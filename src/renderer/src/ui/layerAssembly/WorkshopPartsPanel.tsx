import { useMemo, useState } from 'react'
import type { LayerComposite } from './types'
import { IconLayersStack, IconPlus, IconPuzzle, IconWand } from '../icons'
import { assignToGroup, autoDetectParts, createPartGroup, inferPartKind } from './workshopParts'
import { createVariantSet, slotNames } from './workshopPartSets'
import { PartLayerChip, WorkshopPartGroupCard, type PartCardCommon } from './WorkshopPartGroupCard'
import { WorkshopPartSlotCard } from './WorkshopPartSlotCard'
import { usePartDropTarget, type PartDrop } from './partsDnd'
import '../../styles/layerWorkshopParts.css'

export interface WorkshopPartsPanelProps {
  composite: LayerComposite
  setComposite: (next: LayerComposite) => void
  selectedIds: string[]
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onSetIds: (ids: string[]) => void
  onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
}

const KIND_ORDER = ['head', 'torso', 'arm', 'leg', 'accessory', 'custom']

/** Khay "Chưa liên kết": chip layer tự do để kéo vào nhóm; thả chip thành viên vào đây để gỡ khỏi nhóm. */
function UngroupedTray({ composite, selectedIds, apply, onSelectLayer }: PartCardCommon) {
  const free = composite.layers.filter((l) => !l.partGroupId)
  const onDrop = (drop: PartDrop) => { if (drop.kind === 'layer') apply(assignToGroup(composite, [drop.id], null), drop.id) }
  const { over, handlers } = usePartDropTarget(composite, onDrop)
  return (
    <div className={`lw-part-tray${over ? ' drop-over' : ''}`} {...handlers}>
      <div className="lw-section-label"><IconLayersStack width={11} height={11} /> Chưa liên kết <span className="lw-count">{free.length}</span></div>
      {free.length ? (
        <div className="lw-part-members">
          {free.map((l) => (
            <PartLayerChip key={l.id} composite={composite} layer={l} selected={selectedIds.includes(l.id)} onSelect={(a) => onSelectLayer(l.id, a)} />
          ))}
        </div>
      ) : (
        <p className="lw-hint">Mọi layer đã thuộc một nhóm. Kéo chip thành viên vào đây để gỡ khỏi nhóm.</p>
      )}
    </div>
  )
}

/** Ô thả "Nhóm mới": kéo một layer vào đây để tạo nhóm mới bắt đầu từ layer đó (layer làm neo). */
function NewGroupDrop({ composite, apply, count }: Pick<PartCardCommon, 'composite' | 'apply'> & { count: number }) {
  const onDrop = (drop: PartDrop) => {
    if (drop.kind !== 'layer') return
    const layer = composite.layers.find((l) => l.id === drop.id)
    apply(createPartGroup(composite, layer?.name || `Nhóm ${count + 1}`, [drop.id], (layer && inferPartKind(layer.name)) || 'custom'), drop.id)
  }
  const { over, handlers } = usePartDropTarget(composite, onDrop)
  return (
    <div className={`lw-part-newgroup${over ? ' drop-over' : ''}`} {...handlers}>
      <IconPlus width={12} height={12} /> Thả layer vào đây để tạo nhóm mới
    </div>
  )
}

