import { mulberry32 } from '../animation/math'

// 16:9 canvas calibrated so screen (1920x1080) sits dead-center with 240px X and 135px Y parallax bleed.
export const PLATE_WIDTH = 2400
export const PLATE_HEIGHT = 1350

export function createPlateCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (typeof document === 'undefined') {
    const dummyCtx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_target, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} })
        }
        return () => {}
      }
    })
    const dummyCanvas = {
      width: PLATE_WIDTH,
      height: PLATE_HEIGHT,
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }))
      },
      getContext: () => dummyCtx
    } as unknown as HTMLCanvasElement
    return [dummyCanvas, dummyCtx]
  }
  const c = document.createElement('canvas')
  c.width = PLATE_WIDTH
  c.height = PLATE_HEIGHT
  return [c, c.getContext('2d')!]
}

const W = PLATE_WIDTH
const H = PLATE_HEIGHT

// ============================================================================
// VECTOR ART DRAWING PRIMITIVES
// ============================================================================

export function drawCartoonCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 1): void {
  ctx.save()
  ctx.globalAlpha = alpha

  // Base shadow
  ctx.fillStyle = 'rgba(190, 215, 235, 0.7)'
  ctx.beginPath()
  ctx.ellipse(x, y + h * 0.22, w * 0.48, h * 0.32, 0, 0, Math.PI * 2)
  ctx.fill()

  // White puffs
  ctx.fillStyle = '#ffffff'
  const puffs = [
    { dx: -w * 0.34, dy: h * 0.1, r: h * 0.38 },
    { dx: -w * 0.16, dy: -h * 0.14, r: h * 0.52 },
    { dx: w * 0.08, dy: -h * 0.22, r: h * 0.62 },
    { dx: w * 0.28, dy: -h * 0.06, r: h * 0.48 },
    { dx: w * 0.38, dy: h * 0.12, r: h * 0.34 },
    { dx: -w * 0.04, dy: h * 0.12, r: h * 0.42 }
  ]
  for (const p of puffs) {
    ctx.beginPath()
    ctx.arc(x + p.dx, y + p.dy, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawFacetedBoulder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  colors?: { top: string; mid: string; shadow: string }
): void {
  const rand = mulberry32(seed)
  const topC = colors?.top ?? '#edf3f8'
  const midC = colors?.mid ?? '#a2b5c6'
  const shdC = colors?.shadow ?? '#546677'

  // Soft ground shadow under boulder
  ctx.fillStyle = 'rgba(15, 35, 20, 0.35)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + ry * 0.88, rx * 1.05, ry * 0.32, 0, 0, Math.PI * 2)
  ctx.fill()

  // 7 polygon vertices
  const pts: [number, number][] = []
  const count = 7
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI * 0.5
    const dist = 0.85 + rand() * 0.3
    pts.push([cx + Math.cos(angle) * rx * dist, cy + Math.sin(angle) * ry * dist])
  }

  const crestX = cx - rx * 0.12
  const crestY = cy - ry * 0.15

  // Top sunlit facet
  ctx.fillStyle = topC
  ctx.beginPath()
  ctx.moveTo(pts[5][0], pts[5][1])
  ctx.lineTo(pts[6][0], pts[6][1])
  ctx.lineTo(pts[0][0], pts[0][1])
  ctx.lineTo(pts[1][0], pts[1][1])
  ctx.lineTo(crestX, crestY)
  ctx.closePath()
  ctx.fill()

  // Mid facet
  ctx.fillStyle = midC
  ctx.beginPath()
  ctx.moveTo(pts[1][0], pts[1][1])
  ctx.lineTo(pts[2][0], pts[2][1])
  ctx.lineTo(pts[3][0], pts[3][1])
  ctx.lineTo(crestX, crestY)
  ctx.closePath()
  ctx.fill()

  // Shadow facet
  ctx.fillStyle = shdC
  ctx.beginPath()
  ctx.moveTo(pts[3][0], pts[3][1])
  ctx.lineTo(pts[4][0], pts[4][1])
  ctx.lineTo(pts[5][0], pts[5][1])
  ctx.lineTo(crestX, crestY)
  ctx.closePath()
  ctx.fill()

  // Facet crease lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.lineTo(crestX, crestY)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(30, 45, 60, 0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pts[3][0], pts[3][1])
  ctx.lineTo(crestX, crestY)
  ctx.lineTo(pts[5][0], pts[5][1])
  ctx.stroke()
}

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

export function drawLilyPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, hasFlower = false): void {
  // Water shadow
  ctx.fillStyle = 'rgba(8, 35, 60, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 4, rx * 1.04, ry * 1.04, 0, 0, Math.PI * 2)
  ctx.fill()

  // Pad body
  ctx.fillStyle = '#43a047'
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0.3, Math.PI * 2 - 0.3)
  ctx.lineTo(cx, cy)
  ctx.closePath()
  ctx.fill()

  // Pad bright rim
  ctx.strokeStyle = '#81c784'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0.3, Math.PI * 2 - 0.3)
  ctx.stroke()

  // Center radial ribs
  ctx.strokeStyle = '#2e7d32'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let a = 0.5; a < Math.PI * 2 - 0.5; a += 0.8) {
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * rx * 0.75, cy + Math.sin(a) * ry * 0.75)
  }
  ctx.stroke()

  if (hasFlower) {
    ctx.fillStyle = '#ffeb3b'
    ctx.beginPath()
    ctx.arc(cx + rx * 0.1, cy - ry * 0.2, ry * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff9800'
    ctx.beginPath()
    ctx.arc(cx + rx * 0.1, cy - ry * 0.2, ry * 0.2, 0, Math.PI * 2)
    ctx.fill()
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

export function drawOrganicDirtCliff(
  ctx: CanvasRenderingContext2D,
  topY: number,
  cliffH: number,
  seed: number,
  colors?: { soilTop: string; soilBottom: string; grass: string; grassShadow: string }
): void {
  const rand = mulberry32(seed)
  const soilTop = colors?.soilTop ?? '#734623'
  const soilBottom = colors?.soilBottom ?? '#422411'
  const grassCol = colors?.grass ?? '#6db831'
  const grassShd = colors?.grassShadow ?? '#487c1f'

  // Cliff soil body
  const soilG = ctx.createLinearGradient(0, topY, 0, topY + cliffH)
  soilG.addColorStop(0, soilTop)
  soilG.addColorStop(1, soilBottom)
  ctx.fillStyle = soilG
  ctx.beginPath()
  ctx.moveTo(0, topY)
  for (let x = 0; x <= W; x += 120) {
    const dy = Math.sin((x / W) * Math.PI * 4 + rand() * 2) * 8
    ctx.lineTo(x, topY + dy)
  }
  ctx.lineTo(W, topY + cliffH)
  ctx.lineTo(0, topY + cliffH)
  ctx.closePath()
  ctx.fill()

  // Crevices and strata
  ctx.fillStyle = 'rgba(25, 12, 5, 0.32)'
  for (let x = 30; x < W; x += 75) {
    const cw = 18 + rand() * 20
    const cx = x + rand() * 20
    ctx.beginPath()
    ctx.moveTo(cx, topY)
    ctx.quadraticCurveTo(cx - 6, topY + cliffH * 0.5, cx + 4, topY + cliffH)
    ctx.lineTo(cx + cw, topY + cliffH)
    ctx.quadraticCurveTo(cx + cw + 4, topY + cliffH * 0.5, cx + cw - 4, topY)
    ctx.closePath()
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(150, 95, 55, 0.35)'
  ctx.lineWidth = 2.5
  for (let dy = 16; dy < cliffH - 10; dy += 24) {
    ctx.beginPath()
    ctx.moveTo(0, topY + dy)
    for (let x = 0; x <= W; x += 150) {
      ctx.lineTo(x, topY + dy + Math.sin(x * 0.02) * 5)
    }
    ctx.stroke()
  }

  // Tangled hanging roots
  ctx.strokeStyle = '#c48958'
  ctx.lineWidth = 2
  for (let x = 80; x < W - 80; x += 140) {
    const rx = x + rand() * 50
    const rootLen = 25 + rand() * 35
    ctx.beginPath()
    ctx.moveTo(rx, topY + 10)
    ctx.bezierCurveTo(rx - 8, topY + 22, rx + 12, topY + rootLen * 0.6, rx + 2, topY + rootLen)
    ctx.stroke()
  }

  // Grass fringe
  ctx.fillStyle = grassShd
  ctx.beginPath()
  for (let x = 0; x <= W; x += 36) {
    ctx.arc(x, topY + 4, 22, 0, Math.PI)
  }
  ctx.fill()

  ctx.fillStyle = grassCol
  ctx.beginPath()
  for (let x = 0; x <= W; x += 36) {
    ctx.arc(x, topY, 20, 0, Math.PI)
  }
  ctx.fill()
}

export function drawEarthyRiverbank(
  ctx: CanvasRenderingContext2D,
  topY: number,
  seed: number,
  colors?: { soilTop: string; soilBottom: string }
): void {
  const soilTop = colors?.soilTop ?? '#6d3f1c'
  const soilBottom = colors?.soilBottom ?? '#3d200c'

  const g = ctx.createLinearGradient(0, topY, 0, H)
  g.addColorStop(0, soilTop)
  g.addColorStop(1, soilBottom)
  ctx.fillStyle = g

  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, topY + 60)
  ctx.quadraticCurveTo(W * 0.28, topY - 20, W * 0.58, topY + 45)
  ctx.quadraticCurveTo(W * 0.82, topY + 10, W, topY + 30)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#9c5e31'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, topY + 60)
  ctx.quadraticCurveTo(W * 0.28, topY - 20, W * 0.58, topY + 45)
  ctx.quadraticCurveTo(W * 0.82, topY + 10, W, topY + 30)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(70, 35, 15, 0.45)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W * 0.12, topY + 60)
  ctx.quadraticCurveTo(W * 0.35, topY + 35, W * 0.55, topY + 85)
  ctx.stroke()
}

export function drawCenterIsland(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  islandH = 75
): void {
  ctx.fillStyle = 'rgba(10, 40, 70, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.65, rx * 1.08, ry * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()

  const cliffG = ctx.createLinearGradient(cx, cy, cx, cy + islandH)
  cliffG.addColorStop(0, '#8d552c')
  cliffG.addColorStop(1, '#532c12')
  ctx.fillStyle = cliffG
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.4, rx, ry * 0.45, 0, 0, Math.PI)
  ctx.ellipse(cx, cy, rx, ry * 0.45, 0, Math.PI, 0, true)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#42210b'
  for (let dx = -rx * 0.85; dx <= rx * 0.85; dx += 28) {
    ctx.fillRect(cx + dx, cy, 10, islandH * 0.42)
  }

  const grassG = ctx.createRadialGradient(cx, cy - ry * 0.25, 0, cx, cy, rx)
  grassG.addColorStop(0, '#8fd843')
  grassG.addColorStop(0.65, '#68b329')
  grassG.addColorStop(1.0, '#4a8e1b')
  ctx.fillStyle = grassG
  ctx.beginPath()
  ctx.ellipse(cx, cy - 8, rx, ry * 0.62, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.55, rx * 1.15, ry * 0.6, 0, 0, Math.PI * 2)
  ctx.stroke()
}

