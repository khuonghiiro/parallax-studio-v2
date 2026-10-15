import { describe, it, expect } from 'vitest'
import type { PlantSpine } from '@shared/plantSpine'
import {
  insertPlantSpinePoint,
  learnSwayFromGesture,
  movePlantSpinePoint,
  pickLayersUnderStroke,
  removePlantSpinePoint,
  translatePlantSpine
} from './plantSpineEdit'
import { plantStaticPose, plantTipAngleToward } from '../../engine/plantSpine'

const spine = (patch: Partial<PlantSpine> = {}): PlantSpine => ({
  id: 's', name: 'Cây', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 0, y: -100 }], layerIds: ['a'],
  amplitude: 8, speed: 0.6, stiffness: 0.35, flexibility: 0.3, turbulence: 0.2, lean: 0, ...patch
})

/** Lắc qua lại dạng sin: biên độ amp quanh tâm center, tần số hz, trong khoảng seconds. */
const swing = (amp: number, center: number, hz: number, seconds: number) =>
  Array.from({ length: Math.round(seconds * 60) + 1 }, (_, i) => {
    const t = i / 60
    return { angle: center + amp * Math.sin(2 * Math.PI * hz * t), t }
  })

describe('plantSpineEdit', () => {
  it('sửa, chèn, xoá điểm và dời cả xương', () => {
    const pts = spine().points
    expect(movePlantSpinePoint(pts, 1, { x: 12.4, y: 3.6 })[1]).toEqual({ x: 12, y: 4 })
    const inserted = insertPlantSpinePoint(pts, { x: 3, y: 50 })
    expect(inserted).toHaveLength(4)
    expect(inserted[1]).toEqual({ x: 3, y: 50 })
    expect(removePlantSpinePoint(inserted, 1)).toEqual(pts)
    expect(removePlantSpinePoint([pts[0], pts[2]], 0)).toHaveLength(2)
    expect(translatePlantSpine(pts, 10, -5)[0]).toEqual({ x: 10, y: 95 })
  })

  it('kéo ngọn một phía rồi thả → chỉ đổi biên độ', () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({ angle: i, t: i / 30 }))
    expect(learnSwayFromGesture(samples, spine())).toEqual({ amplitude: 19 })
  })

  it('lắc qua lại → học biên độ, độ nghiêng và tốc độ theo nhịp tay', () => {
    const learned = learnSwayFromGesture(swing(12, 4, 1.5, 2.2), spine())
    expect(learned?.amplitude).toBeCloseTo(12, 0)
    expect(learned?.lean).toBeCloseTo(4, 0)
    expect(learned?.speed).toBeCloseTo(1.5, 1)
  })

  it('bỏ qua cử chỉ quá nhỏ (rung tay)', () => {
    expect(learnSwayFromGesture([{ angle: 0, t: 0 }, { angle: 0.2, t: 0.1 }], spine())).toBeNull()
  })

  it('chọn layer mà nét vẽ đi qua đủ nhiều', () => {
    const hits = [['trunk', 'ground'], ['trunk'], ['trunk', 'leaves'], ['leaves'], ['leaves']]
    expect(pickLayersUnderStroke(hits, ['ground', 'trunk', 'leaves'])).toEqual(['trunk', 'leaves'])
  })

  it('ngọn hướng về điểm kéo khớp với dáng uốn tĩnh', () => {
    const s = spine()
    const target = { x: 60, y: -80 }
    const angle = plantTipAngleToward(s, target)
    const tip = plantStaticPose(s, angle).at(-1)!
    const dir = (p: { x: number; y: number }) => Math.atan2(p.y - 100, p.x)
    expect(Math.abs(dir(tip) - dir(target))).toBeLessThan(0.08)
  })
})
