import { useMemo, useState } from 'react'
import type { Face3D } from './types'
import {
  ASSEMBLY_TEMPLATES,
  TEMPLATE_CATEGORIES,
  appendTemplate,
  replaceWithTemplate,
  templatePreview,
  type AssemblyTemplate,
  type TemplateCategory
} from './assemblyTemplates'
import { IconPlus } from '../../icons'

interface TemplateGalleryProps {
  faces: Face3D[]
  /** Called with the new face list and the face to select afterwards. */
  onApply: (faces: Face3D[], selectId: string | null) => void
}

const PREVIEW_SIZE = 64

/** Isometric line-art preview; colours come from the theme via currentColor / --accent. */
function TemplatePreview({ template }: { template: AssemblyTemplate }) {
  const polys = useMemo(() => templatePreview(template, PREVIEW_SIZE), [template])
  return (
    <svg className="tg-preview" viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`} aria-hidden="true">
      {polys.map((p, i) => (
        <polygon
          key={i}
          points={p.points}
          fill="var(--accent)"
          fillOpacity={0.12 + p.shade * 0.38}
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/**
 * Template catalogue for the Assembly workshop: geometry-only frames for houses, props,
 * plants and stage sets. "Áp dụng" re-folds the current faces (images kept), "+" adds the
 * template next to the current model.
 */
export function TemplateGallery({ faces, onApply }: TemplateGalleryProps) {
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ASSEMBLY_TEMPLATES.filter(
      (t) =>
        (category === 'all' || t.category === category) &&
        (!q || t.label.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q))
    )
  }, [category, query])

  const handleReplace = (t: AssemblyTemplate) => {
    const slots = t.faces().length
    const ok = window.confirm(
      `Áp dụng khuôn "${t.label}" (${slots} mặt)?\n\n` +
        'Vị trí, góc xoay và kích thước các mặt sẽ được gấp lại theo khuôn. Ảnh và chỉnh sửa lưới ' +
        'của bạn được giữ nguyên theo thứ tự danh sách mặt; mặt dư không bị xóa. Có thể hoàn tác (Ctrl+Z).'
    )
    if (!ok) return
    const next = replaceWithTemplate(t, faces)
    onApply(next, next[0]?.id ?? null)
  }

  const handleAppend = (t: AssemblyTemplate) => {
    const next = appendTemplate(t, faces)
    onApply(next, next[faces.length]?.id ?? null)
  }

  return (
    <div className="tg-root">
      <div className="tg-toolbar">
        <div className="tg-chips" role="tablist" aria-label="Nhóm khuôn mẫu">
          {[{ id: 'all' as const, label: 'Tất cả' }, ...TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={`tg-chip${category === c.id ? ' active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="input-text tg-search"
          placeholder="Tìm khuôn…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm khuôn mẫu"
        />
      </div>
      <div className="tg-grid">
        {list.map((t) => (
          <div key={t.id} className="tg-card" title={t.hint}>
            <button type="button" className="tg-card-main" onClick={() => handleReplace(t)}>
              <TemplatePreview template={t} />
              <span className="tg-card-name">{t.label}</span>
              <span className="tg-card-meta">{t.faces().length} mặt</span>
            </button>
            <button
              type="button"
              className="tg-card-add"
              onClick={() => handleAppend(t)}
              title={`Thêm khuôn "${t.label}" cạnh mô hình hiện tại`}
              aria-label={`Thêm khuôn ${t.label}`}
            >
              <IconPlus width={10} height={10} />
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="tg-empty">Không có khuôn phù hợp.</div>}
      </div>
      <p className="fi-hint">Bấm thẻ để gấp lại các mặt hiện có · nút + để ghép thêm khuôn vào cảnh.</p>
    </div>
  )
}