export function drawNaturalPond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number
): void {
  const rand = mulberry32(seed)

  ctx.fillStyle = '#8d5d34'
  ctx.beginPath()
  const rimCount = 28
  for (let i = 0; i <= rimCount; i++) {
    const a = (i / rimCount) * Math.PI * 2
    const d = 1.08 + Math.sin(a * 4 + rand()) * 0.08
    const px = cx + Math.cos(a) * rx * d
    const py = cy + Math.sin(a) * ry * d
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()

  const waterG = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry)
  waterG.addColorStop(0, '#38bdf8')
  waterG.addColorStop(0.6, '#0284c7')
  waterG.addColorStop(1.0, '#0369a1')
  ctx.fillStyle = waterG
  ctx.beginPath()
  for (let i = 0; i <= rimCount; i++) {
    const a = (i / rimCount) * Math.PI * 2
    const d = 0.98 + Math.sin(a * 4 + rand()) * 0.07
    const px = cx + Math.cos(a) * rx * d
    const py = cy + Math.sin(a) * ry * d
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx - rx * 0.2, cy - ry * 0.2, rx * 0.35, ry * 0.25, 0, 0.2, Math.PI * 0.9)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx + rx * 0.25, cy + ry * 0.15, rx * 0.4, ry * 0.28, 0, Math.PI * 0.8, Math.PI * 1.7)
  ctx.stroke()
}

