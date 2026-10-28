import React from 'react'
import { useEditor } from '../../store/editor'
import { toast } from '../../actions'
import { moveTimelineLayers } from '../../project/timelineTiming'
import { timelineSelectedIds, useTimelineSelection } from './timelineSelection'

export function TimelineBatchTiming() {
  const ids = useTimelineSelection(s => s.ids)
  const layers = useEditor(s => s.project.layers)
  const count = ids.filter(id => layers.some(l => l.id === id && !l.locked)).length
  return <div className="tl-batch-timing" data-mcp-region="timeline_batch_timing" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
    <button className="btn ghost sm" disabled={!count} title="Căn đầu các dòng đã tích chọn tới đầu phát, giữ thời lượng và dời cả keyframe"
      onClick={() => {
        try { const st = useEditor.getState(); st.update(d => moveTimelineLayers(d, timelineSelectedIds(), st.time, 'align')) }
        catch (error) { toast(String(error instanceof Error ? error.message : error)) }
      }}>Căn {count || ''} dòng</button>
    {count > 0 && <button className="btn ghost sm" title="Bỏ chọn các dòng" onClick={() => useTimelineSelection.getState().clear()}>×</button>}
  </div>
}
