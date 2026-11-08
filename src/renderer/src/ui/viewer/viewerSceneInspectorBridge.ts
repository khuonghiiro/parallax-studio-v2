import * as THREE from 'three'
import type { Layer, Project } from '@shared/types'
import { evaluateScene, type EvaluatedLayer } from '../../engine/evaluateScene'
import type { EditorCamera } from '../../engine/EditorCamera'
import type { SceneRenderer } from '../../engine/SceneRenderer'
import { projectPoint } from '../../engine/layerGizmo'
import { toDevice, type Layout } from './viewerLayout'

type Rect = NonNullable<Layout['ed']>
import { findClusterRootLayer, isLayerClusterLocked, useEditor } from '../../store/editor'
import {
  getClusterDisplayName,
  getClusterMemberLayers,
  getClusterPartShortName,
  v2ClusterLockId,
  v2LayerNodeId
} from '../../project/workflowV2Engine'

export interface ScannedSceneCanvasHit {
  layerId: string
  layerName: string
  layerType: string
  shotId: string | null
  shotName: string
  paneKind: 'camera' | 'editor_3d'
  isFocused: boolean
  isPickedByRay: boolean
  selectionScope: 'cluster' | 'layer'
  screenBounds: { left: number; top: number; width: number; height: number }
  position: [number, number, number]
  scale: [number, number, number]
  rotation: [number, number, number]
  opacity: number
  clusterInfo?: {
    instanceId: string
    clusterName: string
    memberCount: number
    rootLayerId: string
    lockedGroup: boolean
    partShortName: string
    clusterScreenBounds: { left: number; top: number; width: number; height: number }
  } | null
  workflowNodeId?: string | null
  connectedLogicSummaries?: string[]
}

