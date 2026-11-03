import type { ImageProps, LoopColorConfig, LoopRhythmMode } from '@shared/types'
import type { AnimatedGifData } from './assets'
import { resolveLoopPlayCount } from './loopLifecycle'

export interface LoopRhythmEvaluation {
  opacityMultiplier: number
  scaleMultiplier: number
}

/** Tạo chữ ký màu sắc ngắn gọn cho bộ nhớ đệm TexturePool (trả về 'default' nếu không có bộ lọc màu) */
export function getLoopColorSignature(cfg?: LoopColorConfig | null): string {
  if (!cfg) return 'default'
  const b = cfg.brightness !== undefined && Math.abs(cfg.brightness - 1) > 0.005 ? cfg.brightness.toFixed(2) : ''
  const c = cfg.contrast !== undefined && Math.abs(cfg.contrast - 1) > 0.005 ? cfg.contrast.toFixed(2) : ''
  const s = cfg.saturation !== undefined && Math.abs(cfg.saturation - 1) > 0.005 ? cfg.saturation.toFixed(2) : ''
  const h = cfg.hueRotate !== undefined && Math.abs(cfg.hueRotate) > 0.5 ? Math.round(cfg.hueRotate).toString() : ''
  const t =
    cfg.tintColor && (cfg.tintIntensity ?? 0.65) > 0.005
      ? `${cfg.tintColor}:${(cfg.tintIntensity ?? 0.65).toFixed(2)}:${cfg.blendMode ?? 'source-atop'}`
      : ''
  if (!b && !c && !s && !h && !t) return 'default'
  return `b${b}|c${c}|s${s}|h${h}|t${t}`
}

/** Áp dụng bộ lọc màu sắc (tint, độ sáng, tương phản, bão hoà, xoay sắc độ) lên nguồn ảnh mà không sửa dữ liệu gốc */
export function applyLoopColorFilterToSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  cfg?: LoopColorConfig | null
): HTMLCanvasElement | null {
  if (!cfg || typeof document === 'undefined' || getLoopColorSignature(cfg) === 'default') return null
  const out = document.createElement('canvas')
  out.width = Math.max(1, width)
  out.height = Math.max(1, height)
  const ctx = out.getContext('2d')
  if (!ctx) return null

  const filters: string[] = []
  if (cfg.brightness !== undefined && Math.abs(cfg.brightness - 1) > 0.005) filters.push(`brightness(${cfg.brightness})`)
  if (cfg.contrast !== undefined && Math.abs(cfg.contrast - 1) > 0.005) filters.push(`contrast(${cfg.contrast})`)
  if (cfg.saturation !== undefined && Math.abs(cfg.saturation - 1) > 0.005) filters.push(`saturate(${cfg.saturation})`)
  if (cfg.hueRotate !== undefined && Math.abs(cfg.hueRotate) > 0.5) filters.push(`hue-rotate(${cfg.hueRotate}deg)`)
  if (filters.length > 0) ctx.filter = filters.join(' ')

  ctx.drawImage(source, 0, 0, out.width, out.height)
  ctx.filter = 'none'

  if (cfg.tintColor && (cfg.tintIntensity ?? 0.65) > 0.005) {
    ctx.save()
    ctx.globalCompositeOperation = (cfg.blendMode as GlobalCompositeOperation) || 'source-atop'
    ctx.globalAlpha = Math.max(0, Math.min(1, cfg.tintIntensity ?? 0.65))
    ctx.fillStyle = cfg.tintColor
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.restore()
  }
  return out
}

/**
 * Computes the active frame index of an animated GIF/WebP/Loop Sprite at a given timeline time `t`.
 * Supports playback speed, loop modes ('loop', 'ping-pong', 'once', 'random'), and time offset.
 * `anchorTime` là mốc gốc của đồng hồ Loop (xem `resolveLoopClockAnchor`); chế độ `once` chạy
 * `loopPlayCount` vòng rồi giữ khung cuối.
 */
