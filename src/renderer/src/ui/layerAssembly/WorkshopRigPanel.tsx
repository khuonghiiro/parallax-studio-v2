import { useMemo, useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { findMirrorBoneId, type RigAction } from './workshopRig'
import { IconPlus } from '../icons'
import { SegmentedTabs } from '../primitives'
import { WorkshopMixamoRigCard } from './WorkshopMixamoRigCard'
import { WorkshopSmartRig25DCard } from './WorkshopSmartRig25DCard'
import { WorkshopRigBindingSection } from './WorkshopRigBindingSection'
import { WorkshopCreatureRigCard } from './WorkshopCreatureRigCard'
import { WorkshopBoneBuilderCard } from './WorkshopBoneBuilderCard'
import { BoneInspectorCard, BoneTreeCard } from './WorkshopBoneInspector'
import { resetTestPoses, setRigToolState, useRigToolStore, type MohoRigTool } from './rigToolStore'
import { computeBoneDepthMap, summarizeWeldableJoints, withSymmetricBoneAction } from './mohoRigHelpers'
import {
  IconAutoRigSpark,
  IconBoneAdd,
  IconBoneChainBuild,
  IconBoneHierarchy,
  IconBoneManipulate,
  IconBoneMirror,
  IconBoneSelect,
  IconBoneStrength,
  IconBoneWeld,
  IconFlexiMeshBind
} from './LayerWorkshopStudioIcons'

export { RigNumber } from './RigNumber'

export interface RigPanelProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  selectedIds: string[]
  selectedLayerId?: string | null
  selectLayer?: (id: string | null) => void
  run: (action: RigAction) => void
}

/** 4 phân khu: Cây xương · Thủ công (dựng kết cấu tay) · Gắn Mesh · Tự động (thư viện sinh vật, Mixamo, 2.5D). */
export type RigSubTab = 'hierarchy' | 'build' | 'binding' | 'autorig'

const MOHO_RIG_TOOLS: Array<{ id: MohoRigTool; label: string; hotkey: string; title: string; Icon: typeof IconBoneSelect }> = [
  { id: 'select', label: 'Chọn', hotkey: 'S', title: 'Chọn xương (Phím S): Kéo khớp gốc để dời vị trí, kéo ngọn để chỉnh độ dài & góc xương', Icon: IconBoneSelect },
  { id: 'add', label: 'Vẽ xương', hotkey: 'A', title: 'Vẽ thêm xương trên khung 2D (Phím A): Bấm-kéo để tạo chuỗi xương con, click nhẹ để đặt Chốt Pin Bone, giữ Alt để tạo xương gốc mới', Icon: IconBoneAdd },
  { id: 'strength', label: 'Vùng uốn', hotkey: 'T', title: 'Vùng ảnh hưởng xương (Phím T): Kéo viền viên nang xung quanh xương để chỉnh bán kính uốn Flexi-Bind Mesh', Icon: IconBoneStrength },
  { id: 'manipulate', label: 'Thử khớp', hotkey: 'Z', title: 'Thử bẻ khớp trực tiếp (Phím Z): Kéo bẻ xương IK/FK ngay tại Frame 0 (tôn trọng giới hạn góc khớp) mà không tạo keyframe', Icon: IconBoneManipulate }
]

