import { describe, expect, it } from 'vitest'
import { applyChromaKeyToImageData } from './loopChromaProcessor'
import type { ChromaKeyConfig } from './types'

const SIZE = 41
const CENTER = 20

/** Ảnh phông xanh #00ff00 có vòng tròn trắng đặc (bán kính 10–13px), ruột bên trong vẫn là nền xanh */
function makeRingImage(withGlow = false): ImageData {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      const d = Math.hypot(x - CENTER, y - CENTER)
      let rgb: [number, number, number] = [0, 255, 0]
      if (d >= 10 && d <= 13) rgb = [255, 255, 255]
      else if (withGlow && d > 13 && d <= 16) rgb = [120, 255, 120] // quầng sáng bán trong suốt ngoài viền
      data[i] = rgb[0]
      data[i + 1] = rgb[1]
      data[i + 2] = rgb[2]
      data[i + 3] = 255
    }
  }
  return { data, width: SIZE, height: SIZE } as unknown as ImageData
}

const alphaAt = (img: ImageData, x: number, y: number): number => img.data[(y * SIZE + x) * 4 + 3]

const baseChroma: ChromaKeyConfig = {
  enabled: true,
  keyColor: '#00ff00',
  similarity: 0.28,
  smoothness: 0.1,
  spill: 0.35,
  shadowMode: 'off'
}

describe('Loop chroma isolation scope (Tách toàn bộ / Chỉ nền ngoài)', () => {
  it('outer_only keeps the enclosed background inside the ring', () => {
    const img = makeRingImage()
    applyChromaKeyToImageData(img, { ...baseChroma, isolationMode: 'outer_only' })
    expect(alphaAt(img, 0, 0)).toBe(0) // nền ngoài bị xoá
    expect(alphaAt(img, CENTER + 11, CENTER)).toBe(255) // viền giữ nguyên
    expect(alphaAt(img, CENTER, CENTER)).toBe(255) // ruột vòng tròn giữ nguyên
  })

  it('all (default) removes background both inside and outside — only the ring stays', () => {
    const img = makeRingImage()
    applyChromaKeyToImageData(img, baseChroma)
    expect(alphaAt(img, 0, 0)).toBe(0)
    expect(alphaAt(img, CENTER, CENTER)).toBe(0)
    expect(alphaAt(img, CENTER + 11, CENTER)).toBe(255)
  })

  it('shadow include + outer_only keeps the inside and extracts the outer glow as semi-transparent', () => {
    const img = makeRingImage(true)
    applyChromaKeyToImageData(img, { ...baseChroma, isolationMode: 'outer_only', shadowMode: 'include' })
    expect(alphaAt(img, 0, 0)).toBe(0)
    expect(alphaAt(img, CENTER, CENTER)).toBe(255)
    const glowA = alphaAt(img, CENTER + 15, CENTER)
    expect(glowA).toBeGreaterThan(0)
    expect(glowA).toBeLessThan(255)
    // Color Unmixing khử ám xanh trên quầng sáng
    const gi = ((CENTER) * SIZE + CENTER + 15) * 4
    expect(img.data[gi + 1]).toBeLessThanOrEqual(Math.max(img.data[gi], img.data[gi + 2]) * 1.02 + 3)
  })

  it('shadow include + all removes the enclosed background too', () => {
    const img = makeRingImage(true)
    applyChromaKeyToImageData(img, { ...baseChroma, isolationMode: 'all', shadowMode: 'include' })
    expect(alphaAt(img, 0, 0)).toBe(0)
    expect(alphaAt(img, CENTER, CENTER)).toBe(0)
    expect(alphaAt(img, CENTER + 11, CENTER)).toBeGreaterThan(200)
  })

  it('Xoá bóng: outer_only keeps a soft halo disc untouched, all removes the halo cleanly', () => {
    const makeHalo = (): ImageData => {
      const data = new Uint8ClampedArray(SIZE * SIZE * 4)
      for (let p = 0; p < SIZE * SIZE; p++) {
        const d = Math.hypot((p % SIZE) - CENTER, Math.floor(p / SIZE) - CENTER)
        const rgb = d <= 3 ? [255, 255, 255] : d <= 10 ? [100, 255, 100] : [0, 255, 0]
        data.set([rgb[0], rgb[1], rgb[2], 255], p * 4)
      }
      return { data, width: SIZE, height: SIZE } as unknown as ImageData
    }
    const outer = makeHalo()
    applyChromaKeyToImageData(outer, { ...baseChroma, isolationMode: 'outer_only' })
    const hi = (CENTER * SIZE + CENTER + 6) * 4
    expect(alphaAt(outer, 0, 0)).toBe(0)
    expect(alphaAt(outer, CENTER + 6, CENTER)).toBe(255) // quầng bên trong viền giữ nguyên
    expect([outer.data[hi], outer.data[hi + 1], outer.data[hi + 2]]).toEqual([100, 255, 100])

    const all = makeHalo()
    applyChromaKeyToImageData(all, { ...baseChroma, isolationMode: 'all' })
    expect(alphaAt(all, CENTER + 6, CENTER)).toBe(0) // quầng mờ bị xoá, không còn mảng xanh đục
    expect(alphaAt(all, CENTER, CENTER)).toBe(255) // lõi sáng đặc giữ lại
  })
})
