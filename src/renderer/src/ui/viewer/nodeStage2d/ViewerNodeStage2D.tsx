import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph } from '@shared/types'
import { useToast } from '../../../actions'
import { usePlaybackUiTime } from '../../../hooks/usePlaybackUiTime'
import { bboxStartPosition } from '../../../project/workflowMotionStart'
import { patchPartCue } from '../../../project/workflowPartEditing'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import {
  attachLogicNodeToLayerV2,
  getClusterMemberLayers,
  getLayerDisplayName,
  spawnTimedFollowupNodeV2,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from '../../../project/workflowV2Engine'
import { findClusterRootLayer, isLayerClusterLocked, useEditor } from '../../../store/editor'
import { requestOpenLayerAssembly } from '../../layerAssembly/layerAssemblyBridge'
import { WorkflowPartPreview } from '../../workflow/WorkflowPartPreview'
import { WorkflowV2DirectStagePreview } from '../../workflow/WorkflowV2DirectStagePreview'
import { WorkflowV2Logic25DPreview } from '../../workflow/WorkflowV2Logic25DPreview'
import { resolveActiveMotionNode } from '../../workflow/WorkflowV2StageBboxHelpers'
import { useWorkflowV2Controller } from '../../workflow/useWorkflowV2Controller'
import { NodeStage2DContextMenu } from './NodeStage2DContextMenu'
import { NodeStage2DSideRails } from './NodeStage2DSideRails'
import { NodeStage2DToolbar } from './NodeStage2DToolbar'
import {
  aimCameraAtStagePointInDraft,
  alignEntityOnStageInDraft,
  flipEntityHorizontalInDraft,
  placeBbox2TargetAtWorldXYInDraft,
  resetEntityScaleInDraft,
  resolveShotCameraRouteNodes,
  setCameraWaypointYawInDraft,
  setEntityWorldPositionInDraft,
  stepEntityDepthZInDraft,
  syncCamera3DToEntityOrMotionInDraft,
  type StageContextHitInfo,
  type StageQuickAlignPreset
} from './nodeStageQuickActions'
import {
  buildStageLayerNodeContext,
  resolveEffectiveStageNode,
  resolveNodeStagePrimaryMode
} from './resolveNodeStageTarget'

export const ViewerNodeStage2D: React.FC = () => {
  const wfCtrl = useWorkflowV2Controller()
  const showToast = useToast((s) => s.show)
  const liveTime = usePlaybackUiTime(30)
  const layerSelectionScope = useEditor((s) => s.layerSelectionScope)
  const bodyRef = useRef<HTMLDivElement>(null)
  const lastEntityNodeRef = useRef<{ id: string; label: string } | null>(null)
  const touchHoldTimerRef = useRef<number | null>(null)

  const [bodySize, setBodySize] = useState({ w: 620, h: 420 })
  const [zoomFactor, setZoomFactor] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [overrideSceneView, setOverrideSceneView] = useState(false)
  const [scopeOverride, setScopeOverride] = useState<'cluster' | 'part' | null>(null)
  const [showCameraGuide, setShowCameraGuide] = useState(false)
  const [contextHit, setContextHit] = useState<StageContextHitInfo | null>(null)

  const activeNode = useMemo(
    () =>
      resolveEffectiveStageNode(
        wfCtrl.project,
        wfCtrl.workflow,
        wfCtrl.selectedNode,
        wfCtrl.selectedLayerId,
        wfCtrl.selectedShotId,
        wfCtrl.activeShotId,
        layerSelectionScope
      ),
    [
      wfCtrl.project,
      wfCtrl.workflow,
      wfCtrl.selectedNode,
      wfCtrl.selectedLayerId,
      wfCtrl.selectedShotId,
      wfCtrl.activeShotId,
      layerSelectionScope
    ]
  )

  useEffect(() => {
    setOverrideSceneView(false)
    setScopeOverride(null)
  }, [activeNode?.id])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const updateSize = (): void => {
      const w = Math.floor(el.clientWidth)
      const h = Math.floor(el.clientHeight)
      if (w > 100 && h > 120) setBodySize({ w, h })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ctx = useMemo(
    () => buildStageLayerNodeContext(wfCtrl.project, wfCtrl.workflow, activeNode, wfCtrl.selectedLayerId),
    [wfCtrl.project, wfCtrl.workflow, activeNode, wfCtrl.selectedLayerId]
  )

  useEffect(() => {
    if (ctx.layerOrClusterNode && ctx.activeLayer && activeNode?.type !== 'camera_director') {
      const raw = getLayerDisplayName(ctx.activeLayer)
      lastEntityNodeRef.current = {
        id: ctx.layerOrClusterNode.id,
        label: raw.replace(/\s*—.*$/, '').trim() || raw
      }
    }
  }, [ctx.layerOrClusterNode, ctx.activeLayer, activeNode?.type])

  const camRoute = useMemo(
    () =>
      resolveShotCameraRouteNodes(
        wfCtrl.project,
        wfCtrl.workflow,
        activeNode,
        ctx.activeLayer,
        wfCtrl.selectedShotId ?? wfCtrl.activeShotId
      ),
    [wfCtrl.project, wfCtrl.workflow, activeNode, ctx.activeLayer, wfCtrl.selectedShotId, wfCtrl.activeShotId]
  )

  const isCamDirectorMode = Boolean(activeNode?.type === 'camera_director')
  const primaryMode = resolveNodeStagePrimaryMode(activeNode)
  const showLogic25D = primaryMode === 'logic_25d' && !overrideSceneView
  const showPart25D = primaryMode === 'part_25d' && !overrideSceneView
  const useClusterTransform = Boolean(
    ctx.clusterMemberCount > 1 &&
      (ctx.layerOrClusterNode?.params?.logicCategory === 'cluster_lock' || scopeOverride === 'cluster')
  )

  const handlePickSceneLayer = useCallback(
    (layerId: string) => {
      const st = useEditor.getState()
      const picked = st.project.layers.find((l) => l.id === layerId)
      if (!picked) return
      if (isLayerClusterLocked(picked)) {
        const root = findClusterRootLayer(st.project, picked) ?? picked
        st.selectLayer(root.id, 'cluster')
        const instId = picked.composite?.instanceId ?? picked.model3d?.instanceId
        const clusterNode = instId
          ? wfCtrl.workflow.nodes.find(
              (n) => n.params?.logicCategory === 'cluster_lock' && n.params?.instanceId === instId
            )
          : undefined
        wfCtrl.activateNode(clusterNode?.id ?? v2LayerNodeId(root.id), true, false)
      } else {
        st.selectLayer(picked.id, 'layer')
        wfCtrl.activateNode(v2LayerNodeId(picked.id), true, false)
      }
    },
    [wfCtrl]
  )

  /** Mở Menu Chuột Phải thông minh: nếu chuột phải trúng Layer / Cụm / Mốc Cam khác thì tự Focus vào đối tượng đó ngay */
  const handleOpenStageContextMenu = useCallback(
    (hit: StageContextHitInfo) => {
      if (hit.hitWaypointNodeId && hit.hitWaypointNodeId !== activeNode?.id) {
        wfCtrl.activateNode(hit.hitWaypointNodeId, true, false)
      } else if (hit.hitLayerId) {
        const curInstId = ctx.activeLayer?.composite?.instanceId ?? ctx.activeLayer?.model3d?.instanceId
        const curMembers = curInstId
          ? getClusterMemberLayers(wfCtrl.project, curInstId, ctx.activeLayer)
          : ctx.activeLayer
            ? [ctx.activeLayer]
            : []
        const alreadyInFocusedEntity = curMembers.some((m) => m.id === hit.hitLayerId)
        if (!alreadyInFocusedEntity) {
          handlePickSceneLayer(hit.hitLayerId)
        }
      }
      setContextHit(hit)
    },
    [activeNode?.id, ctx.activeLayer, wfCtrl, handlePickSceneLayer]
  )

  const handleToggleCamDirectorMode = useCallback(() => {
    if (isCamDirectorMode) {
      const backId = lastEntityNodeRef.current?.id ?? ctx.layerOrClusterNode?.id
      if (backId && wfCtrl.workflow.nodes.some((n) => n.id === backId)) {
        wfCtrl.activateNode(backId, true, false)
        return
      }
      const shotLayers = wfCtrl.project.layers.filter((l) => l.shotId === camRoute.shotId)
      if (shotLayers[0]) handlePickSceneLayer(shotLayers[0].id)
      return
    }
    if (camRoute.entryCameraNode) {
      wfCtrl.activateNode(camRoute.entryCameraNode.id, true, false)
    } else if (camRoute.shotId) {
      wfCtrl.actions.spawnCameraWaypoint(camRoute.shotId, 'zoom-in')
    }
  }, [isCamDirectorMode, ctx.layerOrClusterNode, wfCtrl, camRoute, handlePickSceneLayer])

  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    setZoomFactor((z) => Math.max(0.4, Math.min(3.2, Number((z * factor).toFixed(3)))))
  }, [])

  const handleCanvasPanStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 1 && !(e.button === 0 && (e.altKey || e.target === e.currentTarget))) return
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const origPan = { ...pan }
      const onMove = (pev: PointerEvent): void => {
        setPan({
          x: Math.round(origPan.x + (pev.clientX - startX)),
          y: Math.round(origPan.y + (pev.clientY - startY))
        })
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [pan]
  )

  const handleFitStage = useCallback(() => {
    setZoomFactor(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleQuickSpawnBboxMotion = useCallback(() => {
    if (!ctx.activeLayer || !ctx.attachTargetNodeId) return
    const instId = ctx.activeLayer.composite?.instanceId ?? ctx.activeLayer.model3d?.instanceId
    const existingMotion = activeNode
      ? resolveActiveMotionNode(wfCtrl.workflow, activeNode, ctx.activeLayer.id, instId)
      : undefined

    if (existingMotion && activeNode?.id === existingMotion.id && existingMotion.params?.motionMode === 'bbox') {
      let nextId: string | null = null
      let nextStart = existingMotion.params?.timeEnd ?? liveTime
      useEditor.getState().update((draft) => {
        const wf = (draft.workflow ?? wfCtrl.workflow) as WorkflowGraph
        const res = spawnTimedFollowupNodeV2(wf, existingMotion.id, 3.0)
        if (!res) return
        draft.workflow = res.workflow
        nextId = res.createdNodeId
        const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
        if (created) {
          draft.comp.duration = Math.max(draft.comp.duration, created.params?.timeEnd ?? 0)
          nextStart = created.params?.timeStart ?? nextStart
          syncWorkflowV2NodeToProject(draft as Project, created)
        }
      }, 'vn2d-chain-bbox')
      if (nextId) {
        wfCtrl.setTime(nextStart)
        wfCtrl.activateNode(nextId, true, false)
      }
      return
    }

    if (existingMotion) {
      const t0 = existingMotion.params?.timeStart ?? ctx.activeLayer.inPoint ?? 0
      const startPos = bboxStartPosition(ctx.activeLayer, t0, existingMotion.id)
      wfCtrl.actions.updateParams(existingMotion.id, {
        motionMode: 'bbox',
        actionPreset: 'bbox_target',
        bboxPathType: existingMotion.params?.bboxPathType ?? 'shortest',
        bboxTargetX: existingMotion.params?.bboxTargetX ?? Math.round(startPos[0] + 280),
        bboxTargetY: existingMotion.params?.bboxTargetY ?? Math.round(startPos[1] - 20),
        bboxTargetScalePct: existingMotion.params?.bboxTargetScalePct ?? 135,
        bboxStartZ: Math.round(startPos[2]),
        bboxTargetZ: existingMotion.params?.bboxTargetZ ?? Math.round(startPos[2])
      })
      wfCtrl.activateNode(existingMotion.id, true, false)
      return
    }

    const tStart = Number(Math.max(0, ctx.activeLayer.inPoint ?? liveTime).toFixed(2))
    const startPos = bboxStartPosition(ctx.activeLayer, tStart)
    let createdId: string | null = null
    useEditor.getState().update((draft) => {
      const wf = (draft.workflow ?? wfCtrl.workflow) as WorkflowGraph
      const res = attachLogicNodeToLayerV2(
        wf,
        ctx.attachTargetNodeId,
        'action',
        'v2:action:bbox_target',
        {
          motionMode: 'bbox',
          actionPreset: 'bbox_target',
          bboxPathType: 'shortest',
          bboxTargetX: Math.round(startPos[0] + 280),
          bboxTargetY: Math.round(startPos[1] - 20),
          bboxTargetScalePct: 135,
          depthMode: 'flat_2d',
          bboxStartZ: Math.round(startPos[2]),
          bboxTargetZ: Math.round(startPos[2]),
          timeStart: tStart,
          timeEnd: Number((tStart + 3).toFixed(2))
        },
        'Motion: Đặt BBox Đích (đầu → đích)'
      )
      draft.workflow = res.workflow
      createdId = res.createdNodeId
      const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (created) {
        draft.comp.duration = Math.max(draft.comp.duration, created.params?.timeEnd ?? 0)
        syncWorkflowV2NodeToProject(draft as Project, created)
      }
    }, 'vn2d-spawn-bbox2')
    if (createdId) {
      wfCtrl.setTime(tStart)
      wfCtrl.activateNode(createdId, true, false)
    }
  }, [ctx.activeLayer, ctx.attachTargetNodeId, activeNode, wfCtrl, liveTime])

  const handleQuickSpawnPathMotion = useCallback(() => {
    if (!ctx.activeLayer || !ctx.attachTargetNodeId) return
    const instId = ctx.activeLayer.composite?.instanceId ?? ctx.activeLayer.model3d?.instanceId
    const existingMotion = activeNode
      ? resolveActiveMotionNode(wfCtrl.workflow, activeNode, ctx.activeLayer.id, instId)
      : undefined
    if (existingMotion) {
      wfCtrl.actions.updateParams(existingMotion.id, {
        motionMode: 'path',
        actionPreset: 'custom_draw'
      })
      wfCtrl.activateNode(existingMotion.id, true, false)
      return
    }
    wfCtrl.actions.attachLogic(
      ctx.attachTargetNodeId,
      'action',
      'v2:action:custom_draw',
      { motionMode: 'path', actionPreset: 'custom_draw' },
      'Motion: Vẽ đường đi tự do'
    )
  }, [ctx.activeLayer, ctx.attachTargetNodeId, activeNode, wfCtrl])

  const handleSpawnFollowupStep = useCallback(() => {
    if (!activeNode) return
    let createdId: string | null = null
    let nextStart = activeNode.params?.timeEnd ?? liveTime
    useEditor.getState().update((draft) => {
      if (activeNode.params?.isPartChild) patchPartCue(draft, activeNode.id, {})
      const wf = (draft.workflow ?? wfCtrl.workflow) as WorkflowGraph
      const res = spawnTimedFollowupNodeV2(wf, activeNode.id, 3.0)
      if (!res) return
      draft.workflow = res.workflow
      createdId = res.createdNodeId
      const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (created) {
        draft.comp.duration = Math.max(draft.comp.duration, created.params?.timeEnd ?? 0)
        nextStart = created.params?.timeStart ?? nextStart
        syncWorkflowV2NodeToProject(draft as Project, created)
      }
    }, 'vn2d-spawn-followup')
    if (createdId) {
      wfCtrl.setTime(nextStart)
      wfCtrl.activateNode(createdId, true, false)
    }
  }, [activeNode, wfCtrl, liveTime])

  const handleFlipHorizontal = useCallback(() => {
    if (!ctx.activeLayer) return
    useEditor.getState().update((draft) => {
      flipEntityHorizontalInDraft(draft, ctx.activeLayer!.id, useClusterTransform, activeNode)
    }, 'vn2d-flip-x')
  }, [ctx.activeLayer, useClusterTransform, activeNode])

  const handleQuickAlign = useCallback(
    (preset: StageQuickAlignPreset) => {
      if (!ctx.activeLayer) return
      useEditor.getState().update((draft) => {
        alignEntityOnStageInDraft(draft, ctx.activeLayer!.id, preset, useClusterTransform, activeNode)
      }, `vn2d-align-${preset}`)
    },
    [ctx.activeLayer, useClusterTransform, activeNode]
  )

  const handleStepDepthZ = useCallback(
    (deltaZ: number) => {
      if (!ctx.activeLayer) return
      let nextZ: number | null = null
      useEditor.getState().update((draft) => {
        nextZ = stepEntityDepthZInDraft(draft, ctx.activeLayer!.id, deltaZ, useClusterTransform, activeNode)
      }, 'vn2d-step-z')
      if (nextZ !== null) {
        showToast(`${deltaZ < 0 ? 'Đưa gần Camera' : 'Đẩy lùi hậu cảnh'} · Z = ${nextZ}`)
      }
    },
    [ctx.activeLayer, useClusterTransform, activeNode, showToast]
  )

  const handleSyncCameraToEntity = useCallback(() => {
    if (!ctx.activeLayer) return
    let synced: { startTime: number; endTime?: number; followedMotion: boolean } | null = null
    useEditor.getState().update((draft) => {
      synced = syncCamera3DToEntityOrMotionInDraft(draft, {
        node: activeNode,
        layer: ctx.activeLayer!,
        useCluster: useClusterTransform,
        atTime: liveTime
      })
    }, 'vn2d-sync-cam-entity')
    if (synced) {
      const info = synced as { startTime: number; endTime?: number; followedMotion: boolean }
      wfCtrl.setTime(info.startTime)
      showToast(
        info.followedMotion
          ? `Camera 3D đã tự tạo lộ trình lia bám BBox #1 → #2 (${info.startTime.toFixed(1)}s – ${(info.endTime ?? info.startTime).toFixed(1)}s)`
          : 'Camera 3D đã bắt khung gọn vào đối tượng đang chọn'
      )
    }
  }, [ctx.activeLayer, activeNode, useClusterTransform, liveTime, wfCtrl, showToast])

  const handlePlaceBbox2Here = useCallback(
    (hit: StageContextHitInfo) => {
      if (!ctx.activeLayer) return
      let placed: { nodeId: string; startTime: number } | null = null
      useEditor.getState().update((draft) => {
        placed = placeBbox2TargetAtWorldXYInDraft(draft, {
          workflow: wfCtrl.workflow,
          activeNode,
          attachTargetNodeId: ctx.attachTargetNodeId,
          layer: ctx.activeLayer!,
          worldX: hit.worldX,
          worldY: hit.worldY,
          currentTime: liveTime
        })
      }, 'vn2d-ctx-place-bbox2')
      if (placed) {
        const res = placed as { nodeId: string; startTime: number }
        wfCtrl.setTime(res.startTime)
        wfCtrl.activateNode(res.nodeId, true, false)
        showToast(`Đã đặt BBox Đích #2 tới (${hit.worldX}, ${hit.worldY})`)
      }
    },
    [ctx.activeLayer, ctx.attachTargetNodeId, wfCtrl, activeNode, liveTime, showToast]
  )

  const handleMoveEntityHere = useCallback(
    (hit: StageContextHitInfo) => {
      if (!ctx.activeLayer) return
      useEditor.getState().update((draft) => {
        setEntityWorldPositionInDraft(
          draft,
          ctx.activeLayer!.id,
          { x: hit.worldX, y: hit.worldY },
          useClusterTransform,
          activeNode
        )
      }, 'vn2d-ctx-move-entity')
    },
    [ctx.activeLayer, useClusterTransform, activeNode]
  )

  const handleAimCameraHere = useCallback(
    (hit: StageContextHitInfo) => {
      let targetTime = liveTime
      useEditor.getState().update((draft) => {
        targetTime = aimCameraAtStagePointInDraft(
          draft,
          hit.shotId ?? camRoute.shotId,
          hit.screenOffsetX,
          hit.screenOffsetY,
          liveTime,
          ctx.activeLayer?.transform.position.value[2] ?? 0
        )
      }, 'vn2d-ctx-aim-cam')
      wfCtrl.setTime(targetTime)
      showToast('Đã lia tâm khung ngắm Camera tới vị trí vừa chọn')
    },
    [liveTime, camRoute.shotId, ctx.activeLayer, wfCtrl, showToast]
  )

  const handleTogglePlayNode = useCallback(() => {
    const ed = useEditor.getState()
    if (ed.playing) {
      ed.setPlaying(false)
      return
    }
    if (activeNode) {
      const timing = effectiveTimeParams(wfCtrl.project, activeNode, activeNode.params ?? {})
      const t0 = timing.timeStart ?? 0
      const t1 = timing.timeEnd ?? wfCtrl.project.comp.duration
      if (ed.time < t0 || ed.time >= t1 - 0.05) {
        ed.setTime(t0)
      }
    }
    ed.setPlaying(true)
  }, [activeNode, wfCtrl.project])

  const clearTouchHold = useCallback(() => {
    if (touchHoldTimerRef.current !== null) {
      window.clearTimeout(touchHoldTimerRef.current)
      touchHoldTimerRef.current = null
    }
  }, [])

  const hasAnySceneContent = wfCtrl.project.shots.length > 0 || wfCtrl.project.layers.length > 0
  const showSceneStage = Boolean(activeNode && hasAnySceneContent && !showPart25D && !showLogic25D)
  const railInsetX = bodySize.w > 520 ? 104 : 0

  return (
    <div
      className="viewer-node2d-stage"
      data-mcp-region="viewer_node2d"
      data-ai-surface-label="Màn Khung 2D Chỉnh Node"
    >
      <NodeStage2DToolbar
        project={wfCtrl.project}
        workflow={wfCtrl.workflow}
        node={activeNode}
        ctx={ctx}
        cameraWaypoints={camRoute.waypointNodes}
        isCamDirectorMode={isCamDirectorMode}
        lastEntityLabel={lastEntityNodeRef.current?.label}
        primaryMode={primaryMode}
        overrideSceneView={overrideSceneView}
        currentTime={liveTime}
        playing={wfCtrl.playing}
        zoomPct={Math.round(zoomFactor * 100)}
        scopeOverride={scopeOverride}
        onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
        onToggleCamDirectorMode={handleToggleCamDirectorMode}
        onToggleOverrideSceneView={setOverrideSceneView}
        onQuickSpawnBboxMotion={handleQuickSpawnBboxMotion}
        onQuickSpawnPathMotion={handleQuickSpawnPathMotion}
        onSpawnFollowupStep={handleSpawnFollowupStep}
        onSpawnCameraWaypoint={(mode) => {
          if (camRoute.shotId) {
            wfCtrl.actions.spawnCameraWaypoint(camRoute.shotId, mode, activeNode?.params?.timeStart)
          }
        }}
        onSyncCameraToEntity={handleSyncCameraToEntity}
        onQuickAlign={handleQuickAlign}
        onAttachLogic={wfCtrl.actions.attachLogic}
        onToggleScopeOverride={() => setScopeOverride((prev) => (prev === 'cluster' ? 'part' : 'cluster'))}
        onScrubTime={(t) => {
          useEditor.getState().setPlaying(false)
          wfCtrl.setTime(t)
        }}
        onTogglePlayNode={handleTogglePlayNode}
        onFitStage={handleFitStage}
        onOpenContextMenuAtButton={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setContextHit({
            clientX: rect.right - 290,
            clientY: rect.bottom + 6,
            worldX: Math.round(ctx.activeLayer?.transform.position.value[0] ?? 0),
            worldY: Math.round(ctx.activeLayer?.transform.position.value[1] ?? 0),
            screenOffsetX: 0,
            screenOffsetY: 0,
            shotId: camRoute.shotId,
            hitLayerId: ctx.activeLayer?.id ?? null,
            hitWaypointNodeId: isCamDirectorMode ? (activeNode?.id ?? null) : null
          })
        }}
      />

      <div
        ref={bodyRef}
        className="viewer-node2d-body"
        onContextMenu={(e) => {
          if (showSceneStage) return
          e.preventDefault()
          setContextHit({
            clientX: e.clientX,
            clientY: e.clientY,
            worldX: Math.round(ctx.activeLayer?.transform.position.value[0] ?? 0),
            worldY: Math.round(ctx.activeLayer?.transform.position.value[1] ?? 0),
            screenOffsetX: 0,
            screenOffsetY: 0,
            shotId: camRoute.shotId,
            hitLayerId: ctx.activeLayer?.id ?? null,
            hitWaypointNodeId: null
          })
        }}
        onPointerDownCapture={(e) => {
          if (e.pointerType !== 'touch') return
          clearTouchHold()
          const cx = e.clientX
          const cy = e.clientY
          const targetEl = e.target as HTMLElement | null
          touchHoldTimerRef.current = window.setTimeout(() => {
            touchHoldTimerRef.current = null
            const layerEl = targetEl?.closest?.('[data-scene-layer-id]') as HTMLElement | null
            const wpEl = targetEl?.closest?.('[data-waypoint-node-id]') as HTMLElement | null
            handleOpenStageContextMenu({
              clientX: cx,
              clientY: cy,
              worldX: Math.round(ctx.activeLayer?.transform.position.value[0] ?? 0),
              worldY: Math.round(ctx.activeLayer?.transform.position.value[1] ?? 0),
              screenOffsetX: 0,
              screenOffsetY: 0,
              shotId: camRoute.shotId,
              hitLayerId: layerEl?.getAttribute('data-scene-layer-id') ?? null,
              hitWaypointNodeId: wpEl?.getAttribute('data-waypoint-node-id') ?? null
            })
          }, 460)
        }}
        onPointerMoveCapture={clearTouchHold}
        onPointerUpCapture={clearTouchHold}
        onPointerCancelCapture={clearTouchHold}
      >
        {showSceneStage && (
          <NodeStage2DSideRails
            node={activeNode}
            ctx={ctx}
            isCamDirectorMode={isCamDirectorMode}
            showCameraGuide={showCameraGuide}
            activeShotId={camRoute.shotId}
            onSelectEntityRoot={() => {
              if (isCamDirectorMode) {
                handleToggleCamDirectorMode()
              } else if (ctx.layerOrClusterNode) {
                wfCtrl.activateNode(ctx.layerOrClusterNode.id, true, false)
              }
            }}
            onQuickSpawnBboxMotion={handleQuickSpawnBboxMotion}
            onQuickSpawnPathMotion={handleQuickSpawnPathMotion}
            onToggleCamDirectorMode={handleToggleCamDirectorMode}
            onToggleCameraGuide={() => setShowCameraGuide((v) => !v)}
            onFlipHorizontal={handleFlipHorizontal}
            onQuickAlign={handleQuickAlign}
            onStepDepthZ={handleStepDepthZ}
            onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
            onAttachLogic={wfCtrl.actions.attachLogic}
            onOpenLayerWorkshop={() => {
              const compId = ctx.activeLayer?.composite?.compositeId
              if (compId) requestOpenLayerAssembly(compId)
            }}
            onSpawnCameraWaypoint={(mode) => {
              if (camRoute.shotId) {
                wfCtrl.actions.spawnCameraWaypoint(camRoute.shotId, mode, activeNode?.params?.timeStart)
              }
            }}
            onRotateCameraYaw={(yawDeg) => {
              const tWp = activeNode?.params?.timeStart ?? liveTime
              useEditor.getState().update((draft) => {
                setCameraWaypointYawInDraft(draft, tWp, yawDeg)
              }, 'vn2d-cam-yaw')
            }}
            onZoomStep={(delta) =>
              setZoomFactor((z) => Math.max(0.4, Math.min(3.2, Number((z + delta).toFixed(2)))))
            }
          />
        )}

        {!activeNode || !hasAnySceneContent ? (
          <div className="viewer-node2d-empty">
            <strong>Màn Khung 2D Chỉnh Node &amp; Hành Động Trực Tiếp</strong>
            <p>
              Thêm ảnh / Cụm nhân vật 2.5D vào Cảnh để kéo BBox Đầu → Đích, vẽ đường đi chuyển động, đặt vị trí Vietsub, đạo diễn Lộ trình Camera và chỉnh đèn 2.5D ngay trên màn hình lớn.
            </p>
          </div>
        ) : showPart25D ? (
          <WorkflowPartPreview
            fullViewport
            project={wfCtrl.project}
            node={activeNode}
            currentTime={liveTime}
            onScrubTime={wfCtrl.setTime}
            onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
          />
        ) : showLogic25D ? (
          <WorkflowV2Logic25DPreview
            fullViewport
            node={activeNode}
            project={wfCtrl.project}
            currentTime={liveTime}
            open
            onToggleOpen={() => undefined}
            onUpdateParams={wfCtrl.actions.updateParams}
            onScrubTime={wfCtrl.setTime}
          />
        ) : (
          <WorkflowV2DirectStagePreview
            fullViewport
            viewportHeight={Math.max(200, bodySize.h)}
            railInsetX={railInsetX}
            showCameraGuideOverlay={showCameraGuide}
            externalZoom={zoomFactor}
            externalPan={pan}
            scopeOverrideProp={scopeOverride}
            node={activeNode}
            project={wfCtrl.project}
            workflow={wfCtrl.workflow}
            currentTime={liveTime}
            open
            onToggleOpen={() => undefined}
            onUpdateParams={wfCtrl.actions.updateParams}
            onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
            onScrubTime={wfCtrl.setTime}
            onWheelZoom={handleWheelZoom}
            onCanvasPanStart={handleCanvasPanStart}
            onPickSceneLayer={handlePickSceneLayer}
            onStageContextMenu={handleOpenStageContextMenu}
          />
        )}
      </div>

      {contextHit && (
        <NodeStage2DContextMenu
          hit={contextHit}
          node={activeNode}
          ctx={ctx}
          isCamDirectorMode={isCamDirectorMode}
          useClusterTransform={useClusterTransform}
          onClose={() => setContextHit(null)}
          onPlaceBbox2Here={handlePlaceBbox2Here}
          onMoveEntityHere={handleMoveEntityHere}
          onAimCameraHere={handleAimCameraHere}
          onSyncCameraToEntity={handleSyncCameraToEntity}
          onQuickSpawnPathMotion={handleQuickSpawnPathMotion}
          onToggleCamDirectorMode={handleToggleCamDirectorMode}
          onSpawnCameraWaypoint={(mode) => {
            if (camRoute.shotId) {
              wfCtrl.actions.spawnCameraWaypoint(camRoute.shotId, mode, activeNode?.params?.timeStart)
            }
          }}
          onFlipHorizontal={handleFlipHorizontal}
          onQuickAlign={handleQuickAlign}
          onResetScale={() => {
            if (!ctx.activeLayer) return
            useEditor.getState().update((draft) => {
              resetEntityScaleInDraft(draft, ctx.activeLayer!.id, useClusterTransform)
            }, 'vn2d-ctx-reset-scale')
          }}
          onStepDepthZ={handleStepDepthZ}
          onToggleScopeOverride={() => setScopeOverride((prev) => (prev === 'cluster' ? 'part' : 'cluster'))}
          onOpenLayerWorkshop={() => {
            const compId = ctx.activeLayer?.composite?.compositeId
            if (compId) requestOpenLayerAssembly(compId)
          }}
          onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
          onAttachLogic={wfCtrl.actions.attachLogic}
          onToggleEnableNode={wfCtrl.actions.toggleEnable}
          onDeleteNode={wfCtrl.actions.deleteNode}
        />
      )}
    </div>
  )
}
