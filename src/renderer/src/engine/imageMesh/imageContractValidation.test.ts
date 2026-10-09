import { describe, it, expect } from 'vitest'
import { validateImageBuffer, type PixelBuffer } from './imageContractValidation'

describe('imageContractValidation buffer validation', () => {
  it('passes a valid cutout buffer with transparent background and solid root', () => {
    const w = 100
    const h = 200
    // Binary mask: 1 = opaque, 0 = transparent
    const data = new Uint8Array(w * h)

    // Fill an organic shape centered, touching bottom edge (y=190..199 is bottom)
    for (let y = 40; y < 200; y++) {
      const halfWidth = Math.round(20 * Math.sin(((y - 40) / 160) * Math.PI) + 5)
      for (let x = 50 - halfWidth; x <= 50 + halfWidth; x++) {
        data[y * w + x] = 1
      }
    }

    const buffer: PixelBuffer = { width: w, height: h, data, format: 'binary' }
    const result = validateImageBuffer(buffer, {
      aspect: [1, 2],
      alphaMode: 'cutout',
      attachmentBand: { vMin: 0.0, vMax: 0.05 }
    })

    expect(result.valid).toBe(true)
    expect(result.status).toBe('pass')
    expect(result.errors).toHaveLength(0)
    expect(result.metrics.rootBandCoverageRatio).toBeGreaterThan(0.15)
  })

  it('rejects completely opaque image when slot requires cutout', () => {
    const w = 100
    const h = 200
    const data = new Uint8Array(w * h).fill(1) // 100% opaque

    const buffer: PixelBuffer = { width: w, height: h, data, format: 'binary' }
    const result = validateImageBuffer(buffer, {
      aspect: [1, 2],
      alphaMode: 'cutout'
    })

    expect(result.valid).toBe(false)
    expect(result.status).toBe('fail')
    expect(result.errors.some((e) => e.includes('hình đục hoàn toàn') || e.includes('opaque'))).toBe(true)
  })

  it('rejects image with wrong aspect ratio', () => {
    const w = 200
    const h = 100 // aspect 2:1, but slot expects 1:2
    const data = new Uint8Array(w * h)
    for (let i = 0; i < data.length / 2; i++) data[i] = 1

    const buffer: PixelBuffer = { width: w, height: h, data, format: 'binary' }
    const result = validateImageBuffer(buffer, {
      aspect: [1, 2],
      alphaMode: 'cutout'
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Tỉ lệ ảnh'))).toBe(true)
  })

  it('rejects floating artwork that does not reach root attachment band', () => {
    const w = 100
    const h = 200
    const data = new Uint8Array(w * h)
    // Artwork only in top half (y=20..80), bottom (y=190..199 / v=0..0.05) is completely empty!
    for (let y = 20; y <= 80; y++) {
      for (let x = 40; x <= 60; x++) {
        data[y * w + x] = 1
      }
    }

    const buffer: PixelBuffer = { width: w, height: h, data, format: 'binary' }
    const result = validateImageBuffer(buffer, {
      aspect: [1, 2],
      alphaMode: 'cutout',
      attachmentBand: { vMin: 0.0, vMax: 0.05 }
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('cuống / gốc') || e.includes('lơ lửng'))).toBe(true)
  })

  it('detects fake checkerboard pattern in RGBA data', () => {
    const w = 64
    const h = 64
    const data = new Uint8ClampedArray(w * h * 4)

    // Simulate 8x8 checkerboard with opaque light gray and white pixels
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const isBlockWhite = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
        const c = isBlockWhite ? 255 : 204
        const idx = (y * w + x) * 4
        data[idx] = c
        data[idx + 1] = c
        data[idx + 2] = c
        data[idx + 3] = 255 // opaque!
      }
    }

    const buffer: PixelBuffer = { width: w, height: h, data, format: 'rgba' }
    const result = validateImageBuffer(buffer, {
      aspect: [1, 1],
      alphaMode: 'cutout'
    })

    expect(result.metrics.isCheckerboardSuspected).toBe(true)
    expect(result.warnings.some((w) => w.includes('nền caro giả lập') || w.includes('checkerboard'))).toBe(true)
  })
})
