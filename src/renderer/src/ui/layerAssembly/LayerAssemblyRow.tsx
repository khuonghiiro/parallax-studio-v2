import type { AssembledLayerItem } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { IconEye, IconEyeOff, IconLock } from '../icons'

export function LayerRowItem({
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
  onSelect: (additive?: boolean) => void
  onToggleHide: () => void
  onToggleLock: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const imageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)

  return (
    <div
      className={`layer-stack-row-item${isSelected ? ' selected' : ''}`}
      data-layer-id={layer.id}
      tabIndex={0} role="option" aria-selected={isSelected}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSelect(e.ctrlKey || e.metaKey || e.shiftKey) } }}
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.ctrlKey || e.metaKey || e.shiftKey)
      }}
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
          Z: {layer.z}px • {layer.boneId ? (layer.bindingMode === 'soft' ? '🦴 Mesh 2D' : '🦴 Khớp') : (layer.motion.type !== 'none' ? `🍃 ${layer.motion.type}` : 'Tĩnh')}
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
        title="Đưa lên trong danh sách (giữ nguyên Z)"
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
        title="Đưa xuống trong danh sách (giữ nguyên Z)"
      >
        ▼
      </button>
    </div>
  )
}
