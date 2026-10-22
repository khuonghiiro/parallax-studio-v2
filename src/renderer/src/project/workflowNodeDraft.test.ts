import { describe, expect, it } from 'vitest'
import { createProject, createImageLayer, createShot } from './factory'
import { createDefaultWorkflow, ensureProjectWorkflow, resolveNodeTargetBinding } from './workflowEngine'
import { evaluateNodeDraft, initializeNodeDraft, patchNodeDraft } from './workflowNodeDraft'
import { getNodeSubParts } from './workflowTargets'
import type { WorkflowNode } from '@shared/types'

function fixture() {
  const project = createProject()
  const shot = createShot('Test')
  project.shots.push(shot)
  const layer = createImageLayer({ id: 'image', name: 'Nhân vật', kind: 'image', mime: 'image/png', width: 640, height: 480 }, project.comp, 0, shot.id)
  project.layers.push(layer)
  project.workflow = createDefaultWorkflow()
  return { project, layer }
}
describe('node configuration drafts', () => {
  it('evaluates saved configuration immediately without mutating the editor project', () => {
    const { project } = fixture()
    const original = JSON.stringify(project)
    const old = project.workflow!.nodes.find((n) => n.type === 'camera_director')!
    const node = initializeNodeDraft(old, project)
    node.params = { ...node.params, enableDof: true }
    const preview = evaluateNodeDraft(project, project.workflow!, node, old)
    expect(preview.camera.dofEnabled).toBe(true)
    expect(JSON.stringify(project)).toBe(original)
    expect(ensureProjectWorkflow(preview).nodes.find((n) => n.id === node.id)?.params?.enableDof).toBe(true)
    node.params.enableDof = false
    expect(evaluateNodeDraft(project, project.workflow!, node, old).camera.dofEnabled).toBe(false)
  })
  it('keeps checkbox and chip selections consistent in both directions', () => {
    const { project } = fixture()
    let node = initializeNodeDraft(project.workflow!.nodes.find((n) => n.type === 'camera_director')!, project)
    node = patchNodeDraft(node, { enableDof: true })
    expect(node.params!.targetParts).toContain('dof_aperture')
    node = patchNodeDraft(node, { targetParts: [] })
    expect(node.params!.enableDof).toBe(false)
    node = patchNodeDraft(node, { targetParts: ['dof_aperture'] })
    expect(node.params!.enableDof).toBe(true)
    node = patchNodeDraft(node, { enableDof: false })
    expect(node.params!.targetParts).not.toContain('dof_aperture')
  })
  it('preserves explicit empty targets and empty parts', () => {
    const { project, layer } = fixture()
    const node = initializeNodeDraft(project.workflow!.nodes.find((n) => n.type === 'physics_fx')!, project)
    node.params = { ...node.params, targetMode: 'custom', targetLayerIds: [], targetParts: [], spawnParticles: false }
    expect(resolveNodeTargetBinding(node, project).boundTargets).toEqual([])
    expect(resolveNodeTargetBinding(node, project).matchesLayer(layer)).toBe(false)
    expect(getNodeSubParts(node).some((p) => p.active)).toBe(false)
    project.workflow!.nodes = project.workflow!.nodes.map((n) => n.id === node.id ? node : n)
    expect(ensureProjectWorkflow(project).nodes.find((n) => n.id === node.id)?.params).toEqual(node.params)
  })
  it('evaluates transform from a stable baseline without double-moving parented children', () => {
    const { project, layer } = fixture()
    const child = structuredClone(layer); child.id = 'child'; child.parentId = layer.id
    project.layers.push(child)
    const node: WorkflowNode = { id: 'root', type: 'layer_transform', enabled: true, preset: 'default',
      title: 'Transform', aiAgentRole: 'AssemblyRigAgent', aiDirective: '', position: { x: 0, y: 0 },
      params: { targetLayerIds: [layer.id, child.id] } }
    const draft = initializeNodeDraft(node, project)
    draft.params!.transformX = 100
    const graph = { ...project.workflow!, nodes: [...project.workflow!.nodes, draft] }
    const first = evaluateNodeDraft(project, graph, draft, node)
    const second = evaluateNodeDraft(project, graph, draft, node)
    expect(first.layers[0].transform.position.value[0]).toBe(100)
    expect(first.layers[1].transform.position.value[0]).toBe(child.transform.position.value[0])
    expect(second.layers[0].transform.position.value).toEqual(first.layers[0].transform.position.value)
  })
})
