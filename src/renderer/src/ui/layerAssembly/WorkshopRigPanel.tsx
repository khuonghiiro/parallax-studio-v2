import { useMemo, useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { findMirrorBoneId, type RigAction } from './workshopRig'
import { Select } from '../controls'
import { IconPlus, IconTrash } from '../icons'
import { SegmentedTabs } from '../primitives'
import { WorkshopMixamoRigCard } from './WorkshopMixamoRigCard'
import { WorkshopSmartRig25DCard } from './WorkshopSmartRig25DCard'
import { WorkshopRigBindingSection } from './WorkshopRigBindingSection'
import {
  resetTestPoses,
  setRigToolState,
  useRigToolStore,
  type MohoRigTool
} from './rigToolStore'
import {
  classifyBoneSide,
  computeBoneDepthMap,
  computeBoneInfluenceRadius,
  summarizeWeldableJoints,
  withSymmetricBoneAction
} from './mohoRigHelpers'
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
  const weldSummary = useMemo(() => summarizeWeldableJoints(bones, 0.45), [bones])
  const hasTestPose = Object.keys(rigTool.testPoses).length > 0
  const mirrorTwinId = useMemo(
    () => (bone ? findMirrorBoneId(bone.id, bones) : null),
    [bone, bones]
  )
  const mirrorTwin = useMemo(
    () => (mirrorTwinId ? bones.find((b) => b.id === mirrorTwinId) ?? null : null),
    [mirrorTwinId, bones]
  )

  const activeLayerId =
    (selected.length > 0 ? selected[0].id : localLayerId || selectedLayerId) || composite.layers[0]?.id || ''
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

  const handleToggleInfluence = () => {
    const next = !rigTool.showInfluence
    setRigToolState({
      showInfluence: next,
      statusHint: next
        ? 'Vỏ uốn BẬT: hiển thị viên nang bán kính uốn Mesh & nút kéo trên xương đang chọn.'
        : 'Vỏ uốn TẮT: đã ẩn khung viên nang vùng ảnh hưởng trên sân khấu 2D.'
    })
  }

  const handleToggleMirror = () => {
    const next = !rigTool.mirrorDraw
    setRigToolState({
      mirrorDraw: next,
      statusHint: next
        ? 'Đối xứng L⇄R BẬT: hiện trục X = 0, mọi thao tác chỉnh / vẽ / bẻ xương tự phản chiếu sang bên kia.'
        : 'Đối xứng L⇄R TẮT: chỉnh từng bên xương độc lập.'
    })
  }

  const handleToggleWeld = () => {
    if (rigTool.autoWeld && weldSummary.looseCount > 0 && bones.length >= 2) {
      run({ action: 'snap-joints' })
      setRigToolState({
        autoWeld: true,
        statusHint: `Đã hàn khít ${weldSummary.looseCount} khớp lệch (${weldSummary.totalChains} khớp chuỗi khít 100%).`
      })
      return
    }
    const next = !rigTool.autoWeld
    if (next && bones.length >= 2) {
      run({ action: 'snap-joints' })
    }
    setRigToolState({
      autoWeld: next,
      statusHint: next
        ? bones.length < 2
          ? 'Hàn khớp BẬT: khi thêm từ 2 xương nối nhau sẽ tự động bám khít khớp cha-con.'
          : weldSummary.looseCount > 0
            ? `Hàn khớp BẬT & đã khít ngay ${weldSummary.looseCount} khớp hở (${weldSummary.totalChains} khớp chuỗi).`
            : `Hàn khớp BẬT: ${weldSummary.totalChains} khớp chuỗi đang khít 100% (giữ Alt khi kéo để tách rời).`
        : 'Hàn khớp TẮT: kéo khớp gốc/ngọn tự do, không tự co giãn xương cha nối cùng.'
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
    if (rigTool.mirrorDraw && Math.abs(next.x) > 10) {
      run({ action: 'mirror-bone', boneId: next.id })
    }
    const unboundTargets = targetIds.filter((id) => !composite.layers.find((l) => l.id === id)?.boneId)
    if (unboundTargets.length > 0) {
      run({ action: 'bind', boneId: next.id, layerIds: unboundTargets, mode: 'soft' })
    }
    selectBone(next.id)
    if (subTab === 'autorig') setSubTab('hierarchy')
  }

  const patch = (nextPatch: Partial<LayerBone>) => {
    if (!bone) return
    const baseAction: RigAction = { action: 'update-bone', boneId: bone.id, patch: nextPatch }
    const finalAction = withSymmetricBoneAction(bones, baseAction, rigTool.mirrorDraw, findMirrorBoneId) as RigAction
    run(finalAction)
  }

  const handleDeleteBone = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    run({ action: 'delete-bone', boneId: id })
    if (boneId === id) selectBone(null)
  }

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
            aria-pressed={rigTool.showInfluence}
            className={`lw-moho-opt-pill${rigTool.showInfluence ? ' active' : ''}`}
            onClick={handleToggleInfluence}
            title="Hiện/ẩn lớp vỏ viên nang Vùng ảnh hưởng xương (Moho Bone Strength Envelope) & nút kéo bán kính trên xương đang chọn"
          >
            <IconBoneStrength width={12} height={12} />
            <span>Vỏ uốn</span>
          </button>
          <button
            type="button"
            aria-pressed={rigTool.mirrorDraw}
            className={`lw-moho-opt-pill${rigTool.mirrorDraw ? ' active' : ''}`}
            onClick={handleToggleMirror}
            title="Chế độ Đối xứng L⇄R qua trục X = 0: tự động phản chiếu khi vẽ xương, kéo chỉnh khớp, chỉnh vùng uốn và thử bẻ khớp"
          >
            <IconBoneMirror width={12} height={12} />
            <span>Đối xứng</span>
          </button>
          <button
            type="button"
            aria-pressed={rigTool.autoWeld}
            className={`lw-moho-opt-pill${rigTool.autoWeld ? ' active' : ''}`}
            onClick={handleToggleWeld}
            title="Tự động hàn khít khớp nối cha-con khi kéo chỉnh xương & hàn ngay các khớp chuỗi đang bị lệch (giữ Alt khi kéo để tách rời)"
          >
            <IconBoneWeld width={12} height={12} />
            <span>
              Hàn khớp{weldSummary.looseCount > 0 ? ` (${weldSummary.looseCount})` : ''}
            </span>
          </button>
        </div>

        {(rigTool.statusHint || weldSummary.looseCount > 0) && (
          <div className="lw-moho-opt-status">
            <span>
              {rigTool.statusHint ||
                `Phát hiện ${weldSummary.looseCount} khớp chuỗi đang hở — bấm "Hàn khớp" để khít ngay 100%.`}
            </span>
            {weldSummary.looseCount > 0 && bones.length >= 2 && (
              <button
                type="button"
                className="btn xs primary"
                onClick={() => {
                  run({ action: 'snap-joints' })
                  setRigToolState({
                    autoWeld: true,
                    statusHint: `Đã hàn khít ${weldSummary.looseCount} khớp hở (${weldSummary.totalChains} khớp chuỗi).`
                  })
                }}
              >
                Khít ngay
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Thanh 3 Sub-Tabs gọn gàng */}
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
                      <span>Nhân bản L⇄R</span>
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

              {rigTool.mirrorDraw && mirrorTwin && (
                <div className="lw-mirror-pair-note">
                  <IconBoneMirror width={11} height={11} />
                  <span>Đang đồng bộ đối xứng với &ldquo;{mirrorTwin.name}&rdquo;</span>
                </div>
              )}

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
        <WorkshopRigBindingSection
          composite={composite}
          bones={bones}
          bone={bone}
          activeLayerId={activeLayerId}
          targetIds={targetIds}
          onSelectLayer={handleLayerSelectChange}
          run={run}
        />
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
