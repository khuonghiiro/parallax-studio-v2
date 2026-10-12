import { describe, expect, it } from 'vitest'
import { createProject, createSolidLayer, createShot } from '../project/factory'
import { addMotionEffect, effectMotion, listLayerEffects, migrateLayerMotion, sampleMotionEffects, updateMotionEffect } from './motionEffects'
import { sampleLayerMotion } from './proceduralMotion'
import { evaluateScene } from '../engine/evaluateScene'
import { exportProjectToJson, importProjectFromJson } from '../project/jsonFormat'
import { exportProjectToDeclarativeJson } from '../project/json/exportJson'

function fixture() {
  const project = createProject()
  const layer = createSolidLayer(project.comp)
  layer.autoScale = false
  const shot = createShot('Test')
  layer.shotId = shot.id
  project.shots = [shot]
  project.layers = [layer]
  return { project, layer }
}

describe('Motion effect stack', () => {
  it('composes concurrent effects while preserving Transform keys', () => {
    const { project, layer } = fixture()
    const transform = structuredClone(layer.transform)
    const a = addMotionEffect(layer, 'wind', 0, 4)
    const b = addMotionEffect(layer, 'wiggle', 0.5, 2)
    const c = addMotionEffect(layer, 'pulse', 0, 4)
    const sa = sampleLayerMotion(effectMotion(a), 1), sb = sampleLayerMotion(effectMotion(b), 1)
    const sc = sampleLayerMotion(effectMotion(c), 1)
    const evaluated = evaluateScene(project, 1).layers[0]
    expect(evaluated.position[0]).toBeCloseTo(transform.position.value[0] + sa.position[0] + sb.position[0])
    expect(evaluated.rotation[2]).toBeCloseTo(transform.rotation.value[2] + sa.rotation[2] + sb.rotation[2])
    expect(evaluated.scale[0]).toBeCloseTo(transform.scale.value[0] * sc.scale[0])
    expect(layer.transform).toEqual(transform)
    b.enabled = false
    expect(sampleMotionEffects(layer, 1, [100, 100]).position).toEqual(sa.position)
  })
  it('keeps old motion rendering identical through migration and migrates only once', () => {
    const { layer } = fixture()
    layer.motion = { type: 'wiggle', speed: 2, amplitude: [4, 8, 2], phase: 0.2 }
    const original = sampleMotionEffects(layer, 1.7, [100, 100])
    const virtual = listLayerEffects(layer)[0]
    expect(layer.appliedEffects).toBeUndefined()
    migrateLayerMotion(layer)
    migrateLayerMotion(layer)
    expect(layer.appliedEffects).toHaveLength(1)
    expect(layer.appliedEffects![0].id).toBe(virtual.id)
    expect(layer.motion).toBeUndefined()
    expect(sampleMotionEffects(layer, 1.7, [100, 100])).toEqual(original)
  })
  it('resets parameters without destroying clip timing or independent effects', () => {
    const { layer } = fixture()
    const a = addMotionEffect(layer, 'wind', 2, 5)
    const b = structuredClone(addMotionEffect(layer, 'float', 0, 8))
    a.enabled = false
    updateMotionEffect(layer, a.id, { speed: 8 })
    updateMotionEffect(layer, a.id, {}, true)
    expect(a.startTime).toBe(2)
    expect(a.duration).toBe(5)
    expect(a.enabled).toBe(false)
    expect(a.motion?.speed).toBe(0.6)
    expect(layer.appliedEffects![1]).toEqual(b)
  })
  it('preserves stacked effects in full and declarative JSON round trips', async () => {
    const { project, layer } = fixture()
    addMotionEffect(layer, 'wiggle', 1, 4)
    addMotionEffect(layer, 'float', 0, 0).enabled = false
    const full = await importProjectFromJson(await exportProjectToJson(project))
    const declarative = await importProjectFromJson(await exportProjectToDeclarativeJson(project))
    expect(full.layers[0].appliedEffects).toEqual(layer.appliedEffects)
    expect(declarative.layers[0].appliedEffects).toEqual(layer.appliedEffects)
  })
})
