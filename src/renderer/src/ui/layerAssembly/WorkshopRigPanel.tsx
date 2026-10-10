import { useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { Select } from '../controls'
import { IconTrash, IconPlus, IconLayers } from '../icons'

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
    <div className="lw-num-field">
      <span className="lw-num-label">{label}</span>
      <input
        type="number"
        className="lw-field-input"
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
    </div>
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

  const handleDeleteBone = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    run({ action: 'delete-bone', boneId: id })
    if (boneId === id) selectBone(null)
  }

  const layerOptions = [
    { value: '', label: '-- Chọn layer để gắn xương --' },
    ...composite.layers.map((l) => {
      const currentBone = bones.find((b) => b.id === l.boneId)
      const status = currentBone
        ? (l.bindingMode === 'soft' ? `🌿 [Uốn mềm: ${currentBone.name}]` : `🔗 [Khớp: ${currentBone.name}]`)
        : '[Chưa gắn]'
      return {
        value: l.id,
        label: l.name,
        sub: status
      }
    })
  ]

  return (
    <div className="lw-rig-panel">
      {/* 1. Mẫu khung xương dựng sẵn */}
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">🦴 Mẫu khung xương Rig</span>
        </div>
        <div className="lw-preset-row">
          <button
            type="button"
            className="lw-preset-btn"
            title="Tạo bộ 11 xương người 2D (hông, ngực, đầu, tay, chân)"
            onClick={() => run({ action: 'apply-template', template: 'humanoid' })}
          >
            🧍 Người 2D (11 khớp)
          </button>
          <button
            type="button"
            className="lw-preset-btn"
            title="Tạo chuỗi 3 khớp uốn cho cây cối, cành lá, đuôi, dây leo"
            onClick={() => run({ action: 'apply-template', template: 'simple-chain' })}
          >
            🌿 Chuỗi uốn (3 khớp)
          </button>
        </div>
      </div>

      {/* 2. Cây cấu trúc danh sách xương */}
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">
            <span>🦴 Danh sách xương</span>
            <span className="lw-card-badge">{bones.length}</span>
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn xs primary"
              onClick={add}
              title="Tạo xương mới kế thừa từ xương đang chọn hoặc tạo xương gốc mới"
            >
              <IconPlus width={11} height={11} />
              <span>{bone ? 'Xương con' : 'Xương gốc'}</span>
            </button>
            {bone && (
              <button
                type="button"
                className="btn xs"
                onClick={() => selectBone(null)}
                title="Bỏ chọn xương hiện tại"
              >
                Bỏ chọn
              </button>
            )}
          </div>
        </div>

        <div className="lw-bone-list" role="listbox" aria-label="Danh sách xương">
          {bones.map((b) => {
            const isSelected = b.id === boneId
            const boundLayersCount = composite.layers.filter((l) => l.boneId === b.id).length
            return (
              <div
                key={b.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => selectBone(b.id)}
                className={`lw-bone-item${isSelected ? ' active' : ''}`}
                style={{ paddingLeft: b.parentId ? '22px' : '8px' }}
              >
                <div className="lw-bone-item-label">
                  <span className="lw-bone-item-indent">{b.parentId ? '↳' : '◇'}</span>
                  <span className="lw-bone-item-name">{b.name}</span>
                  {boundLayersCount > 0 && (
                    <span className="lw-bone-item-count">
                      {boundLayersCount} lớp
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="lw-bone-item-delete"
                  onClick={(e) => handleDeleteBone(b.id, e)}
                  title="Xóa xương này (Del)"
                  aria-label={`Xóa xương ${b.name}`}
                >
                  <IconTrash width={11} height={11} />
                </button>
              </div>
            )
          })}
          {!bones.length && (
            <p style={{ padding: '10px', margin: 0, textAlign: 'center', color: 'var(--text-faint)', fontSize: '11px' }}>
              Chưa có xương nào. Chọn mẫu ở trên hoặc bấm &ldquo;+ Xương gốc&rdquo;.
            </p>
          )}
        </div>
      </div>

      {/* 3. Thuộc tính xương đang chọn */}
      {bone && (
        <div className="lw-card-section">
          <div className="lw-card-header">
            <span className="lw-card-title">⚙️ Thuộc tính: {bone.name}</span>
          </div>

          <div className="lw-form-group">
            <label className="lw-form-label" htmlFor="lw-bone-name-input">Tên xương:</label>
            <input
              id="lw-bone-name-input"
              className="lw-field-input"
              aria-label="Tên xương"
              value={bone.name}
              onChange={(e) => e.target.value.trim() && patch({ name: e.target.value })}
            />
          </div>

          <div className="lw-form-group">
            <span className="lw-form-label">Xương cha (Gốc phân cấp):</span>
            <Select
              size="sm"
              dropdownWidth={280}
              style={{ width: '100%' }}
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
            <RigNumber label="Chiều dài (px)" value={bone.length} min={10} onChange={(length) => patch({ length })} />
            <RigNumber label="Hướng xương (°)" value={bone.angle} onChange={(angle) => patch({ angle })} />
          </div>

          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn xs danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 9px', color: 'var(--danger, #ef4444)' }}
              onClick={() => handleDeleteBone(bone.id)}
              title="Xóa xương này và toàn bộ các nhánh con (Del)"
            >
              <IconTrash width={11} height={11} />
              <span>Xóa xương này (Del)</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Gắn kết Layer vào xương */}
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">🔗 Gắn Layer vào xương</span>
        </div>
        <p style={{ margin: '2px 0 8px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Uốn mềm: liên kết đa giác Mesh 2D của layer với chuỗi xương để uốn lượn dẻo dai.
        </p>

        {/* Form chọn layer mục tiêu full-width */}
        <div className="lw-form-group">
          <span className="lw-form-label" style={{ fontWeight: 600 }}>Layer mục tiêu:</span>
          <Select
            size="sm"
            dropdownWidth={340}
            style={{ width: '100%' }}
            value={activeLayerId}
            options={layerOptions}
            onChange={(val) => handleLayerSelectChange(String(val))}
          />
        </div>

        {activeLayer && (
          <div
            style={{
              fontSize: '11px',
              padding: '6px 8px',
              background: 'var(--bg-0)',
              borderRadius: '4px',
              border: '1px solid var(--line-soft)',
              margin: '4px 0 8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconLayers width={12} height={12} style={{ opacity: 0.7 }} />
              <strong>{activeLayer.name}</strong>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '10.5px', marginTop: '3px' }}>
              Trạng thái:{' '}
              {activeLayer.boneId ? (
                <span style={{ color: activeLayer.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)', fontWeight: 600 }}>
                  {activeLayer.bindingMode === 'soft' ? '🌿 Uốn mềm Mesh 2D' : '🔗 Gắn cứng'} theo xương &ldquo;{bones.find((b) => b.id === activeLayer.boneId)?.name || activeLayer.boneId}&rdquo;
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
            type="button"
            className="btn sm primary"
            disabled={!bone || !targetIds.length}
            onClick={() => {
              if (bone && targetIds.length) {
                run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'soft' })
              }
            }}
            title="Uốn mềm đa giác Mesh 2D bám theo chuỗi xương (phù hợp tóc, vạt áo, đuôi, cành cây)"
          >
            🌿 Uốn mềm theo chuỗi xương {bone ? `(${bone.name})` : ''}
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
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
              type="button"
              className="btn sm"
              disabled={!targetIds.length || !targetIds.some((id) => composite.layers.find((l) => l.id === id)?.boneId)}
              onClick={() => run({ action: 'bind', layerIds: targetIds })}
              title="Tháo gắn xương của layer đang chọn"
            >
              Tháo gắn {targetIds.length > 1 ? `(${targetIds.length})` : ''}
            </button>
          </div>
        </div>

        {/* Danh sách các layer đang gắn vào xương hiện tại */}
        {bone && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line-soft)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
              Lớp gắn theo xương &ldquo;{bone.name}&rdquo;:
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
                      background: 'var(--bg-0)',
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
    </div>
  )
}
