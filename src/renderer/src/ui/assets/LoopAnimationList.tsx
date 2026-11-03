import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../../actions'
import '../../styles/model3dLibrary.css'
import '../../styles/loopAnimator.css'
import '../../styles/loopLibrary.css'
import { getActiveCategoriesForModule, useAssetManifestStore } from '../../store/assetManifest'
import {
  IconLoopAnimate,
  IconPause,
  IconPen,
  IconPlay,
  IconPlus,
  IconSearch,
  IconTrash
} from '../icons'
import { LoopCardPreviewCanvas } from '../loopAnimator/LoopCardPreviewCanvas'
import { LoopTemplateDeleteDialog } from '../loopAnimator/LoopTemplateDeleteDialog'
import { exportLoopPresetDirectly } from '../loopAnimator/loopAnimationExporter'
import { openLoopAnimatorBlank, openLoopAnimatorTemplate } from '../loopAnimator/loopAnimatorLauncher'
import { LOOP_STORAGE_UPDATED_EVENT, getAllLoopTemplates } from '../loopAnimator/loopAnimatorStorage'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import { setCleanDragGhost } from '../utils/dragPreviewHelper'
import { renderCategoryIcon } from './categoryIcons'

const LOOP_MODE_LABEL: Record<LoopAnimationTemplate['loopMode'], string> = {
  loop: 'Lặp vòng',
  'ping-pong': 'Đảo chiều',
  once: '1 lần',
  random: 'Ngẫu nhiên'
}

function matchCategory(t: LoopAnimationTemplate, cat: string): boolean {
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
  categoryMeta?: {
    title: string
    shortTitle?: string
    accent?: string
    icon: string
    iconUrl?: string
    iconText?: string
  }
}

export const LOOP_CATEGORY_THEMES: Record<
  string,
  {
    accent: string
    badgeBg: string
    badgeColor: string
    label: string
    icon: string
  }
> = {
  magic: {
    accent: '#a855f7',
    badgeBg: 'color-mix(in srgb, #a855f7 78%, #0f172a)',
    badgeColor: '#ffffff',
    label: 'Phép thuật',
    icon: '✨'
  },
  fire: {
    accent: '#f97316',
    badgeBg: 'color-mix(in srgb, #ea580c 78%, #0f172a)',
    badgeColor: '#ffffff',
    label: 'Lửa & Nhiệt',
    icon: '🔥'
  },
  nature: {
    accent: '#10b981',
    badgeBg: 'color-mix(in srgb, #16a34a 78%, #0f172a)',
    badgeColor: '#ffffff',
    label: 'Tự nhiên',
    icon: '🌿'
  },
  electric: {
    accent: '#06b6d4',
    badgeBg: 'color-mix(in srgb, #0284c7 78%, #0f172a)',
    badgeColor: '#ffffff',
    label: 'Tia điện',
    icon: '⚡'
  },
  custom: {
    accent: '#6366f1',
    badgeBg: 'color-mix(in srgb, #4f46e5 78%, #0f172a)',
    badgeColor: '#ffffff',
    label: 'Kho lưu',
    icon: '📦'
  }
}

