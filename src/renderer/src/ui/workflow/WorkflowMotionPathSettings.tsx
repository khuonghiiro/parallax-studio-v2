import { useEditor } from '../../store/editor'
import type { WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import '../../styles/workflowMotionStage.css'

export function WorkflowMotionPathSettings({ props }: { props: WorkflowV2NodeParamsProps }) {
  const p = props.node.params ?? {}
  const playing = useEditor(s => s.playing)
  return <section className="wf-motion-path-settings" data-mcp-region="workflow_motion_path">
    <strong>Vẽ trên khung BBox phía trên</strong>
    <p>Chọn icon bút để vẽ line hoặc icon đoạn thẳng để kéo một đường thẳng. Đường đi bắt đầu từ vị trí BBox; Esc hủy nét đang vẽ.</p>
    <label><input type="checkbox" checked={Boolean(p.customMotionLoop)} onChange={e => props.onUpdate({ customMotionLoop: e.target.checked })}/>Lặp đường đi trong khoảng thời gian của node</label>
    <button type="button" className="wf-v2-mini-btn" onClick={() => { const ed = useEditor.getState(); if (!ed.playing) ed.setTime(p.timeStart ?? 0); ed.setPlaying(!ed.playing) }}>{playing ? '■ Dừng' : '▶ Xem thử trong cảnh'}</button>
    {props.onSpawnFollowupNode && <button type="button" className="wf-v2-mini-btn" onClick={() => props.onSpawnFollowupNode?.(Math.max(0.3, (p.timeEnd ?? 3) - (p.timeStart ?? 0)))}>+ Chặng tiếp</button>}
  </section>
}