// ============================================================================
// NAMED PLATE GENERATORS (Referenced in JSON)
// ============================================================================

export function drawSunnySky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1e88e5')
  g.addColorStop(0.35, '#42a5f5')
  g.addColorStop(0.7, '#90caf9')
  g.addColorStop(1.0, '#e3f2fd')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  drawCartoonCloud(ctx, 360, 240, 480, 150, 0.95)
  drawCartoonCloud(ctx, 1100, 180, 640, 190, 0.9)
  drawCartoonCloud(ctx, 1880, 230, 520, 160, 0.95)
  drawCartoonCloud(ctx, 2380, 190, 400, 140, 0.85)
  return c
}

export function drawDistantMountains(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#79a8cb'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.18, 410, W * 0.35, 520)
  ctx.quadraticCurveTo(W * 0.52, 380, W * 0.72, 530)
  ctx.quadraticCurveTo(W * 0.88, 420, W, 500)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#548ea8'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 610)
  ctx.quadraticCurveTo(W * 0.16, 500, W * 0.32, 590)
  ctx.quadraticCurveTo(W * 0.48, 480, W * 0.66, 610)
  ctx.quadraticCurveTo(W * 0.84, 510, W, 580)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  const haze = ctx.createLinearGradient(0, 580, 0, H)
  haze.addColorStop(0, 'rgba(227, 242, 253, 0)')
  haze.addColorStop(1, 'rgba(227, 242, 253, 0.75)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 580, W, H - 580)
  return c
}

export function drawRollingGreenHills(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#55a038'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 690)
  ctx.quadraticCurveTo(W * 0.28, 570, W * 0.6, 670)
  ctx.quadraticCurveTo(W * 0.82, 590, W, 650)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, 420, 630, 130, 55, 111)
  drawFoliageCloud(ctx, 1180, 610, 150, 60, 222)
  drawFoliageCloud(ctx, 1980, 640, 140, 56, 333)

  ctx.fillStyle = '#6bbd3a'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 750)
  ctx.quadraticCurveTo(W * 0.35, 650, W * 0.72, 770)
  ctx.quadraticCurveTo(W * 0.9, 710, W, 750)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
  return c
}

