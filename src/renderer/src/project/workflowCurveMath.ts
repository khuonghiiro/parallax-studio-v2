/**
 * Thuật toán nội suy đường cong quỹ đạo chuẩn Studio (Centripetal Catmull-Rom + 2D Conformal Similarity Chord Mapping):
 * - Khử rung tay chuột (decimation + endpoint-pinned Gaussian smoothing).
 * - Nội suy spline Centripetal Catmull-Rom (alpha = 0.5) mượt liên tục C1, không gãy khúc hay thắt nút.
 * - Ánh xạ đồng dạng bảo giác 2D (Bookstein Chord Basis) neo khít điểm đầu vào BBox #1 và điểm cuối vào BBox #2,
 *   kể cả khi người dùng vẽ ngược chiều từ #2 về #1 hoặc kéo dời vị trí BBox #2 sau khi vẽ.
 */

export type Point2D = [number, number]

/** Khử nhiễu tay chuột và lấy mẫu đều theo độ dài cung thành tập điểm kiểm soát mượt, giữ cố định 2 đầu mút */
export function decimateAndSmoothStroke(raw: Point2D[], knotCount = 14, smoothPasses = 3): Point2D[] {
  const clean = raw.filter(
    (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
  )
  if (clean.length === 0) return [[0, 0], [0, 0]]
  if (clean.length === 1) return [clean[0], clean[0]]
  if (clean.length === 2) return [clean[0], clean[1]]

  const cumLen: number[] = [0]
  let total = 0
  for (let i = 1; i < clean.length; i++) {
    total += Math.hypot(clean[i][0] - clean[i - 1][0], clean[i][1] - clean[i - 1][1])
    cumLen.push(total)
  }
  if (total < 1e-5) {
    return [clean[0], clean[clean.length - 1]]
  }

  const count = Math.max(4, Math.min(knotCount, clean.length + 2))
  let pts: Point2D[] = []
  let segIdx = 0
  for (let k = 0; k < count; k++) {
    if (k === 0) {
      pts.push([clean[0][0], clean[0][1]])
      continue
    }
    if (k === count - 1) {
      const last = clean[clean.length - 1]
      pts.push([last[0], last[1]])
      continue
    }
    const targetD = (total * k) / (count - 1)
    while (segIdx < cumLen.length - 2 && cumLen[segIdx + 1] < targetD) {
      segIdx++
    }
    const d0 = cumLen[segIdx]
    const d1 = cumLen[segIdx + 1]
    const ratio = d1 - d0 > 1e-6 ? (targetD - d0) / (d1 - d0) : 0
    pts.push([
      clean[segIdx][0] + (clean[segIdx + 1][0] - clean[segIdx][0]) * ratio,
      clean[segIdx][1] + (clean[segIdx + 1][1] - clean[segIdx][1]) * ratio
    ])
  }

  for (let pass = 0; pass < smoothPasses; pass++) {
    const next: Point2D[] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      next.push([
        0.22 * pts[i - 1][0] + 0.56 * pts[i][0] + 0.22 * pts[i + 1][0],
        0.22 * pts[i - 1][1] + 0.56 * pts[i][1] + 0.22 * pts[i + 1][1]
      ])
    }
    next.push(pts[pts.length - 1])
    pts = next
  }

  return pts
}

/** Nội suy spline Centripetal Catmull-Rom (alpha = 0.5, Barry-Goldman) không bao giờ tạo điểm gãy hay tự cắt */
export function evaluateCatmullRom2D(knots: Point2D[], u: number): Point2D {
  if (knots.length === 0) return [0, 0]
  if (knots.length === 1) return knots[0]
  const clamped = Math.max(0, Math.min(1, u))
  if (knots.length === 2) {
    return [
      knots[0][0] + (knots[1][0] - knots[0][0]) * clamped,
      knots[0][1] + (knots[1][1] - knots[0][1]) * clamped
    ]
  }
  if (clamped <= 0) return knots[0]
  if (clamped >= 1) return knots[knots.length - 1]

  const nSeg = knots.length - 1
  const scaled = clamped * nSeg
  const i = Math.min(nSeg - 1, Math.floor(scaled))
  const localFrac = scaled - i

  const p1 = knots[i]
  const p2 = knots[i + 1]
  const p0: Point2D = i > 0 ? knots[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]]
  const p3: Point2D = i + 2 < knots.length ? knots[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]]

  const knotStep = (a: Point2D, b: Point2D): number =>
    Math.max(1e-4, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5))

  const t0 = 0
  const t1 = t0 + knotStep(p0, p1)
  const t2 = t1 + knotStep(p1, p2)
  const t3 = t2 + knotStep(p2, p3)
  const t = t1 + (t2 - t1) * localFrac

  const lerpPt = (a: Point2D, b: Point2D, ta: number, tb: number, tc: number): Point2D => {
    const denom = tb - ta
    const w = Math.abs(denom) > 1e-6 ? (tc - ta) / denom : 0
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
  }

  const a1 = lerpPt(p0, p1, t0, t1, t)
  const a2 = lerpPt(p1, p2, t1, t2, t)
  const a3 = lerpPt(p2, p3, t2, t3, t)
  const b1 = lerpPt(a1, a2, t0, t2, t)
  const b2 = lerpPt(a2, a3, t1, t3, t)
  return lerpPt(b1, b2, t1, t2, t)
}

