import React from 'react'
import { nanoid } from 'nanoid'
import type { Layer, LayerGlow } from '@shared/types'
import { snapToFrame } from '../../animation/math'
import { useEditor } from '../../store/editor'
import { PAD } from './timelineTypes'
import { IconSparkles } from '../icons'
import { getAllGlowConfigs, type GlowInstance } from '../../engine/layerGlow'

export interface TimelineGlowKeysProps {
  layer: Layer
  x: (t: number) => number
  trackWidth?: number
  isSubRow?: boolean
}

interface GlowStripItemProps {
  instance: GlowInstance
  layer: Layer
  x: (t: number) => number
  trackWidth: number
  isSubRow: boolean
}

function calculateMidKeys(glow: LayerGlow, startT: number, dur: number): number[] {
  const midKeys: number[] = []
  if (dur <= 0 || !glow.animated || glow.animated === 'none') return midKeys

  if (glow.animated === 'blink') {
    const blinks = Math.min(8, Math.max(2, Math.round((glow.speed || 2) * dur)))
    const step = dur / blinks
    for (let i = 0; i < blinks; i++) {
      midKeys.push(Math.round((startT + (i + 0.5) * step) * 1000) / 1000)
    }
  } else if (glow.animated === 'breathe' || glow.animated === 'flicker') {
    midKeys.push(Math.round((startT + dur * 0.5) * 1000) / 1000)
  }
  return midKeys
}

