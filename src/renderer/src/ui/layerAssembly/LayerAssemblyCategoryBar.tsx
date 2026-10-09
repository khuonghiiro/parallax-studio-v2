import { useState } from 'react'
import type { LayerCompositeCategory } from './types'
import { renderCategoryIcon } from '../assets/categoryIcons'
import { IconLayers, IconPlus } from '../icons'

interface LayerAssemblyCategoryBarProps {
  categories: LayerCompositeCategory[]
  selectedCategory: string
  onSelectCategory: (catId: string) => void
  itemCounts: Record<string, number>
  onCreateNew: () => void
}

interface TooltipInfo {
  cat?: LayerCompositeCategory
  isAction?: boolean
  top: number
  right: number
}

export function LayerAssemblyCategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
  itemCounts,
  onCreateNew
}: LayerAssemblyCategoryBarProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const showCatTooltip = (e: React.MouseEvent<HTMLElement>, cat: LayerCompositeCategory) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      cat,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const showActionTooltip = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      isAction: true,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <aside className="asset-vertical-strip" aria-label="Chủ đề chi tiết layer">
      {/* Scrollable Category Icons */}
      <div className="asset-strip-scroll" onScroll={hideTooltip}>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id
          const count = itemCounts[cat.id] ?? 0
          const iconKey =
            cat.id === 'all'
              ? 'all'
              : cat.id === 'nature'
                ? 'sparkles'
                : cat.id === 'prop'
                  ? 'cube'
                  : cat.id === 'character'
                    ? 'image'
                    : cat.id === 'architecture'
                      ? 'home'
                      : 'folder'

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
                aria-label={`${cat.title} (${count})`}
              >
                {renderCategoryIcon(iconKey, 16, 16)}
              </button>
            </div>
          )
        })}
      </div>

      {/* Pinned Bottom Action Button */}
      <div className="asset-strip-footer">
        <div className="strip-divider" />
        <div
          className="vertical-tab-wrap"
          onMouseEnter={showActionTooltip}
          onMouseLeave={hideTooltip}
        >
          <button
            type="button"
            className="vertical-tab-btn vertical-action-btn action-folder"
            onClick={onCreateNew}
            aria-label="Tạo hoạt ảnh / chi tiết layer mới"
          >
            <IconPlus width={15} height={15} />
          </button>
        </div>
      </div>

      {/* Tooltip on hover */}
      {tooltip && (
        <div
          className="asset-vertical-tooltip"
          style={{ top: `${tooltip.top}px`, left: `${tooltip.right + 8}px` }}
        >
          {tooltip.isAction ? (
            <div className="tooltip-inner">
              <span className="tooltip-title">Tạo hoạt ảnh mới</span>
              <span className="tooltip-count">Xưởng lắp ráp layer</span>
            </div>
          ) : tooltip.cat ? (
            <div className="tooltip-inner">
              <span className="tooltip-title">{tooltip.cat.title}</span>
              <span className="tooltip-count">{itemCounts[tooltip.cat.id] ?? 0} chi tiết</span>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  )
}
