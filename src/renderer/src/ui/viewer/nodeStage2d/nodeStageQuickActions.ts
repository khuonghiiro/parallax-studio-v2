import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { referenceDistance } from '../../../animation/math'
import { bboxStartPosition } from '../../../project/workflowMotionStart'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import {
  attachLogicNodeToLayerV2,
  evaluateCleanLayerPos,
  getClusterMemberLayers,
  getClusterRootLayer,
  scaleClusterAroundRoot,
  snapCameraToEntityBBox,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  translateClusterToRootPos,
  v2CameraId,
  v2ClusterLockId,
  v2LayerNodeId
} from '../../../project/workflowV2Engine'
import {
  computeShotStageLayout,
  extractCameraFrames2D
} from '../animateCamera/animateCameraMath'
import {
  enrichCameraWaypoints,
  ensureShotWaypointTime,
  panCameraToLayer2D,
  updateCameraWaypoint
} from '../animateCamera/animateCameraRouteLogic'
import { resolveActiveMotionNode } from '../../workflow/WorkflowV2StageBboxHelpers'

export type StageQuickAlignPreset = 'left' | 'center' | 'right' | 'top' | 'ground'

export interface StageContextHitInfo {
  clientX: number
  clientY: number
  worldX: number
  worldY: number
  screenOffsetX: number
  screenOffsetY: number
  shotId: string | null
  hitLayerId: string | null
  hitWaypointNodeId: string | null
}

/** Tính hệ số phối cảnh 2.5D `1 / (Z + refD)` tại độ sâu Z của đối tượng */
export function perspectiveFactorForLayer(project: Project, zDepth: number): number {
  const refD = Math.max(100, referenceDistance(project.comp))
  return refD / Math.max(80, refD + zDepth)
}

/** Lật ngang đối tượng đơn lẻ hoặc toàn bộ Cụm 2.5D quanh trục trung tâm của gốc neo */
export function flipEntityHorizontalInDraft(
  draft: Project,
  layerId: string,
  useCluster: boolean,
  activeNode?: WorkflowNode | null
): boolean {
  const baseLayer = draft.layers.find((l) => l.id === layerId)
  if (!baseLayer) return false
  const instId = baseLayer.composite?.instanceId ?? baseLayer.model3d?.instanceId

  if (useCluster && instId) {
    const members = getClusterMemberLayers(draft, instId, baseLayer)
    const root = getClusterRootLayer(members) ?? baseLayer
    const rootX = root.transform.position.value[0] ?? 0

    for (const m of members) {
      const s = m.transform.scale.value
      m.transform.scale.value = [-(s[0] || 1), s[1] || 1, s[2] ?? 1]
      for (const kf of m.transform.scale.keyframes) {
        kf.value = [-(kf.value[0] || 1), kf.value[1] || 1, kf.value[2] ?? 1]
      }
      const rotZ = m.transform.rotation.value[2] ?? 0
      if (Math.abs(rotZ) > 0.01) {
        m.transform.rotation.value = [m.transform.rotation.value[0], m.transform.rotation.value[1], -rotZ]
      }
      if (m.id !== root.id) {
        const dx = (m.transform.position.value[0] ?? 0) - rootX
        const mirroredX = Math.round((rootX - dx) * 100) / 100
        m.transform.position.value = [mirroredX, m.transform.position.value[1], m.transform.position.value[2]]
        if (m.composite?.rootOffset) {
          m.composite.rootOffset = [
            -m.composite.rootOffset[0],
            m.composite.rootOffset[1],
            m.composite.rootOffset[2]
          ]
        }
      }
    }
    if (draft.workflow && activeNode) {
      const actMot = resolveActiveMotionNode(draft.workflow, activeNode, root.id, instId)
      if (actMot) syncWorkflowV2NodeToProject(draft, actMot)
    }
    return true
  }

  const s = baseLayer.transform.scale.value
  baseLayer.transform.scale.value = [-(s[0] || 1), s[1] || 1, s[2] ?? 1]
  for (const kf of baseLayer.transform.scale.keyframes) {
    kf.value = [-(kf.value[0] || 1), kf.value[1] || 1, kf.value[2] ?? 1]
  }
  return true
}

