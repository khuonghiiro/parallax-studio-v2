import { mulberry32 } from '../../animation/math'
import { W, H } from './canvas'

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
