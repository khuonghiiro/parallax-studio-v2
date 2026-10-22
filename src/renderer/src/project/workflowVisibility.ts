import type { Project, WorkflowGraph } from '@shared/types'

/** Group and leaf switches combine; iteration order cannot re-enable a hidden child. */
export function getWorkflowLayerVisibility(project: Project, workflow: WorkflowGraph, active: Set<string>): Map<string, boolean> {
  const values = new Map<string, boolean>()
  for (const node of workflow.nodes) {
    if (node.type !== 'layer_assembly' || node.params?.logicId) continue
    const ids = node.params?.targetLayerIds ?? []
    if (!node.id.startsWith('wf-layer-') && node.params?.targetMode !== 'custom') continue
    const visible = node.enabled && active.has(node.id)
    for (const id of ids) values.set(id, (values.get(id) ?? true) && visible)
  }
  const byId = new Map(project.layers.map((layer) => [layer.id, layer]))
  for (const layer of project.layers) {
    let parent = layer.parentId
    const seen = new Set([layer.id])
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      if (values.get(parent) === false) { values.set(layer.id, false); break }
      parent = byId.get(parent)?.parentId
    }
  }
  return values
}
