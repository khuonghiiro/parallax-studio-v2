import { useMemo, useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import { Select } from '../controls'
import { IconLayers, IconPlus, IconTrash } from '../icons'
import { SegmentedTabs } from '../primitives'
import { WorkshopMixamoRigCard } from './WorkshopMixamoRigCard'
import { WorkshopSmartRig25DCard } from './WorkshopSmartRig25DCard'
import {
  resetTestPoses,
  setRigToolState,
  useRigToolStore,
  type MohoRigTool
} from './rigToolStore'
import { classifyBoneSide, computeBoneDepthMap, computeBoneInfluenceRadius } from './mohoRigHelpers'
import {
  IconAutoRigSpark,
  IconBoneAdd,
  IconBoneHierarchy,
  IconBoneManipulate,
  IconBoneMirror,
  IconBoneSelect,
  IconBoneStrength,
  IconBoneWeld,
  IconFlexiMeshBind
} from './LayerWorkshopStudioIcons'

export interface RigPanelProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  selectedIds: string[]
  selectedLayerId?: string | null
  selectLayer?: (id: string | null) => void
  run: (action: RigAction) => void
}

export type RigSubTab = 'hierarchy' | 'binding' | 'autorig'

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

const MOHO_RIG_TOOLS: Array<{
  id: MohoRigTool
  label: string
  hotkey: string
  title: string
  Icon: typeof IconBoneSelect
}> = [
  {
    id: 'select',
    label: 'Chọn',
    hotkey: 'S',
    title: 'Chọn xương (Phím S): Kéo khớp gốc để dời vị trí, kéo ngọn để chỉnh độ dài & góc xương',
    Icon: IconBoneSelect
  },
  {
    id: 'add',
    label: 'Vẽ xương',
    hotkey: 'A',
    title: 'Vẽ thêm xương trên khung 2D (Phím A): Bấm-kéo để tạo chuỗi xương con, click nhẹ để đặt Chốt Pin Bone, giữ Alt để tạo xương gốc mới',
    Icon: IconBoneAdd
  },
  {
    id: 'strength',
    label: 'Vùng uốn',
    hotkey: 'T',
    title: 'Vùng ảnh hưởng xương (Phím T): Kéo viền viên nang xung quanh xương để chỉnh bán kính uốn Flexi-Bind Mesh',
    Icon: IconBoneStrength
  },
  {
    id: 'manipulate',
    label: 'Thử khớp',
    hotkey: 'Z',
    title: 'Thử bẻ khớp trực tiếp (Phím Z): Kéo bẻ xương IK/FK ngay tại Frame 0 để kiểm tra độ uốn Mesh mà không tạo keyframe',
    Icon: IconBoneManipulate
  }
]

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
  const [subTab, setSubTab] = useState<RigSubTab>(() => (bones.length > 0 ? 'hierarchy' : 'autorig'))
  const rigTool = useRigToolStore()
  const depthMap = useMemo(() => computeBoneDepthMap(bones), [bones])
  const hasTestPose = Object.keys(rigTool.testPoses).length > 0

  const activeLayerId =
    (selected.length > 0 ? selected[0].id : localLayerId || selectedLayerId) || composite.layers[0]?.id || ''
  const activeLayer = composite.layers.find((l) => l.id === activeLayerId)
  const targetIds = selected.length > 0 ? selectedIds : activeLayerId ? [activeLayerId] : []
  const boundLayersTotal = composite.layers.filter((l) => Boolean(l.boneId)).length

  const handleLayerSelectChange = (id: string) => {
    setLocalLayerId(id)
    if (selectLayer) selectLayer(id || null)
  }

  const switchTool = (nextTool: MohoRigTool) => {
    if (nextTool !== 'manipulate') resetTestPoses()
    setRigToolState({
      tool: nextTool,
      ...(nextTool === 'strength' ? { showInfluence: true } : {})
    })
  }

  const add = () => {
    const parent = bone
    const radians = ((parent?.angle ?? -90) * Math.PI) / 180
    const next: LayerBone = {
      id: `bone-${crypto.randomUUID()}`,
      name: `Xương ${bones.length + 1}`,
      parentId: parent?.id,
      x: parent ? Math.round(parent.x + Math.cos(radians) * parent.length) : selected[0]?.x ?? 0,
      y: parent ? Math.round(parent.y + Math.sin(radians) * parent.length) : selected[0]?.y ?? 0,
      length: 75,
      angle: -90,
      strength: 1
    }
    run({ action: 'add-bone', bone: next })
    const unboundTargets = targetIds.filter((id) => !composite.layers.find((l) => l.id === id)?.boneId)
    if (unboundTargets.length > 0) {
      run({ action: 'bind', boneId: next.id, layerIds: unboundTargets, mode: 'soft' })
    }
    selectBone(next.id)
    if (subTab === 'autorig') setSubTab('hierarchy')
  }

  const patch = (nextPatch: Partial<LayerBone>) => {
    if (!bone) return
    run({ action: 'update-bone', boneId: bone.id, patch: nextPatch })
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
        ? l.bindingMode === 'soft'
          ? `[Flexi-Mesh: ${currentBone.name}]`
          : `[Layer-Bind: ${currentBone.name}]`
        : '[Chưa gắn]'
      return { value: l.id, label: l.name, sub: status }
    })
  ]

  return (
    <div className="lw-rig-panel" data-mcp-region="layer_assembly_rig_panel">
      {/* 1. Thanh công cụ Tạo xương chuẩn Moho Pro (S / A / T / Z) */}
      <div className="lw-moho-toolbelt-card" data-mcp-region="layer_assembly_rig_tools">
        <div className="lw-moho-frame0-bar">
          <span className={`lw-frame-mode-badge${rigTool.tool === 'manipulate' ? ' is-testing' : ' is-setup'}`}>
            {rigTool.tool === 'manipulate' ? '⚡ THỬ KHỚP IK/FK (Z)' : '◇ FRAME 0 · DÁNG GỐC'}
          </span>
          {rigTool.tool === 'manipulate' && hasTestPose ? (
            <button
              type="button"
              className="btn xs lw-reset-test-btn"
              onClick={resetTestPoses}
              title="Trả toàn bộ xương đang bẻ thử về tư thế gốc Frame 0"
            >
              ↺ Về Frame 0
            </button>
          ) : (
            <button
              type="button"
              className="btn xs primary"
              onClick={add}
              title="Thêm xương mới nối từ xương đang chọn (hoặc xương gốc)"
            >
              <IconPlus width={11} height={11} />
              <span>{bone ? 'Xương con' : 'Xương gốc'}</span>
            </button>
          )}
        </div>

        <div className="lw-moho-tool-grid" role="radiogroup" aria-label="Công cụ tạo xương Moho">
          {MOHO_RIG_TOOLS.map(({ id, label, hotkey, title, Icon }) => {
            const active = rigTool.tool === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`lw-moho-tool-btn${active ? ' active' : ''}`}
                onClick={() => switchTool(id)}
                title={title}
              >
                <Icon width={14} height={14} />
                <span className="lw-moho-tool-label">{label}</span>
                <kbd>{hotkey}</kbd>
              </button>
            )
          })}
        </div>

        <div className="lw-moho-tool-options">
          <button
            type="button"
            className={`lw-moho-opt-pill${rigTool.showInfluence ? ' active' : ''}`}
            onClick={() => setRigToolState({ showInfluence: !rigTool.showInfluence })}
            title="Hiện/ẩn lớp vỏ viên nang Vùng ảnh hưởng xương (Moho Bone Strength Envelope)"
          >
            <IconBoneStrength width={12} height={12} />
            <span>Vỏ vùng uốn</span>
          </button>
          <button
            type="button"
            className={`lw-moho-opt-pill${rigTool.mirrorDraw ? ' active' : ''}`}
            onClick={() => setRigToolState({ mirrorDraw: !rigTool.mirrorDraw })}
            title="Khi bật: dùng công cụ Vẽ xương (A) bên trái/phải sẽ tự động sinh xương đối xứng qua trục X = 0"
          >
            <IconBoneMirror width={12} height={12} />
            <span>Đối xứng L⇄R</span>
          </button>
          <button
            type="button"
            className="lw-moho-opt-pill"
            disabled={bones.length < 2}
            onClick={() => run({ action: 'snap-joints' })}
            title="Hàn khớp chuỗi xương (Moho Weld Joints): tự căn độ dài & góc xương cha để khớp tròn ngọn trùng khít 100% tâm khớp con"
          >
            <IconBoneWeld width={12} height={12} />
            <span>Hàn khớp</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh 3 Sub-Tabs gọn gàng (loại bỏ cuộn dọc dài 6 thẻ) */}
      <SegmentedTabs<RigSubTab>
        variant="segmented"
        size="sm"
        ariaLabel="Phân khu Tạo xương"
        value={subTab}
        onChange={setSubTab}
        items={[
          {
            id: 'hierarchy',
            label: 'Cây xương',
            icon: <IconBoneHierarchy width={12} height={12} />,
            badge: bones.length
          },
          {
            id: 'binding',
            label: 'Gắn Mesh',
            icon: <IconFlexiMeshBind width={12} height={12} />,
            badge: `${boundLayersTotal}/${composite.layers.length}`
          },
          {
            id: 'autorig',
            label: 'Auto-Rig',
            icon: <IconAutoRigSpark width={12} height={12} />
          }
        ]}
      />

      {/* SUB-TAB 1: CÂY PHÂN CẤP XƯƠNG & THUỘC TÍNH KHỚP */}
      {subTab === 'hierarchy' && (
        <>
          <div className="lw-card-section">
            <div className="lw-card-header">
              <span className="lw-card-title">
                <span>Cây phân cấp xương</span>
                <span className="lw-card-badge">{bones.length}</span>
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {bone && (
                  <>
                    <button
                      type="button"
                      className="btn xs"
                      onClick={() => run({ action: 'mirror-bone', boneId: bone.id })}
                      title="Tạo bản sao đối xứng Trái ⇄ Phải qua trục X = 0 cho xương này và toàn bộ nhánh con"
                    >
                      <IconBoneMirror width={11} height={11} />
                      <span>Đối xứng L⇄R</span>
                    </button>
                    <button
                      type="button"
                      className="btn xs"
                      onClick={() => selectBone(null)}
                      title="Bỏ chọn xương hiện tại"
                    >
                      Bỏ chọn
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="lw-bone-list" role="listbox" aria-label="Danh sách xương">
              {bones.map((b) => {
                const isSelected = b.id === boneId
                const side = classifyBoneSide(b)
                const depth = Math.min(6, depthMap.get(b.id) ?? 0)
                const boundLayersCount = composite.layers.filter((l) => l.boneId === b.id).length
                return (
                  <div
                    key={b.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectBone(b.id)}
                    className={`lw-bone-item side-${side}${isSelected ? ' active' : ''}`}
                    style={{ paddingLeft: `${8 + depth * 12}px` }}
                  >
                    <div className="lw-bone-item-label">
                      <span className={`lw-bone-side-dot side-${side}`} title={`Nhóm ${side.toUpperCase()}`} />
                      <span className="lw-bone-item-indent">{b.pin ? '📌' : depth > 0 ? '↳' : '◇'}</span>
                      <span className="lw-bone-item-name">{b.name}</span>
                      {boundLayersCount > 0 && <span className="lw-bone-item-count">{boundLayersCount} lớp</span>}
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
                <div className="lw-rig-empty-hint">
                  <p>Chưa có xương nào trên nhân vật / vật thể.</p>
                  <div className="lw-rig-empty-actions">
                    <button type="button" className="btn xs primary" onClick={() => switchTool('add')}>
                      <IconBoneAdd width={12} height={12} /> Bật Vẽ xương (A) trên khung 2D
                    </button>
                    <button type="button" className="btn xs" onClick={() => setSubTab('autorig')}>
                      <IconAutoRigSpark width={12} height={12} /> Mở Auto-Rig & Mẫu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {bone && (
            <div className="lw-card-section">
              <div className="lw-card-header">
                <span className="lw-card-title">Khớp: {bone.name}</span>
                <span className="lw-card-badge">
                  {bone.pin ? 'Pin Bone' : `R=${Math.round(computeBoneInfluenceRadius(bone))}px`}
                </span>
              </div>

              <div className="lw-form-group">
                <label className="lw-form-label" htmlFor="lw-bone-name-input">
                  Tên xương:
                </label>
                <input
                  id="lw-bone-name-input"
                  className="lw-field-input"
                  aria-label="Tên xương"
                  value={bone.name}
                  onChange={(e) => e.target.value.trim() && patch({ name: e.target.value })}
                />
              </div>

              <div className="lw-form-group">
                <span className="lw-form-label">Xương cha (Phân cấp FK/IK):</span>
                <Select
                  size="sm"
                  dropdownWidth={280}
                  style={{ width: '100%' }}
                  value={bone.parentId ?? ''}
                  options={[
                    { value: '', label: 'Không có (Xương gốc Root)' },
                    ...bones.filter((b) => b.id !== bone.id).map((b) => ({ value: b.id, label: b.name }))
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

              {/* Moho Bone Strength / Influence Slider */}
              <div className="lw-moho-strength-row">
                <div className="lw-moho-strength-head">
                  <span>Vùng ảnh hưởng Mesh (Strength)</span>
                  <strong>{Math.round((bone.strength ?? 1) * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={3.0}
                  step={0.05}
                  value={bone.strength ?? 1}
                  aria-label="Vùng ảnh hưởng xương"
                  onChange={(e) => patch({ strength: Number(e.target.value) })}
                />
              </div>

              {/hand|wrist|finger|palm|bàn tay|cổ tay|ngón/i.test(bone.id + ' ' + (bone.name || '')) && (
                <div className="lw-limb-quick-box">
                  <div className="lw-limb-quick-title">Góc nhanh Bàn tay:</div>
                  <div className="lw-limb-quick-pills">
                    {[
                      { label: 'Thẳng 90°', angle: 90 },
                      { label: 'Nắm 55°', angle: 55 },
                      { label: 'Ngửa 135°', angle: 135 },
                      { label: 'Xuôi 75°', angle: 75 }
                    ].map((item) => (
                      <button key={item.label} type="button" className="btn xs" onClick={() => patch({ angle: item.angle })}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/foot|ankle|toe|heel|bàn chân|cổ chân|mũi chân|gót/i.test(bone.id + ' ' + (bone.name || '')) && (
                <div className="lw-limb-quick-box">
                  <div className="lw-limb-quick-title">Góc nhanh Bàn chân:</div>
                  <div className="lw-limb-quick-pills">
                    {[
                      { label: 'Phẳng 0°', angle: 0 },
                      { label: 'Nhón +30°', angle: 30 },
                      { label: 'Gót -25°', angle: -25 },
                      { label: 'Bước +12°', angle: 12 }
                    ].map((item) => (
                      <button key={item.label} type="button" className="btn xs" onClick={() => patch({ angle: item.angle })}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                <button
                  type="button"
                  className="btn xs"
                  onClick={() => patch({ pin: !bone.pin, ...(bone.pin ? { length: Math.max(40, bone.length) } : { length: 16 }) })}
                  title="Chuyển đổi giữa Xương thường và Chốt Pin Bone (Moho Pin Bone)"
                >
                  {bone.pin ? '🦴 Đổi thành Xương dài' : '📌 Đổi thành Pin Bone'}
                </button>
                <button
                  type="button"
                  className="btn xs danger"
                  style={{ color: 'var(--danger, #ef4444)' }}
                  onClick={() => handleDeleteBone(bone.id)}
                  title="Xóa xương này và toàn bộ nhánh con (Del)"
                >
                  <IconTrash width={11} height={11} />
                  <span>Xóa xương</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* SUB-TAB 2: FLEXI-BIND MESH MỀM & LAYER-BIND */}
      {subTab === 'binding' && (
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
              onChange={(val) => handleLayerSelectChange(String(val))}
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
              onClick={() => bone && targetIds.length && run({ action: 'bind', boneId: bone.id, layerIds: targetIds, mode: 'soft' })}
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
                        <span onClick={() => handleLayerSelectChange(l.id)} title="Bấm để chọn lớp này">
                          {l.name}{' '}
                          <small style={{ color: l.bindingMode === 'soft' ? 'var(--accent-cyan)' : 'var(--key)' }}>
                            ({l.bindingMode === 'soft' ? 'Flexi-Mesh' : 'Layer-Bind'})
                          </small>
                        </span>
                        <button
                          type="button"
                          className="btn xs"
                          onClick={() => run({ action: 'bind', layerIds: [l.id] })}
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
      )}

      {/* SUB-TAB 3: AUTO-RIG MIXAMO, SMART 2.5D & KHUÔN MẪU XƯƠNG */}
      {subTab === 'autorig' && (
        <>
          <WorkshopMixamoRigCard composite={composite} run={run} />
          <WorkshopSmartRig25DCard composite={composite} run={run} />

          <div className="lw-card-section">
            <div className="lw-card-header">
              <span className="lw-card-title">Mẫu khung xương giải phẫu</span>
            </div>
            <div className="lw-template-grid">
              {[
                { id: 'humanoid', label: 'Người 2D (15 khớp)', desc: 'Thân, đầu, tay, chân chuẩn' },
                { id: 'humanoid-full', label: 'Người chi tiết (19 khớp)', desc: 'Thêm bàn tay & mũi chân' },
                { id: 'hand-detailed', label: 'Bàn tay (12 khớp)', desc: 'Cổ tay & 5 ngón độc lập' },
                { id: 'foot-detailed', label: 'Bàn chân (8 khớp)', desc: 'Cổ chân, gót & mũi nhón' },
                { id: 'simple-chain', label: 'Chuỗi uốn (3 khớp)', desc: 'Đuôi, áo choàng, thân cây' }
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="lw-preset-btn lw-template-card-btn"
                  onClick={() => {
                    run({ action: 'apply-template', template: tpl.id as any })
                    setSubTab('hierarchy')
                  }}
                >
                  <strong>{tpl.label}</strong>
                  <small>{tpl.desc}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
