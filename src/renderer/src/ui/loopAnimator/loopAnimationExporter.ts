import type { AssetMeta } from '@shared/types'
import { assetStore, type AnimatedGifData, type GifFrame } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import {
  applyChromaKeyToImageData,
  buildGridFrames,
  clearGridBorderPadding,
  extractFrameCanvas,
  getCachedLoopTemplateSheet
} from './loopFrameExtractor'
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
  loopJsonPath?: string
  loopOverrides?: import('@shared/types').LoopAnimationConfigOverrides
  rhythm?: LoopRhythmConfig
  shotId?: string | null
  initialPosition?: [number, number, number]
  /** Kích thước mặt phẳng Mesh chuẩn trong không gian 3D (độc lập với độ phân giải texture 2K/4K) */
  baseMeshWidth?: number
  baseMeshHeight?: number
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
    shotId,
    initialPosition
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

  const frameCanvases = enabledFrames.map((f) => extractFrameCanvas(sourceCanvas, f, maxW, maxH))
  firstFrameCanvas = frameCanvases[0] ?? null

  const bitmaps = await Promise.all(frameCanvases.map((fc) => createLoopFrameBitmap(fc)))

  for (let i = 0; i < enabledFrames.length; i++) {
    const f = enabledFrames[i]
    const duration = Math.max(0.016, baseFrameDuration * (f.durationRatio || 1))
    gifFrames.push({
      index: i,
      bitmap: bitmaps[i],
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
  // Giữ kích thước mặt phẳng Mesh chuẩn (baseMeshWidth × baseMeshHeight) độc lập với độ phân giải texture 2K/4K
  if (options.baseMeshWidth && options.baseMeshWidth > 0 && options.baseMeshHeight && options.baseMeshHeight > 0) {
    layer.props.width = options.baseMeshWidth
    layer.props.height = options.baseMeshHeight
  }
  if (initialPosition) {
    layer.transform.position.value = [initialPosition[0], initialPosition[1], initialPosition[2] ?? 0]
  }
  layer.inPoint = 0
  layer.outPoint = editor.project.comp.duration
  layer.props.loopMode = loopMode
  layer.props.speed = speed
  layer.props.autoPlayPaused = true
  if (templateId) {
    layer.props.loopTemplateId = templateId
  }
  if (options.loopJsonPath) {
    layer.props.loopJsonPath = options.loopJsonPath
  }
  if (options.loopOverrides) {
    layer.props.loopOverrides = options.loopOverrides
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
 * Tạo ImageBitmap cho 1 frame hoạt ảnh lặp. Bắt buộc lật dọc (flipY) giống hệt luồng giải mã
 * ảnh/GIF chuẩn của assetStore vì TexturePool tải texture với `flipY = false` — thiếu bước này
 * hoạt ảnh sẽ bị lộn ngược khi chèn vào cảnh hoặc chèn cụm 2.5D có mảnh Loop.
 */
export async function createLoopFrameBitmap(
  source: HTMLCanvasElement | ImageBitmapSource | string
): Promise<ImageBitmap> {
  const bitmapOpts: ImageBitmapOptions = {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none'
  }
  if (typeof source === 'string') {
    const res = await fetch(source)
    const blob = await res.blob()
    return createImageBitmap(blob, bitmapOpts)
  }
  return createImageBitmap(source, bitmapOpts)
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
  renderedFrames?: string[]
  gridConfig?: { cols: number; rows: number; marginX: number; marginY: number; paddingX: number; paddingY: number }
  chromaKey?: ChromaKeyConfig
  fps: number
  meshWidth?: number
  meshHeight?: number
}): Promise<{ assetMeta: AssetMeta; gifData: AnimatedGifData; width: number; height: number }> {
  // 1. Tối ưu cực hạn: Nếu đã lưu sẵn các frame PNG tách nền (renderedFrames), giải mã trực tiếp 0ms CPU
  if (options.renderedFrames && options.renderedFrames.length > 0) {
    const urls = options.renderedFrames
    const baseFrameDuration = 1 / Math.max(1, Math.min(60, options.fps || 12))
    const bitmaps = await Promise.all(urls.map((u) => createLoopFrameBitmap(u)))
    const maxW = Math.max(1, ...bitmaps.map((b) => b.width))
    const maxH = Math.max(1, ...bitmaps.map((b) => b.height))
    const gifFrames: GifFrame[] = []
    let currentTime = 0
    for (let i = 0; i < bitmaps.length; i++) {
      const bmp = bitmaps[i]
      const duration = Math.max(0.016, baseFrameDuration)
      gifFrames.push({
        index: i,
        bitmap: bmp,
        duration,
        startTime: currentTime
      })
      currentTime += duration
    }
    const safeSlug =
      options.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'loop_sprite'

    const thumbBmp = bitmaps[0]
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = thumbBmp.width
    thumbCanvas.height = thumbBmp.height
    const tctx = thumbCanvas.getContext('2d')
    if (tctx) tctx.drawImage(thumbBmp, 0, 0)

    const runtimeAsset = await assetStore.addCanvas(
      `${safeSlug}_${Date.now().toString(36)}.png`,
      thumbCanvas
    )
    const meta = runtimeAsset.meta
    const effectiveMeshW = options.meshWidth && options.meshWidth > 1 ? options.meshWidth : maxW
    const effectiveMeshH = options.meshHeight && options.meshHeight > 1 ? options.meshHeight : maxH
    meta.width = effectiveMeshW
    meta.height = effectiveMeshH
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

    return { assetMeta: meta, gifData, width: effectiveMeshW, height: effectiveMeshH }
  }
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

  const frameCanvases = normalizedFrames.map((f) => extractFrameCanvas(canvas, f, maxW, maxH))
  if (frameCanvases.length > 0) firstFrameCanvas = frameCanvases[0]
  const bitmaps = await Promise.all(frameCanvases.map((fc) => createLoopFrameBitmap(fc)))

  for (let i = 0; i < normalizedFrames.length; i++) {
    const f = normalizedFrames[i]
    const duration = Math.max(0.016, baseFrameDuration * (f.durationRatio || 1))
    gifFrames.push({
      index: i,
      bitmap: bitmaps[i],
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
  const effectiveMeshW = options.meshWidth && options.meshWidth > 1 ? options.meshWidth : maxW
  const effectiveMeshH = options.meshHeight && options.meshHeight > 1 ? options.meshHeight : maxH
  meta.width = effectiveMeshW
  meta.height = effectiveMeshH
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

  return { assetMeta: meta, gifData, width: effectiveMeshW, height: effectiveMeshH }
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
    initialPosition?: [number, number, number]
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

  // Ưu tiên tận dụng sheet đã khử chroma key từ cache trong RAM để chèn tức thì không đơ lag
  const cached = await getCachedLoopTemplateSheet(template)
  let canvas: HTMLCanvasElement
  let frames: LoopFrameBox[]

  if (cached && cached.canvas && cached.frames.length > 0) {
    canvas = cached.canvas
    frames = cached.frames.map((f, idx) => ({
      id: f.id || `f_${idx}`,
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
  } else {
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
    canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D')

    ctx.drawImage(img, 0, 0, w, h)
    if (template.chromaKey.enabled) {
      const imgData = ctx.getImageData(0, 0, w, h)
      // Xoá vạch lưới trước khi khử nền (khớp với xem trước) để "Chỉ tách nền ngoài" loang được vào từng ô
      if ((template.gridConfig?.borderPadding ?? 0) > 0) clearGridBorderPadding(imgData, template.gridConfig)
      applyChromaKeyToImageData(imgData, template.chromaKey)
      ctx.putImageData(imgData, 0, 0)
    }

    frames =
      template.frames && template.frames.length > 0
        ? template.frames
        : buildGridFrames(w, h, template.gridConfig)
  }

  return applyLoopAnimationToProject({
    layerName: overrides?.layerName ?? template.name,
    sourceCanvas: canvas,
    frames,
    fps: overrides?.fps ?? template.fps,
    speed: overrides?.speed ?? template.speed ?? 1,
    loopMode: overrides?.loopMode ?? template.loopMode ?? 'loop',
    templateId: template.id,
    shotId: overrides?.shotId,
    initialPosition: overrides?.initialPosition,
    baseMeshWidth: template.baseMeshWidth,
    baseMeshHeight: template.baseMeshHeight
  })
}

/**
 * Khi người dùng nâng cấp / lưu lại một mẫu Loop Animation (ví dụ thay Sprite Sheet 2K/4K),
 * tự động đồng bộ các layer đang dùng mẫu này trong Cảnh 3D và trong kho Xưởng Lắp Ráp 2.5D:
 * - Cập nhật bộ frame mới sắc nét (2K/4K) nhưng GIỮ NGUYÊN kích thước mặt phẳng Mesh (`width × height`)
 *   và vị trí/xương hiện tại để không bị phóng to lệch bố cục.
 */
export async function syncSceneAndCompositesWithLoopTemplate(
  template: LoopAnimationTemplate
): Promise<number> {
  const editor = useEditor.getState()
  const matchingLayers = editor.project.layers.filter(
    (l) => l.type === 'image' && l.props.loopTemplateId === template.id
  )
  let updatedCount = 0

  if (matchingLayers.length > 0) {
    const built = await buildLoopAnimatedAsset({
      name: template.name,
      spriteSheetUrl: template.transparentSheetUrl || template.imageUrl,
      frames: template.frames,
      renderedFrames: template.renderedFrames,
      gridConfig: template.gridConfig,
      chromaKey: template.transparentSheetUrl
        ? { ...template.chromaKey, enabled: false }
        : template.chromaKey,
      fps: template.fps
    })

    editor.update((p) => {
      if (!p.assets.some((a) => a.id === built.assetMeta.id)) {
        p.assets.push(built.assetMeta)
      }
      for (const l of p.layers) {
        if (l.type === 'image' && l.props.loopTemplateId === template.id) {
          // Bảo toàn 100% kích thước mặt phẳng Mesh (l.props.width × l.props.height) trên cảnh!
          l.props.assetId = built.assetMeta.id
          l.props.loopMode = template.loopMode
          l.props.speed = template.speed ?? l.props.speed ?? 1
          if (template.rhythm) {
            l.props.loopRhythmMode = template.rhythm.rhythmMode
            l.props.loopRhythmRateHz = template.rhythm.rhythmRateHz
            l.props.loopRhythmIntensity = template.rhythm.rhythmIntensity
            l.props.loopMinOpacity = template.rhythm.minOpacity
            l.props.loopScaleBeatPct = template.rhythm.scaleBeatPct
          }
          updatedCount++
        }
      }
    }, `Đồng bộ Mesh hoạt ảnh Loop: ${template.name}`)
  }

  return updatedCount
}
