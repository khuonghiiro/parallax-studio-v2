import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AssetMeta,
  ImageProps,
  Layer,
  Project,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { assetStore } from '../../project/assets'
import { ensureClusterPartTimeline, patchPartCue } from '../../project/workflowPartEditing'
import {
  listCompatibleMotionNodesForPart,
  projectWorldPointToMotionPct,
  resolvePartMotionTriggerWindow,
  sampleMotionNodeTrajectory
} from '../../project/workflowPartMotionTrigger'
import { recomputeSharedLogicTargets } from '../../project/workflowV2PhysicsAndValidation'
import { getClusterPartShortName } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { cleanV2NodeTitle, type WorkflowV2SpawnCategory } from './workflowV2Theme'
import { ParamSlider } from './WorkflowV2NodeParams'

function resolveAssetThumbData(
  project: Project,
  assetId?: string
): { url?: string; zoomStyle?: React.CSSProperties } {
  if (!assetId) return {}
  const rt = assetStore.get(assetId)
  const saved = project.assets.find((a) => a.id === assetId)
  const url = rt?.thumbUrl || rt?.url || saved?.dataUrl || saved?.path
  if (!url) return {}

  // Nếu sprite nhỏ nằm trong khung trong suốt lớn (như mảnh mắt/miệng nhân vật 2.5D), tự căn tâm phóng cận vùng có pixel
  if (rt?.alpha && rt.alpha.w > 8 && rt.alpha.h > 8) {
    const { w, h, data } = rt.alpha
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[y * w + x] > 16) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const bw = (maxX - minX + 2) / w
      const bh = (maxY - minY + 2) / h
      const span = Math.max(bw, bh)
      if (span > 0.03 && span < 0.48) {
        const cx = ((minX + maxX) * 0.5 / w) * 100
        const cy = ((minY + maxY) * 0.5 / h) * 100
        const zoom = Math.min(3.4, Math.max(1.4, 0.72 / span))
        return {
          url,
          zoomStyle: {
            transformOrigin: `${cx.toFixed(1)}% ${cy.toFixed(1)}%`,
            transform: `scale(${zoom.toFixed(2)})`
          }
        }
      }
    }
  }
  return { url }
}

function useAssetStoreTick(): number {
  const [tick, setTick] = useState(() => assetStore.version)
  useEffect(() => assetStore.subscribe(() => setTick(assetStore.version)), [])
  return tick
}

export function AssetThumbImg({
  project,
  assetId,
  alt,
  fallbackIcon = '🖼'
}: {
  project: Project
  assetId?: string
  alt: string
  fallbackIcon?: string
}): React.ReactElement {
  const tick = useAssetStoreTick()
  const { url, zoomStyle } = useMemo(
    () => resolveAssetThumbData(project, assetId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, assetId, tick]
  )
  if (!url) {
    return <span className="wf-part-thumb-fallback" aria-hidden="true">{fallbackIcon}</span>
  }
  return (
    <span className="wf-part-thumb-box">
      <img src={url} alt={alt} loading="lazy" draggable={false} style={zoomStyle} />
    </span>
  )
}

export interface VariantCardItem {
  id: string
  label: string
  assetId?: string
  active: boolean
  badge?: string
}

export function PartVariantThumbnailGrid({
  project,
  items,
  onPick
}: {
  project: Project
  items: VariantCardItem[]
  onPick: (id: string, label: string) => void
}): React.ReactElement {
  return (
    <div className="wf-part-variant-grid">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`wf-part-thumb-card${item.active ? ' active' : ''}`}
          title={item.label}
          onClick={() => onPick(item.id, item.label)}
        >
          <AssetThumbImg project={project} assetId={item.assetId} alt={item.label} fallbackIcon="🎭" />
          <span className="wf-part-thumb-meta">
            <strong>{item.label}</strong>
            {item.badge && <small>{item.badge}</small>}
          </span>
        </button>
      ))}
    </div>
  )
}

