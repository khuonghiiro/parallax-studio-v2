import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { getCustomActionSpec } from '../../project/workflowStageEffects'

export const editableNodeRules = (node: WorkflowNode) =>
  (node.params?.customRules ?? []).filter((rule) => !rule.id.startsWith('inspector-'))

export function nodeEditingLabel(node: WorkflowNode, ruleId?: string): string {
  const rule = editableNodeRules(node).find((item) => item.id === ruleId)
  if (rule) return getCustomActionSpec(rule.actionKind)?.shortLabel ?? rule.label
  return WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === node.params?.logicId)?.shortLabel
    ?? WORKFLOW_NODE_SPECS[node.type].presets.find((item) => item.id === node.preset)?.label ?? node.title
}

/** Notes, labels and canvas positions do not affect the evaluated scene. */
export function nodePreviewKey(workflow: WorkflowGraph): string {
  return JSON.stringify({ targetShotId: workflow.targetShotId, edges: workflow.edges,
    nodes: workflow.nodes.map(({ id, type, enabled, preset, params }) => ({ id, type, enabled, preset, params })) })
}

/** Draft evaluation preserves identity for unchanged data, including mesh and asset payloads. */
export function nodePreviewChanges(base: Project, preview?: Project) {
  if (!preview || preview === base) return { layers: [], sections: [] as string[] }
  const before = new Map(base.layers.map((layer) => [layer.id, layer]))
  const layers = preview.layers.filter((layer) => !equalPreviewValue(before.get(layer.id), layer))
  const sections: string[] = []
  if (!equalPreviewValue(base.camera, preview.camera)) sections.push('Camera')
  if (!equalPreviewValue(base.look, preview.look)) sections.push('Màu sắc')
  if (!equalPreviewValue(base.audioTracks, preview.audioTracks)) sections.push('Âm thanh')
  return { layers, sections }
}

function equalPreviewValue(before: unknown, after: unknown): boolean {
  if (before === after) return true
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return false
  if (Array.isArray(before) !== Array.isArray(after)) return false
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equalPreviewValue(a[key], b[key]))
}
