import * as THREE from 'three'
import type { Layer } from '@shared/types'
import { assetStore } from '../project/assets'
import { getAnimatedGifFrameIndex } from '../project/gifHelper'
import type { EvaluatedLayer } from './evaluateScene'
import { renderSolidCanvas, renderTextCanvas } from './layerCanvases'
import { DEG } from './spatial'
import { canvasAlpha, MAX_LEVEL, type ResidencyStats, type TexEntry } from './renderTypes'
import type { LayerNode } from './layerNodes'

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()

export class TexturePool {
  private pool = new Map<string, TexEntry>()
  private pending = new Map<string, { level: number; promise: Promise<void> }>()
  private generation = 0
  private tick = 0
  lodBias = 0
  private lastBiasChange = 0
  private maxTex: number
  budgetMB: number
  private maxAnisotropy: number
  disposed = false

  onInvalidate: () => void = () => undefined
  onDropTexture?: (key: string) => void

  constructor(budgetMB = 1024, maxTextureSize = 8192, maxAnisotropy = 1) {
    this.budgetMB = budgetMB
    this.maxTex = Math.min(8192, maxTextureSize)
    this.maxAnisotropy = maxAnisotropy
  }

  get maxTextureSize(): number {
    return this.maxTex
  }
  set maxTextureSize(val: number) {
    this.maxTex = Math.min(16384, Math.max(1024, val))
  }

  get maxAnisotropyLevel(): number {
    return this.maxAnisotropy
  }
  set maxAnisotropyLevel(val: number) {
    this.maxAnisotropy = Math.max(1, val)
    for (const e of this.pool.values()) {
      if (e.texture.anisotropy !== this.maxAnisotropy) {
        e.texture.anisotropy = this.maxAnisotropy
        e.texture.needsUpdate = true
      }
    }
  }

  advanceTick(): void {
    this.tick++
  }

  has(key: string): boolean {
    return this.pool.has(key)
  }

  get(key: string): TexEntry | undefined {
    return this.pool.get(key)
  }

  touch(key: string): void {
    const e = this.pool.get(key)
    if (e) e.lastUsed = this.tick
  }

  configureTexture(tex: THREE.Texture): THREE.Texture {
    tex.colorSpace = THREE.NoColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = this.maxAnisotropy
    tex.needsUpdate = true
    return tex
  }

