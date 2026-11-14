import type { Layer, Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams } from './workflowTiming'
import { resolveMotionMode } from './workflowMotionMode'
import {
  bakeBboxTargetMotionToScene,
  clearBboxMotionKeysFromScene
} from './workflowV2BboxMotionAndCollision'
import {
  bakeClusterRigPresetToScene,
  bakeCustomMotionPathToScene,
  captureTrajectorySnapshot,
  clearClusterRigKeysFromScene,
  getClusterMemberLayers,
  getLockedClusterMemberLayers
} from './workflowV2ClusterRigAndSwap'
import type { ProceduralMotionPreset } from '../ui/layerAssembly/workshopRigPresets'

/** Gom danh sách `instanceId` cụm 2.5D duy nhất bị ảnh hưởng bởi tập layer mục tiêu. */
export function collectClusterInstanceIds(
  project: Project,
  targetIds: Set<string>,
  explicitInstId?: string
): string[] {
  const ids = Array.from(
    new Set(
      project.layers
        .filter((l) => targetIds.has(l.id) && l.composite?.instanceId)
        .map((l) => l.composite!.instanceId!)
    )
  )
  if (explicitInstId && !ids.includes(explicitInstId)) {
    ids.push(explicitInstId)
  }
  return ids
}

const targetsInstance = (params: WorkflowNodeParams | undefined, instId: string, memberIds: Set<string>): boolean =>
  params?.instanceId === instId || (params?.targetLayerIds ?? []).some((id) => memberIds.has(id))

const resolveNodeRigPreset = (n: WorkflowNode): string | undefined => {
  const cat = n.params?.logicCategory
  if (cat === 'anim_fx') {
    if (n.params?.customActionId || n.params?.animMode === 'keyframe_fx') return undefined
    return n.params?.rigActionPreset && n.params.rigActionPreset !== 'none' ? n.params.rigActionPreset : undefined
  }
  if (n.type === 'motion_choreography' || cat === 'action') {
    const mode = resolveMotionMode(n.params ?? {})
    if (mode === 'bbox' || mode === 'path') return undefined
    const p =
      n.params?.rigActionPreset ||
      (n.params?.actionPreset?.startsWith('rig_') ? n.params.actionPreset.replace(/^rig_/, '') : undefined)
    return p && p !== 'none' ? p : undefined
  }
  return undefined
}

/**
 * Tái tổng hợp 2 pha cho mỗi cụm 2.5D:
 * Pha 1 — Xoá `-rig-` và bake lại toàn bộ Node quỹ đạo (`bbox` / `path`) theo `timeStart`.
 * Pha 2 — Chụp quỹ đạo thuần (`captureTrajectorySnapshot`) rồi cộng gộp lần lượt các Node Rig FK theo `timeStart`.
 */
export function recomposeClusterTrajectoriesAndRigs(project: Project, compInstIds: string[]): void {
  if (!project.workflow || compInstIds.length === 0) return

  for (const instId of compInstIds) {
    const locked = getLockedClusterMemberLayers(project, instId)
    const members = locked.length > 0 ? locked : getClusterMemberLayers(project, instId)
    if (members.length === 0) continue

    const memberIds = new Set(members.map((m) => m.id))
    const memberIdList = members.map((m) => m.id)

    const trajNodes = project.workflow.nodes
      .filter((n) => {
        if (!n.enabled) return false
        const isAction = n.type === 'motion_choreography' || n.params?.logicCategory === 'action'
        if (!isAction || !targetsInstance(n.params, instId, memberIds)) return false
        const mode = resolveMotionMode(n.params ?? {})
        return mode === 'bbox' || mode === 'path'
      })
      .sort(
        (a, b) =>
          (effectiveTimeParams(project, a, a.params ?? {}).timeStart ?? 0) -
          (effectiveTimeParams(project, b, b.params ?? {}).timeStart ?? 0)
      )

    const rigNodes = project.workflow.nodes
      .filter((n) => n.enabled && targetsInstance(n.params, instId, memberIds) && Boolean(resolveNodeRigPreset(n)))
      .sort(
        (a, b) =>
          (effectiveTimeParams(project, a, a.params ?? {}).timeStart ?? 0) -
          (effectiveTimeParams(project, b, b.params ?? {}).timeStart ?? 0)
      )

    const boneNode = project.workflow.nodes.find(
      (n) => n.enabled && n.params?.logicCategory === 'rig_bone' && targetsInstance(n.params, instId, memberIds)
    )
    const rigBonePreset = boneNode?.params?.rigBonePreset

    clearClusterRigKeysFromScene(members)

    for (const tNode of trajNodes) {
      const ep = effectiveTimeParams(project, tNode, tNode.params ?? {})
      const mode = resolveMotionMode(ep)
      if (mode === 'bbox') {
        clearBboxMotionKeysFromScene(project, tNode.id)
        bakeBboxTargetMotionToScene(project, memberIdList, ep, tNode.id)
      } else if (mode === 'path') {
        for (const l of project.layers as Layer[]) {
          l.transform.position.keyframes = l.transform.position.keyframes.filter(
            (k) => !k.id.includes(`-motpath-p-${tNode.id}-`)
          )
        }
        bakeCustomMotionPathToScene(project, memberIdList, ep.customMotionPath ?? [], {
          timeStart: ep.timeStart,
          timeEnd: ep.timeEnd,
          intensity: ep.intensity,
          loop: ep.customMotionLoop,
          cycleDuration: ep.customMotionCycleSec,
          nodeId: tNode.id
        })
      }
    }

    if (rigNodes.length === 0) continue
    const trajSnapshot = captureTrajectorySnapshot(members)
    for (const rNode of rigNodes) {
      const ep = effectiveTimeParams(project, rNode, rNode.params ?? {})
      const preset = resolveNodeRigPreset(rNode)
      if (!preset) continue
      bakeClusterRigPresetToScene(project, instId, preset as ProceduralMotionPreset, {
        timeStart: ep.timeStart,
        timeEnd: ep.timeEnd,
        intensity: ep.intensity,
        nodeId: rNode.id,
        rigBonePreset,
        trajSnapshot
      })
    }
  }
}
