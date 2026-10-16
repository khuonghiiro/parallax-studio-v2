/// <reference lib="webworker" />

import type { ChromaKeySettings, CutPoint } from './types'
import { processAdvancedChromaPixelData } from './chromaAdvancedProcessor'

export interface CutterExportWorkerRequest {
  rawBitmap: ImageBitmap
  maskBitmap?: ImageBitmap
  width: number
  height: number
  settings?: ChromaKeySettings
  polygon?: CutPoint[]
}

export interface CutterExportWorkerResponse {
  blob?: Blob
  error?: string
}

async function renderExport(request: CutterExportWorkerRequest): Promise<Blob> {
  const canvas = new OffscreenCanvas(request.width, request.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Không thể khởi tạo canvas xuất ảnh')
  ctx.drawImage(request.rawBitmap, 0, 0, request.width, request.height)
  request.rawBitmap.close()

  if (request.settings?.enabled && request.settings.previewMode !== 'original') {
    const image = ctx.getImageData(0, 0, request.width, request.height)
    processAdvancedChromaPixelData(image.data, request.width, request.height, request.settings)
    ctx.putImageData(image, 0, 0)
  }

  if (request.maskBitmap) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(request.maskBitmap, 0, 0, request.width, request.height)
    request.maskBitmap.close()
    ctx.globalCompositeOperation = 'source-over'
  }

  if (request.polygon && request.polygon.length >= 3) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()
    ctx.moveTo(request.polygon[0].x, request.polygon[0].y)
    for (let i = 1; i < request.polygon.length; i++) {
      ctx.lineTo(request.polygon[i].x, request.polygon[i].y)
    }
    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()
  }

  return canvas.convertToBlob({ type: 'image/png' })
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope
workerScope.onmessage = async (event: MessageEvent<CutterExportWorkerRequest>) => {
  try {
    const blob = await renderExport(event.data)
    workerScope.postMessage({ blob } satisfies CutterExportWorkerResponse)
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : String(error)
    } satisfies CutterExportWorkerResponse)
  }
}

export {}
