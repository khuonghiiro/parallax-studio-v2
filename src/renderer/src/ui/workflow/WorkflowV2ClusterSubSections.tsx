import React from 'react'
import type { Layer, LayerMotionType, Vec3, WorkflowNodeParams } from '@shared/types'
import {
  WORKFLOW_V2_RIG_PRESET_OPTIONS,
  attachExternalLayerToClusterV2,
  getClusterPartShortName,
  updateClusterMemberOffsetV2,
  type ClusterExpressionEntry
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { rescaleModel3DInstance } from '../assets/models3d/insertModel3D'
import { CompositePartSwapSection } from '../inspector/sections/CompositePartSwapSection'
import { batchClearCompositeMotion, batchKeyframeCompositeTransform } from '../layerAssembly/compositeOps'
import { OptionPills, ParamSlider } from './WorkflowV2NodeParams'
import { getCheckerboardPalette, usePreviewCheckerTheme } from './alphaTrimmedPreview'

const CLUSTER_MOTION_PILLS: { id: LayerMotionType; label: string }[] = [
  { id: 'sway', label: '🌿 Đung đưa' },
  { id: 'pulse', label: '💓 Nhịp thở' },
  { id: 'float', label: '☁️ Bồng bềnh' },
  { id: 'wiggle', label: '⚡ Rung rinh' },
  { id: 'wind', label: '💨 Gió thổi' }
]

type UpdateFn = (patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void

export function Cluster3DTransformSection({
  model3d,
  onOpenWorkshop3D
}: {
  model3d: NonNullable<Layer['model3d']>
  onOpenWorkshop3D: () => void
}): React.ReactElement {
  const modelScale = model3d.globalScale ?? 1.0
  const modelCenter: Vec3 = model3d.centerPosition ?? [0, 0, 0]
  return (
    <>
      <div className="wf-v2-insp-subhead">🧊 Biến đổi Khối Mô hình 3D ({model3d.modelName})</div>
      <ParamSlider
        label="Tỉ lệ khối 3D"
        min={0.1}
        max={3.0}
        step={0.05}
        value={modelScale}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => rescaleModel3DInstance(model3d.instanceId, Number(v.toFixed(2)))}
      />
      <ParamSlider
        label="Tâm X"
        min={-1600}
        max={1600}
        step={10}
        value={Math.round(modelCenter[0])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => rescaleModel3DInstance(model3d.instanceId, modelScale, [v, modelCenter[1], modelCenter[2]])}
      />
      <ParamSlider
        label="Tâm Y"
        min={-1200}
        max={1200}
        step={10}
        value={Math.round(modelCenter[1])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => rescaleModel3DInstance(model3d.instanceId, modelScale, [modelCenter[0], v, modelCenter[2]])}
      />
      <ParamSlider
        label="Tâm Z"
        min={-600}
        max={3600}
        step={20}
        value={Math.round(modelCenter[2])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => rescaleModel3DInstance(model3d.instanceId, modelScale, [modelCenter[0], modelCenter[1], v])}
      />
      <button type="button" className="wf-v2-ghost-btn" onClick={onOpenWorkshop3D}>
        🧊 Mở Xưởng Lắp Ráp 3D (Chỉnh các mặt phẳng)
      </button>
    </>
  )
}

export function Cluster25DTransformSection({
  instId,
  rootPos,
  scalePct,
  onUpdate,
  onOpenWorkshop25D
}: {
  instId?: string
  rootPos: Vec3
  scalePct: number
  onUpdate: UpdateFn
  onOpenWorkshop25D: () => void
}): React.ReactElement {
  return (
    <>
      <div className="wf-v2-insp-subhead">📐 Vị trí &amp; Tỉ lệ đồng bộ cả Cụm 2.5D</div>
      <ParamSlider
        label="Vị trí Cụm X"
        min={-1600}
        max={1600}
        step={10}
        value={Math.round(rootPos[0])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => onUpdate({ transformX: v })}
      />
      <ParamSlider
        label="Vị trí Cụm Y"
        min={-1200}
        max={1200}
        step={10}
        value={Math.round(rootPos[1])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => onUpdate({ transformY: v })}
      />
      <ParamSlider
        label="Độ sâu Cụm Z"
        min={-600}
        max={3600}
        step={10}
        value={Math.round(rootPos[2])}
        format={(v) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)}
        onChange={(v) => onUpdate({ transformZ: v })}
      />
      <ParamSlider
        label="Tỉ lệ cả cụm"
        min={15}
        max={250}
        step={2}
        value={scalePct}
        format={(v) => `${Math.round(v)}%`}
        onChange={(v) => onUpdate({ clusterScalePct: Math.round(v) })}
      />
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {instId && (
          <button
            type="button"
            className="wf-v2-ghost-btn"
            onClick={() => batchKeyframeCompositeTransform(instId)}
            title="Đặt keyframe Vị trí, Xoay, Tỉ lệ tại thời điểm hiện tại cho toàn bộ các mảnh trong cụm"
          >
            🔑 Keyframe cả cụm
          </button>
        )}
        <button
          type="button"
          className="wf-v2-ghost-btn"
          onClick={onOpenWorkshop25D}
          title="Mở cụm này trong Xưởng Lắp Ráp Layer 2.5D để chỉnh xương IK, ghim khớp và lưới đàn hồi"
        >
          🛠 Mở Xưởng 2.5D
        </button>
      </div>
    </>
  )
}