export function PartReplaceAssetGrid({
  project,
  targetLayer,
  selectedAssetId,
  onPickAsset
}: {
  project: Project
  targetLayer: Layer
  selectedAssetId?: string
  onPickAsset: (asset: AssetMeta) => void
}): React.ReactElement {
  const [query, setQuery] = useState('')
  const currentLayerAssetId =
    targetLayer.type === 'image' ? (targetLayer.props as ImageProps).assetId : undefined
  const effectiveAssetId = selectedAssetId || currentLayerAssetId
  const currentAsset = project.assets.find((a) => a.id === currentLayerAssetId)
  const replacementAsset = project.assets.find((a) => a.id === effectiveAssetId)

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return project.assets.filter(
      (a) => a.kind === 'image' && (!q || a.name.toLocaleLowerCase().includes(q))
    )
  }, [project.assets, query])

  return (
    <div className="wf-part-asset-grid-section" data-mcp-region="workflow_part_asset_grid">
      <div className="wf-part-compare-strip">
        <div className="wf-part-compare-slot">
          <AssetThumbImg project={project} assetId={currentLayerAssetId} alt="Ảnh gốc" />
          <div>
            <small>Đang dùng trên "{getClusterPartShortName(targetLayer)}"</small>
            <strong>{currentAsset?.name ?? 'Chưa gắn ảnh'}</strong>
          </div>
        </div>
        <span className="wf-part-compare-arrow" aria-hidden="true">➔</span>
        <div className={`wf-part-compare-slot${selectedAssetId && selectedAssetId !== currentLayerAssetId ? ' is-swapped' : ''}`}>
          <AssetThumbImg project={project} assetId={effectiveAssetId} alt="Ảnh thay" />
          <div>
            <small>{selectedAssetId && selectedAssetId !== currentLayerAssetId ? 'Sẽ thay bằng' : 'Chưa đổi ảnh khác'}</small>
            <strong>{replacementAsset?.name ?? 'Chọn ảnh bên dưới'}</strong>
          </div>
        </div>
      </div>

      <input
        className="wf-part-asset-search"
        aria-label="Tìm ảnh có preview để thay bộ phận"
        placeholder={`🔍 Tìm trong ${project.assets.filter((a) => a.kind === 'image').length} ảnh dự án…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filteredAssets.length === 0 ? (
        <p className="wf-v2-hint">Không tìm thấy ảnh phù hợp trong kho dự án.</p>
      ) : (
        <div className="wf-part-asset-thumb-grid">
          {filteredAssets.map((asset) => {
            const isPicked = effectiveAssetId === asset.id
            return (
              <button
                key={asset.id}
                type="button"
                className={`wf-part-asset-card${isPicked ? ' active' : ''}`}
                title={`Thay bằng ảnh "${asset.name}"`}
                onClick={() => onPickAsset(asset)}
              >
                <AssetThumbImg project={project} assetId={asset.id} alt={asset.name} />
                <span className="wf-part-asset-name">{asset.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PartMotionTriggerPicker({
  node,
  project,
  parentClusterOrLayerNodeId,
  onUpdate,
  onScrubTime,
  onSelectNode,
  onAttachLogic
}: {
  node: WorkflowNode
  project: Project
  parentClusterOrLayerNodeId?: string
  onUpdate: (patch: Partial<WorkflowNodeParams>) => void
  onScrubTime: (t: number) => void
  onSelectNode?: (id: string) => void
  onAttachLogic?: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
}): React.ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const p = node.params ?? {}
  const compatibleMotions = useMemo(
    () => listCompatibleMotionNodesForPart(project, node),
    [project, node]
  )
  const triggerInfo = useMemo(
    () => resolvePartMotionTriggerWindow(project, node, p),
    [project, node, p]
  )
  const isMotionMode = triggerInfo.triggeredByMotion || p.partTriggerMode === 'motion_bbox'
  const activeMotionNode = triggerInfo.motionNode ?? compatibleMotions[0]
  const traj = useMemo(
    () => (activeMotionNode ? sampleMotionNodeTrajectory(project, activeMotionNode, 32) : null),
    [project, activeMotionNode]
  )

  const syncMotionTriggerWire = (enableMotion: boolean, motionId?: string, extra?: Partial<WorkflowNodeParams>): void => {
    useEditor.getState().update((draft) => {
      if (!draft.workflow) return
      const wf = draft.workflow
      const filteredEdges = wf.edges.filter((e) => {
        if (e.toNode !== node.id) return true
        const src = wf.nodes.find((n) => n.id === e.fromNode)
        return src?.params?.logicCategory !== 'action'
      })
      if (enableMotion && motionId) {
        filteredEdges.push({
          id: `e-${motionId}-${node.id}`,
          fromNode: motionId,
          fromPort: 'motion_stream',
          toNode: node.id,
          toPort: 'motion_stream',
          disabled: false
        })
      }
      wf.edges = filteredEdges
      patchPartCue(draft, node.id, {
        partTriggerMode: enableMotion ? 'motion_bbox' : 'time',
        linkedMotionNodeId: enableMotion ? motionId : undefined,
        motionTriggerPct: p.motionTriggerPct ?? 50,
        partSwapHoldAfterEnd: p.partSwapHoldAfterEnd ?? true,
        ...(extra ?? {})
      })
      wf.nodes = recomputeSharedLogicTargets(wf.nodes, wf.edges)
      if (p.instanceId) {
        ensureClusterPartTimeline(
          draft,
          wf.nodes.filter((n) => n.params?.logicCategory === 'part_swap' && n.params?.instanceId === p.instanceId)
        )
      }
    }, `part-motion-trigger-${node.id}`)
  }

  const pickPointFromSvg = (clientX: number, clientY: number, bounds: { vx: number; vy: number; vw: number; vh: number }): void => {
    if (!svgRef.current || !activeMotionNode) return
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width < 10 || rect.height < 10) return
    const worldX = bounds.vx + ((clientX - rect.left) / rect.width) * bounds.vw
    const worldY = -(bounds.vy + ((clientY - rect.top) / rect.height) * bounds.vh)
    const snapped = projectWorldPointToMotionPct(project, activeMotionNode, worldX, worldY)
    onUpdate({
      partTriggerMode: 'motion_bbox',
      linkedMotionNodeId: activeMotionNode.id,
      motionTriggerPct: snapped.pct,
      motionTriggerX: snapped.snappedX,
      motionTriggerY: snapped.snappedY
    })
    onScrubTime(snapped.triggerTime)
  }

  const mapBounds = useMemo(() => {
    if (!traj || traj.samples.length === 0) return { vx: -400, vy: -240, vw: 800, vh: 480 }
    let minX = Infinity
    let maxX = -Infinity
    let minSvgY = Infinity
    let maxSvgY = -Infinity
    for (const s of traj.samples) {
      minX = Math.min(minX, s.x)
      maxX = Math.max(maxX, s.x)
      minSvgY = Math.min(minSvgY, -s.y)
      maxSvgY = Math.max(maxSvgY, -s.y)
    }
    const spanX = Math.max(240, maxX - minX)
    const spanY = Math.max(140, maxSvgY - minSvgY)
    const padX = spanX * 0.24
    const padY = spanY * 0.34
    return {
      vx: minX - padX,
      vy: minSvgY - padY,
      vw: spanX + padX * 2,
      vh: spanY + padY * 2
    }
  }, [traj])

  const pctVal = Math.round(triggerInfo.pct ?? p.motionTriggerPct ?? 50)
  const triggerPt = triggerInfo.triggerXY ?? [traj?.targetX ?? 0, traj?.targetY ?? 0]

  return (
    <div className="wf-part-trigger-picker" data-mcp-region="workflow_part_trigger_picker">
      <div className="wf-v2-subsec-head">
        <span>🎯 Điều kiện kích hoạt thay bộ phận</span>
        <small>{isMotionMode && activeMotionNode ? `Bắt theo BBox (${triggerInfo.start.toFixed(2)}s)` : 'Theo mốc giây'}</small>
      </div>

      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Cách kích hoạt thay bộ phận">
        <button
          type="button"
          role="tab"
          aria-selected={!isMotionMode}
          className={`wf-v2-seg-tab${!isMotionMode ? ' active' : ''}`}
          onClick={() => syncMotionTriggerWire(false)}
        >
          ⏱ Theo mốc giây
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isMotionMode}
          className={`wf-v2-seg-tab${isMotionMode ? ' active' : ''}`}
          onClick={() => syncMotionTriggerWire(true, activeMotionNode?.id)}
        >
          🏃 Khi BBox tới vị trí
        </button>
      </div>

      {isMotionMode && (
        <div className="wf-part-motion-box">
          {compatibleMotions.length === 0 ? (
            <div className="wf-part-motion-empty">
              <span>Cụm / Cảnh này chưa có Node Motion BBox nào để bắt vị trí di chuyển.</span>
              {parentClusterOrLayerNodeId && onAttachLogic && (
                <button
                  type="button"
                  className="wf-v2-opt-pill active"
                  onClick={() => onAttachLogic(parentClusterOrLayerNodeId, 'action', 'v2:action:bbox_target')}
                >
                  <span className="wf-v2-opt-pill-txt">+ 🏃 Tạo ngay Motion BBox #1 → #2</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {compatibleMotions.length > 1 && (
                <div className="wf-v2-chip-grid">
                  {compatibleMotions.map((mn) => (
                    <button
                      key={mn.id}
                      type="button"
                      className={`wf-v2-spawn-chip${activeMotionNode?.id === mn.id ? ' is-selected' : ''}`}
                      onClick={() => syncMotionTriggerWire(true, mn.id)}
                    >
                      🏃 {cleanV2NodeTitle(mn.title)}
                    </button>
                  ))}
                </div>
              )}

              {activeMotionNode && traj && (
                <>
                  <div className="wf-part-traj-head">
                    <span>Chạm vào đường đi BBox #1 ➔ #2 để ghim điểm thay 🎯</span>
                    {onSelectNode && (
                      <button
                        type="button"
                        className="wf-v2-mini-btn"
                        onClick={() => onSelectNode(activeMotionNode.id)}
                      >
                        Mở Motion ↗
                      </button>
                    )}
                  </div>

                  <svg
                    ref={svgRef}
                    className="wf-part-traj-svg"
                    viewBox={`${mapBounds.vx} ${mapBounds.vy} ${mapBounds.vw} ${mapBounds.vh}`}
                    role="img"
                    aria-label="Sơ đồ đường đi Motion BBox và điểm thay bộ phận"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      e.preventDefault()
                      pickPointFromSvg(e.clientX, e.clientY, mapBounds)
                      const onMove = (ev: PointerEvent) => pickPointFromSvg(ev.clientX, ev.clientY, mapBounds)
                      const onUp = () => {
                        window.removeEventListener('pointermove', onMove)
                        window.removeEventListener('pointerup', onUp)
                        window.removeEventListener('pointercancel', onUp)
                      }
                      window.addEventListener('pointermove', onMove)
                      window.addEventListener('pointerup', onUp)
                      window.addEventListener('pointercancel', onUp)
                    }}
                  >
                    <polyline
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      points={traj.samples.map((s) => `${s.x},${-s.y}`).join(' ')}
                    />
                    <polyline
                      fill="none"
                      stroke="var(--accent-cyan)"
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      points={traj.samples
                        .filter((s) => s.pct <= pctVal)
                        .map((s) => `${s.x},${-s.y}`)
                        .join(' ')}
                    />
                    {/* Điểm Xuất phát #1 */}
                    <circle
                      cx={traj.startPos[0]}
                      cy={-traj.startPos[1]}
                      r={mapBounds.vh * 0.055}
                      fill="var(--bg-2)"
                      stroke="var(--text-dim)"
                      strokeWidth={1.6}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Điểm Đích #2 */}
                    <circle
                      cx={traj.targetX}
                      cy={-traj.targetY}
                      r={mapBounds.vh * 0.06}
                      fill="var(--bg-2)"
                      stroke="var(--accent)"
                      strokeWidth={1.8}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Điểm Kích hoạt Thay bộ phận 🎯 */}
                    <circle
                      cx={triggerPt[0]}
                      cy={-triggerPt[1]}
                      r={mapBounds.vh * 0.085}
                      fill="var(--key)"
                      stroke="var(--on-key)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  <div className="wf-part-pct-pills">
                    {[
                      { pct: 0, label: '0% Đầu' },
                      { pct: 25, label: '25%' },
                      { pct: 50, label: '50% Giữa' },
                      { pct: 75, label: '75%' },
                      { pct: 100, label: '100% Đích' }
                    ].map((m) => (
                      <button
                        key={m.pct}
                        type="button"
                        className={`wf-v2-opt-pill${Math.abs(pctVal - m.pct) <= 3 ? ' active' : ''}`}
                        onClick={() => {
                          const s = traj.samples.reduce((best, cur) =>
                            Math.abs(cur.pct - m.pct) < Math.abs(best.pct - m.pct) ? cur : best
                          )
                          onUpdate({
                            partTriggerMode: 'motion_bbox',
                            linkedMotionNodeId: activeMotionNode.id,
                            motionTriggerPct: m.pct,
                            motionTriggerX: s.x,
                            motionTriggerY: s.y
                          })
                          onScrubTime(s.time)
                        }}
                      >
                        <span className="wf-v2-opt-pill-txt">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  <ParamSlider
                    label="Vị trí quãng đường"
                    min={0}
                    max={100}
                    step={1}
                    value={pctVal}
                    format={(v) => `${Math.round(v)}% · ${triggerInfo.start.toFixed(2)}s`}
                    onChange={(v) => {
                      const pct = Math.round(v)
                      onUpdate({
                        partTriggerMode: 'motion_bbox',
                        linkedMotionNodeId: activeMotionNode.id,
                        motionTriggerPct: pct
                      })
                    }}
                  />

                  <div className="wf-part-trigger-summary">
                    <span>📍 Thay tại tọa độ ({triggerPt[0]}, {triggerPt[1]}) · tự khớp mốc {triggerInfo.start.toFixed(2)}s</span>
                    <button
                      type="button"
                      className={`wf-v2-mini-btn${(p.partSwapHoldAfterEnd ?? true) ? ' active' : ''}`}
                      onClick={() => onUpdate({ partSwapHoldAfterEnd: !(p.partSwapHoldAfterEnd ?? true) })}
                    >
                      {(p.partSwapHoldAfterEnd ?? true) ? '📌 Giữ luôn tới cuối' : `⏱ Giữ ${(p.motionTriggerHoldSec ?? 1.5).toFixed(1)}s`}
                    </button>
                  </div>

                  {p.partSwapHoldAfterEnd === false && (
                    <ParamSlider
                      label="Thời gian giữ sau khi thay"
                      min={0.3}
                      max={6}
                      step={0.1}
                      value={p.motionTriggerHoldSec ?? 1.5}
                      format={(v) => `${v.toFixed(1)}s`}
                      onChange={(v) => onUpdate({ motionTriggerHoldSec: Number(v.toFixed(1)) })}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
