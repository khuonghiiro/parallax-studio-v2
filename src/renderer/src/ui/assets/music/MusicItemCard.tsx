import { useState, useEffect, useRef } from 'react'
import { IconPlay, IconPause, IconPlus, IconTrash, IconSliders, IconVolume, IconLoop, IconPen } from '../../icons'
import { MusicWaveform } from './MusicWaveform'
import { getAudioPeaks, getAudioPeaksFromBlob } from '../../../project/audioPeaks'
import { assetStore } from '../../../project/assets'
import { useEditor } from '../../../store/editor'
import { useView } from '../../../store/view'
import { getProjectAudioTracks } from '../../../project/audioTracks'
import type { AssetMeta } from '@shared/types'

export interface AudioEntry {
  id: string
  name: string
  source: 'project' | 'builtin'
  assetMeta?: AssetMeta
  relPath?: string
  format: string
  url?: string
}

export interface AudioCardSettings {
  volume: number // 0..1.5 (default 1)
  playbackRate: number // default 1
  loop: boolean // default false
  isMuted: boolean // default false
}

interface MusicItemCardProps {
  item: AudioEntry
  isPlaying: boolean
  playbackTime: number
  duration: number
  theme: string
  currentTime: number
  initialSettings?: AudioCardSettings
  onTogglePlay: (item: AudioEntry, settings: AudioCardSettings) => void
  onSeek: (time: number) => void
  onInsertTimeline: (item: AudioEntry, offset: number, settings: AudioCardSettings) => void
  onUpdateSettings?: (item: AudioEntry, settings: AudioCardSettings) => void
  onDelete?: (item: AudioEntry) => void
}

