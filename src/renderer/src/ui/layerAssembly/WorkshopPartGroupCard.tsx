import { useState } from 'react'
import type { AssembledLayerItem, LayerComposite, LayerPartGroup } from './types'
import { PartThumb } from './PartThumb'
import { PartEditableTitle } from './PartEditableTitle'
import { IconAnchor, IconLink, IconPlus, IconSelectPointer, IconTrash, IconUnlink, IconX } from '../icons'
import { assignToGroup, deletePartGroup, groupMembers, layerAssetPath, updatePartGroup } from './workshopParts'
import { addAssetToGroup } from './workshopPartSets'
import { startLayerDrag, usePartDropTarget, type PartDrop } from './partsDnd'

export interface PartCardCommon {
  composite: LayerComposite
  selectedIds: string[]
  apply: (next: LayerComposite, selectId?: string) => void
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onError: (message: string) => void
}

/** Chip layer kéo được: kéo sang nhóm khác / khay "Chưa liên kết"; hover hiện nút đặt neo và gỡ. */
export function PartLayerChip({ composite, layer, selected, isAnchor, onSelect, onAnchor, onRemove }: {
  composite: LayerComposite; layer: AssembledLayerItem; selected: boolean; isAnchor?: boolean
  onSelect: (additive: boolean) => void; onAnchor?: () => void; onRemove?: () => void
}) {
  return (
    <div
      className={`lw-part-member${selected ? ' selected' : ''}${layer.hidden ? ' is-hidden' : ''}${isAnchor ? ' is-anchor' : ''}`}
      draggable
      onDragStart={(e) => startLayerDrag(e, layer.id)}
      title={`${layer.name}${isAnchor ? ' · neo của nhóm' : ''}${layer.hidden ? ' · đang ẩn' : ''} — kéo sang nhóm khác để chuyển`}
    >
      <button type="button" className="lw-part-member-main" onClick={(e) => onSelect(e.ctrlKey || e.metaKey || e.shiftKey)}>
        <PartThumb path={layerAssetPath(composite, layer)} previewUrl={layer.imageUrl} assets={composite.assets} />
        <span>{layer.name}</span>
        {isAnchor && <span className="lw-tag anchor">Neo</span>}
      </button>
      {onAnchor && !isAnchor && (
        <button type="button" className="lw-part-member-act" onClick={onAnchor} title="Đặt làm neo của nhóm (điểm gốc khi thay thế / liên kết)">
          <IconAnchor width={10} height={10} />
        </button>
      )}
      {onRemove && (
        <button type="button" className="lw-part-member-act danger" onClick={onRemove} title="Gỡ khỏi nhóm">
          <IconX width={10} height={10} />
        </button>
      )}
    </div>
  )
}

function LayerPicker({ composite, group, apply }: Pick<PartCardCommon, 'composite' | 'apply'> & { group: LayerPartGroup }) {
  const candidates = composite.layers.filter((l) => l.partGroupId !== group.id)
  if (!candidates.length) return <p className="lw-hint">Mọi layer đã thuộc nhóm này.</p>
  return (
    <div className="lw-part-picker" role="listbox" aria-label={`Thêm layer vào nhóm ${group.name}`}>
      {candidates.map((l) => (
        <button key={l.id} type="button" className="lw-part-picker-item" onClick={() => apply(assignToGroup(composite, [l.id], group.id))}
          title={l.partGroupId ? 'Đang thuộc nhóm khác — bấm để chuyển sang nhóm này' : 'Bấm để liên kết vào nhóm'}>
          <PartThumb path={layerAssetPath(composite, l)} previewUrl={l.imageUrl} assets={composite.assets} />
          <span>{l.name}</span>
          {l.partGroupId && <span className="lw-tag">{composite.partGroups?.find((g) => g.id === l.partGroupId)?.name}</span>}
          <IconPlus width={11} height={11} />
        </button>
      ))}
    </div>
  )
}

