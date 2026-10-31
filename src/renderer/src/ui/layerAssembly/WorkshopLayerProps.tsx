import type { AssembledLayerItem, LayerComposite } from './types'
import { Select } from '../controls'
import { PartThumb } from './PartThumb'
import { IconAnchor, IconBone, IconCopy, IconFaceSwap, IconLayersStack, IconPuzzle, IconReplace, IconSliders, IconTrash } from '../icons'
import { activateVariant, assignToGroup, layerAssetPath, updatePartGroup } from './workshopParts'
import { addLayersToVariant, createVariantSet, removeFromSlot, renameVariant, slotNames, slotVariantGroups } from './workshopPartSets'
import { PartEditableTitle } from './PartEditableTitle'


export interface WorkshopLayerPropsProps {
  composite: LayerComposite
  layer: AssembledLayerItem
  setComposite: (next: LayerComposite) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onMoveLayer: (id: string, x: number, y: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onSelectLayer: (id: string) => void
  onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
}

const DEPTH_PRESETS: Array<[number, string, string]> = [
  [-120, 'Tiền cảnh', 'Gần sát camera (-120px)'],
  [-50, 'Cận cảnh', 'Cận cảnh (-50px)'],
  [0, 'Trọng tâm', 'Mặt phẳng chuẩn (0px)'],
  [120, 'Hậu cảnh', 'Hậu cảnh xa vừa (+120px)'],
  [350, 'Nền xa', 'Núi/bầu trời xa (+350px)']
]

function NumField({ label, value, step = 1, axis, onChange }: { label: string; value: number; step?: number; axis?: 'x' | 'y' | 'z'; onChange: (v: number) => void }) {
  return (
    <label className="lw-field">
      <span className={`lw-field-label${axis ? ` ${axis}` : ''}`}>{label}</span>
      <input className="lw-input" type="number" step={step} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v) }} />
    </label>
  )
}

const NEW_SLOT = '__new_slot__'