export function MusicItemCard({
  item,
  isPlaying,
  playbackTime,
  duration,
  theme,
  currentTime,
  initialSettings,
  onTogglePlay,
  onSeek,
  onInsertTimeline,
  onUpdateSettings,
  onDelete
}: MusicItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [peaks, setPeaks] = useState<Float32Array>(() => new Float32Array(0))
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(item.name)

  // Cấu hình âm thanh của item (Volume, Speed, Loop)
  const [settings, setSettings] = useState<AudioCardSettings>(() => initialSettings || {
    volume: 1,
    playbackRate: 1,
    loop: false,
    isMuted: false
  })

  // Đồng bộ khi initialSettings từ ngoài thay đổi (ví dụ sửa ở Inspector)
  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings)
    }
  }, [initialSettings?.volume, initialSettings?.playbackRate, initialSettings?.loop, initialSettings?.isMuted])

  // Đếm số track đang sử dụng asset này trên timeline
  const projectAudioTracks = useEditor((s) => s.project.audioTracks || [])
  const usedTrackCount = projectAudioTracks.filter((t) => t.assetId === item.id).length

  // Tự động giải mã peaks thật từ assetStore hoặc load bytes
  useEffect(() => {
    let alive = true

    const loadPeaks = async () => {
      try {
        if (item.source === 'project') {
          const res = await getAudioPeaks(item.id, 240)
          if (alive && res.length > 0) setPeaks(res)
        } else if (item.relPath && window.api?.loadBuiltInAssetBytes) {
          const fileData = await window.api.loadBuiltInAssetBytes(item.relPath)
          if (alive && fileData?.data) {
            const blob = new Blob([fileData.data], { type: fileData.mime || 'audio/wav' })
            const res = await getAudioPeaksFromBlob(blob, item.id, 240)
            if (alive && res.length > 0) setPeaks(res)
          }
        }
      } catch (err) {
        console.warn('[MusicItemCard] Failed to compute peaks for', item.name, err)
      }
    }

    loadPeaks()
    return () => {
      alive = false
    }
  }, [item.id, item.source, item.relPath])

  // Lưu đổi tên file trong dự án
  const handleSaveRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== item.name && item.source === 'project') {
      useEditor.getState().update((proj) => {
        const found = proj.assets.find((a) => a.id === item.id)
        if (found) found.name = trimmed
        // Cập nhật tên các track trên timeline nếu chưa đặt tên riêng
        ;(proj.audioTracks || []).forEach((t) => {
          if (t.assetId === item.id && (!t.name || t.name === item.name)) {
            t.name = trimmed
          }
        })
      })
    }
    setIsRenaming(false)
  }

  // Tùy chỉnh volume tức thì
  const handleVolumeChange = (v: number) => {
    const next: AudioCardSettings = { ...settings, volume: v, isMuted: v === 0 }
    setSettings(next)
    onUpdateSettings?.(item, next)
  }

  const toggleMute = () => {
    const next: AudioCardSettings = { ...settings, isMuted: !settings.isMuted }
    setSettings(next)
    onUpdateSettings?.(item, next)
  }

  const handleSpeedChange = (rate: number) => {
    const next: AudioCardSettings = { ...settings, playbackRate: rate }
    setSettings(next)
    onUpdateSettings?.(item, next)
  }

  const handleLoopChange = (loop: boolean) => {
    const next: AudioCardSettings = { ...settings, loop }
    setSettings(next)
    onUpdateSettings?.(item, next)
  }

  return (
    <div className={`music-card-item-v2 source-${item.source}${isPlaying ? ' playing' : ''}${isExpanded ? ' expanded' : ''}`}>
      {/* 1. Header Dòng chính: Nút Play, Tên đầy đủ, Badges, Nút thao tác nhanh */}
      <div className="music-card-top-row">
        <button
          type="button"
          className={`music-play-btn-v2${isPlaying ? ' active' : ''}`}
          onClick={() => onTogglePlay(item, settings)}
          title={isPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử âm thanh'}
        >
          {isPlaying ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
        </button>

        <div className="music-card-heading">
          {isRenaming ? (
            <div className="music-rename-box">
              <input
                type="text"
                className="music-rename-input"
                value={renameVal}
                autoFocus
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') {
                    setRenameVal(item.name)
                    setIsRenaming(false)
                  }
                }}
              />
            </div>
          ) : (
            <div className="music-title-wrap">
              <span
                className="music-title-text"
                title={`${item.name} (Nhấp đúp để đổi tên)`}
                onDoubleClick={() => item.source === 'project' && setIsRenaming(true)}
              >
                {item.name}
              </span>
              {item.source === 'project' && (
                <button
                  type="button"
                  className="music-rename-btn"
                  onClick={() => setIsRenaming(true)}
                  title="Đổi tên file âm thanh này"
                >
                  <IconPen width={10} height={10} />
                </button>
              )}
            </div>
          )}

          <div className="music-badges-row">
            <span className="music-badge-format">{item.format}</span>
            <span className={`music-badge-source ${item.source}`}>
              {item.source === 'project' ? 'Dự án' : 'Kho mẫu'}
            </span>
            {usedTrackCount > 0 && (
              <span className="music-badge-used" title={`Đã dùng trong ${usedTrackCount} track trên timeline`}>
                Timeline ×{usedTrackCount}
              </span>
            )}
          </div>
        </div>

        {/* Nút thao tác nhanh góc phải */}
        <div className="music-top-actions">
          <button
            type="button"
            className="btn xs asset-action-btn-highlight music-quick-insert-btn"
            onClick={() => onInsertTimeline(item, currentTime, settings)}
            title={`Chèn vào timeline tại mốc kim phát hiện tại (${currentTime.toFixed(1)}s)`}
          >
            <IconPlus width={11} height={11} />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            className={`btn xs icon music-settings-toggle-btn${isExpanded ? ' active' : ''}`}
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? 'Thu gọn điều chỉnh' : 'Mở bảng điều chỉnh âm thanh (Volume, Tốc độ, Lặp lại)'}
          >
            <IconSliders width={12} height={12} />
          </button>

          {item.source === 'project' && onDelete && (
            <button
              type="button"
              className="btn xs icon danger music-del-btn"
              onClick={() => onDelete(item)}
              title="Xoá file âm thanh này khỏi dự án"
            >
              <IconTrash width={12} height={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Sóng âm Waveform Canvas tương tác click tua */}
      <div className="music-waveform-section">
        <MusicWaveform
          peaks={peaks}
          duration={duration}
          playbackTime={playbackTime}
          isPlaying={isPlaying}
          onSeek={onSeek}
          theme={theme}
          height={38}
        />
      </div>

      {/* 3. Bảng điều chỉnh âm nhạc (Volume, Tốc độ, Lặp lại, Chèn Timeline) */}
      {isExpanded && (
        <div className="music-settings-drawer">
          {/* Hàng 1: Âm lượng (Header hiển thị nhãn + %, thanh trượt full-width 100%) */}
          <div className="music-setting-col">
            <div className="music-setting-header-row">
              <span className="music-setting-label">
                <button
                  type="button"
                  className={`music-mute-btn${settings.isMuted ? ' muted' : ''}`}
                  onClick={toggleMute}
                  title={settings.isMuted ? 'Bật tiếng' : 'Tắt tiếng (Mute)'}
                >
                  <IconVolume width={12} height={12} />
                </button>
                Âm lượng:
              </span>
              <span className="music-setting-current-val">
                {settings.isMuted ? 'Tắt tiếng' : `${Math.round(settings.volume * 100)}%`}
              </span>
            </div>
            <div className="music-slider-track-wrap">
              <input
                type="range"
                className="music-slider"
                min={0}
                max={1.5}
                step={0.05}
                value={settings.isMuted ? 0 : settings.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Hàng 2: Tốc độ phát (Header hiển thị nhãn + giá trị, dải nút grid 5 cột) */}
          <div className="music-setting-col">
            <div className="music-setting-header-row">
              <span className="music-setting-label">Tốc độ phát:</span>
              <span className="music-setting-current-val">{settings.playbackRate}x</span>
            </div>
            <div className="music-speed-grid">
              {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`music-chip-btn${settings.playbackRate === rate ? ' active' : ''}`}
                  onClick={() => handleSpeedChange(rate)}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Hàng 3: Tùy chọn Lặp lại (Loop) */}
          <div className="music-loop-row">
            <label className="music-checkbox-label">
              <input
                type="checkbox"
                checked={settings.loop}
                onChange={(e) => handleLoopChange(e.target.checked)}
              />
              <IconLoop width={12} height={12} />
              <span>Lặp lại khi hết bài (Loop)</span>
            </label>
          </div>

          {/* Hàng 4: Hành động chèn timeline nâng cao (Grid 2 cột) */}
          <div className="music-actions-grid">
            <button
              type="button"
              className="btn xs music-drawer-action-btn"
              onClick={() => onInsertTimeline(item, 0, settings)}
              title="Chèn âm thanh từ mốc bắt đầu video (0.0s)"
            >
              <IconPlus width={10} height={10} /> Chèn từ 0s
            </button>

            {usedTrackCount > 0 ? (
              <button
                type="button"
                className="btn xs primary text-link music-drawer-action-btn"
                onClick={() => useView.getState().openAudioDialog('waveform')}
                title="Mở bảng Audio Studio Waveform & Mixer chuyên sâu (phím tắt LL)"
              >
                Audio Studio ↗
              </button>
            ) : (
              <button
                type="button"
                className="btn xs music-drawer-action-btn"
                onClick={() => onInsertTimeline(item, currentTime, settings)}
                title={`Chèn tại mốc kim phát hiện tại (${currentTime.toFixed(1)}s)`}
              >
                <IconPlus width={10} height={10} /> Chèn tại kim
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