function useRigToggles(bones: LayerBone[], run: (a: RigAction) => void) {
  const rigTool = useRigToolStore()
  const weldSummary = useMemo(() => summarizeWeldableJoints(bones, 0.45), [bones])
  const toggleInfluence = () => {
    const next = !rigTool.showInfluence
    setRigToolState({
      showInfluence: next,
      statusHint: next ? 'Vỏ uốn BẬT: hiển thị viên nang bán kính uốn Mesh & nút kéo trên xương đang chọn.' : 'Vỏ uốn TẮT: đã ẩn khung viên nang vùng ảnh hưởng trên sân khấu 2D.'
    })
  }
  const toggleMirror = () => {
    const next = !rigTool.mirrorDraw
    setRigToolState({
      mirrorDraw: next,
      statusHint: next ? 'Đối xứng L⇄R BẬT: hiện trục X = 0, mọi thao tác chỉnh / vẽ / bẻ xương tự phản chiếu sang bên kia.' : 'Đối xứng L⇄R TẮT: chỉnh từng bên xương độc lập.'
    })
  }
  const weld = () => {
    run({ action: 'snap-joints' })
    setRigToolState({ autoWeld: true, statusHint: `Đã hàn khít ${weldSummary.looseCount} khớp hở (${weldSummary.totalChains} khớp chuỗi).` })
  }
  const toggleWeld = () => {
    if (rigTool.autoWeld && weldSummary.looseCount > 0 && bones.length >= 2) return weld()
    const next = !rigTool.autoWeld
    if (next && bones.length >= 2) run({ action: 'snap-joints' })
    const onHint =
      bones.length < 2
        ? 'Hàn khớp BẬT: khi thêm từ 2 xương nối nhau sẽ tự động bám khít khớp cha-con.'
        : `Hàn khớp BẬT: ${weldSummary.totalChains} khớp chuỗi đang khít 100% (giữ Alt khi kéo để tách rời).`
    setRigToolState({ autoWeld: next, statusHint: next ? onHint : 'Hàn khớp TẮT: kéo khớp gốc/ngọn tự do, không tự co giãn xương cha nối cùng.' })
  }
  return { rigTool, weldSummary, toggleInfluence, toggleMirror, toggleWeld, weld }
}

