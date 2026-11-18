import { describe, expect, it } from 'vitest'
import {
  buildBboxCurveScreenPointsFromGesture,
  buildLiveBboxPreviewCurveScreenPoints,
  buildNormalizedBboxCurveFromGesture,
  decimateAndSmoothStroke,
  evaluateCatmullRom2D,
  evaluateConformalBboxCurve2D
} from './workflowCurveMath'

describe('workflowCurveMath (Studio Curve Algorithm)', () => {
  it('pins exact start and target endpoints while preserving smooth arch apex', () => {
    const start: [number, number] = [-300, -100]
    const target: [number, number] = [300, -100]
    // Vòng cung vồng lên trên giữa màn hình (trên màn hình y nhỏ hơn là cao hơn: 0.5 -> 0.2 -> 0.5)
    const stroke: [number, number][] = [
      [0.2, 0.6],
      [0.35, 0.32],
      [0.5, 0.22],
      [0.65, 0.32],
      [0.8, 0.6]
    ]

    const p0 = evaluateConformalBboxCurve2D(start, target, 0, stroke)
    const pMid = evaluateConformalBboxCurve2D(start, target, 0.5, stroke)
    const p1 = evaluateConformalBboxCurve2D(start, target, 1, stroke)

    expect(p0[0]).toBeCloseTo(-300, 3)
    expect(p0[1]).toBeCloseTo(-100, 3)
    expect(p1[0]).toBeCloseTo(300, 3)
    expect(p1[1]).toBeCloseTo(-100, 3)
    // Đỉnh vòng cung phải vồng lên cao hơn đường thẳng y = -100 một khoảng rõ rệt
    expect(pMid[1]).toBeGreaterThan(20)
  })

  it('auto-corrects stroke direction if user draws from #2 back toward #1', () => {
    const start: [number, number] = [-300, 0]
    const target: [number, number] = [300, 0]
    const reverseStroke: [number, number][] = [
      [0.8, 0.5],
      [0.5, 0.25],
      [0.2, 0.5]
    ]

    const p0 = evaluateConformalBboxCurve2D(start, target, 0, reverseStroke)
    const pMid = evaluateConformalBboxCurve2D(start, target, 0.5, reverseStroke)
    const p1 = evaluateConformalBboxCurve2D(start, target, 1, reverseStroke)

    expect(p0).toEqual([-300, 0])
    expect(p1).toEqual([300, 0])
    expect(pMid[1]).toBeGreaterThan(50)
  })

  it('smooths noisy hand-tremor strokes without kinks and builds live screen preview', () => {
    const noisy: [number, number][] = Array.from({ length: 40 }, (_, i) => [
      i * 10,
      100 + (i % 2 === 0 ? 3 : -3)
    ])
    const knots = decimateAndSmoothStroke(noisy, 12, 3)
    expect(knots[0]).toEqual([0, 103])
    expect(knots[knots.length - 1]).toEqual([390, 97])
    const mid = evaluateCatmullRom2D(knots, 0.5)
    expect(Math.abs(mid[1] - 100)).toBeLessThan(1.5)

    const preview = buildLiveBboxPreviewCurveScreenPoints(
      [[100, 200], [250, 90], [400, 200]],
      [120, 210],
      [420, 210],
      600,
      400,
      20
    )
    expect(preview[0][0]).toBeCloseTo(120, 2)
    expect(preview[preview.length - 1][0]).toBeCloseTo(420, 2)
    expect(preview[10][1]).toBeLessThan(150)
  })

  it('bends smoothly right through cursor on vertical bowstring pull without spiking off-chord', () => {
    const startScreen: [number, number] = [160, 240]
    const endScreen: [number, number] = [480, 240]
    // Người dùng bấm giữa dây và kéo thẳng lên trên tới (320, 120) — thao tác kéo dây cung thực tế
    const verticalPull: [number, number][] = [
      [320, 238],
      [322, 180],
      [320, 120]
    ]

    const arch = buildBboxCurveScreenPointsFromGesture(verticalPull, startScreen, endScreen, 20)
    expect(arch[0]).toEqual(startScreen)
    expect(arch[arch.length - 1]).toEqual(endScreen)
    // Điểm giữa t=0.5 đi xuyên chính xác qua con trỏ (320, 120)
    expect(arch[10][0]).toBeCloseTo(320, 2)
    expect(arch[10][1]).toBeCloseTo(120, 2)
    // Không bao giờ bị vọt lùi về bên trái startScreen (x >= 160) hoặc vượt phải endScreen (x <= 480)
    for (const [x, y] of arch) {
      expect(x).toBeGreaterThanOrEqual(159.9)
      expect(x).toBeLessThanOrEqual(480.1)
      expect(y).toBeGreaterThanOrEqual(119.9)
      expect(y).toBeLessThanOrEqual(240.1)
    }

    // Lưu sang customMotionPath và đọc lại bằng evaluateConformalBboxCurve2D vẫn khớp 1:1
    const norm = buildNormalizedBboxCurveFromGesture(verticalPull, startScreen, endScreen, 640)
    const worldMid = evaluateConformalBboxCurve2D([-320, 0], [320, 0], 0.5, norm)
    expect(worldMid[0]).toBeCloseTo(0, 0)
    expect(worldMid[1]).toBeGreaterThan(200)
  })
})
