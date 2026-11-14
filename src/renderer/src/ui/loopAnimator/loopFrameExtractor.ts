import {
  applyChromaKeyToImageData,
  clearGridBorderPadding,
  detectCornerKeyColor,
  parseHexRgb
} from './loopChromaProcessor'
import {
  extractHighResFrameFromProxy,
  getLoopSourceCanvasMeta,
  getLoopSourceLogicalSize,
  scaleGridConfigForWorkCanvas
} from './loopSourceProxy'
import {
  autoCenterLoopFrames,
  clusterAndSortBoxes,
  detectContourFrames,
  type RawBoundingBox
} from './loopContourSlicer'
import { applyLoopColorFilterToSource } from '../../project/gifHelper'
import { resolveLoopAssetUrl } from './sampleLoops'
import type { LoopAnimationPackageJson, LoopColorConfig } from '@shared/types'
import type {
  GridSlicerConfig,
  LoopAnimationTemplate,
  LoopFrameBox
} from './types'

export {
  applyChromaKeyToImageData,
  autoCenterLoopFrames,
  clearGridBorderPadding,
  clusterAndSortBoxes,
  detectContourFrames,
  detectCornerKeyColor,
  parseHexRgb,
  type RawBoundingBox
}

/**
 * Generate a list of LoopFrameBox rectangles from a uniform grid configuration.
 * Supports `borderPadding` to inset each cell inward and strip out grid border lines.
 */
export function buildGridFrames(
  imageWidth: number,
  imageHeight: number,
  grid: GridSlicerConfig
): LoopFrameBox[] {
  const cols = Math.max(1, Math.min(32, Math.round(grid.cols)))
  const rows = Math.max(1, Math.min(32, Math.round(grid.rows)))
  const borderPad = Math.max(0, Math.round(grid.borderPadding ?? 0))
  const usableW = Math.max(1, imageWidth - grid.marginX * 2 - grid.paddingX * (cols - 1))
  const usableH = Math.max(1, imageHeight - grid.marginY * 2 - grid.paddingY * (rows - 1))
  const cellW = Math.max(1, Math.floor(usableW / cols))
  const cellH = Math.max(1, Math.floor(usableH / rows))

  const frames: LoopFrameBox[] = []
  let index = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = Math.round(grid.marginX + c * (cellW + grid.paddingX))
      const baseY = Math.round(grid.marginY + r * (cellH + grid.paddingY))
      const x = Math.max(0, Math.min(imageWidth - 1, baseX + borderPad))
      const y = Math.max(0, Math.min(imageHeight - 1, baseY + borderPad))
      const innerW = Math.max(1, cellW - borderPad * 2)
      const innerH = Math.max(1, cellH - borderPad * 2)
      frames.push({
        id: `frame_${index}`,
        index,
        x,
        y,
        width: Math.max(1, Math.min(imageWidth - x, innerW)),
        height: Math.max(1, Math.min(imageHeight - y, innerH)),
        offsetX: 0,
        offsetY: 0,
        enabled: true,
        durationRatio: 1
      })
      index++
    }
  }
  return frames
}


/**
 * Render a single cropped frame from a processed source canvas into a new canvas.
 */
