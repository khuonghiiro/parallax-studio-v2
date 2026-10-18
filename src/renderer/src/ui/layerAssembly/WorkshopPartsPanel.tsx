import { useMemo } from 'react'
import type { AssembledLayerItem, LayerComposite, LayerPartGroup } from './types'
import { PartThumb } from './PartThumb'
import { IconFaceSwap, IconLink, IconPlus, IconPuzzle, IconSelectPointer, IconTrash, IconUnlink, IconWand } from '../icons'
import {
  activateVariant,
  autoDetectParts,
  createPartGroup,
  deletePartGroup,
  groupMembers,
  inferPartKind,
  layerAssetPath,
  updatePartGroup
} from './workshopParts'

export interface WorkshopPartsPanelProps {
  composite: LayerComposite
  setComposite: (next: LayerComposite) => void
  selectedIds: string[]
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onSetIds: (ids: string[]) => void
  onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
}

function MemberChip({ composite, layer, selected, isAnchor, onSelect }: {
  composite: LayerComposite; layer: AssembledLayerItem; selected: boolean; isAnchor: boolean; onSelect: (additive: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`lw-part-member${selected ? ' selected' : ''}${layer.hidden ? ' is-hidden' : ''}`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey || e.shiftKey)}
      title={`${layer.name}${isAnchor ? ' · neo của nhóm' : ''}${layer.slot ? ` · khe ${layer.slot}` : ''}${layer.hidden ? ' · đang ẩn' : ''}`}
    >
      <PartThumb path={layerAssetPath(composite, layer)} previewUrl={layer.imageUrl} assets={composite.assets} />
      <span>{layer.name}</span>
      {isAnchor && <span className="lw-tag anchor">Neo</span>}
    </button>
  )
}

function PartGroupCard({ composite, group, selectedIds, onChange, onSelectLayer, onSetIds }: {
  composite: LayerComposite; group: LayerPartGroup; selectedIds: string[]
  onChange: (next: LayerComposite) => void; onSelectLayer: WorkshopPartsPanelProps['onSelectLayer']; onSetIds: (ids: string[]) => void
}) {
  const members = groupMembers(composite, group.id)
  return (
    <div className="lw-part-group" data-kind={group.kind}>
      <div className="lw-part-group-head">
        <span className="lw-part-dot" />
        <input
          className="lw-part-name"
          aria-label="Tên nhóm bộ phận"
          value={group.name}
          onChange={(e) => onChange(updatePartGroup(composite, group.id, { name: e.target.value }))}
        />
        <button
          type="button"
          className={`lw-link-toggle${group.locked ? ' on' : ''}`}
          aria-pressed={group.locked}
          onClick={() => onChange(updatePartGroup(composite, group.id, { locked: !group.locked }))}
          title={group.locked ? 'Đang KHOÁ LIÊN KẾT: kéo một bộ phận sẽ kéo cả nhóm. Bấm để tách rời.' : 'Đang TÁCH RỜI: từng bộ phận di chuyển độc lập. Bấm để khoá liên kết.'}
        >
          {group.locked ? <IconLink width={11} height={11} /> : <IconUnlink width={11} height={11} />}
          {group.locked ? 'Liên kết' : 'Tách rời'}
        </button>
        <span className="lw-pane-actions">
          <button type="button" className="lw-icon-btn" onClick={() => onSetIds(members.map((m) => m.id))} title="Chọn tất cả bộ phận trong nhóm">
            <IconSelectPointer width={13} height={13} />
          </button>
          <button type="button" className="lw-icon-btn danger" onClick={() => onChange(deletePartGroup(composite, group.id))} title="Gỡ nhóm (giữ nguyên các layer)">
            <IconTrash width={13} height={13} />
          </button>
        </span>
      </div>
      <div className="lw-part-members">
        {members.map((m) => (
          <MemberChip key={m.id} composite={composite} layer={m} selected={selectedIds.includes(m.id)} isAnchor={m.id === group.anchorLayerId}
            onSelect={(additive) => onSelectLayer(m.id, additive)} />
        ))}
      </div>
    </div>
  )
}

