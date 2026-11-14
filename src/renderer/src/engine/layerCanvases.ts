import type { SolidProps, TextProps } from '@shared/types'
import { isComicMoodPattern, renderComicMoodCanvas } from './comicMoodCanvases'

/** Supersampling factor for text so it stays crisp when the camera pushes in. */
export const TEXT_SUPERSAMPLE = 2

export interface CanvasResult {
  canvas: HTMLCanvasElement
  /** Plane size in world units. */
  width: number
  height: number
}

export function renderTextCanvas(p: TextProps): CanvasResult {
  const ss = TEXT_SUPERSAMPLE
  const lines = (p.text || ' ').split('\n')
  const font = `${p.fontWeight} ${p.fontSize * ss}px "${p.fontFamily}", "Inter", sans-serif`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  measure.letterSpacing = `${p.letterSpacing * ss}px`
  const strokePx = Math.max(0, (p.strokeWidth ?? 0) * ss)
  const lineHeight = p.fontSize * 1.24 * ss
  const padX = (p.fontSize * 0.65 + (p.boxColor || p.boxBorderColor ? 18 : 0)) * ss + strokePx
  const padY = (p.fontSize * 0.45 + (p.boxColor || p.boxBorderColor ? 10 : 0)) * ss + strokePx * 0.6
  const widths = lines.map((l) => measure.measureText(l).width)
  const w = Math.ceil(Math.max(...widths, 1) + padX * 2)
  const h = Math.ceil(lineHeight * lines.length + padY * 2)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (p.boxColor || p.boxBorderColor) {
    const inset = 6 * ss
    const r = Math.min(14 * ss, (h - inset * 2) * 0.45)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, r)
    if (p.boxColor) {
      ctx.fillStyle = p.boxColor
      ctx.fill()
    }
    if (p.boxBorderColor) {
      ctx.lineWidth = 3 * ss
      ctx.strokeStyle = p.boxBorderColor
      ctx.shadowColor = p.boxBorderColor
      ctx.shadowBlur = 10 * ss
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.font = font
  ctx.letterSpacing = `${p.letterSpacing * ss}px`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  lines.forEach((line, i) => {
    const y = padY + lineHeight * (i + 0.5)
    if (p.glowColor) {
      ctx.save()
      ctx.shadowColor = p.glowColor
      ctx.shadowBlur = p.fontSize * 0.34 * ss
      ctx.shadowOffsetY = 0
      if (p.strokeColor && strokePx > 0) {
        ctx.lineWidth = strokePx * 1.15
        ctx.strokeStyle = p.strokeColor
        ctx.strokeText(line, w / 2, y)
      } else {
        ctx.fillStyle = p.glowColor
        ctx.fillText(line, w / 2, y)
      }
      ctx.restore()
    } else if (p.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.62)'
      ctx.shadowBlur = p.fontSize * 0.25 * ss
      ctx.shadowOffsetY = p.fontSize * 0.06 * ss
    }

    if (p.strokeColor && strokePx > 0) {
      ctx.lineWidth = strokePx
      ctx.strokeStyle = p.strokeColor
      ctx.strokeText(line, w / 2, y)
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }
    ctx.fillStyle = p.color
    ctx.fillText(line, w / 2, y)
  })
  return { canvas, width: w / ss, height: h / ss }
}

export function renderSolidCanvas(p: SolidProps): CanvasResult {
  if (isComicMoodPattern(p.pattern)) {
    return {
      canvas: renderComicMoodCanvas(p),
      width: p.width,
      height: p.height
    }
  }

  const hasPattern = p.pattern && p.pattern !== 'none'
  const canvas = document.createElement('canvas')
  const sz = hasPattern ? 512 : p.gradient ? 512 : 4
  canvas.width = hasPattern ? 512 : 4
  canvas.height = sz
  const ctx = canvas.getContext('2d')!

  if (p.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
    g.addColorStop(0, p.color)
    g.addColorStop(1, p.color2)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = p.color
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (hasPattern) {
    const grid = Math.max(16, p.gridSize ?? 40)
    ctx.save()
    if (p.pattern === 'grid') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += grid) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
      }
      for (let y = 0; y <= canvas.height; y += grid) {
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
      }
      ctx.stroke()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += grid * 4) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
      }
      for (let y = 0; y <= canvas.height; y += grid * 4) {
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
      }
      ctx.stroke()
    } else if (p.pattern === 'stripes') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += grid) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
      }
      ctx.stroke()
    } else if (p.pattern === 'dots') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      for (let x = grid / 2; x < canvas.width; x += grid) {
        for (let y = grid / 2; y < canvas.height; y += grid) {
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  return { canvas, width: p.width, height: p.height }
}
