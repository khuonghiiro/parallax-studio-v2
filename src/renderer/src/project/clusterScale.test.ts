import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject } from './factory'
import { scaleClusterAroundRoot } from './workflowV2ClusterRigAndSwap'
import { evaluate } from '../animation/keyframes'
import { scaleClusterFromSnapshot } from './clusterTransform'
import { bakeBboxTargetMotionToScene } from './workflowV2BboxMotionAndCollision'

describe('assembled cluster scale', () => {
  it('scales animated part spacing and the assembly origin with the part sizes', () => {
    const project = createProject()
    const asset = { id: 'part', name: 'part', kind: 'image' as const, width: 100, height: 100, mime: 'image/png' }
    const members = [createImageLayer(asset, project.comp), createImageLayer(asset, project.comp)]
    members.forEach((layer, i) => {
      layer.transform.position.value = [100 + i * 100, 50, 10]
      layer.transform.position.keyframes = [0, 1].map(t => ({ id: `rig-${i}-${t}`, t, value: [100 + i * 100, 50 + t * 20, 10], ease: 'linear' }))
      layer.composite = { instanceId: 'cluster', compositeId: 'template', compositeName: 'Character', isRoot: i === 0, lockedGroup: true, centerPosition: [80, 40, 0], rootOffset: [20 + i * 100, 10, 10], sourceLayerId: `part-${i}` }
    })
    scaleClusterAroundRoot(members, 25)
    const a = evaluate(members[0].transform.position, 0.5)
    const b = evaluate(members[1].transform.position, 0.5)
    expect(b[0] - a[0]).toBeCloseTo(25)
    expect(members[0].composite!.rootOffset).toEqual([5, 2.5, 2.5])
    for (const layer of members) {
      const c = layer.composite!
      expect(c.centerPosition!.map((v, axis) => v + c.rootOffset![axis])).toEqual(layer.transform.position.value)
    }
  })

  it('preserves relative geometry when a viewport drag is rebaked by Motion', () => {
    const project = createProject()
    const asset = { id: 'part', name: 'part', kind: 'image' as const, width: 100, height: 100, mime: 'image/png' }
    project.layers = [createImageLayer(asset, project.comp), createImageLayer(asset, project.comp)]
    project.layers.forEach((layer, i) => {
      layer.transform.position.value = [100 + i * 120, 60 + i * 40, 0]
      layer.transform.scale.value = [i ? -0.8 : 1, 1, 1]
      layer.composite = { instanceId: 'cluster', compositeId: 'template', compositeName: 'Character', isRoot: i === 0, lockedGroup: true, centerPosition: [100, 60, 0], rootOffset: [i * 120, i * 40, 0], sourceLayerId: `part-${i}` }
    })
    const source = structuredClone(project.layers)
    // Pointer move events all use the original snapshot, not the previous move.
    scaleClusterFromSnapshot(project.layers, source, [150, 80, 0], 3)
    scaleClusterFromSnapshot(project.layers, source, [150, 80, 0], 0.25)
    expect(project.layers[1].transform.scale.value[0]).toBe(-0.2)
    bakeBboxTargetMotionToScene(project, [project.layers[0].id], {
      instanceId: 'cluster', motionMode: 'bbox', timeStart: 0, timeEnd: 2,
      bboxTargetX: 400, bboxTargetY: 100, bboxTargetScalePct: 140
    }, 'motion')
    for (const [time, factor] of [[0, 0.25], [2, 0.35]]) {
      const [a, b] = project.layers.map(l => evaluate(l.transform.position, time))
      expect(b[0] - a[0]).toBeCloseTo(120 * factor)
      expect(b[1] - a[1]).toBeCloseTo(40 * factor)
      expect(evaluate(project.layers[0].transform.scale, time)[0]).toBeCloseTo(factor)
    }
  })
})