function GroupHead({ composite, group, apply, picking, setPicking, onSelectAll }: Pick<PartCardCommon, 'composite' | 'apply'> & {
  group: LayerPartGroup; picking: boolean; setPicking: (v: boolean) => void; onSelectAll: () => void
}) {
  return (
    <div className="lw-part-group-head">
      <span className="lw-part-dot" />
      <PartEditableTitle value={group.name} ariaLabel="Tên nhóm bộ phận" onCommit={(name) => apply(updatePartGroup(composite, group.id, { name }))} />
      <button type="button" className={`lw-link-toggle${group.locked ? ' on' : ''}`} aria-pressed={group.locked}
        onClick={() => apply(updatePartGroup(composite, group.id, { locked: !group.locked }))}
        title={group.locked ? 'Đang KHOÁ LIÊN KẾT: kéo một bộ phận sẽ kéo cả nhóm. Bấm để tách rời.' : 'Đang TÁCH RỜI: từng bộ phận di chuyển độc lập. Bấm để khoá liên kết.'}>
        {group.locked ? <IconLink width={11} height={11} /> : <IconUnlink width={11} height={11} />}
        {group.locked ? 'Liên kết' : 'Tách rời'}
      </button>
      <span className="lw-pane-actions">
        <button type="button" className={`lw-icon-btn${picking ? ' active' : ''}`} onClick={() => setPicking(!picking)} title="Thêm layer vào nhóm (chọn từ danh sách)" aria-expanded={picking}>
          <IconPlus width={13} height={13} />
        </button>
        <button type="button" className="lw-icon-btn" onClick={onSelectAll} title="Chọn tất cả bộ phận trong nhóm">
          <IconSelectPointer width={13} height={13} />
        </button>
        <button type="button" className="lw-icon-btn danger" onClick={() => apply(deletePartGroup(composite, group.id))} title="Gỡ nhóm (giữ nguyên các layer)">
          <IconTrash width={13} height={13} />
        </button>
      </span>
    </div>
  )
}

/** Thẻ nhóm bộ phận: đổi tên, khoá liên kết, thêm layer (nút + hoặc kéo layer/ảnh vào thẻ), đặt neo, gỡ thành viên. */
export function WorkshopPartGroupCard({ composite, group, selectedIds, apply, onSelectLayer, onSetIds, onError }: PartCardCommon & {
  group: LayerPartGroup; onSetIds: (ids: string[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const members = groupMembers(composite, group.id)
  const onDrop = (drop: PartDrop) => {
    if (drop.kind === 'layer') return apply(assignToGroup(composite, [drop.id], group.id), drop.id)
    const res = addAssetToGroup(composite, group.id, drop.cand)
    apply(res.composite, res.layerId)
  }
  const { over, handlers } = usePartDropTarget(composite, onDrop, onError)
  return (
    <div className={`lw-part-group${over ? ' drop-over' : ''}`} data-kind={group.kind} {...handlers}>
      <GroupHead composite={composite} group={group} apply={apply} picking={picking} setPicking={setPicking} onSelectAll={() => onSetIds(members.map((m) => m.id))} />
      <div className="lw-part-members">
        {members.map((m) => (
          <PartLayerChip key={m.id} composite={composite} layer={m} selected={selectedIds.includes(m.id)} isAnchor={m.id === group.anchorLayerId}
            onSelect={(additive) => onSelectLayer(m.id, additive)}
            onAnchor={() => apply(updatePartGroup(composite, group.id, { anchorLayerId: m.id }))}
            onRemove={() => apply(assignToGroup(composite, [m.id], null))} />
        ))}
      </div>
      {picking && <LayerPicker composite={composite} group={group} apply={apply} />}
      <div className="lw-part-dropzone" aria-hidden>{over ? 'Thả để liên kết vào nhóm' : 'Kéo layer hoặc ảnh vào đây để liên kết'}</div>
    </div>
  )
}
