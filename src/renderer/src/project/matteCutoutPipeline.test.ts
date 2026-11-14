import { describe, expect, it } from 'vitest'
import {
  autoCropTightAlphaBounds,
  computeChromaAlphaMatte,
  despillChromaFringe,
  detectDominantBorderKeyColor,
  extractForegroundPlate,
  pruneAlphaSpeckles
} from './matteCutoutPipeline'

function makeCanvas(w: number, h: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    buf[o] = fill[0]
    buf[o + 1] = fill[1]
    buf[o + 2] = fill[2]
    buf[o + 3] = fill[3]
  }
  return buf
}

function fillRect(
  buf: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  color: [number, number, number, number]
): void {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      const o = (y * w + x) * 4
      buf[o] = color[0]
      buf[o + 1] = color[1]
      buf[o + 2] = color[2]
      buf[o + 3] = color[3]
    }
  }
}

describe('matteCutoutPipeline', () => {
  it('nhận diện phông xanh lá ở viền và giữ nguyên chủ thể trắng/đỏ', () => {
    const w = 64
    const h = 64
    const rgba = makeCanvas(w, h, [0, 255, 0, 255])
    fillRect(rgba, w, 20, 16, 20, 28, [248, 244, 232, 255])
    fillRect(rgba, w, 24, 24, 12, 8, [184, 41, 47, 255])
    // Giả lập viền răng cưa pha xanh ở cạnh trái nhân vật
    fillRect(rgba, w, 19, 16, 1, 28, [92, 236, 86, 255])

    const key = detectDominantBorderKeyColor(rgba, w, h)
    expect(key.kind).toBe('green')

    const res = extractForegroundPlate(rgba, w, h, { cropPadPx: 2, minSpecklePixels: 16 })
    expect(res.keyColor.kind).toBe('green')
    expect(res.width).toBeLessThan(w)
    expect(res.height).toBeLessThan(h)
    expect(res.opaquePixels).toBeGreaterThanOrEqual(20 * 28)

    // Chấm góc (0, 0) phải hoàn toàn trong suốt
    expect(res.rgba[3]).toBe(0)
    // Tâm nhân vật phải đục 255 và giữ đúng màu trắng/đỏ
    const cx = Math.floor(res.width / 2)
    const cy = Math.floor(res.height / 2)
    const centerOff = (cy * res.width + cx) * 4
    expect(res.rgba[centerOff + 3]).toBe(255)
    expect(res.rgba[centerOff]).toBeGreaterThan(170)
  })

  it('nhận diện phông cánh sen #FF00FF và bảo toàn 100% lá trúc xanh ngọc bích', () => {
    const w = 72
    const h = 72
    const rgba = makeCanvas(w, h, [255, 0, 255, 255])
    // Thân và lá trúc xanh ngọc bích nằm chính giữa
    fillRect(rgba, w, 20, 12, 24, 42, [34, 152, 88, 255])
    // Đá xám thuỷ mặc
    fillRect(rgba, w, 28, 36, 22, 18, [108, 114, 122, 255])

    const res = extractForegroundPlate(rgba, w, h, { cropPadPx: 4, minSpecklePixels: 16 })
    expect(res.keyColor.kind).toBe('magenta')

    // Lá trúc tại vùng trung tâm trên phải giữ nguyên alpha = 255 và kênh G trội
    const lx = 26 - res.cropBox.x
    const ly = 20 - res.cropBox.y
    const loff = (ly * res.width + lx) * 4
    expect(res.rgba[loff + 3]).toBe(255)
    expect(res.rgba[loff + 1]).toBeGreaterThan(res.rgba[loff] + 60)

    // Đá xám cũng giữ alpha = 255
    const rx = 42 - res.cropBox.x
    const ry = 46 - res.cropBox.y
    const roff = (ry * res.width + rx) * 4
    expect(res.rgba[roff + 3]).toBe(255)
  })

  it('khử ám viền xanh (despill) và lọc sạch đốm nhiễu rời nhỏ ngoài rìa', () => {
    const w = 48
    const h = 48
    const rgba = makeCanvas(w, h, [0, 255, 0, 255])
    fillRect(rgba, w, 14, 14, 18, 18, [220, 210, 190, 255])
    // Viền bán trong suốt pha xanh lá mạnh
    fillRect(rgba, w, 13, 14, 1, 18, [110, 232, 100, 255])
    // Đốm nhiễu 3 pixel rời rạc ở góc trên trái
    fillRect(rgba, w, 2, 2, 2, 2, [200, 180, 160, 255])

    const key = detectDominantBorderKeyColor(rgba, w, h)
    const matte = computeChromaAlphaMatte(rgba, w, h, { keyColor: key })
    despillChromaFringe(matte, w, h, key, 1)
    const removed = pruneAlphaSpeckles(matte, w, h, 16)
    expect(removed).toBeGreaterThanOrEqual(4)

    // Kiểm tra viền (13, 20) không còn bị G vượt quá max(R, B)
    const edgeIdx = (20 * w + 13) * 4
    expect(matte[edgeIdx + 1]).toBeLessThanOrEqual(Math.max(matte[edgeIdx], matte[edgeIdx + 2]))

    const cropped = autoCropTightAlphaBounds(matte, w, h, 2)
    expect(cropped.cropBox.x).toBeGreaterThanOrEqual(11)
    expect(cropped.cropBox.width).toBeLessThan(26)
  })
})
