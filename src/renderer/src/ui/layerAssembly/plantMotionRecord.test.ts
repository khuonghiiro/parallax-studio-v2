import { describe, expect, it } from 'vitest'
import type { PlantSpine } from '@shared/plantSpine'
import { samplePlantMotion, validatePlantMotion } from '../../engine/plantMotion'
import {
  buildPlantMotion,
  cleanSwaySamples,
  closeLoop,
  mirrorPlantMotion,
  reducePlantKeys,
  resolvePlantGrab,
  setPlantMotionKeyAngle,
  springTail,
  generateCustomPlantMotion,
  PLANT_CUSTOM_PATTERNS
} from './plantMotionRecord'

/** Mẫu nắm ngọn 60 Hz: đứng yên idle giây, rồi lắc sin biên độ amp, chu kỳ period trong dur giây. */
function gesture(idle: number, dur: number, amp = 20, period = 1) {
  const out: Array<{ t: number; angle: number }> = []
  for (let t = 0; t <= idle + dur + 1e-9; t += 1 / 60) {
    out.push({ t, angle: t < idle ? 0 : amp * Math.sin(((t - idle) / period) * Math.PI * 2) })
  }
  return out
}

const spine: PlantSpine = {
  id: 's', name: 's', points: [{ x: 0, y: 0 }, { x: 0, y: -100 }], layerIds: ['a'],
  amplitude: 8, speed: 0.6, stiffness: 0.3, flexibility: 0.3, turbulence: 0.2
}

describe('cleanSwaySamples', () => {
  it('cắt đoạn đứng yên đầu và dời thời gian về 0', () => {
    const clean = cleanSwaySamples(gesture(0.5, 1))
    expect(clean[0].t).toBe(0)
    expect(clean[clean.length - 1].t).toBeCloseTo(1, 1)
  })
})

describe('buildPlantMotion', () => {
  it('ghi đúng nhịp tay: chu kỳ ≈ thời gian vẽ, biên độ giữ nguyên, mốc gọn', () => {
    const m = buildPlantMotion(gesture(0.3, 2), { end: 'loop' })!
    expect(m).not.toBeNull()
    expect(m.duration).toBeGreaterThan(1.8)
    expect(m.duration).toBeLessThan(2.2)
    expect(Math.max(...m.keys.map((k) => k.angle))).toBeGreaterThan(17)
    expect(m.keys.length).toBeLessThan(60)
    expect(m.lag).toBe(0.08)
    expect(() => validatePlantMotion(m)).not.toThrow()
  })

  it('vòng lặp liền mạch: cuối chu kỳ khớp đầu chu kỳ', () => {
    const m = buildPlantMotion(gesture(0, 1.3, 25), { end: 'loop' })!
    const end = samplePlantMotion(m, m.duration - 0.001)
    const start = samplePlantMotion(m, 0)
    expect(Math.abs(end - start)).toBeLessThan(1.5)
  })

  it('nảy về khi thả: thêm đoạn dao động tắt dần về 0', () => {
    const pull = Array.from({ length: 31 }, (_, i) => ({ t: i / 60, angle: i }))
    const loop = buildPlantMotion(pull, { end: 'loop' })!
    const spring = buildPlantMotion(pull, { end: 'spring' })!
    expect(spring.duration).toBeGreaterThan(loop.duration + 0.5)
    expect(Math.abs(samplePlantMotion(spring, spring.duration * 0.98))).toBeLessThan(2)
  })

  it('giữ tuỳ chỉnh phát lại của bản ghi cũ khi ghi đè', () => {
    const m = buildPlantMotion(gesture(0, 1), { end: 'loop', keep: { speed: 1.5, lag: 0.3, windMix: 0.4 } })!
    expect(m.speed).toBe(1.5)
    expect(m.lag).toBe(0.3)
    expect(m.windMix).toBe(0.4)
  })

  it('bỏ qua cử chỉ quá ngắn hoặc gần như đứng yên', () => {
    expect(buildPlantMotion([{ t: 0, angle: 0 }, { t: 0.05, angle: 10 }], { end: 'loop' })).toBeNull()
    expect(buildPlantMotion(gesture(0, 1, 0.1), { end: 'loop' })).toBeNull()
  })
})

describe('tiện ích chỉnh bản ghi', () => {
  it('closeLoop kéo mẫu cuối về giá trị đầu', () => {
    const v = closeLoop([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(v[v.length - 1]).toBeCloseTo(0)
    expect(v[0]).toBe(0)
  })
  it('springTail tắt dần', () => {
    const tail = springTail(30)
    expect(Math.abs(tail[tail.length - 1])).toBeLessThan(1)
  })
  it('reducePlantKeys giữ đường thẳng chỉ còn 2 mốc', () => {
    const keys = Array.from({ length: 20 }, (_, i) => ({ t: i, angle: i * 2 }))
    expect(reducePlantKeys(keys, 0.1)).toHaveLength(2)
  })
  it('sửa mốc và lật chiều', () => {
    const m = { duration: 1, keys: [{ t: 0, angle: 5 }, { t: 0.5, angle: -5 }] }
    expect(setPlantMotionKeyAngle(m, 1, 12.345).keys[1].angle).toBe(12.35)
    expect(mirrorPlantMotion(m).keys[0].angle).toBe(-5)
  })
})

describe('resolvePlantGrab', () => {
  it('record → patch motion; learn → học thông số gió và xoá bản ghi', () => {
    const rec = resolvePlantGrab(gesture(0, 1.5), spine, { mode: 'record', end: 'loop' })!
    expect(rec.patch.motion?.keys.length).toBeGreaterThan(2)
    const learn = resolvePlantGrab(gesture(0, 2), { ...spine, motion: rec.patch.motion }, { mode: 'learn', end: 'loop' })!
    expect(learn.patch.amplitude).toBeGreaterThan(15)
    expect('motion' in learn.patch && learn.patch.motion === undefined).toBe(true)
  })
})

describe('generateCustomPlantMotion', () => {
  it('sinh chuyển động thực vật hợp lệ cho cả 5 kiểu nhịp tuỳ chỉnh', () => {
    for (const p of PLANT_CUSTOM_PATTERNS) {
      const m = generateCustomPlantMotion({
        pattern: p.id,
        leftAngle: -16,
        rightAngle: 20,
        duration: 2.2
      })
      expect(m.duration).toBe(2.2)
      expect(m.keys.length).toBeGreaterThanOrEqual(4)
      expect(() => validatePlantMotion(m)).not.toThrow()
    }
  })
})