export function extractFrameCanvas(
  sourceCanvas: HTMLCanvasElement,
  frame: LoopFrameBox,
  targetWidth?: number,
  targetHeight?: number,
  anchor: 'bottom' | 'center' | 'top' | 'left' | 'right' = 'bottom'
): HTMLCanvasElement {
  const outW = Math.max(1, Math.round(targetWidth ?? frame.width))
  const outH = Math.max(1, Math.round(targetHeight ?? frame.height))

  const meta = getLoopSourceCanvasMeta(sourceCanvas)
  if (
    meta &&
    meta.rawImage &&
    (meta.workScaleX < 0.999 || meta.workScaleY < 0.999) &&
    (outW > frame.width * meta.workScaleX + 4 || outH > frame.height * meta.workScaleY + 4)
  ) {
    const highRes = extractHighResFrameFromProxy(meta, frame, outW, outH, anchor)
    if (highRes) return highRes
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const { sx, sy } = getLoopSourceLogicalSize(sourceCanvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const drawX =
    anchor === 'left'
      ? Math.round(frame.offsetX)
      : anchor === 'right'
        ? Math.round(canvas.width - frame.width + frame.offsetX)
        : Math.round((canvas.width - frame.width) * 0.5 + frame.offsetX)
  let drawY: number
  if (anchor === 'bottom') {
    drawY = Math.round(canvas.height - frame.height + frame.offsetY)
  } else if (anchor === 'top') {
    drawY = Math.round(frame.offsetY)
  } else {
    drawY = Math.round((canvas.height - frame.height) * 0.5 + frame.offsetY)
  }

  ctx.drawImage(
    sourceCanvas,
    frame.x * sx,
    frame.y * sy,
    Math.max(1, frame.width * sx),
    Math.max(1, frame.height * sy),
    drawX,
    drawY,
    frame.width,
    frame.height
  )
  return canvas
}

/**
 * Extract the cropped First Frame (Frame #1) as a compact PNG DataURL for library thumbnails.
 */
/**
 * Trích xuất toàn bộ các frame ảnh PNG trong suốt đã qua khử nền Chroma Key và căn chỉnh,
 * phục vụ lưu vào template để tái sử dụng ngay lập tức mà không phải chạy lại thuật toán chroma key.
 */
export function extractAllFramesAsDataUrls(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[]
): string[] {
  const enabled = frames.filter((f) => f.enabled)
  const list = enabled.length > 0 ? enabled : frames
  return list.map((frame) => {
    const raw = extractFrameCanvas(sourceCanvas, frame, frame.width, frame.height)
    return raw.toDataURL('image/png')
  })
}

/**
 * Tính số cột × hàng chuẩn (3 hàng × N cột từ trái sang phải, từ trên xuống dưới khi >= 3 frame)
 * để hiển thị gọn gàng trong Xưởng Tách Hoạt Ảnh thay vì trải dài 1 hàng ngang.
 */
export function computeLoopSheetGrid(frameCount: number): { cols: number; rows: number } {
  if (frameCount <= 1) return { cols: 1, rows: 1 }
  if (frameCount < 3) return { cols: frameCount, rows: 1 }
  const rows = 3
  const cols = Math.ceil(frameCount / rows)
  return { cols, rows }
}

export function extractFirstFramePreviewUrl(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[],
  maxSize = 256,
  preferredFrameIndex?: number
): string {
  const preferred =
    typeof preferredFrameIndex === 'number' &&
    preferredFrameIndex >= 0 &&
    preferredFrameIndex < frames.length &&
    frames[preferredFrameIndex]?.enabled
      ? frames[preferredFrameIndex]
      : undefined
  const targetFrame = preferred ?? frames.find((f) => f.enabled) ?? frames[0]
  if (!targetFrame) return sourceCanvas.toDataURL('image/png')
  const rawCanvas = extractFrameCanvas(sourceCanvas, targetFrame, targetFrame.width, targetFrame.height)
  const scale = Math.min(1, maxSize / Math.max(1, rawCanvas.width, rawCanvas.height))
  if (scale >= 0.99) return rawCanvas.toDataURL('image/png')

  const thumb = document.createElement('canvas')
  thumb.width = Math.max(1, Math.round(rawCanvas.width * scale))
  thumb.height = Math.max(1, Math.round(rawCanvas.height * scale))
  const tctx = thumb.getContext('2d')
  if (tctx) {
    tctx.drawImage(rawCanvas, 0, 0, thumb.width, thumb.height)
  }
  return thumb.toDataURL('image/png')
}

export interface CachedLoopSpriteSheet {
  canvas: HTMLCanvasElement
  frames: LoopFrameBox[]
  frameW: number
  frameH: number
  packageJson?: LoopAnimationPackageJson
}

const _spriteSheetCache = new Map<string, Promise<CachedLoopSpriteSheet | null>>()
const _primedPackageSheets = new Map<string, CachedLoopSpriteSheet>()

/** Ghi sẵn dải frame ngang đã tách nền vào bộ nhớ đệm RAM để hiển thị tức thì 0ms */
export function primeCachedLoopTemplateSheet(templateId: string, sheet: CachedLoopSpriteSheet): void {
  _primedPackageSheets.set(templateId, sheet)
}

/** Xoá cache sprite sheet của mẫu hoạt ảnh khi cập nhật tệp animation.json hoặc lưu đè */
export function invalidateCachedLoopTemplateSheet(templateId?: string): void {
  if (!templateId) {
    _primedPackageSheets.clear()
    _spriteSheetCache.clear()
    return
  }
  _primedPackageSheets.delete(templateId)
  for (const k of [..._spriteSheetCache.keys()]) {
    if (k.startsWith(`${templateId}:`) || k.startsWith(`pkg:${templateId}:`)) {
      _spriteSheetCache.delete(k)
    }
  }
}

/** Giới hạn kích thước tối đa của dải Sprite Sheet lưu cache trong RAM (chống tràn 75MB–600MB khi nạp gói 16 frame 4K) */
const MAX_CACHED_STRIP_DIM = 3072
const MAX_CACHED_SHEET_DIM = 2048

async function loadPackageHorizontalSheet(slug: string): Promise<CachedLoopSpriteSheet | null> {
  if (typeof window === 'undefined' || !window.api?.loadBuiltInAssetBytes) return null
  const jsonRel = `loop_animations/${slug}/animation.json`
  const rawJson = await window.api.loadBuiltInAssetBytes(jsonRel)
  if (!rawJson || !rawJson.data) return null

  let pkg: LoopAnimationPackageJson
  try {
    pkg = JSON.parse(new TextDecoder('utf-8').decode(rawJson.data)) as LoopAnimationPackageJson
  } catch {
    return null
  }
  const frameDefs = pkg.frames || []
  if (frameDefs.length === 0) return null

  const baseColor: LoopColorConfig = pkg.colorConfig || {}
  const decoded = await Promise.all(
    frameDefs.map(async (f) => {
      const fRel = `loop_animations/${slug}/${f.file}`
      const raw = await window.api.loadBuiltInAssetBytes(fRel)
      if (!raw || !raw.data) return null
      const blob = new Blob([raw.data as unknown as BlobPart], { type: raw.mime || 'image/png' })
      const bmp = await createImageBitmap(blob)

      const frameColor: LoopColorConfig = {
        ...baseColor,
        tintColor: f.tintColor !== undefined ? f.tintColor : baseColor.tintColor,
        brightness: f.brightness !== undefined ? f.brightness : baseColor.brightness,
        contrast: f.contrast !== undefined ? f.contrast : baseColor.contrast,
        saturation: f.saturation !== undefined ? f.saturation : baseColor.saturation,
        hueRotate: f.hueRotate !== undefined ? f.hueRotate : baseColor.hueRotate,
        opacity: f.opacity !== undefined ? f.opacity : baseColor.opacity
      }
      const filtered = applyLoopColorFilterToSource(bmp, bmp.width, bmp.height, frameColor)
      if (filtered) {
        bmp.close()
        return { source: filtered as CanvasImageSource, width: filtered.width, height: filtered.height, bmpToClose: null, meta: f }
      }
      return { source: bmp as CanvasImageSource, width: bmp.width, height: bmp.height, bmpToClose: bmp, meta: f }
    })
  )

  const valid = decoded.filter((d): d is NonNullable<typeof d> => Boolean(d))
  if (valid.length === 0) return null

  const rawFrameW = Math.max(1, pkg.width || 0, ...valid.map((v) => v.width))
  const rawFrameH = Math.max(1, pkg.height || 0, ...valid.map((v) => v.height))
  const grid = computeLoopSheetGrid(valid.length)
  const cellScale = Math.min(
    1,
    MAX_CACHED_STRIP_DIM / Math.max(1, rawFrameW * grid.cols),
    MAX_CACHED_STRIP_DIM / Math.max(1, rawFrameH * grid.rows)
  )
  const frameW = Math.max(1, Math.round(rawFrameW * cellScale))
  const frameH = Math.max(1, Math.round(rawFrameH * cellScale))

  const stripCanvas = document.createElement('canvas')
  stripCanvas.width = frameW * grid.cols
  stripCanvas.height = frameH * grid.rows
  const sctx = stripCanvas.getContext('2d')
  if (!sctx) {
    valid.forEach((v) => v.bmpToClose?.close())
    return null
  }
  const stripFrames: LoopFrameBox[] = valid.map((v, idx) => {
    const col = idx % grid.cols
    const row = Math.floor(idx / grid.cols)
    const x = col * frameW
    const y = row * frameH
    const dw = Math.max(1, Math.round(v.width * cellScale))
    const dh = Math.max(1, Math.round(v.height * cellScale))
    const drawX = x + Math.round((frameW - dw) * 0.5)
    const drawY = y + Math.round(frameH - dh)
    sctx.drawImage(v.source, drawX, drawY, dw, dh)
    v.bmpToClose?.close()
    return {
      id: `frame_${idx}`,
      index: idx,
      x,
      y,
      width: frameW,
      height: frameH,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: v.meta.durationRatio ?? 1
    }
  })

  return {
    canvas: stripCanvas,
    frames: stripFrames,
    frameW,
    frameH,
    packageJson: pkg
  }
}

/**
 * Loads and caches a processed (Chroma-Key removed) sprite sheet canvas + frame list for a LoopAnimationTemplate,
 * so library cards and the 2.5D Workshop can render Frame #1 or play all frames at 60fps without re-decoding.
 */
export function getCachedLoopTemplateSheet(
  template: Pick<
    LoopAnimationTemplate,
    'id' | 'imageUrl' | 'gridConfig' | 'chromaKey' | 'frames' | 'updatedAt' | 'loopJsonPath' | 'packageFolder'
  >
): Promise<CachedLoopSpriteSheet | null> {
  const primed = _primedPackageSheets.get(template.id)
  if (primed) return Promise.resolve(primed)

  const pkgSource = (template.loopJsonPath || template.packageFolder || template.imageUrl || '').replace(/\\/g, '/')
  const pkgMatch = pkgSource.match(/loop_animations\/([^/]+)/)
  if (pkgMatch && pkgMatch[1]) {
    const slug = pkgMatch[1]
    const pkgCacheKey = `pkg:${slug}:${template.updatedAt ?? 0}`
    const existingPkg = _spriteSheetCache.get(pkgCacheKey)
    if (existingPkg) return existingPkg
    const pkgPromise = loadPackageHorizontalSheet(slug).then((res) => {
      if (res) {
        _primedPackageSheets.set(template.id, res)
        _primedPackageSheets.set(slug, res)
      } else {
        _spriteSheetCache.delete(pkgCacheKey)
      }
      return res
    })
    _spriteSheetCache.set(pkgCacheKey, pkgPromise)
    return pkgPromise
  }

  const pad = template.gridConfig?.borderPadding ?? 0
  const shMode = template.chromaKey?.shadowMode ?? 'off'
  const shType = template.chromaKey?.shadowType ?? 'auto'
  const shRet = template.chromaKey?.shadowRetention ?? 68
  const cacheKey = `${template.id}:${template.updatedAt ?? 0}:${template.imageUrl.slice(0, 64)}:${pad}:${template.chromaKey.enabled}:${template.chromaKey.keyColor}:${template.chromaKey.similarity}:${shMode}:${shType}:${shRet}:${template.chromaKey.isolationMode ?? 'all'}`
  const existing = _spriteSheetCache.get(cacheKey)
  if (existing) return existing

  const promise = new Promise<CachedLoopSpriteSheet | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const rawW = img.naturalWidth || img.width || 512
      const rawH = img.naturalHeight || img.height || 512
      const sheetScale = Math.min(1, MAX_CACHED_SHEET_DIM / Math.max(1, rawW, rawH))
      const w = Math.max(1, Math.round(rawW * sheetScale))
      const h = Math.max(1, Math.round(rawH * sheetScale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      if (pad > 0 || template.chromaKey?.enabled) {
        const imgData = ctx.getImageData(0, 0, w, h)
        if (pad > 0 && template.gridConfig) {
          clearGridBorderPadding(imgData, scaleGridConfigForWorkCanvas(template.gridConfig, sheetScale, sheetScale))
        }
        if (template.chromaKey?.enabled) {
          applyChromaKeyToImageData(imgData, template.chromaKey)
        }
        ctx.putImageData(imgData, 0, 0)
      }
      const allFrames =
        template.frames && template.frames.length > 0
          ? template.frames.map((f) =>
              sheetScale < 0.999
                ? {
                    ...f,
                    x: Math.round(f.x * sheetScale),
                    y: Math.round(f.y * sheetScale),
                    width: Math.max(1, Math.round(f.width * sheetScale)),
                    height: Math.max(1, Math.round(f.height * sheetScale)),
                    offsetX: Math.round((f.offsetX || 0) * sheetScale),
                    offsetY: Math.round((f.offsetY || 0) * sheetScale)
                  }
                : f
            )
          : buildGridFrames(w, h, scaleGridConfigForWorkCanvas(template.gridConfig, sheetScale, sheetScale))
      const enabledFrames = allFrames.filter((f) => f.enabled)
      const activeFrames = enabledFrames.length > 0 ? enabledFrames : allFrames
      const frameW = Math.max(1, ...activeFrames.map((f) => f.width))
      const frameH = Math.max(1, ...activeFrames.map((f) => f.height))
      resolve({ canvas, frames: activeFrames, frameW, frameH })
    }
    img.onerror = () => {
      _spriteSheetCache.delete(cacheKey)
      resolve(null)
    }
    void resolveLoopAssetUrl(template.imageUrl).then((resolved) => {
      img.src = resolved || template.imageUrl
    })
  })

  _spriteSheetCache.set(cacheKey, promise)
  return promise
}
