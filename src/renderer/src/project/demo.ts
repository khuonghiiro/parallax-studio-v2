import type { Layer, Project, Vec3 } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { mulberry32, referenceDistance } from '../animation/math'
import { buildCameraPath } from '../animation/cameraPath'
import { assetStore } from './assets'
import { createImageLayer, createParticleLayer, createProject, createShot, createTextLayer, shotSpacing } from './factory'

/**
 * Builds a 4-shot 2.5D animation landscape journey inspired directly by
 * authentic vector animation backgrounds (e.g. Disney / Pixar / Studio Ghibli style):
 *
 * 1. Emerald Riverbank (Ref Image 1: Dirt cliff strata, hanging roots, blue river with lily pads,
 *    curving bottom earth bank with boulder, giant flared-root oak tree & broadleaf plants)
 * 2. Highland Island Pond (Ref Image 2: Center island knoll with earthen base, rolling green hills,
 *    curved & upright trees, huge tropical broadleaf plants with veins & faceted boulders framing corners)
 * 3. Highland Lagoon & Boulder Ridge (Ref Image 3: Naturally contoured pond, sharp faceted boulder clusters,
 *    sloping hillside with pine tree & deciduous trees, tiered lush bush mounds)
 * 4. Twilight Valley (Lush sunset valley with glowing evening river, violet mountains & amber rim lights)
 */

// 16:9 canvas calibrated so screen (1920x1080) sits dead-center with 240px X and 135px Y parallax bleed.
const W = 2400
const H = 1350

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return [c, c.getContext('2d')!]
}

// ============================================================================
// VECTOR ART DRAWING PRIMITIVES (Faithful to Reference Images)
// ============================================================================

