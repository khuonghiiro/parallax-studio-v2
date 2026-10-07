import { useEffect, useState, useMemo } from 'react'
import type { BuiltInAssetItem, PickedFile } from '@shared/ipc'
import type { Face3D } from './types'
import { renderCategoryIcon } from '../categoryIcons'
import { IconPlus, IconCheck, IconCube, IconReplace, IconSearch, IconX } from '../../icons'

interface AssemblyAssetSidebarProps {
  selectedFace: Face3D | null
  onAssignAssetToFace: (assetPath: string, width?: number, height?: number) => void
  modelFaces: Face3D[]
  onSelectFace: (faceId: string) => void
}

interface MiniCategory {
  id: string
  title: string
  icon: string
}

export interface OrientationDef {
  id: 'all' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'other'
  label: string
  shortLabel: string
  color: string
}

const SIDEBAR_CATEGORIES: MiniCategory[] = [
  { id: 'all', title: 'Tất cả tài nguyên', icon: 'all' },
  { id: 'architecture', title: 'Kiến trúc & Nhà cửa', icon: 'home' },
  { id: 'props', title: 'Đạo cụ & Khối hộp', icon: 'cube' },
  { id: 'street', title: 'Đường phố & Góc cảnh', icon: 'city' },
  { id: 'room', title: 'Nội thất & Căn phòng', icon: 'image' },
  { id: 'custom', title: 'Tự thêm / Từ máy', icon: 'sparkles' }
]

export const ORIENTATIONS: OrientationDef[] = [
  { id: 'all', label: 'Tất cả', shortLabel: 'Tất cả', color: 'var(--accent)' },
  { id: 'front', label: 'Trước', shortLabel: 'Trước', color: '#3b82f6' },
  { id: 'back', label: 'Sau', shortLabel: 'Sau', color: '#ec4899' },
  { id: 'left', label: 'Trái', shortLabel: 'Trái', color: '#06b6d4' },
  { id: 'right', label: 'Phải', shortLabel: 'Phải', color: '#f97316' },
  { id: 'top', label: 'Trên', shortLabel: 'Trên', color: '#a855f7' },
  { id: 'bottom', label: 'Dưới', shortLabel: 'Dưới', color: '#10b981' },
  { id: 'other', label: 'Khác', shortLabel: 'Khác', color: '#64748b' }
]

export function getAssetOrientation(item: BuiltInAssetItem, modelFaces: Face3D[]): OrientationDef {
  const usedFace = modelFaces.find(
    (f) =>
      f.assetPath &&
      (f.assetPath === item.relativePath ||
        item.relativePath.endsWith(f.assetPath) ||
        f.assetPath.endsWith(item.relativePath))
  )

  const textToScan = [
    usedFace?.name || '',
    usedFace?.id || '',
    item.name || '',
    item.fileName || '',
    item.relativePath || ''
  ]
    .join(' ')
    .toLowerCase()

  if (
    textToScan.includes('front') ||
    textToScan.includes('trước') ||
    textToScan.includes('tiền') ||
    textToScan.includes('facade') ||
    textToScan.includes('gable')
  ) {
    return ORIENTATIONS[1] // Trước
  }
  if (
    textToScan.includes('back') ||
    textToScan.includes('sau') ||
    textToScan.includes('lưng') ||
    textToScan.includes('rear')
  ) {
    return ORIENTATIONS[2] // Sau
  }
  if (textToScan.includes('left') || textToScan.includes('trái') || textToScan.includes('hông t')) {
    return ORIENTATIONS[3] // Trái
  }
  if (textToScan.includes('right') || textToScan.includes('phải') || textToScan.includes('hông p')) {
    return ORIENTATIONS[4] // Phải
  }
  if (
    textToScan.includes('roof') ||
    textToScan.includes('mái') ||
    textToScan.includes('nóc') ||
    textToScan.includes('top') ||
    textToScan.includes('trên')
  ) {
    return ORIENTATIONS[5] // Trên
  }
  if (
    textToScan.includes('bottom') ||
    textToScan.includes('đáy') ||
    textToScan.includes('sàn') ||
    textToScan.includes('floor') ||
    textToScan.includes('ground') ||
    textToScan.includes('dưới')
  ) {
    return ORIENTATIONS[6] // Dưới
  }

  return ORIENTATIONS[7] // Khác (ống khói, chi tiết trang trí, v.v.)
}

