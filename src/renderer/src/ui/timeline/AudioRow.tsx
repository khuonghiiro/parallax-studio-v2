import React, { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { AudioTrackItem, Project } from '@shared/types'
import { duplicateAudioTrack, removeAudioTrack, splitAudioTrack } from '../../actions'
import { assetStore } from '../../project/assets'
import { getAudioPeaks } from '../../project/audioPeaks'
import { syncProjectAudio } from '../../project/audioTracks'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  IconCopy,
  IconCube,
  IconLayerAssembly,
  IconLipSync,
  IconMusic,
  IconScissors,
  IconSliders,
  IconTrash,
  IconVoiceDialogue
} from '../icons'
import { PAD } from './timelineTypes'
import { TimelineRow } from './TimelineRow'
import { AudioTargetModal } from './AudioTargetModal'

export interface AudioRowProps {
  track?: AudioTrackItem
  trackIndex?: number
  totalTracks?: number
  nested?: boolean
  clusterRole?: 'child'
  x: (t: number) => number
  trackW: number
}

function AudioRowComponent({ track: propTrack, nested, clusterRole, x, trackW }: AudioRowProps) {
  const projectAudio = useEditor((s) => s.project.audio)
  const duration = useEditor((s) => s.project.comp.duration)
  const selectedAudioTrackId = useEditor((s) => s.selectedAudioTrackId)
  const theme = useView((s) => s.theme)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isTargetModalOpen, setIsTargetModalOpen] = React.useState(false)

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
  const isVoice = track.characterRole === 'voice' || track.lipSyncEnabled

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
      // Dùng màu hồng cánh sen nếu là track thoại của nhân vật
      const waveColor = isVoice
        ? (isLight ? '#f43f5e' : '#fb7185')
        : (isLight ? '#e0f2fe' : '#38bdf8')
      const centerLine = isVoice
        ? 'rgba(244, 63, 94, 0.25)'
        : (isLight ? 'rgba(224, 242, 254, 0.22)' : 'rgba(56, 189, 248, 0.2)')

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
  }, [track.assetId, track.volume, width, theme, isVoice])

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
    <>
      <TimelineRow
        trackWidth={trackW}
        selected={isSelected}
        onClick={() => useEditor.getState().selectAudioTrack(track.id)}
        onTrackPointerDown={() => useEditor.getState().selectAudioTrack(track.id)}
        name={
          <div
            className={`tl-name${nested ? ' nested' : ''}${clusterRole === 'child' ? ' tl-cluster-child' : ''}`}
            style={{
              paddingLeft: clusterRole === 'child' ? 14 : undefined,
              borderLeft: clusterRole === 'child' ? '2px solid rgba(168, 85, 247, 0.4)' : undefined
            }}
          >
            <span style={{ width: 14 }} />
            <span
              className="ico"
              style={{
                background: isVoice ? '#be185d' : '#2563eb',
                color: '#fff'
              }}
            >
              {isVoice ? <IconVoiceDialogue width={11} height={11} /> : <IconMusic width={11} height={11} />}
            </span>
            <span
              className="label"
              title={`${trackName} · Bắt đầu lúc ${track.offset.toFixed(2)}s · Click để chọn (nhấn Del để xoá)`}
              style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {clusterRole === 'child' ? `[Thoại] ${trackName}` : trackName}
            </span>

            {/* Badge mục tiêu liên kết */}
            {track.targetName ? (
              <button
                type="button"
                className="tl-audio-target-badge mini"
                title={`Đã gắn vào: ${track.targetName} (${track.characterRole || 'voice'}) · Click để sửa hoặc đổi`}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsTargetModalOpen(true)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '9.5px',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border:
                    track.targetType === 'character'
                      ? '1px solid rgba(99, 102, 241, 0.4)'
                      : '1px solid rgba(6, 182, 212, 0.4)',
                  background:
                    track.targetType === 'character'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(6, 182, 212, 0.15)',
                  color: track.targetType === 'character' ? 'var(--accent, #6366f1)' : 'var(--accent-cyan, #06b6d4)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {track.targetType === 'character' ? (
                  <IconLayerAssembly width={9} height={9} />
                ) : track.targetType === 'model3d' ? (
                  <IconCube width={9} height={9} />
                ) : (
                  <IconMusic width={9} height={9} />
                )}
                <span style={{ fontWeight: 600 }}>{track.targetName}</span>
                {track.characterRole === 'voice' && <span style={{ opacity: 0.85 }}>[Thoại]</span>}
                {track.lipSyncEnabled && (
                  <span title="Đang bật khẩu hình miệng" style={{ color: '#f43f5e', display: 'flex' }}>
                    <IconLipSync width={9} height={9} strokeWidth={2.4} />
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="tl-audio-bind-btn mini"
                title="Gắn đoạn âm thanh này vào nhân vật / khối 3D / layer để đồng bộ animation"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsTargetModalOpen(true)
                }}
                style={{
                  fontSize: '9px',
                  color: 'var(--text-faint)',
                  border: '1px dashed var(--line)',
                  padding: '1px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                + Gắn mục tiêu
              </button>
            )}

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
                className={`mini${track.targetName ? ' active' : ''}`}
                title="Gắn mục tiêu (nhân vật, 3D, khẩu hình miệng Lip-sync, đổi âm thanh)"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsTargetModalOpen(true)
                }}
              >
                <IconVoiceDialogue width={12} height={12} />
              </button>
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
            className={`tl-bar tl-audio-bar${isSelected ? ' selected' : ''}${isVoice ? ' tl-audio-bar-voice' : ''}`}
            tabIndex={0}
            title={`Click để chọn (nhấn Del để xoá) · Kéo để dời thời điểm (${track.offset.toFixed(2)}s) · Double click để mở bảng sóng âm (LL) · ${trackName}`}
            style={{
              left,
              width,
              overflow: 'hidden',
              ...(isVoice
                ? {
                    border: '1px solid rgba(244, 63, 94, 0.65)',
                    boxShadow: '0 0 8px rgba(244, 63, 94, 0.25)'
                  }
                : {})
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
            <span className="tl-audio-bar-tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isVoice ? (
                <IconLipSync width={10} height={10} strokeWidth={2.4} />
              ) : (
                <IconMusic width={10} height={10} strokeWidth={2.4} />
              )}
              {track.targetName ? `[${track.targetName}] ${trackName}` : trackName}
            </span>
            <canvas
              ref={canvasRef}
              className="audio-wave"
              style={{ width: '100%', height: 'calc(100% - 4px)' }}
            />
          </div>
        }
      />

      {isTargetModalOpen && (
        <AudioTargetModal track={track} onClose={() => setIsTargetModalOpen(false)} />
      )}
    </>
  )
}

export const AudioRow = React.memo(AudioRowComponent)
