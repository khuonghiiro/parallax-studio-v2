import { syncMotionExecution } from './workflowMotionExecution'
import { effectiveTimeParams, isTimeNode } from './workflowTiming'
import type { GlowSide, Layer, LayerGlow, LayerMotionType, Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import {
  generateBlinkKeys,
  generateBreatheKeys,
  generateFadeKeys,
  generatePopInKeys,
  generatePulseKeys,
  generateShakeKeys
} from '../ui/timeline/fxKeyGenerators'
import { deleteLayerEffect, toggleLayerEffect } from '../ui/timeline/timelineEffects'
import {
  spawnWorkflowV2CameraWaypoint,
  syncCameraWaypointNodeToProject
} from './workflowV2CameraWaypointSync'

export { spawnWorkflowV2CameraWaypoint }
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import {
  bakeClusterCustomActionToScene,
  bakeClusterRigPresetToScene,
  bakeCustomMotionPathToScene,
  clearClusterCustomActionKeys,
  clearClusterRigKeysFromScene,
  getClusterMemberLayers,
  getClusterRootLayer,
  getLockedClusterMemberLayers,
  scaleClusterAroundRoot,
  setClusterRootLayer,
  syncPartSwapNodeToProject,
  translateClusterToRootPos
} from './workflowV2ClusterRigAndSwap'
import {
  bakeBboxTargetMotionToScene,
  clearBboxMotionKeysFromScene
} from './workflowV2BboxMotionAndCollision'
import type { ProceduralMotionPreset } from '../ui/layerAssembly/workshopRigPresets'
import {
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  recomputeSharedLogicTargets
} from './workflowV2PhysicsAndValidation'
import { WF_V2_COL_X, layoutWorkflowV2Tree } from './workflowV2Layout'
import {
  applyLogicPresetToNode,
  defaultLogicPreset,
  findLogicPreset,
  type WorkflowV2SpawnCategory
} from './workflowV2LogicPresets'

const NODE_TYPE: Record<WorkflowV2SpawnCategory, WorkflowNode['type']> = {
  action: 'motion_choreography',
  anim_fx: 'motion_choreography',
  rig_bone: 'layer_transform',
  part_swap: 'layer_transform',
  audio: 'audio_lipsync',
  material: 'physics_fx',
  collision: 'physics_fx',
  light: 'physics_fx',
  cave: 'physics_fx',
  fx: 'physics_fx'
}

const AGENT: Record<WorkflowV2SpawnCategory, WorkflowNode['aiAgentRole']> = {
  action: 'MotionChoreographyAgent',
  anim_fx: 'MotionChoreographyAgent',
  rig_bone: 'LayerTransformAgent',
  part_swap: 'LayerTransformAgent',
  audio: 'AudioLipSyncAgent',
  material: 'PhysicsLightFxAgent',
  collision: 'PhysicsLightFxAgent',
  light: 'PhysicsLightFxAgent',
  cave: 'PhysicsLightFxAgent',
  fx: 'PhysicsLightFxAgent'
}

function uniqueNodeId(workflow: WorkflowGraph, base: string): string {
  let id = base
  let i = 2
  while (workflow.nodes.some((n) => n.id === id)) id = `${base}-${i++}`
  return id
}

function withEdge(workflow: WorkflowGraph, nodes: WorkflowNode[], edge: WorkflowEdge): WorkflowGraph {
  const edges = [...workflow.edges, edge]
  return { ...workflow, nodes: layoutWorkflowV2Tree(recomputeSharedLogicTargets(nodes, edges), edges), edges }
}

const layerEdge = (layerNodeId: string, nodeId: string): WorkflowEdge => ({
  id: `e-${layerNodeId}-${nodeId}`,
  fromNode: layerNodeId,
  fromPort: 'layers_tree',
  toNode: nodeId,
  toPort: 'layers_tree'
})

/**
 * Gắn (hoặc tái sử dụng) một Node Logic vào một Node Layer theo mẫu logic chung `presetId`
 * (dùng chung cho Timeline, Workflow và MCP):
 * - Layer đã có logic cùng nhóm → tái sử dụng Node đó (và áp mẫu mới nếu có), không tạo trùng.
 * - Va chạm: ưu tiên ghép làm Layer B vào Node Va chạm cùng cảnh đang chờ; nếu không, tạo Node mới chờ nối Layer B
 *   (không tự đoán đối tượng va chạm).
 * - Id Node xác định theo Layer (`v2-<nhóm>-<layerId>`) để Timeline và Workflow luôn trỏ cùng một Node.
 */
export function attachLogicNodeToLayerV2(
  workflow: WorkflowGraph,
  layerNodeId: string,
  category: WorkflowV2SpawnCategory,
  presetId?: string,
  extraParams?: Partial<WorkflowNodeParams>,
  customTitle?: string
): { workflow: WorkflowGraph; createdNodeId: string; reusedExisting?: boolean; message?: string } {
  const rawTargetNode = workflow.nodes.find((n) => n.id === layerNodeId)
  const isPartHubTarget = Boolean(rawTargetNode?.params?.logicCategory === 'part_swap' && rawTargetNode?.params?.isPartHub)
  const layerNode = isPartHubTarget
    ? (workflow.nodes.find((n) => n.id === rawTargetNode?.params?.hierarchyParentNodeId) ?? rawTargetNode)
    : rawTargetNode
  const isClusterLock = layerNode?.params?.logicCategory === 'cluster_lock'
  if (!layerNode || ((!isClusterLock && !isPartHubTarget && layerNode.type !== 'layer_assembly') || layerNode.params?.groupKind)) {
    return { workflow, createdNodeId: '', message: 'Không tìm thấy Node Layer hoặc Khoá Cụm mục tiêu.' }
  }
  const chosen = (presetId ? findLogicPreset(presetId) : undefined) ?? defaultLogicPreset(category)
  const wantedPartGroupId = extraParams?.partGroupId

  // Nếu gắn một Bộ phận con cụ thể (`wantedPartGroupId`) vào Cụm 2.5D -> gắn làm Node con dưới Node Bộ phận chính (Hub)
  if (category === 'part_swap' && isClusterLock && wantedPartGroupId) {
    const hubRes = isPartHubTarget && rawTargetNode
      ? { workflow, createdNodeId: rawTargetNode.id }
      : attachLogicNodeToLayerV2(workflow, layerNode.id, 'part_swap', 'v2:part_swap:expr_happy', { isPartHub: true }, 'Bộ phận: Cụm 2.5D')
    const curWf = hubRes.workflow
    const hubNode = curWf.nodes.find((n) => n.id === hubRes.createdNodeId)!
    const existingChild = curWf.nodes.find(
      (n) =>
        n.params?.logicCategory === 'part_swap' &&
        n.params?.isPartChild &&
        n.params?.partGroupId === wantedPartGroupId &&
        (n.params?.hierarchyParentNodeId === hubNode.id ||
          curWf.edges.some((e) => e.fromNode === hubNode.id && e.toNode === n.id))
    )
    if (existingChild) {
      const updatedNodes = curWf.nodes.map((n) =>
        n.id === existingChild.id
          ? {
              ...n,
              title: customTitle ?? n.title,
              params: { ...(n.params ?? {}), ...(extraParams ?? {}), isPartChild: true, hierarchyParentNodeId: hubNode.id }
            }
          : n.id === hubNode.id && n.params?.hiddenPartGroupIds?.includes(wantedPartGroupId)
            ? {
                ...n,
                params: {
                  ...n.params,
                  hiddenPartGroupIds: n.params.hiddenPartGroupIds.filter((id) => id !== wantedPartGroupId)
                }
              }
            : n
      )
      return {
        workflow: { ...curWf, nodes: updatedNodes },
        createdNodeId: existingChild.id,
        reusedExisting: true
      }
    }
    const instId = layerNode.params?.instanceId ?? layerNode.id
    const childId = uniqueNodeId(curWf, `v2-partchild-${instId}-${wantedPartGroupId.replace(/[^a-zA-Z0-9_-]/g, '')}`)
    const startSec = extraParams?.timeStart ?? hubNode.params?.timeStart ?? layerNode.params?.timeStart ?? 0
    const endSec = extraParams?.timeEnd ?? hubNode.params?.timeEnd ?? layerNode.params?.timeEnd ?? 5
    const childNode: WorkflowNode = {
      id: childId,
      type: 'layer_assembly',
      title: customTitle ?? `Bộ phận: ${extraParams?.partGroupTitle ?? wantedPartGroupId}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC + 356 * 2, y: hubNode.position.y },
      preset: 'composite_part_swap',
      aiAgentRole: 'AssemblyRigAgent',
      aiDirective: `${customTitle ?? wantedPartGroupId} thuộc "${layerNode.title}".`,
      params: {
        shotId: layerNode.params?.shotId,
        logicCategory: 'part_swap',
        isPartChild: true,
        partGroupId: wantedPartGroupId,
        partGroupTitle: extraParams?.partGroupTitle ?? wantedPartGroupId,
        partIcon: extraParams?.partIcon,
        instanceId: layerNode.params?.instanceId,
        compositeId: layerNode.params?.compositeId,
        targetMode: 'custom',
        targetLayerIds: [...(extraParams?.targetLayerIds ?? layerNode.params?.targetLayerIds ?? [])],
        sharedLayerNodeIds: [hubNode.id],
        requireLayerConnection: true,
        hierarchyParentNodeId: hubNode.id,
        swapMode: wantedPartGroupId === 'face' ? 'expression' : 'part_variant',
        timeStart: startSec,
        timeEnd: endSec,
        ...(extraParams ?? {})
      }
    }
    return {
      workflow: withEdge(curWf, [...curWf.nodes, childNode], layerEdge(hubNode.id, childId)),
      createdNodeId: childId
    }
  }

  const existing = workflow.edges
    .filter((e) => e.fromNode === layerNode.id && !e.disabled)
    .map((e) => workflow.nodes.find((n) => n.id === e.toNode))
    .find((n) => {
      if (n?.params?.logicCategory !== category) return false
      if (category === 'part_swap' && isClusterLock) return Boolean(n.params?.isPartHub || !n.params?.isPartChild)
      if (category === 'part_swap' && wantedPartGroupId) {
        return (n.params?.partGroupId ?? '') === wantedPartGroupId
      }
      return true
    })
  if (existing) {
    const nodes = workflow.nodes.map((n) => {
      if (n.id !== existing.id) return n
      const presetApplied = presetId ? applyLogicPresetToNode(n, chosen) : n
      return {
        ...presetApplied,
        title: customTitle ?? presetApplied.title,
        params: {
          ...(presetApplied.params ?? {}),
          ...(extraParams ?? {})
        }
      }
    })
    return {
      workflow: { ...workflow, nodes },
      createdNodeId: existing.id,
      reusedExisting: true,
      message: presetId
        ? `"${layerNode.title}" đã có Node ${chosen.title.split(':')[0]} — đã chuyển Node đó sang "${customTitle ?? chosen.label}".`
        : `"${layerNode.title}" đã có "${existing.title}" — chọn Node này để tránh trùng logic.`
    }
  }
  if (category === 'collision') {
    const open = workflow.nodes.find(
      (n) =>
        n.params?.logicCategory === 'collision' &&
        (n.params?.sharedLayerNodeIds?.length ?? 0) < 2 &&
        n.params?.shotId === layerNode.params?.shotId
    )
    if (open) {
      return {
        workflow: withEdge(workflow, workflow.nodes, layerEdge(layerNodeId, open.id)),
        createdNodeId: open.id,
        reusedExisting: true,
        message: `Đã ghép "${layerNode.title}" làm Layer B cho "${open.title}".`
      }
    }
  }
  const suffix = layerNodeId.replace(/^v2-(layer|cluster)-/, '')
  const partSuffix = category === 'part_swap' && wantedPartGroupId ? `-${wantedPartGroupId.replace(/[^a-zA-Z0-9_-]/g, '')}` : ''
  const id = uniqueNodeId(workflow, `v2-${category}-${suffix}${partSuffix}`)
  const startSec = layerNode.params?.timeStart ?? 0
  const layerEndSec = layerNode.params?.timeEnd ?? 5
  const animDefaultDur =
    category === 'anim_fx' && chosen.params.animFxPreset
      ? (WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === chosen.params.animFxPreset)?.defaultDuration ?? 0.6)
      : undefined
  const endSec =
    animDefaultDur !== undefined
      ? Number(Math.max(startSec + 0.2, Math.min(layerEndSec, startSec + animDefaultDur)).toFixed(2))
      : layerEndSec
  const baseNode: WorkflowNode = applyLogicPresetToNode(
    {
      id,
      type: NODE_TYPE[category],
      title: customTitle ?? chosen.title,
      enabled: true,
      position: { x: isClusterLock ? WF_V2_COL_X.LOGIC + 356 : WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: category === 'action' || category === 'anim_fx' ? 'organic_wind_breathe' : category === 'audio' ? 'auto_dialogue_lipsync' : 'rim_glow_particles',
      aiAgentRole: AGENT[category],
      aiDirective: `${customTitle ?? chosen.title} cho "${layerNode.title}".`,
      params: {
        shotId: layerNode.params?.shotId,
        logicCategory: category,
        targetMode: 'custom',
        targetLayerIds: [...(layerNode.params?.targetLayerIds ?? [])],
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        timeStart: startSec,
        timeEnd: endSec,
        hierarchyParentNodeId: layerNodeId,
        ...(layerNode.params?.instanceId ? { instanceId: layerNode.params.instanceId } : {}),
        ...(category === 'collision' ? { strikerLayerId: layerNode.params?.targetLayerIds?.[0] } : {})
      }
    },
    chosen
  )
  const node: WorkflowNode = {
    ...baseNode,
    title: customTitle ?? baseNode.title,
    params: {
      ...(baseNode.params ?? {}),
      ...(extraParams ?? {})
    }
  }
  return {
    workflow: withEdge(workflow, [...workflow.nodes, node], layerEdge(layerNodeId, id)),
    createdNodeId: id,
    message: category === 'collision' ? 'Đã tạo Node Va chạm — nối thêm 1 Layer (Layer B) để va chạm có hiệu lực.' : undefined
  }
}

/** Đồng bộ Node Âm thanh xuống các track đang gắn vào Layer đích (âm lượng, tắt tiếng, nhép môi, mốc bắt đầu) */
function syncAudioNodeToProject(project: Project, node: WorkflowNode, params: WorkflowNodeParams, timeEdited: boolean): void {
  const targets = new Set(params.targetLayerIds ?? [])
  const instanceIds = new Set(
    project.layers
      .filter((l) => targets.has(l.id))
      .flatMap((l) => [l.composite?.instanceId, l.model3d?.instanceId])
      .filter((v): v is string => Boolean(v))
  )
  for (const tr of getProjectAudioTracks(project)) {
    if (!tr.targetId || (!targets.has(tr.targetId) && !instanceIds.has(tr.targetId))) continue
    tr.muted = !node.enabled
    if (typeof params.intensity === 'number') tr.volume = Math.max(0, Math.min(2, params.intensity))
    tr.lipSyncEnabled = Boolean(params.autoLipSync)
    if (timeEdited && typeof params.timeStart === 'number') tr.offset = Math.max(0, params.timeStart)
  }
}

/**
 * Đồng bộ Node Layer / Group xuống Layer thật:
 * - Bật/tắt Node = ẩn/hiện Layer.
 * - Node Layer: chỉ ghi inPoint/outPoint khi người dùng thực sự đổi khoảng mốc (hoặc áp dụng toàn bộ),
 *   và ghi toạ độ X/Y/Z. Nếu là mảnh con trong Cụm 2.5D thì cập nhật cả `composite.rootOffset` so với gốc neo.
 * - Node Group: TUYỆT ĐỐI không san phẳng khoảng thời gian của các Layer con; khi người dùng thu hẹp
 *   khoảng mốc của Group thì chỉ cắt các Layer con vào trong khoảng đó.
 */
function syncLayerOrGroupNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const timeEdited = !patch || 'timeStart' in patch || 'timeEnd' in patch
  const tStart = typeof params.timeStart === 'number' && Number.isFinite(params.timeStart) ? params.timeStart : undefined
  const tEnd = typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd) ? params.timeEnd : undefined
  const isGroup = Boolean(params.groupKind)
  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    l.visible = node.enabled
    if (isGroup) {
      if (!patch || !timeEdited || tStart === undefined || tEnd === undefined) continue
      const nextIn = Math.min(Math.max(l.inPoint ?? 0, tStart), tEnd - 0.1)
      const nextOut = Math.max(Math.min(l.outPoint ?? tEnd, tEnd), nextIn + 0.1)
      l.inPoint = Number(Math.max(0, nextIn).toFixed(2))
      l.outPoint = Number(nextOut.toFixed(2))
      continue
    }
    if (timeEdited && tStart !== undefined) l.inPoint = Math.max(0, tStart)
    if (timeEdited && tEnd !== undefined && tEnd > (l.inPoint ?? 0)) l.outPoint = tEnd
    if (l.transform?.position?.value) {
      const curPos = l.transform.position.value
      const nx = typeof params.transformX === 'number' ? params.transformX : curPos[0]
      const ny = typeof params.transformY === 'number' ? params.transformY : curPos[1]
      const nz = typeof params.transformZ === 'number' ? params.transformZ : curPos[2]
      l.transform.position.value = [nx, ny, nz]
      if (l.composite?.instanceId && patch && ('transformX' in patch || 'transformY' in patch || 'transformZ' in patch)) {
        const members = getClusterMemberLayers(project, l.composite.instanceId)
        const root = getClusterRootLayer(members)
        if (root && root.id !== l.id) {
          const rp = root.transform.position?.value ?? [0, 0, 0]
          l.composite.rootOffset = [
            Number((nx - rp[0]).toFixed(2)),
            Number((ny - rp[1]).toFixed(2)),
            Number((nz - rp[2]).toFixed(2))
          ]
        }
      }
    }
  }
}

/** Đồng bộ Node Hoạt ảnh FX (`anim_fx`) xuống `layer.appliedEffects` (và keyframe / glow tương ứng) */
function syncAnimFxNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const presetId = params.animFxPreset ?? 'popIn'
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]
  const tol = 1 / Math.max(1, (project.comp.fps || 30) * 2)

  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    const nonMotionList = (l.appliedEffects ?? []).filter((f) => f.category !== 'motion')
    if (!node.enabled) {
      for (const fx of nonMotionList) {
        if (fx.enabled) toggleLayerEffect(l, fx.id, false)
      }
      continue
    }

    const existingFx = nonMotionList[nonMotionList.length - 1]
    if (existingFx && existingFx.presetId === presetId && !patch) {
      if (!existingFx.enabled) toggleLayerEffect(l, existingFx.id, true)
      continue
    }

    if (existingFx) {
      deleteLayerEffect(l, existingFx.id)
    }

    const start = Math.max(0, params.timeStart ?? existingFx?.startTime ?? l.inPoint ?? 0)
    const rawEnd = params.timeEnd ?? (start + opt.defaultDuration)
    const duration = Math.max(0.1, Number((rawEnd - start).toFixed(2)))
    const count = Math.max(1, Math.round(params.animFxCount ?? existingFx?.count ?? opt.defaultCount ?? 2))
    const intensity = params.intensity ?? existingFx?.intensity ?? opt.defaultIntensity ?? 1.2
    const color = params.animFxColor ?? existingFx?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
    const side: GlowSide = params.animFxSide ?? existingFx?.glow?.side ?? 'outer'
    const thickness = params.animFxThickness ?? existingFx?.glow?.thickness ?? 10
    const speed = params.animFxSpeed ?? existingFx?.glow?.speed ?? (duration > 0 ? Math.max(0.5, count / duration) : 1.5)
    const minIntensity = params.animFxMinIntensity ?? existingFx?.glow?.minIntensity ?? 0.15

    let createdKeyIds: string[] = []
    let targetProp: 'opacity' | 'position' | 'scale' | undefined

    if (presetId === 'blink') {
      targetProp = 'opacity'
      createdKeyIds = generateBlinkKeys(l.transform.opacity, start, duration, count, 0.05, tol).map((k) => k.id)
    } else if (presetId === 'fadeOut') {
      targetProp = 'opacity'
      createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'out', tol).map((k) => k.id)
    } else if (presetId === 'fadeIn') {
      targetProp = 'opacity'
      createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'in', tol).map((k) => k.id)
    } else if (presetId === 'breathe') {
      targetProp = 'opacity'
      createdKeyIds = generateBreatheKeys(l.transform.opacity, start, duration, 0.2, tol).map((k) => k.id)
    } else if (presetId === 'shake') {
      targetProp = 'position'
      createdKeyIds = generateShakeKeys(l.transform.position, start, duration, intensity, count, tol).map((k) => k.id)
    } else if (presetId === 'popIn') {
      targetProp = 'scale'
      createdKeyIds = generatePopInKeys(l.transform.scale, start, duration, count, intensity, tol).map((k) => k.id)
    } else if (presetId === 'pulse') {
      targetProp = 'scale'
      createdKeyIds = generatePulseKeys(l.transform.scale, start, duration, count, intensity, tol).map((k) => k.id)
    } else {
      const animated: LayerGlow['animated'] =
        presetId === 'neonBreathe'
          ? 'breathe'
          : presetId === 'neonBlink'
            ? 'blink'
            : presetId === 'neonFlicker'
              ? 'flicker'
              : 'none'
      l.glow = {
        enabled: true,
        startTime: start,
        duration,
        side,
        color,
        thickness,
        intensity,
        animated,
        speed,
        minIntensity
      }
    }

    if (!l.appliedEffects) l.appliedEffects = []
    l.appliedEffects.push({
      id: existingFx?.id ?? `fx-wf-${node.id}`,
      presetId,
      name: opt.label.replace(/^[^\w\p{L}]+\s*/u, ''),
      badge: opt.badge,
      category: opt.fxCategory,
      startTime: start,
      duration,
      enabled: true,
      targetProp,
      keyframeIds: createdKeyIds,
      glow: opt.fxCategory === 'glow' && l.glow ? { ...l.glow } : undefined,
      count: opt.defaultCount !== undefined ? count : undefined,
      intensity: opt.defaultIntensity !== undefined ? intensity : undefined
    })
  }
}

/**
 * Đồng bộ trực tiếp thay đổi trên một Node V2 xuống dữ liệu Project thực tế
 * (bao gồm Node Nhãn Vật liệu, Va chạm Vật lý 2 Layer và Hoạt ảnh FX).
 */
function syncSingleWorkflowV2NodeToProject(
  project: Project,
  node: WorkflowNode,
  patch?: Partial<WorkflowNodeParams>
): void {
  if (isTimeNode(node)) {
    const start = node.params?.timeStart ?? 0, end = node.params?.timeEnd ?? project.comp.duration
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.comp.duration) throw new Error('Khoảng Time không hợp lệ.')
    for (const edge of project.workflow?.edges ?? []) {
      if (edge.fromNode !== node.id || edge.fromPort !== 'time_range') continue
      const target = project.workflow?.nodes.find(n => n.id === edge.toNode)
      if (target) syncWorkflowV2NodeToProject(project, target)
    }
    return
  }
  if (patch && ('timeStart' in patch || 'timeEnd' in patch) && node.params?.localTimeRange) {
    node.params.localTimeRange = { start: patch.timeStart ?? node.params.localTimeRange.start, end: patch.timeEnd ?? node.params.localTimeRange.end }
  }
  const params = effectiveTimeParams(project, node, { ...(node.params ?? {}), ...(patch ?? {}) })
  if (patch && project.workflow) {
    const idx = project.workflow.nodes.findIndex((n) => n.id === node.id)
    if (idx >= 0) {
      const wfNode = project.workflow.nodes[idx]
      project.workflow = {
        ...project.workflow,
        nodes: project.workflow.nodes.map((n, i) =>
          i === idx ? { ...wfNode, params: { ...(wfNode.params ?? {}), ...patch } } : n
        )
      }
    }
  }
  const mergedNode: WorkflowNode = { ...node, params }
  const targetIds = new Set(params.targetLayerIds ?? [])
  const tStart = params.timeStart
  const tEnd = params.timeEnd

  // 0. Node Cảnh (Scene Shot Root)
  if (node.type === 'scene_shot' && params.shotId) {
    const shot = project.shots.find((s) => s.id === params.shotId)
    if (shot) {
      shot.visible = node.enabled
    }
    return
  }

  // 1b. Node Khoá Cụm 2.5D / 3D (`cluster_lock`) — điều khiển khoá cụm, gốc neo và vị trí/tỉ lệ các mảnh ĐANG KHOÁ trong cụm
  if (params.logicCategory === 'cluster_lock') {
    const instId = params.instanceId
    const allMembers = instId ? getClusterMemberLayers(project, instId) : project.layers.filter((l) => targetIds.has(l.id))
    const lockedMembersRaw = instId ? getLockedClusterMemberLayers(project, instId) : allMembers
    const activeMembers =
      targetIds.size > 0 ? lockedMembersRaw.filter((l) => targetIds.has(l.id)) : lockedMembersRaw
    const effectiveMembers = activeMembers.length > 0 ? activeMembers : lockedMembersRaw

    if (!patch || 'lockedGroup' in patch) {
      const nextLocked = node.enabled && (params.lockedGroup ?? true)
      for (const m of allMembers) {
        if (m.composite) m.composite.lockedGroup = nextLocked
        if (m.model3d) m.model3d.lockedGroup = nextLocked
      }
    }
    const timeEdited = Boolean(params.localTimeRange || (patch && ('timeStart' in patch || 'timeEnd' in patch)))
    if (timeEdited) {
      for (const m of effectiveMembers) {
        if (typeof tStart === 'number' && Number.isFinite(tStart)) m.inPoint = Math.max(0, tStart)
        if (typeof tEnd === 'number' && Number.isFinite(tEnd) && tEnd > (m.inPoint ?? 0)) m.outPoint = tEnd
      }
    }
    if (patch?.rootLayerId) {
      setClusterRootLayer(allMembers, patch.rootLayerId)
    }
    if (patch && ('transformX' in patch || 'transformY' in patch || 'transformZ' in patch)) {
      translateClusterToRootPos(effectiveMembers, { x: params.transformX, y: params.transformY, z: params.transformZ })
    }
    if (patch && 'clusterScalePct' in patch && typeof params.clusterScalePct === 'number') {
      scaleClusterAroundRoot(effectiveMembers, params.clusterScalePct)
    }
    return
  }

  // 1c. Node Bộ phận (`part_swap`) — điều khiển ẩn/hiện, biến thể, độ lệch hoặc ảnh bộ phận theo Tab Bộ phận 2.5D / 3D
  if (params.logicCategory === 'part_swap') {
    syncPartSwapNodeToProject(project, mergedNode, params)
    return
  }

  // 1d. Node Gắn Xương (`rig_bone`) — đồng bộ cấu hình gắn xương 2.5D và tư thế khớp cơ bản
  if (params.logicCategory === 'rig_bone') {
    const compInstIds = Array.from(
      new Set(
        project.layers
          .filter((l) => targetIds.has(l.id) && l.composite?.instanceId)
          .map((l) => l.composite!.instanceId!)
      )
    )
    if (params.instanceId && !compInstIds.includes(params.instanceId)) {
      compInstIds.push(params.instanceId)
    }
    for (const instId of compInstIds) {
      const members = getLockedClusterMemberLayers(project, instId)
      if (!node.enabled) {
        clearClusterRigKeysFromScene(members)
      } else if (patch && 'rigActionPreset' in patch && params.rigActionPreset && params.rigActionPreset !== 'none') {
        bakeClusterRigPresetToScene(project, instId, params.rigActionPreset as ProceduralMotionPreset, {
          timeStart: tStart,
          timeEnd: tEnd,
          intensity: params.intensity
        })
      }
    }
    return
  }

  // 1. Node Layer hoặc Group Layer
  if (node.type === 'layer_assembly') {
    syncLayerOrGroupNodeToProject(project, node, params, patch)
    return
  }

  // 2. Node Nhãn Vật liệu (Material Tag)
  if (params.logicCategory === 'material') {
    applyMaterialNodeToProject(project, mergedNode)
    return
  }

  // 3. Node Va chạm Vật lý (2-Layer Collision Physics)
  if (params.logicCategory === 'collision') {
    applyCollisionNodeToProject(project, project.workflow, mergedNode)
    return
  }

  // 3b. Node Animation (`anim_fx`) — hỗ trợ cả Động tác Tên Động Cụm 2.5D, Clip Animation Rig 2.5D và Keyframe / Neon FX
  if (params.logicCategory === 'anim_fx') {
    const firstTargetLayer = project.layers.find((l) => targetIds.has(l.id))
    const effInstId = params.instanceId ?? firstTargetLayer?.composite?.instanceId
    if (params.customActionId && params.animMode !== 'keyframe_fx') {
      if (!node.enabled) {
        clearClusterCustomActionKeys(getClusterMemberLayers(project, effInstId, firstTargetLayer), node.id)
      } else {
        bakeClusterCustomActionToScene(project, effInstId, params.customActionId, {
          timeStart: tStart,
          timeEnd: tEnd,
          speedHz: params.customActionSpeedHz,
          nodeId: node.id,
          fallbackLayer: firstTargetLayer
        })
      }
      return
    }
    const isRigClipMode =
      params.animMode === 'rig_clip' ||
      (Boolean(params.rigActionPreset && params.rigActionPreset !== 'none') &&
        params.animMode !== 'keyframe_fx' &&
        !(patch && 'animFxPreset' in patch))
    if (isRigClipMode && params.rigActionPreset && params.rigActionPreset !== 'none') {
      const compInstIds = Array.from(
        new Set(
          project.layers
            .filter((l) => targetIds.has(l.id) && l.composite?.instanceId)
            .map((l) => l.composite!.instanceId!)
        )
      )
      if (params.instanceId && !compInstIds.includes(params.instanceId)) {
        compInstIds.push(params.instanceId)
      }
      for (const l of project.layers) {
        if (!targetIds.has(l.id) || !l.appliedEffects) continue
        const staleFx = l.appliedEffects.find((f) => f.id === `fx-wf-${node.id}`)
        if (staleFx) deleteLayerEffect(l, staleFx.id)
      }
      for (const instId of compInstIds) {
        const members = getLockedClusterMemberLayers(project, instId)
        if (!node.enabled) {
          clearClusterRigKeysFromScene(members, node.id)
        } else {
          bakeClusterRigPresetToScene(project, instId, params.rigActionPreset as ProceduralMotionPreset, {
            timeStart: tStart,
            timeEnd: tEnd,
            intensity: params.intensity,
            nodeId: node.id
          })
        }
      }
      return
    } else if (patch && ('rigActionPreset' in patch || 'animMode' in patch) && (params.rigActionPreset === 'none' || params.animMode === 'keyframe_fx')) {
      const compInstIds = Array.from(
        new Set(
          project.layers
            .filter((l) => targetIds.has(l.id) && l.composite?.instanceId)
            .map((l) => l.composite!.instanceId!)
        )
      )
      for (const instId of compInstIds) {
        clearClusterRigKeysFromScene(getClusterMemberLayers(project, instId), node.id)
      }
      if (!params.animFxPreset && params.animMode !== 'keyframe_fx') return
    }
    syncAnimFxNodeToProject(project, node, params, patch)
    return
  }

  // 4. Node Motion (`action`) — hỗ trợ Đặt BBox Đích (`bbox`), Vẽ quỹ đạo chuyển động (`path`) và Chuyển động chu kỳ (`cycle`)
  if (node.type === 'motion_choreography' || params.logicCategory === 'action') {
    const isBboxMode =
      params.motionMode === 'bbox' ||
      params.actionPreset === 'bbox_target' ||
      Boolean(patch && ('bboxTargetX' in patch || 'bboxTargetY' in patch || 'bboxTargetScalePct' in patch || 'depthMode' in patch))
    if (isBboxMode) {
      if (node.enabled) {
        bakeBboxTargetMotionToScene(project, Array.from(targetIds), params, node.id)
      } else {
        clearBboxMotionKeysFromScene(project, node.id)
      }
      for (const l of project.layers) {
        if (targetIds.has(l.id) && l.motion) {
          l.motion.enabled = false
        }
      }
      return
    }
    clearBboxMotionKeysFromScene(project, node.id)
    const isPathMode =
      params.motionMode === 'path' ||
      params.actionPreset === 'custom_draw' ||
      (Boolean(params.customMotionPath && params.customMotionPath.length >= 2) &&
        !(patch && 'actionPreset' in patch && patch.actionPreset !== 'custom_draw'))
    if (isPathMode && params.customMotionPath && params.customMotionPath.length >= 2) {
      if (node.enabled) {
        bakeCustomMotionPathToScene(project, Array.from(targetIds), params.customMotionPath, {
          timeStart: tStart,
          timeEnd: tEnd,
          intensity: params.intensity,
          loop: params.customMotionLoop,
          cycleDuration: params.customMotionCycleSec,
          nodeId: node.id
        })
      } else {
        bakeCustomMotionPathToScene(project, Array.from(targetIds), [], { nodeId: node.id })
      }
      for (const l of project.layers) {
        if (targetIds.has(l.id) && l.motion) {
          l.motion.enabled = false
        }
      }
      return
    }
    const rigPreset =
      params.rigActionPreset ||
      (params.actionPreset?.startsWith('rig_') ? params.actionPreset.replace(/^rig_/, '') : undefined)
    if (rigPreset) {
      const compInstIds = Array.from(
        new Set(
          project.layers
            .filter((l) => targetIds.has(l.id) && l.composite?.instanceId)
            .map((l) => l.composite!.instanceId!)
        )
      )
      for (const instId of compInstIds) {
        const members = getLockedClusterMemberLayers(project, instId)
        if (!node.enabled || rigPreset === 'none') {
          clearClusterRigKeysFromScene(members, node.id)
        } else {
          bakeClusterRigPresetToScene(project, instId, rigPreset as ProceduralMotionPreset, {
            timeStart: tStart,
            timeEnd: tEnd,
            intensity: params.intensity,
            nodeId: node.id
          })
        }
      }
      if (params.actionPreset?.startsWith('rig_')) {
        return
      }
    }
    const actOpt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === params.actionPreset)
    let memberIdx = 0
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const motionType = (actOpt?.motionType ?? (params.actionPreset as LayerMotionType | undefined) ?? l.motion?.type ?? 'float') as LayerMotionType
      if (!node.enabled) {
        l.motion = { ...(l.motion ?? { speed: 1, amount: 0, amplitude: [8, 12, 0] }), type: motionType, enabled: false }
        continue
      }
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      l.motion = {
        amplitude: [8, 12, 0],
        ...(l.motion ?? {}),
        enabled: true,
        type: motionType,
        speed: actOpt?.defaultSpeed ?? l.motion?.speed ?? 1,
        amount: Math.max(0.1, Math.min(2.0, params.intensity ?? actOpt?.defaultAmount ?? 0.6)),
        phase: params.staggerPhase ? Number((memberIdx * 0.35).toFixed(2)) : (l.motion?.phase ?? 0),
        startTime: startSec,
        duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
      }
      memberIdx++
    }
    return
  }

  // 4b. Node Âm thanh — ghi xuống track âm thanh đang gắn vào Layer
  if (node.type === 'audio_lipsync' || params.logicCategory === 'audio') {
    syncAudioNodeToProject(project, node, params, !patch || 'timeStart' in patch)
    return
  }

  // 5. Node Hang động / Vùng độ sâu (Cave Depth Portal)
  if (params.logicCategory === 'cave') {
    const archShape = params.caveArchShape ?? 'arch'
    const darkness = Math.max(0.1, Math.min(1.0, params.caveDarkness ?? params.intensity ?? 0.82))
    const minScale = params.caveMinScale ?? 0.38
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const prevPortal = l.physics?.depthPortal
      l.physics = {
        ...(l.physics ?? { enabled: true, material: 'none' }),
        enabled: node.enabled,
        colliderZone: 'cave_portal',
        depthPortal: {
          centerUV: prevPortal?.centerUV ?? [0.5, 0.45],
          radiusUV: prevPortal?.radiusUV ?? [0.35, 0.35],
          shadowTint: prevPortal?.shadowTint ?? '#060812',
          depthPullZ: prevPortal?.depthPullZ ?? 140,
          feather: prevPortal?.feather ?? 0.55,
          ...(prevPortal ?? {}),
          enabled: node.enabled,
          minScale,
          darkness,
          archShape
        }
      }
    }
    return
  }

  // 6. Node Ánh sáng (Light)
  if (params.logicCategory === 'light') {
    const color = params.lightColor || '#38bdf8'
    const intensity = params.intensity ?? 1.3
    const mode = params.lightMode || 'rim'
    const lightOpt =
      WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === mode) ?? WORKFLOW_V2_LIGHT_OPTIONS[0]
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      if (mode === 'glow' || mode === 'rim') {
        l.glow = {
          ...(l.glow ?? {}),
          enabled: node.enabled,
          color,
          intensity: Math.min(3, intensity),
          thickness: l.glow?.thickness ?? 12,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
      const prevVl = l.virtualLight
      l.virtualLight = {
        radius: prevVl?.radius ?? 460,
        originUV: prevVl?.originUV ?? [0.5, 0.5],
        zReach: prevVl?.zReach ?? 320,
        ...(prevVl ?? {}),
        enabled: node.enabled,
        kind: lightOpt.virtualKind,
        color,
        intensity
      }
    }
    return
  }

  // 7. Node Hiệu ứng & Vật lý (FX)
  if (params.logicCategory === 'fx') {
    const fxKind = params.fxKind || 'wind_physics'
    const intensity = params.intensity ?? 1.0
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      if (fxKind === 'wind_physics') {
        l.physics = {
          ...(l.physics ?? { material: 'foliage_bush' }),
          enabled: node.enabled,
          material: l.physics?.material ?? 'foliage_bush',
          stiffness: 0.8 * intensity,
          damping: 0.35,
          bounciness: 0.9 * intensity
        }
      } else {
        const startSec = tStart ?? l.inPoint ?? 0
        const endSec = tEnd ?? l.outPoint ?? project.comp.duration
        l.glow = {
          enabled: node.enabled,
          color: fxKind === 'chromatic' ? '#a855f7' : '#38bdf8',
          intensity: Math.min(3, intensity * 1.4),
          thickness: 10,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
    }
    return
  }

  // 8. Node Camera 3D hoặc Node con lộ trình quay / cảnh con của Camera
  if (node.type === 'camera_director' || params.logicCategory === 'camera') {
    if (params.isCameraWaypoint) {
      syncCameraWaypointNodeToProject(project, node, params, patch)
      return
    }
    if (project.camera) {
      if (typeof params.enableDof === 'boolean') project.camera.dofEnabled = params.enableDof
      if (typeof params.camShakeAmount === 'number') project.camera.shakeAmount = params.camShakeAmount
      if (typeof params.camShakeSpeed === 'number') project.camera.shakeSpeed = params.camShakeSpeed
    }
  }
}

export { spawnTimedFollowupNodeV2 } from './workflowTimedSteps'

export function syncWorkflowV2NodeToProject(project: Project, node: WorkflowNode, patch?: Partial<WorkflowNodeParams>): void {
  syncMotionExecution(project, node, patch, syncSingleWorkflowV2NodeToProject)
}
