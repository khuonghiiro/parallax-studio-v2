import { describe, expect, it } from 'vitest'
import type { PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import { plantMotionRange, samplePlantMotion, validatePlantMotion } from './plantMotion'
import { plantBendAngle, plantEnvelope } from './plantSpine'

const motion: PlantSpineMotion = {
  duration: 2,
  keys: [{ t: 0, angle: 0 }, { t: 0.5, angle: 20 }, { t: 1, angle: 0 }, { t: 1.5, angle: -20 }]
}

const spine = (patch: Partial<PlantSpine> = {}): PlantSpine => ({
  id: 's', name: 's', points: [{ x: 0, y: 0 }, { x: 0, y: -100 }], layerIds: ['a'],
  amplitude: 10, speed: 1, stiffness: 0, flexibility: 0, turbulence: 0, ...patch
})

describe('samplePlantMotion', () => {
  it('đi qua đúng các mốc và lặp tuần hoàn', () => {
    expect(samplePlantMotion(motion, 0)).toBeCloseTo(0)
    expect(samplePlantMotion(motion, 0.5)).toBeCloseTo(20)
    expect(samplePlantMotion(motion, 1.5)).toBeCloseTo(-20)
    expect(samplePlantMotion(motion, 2.5)).toBeCloseTo(20)
    expect(samplePlantMotion(motion, -1.5)).toBeCloseTo(20)
  })

  it('liền mạch tại điểm nối vòng lặp (mốc cuối → mốc đầu)', () => {
    const a = samplePlantMotion(motion, 1.999)
    const b = samplePlantMotion(motion, 2.001)
    expect(Math.abs(a - b)).toBeLessThan(0.2)
  })

  it('khoảng min/max bao trọn các mốc', () => {
    const r = plantMotionRange(motion)
    expect(r.max).toBeGreaterThanOrEqual(19.5)
    expect(r.min).toBeLessThanOrEqual(-19.5)
  })
})

describe('validatePlantMotion', () => {
  it('chấp nhận bản ghi hợp lệ', () => {
    expect(() => validatePlantMotion(motion)).not.toThrow()
  })
  it('từ chối mốc không tăng dần, nằm ngoài chu kỳ hoặc góc quá lớn', () => {
    expect(() => validatePlantMotion({ ...motion, keys: [{ t: 0, angle: 0 }, { t: 0, angle: 1 }] })).toThrow()
    expect(() => validatePlantMotion({ ...motion, keys: [{ t: 0, angle: 0 }, { t: 2.5, angle: 1 }] })).toThrow()
    expect(() => validatePlantMotion({ ...motion, keys: [{ t: 0, angle: 0 }, { t: 1, angle: 500 }] })).toThrow()
    expect(() => validatePlantMotion({ ...motion, speed: 99 })).toThrow()
  })
})

describe('plantBendAngle với chuyển động vẽ tay', () => {
  it('thay sóng gió bằng góc đã ghi (gốc đứng yên, ngọn theo bản ghi)', () => {
    const s = spine({ motion })
    expect(plantBendAngle(s, 0, 0.5)).toBe(0)
    expect(plantBendAngle(s, 1, 0.5)).toBeCloseTo(20 * plantEnvelope(0, 1))
  })

  it('ngọn trễ nhịp theo lag và tốc độ phát theo speed', () => {
    const lagged = spine({ motion: { ...motion, lag: 0.5 } })
    expect(plantBendAngle(lagged, 1, 1)).toBeCloseTo(20)
    const fast = spine({ motion: { ...motion, speed: 2 } })
    expect(plantBendAngle(fast, 1, 0.25)).toBeCloseTo(20)
  })

  it('trộn gió chồng lên bản ghi khi windMix > 0', () => {
    const t = 0.25
    const pure = plantBendAngle(spine({ motion }), 1, t)
    const mixed = plantBendAngle(spine({ motion: { ...motion, windMix: 1 } }), 1, t)
    expect(mixed - pure).toBeCloseTo(10, 4)
  })
})
