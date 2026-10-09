import { useState, useMemo, useEffect, useCallback } from 'react'
import type { LayerComposite } from './types'
import {
  getStoredComposites,
  saveComposite,
  deleteComposite,
  duplicateComposite,
  COMPOSITE_CATEGORIES
} from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { LayerAssemblyDialog } from './LayerAssemblyDialog'
import { IconLayers, IconPlus, IconPen, IconTrash, IconCopy } from '../icons'
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
    const handleUpdate = () => reload()
    window.addEventListener('layerComposites:changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('layerComposites:changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
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

  return (
    <div className="layer-assembly-panel">
      {/* 1. Header Toolbar */}
      <div className="layer-assembly-header">
        <div className="layer-assembly-search">
          <input
            type="text"
            className="input-text sm"
            style={{ width: '100%', fontSize: '11px' }}
            placeholder="Tìm chi tiết / hoạt ảnh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="layer-assembly-create-btn"
          onClick={handleCreateNew}
          title="Mở Xưởng Lắp Ráp Layer để tạo chi tiết xếp chồng & hoạt ảnh đung đưa mới"
        >
          <IconPlus width={13} height={13} />
          <span>Tạo hoạt ảnh</span>
        </button>
      </div>

      {/* 2. Category Chips Bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '6px 10px',
          overflowX: 'auto',
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--line-soft)',
          flexShrink: 0
        }}
      >
        {COMPOSITE_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id
          const count = itemCounts[cat.id] || 0
          return (
            <button
              key={cat.id}
              type="button"
              className={`btn xs${active ? ' active' : ''}`}
              style={{
                fontSize: '10.5px',
                padding: '2px 7px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.title}</span>
              <span
                style={{
                  fontSize: '9px',
                  opacity: active ? 1 : 0.6,
                  fontWeight: 600
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 3. Grid Card Items */}
      <div className="layer-assembly-grid">
        {filtered.map((item) => (
          <LayerCompositeCard
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
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '11.5px'
            }}
          >
            <div style={{ marginBottom: '8px', opacity: 0.5 }}>
              <IconLayers width={32} height={32} />
            </div>
            Không tìm thấy chi tiết lắp ráp phù hợp.
          </div>
        )}
      </div>

      {/* 4. Fullscreen Workshop Modal */}
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

interface LayerCompositeCardProps {
  item: LayerComposite
  isInserting: boolean
  onInsert: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function LayerCompositeCard({
  item,
  isInserting,
  onInsert,
  onEdit,
  onDuplicate,
  onDelete
}: LayerCompositeCardProps) {
  // Tìm loại motion chính
  const mainMotion = item.layers.find((l) => l.motion?.type && l.motion.type !== 'none')?.motion?.type || 'none'
  const motionLabels: Record<string, string> = {
    sway: 'Đung đưa 🍃',
    breathe: 'Phập phồng 💨',
    float: 'Lơ lửng ☁️',
    wave: 'Lượn sóng 🌊',
    rocking: 'Bập bênh ⚖️',
    none: 'Tĩnh'
  }

  return (
    <div className="layer-assembly-card">
      {/* Thumbnail or Graphic Layer Representation */}
      <div className="layer-assembly-card-thumb" onClick={onEdit} style={{ cursor: 'pointer' }}>
        <div className="layer-assembly-badge-stack">
          <span className="layer-assembly-badge">
            {motionLabels[mainMotion] || 'Chi tiết'}
          </span>
          <span className="layer-assembly-count-badge">
            {item.layers.length} lớp
          </span>
        </div>

        {/* Action Buttons overlay */}
        <div className="layer-assembly-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn xs icon"
            onClick={onEdit}
            title="Chỉnh sửa trong Xưởng Lắp Ráp Layer"
          >
            <IconPen width={11} height={11} />
          </button>
          <button
            type="button"
            className="btn xs icon"
            onClick={onDuplicate}
            title="Nhân bản cụm chi tiết này"
          >
            <IconCopy width={11} height={11} />
          </button>
          <button
            type="button"
            className="btn xs icon"
            onClick={onDelete}
            title="Xóa cụm chi tiết"
          >
            <IconTrash width={11} height={11} />
          </button>
        </div>

        {/* Visual Stack Graphic */}
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              position: 'relative',
              width: '54px',
              height: '64px',
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
                  width: `${36 - idx * 4}px`,
                  height: `${42 - idx * 4}px`,
                  borderRadius: '4px',
                  border: '1.5px solid var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-2))',
                  transform: `translate(${(idx - 1.5) * 5}px, ${(idx - 1.5) * 5}px)`,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  opacity: 0.5 + idx * 0.15
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card Info & Insert Button */}
      <div className="layer-assembly-card-body">
        <div className="layer-assembly-title" title={item.name}>
          {item.name}
        </div>
        <div className="layer-assembly-desc" title={item.description || ''}>
          {item.description || `${item.width} × ${item.height}px`}
        </div>

        <button
          type="button"
          className="btn xs primary"
          style={{ marginTop: '6px', width: '100%', justifyContent: 'center' }}
          onClick={onInsert}
          disabled={isInserting}
          title="Chèn toàn bộ layer trong chi tiết này vào cảnh đang mở"
        >
          <IconPlus width={10} height={10} />
          <span>{isInserting ? 'Đang thêm...' : 'Thêm vào cảnh'}</span>
        </button>
      </div>
    </div>
  )
}
