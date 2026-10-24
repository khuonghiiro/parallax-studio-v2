import React, { useRef } from 'react'
export interface WorkflowTimeRangeBarProps {
  timeStart: number
  timeEnd: number
  minTime?: number
  maxTime: number
  currentTime: number
  accentColor?: string
  onChangeRange: (nextStart: number, nextEnd: number) => void
  onScrubTime?: (t: number) => void
}
/**
 * Thanh chỉnh khoảng mốc thời gian trực tiếp trên mỗi Node (Time-Span Scrubber).
 * Cho phép kéo đầu mút Bắt đầu (tStart), đầu mút Kết thúc (tEnd), hoặc kéo trượt cả khoảng thời gian.
 */
export const WorkflowTimeRangeBar: React.FC<WorkflowTimeRangeBarProps> = ({
  timeStart,
  timeEnd,
  minTime = 0,
  maxTime,
  currentTime,
  accentColor = 'var(--accent)',
  onChangeRange,
  onScrubTime
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const safeMax = Math.max(minTime + 0.5, maxTime || 5)
  const span = safeMax - minTime
  const clampStart = Math.max(minTime, Math.min(safeMax - 0.1, timeStart))
  const clampEnd = Math.max(clampStart + 0.1, Math.min(safeMax, timeEnd))
  const leftPct = ((clampStart - minTime) / span) * 100
  const widthPct = Math.max(3, ((clampEnd - clampStart) / span) * 100)
  const playheadPct = Math.max(0, Math.min(100, ((currentTime - minTime) / span) * 100))
  const isActiveNow = currentTime >= clampStart - 0.02 && currentTime <= clampEnd + 0.02
  const startDrag = (
    e: React.PointerEvent,
    mode: 'start' | 'end' | 'move'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = Math.max(40, rect.width)
    const initX = e.clientX
    const initStart = clampStart
    const initEnd = clampEnd
    const duration = initEnd - initStart
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - initX
      const dt = (dx / w) * span
      if (mode === 'start') {
        const nextS = Number(Math.max(minTime, Math.min(initEnd - 0.1, initStart + dt)).toFixed(2))
        onChangeRange(nextS, initEnd)
        onScrubTime?.(nextS)
      } else if (mode === 'end') {
        const nextE = Number(Math.max(initStart + 0.1, Math.min(safeMax, initEnd + dt)).toFixed(2))
        onChangeRange(initStart, nextE)
        onScrubTime?.(nextE)
      } else {
        let nextS = initStart + dt
        let nextE = initEnd + dt
        if (nextS < minTime) {
          nextS = minTime
          nextE = minTime + duration
        }
        if (nextE > safeMax) {
          nextE = safeMax
          nextS = Math.max(minTime, safeMax - duration)
        }
        onChangeRange(Number(nextS.toFixed(2)), Number(nextE.toFixed(2)))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  return (
    <div
      className={`wf-v2-timebar ${isActiveNow ? 'is-active-time' : ''}`}
      style={{ ['--wf-time-c' as string]: accentColor }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="wf-v2-timebar-head">
        <span className="wf-v2-timebar-label" title="Khoảng mốc thời gian hoạt động của Node">
          ⏱ Mốc:
        </span>
        <div className="wf-v2-timebar-values">
          <span
            className="wf-v2-time-pill"
            title="Nhấn để nhảy tới mốc bắt đầu"
            onClick={() => onScrubTime?.(clampStart)}
          >
            {clampStart.toFixed(1)}s
          </span>
          <span className="wf-v2-time-arrow">→</span>
          <span
            className="wf-v2-time-pill"
            title="Nhấn để nhảy tới mốc kết thúc"
            onClick={() => onScrubTime?.(clampEnd)}
          >
            {clampEnd.toFixed(1)}s
          </span>
          <span className="wf-v2-time-dur">({(clampEnd - clampStart).toFixed(1)}s)</span>
        </div>
      </div>
      <div
        ref={trackRef}
        className="wf-v2-timebar-track"
        title="Kéo 2 đầu mút để chỉnh khoảng mốc thời gian bắt đầu / kết thúc"
      >
        {/* Vạch chia mốc phụ */}
        <div className="wf-v2-timebar-ticks">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        {/* Thanh khoảng thời gian hoạt động */}
        <div
          className="wf-v2-timebar-fill"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          <div
            className="wf-v2-timebar-handle left"
            title={`Kéo chỉnh mốc bắt đầu (${clampStart.toFixed(2)}s)`}
            onPointerDown={(e) => startDrag(e, 'start')}
          />
          <div
            className="wf-v2-timebar-handle right"
            title={`Kéo chỉnh mốc kết thúc (${clampEnd.toFixed(2)}s)`}
            onPointerDown={(e) => startDrag(e, 'end')}
          />
        </div>
        {/* Đường kẻ kim thời gian hiện tại (Playhead) */}
        <div
          className="wf-v2-timebar-playhead"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  )
}
