import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { validateWorkflowConnection } from './workflowConnectionRules'

export interface WorkflowRouting { layerIds: string[]; shotIds: string[]; hasLayerRoute: boolean }

export function isWorkflowEntity(node: WorkflowNode): node is WorkflowNode & { params: { targetLayerIds: string[] } } {
  return node.type === 'layer_assembly' && Boolean(node.params?.targetLayerIds?.length) && !node.params?.logicId
}

const unique = (items: string[]) => [...new Set(items.filter((item) => item && item !== 'all'))]
const scopeOf = (node: WorkflowNode) => unique([node.params?.shotId ?? ''])
const direct = (node: WorkflowNode, workflow: WorkflowGraph, dir: 'in' | 'out') =>
  workflow.edges.flatMap((edge) => {
    if (edge.fromPort === 'time_range' || edge.disabled) return []
    if ((dir === 'in' ? edge.toNode : edge.fromNode) !== node.id) return []
    const other = workflow.nodes.find((item) => item.id === (dir === 'in' ? edge.fromNode : edge.toNode) && item.enabled)
    const from = dir === 'in' ? other : node, to = dir === 'in' ? node : other
    return other && from && to && validateWorkflowConnection(from, edge.fromPort, to, edge.toPort).valid ? [other] : []
  })

function findDownstreamEntities(node: WorkflowNode, workflow: WorkflowGraph): (WorkflowNode & { params: { targetLayerIds: string[] } })[] {
  const visited = new Set<string>([node.id])
  const queue = direct(node, workflow, 'out')
  const entities: (WorkflowNode & { params: { targetLayerIds: string[] } })[] = []
  while (queue.length) {
    const cur = queue.shift()!
    if (visited.has(cur.id)) continue
    visited.add(cur.id)
    if (isWorkflowEntity(cur)) {
      entities.push(cur)
    } else if (cur.type !== 'scene_shot' && cur.type !== 'look_output') {
      queue.push(...direct(cur, workflow, 'out'))
    }
  }
  return entities
}

export function getWorkflowRouting(node: WorkflowNode, workflow: WorkflowGraph): WorkflowRouting {
  if (isWorkflowEntity(node)) return { layerIds: [...node.params.targetLayerIds], shotIds: scopeOf(node), hasLayerRoute: true }
  const seen = new Set([node.id])
  const queue = direct(node, workflow, 'in')
  const layers: string[] = []
  const shots = scopeOf(node)
  let hasLayerRoute = Boolean(node.params?.requireLayerConnection)
  while (queue.length) {
    const current = queue.shift()!
    if (seen.has(current.id)) continue
    seen.add(current.id)
    shots.push(...scopeOf(current))
    if (isWorkflowEntity(current)) {
      hasLayerRoute = true
      layers.push(...current.params.targetLayerIds)
      continue
    }
    if (current.type === 'scene_shot') continue
    for (const source of direct(current, workflow, 'in')) if (!seen.has(source.id)) queue.push(source)
  }
  if (!layers.length) {
    const outLayers = findDownstreamEntities(node, workflow)
    if (outLayers.length) {
      return {
        layerIds: unique(outLayers.flatMap((item) => item.params.targetLayerIds)),
        shotIds: unique([...shots, ...outLayers.flatMap(scopeOf)]),
        hasLayerRoute: true
      }
    }
  }
  return { layerIds: unique(layers), shotIds: unique(shots), hasLayerRoute }
}
