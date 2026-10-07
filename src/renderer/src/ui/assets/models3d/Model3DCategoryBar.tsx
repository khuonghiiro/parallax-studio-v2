import { useMemo, useState } from 'react'
import type { Asset3DsCategory } from '@shared/ipc'
import { IconCode, IconFolder } from '../../icons'
import { renderCategoryIcon } from '../categoryIcons'

interface Model3DCategoryBarProps {
  categories: Asset3DsCategory[]
  selectedCategory: string
  onSelectCategory: (catId: string) => void
  itemCounts: Record<string, number>
  onOpenFolder: () => void
  onOpenManifestModal: () => void
}

interface TooltipInfo {
  type: 'category' | 'action'
  cat?: Asset3DsCategory
  action?: 'folder' | 'manifest'
  top: number
  right: number
}

export function Model3DCategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
  itemCounts,
  onOpenFolder,
  onOpenManifestModal
}: Model3DCategoryBarProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const sorted = useMemo(() => {
    return [...categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  }, [categories])

  const showCatTooltip = (e: React.MouseEvent<HTMLElement>, cat: Asset3DsCategory) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      type: 'category',
      cat,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const showActionTooltip = (e: React.MouseEvent<HTMLElement>, action: 'folder' | 'manifest') => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      type: 'action',
      action,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <aside className="asset-vertical-strip" aria-label="Chủ đề mô hình 3D">
      {/* Scrollable Category Tabs */}
      <div className="asset-strip-scroll" onScroll={hideTooltip}>
        {sorted.map((cat) => {
          const isActive = selectedCategory === cat.id

          return (
            <div
              key={cat.id}
              className="vertical-tab-wrap"
              onMouseEnter={(e) => showCatTooltip(e, cat)}
              onMouseLeave={hideTooltip}
            >
              <button
                type="button"
                className={`vertical-tab-btn${isActive ? ' active' : ''}`}
                onClick={() => onSelectCategory(cat.id)}
                aria-label={cat.title}
              >
                {renderCategoryIcon(cat.icon || cat.id, 16, 16)}
              </button>
            </div>
          )
        })}
      </div>

      {/* Pinned Bottom Utilities */}
      <div className="asset-strip-footer">
        <div className="strip-divider" />

        <div
          className="vertical-tab-wrap"
          onMouseEnter={(e) => showActionTooltip(e, 'folder')}
          onMouseLeave={hideTooltip}
        >
          <button
            type="button"
            className="vertical-tab-btn vertical-action-btn action-folder"
            onClick={onOpenFolder}
            aria-label="Mở thư mục asset-3ds"
          >
            <IconFolder width={16} height={16} />
          </button>
        </div>

        <div
          className="vertical-tab-wrap"
          onMouseEnter={(e) => showActionTooltip(e, 'manifest')}
          onMouseLeave={hideTooltip}
        >
          <button
            type="button"
            className="vertical-tab-btn vertical-action-btn action-json"
            onClick={onOpenManifestModal}
            aria-label="Cấu hình chủ đề asset-3ds/manifest.json"
          >
            <IconCode width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltip && (
        <div
          className="vertical-tab-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.right + 8,
            top: tooltip.top,
            transform: 'translateY(-50%)',
            zIndex: 9999
          }}
        >
          {tooltip.type === 'category' && tooltip.cat && (
            <>
              <div className="tooltip-title">
                <span>{tooltip.cat.title}</span>
              </div>
              {tooltip.cat.description && (
                <div className="tooltip-desc">{tooltip.cat.description}</div>
              )}
              <div className="tooltip-count">
                <span>🧊 {itemCounts[tooltip.cat.id] ?? 0} mô hình 3D</span>
              </div>
            </>
          )}

          {tooltip.type === 'action' && tooltip.action === 'folder' && (
            <>
              <div
                className="tooltip-title"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
              >
                <span>Thư mục asset-3ds</span>
                <span className="tooltip-tag-system tag-amber">Hệ thống</span>
              </div>
              <div className="tooltip-desc">Mở thư mục chứa các file cấu hình model.json và texture ảnh</div>
            </>
          )}

          {tooltip.type === 'action' && tooltip.action === 'manifest' && (
            <>
              <div
                className="tooltip-title"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
              >
                <span>Cấu hình manifest.json</span>
                <span className="tooltip-tag-system tag-cyan">Chủ đề 3D</span>
              </div>
              <div className="tooltip-desc">Chỉnh sửa danh sách chủ đề, icon và mô tả trong asset-3ds/manifest.json</div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
