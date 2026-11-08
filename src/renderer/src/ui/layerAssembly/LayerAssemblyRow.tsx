import type { AssembledLayerItem, AssetTable, LayerPartKind } from './types'
import { PartThumb } from './PartThumb'
import { extractLayerDimensions } from './workshopCutoutRig'
import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconLock, IconUnlock } from '../icons'

export function LayerRowItem({
  layer,
  index,
  totalCount,
  isSelected,
  partKind,
  roleLabel,
  assets,
  onSelect,
  onRename,
  onToggleHide,
  onToggleLock,
  onMoveUp,
  onMoveDown
}: {
  layer: AssembledLayerItem
  index: number
  totalCount: number
  isSelected: boolean
  partKind?: LayerPartKind
  roleLabel?: string
  assets?: AssetTable
  onSelect: (additive?: boolean) => void
  onRename?: (name: string) => void
  onToggleHide: () => void
  onToggleLock: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const motion = layer.boneId
    ? layer.isCloth
      ? 'Vải Mesh'
      : layer.bindingMode === 'soft'
        ? 'Mesh 2D'
        : 'Khớp cứng'
    : layer.motion.type !== 'none'
      ? layer.motion.type
      : 'Tĩnh'
  const { w, h } = extractLayerDimensions(layer)
  const sizeBadge = `${Math.round(w)}×${Math.round(h)}px`
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  return (
    <div
      className={`lw-row layer-stack-row-item${isSelected ? ' selected' : ''}${layer.hidden ? ' is-hidden' : ''}`}
      data-layer-id={layer.id}
      data-kind={partKind}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return
        if (e.key === 'Enter') {
          e.preventDefault()
          onSelect(e.ctrlKey || e.metaKey || e.shiftKey)
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e.ctrlKey || e.metaKey || e.shiftKey)
      }}
    >
      <span className="lw-row-kind" aria-hidden="true" />
      <PartThumb path={layer.asset || layer.assetPath} previewUrl={layer.imageUrl} assets={assets} />
      <div className="lw-row-main">
        {onRename ? (
          <input
            type="text"
            className="lw-row-name lw-row-name-input"
            value={layer.name}
            placeholder={roleLabel || `Tên bộ phận #${index + 1} (VD: Áo dài, Chân trái...)`}
            aria-label={`Đổi tên mảnh bộ phận ${index + 1}`}
            title={`Nhập tên bộ phận để AI nhận biết chính xác mảnh này (Hiện tại: "${layer.name}" · Kích thước: ${sizeBadge}${roleLabel ? ` · Vai trò gợi ý: ${roleLabel}` : ''})`}
            onClick={(e) => {
              e.stopPropagation()
              if (!isSelected) onSelect(false)
            }}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' || e.key === 'Escape') {
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
          />
        ) : (
          <span className="lw-row-name" title={layer.name}>
            {layer.name}
          </span>
        )}
        <span className="lw-row-meta">
          <span>Z {layer.z}</span>
          <span>·</span>
          <span title="Kích thước hiển thị thực tế của mảnh trên sân khấu">{sizeBadge}</span>
          <span>·</span>
          <span className={layer.boneId ? 'lw-tag bone' : ''}>{motion}</span>
          {roleLabel && (
            <span className="lw-tag" title={`Vai trò bộ phận tự nhận diện: ${roleLabel}`}>
              {roleLabel}
            </span>
          )}
          {layer.slot && (
            <span className="lw-tag slot" title={`Khe biến thể: ${layer.slot}`}>
              {layer.slot}
              {layer.variant ? `:${layer.variant}` : ''}
            </span>
          )}
        </span>
      </div>
      <div className="lw-row-actions">
        <button
          type="button"
          className="lw-icon-btn lw-reorder"
          disabled={index === 0}
          onClick={stop(onMoveUp)}
          title="Đưa lên trong danh sách (giữ nguyên Z)"
        >
          <IconArrowUp width={12} height={12} />
        </button>
        <button
          type="button"
          className="lw-icon-btn lw-reorder"
          disabled={index === totalCount - 1}
          onClick={stop(onMoveDown)}
          title="Đưa xuống trong danh sách (giữ nguyên Z)"
        >
          <IconArrowDown width={12} height={12} />
        </button>
        <button
          type="button"
          className={`lw-icon-btn${layer.locked ? ' on' : ''}`}
          onClick={stop(onToggleLock)}
          title={layer.locked ? 'Mở khoá layer' : 'Khoá layer (giữ vị trí)'}
        >
          {layer.locked ? <IconLock width={12} height={12} /> : <IconUnlock width={12} height={12} />}
        </button>
        <button
          type="button"
          className="lw-icon-btn"
          onClick={stop(onToggleHide)}
          title={layer.hidden ? 'Hiện layer' : 'Ẩn layer'}
        >
          {layer.hidden ? <IconEyeOff width={12} height={12} /> : <IconEye width={12} height={12} />}
        </button>
      </div>
    </div>
  )
}
