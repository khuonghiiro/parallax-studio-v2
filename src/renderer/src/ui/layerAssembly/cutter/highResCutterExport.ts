import type { ChromaKeySettings, CutPoint } from './types'
import { extractRegionDataUrl } from './chromaKey'
import type {
  CutterExportWorkerRequest,
  CutterExportWorkerResponse
} from './cutterExportWorker'

const MAX_EXPORT_PIXELS = 36_000_000

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc PNG đã xuất'))
    reader.readAsDataURL(blob)
  })
}

function computeExportSize(width: number, height: number) {
  const pixels = width * height
  const scale = pixels > MAX_EXPORT_PIXELS ? Math.sqrt(MAX_EXPORT_PIXELS / pixels) : 1
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

function runExportWorker(request: CutterExportWorkerRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./cutterExportWorker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => worker.terminate()
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'Worker xuất PNG gặp lỗi'))
    }
    worker.onmessage = async (event: MessageEvent<CutterExportWorkerResponse>) => {
      cleanup()
      if (!event.data.blob) {
        reject(new Error(event.data.error || 'Không thể xuất PNG'))
        return
      }
      try {
        resolve(await blobToDataUrl(event.data.blob))
      } catch (error) {
        reject(error)
      }
    }
    const transfers: Transferable[] = [request.rawBitmap]
    if (request.maskBitmap) transfers.push(request.maskBitmap)
    worker.postMessage(request, transfers)
  })
}

/** Xuất crop độ phân giải gốc trong Worker để PNG 4K/8K không khóa luồng giao diện. */
export async function extractHighResRegionDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  polygon?: CutPoint[],
  fullRawCanvas?: HTMLCanvasElement | null,
  chromaSettings?: ChromaKeySettings,
  hasManualEdits = false
): Promise<string> {
  if (
    !fullRawCanvas ||
    fullRawCanvas.width === sourceCanvas.width ||
    typeof Worker === 'undefined' ||
    typeof createImageBitmap === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return extractRegionDataUrl(sourceCanvas, box, polygon, fullRawCanvas, chromaSettings)
  }

  const sx = Math.max(0, Math.min(fullRawCanvas.width - 1, Math.round(box.x)))
  const sy = Math.max(0, Math.min(fullRawCanvas.height - 1, Math.round(box.y)))
  const sw = Math.max(1, Math.min(fullRawCanvas.width - sx, Math.round(box.width)))
  const sh = Math.max(1, Math.min(fullRawCanvas.height - sy, Math.round(box.height)))
  const output = computeExportSize(sw, sh)
  const workScaleX = sourceCanvas.width / fullRawCanvas.width
  const workScaleY = sourceCanvas.height / fullRawCanvas.height
  const maskX = Math.max(0, Math.min(sourceCanvas.width - 1, Math.round(sx * workScaleX)))
  const maskY = Math.max(0, Math.min(sourceCanvas.height - 1, Math.round(sy * workScaleY)))
  const maskW = Math.max(
    1,
    Math.min(sourceCanvas.width - maskX, Math.round(sw * workScaleX))
  )
  const maskH = Math.max(
    1,
    Math.min(sourceCanvas.height - maskY, Math.round(sh * workScaleY))
  )

  const rawBitmapPromise = createImageBitmap(fullRawCanvas, sx, sy, sw, sh, {
    resizeWidth: output.width,
    resizeHeight: output.height,
    resizeQuality: 'high'
  })
  const maskBitmapPromise = hasManualEdits
    ? createImageBitmap(
        sourceCanvas,
        maskX,
        maskY,
        maskW,
        maskH,
        { resizeWidth: output.width, resizeHeight: output.height, resizeQuality: 'high' }
      )
    : Promise.resolve(undefined)
  const [rawBitmap, maskBitmap] = await Promise.all([
    rawBitmapPromise,
    maskBitmapPromise
  ])

  const localPolygon = polygon?.map((point) => ({
    x: (point.x - sx) * output.scale,
    y: (point.y - sy) * output.scale
  }))
  return runExportWorker({
    rawBitmap,
    maskBitmap,
    width: output.width,
    height: output.height,
    settings: chromaSettings,
    polygon: localPolygon
  })
}