function RigToolbelt({ bones, bone, run, onAdd, switchTool }: { bones: LayerBone[]; bone?: LayerBone; run: (a: RigAction) => void; onAdd: () => void; switchTool: (t: MohoRigTool) => void }) {
  const { rigTool, weldSummary, toggleInfluence, toggleMirror, toggleWeld, weld } = useRigToggles(bones, run)
  const hasTestPose = Object.keys(rigTool.testPoses).length > 0
  return (
    <div className="lw-moho-toolbelt-card" data-mcp-region="layer_assembly_rig_tools">
      <div className="lw-moho-frame0-bar">
        <span className={`lw-frame-mode-badge${rigTool.tool === 'manipulate' ? ' is-testing' : ' is-setup'}`}>
          {rigTool.tool === 'manipulate' ? '⚡ THỬ KHỚP IK/FK (Z)' : '◇ FRAME 0 · DÁNG GỐC'}
        </span>
        {rigTool.tool === 'manipulate' && hasTestPose ? (
          <button type="button" className="btn xs lw-reset-test-btn" onClick={resetTestPoses} title="Trả toàn bộ xương đang bẻ thử về tư thế gốc Frame 0">
            ↺ Về Frame 0
          </button>
        ) : (
          <button type="button" className="btn xs primary" onClick={onAdd} title="Thêm xương mới nối từ xương đang chọn (hoặc xương gốc)">
            <IconPlus width={11} height={11} />
            <span>{bone ? 'Xương con' : 'Xương gốc'}</span>
          </button>
        )}
      </div>
      <div className="lw-moho-tool-grid" role="radiogroup" aria-label="Công cụ tạo xương Moho">
        {MOHO_RIG_TOOLS.map(({ id, label, hotkey, title, Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={rigTool.tool === id} className={`lw-moho-tool-btn${rigTool.tool === id ? ' active' : ''}`} onClick={() => switchTool(id)} title={title}>
            <Icon width={14} height={14} />
            <span className="lw-moho-tool-label">{label}</span>
            <kbd>{hotkey}</kbd>
          </button>
        ))}
      </div>
      <div className="lw-moho-tool-options">
        <button type="button" aria-pressed={rigTool.showInfluence} className={`lw-moho-opt-pill${rigTool.showInfluence ? ' active' : ''}`} onClick={toggleInfluence} title="Hiện/ẩn lớp vỏ viên nang Vùng ảnh hưởng xương (Moho Bone Strength Envelope)">
          <IconBoneStrength width={12} height={12} />
          <span>Vỏ uốn</span>
        </button>
        <button type="button" aria-pressed={rigTool.mirrorDraw} className={`lw-moho-opt-pill${rigTool.mirrorDraw ? ' active' : ''}`} onClick={toggleMirror} title="Chế độ Đối xứng L⇄R qua trục X = 0: tự động phản chiếu khi vẽ, chỉnh khớp, vùng uốn, giới hạn góc và thử bẻ khớp">
          <IconBoneMirror width={12} height={12} />
          <span>Đối xứng</span>
        </button>
        <button type="button" aria-pressed={rigTool.autoWeld} className={`lw-moho-opt-pill${rigTool.autoWeld ? ' active' : ''}`} onClick={toggleWeld} title="Tự động hàn khít khớp nối cha-con khi kéo chỉnh xương & hàn ngay các khớp chuỗi đang bị lệch (giữ Alt khi kéo để tách rời)">
          <IconBoneWeld width={12} height={12} />
          <span>Hàn khớp{weldSummary.looseCount > 0 ? ` (${weldSummary.looseCount})` : ''}</span>
        </button>
      </div>
      {(rigTool.statusHint || weldSummary.looseCount > 0) && (
        <div className="lw-moho-opt-status">
          <span>{rigTool.statusHint || `Phát hiện ${weldSummary.looseCount} khớp chuỗi đang hở — bấm "Hàn khớp" để khít ngay 100%.`}</span>
          {weldSummary.looseCount > 0 && bones.length >= 2 && (
            <button type="button" className="btn xs primary" onClick={weld}>
              Khít ngay
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const TEMPLATES = [
  { id: 'humanoid', label: 'Người 2D (15 khớp)', desc: 'Thân, đầu, tay, chân chuẩn' },
  { id: 'humanoid-full', label: 'Người chi tiết (19 khớp)', desc: 'Thêm bàn tay & mũi chân' },
  { id: 'hand-detailed', label: 'Bàn tay (12 khớp)', desc: 'Cổ tay & 5 ngón độc lập' },
  { id: 'foot-detailed', label: 'Bàn chân (8 khớp)', desc: 'Cổ chân, gót & mũi nhón' },
  { id: 'simple-chain', label: 'Chuỗi uốn (3 khớp)', desc: 'Đuôi, áo choàng, thân cây' }
] as const

function AutoRigSection({ composite, run, onApplied }: { composite: LayerComposite; run: (a: RigAction) => void; onApplied: () => void }) {
  return (
    <>
      <WorkshopCreatureRigCard composite={composite} run={run} />
      <WorkshopMixamoRigCard composite={composite} run={run} />
      <WorkshopSmartRig25DCard composite={composite} run={run} />
      <div className="lw-card-section">
        <div className="lw-card-header">
          <span className="lw-card-title">Mẫu khung xương người & chi</span>
        </div>
        <div className="lw-template-grid">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="lw-preset-btn lw-template-card-btn"
              onClick={() => {
                run({ action: 'apply-template', template: tpl.id })
                onApplied()
              }}
            >
              <strong>{tpl.label}</strong>
              <small>{tpl.desc}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export function WorkshopRigPanel({ composite, boneId, selectBone, selectedIds, selectedLayerId, selectLayer, run }: RigPanelProps) {
  const bones = composite.rig?.bones ?? []
  const bone = bones.find((b) => b.id === boneId)
  const selected = composite.layers.filter((l) => selectedIds.includes(l.id))
  const [localLayerId, setLocalLayerId] = useState<string>('')
  const [subTab, setSubTab] = useState<RigSubTab>(() => (bones.length > 0 ? 'hierarchy' : 'autorig'))
  const rigTool = useRigToolStore()
  const depthMap = useMemo(() => computeBoneDepthMap(bones), [bones])
  const mirrorTwin = useMemo(() => {
    const id = bone ? findMirrorBoneId(bone.id, bones) : null
    return id ? (bones.find((b) => b.id === id) ?? null) : null
  }, [bone, bones])

  const activeLayerId = (selected.length > 0 ? selected[0].id : localLayerId || selectedLayerId) || composite.layers[0]?.id || ''
  const targetIds = selected.length > 0 ? selectedIds : activeLayerId ? [activeLayerId] : []
  const boundLayersTotal = composite.layers.filter((l) => Boolean(l.boneId)).length

  const switchTool = (nextTool: MohoRigTool) => {
    if (nextTool !== 'manipulate') resetTestPoses()
    setRigToolState({ tool: nextTool, ...(nextTool === 'strength' ? { showInfluence: true } : {}) })
  }

  const add = () => {
    const radians = ((bone?.angle ?? -90) * Math.PI) / 180
    const next: LayerBone = {
      id: `bone-${crypto.randomUUID()}`,
      name: `Xương ${bones.length + 1}`,
      parentId: bone?.id,
      x: bone ? Math.round(bone.x + Math.cos(radians) * bone.length) : selected[0]?.x ?? 0,
      y: bone ? Math.round(bone.y + Math.sin(radians) * bone.length) : selected[0]?.y ?? 0,
      length: 75,
      angle: -90,
      strength: 1
    }
    run({ action: 'add-bone', bone: next })
    if (rigTool.mirrorDraw && Math.abs(next.x) > 10) run({ action: 'mirror-bone', boneId: next.id })
    const unboundTargets = targetIds.filter((id) => !composite.layers.find((l) => l.id === id)?.boneId)
    if (unboundTargets.length > 0) run({ action: 'bind', boneId: next.id, layerIds: unboundTargets, mode: 'soft' })
    selectBone(next.id)
    if (subTab === 'autorig') setSubTab('hierarchy')
  }

  const patch = (nextPatch: Partial<LayerBone>) => {
    if (!bone) return
    const baseAction: RigAction = { action: 'update-bone', boneId: bone.id, patch: nextPatch }
    run(withSymmetricBoneAction(bones, baseAction, rigTool.mirrorDraw, findMirrorBoneId) as RigAction)
  }

  const handleDeleteBone = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    run({ action: 'delete-bone', boneId: id })
    if (boneId === id) selectBone(null)
  }

  return (
    <div className="lw-rig-panel" data-mcp-region="layer_assembly_rig_panel">
      <RigToolbelt bones={bones} bone={bone} run={run} onAdd={add} switchTool={switchTool} />
      <SegmentedTabs<RigSubTab>
        variant="segmented"
        size="sm"
        adaptiveCompact
        ariaLabel="Phân khu Tạo xương"
        value={subTab}
        onChange={setSubTab}
        items={[
          { id: 'hierarchy', label: 'Cây xương', icon: <IconBoneHierarchy width={12} height={12} />, title: `Cây phân cấp (${bones.length} xương), thuộc tính khớp & giới hạn góc` },
          { id: 'build', label: 'Thủ công', icon: <IconBoneChainBuild width={12} height={12} />, title: 'Dựng kết cấu xương bằng tay: chuỗi đốt, chia đốt, nhân chi vòng tròn, đối xứng' },
          { id: 'binding', label: 'Gắn Mesh', icon: <IconFlexiMeshBind width={12} height={12} />, badge: `${boundLayersTotal}/${composite.layers.length}`, title: 'Gắn layer cứng / uốn mềm Flexi-Bind' },
          { id: 'autorig', label: 'Tự động', icon: <IconAutoRigSpark width={12} height={12} />, title: 'Thư viện khung xương sinh vật (nhện, cá, ngựa, chim…), Mixamo & Smart 2.5D' }
        ]}
      />
      {subTab === 'hierarchy' && (
        <>
          <BoneTreeCard
            composite={composite}
            bones={bones}
            boneId={boneId}
            depthMap={depthMap}
            selectBone={selectBone}
            onDelete={handleDeleteBone}
            onMirror={(id) => run({ action: 'mirror-bone', boneId: id })}
            onStartDraw={() => switchTool('add')}
            onOpenBuild={() => setSubTab('build')}
            onOpenAuto={() => setSubTab('autorig')}
          />
          {bone && <BoneInspectorCard bone={bone} bones={bones} mirrorTwin={mirrorTwin} mirrorDraw={rigTool.mirrorDraw} patch={patch} onDelete={handleDeleteBone} />}
        </>
      )}
      {subTab === 'build' && <WorkshopBoneBuilderCard bones={bones} bone={bone} run={run} selectBone={selectBone} switchTool={switchTool} />}
      {subTab === 'binding' && (
        <WorkshopRigBindingSection
          composite={composite}
          bones={bones}
          bone={bone}
          activeLayerId={activeLayerId}
          targetIds={targetIds}
          onSelectLayer={(id) => {
            setLocalLayerId(id)
            selectLayer?.(id || null)
          }}
          run={run}
        />
      )}
      {subTab === 'autorig' && <AutoRigSection composite={composite} run={run} onApplied={() => setSubTab('hierarchy')} />}
    </div>
  )
}
