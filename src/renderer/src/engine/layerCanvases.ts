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

function resolveBoxFill(boxColor: string | undefined, boxOpacity: number | undefined): string | null {
  if (!boxColor || boxColor === 'transparent' || boxColor === 'none') return null
  const op = boxOpacity !== undefined ? Math.max(0, Math.min(1, boxOpacity)) : 1
  if (op <= 0.005) return null
  const hex = boxColor.trim()
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    const r = hex.length === 4 ? parseInt(hex[1] + hex[1], 16) : parseInt(hex.slice(1, 3), 16)
    const g = hex.length === 4 ? parseInt(hex[2] + hex[2], 16) : parseInt(hex.slice(3, 5), 16)
    const b = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${Number(op.toFixed(2))})`
  }
  return boxColor
}

function traceSpeechBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bw: number,
  bh: number,
  r: number,
  tail: 'none' | 'left' | 'right' | 'bottom',
  tailLen: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + bw - r, y)
  ctx.quadraticCurveTo(x + bw, y, x + bw, y + r)
  if (tail === 'right') {
    const ty = y + bh * 0.56
    ctx.lineTo(x + bw, Math.max(y + r, ty - tailLen * 0.55))
    ctx.lineTo(x + bw + tailLen, ty + tailLen * 0.15)
    ctx.lineTo(x + bw, Math.min(y + bh - r, ty + tailLen * 0.55))
  }
  ctx.lineTo(x + bw, y + bh - r)
  ctx.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh)
  if (tail === 'bottom') {
    const tx = x + bw * 0.5
    ctx.lineTo(Math.min(x + bw - r, tx + tailLen * 0.55), y + bh)
    ctx.lineTo(tx - tailLen * 0.12, y + bh + tailLen)
    ctx.lineTo(Math.max(x + r, tx - tailLen * 0.55), y + bh)
  }
  ctx.lineTo(x + r, y + bh)
  ctx.quadraticCurveTo(x, y + bh, x, y + bh - r)
  if (tail === 'left') {
    const ty = y + bh * 0.56
    ctx.lineTo(x, Math.min(y + bh - r, ty + tailLen * 0.55))
    ctx.lineTo(x - tailLen, ty + tailLen * 0.15)
    ctx.lineTo(x, Math.max(y + r, ty - tailLen * 0.55))
  }
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function renderTextCanvas(p: TextProps): CanvasResult {
  const ss = TEXT_SUPERSAMPLE
  const rawText = p.text || ' '
  const speakerPrefix =
    p.speakerName && p.speakerName.trim() && !rawText.startsWith(`[${p.speakerName}`) && !rawText.startsWith(`${p.speakerName}:`)
      ? `【${p.speakerName.trim()}】 `
      : ''
  const lines = (speakerPrefix ? `${speakerPrefix}${rawText}` : rawText).split('\n')
  const stylePrefix = p.italic ? 'italic ' : ''
  const font = `${stylePrefix}${p.fontWeight} ${p.fontSize * ss}px "${p.fontFamily}", "Inter", sans-serif`
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  measure.letterSpacing = `${p.letterSpacing * ss}px`
  const strokePx = Math.max(0, (p.strokeWidth ?? 0) * ss)
  const lineHeight = p.fontSize * 1.26 * ss
  const boxFill = resolveBoxFill(p.boxColor, p.boxOpacity)
  const hasBox = Boolean(boxFill || p.boxBorderColor)
  const tail = hasBox && p.bubbleTail && p.bubbleTail !== 'none' ? p.bubbleTail : 'none'
  const tailLen = tail !== 'none' ? Math.round(18 * ss) : 0
  const padX = (p.fontSize * 0.72 + (hasBox ? 22 : 6)) * ss + strokePx
  const padY = (p.fontSize * 0.44 + (hasBox ? 11 : 4)) * ss + strokePx * 0.7
  const widths = lines.map((l) => measure.measureText(l).width)
  const bodyW = Math.ceil(Math.max(...widths, 1) + padX * 2)
  const bodyH = Math.ceil(lineHeight * lines.length + padY * 2)
  const extraLeft = tail === 'left' ? tailLen : 0
  const extraRight = tail === 'right' ? tailLen : 0
  const extraBottom = tail === 'bottom' ? tailLen : 0
  const w = bodyW + extraLeft + extraRight
  const h = bodyH + extraBottom

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (hasBox) {
    const inset = 6 * ss
    const bx = extraLeft + inset
    const by = inset
    const bw = bodyW - inset * 2
    const bh = bodyH - inset * 2
    const isPill = p.subtitleStylePreset === 'dino_white_pill' || p.subtitleStylePreset === 'inner_thought'
    const r = Math.min((isPill ? 28 : 16) * ss, bh * 0.48)
    ctx.save()
    traceSpeechBubblePath(ctx, bx, by, bw, bh, r, tail, tailLen)
    ctx.shadowColor = 'rgba(2, 6, 23, 0.38)'
    ctx.shadowBlur = 12 * ss
    ctx.shadowOffsetY = 3 * ss
    if (boxFill) {
      ctx.fillStyle = boxFill
      ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    if (p.boxBorderColor) {
      ctx.lineWidth = (tail !== 'none' ? 3.5 : 2.8) * ss
      ctx.strokeStyle = p.boxBorderColor
      if (p.subtitleStylePreset === 'system_hologram' || p.subtitleStylePreset === 'comic_shout') {
        ctx.shadowColor = p.boxBorderColor
        ctx.shadowBlur = 9 * ss
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  const align = p.align ?? 'center'
  ctx.font = font
  ctx.letterSpacing = `${p.letterSpacing * ss}px`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.miterLimit = 2
  const anchorX =
    extraLeft + (align === 'left' ? padX : align === 'right' ? bodyW - padX : bodyW / 2)

  lines.forEach((line, i) => {
    const y = padY + lineHeight * (i + 0.5)
    // Lớp 1: Hào quang viền ngoài (Outer Halo) chuẩn Vietsub Hoạt Ảnh 2.5D (ví dụ Cyan bên ngoài Navy)
    if (p.glowColor) {
      ctx.save()
      ctx.shadowColor = p.glowColor
      ctx.shadowBlur = p.fontSize * 0.32 * ss
      ctx.shadowOffsetY = 0
      if (strokePx > 0) {
        ctx.lineWidth = strokePx * 1.48
        ctx.strokeStyle = p.glowColor
        ctx.globalAlpha = 0.72
        ctx.strokeText(line, anchorX, y)
      } else {
        ctx.fillStyle = p.glowColor
        ctx.fillText(line, anchorX, y)
      }
      ctx.restore()
    } else if (p.shadow && !hasBox) {
      ctx.shadowColor = 'rgba(0,0,0,0.66)'
      ctx.shadowBlur = p.fontSize * 0.24 * ss
      ctx.shadowOffsetY = p.fontSize * 0.06 * ss
    }

    // Lớp 2: Viền mực sắc nét tương phản cao (Inner Ink Stroke)
    if (p.strokeColor && strokePx > 0) {
      ctx.lineWidth = strokePx
      ctx.strokeStyle = p.strokeColor
      ctx.strokeText(line, anchorX, y)
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }

    // Lớp 3: Thân chữ chính sắc nét
    ctx.fillStyle = p.color
    ctx.fillText(line, anchorX, y)
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
