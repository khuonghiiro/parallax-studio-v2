import React, { useRef } from 'react'

export interface WorkflowTimeRangeBarProps {
  timeStart: number
  timeEnd: number
  minTime?: number
  maxTime: number
  currentTime: number
  accentColor?: string
  /** Chỉ hiển thị, không cho kéo (ví dụ Node Root có khoảng thời gian suy ra từ cảnh) */
  readOnly?: boolean
  onChangeRange: (nextStart: number, nextEnd: number) => void
  onScrubTime?: (t: number) => void
}

const MIN_SPAN = 0.1

/** Tính khoảng mới khi kéo đầu mút / thân thanh, luôn kẹp trong [minTime, maxTime] và giữ độ dài tối thiểu */
export function dragTimeRange(
  mode: 'start' | 'end' | 'move',
  initStart: number,
  initEnd: number,
  dt: number,
  minTime: number,
  maxTime: number
): [number, number] {
  const round = (v: number): number => Number(v.toFixed(2))
  if (mode === 'start') return [round(Math.max(minTime, Math.min(initEnd - MIN_SPAN, initStart + dt))), initEnd]
  if (mode === 'end') return [initStart, round(Math.max(initStart + MIN_SPAN, Math.min(maxTime, initEnd + dt)))]
  const span = initEnd - initStart
  const nextStart = Math.max(minTime, Math.min(maxTime - span, initStart + dt))
  return [round(nextStart), round(nextStart + span)]
}

/**
 * Thanh chỉnh khoảng mốc thời gian 1 dòng gọn gàng trên mỗi Node (Inline Time-Span Scrubber).
 * Kéo đầu mút trái (tStart), đầu mút phải (tEnd), hoặc kéo thân thanh để dịch chuyển cả khoảng.
 */
export const WorkflowTimeRangeBar: React.FC<WorkflowTimeRangeBarProps> = ({
  timeStart,
  timeEnd,
  minTime = 0,
  maxTime,
  currentTime,
  accentColor = 'var(--accent)',
  readOnly = false,
  onChangeRange,
  onScrubTime
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const safeMax = Math.max(minTime + 0.5, maxTime || 5)
  const span = safeMax - minTime
  const clampStart = Math.max(minTime, Math.min(safeMax - MIN_SPAN, timeStart))
  const clampEnd = Math.max(clampStart + MIN_SPAN, Math.min(safeMax, timeEnd))
  const leftPct = ((clampStart - minTime) / span) * 100
  const widthPct = Math.max(2, ((clampEnd - clampStart) / span) * 100)
  const playheadPct = Math.max(0, Math.min(100, ((currentTime - minTime) / span) * 100))
  const isActiveNow = currentTime >= clampStart - 0.02 && currentTime <= clampEnd + 0.02

  const startDrag = (e: React.PointerEvent, mode: 'start' | 'end' | 'move'): void => {
    e.stopPropagation()
    e.preventDefault()
    if (readOnly) return
    const el = trackRef.current
    if (!el) return
    const w = Math.max(40, el.getBoundingClientRect().width)
    const initX = e.clientX
    const onMove = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - initX) / w) * span
      const [s, en] = dragTimeRange(mode, clampStart, clampEnd, dt, minTime, safeMax)
      onChangeRange(s, en)
      if (mode !== 'move') onScrubTime?.(mode === 'start' ? s : en)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`wf-v2-timebar${isActiveNow ? ' is-active-time' : ''}${readOnly ? ' read-only' : ''}`}
      style={{ ['--wf-time-c' as string]: accentColor }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div ref={trackRef} className="wf-v2-timebar-track" title={`${clampStart.toFixed(2)}s → ${clampEnd.toFixed(2)}s`}>
        <div
          className="wf-v2-timebar-fill"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          {!readOnly && (
            <>
              <div className="wf-v2-timebar-handle left" title="Kéo chỉnh mốc bắt đầu" onPointerDown={(e) => startDrag(e, 'start')} />
              <div className="wf-v2-timebar-handle right" title="Kéo chỉnh mốc kết thúc" onPointerDown={(e) => startDrag(e, 'end')} />
            </>
          )}
        </div>
        <div className="wf-v2-timebar-playhead" style={{ left: `${playheadPct}%` }} />
      </div>
      <button
        type="button"
        className="wf-v2-time-pill"
        title="Nhấn để tua tới mốc bắt đầu"
        onClick={() => onScrubTime?.(clampStart)}
      >
        {clampStart.toFixed(1)}–{clampEnd.toFixed(1)}s
      </button>
    </div>
  )
}