/**
 * Ánh xạ đồng dạng 2D (Bookstein Chord Mapping) đưa nét vẽ chuẩn hoá `[0..1]×[0..1]` trên màn hình 16:9
 * khớp chính xác lên dây cung từ `startXY` (#1 Đầu) tới `targetXY` (#2 Đích) trong không gian thế giới.
 */
export function evaluateConformalBboxCurve2D(
  startXY: Point2D,
  targetXY: Point2D,
  u: number,
  normalizedStroke: Point2D[],
  aspectW = 16,
  aspectH = 9
): Point2D {
  const t = Math.max(0, Math.min(1, u))
  const cwX = targetXY[0] - startXY[0]
  const cwY = targetXY[1] - startXY[1]
  const baseLineX = startXY[0] + cwX * t
  const baseLineY = startXY[1] + cwY * t

  if (!normalizedStroke || normalizedStroke.length < 2) {
    return [baseLineX, baseLineY]
  }

  let aspectPts: Point2D[] = normalizedStroke.map((pt) => [pt[0] * aspectW, -pt[1] * aspectH])
  const firstRaw = aspectPts[0]
  const lastRaw = aspectPts[aspectPts.length - 1]
  const rawDx = lastRaw[0] - firstRaw[0]
  const rawDy = lastRaw[1] - firstRaw[1]
  // Nếu người dùng vẽ ngược chiều từ vùng BBox #2 về BBox #1 -> tự đảo chiều nét vẽ để đỉnh cong giữ đúng hướng
  if (rawDx * cwX + rawDy * cwY < -0.15 * Math.hypot(rawDx, rawDy) * Math.hypot(cwX, cwY)) {
    aspectPts = [...aspectPts].reverse()
  }

  const knots = decimateAndSmoothStroke(aspectPts, 14, 3)
  const s0 = knots[0]
  const s1 = knots[knots.length - 1]
  const csX = s1[0] - s0[0]
  const csY = s1[1] - s0[1]
  const ls = Math.hypot(csX, csY)
  const lw = Math.hypot(cwX, cwY)
  const pCur = evaluateCatmullRom2D(knots, t)

  if (ls >= 0.45 && lw >= 24) {
    const tsX = csX / ls
    const tsY = csY / ls
    const nsX = -tsY
    const nsY = tsX

    const twX = cwX / lw
    const twY = cwY / lw
    const nwX = -twY
    const nwY = twX

    const dsX = pCur[0] - s0[0]
    const dsY = pCur[1] - s0[1]
    const xi = Math.max(-0.35, Math.min(1.35, (dsX * tsX + dsY * tsY) / ls))
    const eta = Math.max(-1.25, Math.min(1.25, (dsX * nsX + dsY * nsY) / ls))

    return [
      startXY[0] + xi * cwX + eta * lw * nwX,
      startXY[1] + xi * cwY + eta * lw * nwY
    ]
  }

  const chordSX = s0[0] + csX * t
  const chordSY = s0[1] + csY * t
  const scaleFallback = Math.max(360, lw) / aspectW
  return [
    baseLineX + (pCur[0] - chordSX) * scaleFallback,
    baseLineY + (pCur[1] - chordSY) * scaleFallback
  ]
}

/** Dựng đường xem trước mượt neo trực tiếp từ tâm BBox #1 tới tâm BBox #2 ngay trong lúc đang kéo chuột vẽ */
export function buildLiveBboxPreviewCurveScreenPoints(
  rawScreenStroke: Point2D[],
  startScreen: Point2D,
  endScreen: Point2D,
  stageW: number,
  stageH: number,
  steps = 40
): Point2D[] {
  const w = Math.max(1, stageW)
  const h = Math.max(1, stageH)
  const norm: Point2D[] = rawScreenStroke.map(([x, y]) => [x / w, y / h])
  const out: Point2D[] = []
  for (let i = 0; i <= steps; i++) {
    const pt = evaluateConformalBboxCurve2D(
      [startScreen[0], -startScreen[1]],
      [endScreen[0], -endScreen[1]],
      i / steps,
      norm,
      w / 100,
      h / 100
    )
    out.push([pt[0], -pt[1]])
  }
  return out
}

