import React, { useMemo, useRef } from 'react'
import type { WorkflowNode } from '@shared/types'
import { IconPause, IconPlay, IconSkipStart } from '../icons'
import { dragTimeRange } from './WorkflowTimeRangeBar'
import { cleanV2NodeTitle, resolveV2NodeTheme } from './workflowV2Theme'

export interface WorkflowTimeRulerV2Props {
  currentTime: number
  duration: number
  playing: boolean
  selectedNode: WorkflowNode | null
  /** Khoảng thời gian của phạm vi cảnh đang xem — vùng ngoài được làm mờ */
  scopeRange: { start: number; end: number }
  activeAtTimeCount: number
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onUpdateNodeTimeRange?: (nodeId: string, nextStart: number, nextEnd: number) => void
}

/** Bước vạch chia sao cho mỗi nhãn cách nhau ≥ ~64px trên độ rộng thước điển hình */
function pickTickStep(duration: number): number {
  const steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
  return steps.find((s) => duration / s <= 14) ?? 60
}

/**
 * Thước thời gian (Master Time Ruler) của Workflow V2, chia 2 làn tách bạch:
 * làn trên là nhãn giây, làn dưới là khoảng mốc của Node đang chọn (kéo 2 đầu mút / kéo thân để dịch).
 */
export const WorkflowTimeRulerV2: React.FC<WorkflowTimeRulerV2Props> = ({
  currentTime,
  duration,
  playing,
  selectedNode,
  scopeRange,
  activeAtTimeCount,
  onSetTime,
  onTogglePlay,
  onUpdateNodeTimeRange
}) => {
  const rulerRef = useRef<HTMLDivElement>(null)
  const safeDuration = Math.max(1, duration || 5)
  const toPct = (t: number): number => Math.max(0, Math.min(100, (t / safeDuration) * 100))

  const ticks = useMemo(() => {
    const step = pickTickStep(safeDuration)
    const minor = step / 2
    const list: { t: number; major: boolean }[] = []
    for (let i = 0; i * minor <= safeDuration + 1e-4; i++) {
      list.push({ t: Number((i * minor).toFixed(3)), major: i % 2 === 0 })
    }
    return list
  }, [safeDuration])

  const timeFromClientX = (clientX: number): number => {
    const rect = rulerRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
    return Number((ratio * safeDuration).toFixed(2))
  }

  const handleScrubDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!rulerRef.current) return
    e.preventDefault()
    onSetTime(timeFromClientX(e.clientX))
    const onMove = (ev: PointerEvent): void => onSetTime(timeFromClientX(ev.clientX))
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const selStart = selectedNode?.params?.timeStart ?? 0
  const selEnd = selectedNode?.params?.timeEnd ?? safeDuration
  const canEditSel = Boolean(selectedNode && onUpdateNodeTimeRange && selectedNode.type !== 'scene_shot')

  const startSpanDrag = (e: React.PointerEvent, mode: 'start' | 'end' | 'move'): void => {
    e.stopPropagation()
    e.preventDefault()
    if (!selectedNode || !onUpdateNodeTimeRange || !canEditSel || !rulerRef.current) return
    const w = Math.max(60, rulerRef.current.getBoundingClientRect().width)
    const initX = e.clientX
    const onMove = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - initX) / w) * safeDuration
      const [s, en] = dragTimeRange(mode, selStart, selEnd, dt, 0, safeDuration)
      onUpdateNodeTimeRange(selectedNode.id, s, en)
      if (mode !== 'move') onSetTime(mode === 'start' ? s : en)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const playPct = toPct(currentTime)
  const capAlign = playPct < 4 ? 'align-left' : playPct > 96 ? 'align-right' : ''
  const accent = selectedNode ? resolveV2NodeTheme(selectedNode).accent : 'var(--accent)'

  return (
    <div className="wf-v2-ruler-bar" data-mcp-region="workflow_ruler">
      <div className="wf-v2-ruler-controls">
        <button
          type="button"
          className={`wf-v2-play-btn${playing ? ' playing' : ''}`}
          onClick={onTogglePlay}
          title={playing ? 'Tạm dừng (Space)' : 'Phát (Space)'}
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
        </button>
        <button type="button" className="wf-v2-zero-btn" onClick={() => onSetTime(0)} title="Về đầu (Home)" aria-label="Về đầu">
          <IconSkipStart width={12} height={12} />
        </button>
        <div className="wf-v2-time-readout" title="Mốc hiện tại / Tổng thời lượng">
          <span className="wf-v2-time-cur">{currentTime.toFixed(2)}s</span>
          <span className="wf-v2-time-max">/ {safeDuration.toFixed(1)}s</span>
        </div>
        <span className="wf-v2-active-badge" title="Số Node đang hoạt động tại mốc hiện tại">
          {activeAtTimeCount} hoạt động
        </span>
      </div>

      <div ref={rulerRef} className="wf-v2-ruler-track" onPointerDown={handleScrubDown} title="Nhấp hoặc kéo để tua">
        <div className="wf-v2-ruler-scope-mask left" style={{ width: `${toPct(scopeRange.start)}%` }} />
        <div className="wf-v2-ruler-scope-mask right" style={{ left: `${toPct(scopeRange.end)}%` }} />
        {ticks.map((tk) => {
          const p = toPct(tk.t)
          return (
            <div key={tk.t} className={`wf-v2-ruler-tick ${tk.major ? 'major' : 'minor'}`} style={{ left: `${p}%` }}>
              {tk.major && (
                <span className={`wf-v2-ruler-tick-label${p < 2 ? ' edge-left' : p > 97 ? ' edge-right' : ''}`}>
                  {Number.isInteger(tk.t) ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}
                </span>
              )}
            </div>
          )
        })}

        {selectedNode && (
          <div
            className={`wf-v2-ruler-node-span${canEditSel ? '' : ' read-only'}`}
            style={{ left: `${toPct(selStart)}%`, width: `${Math.max(0.6, toPct(selEnd) - toPct(selStart))}%`, ['--wf-span-c' as string]: accent }}
            onPointerDown={(e) => startSpanDrag(e, 'move')}
            title={`${cleanV2NodeTitle(selectedNode.title)}: ${selStart.toFixed(2)}s → ${selEnd.toFixed(2)}s`}
          >
            {canEditSel && <div className="wf-v2-ruler-span-handle left" onPointerDown={(e) => startSpanDrag(e, 'start')} />}
            {canEditSel && <div className="wf-v2-ruler-span-handle right" onPointerDown={(e) => startSpanDrag(e, 'end')} />}
          </div>
        )}

        <div className="wf-v2-ruler-playhead" style={{ left: `${playPct}%` }}>
          <span className={`wf-v2-ruler-playhead-cap ${capAlign}`}>{currentTime.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  )
}
