import React, { useRef, useState } from 'react'
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
import { WORKFLOW_V2_LIGHT_OPTIONS, getLayerDisplayName } from '../../project/workflowV2Engine'
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

  if (!layer) return null

  const runtimeAsset = layer.type === 'image' ? assetStore.get((layer.props as ImageProps).assetId) : undefined
  const projectAsset =
    layer.type === 'image' ? project.assets.find((a) => a.id === (layer.props as ImageProps).assetId) : undefined
  const thumbUrl = runtimeAsset?.thumbUrl || runtimeAsset?.url || projectAsset?.dataUrl || projectAsset?.path || null
  const layerSize: [number, number] | undefined =
    runtimeAsset?.meta.width && runtimeAsset?.meta.height
      ? [runtimeAsset.meta.width, runtimeAsset.meta.height]
      : projectAsset?.width && projectAsset?.height
        ? [projectAsset.width, projectAsset.height]
        : undefined

  const vlight: LayerVirtualLight = layer.virtualLight ?? createDefaultVirtualLight('candle')
  const isLightEnabled = Boolean(layer.virtualLight?.enabled) || cat === 'light'
  const portal: DepthPortalConfig = layer.physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalEnabled = Boolean(layer.physics?.depthPortal?.enabled) || cat === 'cave'

  const patchLight = (patch: Partial<LayerVirtualLight>, mergeKey = 'wf-v2-vlight'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds.length ? targetIds : [layer.id])
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
      const idSet = new Set(targetIds.length ? targetIds : [layer.id])
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

  const mr = layer.physics?.meshRegion
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
        const l = d.layers.find((x) => x.id === layer.id)
        if (!l) return
        if (!l.physics) l.physics = createDefaultLayerPhysics('foliage_bush')
        l.physics.meshRegion = {
          ...(l.physics.meshRegion ?? {}),
          minU,
          minV,
          maxU,
          maxV
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

  const tStart = node.params?.timeStart ?? 0
  const tEnd = node.params?.timeEnd ?? Math.max(1, tStart + 1)
  const previewTime = currentTime > tStart + 0.02 && currentTime <= tEnd ? currentTime : tStart + (tEnd - tStart) * 0.45
  const evalScale = evaluate(layer.transform.scale, previewTime)
  const evalOpacity = evaluate(layer.transform.opacity, previewTime)
  const glowColor = layer.glow?.enabled ? layer.glow.color : node.params?.animFxColor || node.params?.lightColor || '#38bdf8'
  const glowOn = Boolean(layer.glow?.enabled) || (cat === 'fx' && node.params?.fxKind !== 'wind_physics')

  return (
    <section className="wf-v2-insp-sec wf-v2-direct-stage-sec" data-mcp-region="workflow_preview">
      <div className="wf-v2-direct-stage-bar">
        <button
          type="button"
          className={`wf-v2-direct-toggle-btn${open ? ' active' : ''}`}
          onClick={onToggleOpen}
          title="Bật/tắt Khung chỉnh 2.5D trực tiếp cho Node Logic này (không hiển thị BBox của Layer)"
        >
          <span>🎛️ Khung chỉnh 2.5D trực tiếp</span>
          <small>{open ? 'Đang mở' : 'Đang ẩn'}</small>
        </button>
      </div>

      {open && (
        <div className="wf-v2-logic-pad-wrap">
          {cat === 'light' || cat === 'cave' ? (
            <VirtualLightInteractivePad
              imageUrl={thumbUrl}
              layerName={getLayerDisplayName(layer)}
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
                <span className="vl-pad-title">🎯 Khung Chỉnh 2.5D · {getLayerDisplayName(layer)}</span>
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
                title="Kéo tâm vùng tác động 2.5D trên Layer (không chứa khung BBox biến đổi Layer)"
              >
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
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={getLayerDisplayName(layer)}
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>
                      {getLayerDisplayName(layer)}
                    </span>
                  )}
                </div>

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
                  UV ({centerU.toFixed(2)}, {centerV.toFixed(2)}) · Scale {Math.round((evalScale[0] || 1) * 100)}%
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