/** Fluffy cartoon cumulus cloud with white puffs and soft blue-grey undershadow. */
function drawCartoonCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 1): void {
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

/** Faceted boulder with sharp highlight, mid-tone, and shadow facets (as in all 3 reference images). */
function drawFacetedBoulder(
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

/** Scalloped cloud-like leaf canopy cluster (as seen in all 3 reference images). */
function drawFoliageCloud(
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

/** Pine / evergreen tree with tiered conical boughs (as in Ref Image 3). */
function drawPineTree(
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

  // 4 tiers of pine foliage from bottom to top
  const tiers = [
    { y: baseY - h * 0.25, tw: w, th: h * 0.32 },
    { y: baseY - h * 0.48, tw: w * 0.8, th: h * 0.3 },
    { y: baseY - h * 0.7, tw: w * 0.6, th: h * 0.28 },
    { y: baseY - h * 0.9, tw: w * 0.38, th: h * 0.25 }
  ]

  for (const t of tiers) {
    // Shadow tier
    ctx.fillStyle = shd
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.5, t.y)
    ctx.quadraticCurveTo(cx, t.y + 12, cx + t.tw * 0.5, t.y)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()

    // Mid tier
    ctx.fillStyle = mid
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.45, t.y - 4)
    ctx.quadraticCurveTo(cx, t.y + 6, cx + t.tw * 0.45, t.y - 4)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()

    // Sunlit left face
    ctx.fillStyle = lgt
    ctx.beginPath()
    ctx.moveTo(cx - t.tw * 0.45, t.y - 4)
    ctx.quadraticCurveTo(cx - t.tw * 0.1, t.y, cx, t.y - 4)
    ctx.lineTo(cx, t.y - t.th)
    ctx.closePath()
    ctx.fill()
  }
}

/** Stylized deciduous / oak tree with curved woody trunk, flared buttress roots, and cloud canopy clusters. */
function drawStylizedTree(
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
  const rand = mulberry32(opts.seed)
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
  // Left flared root
  ctx.moveTo(cx - trunkBaseW * 1.35, baseY)
  ctx.quadraticCurveTo(cx - trunkBaseW * 0.4, baseY - h * 0.2, cx - trunkBaseW * 0.3 + dir * 30, baseY - h * 0.55)
  // Left branch limb
  ctx.quadraticCurveTo(cx - w * 0.3, baseY - h * 0.7, cx - w * 0.42, baseY - h * 0.8)
  ctx.lineTo(cx - w * 0.34, baseY - h * 0.84)
  ctx.quadraticCurveTo(cx - w * 0.18, baseY - h * 0.72, cx + dir * 15, baseY - h * 0.65)
  // Right branch limb
  ctx.quadraticCurveTo(cx + w * 0.25, baseY - h * 0.75, cx + w * 0.4, baseY - h * 0.82)
  ctx.lineTo(cx + w * 0.46, baseY - h * 0.78)
  ctx.quadraticCurveTo(cx + trunkBaseW * 0.35, baseY - h * 0.6, cx + trunkBaseW * 0.4 + dir * 30, baseY - h * 0.4)
  // Right flared root
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

/** Upright tiered deciduous tree (as in Ref Image 2 right side). */
function drawUprightTieredTree(
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

/** Floating lily pad with leaf notch and yellow water-lily blossom (Ref Image 1). */
function drawLilyPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, hasFlower = false): void {
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

/** Large tropical broadleaf plant with central & side veins (as in Ref Image 2 bottom-corners). */
function drawBroadleafPlant(
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

    // Leaf blade outline
    ctx.fillStyle = baseC
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.8, -lf.len * 0.5, 0, -lf.len)
    ctx.quadraticCurveTo(-lf.w * 0.8, -lf.len * 0.5, 0, 0)
    ctx.closePath()
    ctx.fill()

    // Half leaf lighter green
    ctx.fillStyle = halfC
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.8, -lf.len * 0.5, 0, -lf.len)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()

    // Central vein
    ctx.strokeStyle = veinC
    ctx.lineWidth = 3 * scale
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(lf.w * 0.08, -lf.len * 0.5, 0, -lf.len)
    ctx.stroke()

    // Side veins
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

/**
 * Organic Dirt Cliff Cross-section (Iconic from Ref Image 1):
 * Wavy upper edge with overhanging grass fringe, rich warm brown soil strata,
 * vertical erosion crevices, and hanging tree roots.
 */
function drawOrganicDirtCliff(
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

  // 1. Cliff soil body
  const soilG = ctx.createLinearGradient(0, topY, 0, topY + cliffH)
  soilG.addColorStop(0, soilTop)
  soilG.addColorStop(1, soilBottom)
  ctx.fillStyle = soilG
  ctx.beginPath()
  ctx.moveTo(0, topY)
  // Wavy cliff top line
  for (let x = 0; x <= W; x += 120) {
    const dy = Math.sin((x / W) * Math.PI * 4 + rand() * 2) * 8
    ctx.lineTo(x, topY + dy)
  }
  ctx.lineTo(W, topY + cliffH)
  ctx.lineTo(0, topY + cliffH)
  ctx.closePath()
  ctx.fill()

  // 2. Vertical shaded soil crevices and strata bands
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

  // Horizontal subtle strata lines
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

  // 3. Tangled roots dangling down from the cliff
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

  // 4. Overhanging grass fringe with soft cast shadow underneath
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

/**
 * Lower Riverbank Cutaway (From Ref Image 1 bottom):
 * Organic curved bank at the bottom of the screen with warm brown soil and roots.
 */
function drawEarthyRiverbank(
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

  // Soft upper rim highlight along bank curve
  ctx.strokeStyle = '#9c5e31'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, topY + 60)
  ctx.quadraticCurveTo(W * 0.28, topY - 20, W * 0.58, topY + 45)
  ctx.quadraticCurveTo(W * 0.82, topY + 10, W, topY + 30)
  ctx.stroke()

  // Root lines along bank
  ctx.strokeStyle = 'rgba(70, 35, 15, 0.45)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W * 0.12, topY + 60)
  ctx.quadraticCurveTo(W * 0.35, topY + 35, W * 0.55, topY + 85)
  ctx.stroke()
}

/**
 * Center Island Knoll (Iconic from Ref Image 2):
 * Elevated grass knoll with earthy cliff base sitting in the middle of a pond.
 */
function drawCenterIsland(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  islandH = 75
): void {
  // 1. Water shadow under island
  ctx.fillStyle = 'rgba(10, 40, 70, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.65, rx * 1.08, ry * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()

  // 2. Earthy cliff base of the island
  const cliffG = ctx.createLinearGradient(cx, cy, cx, cy + islandH)
  cliffG.addColorStop(0, '#8d552c')
  cliffG.addColorStop(1, '#532c12')
  ctx.fillStyle = cliffG
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.4, rx, ry * 0.45, 0, 0, Math.PI)
  ctx.ellipse(cx, cy, rx, ry * 0.45, 0, Math.PI, 0, true)
  ctx.closePath()
  ctx.fill()

  // Vertical soil texture on the island cliff
  ctx.fillStyle = '#42210b'
  for (let dx = -rx * 0.85; dx <= rx * 0.85; dx += 28) {
    ctx.fillRect(cx + dx, cy, 10, islandH * 0.42)
  }

  // 3. Lush domed green grass cap
  const grassG = ctx.createRadialGradient(cx, cy - ry * 0.25, 0, cx, cy, rx)
  grassG.addColorStop(0, '#8fd843')
  grassG.addColorStop(0.65, '#68b329')
  grassG.addColorStop(1.0, '#4a8e1b')
  ctx.fillStyle = grassG
  ctx.beginPath()
  ctx.ellipse(cx, cy - 8, rx, ry * 0.62, 0, 0, Math.PI * 2)
  ctx.fill()

  // Water ripple ring around island
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cy + islandH * 0.55, rx * 1.15, ry * 0.6, 0, 0, Math.PI * 2)
  ctx.stroke()
}

