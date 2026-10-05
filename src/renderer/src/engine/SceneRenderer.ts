import * as THREE from 'three'
import type { BlendMode, Layer, LookSettings, ParticleProps, Project } from '@shared/types'
import { assetStore } from '../project/assets'
import { getAnimatedGifFrameIndex } from '../project/gifHelper'
import { mulberry32 } from '../animation/math'
import { evaluateScene, type EvaluatedCamera, type EvaluatedLayer, type EvaluatedScene } from './evaluateScene'
import { EditorHelpers, type HelperLayerInfo, type ScreenLabel } from './editorHelpers'
import { renderSolidCanvas, renderTextCanvas } from './layerCanvases'
import { COPY_FRAG, LAYER_FRAG, LAYER_VERT, PARTICLE_FRAG, PARTICLE_VERT, POST_FRAG, POST_VERT } from './shaders'
import { DEG } from './spatial'

// Composite in display space (like AE's default, non-linear workflow).
THREE.ColorManagement.enabled = false

/** Device-pixel rectangle, top-left origin. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface AlphaMask {
  w: number
  h: number
  data: Uint8ClampedArray
}

interface LayerNode {
  id: string
  type: Layer['type']
  object: THREE.Mesh | THREE.Points
  /** Props reference the GPU data was built from (immer gives new refs on change). */
  builtFrom: unknown
  planeW: number
  planeH: number
  alpha?: AlphaMask
  /** Texture-pool key (images share one entry per asset). */
  texKey?: string
  resident: boolean
}

interface TexEntry {
  key: string
  texture: THREE.Texture
  /** LOD level: 0 = full resolution, n = 1/2^n. Canvas textures are always 0. */
  level: number
  w: number
  h: number
  bytes: number
  lastUsed: number
}

export interface RenderOptions {
  /** Layer to outline (preview only). */
  selectedId?: string | null
  /** Frame index — seeds film grain deterministically. */
  frame?: number
  /** Draw into this part of the canvas (split views). Omit = whole canvas, new frame. */
  viewport?: Rect
  /** Request textures that will be needed in the next ~1.5 s of the camera path. */
  prefetch?: boolean
  /** Whether the timeline is actively playing. */
  playing?: boolean
}

export interface EditorRenderOptions {
  viewport: Rect
  selectedId?: string | null
  selectedShotId?: string | null
  showPath?: boolean
  /** Only show content the active camera would load (residency preview); others are outlines. */
  cameraOnly?: boolean
  /** Whether the timeline is actively playing. */
  playing?: boolean
}

export interface ResidencyStats {
  textures: number
  textureMB: number
  budgetMB: number
  pending: number
  lodBias: number
  visibleLayers: number
  totalLayers: number
  visibleShots: number
  totalShots: number
}

const MAX_LEVEL = 6
const LOOKAHEAD = [0.4, 0.9, 1.5]
const EDITOR_MIN_LEVEL = 2
const CULL_FOV_SCALE = 1.2

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)

function sharedUniforms() {
  return {
    dofOn: { value: 0 },
    focusDistance: { value: 1000 },
    aperture: { value: 0 },
    fogOn: { value: 0 },
    fogColor: { value: new THREE.Color('#000000') },
    fogNear: { value: 1000 },
    fogFar: { value: 5000 }
  }
}

function applyBlend(mat: THREE.ShaderMaterial, mode: BlendMode): void {
  mat.blending = THREE.NormalBlending
  mat.depthWrite = mode === 'normal' || mode === 'multiply'
  switch (mode) {
    case 'add':
      mat.blending = THREE.AdditiveBlending
      break
    case 'screen':
      mat.blending = THREE.CustomBlending
      mat.blendEquation = THREE.AddEquation
      mat.blendSrc = THREE.OneFactor
      mat.blendDst = THREE.OneMinusSrcColorFactor
      break
    case 'multiply':
      mat.blending = THREE.CustomBlending
      mat.blendEquation = THREE.AddEquation
      mat.blendSrc = THREE.ZeroFactor
      mat.blendDst = THREE.SrcColorFactor
      break
  }
}

