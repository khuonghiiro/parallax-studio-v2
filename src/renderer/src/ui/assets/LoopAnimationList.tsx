import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../actions'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import { useView } from '../../store/view'
import '../../styles/model3dLibrary.css'
import '../../styles/loopAnimator.css'
import { requestOpenLayerAssembly } from '../layerAssembly/layerAssemblyBridge'
import {
  IconCheck,
  IconCopy,
  IconFilm,
  IconFlame,
  IconFolder,
  IconGrid,
  IconLayers,
  IconPause,
  IconPen,
  IconPlay,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconTree
} from '../icons'
import { PENDING_WORKSHOP_LOOP_TEMPLATE_KEY } from '../loopAnimator/LoopAnimatorDialog'
import { exportLoopPresetDirectly } from '../loopAnimator/loopAnimationExporter'
import {
  LOOP_STORAGE_UPDATED_EVENT,
  deleteLoopTemplate,
  getAllLoopTemplates,
  saveLoopTemplate
} from '../loopAnimator/loopAnimatorStorage'
import { getCachedLoopTemplateSheet } from '../loopAnimator/loopFrameExtractor'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import type { LoopAnimationTemplate } from '../loopAnimator/types'

interface CardPreviewProps {
  template: LoopAnimationTemplate
  isPlaying: boolean
}

