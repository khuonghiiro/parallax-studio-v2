import * as THREE from 'three'

export interface ResolvedTexture {
  texture: THREE.Texture
  image?: HTMLImageElement
  url?: string
  width: number
  height: number
}

const textureCache = new Map<string, Promise<ResolvedTexture | null>>()
const createdBlobUrls = new Set<string>()

/** Largest image (in pixels) that gets edge bleeding; bigger ones are uploaded as-is. */
const BLEED_MAX_PIXELS = 2048 * 2048
const BLEED_PASSES = 3

/**
 * "Alpha bleeding": copies the colour of opaque edge pixels into neighbouring fully
 * transparent pixels (alpha stays 0). Without it, texture filtering at the alpha-cutout
 * edge mixes in the (usually black or white) RGB of transparent pixels → ugly fringes.
 */
export function bleedTransparentEdges(data: Uint8ClampedArray, w: number, h: number, passes = BLEED_PASSES): void {
  const filled = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) filled[i] = data[i * 4 + 3] > 0 ? 1 : 0
  const neighbours = (i: number, visit: (j: number) => void): void => {
    const x = i % w
    const y = (i - x) / w
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= h) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx
        if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue
        visit(yy * w + xx)
      }
    }
  }
  // Initial frontier: transparent pixels touching an opaque one.
  let frontier: number[] = []
  for (let i = 0; i < w * h; i++) {
    if (filled[i]) continue
    let touches = false
    neighbours(i, (j) => { if (filled[j]) touches = true })
    if (touches) frontier.push(i)
  }
  for (let pass = 0; pass < passes && frontier.length > 0; pass++) {
    const done: number[] = []
    for (const i of frontier) {
      let r = 0, g = 0, b = 0, n = 0
      neighbours(i, (j) => {
        if (!filled[j]) return
        r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++
      })
      if (n === 0) continue
      data[i * 4] = r / n
      data[i * 4 + 1] = g / n
      data[i * 4 + 2] = b / n
      done.push(i)
    }
    const nextSet = new Set<number>()
    for (const i of done) filled[i] = 1
    for (const i of done) neighbours(i, (j) => { if (!filled[j]) nextSet.add(j) })
    frontier = Array.from(nextSet)
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

export function resolveFaceTexture(assetPath: string): Promise<ResolvedTexture | null> {
  const cleanKey = assetPath.trim()
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
        // Try assembly_3d prefix
        if (!fileData && !cleanKey.startsWith('assembly_3d/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
        // Try assembly_3d/house prefix if starts with house/
        if (!fileData && cleanKey.startsWith('house/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
      }

      // Fallback: check asset-3ds for any path
      if (!fileData && window.api?.asset3ds?.loadBytes) {
        fileData = await window.api.asset3ds.loadBytes(cleanKey)
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
          img.onerror = () => resolve(null)
          img.src = blobUrl
        })
      }
    } catch (err) {
      console.warn('[textureResolver] Error resolving face texture:', assetPath, err)
    }
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
