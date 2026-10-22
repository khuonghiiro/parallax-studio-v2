import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { getWorkflowNodePorts } from './workflowNodePorts'
import { validateWorkflowConnection } from './workflowConnectionRules'

const scope = (node: WorkflowNode) => node.params?.shotId && node.params.shotId !== 'all' ? node.params.shotId : undefined
const sameScope = (a: WorkflowNode, b: WorkflowNode) => !scope(a) || !scope(b) || scope(a) === scope(b)
const keyOf = (edge: WorkflowEdge) => `${edge.fromNode}:${edge.fromPort}>${edge.toNode}:${edge.toPort}`

function wouldCycle(edges: WorkflowEdge[], from: string, to: string): boolean {
  const pending = [to], visited = new Set<string>()
  while (pending.length) {
    const id = pending.pop()!
    if (id === from) return true
    if (visited.has(id)) continue
    visited.add(id)
    for (const edge of edges) if (edge.fromNode === id) pending.push(edge.toNode)
  }
  return false
}

/** Preserve intentional wiring and complete only unambiguous, same-shot connections. */
export function autoWireScopedWorkflow(workflow: WorkflowGraph): WorkflowGraph {
  const nodes = workflow.nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges: WorkflowEdge[] = []
  const keys = new Set<string>()
  const add = (from: WorkflowNode | undefined, output: WorkflowPortKind, to: WorkflowNode, input: WorkflowPortKind, existing?: WorkflowEdge) => {
    if (!from || !sameScope(from, to)) return
    if (!getWorkflowNodePorts(from).outputs.includes(output) || !getWorkflowNodePorts(to).inputs.includes(input)) return
    if (!validateWorkflowConnection(from, output, to, input).valid) return
    const edge = existing ?? { id: `edge-${from.id}-${output}-${to.id}-${input}`, fromNode: from.id, fromPort: output, toNode: to.id, toPort: input }
    if (keys.has(keyOf(edge)) || wouldCycle(edges, from.id, to.id)) return
    if (['layers_tree', 'transform_link'].includes(input) && edges.some((e) => e.toNode === to.id && e.toPort === input)) return
    edges.push(edge); keys.add(keyOf(edge))
  }
  for (const edge of workflow.edges) {
    const to = byId.get(edge.toNode)
    if (to) add(byId.get(edge.fromNode), edge.fromPort, to, edge.toPort, edge)
  }
  const scenes = nodes.filter((n) => n.type === 'scene_shot')
  const layers = nodes.filter((n) => n.type === 'layer_assembly' && !n.params?.logicId)
  const sceneFor = (node: WorkflowNode) => {
    const matches = scenes.filter((scene) => sameScope(scene, node))
    return matches.length === 1 ? matches[0] : matches.find((scene) => scope(scene) && scope(scene) === scope(node))
  }
  wireHierarchy(nodes, byId, layers, sceneFor, add)
  wireStages(nodes, layers, sceneFor, edges, add)
  return { ...workflow, edges }
}

type Add = (from: WorkflowNode | undefined, output: WorkflowPortKind, to: WorkflowNode, input: WorkflowPortKind) => void
function wireHierarchy(nodes: WorkflowNode[], byId: Map<string, WorkflowNode>, layers: WorkflowNode[], sceneFor: (n: WorkflowNode) => WorkflowNode | undefined, add: Add) {
  for (const layer of layers) {
    const parentId = layer.params?.hierarchyParentNodeId ?? layer.params?.assemblyRootNodeId
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent) add(parent, 'actors_rig', layer, 'layers_tree')
    else add(sceneFor(layer), 'layers_tree', layer, 'layers_tree')
  }
  for (const transform of nodes.filter((node) => node.type === 'layer_transform')) {
    const ids = transform.params?.targetLayerIds ?? []
    const matches = layers.filter((layer) => sameScope(layer, transform)
      && ids.length > 0 && ids.length === layer.params?.targetLayerIds?.length
      && ids.every((id) => layer.params?.targetLayerIds?.includes(id)))
    if (matches.length === 1) add(matches[0], 'transform_link', transform, 'transform_link')
  }
}

function wireStages(nodes: WorkflowNode[], layers: WorkflowNode[], sceneFor: (n: WorkflowNode) => WorkflowNode | undefined, edges: WorkflowEdge[], add: Add) {
  const stages = nodes.filter((node) => node.enabled && !['scene_shot', 'layer_assembly', 'layer_transform'].includes(node.type))
  for (const stage of stages) {
    if (edges.some((edge) => edge.toNode === stage.id)) continue
    const targets = stage.params?.targetLayerIds ?? []
    const candidates = layers.filter((layer) => layer.enabled && sameScope(layer, stage)
      && targets.length > 0 && targets.every((id) => layer.params?.targetLayerIds?.includes(id)))
      .sort((a, b) => (a.params?.targetLayerIds?.length ?? 0) - (b.params?.targetLayerIds?.length ?? 0))
    const source = candidates[0]
    const unique = source && (!candidates[1] || source.params?.targetLayerIds?.length !== candidates[1].params?.targetLayerIds?.length)
    if (unique && getWorkflowNodePorts(stage).inputs.includes('actors_rig')) add(source, 'actors_rig', stage, 'actors_rig')
    else if (!targets.length) add(sceneFor(stage), 'scene_ctx', stage, 'scene_ctx')
  }
  const looks = stages.filter((node) => node.type === 'look_output')
  for (const stage of stages) {
    if (stage.type === 'look_output') continue
    const port = getWorkflowNodePorts(stage).outputs.find((value) => ['camera_cut', 'audio_mix', 'vfx_stage', 'motion_stream'].includes(value))
    if (!port) continue
    for (const look of looks) add(stage, port, look, port)
  }
}
