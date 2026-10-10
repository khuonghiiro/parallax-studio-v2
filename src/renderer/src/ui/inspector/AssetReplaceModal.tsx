import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BuiltInAssetCategory, BuiltInAssetItem, BuiltInCatalogResult } from '@shared/ipc'
import { importBuiltInAsset, replaceLayerAsset } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { IconCheck, IconFolder, IconImage, IconPlus, IconSearch, IconX } from '../icons'
import { BuiltInAssetBar } from '../assets/BuiltInAssetBar'
import { BuiltInAssetGrid } from '../assets/BuiltInAssetGrid'
import { sortAssetCategories } from '../assets/types'
import { getVisiblePublicAssets } from '../assets/publicAssetStorage'

interface AssetReplaceModalProps {
  layerId: string
  currentAssetId: string
  layerName: string
  onClose: () => void
}

type ModalTab = 'builtin' | 'project'

/**
 * Modal to quickly replace the source image asset of an image layer.
 * Displays the full Built-in asset library with vertical category tabs, live search box,
 * project assets tab, and direct disk import.
 * Preserves 100% of 3D transforms, Z-depth, keyframes, in/out points, and effects.
 */
export function AssetReplaceModal({
  layerId,
  currentAssetId,
  layerName,
  onClose
}: AssetReplaceModalProps) {
  const projectAssets = useEditor((s) => s.project.assets)
  const imageProjectAssets = useMemo(() => projectAssets.filter((a) => a.kind === 'image'), [projectAssets])
  const [tab, setTab] = useState<ModalTab>('builtin')

  // Built-in library catalog state
  const [catalog, setCatalog] = useState<BuiltInCatalogResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [publicVersion, setPublicVersion] = useState(0)

  useEffect(() => {
    const handlePubChange = () => setPublicVersion((v) => v + 1)
    window.addEventListener('publicAssets:changed', handlePubChange)
    return () => window.removeEventListener('publicAssets:changed', handlePubChange)
  }, [])

  // Project assets search state
  const [projectSearch, setProjectSearch] = useState('')

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.getBuiltInCatalog()
      setCatalog(res)
    } catch (err) {
      console.error('[AssetReplaceModal] Error loading built-in catalog:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // ESC key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const categories = useMemo<BuiltInAssetCategory[]>(() => {
    const list = catalog?.categories ?? [
      { id: 'all', folder: '', title: 'Tất cả tài nguyên', icon: 'all', order: 0 }
    ]
    return sortAssetCategories(list)
  }, [catalog])

  // Filter only images for replacing an image layer (excluding deleted/hidden ones)
  const builtInItems = useMemo<BuiltInAssetItem[]>(() => {
    const raw = (catalog?.items ?? []).filter((it) => it.kind === 'image')
    return getVisiblePublicAssets(raw)
  }, [catalog, publicVersion])

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: builtInItems.length }
    categories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = builtInItems.filter((it) => cat.folder && it.folder === cat.folder).length
      }
    })
    return counts
  }, [categories, builtInItems])

  const handleOpenFolder = () => {
    const cat = categories.find((c) => c.id === selectedCategory)
    window.api.openBuiltInFolder(cat?.folder)
  }

  // Handle choosing a built-in asset
  const handleSelectBuiltIn = async (item: BuiltInAssetItem) => {
    try {
      setLoading(true)
      const assetId = await importBuiltInAsset(item, false)
      if (assetId) {
        replaceLayerAsset(layerId, assetId)
        onClose()
      }
    } catch (err) {
      console.error('Error replacing with built-in asset:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle choosing an existing project asset
  const handleSelectProjectAsset = (assetId: string) => {
    if (assetId === currentAssetId) {
      onClose()
      return
    }
    replaceLayerAsset(layerId, assetId)
    onClose()
  }

  // Handle uploading directly from computer disk
  const handleUploadFromDisk = async () => {
    try {
      setLoading(true)
      const files = await window.api.openFiles('image')
      if (!files || files.length === 0) {
        setLoading(false)
        return
      }
      const f = files[0]
      const asset = await assetStore.add(f.name, f.mime, f.data, 'image')
      useEditor.getState().update((d) => {
        d.assets.push(asset.meta)
      })
      replaceLayerAsset(layerId, asset.meta.id)
      onClose()
    } catch (err) {
      console.error('Error uploading image file:', err)
      setLoading(false)
    }
  }

  // Filtered project assets
  const filteredProjectAssets = useMemo(() => {
    if (!projectSearch.trim()) return imageProjectAssets
    const q = projectSearch.trim().toLowerCase()
    return imageProjectAssets.filter((a) => a.name.toLowerCase().includes(q))
  }, [imageProjectAssets, projectSearch])

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1200 }}
    >
      <div
        className="modal wide"
        role="dialog"
        aria-labelledby="replace-asset-title"
        style={{
          width: '92vw',
          maxWidth: 960,
          height: '84vh',
          maxHeight: 740,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          className="modal-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0
          }}
        >
          <div>
            <h2 id="replace-asset-title" style={{ fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span>🖼</span> Đổi ảnh cho layer: <span style={{ color: 'var(--accent-cyan)' }}>{layerName}</span>
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
              Giữ nguyên 100% vị trí 3D, độ sâu Z, góc xoay, tỷ lệ scale, keyframes và các hiệu ứng đã gắn.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn sm accent"
              onClick={handleUploadFromDisk}
              disabled={loading}
              title="Mở hộp thoại chọn tệp ảnh mới từ máy tính"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <IconPlus width={12} height={12} />
              <span>{loading ? 'Đang đọc...' : 'Tải ảnh từ máy tính...'}</span>
            </button>
            <button type="button" className="btn icon ghost sm" onClick={onClose} title="Đóng (Esc)">
              <IconX width={14} height={14} />
            </button>
          </div>
        </div>

        {/* Subtabs switcher */}
        <div
          className="asset-subtabs"
          style={{
            margin: 0,
            padding: '6px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg-1)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            className={`asset-subtab-btn${tab === 'builtin' ? ' active' : ''}`}
            onClick={() => setTab('builtin')}
          >
            <IconFolder width={13} height={13} />
            <span>Thư viện mẫu</span>
            <span className="asset-subtab-badge">{builtInItems.length}</span>
          </button>
          <button
            type="button"
            className={`asset-subtab-btn${tab === 'project' ? ' active' : ''}`}
            onClick={() => setTab('project')}
          >
            <IconImage width={13} height={13} />
            <span>Trong dự án</span>
            <span className="asset-subtab-badge">{imageProjectAssets.length}</span>
          </button>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {tab === 'builtin' ? (
            <div className="asset-main-layout asset-replace-builtin" style={{ width: '100%', height: '100%' }}>
              <BuiltInAssetBar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                itemCounts={itemCounts}
                onOpenFolder={handleOpenFolder}
              />
              <BuiltInAssetGrid
                categories={categories}
                items={builtInItems}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectItem={handleSelectBuiltIn}
                onReload={loadCatalog}
                loading={loading}
                actionIcon={<IconCheck width={14} height={14} />}
                actionTitle="Chọn đổi sang ảnh này"
                className="modal-grid"
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className="asset-search-row" style={{ flex: 1, maxWidth: 360 }}>
                  <IconSearch className="asset-search-icon" />
                  <input
                    type="text"
                    className="asset-search-input"
                    placeholder="Tìm ảnh trong dự án..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                  />
                  {projectSearch && (
                    <button
                      type="button"
                      className="btn sm icon ghost asset-search-clear"
                      onClick={() => setProjectSearch('')}
                      title="Xóa tìm kiếm"
                    >
                      <IconX width={12} height={12} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Hiển thị <b>{filteredProjectAssets.length}</b>/{imageProjectAssets.length} ảnh
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                  gap: 12,
                  alignContent: 'start',
                  paddingRight: 4
                }}
              >
                {filteredProjectAssets.length === 0 ? (
                  <div className="empty" style={{ gridColumn: '1 / -1', padding: '40px 16px', textAlign: 'center' }}>
                    Chưa có ảnh nào phù hợp trong dự án.
                  </div>
                ) : (
                  filteredProjectAssets.map((a) => {
                    const rt = assetStore.get(a.id)
                    const isCurrent = a.id === currentAssetId
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleSelectProjectAsset(a.id)}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: 8,
                          borderRadius: 'var(--radius)',
                          background: isCurrent ? 'var(--bg-3)' : 'var(--bg-2)',
                          border: isCurrent ? '2px solid var(--accent-cyan)' : '1px solid var(--line)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.background = 'var(--bg-3)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.borderColor = 'var(--line)'
                            e.currentTarget.style.background = 'var(--bg-2)'
                          }
                        }}
                        title={`${a.name} (${a.width}×${a.height})\nBấm để đổi sang ảnh này`}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: 96,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-1)',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            marginBottom: 6
                          }}
                        >
                          {rt?.thumbUrl ? (
                            <img
                              src={rt.thumbUrl}
                              alt={a.name}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: 24 }}>🖼</span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text)',
                            textAlign: 'center',
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {a.name}
                        </span>

                        <span style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: 2 }}>
                          {a.width}×{a.height}
                        </span>

                        {isCurrent && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 5,
                              right: 5,
                              background: 'var(--accent-cyan)',
                              color: '#000',
                              fontWeight: 700,
                              fontSize: '9px',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                            }}
                          >
                            Đang dùng
                          </span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-foot"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg-1)',
            flexShrink: 0
          }}
        >
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
