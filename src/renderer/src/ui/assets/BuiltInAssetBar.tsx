import { useMemo, useState } from 'react'
import type { BuiltInAssetCategory } from '@shared/ipc'
import { IconCode, IconFolder } from '../icons'
import { renderCategoryIcon } from './categoryIcons'
import { sortAssetCategories } from './types'

interface BuiltInAssetBarProps {
  categories: BuiltInAssetCategory[]
  selectedCategory: string
  onSelectCategory: (catId: string) => void
  itemCounts: Record<string, number>
  onOpenJsonModal: () => void
  onOpenFolder: () => void
}

interface TooltipInfo {
  type: 'category' | 'action'
  cat?: BuiltInAssetCategory
  action?: 'folder' | 'json'
  top: number
  right: number
}

export function BuiltInAssetBar({
  categories,
  selectedCategory,
  onSelectCategory,
  itemCounts,
  onOpenJsonModal,
  onOpenFolder
}: BuiltInAssetBarProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const sortedCategories = useMemo(() => {
    return sortAssetCategories(categories)
  }, [categories])

  const showCatTooltip = (e: React.MouseEvent<HTMLElement>, cat: BuiltInAssetCategory) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      type: 'category',
      cat,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const showActionTooltip = (e: React.MouseEvent<HTMLElement>, action: 'folder' | 'json') => {
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
    <aside className="asset-vertical-strip" aria-label="Danh mục tài nguyên">
      {/* Scrollable Library Category Tabs */}
      <div className="asset-strip-scroll" onScroll={hideTooltip}>
        {sortedCategories.map((cat) => {
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

      {/* Fixed System Utility Actions pinned at bottom */}
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
            aria-label="Mở thư mục assets"
          >
            <IconFolder width={16} height={16} />
          </button>
        </div>

        <div
          className="vertical-tab-wrap"
          onMouseEnter={(e) => showActionTooltip(e, 'json')}
          onMouseLeave={hideTooltip}
        >
          <button
            type="button"
            className="vertical-tab-btn vertical-action-btn action-json"
            onClick={onOpenJsonModal}
            aria-label="Chỉnh sửa JSON mapping"
          >
            <IconCode width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Floating Tooltip outside scroll container */}
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
              {tooltip.cat.folder && <div className="tooltip-folder">assets/{tooltip.cat.folder}</div>}
              {tooltip.cat.description && <div className="tooltip-desc">{tooltip.cat.description}</div>}
              <div className="tooltip-count">
                <span>📦 {itemCounts[tooltip.cat.id] ?? 0} tài nguyên</span>
              </div>
            </>
          )}

          {tooltip.type === 'action' && tooltip.action === 'folder' && (
            <>
              <div className="tooltip-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span>Thư mục Assets</span>
                <span className="tooltip-tag-system tag-amber">Hệ thống</span>
              </div>
              <div className="tooltip-desc">Mở thư mục chứa ảnh & âm thanh trên máy tính</div>
            </>
          )}

          {tooltip.type === 'action' && tooltip.action === 'json' && (
            <>
              <div className="tooltip-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span>Cấu hình JSON</span>
                <span className="tooltip-tag-system tag-cyan">Cài đặt</span>
              </div>
              <div className="tooltip-desc">Chỉnh sửa mapping tên tiếng Việt, folder và icon trong manifest.json</div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

