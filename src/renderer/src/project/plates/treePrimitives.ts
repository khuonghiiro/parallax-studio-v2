import { mulberry32 } from '../../animation/math'

export function drawFoliageCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  colors?: { shadow: string; mid: string; light: string; rim?: string }
): void {
  const rand = mulberry32(seed)
  const shdC = colors?.shadow ?? '#1b5e20'
  const midC = colors?.mid ?? '#388e3c'
  const lgtC = colors?.light ?? '#7cb342'

  const lobes: { x: number; y: number; r: number }[] = []
  const count = 12
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2
    const d = 0.55 + rand() * 0.4
    lobes.push({
      x: cx + Math.cos(ang) * rx * d,
      y: cy + Math.sin(ang) * ry * d,
      r: (rx + ry) * 0.23 * (0.8 + rand() * 0.4)
    })
  }
  lobes.push({ x: cx, y: cy, r: (rx + ry) * 0.3 })

  // 1. Shadow base
  ctx.fillStyle = shdC
  for (const lb of lobes) {
    ctx.beginPath()
    ctx.arc(lb.x, lb.y + ry * 0.12, lb.r * 1.05, 0, Math.PI * 2)
    ctx.fill()
  }

  // 2. Mid-tone green body
  ctx.fillStyle = midC
  for (const lb of lobes) {
    ctx.beginPath()
    ctx.arc(lb.x, lb.y, lb.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 3. Sunlit highlights on top lobes
  ctx.fillStyle = lgtC
  for (const lb of lobes) {
    if (lb.y <= cy + ry * 0.05) {
      ctx.beginPath()
      ctx.arc(lb.x - rx * 0.06, lb.y - ry * 0.1, lb.r * 0.65, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 4. Sunlight rim highlight
  if (colors?.rim) {
    ctx.fillStyle = colors.rim
    for (const lb of lobes) {
      if (lb.y <= cy - ry * 0.15) {
        ctx.beginPath()
        ctx.arc(lb.x - rx * 0.08, lb.y - ry * 0.15, lb.r * 0.38, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

export function drawPineTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  h: number,
  w: number,
  colors?: { shadow: string; mid: string; light: string }
): void {
  const shd = colors?.shadow ?? '#10391d'
  const mid = colors?.mid ?? '#1e5f32'
  const lgt = colors?.light ?? '#388e3c'

  // Trunk
  ctx.fillStyle = '#5c3a21'
  ctx.fillRect(cx - w * 0.06, baseY - h * 0.35, w * 0.12, h * 0.35)

  // 4 tiers of pine foliage
  const tiers = [
    { y: baseY - h * 0.25, tw: w, th: h * 0.32 },
    { y: baseY - h * 0.48, tw: w * 0.8, th: h * 0.3 },
    { y: baseY - h * 0.7, tw: w * 0.6, th: h * 0.28 },
    { y: baseY - h * 0.9, tw: w * 0.38, th: h * 0.25 }
  ]

  for (const t of tiers) {
    ctx.fillStyle = shd
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.5, t.y)
    ctx.quadraticCurveTo(cx, t.y + 12, cx + t.tw * 0.5, t.y)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = mid
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.45, t.y - 4)
    ctx.quadraticCurveTo(cx, t.y + 6, cx + t.tw * 0.45, t.y - 4)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = lgt
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.45, t.y - 4)
    ctx.quadraticCurveTo(cx - t.tw * 0.1, t.y, cx, t.y - 4)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()
  }
}

export function drawStylizedTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  h: number,
  w: number,
  opts: {
    seed: number
    curveDir?: 1 | -1
    trunkColor?: string
    foliage?: { shadow: string; mid: string; light: string; rim?: string }
  }
): void {
  const dir = opts.curveDir ?? 1
  const trunkBaseW = w * 0.18
  const trunkCol = opts.trunkColor ?? '#8d5b34'

  // Root shadow
  ctx.fillStyle = 'rgba(15, 35, 20, 0.38)'
  ctx.beginPath()
  ctx.ellipse(cx, baseY + 6, trunkBaseW * 1.6, 22, 0, 0, Math.PI * 2)
  ctx.fill()

  // 1. Woody trunk with flaring roots and curving branches
  ctx.fillStyle = trunkCol
  ctx.beginPath()
  ctx.moveTo(cx - trunkBaseW * 1.35, baseY)
  ctx.quadraticCurveTo(cx - trunkBaseW * 0.4, baseY - h * 0.2, cx - trunkBaseW * 0.3 + dir * 30, baseY - h * 0.55)
  ctx.quadraticCurveTo(cx - w * 0.3, baseY - h * 0.7, cx - w * 0.42, baseY - h * 0.8)
  ctx.lineTo(cx - w * 0.34, baseY - h * 0.84)
  ctx.quadraticCurveTo(cx - w * 0.18, baseY - h * 0.72, cx + dir * 15, baseY - h * 0.65)
  ctx.quadraticCurveTo(cx + w * 0.25, baseY - h * 0.75, cx + w * 0.4, baseY - h * 0.82)
  ctx.lineTo(cx + w * 0.46, baseY - h * 0.78)
  ctx.quadraticCurveTo(cx + trunkBaseW * 0.35, baseY - h * 0.6, cx + trunkBaseW * 0.4 + dir * 30, baseY - h * 0.4)
  ctx.quadraticCurveTo(cx + trunkBaseW * 0.5, baseY - h * 0.15, cx + trunkBaseW * 1.35, baseY)
  ctx.closePath()
  ctx.fill()

  // Bark grain curves
  ctx.strokeStyle = '#5a351b'
  ctx.lineWidth = Math.max(2, trunkBaseW * 0.08)
  ctx.beginPath()
  ctx.moveTo(cx - trunkBaseW * 0.75, baseY)
  ctx.quadraticCurveTo(cx - trunkBaseW * 0.15, baseY - h * 0.3, cx + dir * 10, baseY - h * 0.6)
  ctx.stroke()

  ctx.strokeStyle = '#af7648'
  ctx.lineWidth = Math.max(1.5, trunkBaseW * 0.06)
  ctx.beginPath()
  ctx.moveTo(cx + trunkBaseW * 0.25, baseY)
  ctx.quadraticCurveTo(cx + trunkBaseW * 0.4, baseY - h * 0.25, cx + w * 0.2, baseY - h * 0.7)
  ctx.stroke()

  // 2. Leafy canopy clouds positioned on branch limbs
  const canopies = [
    { x: cx - w * 0.38, y: baseY - h * 0.85, rx: w * 0.34, ry: h * 0.22, seed: opts.seed + 1 },
    { x: cx + w * 0.38, y: baseY - h * 0.85, rx: w * 0.34, ry: h * 0.22, seed: opts.seed + 2 },
    { x: cx - w * 0.12, y: baseY - h * 0.98, rx: w * 0.38, ry: h * 0.24, seed: opts.seed + 3 },
    { x: cx + w * 0.15, y: baseY - h * 1.02, rx: w * 0.36, ry: h * 0.23, seed: opts.seed + 4 },
    { x: cx + dir * 10, y: baseY - h * 0.82, rx: w * 0.3, ry: h * 0.2, seed: opts.seed + 5 }
  ]

  for (const c of canopies) {
    drawFoliageCloud(ctx, c.x, c.y, c.rx, c.ry, c.seed, opts.foliage)
  }
}

export function drawUprightTieredTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  h: number,
  w: number,
  opts: { seed: number; trunkColor?: string; foliage?: { shadow: string; mid: string; light: string; rim?: string } }
): void {
  const trunkW = w * 0.14
  const trunkCol = opts.trunkColor ?? '#8d5b34'

  // Trunk
  ctx.fillStyle = trunkCol
  ctx.beginPath()
  ctx.moveTo(cx - trunkW * 1.2, baseY)
  ctx.quadraticCurveTo(cx - trunkW * 0.5, baseY - h * 0.2, cx - trunkW * 0.35, baseY - h * 0.9)
  ctx.lineTo(cx + trunkW * 0.35, baseY - h * 0.9)
  ctx.quadraticCurveTo(cx + trunkW * 0.5, baseY - h * 0.2, cx + trunkW * 1.2, baseY)
  ctx.closePath()
  ctx.fill()

  // Bark lines
  ctx.strokeStyle = '#5a351b'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(cx - trunkW * 0.2, baseY)
  ctx.lineTo(cx - trunkW * 0.1, baseY - h * 0.8)
  ctx.moveTo(cx + trunkW * 0.3, baseY)
  ctx.lineTo(cx + trunkW * 0.15, baseY - h * 0.75)
  ctx.stroke()

  // 3 Tiers of cloud foliage
  const tiers = [
    { y: baseY - h * 0.52, rx: w * 0.44, ry: h * 0.18, seed: opts.seed + 10 },
    { y: baseY - h * 0.76, rx: w * 0.38, ry: h * 0.17, seed: opts.seed + 20 },
    { y: baseY - h * 0.96, rx: w * 0.3, ry: h * 0.15, seed: opts.seed + 30 }
  ]
  for (const t of tiers) {
    drawFoliageCloud(ctx, cx, t.y, t.rx, t.ry, t.seed, opts.foliage)
  }
}

export function drawBroadleafPlant(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  dir: 1 | -1,
  colors?: { base: string; half: string; vein: string }
): void {
  const baseC = colors?.base ?? '#144617'
  const halfC = colors?.half ?? '#246b28'
  const veinC = colors?.vein ?? '#76c43b'

  const leaves = [
    { ang: -0.9 * dir, len: 140 * scale, w: 60 * scale },
    { ang: -0.5 * dir, len: 175 * scale, w: 72 * scale },
    { ang: -0.15 * dir, len: 155 * scale, w: 66 * scale },
    { ang: 0.25 * dir, len: 120 * scale, w: 55 * scale }
  ]

  for (const lf of leaves) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(lf.ang)

    ctx.fillStyle = baseC
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.8, -lf.len * 0.5, 0, -lf.len)
    ctx.quadraticCurveTo(-lf.w * 0.8, -lf.len * 0.5, 0, 0)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = halfC
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.8, -lf.len * 0.5, 0, -lf.len)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = veinC
    ctx.lineWidth = 3 * scale
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.08, -lf.len * 0.5, 0, -lf.len)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(140, 215, 100, 0.65)'
    ctx.lineWidth = 1.6 * scale
    for (let u = 0.2; u <= 0.82; u += 0.15) {
      const vy = -lf.len * u
      ctx.beginPath()
      ctx.moveTo(0, vy)
      ctx.lineTo(lf.w * 0.52 * (1 - u * 0.35), vy - 16 * scale)
      ctx.moveTo(0, vy)
      ctx.lineTo(-lf.w * 0.52 * (1 - u * 0.35), vy - 16 * scale)
      ctx.stroke()
    }

    ctx.restore()
  }
}
