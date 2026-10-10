import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { Select } from '../controls'

export interface RigPanelProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  selectedIds: string[]
  run: (action: RigAction) => void
}

export function RigNumber({
  label,
  value,
  onChange,
  min,
  max,
  step = 1
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="lw-rig-field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        value={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) {
            onChange(n)
          }
        }}
      />
    </label>
  )
}

export function WorkshopRigPanel({ composite, boneId, selectBone, selectedIds, run }: RigPanelProps) {
  const bones = composite.rig?.bones ?? []
  const bone = bones.find((b) => b.id === boneId)
  const selected = composite.layers.filter((l) => selectedIds.includes(l.id))

  const add = () => {
    const parent = bone
    const radians = ((parent?.angle ?? -90) * Math.PI) / 180
    const next: LayerBone = {
      id: `bone-${crypto.randomUUID()}`,
      name: `Xương ${bones.length + 1}`,
      parentId: parent?.id,
      x: parent ? Math.round(parent.x + Math.cos(radians) * parent.length) : (selected[0]?.x ?? 0),
      y: parent ? Math.round(parent.y + Math.sin(radians) * parent.length) : (selected[0]?.y ?? 0),
      length: 75,
      angle: -90
    }
    run({ action: 'add-bone', bone: next })
    selectBone(next.id)
  }

  const patch = (p: Partial<LayerBone>) => bone && run({ action: 'update-bone', boneId: bone.id, patch: p })

  return (
    <div className="lw-rig-panel">
      <h3>Gắn xương kiểu Blender (Edit Mode)</h3>
      <p>Tạo khớp tại vai, khuỷu tay, hông… rồi gắn các layer ảnh vào xương. Kéo khớp Head để dời, kéo Tail để đổi góc và chiều dài.</p>

      <div className="lw-rig-presets-title">Khung xương dựng sẵn</div>
      <div className="lw-rig-presets-row">
        <button
          className="lw-preset-btn"
          title="Tạo hệ thống 11 xương chuẩn nhân vật người"
          onClick={() => run({ action: 'apply-template', template: 'humanoid' })}
        >
          🧍 Người 2D (11 khớp)
        </button>
        <button
          className="lw-preset-btn"
          title="Tạo chuỗi 3 khớp uốn lượn cho cây cối, đuôi, dây leo"
          onClick={() => run({ action: 'apply-template', template: 'simple-chain' })}
        >
          🌿 Chuỗi uốn (3 khớp)
        </button>
      </div>

      <div className="lw-rig-actions">
        <button className="btn sm primary" onClick={add}>
          + {bone ? 'Xương con' : 'Xương gốc'}
        </button>
        <button className="btn sm" onClick={() => selectBone(null)}>
          Bỏ chọn xương
        </button>
      </div>

      <div className="lw-bone-list" role="listbox" aria-label="Danh sách xương">
        {bones.map((b) => (
          <button
            key={b.id}
            role="option"
            aria-selected={b.id === boneId}
            onClick={() => selectBone(b.id)}
            className={b.id === boneId ? 'active' : ''}
          >
            <span>
              {b.parentId ? '↳ ' : '◇ '}
              {b.name}
            </span>
            <small>{composite.layers.filter((l) => l.boneId === b.id).length} lớp</small>
          </button>
        ))}
        {!bones.length && <p style={{ padding: '8px', margin: 0 }}>Chưa có xương nào. Chọn mẫu xương ở trên hoặc bấm + Xương gốc.</p>}
      </div>

      {bone && (
        <>
          <label className="lw-rig-field">
            <span>Tên xương</span>
            <input
              aria-label="Tên xương"
              value={bone.name}
              onChange={(e) => e.target.value.trim() && patch({ name: e.target.value })}
            />
          </label>
          <div className="lw-rig-field">
            <span>Xương cha</span>
            <Select
              size="sm"
              value={bone.parentId ?? ''}
              options={[
                { value: '', label: 'Không có (Khớp gốc)' },
                ...bones
                  .filter((b) => b.id !== bone.id)
                  .map((b) => ({ value: b.id, label: b.name }))
              ]}
              onChange={(val) => patch({ parentId: String(val) || undefined })}
            />
          </div>
          <div className="lw-rig-grid">
            <RigNumber label="Khớp X" value={bone.x} onChange={(x) => patch({ x })} />
            <RigNumber label="Khớp Y" value={bone.y} onChange={(y) => patch({ y })} />
            <RigNumber label="Chiều dài" value={bone.length} min={10} onChange={(length) => patch({ length })} />
            <RigNumber label="Hướng xương °" value={bone.angle} onChange={(angle) => patch({ angle })} />
          </div>
          <button
            className="btn sm"
            style={{ marginTop: '8px' }}
            onClick={() => {
              run({ action: 'delete-bone', boneId: bone.id })
              selectBone(null)
            }}
          >
            Xóa xương & nhánh con
          </button>
        </>
      )}

      <h3>Gắn Layer vào xương</h3>
      <p>{selected.length} layer đang chọn trên khung 2D. Chọn xương ở danh sách trên rồi bấm Gắn vào xương.</p>
      <div className="lw-rig-actions">
        <button
          className="btn sm primary"
          disabled={!bone || !selected.length}
          onClick={() => run({ action: 'bind', boneId: bone!.id, layerIds: selectedIds })}
        >
          Gắn vào xương {bone ? `(${bone.name})` : ''}
        </button>
        <button
          className="btn sm"
          disabled={!selected.length}
          onClick={() => run({ action: 'bind', layerIds: selectedIds })}
        >
          Tháo gắn
        </button>
      </div>

      <div style={{ marginTop: '8px' }}>
        {selected.map((l) => (
          <div key={l.id} className="lw-rig-binding">
            <span>{l.name}</span>
            <small>{l.locked ? 'Đã khóa' : bones.find((b) => b.id === l.boneId)?.name ?? 'Chưa gắn'}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
