import { useMemo, useState } from 'react'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { CreatureSkeletonPreview } from './CreatureSkeletonPreview'
import { measureWorkshopLayerSizes } from './workshopLayerMeasure'
import {
  CREATURE_CLIP_LABELS,
  CREATURE_SPECIES,
  getCreatureMeta,
  normalizeCreatureOptions,
  type CreatureRange,
  type CreatureSpeciesMeta
} from './creatures/creatureRigCatalog'
import { buildCreatureRig, isSideViewCreature } from './creatures/creatureRigBuilders'
import { detectCreatureFacing, detectCreatureSpecies } from './creatures/creatureRigFit'
import type { CreatureBindMode, CreatureFacing, CreatureRigOptions, CreatureSpecies } from './creatures/creatureRigTypes'
import '../../styles/layerWorkshopCreatureRig.css'

export interface WorkshopCreatureRigCardProps {
  composite: LayerComposite
  run: (action: RigAction) => void
  onApplied?: () => void
}

interface PillItem<T> {
  id: T
  label: string
  hint?: string
}

/** Nhóm Segmented Pills 1-click (không dùng combobox theo quy chuẩn ≤ 5–7 lựa chọn). */
function PillGroup<T extends string | number | boolean>({ label, items, value, onChange }: { label: string; items: PillItem<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="lw-creature-option">
      <span className="lw-creature-option-label">{label}</span>
      <div className="lw-creature-pills" role="radiogroup" aria-label={label}>
        {items.map((it) => (
          <button
            key={String(it.id)}
            type="button"
            role="radio"
            aria-checked={it.id === value}
            title={it.hint}
            className={`lw-creature-pill${it.id === value ? ' active' : ''}`}
            onClick={() => onChange(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Chọn số nguyên: ≤ 7 giá trị dùng Pills, nhiều hơn dùng bước − / +. */
function RangePicker({ label, range, value, onChange }: { label: string; range: CreatureRange; value: number; onChange: (v: number) => void }) {
  const [min, max] = range
  if (max - min + 1 <= 7) {
    const items = Array.from({ length: max - min + 1 }, (_, i) => ({ id: min + i, label: String(min + i) }))
    return <PillGroup label={label} items={items} value={value} onChange={onChange} />
  }
  return (
    <div className="lw-creature-option">
      <span className="lw-creature-option-label">{label}</span>
      <div className="lw-creature-stepper" aria-label={label}>
        <button type="button" className="lw-creature-pill" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Giảm ${label}`}>
          −
        </button>
        <strong>{value}</strong>
        <button type="button" className="lw-creature-pill" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Tăng ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

function SpeciesGrid({ value, detected, onChange }: { value: CreatureSpecies; detected: CreatureSpecies | null; onChange: (s: CreatureSpecies) => void }) {
  return (
    <div className="lw-creature-grid" role="radiogroup" aria-label="Loài sinh vật">
      {CREATURE_SPECIES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === value}
          className={`lw-creature-species${m.id === value ? ' active' : ''}${m.id === detected ? ' detected' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.hint}
        >
          <span className="lw-creature-species-icon" aria-hidden="true">
            {m.icon}
          </span>
          <span className="lw-creature-species-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

const BIND_MODES: PillItem<CreatureBindMode>[] = [
  { id: 'auto', label: 'Tự động', hint: 'Ảnh đơn & đuôi/vây/cánh/xúc tu uốn mềm, mảnh cắt rời gắn cứng' },
  { id: 'rigid', label: 'Gắn cứng', hint: 'Mọi mảnh xoay nguyên khối theo xương (cutout)' },
  { id: 'soft', label: 'Uốn mềm', hint: 'Biến dạng lưới ảnh mượt theo chuỗi xương (Flexi-Bind)' }
]

interface OptionsPanelProps {
  meta: CreatureSpeciesMeta
  options: Required<CreatureRigOptions>
  patch: (p: CreatureRigOptions) => void
  facingMode: 'auto' | CreatureFacing
  setFacingMode: (f: 'auto' | CreatureFacing) => void
  autoFacing: CreatureFacing | null
  bindMode: CreatureBindMode
  setBindMode: (m: CreatureBindMode) => void
}

function CreatureOptionsPanel({ meta, options, patch, facingMode, setFacingMode, autoFacing, bindMode, setBindMode }: OptionsPanelProps) {
  const autoLabel = autoFacing ? `Tự động ${autoFacing === 'left' ? '←' : '→'}` : 'Tự động'
  return (
    <div className="lw-creature-options">
      {meta.legPairs && <RangePicker label={meta.legPairsLabel ?? 'Cặp chân'} range={meta.legPairs} value={options.legPairs} onChange={(legPairs) => patch({ legPairs })} />}
      {meta.legSegments && <RangePicker label="Đốt mỗi chân" range={meta.legSegments} value={options.legSegments} onChange={(legSegments) => patch({ legSegments })} />}
      {meta.chainSegments && (
        <RangePicker label={meta.chainLabel ?? 'Số đốt'} range={meta.chainSegments} value={options.chainSegments} onChange={(chainSegments) => patch({ chainSegments })} />
      )}
      {meta.wingsOption !== undefined && (
        <PillGroup label="Cánh" items={[{ id: false, label: 'Không' }, { id: true, label: 'Có cánh' }]} value={options.wings} onChange={(wings) => patch({ wings })} />
      )}
      {isSideViewCreature(meta.id) && (
        <PillGroup<'auto' | CreatureFacing>
          label="Hướng mặt"
          items={[{ id: 'auto', label: autoLabel, hint: 'Đoán theo vị trí layer đầu & đuôi' }, { id: 'left', label: '← Trái' }, { id: 'right', label: 'Phải →' }]}
          value={facingMode}
          onChange={setFacingMode}
        />
      )}
      <PillGroup label="Gắn layer" items={BIND_MODES} value={bindMode} onChange={setBindMode} />
    </div>
  )
}

export function WorkshopCreatureRigCard({ composite, run, onApplied }: WorkshopCreatureRigCardProps) {
  const detected = useMemo(() => detectCreatureSpecies(composite), [composite])
  const autoFacing = useMemo(() => detectCreatureFacing(composite), [composite])
  const [species, setSpecies] = useState<CreatureSpecies>(() => detected ?? 'spider')
  const [optionsBySpecies, setOptionsBySpecies] = useState<Partial<Record<CreatureSpecies, CreatureRigOptions>>>({})
  const [facingMode, setFacingMode] = useState<'auto' | CreatureFacing>('auto')
  const [bindMode, setBindMode] = useState<CreatureBindMode>('auto')
  const [flags, setFlags] = useState({ fitToLayers: true, autoBind: true, includeClips: true })
  const [status, setStatus] = useState('')

  const meta = getCreatureMeta(species)
  const facing: CreatureFacing = facingMode === 'auto' ? (autoFacing ?? 'left') : facingMode
  const options = normalizeCreatureOptions(species, { ...optionsBySpecies[species], facing })
  const optionsKey = JSON.stringify(options)
  const preview = useMemo(() => buildCreatureRig(species, options), [species, optionsKey])
  const hasWings = Object.values(preview.roles).some((r) => r.kind === 'wing')
  const clipNames = meta.clips.filter((k) => k !== 'flap' || hasWings).map((k) => CREATURE_CLIP_LABELS[k])
  const existingBones = composite.rig?.bones.length ?? 0

  const patchOptions = (p: CreatureRigOptions) => setOptionsBySpecies((prev) => ({ ...prev, [species]: { ...prev[species], ...p } }))
  const toggle = (key: keyof typeof flags) => setFlags((f) => ({ ...f, [key]: !f[key] }))

  const apply = () => {
    run({ action: 'apply-creature-rig', species, options, bindMode, ...flags, layerSizes: measureWorkshopLayerSizes(composite.layers) })
    const bound = flags.autoBind && composite.layers.length > 0 ? `, gắn ${composite.layers.length} layer` : ''
    const clips = flags.includeClips ? ` & nạp ${clipNames.length} động tác mẫu` : ''
    setStatus(`✓ Đã dựng khung xương ${meta.label} (${preview.bones.length} xương)${bound}${clips}. Ctrl+Z để hoàn tác.`)
    onApplied?.()
  }

  return (
    <div className="lw-card-section lw-creature-rig-card" data-mcp-region="layer_assembly_creature_rig">
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>Thư viện khung xương sinh vật</span>
          <span className="lw-card-badge">{CREATURE_SPECIES.length} loài</span>
        </span>
        {detected && (
          <button type="button" className="lw-creature-detected" onClick={() => setSpecies(detected)} title="Nhận diện từ tên cụm & tên layer — bấm để chọn">
            {getCreatureMeta(detected).icon} Gợi ý: {getCreatureMeta(detected).label}
          </button>
        )}
      </div>
      <p className="lw-creature-desc">
        Chọn loài như Moho Character Wizard: khung xương tự khớp vào ảnh, có sẵn giới hạn góc khớp, tự gắn layer và nạp động tác mẫu. Tinh chỉnh tiếp ở tab <b>Thủ công</b>.
      </p>
      <SpeciesGrid value={species} detected={detected} onChange={setSpecies} />
      <div className="lw-creature-body">
        <div className="lw-creature-preview" title={meta.hint}>
          <CreatureSkeletonPreview build={preview} />
          <span className="lw-creature-preview-badge">{preview.bones.length} xương</span>
        </div>
        <CreatureOptionsPanel
          meta={meta}
          options={options}
          patch={patchOptions}
          facingMode={facingMode}
          setFacingMode={setFacingMode}
          autoFacing={autoFacing}
          bindMode={bindMode}
          setBindMode={setBindMode}
        />
      </div>
      <div className="lw-creature-checks">
        <label title="Co giãn & dời khung xương để lọt khít khung bao các layer đang hiện (kích thước ảnh thật)">
          <input type="checkbox" checked={flags.fitToLayers} onChange={() => toggle('fitToLayers')} /> Khớp vừa ảnh
        </label>
        <label title="Tự gắn mọi layer vào xương phù hợp theo tên bộ phận và khoảng cách">
          <input type="checkbox" checked={flags.autoBind} onChange={() => toggle('autoBind')} /> Tự gắn layer
        </label>
        <label title={clipNames.join(' · ')}>
          <input type="checkbox" checked={flags.includeClips} onChange={() => toggle('includeClips')} /> Động tác mẫu ({clipNames.length})
        </label>
      </div>
      <button type="button" className="btn sm primary lw-creature-apply" onClick={apply} title={meta.hint}>
        <span aria-hidden="true">{meta.icon}</span> Dựng khung xương {meta.label} · {preview.bones.length} xương
      </button>
      {existingBones > 0 && !status && <p className="lw-creature-note">Sẽ thay thế {existingBones} xương hiện có (Ctrl+Z để hoàn tác).</p>}
      {status && (
        <div role="status" className="lw-creature-status">
          {status}
        </div>
      )}
    </div>
  )
}
