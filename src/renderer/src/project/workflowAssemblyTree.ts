import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'

/** Expand a composite wrapper into addressable parts without changing scene transforms. */
export function expandWorkflowAssemblyParts(workflow: WorkflowGraph, project: Project): WorkflowGraph {
  const roots = workflow.nodes.filter((n) => n.type === 'layer_assembly' && n.params?.isAssemblyRoot && !n.params.assemblyRootNodeId)
  if (!roots.length) return workflow
  const nodes = [...workflow.nodes]
  const edges = [...workflow.edges]
  const existing = new Set(nodes.map((n) => n.id))
  const layersById = new Map(project.layers.map((layer) => [layer.id, layer]))
  let changed = false
  for (const root of roots) {
    const layers = (root.params?.targetLayerIds ?? []).map((id) => layersById.get(id)).filter((layer) => !!layer)
    const partId = (id: string) => `${root.id}-part-${id}`
    const partIds = new Map(layers.map((layer) => [layer.id, partId(layer.id)]))
    layers.forEach((layer, index) => {
      const id = partId(layer.id)
      if (existing.has(id)) return
      const parent = layer.parentId && layer.parentId !== layer.id ? partIds.get(layer.parentId) ?? root.id : root.id
      const node: WorkflowNode = {
        id, type: 'layer_assembly', title: layer.name, enabled: layer.visible,
        position: { x: root.position.x + index * 320, y: root.position.y + 560 },
        preset: 'layer_part', aiAgentRole: 'AssemblyRigAgent',
        aiDirective: `Quản lý bộ phận ${layer.name} của ${root.title}.`,
        params: { shotId: layer.shotId ?? root.params?.shotId, targetMode: 'custom',
          targetLayerIds: [layer.id], assemblyRootNodeId: root.id, hierarchyParentNodeId: parent }
      }
      nodes.push(node)
      edges.push({ id: `edge-${parent}-actors_rig-${id}-layers_tree`, fromNode: parent,
        fromPort: 'actors_rig', toNode: id, toPort: 'layers_tree' })
      existing.add(id)
      changed = true
    })
  }
  return changed ? { ...workflow, nodes, edges } : workflow
}
