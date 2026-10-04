import * as THREE from 'three'
import type { BlendMode, Layer, LookSettings, ParticleProps, Project } from '@shared/types'
import { assetStore } from '../project/assets'
import { mulberry32 } from '../animation/math'
import { evaluateScene, type EvaluatedScene } from './evaluateScene'
import { renderSolidCanvas, renderTextCanvas } from './layerCanvases'
import {
  LAYER_FRAG,
  LAYER_VERT,
  PARTICLE_FRAG,
  PARTICLE_VERT,
  POST_FRAG,
  POST_VERT
} from './shaders'

// Composite in display space (like AE's default, non-linear workflow).
THREE.ColorManagement.enabled = false

const DEG = Math.PI / 180

interface AlphaMask {
  w: number
  h: number
  data: Uint8ClampedArray
}

interface LayerNode {
  id: string
  type: Layer['type']
  object: THREE.Mesh | THREE.Points
  /** Last props object reference used to build (immer gives new refs on change). */
  builtFrom: unknown
  ready: boolean
  texture?: THREE.Texture
  planeW: number
  planeH: number
  alpha?: AlphaMask
}

export interface RenderOptions {
  /** Layer to outline (preview only). */
  selectedId?: string | null
  /** Frame index — seeds film grain deterministically. */
  frame?: number
}

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
  mat.uniforms.multiplyOut && (mat.uniforms.multiplyOut.value = 0)
  switch (mode) {
    case 'add':
      mat.blending = THREE.AdditiveBlending
      break
    case 'screen':
      mat.blending = THREE.CustomBlending
      mat.blendEquation = THREE.AddEquation
      mat.blendSrc = THREE.SrcAlphaFactor
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

const MULTIPLY_FRAG = LAYER_FRAG.replace(
  'gl_FragColor = vec4(rgb, c.a * opacity);',
  'float aa = c.a * opacity; gl_FragColor = multiplyOut > 0.5 ? vec4(mix(vec3(1.0), rgb, aa), 1.0) : vec4(rgb, aa);'
).replace('uniform float opacity;', 'uniform float opacity;\nuniform float multiplyOut;')

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private helperScene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 200000)
  private rt: THREE.WebGLRenderTarget
  private postScene = new THREE.Scene()
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private postMat: THREE.ShaderMaterial
  private nodes = new Map<string, LayerNode>()
  private outline: THREE.LineSegments
  private raycaster = new THREE.Raycaster()
  private lastScene: EvaluatedScene | null = null
  private width = 1
  private height = 1
  /** Called when async resources (fonts) finish loading and a redraw is needed. */
  onInvalidate: () => void = () => undefined

  constructor(canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
      powerPreference: 'high-performance'
    })
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.autoClear = false
    this.rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true })

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
        resolution: { value: new THREE.Vector2(1, 1) }
      }
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat)
    quad.frustumCulled = false
    this.postScene.add(quad)

    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
      new THREE.LineBasicMaterial({ color: 0x7c9cff, depthTest: false, transparent: true, opacity: 0.95 })
    )
    this.outline.visible = false
    this.outline.renderOrder = 1e6
    this.helperScene.add(this.outline)

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault() // allow the browser to restore the context
      this.contextLost = true
      console.warn('[SceneRenderer] WebGL context lost')
    })
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[SceneRenderer] WebGL context restored')
      this.contextLost = false
      // Force every layer to rebuild its GPU resources.
      for (const n of this.nodes.values()) n.builtFrom = null
      const waiters = this.restoreWaiters
      this.restoreWaiters = []
      waiters.forEach((w) => w())
      this.onInvalidate()
    })
  }

  private contextLost = false
  private restoreWaiters: (() => void)[] = []

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

  /** Set output size in device pixels. */
  setSize(width: number, height: number): void {
    this.width = Math.max(2, Math.round(width))
    this.height = Math.max(2, Math.round(height))
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.width, this.height, false)
    this.rt.setSize(this.width, this.height)
    this.postMat.uniforms.resolution.value.set(this.width, this.height)
  }

  // ---------------------------------------------------------------- nodes

  private disposeNode(node: LayerNode): void {
    this.scene.remove(node.object)
    node.object.geometry.dispose()
    ;(node.object.material as THREE.Material).dispose()
    node.texture?.dispose()
  }

  private makeLayerMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: LAYER_VERT,
      fragmentShader: MULTIPLY_FRAG,
      transparent: true,
      depthWrite: true,
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      side: THREE.DoubleSide,
      uniforms: {
        map: { value: null },
        texSize: { value: new THREE.Vector2(1, 1) },
        planeSize: { value: new THREE.Vector2(1, 1) },
        opacity: { value: 1 },
        multiplyOut: { value: 0 },
        ...sharedUniforms()
      }
    })
  }

  private makeTexture(source: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
    const tex = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source)
    tex.colorSpace = THREE.NoColorSpace
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    tex.needsUpdate = true
    return tex
  }

  private buildPlane(layer: Layer, existing?: LayerNode): LayerNode {
    let source: HTMLImageElement | HTMLCanvasElement | undefined
    let w = 1
    let h = 1
    let alpha: AlphaMask | undefined
    let ready = true

    if (layer.type === 'image') {
      const asset = assetStore.get(layer.props.assetId)
      source = asset?.image
      alpha = asset?.alpha
      w = layer.props.width
      h = layer.props.height
      ready = !!source
    } else if (layer.type === 'text') {
      const fontSpec = `${layer.props.fontWeight} ${layer.props.fontSize}px "${layer.props.fontFamily}"`
      if (!document.fonts.check(fontSpec)) {
        document.fonts.load(fontSpec).then(() => {
          const n = this.nodes.get(layer.id)
          if (n) n.builtFrom = null
          this.onInvalidate()
        })
      }
      const r = renderTextCanvas(layer.props)
      source = r.canvas
      w = r.width
      h = r.height
      alpha = canvasAlpha(r.canvas)
    } else if (layer.type === 'solid') {
      const r = renderSolidCanvas(layer.props)
      source = r.canvas
      w = r.width
      h = r.height
    }

    let node = existing
    if (!node || !(node.object instanceof THREE.Mesh)) {
      if (node) this.disposeNode(node)
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.makeLayerMaterial())
      mesh.frustumCulled = false
      this.scene.add(mesh)
      node = { id: layer.id, type: layer.type, object: mesh, builtFrom: null, ready, planeW: w, planeH: h }
    } else {
      node.object.geometry.dispose()
      node.object.geometry = new THREE.PlaneGeometry(w, h)
      node.texture?.dispose()
    }
    node.type = layer.type
    node.planeW = w
    node.planeH = h
    node.alpha = alpha
    node.ready = ready
    node.builtFrom = ready ? layer.props : null
    const mat = node.object.material as THREE.ShaderMaterial
    if (source) {
      node.texture = this.makeTexture(source)
      mat.uniforms.map.value = node.texture
      const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
      const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
      mat.uniforms.texSize.value.set(sw, sh)
    }
    mat.uniforms.planeSize.value.set(w, h)
    return node
  }

  private buildParticles(layer: Layer & { props: ParticleProps }, existing?: LayerNode): LayerNode {
    if (existing) this.disposeNode(existing)
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
    this.scene.add(points)
    return {
      id: layer.id,
      type: 'particles',
      object: points,
      builtFrom: layer.props,
      ready: true,
      planeW: p.area[0],
      planeH: p.area[1]
    }
  }

  private syncNodes(project: Project): void {
    const alive = new Set<string>()
    for (const layer of project.layers) {
      alive.add(layer.id)
      const node = this.nodes.get(layer.id)
      const stale = !node || node.type !== layer.type || node.builtFrom !== layer.props || !node.ready
      if (!stale) continue
      const built =
        layer.type === 'particles' ? this.buildParticles(layer, node) : this.buildPlane(layer, node)
      this.nodes.set(layer.id, built)
    }
    for (const [id, node] of this.nodes) {
      if (!alive.has(id)) {
        this.disposeNode(node)
        this.nodes.delete(id)
      }
    }
  }

  // ---------------------------------------------------------------- render

  private applyLook(look: LookSettings, frame: number): void {
    const u = this.postMat.uniforms
    u.exposure.value = look.exposure
    u.contrast.value = look.contrast
    u.saturation.value = look.saturation
    u.vignette.value = look.vignette
    u.grain.value = look.grain * 0.25
    u.seed.value = (frame % 997) * 0.731
  }

  render(project: Project, t: number, opts: RenderOptions = {}): EvaluatedScene {
    this.syncNodes(project)
    const ev = evaluateScene(project, t)
    this.lastScene = ev
    const { comp, look } = project

    // Camera (depth space → three.js: z flipped).
    const cam = this.camera
    cam.fov = ev.camera.fov
    cam.aspect = comp.width / comp.height
    cam.position.set(ev.camera.position[0], ev.camera.position[1], -ev.camera.position[2])
    cam.up.set(0, 1, 0)
    cam.lookAt(ev.camera.target[0], ev.camera.target[1], -ev.camera.target[2])
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    const pxScale = this.height / (2 * Math.tan((cam.fov * DEG) / 2))
    const camDir = new THREE.Vector3()
    cam.getWorldDirection(camDir)
    const tmp = new THREE.Vector3()

    const ordering: { node: LayerNode; dist: number; index: number; particles: boolean }[] = []

    for (const el of ev.layers) {
      const node = this.nodes.get(el.layer.id)
      if (!node) continue
      const obj = node.object
      obj.visible = el.active && node.ready && el.opacity > 0.001
      if (!obj.visible) continue

      obj.position.set(el.position[0], el.position[1], -el.position[2])
      obj.rotation.set(el.rotation[0] * DEG, -el.rotation[1] * DEG, -el.rotation[2] * DEG, 'YXZ')
      obj.scale.set(el.scale[0] || 1e-4, el.scale[1] || 1e-4, el.scale[2] || 1)
      obj.updateMatrixWorld()

      const mat = obj.material as THREE.ShaderMaterial
      const u = mat.uniforms
      u.opacity.value = el.opacity
      u.dofOn.value = ev.camera.dof ? 1 : 0
      u.focusDistance.value = ev.camera.focusDistance
      u.aperture.value = ev.camera.aperture
      u.fogOn.value = look.fogEnabled ? 1 : 0
      u.fogColor.value.set(look.fogColor)
      u.fogNear.value = look.fogNear
      u.fogFar.value = Math.max(look.fogNear + 1, look.fogFar)

      if (node.type === 'particles') {
        u.time.value = t
        u.pxScale.value = pxScale
        mat.blending = el.layer.blendMode === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending
      } else {
        applyBlend(mat, el.layer.blendMode)
        u.multiplyOut.value = el.layer.blendMode === 'multiply' ? 1 : 0
      }

      tmp.copy(obj.position).sub(cam.position)
      ordering.push({ node, dist: tmp.dot(camDir), index: el.index, particles: node.type === 'particles' })
    }

    // Painter's order: far → near; ties broken by stack order (bottom first). Particles last.
    ordering.sort((a, b) => {
      if (a.particles !== b.particles) return a.particles ? 1 : -1
      if (Math.abs(a.dist - b.dist) > 0.01) return b.dist - a.dist
      return b.index - a.index
    })
    ordering.forEach((o, i) => (o.node.object.renderOrder = i))

    // Selection outline.
    const sel = opts.selectedId ? this.nodes.get(opts.selectedId) : undefined
    if (sel && sel.object.visible) {
      this.outline.visible = true
      this.outline.matrixAutoUpdate = false
      const m = new THREE.Matrix4().makeScale(sel.planeW, sel.planeH, 1)
      this.outline.matrix.copy(sel.object.matrixWorld).multiply(m)
      this.outline.matrixWorldNeedsUpdate = true
    } else {
      this.outline.visible = false
    }

    // Scene → MSAA target → post pass → screen → helpers.
    const r = this.renderer
    r.setRenderTarget(this.rt)
    r.setClearColor(new THREE.Color(comp.background), 1)
    r.clear(true, true, true)
    r.render(this.scene, cam)

    this.applyLook(look, opts.frame ?? Math.round(t * comp.fps))
    r.setRenderTarget(null)
    r.clear(true, true, true)
    r.render(this.postScene, this.postCamera)
    if (this.outline.visible) r.render(this.helperScene, cam)
    return ev
  }

  /** Read back the current frame (RGBA, bottom-up rows). Call right after render(). */
  readPixels(): Uint8Array {
    const gl = this.renderer.getContext()
    const out = new Uint8Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  // ---------------------------------------------------------------- picking

  /** Returns the top-most opaque layer under normalized device coords. */
  pick(ndcX: number, ndcY: number, project: Project): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const candidates: THREE.Object3D[] = []
    const byObj = new Map<THREE.Object3D, LayerNode>()
    for (const layer of project.layers) {
      const node = this.nodes.get(layer.id)
      if (!node || layer.locked || node.type === 'particles' || !node.object.visible) continue
      candidates.push(node.object)
      byObj.set(node.object, node)
    }
    const hits = this.raycaster.intersectObjects(candidates, false)
    // Front-most first by render order (painter's order mirrors visual stacking).
    hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder)
    for (const hit of hits) {
      const node = byObj.get(hit.object)!
      if (!node.alpha || !hit.uv) return node.id
      const { w, h, data } = node.alpha
      const x = Math.min(w - 1, Math.max(0, Math.floor(hit.uv.x * w)))
      const y = Math.min(h - 1, Math.max(0, Math.floor((1 - hit.uv.y) * h)))
      if (data[y * w + x] > 24) return node.id
    }
    return null
  }

  /** Intersect a screen ray with the camera-facing plane at a given depth (depth space). */
  screenToDepthPlane(ndcX: number, ndcY: number, depth: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), depth)
    const out = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, out) ? out : null
  }

  get evaluated(): EvaluatedScene | null {
    return this.lastScene
  }

  dispose(): void {
    for (const node of this.nodes.values()) this.disposeNode(node)
    this.nodes.clear()
    this.rt.dispose()
    this.postMat.dispose()
    this.renderer.dispose()
  }
}

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
