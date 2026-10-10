import { useState } from 'react'
import type { LayerCompositeCategory } from './types'
import { renderCategoryIcon } from '../assets/categoryIcons'
import { IconPlus } from '../icons'

interface LayerAssemblyCategoryBarProps {
  categories: LayerCompositeCategory[]
  selectedCategory: string
  onSelectCategory: (catId: string) => void
  itemCounts: Record<string, number>
  onCreateNew: () => void
}

interface TooltipInfo {
  type: 'category' | 'action'
  cat?: LayerCompositeCategory
  top: number
  right: number
}

function getCategoryDescription(catId: string, title: string): string {
  switch (catId) {
    case 'all':
      return 'Toàn bộ các mẫu chi tiết layer xếp chồng và gắn xương trong thư viện'
    case 'nature':
      return 'Các mẫu cây cối, hoa lá, cỏ và cành nhánh thiên nhiên có gắn xương uốn mềm'
    case 'prop':
      return 'Đồ vật, nội thất, lồng đèn, đạo cụ và chi tiết trang trí cảnh'
    case 'character':
      return 'Nhân vật, cử chỉ tay chân, sinh vật và chuyển động uốn lượn'
    case 'architecture':
      return 'Cửa sổ, ban công, mái ngói, cột trụ và chi tiết công trình'
    case 'custom':
      return 'Các chi tiết layer do bạn tự tạo và lưu lại trong dự án'
    default:
      return `Bộ sưu tập chi tiết danh mục ${title}`
  }
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
      type: 'category',
      cat,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const showActionTooltip = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      type: 'action',
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
                {renderCategoryIcon(cat.icon || cat.id, 16, 16)}
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

      {/* Floating Tooltip đồng bộ 100% với tab 3D */}
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
                {tooltip.cat.id !== 'all' && (
                  <span className="tooltip-tag-system tag-cyan">Chủ đề</span>
                )}
              </div>
              <div className="tooltip-desc">
                {getCategoryDescription(tooltip.cat.id, tooltip.cat.title)}
              </div>
              <div className="tooltip-count">
                <span>🧩 {itemCounts[tooltip.cat.id] ?? 0} chi tiết lắp ráp</span>
              </div>
            </>
          )}

          {tooltip.type === 'action' && (
            <>
              <div
                className="tooltip-title"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6
                }}
              >
                <span>Tạo chi tiết mới</span>
                <span className="tooltip-tag-system tag-cyan">Xưởng</span>
              </div>
              <div className="tooltip-desc">
                Mở xưởng lắp ráp layer để ghép các layer và tạo khung xương chuyển động
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
