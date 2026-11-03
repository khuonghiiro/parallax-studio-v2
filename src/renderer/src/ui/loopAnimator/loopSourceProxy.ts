import { applyChromaKeyToImageData } from './loopChromaProcessor'
import type { ChromaKeyConfig, GridSlicerConfig, LoopFrameBox } from './types'

/**
 * Độ phân giải tối đa của Canvas làm việc tương tác (interactive proxy) trong Xưởng Tách Hoạt Ảnh.
 * Khi nạp ảnh 2K / 4K / 6K (VD: 4096×4096 hoặc 6144×3072), mọi thao tác kéo thanh trượt Chroma Key,
 * xoá vạch lưới, dò vùng tự động (Contour) và phát thử 60fps đều chạy trên bộ đệm proxy <= 1280px
 * (~1.2M pixel thay vì 18.8M pixel, nhanh gấp 12–16 lần, chống đơ UI 100%).
 * Ảnh gốc 4K (`rawImage`) được giữ nguyên để trích xuất sắc nét từng frame khi Lưu / Áp dụng.
 */
export const MAX_LOOP_SOURCE_WORK_DIM = 1280

/** Độ phân giải tối đa cho mỗi frame riêng lẻ khi chạy khử nền Chroma Key lúc xuất gói */
const MAX_CHROMA_EXPORT_FRAME_DIM = 1024
/** Độ phân giải tối đa cho mỗi frame riêng lẻ khi không bật Chroma Key lúc xuất gói */
const MAX_RAW_EXPORT_FRAME_DIM = 1536

export interface LoopSourceCanvasMeta {
  logicalWidth: number
  logicalHeight: number
  workScaleX: number
  workScaleY: number
  rawImage: HTMLImageElement | HTMLCanvasElement | null
  chromaKey: ChromaKeyConfig
  gridConfig: GridSlicerConfig
}

const sourceMetaMap = new WeakMap<HTMLCanvasElement, LoopSourceCanvasMeta>()

export function setLoopSourceCanvasMeta(
  canvas: HTMLCanvasElement,
  meta: LoopSourceCanvasMeta
): void {
  sourceMetaMap.set(canvas, meta)
}

export function getLoopSourceCanvasMeta(
  canvas: HTMLCanvasElement | null | undefined
): LoopSourceCanvasMeta | undefined {
  if (!canvas) return undefined
  return sourceMetaMap.get(canvas)
}

export function clearLoopSourceCanvasMeta(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return
  sourceMetaMap.delete(canvas)
}

/**
 * Lấy kích thước logic (gốc 2K/4K) và tỉ lệ quy đổi sang kích thước thực tế của `sourceCanvas`.
 * Nếu `sourceCanvas` là canvas thường (trong unit test hoặc ảnh <= 1280px), `sx = 1, sy = 1`.
 */
export function getLoopSourceLogicalSize(canvas: HTMLCanvasElement): {
  logicalW: number
  logicalH: number
  sx: number
  sy: number
} {
  const meta = sourceMetaMap.get(canvas)
  const logicalW = meta && meta.logicalWidth > 0 ? meta.logicalWidth : canvas.width
  const logicalH = meta && meta.logicalHeight > 0 ? meta.logicalHeight : canvas.height
  const sx = logicalW > 0 ? canvas.width / logicalW : 1
  const sy = logicalH > 0 ? canvas.height / logicalH : 1
  return { logicalW, logicalH, sx, sy }
}

/**
 * Quy đổi cấu hình lưới cắt (`GridSlicerConfig`) từ toạ độ ảnh gốc 4K sang toạ độ Canvas proxy.
 */
export function scaleGridConfigForWorkCanvas(
  grid: GridSlicerConfig,
  sx: number,
  sy: number
): GridSlicerConfig {
  if (Math.abs(sx - 1) < 1e-4 && Math.abs(sy - 1) < 1e-4) return grid
  const sUniform = (sx + sy) * 0.5
  return {
    ...grid,
    marginX: Math.round((grid.marginX || 0) * sx),
    marginY: Math.round((grid.marginY || 0) * sy),
    paddingX: Math.round((grid.paddingX || 0) * sx),
    paddingY: Math.round((grid.paddingY || 0) * sy),
    borderPadding:
      (grid.borderPadding ?? 0) > 0
        ? Math.max(1, Math.round((grid.borderPadding ?? 0) * sUniform))
        : 0
  }
}

/**
 * Chuẩn bị ngữ cảnh 2D để quét pixel (Contour Slicer / Auto-Center / Alpha Mesh Sync).
 * Tự động hạ độ phân giải xuống `<= maxDim` (mặc định 1024px) nếu `sourceCanvas` là 2K/4K
 * nhằm tránh đọc 67MB dữ liệu RGBA từ GPU sang CPU gây khựng luồng chính.
 */
