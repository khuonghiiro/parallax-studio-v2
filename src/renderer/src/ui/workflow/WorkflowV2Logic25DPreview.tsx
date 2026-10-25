import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DepthPortalConfig,
  ImageProps,
  Layer,
  LayerVirtualLight,
  Project,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import {
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS,
  WIND_STRENGTH_VALUES
} from '../../engine/virtualLight'
import { createDefaultLayerPhysics } from '../../engine/layerPhysics'
import { assetStore } from '../../project/assets'
import {
  WORKFLOW_V2_LIGHT_OPTIONS,
  getClusterDisplayName,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer,
  getLayerDisplayName
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { VirtualLightInteractivePad } from '../inspector/sections/VirtualLightInteractivePad'
import { resolveV2LogicCategory } from './workflowV2Theme'
import '../../styles/virtualLightInspector.css'

export interface WorkflowV2Logic25DPreviewProps {
  node: WorkflowNode
  project: Project
  currentTime: number
  open: boolean
  onToggleOpen: () => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onScrubTime: (t: number) => void
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

interface AssembledPartBox {
  id: string
  name: string
  url: string
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
  zDepth: number
  rotDeg: number
  opacity: number
}

function resolveLayerThumbAndSize(
  l: Layer,
  project: Project
): { url: string | null; w: number; h: number } {
  if (l.type !== 'image') return { url: null, w: 320, h: 320 }
  const assetId = (l.props as ImageProps).assetId
  const rt = assetStore.get(assetId)
  const pa = project.assets.find((a) => a.id === assetId)
  const url = rt?.url || rt?.thumbUrl || pa?.dataUrl || pa?.path || null
  const w = rt?.meta.width || pa?.width || 400
  const h = rt?.meta.height || pa?.height || 400
  return { url, w, h }
}

export const WorkflowV2Logic25DPreview: React.FC<WorkflowV2Logic25DPreviewProps> = ({
  node,
  project,
  currentTime,
  open,
  onToggleOpen,
  onUpdateParams,
  onScrubTime
}) => {
  const cat = resolveV2LogicCategory(node)
  const targetIds = node.params?.targetLayerIds ?? []
  const layer: Layer | undefined =
    project.layers.find((l) => targetIds.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
    project.layers.find((l) => targetIds.includes(l.id))

  const stageRef = useRef<HTMLDivElement | null>(null)
  const [draggingUV, setDraggingUV] = useState(false)
  const [clusterDataUrl, setClusterDataUrl] = useState<string | null>(null)
  const [, setAssetTick] = useState(0)

  useEffect(() => assetStore.subscribe(() => setAssetTick((n) => n + 1)), [])

  const clusterInstId =
    node.params?.instanceId ??
    layer?.composite?.instanceId ??
    layer?.model3d?.instanceId ??
    null
  const clusterMembers = useMemo(
    () => (clusterInstId ? getClusterMemberLayers(project, clusterInstId, layer) : []),
    [project, clusterInstId, layer]
  )
  const clusterRoot = useMemo(() => getClusterRootLayer(clusterMembers) ?? layer, [clusterMembers, layer])
  const isClusterLocked = Boolean(layer?.composite?.lockedGroup ?? layer?.model3d?.lockedGroup)
  const singleOnly = Boolean(node.params?.singleSubLayerOnly)
  const showFullCluster = clusterMembers.length > 1 && !singleOnly && (isClusterLocked || targetIds.length > 1)

  const tStart = node.params?.timeStart ?? 0
  const tEnd = node.params?.timeEnd ?? Math.max(1, tStart + 1)
  const previewTime = currentTime > tStart + 0.02 && currentTime <= tEnd ? currentTime : tStart + (tEnd - tStart) * 0.45

  // Tính bố cục lắp ghép toàn bộ các mảnh con hiển thị trong Cụm 2.5D / 3D
  const assembledCluster = useMemo<{
    parts: AssembledPartBox[]
    unionW: number
    unionH: number
  } | null>(() => {
    if (!showFullCluster || clusterMembers.length <= 1) return null
    const visibleMembers = clusterMembers.filter((m) => m.visible !== false)
    if (visibleMembers.length === 0) return null

    const rawItems: {
      id: string
      name: string
      url: string
      cx: number
      cy: number
      w: number
      h: number
      z: number
      rot: number
      op: number
    }[] = []

    for (const m of visibleMembers) {
      const { url, w: rawW, h: rawH } = resolveLayerThumbAndSize(m, project)
      if (!url) continue
      const pos = evaluate(m.transform.position, previewTime)
      const scl = evaluate(m.transform.scale, previewTime)
      const rot = evaluate(m.transform.rotation, previewTime)
      const op = evaluate(m.transform.opacity, previewTime)
      const w = Math.max(16, rawW * Math.abs(scl[0] || 1))
      const h = Math.max(16, rawH * Math.abs(scl[1] || 1))
      rawItems.push({
        id: m.id,
        name: m.name,
        url,
        cx: pos[0],
        cy: -pos[1],
        w,
        h,
        z: pos[2] ?? 0,
        rot: rot[2] ?? 0,
        op: clamp(op, 0.05, 1)
      })
    }
    if (rawItems.length === 0) return null

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const it of rawItems) {
      minX = Math.min(minX, it.cx - it.w / 2)
      maxX = Math.max(maxX, it.cx + it.w / 2)
      minY = Math.min(minY, it.cy - it.h / 2)
      maxY = Math.max(maxY, it.cy + it.h / 2)
    }
    const unionW = Math.max(60, maxX - minX)
    const unionH = Math.max(60, maxY - minY)

    // Sắp xếp từ xa tới gần (Z lớn nằm sau, Z nhỏ nằm trước)
    const sorted = [...rawItems].sort((a, b) => b.z - a.z)
    const parts: AssembledPartBox[] = sorted.map((it) => ({
      id: it.id,
      name: it.name,
      url: it.url,
      leftPct: ((it.cx - it.w / 2 - minX) / unionW) * 100,
      topPct: ((it.cy - it.h / 2 - minY) / unionH) * 100,
      widthPct: (it.w / unionW) * 100,
      heightPct: (it.h / unionH) * 100,
      zDepth: it.z,
      rotDeg: it.rot,
      opacity: it.op
    }))

    return { parts, unionW: Math.round(unionW), unionH: Math.round(unionH) }
  }, [showFullCluster, clusterMembers, project, previewTime])

  // Ghép ảnh tổng hợp cả cụm trên offscreen canvas cho VirtualLightInteractivePad (Light / Cave)
  useEffect(() => {
    if (!open || (cat !== 'light' && cat !== 'cave') || !assembledCluster || assembledCluster.parts.length <= 1) {
      setClusterDataUrl(null)
      return
    }
    let cancelled = false
    const maxDim = 360
    const aspect = assembledCluster.unionW / Math.max(1, assembledCluster.unionH)
    const cw = aspect >= 1 ? maxDim : Math.max(120, Math.round(maxDim * aspect))
    const ch = aspect >= 1 ? Math.max(120, Math.round(maxDim / aspect)) : maxDim

    const loadImg = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
      })

    void Promise.all(assembledCluster.parts.map((p) => loadImg(p.url))).then((imgs) => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      assembledCluster.parts.forEach((p, idx) => {
        const img = imgs[idx]
        if (!img) return
        const px = (p.leftPct / 100) * cw
        const py = (p.topPct / 100) * ch
        const pw = (p.widthPct / 100) * cw
        const ph = (p.heightPct / 100) * ch
        ctx.save()
        ctx.globalAlpha = p.opacity
        if (Math.abs(p.rotDeg) > 0.1) {
          ctx.translate(px + pw / 2, py + ph / 2)
          ctx.rotate((p.rotDeg * Math.PI) / 180)
          ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph)
        } else {
          ctx.drawImage(img, px, py, pw, ph)
        }
        ctx.restore()
      })
      try {
        setClusterDataUrl(canvas.toDataURL('image/png'))
      } catch {
        setClusterDataUrl(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [open, cat, assembledCluster])

  if (!layer) return null

  const { url: singleThumbUrl, w: singleW, h: singleH } = resolveLayerThumbAndSize(layer, project)
  const thumbUrl = showFullCluster && clusterDataUrl ? clusterDataUrl : singleThumbUrl
  const layerSize: [number, number] =
    showFullCluster && assembledCluster
      ? [assembledCluster.unionW, assembledCluster.unionH]
      : [singleW, singleH]

  const effectiveLayerIds = useMemo(() => {
    if (showFullCluster && clusterMembers.length > 1) return clusterMembers.map((m) => m.id)
    return targetIds.length ? targetIds : [layer.id]
  }, [showFullCluster, clusterMembers, targetIds, layer.id])

  const displayTargetTitle = showFullCluster && clusterRoot
    ? `${getClusterDisplayName(clusterRoot)} (${clusterMembers.length} mảnh)`
    : getLayerDisplayName(layer)

  const vlight: LayerVirtualLight = (clusterRoot ?? layer).virtualLight ?? createDefaultVirtualLight('candle')
  const isLightEnabled = Boolean((clusterRoot ?? layer).virtualLight?.enabled) || cat === 'light'
  const portal: DepthPortalConfig = (clusterRoot ?? layer).physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalEnabled = Boolean((clusterRoot ?? layer).physics?.depthPortal?.enabled) || cat === 'cave'

  const toggleClusterScope = (): void => {
    const nextSingle = !singleOnly
    const nextIds = nextSingle ? [layer.id] : clusterMembers.map((m) => m.id)
    onUpdateParams(node.id, {
      singleSubLayerOnly: nextSingle,
      targetLayerIds: nextIds
    })
  }

  const patchLight = (patch: Partial<LayerVirtualLight>, mergeKey = 'wf-v2-vlight'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(effectiveLayerIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        const base = l.virtualLight ?? createDefaultVirtualLight('candle')
        const next: LayerVirtualLight = { ...base, enabled: true, ...patch }
        if (patch.kind && patch.kind !== base.kind) {
          const p = VIRTUAL_LIGHT_PRESETS[patch.kind]
          if (p) {
            if (patch.color === undefined) next.color = p.color
            if (patch.intensity === undefined) next.intensity = p.intensity
            if (patch.radius === undefined) next.radius = p.radius
            if (patch.zReach === undefined) next.zReach = p.zReach
            if (patch.coneAngleDeg === undefined) next.coneAngleDeg = p.coneAngleDeg
            if (patch.beamAngleDeg === undefined) next.beamAngleDeg = p.beamAngleDeg
            if (patch.beamCurvature === undefined) next.beamCurvature = p.beamCurvature
            if (patch.flickerSpeed === undefined) next.flickerSpeed = p.flickerSpeed
            if (patch.windSensitivity === undefined) next.windSensitivity = p.windSensitivity
            if (patch.windPreset === undefined) next.windPreset = p.windPreset
            next.windStrength = WIND_STRENGTH_VALUES[next.windPreset ?? 'gentle']
            if (patch.ambientDim === undefined) next.ambientDim = p.ambientDim
            if (patch.softness === undefined) next.softness = p.softness
          }
        }
        l.virtualLight = next
      }
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        const opt = patch.kind ? WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.virtualKind === patch.kind) : undefined
        wfNode.params = {
          ...(wfNode.params ?? {}),
          ...(opt ? { lightMode: opt.id } : {}),
          ...(patch.color ? { lightColor: patch.color } : {}),
          ...(patch.intensity !== undefined ? { intensity: patch.intensity } : {})
        }
      }
    }, mergeKey)
  }

  const patchPortal = (patch: Partial<DepthPortalConfig>, mergeKey = 'wf-v2-portal'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(effectiveLayerIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        if (!l.physics) {
          l.physics = createDefaultLayerPhysics('ground_terrain')
          l.physics.enabled = true
        }
        const base = l.physics.depthPortal ?? createDefaultDepthPortal()
        l.physics.depthPortal = { ...base, enabled: true, ...patch }
      }
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        wfNode.params = {
          ...(wfNode.params ?? {}),
          ...(patch.archShape ? { caveArchShape: patch.archShape } : {}),
          ...(patch.darkness !== undefined ? { caveDarkness: patch.darkness, intensity: patch.darkness } : {}),
          ...(patch.minScale !== undefined ? { caveMinScale: patch.minScale } : {})
        }
      }
    }, mergeKey)
  }

  const mr = (clusterRoot ?? layer).physics?.meshRegion
  const subRect: [number, number, number, number] = mr
    ? [mr.minU, mr.minV, mr.maxU, mr.maxV]
    : [0.12, 0.12, 0.88, 0.88]
  const centerU = clamp((subRect[0] + subRect[2]) * 0.5, 0.1, 0.9)
  const centerV = clamp((subRect[1] + subRect[3]) * 0.5, 0.1, 0.9)
  const spanU = clamp(subRect[2] - subRect[0], 0.2, 0.95)
  const spanV = clamp(subRect[3] - subRect[1], 0.2, 0.95)

  const handleStageDrag = (e: React.PointerEvent): void => {
    if (cat === 'light' || cat === 'cave') return
    const el = stageRef.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    setDraggingUV(true)

    const applyAt = (clientX: number, clientY: number): void => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const u = clamp((clientX - rect.left) / rect.width, 0.12, 0.88)
      const v = clamp((clientY - rect.top) / rect.height, 0.12, 0.88)
      const halfU = spanU * 0.5
      const halfV = spanV * 0.5
      const minU = Number(clamp(u - halfU, 0.02, 0.92).toFixed(2))
      const minV = Number(clamp(v - halfV, 0.02, 0.92).toFixed(2))
      const maxU = Number(clamp(u + halfU, 0.08, 0.98).toFixed(2))
      const maxV = Number(clamp(v + halfV, 0.08, 0.98).toFixed(2))
      useEditor.getState().update((d) => {
        const idSet = new Set(effectiveLayerIds)
        for (const l of d.layers) {
          if (!idSet.has(l.id)) continue
          if (!l.physics) l.physics = createDefaultLayerPhysics('foliage_bush')
          l.physics.meshRegion = {
            ...(l.physics.meshRegion ?? {}),
            minU,
            minV,
            maxU,
            maxV
          }
        }
      }, 'wf-v2-logic-uv')
    }

    applyAt(e.clientX, e.clientY)
    const onMove = (ev: PointerEvent): void => applyAt(ev.clientX, ev.clientY)
    const onUp = (): void => {
      setDraggingUV(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const evalScale = evaluate(layer.transform.scale, previewTime)
  const evalOpacity = evaluate(layer.transform.opacity, previewTime)
  const glowColor = layer.glow?.enabled ? layer.glow.color : node.params?.animFxColor || node.params?.lightColor || '#38bdf8'
  const glowOn = Boolean(layer.glow?.enabled) || (cat === 'fx' && node.params?.fxKind !== 'wind_physics')

  return (
    <section className="wf-v2-insp-sec wf-v2-direct-stage-sec" data-mcp-region="workflow_preview">
      <div className="wf-v2-direct-stage-bar" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          className={`wf-v2-direct-toggle-btn${open ? ' active' : ''}`}
          style={{ flex: 1 }}
          onClick={onToggleOpen}
          title="Bật/tắt Khung chỉnh 2.5D trực tiếp cho Node Logic này"
        >
          <span>🎛️ {showFullCluster ? `Khung chỉnh 2.5D Cả Cụm (${clusterMembers.length} mảnh)` : 'Khung chỉnh 2.5D trực tiếp'}</span>
          <small>{open ? 'Đang mở' : 'Đang ẩn'}</small>
        </button>
        {open && clusterMembers.length > 1 && (
          <button
            type="button"
            className="wf-v2-direct-btn"
            style={{ height: 22, padding: '0 7px', flexShrink: 0 }}
            title="Chuyển nhanh phạm vi tác động của Node Logic giữa Toàn bộ Cụm đang khoá và Riêng 1 mảnh con"
            onClick={toggleClusterScope}
          >
            {showFullCluster ? `🔒 Cả cụm (${clusterMembers.length})` : `🎯 Riêng: ${getClusterPartShortName(layer)}`}
          </button>
        )}
      </div>

      {open && (
        <div className="wf-v2-logic-pad-wrap">
          {cat === 'light' || cat === 'cave' ? (
            <VirtualLightInteractivePad
              imageUrl={thumbUrl}
              layerName={displayTargetTitle}
              layerSize={layerSize}
              vlight={vlight}
              isLightEnabled={isLightEnabled}
              portal={portal}
              isPortalEnabled={isPortalEnabled}
              onPatchLight={patchLight}
              onPatchPortal={patchPortal}
            />
          ) : (
            <div className="vl-pad-card">
              <div className="vl-pad-header">
                <span className="vl-pad-title">🎯 Khung Chỉnh 2.5D · {displayTargetTitle}</span>
                <div className="vl-pad-badges">
                  <span className="vl-badge-light">
                    {Math.round((node.params?.intensity ?? 1) * 100)}%
                  </span>
                </div>
              </div>

              <div
                ref={stageRef}
                className="vl-pad-stage"
                onPointerDown={handleStageDrag}
                title="Kéo tâm vùng tác động 2.5D trên Cụm / Layer"
              >
                {showFullCluster && assembledCluster && assembledCluster.parts.length > 1 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '8%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      filter: glowOn ? `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 0 20px ${glowColor})` : undefined
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width:
                          assembledCluster.unionW >= assembledCluster.unionH
                            ? '100%'
                            : `${Math.round((assembledCluster.unionW / assembledCluster.unionH) * 100)}%`,
                        height:
                          assembledCluster.unionH >= assembledCluster.unionW
                            ? '100%'
                            : `${Math.round((assembledCluster.unionH / assembledCluster.unionW) * 100)}%`
                      }}
                    >
                      {assembledCluster.parts.map((part) => (
                        <img
                          key={part.id}
                          src={part.url}
                          alt={part.name}
                          draggable={false}
                          style={{
                            position: 'absolute',
                            left: `${part.leftPct}%`,
                            top: `${part.topPct}%`,
                            width: `${part.widthPct}%`,
                            height: `${part.heightPct}%`,
                            objectFit: 'fill',
                            opacity: part.opacity,
                            transform: Math.abs(part.rotDeg) > 0.1 ? `rotate(${part.rotDeg}deg)` : undefined
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '10%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      opacity: clamp(evalOpacity, 0.15, 1),
                      transform: `scale(${clamp(evalScale[0] || 1, 0.4, 1.45).toFixed(3)}, ${clamp(evalScale[1] || 1, 0.4, 1.45).toFixed(3)})`,
                      filter: glowOn ? `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 0 20px ${glowColor})` : undefined,
                      transition: 'transform 60ms linear'
                    }}
                  >
                    {singleThumbUrl ? (
                      <img
                        src={singleThumbUrl}
                        alt={displayTargetTitle}
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>
                        {displayTargetTitle}
                      </span>
                    )}
                  </div>
                )}

                {/* Vùng lưới đàn hồi / tâm tác động 2.5D */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${subRect[0] * 100}%`,
                    top: `${subRect[1] * 100}%`,
                    width: `${(subRect[2] - subRect[0]) * 100}%`,
                    height: `${(subRect[3] - subRect[1]) * 100}%`,
                    border: '1.5px dashed rgba(56, 189, 248, 0.85)',
                    borderRadius: 6,
                    background: 'rgba(56, 189, 248, 0.08)',
                    pointerEvents: 'none'
                  }}
                />
                <div
                  className={`vl-handle vl-handle-aim${draggingUV ? ' dragging' : ''}`}
                  style={{ left: `${centerU * 100}%`, top: `${centerV * 100}%` }}
                  title={`Tâm vùng 2.5D UV (${centerU.toFixed(2)}, ${centerV.toFixed(2)})`}
                >
                  🎯
                </div>
              </div>

              <div className="vl-pad-footer" style={{ justifyContent: 'space-between' }}>
                <span className="vl-pad-stat">
                  {showFullCluster ? `🔒 Cả cụm ${clusterMembers.length} mảnh · ` : ''}UV ({centerU.toFixed(2)}, {centerV.toFixed(2)})
                </span>
                <button
                  type="button"
                  className="wf-v2-direct-btn"
                  style={{ flex: '0 0 auto', height: 20, padding: '0 7px' }}
                  onClick={() => onScrubTime(node.params?.timeStart ?? 0)}
                >
                  ▶ Xem tại {(node.params?.timeStart ?? 0).toFixed(1)}s
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
