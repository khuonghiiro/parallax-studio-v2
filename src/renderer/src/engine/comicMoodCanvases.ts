import type { SolidPattern, SolidProps } from '@shared/types'
import { mulberry32 } from '../animation/math'

const COMIC_MOOD_PATTERNS = new Set<SolidPattern>([
  'speedlines_radial',
  'spotlight_stage',
  'comic_burst',
  'question_sky',
  'anger_veins',
  'hologram_panel'
])

export function isComicMoodPattern(pattern?: SolidPattern): boolean {
  return !!pattern && COMIC_MOOD_PATTERNS.has(pattern)
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

function drawRadialSpeedlines(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  const cx = w * 0.5
  const cy = h * 0.48
  const maxR = Math.hypot(w, h) * 0.72
  const bg = ctx.createRadialGradient(cx, cy, maxR * 0.14, cx, cy, maxR)
  bg.addColorStop(0, p.color || '#2b0938')
  bg.addColorStop(1, p.color2 || '#6a0f49')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const rand = mulberry32(104729)
  const spikes = 96
  for (let i = 0; i < spikes; i++) {
    const baseAngle = (i / spikes) * Math.PI * 2 + (rand() - 0.5) * 0.03
    const halfSpan = 0.005 + rand() * 0.018
    const innerR = maxR * (0.28 + rand() * 0.24)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(baseAngle) * innerR, cy + Math.sin(baseAngle) * innerR)
    ctx.lineTo(cx + Math.cos(baseAngle - halfSpan) * maxR, cy + Math.sin(baseAngle - halfSpan) * maxR)
    ctx.lineTo(cx + Math.cos(baseAngle + halfSpan) * maxR, cy + Math.sin(baseAngle + halfSpan) * maxR)
    ctx.closePath()
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 72, 176, 0.52)' : 'rgba(255, 255, 255, 0.24)'
    ctx.fill()
  }
}

function drawSpotlightStage(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  const wallH = h * 0.72
  const wallGrad = ctx.createLinearGradient(0, 0, 0, wallH)
  wallGrad.addColorStop(0, p.color || '#3b3e45')
  wallGrad.addColorStop(1, p.color2 || '#1f2126')
  ctx.fillStyle = wallGrad
  ctx.fillRect(0, 0, w, wallH)

  ctx.fillStyle = '#15171b'
  ctx.fillRect(0, wallH, w, h - wallH)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, wallH)
  ctx.lineTo(w, wallH)
  ctx.stroke()

  // Hạt nhiễu xám đặc trưng của cảnh bi kịch hài (TV-static gloom)
  const rand = mulberry32(7717)
  for (let i = 0; i < 1800; i++) {
    const gx = rand() * w
    const gy = rand() * h
    const v = Math.floor(150 + rand() * 90)
    ctx.fillStyle = `rgba(${v},${v},${v},${0.06 + rand() * 0.08})`
    ctx.fillRect(gx, gy, 3, 3)
  }

  // Chùm đèn Spotlight trắng chiếu thẳng từ đỉnh đầu xuống sàn
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(w * 0.45, 0)
  ctx.lineTo(w * 0.55, 0)
  ctx.lineTo(w * 0.72, h * 0.92)
  ctx.lineTo(w * 0.28, h * 0.92)
  ctx.closePath()
  const cone = ctx.createLinearGradient(0, 0, 0, h * 0.92)
  cone.addColorStop(0, 'rgba(255, 255, 255, 0.75)')
  cone.addColorStop(0.55, 'rgba(240, 248, 255, 0.28)')
  cone.addColorStop(1, 'rgba(240, 248, 255, 0.03)')
  ctx.fillStyle = cone
  ctx.fill()

  // Elip sáng dưới chân nhân vật
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.84, w * 0.22, h * 0.065, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
  ctx.fill()
  ctx.restore()
}

