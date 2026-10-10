import { useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { Select } from '../controls'

export interface RigPanelProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  selectedIds: string[]
  selectedLayerId?: string | null
  selectLayer?: (id: string | null) => void
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

export function WorkshopRigPanel({
  composite,
  boneId,
  selectBone,
  selectedIds,
  selectedLayerId,
  selectLayer,
  run
}: RigPanelProps) {
  const bones = composite.rig?.bones ?? []
  const bone = bones.find((b) => b.id === boneId)
  const selected = composite.layers.filter((l) => selectedIds.includes(l.id))
  const [localLayerId, setLocalLayerId] = useState<string>('')

  const activeLayerId = (selected.length > 0 ? selected[0].id : (localLayerId || selectedLayerId)) || composite.layers[0]?.id || ''
  const activeLayer = composite.layers.find((l) => l.id === activeLayerId)
  const targetIds = selected.length > 0 ? selectedIds : (activeLayerId ? [activeLayerId] : [])

  const handleLayerSelectChange = (id: string) => {
    setLocalLayerId(id)
    if (selectLayer) selectLayer(id || null)
  }

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

  const patch = (patch: Partial<LayerBone>) => {
    if (!bone) return
    run({ action: 'update-bone', boneId: bone.id, patch })
  }

  return (
    <div className="lw-rig-panel">
      <h3>Mẫu khung xương Rig</h3>
      <div className="lw-preset-row">
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
      <p style={{ margin: '4px 0 8px', fontSize: '11px', color: 'var(--text-dim)' }}>
        Uốn mềm: liên kết đa giác Mesh 2D của layer với chuỗi xương. Các đỉnh mesh sẽ biến dạng mượt mà theo chuyển động xương.
      </p>

      {/* Bộ chọn layer cần gắn */}
      <div className="lw-rig-field">
        <span style={{ fontWeight: 600 }}>Layer mục tiêu:</span>
        <Select
          size="sm"
          value={activeLayerId}
          options={[
            { value: '', label: '-- Chọn layer để gắn xương --' },
            ...composite.layers.map((l) => {
              const currentBone = bones.find((b) => b.id === l.boneId)
              const status = currentBone
                ? (l.bindingMode === 'soft' ? `🌿 [Uốn mềm: ${currentBone.name}]` : `🔗 [Khớp: ${currentBone.name}]`)
                : '[Chưa gắn]'
              return {
                value: l.id,
                label: `${l.name} ${status}`
              }
            })
          ]}
          onChange={(val) => handleLayerSelectChange(String(val))}
        />
      </div>

      {activeLayer && (
        <div style={{ fontSize: '11px', padding: '6px 8px', background: 'var(--bg-1)', borderRadius: '4px', border: '1px solid var(--line-soft)', margin: '6px 0 8px' }}>
          <div><strong>Layer:</strong> {activeLayer.name}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '10.5px', marginTop: '2px' }}>
            Trạng thái: {activeLayer.boneId ? (
              <span style={{ color: activeLayer.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)', fontWeight: 600 }}>
                {activeLayer.bindingMode === 'soft' ? '🌿 Uốn mềm Mesh 2D' : '🔗 Gắn cứng'} theo xương &ldquo;{bones.find(b => b.id === activeLayer.boneId)?.name || activeLayer.boneId}&rdquo;
              </span>
            ) : (
              <span style={{ color: 'var(--text-faint)' }}>Chưa gắn vào xương nào</span>
            )}
            {activeLayer.locked && <span style={{ color: 'var(--danger, #ef4444)', marginLeft: '6px' }}>(Đã khóa)</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          className="btn sm primary"
          disabled={!bone || !targetIds.length}
          onClick={() => {
            if (bone && targetIds.length) {
              run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'soft' })
            }
          }}
          title="Uốn mềm đa giác Mesh 2D bám theo chuỗi xương (phù hợp tóc, vạt áo, đuôi, cành cây)"
        >
          🌿 Uốn mềm theo chuỗi xương (Mesh 2D) {bone ? `(${bone.name})` : ''}
        </button>

        <div className="lw-rig-actions" style={{ marginTop: 0 }}>
          <button
            className="btn sm"
            disabled={!bone || !targetIds.length}
            onClick={() => {
              if (bone && targetIds.length) {
                run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'rigid' })
              }
            }}
            title="Gắn cứng chuyển động vào khớp xương (phù hợp tay chân, vũ khí, phụ kiện)"
            style={{ flex: 1 }}
          >
            🔗 Gắn cứng {bone ? `(${bone.name})` : ''}
          </button>
          <button
            className="btn sm"
            disabled={!targetIds.length || !targetIds.some(id => composite.layers.find(l => l.id === id)?.boneId)}
            onClick={() => run({ action: 'bind', layerIds: targetIds })}
            title="Tháo gắn xương của layer đang chọn"
          >
            Tháo gắn {targetIds.length > 1 ? `(${targetIds.length})` : ''}
          </button>
        </div>
      </div>

      {/* Danh sách các layer đang gắn vào xương hiện tại */}
      {bone && (
        <div style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
            Lớp đang gắn vào xương &ldquo;{bone.name}&rdquo;:
          </span>
          {composite.layers.filter((l) => l.boneId === bone.id).length === 0 ? (
            <p style={{ fontSize: '10.5px', color: 'var(--text-faint)', margin: '4px 0 0' }}>
              Chưa có layer nào gắn vào xương này.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {composite.layers.filter((l) => l.boneId === bone.id).map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: 'var(--bg-1)',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                >
                  <span
                    style={{ cursor: 'pointer', color: 'var(--text)' }}
                    onClick={() => handleLayerSelectChange(l.id)}
                    title="Bấm để chọn layer này"
                  >
                    {l.name} <small style={{ color: l.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)' }}>
                      ({l.bindingMode === 'soft' ? 'Mesh 2D' : 'Khớp'})
                    </small>
                  </span>
                  <button
                    type="button"
                    className="btn xs"
                    style={{ padding: '1px 6px', fontSize: '10px' }}
                    onClick={() => run({ action: 'bind', layerIds: [l.id] })}
                    title="Tháo gắn xương khỏi layer này"
                  >
                    Tháo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