export function drawRiverAndMeadowFloor(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  ctx.strokeStyle = '#43a047'
  ctx.lineWidth = 2.5
  const randTuft = mulberry32(1010)
  for (let x = 60; x < W - 60; x += 85) {
    const ty = meadowTopY + 12 + randTuft() * 35
    ctx.beginPath()
    ctx.moveTo(x - 8, ty + 12)
    ctx.quadraticCurveTo(x - 12, ty, x - 16, ty - 12)
    ctx.moveTo(x, ty + 12)
    ctx.quadraticCurveTo(x, ty - 2, x - 2, ty - 16)
    ctx.moveTo(x + 8, ty + 12)
    ctx.quadraticCurveTo(x + 12, ty, x + 16, ty - 12)
    ctx.stroke()
  }

  drawFacetedBoulder(ctx, 760, cliffTopY - 26, 68, 46, 101)
  drawFacetedBoulder(ctx, 1340, cliffTopY - 22, 54, 38, 202)
  drawFacetedBoulder(ctx, 1860, cliffTopY - 28, 62, 44, 303)

  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 555)

  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#38bdf8')
  riverG.addColorStop(0.45, '#0ea5e9')
  riverG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 2.5
  for (let y = riverTopY + 25; y < H - 20; y += 38) {
    for (let x = 40; x < W; x += 300) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 80, y - 6, x + 160, y)
      ctx.stroke()
    }
  }

  drawLilyPad(ctx, 450, riverTopY + 45, 68, 25, false)
  drawLilyPad(ctx, 1120, riverTopY + 95, 88, 30, true)
  drawLilyPad(ctx, 1880, riverTopY + 55, 78, 28, true)
  drawLilyPad(ctx, 1520, riverTopY + 110, 70, 24, false)
  return c
}

export function drawMidgroundTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 512,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 714,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  drawFoliageCloud(ctx, 280, groundY - 30, 95, 52, 881)
  drawFoliageCloud(ctx, 620, groundY - 25, 115, 58, 882)
  drawFoliageCloud(ctx, 2020, groundY - 25, 105, 55, 883)
  drawFoliageCloud(ctx, 2380, groundY - 30, 120, 60, 884)

  drawFacetedBoulder(ctx, 330, groundY - 10, 52, 38, 404)
  drawFacetedBoulder(ctx, 2320, groundY - 10, 58, 42, 505)
  return c
}

