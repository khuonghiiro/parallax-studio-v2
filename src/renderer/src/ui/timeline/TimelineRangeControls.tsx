import type { Animatable, AnimValue, EaseName, Layer } from '@shared/types'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { keyAt } from '../../animation/keyframes'
import { addTimelineKey, focusTimelineProperty, jumpTimelineKey, navigateTimelineKey, setTimelineEase, useTimelineProperty } from './timelineKeyEditing'
import { LAYER_PROPS } from './timelineTypes'

const MODES: { ease: EaseName; label: string; hint: string }[] = [
  { ease: 'easeInOut', label: 'Đi mượt', hint: 'Tăng tốc rồi chậm dần tới mốc kế tiếp.' },
  { ease: 'linear', label: 'Đi đều', hint: 'Di chuyển với tốc độ đều tới mốc kế tiếp.' },
  { ease: 'hold', label: 'Giữ rồi nhảy', hint: 'Giữ nguyên giá trị đầu; đến mốc cuối mới đổi ngay sang giá trị cuối.' },
  { ease: 'pulse', label: 'Nhịp đập', hint: 'Tới đích 3 lần, quay lại 2 lần rồi giữ tại đích. Nhịp theo độ dài đoạn, chưa theo nhạc.' }
]

export function TimelineKeyEditor({ layer }: { layer: Layer }) {
  const active = useTimelineProperty(s => s.ref)
  const selectedKey = useEditor(s => s.selectedKey)
  const selected = selectedKey?.ref
  const prop = selected?.kind === 'layer' && selected.layerId === layer.id ? selected.prop
    : active?.kind === 'layer' && active.layerId === layer.id ? active.prop : 'position'
  const property = LAYER_PROPS.find(item => item.prop === prop) ?? LAYER_PROPS[0]
  const refp: PropRef = { kind: 'layer', layerId: layer.id, prop: property.prop }
  return <TimelineRangeControls animation={layer.transform[property.prop]!} refp={refp}
    label={property.label} locked={layer.locked} />
}

function TimelineRangeControls({ animation, refp, label, locked }: {
  animation: Animatable<AnimValue>; refp: PropRef; label: string; locked: boolean
}) {
  const time = useEditor(s => s.time)
  const tolerance = frameTolerance(useEditor.getState().project)
  const atKey = keyAt(animation, time, tolerance)
  const { start, end } = timelineSegmentAt(animation, time)
  const prev = animation.keyframes.some(k => k.t < time - tolerance)
  const next = animation.keyframes.some(k => k.t > time + tolerance)
  const mode = MODES.find(item => item.ease === start?.ease)
  const hint = !start ? '1. Đặt thời gian → 2. Tạo mốc đầu → 3. Sửa giá trị ở dòng bên dưới.'
    : atKey ? `Đang sửa ${label.toLowerCase()} tại ${atKey.t.toFixed(2)}s. Đổi thời gian rồi thêm mốc tiếp theo để tạo chuyển động.`
      : `Đặt mốc tại ${time.toFixed(2)}s rồi sửa giá trị ở dòng ${label.toLowerCase()} bên dưới.`
  return <fieldset className="tl-range-controls" data-mcp-region="timeline_key_controls" disabled={locked}
    onPointerDown={event => { event.stopPropagation(); focusTimelineProperty(refp) }}>
    <div className="tl-key-editor-actions">
      <strong className="tl-key-editor-title">Chuyển động · {label}</strong>
      <button disabled={!prev} title="Mốc trước · Alt+←" onClick={() => navigateTimelineKey(refp, -1)}>‹ Mốc trước</button>
      <button className="tl-key-add" title="K: thêm/chọn mốc · Shift+K: đoạn mới · Alt+K: mốc cuối"
        onClick={() => addTimelineKey(refp)}>
        {atKey ? `◆ Mốc tại ${atKey.t.toFixed(2)}s` : start ? `＋ Thêm mốc tại ${time.toFixed(2)}s` : '＋ Tạo mốc đầu'} <kbd>K</kbd>
      </button>
      <button disabled={!next} title="Mốc sau · Alt+→" onClick={() => navigateTimelineKey(refp, 1)}>Mốc sau ›</button>
      <span className="tl-key-editor-help">{hint}</span>
    </div>
    {start && <div className="tl-key-editor-motion">
      <span className="tl-key-editor-title">{end ? 'Đoạn chuyển động' : 'Từ mốc này'}</span>
      <button className="tl-boundary-time" title="Chọn mốc đầu đoạn để sửa giá trị"
        onClick={() => jumpTimelineKey(refp, start.id, start.t)}>{start.t.toFixed(2)}s</button>
      <span className="tl-key-editor-arrow">→</span>
      {end ? <button className="tl-boundary-time" title="Chọn mốc cuối đoạn để sửa giá trị"
        onClick={() => jumpTimelineKey(refp, end.id, end.t)}>{end.t.toFixed(2)}s</button>
        : <span className="tl-key-editor-help">chờ mốc tiếp theo</span>}
      <span className="tl-motion-modes" role="group" aria-label="Cách chuyển từ mốc đầu tới mốc cuối">
        {MODES.map(item => <button key={item.ease} aria-pressed={start.ease === item.ease} title={item.hint}
          className={start.ease === item.ease ? 'active' : ''} onClick={() => setTimelineEase(refp, item.ease)}>{item.label}</button>)}
      </span>
      <span className="tl-key-editor-help">{mode?.hint ?? 'Nội suy tùy chỉnh từ Inspector.'}</span>
    </div>}
  </fieldset>
}
