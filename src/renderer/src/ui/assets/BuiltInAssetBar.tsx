import { useState } from 'react'
import type { BuiltInAssetCategory } from '@shared/ipc'
import { IconCode, IconFolder } from '../icons'
import { renderCategoryIcon } from './categoryIcons'

interface BuiltInAssetBarProps {
  categories: BuiltInAssetCategory[]
  selectedCategory: string
  onSelectCategory: (catId: string) => void
  itemCounts: Record<string, number>
  onOpenJsonModal: () => void
  onOpenFolder: () => void
}

export function BuiltInAssetBar({
  categories,
  selectedCategory,
  onSelectCategory,
  itemCounts,
  onOpenJsonModal,
  onOpenFolder
}: BuiltInAssetBarProps) {
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)

  return (
    <aside className="asset-vertical-strip" aria-label="Danh mục tài nguyên">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.id
        const count = itemCounts[cat.id] ?? 0
        const isHovered = hoveredCatId === cat.id

        return (
          <div
            key={cat.id}
            style={{ position: 'relative' }}
            onMouseEnter={() => setHoveredCatId(cat.id)}
            onMouseLeave={() => setHoveredCatId(null)}
          >
            <button
              type="button"
              className={`vertical-tab-btn${isActive ? ' active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
              aria-label={cat.title}
              title={cat.title}
            >
              {renderCategoryIcon(cat.icon || cat.id, 16, 16)}
            </button>

            {isHovered && (
              <div className="vertical-tab-tooltip" role="tooltip">
                <div className="tooltip-title">
                  <span>{cat.title}</span>
                </div>
                {cat.folder && <div className="tooltip-folder">assets/{cat.folder}</div>}
                {cat.description && <div className="tooltip-desc">{cat.description}</div>}
                <div className="tooltip-count">
                  <span>📦 {count} tài nguyên</span>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="strip-divider" />

      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setHoveredAction('folder')}
        onMouseLeave={() => setHoveredAction(null)}
      >
        <button
          type="button"
          className="vertical-tab-btn vertical-action-btn action-folder"
          onClick={onOpenFolder}
          title="Mở thư mục assets (Hệ thống)"
          aria-label="Mở thư mục assets"
        >
          <IconFolder width={16} height={16} />
        </button>
        {hoveredAction === 'folder' && (
          <div className="vertical-tab-tooltip" role="tooltip">
            <div className="tooltip-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span>Thư mục Assets</span>
              <span className="tooltip-tag-system tag-amber">Hệ thống</span>
            </div>
            <div className="tooltip-desc">Mở thư mục chứa ảnh & âm thanh trên máy tính</div>
          </div>
        )}
      </div>

      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setHoveredAction('json')}
        onMouseLeave={() => setHoveredAction(null)}
      >
        <button
          type="button"
          className="vertical-tab-btn vertical-action-btn action-json"
          onClick={onOpenJsonModal}
          title="Chỉnh sửa JSON mapping (Cấu hình hệ thống)"
          aria-label="Chỉnh sửa JSON mapping"
        >
          <IconCode width={16} height={16} />
        </button>
        {hoveredAction === 'json' && (
          <div className="vertical-tab-tooltip" role="tooltip">
            <div className="tooltip-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span>Cấu hình JSON</span>
              <span className="tooltip-tag-system tag-cyan">Cài đặt</span>
            </div>
            <div className="tooltip-desc">Chỉnh sửa mapping tên tiếng Việt, folder và icon trong manifest.json</div>
          </div>
        )}
      </div>
    </aside>
  )
}