export function drawForegroundRiverbankFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(220, 820)
  ctx.quadraticCurveTo(340, 980, 480, 1180)
  ctx.lineTo(200, 1240)
  ctx.lineTo(100, 1080)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#4e2f17'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(80, 1150)
  ctx.quadraticCurveTo(190, 850, 210, 480)
  ctx.stroke()

  ctx.strokeStyle = '#9c683d'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(120, 1150)
  ctx.quadraticCurveTo(220, 850, 235, 480)
  ctx.stroke()

  drawFoliageCloud(ctx, 320, 180, 320, 170, 901)
  drawFoliageCloud(ctx, 620, 220, 340, 180, 902)

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 220, 140, W - 620, 220)
  ctx.lineTo(W - 600, 270)
  ctx.quadraticCurveTo(W - 180, 210, W + 40, 120)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, W - 240, 180, 360, 180, 904)
  drawFoliageCloud(ctx, W - 620, 240, 340, 170, 905)

  drawEarthyRiverbank(ctx, 1040, 777)
  drawFacetedBoulder(ctx, 1840, 1110, 140, 90, 778, { top: '#e0c8b0', mid: '#b08b68', shadow: '#6a4a2e' })

  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1)
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1)

  return c
}

export function drawPastelSky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#90caf9')
  g.addColorStop(0.45, '#bbdefb')
  g.addColorStop(0.85, '#e3f2fd')
  g.addColorStop(1.0, '#f0f9ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  drawCartoonCloud(ctx, 420, 220, 520, 160, 0.9)
  drawCartoonCloud(ctx, 1240, 170, 660, 190, 0.85)
  drawCartoonCloud(ctx, 2020, 240, 480, 150, 0.9)
  return c
}

export function drawPurpleMountainPeaks(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#8f9db5'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.22, 360, W * 0.42, 510)
  ctx.quadraticCurveTo(W * 0.6, 340, W * 0.78, 520)
  ctx.quadraticCurveTo(W * 0.9, 430, W, 500)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  const haze = ctx.createLinearGradient(0, 520, 0, H)
  haze.addColorStop(0, 'rgba(240, 249, 255, 0)')
  haze.addColorStop(1, 'rgba(240, 249, 255, 0.8)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 520, W, H - 520)
  return c
}

export function drawRollingHillsAndHedges(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#61aa34'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 680)
  ctx.quadraticCurveTo(W * 0.3, 580, W * 0.65, 680)
  ctx.quadraticCurveTo(W * 0.85, 610, W, 670)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, 360, 640, 180, 75, 411)
  drawFoliageCloud(ctx, 740, 660, 200, 80, 412)
  drawFoliageCloud(ctx, 1680, 670, 210, 85, 413)
  drawFoliageCloud(ctx, 2080, 650, 190, 78, 414)
  return c
}

export function drawCenterIslandPond(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const pondTopY = 740

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, pondTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, pondTopY - meadowTopY)

  const pondG = ctx.createLinearGradient(0, pondTopY, 0, H)
  pondG.addColorStop(0, '#38bdf8')
  pondG.addColorStop(0.5, '#0ea5e9')
  pondG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = pondG
  ctx.fillRect(0, pondTopY, W, H - pondTopY)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 2.5
  for (let y = pondTopY + 25; y < H - 20; y += 42) {
    for (let x = 60; x < W; x += 320) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 70, y - 6, x + 140, y)
      ctx.stroke()
    }
  }

  drawCenterIsland(ctx, 1200, 870, 260, 110, 80)
  return c
}

export function drawIslandPondTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 420, groundY - 15, 710, 460, {
    seed: 611,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  drawUprightTieredTree(ctx, 2140, groundY - 10, 760, 440, {
    seed: 622,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  drawFacetedBoulder(ctx, 580, groundY + 10, 95, 65, 801)
  drawFacetedBoulder(ctx, 720, groundY + 25, 75, 52, 802)
  return c
}

export function drawForegroundBroadleafFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  drawFoliageCloud(ctx, 240, 160, 320, 160, 911)
  drawFoliageCloud(ctx, 600, 200, 340, 170, 912)

  drawFoliageCloud(ctx, W - 240, 170, 340, 170, 913)
  drawFoliageCloud(ctx, W - 580, 210, 320, 160, 914)

  ctx.fillStyle = '#4a8e1b'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 1140)
  ctx.quadraticCurveTo(W * 0.3, 1080, W * 0.5, 1120)
  ctx.quadraticCurveTo(W * 0.8, 1080, W, 1140)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawFacetedBoulder(ctx, 260, 1120, 150, 105, 931)
  drawFacetedBoulder(ctx, 420, 1150, 120, 85, 932)
  drawFacetedBoulder(ctx, W - 260, 1120, 150, 105, 933)
  drawFacetedBoulder(ctx, W - 420, 1150, 120, 85, 934)

  drawBroadleafPlant(ctx, 160, 1230, 2.6, 1)
  drawBroadleafPlant(ctx, 320, 1250, 2.1, 1)
  drawBroadleafPlant(ctx, W - 160, 1230, 2.6, -1)
  drawBroadleafPlant(ctx, W - 320, 1250, 2.1, -1)

  return c
}

