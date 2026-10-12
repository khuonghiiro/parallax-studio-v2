import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { assetStore } from '../../project/assets'
import { importAudio, removeAudioTrack } from '../../actions'
import { IconMusic, IconPlus, IconVolume } from '../icons'
import { MusicItemCard, type AudioEntry, type AudioCardSettings } from './music/MusicItemCard'
import { addAudioTrackToProject, syncProjectAudio } from '../../project/audioTracks'
import type { AssetMeta } from '@shared/types'

import { MusicCategoryBar, type AudioCategoryType } from './music/MusicCategoryBar'

import type { BuiltInAssetItem } from '@shared/ipc'
import {
  detectAudioCategory,
  getBuiltInAudios,
  DEFAULT_BUILTIN_AUDIOS
} from './music/builtinAudios'

export { detectAudioCategory }

export interface MusicPanelProps {
  onImportItem?: (item: BuiltInAssetItem, addLayer: boolean) => void
  catalogItems?: BuiltInAssetItem[]
}

export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function MusicPanel({ onImportItem: _onImportItem, catalogItems }: MusicPanelProps) {
  const projectAssets = useEditor((s) => s.project.assets)
  const projectAudioTracks = useEditor((s) => s.project.audioTracks || [])
  const currentTime = useEditor((s) => s.time)
  const theme = useView((s) => s.theme)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState<'all' | 'project' | 'builtin'>('all')
  const selectedCategory = useView((s) => (s.audioSelectedCategory || 'all') as AudioCategoryType)
  const setSelectedCategory = useCallback((cat: AudioCategoryType) => {
    useView.getState().setAudioSelectedCategory(cat)
  }, [])

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
          category: (a.category as AudioCategoryType) || detectAudioCategory(a.name),
          assetMeta: a,
          format: ext,
          url: runtime?.url
        }
      })
  }, [projectAssets])

  // Danh sách audio có sẵn trong kho mẫu (Built-in phong phú nhiều thể loại, hỗ trợ tệp thêm trong thư mục assets/audio)
  const builtinAudios: AudioEntry[] = useMemo(() => {
    return getBuiltInAudios(catalogItems)
  }, [catalogItems])

  // Thống kê số lượng âm thanh theo từng thể loại
  const categoryCounts = useMemo(() => {
    const counts: Record<AudioCategoryType, number> = {
      all: 0,
      music: 0,
      ambient: 0,
      sfx: 0,
      voice: 0,
      cinematic: 0
    }
    const all = [...projectAudios, ...builtinAudios]
    counts.all = all.length
    all.forEach((item) => {
      const cat = item.category || detectAudioCategory(item.name)
      if (counts[cat] !== undefined) {
        counts[cat]++
      }
    })
    return counts
  }, [projectAudios, builtinAudios])

  const allAudios = useMemo(() => {
    const list = [...projectAudios, ...builtinAudios]
    return list.filter((item) => {
      // Lọc theo thể loại (tab dọc bên trái)
      if (selectedCategory !== 'all') {
        const cat = item.category || detectAudioCategory(item.name)
        if (cat !== selectedCategory) return false
      }
      // Lọc theo nguồn (Tất cả / Dự án / Kho mẫu)
      if (filterSource === 'project' && item.source !== 'project') return false
      if (filterSource === 'builtin' && item.source !== 'builtin') return false
      // Tìm kiếm
      if (search.trim()) {
        const q = search.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.format.toLowerCase().includes(q)
      }
      return true
    })
  }, [projectAudios, builtinAudios, selectedCategory, filterSource, search])

  // Thống kê số lượng âm thanh theo nguồn tương ứng với thể loại đang chọn
  const countsBySource = useMemo(() => {
    const isCatMatch = (item: AudioEntry) => {
      if (selectedCategory === 'all') return true
      const cat = item.category || detectAudioCategory(item.name)
      return cat === selectedCategory
    }
    const filteredProj = projectAudios.filter(isCatMatch)
    const filteredBuiltin = builtinAudios.filter(isCatMatch)
    return {
      all: filteredProj.length + filteredBuiltin.length,
      project: filteredProj.length,
      builtin: filteredBuiltin.length
    }
  }, [projectAudios, builtinAudios, selectedCategory])

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
          const blob = new Blob([res.data as unknown as BlobPart], { type: res.mime || 'audio/wav' })
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
          const runtimeAsset = await assetStore.add(item.name, res.mime || 'audio/wav', res.data, 'audio')
          useEditor.getState().update((proj) => {
            if (!proj.assets.some((a) => a.id === runtimeAsset.meta.id)) {
              proj.assets.push(runtimeAsset.meta)
            }
          })
          targetAssetId = runtimeAsset.meta.id
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

  // Cập nhật cấu hình âm lượng / tốc độ / loop tức thì (cả preview player lẫn timeline)
  const handleUpdateSettings = useCallback(
    (item: AudioEntry, newSettings: AudioCardSettings) => {
      // 1. Áp dụng ngay lập tức cho bài đang phát nghe thử
      if (audioRef.current && playingId === item.id) {
        audioRef.current.volume = newSettings.isMuted ? 0 : Math.min(1, Math.max(0, newSettings.volume))
        audioRef.current.playbackRate = newSettings.playbackRate || 1
        audioRef.current.loop = !!newSettings.loop
      }

      // 2. Đồng bộ các track của bài này trên timeline (nếu có)
      useEditor.getState().update((proj) => {
        let changed = false
        ;(proj.audioTracks || []).forEach((t) => {
          if (t.assetId === item.id || t.name === item.name) {
            t.volume = newSettings.isMuted ? 0 : newSettings.volume
            t.playbackRate = newSettings.playbackRate
            t.loop = newSettings.loop
            t.muted = newSettings.isMuted
            changed = true
          }
        })
        if (changed) {
          syncProjectAudio(proj)
        }
      })
    },
    [playingId]
  )

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
    <div className="music-panel-layout">
      {/* Cột trái: Thanh tab dọc phân loại thể loại âm thanh */}
      <MusicCategoryBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categoryCounts={categoryCounts}
        onImportClick={() => importAudio(currentTime, selectedCategory)}
        onOpenFolder={async () => {
          if (window.api?.openBuiltInFolder) window.api.openBuiltInFolder('audio')
        }}
      />

      {/* Cột phải: Khối danh sách và công cụ chính */}
      <div className="music-panel-main">
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
              Tất cả <span className="music-seg-badge">{countsBySource.all}</span>
            </button>
            <button
              type="button"
              className={`music-seg-tab${filterSource === 'project' ? ' active' : ''}`}
              onClick={() => setFilterSource('project')}
            >
              Dự án <span className="music-seg-badge">{countsBySource.project}</span>
            </button>
            <button
              type="button"
              className={`music-seg-tab${filterSource === 'builtin' ? ' active' : ''}`}
              onClick={() => setFilterSource('builtin')}
            >
              Kho mẫu <span className="music-seg-badge">{countsBySource.builtin}</span>
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
                onClick={() => importAudio(currentTime, selectedCategory)}
              >
                <IconPlus width={12} height={12} /> Thêm audio từ máy tính
              </button>
            </div>
          ) : (
            allAudios.map((item) => {
              const matchedTrack = projectAudioTracks.find((t) => t.assetId === item.id || t.name === item.name)
              const initialSettings = matchedTrack
                ? {
                    volume: matchedTrack.volume ?? 1,
                    playbackRate: matchedTrack.playbackRate ?? 1,
                    loop: !!matchedTrack.loop,
                    isMuted: matchedTrack.volume === 0 || !!matchedTrack.muted
                  }
                : undefined

              return (
                <MusicItemCard
                  key={item.id}
                  item={item}
                  isPlaying={playingId === item.id}
                  playbackTime={playingId === item.id ? playbackTime : 0}
                  duration={playingId === item.id ? duration : item.assetMeta?.duration || 0}
                  theme={theme}
                  currentTime={currentTime}
                  initialSettings={initialSettings}
                  onTogglePlay={handleTogglePlay}
                  onSeek={handleSeek}
                  onInsertTimeline={handleInsertTimeline}
                  onUpdateSettings={handleUpdateSettings}
                  onDelete={handleDeleteAudio}
                />
              )
            })
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
            onClick={() => importAudio(currentTime, selectedCategory)}
            title="Chọn tệp âm thanh từ máy tính và chèn tại mốc thời gian hiện tại"
          >
            <IconPlus width={12} height={12} /> Thêm audio từ máy tính
          </button>
        </div>
      </div>
    </div>
  )
}
