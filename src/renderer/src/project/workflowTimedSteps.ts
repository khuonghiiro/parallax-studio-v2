import { stepTimeParams } from './workflowStepGraph'
import { bboxStepNumber, isBboxStep } from './workflowBboxSteps'
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { layoutWorkflowV2Tree } from './workflowV2Layout'
import { recomputeSharedLogicTargets } from './workflowV2PhysicsAndValidation'

function uniqueNodeId(workflow: WorkflowGraph, base: string): string {
  let id = base, index = 1
  while (workflow.nodes.some(n => n.id === id)) id = `${base}-${index++}`
  return id
}
function withEdge(workflow: WorkflowGraph, nodes: WorkflowNode[], edge: WorkflowEdge): WorkflowGraph {
  const edges = [...workflow.edges, edge]
  return { ...workflow, nodes: layoutWorkflowV2Tree(recomputeSharedLogicTargets(nodes, edges), edges), edges }
}

/**
 * Tạo tiếp một Node hành động kế tiếp theo mốc giây (ví dụ: sau `[0.0s – 3.0s]` nối tiếp `[3.0s – 6.0s]` hoặc `[15.0s – 18.0s]`)
 * cho cùng Bộ phận con, Animation hoặc Motion mà không ghi đè mốc cũ.
 */
export function spawnTimedFollowupNodeV2(
  workflow: WorkflowGraph,
  sourceNodeId: string,
  durationSec = 3.0,
  explicitStartSec?: number
): { workflow: WorkflowGraph; createdNodeId: string } | null {
  const src = workflow.nodes.find((n) => n.id === sourceNodeId)
  if (!src || !Number.isFinite(durationSec) || durationSec < 0.5 ||
    (!src.params?.isPartChild && !['action', 'anim_fx', 'collision'].includes(src.params?.logicCategory ?? ''))) return null
  const parentEdge = workflow.edges.find((e) => e.toNode === src.id && !e.disabled)
  const parentId = src.params?.hierarchyParentNodeId ?? parentEdge?.fromNode
  if (!parentId) return null

  const timing = stepTimeParams(workflow, src, src.params ?? {})
  const prevEnd = timing.timeEnd ?? (timing.timeStart ?? 0) + durationSec
  const tStart = Number(Math.max(0, explicitStartSec ?? prevEnd).toFixed(2))
  const tEnd = Number((tStart + Math.max(0.5, durationSec)).toFixed(2))
  const baseId = src.id.replace(/-t\d+(-\d+)?$/, '')
  const newId = uniqueNodeId(workflow, `${baseId}-t${Math.round(tStart * 10)}`)
  const cleanTitle = src.title.replace(/\s*\(\d+(\.\d+)?s–\d+(\.\d+)?s\)$/, '')

  const nextNode: WorkflowNode = {
    ...src,
    id: newId,
    title: isBboxStep(src) ? `Motion: BBox #${bboxStepNumber(workflow, src.id) + 1} → #${bboxStepNumber(workflow, src.id) + 2}` : `${cleanTitle} (${tStart}s–${tEnd}s)`,
    enabled: true,
    position: { x: src.position.x + 356, y: src.position.y },
    params: {
      ...(src.params ?? {}),
      timeStart: tStart,
      timeEnd: tEnd,
      localTimeRange: undefined,
      bboxStartZ: undefined,
      ...(isBboxStep(src) ? { bboxTargetScalePct: 100, collisionOnPathEnabled: false,
        bboxTargetX: (src.params?.bboxTargetX ?? 0) + 280,
        bboxPathType: 'shortest' as const, customMotionPath: undefined } : {}),
      pinned: true
    }
  }
  const chained = ['action', 'collision'].includes(src.params?.logicCategory ?? '')
  const port = chained ? (src.params?.logicCategory === 'collision' ? 'vfx_stage' : 'motion_stream') : 'layers_tree'
  return {
    workflow: withEdge(workflow, [...workflow.nodes, nextNode], { id: `e-${src.id}-${newId}`, fromNode: chained ? src.id : parentId, fromPort: port, toNode: newId, toPort: port }),
    createdNodeId: newId
  }
}