export function ClusterRigAndMotionSection({
  instId,
  rootLayer,
  rigActionPreset,
  motionAmp,
  motionSpeed,
  staggerPhase,
  onSetMotionAmp,
  onSetMotionSpeed,
  onSetStaggerPhase,
  onApplyClusterMotion,
  onUpdate
}: {
  instId: string
  rootLayer?: Layer
  rigActionPreset?: WorkflowNodeParams['rigActionPreset']
  motionAmp: number
  motionSpeed: number
  staggerPhase: boolean
  onSetMotionAmp: (v: number) => void
  onSetMotionSpeed: (v: number) => void
  onSetStaggerPhase: (v: boolean) => void
  onApplyClusterMotion: (mType: LayerMotionType) => void
  onUpdate: UpdateFn
}): React.ReactElement {
  return (
    <>
      <div className="wf-v2-insp-subhead">🦴 Hoạt ảnh Xương Nhân vật 2.5D (Rig Animation)</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {WORKFLOW_V2_RIG_PRESET_OPTIONS.map((opt) => {
          const active = rigActionPreset === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              className={`wf-v2-opt-pill${active ? ' active' : ''}`}
              title={opt.description}
              onClick={() => onUpdate({ rigActionPreset: opt.id })}
            >
              {opt.shortLabel}
            </button>
          )
        })}
        <button
          type="button"
          className={`wf-v2-opt-pill${!rigActionPreset || rigActionPreset === 'none' ? ' active' : ''}`}
          title="Gỡ keyframe hành động xương và trả cụm về tư thế đứng chuẩn"
          onClick={() => onUpdate({ rigActionPreset: 'none' })}
        >
          ⏹ Tắt Rig xương
        </button>
      </div>

      <div className="wf-v2-insp-subhead">🌊 Motion Chu kỳ Đồng bộ Cả Cụm</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {CLUSTER_MOTION_PILLS.map((m) => {
          const active = rootLayer?.motion?.enabled && rootLayer?.motion?.type === m.id
          return (
            <button
              key={m.id}
              type="button"
              className={`wf-v2-opt-pill${active ? ' active' : ''}`}
              onClick={() => onApplyClusterMotion(m.id)}
            >
              {m.label}
            </button>
          )
        })}
        <button
          type="button"
          className="wf-v2-opt-pill"
          onClick={() => batchClearCompositeMotion(instId)}
          title="Tắt chuyển động chu kỳ trên toàn bộ các mảnh của cụm"
        >
          ⏹ Xoá Motion
        </button>
      </div>
      <ParamSlider
        label="Biên độ lắc"
        min={2}
        max={45}
        step={1}
        value={motionAmp}
        format={(v) => `${Math.round(v)}px`}
        onChange={onSetMotionAmp}
      />
      <ParamSlider
        label="Tốc độ nhịp"
        min={0.3}
        max={3.0}
        step={0.1}
        value={motionSpeed}
        format={(v) => `${v.toFixed(1)}×`}
        onChange={onSetMotionSpeed}
      />
      <OptionPills
        cols={2}
        options={[
          { id: 'stagger', label: '🌊 Lệch pha tự nhiên giữa các mảnh' },
          { id: 'sync', label: '🔗 Cùng nhịp đồng loạt' }
        ]}
        value={staggerPhase ? 'stagger' : 'sync'}
        onPick={(id) => {
          const next = id === 'stagger'
          onSetStaggerPhase(next)
          onUpdate({ staggerPhase: next })
        }}
      />
    </>
  )
}

