import type { AssetMeta } from '@shared/types'
import { assetStore, type AnimatedGifData, type GifFrame } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { applyChromaKeyToImageData, buildGridFrames, extractFrameCanvas } from './loopFrameExtractor'
import { getAllLoopTemplates } from './loopAnimatorStorage'
import { SAMPLE_LOOP_PRESETS, resolveLoopAssetUrl } from './sampleLoops'
import type {
  ChromaKeyConfig,
  LoopAnimationMode,
  LoopAnimationTemplate,
  LoopFrameBox,
  LoopRhythmConfig
} from './types'

export interface LoopExportOptions {
  layerName: string
  sourceCanvas: HTMLCanvasElement
  frames: LoopFrameBox[]
  fps: number
  speed?: number
  loopMode: LoopAnimationMode
  templateId?: string
  rhythm?: LoopRhythmConfig
  shotId?: string | null
}

/**
 * Extracts enabled frames from the processed source canvas, builds an in-memory AnimatedGifData
 * with ImageBitmaps, registers the asset (using Frame #1 as the static PNG thumbnail), and adds
 * a new animated ImageLayer to the active shot.
 */
export async function applyLoopAnimationToProject(
  options: LoopExportOptions
): Promise<{ layerId: string; assetId: string; frameCount: number }> {
  const {
    layerName,
    sourceCanvas,
    frames,
    fps,
    speed = 1,
    loopMode,
    templateId,
    rhythm,
    shotId
  } = options
  const enabledFrames = frames.filter((f) => f.enabled)
  if (enabledFrames.length === 0) {
    throw new Error('Cần bật ít nhất 1 khung hình (frame) để tạo hoạt ảnh lặp.')
  }

  const maxW = Math.max(1, ...enabledFrames.map((f) => f.width))
  const maxH = Math.max(1, ...enabledFrames.map((f) => f.height))
  const baseFrameDuration = 1 / Math.max(1, Math.min(60, fps))

  const gifFrames: GifFrame[] = []
  let currentTime = 0
  let firstFrameCanvas: HTMLCanvasElement | null = null

  for (let i = 0; i < enabledFrames.length; i++) {
    const f = enabledFrames[i]
    const frameCanvas = extractFrameCanvas(sourceCanvas, f, maxW, maxH)
    if (i === 0) {
      firstFrameCanvas = frameCanvas
    }
    const bitmap = await createImageBitmap(frameCanvas, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    })
    const duration = Math.max(0.016, baseFrameDuration * (f.durationRatio || 1))
    gifFrames.push({
      index: i,
      bitmap,
      duration,
      startTime: currentTime
    })
    currentTime += duration
  }

  // Export Frame #1 as the static PNG canvas (NOT the full 4x4 sprite sheet!)
  const thumbCanvas = firstFrameCanvas ?? extractFrameCanvas(sourceCanvas, enabledFrames[0], maxW, maxH)
  const safeSlug =
    layerName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'loop_sprite'

  const runtimeAsset = await assetStore.addCanvas(
    `${safeSlug}_${Date.now().toString(36)}.png`,
    thumbCanvas
  )
  const meta = runtimeAsset.meta
  meta.width = maxW
  meta.height = maxH
  meta.isAnimated = true
  meta.frameCount = gifFrames.length
  meta.duration = Math.max(0.05, currentTime)

  const gifData: AnimatedGifData = {
    frames: gifFrames,
    totalDuration: Math.max(0.05, currentTime),
    width: maxW,
    height: maxH
  }
  runtimeAsset.gif = gifData

  const editor = useEditor.getState()
  const targetShotId =
    shotId !== undefined ? shotId : editor.selectedShotId ?? editor.project.shots[0]?.id ?? null
  const layer = createImageLayer(meta, editor.project.comp, 0)
  layer.name = layerName.trim() || 'Hoạt ảnh Loop'
  layer.shotId = targetShotId
  layer.inPoint = 0
  layer.outPoint = editor.project.comp.duration
  layer.props.loopMode = loopMode
  layer.props.speed = speed
  layer.props.autoPlayPaused = true
  if (templateId) {
    layer.props.loopTemplateId = templateId
  }
  if (rhythm && rhythm.rhythmMode !== 'none') {
    layer.props.loopRhythmMode = rhythm.rhythmMode
    layer.props.loopRhythmRateHz = rhythm.rhythmRateHz
    layer.props.loopRhythmIntensity = rhythm.rhythmIntensity
    layer.props.loopMinOpacity = rhythm.minOpacity
    layer.props.loopScaleBeatPct = rhythm.scaleBeatPct
  }

  editor.update((p) => {
    p.assets.push(meta)
    p.layers.unshift(layer)
  })
  editor.selectLayer(layer.id)

  return {
    layerId: layer.id,
    assetId: meta.id,
    frameCount: gifFrames.length
  }
}

