import type {
  LoopAnimationMode,
  LoopAnimationPackageJson,
  LoopAnimationConfigOverrides,
  LoopColorConfig
} from '../../../../shared/types'
import type { LoopRhythmConfig } from './types'
import { loadAssetBytesFromDiskOrBuiltIn } from '../../project/json/assetLoader'
import { type AnimatedGifData, type GifFrame } from '../../project/assets'
import { createLoopFrameBitmap } from './loopAnimationExporter'

export interface EffectiveLoopConfig {
  fps: number
  speed: number
  loopMode: LoopAnimationMode
  color: LoopColorConfig
  rhythm?: LoopRhythmConfig
  timeOffset: number
}

/** Hợp nhất cấu hình gốc từ animation.json với các thuộc tính ghi đè (overrides) của layer */
export function resolveEffectiveLoopConfig(
  baseJson: Partial<LoopAnimationPackageJson>,
  overrides?: Partial<LoopAnimationConfigOverrides> | null,
  fallbackProps?: {
    speed?: number
    loopMode?: LoopAnimationMode
    fps?: number
    timeOffset?: number
    color?: LoopColorConfig
  }
): EffectiveLoopConfig {
  const baseColor = baseJson.colorConfig || {}
  const overrideColor = overrides?.color || fallbackProps?.color || {}

  const mergedColor: LoopColorConfig = {
    tintColor: overrideColor.tintColor !== undefined ? overrideColor.tintColor : baseColor.tintColor,
    tintIntensity: overrideColor.tintIntensity !== undefined ? overrideColor.tintIntensity : (baseColor.tintIntensity ?? 0),
    brightness: overrideColor.brightness !== undefined ? overrideColor.brightness : (baseColor.brightness ?? 1.0),
    contrast: overrideColor.contrast !== undefined ? overrideColor.contrast : (baseColor.contrast ?? 1.0),
    saturation: overrideColor.saturation !== undefined ? overrideColor.saturation : (baseColor.saturation ?? 1.0),
    hueRotate: overrideColor.hueRotate !== undefined ? overrideColor.hueRotate : (baseColor.hueRotate ?? 0),
    blendMode: overrideColor.blendMode !== undefined ? overrideColor.blendMode : (baseColor.blendMode ?? 'normal'),
    opacity: overrideColor.opacity !== undefined ? overrideColor.opacity : (baseColor.opacity ?? 1.0)
  }

  const fps = overrides?.fps ?? fallbackProps?.fps ?? baseJson.fps ?? 14
  const speed = overrides?.speed ?? fallbackProps?.speed ?? baseJson.speed ?? 1.0
  const loopMode = overrides?.loopMode ?? fallbackProps?.loopMode ?? baseJson.loopMode ?? 'loop'
  const timeOffset = overrides?.timeOffset ?? fallbackProps?.timeOffset ?? 0

  let mergedRhythm: LoopRhythmConfig | undefined
  if (baseJson.rhythm || overrides?.rhythm) {
    mergedRhythm = {
      rhythmMode: overrides?.rhythm?.rhythmMode ?? baseJson.rhythm?.rhythmMode ?? 'none',
      rhythmRateHz: overrides?.rhythm?.rhythmRateHz ?? baseJson.rhythm?.rhythmRateHz ?? 2.2,
      rhythmIntensity: overrides?.rhythm?.rhythmIntensity ?? baseJson.rhythm?.rhythmIntensity ?? 0.35,
      minOpacity: overrides?.rhythm?.minOpacity ?? baseJson.rhythm?.minOpacity ?? 0.5,
      scaleBeatPct: overrides?.rhythm?.scaleBeatPct ?? baseJson.rhythm?.scaleBeatPct ?? 12
    }
  }

  return {
    fps,
    speed,
    loopMode,
    color: mergedColor,
    rhythm: mergedRhythm,
    timeOffset
  }
}

/** Áp dụng bộ lọc màu sắc, độ sáng, độ bão hoà và lớp phủ tint lên Canvas frame */
export function applyLoopColorFilterToCanvas(
  canvas: HTMLCanvasElement,
  cfg?: LoopColorConfig
): HTMLCanvasElement {
  if (!cfg || typeof document === 'undefined') return canvas
  const hasFilter =
    (cfg.brightness !== undefined && cfg.brightness !== 1) ||
    (cfg.contrast !== undefined && cfg.contrast !== 1) ||
    (cfg.saturation !== undefined && cfg.saturation !== 1) ||
    (cfg.hueRotate !== undefined && cfg.hueRotate !== 0)
  const hasTint = Boolean(cfg.tintColor && (cfg.tintIntensity ?? 0) > 0)
  if (!hasFilter && !hasTint) return canvas

  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  if (!ctx) return canvas

  const filters: string[] = []
  if (cfg.brightness !== undefined && cfg.brightness !== 1) filters.push(`brightness(${cfg.brightness})`)
  if (cfg.contrast !== undefined && cfg.contrast !== 1) filters.push(`contrast(${cfg.contrast})`)
  if (cfg.saturation !== undefined && cfg.saturation !== 1) filters.push(`saturate(${cfg.saturation})`)
  if (cfg.hueRotate !== undefined && cfg.hueRotate !== 0) filters.push(`hue-rotate(${cfg.hueRotate}deg)`)
  if (filters.length > 0) ctx.filter = filters.join(' ')

  ctx.drawImage(canvas, 0, 0)
  ctx.filter = 'none'

  if (hasTint && cfg.tintColor) {
    ctx.save()
    ctx.globalCompositeOperation = (cfg.blendMode as GlobalCompositeOperation) || 'source-atop'
    ctx.globalAlpha = Math.max(0, Math.min(1, cfg.tintIntensity ?? 0.6))
    ctx.fillStyle = cfg.tintColor
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.restore()
  }

  return out
}

