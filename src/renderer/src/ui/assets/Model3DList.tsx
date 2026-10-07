import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Asset3DsCategory } from '@shared/ipc'
import type { Model3D } from './models3d/types'
import {
  getStoredModels3D,
  fetchDiskModels3D,
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
import { IconCube, IconPlus, IconPen, IconTrash } from '../icons'

const DEFAULT_CATEGORIES: Asset3DsCategory[] = [
  { id: 'all', title: 'Tất cả mô hình', icon: 'all', order: 0 },
  { id: 'architecture', title: 'Kiến trúc & Nhà cửa', icon: 'home', order: 1 },
  { id: 'props', title: 'Đạo cụ & Khối hộp', icon: 'cube', order: 2 },
  { id: 'street', title: 'Đường phố & Góc cảnh', icon: 'city', order: 3 },
  { id: 'room', title: 'Nội thất & Căn phòng', icon: 'image', order: 4 },
  { id: 'custom', title: 'Tùy biến & Tự tạo', icon: 'sparkles', order: 5 }
]

export function Model3DList() {
  const [categories, setCategories] = useState<Asset3DsCategory[]>(DEFAULT_CATEGORIES)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [models, setModels] = useState<Model3D[]>(() => getStoredModels3D())
  const [searchTerm, setSearchTerm] = useState('')
  const [activeEditingModel, setActiveEditingModel] = useState<Model3D | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false)
  const [insertingId, setInsertingId] = useState<string | null>(null)

  const reload = useCallback(() => {
    fetchAsset3DsCatalog().then(({ categories: catList, models: diskModels }) => {
      if (catList && catList.length > 0) {
        setCategories(catList)
      }
      if (diskModels && diskModels.length > 0) {
        setModels(diskModels)
      }
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Count items per category
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: models.length }
    categories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = models.filter((m) => m.category === cat.id).length
      }
    })
    return counts
  }, [categories, models])

  // Filter models by selected category and search term
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

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc muốn xóa mô hình 3D này không?')) {
      deleteModel3D(id)
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
    const ok = await saveAsset3DsManifest(jsonContent)
    if (ok) {
      reload()
    }
    return ok
  }

  const manifestJsonString = useMemo(() => {
    return JSON.stringify({ categories }, null, 2)
  }, [categories])

  return (
    <div className="model-3d-layout">
      {/* Vertical Category Strip */}
      <Model3DCategoryBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        itemCounts={itemCounts}
        onOpenFolder={handleOpenFolder}
        onOpenManifestModal={() => setIsManifestModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="model-3d-content">
        {/* Top Header */}
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
          <button
            type="button"
            className="btn sm primary create-3d-btn"
            onClick={() => setIsCreateModalOpen(true)}
            title="Mở thư viện khung mẫu 3D có ảnh trực quan để chọn và chỉnh sửa"
          >
            <IconPlus width={13} height={13} />
            <span>Tạo 3D</span>
          </button>
        </div>

        {/* Model Cards Grid */}
        <div className="model-3d-grid">
          {filtered.map((m) => {
            // Resolve review thumbnail with fallbacks
            const thumb =
              m.thumbnailDataUrl ||
              (m.id === 'model-tudor-cottage' ? COTTAGE_THUMBNAIL : null) ||
              (m.id === 'model-cubic-box' ? CUBE_THUMBNAIL : null) ||
              (m.id === 'model-l-corner' ? CORNER_THUMBNAIL : null) ||
              (m.id === 'model-room-interior' || m.id === 'model-open-room' ? ROOM_THUMBNAIL : null) ||
              m.thumbnail

            return (
              <div key={m.id} className="model-3d-card">
                {/* Review Image Preview with 3D Badge on Top-Left and Action Icons on Top-Right */}
                <div className="model-3d-card-thumb">
                  {/* Badge góc trái có chữ 3D */}
                  <div className="model-3d-badge">3D</div>

                  {thumb ? (
                    <img src={thumb} alt={m.name} className="model-3d-thumb-img" />
                  ) : (
                    <div className="model-3d-thumb-placeholder">
                      <IconCube width={32} height={32} />
                      <span>3D Mesh</span>
                    </div>
                  )}

                  {/* Icon Edit và Icon Add ở góc phải */}
                  <div className="model-3d-card-actions-top">
                    <button
                      type="button"
                      className="icon-action-btn edit-btn"
                      onClick={() => setActiveEditingModel(m)}
                      title="Chỉnh sửa mô hình 3D trong Xưởng Lắp Ráp"
                    >
                      <IconPen width={13} height={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn add-btn"
                      onClick={() => handleInsert(m)}
                      disabled={insertingId === m.id}
                      title="Thêm mô hình 3D vào phân cảnh (+)"
                    >
                      <IconPlus width={15} height={15} />
                    </button>
                  </div>
                </div>

                {/* Card Meta Information (Bỏ mô tả để tiết kiệm diện tích) */}
                <div className="model-3d-card-body">
                  <div className="card-title-row">
                    <span className="card-title" title={m.name}>
                      {m.name}
                    </span>
                  </div>
                  <div className="card-sub-badges">
                    <span className="faces-badge">{m.faces.length} mặt phẳng</span>
                    {m.category && <span className="cat-badge">{m.category}</span>}
                  </div>
                </div>

                {/* Secondary Actions (Duplicate / Delete) */}
                <div className="card-footer-actions">
                  <button
                    type="button"
                    className="btn xs ghost"
                    onClick={() => handleDuplicate(m.id)}
                    title="Tạo bản sao mô hình này"
                  >
                    Nhân bản
                  </button>
                  {models.length > 1 && (
                    <button
                      type="button"
                      className="btn xs ghost danger"
                      onClick={() => handleDelete(m.id)}
                      title="Xóa mô hình này"
                    >
                      <IconTrash width={11} height={11} />
                    </button>
                  )}
                  <span style={{ flex: 1 }} />
                  <span className="hint-scale">Chỉnh scale ở cột phải</span>
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

      {/* Visual Template Picker Modal (Nút Tạo 3D hiện ảnh để dễ nhìn và chỉnh) */}
      <Create3DModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSelectTemplate={(templateModel) => {
          setIsCreateModalOpen(false)
          setActiveEditingModel(templateModel)
        }}
      />

      {/* Assembly 3D Studio Dialog */}
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

      {/* Manifest Configuration Modal for asset-3ds/manifest.json */}
      <AssetCatalogModal
        isOpen={isManifestModalOpen}
        onClose={() => setIsManifestModalOpen(false)}
        initialJson={manifestJsonString}
        onSave={handleSaveManifest}
        onOpenFolder={handleOpenFolder}
        title="Cấu hình Chủ đề Mô hình 3D (asset-3ds/manifest.json)"
        description="Định nghĩa các danh mục chủ đề phân loại mô hình 3D (Kiến trúc, Đạo cụ, Đường phố, Căn phòng, Tùy biến)."
        folderLabel="Mở thư mục asset-3ds"
        sampleTemplate={`{\n  "categories": [\n    {\n      "id": "all",\n      "title": "Tất cả mô hình",\n      "icon": "all",\n      "order": 0\n    },\n    {\n      "id": "architecture",\n      "title": "Kiến trúc & Nhà cửa",\n      "icon": "home",\n      "order": 1\n    },\n    {\n      "id": "props",\n      "title": "Đạo cụ & Khối hộp",\n      "icon": "cube",\n      "order": 2\n    }\n  ]\n}`}
      />
    </div>
  )
}
