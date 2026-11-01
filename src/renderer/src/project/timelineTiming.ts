import type { Project, WorkflowNode } from '@shared/types'
import { snapToFrame } from '../animation/math'
import { applyLayerShifts } from './layerTimeShift'
import { setTimeGroupRange, timeGroupOfLayer } from './workflowTimeGroups'

export { shiftLayerTiming } from './layerTimeShift'

export interface MoveTimelineOptions {
  /** Alt + kéo: chỉ dời riêng các Layer đã chọn và tách chúng khỏi nhóm Time chung */
  detachLinked?: boolean
}

/** Gom các Layer đã chọn theo nhóm Time đang điều khiển chúng (Layer tự do nằm ngoài mọi nhóm) */
function partitionByTimeGroup(project: Project, ids: string[], detach: boolean) {
  const groups = new Map<string, WorkflowNode>()
  const free: string[] = []
  for (const id of ids) {
    const group = detach ? undefined : timeGroupOfLayer(project, id)
    if (group) groups.set(group.id, group)
    else free.push(id)
  }
  return { groups: [...groups.values()], free }
}

/**
 * Dời các dòng Layer trên Timeline. Layer đang nối vào Node Time chung hoạt động như "clip liên kết":
 * dời một Layer là dời cả nhóm (Node Time đổi khoảng → mọi Layer / Logic / mốc lộ trình Camera cùng nhóm ăn theo).
 * `detachLinked` (Alt + kéo) chỉ dời riêng Layer đã chọn và tách nó khỏi nhóm.
 */
export function moveTimelineLayers(
  project: Project,
  ids: string[],
  seconds: number,
  mode: 'shift' | 'align' = 'shift',
  opts: MoveTimelineOptions = {}
): void {
  if (!Number.isFinite(seconds)) throw new Error('Mốc thời gian không hợp lệ.')
  const selected = new Set(ids)
  const layers = project.layers.filter(l => selected.has(l.id) && !l.locked)
  if (!layers.length) return
  const detach = Boolean(opts.detachLinked)
  const { groups, free } = partitionByTimeGroup(project, layers.map(l => l.id), detach)
  const freeLayers = layers.filter(l => free.includes(l.id))
  const ranges = [
    ...freeLayers.map(l => ({ start: l.inPoint, end: l.outPoint })),
    ...groups.map(g => ({ start: g.params?.timeStart ?? 0, end: g.params?.timeEnd ?? project.comp.duration }))
  ]
  const requested = snapToFrame(seconds, project.comp.fps)
  const delta = Math.max(-Math.min(...ranges.map(r => r.start)), Math.min(project.comp.duration - Math.max(...ranges.map(r => r.end)), requested))
  if (mode === 'align' && (requested < 0 || ranges.some(r => requested + r.end - r.start > project.comp.duration))) {
    throw new Error('Không đủ thời lượng dự án để căn các dòng tới mốc này.')
  }
  const shifts = new Map<string, number>()
  for (const layer of freeLayers) shifts.set(layer.id, mode === 'align' ? requested - layer.inPoint : delta)
  applyLayerShifts(project, shifts, detach ? new Set(shifts.keys()) : new Set())
  for (const group of groups) {
    const start = group.params?.timeStart ?? 0
    const end = group.params?.timeEnd ?? project.comp.duration
    const shift = mode === 'align' ? requested - start : delta
    if (Math.abs(shift) > 1e-6) setTimeGroupRange(project, group.id, start + shift, end + shift)
  }
}
