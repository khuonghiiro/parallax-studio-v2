import { useState, useMemo, useEffect, useRef } from 'react'
import {
  getStoredComposites,
  deleteComposite,
  BUILTIN_COMPOSITES
} from './layerAssemblyStorage'
import type { AssembledLayerItem, LayerComposite } from './types'
import { IconImage, IconLayers, IconPlus, IconTrash, IconX } from '../icons'
import { useLayerAssetImage } from './useLayerAssetImage'
import { CompositeCard } from './CompositeCard'

export interface LayerAssemblySidebarProps {
  composite: LayerComposite
  selectedLayerId?: string | null
  onSelectLayer?: (id: string | null) => void
  onAddLayerFromAsset: (name: string, path: string, url?: string) => void
  onAppendPresetLayers: (layers: AssembledLayerItem[]) => void
  onLoadComposite?: (composite: LayerComposite) => void
}

interface CustomAssetItem {
  id: string
  path: string
  name: string
  isCustom: boolean
}

const CUSTOM_ASSETS_KEY = 'pxs.customWorkshopAssets'
const HIDDEN_BUILTIN_KEY = 'pxs.hiddenBuiltinWorkshopAssets'

function loadCustomAssets(): CustomAssetItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ASSETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCustomAssets(list: CustomAssetItem[]) {
  try {
    localStorage.setItem(CUSTOM_ASSETS_KEY, JSON.stringify(list))
  } catch {}
}

function loadHiddenBuiltinAssets(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHiddenBuiltinAssets(list: string[]) {
  try {
    localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify(list))
  } catch {}
}

// Danh sách các vật liệu mẫu thiên nhiên & đạo cụ có sẵn trong assets
const BUILTIN_NATURE_ASSETS = [
  { path: 'assembly_3d/modular/nature_grass.png', name: 'Bụi cỏ xanh' },
  { path: 'assembly_3d/modular/nature_flower_stem.png', name: 'Thân cành hoa' },
  { path: 'assembly_3d/modular/nature_flower_petal.png', name: 'Cánh hoa đỏ' },
  { path: 'assembly_3d/modular/nature_flower_center.png', name: 'Nhụy hoa vàng' },
  { path: 'assembly_3d/modular/nature_leaf.png', name: 'Nhánh lá cây' },
  { path: 'assembly_3d/modular/decor_flower_box.png', name: 'Bồn hoa ban công' },
  { path: 'assembly_3d/modular/decor_window.png', name: 'Cửa sổ Tudor' },
  { path: 'demo_transparent/layer5_foreground_vines.png', name: 'Dây leo rủ' },
  { path: 'demos/sparkle_fireflies.gif', name: 'Đom đóm (GIF)' }
]