/** Naturally contoured pond / lagoon (as in Ref Image 3). */
function drawNaturalPond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number
): void {
  const rand = mulberry32(seed)

  // 1. Earth/clay shore rim
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

  // 2. Clear azure water
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

  // Water ripple highlights
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
// SHOT 1: EMERALD RIVERBANK (Authentic Ref Image 1 Style)
// ============================================================================

function drawSunnySky(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1e88e5')
  g.addColorStop(0.35, '#42a5f5')
  g.addColorStop(0.7, '#90caf9')
  g.addColorStop(1.0, '#e3f2fd')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Fluffy cartoon clouds
  drawCartoonCloud(ctx, 360, 240, 480, 150, 0.95)
  drawCartoonCloud(ctx, 1100, 180, 640, 190, 0.9)
  drawCartoonCloud(ctx, 1880, 230, 520, 160, 0.95)
  drawCartoonCloud(ctx, 2380, 190, 400, 140, 0.85)
  return c
}

function drawDistantMountains(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Ridge 1: Far blue mountains
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

  // Ridge 2: Mid teal-blue mountains
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

  // Atmospheric haze at base
  const haze = ctx.createLinearGradient(0, 580, 0, H)
  haze.addColorStop(0, 'rgba(227, 242, 253, 0)')
  haze.addColorStop(1, 'rgba(227, 242, 253, 0.75)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 580, W, H - 580)
  return c
}

function drawRollingGreenHills(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Hill 1: Far meadow hill
  ctx.fillStyle = '#55a038'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 690)
  ctx.quadraticCurveTo(W * 0.28, 570, W * 0.6, 670)
  ctx.quadraticCurveTo(W * 0.82, 590, W, 650)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Bush clumps along the crest
  drawFoliageCloud(ctx, 420, 630, 130, 55, 111)
  drawFoliageCloud(ctx, 1180, 610, 150, 60, 222)
  drawFoliageCloud(ctx, 1980, 640, 140, 56, 333)

  // Hill 2: Mid vibrant green hill
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

/** River, floating lily pads, and cutaway earthy riverbank (Exact Ref Image 1). */
function drawRiverAndMeadowFloor(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  // 1. Lush green meadow on top
  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  // Grass blade tufts on meadow
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

  // Faceted boulders resting on the upper meadow (Ref Image 1)
  drawFacetedBoulder(ctx, 760, cliffTopY - 26, 68, 46, 101)
  drawFacetedBoulder(ctx, 1340, cliffTopY - 22, 54, 38, 202)
  drawFacetedBoulder(ctx, 1860, cliffTopY - 28, 62, 44, 303)

  // 2. Organic dirt cliff with hanging roots & strata (Ref Image 1)
  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 555)

  // 3. Clear sparkling blue river flowing across
  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#38bdf8')
  riverG.addColorStop(0.45, '#0ea5e9')
  riverG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  // Water wave reflections
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

  // Floating green lily pads with yellow water-lily flowers (Ref Image 1)
  drawLilyPad(ctx, 450, riverTopY + 45, 68, 25, false)
  drawLilyPad(ctx, 1120, riverTopY + 95, 88, 30, true)
  drawLilyPad(ctx, 1880, riverTopY + 55, 78, 28, true)
  drawLilyPad(ctx, 1520, riverTopY + 110, 70, 24, false)
  return c
}

function drawMidgroundTrees(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const groundY = 740

  // Left knoll tree
  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 512,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  // Right knoll tree
  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 714,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#aed581' }
  })

  // Flanking bushes
  drawFoliageCloud(ctx, 280, groundY - 30, 95, 52, 881)
  drawFoliageCloud(ctx, 620, groundY - 25, 115, 58, 882)
  drawFoliageCloud(ctx, 2020, groundY - 25, 105, 55, 883)
  drawFoliageCloud(ctx, 2380, groundY - 30, 120, 60, 884)

  drawFacetedBoulder(ctx, 330, groundY - 10, 52, 38, 404)
  drawFacetedBoulder(ctx, 2320, groundY - 10, 58, 42, 505)
  return c
}

