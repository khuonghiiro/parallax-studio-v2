import { describe, it, expect } from 'vitest'
import { layoutScanCallouts, resolveColumn, type CalloutPlacement } from './aiUiCalloutLayout'

const VIEWPORT = { width: 1920, height: 1080 }

function overlaps(a: CalloutPlacement['label'], b: CalloutPlacement['label']): boolean {
  return (
    a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top
  )
}

describe('aiUiCalloutLayout', () => {
  it('resolveColumn giữ khoảng cách tối thiểu, không vượt biên dưới', () => {
    const ys = resolveColumn([100, 100, 100, 1050], 40, 8, 10, 1080)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(48)
    expect(ys[ys.length - 1] + 40).toBeLessThanOrEqual(1080)
    expect(ys[0]).toBeGreaterThanOrEqual(10)
  })

  it('nhãn của các phần tử dày đặc không bao giờ đè lên nhau và nằm ngoài vùng quét', () => {
    const scan = { left: 700, top: 300, width: 400, height: 220 }
    const targets = Array.from({ length: 10 }, (_, i) => ({
      idx: i,
      bounds: { left: 710 + (i % 5) * 76, top: 310 + Math.floor(i / 5) * 30, width: 70, height: 24 }
    }))
    const placements = layoutScanCallouts(targets, scan, VIEWPORT)
    expect(placements).toHaveLength(10)
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        expect(overlaps(placements[i].label, placements[j].label)).toBe(false)
      }
      const l = placements[i].label
      const insideScan = l.left < scan.left + scan.width && l.left + l.width > scan.left
      expect(insideScan).toBe(false)
    }
  })

  it('đường dẫn gồm các đoạn vuông góc (chỉ ngang hoặc dọc) và kết thúc tại mép nhãn', () => {
    const placements = layoutScanCallouts(
      [{ idx: 0, bounds: { left: 900, top: 500, width: 80, height: 30 } }],
      { left: 880, top: 400, width: 200, height: 300 },
      VIEWPORT
    )
    const p = placements[0]
    for (let i = 1; i < p.points.length; i++) {
      const [x0, y0] = p.points[i - 1]
      const [x1, y1] = p.points[i]
      expect(x0 === x1 || y0 === y1).toBe(true)
    }
    const end = p.points[p.points.length - 1]
    const labelEdge = p.side === 'right' ? p.label.left : p.label.left + p.label.width
    expect(end[0]).toBeCloseTo(labelEdge)
  })

  it('vùng quét sát mép phải → toàn bộ nhãn dồn sang trái và né vùng toast', () => {
    const placements = layoutScanCallouts(
      [
        { idx: 0, bounds: { left: 1800, top: 10, width: 40, height: 30 } },
        { idx: 1, bounds: { left: 1850, top: 12, width: 40, height: 30 } }
      ],
      { left: 1790, top: 4, width: 120, height: 50 },
      VIEWPORT,
      { reserved: [{ left: 1500, top: 0, width: 400, height: 90 }] }
    )
    expect(placements.every((p) => p.side === 'left')).toBe(true)
    expect(placements.every((p) => p.label.top >= 90)).toBe(true)
  })

  it('quá nhiều phần tử cho chiều cao màn hình → chuyển nhãn gọn (compact) nhưng vẫn không chồng', () => {
    const targets = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      bounds: { left: 40, top: 20 + i * 20, width: 30, height: 16 }
    }))
    const placements = layoutScanCallouts(targets, { left: 30, top: 10, width: 60, height: 260 }, { width: 800, height: 420 })
    expect(placements.some((p) => p.compact)).toBe(true)
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        expect(overlaps(placements[i].label, placements[j].label)).toBe(false)
      }
    }
  })
})