/** Tính vector độ lệch đích `(dxWorld, dyWorld)` từ điểm đầu tới điểm cuối của quỹ đạo vẽ tự do (`customMotionPath`) */
export function computeDrawnPathWorldDelta(
  path: Point2D[] | undefined,
  compW = 1920,
  compH = 1080,
  intensity = 1
): Point2D {
  if (!path || path.length < 2) return [0, 0]
  const clean = path.filter(
    (pt): pt is Point2D =>
      Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
  )
  if (clean.length < 2) return [0, 0]
  const isNorm = clean.every((pt) => Math.abs(pt[0]) <= 1.2 && Math.abs(pt[1]) <= 1.2)
  const mul = Math.max(0.1, Math.min(3.0, intensity))
  const scaleX = (isNorm ? Math.round(compW * 0.28) : 1) * mul
  const scaleY = (isNorm ? Math.round(compH * 0.36) : 1) * mul
  const p0 = clean[0]
  const pLast = clean[clean.length - 1]
  const dx = (pLast[0] - p0[0]) * scaleX
  const dy = (isNorm ? -(pLast[1] - p0[1]) : pLast[1] - p0[1]) * scaleY
  return [Math.round(dx * 10) / 10, Math.round(dy * 10) / 10]
}

/**
 * Biến đổi đồng dạng quỹ đạo vẽ tự do khi người dùng kéo dời khung BBox Đích sang vị trí mới `(nextDeltaX, nextDeltaY)`,
 * giữ nguyên toàn bộ uốn lượn của nét vẽ tay.
 */
export function retargetDrawnPathEndpoint(
  path: Point2D[],
  nextDeltaWorld: Point2D,
  compW = 1920,
  compH = 1080,
  intensity = 1
): Point2D[] {
  if (path.length < 2) return path
  const isNorm = path.every((pt) => Math.abs(pt[0]) <= 1.2 && Math.abs(pt[1]) <= 1.2)
  const mul = Math.max(0.1, Math.min(3.0, intensity))
  const scaleX = (isNorm ? Math.round(compW * 0.28) : 1) * mul
  const scaleY = (isNorm ? Math.round(compH * 0.36) : 1) * mul
  const p0 = path[0]

  // Đưa toàn bộ quỹ đạo về toạ độ độ lệch thế giới tính từ p0
  const worldOffsets: Point2D[] = path.map((pt) => [
    (pt[0] - p0[0]) * scaleX,
    (isNorm ? -(pt[1] - p0[1]) : pt[1] - p0[1]) * scaleY
  ])

  const oldEnd = worldOffsets[worldOffsets.length - 1]
  const oldLen = Math.hypot(oldEnd[0], oldEnd[1])
  const newLen = Math.hypot(nextDeltaWorld[0], nextDeltaWorld[1])

  if (oldLen >= 12 && newLen >= 8) {
    const ratio = newLen / oldLen
    const cosOld = oldEnd[0] / oldLen
    const sinOld = oldEnd[1] / oldLen
    const cosNew = nextDeltaWorld[0] / newLen
    const sinNew = nextDeltaWorld[1] / newLen
    return worldOffsets.map(([wx, wy], idx): Point2D => {
      if (idx === 0) return [0, 0]
      if (idx === worldOffsets.length - 1) return [Math.round(nextDeltaWorld[0] / mul), Math.round(nextDeltaWorld[1] / mul)]
      // Tọa độ dọc cung & vuông góc trên hệ trục cũ -> xoay và giãn sang hệ trục mới
      const along = wx * cosOld + wy * sinOld
      const perp = -wx * sinOld + wy * cosOld
      const nx = (along * cosNew - perp * sinNew) * ratio
      const ny = (along * sinNew + perp * cosNew) * ratio
      return [Math.round((nx / mul) * 10) / 10, Math.round((ny / mul) * 10) / 10]
    })
  }

  const n = worldOffsets.length - 1
  return worldOffsets.map(([wx, wy], idx): Point2D => {
    const u = n > 0 ? idx / n : 1
    const shiftX = (nextDeltaWorld[0] - oldEnd[0]) * u
    const shiftY = (nextDeltaWorld[1] - oldEnd[1]) * u
    return [Math.round(((wx + shiftX) / mul) * 10) / 10, Math.round(((wy + shiftY) / mul) * 10) / 10]
  })
}
