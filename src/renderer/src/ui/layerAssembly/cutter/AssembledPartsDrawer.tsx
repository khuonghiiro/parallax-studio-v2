import React from 'react'
import type { AssembledLayerItem } from '../types'
import { IconTrash, IconArrowUp, IconArrowDown } from '../../icons'

export interface AssembledPartsDrawerProps {
  layers: AssembledLayerItem[]
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDeleteLayer: (id: string) => void
  onReorderLayers?: (sourceIdx: number, targetIdx: number) => void
}

const COMMON_PART_CHIPS = [
  'Đầu',
  'Tóc trước',
  'Tóc sau',
  'Khuôn mặt',
  'Thân áo',
  'Tay trái',
  'Tay phải',
  'Chân trái',
  'Chân phải',
  'Đạo cụ / Vũ khí'
]

export function AssembledPartsDrawer({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer
}: AssembledPartsDrawerProps) {
  const handleMoveLayer = (idx: number, delta: number) => {
    // Delta -1 brings forward (higher z or earlier in render order depending on convention)
    const current = layers[idx]
    if (!current) return
    onUpdateLayer(current.id, { z: (current.z || 0) + delta * 2 })
  }

  return (
    <div className="layer-cutter-slot-drawer">
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
        Bộ phận đã ghép ({layers.length})
      </div>

      {layers.length === 0 ? (
        <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 11 }}>
          Chưa có bộ phận nào.<br />
          Kéo mảnh từ bên trái sang hoặc dán <kbd>Ctrl+V</kbd> để lắp ráp.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {layers.map((layer, idx) => {
            const isSelected = selectedLayerId === layer.id

            return (
              <div
                key={layer.id}
                className={`layer-cutter-slot-card ${isSelected ? 'drag-over' : ''}`}
                style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: 8,
                  gap: 6,
                  borderColor: isSelected ? 'var(--key)' : undefined
                }}
                onClick={() => onSelectLayer(layer.id)}
              >
                {/* Top row: thumb + editable name + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="layer-cutter-slot-thumb" style={{ width: 34, height: 34, flexShrink: 0 }}>
                    {layer.imageUrl ? (
                      <img src={layer.imageUrl} alt={layer.name} />
                    ) : (
                      <span style={{ fontSize: 10 }}>#{idx + 1}</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      className="input sm"
                      style={{
                        width: '100%',
                        fontSize: 11,
                        padding: '2px 6px',
                        height: 22,
                        boxSizing: 'border-box'
                      }}
                      value={layer.name}
                      onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Đặt tên bộ phận..."
                      title="Nhấp để sửa tên bộ phận cho chuẩn"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn sm icon"
                      style={{ width: 20, height: 20, padding: 0 }}
                      title="Đưa lên lớp trước (Nổi lên)"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLayer(idx, -1)
                      }}
                    >
                      <IconArrowUp width={10} height={10} />
                    </button>
                    <button
                      type="button"
                      className="btn sm icon"
                      style={{ width: 20, height: 20, padding: 0 }}
                      title="Đưa xuống lớp sau (Chìm xuống)"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLayer(idx, 1)
                      }}
                    >
                      <IconArrowDown width={10} height={10} />
                    </button>
                    <button
                      type="button"
                      className="btn sm icon"
                      style={{ width: 20, height: 20, padding: 0, color: '#ef4444' }}
                      title="Xóa bộ phận này"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteLayer(layer.id)
                      }}
                    >
                      <IconTrash width={10} height={10} />
                    </button>
                  </div>
                </div>

                {/* Bottom row: Quick suggestion chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {COMMON_PART_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        border: '1px solid var(--line-soft)',
                        background: layer.name === chip ? 'var(--accent)' : 'var(--bg-2)',
                        color: layer.name === chip ? '#fff' : 'var(--text-dim)',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onUpdateLayer(layer.id, { name: chip })
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