function PartSection({ composite, layer, setComposite, onSelectLayer, onOpenSwap }: Pick<WorkshopLayerPropsProps, 'composite' | 'layer' | 'setComposite' | 'onSelectLayer' | 'onOpenSwap'>) {
  const groups = composite.partGroups ?? []
  const group = groups.find((g) => g.id === layer.partGroupId)
  const variants = layer.slot ? slotVariantGroups(composite, layer.slot) : []
  const pickSlot = (v: string) => {
    if (!v) setComposite(removeFromSlot(composite, layer.id))
    else if (v === NEW_SLOT) setComposite(createVariantSet(composite, [layer.id], layer.name).composite)
    else setComposite(addLayersToVariant(composite, [layer.id], v))
  }
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconPuzzle width={13} height={13} /> Bộ phận &amp; Thay thế</span>
        <button type="button" className="lw-btn sm primary" onClick={() => onOpenSwap(layer.id, 'replace')} title="Thay ảnh bộ phận này, giữ nguyên vị trí / xương / nhóm">
          <IconReplace width={12} height={12} /> Thay thế…
        </button>
      </div>
      <div className="lw-prop-grid">
        <div className="lw-field">
          <span className="lw-field-label">Nhóm liên kết</span>
          <Select size="sm" value={layer.partGroupId ?? ''}
            options={[{ value: '', label: 'Không thuộc nhóm' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            onChange={(v) => setComposite(assignToGroup(composite, [layer.id], String(v) || null))} />
        </div>
        <div className="lw-field">
          <span className="lw-field-label">Bộ biến thể</span>
          <Select size="sm" value={layer.slot ?? ''}
            options={[{ value: '', label: 'Không thuộc bộ' }, ...slotNames(composite).map((s) => ({ value: s, label: s })), { value: NEW_SLOT, label: '＋ Tạo bộ mới từ layer này' }]}
            onChange={(v) => pickSlot(String(v))} />
        </div>
      </div>
      {layer.slot && (
        <div className="lw-field">
          <span className="lw-field-label">Tên biến thể của layer này</span>
          <PartEditableTitle value={layer.variant || layer.name} ariaLabel="Tên biến thể"
            onCommit={(name) => setComposite(renameVariant(composite, layer.slot!, layer.variant || layer.name, name))} />
        </div>
      )}
      {group && (
        <div className="lw-chip-row">
          <button type="button" className={`lw-chip${group.anchorLayerId === layer.id ? ' active' : ''}`}
            onClick={() => setComposite(updatePartGroup(composite, group.id, { anchorLayerId: layer.id }))} title="Đặt layer này làm điểm neo của nhóm">
            <IconAnchor width={11} height={11} /> {group.anchorLayerId === layer.id ? 'Đang là neo nhóm' : 'Đặt làm neo nhóm'}
          </button>
          <button type="button" className={`lw-chip${group.locked ? ' active' : ''}`}
            onClick={() => setComposite(updatePartGroup(composite, group.id, { locked: !group.locked }))}>
            {group.locked ? 'Nhóm đang liên kết' : 'Nhóm đang tách rời'}
          </button>
        </div>
      )}
      {variants.length > 0 && <PartVariantStrip composite={composite} layerId={layer.id} variants={variants} setComposite={setComposite} onSelectLayer={onSelectLayer} onOpenSwap={onOpenSwap} />}
    </section>
  )
}

function PartVariantStrip({ composite, layerId, variants, setComposite, onSelectLayer, onOpenSwap }: Pick<WorkshopLayerPropsProps, 'composite' | 'setComposite' | 'onSelectLayer' | 'onOpenSwap'> & {
  layerId: string; variants: ReturnType<typeof slotVariantGroups>
}) {
  return (
    <div className="lw-variant-strip" aria-label="Biến thể cùng bộ">
      {variants.map((v) => (
        <button key={v.variant} type="button" className={`lw-variant${v.active ? ' active' : ''}`} title={`Dùng biến thể "${v.variant}" (${v.layers.length} lớp)`}
          onClick={() => { setComposite(activateVariant(composite, v.layers[0].id)); onSelectLayer(v.layers[0].id) }}>
          <PartThumb path={layerAssetPath(composite, v.layers[0])} previewUrl={v.layers[0].imageUrl} assets={composite.assets} />
          <span className="lw-variant-name">{v.variant}</span>
        </button>
      ))}
      <button type="button" className="lw-variant add" onClick={() => onOpenSwap(layerId, 'variant')} title="Thêm biến thể mới vào bộ">
        <span className="lw-variant-plus"><IconFaceSwap width={16} height={16} /></span>
        <span className="lw-variant-name">Thêm</span>
      </button>
    </div>
  )
}

function TransformSection({ layer, onUpdateLayer, onMoveLayer }: Pick<WorkshopLayerPropsProps, 'layer' | 'onUpdateLayer' | 'onMoveLayer'>) {
  const up = (patch: Partial<AssembledLayerItem>) => onUpdateLayer(layer.id, patch)
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconSliders width={13} height={13} /> Biến đổi</span>
        <button type="button" className="lw-btn sm ghost" onClick={() => { onMoveLayer(layer.id, 0, 0); up({ rotation: 0, rotationX: 0, rotationY: 0 }) }} title="Đưa về tâm (0, 0) và góc 0°">Đặt lại</button>
      </div>
      <div className="lw-prop-grid">
        <NumField label="X (ngang)" value={layer.x} onChange={(v) => onMoveLayer(layer.id, v, layer.y)} />
        <NumField label="Y (dọc)" value={layer.y} onChange={(v) => onMoveLayer(layer.id, layer.x, v)} />
        <NumField label="Tỉ lệ" value={layer.scale} step={0.05} onChange={(v) => v > 0 && up({ scale: v })} />
        <label className="lw-field">
          <span className="lw-field-label">Độ mờ đục</span>
          <span className="lw-range-row">
            <input type="range" min={0.05} max={1} step={0.05} value={layer.opacity} onChange={(e) => up({ opacity: Number(e.target.value) })} />
            <span className="lw-range-value">{Math.round(layer.opacity * 100)}%</span>
          </span>
        </label>
      </div>
      <div className="lw-prop-grid three">
        <NumField label="Xoay X (nghiêng)" axis="x" value={layer.rotationX || 0} onChange={(v) => up({ rotationX: v })} />
        <NumField label="Xoay Y (lắc)" axis="y" value={layer.rotationY || 0} onChange={(v) => up({ rotationY: v })} />
        <NumField label="Xoay Z (roll)" axis="z" value={layer.rotation} onChange={(v) => up({ rotation: v })} />
      </div>
    </section>
  )
}

function DepthSection({ layer, onUpdateLayer }: Pick<WorkshopLayerPropsProps, 'layer' | 'onUpdateLayer'>) {
  const zone = layer.z < -20 ? ['front', 'Tiền cảnh · gần camera'] : layer.z > 20 ? ['back', 'Hậu cảnh · xa về sau'] : ['', 'Trọng tâm · chuẩn']
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconLayersStack width={13} height={13} /> Chiều sâu Z</span>
        <span className={`lw-depth-badge ${zone[0]}`}>{zone[1]}</span>
      </div>
      <span className="lw-range-row">
        <input type="range" min={-500} max={800} step={5} value={layer.z} onChange={(e) => onUpdateLayer(layer.id, { z: Number(e.target.value) })}
          title="Z âm: gần camera · Z dương: xa phía sau" />
        <span className="lw-range-value">{layer.z}px</span>
      </span>
      <div className="lw-chip-row">
        {DEPTH_PRESETS.map(([z, label, title]) => (
          <button key={z} type="button" className={`lw-chip${layer.z === z ? ' active' : ''}`} title={title} onClick={() => onUpdateLayer(layer.id, { z })}>{label}</button>
        ))}
      </div>
    </section>
  )
}

