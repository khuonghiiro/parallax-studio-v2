import { toUnaccentedSnakeCase } from '../../../../shared/slugify'
import type {
  LoopAnimationMode,
  LoopAnimationPackageJson,
  LoopColorConfig
} from '../../../../shared/types'
import { extractFrameCanvas } from './loopFrameExtractor'
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
  sourceConfig?: {
    slicerMode?: SlicerMode
    gridConfig?: GridSlicerConfig
    chromaKey?: ChromaKeyConfig
    contourConfig?: ContourSlicerConfig
  }
}

export interface SaveLoopPackageOutput {
  ok: boolean
  slug: string
  folderPath?: string
  jsonRelPath: string
  thumbnailRelPath: string
  packageJson: LoopAnimationPackageJson
  template: LoopAnimationTemplate
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
    sourceConfig
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

  // 1. Trích xuất canvas và chuyển thành PNG bytes cho từng frame
  const frameCanvases = enabledFrames.map((f) => extractFrameCanvas(sourceCanvas, f, maxW, maxH))
  const framePayloads: Array<{ fileName: string; data: Uint8Array }> = []
  const frameDataUrls: string[] = []

  let totalDuration = 0
  for (let i = 0; i < frameCanvases.length; i++) {
    const fc = frameCanvases[i]
    const fileName = `frame_${String(i).padStart(3, '0')}.png`
    const pngBytes = await canvasToPngBytes(fc)
    framePayloads.push({ fileName, data: pngBytes })
    frameDataUrls.push(fc.toDataURL('image/png'))
    const fMeta = enabledFrames[i]
    totalDuration += Math.max(0.016, baseFrameDuration * (fMeta?.durationRatio || 1))
  }

  // 2. Thumbnail từ Frame #0
  const thumbCanvas = frameCanvases[0]
  const thumbBytes = await canvasToPngBytes(thumbCanvas)
  const thumbDataUrl = thumbCanvas.toDataURL('image/png')

  // 3. Xây dựng cấu trúc animation.json
  const packageJson: LoopAnimationPackageJson = {
    version: '1.0',
    id: slug,
    name: rawName,
    slug,
    category,
    fps,
    speed,
    loopMode,
    frameCount: enabledFrames.length,
    width: maxW,
    height: maxH,
    baseMeshWidth: baseMeshWidth && baseMeshWidth > 0 ? baseMeshWidth : maxW,
    baseMeshHeight: baseMeshHeight && baseMeshHeight > 0 ? baseMeshHeight : maxH,
    duration: Math.max(0.05, totalDuration),
    thumbnail: 'thumbnail.png',
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
      offsetX: f.offsetX ?? 0,
      offsetY: f.offsetY ?? 0
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
  let diskSuccess = false
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
        diskSuccess = true
        folderPath = res.folderPath
      }
    } catch (e) {
      console.warn('[loopPackageSaver] Failed to save package via IPC:', e)
    }
  }

  // 5. Đồng bộ cấu trúc LoopAnimationTemplate vào kho lưu trữ nội bộ
  const template: LoopAnimationTemplate = {
    id: slug,
    name: rawName,
    category,
    badge: `🎞 ${enabledFrames.length}F`,
    description: `Hoạt ảnh lặp ${enabledFrames.length} frame (${fps} FPS • ${loopMode})`,
    imageUrl: thumbnailRelPath,
    thumbUrl: thumbDataUrl,
    renderedFrames: frameDataUrls,
    transparentSheetUrl: thumbDataUrl,
    slicerMode: sourceConfig?.slicerMode || 'grid',
    gridConfig: sourceConfig?.gridConfig || { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
    contourConfig: sourceConfig?.contourConfig,
    chromaKey: sourceConfig?.chromaKey || { enabled: false, keyColor: '#00ff00', similarity: 0.28, smoothness: 0.1, spill: 0.35 },
    fps,
    speed,
    loopMode,
    rhythm,
    frameCount: enabledFrames.length,
    baseMeshWidth: packageJson.baseMeshWidth,
    baseMeshHeight: packageJson.baseMeshHeight,
    frames: enabledFrames.map((f) => ({ ...f }))
  }

  saveLoopTemplate(template)

  return {
    ok: true,
    slug,
    folderPath,
    jsonRelPath,
    thumbnailRelPath,
    packageJson,
    template
  }
}