export function drawSlopingPastureAndPine(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#5ba532'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 720)
  ctx.quadraticCurveTo(W * 0.35, 680, W * 0.7, 600)
  ctx.lineTo(W, 520)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  drawPineTree(ctx, 360, 680, 260, 130)

  drawStylizedTree(ctx, 1420, 630, 360, 240, {
    seed: 331,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342' }
  })
  return c
}

export function drawLagoonAndShore(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, H)
  grassG.addColorStop(0, '#78c73b')
  grassG.addColorStop(0.5, '#5aa32a')
  grassG.addColorStop(1.0, '#3e7c1a')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, H - meadowTopY)

  drawNaturalPond(ctx, 1200, 880, 520, 180, 999)
  return c
}

export function drawMidgroundBoulderClusters(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  drawFacetedBoulder(ctx, 1720, 820, 80, 55, 711)
  drawFacetedBoulder(ctx, 1860, 800, 110, 80, 712)
  drawFacetedBoulder(ctx, 2040, 830, 130, 90, 713)

  drawFacetedBoulder(ctx, 620, 810, 95, 68, 714)
  drawFacetedBoulder(ctx, 480, 830, 120, 85, 715)

  drawFoliageCloud(ctx, 840, 820, 140, 65, 831)
  drawFoliageCloud(ctx, 1540, 810, 150, 70, 832)
  return c
}

export function drawForegroundLagoonFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(-40, 40)
  ctx.quadraticCurveTo(240, 120, 580, 200)
  ctx.lineTo(560, 250)
  ctx.quadraticCurveTo(200, 190, -40, 120)
  ctx.closePath()
  ctx.fill()
  drawFoliageCloud(ctx, 320, 180, 340, 170, 941)
  drawFoliageCloud(ctx, 640, 220, 320, 160, 942)

  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 240, 120, W - 580, 200)
  ctx.lineTo(W - 560, 250)
  ctx.quadraticCurveTo(W - 200, 190, W + 40, 120)
  ctx.closePath()
  ctx.fill()
  drawFoliageCloud(ctx, W - 320, 180, 340, 170, 943)
  drawFoliageCloud(ctx, W - 640, 220, 320, 160, 944)

  drawFacetedBoulder(ctx, 280, 1100, 160, 115, 951)
  drawFacetedBoulder(ctx, 450, 1150, 130, 90, 952)
  drawFacetedBoulder(ctx, W - 280, 1100, 160, 115, 953)
  drawFacetedBoulder(ctx, W - 450, 1150, 130, 90, 954)

  drawFoliageCloud(ctx, 1200, 1180, 260, 90, 961)
  drawFoliageCloud(ctx, 880, 1190, 200, 80, 962)
  drawFoliageCloud(ctx, 1520, 1190, 200, 80, 963)
  return c
}

export function drawSunsetSky(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1a103c')
  g.addColorStop(0.32, '#511b5e')
  g.addColorStop(0.62, '#b7385a')
  g.addColorStop(0.82, '#f46c43')
  g.addColorStop(1.0, '#fed174')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const sx = W * 0.65
  const sy = 680
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 550)
  glow.addColorStop(0, 'rgba(255, 252, 230, 0.98)')
  glow.addColorStop(0.15, 'rgba(255, 195, 105, 0.72)')
  glow.addColorStop(0.4, 'rgba(240, 100, 70, 0.22)')
  glow.addColorStop(1, 'rgba(180, 50, 80, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff7e6'
  ctx.beginPath()
  ctx.arc(sx, sy, 72, 0, Math.PI * 2)
  ctx.fill()

  drawCartoonCloud(ctx, 420, 260, 540, 160, 0.75)
  drawCartoonCloud(ctx, 1280, 210, 640, 180, 0.7)
  drawCartoonCloud(ctx, 2140, 250, 480, 150, 0.75)
  return c
}

