import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import { applyWorkflowToProject, connectWorkflowPort, disconnectWorkflowEdge, resolveConnectedWorkflowNodes } from './workflowEngine'
import { spawnLogicNodeIntoWorkflow } from './workflowLogicNodes'
import { resolveNodeTargetBinding } from './workflowTargets'
import { evaluateNodeDraft } from './workflowNodeDraft'
import { executeAudioLipSyncStage } from './workflowEntitySync'
import type { WorkflowGraph, WorkflowNode } from '@shared/types'

function fixture(logicId = 'logic-physics-wind') {
  const project = createProject()
  const shot = createShot('Cảnh kiểm thử'); project.shots.push(shot)
  const layers = ['Cây A', 'Cây B'].map((name, i) => createImageLayer({ id: `asset-${i}`, name,
    kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id))
  project.layers.push(...layers)
  const root: WorkflowNode = { id: 'scene', type: 'scene_shot', title: 'Cảnh', enabled: true,
    preset: 'deep_parallax_stage', aiAgentRole: 'SceneLayoutAgent', aiDirective: '', position: { x: 0, y: 0 },
    params: { shotId: shot.id, autoArrangeZ: false, ensureGround: false } }
  const entity: WorkflowNode = { ...root, id: 'wf-layer-a', type: 'layer_assembly',
    params: { shotId: shot.id, targetLayerIds: [layers[0].id], targetMode: 'custom' } }
  const graph: WorkflowGraph = { version: 1, id: 'routing', name: 'Routing', description: '', nodes: [root, entity], edges: [] }
  let { workflow, spawnedNode: logic } = spawnLogicNodeIntoWorkflow(graph, logicId, shot.id, { autoConnect: false })
  workflow = connectWorkflowPort(workflow, root.id, 'layers_tree', entity.id, 'layers_tree')
  workflow = connectWorkflowPort(workflow, entity.id, 'actors_rig', logic.id, 'actors_rig')
  project.workflow = workflow
  return { project, workflow, logic, root, entity, layers }
}

describe('workflow operations receive their wired targets', () => {
  it('applies a library operation once and only to the wired entity', () => {
    const { project, workflow, logic, layers } = fixture()
    logic.params!.intensity = 2
    const report = applyWorkflowToProject(project, workflow)
    expect(layers[0].motion?.type).toBe('wind')
    expect(layers[0].motion?.amplitude?.[0]).toBe(20)
    expect(layers[1].motion?.enabled).not.toBe(true)
    expect(report.executedStages.filter((stage) => stage.nodeId === logic.id)).toHaveLength(1)
  })
  it('resolves downstream entity targets without spilling onto the scene', () => {
    const { project, workflow, logic, entity, root, layers } = fixture('logic-motion-drift')
    workflow.edges = workflow.edges.filter((edge) => edge.toNode !== logic.id)
    const next = connectWorkflowPort(connectWorkflowPort(workflow, root.id, 'scene_ctx', logic.id, 'scene_ctx'),
      logic.id, 'motion_stream', entity.id, 'motion_stream')
    applyWorkflowToProject(project, next)
    expect(layers[0].motion?.type).toBe('drift')
    expect(layers[1].motion?.enabled).not.toBe(true)
  })
  it('never lets an explicit rule escape its wired node scope', () => {
    const { project, workflow, logic, layers } = fixture()
    logic.params!.customRules![0].targetId = layers[1].id
    applyWorkflowToProject(project, workflow)
    expect(layers.every((layer) => !layer.motion?.enabled)).toBe(true)
  })
  it('propagates layer scope through processing nodes', () => {
    const { project, workflow, logic, layers } = fixture('logic-motion-drift')
    const spawned = spawnLogicNodeIntoWorkflow(workflow, 'logic-fx-rimglow', project.shots[0].id, { autoConnect: false })
    const next = connectWorkflowPort(spawned.workflow, logic.id, 'motion_stream', spawned.spawnedNode.id, 'motion_stream')
    expect(resolveNodeTargetBinding(spawned.spawnedNode, project, next).matchesLayer(layers[1])).toBe(false)
    applyWorkflowToProject(project, next)
    expect(layers[0].glow?.enabled).toBe(true)
    expect(layers[1].glow?.enabled).not.toBe(true)
  })
  it('cancelled previews leave project intact and disabling one operation preserves unrelated layers', () => {
    const { project, workflow, logic, layers } = fixture()
    applyWorkflowToProject(project, workflow)
    layers[1].motion = { enabled: true, type: 'float', speed: 1 }
    const original = JSON.stringify(project)
    const preview = evaluateNodeDraft(project, workflow, { ...logic, enabled: false }, logic)
    expect(JSON.stringify(project)).toBe(original)
    expect(preview.layers[0].motion?.enabled).toBe(false)
    expect(preview.layers[1].motion?.enabled).toBe(true)
  })
  it('does not run an isolated processing node as a trigger', () => {
    const { workflow, logic } = fixture()
    expect(resolveConnectedWorkflowNodes({ ...workflow, nodes: [logic], edges: [] }).activeNodes).toHaveLength(0)
  })
  it('rejects invalid imported wires and processor cycles but supports layer modifier returns', () => {
    const { workflow, root, logic, entity } = fixture()
    const invalid = { id: 'invalid', fromNode: root.id, fromPort: 'audio_mix' as const, toNode: logic.id, toPort: 'actors_rig' as const }
    expect(resolveConnectedWorkflowNodes({ ...workflow, edges: [invalid] }).activeNodes).toEqual([])
    const feedback = connectWorkflowPort(workflow, logic.id, 'vfx_stage', entity.id, 'vfx_stage')
    expect(resolveConnectedWorkflowNodes(feedback).activeNodes.map((node) => node.id)).toContain(logic.id)
    const spawned = spawnLogicNodeIntoWorkflow(workflow, 'logic-fx-rimglow', undefined, { autoConnect: false })
    const a = { id: 'a', fromNode: logic.id, fromPort: 'vfx_stage' as const, toNode: spawned.spawnedNode.id, toPort: 'vfx_stage' as const }
    const b = { ...a, id: 'b', fromNode: spawned.spawnedNode.id, toNode: logic.id }
    expect(resolveConnectedWorkflowNodes({ ...spawned.workflow, edges: [...workflow.edges, a, b] }).activeNodes.map((node) => node.id)).not.toContain(logic.id)
  })
  it('editing a layer operation preserves existing camera modifiers and unrelated visibility', () => {
    const { project, workflow, logic, layers } = fixture()
    project.camera.dofEnabled = true; project.camera.shakeAmount = 4
    layers[1].visible = false
    const preview = evaluateNodeDraft(project, workflow, logic, logic)
    expect(preview.camera.dofEnabled).toBe(true)
    expect(preview.camera.shakeAmount).toBe(4)
    expect(preview.layers[1].visible).toBe(false)
  })
  it('BGM adjusts music without changing voice lip-sync or SFX', () => {
    const { project, logic } = fixture('logic-audio-bgm')
    project.audioTracks = [
      { id: 'voice', assetId: 'voice', volume: 1, offset: 0, characterRole: 'voice', lipSyncEnabled: true },
      { id: 'music', assetId: 'music', volume: 1, offset: 0, characterRole: 'bgm' },
      { id: 'sfx', assetId: 'sfx', volume: 1, offset: 0, characterRole: 'sfx' }
    ]
    const voice = structuredClone(project.audioTracks[0]), sfx = structuredClone(project.audioTracks[2])
    executeAudioLipSyncStage(project, logic, new Set(['bgm_envelope']), '', 1, () => true)
    expect(project.audioTracks[0]).toEqual(voice)
    expect(project.audioTracks[2]).toEqual(sfx)
    expect(project.audioTracks[1].fadeIn).toBe(0.6)
    expect(project.audioTracks[1].lipSyncEnabled).toBeUndefined()
  })
  it('applies an incoming modifier when wiring it from the entity dialog', () => {
    const { project, workflow, logic, entity, root } = fixture('logic-motion-drift')
    workflow.edges = workflow.edges.filter((edge) => edge.toNode !== logic.id)
    const fromScene = connectWorkflowPort(workflow, root.id, 'scene_ctx', logic.id, 'scene_ctx')
    project.workflow = fromScene
    const next = connectWorkflowPort(fromScene, logic.id, 'motion_stream', entity.id, 'motion_stream')
    const preview = evaluateNodeDraft(project, next, entity, entity)
    expect(preview.layers[0].motion?.type).toBe('drift')
    expect(preview.layers[1].motion?.enabled).not.toBe(true)
    expect(project.layers.every((layer) => !layer.motion?.enabled)).toBe(true)
  })
  it('disconnecting the last layer wire does not redirect an effect to the whole scene', () => {
    const { project, workflow, logic, entity, root } = fixture('logic-motion-drift')
    workflow.edges = workflow.edges.filter((edge) => edge.toNode !== logic.id)
    const fromScene = connectWorkflowPort(workflow, root.id, 'scene_ctx', logic.id, 'scene_ctx')
    const wired = connectWorkflowPort(fromScene, logic.id, 'motion_stream', entity.id, 'motion_stream')
    project.workflow = wired
    applyWorkflowToProject(project, wired)
    const detached = disconnectWorkflowEdge(wired, { fromNode: logic.id, toNode: entity.id })
    const operation = detached.nodes.find((item) => item.id === logic.id)!
    expect(resolveNodeTargetBinding(operation, project, detached).boundTargets).toEqual([])
    const preview = evaluateNodeDraft(project, detached, detached.nodes.find((item) => item.id === entity.id)!, entity)
    expect(preview.layers.every((layer) => !layer.motion?.enabled)).toBe(true)
  })
})
