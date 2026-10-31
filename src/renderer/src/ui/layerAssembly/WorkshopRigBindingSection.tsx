import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { Select } from '../controls'
import { IconLayers } from '../icons'
import { IconFlexiMeshBind } from './LayerWorkshopStudioIcons'

export interface RigBindingSectionProps {
  composite: LayerComposite
  bones: LayerBone[]
  bone: LayerBone | undefined
  activeLayerId: string
  targetIds: string[]
  onSelectLayer: (id: string) => void
  run: (action: RigAction) => void
}

export function WorkshopRigBindingSection({
  composite,
  bones,
  bone,
  activeLayerId,
  targetIds,
  onSelectLayer,
  run
}: RigBindingSectionProps) {
  const activeLayer = composite.layers.find((l) => l.id === activeLayerId)
  const layerOptions = [
    { value: '', label: '-- Chọn layer để gắn xương --' },
    ...composite.layers.map((l) => {
      const currentBone = bones.find((b) => b.id === l.boneId)
      const status = currentBone
        ? l.bindingMode === 'soft'
          ? `[Flexi-Mesh: ${currentBone.name}]`
          : `[Layer-Bind: ${currentBone.name}]`
        : '[Chưa gắn]'
      return { value: l.id, label: l.name, sub: status }
    })
  ]

  return (
    <div className="lw-card-section">
      <div className="lw-card-header">
        <span className="lw-card-title">Liên kết Moho Flexi-Bind & Layer-Bind</span>
      </div>

      <button
        type="button"
        className="btn sm lw-smart-autobind-btn"
        disabled={!bones.length || !composite.layers.length}
        onClick={() => run({ action: 'smart-auto-bind-25d', bindMode: 'auto' })}
        title="Tự động phân tích khoảng cách không gian và gắn từng bộ phận layer vào xương gần nhất"
      >
        ⚡ Tự động gắn thông minh toàn bộ lớp ({composite.layers.length} lớp)
      </button>

      <div className="lw-form-group" style={{ marginTop: 8 }}>
        <span className="lw-form-label" style={{ fontWeight: 600 }}>
          Lớp mục tiêu:
        </span>
        <Select
          size="sm"
          dropdownWidth={320}
          style={{ width: '100%' }}
          value={activeLayerId}
          options={layerOptions}
          onChange={(val) => onSelectLayer(String(val))}
        />
      </div>

      {activeLayer && (
        <div className="lw-bind-status-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconLayers width={12} height={12} style={{ opacity: 0.75 }} />
            <strong>{activeLayer.name}</strong>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '10.5px', marginTop: '3px' }}>
            Chế độ:{' '}
            {activeLayer.boneId ? (
              <span
                style={{
                  color: activeLayer.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)',
                  fontWeight: 600
                }}
              >
                {activeLayer.bindingMode === 'soft' ? 'Flexi-Bind (Uốn mềm Mesh 2D)' : 'Layer-Bind (Gắn cứng khớp)'} →{' '}
                &ldquo;{bones.find((b) => b.id === activeLayer.boneId)?.name || activeLayer.boneId}&rdquo;
              </span>
            ) : (
              <span style={{ color: 'var(--text-faint)' }}>Tự do (chưa gắn xương)</span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          className="btn sm primary"
          disabled={!bone || !targetIds.length}
          onClick={() =>
            bone && targetIds.length && run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'soft' })
          }
          title="Moho Flexi-Bind: Biến dạng lưới tam giác Alpha Mesh mềm mại theo chuỗi xương và bán kính Strength"
        >
          <IconFlexiMeshBind width={13} height={13} />
          <span>Flexi-Bind · Uốn mềm Mesh {bone ? `(${bone.name})` : '(chọn xương)'}</span>
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn sm"
            style={{ flex: 1 }}
            disabled={!bone || !targetIds.length}
            onClick={() =>
              bone && targetIds.length && run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'rigid' })
            }
            title="Moho Layer-Bind: Gắn cứng toàn bộ tấm layer xoay theo khớp xương (phù hợp đạo cụ, mũ, kiếm)"
          >
            Layer-Bind · Gắn cứng
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={!targetIds.length || !targetIds.some((id) => composite.layers.find((l) => l.id === id)?.boneId)}
            onClick={() => run({ action: 'bind', layerIds: targetIds })}
            title="Gỡ liên kết xương khỏi layer đang chọn"
          >
            Tháo gắn
          </button>
        </div>
      </div>

      {bone && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line-soft)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
            Lớp đang đi theo xương &ldquo;{bone.name}&rdquo;:
          </span>
          {composite.layers.filter((l) => l.boneId === bone.id).length === 0 ? (
            <p style={{ fontSize: '10.5px', color: 'var(--text-faint)', margin: '4px 0 0' }}>
              Chưa có lớp nào gắn trực tiếp vào xương này.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {composite.layers
                .filter((l) => l.boneId === bone.id)
                .map((l) => (
                  <div key={l.id} className="lw-bound-layer-chip">
                    <span onClick={() => onSelectLayer(l.id)} title="Bấm để chọn lớp này">
                      {l.name}{' '}
                      <small style={{ color: l.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)' }}>
                        ({l.bindingMode === 'soft' ? 'Flexi-Mesh' : 'Layer-Bind'})
                      </small>
                    </span>
                    <button type="button" className="btn xs" onClick={() => run({ action: 'bind', layerIds: [l.id] })}>
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