const LoopCardPreviewCanvas = React.memo(function LoopCardPreviewCanvas({
  template,
  isPlaying
}: CardPreviewProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sheetReady, setSheetReady] = useState(false)
  const sheetRef = useRef<Awaited<ReturnType<typeof getCachedLoopTemplateSheet>>>(null)

  useEffect(() => {
    let cancelled = false
    void getCachedLoopTemplateSheet(template).then((sheet) => {
      if (cancelled) return
      sheetRef.current = sheet
      setSheetReady((v) => !v)
    })
    return () => {
      cancelled = true
    }
  }, [
    template.id,
    template.imageUrl,
    template.updatedAt,
    template.chromaKey.enabled,
    template.chromaKey.keyColor,
    template.chromaKey.similarity
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    const sheet = sheetRef.current
    if (!canvas || !sheet || sheet.frames.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height

    const drawFrameAt = (frameIdx: number, nowSec: number): void => {
      const f = sheet.frames[frameIdx] ?? sheet.frames[0]
      if (!f) return
      ctx.clearRect(0, 0, cw, ch)

      const rhythmEval =
        isPlaying && template.rhythm && template.rhythm.rhythmMode !== 'none'
          ? evaluateLoopLayerRhythm(
              {
                loopRhythmMode: template.rhythm.rhythmMode,
                loopRhythmRateHz: template.rhythm.rhythmRateHz,
                loopRhythmIntensity: template.rhythm.rhythmIntensity,
                loopMinOpacity: template.rhythm.minOpacity,
                loopScaleBeatPct: template.rhythm.scaleBeatPct,
                speed: template.speed ?? 1
              },
              nowSec,
              0
            )
          : { opacityMultiplier: 1, scaleMultiplier: 1 }

      const pad = 10
      const baseScale = Math.min(
        (cw - pad * 2) / Math.max(1, f.width),
        (ch - pad * 2) / Math.max(1, f.height)
      )
      const scale = baseScale * rhythmEval.scaleMultiplier
      const dw = Math.max(1, Math.round(f.width * scale))
      const dh = Math.max(1, Math.round(f.height * scale))
      const dx = Math.round((cw - dw) * 0.5 + (f.offsetX || 0) * scale)
      const dy = Math.round((ch - dh) * 0.5 + (f.offsetY || 0) * scale)

      ctx.save()
      ctx.globalAlpha = rhythmEval.opacityMultiplier
      ctx.drawImage(sheet.canvas, f.x, f.y, f.width, f.height, dx, dy, dw, dh)
      ctx.restore()
    }

    // When paused: ALWAYS draw ONLY Frame #1 (index 0)
    if (!isPlaying || sheet.frames.length <= 1) {
      drawFrameAt(0, 0)
      return
    }

    let rafId = 0
    let cursor = 0
    let pingPongDir: 1 | -1 = 1
    let lastSwitch = performance.now()
    const total = sheet.frames.length
    const effectiveFps = Math.max(1, (template.fps || 12) * (template.speed || 1))

    drawFrameAt(0, performance.now() / 1000)

    const tick = (now: number): void => {
      const currFrame = sheet.frames[cursor] ?? sheet.frames[0]
      const intervalMs = (1000 / effectiveFps) * (currFrame?.durationRatio || 1)
      if (now - lastSwitch >= intervalMs) {
        lastSwitch = now
        if (template.loopMode === 'random') {
          let next = Math.floor(Math.random() * total)
          if (next === cursor && total > 1) next = (next + 1) % total
          cursor = next
        } else if (template.loopMode === 'ping-pong') {
          cursor += pingPongDir
          if (cursor >= total) {
            pingPongDir = -1
            cursor = Math.max(0, total - 2)
          } else if (cursor < 0) {
            pingPongDir = 1
            cursor = Math.min(total - 1, 1)
          }
        } else {
          cursor = (cursor + 1) % total
        }
        drawFrameAt(cursor, now / 1000)
      } else if (template.rhythm && template.rhythm.rhythmMode !== 'none') {
        drawFrameAt(cursor, now / 1000)
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [
    isPlaying,
    sheetReady,
    template.fps,
    template.speed,
    template.loopMode,
    template.rhythm
  ])

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={140}
      className="loop-card-preview-canvas"
    />
  )
})

const LOOP_CATEGORIES = [
  { id: 'all', title: 'Tất cả hoạt ảnh lặp', icon: 'all' },
  { id: 'fire', title: 'Lửa & Nhiệt', icon: 'fire' },
  { id: 'magic', title: 'Phép thuật & Năng lượng', icon: 'magic' },
  { id: 'nature', title: 'Tự nhiên & Sinh vật', icon: 'nature' },
  { id: 'electric', title: 'Tia điện & Sét', icon: 'electric' },
  { id: 'custom', title: 'Đã lưu trong kho', icon: 'custom' }
] as const

export function LoopAnimationList(): React.ReactElement {
  const openDialog = useView((s) => s.openDialog)
  const openLoopAnimator = useLoopAnimator((s) => s.open)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [playingIds, setPlayingIds] = useState<Set<string>>(() => new Set())
  const [playAll, setPlayAll] = useState(false)

  useEffect(() => {
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    refresh()
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
  }, [])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length }
    for (const t of templates) {
      counts[t.category] = (counts[t.category] ?? 0) + 1
      if (!t.isBuiltin) {
        counts.custom = (counts.custom ?? 0) + (t.category === 'custom' ? 0 : 1)
      }
    }
    return counts
  }, [templates])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (activeCategory !== 'all') {
        if (activeCategory === 'custom') {
          if (t.isBuiltin && t.category !== 'custom') return false
        } else if (t.category !== activeCategory) {
          return false
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        return (
          t.name.toLowerCase().includes(q) ||
          t.badge.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [templates, activeCategory, searchQuery])

  const togglePlayCard = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    if (playAll) {
      setPlayAll(false)
      setPlayingIds(new Set([id]))
      return
    }
    setPlayingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleTogglePlayAll = (): void => {
    if (playAll) {
      setPlayAll(false)
      setPlayingIds(new Set())
    } else {
      setPlayAll(true)
    }
  }

  const handleOpenWorkshop = (presetId?: string): void => {
    openLoopAnimator(presetId)
    openDialog('loop_animator')
  }

  const handleQuickInsert = async (presetId: string, name: string): Promise<void> => {
    if (busyId) return
    setBusyId(presetId)
    try {
      const res = await exportLoopPresetDirectly(presetId)
      toast(`✨ Đã chèn hoạt ảnh lặp "${name}" (${res.frameCount} frames) vào cảnh!`)
    } catch (err) {
      toast(`Lỗi chèn hoạt ảnh: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleSendToWorkshop25D = (preset: LoopAnimationTemplate, e: React.MouseEvent): void => {
    e.stopPropagation()
    try {
      sessionStorage.setItem(PENDING_WORKSHOP_LOOP_TEMPLATE_KEY, preset.id)
    } catch {
      // ignore
    }
    toast(`🧩 Đã đưa "${preset.name}" vào Xưởng Lắp Ráp 2.5D!`)
    requestOpenLayerAssembly()
  }

  const handleDuplicate = (preset: LoopAnimationTemplate, e: React.MouseEvent): void => {
    e.stopPropagation()
    const copy = saveLoopTemplate({
      ...preset,
      id: `loop_${Date.now().toString(36)}`,
      name: `${preset.name} (Bản sao)`,
      isBuiltin: false
    })
    toast(`⧉ Đã nhân bản "${copy.name}"`)
  }

  const handleDelete = (preset: LoopAnimationTemplate, e: React.MouseEvent): void => {
    e.stopPropagation()
    if (confirmDeleteId === preset.id) {
      deleteLoopTemplate(preset.id)
      setConfirmDeleteId(null)
      toast(`🗑 Đã xóa "${preset.name}"`)
    } else {
      setConfirmDeleteId(preset.id)
      setTimeout(() => {
        setConfirmDeleteId((curr) => (curr === preset.id ? null : curr))
      }, 3000)
    }
  }

  const renderCategoryIcon = (icon: string): React.ReactElement => {
    switch (icon) {
      case 'fire':
        return <IconFlame width={16} height={16} />
      case 'magic':
        return <IconSparkles width={16} height={16} />
      case 'nature':
        return <IconTree width={16} height={16} />
      case 'electric':
        return <IconFilm width={16} height={16} />
      case 'custom':
        return <IconFolder width={16} height={16} />
      default:
        return <IconGrid width={16} height={16} />
    }
  }

  const loopModeShortLabel = (mode: LoopAnimationTemplate['loopMode']): string => {
    switch (mode) {
      case 'ping-pong':
        return '↔ Ping-Pong'
      case 'once':
        return '1️⃣ 1 lần'
      case 'random':
        return '🎲 Ngẫu nhiên'
      default:
        return '🔁 Lặp'
    }
  }

  return (
    <div className="model-3d-layout loop-assets-layout" data-mcp-region="assets_loop">
      {/* 1. Left Vertical Category Icon Strip (matching 3D & 2.5D tabs) */}
      <aside className="asset-vertical-strip" aria-label="Danh mục hoạt ảnh lặp">
        <div className="asset-strip-scroll">
          {LOOP_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0
            const isActive = activeCategory === cat.id
            return (
              <div key={cat.id} className="vertical-tab-wrap">
                <button
                  type="button"
                  className={`vertical-tab-btn${isActive ? ' active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  title={`${cat.title} (${count})`}
                  aria-label={`${cat.title} (${count})`}
                >
                  {renderCategoryIcon(cat.icon)}
                </button>
              </div>
            )
          })}
        </div>
        <div className="asset-strip-footer">
          <div className="strip-divider" />
          <div className="vertical-tab-wrap">
            <button
              type="button"
              className="vertical-tab-btn vertical-action-btn action-folder"
              onClick={() => handleOpenWorkshop()}
              title="Mở Xưởng Tách Hoạt Ảnh Loop tạo mới"
              aria-label="Mở Xưởng Tách Hoạt Ảnh Loop tạo mới"
            >
              <IconPlus width={15} height={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="model-3d-content">
        <div className="model-3d-header loop-assets-subbar">
          <div className="search-bar" style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="input-text sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm hoạt ảnh loop..."
            />
          </div>
          <button
            type="button"
            className={`btn ${playAll ? 'primary' : 'ghost'} sm loop-play-all-btn`}
            onClick={handleTogglePlayAll}
            title={
              playAll
                ? 'Dừng phát tất cả hoạt ảnh, trở về hiển thị Frame #1'
                : 'Phát đồng loạt tất cả hoạt ảnh lặp trong danh sách'
            }
          >
            {playAll ? (
              <>
                <IconPause width={11} height={11} /> <span>Dừng tất cả</span>
              </>
            ) : (
              <>
                <IconPlay width={11} height={11} /> <span>Phát tất cả</span>
              </>
            )}
          </button>
        </div>

        {/* 2-Column Grid of Loop Animation Cards */}
        <div className="model-3d-grid loop-card-grid">
          {filteredTemplates.map((preset) => {
            const isCardPlaying = playAll || playingIds.has(preset.id)
            const hasRhythm = preset.rhythm && preset.rhythm.rhythmMode !== 'none'

            return (
              <div
                key={preset.id}
                className={`model-3d-card loop-item-card ${isCardPlaying ? 'is-playing' : ''}`}
                onClick={() => handleOpenWorkshop(preset.id)}
                title={`${preset.name} — Click để mở trong Xưởng Tách Hoạt Ảnh Loop`}
                style={{ cursor: 'pointer' }}
              >
                <div className="model-3d-card-thumb loop-card-thumb">
                  {/* Top-Left Badges */}
                  <div className="model-3d-badge-stack">
                    <span className={`model-3d-badge ${isCardPlaying ? 'has-motion' : 'no-motion'}`}>
                      {isCardPlaying ? `▶ ${preset.fps}fps` : `F1/${preset.frameCount}F`}
                    </span>
                    {hasRhythm && (
                      <span className="model-3d-faces-badge" title="Có cấu hình Logic Nhịp & Nháy">
                        ⚡ Nhịp
                      </span>
                    )}
                  </div>

                  {/* Top-Right Action Strip matching Model3D & 2.5D cards */}
                  <div className="model-3d-card-actions-top" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-action-btn add-btn"
                      disabled={busyId === preset.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleQuickInsert(preset.id, preset.name)
                      }}
                      title="Chèn ngay vào phân cảnh hiện tại"
                    >
                      <IconPlus width={11} height={11} />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn edit-btn"
                      onClick={(e) => handleSendToWorkshop25D(preset, e)}
                      title="Đưa vào Xưởng Lắp Ráp 2.5D"
                    >
                      <IconLayers width={10} height={10} />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenWorkshop(preset.id)
                      }}
                      title="Chỉnh sửa trong Xưởng Tách Hoạt Ảnh Loop"
                    >
                      <IconPen width={10} height={10} />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn duplicate-btn"
                      onClick={(e) => handleDuplicate(preset, e)}
                      title="Nhân bản mẫu hoạt ảnh"
                    >
                      <IconCopy width={10} height={10} />
                    </button>
                    {!preset.isBuiltin && (
                      <button
                        type="button"
                        className="icon-action-btn delete-btn"
                        onClick={(e) => handleDelete(preset, e)}
                        title={confirmDeleteId === preset.id ? 'Bấm lần nữa để xác nhận xóa' : 'Xóa mẫu đã lưu'}
                      >
                        {confirmDeleteId === preset.id ? (
                          <IconCheck width={10} height={10} />
                        ) : (
                          <IconTrash width={10} height={10} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Cropped Frame #1 (when paused) or Live Loop Animation (when playing) */}
                  <LoopCardPreviewCanvas template={preset} isPlaying={isCardPlaying} />

                  {/* Bottom-Left Play/Pause Toggle */}
                  <button
                    type="button"
                    className={`loop-card-play-toggle ${isCardPlaying ? 'active' : ''}`}
                    onClick={(e) => togglePlayCard(preset.id, e)}
                    title={isCardPlaying ? 'Tạm dừng (Chỉ hiện Frame #1)' : 'Chạy thử hoạt ảnh lặp'}
                  >
                    {isCardPlaying ? (
                      <IconPause width={10} height={10} />
                    ) : (
                      <IconPlay width={10} height={10} />
                    )}
                    <span>{isCardPlaying ? 'Dừng' : 'Chạy'}</span>
                  </button>
                </div>

                {/* Card Info */}
                <div className="model-3d-card-info" style={{ padding: '2px 4px 4px 4px' }}>
                  <div
                    className="model-3d-card-title"
                    title={preset.name}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {preset.name}
                  </div>
                  <div
                    className="model-3d-card-cat"
                    style={{
                      fontSize: '9.5px',
                      color: 'var(--text-dim)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {preset.frameCount}F • {preset.fps} FPS • {loopModeShortLabel(preset.loopMode)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
