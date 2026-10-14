import { describe, expect, it } from 'vitest'
import type { LayerComposite } from './types'
import {
  applyPlantSpineAction,
  createPlantSpine,
  prunePlantSpines,
  resolveSpineLayerIds,
  simplifyStroke
} from './workshopPlantSpines'

const layer = (id: string, hidden = false) => ({
  id, name: id, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, hidden,
  motion: { type: 'sway' as const, speed: 1, amplitude: 4, anchor: 'bottom' as const }
})

const composite = (): LayerComposite => ({
  id: 'c', name: 'Cây', category: 'nature', width: 400, height: 400,
  layers: [layer('trunk'), layer('leaves'), layer('ghost', true)]
})

const stem = [{ x: 0, y: 150 }, { x: 5, y: 50 }, { x: -3, y: -60 }]

describe('workshop plant spines', () => {
  it('simplifies a jittery stroke but keeps its ends', () => {
    const jitter = Array.from({ length: 50 }, (_, i) => ({ x: (i % 2) * 0.8, y: 150 - i * 4 }))
    const out = simplifyStroke(jitter)
    expect(out.length).toBeLessThan(6)
    expect(out[0]).toEqual({ x: 0, y: 150 })
    expect(out.at(-1)!.y).toBe(150 - 49 * 4)
  })

  it('binds to selected layers, or all layers including hidden seasonal variants', () => {
    const c = composite()
    expect(resolveSpineLayerIds(c, 'selected', ['leaves'])).toEqual(['leaves'])
    expect(resolveSpineLayerIds(c, 'selected', [])).toEqual(['trunk', 'leaves', 'ghost'])
    expect(resolveSpineLayerIds(c, 'all', ['leaves'])).toEqual(['trunk', 'leaves', 'ghost'])
  })

  it('adds a spine from a preset and mutes the legacy sway of bound layers', () => {
    const spine = createPlantSpine({ points: stem, layerIds: ['trunk'], preset: 'grass', id: 's1' })
    expect(spine.amplitude).toBe(16)
    const next = applyPlantSpineAction(composite(), { action: 'add', spine })
    expect(next.plantSpines).toHaveLength(1)
    expect(next.layers.find((l) => l.id === 'trunk')!.motion.type).toBe('none')
    expect(next.layers.find((l) => l.id === 'leaves')!.motion.type).toBe('sway')
  })

  it('rejects invalid spines', () => {
    const c = composite()
    const tooShort = createPlantSpine({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], layerIds: ['trunk'] })
    expect(() => applyPlantSpineAction(c, { action: 'add', spine: tooShort })).toThrow()
    const unknown = createPlantSpine({ points: stem, layerIds: ['nope'] })
    expect(() => applyPlantSpineAction(c, { action: 'add', spine: unknown })).toThrow()
  })

  it('updates, deletes and prunes spines', () => {
    const spine = createPlantSpine({ points: stem, layerIds: ['trunk'], id: 's1' })
    let c = applyPlantSpineAction(composite(), { action: 'add', spine })
    c = applyPlantSpineAction(c, { action: 'update', id: 's1', patch: { amplitude: 30, layerIds: ['trunk', 'leaves'] } })
    expect(c.plantSpines![0].amplitude).toBe(30)
    expect(c.layers.find((l) => l.id === 'leaves')!.motion.type).toBe('none')
    const pruned = prunePlantSpines({ ...c, layers: c.layers.filter((l) => l.id !== 'trunk') })
    expect(pruned.plantSpines![0].layerIds).toEqual(['leaves'])
    expect(applyPlantSpineAction(c, { action: 'delete', id: 's1' }).plantSpines).toEqual([])
    expect(() => applyPlantSpineAction(c, { action: 'delete', id: 'x' })).toThrow()
  })
})