export function prepareDownsampledScanContext(
  sourceCanvas: HTMLCanvasElement,
  maxDim = 1024
): {
  ctx: CanvasRenderingContext2D
  scanW: number
  scanH: number
  logicalW: number
  logicalH: number
  sx: number
  sy: number
} | null {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  if (w <= 0 || h <= 0) return null
  const { logicalW, logicalH } = getLoopSourceLogicalSize(sourceCanvas)

  const maxSide = Math.max(w, h)
  if (maxSide <= maxDim || typeof document === 'undefined') {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    return {
      ctx,
      scanW: w,
      scanH: h,
      logicalW,
      logicalH,
      sx: logicalW > 0 ? w / logicalW : 1,
      sy: logicalH > 0 ? h / logicalH : 1
    }
  }

  const downScale = maxDim / maxSide
  const scanW = Math.max(1, Math.round(w * downScale))
  const scanH = Math.max(1, Math.round(h * downScale))
  const proxy = document.createElement('canvas')
  proxy.width = scanW
  proxy.height = scanH
  const ctx = proxy.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(sourceCanvas, 0, 0, scanW, scanH)
  return {
    ctx,
    scanW,
    scanH,
    logicalW,
    logicalH,
    sx: logicalW > 0 ? scanW / logicalW : 1,
    sy: logicalH > 0 ? scanH / logicalH : 1
  }
}

/**
 * Trích xuất 1 frame chất lượng cao trực tiếp từ `rawImage` (ảnh gốc 2K/4K) khi `sourceCanvas`
 * đang ở chế độ proxy thu nhỏ. Chỉ chạy Chroma Key trên đúng vùng khung hình đã cắt.
 */
export function extractHighResFrameFromProxy(
  meta: LoopSourceCanvasMeta,
  frame: LoopFrameBox,
  outW: number,
  outH: number,
  anchor: 'bottom' | 'center' = 'bottom'
): HTMLCanvasElement | null {
  const raw = meta.rawImage
  if (!raw || typeof document === 'undefined') return null

  const maxAllowed = meta.chromaKey.enabled
    ? MAX_CHROMA_EXPORT_FRAME_DIM
    : MAX_RAW_EXPORT_FRAME_DIM
  const capScale = Math.min(1, maxAllowed / Math.max(1, outW, outH))
  const finalW = Math.max(1, Math.round(outW * capScale))
  const finalH = Math.max(1, Math.round(outH * capScale))

  const cropW = Math.max(1, Math.round(frame.width * capScale))
  const cropH = Math.max(1, Math.round(frame.height * capScale))
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropW
  cropCanvas.height = cropH
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: meta.chromaKey.enabled })
  if (!cropCtx) return null

  cropCtx.drawImage(raw, frame.x, frame.y, frame.width, frame.height, 0, 0, cropW, cropH)

  if (meta.chromaKey.enabled) {
    const imgData = cropCtx.getImageData(0, 0, cropW, cropH)
    applyChromaKeyToImageData(imgData, meta.chromaKey)
    cropCtx.putImageData(imgData, 0, 0)
  }

  const outCanvas = document.createElement('canvas')
  outCanvas.width = finalW
  outCanvas.height = finalH
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) return cropCanvas

  const drawX = Math.round((finalW - cropW) * 0.5 + frame.offsetX * capScale)
  const drawY =
    anchor === 'bottom'
      ? Math.round(finalH - cropH + frame.offsetY * capScale)
      : Math.round((finalH - cropH) * 0.5 + frame.offsetY * capScale)

  outCtx.drawImage(cropCanvas, 0, 0, cropW, cropH, drawX, drawY, cropW, cropH)
  return outCanvas
}

/**
 * Bộ nhớ đệm LRU ánh xạ URL -> HTMLCanvasElement để khi nạp gói hoạt ảnh 4K hoặc ghép nhiều frame,
 * `LoopAnimatorSourcePane` có thể vẽ trực tiếp từ Canvas trong RAM (0ms) mà không cần nén/giải mã PNG.
 */
const memoryCanvasCache = new Map<string, HTMLCanvasElement>()
const MAX_MEMORY_CANVAS_ENTRIES = 6

export function registerMemoryCanvasUrl(url: string, canvas: HTMLCanvasElement): void {
  if (!url) return
  if (memoryCanvasCache.has(url)) {
    memoryCanvasCache.delete(url)
  }
  memoryCanvasCache.set(url, canvas)
  while (memoryCanvasCache.size > MAX_MEMORY_CANVAS_ENTRIES) {
    const oldest = memoryCanvasCache.keys().next().value
    if (!oldest) break
    memoryCanvasCache.delete(oldest)
    if (oldest.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(oldest)
      } catch {
        /* ignore */
      }
    }
  }
}

export function getRegisteredMemoryCanvas(url: string | null | undefined): HTMLCanvasElement | undefined {
  if (!url) return undefined
  return memoryCanvasCache.get(url)
}

/**
 * Chuyển Canvas thành URL bất đồng bộ qua `toBlob` + `URL.createObjectURL` (chạy trên background thread
 * của trình duyệt thay vì chặn cứng main thread 2–4 giây như `canvas.toDataURL('image/png')` trên ảnh 4K).
 */
export function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  if (typeof canvas.toBlob !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) {
    const dataUrl = canvas.toDataURL('image/png')
    registerMemoryCanvasUrl(dataUrl, canvas)
    return Promise.resolve(dataUrl)
  }
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const blobUrl = URL.createObjectURL(blob)
        registerMemoryCanvasUrl(blobUrl, canvas)
        resolve(blobUrl)
      } else {
        const dataUrl = canvas.toDataURL('image/png')
        registerMemoryCanvasUrl(dataUrl, canvas)
        resolve(dataUrl)
      }
    }, 'image/png')
  })
}