export function drawTwilightMountains(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  ctx.fillStyle = '#5c2d68'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 560)
  ctx.quadraticCurveTo(W * 0.2, 410, W * 0.4, 520)
  ctx.quadraticCurveTo(W * 0.58, 390, W * 0.75, 540)
  ctx.quadraticCurveTo(W * 0.9, 450, W, 520)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 190, 120, 0.75)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(0, 560)
  ctx.quadraticCurveTo(W * 0.2, 410, W * 0.4, 520)
  ctx.quadraticCurveTo(W * 0.58, 390, W * 0.75, 540)
  ctx.quadraticCurveTo(W * 0.9, 450, W, 520)
  ctx.stroke()
  return c
}

export function drawTwilightRiverFloor(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#5a6d2b')
  grassG.addColorStop(1, '#3d4d1d')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 771, {
    soilTop: '#5c321d',
    soilBottom: '#32190d',
    grass: '#4d6824',
    grassShadow: '#283812'
  })

  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#e65100')
  riverG.addColorStop(0.4, '#ad1457')
  riverG.addColorStop(1.0, '#4a148c')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  ctx.strokeStyle = 'rgba(255, 215, 150, 0.5)'
  ctx.lineWidth = 2.5
  for (let y = riverTopY + 25; y < H - 20; y += 42) {
    for (let x = 40; x < W; x += 300) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + 80, y - 6, x + 160, y)
      ctx.stroke()
    }
  }

  drawLilyPad(ctx, 480, riverTopY + 50, 68, 25, false)
  drawLilyPad(ctx, 1180, riverTopY + 105, 88, 30, true)
  drawLilyPad(ctx, 1840, riverTopY + 65, 78, 28, true)
  return c
}

export function drawTwilightTrees(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()
  const groundY = 740

  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 881,
    curveDir: 1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })

  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 882,
    curveDir: -1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })
  return c
}

export function drawTwilightForegroundFraming(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  ctx.fillStyle = '#4e2f17'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 171, 64, 0.65)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(180, 850)
  ctx.quadraticCurveTo(240, 480, 255, 180)
  ctx.stroke()

  drawFoliageCloud(ctx, 320, 180, 320, 170, 971, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })
  drawFoliageCloud(ctx, 620, 220, 340, 180, 972, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })

  ctx.fillStyle = '#4e2f17'
  ctx.beginPath()
  ctx.moveTo(W + 40, 40)
  ctx.quadraticCurveTo(W - 220, 140, W - 620, 220)
  ctx.lineTo(W - 600, 270)
  ctx.quadraticCurveTo(W - 180, 210, W + 40, 120)
  ctx.closePath()
  ctx.fill()

  drawFoliageCloud(ctx, W - 240, 180, 360, 180, 973, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })
  drawFoliageCloud(ctx, W - 620, 240, 340, 170, 974, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })

  drawEarthyRiverbank(ctx, 1040, 888, { soilTop: '#4a2512', soilBottom: '#281308' })

  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })

  return c
}

