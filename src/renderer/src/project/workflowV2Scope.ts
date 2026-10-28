import type { Layer, Project, Shot, WorkflowGraph } from '@shared/types'
import { shotAtTime } from '../animation/cameraPath'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import { enrichCameraWaypoints, type CameraWaypointItem } from '../ui/viewer/animateCamera/animateCameraRouteLogic'

/**
 * Không gian chung của Workflow V2: MỘT đồ thị cho toàn dự án, mỗi Cảnh là một cụm
 * (Root → Camera → Cảnh con lộ trình quay / Group → Layer → Logic). Các cụm nối nhau qua dây Camera theo đúng thứ tự camera đi qua.
 */
export const V2_SHARED_CLUSTER = 'shared'

export const v2RootId = (clusterKey: string): string => `v2-root-${clusterKey}`
export const v2CameraId = (shotId: string): string => `v2-camera-${shotId}`
export const v2CameraWaypointId = (shotId: string, localIdx: number): string => `v2-cam-wp-${shotId}-${localIdx}`
export const v2GroupId = (kind: 'group_3d' | 'group_25d' | 'group_env', clusterKey: string): string =>
  `v2-group-${kind.replace('group_', '')}-${clusterKey}`
export const v2LayerNodeId = (layerId: string): string => `v2-layer-${layerId}`
export const v2ClusterLockId = (instanceId: string): string => `v2-cluster-${instanceId}`

export function isClusterLockNode(node?: { params?: { logicCategory?: string } } | null): boolean {
  return Boolean(node && node.params?.logicCategory === 'cluster_lock')
}

export function isCameraWaypointNode(node?: { type?: string; params?: { isCameraWaypoint?: boolean } } | null): boolean {
  return Boolean(node && node.type === 'camera_director' && node.params?.isCameraWaypoint)
}

export function isParentCameraNode(node?: { type?: string; params?: { isCameraWaypoint?: boolean } } | null): boolean {
  return Boolean(node && node.type === 'camera_director' && !node.params?.isCameraWaypoint)
}

export interface ShotCameraWaypointStep {
  nodeId: string
  shotId: string
  globalIndex: number
  localIndex: number
  displayLabel: string
  isSubWaypoint: boolean
  isFirstOfShot: boolean
  actionMode: string
  tagLabel: string
  angleSummary: string
  zoomPct: number
  stageX: number
  stageY: number
  scale: number
  yaw: number
  pitch: number
  roll: number
  ease: string
  timeStart: number
  timeEnd: number
  stepDuration: number
}

/**
 * Trích xuất danh sách các mốc lộ trình quay / cảnh con thuộc từng Cảnh (`shotId`)
 * từ dữ liệu thật `project.camera` (dùng chung bộ giải mã `extractCameraFrames2D` + `enrichCameraWaypoints` với Timeline).
 */
export function extractShotCameraWaypoints(project: Project): Map<string, ShotCameraWaypointStep[]> {
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))
  const route = computeShotRoute(project)
  const layout = computeShotStageLayout(project, 0)
  const allWps: CameraWaypointItem[] = enrichCameraWaypoints(extractCameraFrames2D(project, layout))
  const byShot = new Map<string, ShotCameraWaypointStep[]>()

  for (let i = 0; i < allWps.length; i++) {
    const wp = allWps[i]
    const shotId = wp.shotId ?? project.shots[0]?.id
    if (!shotId) continue
    const next = allWps[i + 1]
    const timeStart = Number(Math.max(0, wp.time).toFixed(2))
    const rawEnd = next ? next.time : Math.min(compDur, Math.max(wp.time + 0.4, wp.endTime))
    const timeEnd = Number(Math.min(compDur, Math.max(timeStart, rawEnd)).toFixed(2))
    const list = byShot.get(shotId) ?? []
    const localIndex = list.length
    list.push({
      nodeId: v2CameraWaypointId(shotId, localIndex),
      shotId,
      globalIndex: wp.index,
      localIndex,
      displayLabel: wp.displayLabel,
      isSubWaypoint: wp.isSubWaypoint,
      isFirstOfShot: wp.isFirstOfShot || localIndex === 0,
      actionMode: wp.actionMode,
      tagLabel: wp.tagLabel,
      angleSummary: wp.angleSummary,
      zoomPct: wp.zoomPct,
      stageX: wp.stageX,
      stageY: wp.stageY,
      scale: wp.scale,
      yaw: wp.yaw,
      pitch: wp.pitch,
      roll: wp.roll,
      ease: wp.ease,
      timeStart,
      timeEnd,
      stepDuration: Number(Math.max(0, timeEnd - timeStart).toFixed(2))
    })
    byShot.set(shotId, list)
  }

  // Bảo đảm mỗi Cảnh luôn có ít nhất 1 node con lộ trình quay (kể cả khi cảnh mới tạo chưa gắn keyframe riêng)
  project.shots.forEach((shot, idx) => {
    if ((byShot.get(shot.id)?.length ?? 0) > 0) return
    const range = route.ranges.get(shot.id) ?? getShotTimeRange(project, shot)
    const box = layout.find((b) => b.shotId === shot.id) ?? layout[0]
    byShot.set(shot.id, [
      {
        nodeId: v2CameraWaypointId(shot.id, 0),
        shotId: shot.id,
        globalIndex: allWps.length + idx,
        localIndex: 0,
        displayLabel: `${idx + 1}`,
        isSubWaypoint: false,
        isFirstOfShot: true,
        actionMode: 'establishing',
        tagLabel: 'Mở đầu 100%',
        angleSummary: 'Thẳng 0°',
        zoomPct: 100,
        stageX: box?.stageX ?? 0,
        stageY: box?.stageY ?? 0,
        scale: 1,
        yaw: 0,
        pitch: 0,
        roll: 0,
        ease: 'easeInOut',
        timeStart: range.start,
        timeEnd: range.end,
        stepDuration: Number(Math.max(0.1, range.end - range.start).toFixed(2))
      }
    ])
  })

  return byShot
}

