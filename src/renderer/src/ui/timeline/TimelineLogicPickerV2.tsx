import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Layer, Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import { addTimelineLogic } from '../../project/timelineLogic'
import {
  WORKFLOW_V2_LOGIC_CATEGORIES,
  WORKFLOW_V2_LOGIC_PRESETS,
  type WorkflowV2SpawnCategory
} from '../../project/workflowV2LogicPresets'

export type TimelinePickerCategory = WorkflowV2SpawnCategory | 'all'

/** Ánh xạ nhóm logic kiểu cũ (nút nhanh trên hàng Layer) sang nhóm logic chung V2 */
export function toV2PickerCategory(cat?: string): TimelinePickerCategory {
  const map: Record<string, TimelinePickerCategory> = {
    motion: 'action',
    physics: 'material',
    light_fx: 'light',
    scene: 'cave',
    audio: 'audio'
  }
  if (!cat) return 'all'
  if (WORKFLOW_V2_LOGIC_CATEGORIES.some((c) => c.id === cat)) return cat as WorkflowV2SpawnCategory
  return map[cat] ?? 'all'
}

/**
 * Kho logic của Timeline — dùng ĐÚNG danh mục mẫu logic của Workflow V2,
 * nên logic thêm ở đây hiện ngay thành Node trên Workflow (và ngược lại).
 */
export function TimelineLogicPickerV2({
  layer,
  targetName,
  scopeKind,
  initialCategory,
  onClose,
  onAdded
}: {
  layer?: Layer
  targetName: string
  scopeKind: string
  initialCategory: TimelinePickerCategory
  onClose: () => void
  onAdded: (nodeId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<TimelinePickerCategory>(initialCategory)
  const [error, setError] = useState<string | null>(layer ? null : 'Chọn một Layer trên Timeline để gắn logic.')

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return WORKFLOW_V2_LOGIC_PRESETS.filter((p) => {
      if (active !== 'all' && p.category !== active) return false
      if (!q) return true
      const cat = WORKFLOW_V2_LOGIC_CATEGORIES.find((c) => c.id === p.category)
      return `${p.label} ${cat?.label ?? ''} ${cat?.hint ?? ''}`.toLowerCase().includes(q)
    })
  }, [query, active])

  const add = (presetId: string): void => {
    try {
      let added = ''
      useEditor.getState().update((draft: Project) => {
        added = addTimelineLogic(draft, presetId, layer?.id)
      })
      onClose()
      onAdded(added)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm logic.')
    }
  }

  return createPortal(
    <div className="tl-logic-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section
        className="tl-logic-picker"
        data-mcp-region="timeline_logic_picker"
        data-mcp-dialog
        role="dialog"
        aria-modal="true"
        aria-label="Thêm logic"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onClose()
        }}
      >
        <header className="tl-logic-picker-header">
          <div className="tl-logic-picker-title-wrap">
            <div className="tl-logic-picker-heading-row">
              <strong>Kho logic chung (Timeline ⇄ Workflow)</strong>
              <span className="tl-logic-picker-target-badge">{scopeKind}: {targetName}</span>
            </div>
            <p>Logic gắn ở đây là cùng một Node trên Workflow — sửa ở bên nào cũng cập nhật bên kia.</p>
          </div>
          <button type="button" className="btn ghost" aria-label="Đóng" onClick={onClose}>Đóng</button>
        </header>

        <div className="tl-logic-picker-toolbar">
          <input
            type="search"
            className="tl-logic-search-input"
            aria-label="Tìm logic"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm: đung đưa, nến, đèn pin, đá, va chạm, bloom, nhép môi..."
            autoFocus
          />
          <div className="tl-logic-cat-tabs" role="tablist" aria-label="Lọc theo nhóm logic">
            <button type="button" role="tab" aria-selected={active === 'all'} className={`tl-logic-cat-tab${active === 'all' ? ' active' : ''}`} onClick={() => setActive('all')}>
              <span>Tất cả</span>
              <span className="cnt">{WORKFLOW_V2_LOGIC_PRESETS.length}</span>
            </button>
            {WORKFLOW_V2_LOGIC_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active === cat.id}
                className={`tl-logic-cat-tab${active === cat.id ? ' active' : ''}`}
                style={{ ['--logic-accent' as string]: cat.accent }}
                onClick={() => setActive(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="cnt">{WORKFLOW_V2_LOGIC_PRESETS.filter((p) => p.category === cat.id).length}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="tl-logic-error-banner" role="alert">{error}</p>}

        <div className="tl-logic-catalog">
          {items.map((p) => {
            const cat = WORKFLOW_V2_LOGIC_CATEGORIES.find((c) => c.id === p.category)!
            return (
              <button
                key={p.id}
                type="button"
                className="tl-logic-card"
                data-add-logic={p.id}
                disabled={!layer}
                style={{ ['--logic-accent' as string]: cat.accent }}
                onClick={() => add(p.id)}
              >
                <div className="tl-logic-card-top">
                  <span className="tl-logic-card-icon">{cat.icon}</span>
                  <small className="tl-logic-card-cat">{cat.label}</small>
                  <span className="tl-logic-card-cta">+ Gắn</span>
                </div>
                <strong className="tl-logic-card-title">{p.label}</strong>
                <span className="tl-logic-card-desc">{cat.hint}</span>
              </button>
            )
          })}
          {!items.length && <p>Không có logic phù hợp. Thử từ khóa khác.</p>}
        </div>
      </section>
    </div>,
    document.body
  )
}
