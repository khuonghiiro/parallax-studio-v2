import { useState, useMemo, useEffect, useRef } from 'react'
import type { BuiltInAssetItem } from '@shared/ipc'
import {
  getStoredComposites,
  deleteComposite,
  BUILTIN_COMPOSITES
} from './layerAssemblyStorage'
import type { AssembledLayerItem, LayerComposite } from './types'
import { IconGlobe, IconImage, IconInfo, IconLayers, IconLock, IconPlus, IconTrash, IconX } from '../icons'
import { useLayerAssetImage } from './useLayerAssetImage'
import { CompositeCard } from './CompositeCard'
import { LayerItemCard, AssetCard } from './LayerWorkshopCards'
import { AssetDetailModal } from '../assets/AssetDetailModal'
import { AssetDeleteConfirmModal } from '../assets/AssetDeleteConfirmModal'
import {
  getVisiblePublicAssets,
  addCustomPublicAsset,
  hideOrDeletePublicAsset
} from '../assets/publicAssetStorage'
import { clearLayerTextureCache } from './layerAssembly3DMesh'
import { SegmentedTabs } from '../primitives'
import '../../styles/assets.css'

export interface LayerAssemblySidebarProps {
  composite: LayerComposite
  selectedLayerId?: string | null
  onSelectLayer?: (id: string | null) => void
  onAddLayerFromAsset: (name: string, path: string, url?: string) => void
  onAppendPresetLayers: (layers: AssembledLayerItem[]) => void
  onDeleteLayer?: (layerId: string) => void
  onDuplicateLayer?: (layerId: string) => void
  onLoadComposite?: (composite: LayerComposite) => void
  width?: number
}

interface CustomAssetItem {
  id: string
  path: string
  name: string
  previewUrl?: string
  isCustom: boolean
}

// Danh sách tài nguyên công khai mặc định khi chạy môi trường test không có IPC
const BUILTIN_NATURE_ASSETS = [
  { path: 'demo_transparent/layer1_sky.png', name: 'Bầu trời hoàng hôn' },
  { path: 'demo_transparent/layer2_distant_mountains.png', name: 'Dãy núi sương mù xa xăm' },
  { path: 'demo_transparent/layer3_floating_island.png', name: 'Đảo đá bay tinh thể cổ đại' },
  { path: 'demo_transparent/layer4_ancient_ruins.png', name: 'Cổng vòm tàn tích rêu phong' },
  { path: 'demo_transparent/layer5_foreground_vines.png', name: 'Vòm dây leo & đom đóm' }
]