/**
 * Foreground Framing (Ref Image 1):
 * - Giant oak tree trunk on the left with prominent buttress roots grasping the lower riverbank.
 * - Arching leafy canopy branch from top-right.
 * - Bottom earthy riverbank cutaway curving across the bottom with roots and boulder.
 * - Tropical broadleaf plants in bottom corners.
 */
function drawForegroundFraming(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // 1. Giant tree trunk on left edge (Ref Image 1)
  ctx.fillStyle = '#7a4e2a'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  // Flared buttress roots reaching across the bottom bank
  ctx.beginPath()
  ctx.moveTo(220, 820)
  ctx.quadraticCurveTo(340, 980, 480, 1180)
  ctx.lineTo(200, 1240)
  ctx.lineTo(100, 1080)
  ctx.closePath()
  ctx.fill()

  // Bark grain on giant trunk
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

  // Left canopy foliage clumps
  drawFoliageCloud(ctx, 320, 180, 320, 170, 901)
  drawFoliageCloud(ctx, 620, 220, 340, 180, 902)

  // 2. Large woody branch arching from top-right across the top frame (Ref Image 1)
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

  // 3. Lower earthy riverbank cutaway across the bottom of the screen (Ref Image 1)
  drawEarthyRiverbank(ctx, 1040, 777)

  // 4. Smooth faceted boulder resting on the bottom riverbank (Ref Image 1)
  drawFacetedBoulder(ctx, 1840, 1110, 140, 90, 778, { top: '#e0c8b0', mid: '#b08b68', shadow: '#6a4a2e' })

  // 5. Tropical broadleaf plants framing bottom corners (Ref Image 2 style)
  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1)
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1)

  return c
}

// ============================================================================
// SHOT 2: HIGHLAND ISLAND POND (Authentic Ref Image 2 Style)
// ============================================================================

function drawPastelSky(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#90caf9')
  g.addColorStop(0.45, '#bbdefb')
  g.addColorStop(0.85, '#e3f2fd')
  g.addColorStop(1.0, '#f0f9ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Soft cumulus clouds
  drawCartoonCloud(ctx, 420, 220, 520, 160, 0.9)
  drawCartoonCloud(ctx, 1240, 170, 660, 190, 0.85)
  drawCartoonCloud(ctx, 2020, 240, 480, 150, 0.9)
  return c
}

function drawPurpleMountainPeaks(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Distant purple/blue mountain peaks
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

  // Atmospheric haze
  const haze = ctx.createLinearGradient(0, 520, 0, H)
  haze.addColorStop(0, 'rgba(240, 249, 255, 0)')
  haze.addColorStop(1, 'rgba(240, 249, 255, 0.8)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 520, W, H - 520)
  return c
}

function drawRollingHillsAndHedges(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Rolling meadow
  ctx.fillStyle = '#61aa34'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 680)
  ctx.quadraticCurveTo(W * 0.3, 580, W * 0.65, 680)
  ctx.quadraticCurveTo(W * 0.85, 610, W, 670)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Tiered lush green hedges (Ref Image 2)
  drawFoliageCloud(ctx, 360, 640, 180, 75, 411)
  drawFoliageCloud(ctx, 740, 660, 200, 80, 412)
  drawFoliageCloud(ctx, 1680, 670, 210, 85, 413)
  drawFoliageCloud(ctx, 2080, 650, 190, 78, 414)
  return c
}

/** Pond with the Iconic Center Island Knoll (Ref Image 2). */
function drawCenterIslandPond(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const meadowTopY = 670
  const pondTopY = 740

  // Surrounding green lawn
  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, pondTopY)
  grassG.addColorStop(0, '#7ac83d')
  grassG.addColorStop(1, '#5ca72c')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, pondTopY - meadowTopY)

  // Clear blue pond
  const pondG = ctx.createLinearGradient(0, pondTopY, 0, H)
  pondG.addColorStop(0, '#38bdf8')
  pondG.addColorStop(0.5, '#0ea5e9')
  pondG.addColorStop(1.0, '#0284c7')
  ctx.fillStyle = pondG
  ctx.fillRect(0, pondTopY, W, H - pondTopY)

  // Water ripple highlights
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

  // THE CENTER ISLAND KNOLI (Ref Image 2): Elevated grass mound with earthen cliff base
  drawCenterIsland(ctx, 1200, 870, 260, 110, 80)
  return c
}