function projectEvaluatedLayerScreenBox(
  el: EvaluatedLayer,
  camera: THREE.Camera,
  paneRect: Rect,
  canvasClientLeft: number,
  canvasClientTop: number
): { left: number; top: number; width: number; height: number } | null {
  const center3D = new THREE.Vector3(0, 0, 0).applyMatrix4(el.world)
  const projectedCenter = center3D.clone().project(camera)
  if (projectedCenter.z < -1.05 || projectedCenter.z > 1.05) return null

  const halfW = Math.max(4, el.size[0] / 2)
  const halfH = Math.max(4, el.size[1] / 2)
  const corners: [number, number][] = [
    [-halfW, halfH],
    [halfW, halfH],
    [halfW, -halfH],
    [-halfW, -halfH]
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [cx, cy] of corners) {
    const pt3 = new THREE.Vector3(cx, cy, 0).applyMatrix4(el.world)
    const [px, py] = projectPoint(pt3, camera, paneRect)
    const sx = canvasClientLeft + px
    const sy = canvasClientTop + py
    if (sx < minX) minX = sx
    if (sy < minY) minY = sy
    if (sx > maxX) maxX = sx
    if (sy > maxY) maxY = sy
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null

  const paneLeft = canvasClientLeft + paneRect.x
  const paneTop = canvasClientTop + paneRect.y
  const paneRight = paneLeft + paneRect.w
  const paneBottom = paneTop + paneRect.h

  const clampedLeft = Math.max(paneLeft, Math.min(paneRight, minX))
  const clampedTop = Math.max(paneTop, Math.min(paneBottom, minY))
  const clampedRight = Math.max(paneLeft, Math.min(paneRight, maxX))
  const clampedBottom = Math.max(paneTop, Math.min(paneBottom, maxY))

  const width = Math.round(clampedRight - clampedLeft)
  const height = Math.round(clampedBottom - clampedTop)
  if (width < 4 || height < 4) return null

  return {
    left: Math.round(clampedLeft),
    top: Math.round(clampedTop),
    width,
    height
  }
}

function collectConnectedLogicSummaries(project: Project, layer: Layer): string[] {
  const wf = project.workflow
  if (!wf) return []
  const layerNodeId = v2LayerNodeId(layer.id)
  const instId = layer.composite?.instanceId || layer.model3d?.instanceId
  const clusterNodeId = instId ? v2ClusterLockId(instId) : null

  const summaries: string[] = []
  for (const edge of wf.edges) {
    if (edge.disabled) continue
    const touchesTarget =
      edge.fromNode === layerNodeId ||
      edge.toNode === layerNodeId ||
      (clusterNodeId && (edge.fromNode === clusterNodeId || edge.toNode === clusterNodeId))
    if (!touchesTarget) continue
    const otherId =
      edge.fromNode === layerNodeId || edge.fromNode === clusterNodeId ? edge.toNode : edge.fromNode
    const otherNode = wf.nodes.find((n) => n.id === otherId)
    if (otherNode && otherNode.params?.logicCategory) {
      summaries.push(`${otherNode.title} (${otherNode.id})`)
    }
  }
  return Array.from(new Set(summaries)).slice(0, 6)
}

export function queryViewerSceneLayersInBox(params: {
  box: { left: number; top: number; width: number; height: number }
  canvasEl: HTMLCanvasElement
  renderer: SceneRenderer
  layout: Layout
  edCam: EditorCamera
}): ScannedSceneCanvasHit[] {
  const { box, canvasEl, renderer, layout, edCam } = params
  const canvasRect = canvasEl.getBoundingClientRect()
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return []

  const st = useEditor.getState()
  const { project, time, selectedLayerId, layerSelectionScope, selectedWorkflowNodeId } = st
  const wfNode = selectedWorkflowNodeId
    ? project.workflow?.nodes.find((n) => n.id === selectedWorkflowNodeId)
    : null
  const wfTargetIds = new Set<string>(wfNode?.params?.targetLayerIds ?? [])
  const wfClusterInstId = wfNode?.params?.instanceId ?? null

  const selectedLayerObj = selectedLayerId
    ? project.layers.find((l) => l.id === selectedLayerId)
    : undefined
  const selectedClusterInstId =
    selectedLayerObj?.composite?.instanceId ||
    selectedLayerObj?.model3d?.instanceId ||
    wfClusterInstId ||
    null

  const boxRight = box.left + Math.max(4, box.width)
  const boxBottom = box.top + Math.max(4, box.height)
  const boxCx = box.left + box.width * 0.5
  const boxCy = box.top + box.height * 0.5

  const panes: Array<{ key: 'camera' | 'editor_3d'; rect: Rect }> = []
  if (layout.cam) panes.push({ key: 'camera', rect: layout.cam })
  if (layout.ed) panes.push({ key: 'editor_3d', rect: layout.ed })

  const ev = evaluateScene(project, time)
  const hits: ScannedSceneCanvasHit[] = []

  for (const pane of panes) {
    const paneScreenLeft = canvasRect.left + pane.rect.x
    const paneScreenTop = canvasRect.top + pane.rect.y
    const paneScreenRight = paneScreenLeft + pane.rect.w
    const paneScreenBottom = paneScreenTop + pane.rect.h

    const intersectsPane = !(
      paneScreenRight < box.left ||
      paneScreenLeft > boxRight ||
      paneScreenBottom < box.top ||
      paneScreenTop > boxBottom
    )
    if (!intersectsPane) continue

    const isCameraPane = pane.key === 'camera'
    const camera = isCameraPane
      ? renderer.camera
      : edCam.get(pane.rect.w / Math.max(1, pane.rect.h))

    // 1. Lấy mẫu Raycast / Pixel Pick thực tế trên WebGL để bắt chuẩn layer xếp chồng theo Z & Alpha
    const pickedIds = new Set<string>()
    try {
      renderer.layoutForPick(
        project,
        time,
        toDevice(pane.rect, layout.dpr).h,
        isCameraPane ? undefined : camera
      )
      const ix0 = Math.max(paneScreenLeft, box.left)
      const iy0 = Math.max(paneScreenTop, box.top)
      const ix1 = Math.min(paneScreenRight, boxRight)
      const iy1 = Math.min(paneScreenBottom, boxBottom)
      const samplePoints: Array<[number, number]> = [[(ix0 + ix1) * 0.5, (iy0 + iy1) * 0.5]]
      if (ix1 - ix0 >= 20 && iy1 - iy0 >= 20) {
        for (const ux of [0.25, 0.5, 0.75]) {
          for (const uy of [0.25, 0.5, 0.75]) {
            samplePoints.push([ix0 + (ix1 - ix0) * ux, iy0 + (iy1 - iy0) * uy])
          }
        }
      }
      for (const [sx, sy] of samplePoints) {
        const localX = sx - canvasRect.left
        const localY = sy - canvasRect.top
        const nx = ((localX - pane.rect.x) / Math.max(1, pane.rect.w)) * 2 - 1
        const ny = 1 - ((localY - pane.rect.y) / Math.max(1, pane.rect.h)) * 2
        const picked = renderer.pick(nx, ny, project, camera, isCameraPane, selectedLayerId)
        if (picked) pickedIds.add(picked)
      }
    } catch {
      /* ignore pick error */
    }

    // 2. Chiếu toàn bộ các Layer đang active sang toạ độ màn hình 2D
    const projectedMap = new Map<
      string,
      { el: EvaluatedLayer; bounds: { left: number; top: number; width: number; height: number } }
    >()
    const clusterBoundsMap = new Map<
      string,
      { left: number; top: number; right: number; bottom: number }
    >()

    for (const el of ev.layers) {
      if (!el.active || !el.layer.visible) continue
      const sb = projectEvaluatedLayerScreenBox(
        el,
        camera,
        pane.rect,
        canvasRect.left,
        canvasRect.top
      )
      if (!sb) continue
      projectedMap.set(el.layer.id, { el, bounds: sb })

      const instId = el.layer.composite?.instanceId || el.layer.model3d?.instanceId
      if (instId) {
        const cur = clusterBoundsMap.get(instId)
        const r = sb.left + sb.width
        const b = sb.top + sb.height
        if (!cur) {
          clusterBoundsMap.set(instId, { left: sb.left, top: sb.top, right: r, bottom: b })
        } else {
          cur.left = Math.min(cur.left, sb.left)
          cur.top = Math.min(cur.top, sb.top)
          cur.right = Math.max(cur.right, r)
          cur.bottom = Math.max(cur.bottom, b)
        }
      }
    }

    const paneArea = Math.max(1, pane.rect.w * pane.rect.h)

    for (const [layerId, { el, bounds }] of projectedMap.entries()) {
      const layer = el.layer
      const instId = layer.composite?.instanceId || layer.model3d?.instanceId || null
      const cRaw = instId ? clusterBoundsMap.get(instId) : null
      const clusterScreenBounds = cRaw
        ? {
            left: cRaw.left,
            top: cRaw.top,
            width: Math.max(8, cRaw.right - cRaw.left),
            height: Math.max(8, cRaw.bottom - cRaw.top)
          }
        : null

      const isPickedByRay = pickedIds.has(layerId)
      const isFocused =
        layerId === selectedLayerId ||
        wfTargetIds.has(layerId) ||
        Boolean(instId && instId === selectedClusterInstId)

      const lRight = bounds.left + bounds.width
      const lBottom = bounds.top + bounds.height
      const intersectsLayer = !(
        lRight < box.left ||
        bounds.left > boxRight ||
        lBottom < box.top ||
        bounds.top > boxBottom
      )
      const intersectsCluster = clusterScreenBounds
        ? !(
            clusterScreenBounds.left + clusterScreenBounds.width < box.left ||
            clusterScreenBounds.left > boxRight ||
            clusterScreenBounds.top + clusterScreenBounds.height < box.top ||
            clusterScreenBounds.top > boxBottom
          )
        : false

      if (!isPickedByRay && !intersectsLayer && !(isFocused && intersectsCluster)) {
        continue
      }

      // Tính độ phủ giữa khung quét và layer
      const ix0 = Math.max(bounds.left, box.left)
      const iy0 = Math.max(bounds.top, box.top)
      const ix1 = Math.min(lRight, boxRight)
      const iy1 = Math.min(lBottom, boxBottom)
      const interArea = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0)
      const layerArea = Math.max(1, bounds.width * bounds.height)
      const overlapOfLayer = interArea / layerArea
      const lCx = bounds.left + bounds.width * 0.5
      const lCy = bounds.top + bounds.height * 0.5
      const centerInsideBox =
        lCx >= box.left && lCx <= boxRight && lCy >= box.top && lCy <= boxBottom

      // Loại bỏ các layer nền khổng lồ (chiếm > 72% khung nhìn) nếu không được pick trực tiếp hoặc focus
      const isGiantBackdrop = layerArea / paneArea > 0.72 && !instId
      if (isGiantBackdrop && !isFocused && !isPickedByRay) {
        continue
      }

      if (!isPickedByRay && !isFocused && !centerInsideBox && overlapOfLayer < 0.22) {
        continue
      }

      let clusterInfo: ScannedSceneCanvasHit['clusterInfo'] = null
      if (instId && clusterScreenBounds) {
        const members = getClusterMemberLayers(project, instId, layer)
        const root = findClusterRootLayer(project, layer) ?? members[0] ?? layer
        clusterInfo = {
          instanceId: instId,
          clusterName: getClusterDisplayName(root),
          memberCount: members.length,
          rootLayerId: root.id,
          lockedGroup: isLayerClusterLocked(layer),
          partShortName: getClusterPartShortName(layer),
          clusterScreenBounds
        }
      }

      const useClusterScope = Boolean(
        clusterInfo &&
          (layerSelectionScope === 'cluster' ||
            (clusterInfo.lockedGroup && box.width >= 60 && box.height >= 60))
      )

      const shotObj = layer.shotId ? project.shots.find((s) => s.id === layer.shotId) : project.shots[0]
      const wfLayerNodeId =
        useClusterScope && instId ? v2ClusterLockId(instId) : v2LayerNodeId(layer.id)

      hits.push({
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        shotId: layer.shotId ?? shotObj?.id ?? null,
        shotName: shotObj?.name ?? 'Cảnh 1',
        paneKind: pane.key,
        isFocused,
        isPickedByRay,
        selectionScope: useClusterScope ? 'cluster' : 'layer',
        screenBounds:
          useClusterScope && clusterScreenBounds ? clusterScreenBounds : bounds,
        position: [
          Math.round(el.position[0]),
          Math.round(el.position[1]),
          Math.round(el.position[2])
        ],
        scale: [
          Number(el.scale[0].toFixed(2)),
          Number(el.scale[1].toFixed(2)),
          Number(el.scale[2].toFixed(2))
        ],
        rotation: [
          Math.round(el.rotation[0]),
          Math.round(el.rotation[1]),
          Math.round(el.rotation[2])
        ],
        opacity: Number(el.opacity.toFixed(2)),
        clusterInfo,
        workflowNodeId: wfLayerNodeId,
        connectedLogicSummaries: collectConnectedLogicSummaries(project, layer)
      })
    }
  }

  // Nếu có các layer cụ thể (nhỏ/trung bình hoặc thuộc Cụm 2.5D) đã trúng, lọc bỏ các layer nền lớn ở phía sau
  if (hits.length > 1) {
    const hasSpecificTarget = hits.some((h) => h.isFocused || Boolean(h.clusterInfo))
    if (hasSpecificTarget) {
      const filteredHits = hits.filter(
        (h) =>
          h.isFocused ||
          Boolean(h.clusterInfo) ||
          (h.isPickedByRay && h.screenBounds.width * h.screenBounds.height < 350000)
      )
      if (filteredHits.length > 0) {
        hits.length = 0
        hits.push(...filteredHits)
      }
    }
  }

  // Sắp xếp ưu tiên: Đang Focus/Select -> Trúng Raycast trực tiếp -> Gần tâm khung quét nhất
  hits.sort((a, b) => {
    if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1
    if (a.isPickedByRay !== b.isPickedByRay) return a.isPickedByRay ? -1 : 1
    const aCx = a.screenBounds.left + a.screenBounds.width * 0.5
    const aCy = a.screenBounds.top + a.screenBounds.height * 0.5
    const bCx = b.screenBounds.left + b.screenBounds.width * 0.5
    const bCy = b.screenBounds.top + b.screenBounds.height * 0.5
    return Math.hypot(aCx - boxCx, aCy - boxCy) - Math.hypot(bCx - boxCx, bCy - boxCy)
  })

  // Nếu kết quả đầu tiên đang ở chế độ Cụm 2.5D (selectionScope === 'cluster'), gộp các mảnh trùng lặp cùng cụm lại để báo cáo gọn và rõ
  const deduplicated: ScannedSceneCanvasHit[] = []
  const seenClusterIds = new Set<string>()
  for (const h of hits) {
    if (h.selectionScope === 'cluster' && h.clusterInfo) {
      if (seenClusterIds.has(h.clusterInfo.instanceId)) continue
      seenClusterIds.add(h.clusterInfo.instanceId)
    }
    deduplicated.push(h)
  }

  return deduplicated.slice(0, 6)
}
