import { describe, expect, it } from 'vitest'
import type { PlantSpine } from '@shared/plantSpine'
import { deformPlantSpines, evaluatePlantSpine, plantBendAngle, resamplePolyline, spinesForLayer } from './plantSpine'

const spine = (patch: Partial<PlantSpine> = {}): PlantSpine => ({
  id: 's1',
  name: 'Thân cây',
  points: [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 0, y: -100 }],
  layerIds: ['tree'],
  amplitude: 20,
  speed: 1,
  stiffness: 0,
  flexibility: 0,
  turbulence: 0,
  ...patch
})

const binding = { x: 0, y: 0, rotation: 0, scale: 1 }
/** Mesh cục bộ Y-up: đỉnh (0,-100) local = (0,100) composite (gốc), (0,100) local = ngọn. */
const mesh = new Float32Array([0, -100, 0, 0, 0, 0, 0, 100, 0, 30, 100, 0, 0, -140, 0])

describe('plantSpine engine', () => {
  it('resamples a hand-drawn stroke into evenly spaced points', () => {
    const pts = resamplePolyline([{ x: 0, y: 0 }, { x: 0, y: -90 }, { x: 0, y: -100 }], 10)
    expect(pts).toHaveLength(11)
    expect(pts[5].y).toBeCloseTo(-50, 5)
  })

  it('stays at rest at t=0 and bends most at the tip', () => {
    const s = spine()
    expect(plantBendAngle(s, 1, 0)).toBe(0)
    const t = 0.25 // sin(2π·0.25) = 1 → uốn cực đại
    expect(plantBendAngle(s, 1, t)).toBeCloseTo(20, 5)
    expect(Math.abs(plantBendAngle(s, 0.5, t))).toBeLessThan(20)
    expect(plantBendAngle(s, 0, t)).toBe(0)
  })

  it('stiffer stems bend less in the middle', () => {
    const soft = plantBendAngle(spine({ stiffness: 0 }), 0.5, 0.25)
    const stiff = plantBendAngle(spine({ stiffness: 1 }), 0.5, 0.25)
    expect(stiff).toBeLessThan(soft)
  })

  it('keeps the root fixed and moves the tip sideways when bent', () => {
    const frame = evaluatePlantSpine(spine(), 0.25)
    expect(frame.bent[0]).toEqual({ x: 0, y: 100 })
    const tip = frame.bent[frame.bent.length - 1]
    expect(tip.x).toBeGreaterThan(20) // góc dương (Y hướng xuống) xoay ngọn đang hướng lên sang phải
    expect(Math.hypot(tip.x, tip.y - 100)).toBeLessThanOrEqual(200.5) // không bị giãn dài
  })

  it('deforms mesh vertices: root and below stay still, tip and canopy above follow', () => {
    const out = deformPlantSpines(mesh, binding, [spine()], 0.25)
    expect(out[0]).toBeCloseTo(0, 5) // gốc
    expect(out[1]).toBeCloseTo(-100, 5)
    expect(out[6]).not.toBeCloseTo(0, 1) // ngọn dời ngang
    expect(out[12]).toBeCloseTo(0, 5) // dưới gốc (rễ) đứng yên
    expect(out[13]).toBeCloseTo(-140, 5)
    expect(deformPlantSpines(mesh, binding, [spine()], 0)).toEqual(mesh)
  })

  it('limits deformation to the reach radius', () => {
    const near = deformPlantSpines(mesh, binding, [spine({ reach: 20 })], 0.25)
    expect(near[9]).toBeCloseTo(30, 5) // đỉnh cách xương 30px > reach → đứng yên
    expect(near[6]).not.toBeCloseTo(0, 1)
  })

  it('selects only enabled spines bound to the layer', () => {
    const list = [spine(), spine({ id: 's2', enabled: false }), spine({ id: 's3', layerIds: ['grass'] })]
    expect(spinesForLayer(list, 'tree').map((s) => s.id)).toEqual(['s1'])
  })
})
