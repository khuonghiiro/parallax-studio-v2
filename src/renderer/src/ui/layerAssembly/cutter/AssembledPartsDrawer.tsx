import React from 'react'
import type { AssembledLayerItem } from '../types'
import { IconTrash, IconArrowUp, IconArrowDown, IconPen } from '../../icons'

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
                  padding: '7px 9px',
                  gap: 10,
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
                    width: 38,
                    height: 38,
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

                {/* Right Column: Row 1 = Full-width Title Input; Row 2 = Z badge + Stepper & Delete */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {/* Row 1: Title input taking 100% width of the card's content area */}
                  <div
                    className="layer-cutter-part-input-wrap"
                    onClick={(e) => e.stopPropagation()}
                    title="Nhấp để đổi tên bộ phận (Ví dụ: Thân, Đầu, Áo, Tóc...)"
                  >
                    <IconPen width={11} height={11} className="layer-cutter-part-pen" />
                    <input
                      type="text"
                      className="layer-cutter-part-name-input"
                      value={layer.name}
                      onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })}
                      placeholder="Đặt tên bộ phận..."
                    />
                  </div>

                  {/* Row 2: Z-depth & Coordinates on left; Action buttons on right */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'monospace',
                          color: 'var(--accent-cyan)',
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '1px 5px',
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

                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn sm icon"
                        style={{ width: 20, height: 20, padding: 0 }}
                        title="Tăng z (+1): Đưa nổi lên trên"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStepZ(layer, 1)
                        }}
                      >
                        <IconArrowUp width={10} height={10} />
                      </button>
                      <button
                        type="button"
                        className="btn sm icon"
                        style={{ width: 20, height: 20, padding: 0 }}
                        title="Giảm z (-1): Đưa chìm xuống dưới"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStepZ(layer, -1)
                        }}
                      >
                        <IconArrowDown width={10} height={10} />
                      </button>
                      <button
                        type="button"
                        className="btn sm icon"
                        style={{ width: 20, height: 20, padding: 0, color: 'var(--danger)' }}
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
