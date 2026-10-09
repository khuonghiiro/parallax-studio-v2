import type { LayerComposite, AssembledLayerItem, MotionType, MotionAnchor } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { IconTrash, IconCopy, IconEye, IconEyeOff, IconPlus, IconLock } from '../icons'

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
    <div
      className="layer-workshop-inspector"
      style={{
        width: '320px',
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--line-soft)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header: Layer Stack Hierarchy */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--line-soft)',
          background: 'var(--bg-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
            Xếp chồng Layer ({composite.layers.length})
          </span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-faint)' }}>
            (Trước → Sau)
          </span>
        </div>
        <button
          type="button"
          className="btn xs primary"
          onClick={onAddLayer}
          title="Thêm một layer mới vào cụm"
          style={{ padding: '2px 8px', fontSize: '10.5px' }}
        >
          <IconPlus width={11} height={11} /> Thêm
        </button>
      </div>

      {/* Layer Stack List */}
      <div
        style={{
          height: '210px',
          overflowY: 'auto',
          borderBottom: '1px solid var(--line-soft)',
          background: 'var(--bg-1)',
          flexShrink: 0
        }}
      >
        {composite.layers.map((layer, idx) => {
          const isSelected = layer.id === selectedLayerId
          return (
            <LayerRowItem
              key={layer.id}
              layer={layer}
              index={idx}
              totalCount={composite.layers.length}
              isSelected={isSelected}
              onSelect={() => onSelectLayer(layer.id)}
              onToggleHide={() => onUpdateLayer(layer.id, { hidden: !layer.hidden })}
              onToggleLock={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
              onMoveUp={() => onMoveLayerOrder(layer.id, 'up')}
              onMoveDown={() => onMoveLayerOrder(layer.id, 'down')}
            />
          )
        })}

        {composite.layers.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
            Chưa có layer nào. Hãy chọn ảnh từ thư viện bên trái để bắt đầu tạo cảnh.
          </div>
        )}
      </div>

      {/* 2. Inspector Details of Selected Layer */}
      <div style={{ flex: '1 1 0%', overflowY: 'auto', padding: '12px', minHeight: 0 }}>
        {selectedLayer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text)' }}>
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
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>X (Ngang):</span>
                <input
                  type="number"
                  className="input-text sm"
                  value={selectedLayer.x}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { x: Number(e.target.value) })}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Y (Dọc):</span>
                <input
                  type="number"
                  className="input-text sm"
                  value={selectedLayer.y}
                  onChange={(e) => onUpdateLayer(selectedLayer.id, { y: Number(e.target.value) })}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 600 }} title="Độ sâu 2.5D: Z âm ở gần camera (tiền cảnh), Z dương ở xa (hậu cảnh)">
                  Độ sâu Z:
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
                <span style={{ fontWeight: 600 }}>{Math.round(selectedLayer.opacity * 100)}%</span>
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

            {/* 3. Hoạt Ảnh Đung Đưa (Parallax Wind Motion) */}
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--key)' }}>
                  🍃 Hoạt ảnh chuyển động 2.5D
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-faint)' }}>
                  Tự động đung đưa theo gió
                </span>
              </div>

              {/* Kiểu chuyển động */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Kiểu chuyển động:</span>
                <select
                  className="input-text sm"
                  value={selectedLayer.motion.type}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, {
                      motion: { ...selectedLayer.motion, type: e.target.value as MotionType }
                    })
                  }
                >
                  <option value="none">Tĩnh (Không chuyển động)</option>
                  <option value="sway">🍃 Đung đưa theo gió (Sway quanh gốc/tâm)</option>
                  <option value="breathe">🫁 Phập phồng nhịp thở (Breathe Pulse)</option>
                  <option value="float">☁️ Lơ lửng bồng bềnh (Floating nâng hạ)</option>
                  <option value="rocking">🔔 Bập bênh con lắc (Rocking lắc lư)</option>
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
                      <option value="bottom">Gốc ở dưới (Thân cây, cành hoa, bụi cỏ)</option>
                      <option value="top">Treo ở trên (Đèn lồng, dây xích, dây leo)</option>
                      <option value="center">Ở giữa tâm (Tán lá bồng bềnh, mây khói)</option>
                    </select>
                  </div>

                  {/* Tốc độ & Biên độ */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Tốc độ (Speed):</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)' }}>
                      <span>Độ lệch pha so le:</span>
                      <span style={{ fontFamily: 'monospace' }}>{(selectedLayer.motion.phaseOffset ?? 0).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      step="0.05"
                      min="0"
                      max="2"
                      value={selectedLayer.motion.phaseOffset ?? 0}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, {
                          motion: { ...selectedLayer.motion, phaseOffset: Number(e.target.value) }
                        })
                      }
                      style={{ accentColor: 'var(--accent)', width: '100%', marginTop: '3px' }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
            Click chọn một layer trong danh sách hoặc trên khung nhìn để chỉnh sửa toạ độ và hoạt ảnh.
          </div>
        )}
      </div>
    </div>
  )
}

