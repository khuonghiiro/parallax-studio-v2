import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChromaKeySettings, DetectedIsland } from './types'
import { processAdvancedChromaPixelData } from './chromaAdvancedProcessor'
import { scanRawIslandsFromData } from './chromaKey'
import type {
  ChromaPreviewWorkerRequest,
  ChromaPreviewWorkerResponse
} from './chromaPreviewWorker'

interface UseChromaPreviewWorkerOptions {
  chroma: ChromaKeySettings
  imageRevision: number
  rawDataRef: React.RefObject<ImageData | null>
  procCanvasRef: React.RefObject<HTMLCanvasElement | null>
  alphaOverrideRef: React.RefObject<Int16Array | null>
  workScaleRef: React.RefObject<number>
  pausedRef?: React.RefObject<boolean>
  onIslands: (islands: DetectedIsland[]) => void
}

function scaleSettings(settings: ChromaKeySettings, scale: number): ChromaKeySettings {
  if (scale >= 1) return settings
  return {
    ...settings,
    smoothness: Number(((settings.smoothness ?? 2) * scale).toFixed(2)),
    edgeChoke: Number(((settings.edgeChoke ?? 0) * scale).toFixed(2)),
    strokeWidth:
      (settings.strokeWidth ?? 0) > 0
        ? Math.max(1, Math.round((settings.strokeWidth ?? 0) * scale))
        : 0,
    despeckleSize: Math.max(0, Math.round((settings.despeckleSize ?? 16) * scale * scale))
  }
}

export function useChromaPreviewWorker(options: UseChromaPreviewWorkerOptions) {
  const settingsRef = useRef(options.chroma)
  const onIslandsRef = useRef(options.onIslands)
  const workerRef = useRef<Worker | null>(null)
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  const scheduledFrameRef = useRef<number | null>(null)
  const desiredRevisionRef = useRef(0)
  const runLatestRef = useRef<() => void>(() => {})
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastDurationMs, setLastDurationMs] = useState(0)

  settingsRef.current = options.chroma
  onIslandsRef.current = options.onIslands

  const applyResult = useCallback(
    (response: ChromaPreviewWorkerResponse) => {
      const canvas = options.procCanvasRef.current
      if (
        response.revision !== desiredRevisionRef.current ||
        !canvas ||
        canvas.width !== response.width ||
        canvas.height !== response.height
      ) {
        return
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      const pixels = new Uint8ClampedArray(response.pixels)
      ctx.putImageData(new ImageData(pixels, response.width, response.height), 0, 0)
      onIslandsRef.current(response.islands)
      setLastDurationMs(response.durationMs)
    },
    [options.procCanvasRef]
  )

  const runOnMainThread = useCallback(
    (request: ChromaPreviewWorkerRequest) => {
      window.setTimeout(() => {
        const startedAt = performance.now()
        const pixels = new Uint8ClampedArray(request.pixels)
        processAdvancedChromaPixelData(pixels, request.width, request.height, request.settings)
        if (request.alphaOverride) {
          const overrides = new Int16Array(request.alphaOverride)
          for (let p = 0; p < overrides.length; p++) {
            if (overrides[p] >= 0) pixels[p * 4 + 3] = overrides[p]
          }
        }
        const islands =
          request.settings.enabled && request.settings.previewMode !== 'original'
            ? scanRawIslandsFromData(
                pixels,
                request.width,
                request.height,
                request.coordScale
              )
            : []
        applyResult({
          ...request,
          pixels: pixels.buffer,
          islands,
          durationMs: performance.now() - startedAt
        })
        busyRef.current = false
        if (pendingRef.current || request.revision !== desiredRevisionRef.current) {
          requestAnimationFrame(() => runLatestRef.current())
        } else {
          setIsProcessing(false)
        }
      }, 0)
    },
    [applyResult]
  )

  const runLatest = useCallback(() => {
    if (options.pausedRef?.current) {
      pendingRef.current = true
      return
    }
    if (busyRef.current) {
      pendingRef.current = true
      return
    }
    const raw = options.rawDataRef.current
    const canvas = options.procCanvasRef.current
    if (!raw || !canvas || raw.width !== canvas.width || raw.height !== canvas.height) return

    pendingRef.current = false
    busyRef.current = true
    setIsProcessing(true)
    const revision = desiredRevisionRef.current
    const pixels = new Uint8ClampedArray(raw.data)
    const override = options.alphaOverrideRef.current
    const overrideCopy = override ? new Int16Array(override) : undefined
    const request: ChromaPreviewWorkerRequest = {
      revision,
      width: raw.width,
      height: raw.height,
      coordScale: 1 / Math.max(0.0001, options.workScaleRef.current),
      settings: scaleSettings(settingsRef.current, options.workScaleRef.current),
      pixels: pixels.buffer,
      alphaOverride: overrideCopy?.buffer
    }
    const worker = workerRef.current
    if (!worker) {
      runOnMainThread(request)
      return
    }
    const transfers: Transferable[] = [request.pixels]
    if (request.alphaOverride) transfers.push(request.alphaOverride)
    worker.postMessage(request, transfers)
  }, [
    options.rawDataRef,
    options.procCanvasRef,
    options.alphaOverrideRef,
    options.workScaleRef,
    options.pausedRef,
    runOnMainThread
  ])

  runLatestRef.current = runLatest

  const requestProcessing = useCallback(() => {
    desiredRevisionRef.current++
    pendingRef.current = true
    if (scheduledFrameRef.current !== null) cancelAnimationFrame(scheduledFrameRef.current)
    scheduledFrameRef.current = requestAnimationFrame(() => {
      scheduledFrameRef.current = null
      runLatestRef.current()
    })
  }, [])

  useEffect(() => {
    if (typeof Worker === 'undefined') return
    const worker = new Worker(new URL('./chromaPreviewWorker.ts', import.meta.url), {
      type: 'module'
    })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<ChromaPreviewWorkerResponse>) => {
      busyRef.current = false
      if (options.pausedRef?.current) pendingRef.current = true
      else applyResult(event.data)
      if (pendingRef.current || event.data.revision !== desiredRevisionRef.current) {
        requestAnimationFrame(() => runLatestRef.current())
      } else {
        setIsProcessing(false)
      }
    }
    worker.onerror = () => {
      worker.terminate()
      workerRef.current = null
      busyRef.current = false
      pendingRef.current = true
      requestAnimationFrame(() => runLatestRef.current())
    }
    requestProcessing()
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [applyResult, requestProcessing])

  useEffect(() => {
    requestProcessing()
  }, [options.chroma, options.imageRevision, requestProcessing])

  useEffect(
    () => () => {
      if (scheduledFrameRef.current !== null) cancelAnimationFrame(scheduledFrameRef.current)
    },
    []
  )

  return { requestProcessing, isProcessing, lastDurationMs }
}
