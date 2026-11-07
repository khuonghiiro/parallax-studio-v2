import { useState, useMemo } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { analyzeCutoutParts, type CutoutPartInfo } from './workshopCutoutRig'
import { setRigToolState, useRigToolStore } from './rigToolStore'
import { Select } from '../controls'
import { IconLayers, IconPlus, IconX } from '../icons'
import { IconBoneSelect, IconBoneAdd, IconBoneManipulate, IconFlexiMeshBind } from './LayerWorkshopStudioIcons'

export interface WorkshopCutoutRigSectionProps {
  composite: LayerComposite
  bones: LayerBone[]
  bone: LayerBone | undefined
  activeLayerId: string
  targetIds: string[]
  onSelectLayer: (id: string) => void
  selectBone: (id: string | null) => void
  run: (action: RigAction) => void
}

export function WorkshopCutoutRigSection({
  composite,
  bones,
  bone,
  activeLayerId,
  targetIds,
  onSelectLayer,
  selectBone,
  run
}: WorkshopCutoutRigSectionProps) {
  const rigTool = useRigToolStore()
  const [filterUnboundOnly, setFilterUnboundOnly] = useState(false)

  // Phân tích hình học không gian tất cả các mảnh
  const analyzedParts = useMemo(() => analyzeCutoutParts(composite.layers), [composite.layers])

  const activePart = useMemo(
    () => analyzedParts.find((p) => p.layer.id === activeLayerId) || analyzedParts[0],
    [analyzedParts, activeLayerId]
  )

  const boundCount = composite.layers.filter((l) => Boolean(l.boneId)).length
  const totalLayers = composite.layers.length
  const allBound = totalLayers > 0 && boundCount === totalLayers

  // Danh sách options xương để chọn xương cha
  const boneOptions = useMemo(() => {
    return [
      { value: '', label: '-- Không có (Xương Gốc) --' },
      ...bones.map((b) => ({
        value: b.id,
        label: `${b.name}${b.parentId ? '' : ' (Gốc)'}`
      }))
    ]
  }, [bones])

  // Lấy xương hiện tại của layer đang chọn
  const activeLayerBone = useMemo(() => {
    if (!activePart?.layer.boneId) return null
    return bones.find((b) => b.id === activePart.layer.boneId) || null
  }, [activePart, bones])

  // 1-Click Auto Rig toàn bộ
  const handleAutoRigAll = () => {
    run({ action: 'auto-rig-cutout-parts' })
    setRigToolState({
      statusHint: `✓ Đã tự động tạo xương chuẩn khớp và ghép nối toàn bộ ${totalLayers} bộ phận!`
    })
  }

  // Tạo xương đơn lẻ cho bộ phận đang chọn
  const handleCreateBoneForActivePart = () => {
    if (!activePart) return
    run({
      action: 'create-bone-for-layer',
      layerId: activePart.layer.id,
      mode: activePart.suggestedBindingMode
    })
    setRigToolState({
      statusHint: `✓ Đã tạo xương và gắn vào bộ phận "${activePart.layer.name}".`
    })
  }

  // Bật chế độ vẽ xương trực tiếp cho bộ phận đang chọn
  const handleStartDrawBoneForActivePart = () => {
    if (!activePart) return
    setRigToolState({
      tool: 'add',
      targetBindingLayerId: activePart.layer.id,
      targetBindingMode: activePart.suggestedBindingMode,
      statusHint: `✏️ Đang vẽ xương cho "${activePart.layer.name}": Bấm-kéo chuột trên Sân khấu 2D để tạo xương gắn thẳng vào bộ phận này.`
    })
  }

  // Đổi xương cha (Parenting / Ghép nối)
  const handleReparent = (newParentId: string) => {
    if (!activeLayerBone) return
    run({
      action: 'reparent-bone',
      boneId: activeLayerBone.id,
      newParentId: newParentId || undefined
    })
  }

  // Đổi chế độ gắn cứng / uốn mềm
  const handleToggleBindingMode = (mode: 'rigid' | 'soft') => {
    if (!activePart?.layer.boneId) return
    run({
      action: 'bind',
      boneId: activePart.layer.boneId,
      layerIds: [activePart.layer.id],
      mode
    })
  }

  // Gỡ xương khỏi bộ phận
  const handleUnbind = (layerId: string) => {
    run({
      action: 'bind',
      layerIds: [layerId]
    })
  }

  return (
    <div className="lw-card-section lw-cutout-rig-section" data-mcp-region="layer_assembly_cutout_rig">
      {/* 1. Banner Auto-Rig 1-Click */}
      <div className="lw-card-header" style={{ marginBottom: 6 }}>
        <span className="lw-card-title">
          <span>⚡ Ghép Xương Bộ Phận Rời</span>
          <span
            className="lw-card-badge"
            style={{
              background: allBound ? 'rgba(16, 185, 129, 0.2)' : undefined,
              color: allBound ? '#10b981' : undefined
            }}
          >
            {boundCount}/{totalLayers} bộ phận
          </span>
        </span>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.45 }}>
        Tạo xương theo từng bộ phận tách rời (mặt, tóc, thân, tay, chân, đạo cụ) và ghép nối phân cấp cha-con chuẩn xác
        để nhân vật cử động tự nhiên.
      </p>

      <button
        type="button"
        className="btn sm lw-smart-autobind-btn"
        style={{
          width: '100%',
          marginBottom: 10,
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          fontWeight: 600,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
        }}
        onClick={handleAutoRigAll}
        title="Tự động phân tích không gian tất cả các mảnh của nhân vật, sinh xương khớp khít từng mảnh và nối cha-con hoàn chỉnh"
      >
        ⚡ Dựng & Ghép Xương Tự Động (1-Click Cho {totalLayers} Mảnh)
      </button>

      {/* 2. Thẻ Bộ phận Đang Chọn */}
      {activePart && (
        <div
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--line-focus)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            marginBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: '14px' }}>{activePart.roleIcon}</span>
              <strong style={{ fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activePart.layer.name}
              </strong>
            </div>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-1))',
                color: 'var(--accent-cyan)',
                fontWeight: 600
              }}
            >
              {activePart.roleLabel}
            </span>
          </div>

          {/* Trạng thái xương của bộ phận */}
          {activeLayerBone ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-1)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Xương gắn: </span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{activeLayerBone.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => selectBone(activeLayerBone.id)}
                    title="Chọn xương này trong cây xương"
                  >
                    Chọn
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => handleUnbind(activePart.layer.id)}
                    title="Gỡ xương khỏi bộ phận này"
                  >
                    <IconX width={10} height={10} />
                  </button>
                </div>
              </div>

              {/* Ghép nối Xương Cha (Parenting) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10.5px' }}>
                <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', fontWeight: 600 }}>🔗 Nối vào Cha:</span>
                <Select
                  size="sm"
                  style={{ flex: 1 }}
                  dropdownWidth={260}
                  value={activeLayerBone.parentId ?? ''}
                  options={boneOptions.filter((o) => o.value !== activeLayerBone.id)}
                  onChange={(val) => handleReparent(String(val))}
                />
              </div>

              {/* Chế độ Cứng / Uốn Mềm */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Chế độ liên kết:</span>
                <div style={{ display: 'inline-flex', gap: 3 }}>
                  <button
                    type="button"
                    className={`btn xs${activePart.layer.bindingMode !== 'soft' ? ' primary' : ''}`}
                    onClick={() => handleToggleBindingMode('rigid')}
                    title="Gắn cứng xoay theo xương (khuyên dùng cho mặt, thân áo, đai, đạo cụ)"
                  >
                    Cứng (Layer)
                  </button>
                  <button
                    type="button"
                    className={`btn xs${activePart.layer.bindingMode === 'soft' ? ' primary' : ''}`}
                    onClick={() => handleToggleBindingMode('soft')}
                    title="Uốn mềm theo xương (khuyên dùng cho tóc sau, áo choàng, tà áo)"
                  >
                    Uốn mềm (Mesh)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                Chưa có xương gắn cho bộ phận này.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button
                  type="button"
                  className="btn sm primary"
                  onClick={handleCreateBoneForActivePart}
                  title="Tự động tính toạ độ và sinh xương chuẩn khớp khít vào bộ phận này"
                >
                  <IconPlus width={12} height={12} /> Tạo xương
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleStartDrawBoneForActivePart}
                  title="Bấm để vẽ xương bằng chuột trên Canvas 2D, vẽ xong sẽ tự gắn vào bộ phận này"
                >
                  <IconBoneAdd width={12} height={12} /> Vẽ bằng chuột
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Danh Sách Toàn Bộ Các Bộ Phận (Cutout Matrix) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>Danh sách các bộ phận ({analyzedParts.length}):</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', color: 'var(--text-dim)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterUnboundOnly}
            onChange={(e) => setFilterUnboundOnly(e.target.checked)}
          />
          Chỉ xem chưa gắn
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 240,
          overflowY: 'auto',
          paddingRight: 2
        }}
      >
        {analyzedParts
          .filter((p) => (!filterUnboundOnly ? true : !p.layer.boneId))
          .map((p) => {
            const isSelected = p.layer.id === activeLayerId
            const boneObj = p.layer.boneId ? bones.find((b) => b.id === p.layer.boneId) : null
            const parentObj = boneObj?.parentId ? bones.find((b) => b.id === boneObj.parentId) : null

            return (
              <div
                key={p.layer.id}
                onClick={() => onSelectLayer(p.layer.id)} className="lw-cutout-part-row" data-layer-id={p.layer.id} data-layer-name={p.layer.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'color-mix(in srgb, var(--accent) 18%, var(--bg-2))' : 'var(--bg-1)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line-soft)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  transition: 'background 0.12s, border-color 0.12s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span>{p.roleIcon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: isSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.layer.name}
                    </span>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-faint)' }}>
                      {p.roleLabel} · Z: {p.layer.z}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {boneObj ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          color: p.layer.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)',
                          fontWeight: 600
                        }}
                      >
                        🦴 {boneObj.name}
                      </span>
                      {parentObj && (
                        <span style={{ fontSize: '9px', color: 'var(--text-faint)' }}>
                          ↳ {parentObj.name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn xs primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectLayer(p.layer.id)
                        run({
                          action: 'create-bone-for-layer',
                          layerId: p.layer.id,
                          mode: p.suggestedBindingMode
                        })
                      }}
                      title="Tạo nhanh xương cho bộ phận này"
                    >
                      + Xương
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
