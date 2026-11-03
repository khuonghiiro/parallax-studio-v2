import { toUnaccentedSnakeCase } from '../../../../shared/slugify'
import type {
  LoopAnimationMode,
  LoopAnimationPackageJson,
  LoopColorConfig
} from '../../../../shared/types'
import { computeLoopSheetGrid, extractFrameCanvas, primeCachedLoopTemplateSheet } from './loopFrameExtractor'
import { invalidateLoopPackageCache } from './loopPackageLoader'
import { saveLoopTemplate } from './loopAnimatorStorage'
import type {
  ContourSlicerConfig,
  GridSlicerConfig,
  ChromaKeyConfig,
  LoopAnimationTemplate,
  LoopCategorySlug,
  LoopFrameBox,
  LoopRhythmConfig,
  SlicerMode
} from './types'

export interface SaveLoopProgressInfo {
  current: number
  total: number
  phase: 'extract' | 'write' | 'sync'
  message: string
}

export interface SaveLoopPackageOptions {
  name: string
  sourceCanvas: HTMLCanvasElement
  frames: LoopFrameBox[]
  fps: number
  speed?: number
  loopMode?: LoopAnimationMode
  category?: LoopCategorySlug
  rhythm?: LoopRhythmConfig
  colorConfig?: LoopColorConfig
  baseMeshWidth?: number
  baseMeshHeight?: number
  /** Chỉ số khung hình (0-based) đang focus trong BBox để dùng làm thumbnail (mặc định 0 = Frame #1) */
  thumbnailFrameIndex?: number
  sourceConfig?: {
    slicerMode?: SlicerMode
    gridConfig?: GridSlicerConfig
    chromaKey?: ChromaKeyConfig
    contourConfig?: ContourSlicerConfig
  }
  onProgress?: (info: SaveLoopProgressInfo) => void
}

export interface SaveLoopPackageOutput {
  ok: boolean
  slug: string
  folderPath?: string
  jsonRelPath: string
  thumbnailRelPath: string
  packageJson: LoopAnimationPackageJson
  template: LoopAnimationTemplate
  frameCanvases: HTMLCanvasElement[]
  stripCanvas: HTMLCanvasElement
  error?: string
}

/** Chuyển Canvas 2D thành mảng byte Uint8Array của định dạng PNG */
export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        const dataUrl = canvas.toDataURL('image/png')
        const bin = atob(dataUrl.split(',')[1] || '')
        const u8 = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        resolve(u8)
        return
      }
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(() => {
        const dataUrl = canvas.toDataURL('image/png')
        const bin = atob(dataUrl.split(',')[1] || '')
        const u8 = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        resolve(u8)
      })
    }, 'image/png')
  })
}

/**
 * Tách và lưu hoạt ảnh lặp thành một gói thư mục không dấu `assets/loop_animations/<slug>/`
 * chứa danh sách các tệp frame ảnh PNG đã tách nền sẵn, thumbnail.png và animation.json
 */
