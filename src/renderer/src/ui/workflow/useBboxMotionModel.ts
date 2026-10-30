import { useMemo } from 'react'
import type { Layer, Vec3, WorkflowNodeParams } from '@shared/types'
import { bboxStartPosition } from '../../project/workflowMotionStart'
import { getClusterMemberLayers, getClusterRootLayer, syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { resolveActionTargetLayerIds } from './WorkflowV2MotionAndRigEditors'
import type { WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

export function useBboxMotionModel(props: WorkflowV2NodeParamsProps) {
  const { node, project, onScrubTime, onSelectNode } = props
  const p = node.params ?? {}
  const targetIds = useMemo(() => resolveActionTargetLayerIds(props), [props])
  const instId =
    p.instanceId ??
    project.layers.find((l) => targetIds.includes(l.id) && l.composite?.instanceId)?.composite?.instanceId
  const clusterMembers = useMemo(
    () => (instId ? getClusterMemberLayers(project, instId) : []),
    [project, instId]
  )
  const rootLayer: Layer | undefined = useMemo(
    () =>
      getClusterRootLayer(clusterMembers) ??
      project.layers.find((l) => targetIds.includes(l.id)),
    [clusterMembers, project.layers, targetIds]
  )

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Number((p.timeStart ?? rootLayer?.inPoint ?? 0).toFixed(2))
  const tEnd = Number(
    Math.max(tStart + 0.3, Math.min(compDur, p.timeEnd ?? tStart + 3)).toFixed(2)
  )
  const runDuration = Number(Math.max(0.3, tEnd - tStart).toFixed(2))

  const startPos: Vec3 = useMemo(
    () => (rootLayer ? bboxStartPosition(rootLayer, tStart, node.id) : [0, 0, 0]),
    [rootLayer, tStart, node.id]
  )

  const pathType = p.bboxPathType ?? 'shortest'
  const targetX = p.bboxTargetX ?? Math.round(startPos[0] + 280)
  const targetY = p.bboxTargetY ?? Math.round(startPos[1])
  const targetScalePct = p.bboxTargetScalePct ?? 135
  const depthMode = p.depthMode ?? 'flat_2d'
  const startZ = p.bboxStartZ ?? Math.round(startPos[2] ?? 0)
  const targetZ =
    p.bboxTargetZ ??
    (depthMode === 'depth_z'
      ? Math.round(startZ - ((targetScalePct - 100) / 100) * 180)
      : startZ)

  const isPlaying = useEditor((s) => s.playing)

  const applyBboxPatch = (
    patch: Partial<WorkflowNodeParams>,
    mergeKey = 'wf-bbox-motion'
  ): void => {
    const merged: WorkflowNodeParams = {
      ...p,
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: pathType,
      bboxTargetX: targetX,
      bboxTargetY: targetY,
      bboxTargetScalePct: targetScalePct,
      depthMode,
      bboxStartZ: startZ,
      bboxTargetZ: targetZ,
      timeStart: tStart,
      timeEnd: tEnd,
      ...patch
    }
    useEditor.getState().update((d) => {
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        wfNode.params = { ...(wfNode.params ?? {}), ...merged }
      }
      if (wfNode) syncWorkflowV2NodeToProject(d, wfNode, merged)
    }, mergeKey)
  }

  // Danh sách các Layer khác trong cùng cảnh để làm mốc Chiều sâu Z (cây, đá...) hoặc mục tiêu Va chạm
  const movingIdSet = useMemo(() => {
    const s = new Set(targetIds)
    for (const m of clusterMembers) s.add(m.id)
    return s
  }, [targetIds, clusterMembers])

  const sceneObstacleLayers = useMemo(() => {
    const shotId = p.shotId ?? rootLayer?.shotId
    return project.layers.filter((l) => {
      if (!l.visible || movingIdSet.has(l.id)) return false
      if (l.type === 'particles' || (l.type === 'solid' && Boolean(l.props.pattern))) return false
      if (shotId && l.shotId && l.shotId !== shotId) return false
      if (l.composite?.instanceId && !l.composite.isRoot) return false
      return true
    })
  }, [project.layers, movingIdSet, p.shotId, rootLayer?.shotId])

  const handleTogglePreview = (): void => {
    const ed = useEditor.getState()
    if (ed.playing) {
      ed.setPlaying(false)
      return
    }
    applyBboxPatch({}, 'wf-bbox-preview-bake')
    onScrubTime(tStart)
    ed.setTime(tStart)
    ed.setPlaying(true)
  }

  const distPx = Math.round(Math.hypot(targetX - startPos[0], targetY - startPos[1]))
  const speedPxPerSec = Math.round(distPx / Math.max(0.2, runDuration))

  return { p, node, project, onScrubTime, onSelectNode, rootLayer, compDur, tStart, tEnd, runDuration, startPos, pathType, targetX, targetY, targetScalePct, depthMode, startZ, targetZ, applyBboxPatch, sceneObstacleLayers, distPx, speedPxPerSec, isPlaying, handleTogglePreview }
}

export type BboxMotionModel = ReturnType<typeof useBboxMotionModel>
