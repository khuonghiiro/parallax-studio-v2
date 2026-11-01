import { useEditor } from '../../store/editor'
import { toast } from '../../actions'
import { intervalBounds, retimeTimelineIntervals } from '../../project/timelineIntervals'
import { layerNodeIdOf, listTimeGroups, timeGroupOfLayer } from '../../project/workflowTimeGroups'
import { timeGroupLabel } from '../../project/workflowTiming'
import { createTimeGroupFrom, linkTimeGroup, unlinkTimeGroup } from '../workflow/timeGroupActions'
import { IconWfTimeGroup, IconWfTimeUnlink } from '../workflow/workflowIcons'
import { selectedIntervals, useTimelineSelection } from './timelineSelection'
import '../../styles/timelineIntervals.css'
import '../../styles/workflowTimeGroups.css'

/**
 * Thanh thao tác khi chọn nhiều đoạn trên Timeline (Ctrl + nhấp):
 * căn đầu, gom các Layer đã chọn vào một nhóm Time chung (dùng chung với Workflow), nối vào nhóm có sẵn hoặc tách ra.
 */
export function TimelineBatchTiming() {
  const items = useTimelineSelection(s => s.intervals)
  const project = useEditor(s => s.project)
  const count = items.filter(item => intervalBounds(project, item)).length
  if (count === 0) return null
  const layerIds = [...new Set(items.filter(i => i.kind === 'layer' && intervalBounds(project, i)).map(i => i.layerId))]
  const linked = layerIds.filter(id => timeGroupOfLayer(project, id))
  const groups = listTimeGroups(project)
  return <div className="tl-batch-timing" data-mcp-region="timeline_batch_timing">
    <span className="tl-selection-count" title="Ctrl + click vào khoảng thời gian để thêm/bỏ chọn; kéo đoạn đã chọn để dời cả nhóm; Alt + kéo để chỉ dời riêng đoạn trong nhóm Time">{`${count} đoạn chọn`}</span>
    <button className="btn ghost sm" title="Căn đầu các đoạn tới đầu phát, giữ thời lượng"
      onClick={() => {
        try { const st = useEditor.getState(); st.update(d => retimeTimelineIntervals(d, selectedIntervals(), 'align', st.time)) }
        catch (error) { toast(error instanceof Error ? error.message : String(error)) }
      }}>Căn đầu</button>
    {layerIds.length > 0 && (
      <button className="btn ghost sm tl-time-btn" title="Gom các Layer đã chọn vào một Node Time chung — sửa 1 lần, cả nhóm ăn theo (đồng bộ với Workflow)"
        onClick={() => { if (createTimeGroupFrom([], layerIds)) useTimelineSelection.getState().clear() }}>
        <IconWfTimeGroup width={12} height={12} /> Gom Time
      </button>
    )}
    {layerIds.length > 0 && groups.map(g => (
      <button key={g.id} className="btn ghost sm tl-time-chip" style={{ ['--tg-c' as string]: g.color }}
        title={`Nối các Layer đã chọn vào ${g.title} (${g.start.toFixed(1)}–${g.end.toFixed(1)}s)`}
        onClick={() => linkTimeGroup(g.id, [], layerIds)}>→ {timeGroupLabel(g)}</button>
    ))}
    {linked.length > 0 && (
      <button className="btn ghost sm tl-time-btn" title="Tách các Layer đã chọn khỏi nhóm Time, trở lại mốc riêng"
        onClick={() => unlinkTimeGroup(linked.map(layerNodeIdOf))}>
        <IconWfTimeUnlink width={12} height={12} /> Tách
      </button>
    )}
    <button className="btn ghost sm" title="Bỏ chọn các đoạn" onClick={() => useTimelineSelection.getState().clear()}>×</button>
  </div>
}
