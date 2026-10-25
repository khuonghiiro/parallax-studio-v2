import { describe, expect, it } from 'vitest'
import type { PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { balancePlantMotion, insertPlantKey, movePlantKey, removePlantKey, simplifyPlantMotion, smoothPlantMotion } from './plantMotionEdit'
import { applyPlantSpineAction } from './workshopPlantSpines'
import { samplePlantMotion, validatePlantMotion } from '../../engine/plantMotion'

const motion = (): PlantSpineMotion => ({
  keys: [{ t: 0, angle: 0 }, { t: 0.5, angle: 10 }, { t: 1, angle: 0 }, { t: 1.5, angle: -10 }],
  duration: 2
})

describe('chỉnh đồ thị nhịp motion', () => {
  it('thêm mốc giữ nguyên dáng đường cong, xoá mốc giữ tối thiểu 2', () => {
    const m = motion()
    const res = insertPlantKey(m, 0.25)
    expect(res.motion.keys).toHaveLength(5)
    expect(res.motion.keys[res.index].angle).toBeCloseTo(samplePlantMotion(m, 0.25), 1)
    expect(insertPlantKey(m, 0.5).motion).toBe(m)
    let small: PlantSpineMotion = { keys: [{ t: 0, angle: 0 }, { t: 1, angle: 5 }], duration: 2 }
    small = removePlantKey(small, 0)
    expect(small.keys).toHaveLength(2)
    expect(removePlantKey(m, 1).keys).toHaveLength(3)
  })

  it('kéo mốc theo 2 chiều nhưng không vượt mốc lân cận', () => {
    const m = movePlantKey(motion(), 1, 5, 25)
    expect(m.keys[1].t).toBeCloseTo(0.98)
    expect(m.keys[1].angle).toBe(25)
    validatePlantMotion(m)
  })

  it('làm gọn bản ghi dày, làm mượt và cân đối trái – phải', () => {
    const dense: PlantSpineMotion = {
      keys: Array.from({ length: 120 }, (_, i) => ({ t: i / 60, angle: Math.sin((i / 60) * Math.PI) * 20 + (i % 2 ? 0.8 : -0.8) })),
      duration: 2
    }
    const s = simplifyPlantMotion(dense, 12)
    expect(s.keys.length).toBeLessThanOrEqual(12)
    validatePlantMotion(s)
    const noisy: PlantSpineMotion = { keys: Array.from({ length: 40 }, (_, i) => ({ t: i / 20, angle: 5 + (i % 2 ? 0.8 : -0.8) })), duration: 2 }
    const sm = smoothPlantMotion(noisy)
    expect(Math.max(...sm.keys.map((k) => Math.abs(k.angle - 5)))).toBeLessThan(0.05)
    const b = balancePlantMotion({ keys: [{ t: 0, angle: 0 }, { t: 0.4, angle: 18 }, { t: 1.6, angle: -3 }], duration: 2 })
    expect(b.keys.map((k) => [k.t, k.angle])).toEqual([[0, 0], [0.4, 18], [1, -0], [1.4, -18]])
    validatePlantMotion(b)
  })
})

const spine = (id: string, extra: Partial<PlantSpine> = {}): PlantSpine => ({
  id, name: id, points: [{ x: 0, y: 0 }, { x: 0, y: -100 }], layerIds: ['l'],
  amplitude: 10, speed: 0.8, stiffness: 0.3, flexibility: 0.4, turbulence: 0.2, ...extra
})

describe('so le nhịp & sao chép nhịp', () => {
  const comp = (): LayerComposite => ({
    id: 'c', name: 'C', category: 'nature', width: 400, height: 400,
    layers: [{ id: 'l', name: 'grass', x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' } }],
    plantSpines: [spine('a', { amplitude: 22, motion: motion() }), spine('b'), spine('c')]
  })

  it('so le lệch pha khác nhau, đồng bộ về 0', () => {
    const st = applyPlantSpineAction(comp(), { action: 'phase', mode: 'stagger', spread: 1.2 })
    const phases = st.plantSpines!.map((s) => s.phaseOffset)
    expect(new Set(phases).size).toBe(3)
    expect(phases.every((p) => p! >= 0 && p! <= 1.2)).toBe(true)
    const sy = applyPlantSpineAction(st, { action: 'phase', mode: 'sync' })
    expect(sy.plantSpines!.every((s) => s.phaseOffset === 0)).toBe(true)
  })

  it('sao chép nhịp + thông số gió sang xương khác kèm lệch pha', () => {
    const c = applyPlantSpineAction(comp(), { action: 'copy-motion', id: 'a', stagger: 0.35 })
    const [, b, cc] = c.plantSpines!
    expect(b.motion?.keys).toEqual(motion().keys)
    expect(b.amplitude).toBe(22)
    expect([b.phaseOffset, cc.phaseOffset]).toEqual([0.35, 0.7])
    expect(() => applyPlantSpineAction(comp(), { action: 'copy-motion', id: 'zzz' })).toThrow()
  })
})
