import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { resolveMotionMode } from './workflowMotionMode'
import { effectiveTimeParams } from './workflowTiming'
import { clearBboxMotionKeysFromScene } from './workflowV2BboxMotionAndCollision'
import { stripCollisionGeneratedKeys } from './workflowV2CollisionKeys'

type SyncNode = (project: Project, node: WorkflowNode, patch?: Partial<WorkflowNodeParams>) => void
const isBbox = (n: WorkflowNode): boolean => resolveMotionMode(n.params ?? {}) === 'bbox'

/** Rebuild dependent tracks from clean inputs, irrespective of graph insertion order. */
export function syncMotionExecution(
  project: Project,
  node: WorkflowNode,
  patch: Partial<WorkflowNodeParams> | undefined,
  sync: SyncNode
): void {
  sync(project, node, patch)
  if (
    !project.workflow ||
    (!['action', 'collision', 'time', 'cluster_lock'].includes(node.params?.logicCategory ?? '') &&
      node.type !== 'layer_assembly')
  ) {
    return
  }
  const nodes = project.workflow.nodes.map((n) =>
    n.id === node.id && n.enabled !== node.enabled ? { ...n, enabled: node.enabled } : n
  )
  const motions = nodes.filter(isBbox)
  const collisions = nodes.filter((n) => n.params?.logicCategory === 'collision')
  const motionDrivenParts = nodes.filter(
    (n) =>
      n.params?.logicCategory === 'part_swap' &&
      !n.params?.isPartHub &&
      !n.params?.partTimeline &&
      (n.params?.partTriggerMode === 'motion_bbox' || Boolean(n.params?.linkedMotionNodeId))
  )
  for (const motion of motions) clearBboxMotionKeysFromScene(project, motion.id)
  for (const collision of collisions) stripCollisionGeneratedKeys(project, collision.id)
  motions.sort(
    (a, b) =>
      (effectiveTimeParams(project, a, a.params ?? {}).timeStart ?? 0) -
      (effectiveTimeParams(project, b, b.params ?? {}).timeStart ?? 0)
  )
  for (const motion of motions) {
    sync(project, { ...motion, params: effectiveTimeParams(project, motion, motion.params ?? {}) })
  }
  for (const collision of collisions) {
    sync(project, { ...collision, params: effectiveTimeParams(project, collision, collision.params ?? {}) })
  }
  for (const part of motionDrivenParts) {
    sync(project, { ...part, params: effectiveTimeParams(project, part, part.params ?? {}) })
  }
}