function drawIslandPondTrees(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const groundY = 740

  // Left curved tree (Ref Image 2)
  drawStylizedTree(ctx, 420, groundY - 15, 710, 460, {
    seed: 611,
    curveDir: 1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  // Right upright tiered tree (Ref Image 2)
  drawUprightTieredTree(ctx, 2140, groundY - 10, 760, 440, {
    seed: 622,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342', rim: '#c8e6c9' }
  })

  // Faceted boulders by the water
  drawFacetedBoulder(ctx, 580, groundY + 10, 95, 65, 801)
  drawFacetedBoulder(ctx, 720, groundY + 25, 75, 52, 802)
  return c
}

/**
 * Foreground Broadleaf Framing (Ref Image 2):
 * Huge broadleaf plants in bottom-left and bottom-right corners with luminous veins,
 * accompanied by large faceted boulders.
 */
function drawForegroundBroadleafFraming(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // Arching top-left branch
  drawFoliageCloud(ctx, 240, 160, 320, 160, 911)
  drawFoliageCloud(ctx, 600, 200, 340, 170, 912)

  // Arching top-right branch
  drawFoliageCloud(ctx, W - 240, 170, 340, 170, 913)
  drawFoliageCloud(ctx, W - 580, 210, 320, 160, 914)

  // Bottom green ground strip framing
  ctx.fillStyle = '#4a8e1b'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 1140)
  ctx.quadraticCurveTo(W * 0.3, 1080, W * 0.5, 1120)
  ctx.quadraticCurveTo(W * 0.8, 1080, W, 1140)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Large faceted boulders in bottom corners (Ref Image 2)
  drawFacetedBoulder(ctx, 260, 1120, 150, 105, 931)
  drawFacetedBoulder(ctx, 420, 1150, 120, 85, 932)
  drawFacetedBoulder(ctx, W - 260, 1120, 150, 105, 933)
  drawFacetedBoulder(ctx, W - 420, 1150, 120, 85, 934)

  // GIANT TROPICAL BROADLEAF PLANTS (Ref Image 2): Luminous veins framing bottom corners
  drawBroadleafPlant(ctx, 160, 1230, 2.6, 1)
  drawBroadleafPlant(ctx, 320, 1250, 2.1, 1)
  drawBroadleafPlant(ctx, W - 160, 1230, 2.6, -1)
  drawBroadleafPlant(ctx, W - 320, 1250, 2.1, -1)

  return c
}

// ============================================================================
// SHOT 3: HIGHLAND LAGOON & BOULDER RIDGE (Authentic Ref Image 3 Style)
// ============================================================================

function drawSlopingPastureAndPine(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  // Sloping pasture hill rising from left to right (Ref Image 3)
  ctx.fillStyle = '#5ba532'
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, 720)
  ctx.quadraticCurveTo(W * 0.35, 680, W * 0.7, 600)
  ctx.lineTo(W, 520)
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Pine tree on the crest (Ref Image 3 left)
  drawPineTree(ctx, 360, 680, 260, 130)

  // Slender curved tree on the hill (Ref Image 3 center)
  drawStylizedTree(ctx, 1420, 630, 360, 240, {
    seed: 331,
    curveDir: -1,
    foliage: { shadow: '#1b5e20', mid: '#388e3c', light: '#7cb342' }
  })
  return c
}

/** Naturally Contoured Pond surrounded by Green Turf (Ref Image 3). */
function drawLagoonAndShore(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const meadowTopY = 670

  // Lush green turf
  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, H)
  grassG.addColorStop(0, '#78c73b')
  grassG.addColorStop(0.5, '#5aa32a')
  grassG.addColorStop(1.0, '#3e7c1a')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, H - meadowTopY)

  // NATURALLY CONTOURED POND (Ref Image 3): Curved natural lagoon
  drawNaturalPond(ctx, 1200, 880, 520, 180, 999)
  return c
}

function drawMidgroundBoulderClusters(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // Clusters of faceted boulders on right bank of the pond (Ref Image 3)
  drawFacetedBoulder(ctx, 1720, 820, 80, 55, 711)
  drawFacetedBoulder(ctx, 1860, 800, 110, 80, 712)
  drawFacetedBoulder(ctx, 2040, 830, 130, 90, 713)

  // Cluster on left bank (Ref Image 3)
  drawFacetedBoulder(ctx, 620, 810, 95, 68, 714)
  drawFacetedBoulder(ctx, 480, 830, 120, 85, 715)

  // Tiered lush bush mounds flanking the pond
  drawFoliageCloud(ctx, 840, 820, 140, 65, 831)
  drawFoliageCloud(ctx, 1540, 810, 150, 70, 832)
  return c
}