export function LayerAssemblySidebar({
  composite,
  selectedLayerId,
  onSelectLayer,
  onAddLayerFromAsset,
  onAppendPresetLayers,
  onLoadComposite
}: LayerAssemblySidebarProps) {
  const [activeTab, setActiveTab] = useState<'builtin' | 'presets' | 'project'>('builtin')
  const [searchTerm, setSearchTerm] = useState('')
  const [customAssets, setCustomAssets] = useState<CustomAssetItem[]>(loadCustomAssets)
  const [hiddenBuiltinPaths, setHiddenBuiltinPaths] = useState<string[]>(loadHiddenBuiltinAssets)
  const [storedComposites, setStoredComposites] = useState<LayerComposite[]>(getStoredComposites)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Lắng nghe thay đổi kho mẫu composite (khi bấm "Lưu mẫu" ở Header)
  useEffect(() => {
    const handleChanged = () => setStoredComposites(getStoredComposites())
    window.addEventListener('layerComposites:changed', handleChanged)
    return () => window.removeEventListener('layerComposites:changed', handleChanged)
  }, [])

  // 1. Tab Có sẵn: Tài nguyên hệ thống (trừ mục đã xóa) + Ảnh do người dùng thêm vào
  const allAvailableAssets = useMemo(() => {
    const hiddenSet = new Set(hiddenBuiltinPaths)
    const builtinItems = BUILTIN_NATURE_ASSETS
      .filter((b) => !hiddenSet.has(b.path))
      .map((b) => ({
        id: b.path,
        path: b.path,
        name: b.name,
        isCustom: false
      }))
    return [...customAssets, ...builtinItems]
  }, [customAssets, hiddenBuiltinPaths])

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return allAvailableAssets
    const q = searchTerm.toLowerCase()
    return allAvailableAssets.filter((a) => a.name.toLowerCase().includes(q))
  }, [allAvailableAssets, searchTerm])

  // 2. Tab Mẫu layer: Các asset layer xếp chồng tạo sẵn & mẫu người dùng tự tạo đã lưu
  const filteredComposites = useMemo(() => {
    if (!searchTerm.trim()) return storedComposites
    const q = searchTerm.toLowerCase()
    return storedComposites.filter((c) => c.name.toLowerCase().includes(q))
  }, [storedComposites, searchTerm])

  // 3. Tab Dự án: Chỉ các tài nguyên layer đang được tạo trong mẫu đó
  const currentLayers = composite.layers
  const filteredLayers = useMemo(() => {
    if (!searchTerm.trim()) return currentLayers
    const q = searchTerm.toLowerCase()
    return currentLayers.filter((l) => l.name.toLowerCase().includes(q))
  }, [currentLayers, searchTerm])

  // Xử lý nạp ảnh từ máy tính vào tab Có sẵn
  const handleImportFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const item: CustomAssetItem = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          path: dataUrl,
          name: file.name.replace(/\.[^/.]+$/, ''),
          isCustom: true
        }
        setCustomAssets((prev) => {
          const next = [item, ...prev]
          saveCustomAssets(next)
          return next
        })
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Xóa ảnh khỏi tab Có sẵn (nếu custom thì xóa hẳn, nếu builtin thì ẩn đi)
  const handleDeleteAsset = (item: { id: string; path: string; isCustom: boolean }, e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.isCustom) {
      setCustomAssets((prev) => {
        const next = prev.filter((a) => a.id !== item.id)
        saveCustomAssets(next)
        return next
      })
    } else {
      setHiddenBuiltinPaths((prev) => {
        const next = [...prev, item.path]
        saveHiddenBuiltinAssets(next)
        return next
      })
    }
  }

  // Xóa mẫu layer tự tạo
  const handleDeleteComposite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteComposite(id)
    setStoredComposites(getStoredComposites())
  }

  const builtinIds = useMemo(() => new Set(BUILTIN_COMPOSITES.map((b) => b.id)), [])

  return (
    <div
      className="layer-workshop-sidebar"
      style={{
        width: '260px',
        minWidth: '250px',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--line-soft)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {/* 1. Tabs Switcher: 1. Có sẵn -> 2. Mẫu layer -> 3. Dự án */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--line-soft)',
          background: 'var(--bg-1)',
          flexShrink: 0
        }}
      >
        <button
          type="button"
          className={`tab${activeTab === 'builtin' ? ' active' : ''}`}
          style={{
            flex: 1,
            height: '34px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: 0
          }}
          onClick={() => setActiveTab('builtin')}
          title="Kho ảnh & vật liệu có sẵn"
        >
          <IconImage width={12} height={12} /> Có sẵn ({allAvailableAssets.length})
        </button>

        <button
          type="button"
          className={`tab${activeTab === 'presets' ? ' active' : ''}`}
          style={{
            flex: 1,
            height: '34px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: 0
          }}
          onClick={() => setActiveTab('presets')}
          title="Kho mẫu asset layer xếp chồng đã lưu & tạo sẵn"
        >
          <IconLayers width={12} height={12} /> Mẫu layer ({storedComposites.length})
        </button>

        <button
          type="button"
          className={`tab${activeTab === 'project' ? ' active' : ''}`}
          style={{
            flex: 1,
            height: '34px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: 0
          }}
          onClick={() => setActiveTab('project')}
          title="Tài nguyên các layer đang tạo trong mẫu hiện tại"
        >
          <IconImage width={12} height={12} /> Dự án ({currentLayers.length})
        </button>
      </div>

      {/* 2. Search & Action Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0
        }}
      >
        <input
          type="text"
          className="input-text sm"
          placeholder={
            activeTab === 'project'
              ? 'Tìm layer trong mẫu…'
              : activeTab === 'builtin'
                ? 'Tìm ảnh & vật liệu…'
                : 'Tìm mẫu layer xếp chồng…'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', fontSize: '11px' }}
        />

        {/* Nút Thêm ảnh từ máy khi ở tab Có sẵn */}
        {activeTab === 'builtin' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
              {customAssets.length} ảnh tự thêm
            </span>
            <label
              className="btn xs primary"
              style={{
                padding: '2px 8px',
                fontSize: '10.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Chọn ảnh PNG/JPG/WebP/GIF từ máy để đưa vào kho có sẵn"
            >
              <IconPlus width={11} height={11} />
              <span>Thêm ảnh vào</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                multiple
                style={{ display: 'none' }}
                onChange={handleImportFiles}
              />
            </label>
          </div>
        )}
      </div>

      {/* 3. Main Content List */}
      <div style={{ flex: '1 1 0%', overflowY: 'auto', overflowX: 'hidden', padding: '8px', minHeight: 0 }}>
        {/* TAB 1: CÓ SẴN - Ảnh & Đạo cụ có sẵn + Ảnh người dùng thêm vào */}
        {activeTab === 'builtin' && (
          filteredAssets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
              {filteredAssets.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  onAdd={() => onAddLayerFromAsset(item.name, item.path, item.path.startsWith('data:') ? item.path : undefined)}
                  onDelete={(e) => handleDeleteAsset(item, e)}
                />
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
              Không tìm thấy tài nguyên nào.
            </div>
          )
        )}

        {/* TAB 2: MẪU LAYER - Các asset layer xếp chồng đã lưu & tạo sẵn kèm ảnh xem trước */}
        {activeTab === 'presets' && (
          filteredComposites.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
              {filteredComposites.map((item) => (
                <CompositeCard
                  key={item.id}
                  item={item}
                  isBuiltin={builtinIds.has(item.id)}
                  onLoad={onLoadComposite}
                  onAppend={onAppendPresetLayers}
                  onDelete={handleDeleteComposite}
                />
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
              Không có mẫu layer nào. Bạn có thể nhấn &quot;Lưu mẫu&quot; ở thanh tiêu đề để lưu mẫu mới vào đây!
            </div>
          )
        )}

        {/* TAB 3: DỰ ÁN - Các layer đang tạo trong mẫu hiện tại */}
        {activeTab === 'project' && (
          filteredLayers.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
              {filteredLayers.map((layer) => {
                const isSelected = selectedLayerId === layer.id
                return (
                  <LayerItemCard
                    key={layer.id}
                    layer={layer}
                    isSelected={isSelected}
                    onSelect={() => onSelectLayer?.(layer.id)}
                  />
                )
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '30px 14px',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: '11px',
                lineHeight: 1.5
              }}
            >
              {currentLayers.length === 0 ? (
                <>
                  Chưa có layer nào trong mẫu này.
                  <br />
                  <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                    Hãy chọn ảnh từ tab <strong>Có sẵn</strong> để bắt đầu xếp lớp!
                  </span>
                </>
              ) : (
                'Không tìm thấy layer nào khớp với từ khóa tìm kiếm.'
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

/** Card hiển thị Layer đang có trong mẫu (Tab Dự án) */
function LayerItemCard({
  layer,
  isSelected,
  onSelect
}: {
  layer: AssembledLayerItem
  isSelected: boolean
  onSelect: () => void
}) {
  const assetUrl = useLayerAssetImage(layer.assetPath)
  const displayUrl = layer.imageUrl || assetUrl

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'layer', layer }))
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--accent) 15%, var(--bg-1))' : 'var(--bg-1)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-soft)'}`,
        borderRadius: '4px',
        padding: '5px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}
      title={`Click để chọn: ${layer.name} (Z: ${layer.z}px)`}
    >
      <div
        style={{
          height: '75px',
          width: '100%',
          minWidth: 0,
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '3px',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={layer.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
        )}
        <span
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '3px',
            fontSize: '8.5px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '1px 3px',
            borderRadius: '2px'
          }}
        >
          Z:{layer.z}
        </span>
      </div>

      <span
        style={{
          fontSize: '10px',
          color: isSelected ? 'var(--accent)' : 'var(--text)',
          fontWeight: isSelected ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          width: '100%',
          minWidth: 0
        }}
        title={layer.name}
      >
        {layer.name}
      </span>
    </div>
  )
}

