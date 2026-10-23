import { current, isDraft } from 'immer'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { ensureProjectWorkflow, connectWorkflowPort, applyWorkflowToProject } from './workflowEngine'
import { spawnLogicNodeIntoWorkflow } from './workflowLogicNodes'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { getWorkflowNodePorts } from './workflowNodePorts'
import { validateWorkflowConnection } from './workflowConnectionRules'

function contextNode(id: string, type: WorkflowNode['type'], title: string, shotId: string, layerIds?: string[]): WorkflowNode {
  const spec = WORKFLOW_NODE_SPECS[type]
  return { id, type, title, enabled: true, preset: spec.presets[0].id, aiAgentRole: spec.aiAgentRole,
    aiDirective: '', position: { x: 80, y: type === 'scene_shot' ? 40 : 360 },
    params: { shotId, targetMode: layerIds ? 'custom' : 'auto', targetLayerIds: layerIds } }
}

function wireSource(graph: WorkflowGraph, source: WorkflowNode, node: WorkflowNode): WorkflowGraph | null {
  const from = getWorkflowNodePorts(source), to = getWorkflowNodePorts(node)
  for (const port of from.outputs) {
    if (to.inputs.includes(port) && validateWorkflowConnection(source, port, node, port).valid) {
      return connectWorkflowPort(graph, source.id, port, node.id, port)
    }
  }
  return null
}

/** Shared entry point for timeline and MCP. Only the new processor is executed. */
export function addTimelineLogic(project: Project, logicId: string, layerId?: string, targetShotId?: string): string {
  const layer = layerId ? project.layers.find((item) => item.id === layerId) : undefined
  if (layerId && !layer) throw new Error('Layer không còn tồn tại.')
  if (layer?.locked) throw new Error('Mở khóa layer trước khi thêm logic.')
  const shotId = layer?.shotId || targetShotId || 'all'
  if (shotId !== 'all' && !project.shots.some((item) => item.id === shotId)) throw new Error('Cảnh không còn tồn tại.')
  let graph = structuredClone(ensureProjectWorkflow(isDraft(project) ? current(project) : project))
  const column = Math.max(0, ...graph.nodes.map((item) => item.position.x)) + 360
  const result = spawnLogicNodeIntoWorkflow(graph, logicId, shotId, { autoConnect: false })
  graph = result.workflow
  const node = result.spawnedNode
  node.position = { x: column + 360, y: 360 }
  if (layer) node.params = { ...node.params, targetMode: 'custom', targetLayerIds: [layer.id] }
  if (node.type === 'scene_shot') {
    const ids = layer ? [layer.id] : project.layers.filter((item) => shotId === 'all' || item.shotId === shotId).map((item) => item.id)
    const output = contextNode(`tl-output-${node.id}`, 'layer_assembly', 'Layer của cảnh', shotId, ids)
    output.position = { x: node.position.x, y: node.position.y + 340 }
    graph.nodes.push(output)
    graph = connectWorkflowPort(graph, node.id, 'layers_tree', output.id, 'layers_tree')
  } else {
    let source = graph.nodes.find((item) => item.type === 'scene_shot' && item.enabled && item.params?.shotId === shotId)
    if (!source) {
      source = contextNode(`tl-scene-${shotId}`, 'scene_shot', project.shots.find((item) => item.id === shotId)?.name ?? 'Toàn dự án', shotId)
      // Keep a disabled existing context untouched; create a fresh source instead.
      if (graph.nodes.some((item) => item.id === source!.id)) source.id += `-${node.id}`
      source.position = { x: column, y: 40 }
      graph.nodes.push(source)
    }
    let connected: WorkflowGraph | null = null
    if (layer && getWorkflowNodePorts(node).inputs.includes('actors_rig')) {
      let entity = graph.nodes.find((item) => item.type === 'layer_assembly' && !item.params?.logicId
        && item.enabled && item.params?.targetLayerIds?.length === 1 && item.params.targetLayerIds[0] === layer.id)
      if (!entity) {
        entity = contextNode(`tl-layer-${layer.id}-${node.id}`, 'layer_assembly', layer.name, shotId, [layer.id])
        entity.position = { x: column, y: 360 }
        graph.nodes.push(entity)
      }
      graph = connectWorkflowPort(graph, source.id, 'layers_tree', entity.id, 'layers_tree')
      connected = wireSource(graph, entity, node)
    }
    graph = connected ?? wireSource(graph, source, node) ?? graph
    if (!graph.edges.some((edge) => edge.toNode === node.id)) throw new Error('Logic này chưa có cổng nguồn tương thích.')
  }
  applyWorkflowToProject(project, graph, { onlyNodeIds: new Set([node.id]) })
  return node.id
}