function drawQuestionSky(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, p.color || '#62a8ff')
  sky.addColorStop(1, p.color2 || '#cde7ff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Vòm mây trắng comic phía dưới
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.98, w * 0.52, h * 0.34, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(88, 145, 225, 0.55)'
  ctx.stroke()

  const qMarks: Array<[number, number, number, number, string]> = [
    [0.14, 0.26, -0.35, 84, '#ffd166'],
    [0.27, 0.56, 0.24, 66, '#ffffff'],
    [0.11, 0.72, -0.18, 92, '#ffe08a'],
    [0.83, 0.24, 0.32, 88, '#ffd166'],
    [0.74, 0.58, -0.22, 68, '#ffffff'],
    [0.88, 0.74, 0.28, 96, '#ffe08a'],
    [0.36, 0.18, -0.15, 58, '#ffffff'],
    [0.64, 0.17, 0.19, 62, '#ffd166']
  ]
  for (const [ux, uy, rot, size, fill] of qMarks) {
    ctx.save()
    ctx.translate(w * ux, h * uy)
    ctx.rotate(rot)
    ctx.font = `900 ${size}px "Montserrat", "Inter", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(6, size * 0.12)
    ctx.strokeStyle = '#2563eb'
    ctx.strokeText('?', 0, 0)
    ctx.fillStyle = fill
    ctx.fillText('?', 0, 0)
    ctx.restore()
  }
}

function drawAngerVeinSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const g = size * 0.16
  const L = size * 0.48
  const drawQuadArm = (sx: number, sy: number): void => {
    ctx.beginPath()
    ctx.moveTo(sx * L, sy * g)
    ctx.quadraticCurveTo(sx * g, sy * g, sx * g, sy * L)
    ctx.stroke()
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.22
  ctx.strokeStyle = '#ffffff'
  drawQuadArm(1, 1)
  drawQuadArm(-1, 1)
  drawQuadArm(1, -1)
  drawQuadArm(-1, -1)

  ctx.lineWidth = size * 0.13
  ctx.strokeStyle = '#7f1d1d'
  drawQuadArm(1, 1)
  drawQuadArm(-1, 1)
  drawQuadArm(1, -1)
  drawQuadArm(-1, -1)
  ctx.restore()
}

function drawAngerVeinsBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, p.color || '#be123c')
  bg.addColorStop(1, p.color2 || '#fb7185')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Vòm trắng nổi bật nhân vật ở tâm dưới
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.88, w * 0.44, h * 0.48, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#fff5f7'
  ctx.fill()

  // Tia lửa giận dữ bay lên
  const rand = mulberry32(9913)
  ctx.strokeStyle = 'rgba(255, 82, 168, 0.65)'
  ctx.lineWidth = 4
  for (let i = 0; i < 42; i++) {
    const sx = rand() * w
    const sy = rand() * h * 0.72
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + (rand() - 0.5) * 14, sy - 14 - rand() * 12)
    ctx.stroke()
  }

  drawAngerVeinSymbol(ctx, w * 0.16, h * 0.24, 118, -0.18)
  drawAngerVeinSymbol(ctx, w * 0.82, h * 0.22, 126, 0.16)
  drawAngerVeinSymbol(ctx, w * 0.21, h * 0.64, 102, 0.12)
  drawAngerVeinSymbol(ctx, w * 0.81, h * 0.62, 108, -0.14)
}

function drawComicBurst(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  drawRadialSpeedlines(ctx, w, h, {
    ...p,
    color: p.color || '#fef08a',
    color2: p.color2 || '#ef4444'
  })
  const cx = w * 0.5
  const cy = h * 0.5
  const points = 28
  ctx.beginPath()
  for (let i = 0; i <= points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? Math.min(w, h) * 0.46 : Math.min(w, h) * 0.28
    const px = cx + Math.cos(ang) * r * 1.35
    const py = cy + Math.sin(ang) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(255, 251, 235, 0.9)'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#dc2626'
  ctx.stroke()
}

function drawHologramPanel(ctx: CanvasRenderingContext2D, w: number, h: number, p: SolidProps): void {
  ctx.clearRect(0, 0, w, h)
  const pad = 22
  const rw = w - pad * 2
  const rh = h - pad * 2
  drawRoundedRectPath(ctx, pad, pad, rw, rh, 18)
  const glass = ctx.createLinearGradient(0, pad, 0, pad + rh)
  glass.addColorStop(0, p.color || 'rgba(14, 116, 190, 0.86)')
  glass.addColorStop(1, p.color2 || 'rgba(6, 52, 98, 0.90)')
  ctx.fillStyle = glass
  ctx.fill()

  // Scanlines ngang kiểu Hệ Thống Xuyên Không
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(125, 211, 252, 0.11)'
  for (let y = pad; y < pad + rh; y += 10) {
    ctx.fillRect(pad, y, rw, 3)
  }
  ctx.restore()

  ctx.shadowColor = '#38bdf8'
  ctx.shadowBlur = 16
  ctx.lineWidth = 5
  ctx.strokeStyle = '#7dd3fc'
  drawRoundedRectPath(ctx, pad, pad, rw, rh, 18)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Góc HUD phát sáng
  const cLen = 38
  ctx.lineWidth = 8
  ctx.strokeStyle = '#e0f2fe'
  const corners: Array<[number, number, number, number]> = [
    [pad, pad, 1, 1],
    [pad + rw, pad, -1, 1],
    [pad, pad + rh, 1, -1],
    [pad + rw, pad + rh, -1, -1]
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * cLen, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * cLen)
    ctx.stroke()
  }
}

export function renderComicMoodCanvas(p: SolidProps): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 540
  const ctx = canvas.getContext('2d')!
  switch (p.pattern) {
    case 'speedlines_radial':
      drawRadialSpeedlines(ctx, canvas.width, canvas.height, p)
      break
    case 'spotlight_stage':
      drawSpotlightStage(ctx, canvas.width, canvas.height, p)
      break
    case 'question_sky':
      drawQuestionSky(ctx, canvas.width, canvas.height, p)
      break
    case 'anger_veins':
      drawAngerVeinsBackdrop(ctx, canvas.width, canvas.height, p)
      break
    case 'comic_burst':
      drawComicBurst(ctx, canvas.width, canvas.height, p)
      break
    case 'hologram_panel':
      drawHologramPanel(ctx, canvas.width, canvas.height, p)
      break
  }
  return canvas
}
