import type { LayerComposite } from './types'
import { PartThumb } from './PartThumb'
import { PartEditableTitle } from './PartEditableTitle'
import { IconFaceSwap, IconPlus, IconX } from '../icons'
import { activateVariant, layerAssetPath, replacePartAsset } from './workshopParts'
import { addAssetToVariant, addLayersToVariant, dissolveSlot, renameSlot, renameVariant, slotVariantGroups } from './workshopPartSets'
import { usePartDropTarget, type PartDrop } from './partsDnd'
import type { PartCardCommon } from './WorkshopPartGroupCard'

type VariantGroup = ReturnType<typeof slotVariantGroups>[number]

function VariantTile({ composite, slot, group, apply, onError }: Pick<PartCardCommon, 'composite' | 'apply' | 'onError'> & { slot: string; group: VariantGroup }) {
  const first = group.layers[0]
  const onDrop = (drop: PartDrop) => {
    if (drop.kind === 'layer') return apply(addLayersToVariant(composite, [drop.id], slot, group.variant), drop.id)
    const res = addAssetToVariant(composite, slot, group.variant, drop.cand)
    apply(res.composite, res.layerId)
  }
  const { over, handlers } = usePartDropTarget(composite, onDrop, onError)
  const extra = group.layers.length - 1
  return (
    <div className={`lw-variant${group.active ? ' active' : ''}${over ? ' drop-over' : ''}`} {...handlers}
      title={`Biến thể "${group.variant}" · ${group.layers.map((l) => l.name).join(' + ')} — bấm để dùng, kéo thêm layer/ảnh vào để ghép nhiều lớp`}>
      <button type="button" className="lw-variant-hit" onClick={() => apply(activateVariant(composite, first.id), first.id)} aria-label={`Dùng biến thể ${group.variant}`}>
        <PartThumb path={layerAssetPath(composite, first)} previewUrl={first.imageUrl} assets={composite.assets} />
        {extra > 0 && <span className="lw-variant-layers">+{extra} lớp</span>}
      </button>
      <PartEditableTitle size="sm" value={group.variant} ariaLabel="Tên biến thể" onCommit={(name) => apply(renameVariant(composite, slot, group.variant, name))} />
    </div>
  )
}

function AddVariantTile({ composite, slot, activeLayerId, apply, onError, onOpenSwap }: Pick<PartCardCommon, 'composite' | 'apply' | 'onError'> & {
  slot: string; activeLayerId: string; onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
}) {
  const onDrop = (drop: PartDrop) => {
    if (drop.kind === 'layer') return apply(addLayersToVariant(composite, [drop.id], slot), drop.id)
    const res = replacePartAsset(composite, activeLayerId, drop.cand, 'variant')
    apply(res.composite, res.layerId)
  }
  const { over, handlers } = usePartDropTarget(composite, onDrop, onError)
  return (
    <button type="button" className={`lw-variant add${over ? ' drop-over' : ''}`} {...handlers} onClick={() => onOpenSwap(activeLayerId, 'variant')}
      title="Thêm biến thể mới: bấm để chọn ảnh cùng thư mục nhân vật, hoặc kéo layer / ảnh vào đây">
      <span className="lw-variant-plus"><IconPlus width={16} height={16} /></span>
      <span className="lw-variant-name">{over ? 'Thả vào' : 'Thêm'}</span>
    </button>
  )
}

/**
 * Thẻ bộ biến thể: tên bộ đổi được, mỗi ô là một biến thể (có thể gồm nhiều lớp — mắt + miệng + lông mày…),
 * bấm để thay nhanh, kéo layer/ảnh vào ô để ghép thêm lớp, ô "+" để tạo biến thể mới.
 */
export function WorkshopPartSlotCard({ composite, slot, apply, onError, onOpenSwap }: Pick<PartCardCommon, 'composite' | 'apply' | 'onError'> & {
  slot: string; onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
}) {
  const groups = slotVariantGroups(composite, slot)
  const active = groups.find((g) => g.active) ?? groups[0]
  if (!active) return null
  return (
    <div className="lw-slot-row">
      <div className="lw-slot-name">
        <span className="lw-slot-icon"><IconFaceSwap width={12} height={12} /></span>
        <PartEditableTitle value={slot} ariaLabel="Tên bộ biến thể" onCommit={(name) => apply(renameSlot(composite, slot, name))} />
        <span className="lw-count">{groups.length} biến thể</span>
        <button type="button" className="lw-icon-btn danger" onClick={() => apply(dissolveSlot(composite, slot))} title="Giải tán bộ biến thể (giữ nguyên layer và trạng thái hiển thị)">
          <IconX width={12} height={12} />
        </button>
      </div>
      <div className="lw-variant-strip">
        {groups.map((g) => <VariantTile key={g.variant} composite={composite} slot={slot} group={g} apply={apply} onError={onError} />)}
        <AddVariantTile composite={composite} slot={slot} activeLayerId={active.layers[0].id} apply={apply} onError={onError} onOpenSwap={onOpenSwap} />
      </div>
    </div>
  )
}
