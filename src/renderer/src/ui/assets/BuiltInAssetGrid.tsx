import { useMemo, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem } from '@shared/ipc'
import { IconCode, IconMusic, IconPlus, IconRefresh, IconSearch, IconX } from '../icons'

interface BuiltInAssetGridProps {
  categories: BuiltInAssetCategory[]
  items: BuiltInAssetItem[]
  selectedCategory: string
  onSelectCategory: (id: string) => void
  onImportItem: (item: BuiltInAssetItem, addLayer: boolean) => void
  onReload: () => void
  onOpenJsonModal: () => void
  loading?: boolean
}

function matchAsset(item: BuiltInAssetItem, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return (
    item.name.toLowerCase().includes(q) ||
    item.fileName.toLowerCase().includes(q) ||
    item.folder.toLowerCase().includes(q)
  )
}

export function BuiltInAssetGrid({
  categories,
  items,
  selectedCategory,
  onSelectCategory,
  onImportItem,
  onReload,
  onOpenJsonModal,
  loading = false
}: BuiltInAssetGridProps) {
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const activeCategory = categories.find((c) => c.id === selectedCategory) || categories[0]

  // Filter items by category & search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat =
        !activeCategory ||
        activeCategory.id === 'all' ||
        !activeCategory.folder ||
        item.folder === activeCategory.folder
      return matchCat && matchAsset(item, search)
    })
  }, [items, activeCategory, search])

  return (
    <div className="asset-content-area">
      {/* Combobox & Tool Controls */}
      <div className="asset-filter-bar">
        <div className="asset-combobox-row">
          <select
            className="asset-category-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            title="Chọn danh mục tài nguyên"
          >
            {categories.map((c) => {
              const count = items.filter(
                (it) => c.id === 'all' || !c.folder || it.folder === c.folder
              ).length
              return (
                <option key={c.id} value={c.id}>
                  {c.title} ({count})
                </option>
              )
            })}
          </select>

          <button
            type="button"
            className="btn sm icon"
            onClick={onReload}
            title="Quét lại thư mục assets"
            disabled={loading}
          >
            <IconRefresh width={14} height={14} />
          </button>

          <button
            type="button"
            className="btn sm icon"
            onClick={onOpenJsonModal}
            title="Sửa cấu hình JSON (manifest.json)"
          >
            <IconCode width={14} height={14} />
          </button>
        </div>

        {/* Search input with live filter */}
        <div className="asset-search-row">
          <IconSearch className="asset-search-icon" />
          <input
            type="text"
            className="asset-search-input"
            placeholder="Tìm theo tên ảnh hoặc âm thanh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="asset-search-clear"
              onClick={() => setSearch('')}
              title="Xoá tìm kiếm"
            >
              <IconX />
            </button>
          )}
        </div>

        <div className="asset-match-count">
          <span>
            {activeCategory?.title || 'Tất cả'} · <b>{filteredItems.length}</b>/{items.length} tệp
          </span>
          {search && <span style={{ color: 'var(--accent-cyan)' }}>Lọc: &quot;{search}&quot;</span>}
        </div>
      </div>

      {/* Grid of Built-in Assets */}
      <div className="builtin-grid-wrap">
        {filteredItems.length === 0 ? (
          <div className="asset-empty-state">
            <IconSearch width={32} height={32} />
            <div>
              {search
                ? `Không tìm thấy tài nguyên nào khớp với "${search}"`
                : 'Thư mục tài nguyên này hiện chưa có tệp ảnh hoặc âm thanh.'}
            </div>
            <div style={{ marginTop: 6, fontSize: '10px' }}>
              Thêm file vào thư mục <code>assets/{activeCategory?.folder || ''}</code> rồi bấm làm mới.
            </div>
          </div>
        ) : (
          <div className="builtin-asset-grid">
            {filteredItems.map((item) => {
              const isAudio = item.kind === 'audio'
              const isHover = hoveredId === item.id

              return (
                <div
                  key={item.id}
                  className={`builtin-asset-card${isAudio ? ' audio' : ''}`}
                  title={`${item.name} (${item.fileName})\nDouble-click để ${isAudio ? 'đặt làm nhạc nền' : 'thêm layer vào cảnh'}`}
                  onDoubleClick={() => onImportItem(item, true)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-pxs-builtin-asset', JSON.stringify(item))
                  }}
                >
                  {isAudio ? (
                    <IconMusic width={28} height={28} style={{ color: 'var(--accent-2)' }} />
                  ) : item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.name} draggable={false} loading="lazy" />
                  ) : (
                    <div style={{ padding: 10, fontSize: '10px', color: 'var(--text-faint)' }}>{item.ext.toUpperCase()}</div>
                  )}

                  {item.isAnimated && <span className="builtin-asset-badge">GIF</span>}

                  <span className="builtin-asset-name">{item.name}</span>

                  {isHover && (
                    <div className="builtin-asset-actions">
                      <button
                        type="button"
                        className="btn sm icon primary"
                        title={isAudio ? 'Dùng làm nhạc nền' : 'Thêm thành layer vào cảnh'}
                        onClick={(e) => {
                          e.stopPropagation()
                          onImportItem(item, true)
                        }}
                      >
                        <IconPlus />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