/** Căn nhanh vị trí đối tượng hoặc Cụm 2.5D lên 5 vùng vàng của khung 16:9 (có bù phối cảnh chiều sâu Z) */
export function alignEntityOnStageInDraft(
  draft: Project,
  layerId: string,
  preset: StageQuickAlignPreset,
  useCluster: boolean,
  activeNode?: WorkflowNode | null
): boolean {
  const baseLayer = draft.layers.find((l) => l.id === layerId)
  if (!baseLayer) return false
  const instId = baseLayer.composite?.instanceId ?? baseLayer.model3d?.instanceId
  const members = useCluster && instId ? getClusterMemberLayers(draft, instId, baseLayer) : []
  const refLayer = (members.length > 0 ? getClusterRootLayer(members) : undefined) ?? baseLayer

  const curPos = evaluateCleanLayerPos(refLayer, refLayer.inPoint ?? 0)
  const pFactor = perspectiveFactorForLayer(draft, curPos[2] ?? 0)
  const compW = Math.max(320, draft.comp.width || 1920)
  const compH = Math.max(180, draft.comp.height || 1080)

  let nextX = curPos[0]
  let nextY = curPos[1]
  if (preset === 'center') {
    nextX = 0
    nextY = 0
  } else if (preset === 'left') {
    nextX = Math.round((-compW * 0.29) / pFactor)
  } else if (preset === 'right') {
    nextX = Math.round((compW * 0.29) / pFactor)
  } else if (preset === 'top') {
    nextY = Math.round((compH * 0.25) / pFactor)
  } else if (preset === 'ground') {
    nextY = Math.round((-compH * 0.17) / pFactor)
  }

  return setEntityWorldPositionInDraft(draft, layerId, { x: nextX, y: nextY }, useCluster, activeNode)
}

/** Đặt toạ độ không gian `(x, y, z)` cho Layer hoặc toàn bộ Cụm 2.5D và đồng bộ Node tương ứng */
export function setEntityWorldPositionInDraft(
  draft: Project,
  layerId: string,
  pos: Partial<{ x: number; y: number; z: number }>,
  useCluster: boolean,
  activeNode?: WorkflowNode | null
): boolean {
  const baseLayer = draft.layers.find((l) => l.id === layerId)
  if (!baseLayer) return false
  const instId = baseLayer.composite?.instanceId ?? baseLayer.model3d?.instanceId

  if (useCluster && instId) {
    const members = getClusterMemberLayers(draft, instId, baseLayer)
    if (members.length === 0) return false
    translateClusterToRootPos(members, pos)
    const root = getClusterRootLayer(members) ?? baseLayer
    const cNode = draft.workflow?.nodes.find((n) => n.id === v2ClusterLockId(instId))
    if (cNode?.params) {
      if (pos.x !== undefined) cNode.params.transformX = Math.round(pos.x)
      if (pos.y !== undefined) cNode.params.transformY = Math.round(pos.y)
      if (pos.z !== undefined) cNode.params.transformZ = Math.round(pos.z)
    }
    if (draft.workflow && activeNode) {
      const actMot = resolveActiveMotionNode(draft.workflow, activeNode, root.id, instId)
      if (actMot) syncWorkflowV2NodeToProject(draft, actMot)
    }
    return true
  }

  const cur = baseLayer.transform.position.value
  const nx = pos.x !== undefined ? Math.round(pos.x) : cur[0]
  const ny = pos.y !== undefined ? Math.round(pos.y) : cur[1]
  const nz = pos.z !== undefined ? Math.round(pos.z) : cur[2]
  baseLayer.transform.position.value = [nx, ny, nz]

  if (baseLayer.composite?.instanceId) {
    const members = getClusterMemberLayers(draft, baseLayer.composite.instanceId, baseLayer)
    const root = getClusterRootLayer(members)
    if (root && root.id !== baseLayer.id) {
      const rp = root.transform.position.value
      baseLayer.composite.rootOffset = [
        Math.round((nx - rp[0]) * 100) / 100,
        Math.round((ny - rp[1]) * 100) / 100,
        Math.round((nz - rp[2]) * 100) / 100
      ]
    }
  }

  const wfNode = draft.workflow?.nodes.find((n) => n.id === v2LayerNodeId(baseLayer.id))
  if (wfNode?.params) {
    wfNode.params.transformX = nx
    wfNode.params.transformY = ny
    wfNode.params.transformZ = nz
  }
  if (draft.workflow && activeNode) {
    const actMot = resolveActiveMotionNode(draft.workflow, activeNode, baseLayer.id, instId)
    if (actMot) syncWorkflowV2NodeToProject(draft, actMot)
  }
  return true
}

