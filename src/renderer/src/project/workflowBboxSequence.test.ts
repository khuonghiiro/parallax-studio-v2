import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { createImageLayer, createProject, createShot } from './factory'
import { findWorkflowContact } from './workflowBboxContact'
import { syncWorkflowV2Graph, attachLogicNodeToLayerV2, syncWorkflowV2NodeToProject, v2LayerNodeId, spawnTimedFollowupNodeV2 } from './workflowV2Engine'
import { applyCollisionNodeToProject } from './workflowV2PhysicsAndValidation'
import { bboxStepsForLayer, bboxStepNumber } from './workflowBboxSteps'

function fixture() {
  const project = createProject()
  project.comp.duration = 12
  const shot = createShot('Test'); project.shots.push(shot)
  const make = (id: string, x: number) => {
    const layer = createImageLayer({ id, name: id, kind: 'image', mime: 'image/png', width: 20, height: 20 }, project.comp, 0, shot.id)
    layer.transform.position.value = [x, 0, 0]
    layer.transform.scale.value = [1, 1, 1]
    layer.inPoint = 0; layer.outPoint = 12
    project.layers.push(layer)
    return layer
  }
  const a = make('a', -100), b = make('b', 100)
  return { project, a, b }
}

describe('BBox collision measures simultaneous real trajectories', () => {
  it('detects two moving layers and does not assume a static obstacle', () => {
    const { project, a, b } = fixture()
    a.transform.position.keyframes = [{ id: 'a0', t: 0, value: [-100, 0, 0], ease: 'linear' }, { id: 'a1', t: 2, value: [100, 0, 0], ease: 'linear' }]
    b.transform.position.keyframes = [{ id: 'b-bboxmot-other-p-0', t: 0, value: [100, 0, 0], ease: 'linear' }, { id: 'b-bboxmot-other-p-1', t: 2, value: [-100, 0, 0], ease: 'linear' }]
    expect(findWorkflowContact(project, a, b, 0, 2)?.time).toBeCloseTo(0.9, 2)
    b.transform.position.keyframes.forEach(k => { k.value[1] = 100 })
    expect(findWorkflowContact(project, a, b, 0, 2)).toBeNull()
  })
  it('rejects different depth, hidden layers, and contact outside the active range', () => {
    const { project, a, b } = fixture()
    b.transform.position.value = [-100, 0, 100]
    expect(findWorkflowContact(project, a, b, 0, 2)).toBeNull()
    b.transform.position.value[2] = 0
    b.inPoint = 3
    expect(findWorkflowContact(project, a, b, 0, 2)).toBeNull()
    b.inPoint = 0; b.visible = false
    expect(findWorkflowContact(project, a, b, 0, 2)).toBeNull()
  })
  it('sweeps fast crossings between samples', () => {
    const { project, a, b } = fixture()
    b.transform.position.value = [0, 0, 0]
    a.transform.position.keyframes = [{ id: 'a0', t: 0, value: [-10000, 0, 0], ease: 'linear' }, { id: 'a1', t: 0.001, value: [10000, 0, 0], ease: 'linear' }]
    expect(findWorkflowContact(project, a, b, 0, 0.001)?.time).toBeCloseTo(0.000499, 6)
  })
  it('keeps the legacy A-to-B approach when neither layer has a Motion path', () => {
    const { project, a, b } = fixture()
    const node = { id: 'legacy', type: 'physics_fx', enabled: true, params: { logicCategory: 'collision', targetLayerIds: [a.id, b.id], strikerLayerId: a.id, targetColliderLayerId: b.id, timeStart: 0, timeEnd: 2 } } as WorkflowNode
    applyCollisionNodeToProject(project, undefined, node)
    expect(a.transform.position.keyframes.some(k => k.id.startsWith('wfcol:legacy:'))).toBe(true)
    expect(b.physics?.impacts).toHaveLength(1)
    const time = b.physics!.impacts![0].time
    expect(time).toBeGreaterThan(0)
    expect(Math.abs(evaluate(a.transform.position, time)[0] - evaluate(b.transform.position, time)[0])).toBeLessThanOrEqual(20.1)
    const first = JSON.stringify(a.transform)
    applyCollisionNodeToProject(project, undefined, node)
    expect(JSON.stringify(a.transform)).toBe(first)
  })

  it('clears stale impacts when trajectories stop intersecting, without rewriting motion keys', () => {
    const { project, a, b } = fixture()
    b.transform.position.value = [-100, 0, 0]
    const node = { id: 'collision', type: 'physics_fx', enabled: true, params: { logicCategory: 'collision', targetLayerIds: [a.id, b.id], strikerLayerId: a.id, targetColliderLayerId: b.id, timeStart: 0, timeEnd: 2 } } as WorkflowNode
    applyCollisionNodeToProject(project, undefined, node)
    expect(b.physics?.impacts?.[0].time).toBe(0)
    expect(a.transform.position.keyframes).toHaveLength(0)
    b.transform.position.value = [300, 0, 0]
    a.transform.position.keyframes = [{ id: 'a-bboxmot-test-p-0', t: 0, value: [-100, 0, 0], ease: 'linear' }, { id: 'a-bboxmot-test-p-1', t: 2, value: [-50, 0, 0], ease: 'linear' }]
    applyCollisionNodeToProject(project, undefined, node)
    expect(b.physics?.impacts).toHaveLength(0)
  })
})

