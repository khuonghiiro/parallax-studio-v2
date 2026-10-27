import React, { useMemo, useState } from 'react'
import type { ImageProps, Layer, WorkflowNodeParams } from '@shared/types'
import {
  detectClusterExpressions,
  extractCompositeDynamicParts,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer,
  syncWorkflowV2NodeToProject
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { cleanV2NodeTitle } from './workflowV2Theme'
import { ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

type PartTabMode = 'variant' | 'pose' | 'layers'

interface QuickPosePreset {
  id: string
  label: string
  patch: Partial<WorkflowNodeParams>
}

const QUICK_POSE_PRESETS: QuickPosePreset[] = [
  { id: 'rest', label: '🎯 Tư thế chuẩn', patch: { partRotDeg: 0, partOffsetX: 0, partOffsetY: 0, partScalePct: 100, partPoseWave: 'smooth' } },
  { id: 'wave', label: '👋 Vẫy / Lắc (-35°)', patch: { partRotDeg: -35, partOffsetX: 0, partOffsetY: -6, partScalePct: 100, partPoseWave: 'oscillate' } },
  { id: 'raise', label: '🙋 Nâng lên (-25°)', patch: { partRotDeg: -25, partOffsetX: 0, partOffsetY: -14, partScalePct: 100, partPoseWave: 'smooth' } },
  { id: 'lower', label: '👇 Hạ xuống (+25°)', patch: { partRotDeg: 25, partOffsetX: 0, partOffsetY: 12, partScalePct: 100, partPoseWave: 'smooth' } },
  { id: 'reach', label: '↗️ Đưa tới trước', patch: { partRotDeg: -14, partOffsetX: 18, partOffsetY: -6, partScalePct: 100, partPoseWave: 'smooth' } },
  { id: 'pop', label: '💓 Phóng nhấn 115%', patch: { partRotDeg: 0, partOffsetX: 0, partOffsetY: 0, partScalePct: 115, partPoseWave: 'smooth' } }
]

const degFmt = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v)}°`
const pxFmt = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v)}px`
const pctRawFmt = (v: number): string => `${Math.round(v)}%`

/**
 * Tham số của Node Bộ phận (`part_swap`):
 * - Nếu là Node Bộ phận chính (`isPartHub`): hiển thị danh sách trực quan các Node con Bộ phận của cụm 2.5D để điều phối hoặc nhảy nhanh.
 * - Nếu là Node con Bộ phận (`isPartChild`): hiển thị 3 Sub-Tabs gọn gàng (Biến thể/Ảnh, Cử động & Tư thế theo giây, Mảnh con).
 */
