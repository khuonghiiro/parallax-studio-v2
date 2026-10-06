import React, { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { AudioTrackItem, Project } from '@shared/types'
import { duplicateAudioTrack, removeAudioTrack, splitAudioTrack } from '../../actions'
import { assetStore } from '../../project/assets'
import { getAudioPeaks } from '../../project/audioPeaks'
import { syncProjectAudio } from '../../project/audioTracks'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { IconCopy, IconMusic, IconScissors, IconSliders, IconTrash } from '../icons'
import { PAD } from './timelineTypes'
import { TimelineRow } from './TimelineRow'

export interface AudioRowProps {
  track?: AudioTrackItem
  trackIndex?: number
  totalTracks?: number
  x: (t: number) => number
  trackW: number
}

export function AudioRow({ track: propTrack, x, trackW }: AudioRowProps) {
  const projectAudio = useEditor((s) => s.project.audio)
  const duration = useEditor((s) => s.project.comp.duration)
  const selectedAudioTrackId = useEditor((s) => s.selectedAudioTrackId)
  const theme = useView((s) => s.theme)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const track: AudioTrackItem | null =
    propTrack ||
    (projectAudio
      ? {
          id: projectAudio.id || 'main',
          assetId: projectAudio.assetId,
          name: projectAudio.name,
          offset: projectAudio.offset,
          volume: projectAudio.volume
        }
      : null)

  const isSelected = track ? selectedAudioTrackId === track.id : false

  if (!track) return null

  const meta = assetStore.get(track.assetId)?.meta
  const audioDur = meta?.duration ?? 0
  const left = x(track.offset)
  const width = Math.max(4, x(track.offset + audioDur) - left)
  const trackName = track.name || meta?.name || 'Audio'

  useEffect(() => {
    let alive = true
    getAudioPeaks(track.assetId).then((peaks) => {
      const c = canvasRef.current
      if (!alive || !c || peaks.length === 0) return
      const w = Math.max(1, Math.min(8000, Math.round(width)))
      const h = 22
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, w, h)

      const isLight = theme === 'light'
      // High contrast electric sky blue on the dark blue bar in Light theme, vivid cyan blue on Dark theme
      const waveColor = isLight ? '#e0f2fe' : '#38bdf8'
      const centerLine = isLight ? 'rgba(224, 242, 254, 0.22)' : 'rgba(56, 189, 248, 0.2)'

      // Draw subtle center baseline
      ctx.strokeStyle = centerLine
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Draw mirrored dual-sided waveform peaks
      ctx.fillStyle = waveColor
      for (let i = 0; i < w; i++) {
        const v = peaks[Math.floor((i / w) * peaks.length)] * track.volume
        if (v <= 0.002) continue
        const bh = Math.max(1, Math.round(v * (h - 4)))
        const top = Math.round((h - bh) / 2)
        ctx.fillRect(i, top, 1, bh)
      }
    })
    return () => {
      alive = false
    }
  }, [track.assetId, track.volume, width, theme])

  const drag = (e: React.PointerEvent): void => {
    const startX = e.clientX
    const start = track.offset
    const key = `audio-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - startX) / (trackW - PAD * 2)) * duration
      const newOffset = Math.max(0, Math.round((start + dt) * 100) / 100)
      useEditor.getState().update((d) => {
        if (!d.audioTracks) d.audioTracks = []
        const item = d.audioTracks.find((it) => it.id === track.id)
        if (item) {
          item.offset = newOffset
        } else if (d.audio && (d.audio.id === track.id || track.id === 'main')) {
          d.audio.offset = newOffset
        }
        syncProjectAudio(d as Project)
      }, key)
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
      trackWidth={trackW}
      selected={isSelected}
      onClick={() => useEditor.getState().selectAudioTrack(track.id)}
      onTrackPointerDown={() => useEditor.getState().selectAudioTrack(track.id)}
      name={
        <div className="tl-name">
          <span style={{ width: 14 }} />
          <span className="ico" style={{ background: '#2563eb', color: '#fff' }}>
            <IconMusic width={11} height={11} />
          </span>
          <span
            className="label"
            title={`${trackName} · Bắt đầu lúc ${track.offset.toFixed(2)}s · Click để chọn (nhấn Del để xoá)`}
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {trackName}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-faint)',
              marginRight: 4,
              flexShrink: 0
            }}
          >
            {track.offset.toFixed(1)}s
          </span>
          <span className="row-actions">
            <button
              type="button"
              className="mini"
              title="Cấu hình mức âm lượng & biểu đồ sóng âm (L / LL)"
              onClick={(e) => {
                e.stopPropagation()
                useView.getState().openAudioDialog('waveform')
              }}
            >
              <IconSliders width={12} height={12} />
            </button>
            <button
              type="button"
              className="mini"
              title="Cắt đôi đoạn âm thanh này tại vị trí kim phát"
              onClick={(e) => {
                e.stopPropagation()
                splitAudioTrack(track.id)
              }}
            >
              <IconScissors width={12} height={12} />
            </button>
            <button
              type="button"
              className="mini"
              title="Tạo trùng (nhân bản) đoạn âm thanh này tại kim phát"
              onClick={(e) => {
                e.stopPropagation()
                duplicateAudioTrack(track.id)
              }}
            >
              <IconCopy width={12} height={12} />
            </button>
            <button
              type="button"
              className="mini danger"
              title="Xoá đoạn âm thanh này (Del)"
              onClick={(e) => {
                e.stopPropagation()
                removeAudioTrack(track.id)
              }}
            >
              <IconTrash width={12} height={12} />
            </button>
          </span>
        </div>
      }
      track={
        <div
          className={`tl-bar tl-audio-bar${isSelected ? ' selected' : ''}`}
          tabIndex={0}
          title={`Click để chọn (nhấn Del để xoá) · Kéo để dời thời điểm (${track.offset.toFixed(2)}s) · Double click để mở bảng sóng âm (LL) · ${trackName}`}
          style={{
            left,
            width,
            overflow: 'hidden'
          }}
          onPointerDown={(e) => {
            useEditor.getState().selectAudioTrack(track.id)
            drag(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              e.stopPropagation()
              removeAudioTrack(track.id)
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            useView.getState().openAudioDialog('waveform')
          }}
        >
          <span className="tl-audio-bar-tag">
            <IconMusic width={10} height={10} strokeWidth={2.4} />
            {trackName}
          </span>
          <canvas
            ref={canvasRef}
            className="audio-wave"
            style={{ width: '100%', height: 'calc(100% - 4px)' }}
          />
        </div>
      }
    />
  )
}