describe('BBox follow-up continuity', () => {
  it('inherits position/scale, preserves history, updates downstream and remains idempotent', () => {
    const { project, a } = fixture()
    project.workflow = syncWorkflowV2Graph(project)
    const first = attachLogicNodeToLayerV2(project.workflow, v2LayerNodeId(a.id), 'action', 'v2:action:bbox_target',
      { timeStart: 0, timeEnd: 2, bboxTargetX: 100, bboxTargetY: 0, bboxTargetScalePct: 150, depthMode: 'flat_2d' })
    project.workflow = first.workflow
    const n1 = project.workflow.nodes.find(n => n.id === first.createdNodeId)!
    syncWorkflowV2NodeToProject(project, n1)
    const next = spawnTimedFollowupNodeV2(project.workflow, n1.id, 2)!
    project.workflow = next.workflow
    const n2 = project.workflow.nodes.find(n => n.id === next.createdNodeId)!
    expect(n2.params?.targetLayerIds).toContain(a.id)
    expect(n2.params?.bboxTargetX).toBe(380)
    expect(bboxStepNumber(project.workflow, n2.id)).toBe(2)
    syncWorkflowV2NodeToProject(project, n2, { bboxTargetX: 300 })
    expect(evaluate(a.transform.position, 1)[0]).toBeCloseTo(0)
    expect(evaluate(a.transform.position, 2)[0]).toBeCloseTo(100)
    expect(evaluate(a.transform.position, 4)[0]).toBeCloseTo(300)
    expect(evaluate(a.transform.scale, 4)[0]).toBeCloseTo(1.5)
    syncWorkflowV2NodeToProject(project, n1, { bboxTargetX: 150 })
    expect(evaluate(a.transform.position, 2)[0]).toBeCloseTo(150)
    const before = JSON.stringify(a.transform)
    syncWorkflowV2NodeToProject(project, project.workflow.nodes.find(n => n.id === n2.id)!)
    expect(JSON.stringify(a.transform)).toBe(before)
    const third = spawnTimedFollowupNodeV2(project.workflow, n2.id, 2)!
    project.workflow = third.workflow
    const n3 = project.workflow.nodes.find(n => n.id === third.createdNodeId)!
    syncWorkflowV2NodeToProject(project, n3, { bboxTargetX: 500 })
    const steps = bboxStepsForLayer(project.workflow, a.id)
    expect(steps.map(s => s.number)).toEqual([1, 2, 3])
    expect(steps.map(s => s.timing.timeStart)).toEqual([0, 2, 4])
    expect(bboxStepsForLayer(project.workflow, 'unrelated-layer')).toEqual([])
    syncWorkflowV2NodeToProject(project, project.workflow.nodes.find(n => n.id === n2.id)!, { bboxTargetX: 350 })
    expect(evaluate(a.transform.position, 4)[0]).toBeCloseTo(350)
    expect(evaluate(a.transform.position, 6)[0]).toBeCloseTo(500)
  })
})
