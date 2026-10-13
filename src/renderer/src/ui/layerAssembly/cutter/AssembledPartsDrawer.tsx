import React from 'react'
import type { AssembledLayerItem } from '../types'
import { IconTrash, IconArrowUp, IconArrowDown } from '../../icons'

export interface AssembledPartsDrawerProps {
  layers: AssembledLayerItem[]
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDeleteLayer: (id: string) => void
}

export function AssembledPartsDrawer({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer
}: AssembledPartsDrawerProps) {
  const handleStepZ = (layer: AssembledLayerItem, delta: number) => {
    const currentZ = layer.z ?? 10
    onUpdateLayer(layer.id, { z: currentZ + delta })
  }

  return (
    <div className="layer-cutter-slot-drawer">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--line-soft)'
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
          Bộ phận đã ghép
        </span>
        <span className="layer-cutter-badge" style={{ fontWeight: 600 }}>
          {layers.length} lớp
        </span>
      </div>

      {layers.length === 0 ? (
        <div
          style={{
            padding: '32px 12px',
            textAlign: 'center',
            color: 'var(--text-faint)',
            fontSize: 11,
            lineHeight: 1.6
          }}
        >
          Chưa có bộ phận nào.<br />
          Kéo thả mảnh từ bên trái sang hoặc dán <kbd>Ctrl+V</kbd> vào bố cục.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {layers.map((layer, idx) => {
            const isSelected = selectedLayerId === layer.id
            const zVal = layer.z ?? 10

            return (
              <div
                key={layer.id}
                className={`layer-cutter-slot-card ${isSelected ? 'drag-over' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  gap: 8,
                  borderColor: isSelected ? 'var(--key)' : 'var(--line-soft)',
                  background: isSelected ? 'var(--bg-3)' : 'var(--bg-1)',
                  boxShadow: isSelected ? '0 0 10px rgba(251, 191, 36, 0.2)' : 'none',
                  borderRadius: 6
                }}
                onClick={() => onSelectLayer(layer.id)}
              >
                {/* Thumbnail */}
                <div
                  className="layer-cutter-slot-thumb"
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 4,
                    background: 'var(--bg-0)',
                    border: '1px solid var(--line-soft)'
                  }}
                >
                  {layer.imageUrl ? (
                    <img src={layer.imageUrl} alt={layer.name} />
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>#{idx + 1}</span>
                  )}
                </div>

                {/* Name Input & Z-index badge */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input
                    type="text"
                    className="input sm"
                    style={{
                      width: '100%',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      height: 22,
                      boxSizing: 'border-box',
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: 'var(--text)'
                    }}
                    value={layer.name}
                    onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--line-focus)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                    placeholder="Tên bộ phận..."
                    title="Nhấp để tự đặt tên cho bộ phận"
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: 'var(--accent-cyan)',
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.1)',
                        padding: '1px 4px',
                        borderRadius: 3
                      }}
                      title="Thứ tự lớp (z-index): Càng cao càng nằm đè lên trên"
                    >
                      z: {zVal}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                      ({Math.round(layer.x)}, {Math.round(layer.y)})
                    </span>
                  </div>
                </div>

                {/* Action buttons: Up, Down, Delete */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn sm icon"
                    style={{ width: 22, height: 22, padding: 0 }}
                    title="Tăng z (+1): Đưa nổi lên trên"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStepZ(layer, 1)
                    }}
                  >
                    <IconArrowUp width={11} height={11} />
                  </button>
                  <button
                    type="button"
                    className="btn sm icon"
                    style={{ width: 22, height: 22, padding: 0 }}
                    title="Giảm z (-1): Đưa chìm xuống dưới"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStepZ(layer, -1)
                    }}
                  >
                    <IconArrowDown width={11} height={11} />
                  </button>
                  <button
                    type="button"
                    className="btn sm icon"
                    style={{ width: 22, height: 22, padding: 0, color: '#ef4444' }}
                    title="Xóa bộ phận này"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteLayer(layer.id)
                    }}
                  >
                    <IconTrash width={11} height={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
