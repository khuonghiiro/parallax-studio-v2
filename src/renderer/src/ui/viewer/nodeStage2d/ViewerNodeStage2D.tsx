import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph } from '@shared/types'
import { usePlaybackUiTime } from '../../../hooks/usePlaybackUiTime'
import { bboxStartPosition } from '../../../project/workflowMotionStart'
import { patchPartCue } from '../../../project/workflowPartEditing'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import {
  attachLogicNodeToLayerV2,
  spawnTimedFollowupNodeV2,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from '../../../project/workflowV2Engine'
import { findClusterRootLayer, isLayerClusterLocked, useEditor } from '../../../store/editor'
import { WorkflowPartPreview } from '../../workflow/WorkflowPartPreview'
import { WorkflowV2DirectStagePreview } from '../../workflow/WorkflowV2DirectStagePreview'
import { WorkflowV2Logic25DPreview } from '../../workflow/WorkflowV2Logic25DPreview'
import { resolveActiveMotionNode } from '../../workflow/WorkflowV2StageBboxHelpers'
import { useWorkflowV2Controller } from '../../workflow/useWorkflowV2Controller'
import { NodeStage2DToolbar } from './NodeStage2DToolbar'
import {
  buildStageLayerNodeContext,
  resolveEffectiveStageNode,
  resolveNodeStagePrimaryMode
} from './resolveNodeStageTarget'

export const ViewerNodeStage2D: React.FC = () => {
  const wfCtrl = useWorkflowV2Controller()
  const liveTime = usePlaybackUiTime(30)
  const layerSelectionScope = useEditor((s) => s.layerSelectionScope)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [bodyHeight, setBodyHeight] = useState(420)
  const [zoomFactor, setZoomFactor] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [overrideSceneView, setOverrideSceneView] = useState(false)
  const [scopeOverride, setScopeOverride] = useState<'cluster' | 'part' | null>(null)

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
    const updateH = (): void => {
      const h = Math.floor(el.clientHeight)
      if (h > 120) setBodyHeight(h)
    }
    updateH()
    const ro = new ResizeObserver(updateH)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ctx = useMemo(
    () => buildStageLayerNodeContext(wfCtrl.project, wfCtrl.workflow, activeNode, wfCtrl.selectedLayerId),
    [wfCtrl.project, wfCtrl.workflow, activeNode, wfCtrl.selectedLayerId]
  )

  const primaryMode = resolveNodeStagePrimaryMode(activeNode)
  const showLogic25D = primaryMode === 'logic_25d' && !overrideSceneView
  const showPart25D = primaryMode === 'part_25d' && !overrideSceneView

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
      // Đang đứng ngay trên Node Motion BBox -> nối thêm chặng BBox kế tiếp!
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

  const hasAnySceneContent = wfCtrl.project.shots.length > 0 || wfCtrl.project.layers.length > 0

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
        primaryMode={primaryMode}
        overrideSceneView={overrideSceneView}
        currentTime={liveTime}
        playing={wfCtrl.playing}
        zoomPct={Math.round(zoomFactor * 100)}
        scopeOverride={scopeOverride}
        onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
        onToggleOverrideSceneView={setOverrideSceneView}
        onQuickSpawnBboxMotion={handleQuickSpawnBboxMotion}
        onQuickSpawnPathMotion={handleQuickSpawnPathMotion}
        onSpawnFollowupStep={handleSpawnFollowupStep}
        onSpawnCameraWaypoint={(shotId) => wfCtrl.actions.spawnCameraWaypoint(shotId, 'zoom-in')}
        onAttachLogic={wfCtrl.actions.attachLogic}
        onToggleScopeOverride={() => setScopeOverride((prev) => (prev === 'cluster' ? 'part' : 'cluster'))}
        onScrubTime={(t) => {
          useEditor.getState().setPlaying(false)
          wfCtrl.setTime(t)
        }}
        onTogglePlayNode={handleTogglePlayNode}
        onZoomStep={(delta) =>
          setZoomFactor((z) => Math.max(0.4, Math.min(3.2, Number((z + delta).toFixed(2)))))
        }
        onFitStage={handleFitStage}
      />

      <div ref={bodyRef} className="viewer-node2d-body">
        {!activeNode || !hasAnySceneContent ? (
          <div className="viewer-node2d-empty">
            <strong>Màn Khung 2D Chỉnh Node &amp; Hành Động Trực Tiếp</strong>
            <p>
              Thêm ảnh / Cụm nhân vật 2.5D vào Cảnh để kéo BBox Đầu → Đích, vẽ đường đi chuyển động, đặt vị trí Vietsub, chỉnh đèn 2.5D và bộ phận ngay trên màn hình lớn.
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
            viewportHeight={Math.max(200, bodyHeight - 48)}
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
          />
        )}
      </div>
    </div>
  )
}