function LayerRowItem({
  layer,
  index,
  totalCount,
  isSelected,
  onSelect,
  onToggleHide,
  onToggleLock,
  onMoveUp,
  onMoveDown
}: {
  layer: AssembledLayerItem
  index: number
  totalCount: number
  isSelected: boolean
  onSelect: () => void
  onToggleHide: () => void
  onToggleLock: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const imageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 8px',
        background: isSelected ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'transparent',
        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
        cursor: 'pointer',
        fontSize: '11px',
        color: isSelected ? 'var(--text)' : 'var(--text-dim)',
        transition: 'background 0.1s ease',
        userSelect: 'none'
      }}
      onClick={onSelect}
    >
      {/* Mini Thumbnail */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '3px',
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid var(--line-soft)'
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: '8px', opacity: 0.5 }}>{index + 1}</span>
        )}
      </div>

      {/* Layer Name & Depth */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? 'var(--text)' : 'var(--text-dim)'
          }}
          title={layer.name}
        >
          {layer.name}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--accent-cyan)', opacity: 0.8 }}>
          Z: {layer.z}px • {layer.motion.type !== 'none' ? `🍃 ${layer.motion.type}` : 'Tĩnh'}
        </span>
      </div>

      {/* Hide / Unhide Button */}
      <button
        type="button"
        className="btn xs icon"
        style={{ width: '18px', height: '18px', padding: 0 }}
        onClick={(e) => {
          e.stopPropagation()
          onToggleHide()
        }}
        title={layer.hidden ? 'Hiện layer này' : 'Ẩn layer này'}
      >
        {layer.hidden ? <IconEyeOff width={11} height={11} /> : <IconEye width={11} height={11} />}
      </button>

      {/* Lock Button */}
      <button
        type="button"
        className="btn xs icon"
        style={{ width: '18px', height: '18px', padding: 0, opacity: layer.locked ? 1 : 0.4 }}
        onClick={(e) => {
          e.stopPropagation()
          onToggleLock()
        }}
        title={layer.locked ? 'Mở khóa layer' : 'Khóa layer'}
      >
        <IconLock width={10} height={10} />
      </button>

      {/* Reorder Buttons */}
      <button
        type="button"
        className="btn xs icon"
        style={{ width: '18px', height: '18px', padding: 0 }}
        disabled={index === 0}
        onClick={(e) => {
          e.stopPropagation()
          onMoveUp()
        }}
        title="Đưa lên trên (ra phía trước)"
      >
        ▲
      </button>

      <button
        type="button"
        className="btn xs icon"
        style={{ width: '18px', height: '18px', padding: 0 }}
        disabled={index === totalCount - 1}
        onClick={(e) => {
          e.stopPropagation()
          onMoveDown()
        }}
        title="Đưa xuống dưới (về phía sau)"
      >
        ▼
      </button>
    </div>
  )
}