export async function saveLoopAnimationAsPackage(
  options: SaveLoopPackageOptions
): Promise<SaveLoopPackageOutput> {
  const {
    name,
    sourceCanvas,
    frames,
    fps,
    speed = 1,
    loopMode = 'loop',
    category = 'custom',
    rhythm,
    colorConfig,
    baseMeshWidth,
    baseMeshHeight,
    thumbnailFrameIndex,
    sourceConfig,
    onProgress
  } = options

  const enabledFrames = frames.filter((f) => f.enabled)
  if (enabledFrames.length === 0) {
    throw new Error('Cần ít nhất 1 khung hình (frame) được bật để lưu gói hoạt ảnh.')
  }

  const rawName = name.trim() || 'Hoạt ảnh Loop'
  const slug = toUnaccentedSnakeCase(rawName, 'loop_anim')
  const maxW = Math.max(1, ...enabledFrames.map((f) => f.width))
  const maxH = Math.max(1, ...enabledFrames.map((f) => f.height))
  const baseFrameDuration = 1 / Math.max(1, Math.min(60, fps))
  const totalFrames = enabledFrames.length

  // 1. Trích xuất canvas và chuyển thành PNG bytes cho từng frame kèm báo cáo tiến trình
  const frameCanvases: HTMLCanvasElement[] = []
  const framePayloads: Array<{ fileName: string; data: Uint8Array }> = []

  const grid = computeLoopSheetGrid(totalFrames)
  const stripCanvas = document.createElement('canvas')
  stripCanvas.width = maxW * grid.cols
  stripCanvas.height = maxH * grid.rows
  const stripCtx = stripCanvas.getContext('2d')
  const stripFrames: LoopFrameBox[] = []

  let totalDuration = 0
  for (let i = 0; i < totalFrames; i++) {
    const fMeta = enabledFrames[i]
    const fileName = `frame_${String(i).padStart(3, '0')}.png`
    onProgress?.({
      current: i + 1,
      total: totalFrames,
      phase: 'extract',
      message: `Đang xử lý & đóng gói ${i + 1}/${totalFrames} frame (${fileName})…`
    })
    if (i % 2 === 1) {
      await new Promise((r) => setTimeout(r, 0))
    }

    const fc = extractFrameCanvas(sourceCanvas, fMeta, maxW, maxH)
    frameCanvases.push(fc)

    const col = i % grid.cols
    const row = Math.floor(i / grid.cols)
    const cellX = col * maxW
    const cellY = row * maxH
    if (stripCtx) {
      stripCtx.drawImage(fc, cellX, cellY)
    }
    stripFrames.push({
      id: `frame_${i}`,
      index: i,
      x: cellX,
      y: cellY,
      width: maxW,
      height: maxH,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: fMeta?.durationRatio ?? 1
    })

    const pngBytes = await canvasToPngBytes(fc)
    framePayloads.push({ fileName, data: pngBytes })
    totalDuration += Math.max(0.016, baseFrameDuration * (fMeta?.durationRatio || 1))
  }

  // 2. Thumbnail gọn nhẹ từ frame đang được focus trong BBox (hoặc mặc định Frame #1 = index 0)
  const rawThumbFrame =
    typeof thumbnailFrameIndex === 'number' &&
    thumbnailFrameIndex >= 0 &&
    thumbnailFrameIndex < frames.length
      ? frames[thumbnailFrameIndex]
      : undefined
  const resolvedThumbIdx = rawThumbFrame
    ? Math.max(0, enabledFrames.indexOf(rawThumbFrame))
    : typeof thumbnailFrameIndex === 'number' &&
        thumbnailFrameIndex >= 0 &&
        thumbnailFrameIndex < frameCanvases.length
      ? thumbnailFrameIndex
      : 0
  const firstCanvas = frameCanvases[resolvedThumbIdx] || frameCanvases[0]
  const thumbScale = Math.min(1, 256 / Math.max(1, firstCanvas.width, firstCanvas.height))
  let thumbCanvas = firstCanvas
  if (thumbScale < 0.99) {
    thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = Math.max(1, Math.round(firstCanvas.width * thumbScale))
    thumbCanvas.height = Math.max(1, Math.round(firstCanvas.height * thumbScale))
    const tctx = thumbCanvas.getContext('2d')
    if (tctx) tctx.drawImage(firstCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
  }
  const thumbBytes = await canvasToPngBytes(thumbCanvas)
  const thumbDataUrl = thumbCanvas.toDataURL('image/png')

  // 3. Xây dựng cấu trúc animation.json
  onProgress?.({
    current: totalFrames,
    total: totalFrames,
    phase: 'write',
    message: `Đang lưu cấu hình animation.json vào loop_animations/${slug}/…`
  })
  await new Promise((r) => setTimeout(r, 0))

  const packageJson: LoopAnimationPackageJson = {
    version: '1.0',
    id: slug,
    name: rawName,
    slug,
    category,
    fps,
    speed,
    loopMode,
    frameCount: totalFrames,
    width: maxW,
    height: maxH,
    baseMeshWidth: baseMeshWidth && baseMeshWidth > 0 ? baseMeshWidth : maxW,
    baseMeshHeight: baseMeshHeight && baseMeshHeight > 0 ? baseMeshHeight : maxH,
    duration: Math.max(0.05, totalDuration),
    thumbnail: 'thumbnail.png',
    thumbnailFrameIndex: resolvedThumbIdx,
    colorConfig: colorConfig || {
      tintColor: null,
      tintIntensity: 0,
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      hueRotate: 0,
      blendMode: 'normal',
      opacity: 1.0
    },
    rhythm: rhythm
      ? {
          rhythmMode: rhythm.rhythmMode,
          rhythmRateHz: rhythm.rhythmRateHz,
          rhythmIntensity: rhythm.rhythmIntensity,
          minOpacity: rhythm.minOpacity,
          scaleBeatPct: rhythm.scaleBeatPct
        }
      : undefined,
    frames: enabledFrames.map((f, idx) => ({
      index: idx,
      file: `frame_${String(idx).padStart(3, '0')}.png`,
      durationRatio: f.durationRatio ?? 1,
      offsetX: 0,
      offsetY: 0
    })),
    sourceConfig: sourceConfig
      ? {
          slicerMode: sourceConfig.slicerMode,
          gridConfig: sourceConfig.gridConfig as unknown as Record<string, unknown>,
          chromaKey: sourceConfig.chromaKey as unknown as Record<string, unknown>,
          contourConfig: sourceConfig.contourConfig as unknown as Record<string, unknown>
        }
      : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const jsonContent = JSON.stringify(packageJson, null, 2)
  const relPath = `loop_animations/${slug}`
  const jsonRelPath = `${relPath}/animation.json`
  const thumbnailRelPath = `${relPath}/thumbnail.png`

  // 4. Ghi lên đĩa qua IPC
  let folderPath: string | undefined
  if (typeof window !== 'undefined' && window.api?.saveLoopAnimationPackage) {
    try {
      const res = await window.api.saveLoopAnimationPackage({
        folderName: slug,
        name: rawName,
        category,
        jsonContent,
        frames: framePayloads,
        thumbnail: { fileName: 'thumbnail.png', data: thumbBytes }
      })
      if (res.ok) {
        folderPath = res.folderPath
      }
    } catch (e) {
      console.warn('[loopPackageSaver] Failed to save package via IPC:', e)
    }
  }

  // 5. Ghi sẵn dải frame ngang đã tách nền vào RAM cache để hiển thị 0ms không cần cắt lại
  invalidateLoopPackageCache(jsonRelPath)
  primeCachedLoopTemplateSheet(slug, {
    canvas: stripCanvas,
    frames: stripFrames,
    frameW: maxW,
    frameH: maxH,
    packageJson
  })

  // 6. Đồng bộ cấu trúc LoopAnimationTemplate gọn nhẹ vào kho lưu trữ (không lưu base64 16 frame vào localStorage)
  const template: LoopAnimationTemplate = {
    id: slug,
    name: rawName,
    category,
    badge: `🎞 ${totalFrames}F`,
    description: `Hoạt ảnh lặp ${totalFrames} frame (${fps} FPS • ${loopMode})`,
    imageUrl: `assets/${thumbnailRelPath}`,
    thumbUrl: thumbDataUrl,
    thumbnailFrameIndex: resolvedThumbIdx,
    loopJsonPath: jsonRelPath,
    packageFolder: relPath,
    framePaths: enabledFrames.map((_, idx) => `${relPath}/frame_${String(idx).padStart(3, '0')}.png`),
    colorConfig: packageJson.colorConfig,
    slicerMode: 'grid',
    gridConfig: {
      cols: grid.cols,
      rows: grid.rows,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0,
      borderPadding: 0
    },
    contourConfig: sourceConfig?.contourConfig,
    chromaKey: {
      ...(sourceConfig?.chromaKey || {
        enabled: false,
        keyColor: '#00ff00',
        similarity: 0.28,
        smoothness: 0.1,
        spill: 0.35
      }),
      enabled: false
    },
    fps,
    speed,
    loopMode,
    rhythm,
    frameCount: totalFrames,
    sourceWidth: maxW * grid.cols,
    sourceHeight: maxH * grid.rows,
    baseMeshWidth: packageJson.baseMeshWidth,
    baseMeshHeight: packageJson.baseMeshHeight,
    frames: stripFrames
  }

  saveLoopTemplate(template)

  return {
    ok: true,
    slug,
    folderPath,
    jsonRelPath,
    thumbnailRelPath,
    packageJson,
    template,
    frameCanvases,
    stripCanvas
  }
}