/** Đẩy lùi hoặc kéo gần đối tượng theo trục chiều sâu 2.5D (`deltaZ < 0`: gần Camera, `deltaZ > 0`: lùi hậu cảnh) */
export function stepEntityDepthZInDraft(
  draft: Project,
  layerId: string,
  deltaZ: number,
  useCluster: boolean,
  activeNode?: WorkflowNode | null
): number | null {
  const baseLayer = draft.layers.find((l) => l.id === layerId)
  if (!baseLayer) return null
  const instId = baseLayer.composite?.instanceId ?? baseLayer.model3d?.instanceId
  const members = useCluster && instId ? getClusterMemberLayers(draft, instId, baseLayer) : []
  const refLayer = (members.length > 0 ? getClusterRootLayer(members) : undefined) ?? baseLayer
  const curZ = refLayer.transform.position.value[2] ?? 0
  const nextZ = Math.max(-900, Math.min(2400, Math.round(curZ + deltaZ)))
  setEntityWorldPositionInDraft(draft, layerId, { z: nextZ }, useCluster, activeNode)
  return nextZ
}

/** Đặt lại kích thước chuẩn (100% cho Layer đơn, 72% chuẩn sân khấu cho Cụm 2.5D) */
export function resetEntityScaleInDraft(draft: Project, layerId: string, useCluster: boolean): boolean {
  const baseLayer = draft.layers.find((l) => l.id === layerId)
  if (!baseLayer) return false
  const instId = baseLayer.composite?.instanceId ?? baseLayer.model3d?.instanceId
  if (useCluster && instId) {
    const members = getClusterMemberLayers(draft, instId, baseLayer)
    if (members.length === 0) return false
    scaleClusterAroundRoot(members, 72)
    return true
  }
  const signX = (baseLayer.transform.scale.value[0] ?? 1) < 0 ? -1 : 1
  baseLayer.transform.scale.value = [signX, 1, 1]
  return true
}

/**
 * Đặt BBox Đích `#2` ngay tại vị trí con trỏ `(worldX, worldY)` trên sân khấu 2D:
 * - Nếu đã có Node BBox Motion: cập nhật toạ độ Đích tức thì.
 * - Nếu chưa có: tự sinh Node `BBox #1 → #2` nối vào đối tượng và đặt `#2` ngay tại điểm vừa click.
 */
