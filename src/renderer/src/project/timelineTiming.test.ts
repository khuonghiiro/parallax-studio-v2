import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import { moveTimelineLayers } from './timelineTiming'
import { connectTimeNode, createTimeNode } from './workflowTiming'
import { syncWorkflowV2Graph } from './workflowV2Sync'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { sampleLayerMotion } from '../animation/proceduralMotion'

function fixture() {
  const project = createProject()
  project.comp.duration = 20
  const shot = createShot('Timing')
  project.shots = [shot]
  project.layers = ['a', 'b'].map(id => {
    const layer = createImageLayer({ id, name: id, kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id)
    layer.inPoint = 2; layer.outPoint = 6
    return layer
  })
  project.workflow = syncWorkflowV2Graph(project)
  return project
}

describe('manual timeline clock movement', () => {
  it('preserves glow, legacy motion, impact, keyframe and linked audio clocks', () => {
    const project = fixture(), layer = project.layers[0]
    layer.motion = { type: 'float', speed: 0.5, amplitude: [5, 5, 0] }
    const sampled = sampleLayerMotion(layer.motion, 3)
    layer.transform.opacity.keyframes = [{ id: 'k', t: 3, value: 1, ease: 'linear' }]
    layer.appliedEffects = [{ id: 'glow', presetId: 'glow', name: 'Glow', badge: 'G', category: 'glow', startTime: 3, duration: 2, enabled: true, glow: { enabled: true, startTime: 3, duration: 2 } }]
    layer.physics = { enabled: true, material: 'flesh_body', impacts: [{ id: 'impact', time: 3, type: 'land', velocity: [0, 1, 0] }] }
    project.audioTracks = [{ id: 'voice', assetId: 'audio', offset: 3, volume: 1, targetType: 'layer', targetId: layer.id }]
    moveTimelineLayers(project, [layer.id], 4)
    expect(sampleLayerMotion(layer.motion, 7)).toEqual(sampled)
    expect(layer.transform.opacity.keyframes[0].t).toBe(7)
    expect(layer.appliedEffects[0].glow!.startTime).toBe(7)
    expect(layer.physics!.impacts![0].time).toBe(7)
    expect(project.audioTracks[0].offset).toBe(7)
    expect(project.layers[1].inPoint).toBe(2)
  })

  it('moves the whole Time group like linked clips; Alt-detach moves only the chosen consumer', () => {
    const project = fixture(), clock = createTimeNode(project)
    clock.params = { ...clock.params, timeStart: 2, timeEnd: 6 }
    project.workflow!.nodes.push(clock)
    const ids = project.layers.map(layer => `v2-layer-${layer.id}`)
    for (const id of ids) project.workflow = connectTimeNode(project.workflow!, clock.id, id)
    syncWorkflowV2NodeToProject(project, clock)
    moveTimelineLayers(project, [project.layers[0].id], 3)
    expect(project.workflow!.edges.filter(edge => edge.fromPort === 'time_range').map(edge => edge.toNode).sort()).toEqual([...ids].sort())
    expect(project.workflow!.nodes.find(n => n.id === clock.id)!.params?.timeStart).toBe(5)
    expect(project.layers.map(l => [l.inPoint, l.outPoint])).toEqual([[5, 9], [5, 9]])
    moveTimelineLayers(project, [project.layers[0].id], 2, 'shift', { detachLinked: true })
    expect(project.workflow!.edges.filter(edge => edge.fromPort === 'time_range').map(edge => edge.toNode)).toEqual([ids[1]])
    project.workflow = syncWorkflowV2Graph(project, project.workflow)
    const moved = project.workflow.nodes.find(node => node.id === ids[0])!
    syncWorkflowV2NodeToProject(project, moved)
    expect([project.layers[0].inPoint, project.layers[0].outPoint]).toEqual([7, 11])
    expect(project.layers[1].inPoint).toBe(5)
  })
})
