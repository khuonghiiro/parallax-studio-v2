import type { Layer, Project } from '@shared/types'
import { effectiveTimeParams, isTimeNode, timeSource } from './workflowTiming'

/** Dời toàn bộ đồng hồ thật của Layer (keyframe, hiệu ứng, motion, va chạm, in/out) theo `delta` giây. */
export function shiftLayerTiming(layer: Layer, delta: number): void {
  if (!delta) return
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    const object = value as Record<string, unknown>
    if (Array.isArray(object.keyframes)) {
      for (const key of object.keyframes as { t: number }[]) key.t += delta
      return
    }
    for (const child of Object.values(object)) walk(child)
  }
  walk(layer.transform)
  walk(layer.props)
  layer.inPoint += delta
  layer.outPoint += delta
  if (layer.motion) layer.motion.startTime = (layer.motion.startTime ?? 0) + delta
  for (const effect of [layer.glow, ...(layer.appliedEffects ?? []), ...(layer.appliedEffects ?? []).map(fx => fx.glow)]) {
    if (effect && typeof effect.startTime === 'number') effect.startTime += delta
  }
  for (const impact of layer.physics?.impacts ?? []) impact.time += delta
}

/**
 * Node Logic gắn riêng vào các Layer vừa dời được dời theo cùng `delta` (giữ đồng bộ Workflow ⇄ Timeline).
 * Node đang ăn theo một Node Time thì giữ nguyên: khoảng thời gian của nó do Node Time quyết định.
 * `detachIds` liệt kê các Layer người dùng chủ động tách khỏi nhóm Time (Alt + kéo) để gỡ dây Time của chúng.
 */
function shiftWorkflowTiming(project: Project, shifts: Map<string, number>, detachIds: Set<string>): void {
  const workflow = project.workflow
  if (!workflow) return
  const detached = new Set<string>()
  workflow.nodes = workflow.nodes.map((node) => {
    if (isTimeNode(node)) return node
    const targets = node.params?.targetLayerIds ?? []
    if (!targets.length || !targets.every(id => shifts.has(id))) return node
    const shift = shifts.get(targets[0])!
    if (!shift || !targets.every(id => shifts.get(id) === shift)) return node
    const bound = Boolean(timeSource(workflow, node.id))
    if (bound && !targets.every(id => detachIds.has(id))) return node
    const effective = effectiveTimeParams(project, node, node.params ?? {})
    const params = { ...node.params }
    const start = effective.timeStart
    const end = effective.timeEnd
    if (typeof start === 'number') params.timeStart = Number((start + shift).toFixed(3))
    if (typeof end === 'number') params.timeEnd = Number((end + shift).toFixed(3))
    if (typeof start === 'number' && typeof end === 'number') params.localTimeRange = { start: params.timeStart!, end: params.timeEnd! }
    if (bound) detached.add(node.id)
    return { ...node, params }
  })
  if (detached.size) workflow.edges = workflow.edges.filter(edge => edge.fromPort !== 'time_range' || !detached.has(edge.toNode))
}

/** Dời nhiều Layer (mỗi Layer một độ dời riêng) kèm track âm thanh gắn Layer và Node Logic của chúng. */
export function applyLayerShifts(project: Project, shifts: Map<string, number>, detachIds: Set<string> = new Set()): void {
  if (!shifts.size) return
  for (const layer of project.layers) {
    const shift = shifts.get(layer.id)
    if (shift) shiftLayerTiming(layer, shift)
  }
  for (const track of project.audioTracks ?? []) {
    if (track.targetType === 'layer' && track.targetId) track.offset += shifts.get(track.targetId) ?? 0
  }
  shiftWorkflowTiming(project, shifts, detachIds)
}
