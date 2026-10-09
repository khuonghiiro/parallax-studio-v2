import type { LayerComposite, AssembledLayerItem, MotionType, MotionAnchor } from './types'
import { IconTrash, IconCopy, IconEye, IconEyeOff, IconPlus } from '../icons'

export interface LayerAssemblyInspectorProps {
  composite: LayerComposite
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  onDuplicateLayer: (id: string) => void
  onMoveLayerOrder: (id: string, direction: 'up' | 'down') => void
}

export function LayerAssemblyInspector({
  composite,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayerOrder
}: LayerAssemblyInspectorProps) {
  const selectedLayer = composite.layers.find((l) => l.id === selectedLayerId) || null

  return (
    <div className="layer-workshop-inspector">
      {/* 1. Header: Layer Stack Hierarchy */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
          Các lớp layer ({composite.layers.length})
        </span>
        <button
          type="button"
          className="btn xs primary"
          onClick={onAddLayer}
          title="Thêm một layer mới vào cụm"
        >
          <IconPlus width={11} height={11} /> Thêm
        </button>
      </div>

      {/* Layer Stack List */}
      <div style={{ maxHeight: '180px', overflowY: 'auto', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-1)' }}>
        {composite.layers.map((layer, idx) => {
          const isSelected = layer.id === selectedLayerId
          return (
            <div
              key={layer.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 8px',
                background: isSelected ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '11px',
                color: isSelected ? 'var(--text)' : 'var(--text-dim)'
              }}
              onClick={() => onSelectLayer(layer.id)}
            >
              <button
                type="button"
                className="btn xs icon"
                style={{ width: '18px', height: '18px', padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateLayer(layer.id, { hidden: !layer.hidden })
                }}
                title={layer.hidden ? 'Hiện layer' : 'Ẩn layer'}
              >
                {layer.hidden ? <IconEyeOff width={10} height={10} /> : <IconEye width={10} height={10} />}
              </button>

              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 400 }}>
                {layer.name}
              </span>

              <span style={{ fontSize: '9px', color: 'var(--text-faint)', minWidth: '40px', textAlign: 'right' }}>
                Z: {layer.z}px
              </span>

              <button
                type="button"
                className="btn xs icon"
                style={{ width: '18px', height: '18px', padding: 0 }}
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveLayerOrder(layer.id, 'up')
                }}
                title="Đưa lên trên (gần hơn)"
              >
                ▲
              </button>

              <button
                type="button"
                className="btn xs icon"
                style={{ width: '18px', height: '18px', padding: 0 }}
                disabled={idx === composite.layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveLayerOrder(layer.id, 'down')
                }}
                title="Đưa xuống dưới (sâu hơn)"
              >
                ▼
              </button>
            </div>
          )
        })}
      </div>

      {/* 2. Inspector Details of Selected Layer */}
      {selectedLayer ? (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
              Thuộc tính layer
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn xs icon"
                onClick={() => onDuplicateLayer(selectedLayer.id)}
                title="Nhân bản layer này"
              >
                <IconCopy width={11} height={11} />
              </button>
              <button
                type="button"
                className="btn xs icon"
                onClick={() => onDeleteLayer(selectedLayer.id)}
                title="Xóa layer này"
              >
                <IconTrash width={11} height={11} />
              </button>
            </div>
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Tên lớp:</span>
            <input
              type="text"
              className="input-text sm"
              value={selectedLayer.name}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { name: e.target.value })}
            />
          </div>

          {/* Transform: X, Y, Z Depth */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>X (px):</span>
              <input
                type="number"
                className="input-text sm"
                value={selectedLayer.x}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { x: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Y (px):</span>
              <input
                type="number"
                className="input-text sm"
                value={selectedLayer.y}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { y: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--accent-cyan)' }} title="Độ sâu chiều sâu 2.5D: Z lớn ở sau, Z nhỏ ở trước">
                Sâu Z (px):
              </span>
              <input
                type="number"
                className="input-text sm"
                value={selectedLayer.z}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { z: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Scale & Rotation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Tỉ lệ (Scale):</span>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="5"
                className="input-text sm"
                value={selectedLayer.scale}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { scale: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Góc xoay (°):</span>
              <input
                type="number"
                className="input-text sm"
                value={selectedLayer.rotation}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Opacity Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)' }}>
              <span>Độ mờ đục (Opacity):</span>
              <span>{Math.round(selectedLayer.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={selectedLayer.opacity}
              onChange={(e) => onUpdateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>

          {/* 3. Hoạt Ảnh Đung Đưa (Motion & Sway Animation) */}
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--key)' }}>
              🍃 Hoạt ảnh chuyển động 2.5D
            </span>

            {/* Kiểu chuyển động */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Kiểu hoạt ảnh:</span>
              <select
                className="input-text sm"
                value={selectedLayer.motion.type}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, {
                    motion: { ...selectedLayer.motion, type: e.target.value as MotionType }
                  })
                }
              >
                <option value="none">Không chuyển động</option>
                <option value="sway">🍃 Đung đưa theo gió (Wind Sway)</option>
                <option value="breathe">🫁 Thở / Nhấp nhô (Breathe Pulse)</option>
                <option value="float">☁️ Nổi bồng bềnh (Floating)</option>
                <option value="rocking">🔔 Lắc lư con lắc (Rocking)</option>
              </select>
            </div>

            {selectedLayer.motion.type !== 'none' && (
              <>
                {/* Điểm neo (Anchor) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Điểm neo uốn (Anchor):</span>
                  <select
                    className="input-text sm"
                    value={selectedLayer.motion.anchor}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        motion: { ...selectedLayer.motion, anchor: e.target.value as MotionAnchor }
                      })
                    }
                  >
                    <option value="bottom">Gốc ở dưới (Thân cây, hoa, cỏ)</option>
                    <option value="top">Treo ở trên (Đèn lồng, dây xích)</option>
                    <option value="center">Ở giữa tâm (Tán lá bồng bềnh)</option>
                  </select>
                </div>

                {/* Tốc độ & Biên độ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Tốc độ:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="5"
                      className="input-text sm"
                      value={selectedLayer.motion.speed}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, {
                          motion: { ...selectedLayer.motion, speed: Number(e.target.value) }
                        })
                      }
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Biên độ (°/px):</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="60"
                      className="input-text sm"
                      value={selectedLayer.motion.amplitude}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, {
                          motion: { ...selectedLayer.motion, amplitude: Number(e.target.value) }
                        })
                      }
                    />
                  </div>
                </div>

                {/* Lệch pha (Phase Offset) */}
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Lệch pha (s):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="3"
                    className="input-text sm"
                    value={selectedLayer.motion.phaseOffset ?? 0}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        motion: { ...selectedLayer.motion, phaseOffset: Number(e.target.value) }
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
          Chọn một layer để tùy chỉnh thuộc tính và hoạt ảnh đung đưa.
        </div>
      )}
    </div>
  )
}
