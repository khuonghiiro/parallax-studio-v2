import { useEffect, useState, useMemo } from 'react'
import type { BuiltInAssetItem, PickedFile } from '@shared/ipc'
import type { Face3D } from './types'
import { IconImage, IconPlus, IconCheck, IconCube } from '../../icons'

interface AssemblyAssetSidebarProps {
  selectedFace: Face3D | null
  onAssignAssetToFace: (assetPath: string, width?: number, height?: number) => void
  modelFaces: Face3D[]
  onSelectFace: (faceId: string) => void
}

export function AssemblyAssetSidebar({
  selectedFace,
  onAssignAssetToFace,
  modelFaces,
  onSelectFace
}: AssemblyAssetSidebarProps) {
  const [assets, setAssets] = useState<BuiltInAssetItem[]>([])
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

  // Combine built-in assembly assets with custom user picked files
  const allItems = useMemo(() => {
    return [...customAssets, ...assets]
  }, [customAssets, assets])

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return allItems
    const q = searchTerm.toLowerCase()
    return allItems.filter(
      (it) => it.name.toLowerCase().includes(q) || it.fileName.toLowerCase().includes(q)
    )
  }, [allItems, searchTerm])

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
            relativePath: previewUrl, // Data / Blob URL
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

  return (
    <aside className="assembly-asset-sidebar" aria-label="Tài nguyên lắp ráp 3D">
      {/* Header */}
      <div className="assembly-sidebar-header">
        <div className="header-title-row">
          <IconImage width={14} height={14} />
          <span>Tài nguyên Lắp ráp</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn xs secondary"
            onClick={handlePickLocalImage}
            title="Nhập thêm ảnh texture từ máy tính để lắp ghép"
          >
            <IconPlus width={11} height={11} />
            <span>Thêm ảnh</span>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          className="input-text xs"
          placeholder="Lọc ảnh chi tiết..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Selected Face Hint */}
        <div className="selected-face-hint">
          {selectedFace ? (
            <>
              <span className="hint-label">Mặt đang chọn:</span>
              <span className="hint-name" title={selectedFace.name}>
                {selectedFace.name}
              </span>
            </>
          ) : (
            <span className="hint-none">Bấm chọn 1 mặt phẳng bên phải hoặc ở giữa</span>
          )}
        </div>
      </div>

      {/* Asset Items List */}
      <div className="assembly-sidebar-list">
        {filtered.map((item) => {
          const usedFaces = getUsedByFaces(item.relativePath)
          const isCurrentFaceUsing =
            selectedFace?.assetPath &&
            (selectedFace.assetPath === item.relativePath ||
              item.relativePath.endsWith(selectedFace.assetPath) ||
              selectedFace.assetPath.endsWith(item.relativePath))

          return (
            <div
              key={item.id}
              className={`assembly-asset-card${isCurrentFaceUsing ? ' active-for-face' : ''}`}
              onClick={() => onAssignAssetToFace(item.relativePath)}
              title={
                selectedFace
                  ? `Bấm để gán ảnh "${item.name}" cho mặt "${selectedFace.name}"`
                  : 'Bấm chọn 1 mặt phẳng trước khi gán ảnh'
              }
            >
              {/* Picture Thumbnail */}
              <div className="assembly-asset-thumb">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} />
                ) : (
                  <div className="thumb-placeholder">
                    <IconCube width={20} height={20} />
                  </div>
                )}
                {isCurrentFaceUsing && (
                  <div className="active-face-badge">
                    <IconCheck width={11} height={11} />
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="assembly-asset-meta">
                <span className="asset-meta-title" title={item.name}>
                  {item.name}
                </span>
                <span className="asset-meta-file" title={item.fileName}>
                  {item.fileName}
                </span>

                {/* Used badges */}
                {usedFaces.length > 0 && (
                  <div className="used-tags-row">
                    {usedFaces.map((f) => (
                      <span
                        key={f.id}
                        className={`used-tag${f.id === selectedFace?.id ? ' current' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectFace(f.id)
                        }}
                        title={`Bấm để chọn mặt ${f.name}`}
                      >
                        {f.name.split('.')[0] || f.name.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && !loading && (
          <div className="empty-sidebar-assets">
            <p>Không có ảnh phù hợp</p>
          </div>
        )}

        {loading && (
          <div className="empty-sidebar-assets">
            <p>Đang tải tài nguyên 3D...</p>
          </div>
        )}
      </div>
    </aside>
  )
}