function drawForegroundLagoonFraming(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // Top overhead canopy branches from left and right
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

  // FOREGROUND FACETED BOULDER FORMATIONS (Ref Image 3 bottom corners)
  drawFacetedBoulder(ctx, 280, 1100, 160, 115, 951)
  drawFacetedBoulder(ctx, 450, 1150, 130, 90, 952)
  drawFacetedBoulder(ctx, W - 280, 1100, 160, 115, 953)
  drawFacetedBoulder(ctx, W - 450, 1150, 130, 90, 954)

  // Lush bottom bush clusters framing the pond (Ref Image 3)
  drawFoliageCloud(ctx, 1200, 1180, 260, 90, 961)
  drawFoliageCloud(ctx, 880, 1190, 200, 80, 962)
  drawFoliageCloud(ctx, 1520, 1190, 200, 80, 963)
  return c
}

// ============================================================================
// SHOT 4: TWILIGHT VALLEY (Magical Sunset Golden Hour)
// ============================================================================

function drawSunsetSky(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1a103c')
  g.addColorStop(0.32, '#511b5e')
  g.addColorStop(0.62, '#b7385a')
  g.addColorStop(0.82, '#f46c43')
  g.addColorStop(1.0, '#fed174')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Setting sun
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

  // Sunset clouds
  drawCartoonCloud(ctx, 420, 260, 540, 160, 0.75)
  drawCartoonCloud(ctx, 1280, 210, 640, 180, 0.7)
  drawCartoonCloud(ctx, 2140, 250, 480, 150, 0.75)
  return c
}

function drawTwilightMountains(): HTMLCanvasElement {
  const [c, ctx] = canvas()
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

  // Amber sunset rim on mountain ridges
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

function drawTwilightRiverFloor(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const meadowTopY = 670
  const cliffTopY = 740
  const cliffH = 65
  const riverTopY = cliffTopY + cliffH

  // Warm amber-olive grass
  const grassG = ctx.createLinearGradient(0, meadowTopY, 0, cliffTopY)
  grassG.addColorStop(0, '#5a6d2b')
  grassG.addColorStop(1, '#3d4d1d')
  ctx.fillStyle = grassG
  ctx.fillRect(0, meadowTopY, W, cliffTopY - meadowTopY)

  // Dirt cliff with warm evening tones
  drawOrganicDirtCliff(ctx, cliffTopY, cliffH, 771, {
    soilTop: '#5c321d',
    soilBottom: '#32190d',
    grass: '#4d6824',
    grassShadow: '#283812'
  })

  // Sunset river reflecting glowing orange & magenta sky
  const riverG = ctx.createLinearGradient(0, riverTopY, 0, H)
  riverG.addColorStop(0, '#e65100')
  riverG.addColorStop(0.4, '#ad1457')
  riverG.addColorStop(1.0, '#4a148c')
  ctx.fillStyle = riverG
  ctx.fillRect(0, riverTopY, W, H - riverTopY)

  // Water reflections
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

function drawTwilightTrees(): HTMLCanvasElement {
  const [c, ctx] = canvas()
  const groundY = 740

  // Left tree catching sunset peach rim light
  drawStylizedTree(ctx, 460, groundY - 20, 680, 440, {
    seed: 881,
    curveDir: 1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })

  // Right tree
  drawStylizedTree(ctx, 2180, groundY - 15, 720, 460, {
    seed: 882,
    curveDir: -1,
    trunkColor: '#5c321d',
    foliage: { shadow: '#1a2e12', mid: '#2d541e', light: '#4d8028', rim: '#ffab40' }
  })
  return c
}

function drawTwilightForegroundFraming(): HTMLCanvasElement {
  const [c, ctx] = canvas()

  // Giant tree trunk with amber sunset rim
  ctx.fillStyle = '#4e2f17'
  ctx.beginPath()
  ctx.moveTo(10, H + 40)
  ctx.quadraticCurveTo(180, 850, 220, 480)
  ctx.quadraticCurveTo(240, 180, 40, -40)
  ctx.lineTo(-40, -40)
  ctx.lineTo(-40, H + 40)
  ctx.closePath()
  ctx.fill()

  // Amber rim on trunk
  ctx.strokeStyle = 'rgba(255, 171, 64, 0.65)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(180, 850)
  ctx.quadraticCurveTo(240, 480, 255, 180)
  ctx.stroke()

  drawFoliageCloud(ctx, 320, 180, 320, 170, 971, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })
  drawFoliageCloud(ctx, 620, 220, 340, 180, 972, { shadow: '#14220e', mid: '#223d16', light: '#385c22', rim: '#ffab40' })

  // Arching right branch
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

  // Bottom riverbank
  drawEarthyRiverbank(ctx, 1040, 888, { soilTop: '#4a2512', soilBottom: '#281308' })

  // Broadleaf plants with subtle amber highlights
  drawBroadleafPlant(ctx, 320, 1220, 2.3, 1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })
  drawBroadleafPlant(ctx, W - 260, 1220, 2.3, -1, { base: '#0f2911', half: '#19421c', vein: '#e69138' })

  return c
}

