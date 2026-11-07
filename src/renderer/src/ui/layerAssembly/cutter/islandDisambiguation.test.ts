import { describe, it, expect } from 'vitest'
import {
  boxesIntersect,
  disambiguateRegionPixels
} from './islandDisambiguation'

describe('islandDisambiguation', () => {
  it('checks bounding box intersection correctly', () => {
    const boxA = { x: 0, y: 0, width: 100, height: 100 }
    const boxB = { x: 50, y: 50, width: 100, height: 100 }
    const boxC = { x: 200, y: 200, width: 50, height: 50 }

    expect(boxesIntersect(boxA, boxB)).toBe(true)
    expect(boxesIntersect(boxA, boxC)).toBe(false)
    expect(boxesIntersect(boxB, boxC)).toBe(false)
  })

  it('removes intruder components from overlapping sibling bounding box', () => {
    // Giả lập:
    // Box 1 (Tóc trước): x=0, y=0, w=100, h=100 (tâm 50, 50)
    // Box 2 (Búi tóc sau): x=60, y=0, w=100, h=100 (tâm 110, 50)
    // Vùng giao thoa theo trục X: từ x=60 đến x=100 (chiều rộng 40px)
    //
    // Ta đang trích xuất Box 2 (kích thước cục bộ 100x100, x cục bộ từ 0..99 tương ứng x toàn cục 60..159):
    // Trong Box 2 có 2 cụm pixel:
    // 1. Thân chính của Box 2: ở x toàn cục 100..120, y 40..60 (x cục bộ 40..60).
    //    Đây là vùng lõi (nằm ngoài Box 1 vì Box 1 kết thúc ở x=100).
    // 2. Mảnh lọt từ Box 1 (đuôi tóc mái của Box 1): ở x toàn cục 70..80, y 40..60 (x cục bộ 10..20).
    //    Cụm này nằm hoàn toàn trong vùng giao thoa (x toàn cục < 100) và gần tâm Box 1 hơn nhiều!

    const W = 100
    const H = 100
    const data = new Uint8ClampedArray(W * H * 4)

    // Cụm 1: Thân chính của Box 2 (x cục bộ 40..60, y cục bộ 40..60)
    for (let y = 40; y <= 60; y++) {
      for (let x = 40; x <= 60; x++) {
        const idx = (y * W + x) * 4
        data[idx] = 150
        data[idx + 1] = 100
        data[idx + 2] = 50
        data[idx + 3] = 255
      }
    }

    // Cụm 2: Mảnh lọt từ Box 1 (x cục bộ 10..20, y cục bộ 40..60)
    // x toàn cục = 60 + (10..20) = 70..80 (nằm trong Box 1 x=0..100)
    for (let y = 40; y <= 60; y++) {
      for (let x = 10; x <= 20; x++) {
        const idx = (y * W + x) * 4
        data[idx] = 20
        data[idx + 1] = 20
        data[idx + 2] = 20
        data[idx + 3] = 255
      }
    }

    const imgData = {
      width: W,
      height: H,
      data
    } as ImageData

    const targetBox = { x: 60, y: 0, width: 100, height: 100 }
    const siblingBoxes = [{ x: 0, y: 0, width: 100, height: 100 }]

    const modified = disambiguateRegionPixels(imgData, targetBox, siblingBoxes)
    expect(modified).toBe(true)

    // Kiểm tra: Mảnh lọt từ Box 1 (x cục bộ 15, y cục bộ 50) PHẢI BỊ XÓA (alpha = 0)
    const intruderIdx = (50 * W + 15) * 4
    expect(data[intruderIdx + 3]).toBe(0)

    // Kiểm tra: Thân chính Box 2 (x cục bộ 50, y cục bộ 50) PHẢI ĐƯỢC GIỮ NGUYÊN (alpha = 255)
    const targetIdx = (50 * W + 50) * 4
    expect(data[targetIdx + 3]).toBe(255)
  })

  it('keeps valid non-overlapping pieces untouched', () => {
    const W = 50
    const H = 50
    const data = new Uint8ClampedArray(W * H * 4)
    data[10 * W * 4 + 10 * 4 + 3] = 255

    const imgData = { width: W, height: H, data } as ImageData
    const targetBox = { x: 0, y: 0, width: 50, height: 50 }
    const siblingBoxes = [{ x: 200, y: 200, width: 50, height: 50 }]

    const modified = disambiguateRegionPixels(imgData, targetBox, siblingBoxes)
    expect(modified).toBe(false)
    expect(data[10 * W * 4 + 10 * 4 + 3]).toBe(255)
  })
})
