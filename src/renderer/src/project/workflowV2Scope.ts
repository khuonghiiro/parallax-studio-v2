import type { Layer, Project, Shot, WorkflowGraph } from '@shared/types'

/**
 * Phạm vi cảnh & khoảng thời gian chuẩn của Workflow V2 — dùng chung cho build, reconcile và đồng bộ
 * để Node Root / Group / Layer luôn hiển thị đúng dữ liệu thật của Project.
 */
export const WORKFLOW_V2_ALL_SCOPE = '__all__'

/** Tính khoảng mốc thời gian [start, end] của một Shot dựa trên các Layer thuộc Shot đó (không có Shot = toàn dự án) */
export function getShotTimeRange(project: Project, shot?: Shot): { start: number; end: number } {
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))
  if (!shot) return { start: 0, end: compDur }
  const shotLayers = project.layers.filter((l) => l.shotId === shot.id)
  if (shotLayers.length === 0) return { start: 0, end: compDur }
  const minIn = Math.max(0, Math.min(...shotLayers.map((l) => (Number.isFinite(l.inPoint) ? l.inPoint : 0))))
  const maxOut = Math.min(
    compDur,
    Math.max(...shotLayers.map((l) => (Number.isFinite(l.outPoint) ? l.outPoint : compDur)))
  )
  return {
    start: Number(minIn.toFixed(2)),
    end: Number(Math.max(minIn + 0.5, maxOut).toFixed(2))
  }
}

/**
 * Chuẩn hoá phạm vi cảnh:
 * - `'__all__'` (hoặc dự án chưa có Shot) → toàn bộ dự án.
 * - id Shot hợp lệ → đúng Shot đó.
 * - `undefined` / id không còn tồn tại → Shot đầu tiên.
 */
export function normalizeWorkflowV2Scope(project: Project, scope?: string | null): string {
  if (scope === WORKFLOW_V2_ALL_SCOPE || project.shots.length === 0) return WORKFLOW_V2_ALL_SCOPE
  if (scope && project.shots.some((s) => s.id === scope)) return scope
  return project.shots[0].id
}

/** Phạm vi cảnh mà một đồ thị Workflow V2 đang đại diện (`targetShotId` rỗng = toàn dự án). */
export function workflowV2ScopeOf(workflow?: WorkflowGraph | null): string {
  return workflow?.targetShotId || WORKFLOW_V2_ALL_SCOPE
}

export function isWorkflowV2Graph(workflow?: WorkflowGraph | null): workflow is WorkflowGraph {
  return Boolean(
    workflow &&
      workflow.presetId === 'v2_scene_hierarchy' &&
      workflow.nodes.some((n) => n.id === 'v2-root-scene')
  )
}

/** Shot đang hoạt động theo phạm vi đã chuẩn hoá (`undefined` khi xem toàn dự án) */
export function resolveWorkflowV2ActiveShot(project: Project, scope?: string | null): Shot | undefined {
  const normalized = normalizeWorkflowV2Scope(project, scope)
  return normalized === WORKFLOW_V2_ALL_SCOPE ? undefined : project.shots.find((s) => s.id === normalized)
}

/** Các Layer thuộc phạm vi cảnh (Layer không gắn Shot được xem là dùng chung cho mọi cảnh) */
export function scopedWorkflowV2Layers(project: Project, shot?: Shot): Layer[] {
  return shot ? project.layers.filter((l) => !l.shotId || l.shotId === shot.id) : project.layers
}

/** Tiêu đề Node Root theo phạm vi cảnh */
export function workflowV2RootTitle(project: Project, shot?: Shot): string {
  return shot ? `Cảnh: ${shot.name}` : `Toàn dự án (${project.shots.length} cảnh)`
}

/**
 * Khoảng thời gian THẬT của một Node Layer = [inPoint, outPoint] của Layer (không kẹp theo Shot)
 * để khi đồng bộ ngược xuống Project không bao giờ cắt cụt Layer ngoài ý muốn.
 */
export function resolveLayerNodeTimeRange(layer: Layer, compDuration: number): { start: number; end: number } {
  const start = Number(Math.max(0, Number.isFinite(layer.inPoint) ? layer.inPoint : 0).toFixed(2))
  const end = Number(
    Math.max(start + 0.1, Number.isFinite(layer.outPoint) ? layer.outPoint : compDuration).toFixed(2)
  )
  return { start, end }
}

/** Khoảng thời gian của Group = hợp các khoảng Layer con (Group rỗng dùng khoảng dự phòng của cảnh) */
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