// ============================================================================
// DEMO PROJECT BUILDER
// ============================================================================

interface Plate {
  name: string
  z: number
  draw: () => HTMLCanvasElement
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
  autoScale?: boolean
}

interface ShotSpec {
  name: string
  plates: Plate[]
  title: string
  subtitle: string
  titleColor?: string
  subtitleColor: string
  arrive: number
  particles: { name: string; seed: number; count: number; size: number; color: string; velocity: Vec3; sway: number }
}

export async function buildDemoProject(): Promise<Project> {
  assetStore.clear()
  const project = createProject({ name: 'Parallax Journey', duration: 19.2 })
  const comp = project.comp
  const d = referenceDistance(comp)
  const spacing = shotSpacing(comp)

  const specs: ShotSpec[] = [
    {
      name: 'Emerald Riverbank',
      arrive: 0.6,
      title: 'EMERALD RIVERBANK',
      subtitle: 'where the wild earth awakes',
      titleColor: '#ffffff',
      subtitleColor: '#ffe57f',
      particles: { name: 'Sun Dust', seed: 108, count: 280, size: 6, color: '#fff9c4', velocity: [16, 10, 0], sway: 36 },
      plates: [
        { name: 'Sunny Sky', z: 3200, draw: drawSunnySky },
        { name: 'Distant Mountains', z: 2200, draw: drawDistantMountains },
        { name: 'Rolling Green Hills', z: 1400, draw: drawRollingGreenHills },
        { name: 'River & Meadow Floor', z: 800, draw: drawRiverAndMeadowFloor },
        { name: 'Midground Trees', z: 400, draw: drawMidgroundTrees },
        { name: 'Foreground Framing', z: -240, draw: drawForegroundFraming }
      ]
    },
    {
      name: 'Island Pond',
      arrive: 5.8,
      title: 'ISLAND POND',
      subtitle: 'sanctuary of ancient trees',
      titleColor: '#ffffff',
      subtitleColor: '#bbf7d0',
      particles: { name: 'Pollen', seed: 909, count: 240, size: 5, color: '#dcedc8', velocity: [28, 8, 0], sway: 26 },
      plates: [
        { name: 'Pastel Sky', z: 3200, draw: drawPastelSky },
        { name: 'Purple Mountain Peaks', z: 2200, draw: drawPurpleMountainPeaks },
        { name: 'Rolling Hills & Hedges', z: 1400, draw: drawRollingHillsAndHedges },
        { name: 'Center Island Pond', z: 800, draw: drawCenterIslandPond },
        { name: 'Midground Trees', z: 400, draw: drawIslandPondTrees },
        { name: 'Foreground Broadleaf Framing', z: -240, draw: drawForegroundBroadleafFraming }
      ]
    },
    {
      name: 'Highland Lagoon',
      arrive: 11.0,
      title: 'HIGHLAND LAGOON',
      subtitle: 'whispers of the stone ridges',
      titleColor: '#ffffff',
      subtitleColor: '#c7d2fe',
      particles: { name: 'Sun Motes', seed: 44, count: 260, size: 6, color: '#fef08a', velocity: [12, 14, 0], sway: 30 },
      plates: [
        { name: 'Sunny Sky', z: 3200, draw: drawSunnySky },
        { name: 'Distant Mountains', z: 2200, draw: drawDistantMountains },
        { name: 'Sloping Pasture & Pine', z: 1400, draw: drawSlopingPastureAndPine },
        { name: 'Lagoon & Shore', z: 800, draw: drawLagoonAndShore },
        { name: 'Midground Boulder Clusters', z: 400, draw: drawMidgroundBoulderClusters },
        { name: 'Foreground Lagoon Framing', z: -240, draw: drawForegroundLagoonFraming }
      ]
    },
    {
      name: 'Twilight Valley',
      arrive: 15.6,
      title: 'TWILIGHT VALLEY',
      subtitle: 'a golden sunset tale',
      titleColor: '#fff8e1',
      subtitleColor: '#ffcc80',
      particles: { name: 'Fireflies', seed: 2024, count: 280, size: 7, color: '#ffe082', velocity: [10, 16, 0], sway: 40 },
      plates: [
        { name: 'Sunset Sky', z: 3200, draw: drawSunsetSky },
        { name: 'Twilight Mountains', z: 2200, draw: drawTwilightMountains },
        { name: 'Rolling Green Hills', z: 1400, draw: drawRollingGreenHills },
        { name: 'Twilight River Floor', z: 800, draw: drawTwilightRiverFloor },
        { name: 'Twilight Trees', z: 400, draw: drawTwilightTrees },
        { name: 'Twilight Foreground Framing', z: -240, draw: drawTwilightForegroundFraming }
      ]
    }
  ]

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const shot = createShot(spec.name, [i * spacing, 0, 0], i)
    project.shots.push(shot)
    const shotLayers: Layer[] = []

    for (const p of spec.plates) {
      const asset = await assetStore.addCanvas(`${spec.name}-${p.name}.png`, p.draw())
      project.assets.push(asset.meta)
      const layer = createImageLayer(asset.meta, comp, p.z)
      layer.name = p.name
      if (p.rotation) layer.transform.rotation.value = p.rotation
      if (p.position) layer.transform.position.value = p.position
      if (p.autoScale !== undefined) layer.autoScale = p.autoScale
      if (p.scale) {
        layer.transform.scale.value = p.scale
      } else {
        layer.transform.scale.value = [comp.width / 1920, comp.width / 1920, 1]
      }
      shotLayers.unshift(layer)
    }

    const a = spec.arrive
    const title = createTextLayer(comp, spec.title)
    title.name = `${spec.name} · Title`
    title.props = {
      ...title.props,
      fontFamily: 'Montserrat',
      fontWeight: 800,
      fontSize: 88,
      letterSpacing: 10,
      ...(spec.titleColor ? { color: spec.titleColor } : {})
    }
    title.transform.position.value = [0, 210, 700]
    addKeyframe(title.transform.opacity, a, 0, 'easeOut')
    addKeyframe(title.transform.opacity, a + 1.8, 1, 'easeOut')
    addKeyframe(title.transform.position, a, [0, 160, 700] as Vec3, 'easeOut')
    addKeyframe(title.transform.position, a + 2.4, [0, 210, 700] as Vec3, 'easeOut')

    const subtitle = createTextLayer(comp, spec.subtitle)
    subtitle.name = `${spec.name} · Subtitle`
    subtitle.props = {
      ...subtitle.props,
      fontFamily: 'Playfair Display',
      fontWeight: 400,
      fontSize: 42,
      letterSpacing: 5,
      color: spec.subtitleColor
    }
    subtitle.transform.position.value = [0, 125, 700]
    addKeyframe(subtitle.transform.opacity, a + 1.2, 0, 'easeOut')
    addKeyframe(subtitle.transform.opacity, a + 2.8, 0.9, 'easeOut')

    const pt = spec.particles
    const particles = createParticleLayer(comp)
    particles.name = pt.name
    particles.props = {
      ...particles.props,
      seed: pt.seed,
      count: pt.count,
      size: pt.size,
      color: pt.color,
      area: [comp.width * 2.4, comp.height * 1.6, d * 1.8],
      velocity: pt.velocity,
      sway: pt.sway
    }
    particles.transform.position.value = [0, -150, 500]

    shotLayers.unshift(particles, title, subtitle)
    for (const l of shotLayers) l.shotId = shot.id
    project.layers.push(...shotLayers)
  }

  // Camera tour across 4 shots
  const [s1, s2, s3, s4] = project.shots
  const end = buildCameraPath(
    project,
    [
      { shotId: s1.id, hold: 3.5, type: 'arc', transition: 2.5 },
      { shotId: s2.id, hold: 3.0, type: 'arc', transition: 2.5 },
      { shotId: s3.id, hold: 3.0, type: 'fade', transition: 1.2 },
      { shotId: s4.id, hold: 3.5, type: 'cut', transition: 0 }
    ],
    { pushIn: 0.14 }
  )
  project.comp.duration = Math.round(end * comp.fps) / comp.fps
  for (const l of project.layers) l.outPoint = project.comp.duration

  project.camera.shakeAmount = 3.0
  project.camera.shakeSpeed = 0.35
  project.camera.dofEnabled = false
  for (const k of project.camera.focusDistance.keyframes) k.value += 700

  project.look = {
    ...project.look,
    fogEnabled: false,
    vignette: 0.28,
    grain: 0.02,
    contrast: 1.05,
    saturation: 1.08
  }

  return structuredClone(project)
}