function LoopTemplateCard({
  template,
  isPlaying,
  busy,
  onTogglePlay,
  onInsert,
  onEdit,
  onDelete,
  categoryMeta
}: CardProps): React.ReactElement {
  const hasRhythm = Boolean(template.rhythm && template.rhythm.rhythmMode !== 'none')
  const fallbackTheme = LOOP_CATEGORY_THEMES[template.category] ?? LOOP_CATEGORY_THEMES.custom
  const accent = categoryMeta?.accent || fallbackTheme.accent
  const badgeBg = `color-mix(in srgb, ${accent} 78%, #0f172a)`
  const label = categoryMeta?.shortTitle || categoryMeta?.title || fallbackTheme.label

  return (
    <article
      className={`loop-lib-card${isPlaying ? ' is-playing' : ''}`}
      title={`${template.name} — Nhấn giữ kéo thả vào cảnh hoặc bấm + Chèn`}
      style={{ ['--item-accent' as string]: accent, cursor: 'grab' }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-pxs-loop-template', template.id)
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({ type: 'loop_template', templateId: template.id, template })
        )
        e.dataTransfer.effectAllowed = 'copy'
        const img = e.currentTarget.querySelector('img.loop-card-ghost-img, img') as HTMLImageElement | null
        const cv = e.currentTarget.querySelector('canvas') as HTMLCanvasElement | null
        setCleanDragGhost(e, img || cv || template.thumbUrl)
      }}
    >
      <div className="loop-lib-thumb">
        <div
          className="loop-lib-thumb-hit"
          onClick={onEdit}
          title="Nhấn để chỉnh sửa trong Xưởng Tách Hoạt Ảnh Loop · Nhấn giữ kéo thả vào cảnh"
        >
          <LoopCardPreviewCanvas template={template} isPlaying={isPlaying} width={200} height={140} />
        </div>
        <span className="loop-lib-chip loop-lib-chip--frames">{template.frameCount}F</span>
        <span
          className="loop-lib-chip loop-lib-chip--category"
          style={{
            top: 6,
            left: 6,
            backgroundColor: badgeBg,
            color: '#ffffff',
            boxShadow: `0 2px 6px rgba(0, 0, 0, 0.45), 0 0 0 1px color-mix(in srgb, ${accent} 40%, transparent)`
          }}
          title={`Chủ đề: ${label}`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {categoryMeta
              ? renderCategoryIcon(categoryMeta.icon, 10, 10, template.category, {
                  iconUrl: categoryMeta.iconUrl,
                  iconText: categoryMeta.iconText
                })
              : fallbackTheme.icon}
          </span>
          <span style={{ marginLeft: 3 }}>{label}</span>
        </span>
        {hasRhythm && (
          <span
            className="loop-lib-chip loop-lib-chip--rhythm"
            style={{
              top: 27,
              left: 6,
              background: 'color-mix(in srgb, var(--bg-1) 85%, #0f172a)',
              color: 'var(--text)',
              border: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`
            }}
            title="Có hiệu ứng nhịp điệu (pulse / beat)"
          >
            〰 Nhịp
          </span>
        )}
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
        <button
          type="button"
          className="la-icon-btn la-icon-btn--primary"
          disabled={busy}
          onClick={onInsert}
          title="Chèn hoạt ảnh này vào cảnh hiện tại"
          aria-label="Chèn vào cảnh"
        >
          <IconPlus width={13} height={13} />
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
  const manifestModules = useAssetManifestStore((s) => s.modules)
  const manifestRevision = useAssetManifestStore((s) => s.revision)
  const loopCategories = useMemo(
    () => getActiveCategoriesForModule(manifestModules, 'loop_animator'),
    [manifestModules]
  )
  const categoryMap = useMemo(
    () => new Map(loopCategories.map((c) => [c.id, c])),
    [loopCategories]
  )

  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [playingIds, setPlayingIds] = useState<Set<string>>(() => new Set())
  const [playAll, setPlayAll] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoopAnimationTemplate | null>(null)

  useEffect(() => {
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    refresh()
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    window.addEventListener('parallax:manifest-updated', refresh)
    return () => {
      window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
      window.removeEventListener('parallax:manifest-updated', refresh)
    }
  }, [manifestRevision])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of loopCategories) counts[c.id] = templates.filter((t) => matchCategory(t, c.id)).length
    return counts
  }, [templates, loopCategories])

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
          {loopCategories.map((cat) => (
            <div key={cat.id} className="vertical-tab-wrap">
              <button
                type="button"
                className={`vertical-tab-btn${activeCategory === cat.id ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                title={`${cat.title} (${categoryCounts[cat.id] ?? 0})`}
                aria-label={`${cat.title} (${categoryCounts[cat.id] ?? 0})`}
              >
                {renderCategoryIcon(cat.icon || cat.id, 16, 16, cat.id, {
                  iconUrl: cat.iconUrl,
                  iconText: cat.iconText
                })}
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
          <span>{loopCategories.find((c) => c.id === activeCategory)?.title}</span>
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
                categoryMeta={categoryMap.get(t.category)}
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
