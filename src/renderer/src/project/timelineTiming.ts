import type { Layer, Project } from '@shared/types'
import { snapToFrame } from '../animation/math'
import { effectiveTimeParams, isTimeNode } from './workflowTiming'

/** Shift actual animation and effect clocks with the clip, once per gesture snapshot. */
export function shiftLayerTiming(layer: Layer, delta: number): void {
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

/** A manual move opts consumers out of their shared clock, without moving other consumers. */
function shiftWorkflowTiming(project: Project, shifts: Map<string, number>): void {
  const workflow = project.workflow
  if (!workflow) return
  const detached = new Set<string>()
  for (const node of workflow.nodes) {
    if (isTimeNode(node)) continue
    const targets = node.params?.targetLayerIds ?? []
    if (!targets.length || !targets.every(id => shifts.has(id))) continue
    const shift = shifts.get(targets[0])!
    if (!shift || !targets.every(id => shifts.get(id) === shift)) continue
    const params = node.params!
    const effective = effectiveTimeParams(project, node, params)
    const start = effective.timeStart
    const end = effective.timeEnd
    if (typeof start === 'number') params.timeStart = start + shift
    if (typeof end === 'number') params.timeEnd = end + shift
    if (typeof start === 'number' && typeof end === 'number') {
      params.localTimeRange = { start: start + shift, end: end + shift }
    }
    detached.add(node.id)
  }
  workflow.edges = workflow.edges.filter(edge => edge.fromPort !== 'time_range' || !detached.has(edge.toNode))
}

export function moveTimelineLayers(project: Project, ids: string[], seconds: number, mode: 'shift' | 'align' = 'shift'): void {
  if (!Number.isFinite(seconds)) throw new Error('Mốc thời gian không hợp lệ.')
  const selected = new Set(ids)
  const layers = project.layers.filter(l => selected.has(l.id) && !l.locked)
  if (!layers.length) return
  const requested = snapToFrame(seconds, project.comp.fps)
  const delta = Math.max(-Math.min(...layers.map(l => l.inPoint)),
    Math.min(project.comp.duration - Math.max(...layers.map(l => l.outPoint)), requested))
  if (mode === 'align' && (requested < 0 || layers.some(l => requested + l.outPoint - l.inPoint > project.comp.duration))) {
    throw new Error('Không đủ thời lượng dự án để căn các dòng tới mốc này.')
  }
  const shifts = new Map<string, number>()
  for (const layer of layers) {
    const shift = mode === 'align' ? requested - layer.inPoint : delta
    shifts.set(layer.id, shift)
    shiftLayerTiming(layer, shift)
  }
  for (const track of project.audioTracks ?? []) {
    if (track.targetType === 'layer' && track.targetId) track.offset += shifts.get(track.targetId) ?? 0
  }
  shiftWorkflowTiming(project, shifts)
}
