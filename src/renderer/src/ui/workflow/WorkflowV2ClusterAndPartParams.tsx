import React, { useMemo, useState } from 'react'
import type { Layer, LayerMotion, LayerMotionType, Vec3 } from '@shared/types'
import {
  WORKFLOW_V2_RIG_PRESET_OPTIONS,
  detectClusterAccessories,
  detectClusterExpressions,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { Assembly3DDialog } from '../assets/models3d/Assembly3DDialog'
import { rescaleModel3DInstance } from '../assets/models3d/insertModel3D'
import { getStoredModels3D } from '../assets/models3d/models3dStorage'
import type { Model3D } from '../assets/models3d/types'
import { AssetReplaceModal } from '../inspector/AssetReplaceModal'
import { CompositePartSwapSection } from '../inspector/sections/CompositePartSwapSection'
import {
  batchApplyCompositeMotion,
  batchClearCompositeMotion,
  batchKeyframeCompositeTransform
} from '../layerAssembly/compositeOps'
import { LayerAssemblyDialog } from '../layerAssembly/LayerAssemblyDialog'
import { findCompositeTemplate } from '../layerAssembly/scenePartSwap'
import type { LayerComposite } from '../layerAssembly/types'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

const CLUSTER_MOTION_PILLS: { id: LayerMotionType; label: string }[] = [
  { id: 'sway', label: '🌿 Đung đưa' },
  { id: 'pulse', label: '💓 Nhịp thở' },
  { id: 'float', label: '☁️ Bồng bềnh' },
  { id: 'wiggle', label: '⚡ Rung rinh' },
  { id: 'wind', label: '💨 Gió thổi' }
]

export function WorkflowV2ClusterLockParams({
  node,
  project,
  onUpdate
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const selectLayer = useEditor((s) => s.selectLayer)
  const p = node.params ?? {}
  const instId = p.instanceId
  const members = useMemo(
    () => getClusterMemberLayers(project, instId, project.layers.find((l) => (p.targetLayerIds ?? []).includes(l.id))),
    [project, instId, p.targetLayerIds]
  )
  const rootLayer = getClusterRootLayer(members)
  const is3D = Boolean(rootLayer?.model3d)
  const isLocked = node.enabled && (p.lockedGroup ?? true)
  const isCollapsed = Boolean(p.collapsedSubLayers)

  const [replacingLayerId, setReplacingLayerId] = useState<string | null>(null)
  const [editingModel, setEditingModel] = useState<Model3D | null>(null)
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(null)
  const [showCompositeModal, setShowCompositeModal] = useState(false)
  const [staggerPhase, setStaggerPhase] = useState<boolean>(p.staggerPhase ?? true)
  const [motionSpeed, setMotionSpeed] = useState<number>(1.2)
  const [motionAmp, setMotionAmp] = useState<number>(15)

  const expressions = useMemo(() => detectClusterExpressions(members), [members])
  const accessories = useMemo(() => detectClusterAccessories(members), [members])

  const rootPos: Vec3 = rootLayer?.transform.position.value ?? [p.transformX ?? 0, p.transformY ?? 0, p.transformZ ?? 0]
  const scalePct = Math.round(Math.abs(rootLayer?.transform.scale.value?.[0] ?? (p.clusterScalePct ?? 100) / 100) * 100)
  const model3d = rootLayer?.model3d
  const modelScale = model3d?.globalScale ?? 1.0
  const modelCenter: Vec3 = model3d?.centerPosition ?? [0, 0, 0]

  const toggleClusterLock = (): void => {
    const nextLocked = !isLocked
    onUpdate({ lockedGroup: nextLocked })
  }

  const toggleCollapseSubLayers = (): void => {
    onUpdate({ collapsedSubLayers: !isCollapsed })
  }

  const applyClusterMotion = (mType: LayerMotionType): void => {
    if (!instId) return
    const motion: LayerMotion = {
      enabled: true,
      type: mType,
      speed: motionSpeed,
      amount: Math.max(0.2, Math.min(2.0, motionAmp / 22)),
      amplitude: [motionAmp, motionAmp, 4],
      phase: 0
    }
    batchApplyCompositeMotion(instId, motion, staggerPhase)
  }

  const openWorkshop25D = (): void => {
    const compId = rootLayer?.composite?.compositeId
    const found = findCompositeTemplate(compId)
    setEditingComposite(found ?? null)
    setShowCompositeModal(true)
  }

  const openWorkshop3D = (): void => {
    if (!model3d) return
    const stored = getStoredModels3D()
    const found = stored.find((m) => m.id === model3d.modelId)
    setEditingModel(
      found ?? {
        id: model3d.modelId,
        name: model3d.modelName,
        category: 'custom',
        scale: model3d.initialScale || 1.0,
        faces: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    )
  }

  const targetReplaceLayer = replacingLayerId ? members.find((l) => l.id === replacingLayerId) : null

  return (
    <>
      {/* 1. Thanh điều khiển Khoá Cụm & Bung/Gom Mảnh Con trên sơ đồ */}
      <div className="wf-v2-insp-subhead">Trạng thái Khoá Cụm &amp; Hiển thị Sơ đồ ({members.length} mảnh)</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button
          type="button"
          className={`wf-v2-opt-pill${isLocked ? ' active' : ''}`}
          onClick={toggleClusterLock}
          title={
            isLocked
              ? 'Đang KHOÁ CỤM: Kéo BBox hoặc gắn Node Logic sẽ áp dụng đồng bộ cho toàn bộ các mảnh trong cụm'
              : 'Đang MỞ KHOÁ: Cho phép chỉnh sửa, kéo vị trí hoặc gắn logic riêng lẻ cho từng mảnh con'
          }
        >
          {isLocked ? '🔒 Đang khoá cả cụm' : '🔓 Đang mở khoá riêng'}
        </button>
        <button
          type="button"
          className={`wf-v2-opt-pill${!isCollapsed ? ' active' : ''}`}
          onClick={toggleCollapseSubLayers}
          title="Bung toàn bộ các mảnh layer con trên sơ đồ Workflow hoặc thu gọn chỉ giữ lại mảnh gốc"
        >
          {isCollapsed ? `📁 Bung ${members.length} mảnh con` : `📂 Đang bung ${members.length} mảnh`}
        </button>
      </div>

      {/* 2. Chọn Gốc Neo Định Vị (Root Anchor) cho Cụm 2.5D */}
      {!is3D && members.length > 1 && (
        <>
          <div className="wf-v2-insp-subhead">⚓ Gốc neo định vị của Cụm (Root Layer)</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {members.slice(0, 9).map((m) => {
              const isRoot = m.id === rootLayer?.id
              const shortName = getClusterPartShortName(m)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`wf-v2-opt-pill${isRoot ? ' active' : ''}`}
                  title={`Đặt "${shortName}" làm điểm neo gốc định vị cho toàn bộ cụm`}
                  onClick={() => onUpdate({ rootLayerId: m.id })}
                >
                  {isRoot ? `⚓ ${shortName}` : shortName}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 3. Toạ độ & Tỉ lệ toàn bộ Cụm 2.5D hoặc Mô hình 3D */}
      {is3D && model3d ? (
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
          <button type="button" className="wf-v2-ghost-btn" onClick={openWorkshop3D}>
            🧊 Mở Xưởng Lắp Ráp 3D (Chỉnh các mặt phẳng)
          </button>
        </>
      ) : (
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
              onClick={openWorkshop25D}
              title="Mở cụm này trong Xưởng Lắp Ráp Layer 2.5D để chỉnh xương IK, ghim khớp và lưới đàn hồi"
            >
              🛠 Mở Xưởng 2.5D
            </button>
          </div>
        </>
      )}

      {/* 4. Hành động Xương Nhân vật 2.5D (Rig Animation: Đứng thở, Bước đi, Vẫy tay, Cúi chào...) */}
      {!is3D && instId && (
        <>
          <div className="wf-v2-insp-subhead">🦴 Hoạt ảnh Xương Nhân vật 2.5D (Rig Animation)</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {WORKFLOW_V2_RIG_PRESET_OPTIONS.map((opt) => {
              const active = p.rigActionPreset === opt.id
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
              className={`wf-v2-opt-pill${!p.rigActionPreset || p.rigActionPreset === 'none' ? ' active' : ''}`}
              title="Gỡ keyframe hành động xương và trả cụm về tư thế đứng chuẩn"
              onClick={() => onUpdate({ rigActionPreset: 'none' })}
            >
              ⏹ Tắt Rig xương
            </button>
          </div>
        </>
      )}

      {/* 5. Motion Chu kỳ Đồng bộ Cả Cụm (Sway, Pulse, Float, Wiggle, Wind + Staggered Phase) */}
      {!is3D && instId && (
        <>
          <div className="wf-v2-insp-subhead">🌊 Motion Chu kỳ Đồng bộ Cả Cụm</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {CLUSTER_MOTION_PILLS.map((m) => {
              const active = rootLayer?.motion?.enabled && rootLayer?.motion?.type === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`wf-v2-opt-pill${active ? ' active' : ''}`}
                  onClick={() => applyClusterMotion(m.id)}
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
            onChange={(v) => setMotionAmp(v)}
          />
          <ParamSlider
            label="Tốc độ nhịp"
            min={0.3}
            max={3.0}
            step={0.1}
            value={motionSpeed}
            format={(v) => `${v.toFixed(1)}×`}
            onChange={(v) => setMotionSpeed(v)}
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
              setStaggerPhase(next)
              onUpdate({ staggerPhase: next })
            }}
          />
        </>
      )}

      {/* 6. Biểu cảm khuôn mặt & Phụ kiện bật/tắt 1 chạm (dành cho Nhân vật Anime 2.5D) */}
      {expressions.length > 0 && (
        <>
          <div className="wf-v2-insp-subhead">😊 Đổi Biểu cảm Khuôn mặt (1-Click)</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, expressions.length)}, minmax(0, 1fr))` }}>
            {expressions.map((expr) => (
              <button
                key={expr.layerId}
                type="button"
                className={`wf-v2-opt-pill${expr.visible ? ' active' : ''}`}
                onClick={() =>
                  editorUpdate((d) => {
                    for (const item of expressions) {
                      const l = d.layers.find((x) => x.id === item.layerId)
                      if (l) l.visible = item.layerId === expr.layerId
                    }
                  })
                }
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
                onClick={() =>
                  editorUpdate((d) => {
                    const l = d.layers.find((x) => x.id === acc.layerId)
                    if (l) l.visible = !acc.visible
                  })
                }
              >
                {acc.visible ? `👁 Đang đeo: ${acc.label}` : `🚫 Đang ẩn: ${acc.label}`}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 7. Khe biến thể & Thay bộ phận cụm 2.5D */}
      {!is3D && rootLayer && <CompositePartSwapSection layer={rootLayer} compLayers={members} />}

      {/* 8. Danh sách các mảnh con trong cụm (Bật/tắt mắt, Đổi ảnh riêng, Chọn mảnh riêng) */}
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
                onClick={() =>
                  editorUpdate((d) => {
                    const l = d.layers.find((x) => x.id === m.id)
                    if (l) l.visible = l.visible === false
                  })
                }
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
                onClick={() => selectLayer(m.id)}
              >
                {shortName}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-faint)' }}>Z:{zVal}</span>
              {m.type === 'image' && (
                <button
                  type="button"
                  className="wf-v2-mini-btn"
                  title="Thay ảnh PNG khác cho mảnh con này"
                  onClick={() => setReplacingLayerId(m.id)}
                >
                  🖼 Đổi
                </button>
              )}
              <button
                type="button"
                className="wf-v2-mini-btn"
                title="Chọn riêng Node mảnh này để chỉnh sửa độc lập"
                onClick={() => selectLayer(m.id)}
              >
                🎯
              </button>
            </div>
          )
        })}
      </div>

      {targetReplaceLayer && targetReplaceLayer.type === 'image' && (
        <AssetReplaceModal
          layerId={targetReplaceLayer.id}
          currentAssetId={targetReplaceLayer.props.assetId}
          layerName={targetReplaceLayer.name}
          onClose={() => setReplacingLayerId(null)}
        />
      )}

      {editingModel && (
        <Assembly3DDialog
          isOpen={true}
          initialModel={editingModel}
          onClose={() => setEditingModel(null)}
          onSaved={() => setEditingModel(null)}
        />
      )}

      {showCompositeModal && (
        <LayerAssemblyDialog
          initialComposite={editingComposite}
          onClose={() => setShowCompositeModal(false)}
        />
      )}
    </>
  )
}

export function WorkflowV2PartSwapParams({
  node,
  project,
  onUpdate
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const firstLayer = project.layers.find((l) => (p.targetLayerIds ?? []).includes(l.id))
  const members = useMemo(
    () => getClusterMemberLayers(project, p.instanceId, firstLayer),
    [project, p.instanceId, firstLayer]
  )
  const rootLayer = getClusterRootLayer(members) ?? firstLayer
  const expressions = useMemo(() => detectClusterExpressions(members), [members])
  const accessories = useMemo(() => detectClusterAccessories(members), [members])
  const [replacingLayerId, setReplacingLayerId] = useState<string | null>(null)

  const mode = p.swapMode ?? (expressions.length > 0 ? 'expression' : 'replace_layer')
  const targetPart =
    members.find((m) => m.id === p.swapTargetLayerId) ??
    (accessories[0] ? members.find((m) => m.id === accessories[0].layerId) : undefined) ??
    members[0]
  const replaceModalLayer = replacingLayerId ? members.find((m) => m.id === replacingLayerId) : null

  return (
    <>
      <div className="wf-v2-insp-subhead">🧩 Chế độ Thay Layer / Bộ phận Cụm 2.5D</div>
      <OptionPills
        cols={3}
        options={[
          { id: 'expression', label: '😊 Biểu cảm' },
          { id: 'toggle_part', label: '👓 Phụ kiện' },
          { id: 'replace_layer', label: '🖼 Thay mảnh' }
        ]}
        value={mode}
        onPick={(nextMode) => onUpdate({ swapMode: nextMode })}
      />

      {mode === 'expression' && (
        <>
          <div className="wf-v2-insp-subhead">Chọn Biểu cảm Khuôn mặt kích hoạt</div>
          {expressions.length > 0 ? (
            <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {expressions.map((expr) => {
                const active = p.swapVariant === expr.layerId || p.swapVariant === expr.slotKey || expr.visible
                return (
                  <button
                    key={expr.layerId}
                    type="button"
                    className={`wf-v2-opt-pill${active ? ' active' : ''}`}
                    onClick={() =>
                      onUpdate(
                        { swapMode: 'expression', swapVariant: expr.layerId },
                        `Biểu cảm: ${expr.label}`
                      )
                    }
                  >
                    😊 {expr.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="wf-v2-hint">
              Cụm hiện tại chưa có lớp biểu cảm khuôn mặt (`face-normal` / `face-happy`). Bạn có thể chuyển sang tab{' '}
              <b>🖼 Thay mảnh</b> để đổi ảnh trực tiếp cho bất kỳ bộ phận nào.
            </p>
          )}
        </>
      )}

      {mode === 'toggle_part' && (
        <>
          <div className="wf-v2-insp-subhead">Chọn Phụ kiện / Mảnh con cần Bật hoặc Ẩn</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {(accessories.length > 0 ? accessories.map((a) => members.find((m) => m.id === a.layerId)!).filter(Boolean) : members).map(
              (m: Layer) => {
                const shortName = getClusterPartShortName(m)
                const active = p.swapTargetLayerId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`wf-v2-opt-pill${active ? ' active' : ''}`}
                    onClick={() =>
                      onUpdate(
                        { swapMode: 'toggle_part', swapTargetLayerId: m.id },
                        `Phụ kiện: ${shortName}`
                      )
                    }
                  >
                    {m.visible !== false ? '👁' : '🚫'} {shortName}
                  </button>
                )
              }
            )}
          </div>
          <p className="wf-v2-hint">
            Khi Node này <b>Bật</b>, phụ kiện được chọn sẽ hiển thị; khi <b>Tắt</b> Node, phụ kiện sẽ tự ẩn đi.
          </p>
        </>
      )}

      {mode === 'replace_layer' && (
        <>
          <div className="wf-v2-insp-subhead">Chọn Mảnh Bộ phận để thay thế hình ảnh</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {members.map((m) => {
              const shortName = getClusterPartShortName(m)
              const active = (targetPart?.id ?? '') === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`wf-v2-opt-pill${active ? ' active' : ''}`}
                  onClick={() => onUpdate({ swapMode: 'replace_layer', swapTargetLayerId: m.id })}
                >
                  {shortName}
                </button>
              )
            })}
          </div>
          {targetPart && targetPart.type === 'image' && (
            <button
              type="button"
              className="wf-v2-ghost-btn"
              onClick={() => setReplacingLayerId(targetPart.id)}
            >
              🖼 Chọn ảnh mới cho &ldquo;{getClusterPartShortName(targetPart)}&rdquo;…
            </button>
          )}
          {rootLayer && members.length > 1 && (
            <CompositePartSwapSection layer={targetPart ?? rootLayer} compLayers={members} />
          )}
        </>
      )}

      {replaceModalLayer && replaceModalLayer.type === 'image' && (
        <AssetReplaceModal
          layerId={replaceModalLayer.id}
          currentAssetId={replaceModalLayer.props.assetId}
          layerName={replaceModalLayer.name}
          onClose={() => setReplacingLayerId(null)}
        />
      )}
    </>
  )
}
