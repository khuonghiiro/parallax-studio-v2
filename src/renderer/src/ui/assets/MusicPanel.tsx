import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { assetStore } from '../../project/assets'
import { importAudio, removeAudioTrack } from '../../actions'
import { IconMusic, IconPlus, IconVolume } from '../icons'
import { MusicItemCard, type AudioEntry, type AudioCardSettings } from './music/MusicItemCard'
import { addAudioTrackToProject } from '../../project/audioTracks'
import type { AssetMeta } from '@shared/types'

export interface MusicPanelProps {
  onImportItem?: (item: any) => void
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
  const theme = useView((s) => s.theme)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState<'all' | 'project' | 'builtin'>('all')

  // Quản lý phát âm thanh nghe thử (Preview player)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const curItemRef = useRef<AudioEntry | null>(null)

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

  // Bật/tắt nghe thử với cấu hình tuỳ chỉnh
  const handleTogglePlay = async (item: AudioEntry, settings: AudioCardSettings) => {
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
    curItemRef.current = item
    setPlayingId(item.id)
    setPlaybackTime(0)

    // Áp dụng volume, speed, loop
    audio.volume = settings.isMuted ? 0 : Math.min(1, Math.max(0, settings.volume))
    audio.playbackRate = settings.playbackRate || 1
    audio.loop = !!settings.loop

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0)
    }

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime)
    }

    audio.onended = () => {
      if (!audio.loop) {
        setPlayingId(null)
        setPlaybackTime(0)
      }
    }

    audio.play().catch((err) => {
      console.warn('[MusicPanel] Audio play error:', err)
      setPlayingId(null)
    })
  }

  // Tua thời gian (seek) từ sóng âm
  const handleSeek = useCallback(
    (time: number) => {
      const safeTime = Math.max(0, Math.min(duration || 1000, time))
      setPlaybackTime(safeTime)
      if (audioRef.current) {
        audioRef.current.currentTime = safeTime
      }
    },
    [duration]
  )

  // Chèn audio vào timeline
  const handleInsertTimeline = async (
    item: AudioEntry,
    targetOffset: number,
    settings: AudioCardSettings
  ) => {
    let targetAssetId = item.id

    if (item.source === 'builtin' && item.relPath && window.api?.loadBuiltInAssetBytes) {
      try {
        const res = await window.api.loadBuiltInAssetBytes(item.relPath)
        if (res && res.data) {
          const file = new File([res.data], `${item.name}.wav`, { type: res.mime || 'audio/wav' })
          const asset = await assetStore.addFile(file)
          useEditor.getState().update((proj) => {
            proj.assets.push(asset)
          })
          targetAssetId = asset.id
        }
      } catch (err) {
        console.error('[MusicPanel] Failed to insert builtin audio:', err)
        return
      }
    }

    useEditor.getState().update((proj) => {
      const track = addAudioTrackToProject(proj, targetAssetId, item.name, targetOffset)
      track.volume = settings.isMuted ? 0 : settings.volume
      track.playbackRate = settings.playbackRate
      track.loop = settings.loop
    })
  }

  // Xoá audio dự án
  const handleDeleteAudio = (item: AudioEntry) => {
    if (item.source !== 'project') return
    const confirmed = window.confirm(
      `Xoá tệp âm thanh "${item.name}"?\n(Các đoạn âm thanh liên quan trên timeline cũng sẽ được xoá)`
    )
    if (!confirmed) return

    if (playingId === item.id && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingId(null)
    }

    const editorState = useEditor.getState()
    const tracks = editorState.project.audioTracks || []
    tracks.forEach((t) => {
      if (t.assetId === item.id) {
        removeAudioTrack(t.id)
      }
    })

    editorState.update((proj) => {
      proj.assets = proj.assets.filter((a) => a.id !== item.id)
    })
  }

  return (
    <div className="music-panel-container">
      {/* 1. Header công cụ tìm kiếm và phân loại */}
      <div className="music-panel-filter-bar">
        <div className="music-search-box-v2">
          <input
            type="text"
            className="music-search-input-v2"
            placeholder="Tìm nhạc, hiệu ứng âm thanh…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="music-search-clear-btn"
              onClick={() => setSearch('')}
              title="Xoá tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="music-segmented-tabs">
          <button
            type="button"
            className={`music-seg-tab${filterSource === 'all' ? ' active' : ''}`}
            onClick={() => setFilterSource('all')}
          >
            Tất cả <span className="music-seg-badge">{projectAudios.length + builtinAudios.length}</span>
          </button>
          <button
            type="button"
            className={`music-seg-tab${filterSource === 'project' ? ' active' : ''}`}
            onClick={() => setFilterSource('project')}
          >
            Dự án <span className="music-seg-badge">{projectAudios.length}</span>
          </button>
          <button
            type="button"
            className={`music-seg-tab${filterSource === 'builtin' ? ' active' : ''}`}
            onClick={() => setFilterSource('builtin')}
          >
            Kho mẫu <span className="music-seg-badge">{builtinAudios.length}</span>
          </button>
        </div>
      </div>

      {/* 2. Danh sách thẻ âm nhạc & sóng âm */}
      <div className="music-list-scroll">
        {allAudios.length === 0 ? (
          <div className="music-empty-state">
            <div className="music-empty-icon">
              <IconMusic width={28} height={28} />
            </div>
            <div className="music-empty-title">Không tìm thấy âm thanh phù hợp</div>
            <div className="music-empty-desc">
              Hỗ trợ MP3, WAV, OGG, FLAC, AAC. Thêm nhanh từ máy tính vào dự án.
            </div>
            <button
              type="button"
              className="btn sm asset-action-btn-highlight"
              onClick={() => importAudio(currentTime)}
            >
              <IconPlus width={12} height={12} /> Thêm audio từ máy tính
            </button>
          </div>
        ) : (
          allAudios.map((item) => (
            <MusicItemCard
              key={item.id}
              item={item}
              isPlaying={playingId === item.id}
              playbackTime={playingId === item.id ? playbackTime : 0}
              duration={playingId === item.id ? duration : item.assetMeta?.duration || 0}
              theme={theme}
              currentTime={currentTime}
              onTogglePlay={handleTogglePlay}
              onSeek={handleSeek}
              onInsertTimeline={handleInsertTimeline}
              onDelete={handleDeleteAudio}
            />
          ))
        )}
      </div>

      {/* 3. Footer tóm tắt */}
      <div className="music-panel-footer-v2">
        <div className="music-footer-time-info">
          <IconVolume width={12} height={12} />
          <span>Kim phát: <strong>{currentTime.toFixed(1)}s</strong></span>
        </div>
        <button
          type="button"
          className="btn sm asset-action-btn-highlight music-footer-add-btn"
          onClick={() => importAudio(currentTime)}
          title="Chọn tệp âm thanh từ máy tính và chèn tại mốc thời gian hiện tại"
        >
          <IconPlus width={12} height={12} /> Thêm audio từ máy tính
        </button>
      </div>
    </div>
  )
}
