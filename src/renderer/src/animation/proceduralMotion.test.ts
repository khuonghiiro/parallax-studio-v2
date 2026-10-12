import { describe, expect, it } from 'vitest'
import { defaultLayerMotion, motionEnvelope, patchLayerMotion, sampleLayerMotion } from './proceduralMotion'
import { createProject, createSolidLayer } from '../project/factory'
import { evaluateScene } from '../engine/evaluateScene'

describe('procedural Motion effect controls', () => {
  it('respects zero pulse amplitudes and zero frequency', () => {
    expect(sampleLayerMotion({ type: 'pulse', amplitude: [0, 0, 0] }, 0.37).scale).toEqual([1, 1, 1])
    const m = { ...defaultLayerMotion('wiggle'), speed: 0 }
    expect(sampleLayerMotion(m, 1)).toEqual(sampleLayerMotion(m, 9))
  })
  it('bypasses without changing the stored settings', () => {
    const m = { ...defaultLayerMotion('wind'), enabled: false }
    expect(sampleLayerMotion(m, 1)).toEqual(sampleLayerMotion(undefined, 1))
    expect(sampleLayerMotion({ ...m, enabled: true, amount: 0 }, 1)).toEqual(sampleLayerMotion(undefined, 1))
  })
  it('has smooth, bounded overlapping fades and exact start/end behavior', () => {
    const m = { ...defaultLayerMotion('float'), startTime: 2, duration: 4, fadeIn: 1, fadeOut: 1 }
    expect(motionEnvelope(m, 1)).toBe(0)
    expect(motionEnvelope(m, 2)).toBe(0)
    expect(motionEnvelope(m, 2.5)).toBe(0.5)
    expect(motionEnvelope(m, 4)).toBe(1)
    expect(motionEnvelope(m, 5.5)).toBe(0.5)
    expect(motionEnvelope(m, 6)).toBe(0)
    expect(motionEnvelope({ ...m, fadeIn: 10, fadeOut: 10 }, 4)).toBeGreaterThan(0)
    expect(sampleLayerMotion({ ...m, fadeIn: 0, fadeOut: 0 }, 3))
      .toEqual(sampleLayerMotion(defaultLayerMotion('float'), 1))
  })
  it('repeats seeded results independent of sampling order', () => {
    const m = { ...defaultLayerMotion('wiggle'), seed: 42 }
    const first = sampleLayerMotion(m, 1.25)
    sampleLayerMotion(m, 17)
    expect(sampleLayerMotion(m, 1.25)).toEqual(first)
    expect(sampleLayerMotion({ ...m, seed: 43 }, 1.25)).not.toEqual(first)
  })
  it('resets units on type changes and preserves partial edits', () => {
    const old = { ...defaultLayerMotion('drift'), speed: 80 }
    const pulse = patchLayerMotion(old, { type: 'pulse' })
    expect(pulse.amplitude).toEqual([0.05, 0.05, 0])
    expect(pulse.speed).toBe(0.5)
    expect(patchLayerMotion(old, { phase: 2 }).speed).toBe(80)
    expect(patchLayerMotion(old, {}, true).speed).toBe(40)
  })
  it('matches directional UV drift and applies amount to all offsets', () => {
    const m = { ...defaultLayerMotion('drift'), direction: 90, amplitude: [0, 0, 0] as [number, number, number], amount: 0.5 }
    const s = sampleLayerMotion(m, 2, [100, 200])
    expect(s.uvOffset![0]).toBeCloseTo(0)
    expect(s.uvOffset![1]).toBeCloseTo(-0.2)
    expect(s.position).toEqual([0, 0, 0])
  })
  it('uses the same sampler for evaluated scene transforms without mutating keys', () => {
    const project = createProject()
    const layer = createSolidLayer(project.comp)
    layer.autoScale = false
    layer.motion = { ...defaultLayerMotion('wiggle'), seed: 8, amount: 0.4 }
    project.layers = [layer]
    const original = JSON.stringify(project)
    const sample = sampleLayerMotion(layer.motion, 1)
    const evaluated = evaluateScene(project, 1).layers[0]
    expect(evaluated.position).toEqual(layer.transform.position.value.map((v, i) => v + sample.position[i]))
    expect(evaluated.rotation).toEqual(layer.transform.rotation.value.map((v, i) => v + sample.rotation[i]))
    expect(JSON.stringify(project)).toBe(original)
  })
})