/**
 * Builds an AnimatedGifData + Frame #1 PNG asset from a sprite sheet URL, frame rects, and Chroma Key.
 * Used both for direct preset insertion and for 2.5D Composite layers with `loopConfig`.
 */
export async function buildLoopAnimatedAsset(options: {
  name: string
  spriteSheetUrl: string
  frames?: Array<{
    x: number
    y: number
    width: number
    height: number
    offsetX?: number
    offsetY?: number
    durationRatio?: number
    enabled?: boolean
  }>
  gridConfig?: { cols: number; rows: number; marginX: number; marginY: number; paddingX: number; paddingY: number }
  chromaKey?: ChromaKeyConfig
  fps: number
}): Promise<{ assetMeta: AssetMeta; gifData: AnimatedGifData; width: number; height: number }> {
  const resolvedUrl = await resolveLoopAssetUrl(options.spriteSheetUrl)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`Không thể tải ảnh Sprite Sheet: ${options.spriteSheetUrl}`))
    el.src = resolvedUrl || options.spriteSheetUrl
  })

  const w = img.naturalWidth || img.width || 1024
  const h = img.naturalHeight || img.height || 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D')

  ctx.drawImage(img, 0, 0, w, h)
  if (options.chromaKey?.enabled) {
    const imgData = ctx.getImageData(0, 0, w, h)
    applyChromaKeyToImageData(imgData, options.chromaKey)
    ctx.putImageData(imgData, 0, 0)
  }

  const normalizedFrames: LoopFrameBox[] =
    options.frames && options.frames.length > 0
      ? options.frames
          .filter((f) => f.enabled !== false)
          .map((f, idx) => ({
            id: `frame_${idx}`,
            index: idx,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            offsetX: f.offsetX ?? 0,
            offsetY: f.offsetY ?? 0,
            enabled: true,
            durationRatio: f.durationRatio ?? 1
          }))
      : buildGridFrames(
          w,
          h,
          options.gridConfig ?? { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 }
        )

  const maxW = Math.max(1, ...normalizedFrames.map((f) => f.width))
  const maxH = Math.max(1, ...normalizedFrames.map((f) => f.height))
  const baseFrameDuration = 1 / Math.max(1, Math.min(60, options.fps || 12))

  const gifFrames: GifFrame[] = []
  let currentTime = 0
  let firstFrameCanvas: HTMLCanvasElement | null = null

  for (let i = 0; i < normalizedFrames.length; i++) {
    const f = normalizedFrames[i]
    const frameCanvas = extractFrameCanvas(canvas, f, maxW, maxH)
    if (i === 0) firstFrameCanvas = frameCanvas
    const bitmap = await createImageBitmap(frameCanvas, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    })
    const duration = Math.max(0.016, baseFrameDuration * (f.durationRatio || 1))
    gifFrames.push({
      index: i,
      bitmap,
      duration,
      startTime: currentTime
    })
    currentTime += duration
  }

  const thumbCanvas = firstFrameCanvas ?? extractFrameCanvas(canvas, normalizedFrames[0], maxW, maxH)
  const safeSlug =
    options.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'loop_sprite'

  const runtimeAsset = await assetStore.addCanvas(
    `${safeSlug}_${Date.now().toString(36)}.png`,
    thumbCanvas
  )
  const meta = runtimeAsset.meta
  meta.width = maxW
  meta.height = maxH
  meta.isAnimated = true
  meta.frameCount = gifFrames.length
  meta.duration = Math.max(0.05, currentTime)

  const gifData: AnimatedGifData = {
    frames: gifFrames,
    totalDuration: Math.max(0.05, currentTime),
    width: maxW,
    height: maxH
  }
  runtimeAsset.gif = gifData

  return { assetMeta: meta, gifData, width: maxW, height: maxH }
}

