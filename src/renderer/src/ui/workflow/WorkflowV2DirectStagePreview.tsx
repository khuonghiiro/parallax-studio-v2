import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluateScene } from '../../engine/evaluateScene'
import { assetStore } from '../../project/assets'
import {
  evaluateCleanLayerPos,
  evaluateCleanLayerScale
} from '../../project/workflowV2BboxMotionAndCollision'
import {
  getClusterDisplayName,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer,
  scaleClusterAroundRoot,
  syncWorkflowV2NodeToProject,
  translateClusterToRootPos,
  v2ClusterLockId,
  v2LayerNodeId
} from '../../project/workflowV2Engine'
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
import {
  resolveActiveMotionNode,
  WorkflowV2StageBboxMotionOverlay
} from './WorkflowV2StageBboxMotionOverlay'
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
 * Khung chỉnh sửa BBox & vị trí trực tiếp kiểu Camera 2D ngay trong tab "Thuộc tính Node":
 * - Node Khoá Cụm 2.5D / 3D (`cluster_lock`): BBox bao trọn toàn bộ các mảnh trong cụm, kéo/thu phóng cả cụm đồng bộ.
 * - Node Layer con trong cụm: cho phép chọn chỉnh BBox riêng từng mảnh (cập nhật `rootOffset`) hoặc chuyển 1 chạm sang BBox cả cụm.
 * - Node Camera / Cảnh con (#1, #2...): hiển thị lộ trình ① → ② và kéo trực tiếp BBox khung ngắm Camera.
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
  const playing = useEditor((s) => s.playing)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(320)
  const [, setAssetTick] = useState(0)
  const [scopeOverride, setScopeOverride] = useState<'cluster' | 'part' | null>(null)
  const [customStageH, setCustomStageH] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem('pxs:wf-stage-h'))
      return Number.isFinite(saved) && saved >= 160 && saved <= 520 ? saved : null
    } catch {
      return null
    }
  })
  const [stageZoomBoost, setStageZoomBoost] = useState<number>(1)

  useEffect(() => {
    setScopeOverride(null)
  }, [node.id])

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
  const isClusterLockNode = node.params?.logicCategory === 'cluster_lock'
  const repLayerId = node.params?.targetLayerIds?.[0] ?? null
  const activeLayerObj = repLayerId ? project.layers.find((l) => l.id === repLayerId) : undefined

  const clusterInstId =
    node.params?.instanceId ??
    activeLayerObj?.composite?.instanceId ??
    activeLayerObj?.model3d?.instanceId ??
    null
  const clusterMembers = useMemo(
    () => (clusterInstId ? getClusterMemberLayers(project, clusterInstId, activeLayerObj) : []),
    [project, clusterInstId, activeLayerObj]
  )
  const clusterMemberIds = useMemo(() => new Set(clusterMembers.map((m) => m.id)), [clusterMembers])
  const clusterRootLayer = useMemo(() => getClusterRootLayer(clusterMembers), [clusterMembers])
  const isClusterLocked = Boolean(
    isClusterLockNode
      ? node.enabled && node.params?.lockedGroup !== false
      : activeLayerObj?.composite?.lockedGroup ?? activeLayerObj?.model3d?.lockedGroup
  )

  // Trên Node Khoá Cụm: luôn chỉnh BBox cả cụm. Trên Node mảnh con: mặc định chỉnh riêng mảnh đó (hoặc chuyển 1 chạm sang Cả cụm)
  const useClusterBbox =
    clusterMembers.length > 1 &&
    (isClusterLockNode || scopeOverride === 'cluster' || (scopeOverride === null && level !== 'layer' && isClusterLocked))

  const effectiveShotId =
    node.params?.shotId ??
    activeLayerObj?.shotId ??
    clusterRootLayer?.shotId ??
    project.shots[0]?.id ??
    null

  const sampleTime = useMemo(() => {
    if (isWaypointNode && typeof node.params?.timeStart === 'number') return node.params.timeStart
    if (playing) return Math.round(currentTime * 12) / 12
    return currentTime
  }, [isWaypointNode, node.params?.timeStart, playing, currentTime])

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

  const clusterUnionProj = useMemo<ProjectedLayer2D | undefined>(() => {
    if (clusterMembers.length <= 1) return undefined
    const memberProjs = layers2D.filter((l) => clusterMemberIds.has(l.id))
    if (memberProjs.length === 0) return undefined
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const mp of memberProjs) {
      minX = Math.min(minX, mp.offsetX - mp.width / 2)
      maxX = Math.max(maxX, mp.offsetX + mp.width / 2)
      minY = Math.min(minY, mp.offsetY - mp.height / 2)
      maxY = Math.max(maxY, mp.offsetY + mp.height / 2)
    }
    const base = memberProjs.find((m) => m.id === clusterRootLayer?.id) ?? memberProjs[0]
    const cName = clusterRootLayer ? getClusterDisplayName(clusterRootLayer) : base.name
    return {
      ...base,
      name: `${cName} (${clusterMembers.length} mảnh)`,
      offsetX: (minX + maxX) / 2,
      offsetY: (minY + maxY) / 2,
      width: Math.max(24, maxX - minX),
      height: Math.max(24, maxY - minY)
    }
  }, [clusterMembers.length, layers2D, clusterMemberIds, clusterRootLayer])

  const singleProjLayer = useMemo(
    () => (repLayerId ? layers2D.find((l) => l.id === repLayerId) : undefined),
    [layers2D, repLayerId]
  )

  const selectedProjLayer = useClusterBbox ? (clusterUnionProj ?? singleProjLayer) : singleProjLayer

  const compW = Math.max(100, project.comp.width || 1920)
  const compH = Math.max(100, project.comp.height || 1080)
  const padScale = 0.96
  const stageW = Math.max(200, boxWidth)
  const naturalH = Math.max(195, Math.min(340, Math.round(((stageW * padScale) * compH) / compW) + 12))
  const stageH = customStageH ?? naturalH
  const baseZoom = Math.min((stageW * padScale) / compW, (stageH * padScale) / compH)
  const zoom = baseZoom * stageZoomBoost
  const shotScreenW = compW * zoom
  const shotScreenH = compH * zoom
  const shotLeft = (stageW - shotScreenW) / 2
  const shotTop = (stageH - shotScreenH) / 2

  const startStageResizeDrag = useCallback(
    (e: React.PointerEvent): void => {
      e.stopPropagation()
      e.preventDefault()
      const startY = e.clientY
      const startH = stageH
      const onMove = (pev: PointerEvent): void => {
        const nextH = Math.max(165, Math.min(480, Math.round(startH + (pev.clientY - startY))))
        setCustomStageH(nextH)
        try {
          localStorage.setItem('pxs:wf-stage-h', String(nextH))
        } catch {
          // ignore storage error
        }
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [stageH]
  )

  const startLayerDrag = useCallback(
    (e: React.PointerEvent, proj: ProjectedLayer2D, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'): void => {
      e.stopPropagation()
      e.preventDefault()
      setPlaying(false)
      const st = useEditor.getState().project
      const refLayer = useClusterBbox
        ? (clusterRootLayer ?? st.layers.find((l) => l.id === proj.id))
        : st.layers.find((l) => l.id === proj.id)
      if (!refLayer) return
      if (!isClusterLockNode) selectLayer(refLayer.id)

      const startX = e.clientX
      const startY = e.clientY
      const origPos = evaluateCleanLayerPos(refLayer, refLayer.inPoint ?? 0)
      const origScale = evaluateCleanLayerScale(refLayer, refLayer.inPoint ?? 0)
      const safeZoom = Math.max(0.02, zoom)
      const refD = 1483.64
      const pFactor = refD / Math.max(80, refD + (origPos[2] ?? 0))

      const onMove = (pev: PointerEvent): void => {
        const dxStage = (pev.clientX - startX) / safeZoom
        const dyStage = (pev.clientY - startY) / safeZoom
        update((d) => {
          if (useClusterBbox && clusterInstId) {
            const members = getClusterMemberLayers(d, clusterInstId)
            if (members.length === 0) return
            if (mode === 'move') {
              const nx = Math.round(origPos[0] + dxStage / pFactor)
              const ny = Math.round(origPos[1] - dyStage / pFactor)
              translateClusterToRootPos(members, { x: nx, y: ny })
              const cNode = d.workflow?.nodes.find((n) => n.id === v2ClusterLockId(clusterInstId))
              if (cNode?.params) {
                cNode.params.transformX = nx
                cNode.params.transformY = ny
              }
            } else {
              const signX = mode === 'ne' || mode === 'se' ? 1 : -1
              const signY = mode === 'sw' || mode === 'se' ? 1 : -1
              const deltaW = dxStage * signX * 2
              const deltaH = dyStage * signY * 2
              const ratioW = Math.max(0.15, Math.min(4, (proj.width + deltaW) / Math.max(12, proj.width)))
              const ratioH = Math.max(0.15, Math.min(4, (proj.height + deltaH) / Math.max(12, proj.height)))
              const ratio = (ratioW + ratioH) / 2
              const nextPct = Math.round(Math.abs(origScale[0] || 1) * ratio * 100)
              scaleClusterAroundRoot(members, nextPct)
            }
            if (d.workflow) {
              const actMot = resolveActiveMotionNode(d.workflow, node, refLayer.id, clusterInstId)
              if (actMot) syncWorkflowV2NodeToProject(d, actMot)
            }
            return
          }

          const dl = d.layers.find((l) => l.id === proj.id)
          if (!dl) return
          if (mode === 'move') {
            const nx = Math.round(origPos[0] + dxStage / pFactor)
            const ny = Math.round(origPos[1] - dyStage / pFactor)
            dl.transform.position.value = [nx, ny, origPos[2] ?? 0]
            if (dl.composite?.instanceId) {
              const members = getClusterMemberLayers(d, dl.composite.instanceId)
              const root = getClusterRootLayer(members)
              if (root && root.id !== dl.id) {
                const rp = root.transform.position.value ?? [0, 0, 0]
                dl.composite.rootOffset = [
                  Math.round((nx - rp[0]) * 100) / 100,
                  Math.round((ny - rp[1]) * 100) / 100,
                  Math.round(((origPos[2] ?? 0) - rp[2]) * 100) / 100
                ]
              }
            }
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
          if (d.workflow) {
            const actMot = resolveActiveMotionNode(d.workflow, node, dl.id, dl.composite?.instanceId)
            if (actMot) syncWorkflowV2NodeToProject(d, actMot)
          }
        }, `wf-mini-layer-bbox-${useClusterBbox ? clusterInstId : proj.id}`)
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [zoom, setPlaying, selectLayer, update, useClusterBbox, clusterRootLayer, isClusterLockNode, clusterInstId, node]
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
    if (useClusterBbox && clusterInstId) {
      update((d) => {
        translateClusterToRootPos(getClusterMemberLayers(d, clusterInstId), { x: 0, y: 0 })
      })
      return
    }
    if (!repLayerId) return
    onUpdateParams(node.id, { transformX: 0, transformY: 0 })
  }

  const handleResetLayerScale = (): void => {
    if (useClusterBbox && clusterInstId) {
      update((d) => {
        scaleClusterAroundRoot(getClusterMemberLayers(d, clusterInstId), 72)
      })
      return
    }
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

  const coordRefLayer = useClusterBbox ? (clusterRootLayer ?? activeLayerObj) : activeLayerObj

  return (
    <section className="wf-v2-insp-sec wf-v2-direct-stage-sec">
      <div className="wf-v2-direct-stage-bar" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          className={`wf-v2-direct-toggle-btn${open ? ' active' : ''}`}
          style={{ flex: '1 1 auto', minWidth: 0 }}
          onClick={onToggleOpen}
          title={open ? 'Ẩn khung chỉnh sửa trực tiếp BBox 2D' : 'Hiện khung chỉnh sửa trực tiếp BBox 2D như trên Camera 2D'}
        >
          <span>{open ? '▾' : '▸'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🎯 {useClusterBbox ? `BBox Cụm (${clusterMembers.length} mảnh)` : 'Khung BBox 2D trực tiếp'}
          </span>
        </button>
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <button
              type="button"
              className={`wf-v2-direct-btn${customStageH === null && stageZoomBoost === 1 ? ' accent' : ''}`}
              style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
              title="Tự động dãn khung 2D vừa khít toàn bộ chiều ngang bảng"
              onClick={() => {
                setCustomStageH(null)
                setStageZoomBoost(1)
                try {
                  localStorage.removeItem('pxs:wf-stage-h')
                } catch {
                  // ignore
                }
              }}
            >
              ↔ Khít
            </button>
            <button
              type="button"
              className={`wf-v2-direct-btn${customStageH && customStageH >= 280 ? ' accent' : ''}`}
              style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
              title="Mở rộng chiều cao khung BBox 2D để dễ kéo & vẽ đường đi"
              onClick={() => {
                const nextH = customStageH && customStageH >= 280 ? null : 300
                setCustomStageH(nextH)
                try {
                  if (nextH) localStorage.setItem('pxs:wf-stage-h', String(nextH))
                  else localStorage.removeItem('pxs:wf-stage-h')
                } catch {
                  // ignore
                }
              }}
            >
              ↕ Cao
            </button>
            <button
              type="button"
              className={`wf-v2-direct-btn${stageZoomBoost > 1 ? ' accent' : ''}`}
              style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
              title="Phóng to khung cảnh 2D (100% -> 125% -> 150%) để chỉnh BBox chi tiết"
              onClick={() =>
                setStageZoomBoost((z) => (z < 1.2 ? 1.25 : z < 1.45 ? 1.5 : 1))
              }
            >
              🔍 {Math.round(stageZoomBoost * 100)}%
            </button>
          </div>
        )}
        {open && clusterMembers.length > 1 && !isClusterLockNode && (
          <button
            type="button"
            className="wf-v2-direct-btn"
            style={{ height: 22, padding: '0 7px', flexShrink: 0 }}
            title="Chuyển nhanh chế độ kéo BBox giữa Riêng mảnh đang chọn và Toàn bộ Cụm"
            onClick={() => setScopeOverride(useClusterBbox ? 'part' : 'cluster')}
          >
            {useClusterBbox ? '🔒 BBox Cụm' : `🎯 Riêng: ${activeLayerObj ? getClusterPartShortName(activeLayerObj) : 'Mảnh'}`}
          </button>
        )}
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
                const isTarget = useClusterBbox ? clusterMemberIds.has(l.id) : l.id === repLayerId
                const runtimeAsset = l.assetId ? assetStore.get(l.assetId) : undefined
                const projAsset = l.assetId ? project.assets.find((a) => a.id === l.assetId) : undefined
                const imgUrl = runtimeAsset?.url || runtimeAsset?.thumbUrl || projAsset?.dataUrl || projAsset?.path
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
                      if (isTarget && selectedProjLayer) {
                        startLayerDrag(e, selectedProjLayer, 'move')
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
                            objectFit: 'contain',
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

            {/* Khung BBox tương tác trực tiếp của Layer hoặc Toàn bộ Cụm */}
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
                title={
                  useClusterBbox
                    ? `Kéo để dời toàn bộ Cụm "${selectedProjLayer.name}" · Kéo 4 góc để phóng to/thu nhỏ cả cụm`
                    : `Kéo để chỉnh vị trí riêng "${selectedProjLayer.name}" · Kéo 4 góc để đổi kích thước`
                }
                onPointerDown={(e) => {
                  if (e.button === 0) startLayerDrag(e, selectedProjLayer, 'move')
                }}
              >
                <span className="wf-v2-direct-bbox-tag">
                  {useClusterBbox ? '🔒 BBox Cụm · ' : 'BBox · '}
                  {selectedProjLayer.name}
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

            {/* Lớp phủ Ghost BBox #2 (Đích) & Quỹ đạo #1 -> #2 & Điểm Va Chạm */}
            <WorkflowV2StageBboxMotionOverlay
              project={project}
              workflow={workflow}
              node={node}
              selectedProjLayer={selectedProjLayer}
              coordRefLayer={coordRefLayer}
              useClusterBbox={useClusterBbox}
              clusterInstId={clusterInstId ?? undefined}
              stageW={stageW}
              stageH={stageH}
              shotLeft={shotLeft}
              shotTop={shotTop}
              shotScreenW={shotScreenW}
              shotScreenH={shotScreenH}
              zoom={zoom}
              onSelectNode={onSelectNode}
              onScrubTime={onScrubTime}
            />
          </div>

          {/* Thanh nắm kéo dãn chiều cao khung BBox 2D trực tiếp */}
          <div
            className="wf-v2-stage-resizer"
            onPointerDown={startStageResizeDrag}
            title="Kéo lên/xuống để điều chỉnh chiều cao khung BBox 2D trực tiếp"
            style={{
              height: 9,
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-2)',
              borderTop: '1px solid var(--line-soft)',
              userSelect: 'none'
            }}
          >
            <span
              style={{
                width: 34,
                height: 3,
                borderRadius: 99,
                background: 'var(--text-faint)'
              }}
            />
          </div>

          {/* Thanh thông số toạ độ BBox & thao tác nhanh */}
          {selectedProjLayer && coordRefLayer ? (
            <div className="wf-v2-direct-footer">
              <span className="wf-v2-direct-coords">
                {useClusterBbox ? 'Cụm ' : ''}X <b>{Math.round(coordRefLayer.transform.position.value?.[0] ?? 0)}</b> · Y{' '}
                <b>{Math.round(coordRefLayer.transform.position.value?.[1] ?? 0)}</b> · Z{' '}
                <b>{Math.round(coordRefLayer.transform.position.value?.[2] ?? 0)}</b> · Cỡ{' '}
                <b>{Math.round(Math.abs(coordRefLayer.transform.scale.value?.[0] ?? 1) * 100)}%</b>
              </span>
              <div className="wf-v2-direct-actions">
                <button type="button" className="wf-v2-direct-btn" onClick={handleCenterLayer} title="Đặt vị trí BBox về chính giữa khung cảnh (X=0, Y=0)">
                  ⊡ Giữa khung
                </button>
                <button type="button" className="wf-v2-direct-btn" onClick={handleResetLayerScale} title="Đặt lại tỷ lệ BBox chuẩn">
                  ↺ Chuẩn cỡ
                </button>
                <button type="button" className="wf-v2-direct-btn accent" onClick={handleAimCameraAtLayer} title="Lia khung Camera đang chọn vào đúng BBox này">
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