export function isWorkflowV2Graph(workflow?: WorkflowGraph | null): workflow is WorkflowGraph {
  return Boolean(
    workflow && workflow.presetId === 'v2_scene_hierarchy' && workflow.nodes.some((n) => n.type === 'scene_shot')
  )
}

/** Cụm (cảnh) chứa Layer: Shot hợp lệ của Layer, hoặc cụm "Dùng chung" khi Layer không gắn Shot */
export function layerClusterKey(project: Project, layer: Layer): string {
  return layer.shotId && project.shots.some((s) => s.id === layer.shotId) ? layer.shotId : V2_SHARED_CLUSTER
}

/** Khoảng thời gian dự phòng của Shot tính từ các Layer thuộc Shot (khi camera chưa từng nhìn vào Shot) */
export function getShotTimeRange(project: Project, shot?: Shot): { start: number; end: number } {
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))
  if (!shot) return { start: 0, end: compDur }
  const shotLayers = project.layers.filter((l) => l.shotId === shot.id)
  if (shotLayers.length === 0) return { start: 0, end: compDur }
  const minIn = Math.max(0, Math.min(...shotLayers.map((l) => (Number.isFinite(l.inPoint) ? l.inPoint : 0))))
  const maxOut = Math.min(compDur, Math.max(...shotLayers.map((l) => (Number.isFinite(l.outPoint) ? l.outPoint : compDur))))
  return { start: Number(minIn.toFixed(2)), end: Number(Math.max(minIn + 0.5, maxOut).toFixed(2)) }
}

export interface ShotRoute {
  /** Thứ tự cảnh theo đường camera đi qua (cảnh camera chưa nhìn tới xếp sau cùng) */
  order: Shot[]
  ranges: Map<string, { start: number; end: number }>
}

let routeCache: { camera: unknown; shots: unknown; duration: number; fps: number; route: ShotRoute } | null = null

/**
 * Lộ trình cảnh theo camera — cùng nguồn với dải "Cảnh đang quay" trên Timeline (`shotAtTime`).
 * Có cache theo tham chiếu camera/shots (Immer giữ nguyên tham chiếu khi không đổi) để gọi mỗi khung hình vẫn nhẹ.
 */
export function computeShotRoute(project: Project): ShotRoute {
  const { duration, fps } = project.comp
  if (
    routeCache &&
    routeCache.camera === project.camera &&
    routeCache.shots === project.shots &&
    routeCache.duration === duration &&
    routeCache.fps === fps
  ) {
    return routeCache.route
  }
  const ranges = new Map<string, { start: number; end: number }>()
  const firstSeen: string[] = []
  const n = Math.max(2, Math.min(600, Math.round((duration || 5) * (fps || 30))))
  for (let i = 0; i <= n && project.shots.length > 0; i++) {
    const t = ((duration || 5) * i) / n
    const id = shotAtTime(project, t)
    if (!id) continue
    const r = ranges.get(id)
    if (r) r.end = t
    else {
      ranges.set(id, { start: t, end: t })
      firstSeen.push(id)
    }
  }
  for (const shot of project.shots) {
    const r = ranges.get(shot.id)
    if (r) ranges.set(shot.id, { start: Number(r.start.toFixed(2)), end: Number(Math.max(r.start + 0.1, r.end).toFixed(2)) })
    else ranges.set(shot.id, getShotTimeRange(project, shot))
  }
  const seen = firstSeen.map((id) => project.shots.find((s) => s.id === id)!).filter(Boolean)
  const order = [...seen, ...project.shots.filter((s) => !firstSeen.includes(s.id))]
  const route = { order, ranges }
  routeCache = { camera: project.camera, shots: project.shots, duration, fps, route }
  return route
}

/** Cảnh camera đang quay tại mốc `t` (null khi đang lia chuyển giữa 2 cảnh) */
export function shotIdAtTime(project: Project, t: number): string | null {
  if (project.shots.length === 0) return null
  return shotAtTime(project, t)
}

/**
 * Khoảng thời gian THẬT của một Node Layer = [inPoint, outPoint] của Layer (không kẹp theo Shot)
 * để khi đồng bộ ngược xuống Project không bao giờ cắt cụt Layer ngoài ý muốn.
 */
export function resolveLayerNodeTimeRange(layer: Layer, compDuration: number): { start: number; end: number } {
  const start = Number(Math.max(0, Number.isFinite(layer.inPoint) ? layer.inPoint : 0).toFixed(2))
  const end = Number(Math.max(start + 0.1, Number.isFinite(layer.outPoint) ? layer.outPoint : compDuration).toFixed(2))
  return { start, end }
}

/** Khoảng thời gian của Group = hợp các khoảng Layer con (Group rỗng dùng khoảng dự phòng) */
export function resolveGroupTimeRange(
  layers: Layer[],
  compDuration: number,
  fallback: { start: number; end: number }
): { start: number; end: number } {
  if (layers.length === 0) return fallback
  const ranges = layers.map((l) => resolveLayerNodeTimeRange(l, compDuration))
  return {
    start: Number(Math.min(...ranges.map((r) => r.start)).toFixed(2)),
    end: Number(Math.max(...ranges.map((r) => r.end)).toFixed(2))
  }
}