function SlotRow({ composite, slot, layers, onChange, onSelectLayer, onOpenSwap }: {
  composite: LayerComposite; slot: string; layers: AssembledLayerItem[]
  onChange: (next: LayerComposite) => void; onSelectLayer: (id: string) => void; onOpenSwap: WorkshopPartsPanelProps['onOpenSwap']
}) {
  const active = layers.find((l) => !l.hidden) ?? layers[0]
  return (
    <div className="lw-slot-row">
      <div className="lw-slot-name">
        <span><IconFaceSwap width={12} height={12} /> {slot}</span>
        <span className="lw-count">{layers.length} biến thể</span>
      </div>
      <div className="lw-variant-strip">
        {layers.map((v) => (
          <button key={v.id} type="button" className={`lw-variant${!v.hidden ? ' active' : ''}`} title={`Dùng biến thể "${v.variant || v.name}" (giữ nguyên vị trí neo)`}
            onClick={() => { onChange(activateVariant(composite, v.id)); onSelectLayer(v.id) }}>
            <PartThumb path={layerAssetPath(composite, v)} previewUrl={v.imageUrl} assets={composite.assets} />
            <span className="lw-variant-name">{v.variant || v.name}</span>
          </button>
        ))}
        <button type="button" className="lw-variant add" onClick={() => onOpenSwap(active.id, 'variant')} title="Thêm biến thể mới từ ảnh cùng thư mục nhân vật">
          <span className="lw-variant-plus"><IconPlus width={16} height={16} /></span>
          <span className="lw-variant-name">Thêm</span>
        </button>
      </div>
    </div>
  )
}

const KIND_ORDER = ['head', 'torso', 'arm', 'leg', 'accessory', 'custom']

export function WorkshopPartsPanel({ composite, setComposite, selectedIds, onSelectLayer, onSetIds, onOpenSwap }: WorkshopPartsPanelProps) {
  const groups = useMemo(
    () => (composite.partGroups ?? []).slice().sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [composite.partGroups]
  )
  const slots = useMemo(() => {
    const map = new Map<string, AssembledLayerItem[]>()
    for (const l of composite.layers) if (l.slot) map.set(l.slot, [...(map.get(l.slot) ?? []), l])
    return [...map.entries()]
  }, [composite.layers])
  const ungrouped = composite.layers.filter((l) => !l.partGroupId).length
  const createFromSelection = () => {
    const first = composite.layers.find((l) => l.id === selectedIds[0])
    setComposite(createPartGroup(composite, `Nhóm ${groups.length + 1}`, selectedIds, (first && inferPartKind(first.name)) || 'custom'))
  }
  return (
    <section className="lw-parts-panel" data-mcp-region="layer_assembly_parts" aria-label="Bộ phận và liên kết">
      <div className="lw-pane-head">
        <div className="lw-pane-title"><IconPuzzle width={14} height={14} /> Bộ phận <span className="lw-count">{groups.length}</span></div>
        <div className="lw-pane-actions">
          <button type="button" className="lw-btn sm" onClick={() => setComposite(autoDetectParts(composite))} disabled={!composite.layers.length}
            title="Tự nhận diện nhóm (Đầu, Thân, Tay trái/phải, Chân trái/phải) và khe biến thể (face-normal / face-happy…) theo tên layer">
            <IconWand width={12} height={12} /> Tự nhận diện
          </button>
          <button type="button" className="lw-btn sm" onClick={createFromSelection} disabled={!selectedIds.length} title="Tạo nhóm bộ phận mới từ các layer đang chọn">
            <IconPlus width={12} height={12} /> Nhóm ({selectedIds.length})
          </button>
        </div>
      </div>
      <div className="lw-parts-scroll">
        <div className="lw-section-label">Thay nhanh biến thể <span className="lw-count">{slots.length}</span></div>
        {slots.length === 0 ? (
          <p className="lw-hint">Đặt tên ảnh dạng <b>face-normal</b>, <b>face-happy</b>, <b>face-cry</b> rồi bấm Tự nhận diện, hoặc chọn 1 layer → <b>Thay thế…</b> → Thêm làm biến thể.</p>
        ) : (
          slots.map(([slot, list]) => (
            <SlotRow key={slot} composite={composite} slot={slot} layers={list} onChange={setComposite} onSelectLayer={(id) => onSelectLayer(id)} onOpenSwap={onOpenSwap} />
          ))
        )}
        <div className="lw-section-label">Nhóm & liên kết <span className="lw-count">{groups.length}</span></div>
        {groups.length === 0 ? (
          <div className="lw-empty">
            Chưa có nhóm bộ phận. Bấm <strong>Tự nhận diện</strong> để gom <strong>mắt · mũi · miệng · kính · tóc</strong> vào nhóm <strong>Đầu</strong>,
            khoá liên kết để kéo đầu không làm lệch khuôn mặt.
          </div>
        ) : (
          groups.map((g) => (
            <PartGroupCard key={g.id} composite={composite} group={g} selectedIds={selectedIds} onChange={setComposite} onSelectLayer={onSelectLayer} onSetIds={onSetIds} />
          ))
        )}
        {groups.length > 0 && ungrouped > 0 && <p className="lw-hint">{ungrouped} layer chưa thuộc nhóm — chọn layer rồi gán nhóm ở phần Thuộc tính bên dưới.</p>}
      </div>
    </section>
  )
}
