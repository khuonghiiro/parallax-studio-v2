import type { Animatable, AnimValue, EaseName } from '@shared/types'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { keyAt } from '../../animation/keyframes'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { Menu } from '../controls'
import { addTimelineKey, navigateTimelineKey, setTimelineEase } from './timelineKeyEditing'

const modes: { value: EaseName; label: string }[] = [
  { value: 'easeInOut', label: 'Đi mượt' }, { value: 'linear', label: 'Đi đều' },
  { value: 'hold', label: 'Giữ rồi nhảy' }, { value: 'pulse', label: 'Nhịp đập' }
]

export function TimelineRangeControls({ animation, refp }: { animation: Animatable<AnimValue>; refp: PropRef }) {
  const time = useEditor(s => s.time)
  const tolerance = frameTolerance(useEditor.getState().project)
  const current = keyAt(animation, time, tolerance)
  const segment = timelineSegmentAt(animation, time)
  return <div className="tl-compact-keys tl-range-controls" data-mcp-region="timeline_key_controls" onPointerDownCapture={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      event.currentTarget.style.setProperty('--motion-menu-top', `${Math.max(8, Math.min(rect.bottom, window.innerHeight - 220))}px`)
      event.currentTarget.style.setProperty('--motion-menu-left', `${Math.max(8, rect.right - 240)}px`)
    }}>
    <button title="Mốc trước (Alt+←)" disabled={!animation.keyframes.some(k => k.t < time - tolerance)}
      onClick={() => navigateTimelineKey(refp, -1)}>‹</button>
    <button className={current ? 'active' : ''} title={current ? 'Đang ở mốc; sửa số trực tiếp. Delete xóa mốc đã chọn.' : 'Thêm mốc tại đầu phát (K)'}
      onClick={() => addTimelineKey(refp)}>{current ? '◆' : '◇'}</button>
    <button title="Mốc sau (Alt+→)" disabled={!animation.keyframes.some(k => k.t > time + tolerance)}
      onClick={() => navigateTimelineKey(refp, 1)}>›</button>
    {current && <Menu id={`motion-${refp.kind === 'layer' ? refp.layerId : refp.kind}-${refp.prop}`} label="⋯" title="Chọn kiểu chuyển động của đoạn này">
      <div className="menu-label">Chuyển động {segment.start?.t.toFixed(2)}s → {segment.end?.t.toFixed(2) ?? 'mốc sau'}s</div>
      {modes.map(mode => <button key={mode.value} className="menu-item"
        onClick={() => setTimelineEase(refp, mode.value)}>{segment.start?.ease === mode.value ? '✓ ' : ''}{mode.label}</button>)}
    </Menu>}
  </div>
}