export function placeBbox2TargetAtWorldXYInDraft(
  draft: Project,
  opts: {
    workflow: WorkflowGraph
    activeNode: WorkflowNode | null
    attachTargetNodeId: string
    layer: Layer
    worldX: number
    worldY: number
    currentTime: number
  }
): { nodeId: string; startTime: number } | null {
  const instId = opts.layer.composite?.instanceId ?? opts.layer.model3d?.instanceId
  const wf = (draft.workflow ?? opts.workflow) as WorkflowGraph
  const existing = opts.activeNode
    ? resolveActiveMotionNode(wf, opts.activeNode, opts.layer.id, instId)
    : undefined

  const tx = Math.round(opts.worldX)
  const ty = Math.round(opts.worldY)

  if (existing) {
    const t0 = existing.params?.timeStart ?? opts.layer.inPoint ?? 0
    const startPos = bboxStartPosition(opts.layer, t0, existing.id)
    const nodes = wf.nodes.map((n) =>
      n.id === existing.id
        ? {
            ...n,
            params: {
              ...(n.params ?? {}),
              motionMode: 'bbox' as const,
              actionPreset: 'bbox_target',
              bboxPathType: n.params?.bboxPathType ?? 'shortest',
              bboxTargetX: tx,
              bboxTargetY: ty,
              bboxTargetScalePct: n.params?.bboxTargetScalePct ?? 125,
              bboxStartZ: Math.round(startPos[2]),
              bboxTargetZ: n.params?.bboxTargetZ ?? Math.round(startPos[2])
            }
          }
        : n
    )
    draft.workflow = { ...wf, nodes }
    const updated = nodes.find((n) => n.id === existing.id)
    if (updated) syncWorkflowV2NodeToProject(draft, updated)
    return { nodeId: existing.id, startTime: t0 }
  }

  if (!opts.attachTargetNodeId) return null
  const tStart = Number(Math.max(0, opts.layer.inPoint ?? opts.currentTime).toFixed(2))
  const startPos = bboxStartPosition(opts.layer, tStart)
  const res = attachLogicNodeToLayerV2(
    wf,
    opts.attachTargetNodeId,
    'action',
    'v2:action:bbox_target',
    {
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: 'shortest',
      bboxTargetX: tx,
      bboxTargetY: ty,
      bboxTargetScalePct: 125,
      depthMode: 'flat_2d',
      bboxStartZ: Math.round(startPos[2]),
      bboxTargetZ: Math.round(startPos[2]),
      timeStart: tStart,
      timeEnd: Number((tStart + 3).toFixed(2))
    },
    'Motion: Đặt BBox Đích (đầu → đích)'
  )
  if (!res.createdNodeId) return null
  draft.workflow = res.workflow
  const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
  if (created) {
    draft.comp.duration = Math.max(draft.comp.duration, created.params?.timeEnd ?? 0)
    syncWorkflowV2NodeToProject(draft, created)
  }
  return { nodeId: res.createdNodeId, startTime: tStart }
}

/** Lia khung ngắm Camera hiện tại tới vị trí màn hình `(screenOffsetX, screenOffsetY)` trên Cảnh 2D */
export function aimCameraAtStagePointInDraft(
  draft: Project,
  shotId: string | null,
  screenOffsetX: number,
  screenOffsetY: number,
  atTime: number,
  zDepth = 0
): number {
  const layout = computeShotStageLayout(draft, 0)
  const frames = extractCameraFrames2D(draft, layout)
  const waypoints = enrichCameraWaypoints(frames)
  const shotBox = (shotId ? layout.find((b) => b.shotId === shotId) : null) ?? layout[0]
  if (!shotBox) return atTime

  const activeWp =
    waypoints.find((w) => w.shotId === shotBox.shotId && Math.abs(w.time - atTime) <= 0.5) ??
    waypoints.find((w) => w.shotId === shotBox.shotId) ??
    waypoints[0]

  let targetTime = activeWp?.time ?? atTime
  if (shotBox.shotId && activeWp?.shotId !== shotBox.shotId) {
    targetTime = ensureShotWaypointTime(draft, layout, shotBox.shotId, targetTime, true)
  }
  panCameraToLayer2D(
    draft,
    layout,
    shotBox.shotId,
    screenOffsetX,
    screenOffsetY,
    targetTime,
    activeWp?.scale ?? 0.78,
    activeWp?.ease ?? 'easeInOut',
    zDepth
  )
  draft.workflow = syncWorkflowV2Graph(draft, draft.workflow)
  return targetTime
}

/**
 * 1-Click đồng bộ lộ trình Camera 3D với đối tượng đang chọn trên Màn Khung 2D:
 * - Nếu đang đứng trên Node BBox `#1 → #2`: tự tạo 2 mốc Camera lia bám mượt từ `#1` sang `#2`.
 * - Nếu đang đứng trên Layer / Cụm gốc: bắt khung Camera ôm gọn đối tượng tại mốc hiện tại.
 */