function PanelHead({ composite, selectedIds, apply, groupCount }: Pick<PartCardCommon, 'composite' | 'selectedIds' | 'apply'> & { groupCount: number }) {
  const createFromSelection = () => {
    const first = composite.layers.find((l) => l.id === selectedIds[0])
    apply(createPartGroup(composite, first?.name || `Nhóm ${groupCount + 1}`, selectedIds, (first && inferPartKind(first.name)) || 'custom'))
  }
  return (
    <div className="lw-pane-head">
      <div className="lw-pane-title"><IconPuzzle width={14} height={14} /> Bộ phận <span className="lw-count">{groupCount}</span></div>
      <div className="lw-pane-actions">
        <button type="button" className="lw-btn sm" onClick={() => apply(autoDetectParts(composite))} disabled={!composite.layers.length}
          title="Gợi ý nhóm & bộ biến thể theo tên layer (người, động vật: đầu, thân, tay, chân, đuôi, cánh…; cùng tiền tố tên). Giữ nguyên các nhóm bạn đã đặt — mọi tên đều đổi được.">
          <IconWand width={12} height={12} /> Tự nhận diện
        </button>
        <button type="button" className="lw-btn sm" onClick={createFromSelection} disabled={!selectedIds.length} title="Tạo nhóm bộ phận mới từ các layer đang chọn">
          <IconPlus width={12} height={12} /> Nhóm ({selectedIds.length})
        </button>
      </div>
    </div>
  )
}

function SlotSection({ composite, selectedIds, apply, onError, onOpenSwap }: Pick<PartCardCommon, 'composite' | 'selectedIds' | 'apply' | 'onError'> & {
  onOpenSwap: WorkshopPartsPanelProps['onOpenSwap']
}) {
  const slots = slotNames(composite)
  const createSet = () => {
    try {
      apply(createVariantSet(composite, selectedIds).composite, selectedIds[0])
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <>
      <div className="lw-section-label lw-section-row">
        <span>Bộ biến thể <span className="lw-count">{slots.length}</span></span>
        <button type="button" className="lw-btn xs" disabled={!selectedIds.length} onClick={createSet}
          title="Tạo bộ biến thể từ các layer đang chọn: mỗi layer là một phương án thay thế nhau (VD mặt thường / mặt cười)">
          <IconPlus width={11} height={11} /> Bộ từ chọn ({selectedIds.length})
        </button>
      </div>
      {slots.length === 0 ? (
        <p className="lw-hint">
          Chọn các layer thay thế nhau (VD <b>mặt thường</b>, <b>mặt khóc</b>) rồi bấm <b>Bộ từ chọn</b>. Khuôn mặt gồm nhiều mảnh rời? Kéo thêm
          <b> mắt / miệng / lông mày</b> vào cùng ô biến thể để chúng đổi cùng nhau.
        </p>
      ) : (
        slots.map((slot) => <WorkshopPartSlotCard key={slot} composite={composite} slot={slot} apply={apply} onError={onError} onOpenSwap={onOpenSwap} />)
      )}
    </>
  )
}

/** Bảng Bộ phận: bộ biến thể (thay nhanh biểu cảm / bộ phận) + nhóm liên kết (kéo-thả layer hoặc ảnh để gắn khoá). */
export function WorkshopPartsPanel({ composite, setComposite, selectedIds, onSelectLayer, onSetIds, onOpenSwap }: WorkshopPartsPanelProps) {
  const [error, setError] = useState('')
  const groups = useMemo(
    () => (composite.partGroups ?? []).slice().sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [composite.partGroups]
  )
  const apply: PartCardCommon['apply'] = (next, selectId) => {
    setComposite(next)
    setError('')
    if (selectId) onSelectLayer(selectId)
  }
  const common: PartCardCommon = { composite, selectedIds, onSelectLayer, apply, onError: setError }
  return (
    <section className="lw-parts-panel" data-mcp-region="layer_assembly_parts" aria-label="Bộ phận và liên kết">
      <PanelHead composite={composite} selectedIds={selectedIds} apply={apply} groupCount={groups.length} />
      <div className="lw-parts-scroll">
        {error && <div className="lw-error" role="alert">{error}</div>}
        <SlotSection {...common} onOpenSwap={onOpenSwap} />
        <div className="lw-section-label">Nhóm &amp; liên kết <span className="lw-count">{groups.length}</span></div>
        {groups.map((g) => <WorkshopPartGroupCard key={g.id} {...common} group={g} onSetIds={onSetIds} />)}
        <NewGroupDrop {...common} count={groups.length} />
        <UngroupedTray {...common} />
      </div>
    </section>
  )
}
