import * as THREE from 'three'
import { resolveAssetAlias, type AssetTable } from '../../../project/json/assetTable'

export interface ResolvedTexture {
  texture: THREE.Texture
  image?: HTMLImageElement
  url?: string
  width: number
  height: number
}

const textureCache = new Map<string, Promise<ResolvedTexture | null>>()
const createdBlobUrls = new Set<string>()

/** Largest image (in pixels) that gets edge bleeding; bigger ones are uploaded directly without CPU readback stall. */
const BLEED_MAX_PIXELS = 1024 * 1024
const BLEED_PASSES = 3

/**
 * "Alpha bleeding": copies the colour of opaque edge pixels into neighbouring fully
 * transparent pixels (alpha stays 0). Without it, texture filtering at the alpha-cutout
 * edge mixes in the (usually black or white) RGB of transparent pixels → ugly fringes.
 * Uses flat typed arrays instead of Set/Array allocations to avoid GC stalls on large textures.
 */
export function bleedTransparentEdges(data: Uint8ClampedArray, w: number, h: number, passes = BLEED_PASSES): void {
  const total = w * h
  if (total <= 0) return
  const filled = new Uint8Array(total)
  const queued = new Uint8Array(total)
  for (let i = 0; i < total; i++) filled[i] = data[i * 4 + 3] > 0 ? 1 : 0

  let frontier = new Int32Array(total)
  let nextFrontier = new Int32Array(total)
  let done = new Int32Array(total)
  let frontierLen = 0

  // Initial frontier: transparent pixels touching an opaque one.
  for (let y = 0; y < h; y++) {
    const rowOff = y * w
    for (let x = 0; x < w; x++) {
      const i = rowOff + x
      if (filled[i]) continue
      let touches = false
      const y0 = y > 0 ? y - 1 : 0
      const y1 = y + 1 < h ? y + 1 : h - 1
      const x0 = x > 0 ? x - 1 : 0
      const x1 = x + 1 < w ? x + 1 : w - 1
      for (let yy = y0; yy <= y1 && !touches; yy++) {
        const rOff = yy * w
        for (let xx = x0; xx <= x1; xx++) {
          if (filled[rOff + xx]) {
            touches = true
            break
          }
        }
      }
      if (touches) {
        frontier[frontierLen++] = i
        queued[i] = 1
      }
    }
  }

  for (let pass = 0; pass < passes && frontierLen > 0; pass++) {
    let doneLen = 0
    for (let f = 0; f < frontierLen; f++) {
      const i = frontier[f]
      const x = i % w
      const y = (i - x) / w
      let r = 0, g = 0, b = 0, n = 0
      const y0 = y > 0 ? y - 1 : 0
      const y1 = y + 1 < h ? y + 1 : h - 1
      const x0 = x > 0 ? x - 1 : 0
      const x1 = x + 1 < w ? x + 1 : w - 1
      for (let yy = y0; yy <= y1; yy++) {
        const rOff = yy * w
        for (let xx = x0; xx <= x1; xx++) {
          const j = rOff + xx
          if (!filled[j]) continue
          const pOff = j * 4
          r += data[pOff]
          g += data[pOff + 1]
          b += data[pOff + 2]
          n++
        }
      }
      if (n === 0) continue
      const iOff = i * 4
      data[iOff] = r / n
      data[iOff + 1] = g / n
      data[iOff + 2] = b / n
      done[doneLen++] = i
    }

    for (let d = 0; d < doneLen; d++) {
      filled[done[d]] = 1
    }

    let nextLen = 0
    if (pass + 1 < passes) {
      for (let d = 0; d < doneLen; d++) {
        const i = done[d]
        const x = i % w
        const y = (i - x) / w
        const y0 = y > 0 ? y - 1 : 0
        const y1 = y + 1 < h ? y + 1 : h - 1
        const x0 = x > 0 ? x - 1 : 0
        const x1 = x + 1 < w ? x + 1 : w - 1
        for (let yy = y0; yy <= y1; yy++) {
          const rOff = yy * w
          for (let xx = x0; xx <= x1; xx++) {
            const j = rOff + xx
            if (!filled[j] && !queued[j]) {
              queued[j] = 1
              nextFrontier[nextLen++] = j
            }
          }
        }
      }
    }

    const tmp = frontier
    frontier = nextFrontier
    nextFrontier = tmp
    frontierLen = nextLen
  }
}

/**
 * Reads the image pixels, bleeds edge colours and flips rows bottom-up (WebGL texture
 * origin). Returns null when pixels cannot be read or the image is too large.
 */
function bledPixels(img: HTMLImageElement): Uint8Array | null {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h || w * h > BLEED_MAX_PIXELS) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const src = ctx.getImageData(0, 0, w, h).data
    bleedTransparentEdges(src, w, h)
    const rowBytes = w * 4
    const out = new Uint8Array(src.length)
    for (let y = 0; y < h; y++) {
      out.set(src.subarray(y * rowBytes, (y + 1) * rowBytes), (h - 1 - y) * rowBytes)
    }
    return out
  } catch {
    return null
  }
}