export function LayerAssemblySidebar({
  composite,
  selectedLayerId,
  onSelectLayer,
  onAddLayerFromAsset,
  onAppendPresetLayers,
  onDeleteLayer,
  onDuplicateLayer,
  onLoadComposite,
  width
}: LayerAssemblySidebarProps) {
  const [activeTab, setActiveTab] = useState<'builtin' | 'presets' | 'project'>('project')
  const [searchTerm, setSearchTerm] = useState('')
  const [storedComposites, setStoredComposites] = useState<LayerComposite[]>(getStoredComposites)
  const [detailTarget, setDetailTarget] = useState<CustomAssetItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomAssetItem | null>(null)
  const [catalogItems, setCatalogItems] = useState<BuiltInAssetItem[]>([])
  const [publicVersion, setPublicVersion] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const projectFileInputRef = useRef<HTMLInputElement | null>(null)

  // Lắng nghe thay đổi kho tài nguyên công khai
  useEffect(() => {
    const handlePublicChanged = () => {
      clearLayerTextureCache()
      setPublicVersion((v) => v + 1)
    }
    window.addEventListener('publicAssets:changed', handlePublicChanged)
    return () => window.removeEventListener('publicAssets:changed', handlePublicChanged)
  }, [])

  // Nạp toàn bộ kho tài nguyên có sẵn của hệ thống
  useEffect(() => {
    let active = true
    if (typeof window !== 'undefined' && window.api?.getBuiltInCatalog) {
      window.api
        .getBuiltInCatalog()
        .then((res) => {
          if (active && res?.items) {
            setCatalogItems(res.items.filter((it) => it.kind === 'image'))
          }
        })
        .catch(() => { })
    }
    return () => {
      active = false
    }
  }, [publicVersion])

  // Xử lý nạp ảnh riêng cho layer trong mẫu hiện tại (Private - lưu vào assets/uploads để không mất ảnh)
  const handleImportProjectLayerFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      try {
        const cleanName = file.name.replace(/\.[^/.]+$/, '')
        if (window.api?.importBuiltInAssetFile) {
          const buffer = new Uint8Array(await file.arrayBuffer())
          const res = await window.api.importBuiltInAssetFile({
            name: file.name,
            buffer,
            folder: 'uploads'
          })
          if (res.ok && res.relPath) {
            onAddLayerFromAsset(cleanName, res.relPath, res.item?.previewUrl)
            continue
          }
        }
        // Fallback đọc dataUrl nếu không có IPC
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          onAddLayerFromAsset(cleanName, dataUrl, dataUrl)
        }
        reader.readAsDataURL(file)
      } catch (err) {
        console.error('[LayerAssemblySidebar] Error importing project layer file:', err)
      }
    }
    e.target.value = ''
  }

  // Lắng nghe thay đổi kho mẫu composite (khi bấm "Lưu mẫu" ở Header)
  useEffect(() => {
    const handleChanged = () => setStoredComposites(getStoredComposites())
    window.addEventListener('layerComposites:changed', handleChanged)
    return () => window.removeEventListener('layerComposites:changed', handleChanged)
  }, [])

  // 1. Tab Có sẵn: Toàn bộ kho tài nguyên công khai (Built-in + Ảnh người dùng thêm công khai)
  const allAvailableAssets = useMemo(() => {
    const baseList: BuiltInAssetItem[] =
      catalogItems.length > 0
        ? catalogItems
        : BUILTIN_NATURE_ASSETS.map((b) => ({
          id: b.path,
          name: b.name,
          fileName: b.name,
          relativePath: b.path,
          path: b.path,
          folder: 'modular',
          ext: 'png',
          mime: 'image/png',
          kind: 'image' as const,
          size: 0
        }))

    const visiblePublic = getVisiblePublicAssets(baseList)
    return visiblePublic.map((it) => ({
      id: it.id,
      path: it.relativePath || it.path || '',
      name: it.name,
      previewUrl: it.previewUrl,
      isCustom: Boolean(it.id?.startsWith('custom-public-'))
    }))
  }, [catalogItems, publicVersion])

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

  // Xử lý nạp ảnh từ máy tính vào tab Có sẵn (Kho công khai - copy vào assets/uploads)
  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      try {
        if (window.api?.importBuiltInAssetFile) {
          const buffer = new Uint8Array(await file.arrayBuffer())
          await window.api.importBuiltInAssetFile({
            name: file.name,
            buffer,
            folder: 'uploads'
          })
        } else {
          const reader = new FileReader()
          reader.onload = () => {
            addCustomPublicAsset(file.name, reader.result as string, file.size, 'uploads')
            setPublicVersion((v) => v + 1)
          }
          reader.readAsDataURL(file)
        }
      } catch (err) {
        console.error('[LayerAssemblySidebar] Error importing public file:', err)
      }
    }
    e.target.value = ''
    try {
      const cat = await window.api.getBuiltInCatalog()
      setCatalogItems(cat.items || [])
    } catch {
      /* ignore */
    }
    setPublicVersion((v) => v + 1)
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
      className="layer-workshop-sidebar lw-sidebar" data-mcp-region="layer_assembly_sidebar"
      style={{
        ...(width !== undefined ? { width: `${width}px`, minWidth: '190px' } : {}),
        boxSizing: 'border-box',
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
      <SegmentedTabs<'builtin' | 'presets' | 'project'>
        variant="segmented"
        size="sm"
        ariaLabel="Nguồn tài nguyên xưởng layer"
        className="lw-sidebar-source-tabs"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: 'builtin',
            label: 'Tất cả',
            icon: <IconGlobe width={12} height={12} />,
            badge: allAvailableAssets.length,
            title: 'Kho ảnh & vật liệu có sẵn'
          },
          {
            id: 'presets',
            label: 'Mẫu sẵn',
            icon: <IconLayers width={12} height={12} />,
            badge: storedComposites.length,
            title: 'Kho mẫu asset layer xếp chồng đã lưu & tạo sẵn'
          },
          {
            id: 'project',
            label: 'Dự án',
            icon: <IconImage width={12} height={12} />,
            badge: currentLayers.length,
            title: 'Tài nguyên các layer đang tạo trong mẫu hiện tại'
          }
        ]}
      />

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

        {/* Nút Thêm ảnh từ máy khi ở tab Có sẵn (Kho công khai) */}
        {activeTab === 'builtin' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
              {allAvailableAssets.filter((a) => a.isCustom).length} ảnh tự thêm
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

        {/* Nút Thêm ảnh từ máy khi ở tab Dự án (Tài nguyên Private riêng cho mẫu này) */}
        {activeTab === 'project' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
              {currentLayers.length} layer riêng
            </span>
            <label
              className="btn xs"
              style={{
                padding: '2px 8px',
                fontSize: '10.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-3)',
                border: '1px solid var(--line)'
              }}
              title="Thêm ảnh layer riêng (Private) cho mẫu hiện tại, không đưa vào kho chung"
            >
              <IconPlus width={11} height={11} />
              <span>Thêm ảnh layer</span>
              <input
                ref={projectFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                multiple
                style={{ display: 'none' }}
                onChange={handleImportProjectLayerFiles}
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
            <div className="lw-sidebar-asset-grid">
              {filteredAssets.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  onAdd={() =>
                    onAddLayerFromAsset(
                      item.name,
                      item.path,
                      item.previewUrl || (item.path.startsWith('data:') ? item.path : undefined)
                    )
                  }
                  onDetail={() => setDetailTarget(item)}
                  onDelete={() => setDeleteTarget(item)}
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
            <div className="lw-sidebar-asset-grid">
              {filteredLayers.map((layer) => {
                const isSelected = selectedLayerId === layer.id
                return (
                  <LayerItemCard
                    key={layer.id}
                    layer={layer}
                    isSelected={isSelected}
                    onSelect={() => onSelectLayer?.(layer.id)}
                    onDelete={onDeleteLayer}
                    onDuplicate={onDuplicateLayer}
                    onDetail={(l) => {
                      setDetailTarget({
                        id: l.id,
                        name: l.name,
                        path: l.assetPath || l.imageUrl || '',
                        previewUrl: l.imageUrl,
                        isCustom: true
                      })
                    }}
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

      {detailTarget && (
        <AssetDetailModal
          target={{
            name: detailTarget.name,
            fileName: detailTarget.name,
            previewUrl: detailTarget.previewUrl || (detailTarget.path.startsWith('data:') ? detailTarget.path : undefined),
            assetPath: detailTarget.path.startsWith('data:') ? undefined : detailTarget.path,
            scope: 'public'
          }}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {deleteTarget && (
        <AssetDeleteConfirmModal
          target={{
            name: deleteTarget.name,
            fileName: deleteTarget.name,
            previewUrl: deleteTarget.previewUrl || (deleteTarget.path.startsWith('data:') ? deleteTarget.path : undefined),
            assetPath: deleteTarget.path.startsWith('data:') ? undefined : deleteTarget.path,
            scope: 'public'
          }}
          onClose={() => setDeleteTarget(null)}
          onConfirmDelete={() => {
            hideOrDeletePublicAsset({
              id: deleteTarget.id,
              relativePath: deleteTarget.path,
              path: deleteTarget.path,
              fileName: deleteTarget.name,
              isCustom: deleteTarget.isCustom
            })
            setPublicVersion((v) => v + 1)
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}
