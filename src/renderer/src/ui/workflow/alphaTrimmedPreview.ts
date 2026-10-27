import { useEffect, useState } from 'react'

export interface AlphaTrimmedInfo {
  /** URL ảnh đã cắt bỏ toàn bộ viền pixel trong suốt (chỉ giữ BBox có pixel) */
  croppedUrl: string
  /** Chiều rộng vùng BBox có pixel (tính theo hệ toạ độ ảnh gốc) */
  trimW: number
  /** Chiều cao vùng BBox có pixel (tính theo hệ toạ độ ảnh gốc) */
  trimH: number
  /** Chiều rộng ảnh gốc */
  origW: number
  /** Chiều cao ảnh gốc */
  origH: number
  /** Độ lệch tâm X của vùng có pixel so với tâm ảnh gốc (-0.5 .. 0.5) */
  offsetRx: number
  /** Độ lệch tâm Y của vùng có pixel so với tâm ảnh gốc (-0.5 .. 0.5) */
  offsetRy: number
}

const trimCache = new Map<string, AlphaTrimmedInfo>()
const pendingPromises = new Map<string, Promise<AlphaTrimmedInfo | null>>()
const listeners = new Set<() => void>()

function notifyTrimListeners(): void {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // ignore
    }
  }
}

/**
 * Tự động quét Alpha Bounding Box của ảnh Layer để loại trừ khoảng trống trong suốt (alpha <= 12),
 * chỉ giữ lại đúng vùng BBox chứa pixel thực tế giúp ảnh hiển thị to, rõ nét trên khung vẽ preview.
 */