export function AssemblyAssetSidebar({
  selectedFace,
  onAssignAssetToFace,
  modelFaces,
  onSelectFace
}: AssemblyAssetSidebarProps) {
  const [assets, setAssets] = useState<BuiltInAssetItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedOrientation, setSelectedOrientation] = useState<OrientationDef['id']>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [customAssets, setCustomAssets] = useState<BuiltInAssetItem[]>([])
  const [loading, setLoading] = useState(false)

  // Load assembly assets from backend
  useEffect(() => {
    setLoading(true)
    if (window.api?.getAssemblyAssets) {
      window.api
        .getAssemblyAssets()
        .then((items) => {
          if (Array.isArray(items)) {
            setAssets(items)
          }
        })
        .catch((err) => console.warn('[AssemblyAssetSidebar] Error loading assembly assets:', err))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Combine built-in assembly assets with custom user picked files, filtering out review/raw junk
  const cleanAllItems = useMemo(() => {
    return [...customAssets, ...assets].filter((item) => {
      const n = (item.fileName || item.name || '').toLowerCase()
      if (n.includes('review') || n.includes('thumb')) return false
      if (n.includes('_raw') || n.includes('raw_crop')) return false
      return true
    })
  }, [customAssets, assets])

  // Count items per category
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: cleanAllItems.length }
    SIDEBAR_CATEGORIES.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = cleanAllItems.filter(
          (it) => it.folder === cat.id || (cat.id === 'architecture' && it.relativePath.includes('house'))
        ).length
      }
    })
    return counts
  }, [cleanAllItems])

  // Items filtered by category only (for orientation counters)
  const categoryItems = useMemo(() => {
    if (selectedCategory === 'all') return cleanAllItems
    return cleanAllItems.filter(
      (it) =>
        it.folder === selectedCategory ||
        (selectedCategory === 'architecture' && it.relativePath.includes('house'))
    )
  }, [cleanAllItems, selectedCategory])

  // Filter by category, orientation & search
  const filtered = useMemo(() => {
    let list = categoryItems
    if (selectedOrientation !== 'all') {
      list = list.filter((it) => getAssetOrientation(it, modelFaces).id === selectedOrientation)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (it) => it.name.toLowerCase().includes(q) || it.fileName.toLowerCase().includes(q)
      )
    }
    return list
  }, [categoryItems, selectedOrientation, searchTerm, modelFaces])

  // Group items by orientation when in "Tất cả" view (without search) for crystal clear browsing
  const orientationGroups = useMemo(() => {
    if (selectedOrientation !== 'all' || searchTerm.trim()) {
      return null
    }

    const groups: { orient: OrientationDef; items: BuiltInAssetItem[] }[] = []
    ORIENTATIONS.slice(1).forEach((ori) => {
      const itemsForOri = categoryItems.filter(
        (it) => getAssetOrientation(it, modelFaces).id === ori.id
      )
      if (itemsForOri.length > 0) {
        groups.push({ orient: ori, items: itemsForOri })
      }
    })
    return groups
  }, [selectedOrientation, searchTerm, categoryItems, modelFaces])

  // Handle importing additional image textures from disk
  const handlePickLocalImage = async () => {
    try {
      const files: PickedFile[] = await window.api.openFiles('image')
      if (files && files.length > 0) {
        const newItems: BuiltInAssetItem[] = files.map((f) => {
          const blob = new Blob([f.data as BlobPart], { type: f.mime })
          const previewUrl = URL.createObjectURL(blob)
          const ext = f.name.split('.').pop()?.toLowerCase() || 'png'
          return {
            id: `custom:${f.name}-${Date.now()}`,
            name: f.name.replace(/\.[^.]+$/, ''),
            fileName: f.name,
            relativePath: previewUrl,
            folder: 'custom',
            ext,
            mime: f.mime,
            kind: 'image',
            size: f.data.byteLength,
            path: f.path,
            previewUrl
          }
        })
        setCustomAssets((prev) => [...newItems, ...prev])
      }
    } catch (err) {
      console.warn('[AssemblyAssetSidebar] Error picking local image:', err)
    }
  }

  // Replace texture for currently selected face from local file
  const handleReplaceLocalForSelectedFace = async () => {
    if (!selectedFace) return
    try {
      const files: PickedFile[] = await window.api.openFiles('image')
      if (files && files.length > 0) {
        const f = files[0]
        const blob = new Blob([f.data as BlobPart], { type: f.mime })
        const previewUrl = URL.createObjectURL(blob)
        const ext = f.name.split('.').pop()?.toLowerCase() || 'png'
        const newItem: BuiltInAssetItem = {
          id: `custom:${f.name}-${Date.now()}`,
          name: f.name.replace(/\.[^.]+$/, ''),
          fileName: f.name,
          relativePath: previewUrl,
          folder: 'custom',
          ext,
          mime: f.mime,
          kind: 'image',
          size: f.data.byteLength,
          path: f.path,
          previewUrl
        }
        setCustomAssets((prev) => [newItem, ...prev])
        onAssignAssetToFace(previewUrl)
      }
    } catch (err) {
      console.warn('[AssemblyAssetSidebar] Error replacing face texture:', err)
    }
  }

  // Find which face is currently using an asset
  const getUsedByFaces = (assetPath: string) => {
    return modelFaces.filter(
      (f) =>
        f.assetPath &&
        (f.assetPath === assetPath ||
          assetPath.endsWith(f.assetPath) ||
          f.assetPath.endsWith(assetPath))
    )
  }

  const activeCategoryTitle =
    SIDEBAR_CATEGORIES.find((c) => c.id === selectedCategory)?.title || 'Tất cả tài nguyên'

  // Render a clean visual card with unobscured image and solid info footer
  const renderAssetCard = (item: BuiltInAssetItem) => {
    const orient = getAssetOrientation(item, modelFaces)
    const usedFaces = getUsedByFaces(item.relativePath)
    const isCurrentFaceUsing =
      selectedFace?.assetPath &&
      (selectedFace.assetPath === item.relativePath ||
        item.relativePath.endsWith(selectedFace.assetPath) ||
        selectedFace.assetPath.endsWith(item.relativePath))

    return (
      <div
        key={item.id}
        className={`assembly-asset-card${isCurrentFaceUsing ? ' active' : ''}`}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData(
            'application/json',
            JSON.stringify({
              type: 'assembly-asset',
              assetPath: item.relativePath,
              name: item.name
            })
          )
          e.dataTransfer.setData('text/plain', item.relativePath)
          e.dataTransfer.effectAllowed = 'copyMove'
        }}
        onClick={() => onAssignAssetToFace(item.relativePath)}
        title={
          selectedFace
            ? `Click hoặc Kéo vào 3D để gán ảnh "${item.name}"`
            : `Ảnh: ${item.name} (${item.fileName})\nKéo thả trực tiếp vào không gian 3D để tạo mặt mới`
        }
      >
        {/* 1. Image Thumbnail Stage: Pure view of the texture */}
        <div className="card-thumb-stage">
          {item.previewUrl ? (
            <img src={item.previewUrl} alt={item.name} className="card-thumb-img" loading="lazy" />
          ) : (
            <div className="card-thumb-fallback">
              <IconCube width={28} height={28} />
              <span>{item.ext.toUpperCase()}</span>
            </div>
          )}

          {/* Micro badge in top-left: sleek, minimal */}
          <div className="card-micro-badge">
            <span className="micro-badge-dot" style={{ backgroundColor: orient.color }} />
            <span className="micro-badge-text">{orient.shortLabel}</span>
          </div>

          {/* Top-Right: Active Checkmark or Quick Swap */}
          <div className="card-top-actions">
            {isCurrentFaceUsing && (
              <span className="card-using-pill" title="Đang được gán cho mặt này">
                <IconCheck width={9} height={9} strokeWidth={3} />
                <span>Đang chọn</span>
              </span>
            )}
            <button
              type="button"
              className="card-quick-swap-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleReplaceLocalForSelectedFace()
              }}
              title="Đổi file ảnh này bằng ảnh khác từ máy tính"
            >
              <IconReplace width={11} height={11} />
            </button>
          </div>
        </div>

        {/* 2. Metadata Bar BELOW image: Solid background, never obscures the picture */}
        <div className="card-meta-bar">
          <div className="card-meta-title" title={item.name}>
            {item.name}
          </div>
          {usedFaces.length > 0 && (
            <div className="card-meta-faces">
              {usedFaces.map((f) => (
                <span
                  key={f.id}
                  className={`card-face-chip${f.id === selectedFace?.id ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectFace(f.id)
                  }}
                  title={`Chuyển sang mặt: ${f.name}`}
                >
                  {f.name.split('.')[0] || f.name.slice(0, 10)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <aside className="assembly-asset-sidebar" aria-label="Tài nguyên lắp ráp 3D">
      {/* 1. Left Vertical Mini-Category Strip (giống tab Thư viện) */}
      <div className="sidebar-category-strip">
        <div className="sidebar-strip-icons">
          {SIDEBAR_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`sidebar-cat-btn${isActive ? ' active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                title={`${cat.title} (${itemCounts[cat.id] ?? 0})`}
              >
                {renderCategoryIcon(cat.icon, 16, 16)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Main Content: Header & Catalog */}
      <div className="sidebar-catalog-main">
        {/* Top Header */}
        <div className="sidebar-catalog-header">
          <div className="header-title-row">
            <div className="header-title-left">
              <span className="cat-title">{activeCategoryTitle}</span>
              <span className="cat-count-badge">{filtered.length}</span>
            </div>

            {/* Header Right Action Buttons */}
            <div className="header-actions-right">
              <button
                type="button"
                className="btn xs secondary action-btn-compact"
                onClick={handlePickLocalImage}
                title="Thêm ảnh texture mới từ máy tính vào danh sách"
              >
                <IconPlus width={12} height={12} />
                <span>Thêm ảnh</span>
              </button>
              {selectedFace && (
                <button
                  type="button"
                  className="btn xs secondary action-btn-compact replace-active"
                  onClick={handleReplaceLocalForSelectedFace}
                  title={`Chọn file ảnh từ máy để thay thế trực tiếp vào mặt "${selectedFace.name}"`}
                >
                  <IconReplace width={12} height={12} />
                  <span>Đổi ảnh</span>
                </button>
              )}
            </div>
          </div>

          {/* Search bar with clear button */}
          <div className="sidebar-search-box">
            <IconSearch width={13} height={13} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm texture..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
                title="Xóa tìm kiếm"
              >
                <IconX width={12} height={12} />
              </button>
            )}
          </div>

          {/* Selected Face Hint Bar */}
          <div className="selected-face-bar">
            {selectedFace ? (
              <div className="face-bar-active">
                <span className="face-bar-label">Mặt đang chọn:</span>
                <span className="face-bar-name" title={selectedFace.name}>
                  {selectedFace.name}
                </span>
              </div>
            ) : (
              <div className="face-bar-empty">
                <span>💡 Click chọn 1 mặt phẳng 3D trong khung nhìn để gán ảnh</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Horizontal Orientation Tab Strip (Gọn gàng 2 hàng, không bị UI che lấp) */}
        <div className="sidebar-orientation-tabs">
          <div className="orient-tabs-wrap">
            {ORIENTATIONS.map((ori) => {
              const isActive = selectedOrientation === ori.id
              const count =
                ori.id === 'all'
                  ? categoryItems.length
                  : categoryItems.filter((it) => getAssetOrientation(it, modelFaces).id === ori.id).length
              return (
                <button
                  key={ori.id}
                  type="button"
                  className={`orient-pill${isActive ? ' active' : ''}${count === 0 && !isActive ? ' dimmed' : ''}`}
                  onClick={() => setSelectedOrientation(ori.id)}
                  title={`${ori.label} (${count} ảnh)`}
                >
                  <span className="orient-pill-dot" style={{ backgroundColor: ori.color }} />
                  <span className="orient-pill-text">{ori.shortLabel}</span>
                  <span className="orient-pill-badge">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 4. Visual Catalog Content: Grouped by orientation in "Tất cả" OR Flat Grid in Sub-Tabs */}
        <div className="sidebar-catalog-content">
          {orientationGroups && orientationGroups.length > 0 ? (
            <div className="catalog-orientation-sections">
              {orientationGroups.map((group) => (
                <div key={group.orient.id} className="orient-section-block">
                  <div className="orient-section-header">
                    <span className="orient-section-dot" style={{ backgroundColor: group.orient.color }} />
                    <span className="orient-section-title">{group.orient.label}</span>
                    <span className="orient-section-count">{group.items.length} ảnh</span>
                  </div>
                  <div className="orient-section-grid">
                    {group.items.map(renderAssetCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sidebar-catalog-grid">
              {filtered.map(renderAssetCard)}
            </div>
          )}

          {filtered.length === 0 && !loading && (
            <div className="empty-catalog-box">
              <IconSearch width={24} height={24} />
              <p>Không có ảnh phù hợp ở hướng này</p>
              <button
                type="button"
                className="btn xs secondary"
                onClick={handlePickLocalImage}
                style={{ marginTop: 8 }}
              >
                <IconPlus width={12} height={12} /> Thêm ảnh từ máy
              </button>
            </div>
          )}

          {loading && (
            <div className="empty-catalog-box">
              <p>Đang tải tài nguyên...</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
