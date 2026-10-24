import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EaseName } from '@shared/types'
import { frameTolerance, getAnimatable, useEditor } from '../../store/editor'
import { keyAt } from '../../animation/keyframes'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { addTimelineKey, navigateTimelineKey, removeTimelineKeyAt } from './timelineKeyEditing'
import { applyTimelineMotion, closeMotionPopup, isSilentHoldGuard, MOTION_MODES, useMotionPopup } from './timelineMotionModel'
import { TimelineMotionCurve, TimelineMotionFields } from './TimelineMotionFields'
import '../../styles/timelineMotion.css'

export function TimelineMotionPopup() {
  const popup = useMotionPopup(s => s.popup)
  return popup ? <MotionEditor key={popup.id} popup={popup} /> : null
}

function MotionEditor({ popup }: { popup: NonNullable<ReturnType<typeof useMotionPopup.getState>['popup']> }) {
  const project = useEditor(s => s.project)
  const animation = getAnimatable(project, popup.ref)
  const segment = animation ? timelineSegmentAt(animation, popup.time) : undefined
  const effectiveStart = animation && segment?.start && !isSilentHoldGuard(animation, segment.start) ? segment.start : undefined
  const [mode, setMode] = useState<EaseName>(effectiveStart?.ease ?? 'easeInOut')
  const [options, setOptions] = useState(effectiveStart?.easeOptions ?? {})
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: popup.x, top: popup.y })
  const layerId = popup.ref.kind === 'layer' ? popup.ref.layerId : undefined
  const layer = project.layers.find(l => l.id === layerId)
  useLayoutEffect(() => {
    const bounds = root.current?.getBoundingClientRect()
    if (bounds) setPosition({ left: Math.max(8, Math.min(popup.x, window.innerWidth - bounds.width - 8)),
      top: Math.max(8, Math.min(popup.y, window.innerHeight - bounds.height - 8)) })
  }, [popup, mode, !!effectiveStart])
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) closeMotionPopup() }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeMotionPopup() } }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('resize', closeMotionPopup)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true); window.removeEventListener('resize', closeMotionPopup) }
  }, [])
  if (!animation) return null
  const tolerance = frameTolerance(project)
  const existingKey = keyAt(animation, popup.time, tolerance)
  const hasRealKeyHere = !!existingKey && !isSilentHoldGuard(animation, existingKey)
  const apply = () => {
    try { applyTimelineMotion(popup.ref, popup.time, mode, options); closeMotionPopup() }
    catch (e) { setError(e instanceof Error ? e.message : 'Thông số không hợp lệ') }
  }
  return createPortal(<div ref={root} className="tl-motion-popup" data-mcp-region="timeline_motion_popup" data-mcp-dialog
    role="dialog" tabIndex={-1} aria-label="Cấu hình chuyển động thuộc tính" style={position} onContextMenu={e => e.preventDefault()}>
    <header><div><strong>Cấu hình chuyển động</strong><small>{layer?.name ?? 'Camera'} · {({ position: 'Vị trí', rotation: 'Xoay', scale: 'Tỉ lệ', opacity: 'Độ mờ' } as Record<string, string>)[popup.ref.prop] ?? popup.ref.prop}</small></div>
      <button onClick={closeMotionPopup} title="Đóng (Escape)">×</button></header>
    <p className="tl-motion-interval">{effectiveStart ? `${effectiveStart.t.toFixed(2)}s → ${segment?.end ? `${segment.end.t.toFixed(2)}s` : 'chưa có mốc cuối'}` : `Chưa có mốc · Đầu phát ${popup.time.toFixed(2)}s (Áp dụng sẽ tự tạo mốc)`}</p>
    <fieldset disabled={layer?.locked}>
      <div className="tl-motion-boundaries">
        <button disabled={!hasRealKeyHere && animation.keyframes.some(k => k.t > popup.time)}
          onClick={() => addTimelineKey(popup.ref, 'start')}>◆ Đặt đầu đoạn</button>
        <button disabled={!effectiveStart || popup.time <= effectiveStart.t + tolerance} onClick={() => addTimelineKey(popup.ref, 'end')}>◆ Đặt cuối đoạn</button>
        {hasRealKeyHere && (
          <button
            className="tl-motion-delete-key"
            title={`Xóa mốc tại ${popup.time.toFixed(2)}s`}
            onClick={() => {
              removeTimelineKeyAt(popup.ref, popup.time)
              closeMotionPopup()
            }}
          >
            ✕ Xóa mốc
          </button>
        )}
      </div>
      <div className="tl-motion-modes">{MOTION_MODES.map(item => <button key={item.value} title={item.label}
        aria-pressed={mode === item.value || (item.value === 'easeInOut' && mode.startsWith('ease'))}
        onClick={() => setMode(item.value)}><item.Icon width={14} height={14} /><span>{item.label.split(' (')[0]}</span></button>)}</div>
      {mode.startsWith('ease') && <div className="tl-motion-directions">{(['easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong'] as const).map((value, i) =>
        <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{['Chậm đầu', 'Chậm cuối', 'Hai đầu', 'Mạnh'][i]}</button>)}</div>}
      <TimelineMotionCurve mode={mode} options={options} />
      <TimelineMotionFields mode={mode} options={options} setOptions={setOptions} />
      <p className="tl-motion-note">Thông số áp dụng giữa hai mốc, từ giá trị đầu đến giá trị cuối. Với nhấp nháy, dùng Độ mờ để bật/tắt hình.</p>
      {error && <p role="alert">{error}</p>}
      <footer><button disabled={!animation.keyframes.some(k => !isSilentHoldGuard(animation, k) && k.t < popup.time - tolerance)} onClick={() => { navigateTimelineKey(popup.ref, -1); closeMotionPopup() }}>‹ Mốc trước</button>
        <button disabled={!animation.keyframes.some(k => k.t > popup.time + tolerance)} onClick={() => { navigateTimelineKey(popup.ref, 1); closeMotionPopup() }}>Mốc sau ›</button>
        <button className="tl-motion-apply" onClick={apply}>Áp dụng</button></footer>
    </fieldset>
  </div>, document.body)
}
