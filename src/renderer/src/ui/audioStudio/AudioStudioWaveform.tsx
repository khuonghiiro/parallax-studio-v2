import { useEffect, useRef, useState } from 'react'
import type { AudioTrackItem } from '@shared/types'
import { getAudioPeaks } from '../../project/audioPeaks'
import { duplicateAudioTrack, mergeAudioTracks, splitAudioTrack } from '../../actions'
import { IconCopy, IconMerge, IconScissors } from '../icons'

interface AudioStudioWaveformProps {
  curTrack: AudioTrackItem | null
  time: number
  totalTracks: number
  theme: string
  onSeek: (time: number) => void
}

export function AudioStudioWaveform({
  curTrack,
  time,
  totalTracks,
  theme,
  onSeek
}: AudioStudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)

  useEffect(() => {
    if (!curTrack?.assetId) return
    let alive = true
    getAudioPeaks(curTrack.assetId, 1200).then((res) => {
      if (alive) setPeaks(res)
    })
    return () => {
      alive = false
    }
  }, [curTrack?.assetId])

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !peaks || peaks.length === 0 || !curTrack) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const isLight = theme === 'light'
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    if (isLight) {
      grad.addColorStop(0, '#2563eb')
      grad.addColorStop(0.5, '#0284c7')
      grad.addColorStop(1, '#2563eb')
    } else {
      grad.addColorStop(0, '#38bdf8')
      grad.addColorStop(0.5, '#60a5fa')
      grad.addColorStop(1, '#38bdf8')
    }

    // Grid baseline
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h * 0.25)
    ctx.lineTo(w, h * 0.25)
    ctx.moveTo(0, h * 0.75)
    ctx.lineTo(w, h * 0.75)
    ctx.stroke()

    // Center subtle baseline
    ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.35)' : 'rgba(56, 189, 248, 0.35)'
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    // Waveform bars
    ctx.fillStyle = grad
    const step = w / peaks.length
    for (let i = 0; i < peaks.length; i++) {
      const v = peaks[i] * (curTrack.muted ? 0 : curTrack.volume)
      if (v <= 0.001) continue
      const barH = Math.max(1, Math.round(v * (h - 16)))
      const top = Math.round((h - barH) / 2)
      ctx.fillRect(i * step, top, Math.max(1, step - 0.4), barH)
    }

    // Playhead line relative to this track's start
    const relTime = time - curTrack.offset
    const totalEstDuration = curTrack.duration || 10
    if (relTime >= 0 && relTime <= totalEstDuration) {
      const playheadX = Math.min(w - 2, Math.max(0, (relTime / totalEstDuration) * w))
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, h)
      ctx.stroke()
    }
  }, [peaks, curTrack?.volume, curTrack?.offset, curTrack?.duration, curTrack?.muted, time, theme])

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!curTrack) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const totalEst = curTrack.duration || 10
    const targetTime = Math.round((curTrack.offset + ratio * totalEst) * 100) / 100
    onSeek(targetTime)
  }

  const canSplitAtPlayhead = curTrack
    ? time > curTrack.offset && (!curTrack.duration || time < curTrack.offset + curTrack.duration)
    : false

  if (!curTrack) return null

  return (
    <div className="audio-waveform-panel">
      <div className="waveform-panel-header">
        <span>Biểu đồ sóng âm (Click trên sóng âm để đặt kim phát)</span>
        <span className="waveform-hint">Kim đỏ: Thời điểm timeline ({time.toFixed(2)}s)</span>
      </div>

      <div className="waveform-canvas-box" title="Click trên sóng âm để nhảy kim phát đến vị trí đó">
        <canvas
          ref={canvasRef}
          className="audio-studio-canvas"
          onClick={handleWaveformClick}
          style={{ cursor: 'crosshair' }}
        />
      </div>

      <div className="waveform-ruler-marks">
        <span>0.0s</span>
        <span>+2.5s</span>
        <span>+5.0s</span>
        <span>+7.5s</span>
        <span>+10.0s</span>
      </div>

      <div className="audio-tools-action-bar">
        <button
          className="btn primary"
          disabled={!canSplitAtPlayhead}
          onClick={() => splitAudioTrack(curTrack.id, time)}
          title={
            canSplitAtPlayhead
              ? `Cắt đôi track "${curTrack.name}" tại thời điểm ${time.toFixed(2)}s`
              : `Kim phát (${time.toFixed(2)}s) phải nằm trong khoảng thời gian phát của track để cắt`
          }
        >
          <IconScissors width={13} height={13} />
          Cắt đôi âm thanh tại kim phát ({time.toFixed(2)}s)
        </button>

        <button
          className="btn"
          onClick={() => duplicateAudioTrack(curTrack.id)}
          title="Tách hoặc tạo một bản sao độc lập của luồng âm này"
        >
          <IconCopy width={13} height={13} />
          Tách / Nhân bản luồng âm
        </button>

        <button
          className="btn"
          disabled={totalTracks < 2}
          onClick={() => mergeAudioTracks()}
          title="Hòa âm và gộp tất cả các luồng âm thành 1 tệp WAV tổng hợp"
        >
          <IconMerge width={13} height={13} />
          Gộp các luồng âm ({totalTracks})
        </button>
      </div>
    </div>
  )
}
