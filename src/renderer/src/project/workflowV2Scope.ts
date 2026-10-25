import type { Layer, Project, Shot, WorkflowGraph } from '@shared/types'
import { shotAtTime } from '../animation/cameraPath'

/**
 * Không gian chung của Workflow V2: MỘT đồ thị cho toàn dự án, mỗi Cảnh là một cụm
 * (Root → Camera / Group → Layer → Logic). Các cụm nối nhau qua dây Camera theo đúng thứ tự camera đi qua.
 */
export const V2_SHARED_CLUSTER = 'shared'

export const v2RootId = (clusterKey: string): string => `v2-root-${clusterKey}`
export const v2CameraId = (shotId: string): string => `v2-camera-${shotId}`
export const v2GroupId = (kind: 'group_3d' | 'group_25d' | 'group_env', clusterKey: string): string =>
  `v2-group-${kind.replace('group_', '')}-${clusterKey}`
export const v2LayerNodeId = (layerId: string): string => `v2-layer-${layerId}`

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
