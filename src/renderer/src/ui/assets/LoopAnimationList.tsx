import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../../actions'
import '../../styles/model3dLibrary.css'
import '../../styles/loopAnimator.css'
import '../../styles/loopLibrary.css'
import {
  IconFilm,
  IconFlame,
  IconFolder,
  IconGrid,
  IconLoopAnimate,
  IconPause,
  IconPen,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconTree
} from '../icons'
import { LoopCardPreviewCanvas } from '../loopAnimator/LoopCardPreviewCanvas'
import { LoopTemplateDeleteDialog } from '../loopAnimator/LoopTemplateDeleteDialog'
import { exportLoopPresetDirectly } from '../loopAnimator/loopAnimationExporter'
import { openLoopAnimatorBlank, openLoopAnimatorTemplate } from '../loopAnimator/loopAnimatorLauncher'
import { LOOP_STORAGE_UPDATED_EVENT, getAllLoopTemplates } from '../loopAnimator/loopAnimatorStorage'
import type { LoopAnimationTemplate } from '../loopAnimator/types'

const LOOP_CATEGORIES = [
  { id: 'all', title: 'Tất cả hoạt ảnh lặp' },
  { id: 'fire', title: 'Lửa & Nhiệt' },
  { id: 'magic', title: 'Phép thuật & Năng lượng' },
  { id: 'nature', title: 'Tự nhiên & Sinh vật' },
  { id: 'electric', title: 'Tia điện & Sét' },
  { id: 'custom', title: 'Đã lưu trong kho' }
] as const

type LoopCategoryId = (typeof LOOP_CATEGORIES)[number]['id']

function CategoryIcon({ id }: { id: LoopCategoryId }): React.ReactElement {
  const p = { width: 16, height: 16 }
  switch (id) {
    case 'fire':
      return <IconFlame {...p} />
    case 'magic':
      return <IconSparkles {...p} />
    case 'nature':
      return <IconTree {...p} />
    case 'electric':
      return <IconFilm {...p} />
    case 'custom':
      return <IconFolder {...p} />
    default:
      return <IconGrid {...p} />
  }
}

const LOOP_MODE_LABEL: Record<LoopAnimationTemplate['loopMode'], string> = {
  loop: 'Lặp vòng',
  'ping-pong': 'Đảo chiều',
  once: '1 lần',
  random: 'Ngẫu nhiên'
}

function matchCategory(t: LoopAnimationTemplate, cat: LoopCategoryId): boolean {
  if (cat === 'all') return true
  if (cat === 'custom') return !t.isBuiltin || t.category === 'custom'
  return t.category === cat
}

interface CardProps {
  template: LoopAnimationTemplate
  isPlaying: boolean
  busy: boolean
  onTogglePlay: () => void
  onInsert: () => void
  onEdit: () => void
  onDelete: () => void
}

