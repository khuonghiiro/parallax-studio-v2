import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluateScene } from '../../engine/evaluateScene'
import { assetStore } from '../../project/assets'
import { v2LayerNodeId } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import {
  computeShotStageLayout,
  extractCameraFrames2D,
  getLayer2DFilterStyle,
  getLook2DCssFilter,
  projectShotLayers2D,
  type ProjectedLayer2D
} from '../viewer/animateCamera/animateCameraMath'
import {
  enrichCameraWaypoints,
  ensureShotWaypointTime,
  panCameraToLayer2D,
  updateCameraWaypoint
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { Layer2DLightOverlay } from '../viewer/animateCamera/AnimateShotPlane2D'
import { resolveV2NodeLevel, resolveV2NodeTheme } from './workflowV2Theme'

export interface WorkflowV2DirectStagePreviewProps {
  node: WorkflowNode
  project: Project
  workflow: WorkflowGraph
  currentTime: number
  open: boolean
  onToggleOpen: () => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onSelectNode?: (nodeId: string) => void
  onScrubTime: (t: number) => void
}

const STEP_CIRCLES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
const CAM_STEP_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316']

/**
 * Khung chỉnh sửa BBox & vị trí trực tiếp kiểu Camera 2D ngay trong tab "Thuộc tính Node" (nằm trên mục Khoảng thời gian):
 * - Node Layer / Logic gắn Layer: kéo BBox để dời vị trí (X, Y), kéo 4 góc để đổi kích thước (Scale), hoặc bấm ngắm Camera vào BBox.
 * - Node Camera / Cảnh con (#1, #2...): hiển thị lộ trình ① → ② và kéo trực tiếp BBox khung ngắm Camera để lia máy (stageX, stageY) hoặc thu phóng (Zoom %).
 */
export const WorkflowV2DirectStagePreview: React.FC<WorkflowV2DirectStagePreviewProps> = ({
  node,
  project,
  workflow,
  currentTime,
  open,
  onToggleOpen,
  onUpdateParams,
  onSelectNode,
  onScrubTime
}) => {
  const update = useEditor((s) => s.update)
  const selectLayer = useEditor((s) => s.selectLayer)
  const setPlaying = useEditor((s) => s.setPlaying)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(276)
  const [, setAssetTick] = useState(0)

  useEffect(() => assetStore.subscribe(() => setAssetTick((n) => n + 1)), [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0)
      if (w > 80) setBoxWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const level = resolveV2NodeLevel(node)
  const theme = resolveV2NodeTheme(node)
  const isCamNode = node.type === 'camera_director'
  const isWaypointNode = Boolean(node.params?.isCameraWaypoint)
  const repLayerId = node.params?.targetLayerIds?.[0] ?? null
  const activeLayerObj = repLayerId ? project.layers.find((l) => l.id === repLayerId) : undefined

  const effectiveShotId =
    node.params?.shotId ??
    activeLayerObj?.shotId ??
    project.shots[0]?.id ??
    null

  const sampleTime = useMemo(() => {
    if (isWaypointNode && typeof node.params?.timeStart === 'number') return node.params.timeStart
    return currentTime
  }, [isWaypointNode, node.params?.timeStart, currentTime])

  const stageLayout = useMemo(() => computeShotStageLayout(project, 0), [project])
  const frames = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const waypoints = useMemo(() => enrichCameraWaypoints(frames), [frames])

  const shotBox = useMemo(
    () => (effectiveShotId ? stageLayout.find((b) => b.shotId === effectiveShotId) : null) ?? stageLayout[0],
    [stageLayout, effectiveShotId]
  )

  const shotWaypoints = useMemo(
    () => waypoints.filter((w) => w.shotId === shotBox?.shotId),
    [waypoints, shotBox?.shotId]
  )

  const activeWaypoint = useMemo(() => {
    if (isWaypointNode) {
      const idx = node.params?.waypointIndex ?? 0
      return waypoints[idx] ?? shotWaypoints[node.params?.waypointLocalIndex ?? 0] ?? shotWaypoints[0]
    }
    return shotWaypoints.find((w) => Math.abs(w.time - sampleTime) <= 0.5) ?? shotWaypoints[0] ?? waypoints[0]
  }, [isWaypointNode, node.params?.waypointIndex, node.params?.waypointLocalIndex, waypoints, shotWaypoints, sampleTime])

  const ev = useMemo(() => evaluateScene(project, sampleTime), [project, sampleTime])
  const layers2D = useMemo(() => {
    if (!shotBox) return []
    const isFirst = stageLayout[0]?.shotId === shotBox.shotId
    return projectShotLayers2D(project, ev, shotBox.shotId, isFirst, {
      yaw: activeWaypoint?.yaw ?? 0,
      pitch: activeWaypoint?.pitch ?? 0
    })
  }, [project, ev, shotBox, stageLayout, activeWaypoint?.yaw, activeWaypoint?.pitch])

  const selectedProjLayer = useMemo(
    () => (repLayerId ? layers2D.find((l) => l.id === repLayerId) : undefined),
    [layers2D, repLayerId]
  )

  const compW = Math.max(100, project.comp.width || 1920)
  const compH = Math.max(100, project.comp.height || 1080)
  // Chừa viền 14% quanh khung cảnh để thấy rõ cả các BBox tràn nhẹ ra ngoài biên cảnh
  const padScale = 0.84
  const stageW = Math.max(160, boxWidth)
  const stageH = Math.max(104, Math.min(168, Math.round(stageW * (compH / compW))))
  const zoom = (stageW / compW) * padScale
  const shotScreenW = compW * zoom
  const shotScreenH = compH * zoom
  const shotLeft = (stageW - shotScreenW) / 2
  const shotTop = (stageH - shotScreenH) / 2

  const startLayerDrag = useCallback(
    (e: React.PointerEvent, proj: ProjectedLayer2D, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'): void => {
      e.stopPropagation()
      e.preventDefault()
      setPlaying(false)
      selectLayer(proj.id)
      const layerObj = useEditor.getState().project.layers.find((l) => l.id === proj.id)
      if (!layerObj) return
      const startX = e.clientX
      const startY = e.clientY
      const origPos = [...(layerObj.transform.position.value ?? [0, 0, 0])]
      const origScale = [...(layerObj.transform.scale.value ?? [1, 1, 1])]
      const safeZoom = Math.max(0.02, zoom)
      const refD = 1483.64
      const pFactor = refD / Math.max(80, refD + (origPos[2] ?? 0))

      const onMove = (pev: PointerEvent): void => {
        const dxStage = (pev.clientX - startX) / safeZoom
        const dyStage = (pev.clientY - startY) / safeZoom
        update((d) => {
          const dl = d.layers.find((l) => l.id === proj.id)
          if (!dl) return
          if (mode === 'move') {
            const nx = Math.round(origPos[0] + dxStage / pFactor)
            const ny = Math.round(origPos[1] - dyStage / pFactor)
            dl.transform.position.value = [nx, ny, origPos[2] ?? 0]
            const wfNode = d.workflow?.nodes.find((n) => n.id === v2LayerNodeId(dl.id))
            if (wfNode?.params) {
              wfNode.params.transformX = nx
              wfNode.params.transformY = ny
            }
          } else {
            const signX = mode === 'ne' || mode === 'se' ? 1 : -1
            const signY = mode === 'sw' || mode === 'se' ? 1 : -1
            const deltaW = dxStage * signX * 2
            const deltaH = dyStage * signY * 2
            const ratioW = Math.max(0.1, Math.min(8, (proj.width + deltaW) / Math.max(12, proj.width)))
            const ratioH = Math.max(0.1, Math.min(8, (proj.height + deltaH) / Math.max(12, proj.height)))
            const ratio = Number(((ratioW + ratioH) / 2).toFixed(3))
            dl.transform.scale.value = [
              Number((origScale[0] * ratio).toFixed(3)),
              Number((origScale[1] * ratio).toFixed(3)),
              origScale[2] ?? 1
            ]
          }
        }, `wf-mini-layer-bbox-${proj.id}`)
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [zoom, setPlaying, selectLayer, update]
  )

  const startCameraWaypointDrag = useCallback(
    (e: React.PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'): void => {
      if (!shotBox || !activeWaypoint) return
      e.stopPropagation()
      e.preventDefault()
      setPlaying(false)
      onScrubTime(activeWaypoint.time)
      const startX = e.clientX
      const startY = e.clientY
      const origStageX = activeWaypoint.stageX
      const origStageY = activeWaypoint.stageY
      const origScale = activeWaypoint.scale
      const origW = compW * origScale
      const safeZoom = Math.max(0.02, zoom)

      const onMove = (pev: PointerEvent): void => {
        const dxStage = (pev.clientX - startX) / safeZoom
        const dyStage = (pev.clientY - startY) / safeZoom
        if (mode === 'move') {
          const nextStageX = Math.round(origStageX + dxStage)
          const nextStageY = Math.round(origStageY + dyStage)
          update((d) => {
            updateCameraWaypoint(d, stageLayout, activeWaypoint.time, {
              stageX: nextStageX,
              stageY: nextStageY
            })
          }, `wf-mini-cam-bbox-${activeWaypoint.index}`)
        } else {
          const signX = mode === 'ne' || mode === 'se' ? 1 : -1
          const deltaW = dxStage * signX * 2
          const nextScale = Math.max(0.25, Math.min(2.2, Number(((origW + deltaW) / compW).toFixed(3))))
          update((d) => {
            updateCameraWaypoint(d, stageLayout, activeWaypoint.time, {
              scale: nextScale
            })
          }, `wf-mini-cam-bbox-${activeWaypoint.index}`)
        }
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [shotBox, activeWaypoint, compW, zoom, stageLayout, setPlaying, onScrubTime, update]
  )

  const handleCenterLayer = (): void => {
    if (!repLayerId) return
    onUpdateParams(node.id, { transformX: 0, transformY: 0 })
  }

  const handleResetLayerScale = (): void => {
    if (!repLayerId) return
    update((d) => {
      const dl = d.layers.find((l) => l.id === repLayerId)
      if (dl) dl.transform.scale.value = [1, 1, 1]
    })
  }

  const handleAimCameraAtLayer = (): void => {
    if (!shotBox || !selectedProjLayer) return
    let targetTime = activeWaypoint?.time ?? currentTime
    update((d) => {
      if (shotBox.shotId && activeWaypoint?.shotId !== shotBox.shotId) {
        targetTime = ensureShotWaypointTime(d, stageLayout, shotBox.shotId, targetTime, true)
      }
      panCameraToLayer2D(
        d,
        stageLayout,
        shotBox.shotId,
        selectedProjLayer.offsetX,
        selectedProjLayer.offsetY,
        targetTime,
        activeWaypoint?.scale ?? 0.72,
        activeWaypoint?.ease ?? 'easeInOut',
        selectedProjLayer.zDepth
      )
    })
    onScrubTime(targetTime)
  }

  const handleResetCameraWaypoint = (targetScale: number): void => {
    if (!shotBox || !activeWaypoint) return
    update((d) => {
      updateCameraWaypoint(d, stageLayout, activeWaypoint.time, {
        stageX: shotBox.stageX,
        stageY: shotBox.stageY,
        scale: targetScale
      })
    })
  }

  const handles: { key: 'nw' | 'ne' | 'sw' | 'se'; cls: string }[] = [
    { key: 'nw', cls: 'nw' },
    { key: 'ne', cls: 'ne' },
    { key: 'sw', cls: 'sw' },
    { key: 'se', cls: 'se' }
  ]

  return (
    <section className="wf-v2-insp-sec wf-v2-direct-stage-sec">
      <div className="wf-v2-direct-stage-bar">
        <button
          type="button"
          className={`wf-v2-direct-toggle-btn${open ? ' active' : ''}`}
          onClick={onToggleOpen}
          title={open ? 'Ẩn khung chỉnh sửa trực tiếp BBox 2D' : 'Hiện khung chỉnh sửa trực tiếp BBox 2D như trên Camera 2D'}
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>🎯 Khung BBox 2D trực tiếp</span>
          <small>{open ? 'Đang bật' : 'Đang tắt'}</small>
        </button>
      </div>

      {open && shotBox && (
        <div
          ref={wrapRef}
          className="wf-v2-direct-stage wf-inspector-preview-box"
          data-mcp-region="workflow_preview"
        >
          <div
            className="wf-v2-direct-canvas"
            style={{ width: '100%', height: stageH }}
          >
            {/* Khung biên 16:9 của Cảnh 2D */}
            <div
              className="wf-v2-direct-shot-plane"
              style={{
                left: shotLeft,
                top: shotTop,
                width: shotScreenW,
                height: shotScreenH,
                background: project.comp.background,
                filter: getLook2DCssFilter(project.look)
              }}
            >
              {layers2D.map((l) => {
                const lw = l.width * zoom
                const lh = l.height * zoom
                const lx = shotScreenW / 2 + l.offsetX * zoom - lw / 2
                const ly = shotScreenH / 2 + l.offsetY * zoom - lh / 2
                const isTarget = l.id === repLayerId
                const runtimeAsset = l.assetId ? assetStore.get(l.assetId) : undefined
                const imgUrl = runtimeAsset?.url || runtimeAsset?.thumbUrl
                return (
                  <div
                    key={l.id}
                    className={`wf-v2-direct-layer${isTarget ? ' is-target' : ''}`}
                    style={{
                      left: lx,
                      top: ly,
                      width: lw,
                      height: lh,
                      opacity: l.opacity,
                      transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined
                    }}
                    title={`Bấm để chọn "${l.name}" (Z ${Math.round(l.zDepth)})`}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      if (isTarget) {
                        startLayerDrag(e, l, 'move')
                        return
                      }
                      e.stopPropagation()
                      selectLayer(l.id)
                      const lNode = workflow.nodes.find(
                        (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(l.id)
                      )
                      if (lNode) onSelectNode?.(lNode.id)
                    }}
                  >
                    {l.type === 'image' && imgUrl && (
                      <>
                        <img
                          src={imgUrl}
                          alt={l.name}
                          draggable={false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'fill',
                            display: 'block',
                            filter: getLayer2DFilterStyle(l, Math.max(0.3, zoom * 2))
                          }}
                        />
                        <Layer2DLightOverlay layer={l} imgUrl={imgUrl} />
                      </>
                    )}
                    {l.type === 'solid' && (
                      <div style={{ width: '100%', height: '100%', background: l.solidColor ?? '#334155' }} />
                    )}
                    {l.type === 'text' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: l.textColor ?? '#ffffff',
                          fontSize: Math.max(7, (l.fontSize ?? 36) * zoom),
                          fontWeight: 700,
                          textAlign: 'center'
                        }}
                      >
                        {l.text}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Lộ trình các cảnh con (#1 → #2...) & BBox Camera tương tác */}
            {shotWaypoints.length > 0 && (
              <svg className="wf-v2-direct-cam-svg" width={stageW} height={stageH}>
                {shotWaypoints.map((wp, idx) => {
                  if (idx === 0) return null
                  const prev = shotWaypoints[idx - 1]
                  const x1 = stageW / 2 + (prev.stageX - shotBox.stageX) * zoom
                  const y1 = stageH / 2 + (prev.stageY - shotBox.stageY) * zoom
                  const x2 = stageW / 2 + (wp.stageX - shotBox.stageX) * zoom
                  const y2 = stageH / 2 + (wp.stageY - shotBox.stageY) * zoom
                  const stepColor = CAM_STEP_COLORS[idx % CAM_STEP_COLORS.length]
                  return (
                    <line
                      key={`cam-seg-${wp.index}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={stepColor}
                      strokeWidth={1.8}
                      strokeDasharray="4 3"
                    />
                  )
                })}
              </svg>
            )}

            {/* Khung BBox của các cảnh con trong lộ trình Camera */}
            {(isCamNode || level === 'root') &&
              shotWaypoints.map((wp, localIdx) => {
                const isFocusedWp = activeWaypoint?.index === wp.index
                const stepColor = CAM_STEP_COLORS[localIdx % CAM_STEP_COLORS.length]
                const fw = Math.max(20, compW * wp.scale * zoom)
                const fh = Math.max(14, compH * wp.scale * zoom)
                const fx = stageW / 2 + (wp.stageX - shotBox.stageX) * zoom - fw / 2
                const fy = stageH / 2 + (wp.stageY - shotBox.stageY) * zoom - fh / 2
                const wpNodeId = `v2-cam-wp-${shotBox.shotId}-${localIdx}`
                return (
                  <div
                    key={`wp-bbox-${wp.index}`}
                    className={`wf-v2-direct-cam-bbox${isFocusedWp ? ' active' : ''}`}
                    style={{
                      left: fx,
                      top: fy,
                      width: fw,
                      height: fh,
                      ['--cam-step-c' as string]: stepColor
                    }}
                    title={`#${wp.displayLabel} · ${wp.tagLabel} — Kéo để lia máy, kéo góc để Zoom`}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      if (!isFocusedWp) {
                        e.stopPropagation()
                        onScrubTime(wp.time)
                        onSelectNode?.(wpNodeId)
                        return
                      }
                      startCameraWaypointDrag(e, 'move')
                    }}
                  >
                    <span className="wf-v2-direct-cam-tag">
                      {STEP_CIRCLES[localIdx] ?? localIdx + 1} #{wp.displayLabel} · {wp.zoomPct}%
                    </span>
                    {isFocusedWp &&
                      handles.map((h) => (
                        <span
                          key={h.key}
                          className={`wf-v2-bbox-handle ${h.cls}`}
                          onPointerDown={(e) => startCameraWaypointDrag(e, h.key)}
                        />
                      ))}
                  </div>
                )
              })}

            {/* Khung BBox tương tác trực tiếp của Layer đang chọn */}
            {selectedProjLayer && (
              <div
                className="wf-v2-direct-layer-bbox"
                style={{
                  left: shotLeft + shotScreenW / 2 + selectedProjLayer.offsetX * zoom - Math.max(18, selectedProjLayer.width * zoom) / 2,
                  top: shotTop + shotScreenH / 2 + selectedProjLayer.offsetY * zoom - Math.max(18, selectedProjLayer.height * zoom) / 2,
                  width: Math.max(18, selectedProjLayer.width * zoom),
                  height: Math.max(18, selectedProjLayer.height * zoom),
                  ['--wf-v2-accent' as string]: theme.accent
                }}
                title={`Kéo để chỉnh vị trí BBox "${selectedProjLayer.name}" · Kéo 4 góc để đổi kích thước`}
                onPointerDown={(e) => {
                  if (e.button === 0) startLayerDrag(e, selectedProjLayer, 'move')
                }}
              >
                <span className="wf-v2-direct-bbox-tag">
                  BBox · {selectedProjLayer.name}
                </span>
                <span className="wf-v2-direct-bbox-crosshair" />
                {handles.map((h) => (
                  <span
                    key={h.key}
                    className={`wf-v2-bbox-handle ${h.cls}`}
                    onPointerDown={(e) => startLayerDrag(e, selectedProjLayer, h.key)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thanh thông số toạ độ BBox & thao tác nhanh */}
          {selectedProjLayer && activeLayerObj ? (
            <div className="wf-v2-direct-footer">
              <span className="wf-v2-direct-coords">
                X <b>{Math.round(activeLayerObj.transform.position.value?.[0] ?? 0)}</b> · Y{' '}
                <b>{Math.round(activeLayerObj.transform.position.value?.[1] ?? 0)}</b> · Z{' '}
                <b>{Math.round(activeLayerObj.transform.position.value?.[2] ?? 0)}</b> · Cỡ{' '}
                <b>{Math.round((activeLayerObj.transform.scale.value?.[0] ?? 1) * 100)}%</b>
              </span>
              <div className="wf-v2-direct-actions">
                <button type="button" className="wf-v2-direct-btn" onClick={handleCenterLayer} title="Đặt vị trí BBox về chính giữa khung cảnh (X=0, Y=0)">
                  ⊡ Giữa khung
                </button>
                <button type="button" className="wf-v2-direct-btn" onClick={handleResetLayerScale} title="Đặt lại tỷ lệ BBox về 100%">
                  ↺ 100%
                </button>
                <button type="button" className="wf-v2-direct-btn accent" onClick={handleAimCameraAtLayer} title="Lia khung Camera đang chọn vào đúng BBox của Layer này">
                  🎯 Ngắm Cam
                </button>
              </div>
            </div>
          ) : activeWaypoint ? (
            <div className="wf-v2-direct-footer">
              <span className="wf-v2-direct-coords">
                BBox Cam <b>#{activeWaypoint.displayLabel}</b> · Tâm{' '}
                <b>
                  ({Math.round(activeWaypoint.stageX - shotBox.stageX)}, {Math.round(activeWaypoint.stageY - shotBox.stageY)})
                </b>{' '}
                · Zoom <b>{activeWaypoint.zoomPct}%</b>
              </span>
              <div className="wf-v2-direct-actions">
                <button type="button" className="wf-v2-direct-btn" onClick={() => handleResetCameraWaypoint(1)} title="Căn BBox Camera về chuẩn 100% giữa cảnh">
                  ⊡ Chuẩn 100%
                </button>
                <button type="button" className="wf-v2-direct-btn accent" onClick={() => handleResetCameraWaypoint(0.667)} title="Thu hẹp BBox Camera để đẩy cận 150%">
                  🔍 Đẩy cận 150%
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
