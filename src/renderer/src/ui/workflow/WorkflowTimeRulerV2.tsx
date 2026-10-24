import React, { useMemo, useRef } from 'react'
import type { Project, Shot, WorkflowNode } from '@shared/types'
import { getShotTimeRange } from '../../project/workflowV2Engine'
export interface WorkflowTimeRulerV2Props {
  project: Project
  currentTime: number
  duration: number
  playing: boolean
  shots: Shot[]
  selectedNode: WorkflowNode | null
  activeAtTimeCount: number
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onUpdateNodeTimeRange?: (nodeId: string, nextStart: number, nextEnd: number) => void
}
/**
 * Đường kẻ mốc thời gian (Master Time Ruler) nằm trên đỉnh khung vẽ Workflow V2.
 * Cho phép kéo kim thời gian (Playhead) thời gian thực 60fps và kéo trực tiếp khoảng mốc [tStart - tEnd] của Node đang chọn.
 */
export const WorkflowTimeRulerV2: React.FC<WorkflowTimeRulerV2Props> = ({
  project,
  currentTime,
  duration,
  playing,
  shots,
  selectedNode,
  activeAtTimeCount,
  onSetTime,
  onTogglePlay,
  onUpdateNodeTimeRange
}) => {
  const rulerRef = useRef<HTMLDivElement>(null)
  const safeDuration = Math.max(1, duration || 5)
  const ticks = useMemo(() => {
    const step = safeDuration <= 6 ? 0.5 : safeDuration <= 15 ? 1 : 2
    const list: { t: number; major: boolean }[] = []
    const minor = step / 2
    for (let t = 0; t <= safeDuration + 1e-4; t += minor) {
      const rounded = Number(t.toFixed(2))
      const isMajor = Math.abs(rounded / step - Math.round(rounded / step)) < 1e-3
      list.push({ t: rounded, major: isMajor })
    }
    return list
  }, [safeDuration])
  const playheadPct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100))
  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rulerRef.current
    if (!el) return
    e.preventDefault()
    const updateFromClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))
      onSetTime(Number((ratio * safeDuration).toFixed(2)))
    }
    updateFromClientX(e.clientX)
    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const selStart = selectedNode?.params?.timeStart ?? 0
  const selEnd = selectedNode?.params?.timeEnd ?? safeDuration
  const selLeftPct = Math.max(0, Math.min(100, (selStart / safeDuration) * 100))
  const selWidthPct = Math.max(2, Math.min(100 - selLeftPct, ((selEnd - selStart) / safeDuration) * 100))
  const startSelectedRangeDrag = (
    e: React.PointerEvent,
    mode: 'start' | 'end' | 'move'
  ) => {
    if (!selectedNode || !onUpdateNodeTimeRange) return
    e.stopPropagation()
    e.preventDefault()
    const el = rulerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = Math.max(60, rect.width)
    const initX = e.clientX
    const initS = selStart
    const initE = selEnd
    const span = initE - initS
    const onMove = (ev: PointerEvent) => {
      const dt = ((ev.clientX - initX) / w) * safeDuration
      if (mode === 'start') {
        const nextS = Number(Math.max(0, Math.min(initE - 0.1, initS + dt)).toFixed(2))
        onUpdateNodeTimeRange(selectedNode.id, nextS, initE)
        onSetTime(nextS)
      } else if (mode === 'end') {
        const nextE = Number(Math.max(initS + 0.1, Math.min(safeDuration, initE + dt)).toFixed(2))
        onUpdateNodeTimeRange(selectedNode.id, initS, nextE)
        onSetTime(nextE)
      } else {
        let nextS = Math.max(0, initS + dt)
        let nextE = nextS + span
        if (nextE > safeDuration) {
          nextE = safeDuration
          nextS = Math.max(0, safeDuration - span)
        }
        onUpdateNodeTimeRange(selectedNode.id, Number(nextS.toFixed(2)), Number(nextE.toFixed(2)))
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
    <div className="wf-v2-ruler-bar">
      {/* Cụm điều khiển phát & hiển thị mốc giây bên trái */}
      <div className="wf-v2-ruler-controls">
        <button
          type="button"
          className={`wf-v2-play-btn ${playing ? 'playing' : ''}`}
          onClick={onTogglePlay}
          title={playing ? 'Tạm dừng (Space)' : 'Phát theo đường kẻ mốc thời gian (Space)'}
        >
          {playing ? '⏸ Dừng' : '▶ Phát'}
        </button>
        <button
          type="button"
          className="wf-v2-zero-btn"
          onClick={() => onSetTime(0)}
          title="Về mốc 0.0s"
        >
          ⏮ 0s
        </button>
        <div className="wf-v2-time-readout" title="Mốc thời gian hiện tại / Tổng thời lượng">
          <span className="wf-v2-time-cur">{currentTime.toFixed(2)}s</span>
          <span className="wf-v2-time-sep">/</span>
          <span className="wf-v2-time-max">{safeDuration.toFixed(1)}s</span>
        </div>
        <span className="wf-v2-active-badge" title="Số lượng Node đang hoạt động tại mốc thời gian hiện tại">
          ⚡ {activeAtTimeCount} chạy
        </span>
      </div>
      {/* Đường kẻ thước đo mốc thời gian */}
      <div
        ref={rulerRef}
        className="wf-v2-ruler-track"
        onPointerDown={handleRulerPointerDown}
        title="Nhấp hoặc kéo để di chuyển đường kẻ mốc thời gian"
      >
        {/* Phân vùng các Cảnh (Shots) */}
        {shots.map((s, idx) => {
          const range = getShotTimeRange(project, s)
          const left = (range.start / safeDuration) * 100
          const width = ((range.end - range.start) / safeDuration) * 100
          return (
            <div
              key={s.id}
              className="wf-v2-ruler-shot"
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="wf-v2-ruler-shot-tag">
                🎬 #{idx + 1} {s.name}
              </span>
            </div>
          )
        })}
        {/* Vạch chia giây trên thước đo */}
        {ticks.map((tk) => {
          const pct = (tk.t / safeDuration) * 100
          return (
            <div
              key={tk.t}
              className={`wf-v2-ruler-tick ${tk.major ? 'major' : 'minor'}`}
              style={{ left: `${pct}%` }}
            >
              {tk.major && (
                <span
                  className={`wf-v2-ruler-tick-label ${
                    tk.t === 0 ? 'edge-left' : pct > 95 ? 'edge-right' : ''
                  }`}
                >
                  {tk.t.toFixed(1)}s
                </span>
              )}
            </div>
          )
        })}
        {/* Khoảng mốc thời gian của Node đang chọn trên thước đo */}
        {selectedNode && (
          <div
            className="wf-v2-ruler-node-span"
            style={{ left: `${selLeftPct}%`, width: `${selWidthPct}%` }}
            onPointerDown={(e) => startSelectedRangeDrag(e, 'move')}
            title={`Khoảng mốc của "${selectedNode.title}": ${selStart.toFixed(2)}s → ${selEnd.toFixed(2)}s (Kéo để dịch chuyển)`}
          >
            <div
              className="wf-v2-ruler-span-handle left"
              onPointerDown={(e) => startSelectedRangeDrag(e, 'start')}
              title={`Kéo chỉnh mốc bắt đầu (${selStart.toFixed(2)}s)`}
            />
            <span className="wf-v2-ruler-span-text">
              {selectedNode.title}: {selStart.toFixed(1)}s–{selEnd.toFixed(1)}s
            </span>
            <div
              className="wf-v2-ruler-span-handle right"
              onPointerDown={(e) => startSelectedRangeDrag(e, 'end')}
              title={`Kéo chỉnh mốc kết thúc (${selEnd.toFixed(2)}s)`}
            />
          </div>
        )}
        {/* Đầu kim đường kẻ mốc thời gian (Playhead Cap) */}
        <div
          className="wf-v2-ruler-playhead"
          style={{ left: `${playheadPct}%` }}
        >
          <span className="wf-v2-ruler-playhead-cap">{currentTime.toFixed(1)}s</span>
          <div className="wf-v2-ruler-playhead-stem" />
        </div>
      </div>
    </div>
  )
}