/**
 * Builds the GPU texture for a face image: edge-bled colours, sRGB, mipmaps + anisotropy.
 * The bled pixels are uploaded as a straight-alpha DataTexture — going back through a
 * canvas (putImageData) would premultiply and wipe the bled RGB of alpha-0 pixels.
 */
export function createFaceTexture(img: HTMLImageElement): THREE.Texture {
  const pixels = bledPixels(img)
  const tex = pixels
    ? new THREE.DataTexture(pixels, img.naturalWidth, img.naturalHeight, THREE.RGBAFormat, THREE.UnsignedByteType)
    : new THREE.Texture(img)
  if (pixels) {
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.unpackAlignment = 4
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function resolveFaceTexture(assetPath: string, assetTable?: AssetTable): Promise<ResolvedTexture | null> {
  const resolved = resolveAssetAlias(assetPath, assetTable)
  const cleanKey = (resolved || assetPath || '').trim()
  if (!cleanKey) return Promise.resolve(null)


  const cached = textureCache.get(cleanKey)
  if (cached) return cached

  const promise = (async (): Promise<ResolvedTexture | null> => {
    try {
      // 1. Data URL or Blob URL directly
      if (cleanKey.startsWith('data:') || cleanKey.startsWith('blob:')) {
        return new Promise<ResolvedTexture | null>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const tex = createFaceTexture(img)
            resolve({ texture: tex, image: img, url: cleanKey, width: img.naturalWidth, height: img.naturalHeight })
          }
          img.onerror = () => resolve(null)
          img.src = cleanKey
        })
      }

      // 2. Try loading raw bytes from main process
      let fileData: { name: string; mime: string; data: Uint8Array } | null = null

      // Check asset-3ds first if path mentions asset-3ds or tudor
      if (window.api?.asset3ds?.loadBytes && (cleanKey.includes('asset-3ds') || cleanKey.includes('tudor_cottage'))) {
        const clean = cleanKey.replace(/^asset-3ds[\\/]/, '')
        fileData = await window.api.asset3ds.loadBytes(clean)
      }

      // Check built-in assets
      if (!fileData && window.api?.loadBuiltInAssetBytes) {
        // Try exact path
        fileData = await window.api.loadBuiltInAssetBytes(cleanKey)
        // Try stripped assets/ prefix
        if (!fileData && cleanKey.startsWith('assets/')) {
          fileData = await window.api.loadBuiltInAssetBytes(cleanKey.replace(/^assets\//, ''))
        }
        // Try assembly_3d prefix
        if (!fileData && !cleanKey.startsWith('assembly_3d/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
        // Try assembly_3d/house prefix if starts with house/
        if (!fileData && cleanKey.startsWith('house/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
        // Try uploads/ prefix
        if (!fileData && !cleanKey.startsWith('uploads/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`uploads/${cleanKey}`)
        }
      }

      // Fallback: check asset-3ds for any path
      if (!fileData && window.api?.asset3ds?.loadBytes) {
        fileData = await window.api.asset3ds.loadBytes(cleanKey)
      }

      // Fallback: check customPublicAssets in localStorage for base64 dataUrl
      if (!fileData && typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem('pxs.customPublicAssets')
          if (raw) {
            const list = JSON.parse(raw)
            const match = list.find(
              (it: any) =>
                it?.path === cleanKey ||
                it?.relativePath === cleanKey ||
                it?.id === cleanKey ||
                it?.fileName === cleanKey ||
                cleanKey.endsWith(it?.fileName || '___')
            )
            if (match?.previewUrl && typeof match.previewUrl === 'string' && match.previewUrl.startsWith('data:')) {
              return new Promise<ResolvedTexture | null>((resolve) => {
                const img = new Image()
                img.onload = () => {
                  const tex = createFaceTexture(img)
                  resolve({ texture: tex, image: img, url: match.previewUrl, width: img.naturalWidth, height: img.naturalHeight })
                }
                img.onerror = () => {
                  textureCache.delete(cleanKey)
                  resolve(null)
                }
                img.src = match.previewUrl
              })
            }
          }
        } catch {
          /* ignore storage errors */
        }
      }

      if (fileData) {
        const blob = new Blob([fileData.data as BlobPart], { type: fileData.mime })
        const blobUrl = URL.createObjectURL(blob)
        createdBlobUrls.add(blobUrl)

        return new Promise<ResolvedTexture | null>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const tex = createFaceTexture(img)
            resolve({ texture: tex, image: img, url: blobUrl, width: img.naturalWidth, height: img.naturalHeight })
          }
          img.onerror = () => {
            textureCache.delete(cleanKey)
            resolve(null)
          }
          img.src = blobUrl
        })
      }
    } catch (err) {
      console.warn('[textureResolver] Error resolving face texture:', assetPath, err)
    }
    textureCache.delete(cleanKey)
    return null
  })()

  textureCache.set(cleanKey, promise)
  return promise
}

export function clearTextureCache(): void {
  for (const url of createdBlobUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
  createdBlobUrls.clear()
  textureCache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('publicAssets:changed', () => {
    clearTextureCache()
  })
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearTextureCache()
  })
}