export function ClusterExpressionsAndMembersSection({
  is3D,
  rootLayer,
  members,
  expressions,
  accessories,
  onToggleExpression,
  onToggleAccessory,
  onToggleMemberVisible,
  onSelectLayer,
  onReplaceLayer
}: {
  is3D: boolean
  rootLayer?: Layer
  members: Layer[]
  expressions: ClusterExpressionEntry[]
  accessories: { layerId: string; label: string; visible: boolean }[]
  onToggleExpression: (layerId: string) => void
  onToggleAccessory: (layerId: string, currentlyVisible: boolean) => void
  onToggleMemberVisible: (layerId: string) => void
  onSelectLayer: (layerId: string) => void
  onReplaceLayer: (layerId: string) => void
}): React.ReactElement {
  return (
    <>
      {expressions.length > 0 && (
        <>
          <div className="wf-v2-insp-subhead">😊 Đổi Biểu cảm Khuôn mặt (1-Click)</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, expressions.length)}, minmax(0, 1fr))` }}>
            {expressions.map((expr) => (
              <button
                key={expr.layerId}
                type="button"
                className={`wf-v2-opt-pill${expr.visible ? ' active' : ''}`}
                onClick={() => onToggleExpression(expr.layerId)}
              >
                {expr.visible ? `● ${expr.label}` : expr.label}
              </button>
            ))}
          </div>
        </>
      )}

      {accessories.length > 0 && (
        <>
          <div className="wf-v2-insp-subhead">👓 Bật / Tắt Phụ kiện rời</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(2, accessories.length)}, minmax(0, 1fr))` }}>
            {accessories.map((acc) => (
              <button
                key={acc.layerId}
                type="button"
                className={`wf-v2-opt-pill${acc.visible ? ' active' : ''}`}
                onClick={() => onToggleAccessory(acc.layerId, acc.visible)}
              >
                {acc.visible ? `👁 Đang đeo: ${acc.label}` : `🚫 Đang ẩn: ${acc.label}`}
              </button>
            ))}
          </div>
        </>
      )}

      {!is3D && rootLayer && <CompositePartSwapSection layer={rootLayer} compLayers={members} />}

      <div className="wf-v2-insp-subhead">🧩 Danh sách các mảnh trong Cụm ({members.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 190, overflowY: 'auto', paddingRight: 2 }}>
        {members.map((m) => {
          const isSubRoot = m.id === rootLayer?.id
          const shortName = getClusterPartShortName(m)
          const zVal = Math.round(m.transform.position.value?.[2] ?? 0)
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 6px',
                borderRadius: 4,
                background: 'var(--bg-1)',
                border: isSubRoot ? '1px solid var(--key)' : '1px solid var(--line-soft)',
                fontSize: 10.5
              }}
            >
              <button
                type="button"
                className={`wf-v2-icon-btn ${m.visible !== false ? 'on' : 'off'}`}
                title={m.visible !== false ? 'Đang hiện mảnh này (Bấm để ẩn)' : 'Đang ẩn mảnh này (Bấm để hiện)'}
                onClick={() => onToggleMemberVisible(m.id)}
              >
                {m.visible !== false ? '👁' : '○'}
              </button>
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: isSubRoot ? 'var(--key)' : 'var(--bg-3)',
                  color: isSubRoot ? 'var(--on-key)' : 'var(--text-dim)',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {isSubRoot ? 'GỐC' : 'MẢNH'}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: isSubRoot ? 600 : 400
                }}
                title={`Bấm để chuyển tới Node mảnh "${shortName}"`}
                onClick={() => onSelectLayer(m.id)}
              >
                {shortName}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-faint)' }}>Z:{zVal}</span>
              {m.type === 'image' && (
                <button
                  type="button"
                  className="wf-v2-mini-btn"
                  title="Thay ảnh PNG khác cho mảnh con này"
                  onClick={() => onReplaceLayer(m.id)}
                >
                  🖼 Đổi
                </button>
              )}
              <button
                type="button"
                className="wf-v2-mini-btn"
                title="Chọn riêng Node mảnh này để chỉnh sửa độc lập"
                onClick={() => onSelectLayer(m.id)}
              >
                🎯
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

const QUICK_ANCHOR_SNAPS: { id: string; label: string; ox: number; oy: number; oz: number }[] = [
  { id: 'l_hand', label: '🤚 Tay trái', ox: -75, oy: -15, oz: -8 },
  { id: 'r_hand', label: '🤚 Tay phải', ox: 75, oy: -15, oz: -8 },
  { id: 'head', label: '🙂 Đầu / Mũ', ox: 0, oy: 115, oz: -10 },
  { id: 'torso', label: '👕 Ngực / Thân', ox: 0, oy: 10, oz: -6 },
  { id: 'ground', label: '🦶 Chân / Đế', ox: 0, oy: -115, oz: 4 }
]

