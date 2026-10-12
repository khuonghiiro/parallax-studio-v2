import { describe, expect, it } from 'vitest'
import { dragEffectTiming, retimeLayerEffect } from './effectTiming'
import { createProject, createSolidLayer } from '../project/factory'
import { addMotionEffect } from './motionEffects'
import { toggleLayerEffect } from '../ui/timeline/timelineEffects'

describe('effect timeline timing', () => {
  it('snaps movement to frames, clamps edges and preserves unlimited mode on move', () => {
    const effect = { startTime: 2, duration: 3 }
    expect(dragEffectTiming(effect, 8, 0.11, 'move', 30, 10).startTime).toBeCloseTo(2.1)
    expect(dragEffectTiming(effect, 8, 99, 'move', 30, 10)).toEqual({ startTime: 7, duration: 3 })
    expect(dragEffectTiming(effect, 8, -99, 'move', 30, 10)).toEqual({ startTime: 0, duration: 3 })
    expect(dragEffectTiming({ startTime: 0, duration: 0 }, 8, 2, 'move', 30, 10).duration).toBe(0)
    expect(dragEffectTiming(effect, 8, 99, 'in', 30, 10).duration).toBeCloseTo(1 / 30)
    expect(dragEffectTiming(effect, 8, -99, 'out', 30, 10).duration).toBeCloseTo(1 / 30)
  })
  it('retimes only keys owned by an effect, including disabled stashes', () => {
    const layer = createSolidLayer(createProject().comp)
    layer.transform.opacity.keyframes = [
      { id: 'a', t: 1, value: 0, ease: 'linear' }, { id: 'b', t: 3, value: 1, ease: 'linear' },
      { id: 'manual', t: 6, value: 0.5, ease: 'linear' }
    ]
    layer.appliedEffects = [{ id: 'fx', presetId: 'fadeIn', name: 'Fade', badge: '', category: 'opacity',
      startTime: 1, duration: 2, enabled: true, targetProp: 'opacity', keyframeIds: ['a', 'b'] }]
    toggleLayerEffect(layer, 'fx', false)
    retimeLayerEffect(layer, 'fx', { startTime: 2, duration: 4 })
    toggleLayerEffect(layer, 'fx', true)
    expect(layer.transform.opacity.keyframes.find((k) => k.id === 'a')?.t).toBe(2)
    expect(layer.transform.opacity.keyframes.find((k) => k.id === 'b')?.t).toBe(6)
    expect(layer.transform.opacity.keyframes.find((k) => k.id === 'manual')?.t).toBe(6)
  })
  it('retimes Motion independently and rejects invalid intervals', () => {
    const layer = createSolidLayer(createProject().comp)
    const fx = addMotionEffect(layer, 'wind', 0, 4)
    retimeLayerEffect(layer, fx.id, { startTime: 2, duration: 1 })
    expect(fx.startTime).toBe(2)
    expect(fx.duration).toBe(1)
    expect(() => retimeLayerEffect(layer, fx.id, { startTime: -1, duration: 2 })).toThrow()
  })
})
