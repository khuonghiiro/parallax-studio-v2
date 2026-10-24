import type { Animatable, AnimValue } from '@shared/types'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { keyAt } from '../../animation/keyframes'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { addTimelineKey } from './timelineKeyEditing'
import { applyTimelineMotion, MOTION_MODES, openMotionPopup } from './timelineMotionModel'

export function TimelineRangeControls({ animation, refp }: { animation: Animatable<AnimValue>; refp: PropRef }) {
  const time = useEditor(s => s.time)
  const current = keyAt(animation, time, frameTolerance(useEditor.getState().project))
  const segment = timelineSegmentAt(animation, time)
  return <div className="tl-compact-keys tl-range-controls" data-mcp-region="timeline_key_controls">
    <button aria-pressed={!!current} className={`tl-key-diamond${current ? ' active' : ''}`}
      title={`◆ ${current ? 'Chọn mốc để sửa' : 'Thêm mốc'} tại ${time.toFixed(2)}s · Chuột phải: cấu hình`}
      onClick={() => addTimelineKey(refp)}>{current ? '◆' : '◇'}</button>
    {MOTION_MODES.map(({ value, label, Icon }) => <button key={value} className="tl-motion-quick"
      aria-pressed={segment.start?.ease === value || (value === 'easeInOut' && segment.start?.ease.startsWith('ease'))} disabled={!segment.start}
      title={segment.start ? `${label} · Áp dụng nhanh cho đoạn · Chuột phải để cấu hình` : `${label} · Đặt mốc ◆ trước để áp dụng`}
      onClick={() => applyTimelineMotion(refp, time, value)}><Icon width={12} height={12} /></button>)}
    <button className="tl-motion-settings" title="Cấu hình chuyển động (hoặc chuột phải vào dòng)"
      onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); openMotionPopup(refp, { clientX: rect.left, clientY: rect.bottom }) }}>⋯</button>
  </div>
}