/** Card hiển thị Tài nguyên mẫu hoặc Ảnh người dùng thêm vào (Tab Có sẵn) */
function AssetCard({
  item,
  onAdd,
  onDelete
}: {
  item: { path: string; name: string; isCustom: boolean }
  onAdd: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const assetUrl = useLayerAssetImage(item.isCustom ? '' : item.path)
  const displayUrl = item.isCustom ? item.path : assetUrl

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({
            type: 'asset',
            name: item.name,
            path: item.path,
            url: item.isCustom ? item.path : (displayUrl || undefined)
          })
        )
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd()
        }
      }}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: '4px',
        padding: '5px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}
      title={`Click hoặc Kéo thả để thêm ${item.name} làm layer mới`}
    >
      {/* 2 button ở góc phải của item: (+) Thêm layer và (Thùng rác) Xóa layer */}
      <div
        style={{
          position: 'absolute',
          top: '3px',
          right: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          zIndex: 5
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Button (+) Thêm layer */}
        <button
          type="button"
          className="btn xs icon"
          style={{
            width: '18px',
            height: '18px',
            padding: 0,
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '3px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'transform 0.1s ease, filter 0.1s ease'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          title={`Thêm ${item.name} làm layer mới (+) vào cảnh`}
        >
          <IconPlus width={11} height={11} />
        </button>

        {/* Button Thùng rác Xoá layer */}
        <button
          type="button"
          className="btn xs icon"
          style={{
            width: '18px',
            height: '18px',
            padding: 0,
            background: 'color-mix(in srgb, var(--bg-0) 80%, transparent)',
            color: 'var(--text-dim)',
            borderRadius: '3px',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'color 0.15s ease, border-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--danger, #ef4444)'
            e.currentTarget.style.borderColor = 'var(--danger, #ef4444)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)'
            e.currentTarget.style.borderColor = 'var(--line-soft)'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(e)
          }}
          title={`Xóa ${item.name} khỏi danh sách có sẵn`}
        >
          <IconTrash width={10} height={10} />
        </button>
      </div>

      <div
        style={{
          height: '75px',
          width: '100%',
          minWidth: 0,
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '3px',
          boxSizing: 'border-box'
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={item.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
        )}
      </div>

      <span
        style={{
          fontSize: '10px',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          width: '100%',
          minWidth: 0
        }}
        title={item.name}
      >
        {item.name}
      </span>
    </div>
  )
}