function RigSection({ composite, layer, onUpdateLayer }: Pick<WorkshopLayerPropsProps, 'composite' | 'layer' | 'onUpdateLayer'>) {
  const bones = composite.rig?.bones ?? []
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconBone width={13} height={13} /> Khung xương</span>
        {layer.boneId && <span className="lw-tag bone">{layer.bindingMode === 'soft' ? 'Uốn mềm' : 'Khớp cứng'}</span>}
      </div>
      {bones.length ? (
        <div className="lw-prop-grid">
          <div className="lw-field">
            <span className="lw-field-label">Gắn vào xương</span>
            <Select size="sm" value={layer.boneId ?? ''}
              options={[{ value: '', label: 'Không gắn' }, ...bones.map((b) => ({ value: b.id, label: `${b.parentId ? '↳ ' : ''}${b.name}` }))]}
              onChange={(v) => onUpdateLayer(layer.id, { boneId: String(v) || undefined, bindingMode: String(v) ? layer.bindingMode || 'soft' : undefined })} />
          </div>
          <div className="lw-field">
            <span className="lw-field-label">Chế độ gắn</span>
            <Select size="sm" value={layer.bindingMode || 'soft'} disabled={!layer.boneId}
              options={[{ value: 'soft', label: 'Uốn mềm Mesh 2D' }, { value: 'rigid', label: 'Gắn cứng theo xương' }]}
              onChange={(v) => onUpdateLayer(layer.id, { bindingMode: v as 'soft' | 'rigid' })} />
          </div>
        </div>
      ) : (
        <p className="lw-callout">Chưa có khung xương. Mở tab <b>Tạo xương</b> để thêm xương hoặc áp dụng mẫu xương nhân vật.</p>
      )}
    </section>
  )
}

/** Thuộc tính layer đang chọn: tên, bộ phận & thay thế, biến đổi, chiều sâu Z, khung xương. */
export function WorkshopLayerProps(props: WorkshopLayerPropsProps) {
  const { layer, onUpdateLayer, onDuplicate, onDelete } = props
  return (
    <div className="lw-props-panel" data-mcp-region="layer_assembly_properties">
      <div className="lw-prop-head">
        <input className="lw-input" aria-label="Tên layer" value={layer.name} onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })} />
        <button type="button" className="lw-icon-btn" onClick={() => onDuplicate(layer.id)} title="Nhân bản layer (Ctrl+D)"><IconCopy width={13} height={13} /></button>
        <button type="button" className="lw-icon-btn danger" onClick={() => onDelete(layer.id)} title="Xoá layer (Delete)"><IconTrash width={13} height={13} /></button>
      </div>
      <PartSection {...props} />
      <TransformSection {...props} />
      <DepthSection {...props} />

      <RigSection {...props} />
    </div>
  )
}
