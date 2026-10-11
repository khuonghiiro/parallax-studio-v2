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

export interface MusicPanelProps {
  onImportItem?: (item: any) => void
}

export function formatAudioDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/** Loại bỏ dấu tiếng Việt để đối chiếu tên tệp không dấu (ví dụ: tieng_sung, hoi_thoai) */
function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

/** Tự động nhận diện thể loại âm thanh dựa trên từ khóa tên tệp (hỗ trợ cả tiếng Anh, tiếng Việt có dấu và không dấu) */
export function detectAudioCategory(name: string): AudioCategoryType {
  const raw = (name || '').toLowerCase()
  const norm = removeVietnameseDiacritics(raw)
  // Thay thế ký tự phân cách gạch dưới, gạch ngang, dấu chấm bằng dấu cách
  const clean = norm.replace(/[^a-z0-9]/g, ' ')
  const words = new Set(clean.split(/\s+/).filter(Boolean))

  const hasPhrase = (phrase: string) => {
    const cleanPhrase = removeVietnameseDiacritics(phrase).replace(/[^a-z0-9]/g, ' ')
    return clean.includes(cleanPhrase) || raw.includes(phrase.toLowerCase())
  }
  const hasWord = (word: string) => words.has(word.toLowerCase())

  // 1. Thể loại Lời thoại & Lồng tiếng (Voice)
  if (
    hasPhrase('voice') ||
    hasPhrase('thoại') ||
    hasPhrase('thoai') ||
    hasPhrase('speech') ||
    hasPhrase('podcast') ||
    hasPhrase('dialog') ||
    hasPhrase('narration') ||
    hasPhrase('thuyết minh') ||
    hasPhrase('thuyet minh') ||
    hasPhrase('lồng tiếng') ||
    hasPhrase('long tieng') ||
    hasPhrase('radio') ||
    hasPhrase('vocal') ||
    hasPhrase('diễn đọc') ||
    hasPhrase('dien doc') ||
    hasWord('noi') ||
    hasWord('talk')
  ) {
    return 'voice'
  }

  // 2. Thể loại Hiệu ứng & Tiếng động (SFX)
  if (
    hasPhrase('shot') ||
    hasPhrase('gun') ||
    hasPhrase('súng') ||
    hasPhrase('sung') ||
    hasPhrase('bắn') ||
    hasPhrase('snap') ||
    hasPhrase('cành cây') ||
    hasPhrase('canh cay') ||
    hasPhrase('gãy') ||
    hasPhrase('break') ||
    hasPhrase('va chạm') ||
    hasPhrase('va cham') ||
    hasPhrase('footstep') ||
    hasPhrase('bước chân') ||
    hasPhrase('buoc chan') ||
    hasPhrase('sword') ||
    hasPhrase('kiếm') ||
    hasPhrase('kiem') ||
    hasPhrase('punch') ||
    hasPhrase('door') ||
    hasPhrase('cửa') ||
    hasPhrase('cua') ||
    hasPhrase('sfx') ||
    hasPhrase('explosion') ||
    hasPhrase('tiếng nổ') ||
    hasPhrase('tieng no') ||
    hasPhrase('laser') ||
    hasWord('hit') ||
    hasWord('no') ||
    hasWord('gay')
  ) {
    return 'sfx'
  }

  // 3. Thể loại Chuyển cảnh & Kịch tính (Cinematic)
  if (
    hasPhrase('whoosh') ||
    hasPhrase('swoosh') ||
    hasPhrase('riser') ||
    hasPhrase('impact') ||
    hasPhrase('boom') ||
    hasPhrase('cinematic') ||
    hasPhrase('kịch tính') ||
    hasPhrase('kich tinh') ||
    hasPhrase('transition') ||
    hasPhrase('chuyển cảnh') ||
    hasPhrase('chuyen canh') ||
    hasPhrase('stinger') ||
    hasPhrase('trailer') ||
    hasPhrase('hit marker')
  ) {
    return 'cinematic'
  }

  // 4. Thể loại Âm đệm & Môi trường (Ambient)
  if (
    hasPhrase('wind') ||
    hasPhrase('gió') ||
    hasPhrase('gio') ||
    hasPhrase('rain') ||
    hasPhrase('mưa') ||
    hasPhrase('mua') ||
    hasPhrase('chime') ||
    hasPhrase('chuông') ||
    hasPhrase('chuong') ||
    hasPhrase('ambient') ||
    hasPhrase('âm đệm') ||
    hasPhrase('am dem') ||
    hasPhrase('môi trường') ||
    hasPhrase('moi truong') ||
    hasPhrase('nature') ||
    hasPhrase('thiên nhiên') ||
    hasPhrase('thien nhien') ||
    hasPhrase('đêm tĩnh') ||
    hasPhrase('dem tinh') ||
    hasPhrase('forest') ||
    hasPhrase('rừng') ||
    hasPhrase('rung') ||
    hasPhrase('sea') ||
    hasPhrase('biển') ||
    hasPhrase('bien') ||
    hasPhrase('water') ||
    hasPhrase('sóng biển') ||
    hasPhrase('song bien') ||
    hasPhrase('chim') ||
    hasPhrase('bird')
  ) {
    return 'ambient'
  }

  // Mặc định là Nhạc nền & Giai điệu (Music)
  return 'music'
}

export function MusicPanel({ onImportItem: _onImportItem }: MusicPanelProps) {
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

  // Danh sách audio có sẵn trong kho mẫu (Built-in phong phú nhiều thể loại)
  const builtinAudios: AudioEntry[] = useMemo(() => {
    return [
      {
        id: 'builtin-ambient-chime',
        name: 'Chuông gió ngân vang (Ambient Chime)',
        source: 'builtin',
        category: 'ambient',
        relPath: 'audio/ambient_chime.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-ambient-night-wind',
        name: 'Gió đêm huyền ảo (Night Wind)',
        source: 'builtin',
        category: 'ambient',
        relPath: 'audio/ambient_night_wind.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-music-chill-melody',
        name: 'Giai điệu thư giãn (Chill Melody)',
        source: 'builtin',
        category: 'music',
        relPath: 'audio/music_chill_melody.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-sfx-gunshot',
        name: 'Phát súng không gian (Laser Shot)',
        source: 'builtin',
        category: 'sfx',
        relPath: 'audio/sfx_gunshot.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-sfx-branch-snap',
        name: 'Cành cây gãy giòn (Branch Snap)',
        source: 'builtin',
        category: 'sfx',
        relPath: 'audio/sfx_branch_snap.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-cinematic-whoosh',
        name: 'Chuyển cảnh vút gió (Camera Whoosh)',
        source: 'builtin',
        category: 'cinematic',
        relPath: 'audio/cinematic_whoosh.wav',
        format: 'WAV'
      },
      {
        id: 'builtin-voice-radio-intro',
        name: 'Tín hiệu lời thoại vô tuyến (Radio Voice)',
        source: 'builtin',
        category: 'voice',
        relPath: 'audio/voice_radio_intro.wav',
        format: 'WAV'
      }
    ]
  }, [])

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
