import { useState, useMemo, useEffect, useCallback } from 'react'
import type { LayerComposite } from './types'
import {
  getStoredComposites,
  saveComposite,
  deleteComposite,
  duplicateComposite,
  updateCompositeThumbnail,
  restoreDefaultComposites,
  COMPOSITE_CATEGORIES
} from './layerAssemblyStorage'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { LayerAssemblyDialog } from './LayerAssemblyDialog'
import { LayerAssemblyCategoryBar } from './LayerAssemblyCategoryBar'
import { IconPlus, IconPen, IconTrash, IconCopy, IconLayers } from '../icons'
import { consumePendingOpenLayerAssembly } from './layerAssemblyBridge'
import '../../styles/model3dLibrary.css'
import '../../styles/layerAssembly.css'

export function LayerAssemblyList() {
  const [composites, setComposites] = useState<LayerComposite[]>(() => getStoredComposites())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [insertingId, setInsertingId] = useState<string | null>(null)

  const reload = useCallback(() => {
    setComposites(getStoredComposites())
  }, [])

  useEffect(() => {
    const pending = consumePendingOpenLayerAssembly()
    if (pending) {
      if (pending.compositeId) {
        const found = getStoredComposites().find((c) => c.id === pending.compositeId)
        setEditingComposite(found || null)
      } else {
        setEditingComposite(null)
      }
      setIsDialogOpen(true)
    }
  }, [])

  useEffect(() => {
    const handleUpdate = () => reload()
    const handleOpenReq = (e: Event) => {
      const customEvent = e as CustomEvent<{ compositeId?: string }>
      const targetId = customEvent.detail?.compositeId
      if (targetId) {
        const found = getStoredComposites().find((c) => c.id === targetId)
        setEditingComposite(found || null)
      } else {
        setEditingComposite(null)
      }
      setIsDialogOpen(true)
    }
    const handleCloseReq = () => {
      setIsDialogOpen(false)
      setEditingComposite(null)
    }

    window.addEventListener('layerComposites:changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    window.addEventListener('layerAssembly:open', handleOpenReq)
    window.addEventListener('layerAssembly:close', handleCloseReq)
    return () => {
      window.removeEventListener('layerComposites:changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('layerAssembly:open', handleOpenReq)
      window.removeEventListener('layerAssembly:close', handleCloseReq)
    }
  }, [reload])

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: composites.length }
    COMPOSITE_CATEGORIES.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = composites.filter((c) => c.category === cat.id).length
      }
    })
    return counts
  }, [composites])

  const filtered = useMemo(() => {
    let list = composites
    if (selectedCategory !== 'all') {
      list = list.filter((c) => c.category === selectedCategory)
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      )
    }
    return list
  }, [composites, selectedCategory, searchTerm])

  const handleCreateNew = () => {
    setEditingComposite(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (comp: LayerComposite) => {
    setEditingComposite(comp)
    setIsDialogOpen(true)
  }

  const handleInsert = async (comp: LayerComposite) => {
    setInsertingId(comp.id)
    try {
      await insertLayerCompositeToScene({ composite: comp })
    } catch (err) {
      console.error('[LayerAssemblyList] Failed to insert composite:', err)
    } finally {
      setInsertingId(null)
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa chi tiết lắp ráp "${name}" không?`)) {
      deleteComposite(id)
      reload()
    }
  }

  const handleDuplicate = (id: string) => {
    duplicateComposite(id)
    reload()
  }

  const handleRestoreDefaults = () => {
    if (window.confirm('Khôi phục lại tất cả các mẫu layer có sẵn (built-in) về trạng thái ban đầu?')) {
      restoreDefaultComposites()
      reload()
    }
  }

  return (
    <div className="model-3d-layout">
      {/* 1. Left Vertical Category Strip */}
      <LayerAssemblyCategoryBar
        categories={COMPOSITE_CATEGORIES}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        itemCounts={itemCounts}
        onCreateNew={handleCreateNew}
      />

      {/* 2. Main Content Area */}
      <div className="model-3d-content">
        {/* Header Search */}
        <div className="model-3d-header">
          <div className="search-bar">
            <input
              type="text"
              className="input-text sm"
              placeholder="Tìm kiếm chi tiết lắp ráp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* 2-column Grid of Layer Composite Cards */}
        <div className="model-3d-grid">
          {filtered.map((item) => (
            <LayerCardItem
              key={item.id}
              item={item}
              isInserting={insertingId === item.id}
              onInsert={() => handleInsert(item)}
              onEdit={() => handleEdit(item)}
              onDuplicate={() => handleDuplicate(item.id)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11.5px' }}>
              <div style={{ marginBottom: '8px', opacity: 0.5 }}>
                <IconLayers width={32} height={32} />
              </div>
              <div style={{ marginBottom: '10px' }}>Không tìm thấy chi tiết lắp ráp phù hợp.</div>
              <button
                type="button"
                className="btn sm"
                onClick={handleRestoreDefaults}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                title="Khôi phục lại các mẫu có sẵn nếu bạn đã từng xóa"
              >
                Khôi phục mẫu có sẵn
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Workshop Modal */}
      {isDialogOpen && (
        <LayerAssemblyDialog
          initialComposite={editingComposite}
          onClose={() => {
            setIsDialogOpen(false)
            setEditingComposite(null)
          }}
        />
      )}
    </div>
  )
}

interface LayerCardItemProps {
  item: LayerComposite
  isInserting: boolean
  onInsert: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function LayerCardItem({
  item,
  isInserting,
  onInsert,
  onEdit,
  onDuplicate,
  onDelete
}: LayerCardItemProps) {
  const [thumb, setThumb] = useState<string | undefined>(item.thumbnail)

  useEffect(() => {
    if (item.thumbnail) {
      setThumb(item.thumbnail)
      return
    }
    let active = true
    captureCompositeThumbnail(item, { size: 240, autoFit: true })
      .then((url) => {
        if (active && url) {
          setThumb(url)
          item.thumbnail = url
          updateCompositeThumbnail(item.id, url)
        }
      })
      .catch((err) => {
        console.warn('[LayerCardItem] Failed to generate thumbnail:', item.name, err)
      })
    return () => {
      active = false
    }
  }, [item])

  // Tính tổng số chuyển động của chi tiết: ưu tiên số clips gắn xương, hoặc số layer có chuyển động
  const motionCount = (() => {
    if (item.rig?.clips && item.rig.clips.length > 0) {
      return item.rig.clips.length
    }
    if (item.rig && Object.keys(item.rig.tracks || {}).length > 0) {
      return 1
    }
    const organicCount = item.layers.filter((l) => l.motion?.type && l.motion.type !== 'none').length
    return organicCount
  })()

  const motionTooltip =
    item.rig?.clips && item.rig.clips.length > 0
      ? `Động tác (${item.rig.clips.length}): ${item.rig.clips.map((c) => c.name).join(', ')}`
      : motionCount > 0
        ? `${motionCount} chuyển động hoạt ảnh`
        : 'Chi tiết tĩnh (0 chuyển động)'

  const categoryLabels: Record<string, string> = {
    nature: 'Cây cối',
    prop: 'Đạo cụ',
    character: 'Nhân vật',
    architecture: 'Kiến trúc',
    custom: 'Tự tạo'
  }

  return (
    <div className="model-3d-card" onClick={onEdit} style={{ cursor: 'pointer' }}>
      {/* Thumbnail Area */}
      <div className="model-3d-card-thumb">
        {/* Badges on Top-Left */}
        <div className="model-3d-badge-stack">
          <span
            className={`model-3d-badge ${motionCount > 0 ? 'has-motion' : 'no-motion'}`}
            title={motionTooltip}
            style={{
              background: motionCount > 0 ? 'var(--accent)' : 'var(--bg-3)',
              color: motionCount > 0 ? '#ffffff' : 'var(--text-faint)',
              border: motionCount > 0 ? '1px solid transparent' : '1px solid var(--line-soft)',
              fontWeight: motionCount > 0 ? 600 : 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            {motionCount > 0 && <span style={{ fontSize: '9px' }}>🏃</span>}
            <span>{motionCount} chuyển động</span>
          </span>
          <span className="model-3d-faces-badge">
            {item.layers.length} lớp
          </span>
        </div>

        {/* Action Buttons Top-Right */}
        <div className="model-3d-card-actions-top" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="icon-action-btn add-btn"
            onClick={onInsert}
            disabled={isInserting}
            title="Chèn ngay vào cảnh hiện tại của dự án"
          >
            <IconPlus width={11} height={11} />
          </button>
          <button
            type="button"
            className="icon-action-btn edit-btn"
            onClick={onEdit}
            title="Chỉnh sửa chi tiết trong Xưởng Lắp Ráp Layer"
          >
            <IconPen width={10} height={10} />
          </button>
          <button
            type="button"
            className="icon-action-btn duplicate-btn"
            onClick={onDuplicate}
            title="Nhân bản chi tiết này"
          >
            <IconCopy width={10} height={10} />
          </button>
          <button
            type="button"
            className="icon-action-btn delete-btn"
            onClick={onDelete}
            title="Xóa chi tiết này"
          >
            <IconTrash width={10} height={10} />
          </button>
        </div>

        {/* Thumbnail Graphic Preview */}
        {thumb || item.thumbnail ? (
          <img
            src={thumb || item.thumbnail}
            alt={item.name}
            className="model-3d-thumb-img"
          />
        ) : (
          <div
            style={{
              position: 'relative',
              width: '50px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {item.layers.slice(0, 4).map((_, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  width: `${34 - idx * 4}px`,
                  height: `${40 - idx * 4}px`,
                  borderRadius: '3px',
                  border: '1.5px solid var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 18%, var(--bg-1))',
                  transform: `translate(${(idx - 1.5) * 5}px, ${(idx - 1.5) * 5}px)`,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                  opacity: 0.5 + idx * 0.15
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="model-3d-card-info" style={{ padding: '2px 4px 4px 4px' }}>
        <div
          className="model-3d-card-title"
          title={item.name}
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {item.name}
        </div>
        <div
          className="model-3d-card-cat"
          style={{ fontSize: '9.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {categoryLabels[item.category] || 'Chi tiết'} • {item.width}×{item.height}
        </div>
      </div>
    </div>
  )
}
