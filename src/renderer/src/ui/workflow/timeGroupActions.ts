import type { Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import { toast } from '../../actions'
import {
  createTimeGroup,
  linkToTimeGroup,
  resolveTimeTargets,
  setTimeGroupRange,
  shiftTimeGroup,
  unlinkFromTimeGroup,
  updateTimeGroupMeta
} from '../../project/workflowTimeGroups'
import { timeGroupLabel } from '../../project/workflowTiming'

/**
 * Thao tác nhóm Time chung dùng chung cho Workflow (thẻ, làn thời gian, thanh chọn nhiều, Inspector) và Timeline.
 * Mỗi thao tác là MỘT bước Undo và đi qua cùng logic `workflowTimeGroups` với MCP `time_group`.
 */
const run = <T>(_label: string, fn: (draft: Project) => T, mergeKey?: string): T | undefined => {
  let result: T | undefined
  try {
    useEditor.getState().update((draft) => {
      result = fn(draft as Project)
    }, mergeKey)
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error))
    return undefined
  }
  return result
}

/** Tạo nhóm Time mới từ các Node / Layer; trả về id Node Time vừa tạo */
export function createTimeGroupFrom(nodeIds: string[], layerIds: string[] = [], opts: { start?: number; end?: number } = {}): string | undefined {
  const created = run('time-group-create', (d) => {
    const targets = resolveTimeTargets(d, nodeIds, layerIds)
    const node = createTimeGroup(d, targets, opts)
    return { id: node.id, label: timeGroupLabel(node) }
  })
  if (created) {
    const count = useEditor.getState().project.workflow?.edges.filter(e => e.fromNode === created.id && e.fromPort === 'time_range').length ?? 0
    toast(count ? `Đã gom ${count} mục vào ${created.label} — sửa 1 lần cho cả nhóm` : `Đã tạo ${created.label} — nối các Node vào cổng ⏱ để dùng chung thời gian`)
  }
  return created?.id
}

export function linkTimeGroup(timeId: string, nodeIds: string[], layerIds: string[] = []): void {
  const linked = run('time-group-link', (d) => linkToTimeGroup(d, timeId, resolveTimeTargets(d, nodeIds, layerIds)))
  if (linked !== undefined) toast(linked ? `Đã nối ${linked} mục vào nhóm Time` : 'Không có mục nào nhận được Time (cấu trúc cảnh, vật liệu, hang động dùng phạm vi riêng)')
}

export function unlinkTimeGroup(nodeIds: string[]): void {
  const removed = run('time-group-unlink', (d) => unlinkFromTimeGroup(d, nodeIds))
  if (removed) toast(`Đã tách ${removed} mục khỏi nhóm Time — trở lại mốc thời gian riêng`)
}

/** Kéo trên làn / thẻ: các lần gọi liên tiếp với cùng `timeId` gộp vào một bước Undo */
export function setTimeGroupRangeAction(timeId: string, start: number, end: number): void {
  run('time-group-range', (d) => setTimeGroupRange(d, timeId, start, end), `time-group-range-${timeId}`)
}

export function alignTimeGroupToPlayhead(timeId: string): void {
  const st = useEditor.getState()
  const node = st.project.workflow?.nodes.find(n => n.id === timeId)
  if (!node) return
  const start = node.params?.timeStart ?? 0
  run('time-group-align', (d) => shiftTimeGroup(d, timeId, st.time - start))
}

export function updateTimeGroupMetaAction(timeId: string, meta: { title?: string; color?: string }): void {
  run('time-group-meta', (d) => updateTimeGroupMeta(d, timeId, meta), `time-group-meta-${timeId}`)
}
