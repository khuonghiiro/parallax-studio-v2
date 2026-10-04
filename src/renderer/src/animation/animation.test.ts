import { describe, expect, it } from 'vitest'
import type { Animatable, Vec3 } from '@shared/types'
import { cubicBezier, ease } from './easing'
import { addKeyframe, anim, evaluate, moveKeyframe, removeKeyframe, setValueAt, toggleAnimated } from './keyframes'
import { autoScaleFactor, formatTimecode, mulberry32, referenceDistance } from './math'
import { parseDirectionAngle } from '../engine/evaluateScene'

describe('easing', () => {
  it('linear bezier is identity', () => {
    const f = cubicBezier(0, 0, 1, 1)
    for (const x of [0, 0.1, 0.5, 0.9, 1]) expect(f(x)).toBeCloseTo(x, 4)
  })
  it('easeInOut is symmetric and monotonic', () => {
    expect(ease('easeInOut', 0.5)).toBeCloseTo(0.5, 4)
    expect(ease('easeInOut', 0.25) + ease('easeInOut', 0.75)).toBeCloseTo(1, 4)
    let prev = 0
    for (let i = 1; i <= 20; i++) {
      const v = ease('easeInOut', i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('hold stays at 0 until the end', () => {
    expect(ease('hold', 0.99)).toBe(0)
    expect(ease('hold', 1)).toBe(1)
  })
})

describe('keyframes', () => {
  it('static property returns its value', () => {
    expect(evaluate(anim(5), 3)).toBe(5)
  })

  it('interpolates numbers linearly and clamps outside range', () => {
    const a: Animatable<number> = anim(0)
    addKeyframe(a, 1, 10, 'linear')
    addKeyframe(a, 3, 30, 'linear')
    expect(evaluate(a, 0)).toBe(10)
    expect(evaluate(a, 2)).toBeCloseTo(20)
    expect(evaluate(a, 5)).toBe(30)
  })

  it('interpolates vectors', () => {
    const a: Animatable<Vec3> = anim([0, 0, 0] as Vec3)
    addKeyframe(a, 0, [0, 0, 0], 'linear')
    addKeyframe(a, 2, [10, 20, -40], 'linear')
    expect(evaluate(a, 1)).toEqual([5, 10, -20])
  })

  it('keeps keyframes sorted and supports many segments', () => {
    const a = anim(0)
    addKeyframe(a, 4, 40, 'linear')
    addKeyframe(a, 0, 0, 'linear')
    addKeyframe(a, 2, 20, 'linear')
    expect(a.keyframes.map((k) => k.t)).toEqual([0, 2, 4])
    expect(evaluate(a, 3)).toBeCloseTo(30)
  })

  it('setValueAt writes static value or keyframe', () => {
    const a = anim(1)
    setValueAt(a, 2, 7, 0.01)
    expect(a.value).toBe(7)
    expect(a.keyframes).toHaveLength(0)
    toggleAnimated(a, 0)
    setValueAt(a, 2, 9, 0.01)
    expect(a.keyframes).toHaveLength(2)
    setValueAt(a, 2.005, 11, 0.01)
    expect(a.keyframes).toHaveLength(2)
    expect(evaluate(a, 2)).toBe(11)
  })

  it('toggleAnimated off bakes current value', () => {
    const a = anim(0)
    addKeyframe(a, 0, 0, 'linear')
    addKeyframe(a, 2, 10, 'linear')
    toggleAnimated(a, 1)
    expect(a.keyframes).toHaveLength(0)
    expect(a.value).toBeCloseTo(5)
  })

  it('move and remove keyframes', () => {
    const a = anim(0)
    const k1 = addKeyframe(a, 0, 0, 'linear')
    const k2 = addKeyframe(a, 1, 10, 'linear')
    moveKeyframe(a, k1.id, 2)
    expect(a.keyframes[0].id).toBe(k2.id)
    removeKeyframe(a, k2.id)
    removeKeyframe(a, k1.id)
    expect(a.keyframes).toHaveLength(0)
    expect(a.value).toBe(0)
  })
})

describe('math', () => {
  it('auto-scale is 1 at z=0 and grows with depth', () => {
    const comp = { height: 1080 }
    expect(autoScaleFactor(0, comp)).toBeCloseTo(1)
    const d = referenceDistance(comp)
    expect(autoScaleFactor(d, comp)).toBeCloseTo(2)
  })
  it('PRNG is deterministic', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
  it('formats timecode', () => {
    expect(formatTimecode(61.5, 30)).toBe('01:01:15')
  })
})

describe('directional drift & angles', () => {
  it('parses directional angles and presets correctly', () => {
    expect(parseDirectionAngle('right')).toBe(0)
    expect(parseDirectionAngle('up-right')).toBe(45)
    expect(parseDirectionAngle('up')).toBe(90)
    expect(parseDirectionAngle('up-left')).toBe(135)
    expect(parseDirectionAngle('left')).toBe(180)
    expect(parseDirectionAngle('down-left')).toBe(225)
    expect(parseDirectionAngle('down')).toBe(270)
    expect(parseDirectionAngle('down-right')).toBe(315)
    expect(parseDirectionAngle(60)).toBe(60)
    expect(parseDirectionAngle(420)).toBe(60)
    expect(parseDirectionAngle(-90)).toBe(270)
  })

  it('computes seamless toroidal UV wrap for drift without jumping layer coordinates', async () => {
    const { createProject, createSolidLayer } = await import('../project/factory')
    const { evaluateScene } = await import('../engine/evaluateScene')

    const proj = createProject()
    const layer = createSolidLayer(proj.comp)
    layer.name = 'Drifting Portal'
    layer.motion = {
      type: 'drift',
      speed: 100,
      direction: 'right',
      loopMode: 'uv',
      amplitude: [0, 0, 0]
    }
    proj.layers.push(layer)

    const frame0 = evaluateScene(proj, 0)
    const frame1 = evaluateScene(proj, 1)
    const frame2 = evaluateScene(proj, 2)

    const el0 = frame0.layers[0]
    const el1 = frame1.layers[0]
    const el2 = frame2.layers[0]

    // Plane position in 3D space does NOT teleport or jump
    expect(el0.position).toEqual([0, 0, 1000])
    expect(el1.position).toEqual(el0.position)
    expect(el2.position).toEqual(el0.position)

    // UV offsets progress monotonically along the drift vector (Offset effect)
    expect(el0.uvOffset).toBeDefined()
    expect(el1.uvOffset).toBeDefined()
    expect(el2.uvOffset).toBeDefined()

    expect(el1.uvOffset![0]).toBeLessThan(el0.uvOffset![0])
    expect(el2.uvOffset![0]).toBeLessThan(el1.uvOffset![0])
  })
})
