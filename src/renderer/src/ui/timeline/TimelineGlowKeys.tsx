import React from 'react'
import { nanoid } from 'nanoid'
import type { Layer } from '@shared/types'
import { snapToFrame } from '../../animation/math'
import { useEditor } from '../../store/editor'
import { PAD } from './timelineTypes'

export interface TimelineGlowKeysProps {
  layer: Layer
  x: (t: number) => number
  trackWidth?: number
  isSubRow?: boolean
}

export function TimelineGlowKeys({
  layer,
  x,
  trackWidth = 800,
  isSubRow = false
}: TimelineGlowKeysProps) {
  const glow = layer.glow
  if (!glow || !glow.enabled) return null

  const comp = useEditor((s) => s.project.comp)
  const setTime = useEditor((s) => s.setTime)
  const selectLayer = useEditor((s) => s.selectLayer)

  const startT = glow.startTime !== undefined ? glow.startTime : layer.inPoint
  const dur = glow.duration || 0
  const endT = dur > 0 ? Math.min(layer.outPoint, startT + dur) : layer.outPoint
  const color = glow.color || '#3dd6f5'

  // Mid keys calculation for blink / breathe / flicker
  const midKeys: number[] = []
  if (dur > 0 && glow.animated && glow.animated !== 'none') {
    if (glow.animated === 'blink') {
      const blinks = Math.min(8, Math.max(2, Math.round((glow.speed || 2) * dur)))
      const step = dur / blinks
      for (let i = 0; i < blinks; i++) {
        midKeys.push(Math.round((startT + (i + 0.5) * step) * 1000) / 1000)
      }
    } else if (glow.animated === 'breathe' || glow.animated === 'flicker') {
      midKeys.push(Math.round((startT + dur * 0.5) * 1000) / 1000)
    }
  }

  // Dragging logic
  const handleKeyDrag = (
    e: React.PointerEvent,
    mode: 'start' | 'end' | 'strip'
  ) => {
    e.stopPropagation()
    selectLayer(layer.id)
    if (layer.locked) return

    const startX = e.clientX
    const origStart = startT
    const origDur = dur
    const key = `glowdrag-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    let moved = false

    const move = (ev: PointerEvent) => {
      const dt = ((ev.clientX - startX) / (trackWidth - PAD * 2)) * comp.duration
      if (Math.abs(ev.clientX - startX) > 2) moved = true

      useEditor.getState().update((d) => {
        const l = d.layers.find((q) => q.id === layer.id)
        if (!l || !l.glow) return

        if (mode === 'start') {
          const newStart = Math.max(
            layer.inPoint,
            Math.min(layer.outPoint - 0.1, snapToFrame(origStart + dt, comp.fps))
          )
          l.glow.startTime = newStart
        } else if (mode === 'end') {
          const newEnd = Math.max(
            origStart + 0.1,
            Math.min(layer.outPoint, snapToFrame(origStart + origDur + dt, comp.fps))
          )
          l.glow.duration = Math.max(0.1, Math.round((newEnd - origStart) * 100) / 100)
        } else if (mode === 'strip') {
          const maxStart = origDur > 0 ? layer.outPoint - origDur : layer.outPoint - 0.2
          const newStart = Math.max(
            layer.inPoint,
            Math.min(maxStart, snapToFrame(origStart + dt, comp.fps))
          )
          l.glow.startTime = newStart
        }
      }, key)
    }

    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      if (!moved) {
        if (mode === 'start') setTime(startT)
        else if (mode === 'end') setTime(endT)
      }
    }

    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const leftPx = x(startT)
  const rightPx = x(endT)
  const stripW = Math.max(10, rightPx - leftPx)

  return (
    <>
      {/* Neon Glow Strip */}
      <div
        className={`tl-glow-strip${isSubRow ? ' sub-row' : ''}`}
        style={{
          left: leftPx,
          width: stripW,
          ['--glow-color' as string]: color
        }}
        title={`✨ Viền Neon: ${startT.toFixed(2)}s → ${endT.toFixed(2)}s (${dur === 0 ? 'Suốt layer' : `${dur.toFixed(2)}s`}) - Click để chọn, kéo để di chuyển`}
        onPointerDown={(e) => handleKeyDrag(e, 'strip')}
        onDoubleClick={() => setTime(startT)}
      >
        <span className="tl-glow-strip-label">
          <span>✨</span>
          <span>{dur === 0 ? 'Suốt layer' : `${dur.toFixed(1)}s`}</span>
        </span>
      </div>

      {/* Start Key Diamond (◆) */}
      <div
        className="tl-key tl-key-glow start"
        style={{
          left: leftPx,
          ['--glow-color' as string]: color
        }}
        title={`✨ Bắt đầu Neon @ ${startT.toFixed(2)}s (Click nhảy tới, kéo để dời mốc)`}
        onPointerDown={(e) => handleKeyDrag(e, 'start')}
        onDoubleClick={() => setTime(startT)}
      />

      {/* Mid Pulse/Blink Keys Diamonds (◆) */}
      {midKeys.map((mt, idx) => (
        <div
          key={`mid-${idx}-${mt}`}
          className="tl-key tl-key-glow sub"
          style={{
            left: x(mt),
            ['--glow-color' as string]: color
          }}
          title={`✨ Nhịp chớp Neon @ ${mt.toFixed(2)}s`}
          onPointerDown={(e) => {
            e.stopPropagation()
            setTime(mt)
          }}
        />
      ))}

      {/* End Key Diamond (◆) (only if duration > 0) */}
      {dur > 0 && (
        <div
          className="tl-key tl-key-glow end"
          style={{
            left: rightPx,
            ['--glow-color' as string]: color
          }}
          title={`✨ Kết thúc Neon @ ${endT.toFixed(2)}s (Click nhảy tới, kéo để co giãn thời lượng)`}
          onPointerDown={(e) => handleKeyDrag(e, 'end')}
          onDoubleClick={() => setTime(endT)}
        />
      )}
    </>
  )
}
