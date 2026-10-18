import { describe, expect, it } from 'vitest'
import type { LayerComposite } from './types'
import {
  applyPlantSpineAction,
  buildAutoPlantSpinePoints,
  createPlantSpine,
  prunePlantSpines,
  resamplePlantSpinePoints,
  resolveSpineLayerIds,
  simplifyStroke,
  subdividePlantSpine
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

  it('tự động chia đều các khớp uốn khi vẽ đường thẳng dài', () => {
    // Đoạn thẳng dài 240px: không có điểm uốn cong, nhưng cần tự sinh ~4-5 khớp uốn cách nhau ~60px
    const straight = Array.from({ length: 25 }, (_, i) => ({ x: 0, y: 240 - i * 10 }))
    const out = simplifyStroke(straight)
    expect(out.length).toBeGreaterThanOrEqual(4)
    expect(out[0]).toEqual({ x: 0, y: 240 })
    expect(out.at(-1)!).toEqual({ x: 0, y: 0 })
    for (let i = 1; i < out.length; i++) {
      const dist = Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)
      expect(dist).toBeLessThanOrEqual(65)
    }
  })

  it('subdividePlantSpine nhân đôi số khớp uốn đều đặn', () => {
    const pts = [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 0, y: -100 }]
    const subdivided = subdividePlantSpine(pts)
    expect(subdivided).toHaveLength(5)
    expect(subdivided[1]).toEqual({ x: 0, y: 50 })
    expect(subdivided[3]).toEqual({ x: 0, y: -50 })
  })

  it('resamplePlantSpinePoints phân bố lại các khớp uốn cách đều nhau', () => {
    const pts = [{ x: 0, y: 200 }, { x: 0, y: 150 }, { x: 0, y: 0 }]
    const resampled = resamplePlantSpinePoints(pts, 50)
    expect(resampled.length).toBeGreaterThanOrEqual(4)
    expect(resampled[0]).toEqual({ x: 0, y: 200 })
    expect(resampled.at(-1)!).toEqual({ x: 0, y: 0 })
  })

  it('builds a valid 4-point vertical spine from root to tip automatically', () => {
    const c = composite()
    const pts = buildAutoPlantSpinePoints(c, ['trunk'])
    expect(pts).toHaveLength(4)
    expect(pts[0].y).toBeGreaterThan(pts[3].y)
    const spine = createPlantSpine({ points: pts, layerIds: ['trunk'] })
    const next = applyPlantSpineAction(c, { action: 'add', spine })
    expect(next.plantSpines).toHaveLength(1)
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
