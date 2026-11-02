import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '../../actions'
import { IconFilm, IconLayers, IconTrash, IconUnlink, IconX } from '../icons'
import { LoopCardPreviewCanvas } from './LoopCardPreviewCanvas'
import {
  deleteLoopTemplateSafely,
  detachLoopTemplateUsage,
  findLoopTemplateUsages,
  loopUsageKey,
  removeLoopSceneLayer,
  type LoopTemplateUsage
} from './loopTemplateUsage'
import type { LoopAnimationTemplate } from './types'
import '../../styles/loopLibrary.css'

interface Props {
  template: LoopAnimationTemplate
  onClose: () => void
  onDeleted?: (templateId: string) => void
}

function UsageRow({
  usage,
  onDetach,
  onRemoveLayer
}: {
  usage: LoopTemplateUsage
  onDetach: () => void
  onRemoveLayer?: () => void
}): React.ReactElement {
  const isScene = usage.kind === 'scene'
  return (
    <li className="loop-del-usage">
      <span className={`loop-del-usage-icon ${isScene ? 'is-scene' : 'is-composite'}`}>
        {isScene ? <IconFilm width={13} height={13} /> : <IconLayers width={13} height={13} />}
      </span>
      <span className="loop-del-usage-text">
        <strong title={usage.layerName}>{usage.layerName}</strong>
        <small>{isScene ? usage.shotName : usage.compositeName}</small>
      </span>
      <span className="loop-del-usage-actions">
        <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={onDetach} title="Gỡ liên kết tới mẫu, layer vẫn giữ khung hình đã đóng gói">
          <IconUnlink width={12} height={12} />
          <span>Gỡ liên kết</span>
        </button>
        {onRemoveLayer && (
          <button type="button" className="la-btn la-btn--danger-outline la-btn--sm" onClick={onRemoveLayer} title="Xoá hẳn layer này khỏi cảnh (Ctrl+Z để hoàn tác)">
            <IconTrash width={12} height={12} />
            <span>Xoá layer</span>
          </button>
        )}
      </span>
    </li>
  )
}

/**
 * Hộp thoại xoá mẫu hoạt ảnh lặp: nếu mẫu đang được dùng (layer trong cảnh hoặc mảnh
 * trong mẫu Xưởng 2.5D) thì liệt kê từng vị trí để người dùng gỡ; nếu không thì chỉ hỏi xác nhận.
 */
export function LoopTemplateDeleteDialog({ template, onClose, onDeleted }: Props): React.ReactElement {
  const [version, setVersion] = useState(0)
  const usages = useMemo(() => findLoopTemplateUsages(template.id), [template.id, version])
  const sceneUsages = usages.filter((u) => u.kind === 'scene')
  const compositeUsages = usages.filter((u) => u.kind === 'composite')
  const hasUsage = usages.length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const refresh = (): void => setVersion((v) => v + 1)

  const handleDetach = (u: LoopTemplateUsage): void => {
    if (detachLoopTemplateUsage(u)) toast(`🔗 Đã gỡ liên kết "${u.layerName}" khỏi mẫu "${template.name}"`)
    refresh()
  }

  const handleRemoveLayer = (u: LoopTemplateUsage): void => {
    if (u.kind === 'scene' && removeLoopSceneLayer(u)) toast(`🗑 Đã xoá layer "${u.layerName}" khỏi cảnh (Ctrl+Z để hoàn tác)`)
    refresh()
  }

  const handleDelete = (): void => {
    const res = deleteLoopTemplateSafely(template.id)
    if (res.deleted) {
      toast(
        res.detached > 0
          ? `🗑 Đã xoá "${template.name}" và tự gỡ ${res.detached} liên kết còn lại`
          : `🗑 Đã xoá "${template.name}" khỏi kho Loop Animate`
      )
      onDeleted?.(template.id)
    }
    onClose()
  }

  return createPortal(
    <div className="loop-del-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`loop-del-dialog${hasUsage ? ' has-usage' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Xoá mẫu hoạt ảnh Loop"
        data-mcp-region="loop_delete_confirm"
        data-mcp-dialog="loop_delete_confirm"
      >
        <header className="loop-del-header">
          <span className="loop-del-header-icon">
            <IconTrash width={16} height={16} />
          </span>
          <div className="loop-del-header-text">
            <h3>{hasUsage ? 'Mẫu đang được sử dụng' : 'Xoá hoạt ảnh Loop?'}</h3>
            <p title={template.name}>{template.name}</p>
          </div>
          <button type="button" className="la-icon-btn" onClick={onClose} title="Đóng (Esc)" aria-label="Đóng">
            <IconX width={14} height={14} />
          </button>
        </header>

        <div className="loop-del-body">
          <div className="loop-del-summary">
            <div className="loop-del-thumb">
              <LoopCardPreviewCanvas template={template} isPlaying={false} width={96} height={72} />
            </div>
            <p>
              {hasUsage ? (
                <>
                  Đang được dùng ở <strong>{usages.length} vị trí</strong>. Gỡ từng mục bên dưới, hoặc bấm
                  <strong> Gỡ tất cả &amp; xoá</strong> — các layer vẫn giữ nguyên khung hình đã đóng gói.
                </>
              ) : (
                <>Mẫu chưa được dùng ở cảnh hay mẫu Xưởng 2.5D nào, có thể xoá an toàn.</>
              )}
              {template.isBuiltin && <span className="loop-del-note">Mẫu tích hợp sẵn — xoá sẽ ẩn mẫu khỏi kho.</span>}
            </p>
          </div>

          {sceneUsages.length > 0 && (
            <section className="loop-del-group">
              <h4>Layer trong cảnh dự án ({sceneUsages.length})</h4>
              <ul>
                {sceneUsages.map((u) => (
                  <UsageRow key={loopUsageKey(u)} usage={u} onDetach={() => handleDetach(u)} onRemoveLayer={() => handleRemoveLayer(u)} />
                ))}
              </ul>
            </section>
          )}
          {compositeUsages.length > 0 && (
            <section className="loop-del-group">
              <h4>Mảnh trong mẫu Xưởng Layer 2.5D ({compositeUsages.length})</h4>
              <ul>
                {compositeUsages.map((u) => (
                  <UsageRow key={loopUsageKey(u)} usage={u} onDetach={() => handleDetach(u)} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="loop-del-footer">
          <button type="button" className="la-btn la-btn--ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" className="la-btn la-btn--danger" onClick={handleDelete} autoFocus={!hasUsage}>
            <IconTrash width={13} height={13} />
            <span>{hasUsage ? 'Gỡ tất cả & xoá' : 'Xoá mẫu'}</span>
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
