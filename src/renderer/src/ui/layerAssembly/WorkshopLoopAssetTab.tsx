import React, { useEffect, useMemo, useState } from 'react'
import '../../styles/loopWorkshop.css'
import { IconLink, IconLoopAnimate, IconPen, IconPlay, IconPause, IconPlus } from '../icons'
import { LoopCardPreviewCanvas } from '../loopAnimator/LoopCardPreviewCanvas'
import { openLoopAnimatorInPlace } from '../loopAnimator/loopAnimatorLauncher'
import { LOOP_STORAGE_UPDATED_EVENT, getAllLoopTemplates } from '../loopAnimator/loopAnimatorStorage'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import type { AssembledLayerItem } from './types'

interface Props {
  searchTerm: string
  layers: AssembledLayerItem[]
  selectedLayer: AssembledLayerItem | null
  onAddLoopTemplate: (tpl: LoopAnimationTemplate) => void
  onBindLoopTemplate: (tpl: LoopAnimationTemplate) => void
}

export function useLoopTemplateList(): LoopAnimationTemplate[] {
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())
  useEffect(() => {
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
  }, [])
  return templates
}

/**
 * Tab tài nguyên "Loop" trong sidebar Xưởng Layer 2.5D: liệt kê mẫu hoạt ảnh lặp của kho
 * để thêm thành mảnh mới hoặc gán vào mảnh đang chọn; cấu hình chi tiết ở tab Loop bên phải.
 */
export function WorkshopLoopAssetTab({ searchTerm, layers, selectedLayer, onAddLoopTemplate, onBindLoopTemplate }: Props): React.ReactElement {
  const templates = useLoopTemplateList()
  const [playingId, setPlayingId] = useState<string | null>(null)

  const usedCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of layers) {
      const id = l.loopConfig?.templateId
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [layers])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates
  }, [templates, searchTerm])

  return (
    <div className="lw-loop-assets" data-mcp-region="layer_assembly_loop_assets">
      <div className="lw-loop-assets-head">
        <span className="lw-loop-assets-hint">
          {selectedLayer ? (
            <>
              Đang chọn: <strong title={selectedLayer.name}>{selectedLayer.name}</strong>
            </>
          ) : (
            'Chọn 1 mảnh để gán, hoặc thêm thành mảnh mới'
          )}
        </span>
        <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={() => openLoopAnimatorInPlace()} title="Mở Xưởng Tách Hoạt Ảnh Loop trống để tạo mẫu mới">
          <IconPlus width={12} height={12} />
          <span>Tạo mới</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="lw-loop-assets-empty">
          <IconLoopAnimate width={22} height={22} />
          <span>{searchTerm ? 'Không có mẫu Loop khớp từ khoá.' : 'Kho Loop Animate đang trống.'}</span>
        </div>
      ) : (
        <div className="lw-loop-assets-list">
          {filtered.map((t) => {
            const used = usedCount.get(t.id) ?? 0
            const isBound = selectedLayer?.loopConfig?.templateId === t.id
            const isPlaying = playingId === t.id
            return (
              <article key={t.id} className={`lw-loop-asset${isBound ? ' is-bound' : ''}`}>
                <button type="button" className="lw-loop-asset-thumb" onClick={() => setPlayingId(isPlaying ? null : t.id)} title={isPlaying ? 'Tạm dừng' : 'Chạy thử'}>
                  <LoopCardPreviewCanvas template={t} isPlaying={isPlaying} width={112} height={84} />
                  <span className="lw-loop-asset-play">{isPlaying ? <IconPause width={10} height={10} /> : <IconPlay width={10} height={10} />}</span>
                </button>
                <div className="lw-loop-asset-body">
                  <span className="lw-loop-asset-name" title={t.name}>{t.name}</span>
                  <span className="lw-loop-asset-meta">
                    {t.frameCount}F · {t.fps} FPS
                    {used > 0 && <span className="lw-loop-asset-used">Đang dùng {used}</span>}
                  </span>
                  <div className="lw-loop-asset-actions">
                    <button type="button" className="la-btn la-btn--primary la-btn--sm" onClick={() => onAddLoopTemplate(t)} title="Thêm thành 1 mảnh hoạt ảnh mới trong cụm 2.5D">
                      <IconPlus width={11} height={11} />
                      <span>Thêm</span>
                    </button>
                    <button
                      type="button"
                      className="la-btn la-btn--outline la-btn--sm"
                      disabled={!selectedLayer || isBound}
                      onClick={() => onBindLoopTemplate(t)}
                      title={selectedLayer ? `Gán vào mảnh "${selectedLayer.name}"` : 'Chọn 1 mảnh trước để gán'}
                    >
                      <IconLink width={11} height={11} />
                      <span>{isBound ? 'Đã gán' : 'Gán'}</span>
                    </button>
                    <button type="button" className="la-icon-btn la-icon-btn--bordered" onClick={() => openLoopAnimatorInPlace(t.id)} title="Sửa mẫu trong Xưởng Tách Hoạt Ảnh Loop" aria-label="Sửa mẫu">
                      <IconPen width={12} height={12} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