const _packageJsonCache = new Map<string, LoopAnimationPackageJson>()

/**
 * Nạp tệp cấu hình animation.json và giải mã các frame ảnh kèm kế thừa tham số ghi đè
 */
export async function loadLoopPackageData(
  jsonRelPath: string,
  overrides?: Partial<LoopAnimationConfigOverrides> | null,
  fallbackProps?: {
    speed?: number
    loopMode?: LoopAnimationMode
    fps?: number
    timeOffset?: number
    color?: LoopColorConfig
  }
): Promise<{
  packageJson: LoopAnimationPackageJson
  effectiveConfig: EffectiveLoopConfig
  gifData: AnimatedGifData
  thumbCanvas: HTMLCanvasElement
} | null> {
  let cleanJson = jsonRelPath.replace(/\\/g, '/').replace(/^builtin:/, '').replace(/^assets\//, '').trim()
  if (!cleanJson.endsWith('.json')) {
    cleanJson = cleanJson.replace(/\/+$/, '') + '/animation.json'
  }

  // 1. Nạp JSON từ đĩa hoặc cache
  let packageJson = _packageJsonCache.get(cleanJson)
  if (!packageJson) {
    const rawFile = await loadAssetBytesFromDiskOrBuiltIn(cleanJson)
    if (!rawFile || !rawFile.data) return null
    try {
      const decoder = new TextDecoder('utf-8')
      const text = decoder.decode(rawFile.data)
      packageJson = JSON.parse(text) as LoopAnimationPackageJson
      _packageJsonCache.set(cleanJson, packageJson)
    } catch (e) {
      console.warn('[loopPackageLoader] Failed to parse animation.json:', e)
      return null
    }
  }

  const effectiveConfig = resolveEffectiveLoopConfig(packageJson, overrides, fallbackProps)
  const baseFolder = cleanJson.includes('/') ? cleanJson.slice(0, cleanJson.lastIndexOf('/')) : ''
  const frames = packageJson.frames || []
  if (frames.length === 0) return null

  // 2. Tải từng frame ảnh PNG
  const frameBitmaps: ImageBitmap[] = []
  const frameCanvases: HTMLCanvasElement[] = []
  const baseFrameDuration = 1 / Math.max(1, Math.min(60, effectiveConfig.fps))

  for (const f of frames) {
    const frameRel = `${baseFolder}/${f.file}`
    const file = await loadAssetBytesFromDiskOrBuiltIn(frameRel)
    if (!file || !file.data) continue

    const blob = new Blob([file.data as unknown as BlobPart], { type: file.mime || 'image/png' })
    const imgBitmap = await createImageBitmap(blob)

    // Tạo canvas để áp dụng bộ lọc màu nếu có
    const c = document.createElement('canvas')
    c.width = imgBitmap.width
    c.height = imgBitmap.height
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.drawImage(imgBitmap, 0, 0)
    }
    imgBitmap.close()

    // Hợp nhất màu riêng của từng frame với màu tổng thể
    const effectiveFrameColor: LoopColorConfig = {
      ...effectiveConfig.color,
      tintColor: f.tintColor !== undefined ? f.tintColor : effectiveConfig.color.tintColor,
      brightness: f.brightness !== undefined ? f.brightness : effectiveConfig.color.brightness,
      contrast: f.contrast !== undefined ? f.contrast : effectiveConfig.color.contrast,
      saturation: f.saturation !== undefined ? f.saturation : effectiveConfig.color.saturation,
      hueRotate: f.hueRotate !== undefined ? f.hueRotate : effectiveConfig.color.hueRotate,
      opacity: f.opacity !== undefined ? f.opacity : effectiveConfig.color.opacity
    }

    const filtered = applyLoopColorFilterToCanvas(c, effectiveFrameColor)
    frameCanvases.push(filtered)
    const bmp = await createLoopFrameBitmap(filtered)
    frameBitmaps.push(bmp)
  }

  if (frameBitmaps.length === 0) return null

  // 3. Xây dựng AnimatedGifData
  const gifFrames: GifFrame[] = []
  let currentTime = 0
  for (let i = 0; i < frameBitmaps.length; i++) {
    const fMeta = frames[i]
    const dur = Math.max(0.016, baseFrameDuration * (fMeta?.durationRatio || 1))
    gifFrames.push({
      index: i,
      bitmap: frameBitmaps[i],
      duration: dur,
      startTime: currentTime
    })
    currentTime += dur
  }

  const maxW = Math.max(1, ...frameBitmaps.map((b) => b.width))
  const maxH = Math.max(1, ...frameBitmaps.map((b) => b.height))

  const gifData: AnimatedGifData = {
    frames: gifFrames,
    totalDuration: Math.max(0.05, currentTime),
    width: maxW,
    height: maxH
  }

  const thumbCanvas = frameCanvases[0] || document.createElement('canvas')

  return {
    packageJson,
    effectiveConfig,
    gifData,
    thumbCanvas
  }
}
