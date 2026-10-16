/// <reference lib="webworker" />

import type { ChromaKeySettings } from './types'
import { processAdvancedChromaPixelData } from './chromaAdvancedProcessor'
import { scanRawIslandsFromData } from './chromaKey'

export interface ChromaPreviewWorkerRequest {
  revision: number
  width: number
  height: number
  coordScale: number
  settings: ChromaKeySettings
  pixels: ArrayBuffer
  alphaOverride?: ArrayBuffer
}

export interface ChromaPreviewWorkerResponse {
  revision: number
  width: number
  height: number
  durationMs: number
  pixels: ArrayBuffer
  islands: ReturnType<typeof scanRawIslandsFromData>
}

function applyOverrides(data: Uint8ClampedArray, overrides?: Int16Array): void {
  if (!overrides) return
  const total = Math.min(overrides.length, data.length >> 2)
  for (let p = 0; p < total; p++) {
    const alpha = overrides[p]
    if (alpha >= 0) data[p * 4 + 3] = Math.max(0, Math.min(255, alpha))
  }
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<ChromaPreviewWorkerRequest>) => {
  const request = event.data
  const startedAt = performance.now()
  const pixels = new Uint8ClampedArray(request.pixels)

  processAdvancedChromaPixelData(pixels, request.width, request.height, request.settings)
  applyOverrides(
    pixels,
    request.alphaOverride ? new Int16Array(request.alphaOverride) : undefined
  )

  const islands =
    request.settings.enabled && request.settings.previewMode !== 'original'
      ? scanRawIslandsFromData(pixels, request.width, request.height, request.coordScale)
      : []
  const response: ChromaPreviewWorkerResponse = {
    revision: request.revision,
    width: request.width,
    height: request.height,
    durationMs: performance.now() - startedAt,
    pixels: pixels.buffer,
    islands
  }
  workerScope.postMessage(response, [response.pixels])
}

export {}
