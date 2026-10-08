import { useEffect, useMemo, useState } from 'react'
import type { Face3D, Model3D } from './types'
import { fetchDiskModels3D, getStoredModels3D } from './models3dStorage'
import { appendModel, appendModelOnFace } from './assemblyCompose'
import { IconCube, IconPlus, IconSearch } from '../../icons'
import '../../../styles/assemblyModelLib.css'
import {
  COTTAGE_THUMBNAIL,
  CUBE_THUMBNAIL,
  CORNER_THUMBNAIL,
  ROOM_THUMBNAIL
} from './templateThumbnails'

interface AssemblyModelLibraryTabProps {
  currentModel: Model3D
  selectedFace: Face3D | null
  onApplyFaces: (faces: Face3D[], selectId: string | null) => void
}

const CATEGORY_CHIPS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'decor', label: 'Trang trí' },
  { id: 'nature', label: 'Thiên nhiên' },
  { id: 'architecture', label: 'Khung nhà' },
  { id: 'props', label: 'Đồ vật' }
]

export function AssemblyModelLibraryTab({
  currentModel,
  selectedFace,
  onApplyFaces
}: AssemblyModelLibraryTabProps) {
  const [library, setLibrary] = useState<Model3D[]>(() => getStoredModels3D())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    let alive = true
    fetchDiskModels3D().then((list) => {
      if (alive && Array.isArray(list) && list.length > 0) {
        setLibrary(list)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .filter((m) => m.id !== currentModel.id && m.faces && m.faces.length > 0)
      .filter((m) => category === 'all' || m.category === category)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q)))
      .sort((a, b) => {
        // Ưu tiên decor và nature lên đầu
        const prio = (cat?: string) => (cat === 'decor' ? 3 : cat === 'nature' ? 2 : 1)
        return prio(b.category) - prio(a.category)
      })
  }, [library, currentModel.id, category, query])

  const handleMountOnFace = (part: Model3D) => {
    if (!selectedFace) return
    const res = appendModelOnFace(part, currentModel, selectedFace, { uv: [0.5, 0.5] })
    onApplyFaces(res.faces, res.addedIds[0] ?? null)
  }

  const handleAppendBeside = (part: Model3D) => {
    const res = appendModel(part, currentModel)
    onApplyFaces(res.faces, res.addedIds[0] ?? null)
  }

  return (
    <div className="assembly-model-lib-tab">
      {/* Search Input */}
      <div className="model-lib-search-box">
        <IconSearch width={12} height={12} className="search-icon" />
        <input
          type="search"
          className="model-lib-search-input"
          placeholder="Tìm mô hình 3D đã lưu..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Category Chips */}
      <div className="model-lib-chips" role="tablist">
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`model-lib-chip${category === chip.id ? ' active' : ''}`}
            onClick={() => setCategory(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Selected Face Hint */}
      <div className="model-lib-mount-banner">
        {selectedFace ? (
          <span className="banner-text">
            Mặt đang chọn: <b>{selectedFace.name}</b>
          </span>
        ) : (
          <span className="banner-text dim">Chọn 1 mặt để gắn bộ phận lên mặt đó</span>
        )}
      </div>

      {/* Model Cards List */}
      <div className="model-lib-list">
        {filtered.map((m) => {
          const thumb =
            m.thumbnailDataUrl ||
            (m.id === 'model-tudor-cottage' ? COTTAGE_THUMBNAIL : null) ||
            (m.id === 'model-cubic-box' ? CUBE_THUMBNAIL : null) ||
            (m.id === 'model-l-corner' ? CORNER_THUMBNAIL : null) ||
            (m.id === 'model-room-interior' ? ROOM_THUMBNAIL : null) ||
            m.thumbnail

          return (
            <div key={m.id} className="model-lib-item">
              <div className="model-lib-thumb-box">
                {thumb ? (
                  <img src={thumb} alt={m.name} className="model-lib-thumb-img" />
                ) : (
                  <IconCube width={24} height={24} className="model-lib-thumb-icon" />
                )}
                <span className="model-lib-face-tag">{m.faces.length} mặt</span>
              </div>
              <div className="model-lib-info">
                <div className="model-lib-name" title={m.name}>
                  {m.name}
                </div>
                <div className="model-lib-actions">
                  <button
                    type="button"
                    className="model-lib-btn primary"
                    disabled={!selectedFace}
                    onClick={() => handleMountOnFace(m)}
                    title={
                      selectedFace
                        ? `Gắn lên mặt "${selectedFace.name}"`
                        : 'Vui lòng click chọn 1 mặt trong không gian 3D để gắn'
                    }
                  >
                    <IconPlus width={10} height={10} />
                    <span>Gắn lên mặt</span>
                  </button>
                  <button
                    type="button"
                    className="model-lib-btn secondary"
                    onClick={() => handleAppendBeside(m)}
                    title="Đặt cạnh mô hình hiện tại (chân bằng nhau)"
                  >
                    <span>Đặt cạnh</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="model-lib-empty">
            <IconCube width={28} height={28} />
            <p>Không có mô hình 3D nào phù hợp.</p>
            <p className="sub">Hãy lưu các bộ phận 3D (cửa sổ, ống khói, bụi cây...) rồi chọn tại đây để ghép nối!</p>
          </div>
        )}
      </div>
    </div>
  )
}