  levelSize(w: number, h: number, level: number): [number, number] {
    const k = 2 ** level
    return [Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k))]
  }

  /** LOD level an image layer needs for its on-screen size from `cam`. */
  desiredLevel(el: EvaluatedLayer, planeW: number, planeH: number, cam: THREE.Camera, viewportH: number, minLevel: number): number {
    if (el.layer.type !== 'image') return 0
    const meta = assetStore.get(el.layer.props.assetId)?.meta
    if (!meta?.width || !meta.height) return 0
    const sx = _v1.setFromMatrixColumn(el.world, 0).length()
    const sy = _v1.setFromMatrixColumn(el.world, 1).length()
    let pxPerUnit: number
    if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
      const o = cam as THREE.OrthographicCamera
      pxPerUnit = (viewportH * o.zoom) / Math.max(1e-6, o.top - o.bottom)
    } else {
      const p = cam as THREE.PerspectiveCamera
      const dist = Math.max(p.near, el.bounds.distanceToPoint(_v2.setFromMatrixPosition(p.matrixWorld)))
      pxPerUnit = viewportH / (2 * Math.tan((p.fov * DEG) / 2)) / dist
    }
    const projW = Math.max(1e-3, planeW * sx * pxPerUnit)
    const projH = Math.max(1e-3, planeH * sy * pxPerUnit)
    const ratio = Math.min(meta.width / projW, meta.height / projH)
    let level = ratio <= 1.0001 ? 0 : Math.floor(Math.log2(ratio))
    level = Math.min(MAX_LEVEL, Math.max(minLevel, level + this.lodBias))
    while (level < MAX_LEVEL && Math.max(...this.levelSize(meta.width, meta.height, level)) > this.maxTex) level++
    return level
  }

  requestDecode(assetId: string, level: number): Promise<void> {
    const key = `img:${assetId}`
    const pend = this.pending.get(key)
    if (pend && pend.level <= level) return pend.promise
    const meta = assetStore.get(assetId)?.meta
    if (!meta?.width || !meta.height) return Promise.resolve()
    const [w, h] = this.levelSize(meta.width, meta.height, level)
    const gen = this.generation
    const promise = assetStore.decode(assetId, w, h).then(
      (bmp) => {
        if (this.pending.get(key)?.promise === promise) this.pending.delete(key)
        const existing = this.pool.get(key)
        if (this.disposed || gen !== this.generation || (existing && existing.level <= level)) {
          bmp.close()
          return
        }
        const tex = this.configureTexture(new THREE.Texture(bmp as unknown as HTMLImageElement))
        tex.flipY = false // flipped by createImageBitmap
        // Pixels live on the GPU after upload; free the CPU copy right away.
        tex.onUpdate = () => bmp.close()
        if (existing) existing.texture.dispose()
        this.pool.set(key, {
          key,
          texture: tex,
          level,
          w: bmp.width,
          h: bmp.height,
          bytes: Math.round(bmp.width * bmp.height * 4 * 1.34),
          lastUsed: this.tick
        })
        this.onInvalidate()
      },
      (err) => {
        if (this.pending.get(key)?.promise === promise) this.pending.delete(key)
        console.warn('[SceneRenderer] decode failed', assetId, err)
      }
    )
    this.pending.set(key, { level, promise })
    return promise
  }

  /** Returns the best resident texture for a node (requesting a better one if needed). */
  acquireTexture(
    el: EvaluatedLayer,
    node: LayerNode,
    level: number,
    t = 0,
    isExport = false,
    isPlaying = false
  ): TexEntry | null {
    const layer = el.layer
    if (!node.texKey) return null

    if (layer.type === 'image') {
      const asset = assetStore.get(layer.props.assetId)
      if (asset?.gif && asset.gif.frames.length > 1) {
        // When in live viewport and paused, use continuous real-world time so the GIF animates smoothly
        const isLivePaused = !isExport && !isPlaying && (layer.props.autoPlayPaused !== false)
        const liveT = typeof performance !== 'undefined' ? performance.now() / 1000 : 0
        const animT = isLivePaused ? liveT : t
        const frameIdx = getAnimatedGifFrameIndex(asset.gif, animT, layer.props)
        const frameKey = `gif:${layer.props.assetId}:f${frameIdx}`
        let ge = this.pool.get(frameKey)
        if (!ge) {
          const frame = asset.gif.frames[frameIdx]
          if (frame?.bitmap) {
            const tex = this.configureTexture(new THREE.Texture(frame.bitmap as unknown as HTMLImageElement))
            tex.flipY = false
            tex.needsUpdate = true
            ge = {
              key: frameKey,
              texture: tex,
              level: 0,
              w: frame.bitmap.width,
              h: frame.bitmap.height,
              bytes: Math.round(frame.bitmap.width * frame.bitmap.height * 4 * 1.34),
              lastUsed: this.tick
            }
            this.pool.set(frameKey, ge)
          }
        }
        if (ge) {
          ge.lastUsed = this.tick
          return ge
        }
      } else if (
        asset &&
        !asset.gif &&
        (asset.meta.mime === 'image/gif' ||
          asset.meta.name.toLowerCase().endsWith('.gif') ||
          asset.meta.mime === 'image/webp' ||
          asset.meta.name.toLowerCase().endsWith('.webp'))
      ) {
        void assetStore.getAnimatedGif(layer.props.assetId).then((g) => {
          if (g) this.onInvalidate()
        })
      }

      let e = this.pool.get(node.texKey)
      if (!e || e.level > level) void this.requestDecode(layer.props.assetId, level)
      if (e) e.lastUsed = this.tick
      return e ?? null
    }

    let e = this.pool.get(node.texKey)
    if (!e && (layer.type === 'text' || layer.type === 'solid')) {
      e = this.buildCanvasTexture(layer, node)
    }
    if (e) e.lastUsed = this.tick
    return e ?? null
  }

  buildCanvasTexture(layer: Layer, node: LayerNode): TexEntry {
    let canvas: HTMLCanvasElement
    if (layer.type === 'text') {
      const fontSpec = `${layer.props.fontWeight} ${layer.props.fontSize}px "${layer.props.fontFamily}"`
      if (!document.fonts.check(fontSpec)) {
        document.fonts.load(fontSpec).then(() => {
          if (node.texKey) this.dropTexture(node.texKey)
          this.onInvalidate()
        })
      }
      const r = renderTextCanvas(layer.props)
      canvas = r.canvas
      node.planeW = r.width
      node.planeH = r.height
      node.alpha = canvasAlpha(r.canvas)
    } else {
      const r = renderSolidCanvas((layer as Layer & { type: 'solid' }).props)
      canvas = r.canvas
      node.planeW = r.width
      node.planeH = r.height
    }
    const tex = this.configureTexture(new THREE.CanvasTexture(canvas))
    const e: TexEntry = {
      key: node.texKey!,
      texture: tex,
      level: 0,
      w: canvas.width,
      h: canvas.height,
      bytes: Math.round(canvas.width * canvas.height * 4 * 1.34),
      lastUsed: this.tick
    }
    this.pool.set(e.key, e)
    return e
  }

  dropTexture(key: string): void {
    const e = this.pool.get(key)
    if (!e) return
    const src = e.texture.image as ImageBitmap | undefined
    if (!key.startsWith('gif:') && src && typeof (src as ImageBitmap).close === 'function') {
      src.close()
    }
    e.texture.dispose()
    this.pool.delete(key)
    if (this.onDropTexture) this.onDropTexture(key)
  }

  dropAllTextures(): void {
    this.generation++
    for (const key of [...this.pool.keys()]) this.dropTexture(key)
    this.pending.clear()
  }

  /** Enforce the VRAM budget: evict least-recently-used textures not needed this frame. */
  evict(): void {
    const budget = this.budgetMB * 1024 * 1024
    let total = 0
    for (const e of this.pool.values()) total += e.bytes
    if (total <= budget) {
      if (this.lodBias > 0 && total < budget * 0.45 && this.tick - this.lastBiasChange > 90) {
        this.lodBias--
        this.lastBiasChange = this.tick
      }
      return
    }
    const victims = [...this.pool.values()].filter((e) => e.lastUsed < this.tick).sort((a, b) => a.lastUsed - b.lastUsed)
    for (const v of victims) {
      if (total <= budget) break
      total -= v.bytes
      this.dropTexture(v.key)
    }
    if (total > budget && this.lodBias < 3 && this.tick - this.lastBiasChange > 10) {
      // Even the visible set does not fit: lower resolution globally until it does.
      this.lodBias++
      this.lastBiasChange = this.tick
    }
  }

  stats(lastStats: { visibleLayers: number; totalLayers: number; visibleShots: number; totalShots: number }): ResidencyStats {
    let bytes = 0
    for (const e of this.pool.values()) bytes += e.bytes
    return {
      textures: this.pool.size,
      textureMB: Math.round((bytes / 1024 / 1024) * 10) / 10,
      budgetMB: this.budgetMB,
      pending: this.pending.size,
      lodBias: this.lodBias,
      ...lastStats
    }
  }
}