function LoopTemplateCard({ template, isPlaying, busy, onTogglePlay, onInsert, onEdit, onDelete }: CardProps): React.ReactElement {
  const hasRhythm = Boolean(template.rhythm && template.rhythm.rhythmMode !== 'none')
  return (
    <article className={`loop-lib-card${isPlaying ? ' is-playing' : ''}`} title={template.name}>
      <div className="loop-lib-thumb">
        <button type="button" className="loop-lib-thumb-hit" onClick={onEdit} title="Mở trong Xưởng Tách Hoạt Ảnh Loop để chỉnh sửa">
          <LoopCardPreviewCanvas template={template} isPlaying={isPlaying} width={200} height={140} />
        </button>
        <span className="loop-lib-chip loop-lib-chip--frames">{template.frameCount}F</span>
        {hasRhythm && <span className="loop-lib-chip loop-lib-chip--rhythm">Nhịp</span>}
        {!template.isBuiltin && <span className="loop-lib-chip loop-lib-chip--own">Của tôi</span>}
        <button
          type="button"
          className={`loop-lib-play${isPlaying ? ' active' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Tạm dừng (hiện Frame #1)' : 'Chạy thử hoạt ảnh'}
          aria-label={isPlaying ? 'Tạm dừng' : 'Chạy thử'}
        >
          {isPlaying ? <IconPause width={11} height={11} /> : <IconPlay width={11} height={11} />}
        </button>
      </div>
      <div className="loop-lib-info">
        <span className="loop-lib-name">{template.name}</span>
        <span className="loop-lib-meta">
          {template.fps} FPS · {LOOP_MODE_LABEL[template.loopMode] ?? 'Lặp vòng'}
        </span>
      </div>
      <div className="loop-lib-actions">
        <button type="button" className="la-btn la-btn--primary la-btn--sm loop-lib-insert" disabled={busy} onClick={onInsert} title="Chèn hoạt ảnh này vào cảnh hiện tại">
          <IconPlus width={12} height={12} />
          <span>{busy ? 'Đang chèn…' : 'Chèn'}</span>
        </button>
        <button type="button" className="la-icon-btn la-icon-btn--bordered" onClick={onEdit} title="Chỉnh sửa trong Xưởng Tách Hoạt Ảnh Loop" aria-label="Chỉnh sửa">
          <IconPen width={13} height={13} />
        </button>
        <button type="button" className="la-icon-btn la-icon-btn--bordered la-icon-btn--danger" onClick={onDelete} title="Xoá mẫu khỏi kho (kiểm tra nơi đang dùng trước khi xoá)" aria-label="Xoá">
          <IconTrash width={13} height={13} />
        </button>
      </div>
    </article>
  )
}

export function LoopAnimationList(): React.ReactElement {
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  const [activeCategory, setActiveCategory] = useState<LoopCategoryId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [playingIds, setPlayingIds] = useState<Set<string>>(() => new Set())
  const [playAll, setPlayAll] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoopAnimationTemplate | null>(null)

  useEffect(() => {
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    refresh()
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
  }, [])

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<LoopCategoryId, number>
    for (const c of LOOP_CATEGORIES) counts[c.id] = templates.filter((t) => matchCategory(t, c.id)).length
    return counts
  }, [templates])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return templates.filter(
      (t) =>
        matchCategory(t, activeCategory) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    )
  }, [templates, activeCategory, searchQuery])

  const togglePlayCard = (id: string): void => {
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
    setPlayAll((v) => !v)
    setPlayingIds(new Set())
  }

  const handleInsert = async (t: LoopAnimationTemplate): Promise<void> => {
    if (busyId) return
    setBusyId(t.id)
    try {
      const res = await exportLoopPresetDirectly(t.id)
      toast(`✨ Đã chèn hoạt ảnh lặp "${t.name}" (${res.frameCount} frames) vào cảnh!`)
    } catch (err) {
      toast(`Lỗi chèn hoạt ảnh: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="model-3d-layout loop-assets-layout" data-mcp-region="assets_loop">
      <aside className="asset-vertical-strip" aria-label="Danh mục hoạt ảnh lặp">
        <div className="asset-strip-scroll">
          {LOOP_CATEGORIES.map((cat) => (
            <div key={cat.id} className="vertical-tab-wrap">
              <button
                type="button"
                className={`vertical-tab-btn${activeCategory === cat.id ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                title={`${cat.title} (${categoryCounts[cat.id]})`}
                aria-label={`${cat.title} (${categoryCounts[cat.id]})`}
              >
                <CategoryIcon id={cat.id} />
              </button>
            </div>
          ))}
        </div>
        <div className="asset-strip-footer">
          <div className="strip-divider" />
          <div className="vertical-tab-wrap">
            <button
              type="button"
              className="vertical-tab-btn vertical-action-btn action-folder"
              onClick={openLoopAnimatorBlank}
              title="Tạo Loop Animate mới (xưởng trống)"
              aria-label="Tạo Loop Animate mới"
            >
              <IconPlus width={15} height={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="model-3d-content">
        <div className="loop-lib-toolbar">
          <label className="loop-lib-search">
            <IconSearch width={13} height={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm hoạt ảnh loop…"
              aria-label="Tìm hoạt ảnh loop"
            />
          </label>
          <button
            type="button"
            className={`la-btn la-btn--sm ${playAll ? 'la-btn--primary' : 'la-btn--outline'}`}
            onClick={handleTogglePlayAll}
            title={playAll ? 'Dừng tất cả, trở về Frame #1' : 'Phát đồng loạt tất cả hoạt ảnh'}
          >
            {playAll ? <IconPause width={11} height={11} /> : <IconPlay width={11} height={11} />}
            <span>{playAll ? 'Dừng' : 'Phát tất cả'}</span>
          </button>
        </div>

        <div className="loop-lib-section-head">
          <span>{LOOP_CATEGORIES.find((c) => c.id === activeCategory)?.title}</span>
          <span className="loop-lib-count">{filtered.length}</span>
        </div>

        {filtered.length > 0 ? (
          <div className="loop-lib-grid">
            {filtered.map((t) => (
              <LoopTemplateCard
                key={t.id}
                template={t}
                isPlaying={playAll || playingIds.has(t.id)}
                busy={busyId === t.id}
                onTogglePlay={() => togglePlayCard(t.id)}
                onInsert={() => void handleInsert(t)}
                onEdit={() => openLoopAnimatorTemplate(t.id)}
                onDelete={() => setDeleteTarget(t)}
              />
            ))}
          </div>
        ) : (
          <div className="loop-lib-empty">
            <IconLoopAnimate width={28} height={28} />
            <p>{searchQuery ? 'Không tìm thấy hoạt ảnh khớp từ khoá.' : 'Chưa có hoạt ảnh nào trong nhóm này.'}</p>
            <button type="button" className="la-btn la-btn--primary la-btn--sm" onClick={openLoopAnimatorBlank}>
              <IconPlus width={12} height={12} />
              <span>Tạo Loop Animate</span>
            </button>
          </div>
        )}
      </div>

      {deleteTarget && (
        <LoopTemplateDeleteDialog
          template={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) =>
            setPlayingIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }
        />
      )}
    </div>
  )
}
