import type { SolidProps, TextProps } from '@shared/types'

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
  const lineHeight = p.fontSize * 1.2 * ss
  const pad = p.fontSize * 0.5 * ss
  const widths = lines.map((l) => measure.measureText(l).width)
  const w = Math.ceil(Math.max(...widths, 1) + pad * 2)
  const h = Math.ceil(lineHeight * lines.length + pad * 2)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.letterSpacing = `${p.letterSpacing * ss}px`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = p.color
  if (p.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = p.fontSize * 0.25 * ss
    ctx.shadowOffsetY = p.fontSize * 0.05 * ss
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, pad + lineHeight * (i + 0.5))
  })
  return { canvas, width: w / ss, height: h / ss }
}

export function renderSolidCanvas(p: SolidProps): CanvasResult {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = p.gradient ? 512 : 4
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
  return { canvas, width: p.width, height: p.height }
}
