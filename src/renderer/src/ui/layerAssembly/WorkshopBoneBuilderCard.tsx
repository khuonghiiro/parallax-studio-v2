import { useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import { collectBranch, MAX_RIG_BONES } from './workshopRigStructure'
import { setRigToolState, useRigToolStore, type MohoRigTool } from './rigToolStore'
import { IconBoneAdd, IconBoneDuplicateLR, IconBoneManipulate, IconBoneMirror, IconBoneWeld } from './LayerWorkshopStudioIcons'
import '../../styles/layerWorkshopCreatureRig.css'

export interface WorkshopBoneBuilderCardProps {
  bones: LayerBone[]
  bone?: LayerBone
  run: (action: RigAction) => void
  selectBone: (id: string | null) => void
  switchTool: (tool: MohoRigTool) => void
}

type Direction = 'bone' | 'up' | 'right' | 'down' | 'left'
const DIRECTION_ANGLE: Record<Exclude<Direction, 'bone'>, number> = { up: -90, right: 0, down: 90, left: 180 }

function Pills<T extends string | number>({ label, items, value, onChange }: { label: string; items: Array<{ id: T; label: string; hint?: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="lw-bone-builder-row">
      <span className="lw-creature-option-label">{label}</span>
      <div className="lw-creature-pills" role="radiogroup" aria-label={label}>
        {items.map((it) => (
          <button key={String(it.id)} type="button" role="radio" aria-checked={it.id === value} title={it.hint} className={`lw-creature-pill${it.id === value ? ' active' : ''}`} onClick={() => onChange(it.id)}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const nums = (list: number[]) => list.map((n) => ({ id: n, label: String(n) }))

/** Chuỗi N đốt kiểu Adobe Animate Bone Tool: bấm nối tiếp từ ngọn xương đang chọn (đuôi, xúc tu, thân rắn, dây). */
function ChainSection({ bone, run, selectBone }: Pick<WorkshopBoneBuilderCardProps, 'bone' | 'run' | 'selectBone'>) {
  const [segments, setSegments] = useState(4)
  const [direction, setDirection] = useState<Direction>('bone')
  const [length, setLength] = useState(160)
  const [name, setName] = useState('Đuôi')
  const dir: Direction = direction === 'bone' && !bone ? 'up' : direction
  const create = () => {
    const idPrefix = `bone-chain-${crypto.randomUUID().slice(0, 8)}`
    run({ action: 'add-bone-chain', parentId: bone?.id, angle: dir === 'bone' ? bone?.angle : DIRECTION_ANGLE[dir], length, segments, namePrefix: name, idPrefix })
    selectBone(`${idPrefix}-${segments}`)
  }
  return (
    <section className="lw-bone-builder-section">
      <h4>Chuỗi xương N đốt</h4>
      <Pills label="Số đốt" items={nums([2, 3, 4, 5, 6, 8])} value={segments} onChange={setSegments} />
      <Pills<Direction>
        label="Hướng"
        items={[{ id: 'bone', label: 'Theo xương', hint: 'Nối thẳng theo hướng xương đang chọn' }, { id: 'up', label: '↑' }, { id: 'right', label: '→' }, { id: 'down', label: '↓' }, { id: 'left', label: '←' }]}
        value={dir}
        onChange={setDirection}
      />
      <div className="lw-bone-builder-row lw-bone-builder-fields">
        <label>
          <span className="lw-creature-option-label">Tổng dài (px)</span>
          <input type="number" className="lw-field-input" min={20} max={2000} value={length} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setLength(e.target.valueAsNumber)} />
        </label>
        <label>
          <span className="lw-creature-option-label">Tên đốt</span>
          <input className="lw-field-input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <button type="button" className="btn xs primary" onClick={create} title={bone ? `Nối từ ngọn "${bone.name}"` : 'Tạo chuỗi gốc mới tại tâm khung'}>
        + Tạo chuỗi {segments} đốt {bone ? `từ “${bone.name}”` : '(xương gốc mới)'}
      </button>
    </section>
  )
}

function SubdivideSection({ bone, run }: Pick<WorkshopBoneBuilderCardProps, 'bone' | 'run'>) {
  const [segments, setSegments] = useState(3)
  const disabled = !bone || bone.pin
  return (
    <section className="lw-bone-builder-section">
      <h4>Chia đốt xương đang chọn</h4>
      <Pills label="Chia thành" items={nums([2, 3, 4, 5, 6])} value={segments} onChange={setSegments} />
      <button type="button" className="btn xs" disabled={disabled} onClick={() => bone && run({ action: 'subdivide-bone', boneId: bone.id, segments })}>
        ✂ Chia {bone ? `“${bone.name}”` : 'xương'} thành {segments} đốt đều
      </button>
    </section>
  )
}

/** Nhân chi vòng tròn (radial array): vẽ 1 chân nhện / xúc tu rồi nhân thành cả dãy, kèm đối xứng L⇄R. */
function RadialSection({ bones, bone, run }: Pick<WorkshopBoneBuilderCardProps, 'bones' | 'bone' | 'run'>) {
  const [count, setCount] = useState(4)
  const [step, setStep] = useState(-25)
  const [mirror, setMirror] = useState(true)
  const branchSize = bone ? collectBranch(bones, bone.id).length : 0
  const added = branchSize * (count - 1) * (mirror ? 2 : 1)
  const overflow = bones.length + added > MAX_RIG_BONES
  return (
    <section className="lw-bone-builder-section">
      <h4>Nhân chi vòng tròn</h4>
      <Pills label="Tổng số chi" items={nums([2, 3, 4, 5, 6, 8])} value={count} onChange={setCount} />
      <div className="lw-bone-builder-row lw-bone-builder-fields">
        <label>
          <span className="lw-creature-option-label">Góc giữa 2 chi (°)</span>
          <input type="number" className="lw-field-input" min={-180} max={180} value={step} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setStep(e.target.valueAsNumber)} />
        </label>
        <label className="lw-bone-builder-check">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Đối xứng L⇄R
        </label>
      </div>
      <button
        type="button"
        className="btn xs"
        disabled={!bone || overflow}
        onClick={() => bone && run({ action: 'radial-array-bone', boneId: bone.id, count, stepAngle: step, mirror })}
        title={overflow ? `Vượt giới hạn ${MAX_RIG_BONES} xương` : 'Chọn đốt gốc của chi (VD đùi chân nhện) rồi bấm'}
      >
        ✳ Nhân nhánh {bone ? `“${bone.name}”` : ''} thành {count} chi (+{added} xương)
      </button>
    </section>
  )
}

export function WorkshopBoneBuilderCard({ bones, bone, run, selectBone, switchTool }: WorkshopBoneBuilderCardProps) {
  const rigTool = useRigToolStore()
  return (
    <div className="lw-card-section lw-bone-builder-card" data-mcp-region="layer_assembly_bone_builder">
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>Dựng xương thủ công</span>
          <span className="lw-card-badge">{bones.length}/{MAX_RIG_BONES}</span>
        </span>
      </div>
      <div className="lw-bone-builder-tools">
        <button type="button" className={`lw-moho-opt-pill${rigTool.tool === 'add' ? ' active' : ''}`} onClick={() => switchTool('add')} title="Phím A: bấm-kéo trên khung 2D tạo xương con, click nhẹ = Pin Bone, giữ Alt = xương gốc mới">
          <IconBoneAdd width={12} height={12} /> <span>Vẽ xương (A)</span>
        </button>
        <button type="button" className={`lw-moho-opt-pill${rigTool.tool === 'manipulate' ? ' active' : ''}`} onClick={() => switchTool('manipulate')} title="Phím Z: bẻ thử IK/FK, tôn trọng giới hạn góc khớp, không ghi keyframe">
          <IconBoneManipulate width={12} height={12} /> <span>Thử khớp (Z)</span>
        </button>
        <button type="button" className={`lw-moho-opt-pill${rigTool.mirrorDraw ? ' active' : ''}`} onClick={() => setRigToolState({ mirrorDraw: !rigTool.mirrorDraw })} title="Vẽ / chỉnh xương tự phản chiếu qua trục X = 0">
          <IconBoneMirror width={12} height={12} /> <span>Đối xứng</span>
        </button>
        <button type="button" className="lw-moho-opt-pill" disabled={!bone} onClick={() => bone && run({ action: 'mirror-bone', boneId: bone.id })} title="Nhân bản xương đang chọn + nhánh con sang bên kia trục X = 0">
          <IconBoneDuplicateLR width={12} height={12} /> <span>Nhân bản L⇄R</span>
        </button>
        <button type="button" className="lw-moho-opt-pill" disabled={bones.length < 2} onClick={() => run({ action: 'snap-joints' })} title="Hàn khít mọi khớp chuỗi cha-con đang hở">
          <IconBoneWeld width={12} height={12} /> <span>Hàn khớp</span>
        </button>
      </div>
      <p className="lw-creature-desc">
        Quy trình Moho / Animate: vẽ thân → chọn xương làm cha → tạo chuỗi đốt cho chân, đuôi, xúc tu → nhân chi vòng tròn + đối xứng → đặt giới hạn góc ở tab <b>Cây xương</b> → bấm <b>Z</b> thử bẻ khớp.
      </p>
      <div className="lw-bone-builder-grid">
        <ChainSection bone={bone} run={run} selectBone={selectBone} />
        <SubdivideSection bone={bone} run={run} />
        <RadialSection bones={bones} bone={bone} run={run} />
      </div>
    </div>
  )
}