/**
 * Cột cấu hình vị trí tương đối cho Layer mới kết nối vào Cụm 2.5D (hoặc bất kỳ mảnh/công cụ nào trong cụm)
 * ngay trên Workflow mà không cần mở lại Xưởng 2.5D.
 */
export function ClusterMemberPositionColumnSection({
  clusterNodeId,
  instId,
  rootLayer,
  members,
  standaloneLayers,
  activeMemberLayerId,
  onUpdate
}: {
  clusterNodeId: string
  instId?: string
  rootLayer?: Layer
  members: Layer[]
  standaloneLayers: Layer[]
  activeMemberLayerId?: string
  onUpdate: UpdateFn
}): React.ReactElement | null {
  const editorUpdate = useEditor((s) => s.update)
  const selectLayer = useEditor((s) => s.selectLayer)
  const [checkerTheme, toggleCheckerTheme] = usePreviewCheckerTheme()
  const palette = getCheckerboardPalette(checkerTheme)
  const safeMembers = Array.isArray(members) ? members : []
  const nonRootMembers = safeMembers.filter((m) => m && m.id !== rootLayer?.id)
  const candidateMembers = nonRootMembers.length > 0 ? nonRootMembers : safeMembers
  const selectedMember =
    candidateMembers.find((m) => m && m.id === activeMemberLayerId) ??
    candidateMembers.find((m) => m && m.composite?.partGroupId === 'attached_prop') ??
    candidateMembers[candidateMembers.length - 1]

  if (!rootLayer && safeMembers.length === 0) return null

  const rootPos: Vec3 = rootLayer?.transform.position.value ?? [0, 0, 0]
  const memberPos: Vec3 = selectedMember?.transform.position.value ?? rootPos
  const relOff: Vec3 = selectedMember?.composite?.rootOffset ?? [
    Math.round(memberPos[0] - rootPos[0]),
    Math.round(memberPos[1] - rootPos[1]),
    Math.round(memberPos[2] - rootPos[2])
  ]
  const memberScalePct = Math.round(Math.abs(selectedMember?.transform.scale.value?.[0] ?? 1) * 100)
  const memberRotDeg = Math.round(selectedMember?.transform.rotation.value?.[2] ?? 0)

  const applyMemberPatch = (
    patch: { offsetX?: number; offsetY?: number; offsetZ?: number; scalePct?: number; rotDeg?: number },
    mergeKey = 'wf-cluster-member-pos'
  ): void => {
    if (!selectedMember) return
    editorUpdate((d) => {
      updateClusterMemberOffsetV2(d, instId, selectedMember.id, patch, d.layers.find((l) => l.id === rootLayer?.id))
    }, mergeKey)
  }

  const handlePadPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!selectedMember) return
    e.stopPropagation()
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const applyAt = (cx: number, cy: number): void => {
      const nx = ((cx - rect.left) / Math.max(1, rect.width) - 0.5) * 400
      const ny = (0.5 - (cy - rect.top) / Math.max(1, rect.height)) * 320
      applyMemberPatch({ offsetX: Math.round(nx), offsetY: Math.round(ny) }, 'wf-cluster-member-pad')
    }
    applyAt(e.clientX, e.clientY)
    const onMove = (ev: PointerEvent): void => applyAt(ev.clientX, ev.clientY)
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="wf-v2-subsec" style={{ marginTop: 6 }}>
      <div className="wf-v2-subsec-head">
        <span>🎯 Cột Cấu hình Vị trí Layer / Công cụ trong Cụm 2.5D</span>
        <button type="button" className="wf-v2-mini-btn" onClick={toggleCheckerTheme} title="Đổi nền Caro Trắng / Đen">
          {checkerTheme === 'light' ? '☀️ Caro Trắng' : '🌙 Caro Đen'}
        </button>
        <small>{candidateMembers.length} mảnh</small>
      </div>

      {standaloneLayers.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
            ➕ Gắn &amp; khoá nhanh Layer rời trong cảnh vào Cụm 2.5D này:
          </div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {standaloneLayers.map((sl) => (
              <button
                key={sl.id}
                type="button"
                className="wf-v2-opt-pill"
                title={`Khoá "${sl.name}" vào cùng Cụm 2.5D và mở cột cấu hình vị trí`}
                onClick={() => {
                  editorUpdate((d) => {
                    const wfNode = d.workflow?.nodes.find((n) => n.id === clusterNodeId)
                    if (wfNode) attachExternalLayerToClusterV2(d, [sl.id], wfNode)
                  }, 'wf-attach-ext-layer')
                  onUpdate({ activeMemberLayerId: sl.id })
                }}
              >
                <span className="wf-v2-opt-pill-txt">+ 🔒 {sl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {candidateMembers.length > 0 && (
        <>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {candidateMembers.map((m) => {
              const isSel = m.id === selectedMember?.id
              const isAttachedProp = m.composite?.partGroupId === 'attached_prop'
              const shortName = getClusterPartShortName(m)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`wf-v2-opt-pill${isSel ? ' active' : ''}`}
                  onClick={() => {
                    onUpdate({ activeMemberLayerId: m.id })
                    selectLayer(m.id)
                  }}
                >
                  <span className="wf-v2-opt-pill-txt">
                    {isAttachedProp ? '🆕 ' : '🧩 '}
                    {shortName}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedMember && (
            <>
              <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 4 }}>
                {QUICK_ANCHOR_SNAPS.map((snap) => (
                  <button
                    key={snap.id}
                    type="button"
                    className="wf-v2-opt-pill"
                    title={`Đặt nhanh vào vị trí ${snap.label} (${snap.ox}, ${snap.oy})`}
                    onClick={() => applyMemberPatch({ offsetX: snap.ox, offsetY: snap.oy, offsetZ: snap.oz })}
                  >
                    <span className="wf-v2-opt-pill-txt">{snap.label}</span>
                  </button>
                ))}
              </div>

              <svg
                className="wf-v2-inline-motion-svg"
                viewBox="0 0 240 116"
                style={{ marginTop: 4, cursor: 'crosshair' }}
                onPointerDown={handlePadPointerDown}
              >
                <defs>
                  <pattern id={`wf-cluster-checker-${clusterNodeId}`} width="16" height="16" patternUnits="userSpaceOnUse">
                    <rect width="16" height="16" fill={palette.tileA} />
                    <rect width="8" height="8" fill={palette.tileB} />
                    <rect x="8" y="8" width="8" height="8" fill={palette.tileB} />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="240" height="116" fill={`url(#wf-cluster-checker-${clusterNodeId})`} stroke={palette.borderStroke} rx="6" />
                <line x1="120" y1="0" x2="120" y2="116" stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" />
                <line x1="0" y1="58" x2="240" y2="58" stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" />
                <circle cx="120" cy="58" r="5" fill="#f59e0b" />
                <text x="128" y="55" fill="#f59e0b" fontSize="8.5" fontWeight="700">
                  ⚓ Tâm Cụm (0,0)
                </text>
                {(() => {
                  const px = Math.max(10, Math.min(230, 120 + (relOff[0] / 400) * 240))
                  const py = Math.max(10, Math.min(106, 58 - (relOff[1] / 320) * 116))
                  return (
                    <>
                      <line x1="120" y1="58" x2={px} y2={py} stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="2 2" />
                      <circle cx={px} cy={py} r="6.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.8" />
                      <text x={px} y={Math.max(12, py - 9)} textAnchor="middle" fill="#38bdf8" fontSize="8.5" fontWeight="700">
                        {getClusterPartShortName(selectedMember)} ({Math.round(relOff[0])}, {Math.round(relOff[1])})
                      </text>
                    </>
                  )
                })()}
              </svg>

              <ParamSlider
                label="Lệch ngang X"
                min={-450}
                max={450}
                step={2}
                value={Math.round(relOff[0])}
                format={(v) => `${Math.round(v)}px`}
                onChange={(v) => applyMemberPatch({ offsetX: v })}
              />
              <ParamSlider
                label="Lệch dọc Y"
                min={-450}
                max={450}
                step={2}
                value={Math.round(relOff[1])}
                format={(v) => `${Math.round(v)}px`}
                onChange={(v) => applyMemberPatch({ offsetY: v })}
              />
              <ParamSlider
                label="Độ sâu Z (Trước/Sau)"
                min={-150}
                max={150}
                step={2}
                value={Math.round(relOff[2])}
                format={(v) => (v <= 0 ? `Trước (${Math.round(v)})` : `Sau (+${Math.round(v)})`)}
                onChange={(v) => applyMemberPatch({ offsetZ: v })}
              />
              <ParamSlider
                label="Tỉ lệ mảnh"
                min={15}
                max={250}
                step={2}
                value={memberScalePct}
                format={(v) => `${Math.round(v)}%`}
                onChange={(v) => applyMemberPatch({ scalePct: v })}
              />
              <ParamSlider
                label="Góc xoay mảnh"
                min={-180}
                max={180}
                step={1}
                value={memberRotDeg}
                format={(v) => `${Math.round(v)}°`}
                onChange={(v) => applyMemberPatch({ rotDeg: v })}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