export function drawDriftingMistPlate(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // 1. Base rolling haze band across the bottom/mid height
  const grad1 = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.85)
  grad1.addColorStop(0, 'rgba(235, 245, 255, 0)')
  grad1.addColorStop(0.35, 'rgba(235, 248, 255, 0.42)')
  grad1.addColorStop(0.65, 'rgba(225, 240, 255, 0.35)')
  grad1.addColorStop(1, 'rgba(215, 235, 250, 0)')

  ctx.fillStyle = grad1
  ctx.beginPath()
  ctx.moveTo(0, H * 0.6)
  ctx.bezierCurveTo(W * 0.25, H * 0.48, W * 0.45, H * 0.68, W * 0.7, H * 0.52)
  ctx.bezierCurveTo(W * 0.85, H * 0.42, W * 0.95, H * 0.6, W, H * 0.55)
  ctx.lineTo(W, H * 0.82)
  ctx.bezierCurveTo(W * 0.8, H * 0.88, W * 0.5, H * 0.75, W * 0.3, H * 0.85)
  ctx.lineTo(0, H * 0.8)
  ctx.closePath()
  ctx.fill()

  // 2. Soft billowy mist puffs along the valley
  const puffs = [
    { x: W * 0.15, y: H * 0.58, rx: 320, ry: 90, a: 0.38 },
    { x: W * 0.35, y: H * 0.52, rx: 420, ry: 110, a: 0.45 },
    { x: W * 0.55, y: H * 0.62, rx: 380, ry: 100, a: 0.4 },
    { x: W * 0.75, y: H * 0.48, rx: 440, ry: 120, a: 0.48 },
    { x: W * 0.92, y: H * 0.56, rx: 340, ry: 95, a: 0.36 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(245, 250, 255, ${p.a})`)
    rad.addColorStop(0.5, `rgba(235, 245, 255, ${p.a * 0.6})`)
    rad.addColorStop(1, 'rgba(230, 240, 255, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 3. Lower riverbed wisps
  const grad2 = ctx.createLinearGradient(0, H * 0.65, 0, H * 0.95)
  grad2.addColorStop(0, 'rgba(240, 248, 255, 0)')
  grad2.addColorStop(0.4, 'rgba(230, 245, 255, 0.32)')
  grad2.addColorStop(1, 'rgba(220, 238, 252, 0)')
  ctx.fillStyle = grad2
  ctx.beginPath()
  ctx.moveTo(0, H * 0.72)
  ctx.bezierCurveTo(W * 0.3, H * 0.82, W * 0.6, H * 0.68, W, H * 0.76)
  ctx.lineTo(W, H * 0.92)
  ctx.bezierCurveTo(W * 0.7, H * 0.98, W * 0.3, H * 0.88, 0, H * 0.95)
  ctx.closePath()
  ctx.fill()

  return c
}

export function drawDriftingMountainClouds(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // Mid-altitude cloud blanket drifting through mountain ridges
  const puffs = [
    { x: W * 0.1, y: H * 0.32, rx: 480, ry: 120, a: 0.42 },
    { x: W * 0.38, y: H * 0.38, rx: 550, ry: 140, a: 0.5 },
    { x: W * 0.65, y: H * 0.28, rx: 600, ry: 130, a: 0.45 },
    { x: W * 0.88, y: H * 0.36, rx: 450, ry: 110, a: 0.4 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(255, 255, 255, ${p.a})`)
    rad.addColorStop(0.6, `rgba(240, 245, 252, ${p.a * 0.5})`)
    rad.addColorStop(1, 'rgba(235, 242, 250, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, -0.04, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

export function drawDriftingTwilightMist(): HTMLCanvasElement {
  const [c, ctx] = createPlateCanvas()

  // Warm sunset tinted valley mist
  const puffs = [
    { x: W * 0.2, y: H * 0.55, rx: 420, ry: 110, a: 0.4 },
    { x: W * 0.45, y: H * 0.5, rx: 520, ry: 130, a: 0.48 },
    { x: W * 0.72, y: H * 0.58, rx: 480, ry: 120, a: 0.44 },
    { x: W * 0.95, y: H * 0.52, rx: 380, ry: 100, a: 0.38 }
  ]
  for (const p of puffs) {
    const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx)
    rad.addColorStop(0, `rgba(255, 224, 185, ${p.a})`)
    rad.addColorStop(0.5, `rgba(240, 190, 160, ${p.a * 0.55})`)
    rad.addColorStop(1, 'rgba(210, 150, 140, 0)')
    ctx.fillStyle = rad
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0.02, 0, Math.PI * 2)
    ctx.fill()
  }

  return c
}

/** Registry of all available procedural vector background generators. */
export const PLATE_GENERATORS: Record<string, () => HTMLCanvasElement> = {
  sunny_sky: drawSunnySky,
  distant_mountains: drawDistantMountains,
  rolling_green_hills: drawRollingGreenHills,
  river_and_meadow_floor: drawRiverAndMeadowFloor,
  midground_trees: drawMidgroundTrees,
  foreground_riverbank_framing: drawForegroundRiverbankFraming,
  pastel_sky: drawPastelSky,
  purple_mountain_peaks: drawPurpleMountainPeaks,
  rolling_hills_and_hedges: drawRollingHillsAndHedges,
  center_island_pond: drawCenterIslandPond,
  island_pond_trees: drawIslandPondTrees,
  foreground_broadleaf_framing: drawForegroundBroadleafFraming,
  sloping_pasture_and_pine: drawSlopingPastureAndPine,
  lagoon_and_shore: drawLagoonAndShore,
  midground_boulder_clusters: drawMidgroundBoulderClusters,
  foreground_lagoon_framing: drawForegroundLagoonFraming,
  sunset_sky: drawSunsetSky,
  twilight_mountains: drawTwilightMountains,
  twilight_river_floor: drawTwilightRiverFloor,
  twilight_trees: drawTwilightTrees,
  twilight_foreground_framing: drawTwilightForegroundFraming,
  drifting_low_mist: drawDriftingMistPlate,
  drifting_mountain_clouds: drawDriftingMountainClouds,
  drifting_twilight_mist: drawDriftingTwilightMist
}

