import { useEditor } from '../../store/editor'
import { toast } from '../../actions'
import { intervalBounds, retimeTimelineIntervals } from '../../project/timelineIntervals'
import { selectedIntervals, useTimelineSelection } from './timelineSelection'
import '../../styles/timelineIntervals.css'

export function TimelineBatchTiming() {
  const items = useTimelineSelection(s => s.intervals)
  const project = useEditor(s => s.project)
  const count = items.filter(item => intervalBounds(project, item)).length
  return <div className={`tl-batch-timing${count === 0 ? ' is-empty' : ''}`} data-mcp-region="timeline_batch_timing">
    <span className="tl-selection-count" title="Ctrl + click vào khoảng thời gian để thêm/bỏ chọn; kéo đoạn đã chọn để dời cả nhóm">{count ? `${count} đoạn chọn` : 'Ctrl + click chọn đoạn'}</span>
    {count > 0 && <>
      <button className="btn ghost sm" title="Căn đầu các đoạn tới đầu phát, giữ thời lượng"
        onClick={() => {
          try { const st = useEditor.getState(); st.update(d => retimeTimelineIntervals(d, selectedIntervals(), 'align', st.time)) }
          catch (error) { toast(error instanceof Error ? error.message : String(error)) }
        }}>Căn đầu</button>
      <button className="btn ghost sm" title="Bỏ chọn các đoạn" onClick={() => useTimelineSelection.getState().clear()}>×</button>
    </>}
  </div>
}