export function getAnimatedGifFrameIndex(
  gif: AnimatedGifData,
  t: number,
  props: Partial<ImageProps> = {},
  anchorTime = 0
): number {
  const frames = gif?.frames
  if (!frames || frames.length <= 1) return 0
  if (typeof t !== 'number' || isNaN(t)) return 0

  const speed = Math.max(0.01, typeof props.speed === 'number' && !isNaN(props.speed) ? props.speed : 1)
  const loopMode = props.loopMode ?? 'loop'
  const offset = typeof props.timeOffset === 'number' && !isNaN(props.timeOffset) ? props.timeOffset : 0
  const duration = gif.totalDuration && !isNaN(gif.totalDuration) && gif.totalDuration > 0 ? gif.totalDuration : 1
  const anchor = typeof anchorTime === 'number' && !isNaN(anchorTime) ? anchorTime : 0

  let localT = (t - anchor + offset) * speed
  if (isNaN(localT) || localT < 0) localT = 0

  if (loopMode === 'random') {
    const avgDur = Math.max(0.016, duration / Math.max(1, frames.length))
    const slot = Math.floor(localT / avgDur)
    const hash = Math.abs(Math.sin(slot * 12.9898 + 78.233) * 43758.5453)
    return Math.floor((hash - Math.floor(hash)) * frames.length) % frames.length
  }

  let frameT: number
  if (loopMode === 'once') {
    const total = duration * resolveLoopPlayCount(props)
    frameT = localT >= total ? Math.max(0, duration - 1e-4) : localT % duration
  } else if (loopMode === 'ping-pong') {
    const cycle = duration * 2
    const rem = localT % cycle
    frameT = rem < duration ? rem : cycle - rem
  } else {
    frameT = localT % duration
  }

  if (isNaN(frameT) || frameT < 0) frameT = 0

  // Binary search for frame with safety guard
  let low = 0
  let high = frames.length - 1
  let iters = 0
  while (low <= high && iters++ < 64) {
    const mid = (low + high) >> 1
    const f = frames[mid]
    if (!f) break
    if (frameT < f.startTime) {
      high = mid - 1
    } else if (mid + 1 < frames.length && frameT >= frames[mid + 1].startTime) {
      low = mid + 1
    } else {
      return mid
    }
  }
  return Math.max(0, Math.min(frames.length - 1, low))
}

/**
 * Evaluates rhythmic opacity flicker & scale pulse synchronized with a Loop Animate layer.
 */
export function evaluateLoopLayerRhythm(
  props: {
    loopRhythmMode?: LoopRhythmMode
    loopRhythmRateHz?: number
    loopRhythmIntensity?: number
    loopMinOpacity?: number
    loopScaleBeatPct?: number
    timeOffset?: number
    speed?: number
  },
  t: number,
  layerInPoint = 0
): LoopRhythmEvaluation {
  const mode = props.loopRhythmMode ?? 'none'
  if (mode === 'none') {
    return { opacityMultiplier: 1, scaleMultiplier: 1 }
  }

  const rateHz = Math.max(0.1, Math.min(20, props.loopRhythmRateHz ?? 2.2))
  const intensity = Math.max(0, Math.min(1, props.loopRhythmIntensity ?? 0.45))
  const minOpacity = Math.max(0, Math.min(1, props.loopMinOpacity ?? Math.max(0.15, 1 - intensity * 0.85)))
  const scaleBeatPct = Math.max(0, Math.min(60, props.loopScaleBeatPct ?? 12))
  const offset = props.timeOffset ?? 0
  const elapsed = Math.max(0, t - layerInPoint + offset)
  const phase = elapsed * rateHz * Math.PI * 2

  // Smooth harmonic wave (0..1) + organic flicker harmonic
  const wave = Math.sin(phase) * 0.5 + 0.5
  const flickerWave =
    Math.sin(phase) * 0.45 +
    Math.sin(phase * 2.37 + 1.3) * 0.3 +
    Math.cos(phase * 4.13 + 2.7) * 0.25
  const flicker01 = Math.max(0, Math.min(1, flickerWave * 0.5 + 0.5))

  let opacityMultiplier = 1
  let scaleMultiplier = 1

  if (mode === 'flicker_opacity') {
    opacityMultiplier = minOpacity + (1 - minOpacity) * (1 - intensity + intensity * flicker01)
  } else if (mode === 'pulse_scale') {
    const beat = Math.pow(wave, 1.6)
    scaleMultiplier = 1 + (scaleBeatPct / 100) * intensity * beat
  } else if (mode === 'sync_both') {
    const beat = Math.pow(wave, 1.5)
    opacityMultiplier = minOpacity + (1 - minOpacity) * (1 - intensity * 0.8 + intensity * 0.8 * flicker01)
    scaleMultiplier = 1 + (scaleBeatPct / 100) * intensity * beat
  } else if (mode === 'strobe_beat') {
    const step = Math.sin(phase) > -0.15 ? 1 : 0
    const kick = Math.pow(Math.max(0, Math.sin(phase)), 3)
    opacityMultiplier = step ? 1 : minOpacity
    scaleMultiplier = 1 + (scaleBeatPct / 100) * intensity * kick
  }

  return {
    opacityMultiplier: Math.max(0, Math.min(1, opacityMultiplier)),
    scaleMultiplier: Math.max(0.1, Math.min(3, scaleMultiplier))
  }
}
