import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Asset3DsCategory } from '@shared/ipc'
import type { Model3D } from './models3d/types'
import {
  getStoredModels3D,
  fetchAsset3DsCatalog,
  saveAsset3DsManifest,
  deleteModel3D,
  duplicateModel3D,
  saveModel3D
} from './models3d/models3dStorage'
import { insertModel3DToScene } from './models3d/insertModel3D'
import { Assembly3DDialog } from './models3d/Assembly3DDialog'
import { Create3DModal } from './models3d/Create3DModal'
import { Model3DCategoryBar } from './models3d/Model3DCategoryBar'
import { AssetCatalogModal } from './AssetCatalogModal'
import {
  COTTAGE_THUMBNAIL,
  CUBE_THUMBNAIL,
  CORNER_THUMBNAIL,
  ROOM_THUMBNAIL
} from './models3d/templateThumbnails'
import { IconCube, IconPlus, IconPen, IconTrash, IconCopy } from '../icons'
import { setCleanDragGhost } from '../utils/dragPreviewHelper'
import { getActiveCategoriesForModule, useAssetManifestStore } from '../../store/assetManifest'
import '../../styles/model3dLibrary.css'

export function Model3DList() {
  const manifestModules = useAssetManifestStore((s) => s.modules)
  const manifestCategories = useMemo(
    () => getActiveCategoriesForModule(manifestModules, 'model_3d'),
    [manifestModules]
  )

  const [diskCategories, setDiskCategories] = useState<Asset3DsCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [models, setModels] = useState<Model3D[]>(() => getStoredModels3D())
  const [searchTerm, setSearchTerm] = useState('')
  const [activeEditingModel, setActiveEditingModel] = useState<Model3D | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false)
  const [insertingId, setInsertingId] = useState<string | null>(null)

  const categories = useMemo<Asset3DsCategory[]>(() => {
    if (manifestCategories.length > 0) return manifestCategories
    return diskCategories
  }, [manifestCategories, diskCategories])

  const reload = useCallback(() => {
    fetchAsset3DsCatalog().then(({ categories: catList, models: diskModels }) => {
      if (catList && catList.length > 0) {
        setDiskCategories(catList)
      }
      if (Array.isArray(diskModels)) {
        setModels(diskModels)
      }
    })
  }, [])

  useEffect(() => {
    reload()
    const handleUpdate = () => reload()
    window.addEventListener('models3d:changed', handleUpdate)
    window.addEventListener('parallax:manifest-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    const handleOpenCreate = () => setIsCreateModalOpen(true)
    window.addEventListener('assembly:open', handleOpenCreate)
    return () => {
      window.removeEventListener('models3d:changed', handleUpdate)
      window.removeEventListener('parallax:manifest-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('assembly:open', handleOpenCreate)
    }
  }, [reload])

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: models.length }
    categories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = models.filter((m) => m.category === cat.id).length
      }
    })
    return counts
  }, [categories, models])

  const filtered = useMemo(() => {
    let list = models
    if (selectedCategory !== 'all') {
      list = list.filter((m) => m.category === selectedCategory)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    return list
  }, [models, selectedCategory, searchTerm])

  const handleInsert = async (model: Model3D) => {
    setInsertingId(model.id)
    try {
      await insertModel3DToScene({ model })
    } catch (err) {
      console.error('[Model3DList] Failed to insert 3D model:', err)
    } finally {
      setInsertingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc muốn xóa mô hình 3D này không?')) {
      setModels((prev) => prev.filter((m) => m.id !== id))
      await deleteModel3D(id)
      reload()
    }
  }

  const handleDuplicate = (id: string) => {
    duplicateModel3D(id)
    reload()
  }

  const handleOpenFolder = () => {
    if (window.api?.asset3ds?.openFolder) {
      window.api.asset3ds.openFolder()
    }
  }

  const handleSaveManifest = async (jsonContent: string): Promise<boolean> => {
    const res = await useAssetManifestStore.getState().saveModuleJson('model_3d', jsonContent)
    if (res.ok) {
      reload()
      return true
    }
    const ok = await saveAsset3DsManifest(jsonContent)
    if (ok) reload()
    return ok
  }

  const manifestJsonString = useMemo(() => {
    return manifestModules.model_3d?.rawJson || JSON.stringify({ categories }, null, 2)
  }, [manifestModules.model_3d, categories])

  return (
    <div className="model-3d-layout">
      <Model3DCategoryBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        itemCounts={itemCounts}
        onOpenFolder={handleOpenFolder}
        onOpenManifestModal={() => setIsManifestModalOpen(true)}
      />

      <div className="model-3d-content">
        <div className="model-3d-header">
          <div className="search-bar">
            <input
              type="text"
              className="input-text sm"
              placeholder="Tìm kiếm mô hình 3D..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="model-3d-grid">
          {filtered.map((m) => {
            const thumb =
              m.thumbnailDataUrl ||
              (m.id === 'model-tudor-cottage' ? COTTAGE_THUMBNAIL : null) ||
              (m.id === 'model-cubic-box' ? CUBE_THUMBNAIL : null) ||
              (m.id === 'model-l-corner' ? CORNER_THUMBNAIL : null) ||
              (m.id === 'model-room-interior' || m.id === 'model-open-room' ? ROOM_THUMBNAIL : null) ||
              m.thumbnail

            return (
              <div
                key={m.id}
                className="model-3d-card"
                title={`${m.name} — Nhấn giữ kéo thả vào cảnh hoặc bấm + Chèn`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-pxs-model3d', m.id)
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({ type: 'model3d', modelId: m.id, model: m })
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                  setCleanDragGhost(e, thumb)
                }}
              >
                <div
                  className="model-3d-card-thumb"
                  onClick={() => setActiveEditingModel(m)}
                  title="Nhấn đúp hoặc bấm Sửa để chỉnh sửa trong Xưởng Lắp Ráp"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="model-3d-badge-stack">
                    <div className="model-3d-badge">3D</div>
                    <div className="model-3d-faces-badge">{m.faces.length} mặt</div>
                  </div>

                  {thumb ? (
                    <img src={thumb} alt={m.name} className="model-3d-thumb-img" />
                  ) : (
                    <div className="model-3d-thumb-placeholder">
                      <IconCube width={28} height={28} />
                      <span>3D Mesh</span>
                    </div>
                  )}
                </div>

                <div className="model-3d-card-body">
                  <span className="card-title" title={m.name}>
                    {m.name}
                  </span>
                  {m.category && (
                    <div className="card-meta-row">
                      <span className="cat-badge">{m.category}</span>
                    </div>
                  )}
                </div>

                <div className="model-3d-card-actions">
                  <button
                    type="button"
                    className="la-icon-btn la-icon-btn--bordered la-icon-btn--edit"
                    onClick={() => setActiveEditingModel(m)}
                    title="Chỉnh sửa mô hình 3D trong Xưởng Lắp Ráp"
                    aria-label="Chỉnh sửa"
                  >
                    <IconPen width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    className="la-icon-btn la-icon-btn--bordered la-icon-btn--danger"
                    onClick={() => handleDelete(m.id)}
                    title="Xóa mô hình này"
                    aria-label="Xóa"
                  >
                    <IconTrash width={12} height={12} />
                  </button>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="empty-state">
              <IconCube width={32} height={32} />
              <p>Không có mô hình 3D nào trong chủ đề này</p>
            </div>
          )}
        </div>
      </div>

      <Create3DModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSelectTemplate={(templateModel) => {
          setIsCreateModalOpen(false)
          setActiveEditingModel(templateModel)
        }}
      />

      {activeEditingModel && (
        <Assembly3DDialog
          isOpen={true}
          initialModel={activeEditingModel}
          onClose={() => setActiveEditingModel(null)}
          onSaved={(updated) => {
            saveModel3D(updated)
            reload()
            setActiveEditingModel(null)
          }}
        />
      )}

      <AssetCatalogModal
        isOpen={isManifestModalOpen}
        onClose={() => setIsManifestModalOpen(false)}
        initialJson={manifestJsonString}
        onSave={handleSaveManifest}
        onOpenFolder={handleOpenFolder}
        title="Cấu hình Chủ đề Mô hình 3D (manifests/model-3d.json)"
        description="Định nghĩa các danh mục chủ đề phân loại mô hình 3D (Kiến trúc, Đạo cụ, Nội thất, Phương tiện, Thiên nhiên, Tùy biến)."
        folderLabel="Mở thư mục asset-3ds"
      />
    </div>
  )
}
