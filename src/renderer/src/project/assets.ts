import { nanoid } from 'nanoid'
import type { AssetKind, AssetMeta } from '@shared/types'

export interface RuntimeAsset {
  meta: AssetMeta
  /** Compressed file data. Blobs live outside the JS heap (Chromium can page large ones to disk). */
  blob: Blob
  /** Blob URL of the original file (audio playback). */
  url: string
  /** Small (≤256px) thumbnail URL for UI lists — never decode full-res images for the UI. */
  thumbUrl?: string
  /** Low-res alpha mask used for pixel-accurate picking in the viewer. */
  alpha?: { w: number; h: number; data: Uint8ClampedArray }
}

type Listener = () => void

const THUMB = 256
const MAX_CONCURRENT_DECODES = 3

/**
 * Holds binary asset data outside the (serializable, undoable) project state.
 *
 * Memory model (v2): only the compressed Blob is kept. Full-resolution pixels are never
 * held here — renderers request a decode at the exact level-of-detail they need via
 * {@link AssetStore.decode}, upload it to the GPU and close the bitmap immediately.
 */
class AssetStore {
  private assets = new Map<string, RuntimeAsset>()
  private listeners = new Set<Listener>()
  private active = 0
  private queue: (() => void)[] = []
  version = 0
  /** Diagnostics. */
  stats = { decodes: 0, decodedBytes: 0 }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    this.version++
    this.listeners.forEach((l) => l())
  }

  get(id: string): RuntimeAsset | undefined {
    return this.assets.get(id)
  }

  async getBytes(id: string): Promise<Uint8Array | undefined> {
    const a = this.assets.get(id)
    return a ? new Uint8Array(await a.blob.arrayBuffer()) : undefined
  }

  clear(): void {
    this.assets.forEach((a) => {
      URL.revokeObjectURL(a.url)
      if (a.thumbUrl) URL.revokeObjectURL(a.thumbUrl)
    })
    this.assets.clear()
    this.emit()
  }

  /** Register bytes as an asset; resolves once probed (size, thumbnail, alpha mask). */
  async add(name: string, mime: string, bytes: Uint8Array | Blob, kind: AssetKind, existingMeta?: AssetMeta): Promise<RuntimeAsset> {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)
    const meta: AssetMeta = existingMeta ?? { id: nanoid(10), name, kind, mime }
    const asset: RuntimeAsset = { meta, blob, url }

    if (kind === 'image') {
      if (!meta.width || !meta.height) {
        const head = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer())
        const size = probeImageSize(head)
        if (size) [meta.width, meta.height] = size
        else if (typeof createImageBitmap !== 'undefined') {
          const bmp = await createImageBitmap(blob)
          meta.width = bmp.width
          meta.height = bmp.height
          bmp.close()
        } else {
          meta.width = 1920
          meta.height = 1080
        }
      }
      if (typeof createImageBitmap !== 'undefined' && typeof document !== 'undefined') {
        const s = Math.min(1, THUMB / Math.max(meta.width!, meta.height!))
        const tw = Math.max(1, Math.round(meta.width! * s))
        const th = Math.max(1, Math.round(meta.height! * s))
        const small = await createImageBitmap(blob, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'medium' })
        const c = document.createElement('canvas')
        c.width = tw
        c.height = th
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(small, 0, 0)
        small.close()
        const src = ctx.getImageData(0, 0, tw, th).data
        const data = new Uint8ClampedArray(tw * th)
        for (let i = 0; i < tw * th; i++) data[i] = src[i * 4 + 3]
        asset.alpha = { w: tw, h: th, data }
        const thumb = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.85))
        if (thumb) asset.thumbUrl = URL.createObjectURL(thumb)
      }
    } else {
      meta.duration = await probeAudioDuration(url)
    }

    this.assets.set(meta.id, asset)
    this.emit()
    return asset
  }

  /** Register a canvas as a PNG asset (procedural content). */
  async addCanvas(name: string, canvas: HTMLCanvasElement): Promise<RuntimeAsset> {
    const blob = await new Promise<Blob>((res, rej) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
      } else {
        res(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }))
      }
    })
    return this.add(name, 'image/png', blob, 'image', {
      id: nanoid(10),
      name,
      kind: 'image',
      mime: 'image/png',
      width: canvas.width,
      height: canvas.height
    })
  }

  /**
   * Decode an image at a specific size, ready for WebGL upload (rows flipped, straight alpha).
   * At most a few decodes run concurrently. Caller owns the bitmap and must close() it.
   */
  decode(id: string, width: number, height: number): Promise<ImageBitmap> {
    const asset = this.assets.get(id)
    if (!asset) return Promise.reject(new Error(`asset ${id} not found`))
    return new Promise<ImageBitmap>((resolve, reject) => {
      const run = (): void => {
        this.active++
        const full = width >= (asset.meta.width ?? 0) && height >= (asset.meta.height ?? 0)
        createImageBitmap(asset.blob, {
          imageOrientation: 'flipY',
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
          ...(full ? {} : { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' as const })
        })
          .then((b) => {
            this.stats.decodes++
            this.stats.decodedBytes += b.width * b.height * 4
            resolve(b)
          }, reject)
          .finally(() => {
            this.active--
            this.queue.shift()?.()
          })
      }
      if (this.active < MAX_CONCURRENT_DECODES) run()
      else this.queue.push(run)
    })
  }

  all(): RuntimeAsset[] {
    return [...this.assets.values()]
  }
}

/** Read width/height from PNG, JPEG, GIF, WebP or BMP headers without decoding pixels. */
export function probeImageSize(b: Uint8Array): [number, number] | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return [dv.getUint32(16), dv.getUint32(20)]
  }
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return [dv.getUint16(6, true), dv.getUint16(8, true)]
  }
  if (b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d) {
    return [Math.abs(dv.getInt32(18, true)), Math.abs(dv.getInt32(22, true))]
  }
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (fourcc === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))]
    if (fourcc === 'VP8 ') return [dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff]
    if (fourcc === 'VP8L') {
      const bits = dv.getUint32(21, true)
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]
    }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const marker = b[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      const len = dv.getUint16(i + 2)
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSOF) return [dv.getUint16(i + 7), dv.getUint16(i + 5)]
      i += 2 + len
    }
  }
  return null
}

function probeAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0)
    a.onerror = () => resolve(0)
    a.src = url
  })
}

export const assetStore = new AssetStore()