/**
 * Headless helper to directly slice and add a builtin or saved loop preset by ID (used by MCP and quick-insert).
 */
export async function exportLoopPresetDirectly(
  presetId: string,
  overrides?: {
    layerName?: string
    fps?: number
    speed?: number
    loopMode?: LoopAnimationMode
    shotId?: string | null
  }
): Promise<{ layerId: string; assetId: string; frameCount: number }> {
  const allTemplates = getAllLoopTemplates()
  const template: LoopAnimationTemplate | undefined =
    allTemplates.find((t) => t.id === presetId) ??
    (() => {
      const p = SAMPLE_LOOP_PRESETS.find((x) => x.id === presetId) ?? SAMPLE_LOOP_PRESETS[0]
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        badge: p.badge,
        description: p.description,
        imageUrl: p.imageUrl,
        slicerMode: 'grid',
        gridConfig: p.defaultGrid,
        chromaKey: p.defaultChroma,
        fps: p.defaultFps,
        speed: p.defaultSpeed ?? 1,
        loopMode: p.defaultLoopMode ?? 'loop',
        rhythm: p.defaultRhythm
          ? {
              rhythmMode: p.defaultRhythm.rhythmMode ?? 'none',
              rhythmRateHz: p.defaultRhythm.rhythmRateHz ?? 2.2,
              rhythmIntensity: p.defaultRhythm.rhythmIntensity ?? 0.35,
              minOpacity: p.defaultRhythm.minOpacity ?? 0.5,
              scaleBeatPct: p.defaultRhythm.scaleBeatPct ?? 12
            }
          : undefined,
        frameCount: p.defaultGrid.cols * p.defaultGrid.rows
      }
    })()

  // Phân giải đường dẫn asset tương đối (assets/...) qua IPC → blob URL trước khi nạp ảnh
  const resolvedUrl = (await resolveLoopAssetUrl(template.imageUrl)) || template.imageUrl
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`Không thể tải ảnh preset: ${template.imageUrl}`))
    el.src = resolvedUrl
  })

  const w = img.naturalWidth || img.width || 1024
  const h = img.naturalHeight || img.height || 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D')

  ctx.drawImage(img, 0, 0, w, h)
  if (template.chromaKey.enabled) {
    const imgData = ctx.getImageData(0, 0, w, h)
    applyChromaKeyToImageData(imgData, template.chromaKey)
    ctx.putImageData(imgData, 0, 0)
  }

  const frames =
    template.frames && template.frames.length > 0
      ? template.frames
      : buildGridFrames(w, h, template.gridConfig)

  return applyLoopAnimationToProject({
    layerName: overrides?.layerName ?? template.name,
    sourceCanvas: canvas,
    frames,
    fps: overrides?.fps ?? template.fps,
    speed: overrides?.speed ?? template.speed ?? 1,
    loopMode: overrides?.loopMode ?? template.loopMode ?? 'loop',
    templateId: template.id,
    rhythm: template.rhythm,
    shotId: overrides?.shotId
  })
}