export function syncCamera3DToEntityOrMotionInDraft(
  draft: Project,
  opts: {
    node: WorkflowNode | null
    layer: Layer
    useCluster: boolean
    atTime: number
  }
): { startTime: number; endTime?: number; followedMotion: boolean } | null {
  const instId = opts.layer.composite?.instanceId ?? opts.layer.model3d?.instanceId
  const members = opts.useCluster && instId ? getClusterMemberLayers(draft, instId, opts.layer) : [opts.layer]
  const layerIds = members.length > 0 ? members.map((m) => m.id) : [opts.layer.id]
  const root = getClusterRootLayer(members) ?? opts.layer
  const shotId = opts.node?.params?.shotId ?? root.shotId ?? undefined

  if (opts.node && opts.node.params?.logicCategory === 'action' && opts.node.params?.motionMode === 'bbox') {
    const p = opts.node.params
    const timing = effectiveTimeParams(draft, opts.node, p)
    const tStart = timing.timeStart ?? 0
    const tEnd = timing.timeEnd ?? tStart + 3
    const startPos = bboxStartPosition(root, tStart, opts.node.id)
    const tx = p.bboxTargetX ?? Math.round(startPos[0] + 240)
    const ty = p.bboxTargetY ?? Math.round(startPos[1])
    const res = snapCameraToEntityBBox(draft, {
      shotId,
      layerIds,
      atTime: tStart,
      mode: 'follow_bbox_motion',
      endTime: tEnd,
      startXY: [Math.round(startPos[0]), Math.round(startPos[1])],
      targetXY: [Math.round(tx), Math.round(ty)],
      targetScalePct: p.bboxTargetScalePct ?? 100
    })
    if (!res) return null
    draft.workflow = syncWorkflowV2Graph(draft, draft.workflow, { relayout: true })
    return { ...res, followedMotion: true }
  }

  const res = snapCameraToEntityBBox(draft, {
    shotId,
    layerIds,
    atTime: opts.atTime,
    mode: 'snap_current'
  })
  if (!res) return null
  draft.workflow = syncWorkflowV2Graph(draft, draft.workflow, { relayout: true })
  return { ...res, followedMotion: false }
}

/** Xoay nhanh góc nghiêng 3D (`yaw`) của mốc Camera đang chọn ngay từ Màn Khung 2D */
export function setCameraWaypointYawInDraft(draft: Project, waypointTime: number, yawDeg: number): void {
  const layout = computeShotStageLayout(draft, 0)
  updateCameraWaypoint(draft, layout, waypointTime, { yaw: yawDeg })
  draft.workflow = syncWorkflowV2Graph(draft, draft.workflow)
}

/** Tìm danh sách các Node lộ trình Camera (`#1`, `#2`...) thuộc Cảnh hiện tại để chuyển chế độ 1 chạm */
export function resolveShotCameraRouteNodes(
  project: Project,
  workflow: WorkflowGraph,
  activeNode: WorkflowNode | null,
  activeLayer: Layer | undefined,
  fallbackShotId: string | null
): {
  shotId: string | null
  cameraParentNode: WorkflowNode | null
  waypointNodes: WorkflowNode[]
  entryCameraNode: WorkflowNode | null
} {
  const shotId =
    activeNode?.params?.shotId ??
    activeLayer?.shotId ??
    fallbackShotId ??
    project.shots[0]?.id ??
    null
  if (!shotId) {
    return { shotId: null, cameraParentNode: null, waypointNodes: [], entryCameraNode: null }
  }
  const cameraParentNode = workflow.nodes.find((n) => n.id === v2CameraId(shotId)) ?? null
  const waypointNodes = workflow.nodes
    .filter((n) => n.type === 'camera_director' && Boolean(n.params?.isCameraWaypoint) && n.params?.shotId === shotId)
    .sort((a, b) => (a.params?.waypointLocalIndex ?? 0) - (b.params?.waypointLocalIndex ?? 0))
  const entryCameraNode = waypointNodes[0] ?? cameraParentNode
  return { shotId, cameraParentNode, waypointNodes, entryCameraNode }
}
