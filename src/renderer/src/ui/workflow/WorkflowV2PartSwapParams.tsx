import React, { useMemo, useState } from 'react'
import type { ImageProps, Layer, WorkflowNodeParams } from '@shared/types'
import { patchPartCue } from '../../project/workflowPartEditing'
import { resolvePartMotionTriggerWindow } from '../../project/workflowPartMotionTrigger'
import {
  detectClusterExpressions,
  extractCompositeDynamicParts,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import {
  AssetThumbImg,
  PartMotionTriggerPicker,
  PartReplaceAssetGrid,
  PartVariantThumbnailGrid
} from './PartAssetThumbnailPicker'
import { cleanV2NodeTitle } from './workflowV2Theme'
import { ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

type PartEditorTab = 'variant' | 'trigger' | 'pose'

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

function getLayerAssetId(layer?: Layer): string | undefined {
  return layer?.type === 'image' ? (layer.props as ImageProps).assetId : undefined
}

export function WorkflowV2PartSwapParams({
  node,
  project,
  workflow,
  onUpdate: updateNode,
  onScrubTime,
  onSelectNode,
  onAttachLogic
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const onUpdate = (patch: Partial<WorkflowNodeParams>, title?: string): void => {
    if (node.params?.isPartHub) {
      updateNode(patch, title)
      return
    }
    useEditor.getState().update((draft) => {
      patchPartCue(draft, node.id, patch)
      if (title) {
        const target = draft.workflow?.nodes.find((n) => n.id === node.id)
        if (target) target.title = title
      }
    }, `part-edit-${node.id}`)
  }

  const p = node.params ?? {}
  const targetIds = useMemo(() => new Set(p.targetLayerIds ?? []), [p.targetLayerIds])
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
          (n.params?.hierarchyParentNodeId === node.id || (instId && n.params?.instanceId === instId))
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

  const parentClusterOrLayerNodeId = useMemo(() => {
    if (!workflow) return undefined
    const clusterNode = workflow.nodes.find(
      (n) => n.params?.logicCategory === 'cluster_lock' && instId && n.params?.instanceId === instId
    )
    if (clusterNode) return clusterNode.id
    if (parentHubNode) {
      const edgeToHub = workflow.edges.find((e) => e.toNode === parentHubNode.id && !e.disabled)
      if (edgeToHub) return edgeToHub.fromNode
    }
    const edgeToSelf = workflow.edges.find((e) => e.toNode === node.id && !e.disabled)
    return edgeToSelf?.fromNode
  }, [workflow, instId, parentHubNode, node.id])

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

  const initialTab: PartEditorTab = p.partActionMode === 'pose' ? 'pose' : 'variant'
  const [subTab, setSubTab] = useState<PartEditorTab>(initialTab)

  const switchSubTab = (next: PartEditorTab): void => {
    setSubTab(next)
    if (next === 'variant' || next === 'pose') {
      onUpdate({ partActionMode: next })
    }
  }

  // 1. GIAO DIỆN NODE BỘ PHẬN CHÍNH (HUB QUẢN LÝ CÁC NODE CON BỘ PHẬN)
  if (p.isPartHub || (!p.isPartChild && childPartNodes.length > 0)) {
    const collapsed = Boolean(p.collapsedGroup)
    return (
      <div className="wf-v2-part-hub-panel" data-mcp-region="workflow_part_hub">
        <div className="wf-v2-part-hub-banner">
          <div className="wf-v2-part-hub-info">
            <strong>🧩 Cụm Bộ phận 2.5D ({childPartNodes.length} bộ phận động)</strong>
            <span>Chọn bộ phận để thay ảnh / biểu cảm theo mốc giây hoặc khi BBox di chuyển tới vị trí</span>
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

        <div className="wf-v2-part-child-grid">
          {childPartNodes.map((child) => {
            const cp = child.params ?? {}
            const trig = resolvePartMotionTriggerWindow(project, child, cp)
            const leadLayer =
              project.layers.find((l) => l.id === (cp.swapVariant || cp.swapTargetLayerId)) ??
              project.layers.find((l) => (cp.targetLayerIds ?? []).includes(l.id))
            const assetId = cp.swapAssetId || getLayerAssetId(leadLayer)
            return (
              <div key={child.id} className={`wf-v2-part-child-card${!child.enabled ? ' is-off' : ''}`}>
                <button
                  type="button"
                  className="wf-v2-part-child-main"
                  onClick={() => onSelectNode?.(child.id)}
                >
                  <AssetThumbImg
                    project={project}
                    assetId={assetId}
                    alt={child.title}
                    fallbackIcon={cp.partIcon || '🧩'}
                  />
                  <span className="part-body">
                    <strong>{cp.partGroupTitle || cleanV2NodeTitle(child.title)}</strong>
                    <small>
                      {trig.triggeredByMotion
                        ? `🏃 Tại ${Math.round(trig.pct ?? 50)}% BBox (${trig.start.toFixed(1)}s)`
                        : `⏱ ${trig.start.toFixed(1)}s–${trig.end.toFixed(1)}s`}
                    </small>
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {dynamicParts.some((dp) => !childPartNodes.some((c) => c.params?.partGroupId === dp.id)) && (
          <div className="wf-v2-subsec">
            <div className="wf-v2-subsec-head">
              <span>➕ Khôi phục bộ phận đã ẩn</span>
            </div>
            <div className="wf-v2-chip-grid">
              {dynamicParts
                .filter((dp) => !childPartNodes.some((c) => c.params?.partGroupId === dp.id))
                .map((dp) => (
                  <button
                    key={dp.id}
                    type="button"
                    className="wf-v2-spawn-chip"
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
                    + {dp.icon} {dp.title}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // 2. GIAO DIỆN NODE CON BỘ PHẬN (THUMBNAIL TRỰC QUAN + BẮT VỊ TRÍ MOTION BBOX + TƯ THẾ)
  const isFacePart = activePart?.id === 'face' && expressions.length > 0
  const selectedSubLayer =
    partLayers.find((l) => l.id === p.swapTargetLayerId || l.id === p.swapVariant) ?? partLayers[0]
  const triggerSummary = resolvePartMotionTriggerWindow(project, node, p)

  const variantItems = useMemo(() => {
    if (isFacePart) {
      return expressions.map((expr) => {
        const lyr = members.find((m) => m.id === expr.layerId)
        const active = p.swapVariant ? p.swapVariant === expr.layerId : expr.visible
        return {
          id: expr.layerId,
          label: expr.label,
          assetId: getLayerAssetId(lyr),
          active,
          badge: active ? 'Đang chọn' : undefined
        }
      })
    }
    return partLayers.map((pl) => {
      const shortName = getClusterPartShortName(pl)
      const active = p.swapVariant ? p.swapVariant === pl.id : pl.visible !== false
      return {
        id: pl.id,
        label: shortName,
        assetId: getLayerAssetId(pl),
        active,
        badge: active ? 'Đang bật' : 'Ẩn'
      }
    })
  }, [isFacePart, expressions, members, partLayers, p.swapVariant])

  return (
    <div className="wf-v2-part-child-editor" data-mcp-region="workflow_part_editor">
      <div className="wf-v2-part-child-head-bar">
        <div className="wf-v2-part-child-title-tag">
          <AssetThumbImg
            project={project}
            assetId={p.swapAssetId || getLayerAssetId(selectedSubLayer)}
            alt={node.title}
            fallbackIcon={p.partIcon || activePart?.icon || '🧩'}
          />
          <div>
            <strong>{p.partGroupTitle || activePart?.title || cleanV2NodeTitle(node.title)}</strong>
            <small>
              {triggerSummary.triggeredByMotion
                ? `🏃 Thay tại ${Math.round(triggerSummary.pct ?? 50)}% BBox (${triggerSummary.start.toFixed(2)}s)`
                : `⏱ Thay tại ${triggerSummary.start.toFixed(1)}s – ${triggerSummary.end.toFixed(1)}s`}
            </small>
          </div>
        </div>
        {parentHubNode && onSelectNode && (
          <button
            type="button"
            className="wf-v2-mini-btn"
            title="Quay về Node Cụm Bộ phận chính"
            onClick={() => onSelectNode(parentHubNode.id)}
          >
            ← Cụm Bộ phận
          </button>
        )}
      </div>

      {/* 3 Segmented Sub-Tabs chuẩn 1-Click */}
      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Chế độ chỉnh Bộ phận con">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'variant'}
          className={`wf-v2-seg-tab${subTab === 'variant' ? ' active' : ''}`}
          onClick={() => switchSubTab('variant')}
        >
          🖼 {isFacePart ? 'Biểu cảm & Ảnh' : 'Biến thể & Ảnh'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'trigger'}
          className={`wf-v2-seg-tab${subTab === 'trigger' ? ' active' : ''}`}
          onClick={() => switchSubTab('trigger')}
        >
          🎯 {triggerSummary.triggeredByMotion ? `Vị trí (${Math.round(triggerSummary.pct ?? 50)}%)` : 'Vị trí kích hoạt'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pose'}
          className={`wf-v2-seg-tab${subTab === 'pose' ? ' active' : ''}`}
          onClick={() => switchSubTab('pose')}
        >
          🤸 Tư thế
        </button>
      </div>

      {subTab === 'variant' && (
        <div className="wf-v2-subsec">
          {variantItems.length > 1 ? (
            <>
              <div className="wf-v2-subsec-head">
                <span>{isFacePart ? '😊 Chọn Biểu cảm (có hình xem trước)' : '🔄 Chọn Biến thể bộ phận'}</span>
                <button
                  type="button"
                  className={`wf-v2-mini-btn${p.partSwapHoldAfterEnd ? ' active' : ''}`}
                  onClick={() => onUpdate({ partSwapHoldAfterEnd: !p.partSwapHoldAfterEnd })}
                >
                  {p.partSwapHoldAfterEnd ? '📌 Giữ luôn sau khi thay' : '↩ Hết mốc trả mặc định'}
                </button>
              </div>
              <PartVariantThumbnailGrid
                project={project}
                items={variantItems}
                onPick={(layerId, label) =>
                  onUpdate(
                    isFacePart
                      ? { swapMode: 'expression', swapVariant: layerId, swapTargetLayerId: layerId }
                      : { swapMode: 'part_variant', swapVariant: layerId, swapTargetLayerId: layerId },
                    isFacePart
                      ? `Bộ phận: Khuôn mặt (${label})`
                      : `Bộ phận: ${p.partGroupTitle || activePart?.title || label}`
                  )
                }
              />
            </>
          ) : selectedSubLayer ? (
            <div className="wf-v2-subsec-head">
              <span>👁 Trạng thái mảnh "{getClusterPartShortName(selectedSubLayer)}"</span>
              <button
                type="button"
                className={`wf-v2-mini-btn${(p.partVisible ?? selectedSubLayer.visible) !== false ? ' active' : ''}`}
                onClick={() =>
                  onUpdate({
                    swapMode: 'toggle_part',
                    swapTargetLayerId: selectedSubLayer.id,
                    partVisible: !(p.partVisible ?? selectedSubLayer.visible)
                  })
                }
              >
                {(p.partVisible ?? selectedSubLayer.visible) !== false ? '👁 Hiện trong mốc' : '🚫 Ẩn trong mốc'}
              </button>
            </div>
          ) : null}

          {selectedSubLayer && (
            <PartReplaceAssetGrid
              project={project}
              targetLayer={selectedSubLayer}
              selectedAssetId={p.swapAssetId}
              onPickAsset={(asset) =>
                onUpdate({
                  swapMode: 'replace_asset',
                  swapTargetLayerId: selectedSubLayer.id,
                  swapAssetId: asset.id
                })
              }
            />
          )}
        </div>
      )}

      {subTab === 'trigger' && (
        <PartMotionTriggerPicker
          node={node}
          project={project}
          parentClusterOrLayerNodeId={parentClusterOrLayerNodeId}
          onUpdate={(patch) => onUpdate(patch)}
          onScrubTime={onScrubTime}
          onSelectNode={onSelectNode}
          onAttachLogic={onAttachLogic}
        />
      )}

      {subTab === 'pose' && (
        <div className="wf-v2-subsec">
          <div className="wf-v2-subsec-head">
            <span>⚡ Mẫu cử động nhanh tại điểm kích hoạt</span>
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

          <div className="wf-v2-subsec-head" style={{ marginTop: 4 }}>
            <span>🌊 Nhịp cử động</span>
          </div>
          <div className="wf-v2-pill-grid" data-cols={3} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {(
              [
                { id: 'smooth', label: '🌊 Vào-Giữ-Trả' },
                { id: 'hold', label: '📌 Giữ tư thế' },
                { id: 'oscillate', label: '👋 Vẫy lặp' }
              ] as const
            ).map((w) => (
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
    </div>
  )
}