export function WorkflowV2PartSwapParams({
  node,
  project,
  workflow,
  onUpdate,
  onSelectNode,
  onAttachLogic,
  onSpawnFollowupNode
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const targetIds = new Set(p.targetLayerIds ?? [])
  const firstLayer = project.layers.find((l) => targetIds.has(l.id))
  const instId = p.instanceId ?? firstLayer?.composite?.instanceId ?? firstLayer?.model3d?.instanceId
  const members = useMemo(() => getClusterMemberLayers(project, instId, firstLayer), [project, instId, firstLayer])
  const rootLayer = useMemo(() => getClusterRootLayer(members), [members])
  const expressions = useMemo(() => detectClusterExpressions(members), [members])
  const dynamicParts = useMemo(
    () =>
      extractCompositeDynamicParts(project, instId, rootLayer).filter(
        (dp) => dp.layerIds.length >= 2 || dp.variants.length >= 2
      ),
    [project, instId, rootLayer]
  )

  const childPartNodes = useMemo(
    () =>
      (workflow?.nodes ?? []).filter(
        (n) =>
          n.params?.logicCategory === 'part_swap' &&
          Boolean(n.params?.isPartChild) &&
          (n.params?.hierarchyParentNodeId === node.id ||
            (instId && n.params?.instanceId === instId))
      ),
    [workflow?.nodes, node.id, instId]
  )

  const parentHubNode = useMemo(
    () =>
      p.isPartChild && workflow
        ? workflow.nodes.find(
            (n) =>
              n.id === p.hierarchyParentNodeId ||
              (n.params?.logicCategory === 'part_swap' && n.params?.isPartHub && n.params?.instanceId === instId)
          )
        : undefined,
    [p.isPartChild, p.hierarchyParentNodeId, workflow, instId]
  )

  const activePart = useMemo(
    () =>
      (p.partGroupId ? dynamicParts.find((dp) => dp.id === p.partGroupId) : undefined) ??
      dynamicParts.find((dp) => dp.layerIds.some((id) => targetIds.has(id))) ??
      dynamicParts[0],
    [dynamicParts, p.partGroupId, targetIds]
  )

  const partLayers: Layer[] = useMemo(
    () =>
      p.isPartChild && p.targetLayerIds?.length
        ? members.filter((m) => targetIds.has(m.id))
        : activePart?.layerIds && activePart.layerIds.length > 0
          ? members.filter((m) => activePart.layerIds.includes(m.id))
          : members,
    [p.isPartChild, p.targetLayerIds, members, targetIds, activePart]
  )

  const defaultTab: PartTabMode =
    p.partActionMode ??
    ((activePart?.id === 'face' && expressions.length > 0) || partLayers.length > 1 ? 'variant' : 'pose')
  const [subTab, setSubTab] = useState<PartTabMode>(defaultTab)

  const switchSubTab = (next: PartTabMode): void => {
    setSubTab(next)
    onUpdate({ partActionMode: next })
  }

  // 1. GIAO DIỆN NODE BỘ PHẬN CHÍNH (HUB QUẢN LÝ CÁC NODE CON BỘ PHẬN)
  if (p.isPartHub || (!p.isPartChild && childPartNodes.length > 0)) {
    const collapsed = Boolean(p.collapsedGroup)
    return (
      <div className="wf-v2-part-hub-panel">
        <div className="wf-v2-part-hub-banner">
          <div className="wf-v2-part-hub-info">
            <strong>🧩 Cụm Bộ phận 2.5D ({childPartNodes.length} bộ phận có 2+ biến thể)</strong>
            <span>Chỉ hiện các bộ phận có từ 2 item trở lên để đánh tráo theo mốc giây</span>
          </div>
          <button
            type="button"
            className={`wf-v2-mini-btn${collapsed ? ' active' : ''}`}
            title={collapsed ? 'Bung các Node con Bộ phận ra trên sơ đồ' : 'Thu gọn các Node con Bộ phận trên sơ đồ'}
            onClick={() => onUpdate({ collapsedGroup: !collapsed })}
          >
            {collapsed ? `Bung (+${childPartNodes.length})` : 'Thu gọn'}
          </button>
        </div>

        {expressions.length > 0 && (
          <div className="wf-v2-subsec">
            <div className="wf-v2-subsec-head">
              <span>😊 Đổi nhanh Biểu cảm khuôn mặt</span>
              <small>{expressions.length} trạng thái</small>
            </div>
            <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {expressions.map((expr, idx) => {
                const spanFull = expressions.length % 2 === 1 && idx === expressions.length - 1
                const isActive = expr.visible
                return (
                  <button
                    key={expr.layerId}
                    type="button"
                    className={`wf-v2-opt-pill${isActive ? ' active' : ''}`}
                    style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                    onClick={() => {
                      onUpdate({ swapMode: 'expression', swapVariant: expr.layerId })
                      const faceChild = childPartNodes.find((c) => c.params?.partGroupId === 'face')
                      if (faceChild) {
                        useEditor.getState().update((draft) => {
                          const target = draft.workflow?.nodes.find((n) => n.id === faceChild.id)
                          if (target) {
                            target.params = { ...target.params, swapMode: 'expression', swapVariant: expr.layerId }
                            syncWorkflowV2NodeToProject(draft, target, { swapMode: 'expression', swapVariant: expr.layerId })
                          }
                        }, 'wf-v2-hub-expr')
                      }
                    }}
                  >
                    <span className="wf-v2-opt-pill-txt">{isActive ? '● ' : '○ '}{expr.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="wf-v2-subsec">
          <div className="wf-v2-subsec-head">
            <span>🌿 Danh sách Node con Bộ phận</span>
            <small>Chọn để chỉnh riêng theo giây</small>
          </div>
          <div className="wf-v2-part-child-grid">
            {childPartNodes.map((child, idx) => {
              const cp = child.params ?? {}
              const t0 = (cp.timeStart ?? 0).toFixed(1)
              const t1 = (cp.timeEnd ?? project.comp.duration ?? 5).toFixed(1)
              const hasPose = Math.abs(cp.partRotDeg ?? 0) >= 1 || Math.abs(cp.partOffsetX ?? 0) >= 1 || Math.abs(cp.partOffsetY ?? 0) >= 1
              const spanFull = childPartNodes.length % 2 === 1 && idx === childPartNodes.length - 1
              return (
                <div
                  key={child.id}
                  className={`wf-v2-part-child-card${!child.enabled ? ' is-off' : ''}`}
                  style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                >
                  <button
                    type="button"
                    className="wf-v2-part-child-main"
                    title={`Mở thuộc tính của "${child.title}" (${t0}s – ${t1}s)`}
                    onClick={() => onSelectNode?.(child.id)}
                  >
                    <span className="part-ico">{cp.partIcon || '🧩'}</span>
                    <span className="part-body">
                      <strong>{cp.partGroupTitle || cleanV2NodeTitle(child.title)}</strong>
                      <small>
                        {t0}s–{t1}s · {hasPose ? `Xoay ${cp.partRotDeg ?? 0}°` : `${cp.targetLayerIds?.length ?? 1} mảnh`}
                      </small>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {dynamicParts.some((dp) => !childPartNodes.some((c) => c.params?.partGroupId === dp.id)) && (
          <div className="wf-v2-subsec">
            <div className="wf-v2-subsec-head">
              <span>➕ Khôi phục Node con Bộ phận đã ẩn</span>
            </div>
            <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {dynamicParts
                .filter((dp) => !childPartNodes.some((c) => c.params?.partGroupId === dp.id))
                .map((dp) => (
                  <button
                    key={dp.id}
                    type="button"
                    className="wf-v2-opt-pill"
                    onClick={() =>
                      onAttachLogic?.(
                        node.id,
                        'part_swap',
                        'v2:part_swap:expr_happy',
                        {
                          partGroupId: dp.id,
                          partGroupTitle: dp.title,
                          partIcon: dp.icon,
                          targetLayerIds: dp.layerIds
                        },
                        `Bộ phận: ${dp.title}`
                      )
                    }
                  >
                    <span className="wf-v2-opt-pill-txt">+ {dp.icon} {dp.title}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 2. GIAO DIỆN NODE CON BỘ PHẬN (CHỈNH RIÊNG 1 BỘ PHẬN TRONG MỐC GIÂY)
  const isFacePart = activePart?.id === 'face' && expressions.length > 0
  const imageAssets = project.assets.filter((a) => a.kind === 'image')
  const selectedSubLayer =
    partLayers.find((l) => l.id === p.swapTargetLayerId) ?? partLayers[0]

  return (
    <div className="wf-v2-part-child-editor">
      <div className="wf-v2-part-child-head-bar">
        <div className="wf-v2-part-child-title-tag">
          <span className="ico">{p.partIcon || activePart?.icon || '🧩'}</span>
          <div>
            <strong>{p.partGroupTitle || activePart?.title || cleanV2NodeTitle(node.title)}</strong>
            <small>{partLayers.length} mảnh trong bộ phận này</small>
          </div>
        </div>
        <div className="wf-v2-part-child-actions">
          {parentHubNode && onSelectNode && (
            <button
              type="button"
              className="wf-v2-mini-btn"
              title="Quay về Node Bộ phận chính (Hub quản lý toàn bộ bộ phận)"
              onClick={() => onSelectNode(parentHubNode.id)}
            >
              ← Cụm Bộ phận
            </button>
          )}
          {onSpawnFollowupNode && (
            <button
              type="button"
              className="wf-v2-mini-btn accent"
              title="Tạo nối tiếp 1 mốc hành động 3s mới cho bộ phận này (ví dụ: 15s – 18s)"
              onClick={() => onSpawnFollowupNode(3.0)}
            >
              + Mốc +3s
            </button>
          )}
        </div>
      </div>

      {/* Segmented Sub-Tabs chuẩn 1-Click */}
      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Chế độ chỉnh Bộ phận con">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'variant'}
          className={`wf-v2-seg-tab${subTab === 'variant' ? ' active' : ''}`}
          onClick={() => switchSubTab('variant')}
        >
          🎭 {isFacePart ? 'Biểu cảm' : 'Biến thể & Ảnh'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pose'}
          className={`wf-v2-seg-tab${subTab === 'pose' ? ' active' : ''}`}
          onClick={() => switchSubTab('pose')}
        >
          📐 Cử động &amp; Tư thế
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'layers'}
          className={`wf-v2-seg-tab${subTab === 'layers' ? ' active' : ''}`}
          onClick={() => switchSubTab('layers')}
        >
          👁 Mảnh ({partLayers.length})
        </button>
      </div>

      {subTab === 'variant' && (
        <div className="wf-v2-subsec">
          {isFacePart ? (
            <>
              <div className="wf-v2-subsec-head">
                <span>😊 Chọn Biểu cảm trong mốc giây</span>
                <small>{expressions.length} trạng thái</small>
              </div>
              <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {expressions.map((expr, idx) => {
                  const isSelected = p.swapVariant ? p.swapVariant === expr.layerId : expr.visible
                  const spanFull = expressions.length % 2 === 1 && idx === expressions.length - 1
                  return (
                    <button
                      key={expr.layerId}
                      type="button"
                      className={`wf-v2-opt-pill${isSelected ? ' active' : ''}`}
                      style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                      onClick={() =>
                        onUpdate(
                          { swapMode: 'expression', swapVariant: expr.layerId },
                          `Bộ phận: Khuôn mặt (${expr.label})`
                        )
                      }
                    >
                      <span className="wf-v2-opt-pill-txt">{isSelected ? '● ' : '○ '}{expr.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : partLayers.length > 1 ? (
            <>
              <div className="wf-v2-subsec-head">
                <span>🔄 Chọn Biến thể hiển thị của {p.partGroupTitle || activePart?.title}</span>
                <small>{partLayers.length} mảnh</small>
              </div>
              <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {partLayers.map((pl, idx) => {
                  const shortName = getClusterPartShortName(pl)
                  const isPicked = p.swapVariant ? p.swapVariant === pl.id : pl.visible !== false
                  const spanFull = partLayers.length % 2 === 1 && idx === partLayers.length - 1
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      className={`wf-v2-opt-pill${isPicked ? ' active' : ''}`}
                      style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                      title={shortName}
                      onClick={() =>
                        onUpdate(
                          { swapMode: 'part_variant', swapVariant: pl.id, swapTargetLayerId: pl.id },
                          `Bộ phận: ${p.partGroupTitle || activePart?.title || shortName}`
                        )
                      }
                    >
                      <span className="wf-v2-opt-pill-txt">{pl.visible !== false ? '👁 ' : '🚫 '}{shortName}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="wf-v2-subsec-head">
              <span>🖼 Mảnh bộ phận: {selectedSubLayer ? getClusterPartShortName(selectedSubLayer) : 'Mảnh đơn'}</span>
              <button
                type="button"
                className={`wf-v2-mini-btn${selectedSubLayer?.visible !== false ? ' active' : ''}`}
                onClick={() => {
                  if (!selectedSubLayer) return
                  useEditor.getState().update((draft) => {
                    const target = draft.layers.find((m) => m.id === selectedSubLayer.id)
                    if (target) target.visible = !(target.visible !== false)
                  }, 'wf-v2-toggle-single-part')
                }}
              >
                {selectedSubLayer?.visible !== false ? '👁 Đang hiện' : '🚫 Đang ẩn'}
              </button>
            </div>
          )}

          {(isFacePart || partLayers.length > 1) && (
            <div className="wf-v2-subsec-head" style={{ marginTop: 4 }}>
              <span>⏱ Hết mốc giây ({(p.timeEnd ?? project.comp.duration ?? 5).toFixed(1)}s)</span>
              <button
                type="button"
                className={`wf-v2-mini-btn${p.partSwapHoldAfterEnd ? ' active' : ''}`}
                title="Chọn xem sau mốc kết thúc sẽ giữ nguyên biến thể mới hay trả về mặc định ban đầu"
                onClick={() => onUpdate({ partSwapHoldAfterEnd: !p.partSwapHoldAfterEnd })}
              >
                {p.partSwapHoldAfterEnd ? '📌 Giữ luôn sau khi đổi' : '↩ Trả về mặc định'}
              </button>
            </div>
          )}
          {selectedSubLayer && imageAssets.length > 0 && (
            <div className="wf-v2-subsec" style={{ marginTop: 6 }}>
              <div className="wf-v2-subsec-head">
                <span>🎨 Thay ảnh (Asset) cho "{getClusterPartShortName(selectedSubLayer)}"</span>
              </div>
              <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {imageAssets.slice(0, 6).map((asset, idx, arr) => {
                  const currentAssetId =
                    selectedSubLayer.type === 'image' ? (selectedSubLayer.props as ImageProps).assetId : ''
                  const isCurrent = p.swapAssetId ? p.swapAssetId === asset.id : currentAssetId === asset.id
                  const spanFull = arr.length % 2 === 1 && idx === arr.length - 1
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`wf-v2-opt-pill${isCurrent ? ' active' : ''}`}
                      style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                      title={asset.name}
                      onClick={() =>
                        onUpdate({
                          swapMode: 'replace_asset',
                          swapTargetLayerId: selectedSubLayer.id,
                          swapAssetId: asset.id
                        })
                      }
                    >
                      <span className="wf-v2-opt-pill-txt">🖼 {asset.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'pose' && (
        <div className="wf-v2-subsec">
          <div className="wf-v2-subsec-head">
            <span>⚡ Mẫu cử động nhanh trong mốc giây</span>
          </div>
          <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {QUICK_POSE_PRESETS.map((qp) => {
              const isCurrent =
                Math.abs((p.partRotDeg ?? 0) - (qp.patch.partRotDeg ?? 0)) < 1 &&
                Math.abs((p.partOffsetX ?? 0) - (qp.patch.partOffsetX ?? 0)) < 1 &&
                Math.abs((p.partScalePct ?? 100) - (qp.patch.partScalePct ?? 100)) < 1
              return (
                <button
                  key={qp.id}
                  type="button"
                  className={`wf-v2-opt-pill${isCurrent ? ' active' : ''}`}
                  onClick={() => onUpdate({ partActionMode: 'pose', ...qp.patch })}
                >
                  <span className="wf-v2-opt-pill-txt">{qp.label}</span>
                </button>
              )
            })}
          </div>

          <div className="wf-v2-subsec-head" style={{ marginTop: 6 }}>
            <span>🌊 Kiểu nhịp Keyframe trong khoảng thời gian</span>
          </div>
          <div className="wf-v2-pill-grid" data-cols={3} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {([
              { id: 'smooth', label: '🌊 Vào-Giữ-Trả' },
              { id: 'hold', label: '📌 Giữ tư thế' },
              { id: 'oscillate', label: '👋 Vẫy lặp' }
            ] as const).map((w) => (
              <button
                key={w.id}
                type="button"
                className={`wf-v2-opt-pill${(p.partPoseWave ?? 'smooth') === w.id ? ' active' : ''}`}
                onClick={() => onUpdate({ partActionMode: 'pose', partPoseWave: w.id })}
              >
                <span className="wf-v2-opt-pill-txt">{w.label}</span>
              </button>
            ))}
          </div>

          <ParamSlider
            label="Góc xoay"
            min={-90}
            max={90}
            step={1}
            value={p.partRotDeg ?? 0}
            format={degFmt}
            onChange={(v) => onUpdate({ partActionMode: 'pose', partRotDeg: v })}
          />
          <ParamSlider
            label="Dịch ngang X"
            min={-120}
            max={120}
            step={2}
            value={p.partOffsetX ?? 0}
            format={pxFmt}
            onChange={(v) => onUpdate({ partActionMode: 'pose', partOffsetX: v })}
          />
          <ParamSlider
            label="Dịch dọc Y"
            min={-120}
            max={120}
            step={2}
            value={p.partOffsetY ?? 0}
            format={pxFmt}
            onChange={(v) => onUpdate({ partActionMode: 'pose', partOffsetY: v })}
          />
          <ParamSlider
            label="Tỉ lệ bộ phận"
            min={50}
            max={180}
            step={2}
            value={p.partScalePct ?? 100}
            format={pctRawFmt}
            onChange={(v) => onUpdate({ partActionMode: 'pose', partScalePct: v })}
          />
        </div>
      )}

      {subTab === 'layers' && (
        <div className="wf-v2-subsec">
          <div className="wf-v2-subsec-head">
            <span>👁 Bật / Tắt từng mảnh trong "{p.partGroupTitle || activePart?.title}"</span>
            <small>{partLayers.filter((l) => l.visible !== false).length}/{partLayers.length} hiện</small>
          </div>
          <div className="wf-v2-pill-grid" data-cols={2} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {partLayers.map((pl, idx) => {
              const shortName = getClusterPartShortName(pl)
              const vis = pl.visible !== false
              const spanFull = partLayers.length % 2 === 1 && idx === partLayers.length - 1
              return (
                <button
                  key={pl.id}
                  type="button"
                  className={`wf-v2-opt-pill${vis ? ' active' : ''}`}
                  style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                  title={`Click để ${vis ? 'Ẩn' : 'Hiện'} mảnh "${shortName}"`}
                  onClick={() => {
                    useEditor.getState().update((draft) => {
                      const target = draft.layers.find((m) => m.id === pl.id)
                      if (target) target.visible = !vis
                    }, 'wf-v2-toggle-part-sublayer')
                  }}
                >
                  <span className="wf-v2-opt-pill-txt">{vis ? '👁 ' : '🚫 '}{shortName}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
