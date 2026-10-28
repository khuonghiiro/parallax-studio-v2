import type { Project, Transform } from '@shared/types'
import { listLayerEffects } from '../animation/motionEffects'
import { retimeLayerEffect } from '../animation/effectTiming'
import { moveTimelineLayers } from './timelineTiming'

export type TimelineInterval = { layerId: string } & (
  { kind: 'layer' } | { kind: 'keys'; prop: keyof Transform; startId: string; endId: string } |
  { kind: 'effect'; effectId: string })
export type IntervalMode = 'shift' | 'align' | 'in' | 'out'
export const intervalId = (item: TimelineInterval): string => JSON.stringify(item)

export function intervalBounds(project: Project, item: TimelineInterval) {
  const layer = project.layers.find(l => l.id === item.layerId)
  if (!layer || layer.locked) return null
  if (item.kind === 'layer') return { start: layer.inPoint, end: layer.outPoint }
  if (item.kind === 'effect') {
    const fx = listLayerEffects(layer).find(f => f.id === item.effectId)
    return fx ? { start: fx.startTime, end: fx.duration > 0 ? fx.startTime + fx.duration : layer.outPoint } : null
  }
  const keys = layer.transform[item.prop]?.keyframes
  const index = keys?.findIndex(k => k.id === item.startId) ?? -1
  if (!keys || index < 0 || keys[index + 1]?.id !== item.endId) return null
  return { start: keys[index].t, end: keys[index + 1].t }
}

/** Resolve all targets before writing: invalid groups never partially mutate the project. */
export function retimeTimelineIntervals(project: Project, items: TimelineInterval[], mode: IntervalMode, seconds: number): void {
  if (!Number.isFinite(seconds)) throw new Error('Mốc thời gian không hợp lệ')
  const unique = [...new Map(items.map(item => [intervalId(item), item])).values()]
  const valid = unique.filter(item => intervalBounds(project, item))
  const parents = new Set(valid.filter(i => i.kind === 'layer').map(i => i.layerId))
  const targets = valid.filter(i => {
    if (i.kind !== 'layer' && parents.has(i.layerId)) return false
    if (i.kind !== 'keys') return true
    const layer = project.layers.find(l => l.id === i.layerId)!
    return !valid.some(selected => selected.kind === 'effect' && selected.layerId === i.layerId &&
      listLayerEffects(layer).some(fx => fx.id === selected.effectId && fx.keyframeIds?.includes(i.startId) && fx.keyframeIds.includes(i.endId)))
  })
  if (!targets.length) return
  const frame = 1 / project.comp.fps
  const snapped = Math.round(seconds / frame) * frame
  const bounds = targets.map(item => intervalBounds(project, item)!)
  const delta = mode === 'shift' ? Math.max(-Math.min(...bounds.map(b => b.start)),
    Math.min(project.comp.duration - Math.max(...bounds.map(b => b.end)), snapped)) : 0
  const plans = targets.map((item, index) => {
    const old = bounds[index]
    const start = mode === 'shift' ? old.start + delta : mode === 'out' ? old.start : snapped
    const end = mode === 'shift' ? old.end + delta : mode === 'align' ? start + old.end - old.start : mode === 'in' ? old.end : snapped
    if (start < -1e-6 || end > project.comp.duration + 1e-6 || end - start < frame - 1e-6)
      throw new Error('IN phải trước OUT ít nhất một khung hình và nằm trong thời lượng dự án')
    return { item, start, end }
  })
  const keyTimes = new Map<string, Map<string, number>>()
  for (const { item, start, end } of plans) {
    if (item.kind !== 'keys') continue
    const group = JSON.stringify([item.layerId, item.prop])
    const times = keyTimes.get(group) ?? new Map<string, number>()
    for (const [id, time] of [[item.startId, start], [item.endId, end]] as const) {
      if (times.has(id) && Math.abs(times.get(id)! - time) > 1e-6) throw new Error('Các đoạn chung mốc có IN/OUT xung đột')
      times.set(id, time)
    }
    keyTimes.set(group, times)
  }
  for (const [group, times] of keyTimes) {
    const [layerId, prop] = JSON.parse(group) as [string, keyof Transform]
    const keys = project.layers.find(l => l.id === layerId)!.transform[prop]!.keyframes
    for (let i = 1; i < keys.length; i++) {
      if ((times.get(keys[i].id) ?? keys[i].t) - (times.get(keys[i - 1].id) ?? keys[i - 1].t) < 1e-6)
        throw new Error('Không thể dời đoạn qua hoặc trùng mốc bên cạnh')
    }
  }
  const layerIds = plans.filter(p => p.item.kind === 'layer').map(p => p.item.layerId)
  if (layerIds.length && (mode === 'shift' || mode === 'align')) moveTimelineLayers(project, layerIds, mode === 'shift' ? delta : snapped, mode)
  for (const { item, start, end } of plans) {
    const layer = project.layers.find(l => l.id === item.layerId)!
    if (item.kind === 'layer' && mode !== 'shift' && mode !== 'align') { layer.inPoint = start; layer.outPoint = end }
    if (item.kind === 'effect') retimeLayerEffect(layer, item.effectId, { startTime: start, duration: end - start })
  }
  for (const [group, times] of keyTimes) {
    const [layerId, prop] = JSON.parse(group) as [string, keyof Transform]
    for (const key of project.layers.find(l => l.id === layerId)!.transform[prop]!.keyframes) {
      if (times.has(key.id)) key.t = times.get(key.id)!
    }
  }
}