function GlowStripItem({ instance, layer, x, trackWidth, isSubRow }: GlowStripItemProps) {
  const { id, name, glow } = instance
  const isGlowOff = !glow.enabled
  const comp = useEditor((s) => s.project.comp)
  const setTime = useEditor((s) => s.setTime)
  const selectLayer = useEditor((s) => s.selectLayer)

  const startT = glow.startTime !== undefined ? glow.startTime : layer.inPoint
  const dur = glow.duration || 0
  const endT = dur > 0 ? Math.min(layer.outPoint, startT + dur) : layer.outPoint
  const color = isGlowOff ? 'var(--text-faint)' : (glow.color || '#3dd6f5')
  const effectName = name || 'Viền Neon'

  const midKeys = calculateMidKeys(glow, startT, dur)

  const handleKeyDrag = (e: React.PointerEvent, mode: 'start' | 'end' | 'strip') => {
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
        if (!l) return

        let targetGlow: LayerGlow | undefined = undefined
        let targetFx: any = null

        if (id !== 'standalone' && l.appliedEffects) {
          targetFx = l.appliedEffects.find((fx) => fx.id === id)
          if (targetFx && targetFx.glow) {
            targetGlow = targetFx.glow
          }
        } else if (l.glow) {
          targetGlow = l.glow
        }

        if (!targetGlow) return

        if (mode === 'start') {
          const newStart = Math.max(
            layer.inPoint,
            Math.min(layer.outPoint - 0.1, snapToFrame(origStart + dt, comp.fps))
          )
          targetGlow.startTime = newStart
          if (targetFx) targetFx.startTime = newStart
        } else if (mode === 'end') {
          const newEnd = Math.max(
            origStart + 0.1,
            Math.min(layer.outPoint, snapToFrame(origStart + origDur + dt, comp.fps))
          )
          const newDur = Math.max(0.1, Math.round((newEnd - origStart) * 100) / 100)
          targetGlow.duration = newDur
          if (targetFx) targetFx.duration = newDur
        } else if (mode === 'strip') {
          const maxStart = origDur > 0 ? layer.outPoint - origDur : layer.outPoint - 0.2
          const newStart = Math.max(
            layer.inPoint,
            Math.min(maxStart, snapToFrame(origStart + dt, comp.fps))
          )
          targetGlow.startTime = newStart
          if (targetFx) targetFx.startTime = newStart
        }

        if (l.glow && (id === 'standalone' || l.glow.color === targetGlow.color)) {
          l.glow.startTime = targetGlow.startTime
          l.glow.duration = targetGlow.duration
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
    <React.Fragment key={id}>
      {/* Neon Glow Strip */}
      <div
        className={`tl-glow-strip${isSubRow ? ' sub-row' : ''}${isGlowOff ? ' disabled' : ''}`}
        style={{
          left: leftPx,
          width: stripW,
          ['--glow-color' as string]: color,
          opacity: isGlowOff ? 0.35 : undefined,
          filter: isGlowOff ? 'grayscale(1)' : undefined
        }}
        title={`✨ ${effectName} ${isGlowOff ? '[ĐÃ TẮT] ' : ''}: ${startT.toFixed(2)}s → ${endT.toFixed(2)}s (${dur === 0 ? 'Suốt layer' : `${dur.toFixed(2)}s`}) - Click để chọn, kéo để di chuyển`}
        onPointerDown={(e) => handleKeyDrag(e, 'strip')}
        onDoubleClick={() => setTime(startT)}
      >
        <span className="tl-glow-strip-label">
          <span>✨</span>
          <span>{isGlowOff ? 'Tắt' : `${effectName} (${dur === 0 ? 'Suốt layer' : `${dur.toFixed(1)}s`})`}</span>
        </span>
      </div>

      {/* Start Key Icon (✨) */}
      <div
        className={`tl-key tl-key-glow tl-key-glow-icon start${isGlowOff ? ' disabled' : ''}`}
        style={{
          left: leftPx,
          ['--glow-color' as string]: color
        }}
        title={`✨ Bắt đầu ${effectName} ${isGlowOff ? '[ĐÃ TẮT] ' : ''}@ ${startT.toFixed(2)}s (Click nhảy tới, kéo để dời mốc)`}
        onPointerDown={(e) => handleKeyDrag(e, 'start')}
        onDoubleClick={() => setTime(startT)}
      >
        <IconSparkles className="tl-key-glow-sparkle" width={10} height={10} style={{ color: isGlowOff ? 'var(--text-faint)' : color }} />
      </div>

      {/* Mid Pulse/Blink Keys Diamonds (✨) */}
      {midKeys.map((mt, idx) => (
        <div
          key={`mid-${idx}-${mt}`}
          className={`tl-key tl-key-glow tl-key-glow-icon sub${isGlowOff ? ' disabled' : ''}`}
          style={{
            left: x(mt),
            ['--glow-color' as string]: color
          }}
          title={`✨ Nhịp chớp ${effectName} ${isGlowOff ? '[ĐÃ TẮT] ' : ''}@ ${mt.toFixed(2)}s`}
          onPointerDown={(e) => {
            e.stopPropagation()
            setTime(mt)
          }}
        >
          <IconSparkles className="tl-key-glow-sparkle" width={7} height={7} style={{ color: isGlowOff ? 'var(--text-faint)' : color }} />
        </div>
      ))}

      {/* End Key Icon (✨) (only if duration > 0) */}
      {dur > 0 && (
        <div
          className={`tl-key tl-key-glow tl-key-glow-icon end${isGlowOff ? ' disabled' : ''}`}
          style={{
            left: rightPx,
            ['--glow-color' as string]: color
          }}
          title={`✨ Kết thúc ${effectName} ${isGlowOff ? '[ĐÃ TẮT] ' : ''}@ ${endT.toFixed(2)}s (Click nhảy tới, kéo để co giãn thời lượng)`}
          onPointerDown={(e) => handleKeyDrag(e, 'end')}
          onDoubleClick={() => setTime(endT)}
        >
          <IconSparkles className="tl-key-glow-sparkle" width={10} height={10} style={{ color: isGlowOff ? 'var(--text-faint)' : color }} />
        </div>
      )}
    </React.Fragment>
  )
}

export function TimelineGlowKeys({
  layer,
  x,
  trackWidth = 800,
  isSubRow = false
}: TimelineGlowKeysProps) {
  const configs = getAllGlowConfigs(layer)
  if (configs.length === 0) return null

  return (
    <>
      {configs.map((instance) => (
        <GlowStripItem
          key={instance.id}
          instance={instance}
          layer={layer}
          x={x}
          trackWidth={trackWidth}
          isSubRow={isSubRow}
        />
      ))}
    </>
  )
}