export function computeAlphaTrimmedImage(url: string): Promise<AlphaTrimmedInfo | null> {
  if (!url) return Promise.resolve(null)
  const cached = trimCache.get(url)
  if (cached) return Promise.resolve(cached)
  const existing = pendingPromises.get(url)
  if (existing) return existing

  const promise = new Promise<AlphaTrimmedInfo | null>((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const origW = Math.max(1, img.naturalWidth || img.width || 1)
        const origH = Math.max(1, img.naturalHeight || img.height || 1)

        // Quét trên kích thước thu gọn (tối đa 320px) để đạt tốc độ < 1.5ms
        const scanMax = 320
        const scanScale = Math.min(1, scanMax / Math.max(origW, origH))
        const sw = Math.max(1, Math.round(origW * scanScale))
        const sh = Math.max(1, Math.round(origH * scanScale))

        const scanCanvas = document.createElement('canvas')
        scanCanvas.width = sw
        scanCanvas.height = sh
        const sctx = scanCanvas.getContext('2d', { willReadFrequently: true })
        if (!sctx) {
          const fallback: AlphaTrimmedInfo = {
            croppedUrl: url,
            trimW: origW,
            trimH: origH,
            origW,
            origH,
            offsetRx: 0,
            offsetRy: 0
          }
          trimCache.set(url, fallback)
          resolve(fallback)
          return
        }

        sctx.drawImage(img, 0, 0, sw, sh)
        const { data } = sctx.getImageData(0, 0, sw, sh)

        let minX = sw
        let minY = sh
        let maxX = -1
        let maxY = -1
        const alphaThreshold = 12

        for (let y = 0; y < sh; y++) {
          const rowOffset = y * sw * 4
          for (let x = 0; x < sw; x++) {
            const a = data[rowOffset + x * 4 + 3]
            if (a > alphaThreshold) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }

        // Nếu ảnh hoàn toàn trong suốt hoặc đã kín > 92% khung thì giữ nguyên
        if (maxX < minX || maxY < minY) {
          const fallback: AlphaTrimmedInfo = {
            croppedUrl: url,
            trimW: origW,
            trimH: origH,
            origW,
            origH,
            offsetRx: 0,
            offsetRy: 0
          }
          trimCache.set(url, fallback)
          resolve(fallback)
          return
        }

        // Quy đổi ngược về toạ độ ảnh gốc kèm đệm 2px chống cắt viền khử răng cưa
        const padOrig = Math.max(2, Math.round(2 / scanScale))
        const sx0 = Math.max(0, Math.floor(minX / scanScale) - padOrig)
        const sy0 = Math.max(0, Math.floor(minY / scanScale) - padOrig)
        const sx1 = Math.min(origW, Math.ceil((maxX + 1) / scanScale) + padOrig)
        const sy1 = Math.min(origH, Math.ceil((maxY + 1) / scanScale) + padOrig)

        const trimW = Math.max(1, sx1 - sx0)
        const trimH = Math.max(1, sy1 - sy0)
        const centerX = sx0 + trimW / 2
        const centerY = sy0 + trimH / 2
        const offsetRx = (centerX - origW / 2) / origW
        const offsetRy = (centerY - origH / 2) / origH

        // Nếu vùng pixel đã chiếm gần hết ảnh gốc (> 94%), không cần sinh dataURL mới
        if (trimW >= origW * 0.94 && trimH >= origH * 0.94) {
          const info: AlphaTrimmedInfo = {
            croppedUrl: url,
            trimW: origW,
            trimH: origH,
            origW,
            origH,
            offsetRx: 0,
            offsetRy: 0
          }
          trimCache.set(url, info)
          resolve(info)
          return
        }

        const outMax = 384
        const outScale = Math.min(1, outMax / Math.max(trimW, trimH))
        const outW = Math.max(1, Math.round(trimW * outScale))
        const outH = Math.max(1, Math.round(trimH * outScale))

        const outCanvas = document.createElement('canvas')
        outCanvas.width = outW
        outCanvas.height = outH
        const octx = outCanvas.getContext('2d')
        if (!octx) {
          const fallback: AlphaTrimmedInfo = {
            croppedUrl: url,
            trimW,
            trimH,
            origW,
            origH,
            offsetRx,
            offsetRy
          }
          trimCache.set(url, fallback)
          resolve(fallback)
          return
        }

        octx.drawImage(img, sx0, sy0, trimW, trimH, 0, 0, outW, outH)
        const croppedUrl = outCanvas.toDataURL('image/png')
        const info: AlphaTrimmedInfo = {
          croppedUrl,
          trimW,
          trimH,
          origW,
          origH,
          offsetRx,
          offsetRy
        }
        trimCache.set(url, info)
        resolve(info)
      } catch {
        const fallback: AlphaTrimmedInfo = {
          croppedUrl: url,
          trimW: img.naturalWidth || 300,
          trimH: img.naturalHeight || 300,
          origW: img.naturalWidth || 300,
          origH: img.naturalHeight || 300,
          offsetRx: 0,
          offsetRy: 0
        }
        trimCache.set(url, fallback)
        resolve(fallback)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  }).finally(() => {
    pendingPromises.delete(url)
    notifyTrimListeners()
  })

  pendingPromises.set(url, promise)
  return promise
}

export function getCachedAlphaTrim(url: string | null | undefined): AlphaTrimmedInfo | null {
  if (!url) return null
  return trimCache.get(url) ?? null
}

/**
 * Hook tự động cắt khoảng trống trong suốt (Alpha BBox) cho danh sách URL ảnh Layer.
 */
export function useAlphaTrimmedUrls(
  urls: (string | null | undefined)[]
): Record<string, AlphaTrimmedInfo> {
  const [, setTick] = useState(0)
  const key = urls.filter(Boolean).join('|')

  useEffect(() => {
    const onUpdate = (): void => setTick((n) => n + 1)
    listeners.add(onUpdate)
    for (const u of urls) {
      if (u && !trimCache.has(u)) {
        void computeAlphaTrimmedImage(u)
      }
    }
    return () => {
      listeners.delete(onUpdate)
    }
  }, [key])

  const result: Record<string, AlphaTrimmedInfo> = {}
  for (const u of urls) {
    if (u) {
      const hit = trimCache.get(u)
      if (hit) result[u] = hit
    }
  }
  return result
}

export type PreviewCheckerTheme = 'dark' | 'light'

const CHECKER_STORAGE_KEY = 'pxs:wf-preview-checker-theme'
const CHECKER_EVENT_NAME = 'pxs:wf-checker-theme-change'

export function readPreviewCheckerTheme(): PreviewCheckerTheme {
  try {
    const v = localStorage.getItem(CHECKER_STORAGE_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function writePreviewCheckerTheme(next: PreviewCheckerTheme): void {
  try {
    localStorage.setItem(CHECKER_STORAGE_KEY, next)
    window.dispatchEvent(new CustomEvent(CHECKER_EVENT_NAME, { detail: next }))
  } catch {
    // ignore
  }
}

/**
 * Hook đồng bộ chế độ nền Caro Trắng / Đen (`light` / `dark`) trên toàn bộ các khung vẽ preview.
 */
export function usePreviewCheckerTheme(): [
  PreviewCheckerTheme,
  () => void,
  (next: PreviewCheckerTheme) => void
] {
  const [theme, setTheme] = useState<PreviewCheckerTheme>(() => readPreviewCheckerTheme())

  useEffect(() => {
    const onStorageOrCustom = (): void => {
      setTheme(readPreviewCheckerTheme())
    }
    window.addEventListener(CHECKER_EVENT_NAME, onStorageOrCustom)
    window.addEventListener('storage', onStorageOrCustom)
    return () => {
      window.removeEventListener(CHECKER_EVENT_NAME, onStorageOrCustom)
      window.removeEventListener('storage', onStorageOrCustom)
    }
  }, [])

  const toggle = (): void => {
    const next: PreviewCheckerTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    writePreviewCheckerTheme(next)
  }

  const setDirect = (next: PreviewCheckerTheme): void => {
    setTheme(next)
    writePreviewCheckerTheme(next)
  }

  return [theme, toggle, setDirect]
}

export function getCheckerboardPalette(theme: PreviewCheckerTheme): {
  tileA: string
  tileB: string
  gridLine: string
  hintText: string
  labelStroke: string
  borderStroke: string
  cssBackground: string
} {
  if (theme === 'light') {
    return {
      tileA: '#f8fafc',
      tileB: '#cbd5e1',
      gridLine: 'rgba(15, 23, 42, 0.22)',
      hintText: '#334155',
      labelStroke: 'rgba(255, 255, 255, 0.92)',
      borderStroke: 'rgba(100, 116, 139, 0.45)',
      cssBackground:
        'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 14px 14px'
    }
  }
  return {
    tileA: '#0f172a',
    tileB: '#1e293b',
    gridLine: 'rgba(148, 163, 184, 0.22)',
    hintText: '#94a3b8',
    labelStroke: 'rgba(15, 23, 42, 0.92)',
    borderStroke: 'rgba(51, 65, 85, 0.65)',
    cssBackground:
      'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 14px 14px'
  }
}
