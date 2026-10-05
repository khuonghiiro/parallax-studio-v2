import React, { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import { assetStore } from '../../project/assets'
import { getAudioPeaks } from '../../project/audioPeaks'
import { useEditor } from '../../store/editor'
import { IconMusic } from '../icons'
import { PAD } from './timelineTypes'
import { TimelineRow } from './TimelineRow'

export interface AudioRowProps {
  x: (t: number) => number
  trackW: number
}

export function AudioRow({ x, trackW }: AudioRowProps) {
  const audio = useEditor((s) => s.project.audio)!
  const duration = useEditor((s) => s.project.comp.duration)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const meta = assetStore.get(audio.assetId)?.meta
  const audioDur = meta?.duration ?? 0
  const left = x(audio.offset)
  const width = Math.max(4, x(audio.offset + audioDur) - left)

  useEffect(() => {
    let alive = true
    getAudioPeaks(audio.assetId).then((peaks) => {
      const c = canvasRef.current
      if (!alive || !c || peaks.length === 0) return
      const w = Math.max(1, Math.min(8000, Math.round(width)))
      const h = 20
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#3dd6f5'
      for (let i = 0; i < w; i++) {
        const v = peaks[Math.floor((i / w) * peaks.length)] * audio.volume
        const bh = Math.max(1, v * h)
        ctx.fillRect(i, (h - bh) / 2, 1, bh)
      }
    })
    return () => {
      alive = false
    }
  }, [audio.assetId, audio.volume, width])

  const drag = (e: React.PointerEvent): void => {
    const startX = e.clientX
    const start = audio.offset
    const key = `audio-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - startX) / (trackW - PAD * 2)) * duration
      useEditor.getState().update((d) => void (d.audio && (d.audio.offset = Math.round((start + dt) * 100) / 100)), key)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <TimelineRow
      name={
        <div className="tl-name">
          <span style={{ width: 20 }} />
          <span className="ico" style={{ background: '#4ade80' }}>
            <IconMusic width={11} height={11} />
          </span>
          <span className="label">{meta?.name ?? 'Audio'}</span>
        </div>
      }
      track={
        <div
          className="tl-bar"
          title="Kéo để dời thời điểm bắt đầu nhạc"
          style={{
            left,
            width,
            background: 'rgba(74,222,128,0.12)',
            border: '1px solid rgba(74,222,128,0.4)',
            overflow: 'hidden'
          }}
          onPointerDown={drag}
        >
          <canvas ref={canvasRef} className="audio-wave" style={{ width: '100%', height: 'calc(100% - 6px)' }} />
        </div>
      }
    />
  )
}