const LAYER_COMPOSE_FRAG = LAYER_FRAG.replace(
  'gl_FragColor = vec4(rgb, c.a * opacity);',
  'float aa = c.a * opacity; gl_FragColor = multiplyOut > 0.5 ? vec4(mix(vec3(1.0), rgb, aa), 1.0) : screenOut > 0.5 ? vec4(rgb * aa, aa) : vec4(rgb, aa);'
).replace('uniform float opacity;', 'uniform float opacity;\nuniform float multiplyOut;\nuniform float screenOut;')

const TYPE_COLORS: Record<Layer['type'], string> = {
  image: '#8b7bff',
  text: '#3dd6f5',
  solid: '#f59e6b',
  particles: '#ffc24b'
}

/** Pose a perspective camera from an evaluated camera (depth space → three.js). */
export function applyEvaluatedCamera(cam: THREE.PerspectiveCamera, ev: EvaluatedCamera, aspect: number): void {
  cam.fov = ev.fov
  cam.aspect = aspect
  cam.position.set(ev.position[0], ev.position[1], -ev.position[2])
  cam.up.set(0, 1, 0)
  cam.lookAt(ev.target[0], ev.target[1], -ev.target[2])
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
}

/**
 * Renders a project with Three.js.
 *
 * Residency (v2): only layers inside the (slightly widened) camera frustum are drawn and
 * hold GPU textures. Image textures are decoded at the level of detail matching their
 * on-screen size, kept in an LRU pool under a VRAM budget, and prefetched along the
 * camera path so upcoming shots are ready before they enter the frame.
 */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private helperScene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 400000)
  private cullCamera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 400000)
  private rt: THREE.WebGLRenderTarget
  private editorRt: THREE.WebGLRenderTarget
  private postScene = new THREE.Scene()
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private postMat: THREE.ShaderMaterial
  private copyMat: THREE.ShaderMaterial
  private postQuad: THREE.Mesh
  private nodes = new Map<string, LayerNode>()
  private outline: THREE.LineSegments
  private raycaster = new THREE.Raycaster()
  private lastScene: EvaluatedScene | null = null
  private helpers: EditorHelpers | null = null
  private width = 1
  private height = 1
  private disposed = false
  private contextLost = false
  private restoreWaiters: (() => void)[] = []

  // residency
  private pool = new Map<string, TexEntry>()
  private pending = new Map<string, { level: number; promise: Promise<void> }>()
  private generation = 0
  private tick = 0
  private lodBias = 0
  private lastBiasChange = 0
  private maxTex: number
  budgetMB: number
  private isExport = false
  private isPlaying = false
  private lastStats = { visibleLayers: 0, totalLayers: 0, visibleShots: 0, totalShots: 0 }

  /** Called when async resources (fonts, decoded textures) arrive and a redraw is needed. */
  onInvalidate: () => void = () => undefined

  constructor(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean; budgetMB?: number } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
      powerPreference: 'high-performance'
    })
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.autoClear = false
    this.budgetMB = opts.budgetMB ?? 1024
    this.maxTex = Math.min(8192, this.renderer.capabilities.maxTextureSize)
    this.rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true })
    this.editorRt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true })

    this.postMat = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.rt.texture },
        exposure: { value: 0 },
        contrast: { value: 1 },
        saturation: { value: 1 },
        vignette: { value: 0 },
        grain: { value: 0 },
        seed: { value: 0 },
        fade: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) }
      }
    })
    this.copyMat = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: COPY_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: { tScene: { value: this.editorRt.texture } }
    })
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat)
    this.postQuad.frustumCulled = false
    this.postScene.add(this.postQuad)

    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(UNIT_PLANE),
      new THREE.LineBasicMaterial({ color: 0x7c9cff, depthTest: false, transparent: true, opacity: 0.95 })
    )
    this.outline.visible = false
    this.outline.renderOrder = 1e6
    this.outline.matrixAutoUpdate = false
    this.helperScene.add(this.outline)

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault() // allow the browser to restore the context
      this.contextLost = true
      console.warn('[SceneRenderer] WebGL context lost')
    })
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[SceneRenderer] WebGL context restored')
      this.contextLost = false
      // Textures were uploaded from bitmaps that are already closed: drop and re-request them.
      this.dropAllTextures()
      const waiters = this.restoreWaiters
      this.restoreWaiters = []
      waiters.forEach((w) => w())
      this.onInvalidate()
    })
  }

  isContextLost(): boolean {
    return this.contextLost || this.renderer.getContext().isContextLost()
  }

  /** Resolves once the GL context is usable (immediately if it is). Rejects after `timeoutMs`. */
  waitForContext(timeoutMs = 10000): Promise<void> {
    if (!this.isContextLost()) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Mất kết nối GPU (WebGL context lost) và không khôi phục được')), timeoutMs)
      this.restoreWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  /** Set canvas size in device pixels. */
  setSize(width: number, height: number): void {
    this.width = Math.max(2, Math.round(width))
    this.height = Math.max(2, Math.round(height))
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.width, this.height, false)
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  // ---------------------------------------------------------------- nodes

  private disposeNode(node: LayerNode): void {
    this.scene.remove(node.object)
    if (node.object.geometry !== UNIT_PLANE) node.object.geometry.dispose()
    ;(node.object.material as THREE.Material).dispose()
    if (node.texKey?.startsWith('cv:')) this.dropTexture(node.texKey)
  }

  private makeLayerMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: LAYER_VERT,
      fragmentShader: LAYER_COMPOSE_FRAG,
      transparent: true,
      depthWrite: true,
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: null },
        uvRepeat: { value: new THREE.Vector2(1, 1) },
        uvOffset: { value: new THREE.Vector2(0, 0) },
        texSize: { value: new THREE.Vector2(1, 1) },
        planeSize: { value: new THREE.Vector2(1, 1) },
        opacity: { value: 1 },
        multiplyOut: { value: 0 },
        screenOut: { value: 0 },
        ...sharedUniforms()
      }
    })
  }

  private configureTexture(tex: THREE.Texture): THREE.Texture {
    tex.colorSpace = THREE.NoColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    tex.needsUpdate = true
    return tex
  }

  private buildPlaneNode(layer: Layer): LayerNode {
    const mesh = new THREE.Mesh(UNIT_PLANE, this.makeLayerMaterial())
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.visible = false
    this.scene.add(mesh)
    return { id: layer.id, type: layer.type, object: mesh, builtFrom: null, planeW: 1, planeH: 1, resident: false }
  }

  private buildParticles(layer: Layer & { props: ParticleProps }): LayerNode {
    const p = layer.props
    const count = Math.max(1, Math.min(20000, Math.round(p.count)))
    const rand = mulberry32(p.seed)
    const pos = new Float32Array(count * 3)
    const rnd = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * p.area[0]
      pos[i * 3 + 1] = (rand() - 0.5) * p.area[1]
      pos[i * 3 + 2] = (rand() - 0.5) * p.area[2]
      for (let j = 0; j < 4; j++) rnd[i * 4 + j] = rand()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4))
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: {
        time: { value: 0 },
        area: { value: new THREE.Vector3(...p.area) },
        // Velocity is authored in depth space (+z = away); flip z for three.js.
        velocity: { value: new THREE.Vector3(p.velocity[0], p.velocity[1], -p.velocity[2]) },
        sway: { value: p.sway },
        size: { value: p.size },
        pxScale: { value: 1 },
        twinkle: { value: p.twinkle ? 1 : 0 },
        color: { value: new THREE.Color(p.color) },
        opacity: { value: 1 },
        glow: { value: p.glow ? 1 : 0 },
        ...sharedUniforms()
      }
    })
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.matrixAutoUpdate = false
    points.visible = false
    this.scene.add(points)
    return { id: layer.id, type: 'particles', object: points, builtFrom: layer.props, planeW: 1, planeH: 1, resident: true }
  }

  private syncNodes(project: Project): void {
    const alive = new Set<string>()
    for (const layer of project.layers) {
      alive.add(layer.id)
      let node = this.nodes.get(layer.id)
      const rebuild = !node || node.type !== layer.type || (layer.type === 'particles' && node.builtFrom !== layer.props)
      if (rebuild) {
        if (node) this.disposeNode(node)
        node = layer.type === 'particles' ? this.buildParticles(layer) : this.buildPlaneNode(layer)
        this.nodes.set(layer.id, node)
      }
      node = node!
      if (layer.type === 'image') {
        node.texKey = `img:${layer.props.assetId}`
        node.planeW = layer.props.width
        node.planeH = layer.props.height
        node.alpha = assetStore.get(layer.props.assetId)?.alpha
      } else if (layer.type === 'text' || layer.type === 'solid') {
        node.texKey = `cv:${layer.id}`
        if (node.builtFrom !== layer.props) {
          // Content changed: drop the canvas texture; it is rebuilt lazily when visible.
          this.dropTexture(node.texKey)
          node.builtFrom = layer.props
        }
      }
    }
    for (const [id, node] of this.nodes) {
      if (!alive.has(id)) {
        this.disposeNode(node)
        this.nodes.delete(id)
      }
    }
  }

  // ---------------------------------------------------------------- residency

  private levelSize(w: number, h: number, level: number): [number, number] {
    const k = 2 ** level
    return [Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k))]
  }

  /** LOD level an image layer needs for its on-screen size from `cam`. */
  private desiredLevel(el: EvaluatedLayer, node: LayerNode, cam: THREE.Camera, viewportH: number, minLevel: number): number {
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
    const projW = Math.max(1e-3, node.planeW * sx * pxPerUnit)
    const projH = Math.max(1e-3, node.planeH * sy * pxPerUnit)
    const ratio = Math.min(meta.width / projW, meta.height / projH)
    let level = ratio <= 1.0001 ? 0 : Math.floor(Math.log2(ratio))
    level = Math.min(MAX_LEVEL, Math.max(minLevel, level + this.lodBias))
    while (level < MAX_LEVEL && Math.max(...this.levelSize(meta.width, meta.height, level)) > this.maxTex) level++
    return level
  }

  private requestDecode(assetId: string, level: number): Promise<void> {
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
  private acquireTexture(el: EvaluatedLayer, node: LayerNode, level: number, t = 0): TexEntry | null {
    const layer = el.layer
    if (!node.texKey) return null

    if (layer.type === 'image') {
      const asset = assetStore.get(layer.props.assetId)
      if (asset?.gif && asset.gif.frames.length > 1) {
        // When in live viewport and paused, use continuous real-world time so the GIF animates smoothly
        const isLivePaused = !this.isExport && !this.isPlaying && (layer.props.autoPlayPaused !== false)
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

  private buildCanvasTexture(layer: Layer, node: LayerNode): TexEntry {
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

  private dropTexture(key: string): void {
    const e = this.pool.get(key)
    if (!e) return
    const src = e.texture.image as ImageBitmap | undefined
    if (!key.startsWith('gif:') && src && typeof (src as ImageBitmap).close === 'function') {
      src.close()
    }
    e.texture.dispose()
    this.pool.delete(key)
    for (const n of this.nodes.values()) {
      if (n.texKey === key) {
        const u = (n.object.material as THREE.ShaderMaterial).uniforms
        if (u.map) u.map.value = null
      }
    }
  }

  private dropAllTextures(): void {
    this.generation++
    for (const key of [...this.pool.keys()]) this.dropTexture(key)
    this.pending.clear()
  }

  /** Enforce the VRAM budget: evict least-recently-used textures not needed this frame. */
  private evict(): void {
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

  stats(): ResidencyStats {
    let bytes = 0
    for (const e of this.pool.values()) bytes += e.bytes
    return {
      textures: this.pool.size,
      textureMB: Math.round((bytes / 1024 / 1024) * 10) / 10,
      budgetMB: this.budgetMB,
      pending: this.pending.size,
      lodBias: this.lodBias,
      ...this.lastStats
    }
  }

  // ---------------------------------------------------------------- frame layout

  private cullFrustum(cam: THREE.Camera, out: THREE.Frustum): THREE.Frustum {
    let proj: THREE.Matrix4
    if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const p = cam as THREE.PerspectiveCamera
      const c = this.cullCamera
      c.position.copy(p.position)
      c.quaternion.copy(p.quaternion)
      c.fov = Math.min(170, p.fov * CULL_FOV_SCALE)
      c.aspect = p.aspect * 1.08
      c.near = p.near
      c.far = p.far
      c.updateProjectionMatrix()
      c.updateMatrixWorld()
      proj = _m1.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
    } else {
      cam.updateMatrixWorld()
      proj = _m1.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    }
    return out.setFromProjectionMatrix(proj)
  }

  /**
   * Position every layer, decide visibility via frustum culling, bind textures and set
   * uniforms. `lodCam` is the camera used for LOD (active camera unless editor view).
   */
  private layoutLayers(
    ev: EvaluatedScene,
    look: LookSettings,
    cam: THREE.Camera,
    viewportH: number,
    mode: { editor: boolean; cullCam?: THREE.Camera }
  ): void {
    const frustum = this.cullFrustum(mode.cullCam ?? cam, _frustum)
    const isPersp = (cam as THREE.PerspectiveCamera).isPerspectiveCamera
    const pxScale = isPersp ? viewportH / (2 * Math.tan(((cam as THREE.PerspectiveCamera).fov * DEG) / 2)) : viewportH / 1000
    const camPos = _v3.setFromMatrixPosition(cam.matrixWorld)
    const camDir = cam.getWorldDirection(_v4)
    const ordering: { node: LayerNode; dist: number; index: number; particles: boolean }[] = []
    let visibleLayers = 0
    const visibleShots = new Set<string>()

    for (const el of ev.layers) {
      const node = this.nodes.get(el.layer.id)
      if (!node) continue
      const obj = node.object
      // Matrices are kept current for every layer so picking works even when culled.
      if (node.type === 'particles') obj.matrix.copy(el.world)
      else obj.matrix.copy(el.world).multiply(_m2.makeScale(node.planeW, node.planeH, 1))
      obj.matrixWorldNeedsUpdate = true
      obj.updateMatrixWorld(true)

      const inView = el.active && el.opacity > 0.001 && frustum.intersectsBox(el.bounds)
      node.resident = node.type === 'particles' || (!!node.texKey && this.pool.has(node.texKey))
      if (!inView) {
        obj.visible = false
        continue
      }

      const mat = obj.material as THREE.ShaderMaterial
      const u = mat.uniforms
      if (node.type !== 'particles') {
        const level = this.desiredLevel(el, node, cam, viewportH, mode.editor ? EDITOR_MIN_LEVEL : 0)
        const entry = this.acquireTexture(el, node, level, ev.t)
        node.resident = !!entry
        if (!entry) {
          obj.visible = false
          continue
        }
        // Canvas layers learn their true size when built; refresh the matrix.
        obj.matrix.copy(el.world).multiply(_m2.makeScale(node.planeW, node.planeH, 1))
        obj.updateMatrixWorld(true)
        u.map.value = entry.texture
        u.texSize.value.set(entry.w, entry.h)
        u.planeSize.value.set(node.planeW, node.planeH)
        if (el.layer.type === 'image' && el.layer.props.repeat) {
          u.uvRepeat.value.set(el.layer.props.repeat[0], el.layer.props.repeat[1])
        } else {
          u.uvRepeat.value.set(1, 1)
        }
        if (el.uvOffset) {
          u.uvOffset.value.set(el.uvOffset[0], el.uvOffset[1])
        } else {
          u.uvOffset.value.set(0, 0)
        }
        applyBlend(mat, el.layer.blendMode)
        u.multiplyOut.value = el.layer.blendMode === 'multiply' ? 1 : 0
        u.screenOut.value = el.layer.blendMode === 'screen' ? 1 : 0
      } else {
        u.time.value = ev.t
        u.pxScale.value = pxScale
        mat.blending = el.layer.blendMode === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending
      }

      obj.visible = true
      visibleLayers++
      if (el.shot) visibleShots.add(el.shot.shot.id)
      u.opacity.value = el.opacity
      u.dofOn.value = !mode.editor && ev.camera.dof ? 1 : 0
      u.focusDistance.value = ev.camera.focusDistance
      u.aperture.value = ev.camera.aperture
      u.fogOn.value = !mode.editor && look.fogEnabled ? 1 : 0
      u.fogColor.value.set(look.fogColor)
      u.fogNear.value = look.fogNear
      u.fogFar.value = Math.max(look.fogNear + 1, look.fogFar)

      _v5.setFromMatrixPosition(el.world).sub(camPos)
      ordering.push({ node, dist: _v5.dot(camDir), index: el.index, particles: node.type === 'particles' })
    }

    // Painter's order: far → near; ties broken by stack order (bottom first). Particles last.
    ordering.sort((a, b) => {
      if (a.particles !== b.particles) return a.particles ? 1 : -1
      if (Math.abs(a.dist - b.dist) > 0.01) return b.dist - a.dist
      return b.index - a.index
    })
    ordering.forEach((o, i) => (o.node.object.renderOrder = i))

    if (!mode.editor) {
      this.lastStats = {
        visibleLayers,
        totalLayers: ev.layers.length,
        visibleShots: visibleShots.size,
        totalShots: ev.shots.length
      }
    }
  }

  // ---------------------------------------------------------------- render

  private applyLook(look: LookSettings, frame: number, fade: number): void {
    const u = this.postMat.uniforms
    u.exposure.value = look.exposure
    u.contrast.value = look.contrast
    u.saturation.value = look.saturation
    u.vignette.value = look.vignette
    u.grain.value = look.grain * 0.25
    u.seed.value = (frame % 997) * 0.731
    u.fade.value = fade
  }

  private ensureTarget(rt: THREE.WebGLRenderTarget, w: number, h: number): void {
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h)
  }

  private setViewport(vp: Rect): void {
    const y = this.height - vp.y - vp.h
    this.renderer.setViewport(vp.x, y, vp.w, vp.h)
    this.renderer.setScissor(vp.x, y, vp.w, vp.h)
    this.renderer.setScissorTest(true)
  }

  /** Start a new frame: clears the whole canvas. Call before rendering split viewports. */
  beginFrame(clearColor = '#07080c'): void {
    this.tick++
    const r = this.renderer
    r.setRenderTarget(null)
    r.setScissorTest(false)
    r.setViewport(0, 0, this.width, this.height)
    r.setClearColor(new THREE.Color(clearColor), 1)
    r.clear(true, true, true)
  }

  /** Render the active-camera view (with post look). */
  render(project: Project, t: number, opts: RenderOptions = {}): EvaluatedScene {
    this.isExport = opts.frame !== undefined
    this.isPlaying = !!opts.playing
    if (!opts.viewport) this.beginFrame()
    const vp = opts.viewport ?? { x: 0, y: 0, w: this.width, h: this.height }
    this.syncNodes(project)
    const ev = evaluateScene(project, t)
    this.lastScene = ev
    const { comp, look } = project

    applyEvaluatedCamera(this.camera, ev.camera, comp.width / comp.height)
    this.layoutLayers(ev, look, this.camera, vp.h, { editor: false })
    this.updateOutline(opts.selectedId)

    const r = this.renderer
    this.ensureTarget(this.rt, vp.w, vp.h)
    this.postMat.uniforms.resolution.value.set(vp.w, vp.h)
    r.setScissorTest(false)
    r.setRenderTarget(this.rt)
    r.setViewport(0, 0, vp.w, vp.h)
    r.setClearColor(new THREE.Color(comp.background), 1)
    r.clear(true, true, true)
    r.render(this.scene, this.camera)

    this.applyLook(look, opts.frame ?? Math.round(t * comp.fps), ev.camera.fade)
    r.setRenderTarget(null)
    this.setViewport(vp)
    this.postQuad.material = this.postMat
    r.render(this.postScene, this.postCamera)
    if (this.outline.visible) r.render(this.helperScene, this.camera)
    r.setScissorTest(false)

    if (opts.prefetch) this.prefetch(project, t, vp.h)
    this.evict()
    return ev
  }

  /** Render the free 3D editor view (no post, no DOF/fog) with gizmos. Returns label anchors. */
  renderEditor(project: Project, t: number, cam: THREE.PerspectiveCamera | THREE.OrthographicCamera, opts: EditorRenderOptions): ScreenLabel[] {
    this.isExport = false
    this.isPlaying = !!opts.playing
    const vp = opts.viewport
    this.syncNodes(project)
    const ev = evaluateScene(project, t)
    this.lastScene = ev
    applyEvaluatedCamera(this.camera, ev.camera, project.comp.width / project.comp.height)
    this.layoutLayers(ev, project.look, cam, vp.h, { editor: true, cullCam: opts.cameraOnly ? this.camera : undefined })
    this.updateOutline(opts.selectedId)

    this.helpers ??= new EditorHelpers()
    const infos = new Map<string, HelperLayerInfo>()
    for (const el of ev.layers) {
      const n = this.nodes.get(el.layer.id)
      if (!n) continue
      const matrix = n.type === 'particles' ? el.world.clone().multiply(_m2.makeScale(el.size[0], el.size[1], 1)) : n.object.matrix
      infos.set(el.layer.id, { matrix, resident: n.resident, color: el.shot?.shot.color ?? TYPE_COLORS[el.layer.type], pickable: !el.layer.locked })
    }
    this.helpers.update(project, ev, this.camera, infos, opts)

    const r = this.renderer
    this.ensureTarget(this.editorRt, vp.w, vp.h)
    r.setScissorTest(false)
    r.setRenderTarget(this.editorRt)
    r.setViewport(0, 0, vp.w, vp.h)
    r.setClearColor(new THREE.Color('#0c0e14'), 1)
    r.clear(true, true, true)
    r.render(this.scene, cam)
    r.render(this.helpers.scene, cam)
    if (this.outline.visible) r.render(this.helperScene, cam)

    r.setRenderTarget(null)
    this.setViewport(vp)
    this.postQuad.material = this.copyMat
    r.render(this.postScene, this.postCamera)
    this.postQuad.material = this.postMat
    r.setScissorTest(false)
    this.evict()
    return this.helpers.labels(ev, cam, this.camera, vp.w, vp.h)
  }

  private updateOutline(selectedId?: string | null): void {
    const sel = selectedId ? this.nodes.get(selectedId) : undefined
    if (sel && sel.object.visible && sel.type !== 'particles') {
      this.outline.visible = true
      this.outline.matrix.copy(sel.object.matrixWorld)
      this.outline.matrixWorldNeedsUpdate = true
    } else {
      this.outline.visible = false
    }
  }

  /**
   * Lay out the scene for a view without drawing, so picking sees the same visibility
   * as that view. `cam` omitted = the active (comp) camera.
   */
  layoutForPick(project: Project, t: number, viewportH: number, cam?: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    this.syncNodes(project)
    const ev = evaluateScene(project, t)
    this.lastScene = ev
    applyEvaluatedCamera(this.camera, ev.camera, project.comp.width / project.comp.height)
    this.layoutLayers(ev, project.look, cam ?? this.camera, viewportH, { editor: !!cam })
  }

  /** Request textures for layers the camera will see shortly (does not wait). */
  private prefetch(project: Project, t: number, viewportH: number): void {
    const cam = new THREE.PerspectiveCamera()
    for (const dt of LOOKAHEAD) {
      const tt = t + dt
      if (tt > project.comp.duration) break
      const ev = evaluateScene(project, tt)
      applyEvaluatedCamera(cam, ev.camera, project.comp.width / project.comp.height)
      cam.near = this.camera.near
      cam.far = this.camera.far
      cam.updateProjectionMatrix()
      const frustum = this.cullFrustum(cam, new THREE.Frustum())
      for (const el of ev.layers) {
        if (el.layer.type !== 'image' || !el.active || el.opacity <= 0.001) continue
        const node = this.nodes.get(el.layer.id)
        if (!node || !frustum.intersectsBox(el.bounds)) continue
        const level = this.desiredLevel(el, node, cam, viewportH, 0)
        const e = this.pool.get(node.texKey!)
        if (e) e.lastUsed = this.tick
        if (!e || e.level > level) void this.requestDecode(el.layer.props.assetId, level)
      }
    }
  }

  /**
   * Make sure every texture needed to render frame `t` at full quality is resident.
   * Export/screenshot call this before render() so frames never show placeholders.
   */
  async prepare(project: Project, t: number, viewportH = this.height): Promise<void> {
    this.syncNodes(project)
    const ev = evaluateScene(project, t)
    const cam = new THREE.PerspectiveCamera()
    applyEvaluatedCamera(cam, ev.camera, project.comp.width / project.comp.height)
    cam.near = this.camera.near
    cam.far = this.camera.far
    cam.updateProjectionMatrix()
    const frustum = this.cullFrustum(cam, new THREE.Frustum())
    const waits: Promise<void>[] = []
    for (const el of ev.layers) {
      if (el.layer.type !== 'image' || !el.active || el.opacity <= 0.001) continue
      const node = this.nodes.get(el.layer.id)
      if (!node || !frustum.intersectsBox(el.bounds)) continue
      const level = this.desiredLevel(el, node, cam, viewportH, 0)
      const e = this.pool.get(node.texKey!)
      if (e) e.lastUsed = this.tick
      if (!e || e.level > level) waits.push(this.requestDecode(el.layer.props.assetId, level))
    }
    await Promise.all(waits)
  }

  /** Read back the current frame (RGBA, bottom-up rows). Call right after render(). */
  readPixels(): Uint8Array {
    const gl = this.renderer.getContext()
    const out = new Uint8Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  // ---------------------------------------------------------------- picking

  rayAt(ndcX: number, ndcY: number, cam: THREE.Camera = this.camera): THREE.Ray {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam)
    return this.raycaster.ray.clone()
  }

  /**
   * Returns the top-most opaque layer under normalized device coords of `cam`'s viewport.
   * In the camera view only drawn layers are pickable; in the 3D view any active layer is.
   */
  pick(ndcX: number, ndcY: number, project: Project, cam: THREE.Camera = this.camera, onlyVisible = true): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam)
    const ev = this.lastScene
    const active = new Set(ev?.layers.filter((l) => l.active).map((l) => l.layer.id))
    const candidates: THREE.Object3D[] = []
    const byObj = new Map<THREE.Object3D, LayerNode>()
    for (const layer of project.layers) {
      const node = this.nodes.get(layer.id)
      if (!node || layer.locked || node.type === 'particles') continue
      if (onlyVisible ? !node.object.visible : !active.has(layer.id)) continue
      candidates.push(node.object)
      byObj.set(node.object, node)
    }
    const hits = this.raycaster.intersectObjects(candidates, false)
    if (onlyVisible) hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder)
    for (const hit of hits) {
      const node = byObj.get(hit.object)!
      if (!node.alpha || !hit.uv || !node.resident) return node.id
      const { w, h, data } = node.alpha
      const x = Math.min(w - 1, Math.max(0, Math.floor(hit.uv.x * w)))
      const y = Math.min(h - 1, Math.max(0, Math.floor((1 - hit.uv.y) * h)))
      if (data[y * w + x] > 24) return node.id
    }
    return null
  }

  /** Nearest shot whose bounds the ray hits. */
  pickShot(ndcX: number, ndcY: number, cam: THREE.Camera): string | null {
    const ev = this.lastScene
    if (!ev) return null
    const ray = this.rayAt(ndcX, ndcY, cam)
    let best: string | null = null
    let bestD = Infinity
    const p = new THREE.Vector3()
    for (const s of ev.shots) {
      if (!s.shot.visible || !ray.intersectBox(s.bounds, p)) continue
      const d = p.distanceTo(ray.origin)
      if (d < bestD) {
        bestD = d
        best = s.shot.id
      }
    }
    return best
  }

  get evaluated(): EvaluatedScene | null {
    return this.lastScene
  }

  dispose(): void {
    this.disposed = true
    for (const node of this.nodes.values()) this.disposeNode(node)
    this.nodes.clear()
    this.dropAllTextures()
    this.helpers?.dispose()
    this.rt.dispose()
    this.editorRt.dispose()
    this.postMat.dispose()
    this.copyMat.dispose()
    this.renderer.dispose()
  }
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()
const _v5 = new THREE.Vector3()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _frustum = new THREE.Frustum()

function canvasAlpha(canvas: HTMLCanvasElement): AlphaMask {
  const s = Math.min(1, 256 / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * s))
  const h = Math.max(1, Math.round(canvas.height * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h).data
  const data = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) data[i] = src[i * 4 + 3]
  return { w, h, data }
}
