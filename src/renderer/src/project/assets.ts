import { nanoid } from 'nanoid'
import type { AssetKind, AssetMeta } from '@shared/types'

export interface RuntimeAsset {
  meta: AssetMeta
  bytes: Uint8Array
  url: string
  image?: HTMLImageElement
  /** Low-res alpha mask used for pixel-accurate picking in the viewer. */
  alpha?: { w: number; h: number; data: Uint8ClampedArray }
}

type Listener = () => void

/**
 * Holds binary asset data outside the (serializable, undoable) project state.
 * Images are decoded once and shared by the preview and export renderers.
 */
class AssetStore {
  private assets = new Map<string, RuntimeAsset>()
  private listeners = new Set<Listener>()
  version = 0

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

  getImage(id: string): HTMLImageElement | undefined {
    return this.assets.get(id)?.image
  }

  clear(): void {
    this.assets.forEach((a) => URL.revokeObjectURL(a.url))
    this.assets.clear()
    this.emit()
  }

  /** Register bytes as an asset; resolves once decoded (images) or probed (audio). */
  async add(
    name: string,
    mime: string,
    bytes: Uint8Array,
    kind: AssetKind,
    existingMeta?: AssetMeta
  ): Promise<RuntimeAsset> {
    const blob = new Blob([bytes as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)
    const meta: AssetMeta = existingMeta ?? { id: nanoid(10), name, kind, mime }
    const asset: RuntimeAsset = { meta, bytes, url }

    if (kind === 'image') {
      const img = new Image()
      img.src = url
      await img.decode()
      asset.image = img
      meta.width = img.naturalWidth
      meta.height = img.naturalHeight
      asset.alpha = buildAlphaMask(img)
    } else {
      meta.duration = await probeAudioDuration(url)
    }

    this.assets.set(meta.id, asset)
    this.emit()
    return asset
  }

  /** Register a canvas as a PNG asset (used by the procedural demo scene). */
  async addCanvas(name: string, canvas: HTMLCanvasElement): Promise<RuntimeAsset> {
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return this.add(name, 'image/png', bytes, 'image')
  }

  all(): RuntimeAsset[] {
    return [...this.assets.values()]
  }
}

function buildAlphaMask(img: HTMLImageElement): RuntimeAsset['alpha'] {
  const maxSide = 256
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * s))
  const h = Math.max(1, Math.round(img.naturalHeight * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) data[i] = src[i * 4 + 3]
  return { w, h, data }
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
