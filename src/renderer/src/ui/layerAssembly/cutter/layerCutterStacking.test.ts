import { describe, it, expect } from 'vitest'
import { computeNextLayerZ, computeFrontLayerZ } from '../useLayerWorkshop'
import { computeAutoFitPieceScale, computeSlotFitPieceScale } from './cutterHelpers'

describe('2D Layer Cutter Stacking & Z-Index Ordering Rules', () => {
  it('assigns z = 11 (10 + 1) to the first added layer in an empty composite', () => {
    const layers: { z?: number }[] = []
    const firstZ = computeNextLayerZ(layers)
    expect(firstZ).toBe(11) // 10 + 1 (tay vào trước)
  })

  it('assigns z = 12 (10 + 1 + 1) to the second added layer, and increments by +1 sequentially', () => {
    const layers: { z?: number }[] = []

    // 1. Tay vào trước: z = 10 + 1 = 11
    const tayZ = computeNextLayerZ(layers)
    expect(tayZ).toBe(11)
    layers.push({ z: tayZ })

    // 2. Áo vào sau: z = 10 + 1 + 1 = 12 (nằm đè lên tay)
    const aoZ = computeNextLayerZ(layers)
    expect(aoZ).toBe(12)
    layers.push({ z: aoZ })

    // 3. Quần vào sau: z = 13 (nằm đè lên áo)
    const quanZ = computeNextLayerZ(layers)
    expect(quanZ).toBe(13)
    layers.push({ z: quanZ })

    // 4. Áo khoác vào sau: z = 14
    const khoacZ = computeNextLayerZ(layers)
    expect(khoacZ).toBe(14)
  })

  it('handles existing layers where some z-indexes are below 10 by using base 10', () => {
    // If old legacy layers had z = 0 or 5, new layer will start at max(10, maxZ) + 1 = 11
    const legacyLayers = [{ z: 0 }, { z: 5 }]
    const nextZ = computeNextLayerZ(legacyLayers)
    expect(nextZ).toBe(11)
  })

  it('honors customZ when explicitly provided (e.g. from template slots)', () => {
    const layers = [{ z: 11 }, { z: 12 }]
    const customZ = computeNextLayerZ(layers, 30)
    expect(customZ).toBe(30)
  })

  it('computes front-most Z (computeFrontLayerZ) and renders zIndex = 1000 - z identically between Tab 1 and Tab 2', () => {
    // Nam Sinh Kính Cận layers: glasses (-42), face-normal (-30), head (-20), torso (0), arm-left (35)
    const animeLayers = [
      { id: 'head', z: -20 },
      { id: 'glasses', z: -42 },
      { id: 'face-normal', z: -30 },
      { id: 'torso', z: 0 },
      { id: 'arm-left', z: 35 }
    ]

    const zIndexOf = (z: number) => Math.round(1000 - z)
    expect(zIndexOf(-42)).toBeGreaterThan(zIndexOf(-30)) // Kính nổi trên biểu cảm mặt
    expect(zIndexOf(-30)).toBeGreaterThan(zIndexOf(-20)) // Biểu cảm mặt nổi trên đầu trơn
    expect(zIndexOf(-20)).toBeGreaterThan(zIndexOf(0))   // Đầu nổi trên thân áo
    expect(zIndexOf(0)).toBeGreaterThan(zIndexOf(35))    // Thân áo nổi trên bắp tay sau

    // Khi kéo mảnh mới vào, mảnh mới nhận z = -43 để nổi lên trước toàn bộ nhân vật
    const droppedZ = computeFrontLayerZ(animeLayers)
    expect(droppedZ).toBe(-43)
    expect(zIndexOf(droppedZ)).toBeGreaterThan(zIndexOf(-42))
  })

  it('auto-scales 4K/8K cut pieces proportionally to composite board so they do not cover other details', () => {
    // Mảnh #5 (cánh tay 259x446) cắt từ ảnh 4K (4800x3584) kéo vào khung Nam Sinh Kính Cận (750x1050)
    const scale4kArm = computeAutoFitPieceScale(
      { width: 259, height: 446, sourceImageSize: { width: 4800, height: 3584 } },
      750,
      1050
    )
    expect(scale4kArm).toBeGreaterThanOrEqual(0.2)
    expect(scale4kArm).toBeLessThanOrEqual(0.32)
    expect(Math.round(259 * scale4kArm)).toBeLessThan(90)
    expect(Math.round(446 * scale4kArm)).toBeLessThan(140)

    // Mảnh cắt từ sprite sheet chuẩn (665x702) giữ nguyên scale = 1
    const scaleStandard = computeAutoFitPieceScale(
      { width: 113, height: 184, sourceImageSize: { width: 665, height: 702 } },
      600,
      600
    )
    expect(scaleStandard).toBe(1)

    // Gán mảnh 4K vào ô khuôn mẫu (slot 45x94) tự động co vừa khít ô
    const slotScale = computeSlotFitPieceScale(
      { width: 259, height: 446, sourceImageSize: { width: 4800, height: 3584 } },
      { width: 45, height: 94, scale: 0.52 },
      750,
      1050
    )
    expect(slotScale).toBeGreaterThanOrEqual(0.15)
    expect(slotScale).toBeLessThanOrEqual(0.25)
  })
})

describe('2D Layer Cutter Smart Tag Placement Rules', () => {
  function getTagPlacement(w: number, h: number, y: number): string {
    const isInside = h >= 34 && w >= 46
    const isNearTop = y < 22
    return isInside ? 'inside-top-left' : isNearTop ? 'outside-bottom' : 'outside-top'
  }

  it('places tag inside-top-left when box is tall and wide enough, preventing overlap with box above', () => {
    const placement = getTagPlacement(145, 51, 80)
    expect(placement).toBe('inside-top-left')
  })

  it('places tag outside-top when box is shallow and not near top edge', () => {
    const placement = getTagPlacement(77, 24, 50)
    expect(placement).toBe('outside-top')
  })

  it('places tag outside-bottom when box is shallow but near top edge', () => {
    const placement = getTagPlacement(77, 24, 10)
    expect(placement).toBe('outside-bottom')
  })
})
