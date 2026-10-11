import { useState, useRef, useEffect, useMemo } from 'react'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import { importAudio, addAudioTrackFromAsset, removeAudioTrack } from '../../actions'
import { IconMusic, IconPlay, IconPause, IconPlus, IconTrash, IconVolume } from '../icons'
import type { AssetMeta } from '@shared/types'

export interface MusicPanelProps {
  onImportItem?: (item: any) => void
}

interface AudioEntry {
  id: string
  name: string
  source: 'project' | 'builtin'
  assetMeta?: AssetMeta
  relPath?: string
  format: string
  url?: string
}

export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function MusicPanel({ onImportItem: _onImportItem }: MusicPanelProps) {
  const projectAssets = useEditor((s) => s.project.assets)
  const currentTime = useEditor((s) => s.time)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState<'all' | 'project' | 'builtin'>('all')

  // Quản lý phát âm thanh nghe thử (Preview player)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Danh sách các tệp âm thanh trong dự án
  const projectAudios: AudioEntry[] = useMemo(() => {
    return projectAssets
      .filter((a) => a.kind === 'audio')
      .map((a) => {
        const ext = a.name.split('.').pop()?.toUpperCase() || 'AUDIO'
        const runtime = assetStore.get(a.id)
        return {
          id: a.id,
          name: a.name,
          source: 'project',
          assetMeta: a,
          format: ext,
          url: runtime?.url
        }
      })
  }, [projectAssets])

  // Danh sách audio có sẵn trong kho mẫu (Built-in demo)
  const builtinAudios: AudioEntry[] = useMemo(() => {
    return [
      {
        id: 'builtin-ambient-chime',
        name: 'Chuông gió không gian (Ambient Chime)',
        source: 'builtin',
        relPath: 'audio/ambient_chime.wav',
        format: 'WAV'
      }
    ]
  }, [])

  const allAudios = useMemo(() => {
    const list = [...projectAudios, ...builtinAudios]
    return list.filter((item) => {
      if (filterSource === 'project' && item.source !== 'project') return false
      if (filterSource === 'builtin' && item.source !== 'builtin') return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.format.toLowerCase().includes(q)
      }
      return true
    })
  }, [projectAudios, builtinAudios, filterSource, search])

  // Dừng phát khi component unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = async (item: AudioEntry) => {
    if (playingId === item.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
        } else {
          audioRef.current.pause()
          setPlayingId(null)
        }
      }
      return
    }

    // Nếu đang phát bài khác, dừng trước
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    let playUrl = item.url

    // Nếu là builtin audio và chưa có URL, nạp byte từ API
    if (!playUrl && item.relPath && window.api?.loadBuiltInAssetBytes) {
      try {
        const res = await window.api.loadBuiltInAssetBytes(item.relPath)
        if (res && res.data) {
          const blob = new Blob([res.data], { type: res.mime || 'audio/wav' })
          playUrl = URL.createObjectURL(blob)
        }
      } catch (err) {
        console.error('[MusicPanel] Failed to load builtin audio bytes:', err)
      }
    }

    if (!playUrl) return

    const audio = new Audio(playUrl)
    audioRef.current = audio
    setPlayingId(item.id)
    setPlaybackTime(0)

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0)
    }

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime)
    }

    audio.onended = () => {
      setPlayingId(null)
      setPlaybackTime(0)
    }

    audio.onerror = () => {
      setPlayingId(null)
    }

    audio.play().catch((err) => {
      console.warn('[MusicPanel] Audio play failed:', err)
      setPlayingId(null)
    })
  }

  const handleInsertToTimeline = async (item: AudioEntry) => {
    if (item.source === 'project' && item.assetMeta) {
      addAudioTrackFromAsset(item.assetMeta.id, currentTime)
    } else if (item.source === 'builtin' && item.relPath && window.api?.loadBuiltInAssetBytes) {
      try {
        const res = await window.api.loadBuiltInAssetBytes(item.relPath)
        if (res && res.data) {
          const asset = await assetStore.add(res.name, res.mime, res.data, 'audio')
          useEditor.getState().update((d) => {
            if (!d.assets.some((a) => a.id === asset.meta.id)) {
              d.assets.push(asset.meta)
            }
          })
          addAudioTrackFromAsset(asset.meta.id, currentTime)
        }
      } catch (err) {
        console.error('[MusicPanel] Failed to insert builtin audio:', err)
      }
    }
  }

  const handleDeleteAudio = (item: AudioEntry) => {
    if (item.source === 'project' && item.assetMeta) {
      const assetId = item.assetMeta.id
      // Xoá track liên quan trên timeline
      const editorState = useEditor.getState()
      const tracks = editorState.project.audioTracks || []
      tracks.filter((t) => t.assetId === assetId).forEach((t) => removeAudioTrack(t.id))

      // Xoá khỏi asset store và project assets
      assetStore.remove(assetId)
      editorState.update((d) => {
        d.assets = d.assets.filter((a) => a.id !== assetId)
      })

      if (playingId === item.id && audioRef.current) {
        audioRef.current.pause()
        setPlayingId(null)
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setPlaybackTime(val)
    if (audioRef.current) {
      audioRef.current.currentTime = val
    }
  }

  return (
    <div className="music-panel-container">
      {/* 1. Header công cụ tìm kiếm và bộ lọc */}
      <div className="music-panel-filter-bar">
        <div className="music-search-box">
          <input
            type="text"
            className="input-text sm"
            placeholder="Tìm theo tên âm thanh, định dạng…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="music-filter-tabs">
          <button
            type="button"
            className={`btn xs${filterSource === 'all' ? ' active' : ''}`}
            onClick={() => setFilterSource('all')}
          >
            Tất cả ({projectAudios.length + builtinAudios.length})
          </button>
          <button
            type="button"
            className={`btn xs${filterSource === 'project' ? ' active' : ''}`}
            onClick={() => setFilterSource('project')}
          >
            Dự án ({projectAudios.length})
          </button>
          <button
            type="button"
            className={`btn xs${filterSource === 'builtin' ? ' active' : ''}`}
            onClick={() => setFilterSource('builtin')}
          >
            Kho mẫu ({builtinAudios.length})
          </button>
        </div>
      </div>

      {/* 2. Danh sách bài nhạc & hiệu ứng âm thanh */}
      <div className="music-list-scroll">
        {allAudios.length === 0 ? (
          <div className="music-empty-state">
            <div className="music-empty-icon">
              <IconMusic width={32} height={32} />
            </div>
            <div className="music-empty-title">Chưa có tệp âm thanh nào</div>
            <div className="music-empty-desc">
              Hỗ trợ các định dạng .mp3, .wav, .ogg, .m4a, .flac, .aac. Nhấn nút bên dưới để chọn tệp từ máy tính của bạn.
            </div>
            <button
              type="button"
              className="btn sm asset-action-btn-highlight"
              onClick={() => importAudio(currentTime)}
            >
              <IconPlus /> Thêm audio từ máy tính
            </button>
          </div>
        ) : (
          allAudios.map((item) => {
            const isPlaying = playingId === item.id
            return (
              <div
                key={item.id}
                className={`music-card-item${isPlaying ? ' playing' : ''}`}
              >
                <div className="music-card-header">
                  <button
                    type="button"
                    className={`music-play-btn${isPlaying ? ' active' : ''}`}
                    onClick={() => handleTogglePlay(item)}
                    title={isPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử âm thanh'}
                  >
                    {isPlaying ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
                  </button>

                  <div className="music-info-meta">
                    <div className="music-title" title={item.name}>
                      {item.name}
                    </div>
                    <div className="music-sub-tags">
                      <span className="music-format-badge">{item.format}</span>
                      <span className={`music-source-badge ${item.source}`}>
                        {item.source === 'project' ? 'Dự án' : 'Kho mẫu'}
                      </span>
                      {isPlaying && (
                        <span className="music-playing-indicator">
                          <span className="bar b1" />
                          <span className="bar b2" />
                          <span className="bar b3" />
                          <span className="bar b4" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="music-actions">
                    <button
                      type="button"
                      className="btn xs asset-action-btn-highlight"
                      onClick={() => handleInsertToTimeline(item)}
                      title={`Chèn vào timeline tại mốc ${currentTime.toFixed(1)}s`}
                    >
                      <IconPlus width={12} height={12} /> Chèn timeline
                    </button>
                    {item.source === 'project' && (
                      <button
                        type="button"
                        className="btn xs icon danger"
                        onClick={() => handleDeleteAudio(item)}
                        title="Xoá tệp âm thanh này khỏi dự án"
                      >
                        <IconTrash width={12} height={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Thanh tiến trình phát nghe thử mini khi đang chọn phát bài này */}
                {isPlaying && (
                  <div className="music-playback-bar">
                    <span className="music-time-label">{formatAudioDuration(playbackTime)}</span>
                    <input
                      type="range"
                      className="music-seek-slider"
                      min={0}
                      max={duration || 1}
                      step={0.1}
                      value={playbackTime}
                      onChange={handleSeek}
                    />
                    <span className="music-time-label">{formatAudioDuration(duration)}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 3. Footer tóm tắt */}
      <div className="music-panel-footer">
        <div className="music-footer-info">
          <IconVolume width={13} height={13} />
          <span>Vị trí kim phát hiện tại: <strong>{currentTime.toFixed(1)}s</strong></span>
        </div>
        <button
          type="button"
          className="btn sm asset-action-btn-highlight"
          onClick={() => importAudio(currentTime)}
          title="Chọn tệp âm thanh từ máy tính và chèn tại mốc thời gian hiện tại"
        >
          <IconPlus /> Thêm audio từ máy tính
        </button>
      </div>
    </div>
  )
}
