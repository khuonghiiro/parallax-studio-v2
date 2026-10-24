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
  return <div className="tl-compact-keys tl-range-controls" data-mcp-region="timeline_key_controls">
    <button title="Mốc trước (Alt+←)" disabled={!animation.keyframes.some(k => k.t < time - tolerance)}
      onClick={() => navigateTimelineKey(refp, -1)}>‹</button>
    <button aria-pressed={!!current} className={`tl-key-diamond${current ? ' active' : ''}`} title={current ? `Mốc tại ${current.t.toFixed(2)}s · Bấm chọn để sửa, không xóa` : `Thêm mốc tại ${time.toFixed(2)}s (K)`}
      onClick={() => addTimelineKey(refp)}>{current ? '◆' : '◇'}</button>
    <button title="Mốc sau (Alt+→)" disabled={!animation.keyframes.some(k => k.t > time + tolerance)}
      onClick={() => navigateTimelineKey(refp, 1)}>›</button>
    <Menu portal popupClassName="tl-property-menu-popup" id={`motion-${refp.kind === 'layer' ? refp.layerId : refp.kind}-${refp.prop}`} label="⋯" title="Mốc đầu/cuối và kiểu chuyển động">
      <div className="tl-key-menu" data-mcp-region="timeline_key_menu">
      <div className="menu-label">Tại đầu phát {time.toFixed(2)}s</div>
      <button className="menu-item" onClick={() => addTimelineKey(refp, 'start')}>◆ Đặt đầu đoạn <kbd>Shift K</kbd></button>
      <button className="menu-item" disabled={!animation.keyframes.some(k => k.t < time - tolerance)}
        onClick={() => addTimelineKey(refp, 'end')}>◆ Đặt cuối đoạn <kbd>Alt K</kbd></button>
      <div className="menu-label">{segment.start ? `Chuyển động ${segment.start.t.toFixed(2)}s → ${segment.end ? `${segment.end.t.toFixed(2)}s` : 'mốc sau'}` : 'Đặt mốc để chọn kiểu chuyển động'}</div>
      {modes.map(mode => <button key={mode.value} className="menu-item" disabled={!current} aria-pressed={segment.start?.ease === mode.value}
        onClick={() => setTimelineEase(refp, mode.value)}>{segment.start?.ease === mode.value ? '✓ ' : ''}{mode.label}</button>)}
      </div>
    </Menu>
  </div>
}

