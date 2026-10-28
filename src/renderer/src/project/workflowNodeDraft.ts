import { isTimeNode } from './workflowTiming'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { applyWorkflowToProject, resolveNodeTargetBinding } from './workflowEngine'
import { getNodeSubParts } from './workflowTargets'
import { applyRuleMutationToProjectLayer } from './workflowStageEffects'
import { isWorkflowEntity } from './workflowRouting'
import { Immer } from 'immer'

const previewImmer = new Immer({ autoFreeze: false })

export function initializeNodeDraft(node: WorkflowNode, project: Project): WorkflowNode {
  const result = structuredClone(node)
  result.params = { ...result.params, configurationMode: 'explicit' }
  if (node.type === 'layer_transform' || (node.type === 'layer_assembly' && node.params?.targetLayerIds?.length)) {
    const layer = project.layers.find((item) => item.id === node.params?.targetLayerIds?.[0])
    if (layer) Object.assign(result.params, { transformX: layer.transform.position.value[0],
      transformY: layer.transform.position.value[1], transformZ: layer.transform.position.value[2],
      transformRotation: layer.transform.rotation.value[2] })
  }
  result.params.targetParts ??= getNodeSubParts(result).filter((p) => p.active).map((p) => p.id)
  return patchNodeDraft(result, result.params)
}

/** Keep duplicate representations (checkbox and part chip) in one explicit state. */
export function patchNodeDraft(node: WorkflowNode, patch: Partial<WorkflowNodeParams>): WorkflowNode {
  const params = { ...node.params, ...patch, configurationMode: 'explicit' as const }
  const parts = new Set(patch.targetParts ?? getNodeSubParts(node).filter((p) => p.active).map((p) => p.id))
  const pairs = node.type === 'camera_director' ? [['enableDof', 'dof_aperture'], ['camShakeAmount', 'handheld_rig']]
    : node.type === 'physics_fx' ? [['spawnParticles', 'firefly_particles']]
    : node.type === 'audio_lipsync' ? [['autoLipSync', 'mouth_viseme_25d']]
    : node.type === 'scene_shot' ? [['ensureGround', 'ground_plane']] : []
  for (const [key, part] of pairs) {
    const field = key as keyof WorkflowNodeParams
    if (patch[field] !== undefined) {
      if (patch[field]) parts.add(part); else parts.delete(part)
    } else if (patch.targetParts !== undefined) {
      Object.assign(params, { [key]: key === 'camShakeAmount' ? (parts.has(part) ? Number(params.camShakeAmount) || 6 : 0) : parts.has(part) })
    }
  }
  params.targetParts = [...parts]
  return { ...node, params }
}

function resetRemovedEffects(project: Project, previous: WorkflowNode, node: WorkflowNode) {
  const oldParts = getNodeSubParts(previous).filter((p) => p.active).map((p) => p.id)
  const parts = new Set(node.enabled ? getNodeSubParts(node).filter((p) => p.active).map((p) => p.id) : [])
  const removed = new Set(oldParts.filter((id) => !parts.has(id)))
  const binding = resolveNodeTargetBinding(previous, project)
  for (const rule of previous.params?.customRules ?? []) {
    if (rule.enabled) applyRuleMutationToProjectLayer(project, rule, false, previous.params?.shotId === 'all' ? undefined : previous.params?.shotId, binding.matchesLayer)
  }
  for (const layer of project.layers) {
    if (layer.locked || !binding.matchesLayer(layer)) continue
    if ((!node.enabled && previous.type === 'motion_choreography') || [...removed].some((p) => /wind|drift|breathe|sway/.test(p))) {
      if (layer.motion) layer.motion.enabled = false
    }
    if (removed.has('virtual_light_core') && layer.virtualLight) layer.virtualLight.enabled = false
    if (removed.has('rim_glow_silhouette') && layer.glow) layer.glow.enabled = false
    if ((removed.has('soft_mesh_jiggle') || removed.has('collider_zone')) && layer.physics) layer.physics.enabled = false
    if (previous.type === 'physics_fx' && layer.type === 'particles') {
      layer.visible = node.enabled && (node.params?.spawnParticles ?? parts.has('firefly_particles'))
    }
  }
}

/** Shared by the private preview and the single Undo transaction on Apply. */
function applyNodeDraftToProject(project: Project, base: Project, workflow: WorkflowGraph, node: WorkflowNode, previous: WorkflowNode): void {
  const next = { ...workflow, nodes: workflow.nodes.map((item) => item.id === node.id ? node : item) }
  if (isTimeNode(node)) { project.workflow = next; syncWorkflowV2NodeToProject(project, node); return }
  resetRemovedEffects(project, previous, node)
  const entity = node.type === 'layer_transform' || (node.type === 'layer_assembly' && !node.params?.logicId && node.params?.targetLayerIds?.length)
  if (entity) {
    const ids = node.params?.targetLayerIds ?? []
    const root = base.layers.find((layer) => layer.id === ids[0])
    if (root) for (const layer of project.layers) {
      if (!ids.includes(layer.id) || layer.locked || (layer.parentId && ids.includes(layer.parentId))) continue
      const keys = ['transformX', 'transformY', 'transformZ'] as const
      keys.forEach((key, i) => { layer.transform.position.value[i] += (node.params?.[key] ?? root.transform.position.value[i]) - root.transform.position.value[i] })
      layer.transform.rotation.value[2] += (node.params?.transformRotation ?? root.transform.rotation.value[2]) - root.transform.rotation.value[2]
    }
  }
  const affected = new Set([node.id])
  const oldGraph = base.workflow
  const before = oldGraph?.edges ?? []
  const changed = [...before.filter((edge) => !next.edges.some((item) => item.id === edge.id)),
    ...next.edges.filter((edge) => !before.some((item) => item.id === edge.id))]
  for (const edge of changed.filter((edge) => edge.fromNode === node.id || edge.toNode === node.id)) {
    for (const id of [edge.fromNode, edge.toNode]) {
      const neighbor = next.nodes.find((item) => item.id === id)
      if (!neighbor || isWorkflowEntity(neighbor) || neighbor.type === 'scene_shot') continue
      affected.add(id)
      const old = oldGraph?.nodes.find((item) => item.id === id)
      if (old && id !== node.id) resetRemovedEffects(project, old, neighbor)
    }
  }
  applyWorkflowToProject(project, next, { onlyNodeIds: affected })
}

export function evaluateNodeDraft(base: Project, workflow: WorkflowGraph, node: WorkflowNode, previous: WorkflowNode): Project {
  return previewImmer.produce(base, (draft) => { applyNodeDraftToProject(draft as Project, base, workflow, node, previous) })
}
