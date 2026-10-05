import * as THREE from 'three'
import type { LookSettings, Project } from '@shared/types'
import { assetStore } from '../project/assets'
import { evaluateScene, type EvaluatedScene } from './evaluateScene'
import { EditorHelpers, type HelperLayerInfo, type ScreenLabel } from './editorHelpers'
import { COPY_FRAG, POST_FRAG, POST_VERT } from './shaders'
import { DEG } from './spatial'
import {
  applyBlend,
  applyEvaluatedCamera,
  CULL_FOV_SCALE,
  EDITOR_MIN_LEVEL,
  LOOKAHEAD,
  TYPE_COLORS,
  UNIT_PLANE,
  type EditorRenderOptions,
  type Rect,
  type RenderOptions,
  type ResidencyStats
} from './renderTypes'
import { buildParticles, buildPlaneNode, disposeNode, type LayerNode } from './layerNodes'
import { TexturePool } from './TexturePool'

export type { Rect, RenderOptions, EditorRenderOptions, ResidencyStats }
export { applyEvaluatedCamera }

// Composite in display space (like AE's default, non-linear workflow).
THREE.ColorManagement.enabled = false

const _v3 = new THREE.Vector3()
const _v4 = new THREE.Vector3()
const _v5 = new THREE.Vector3()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _frustum = new THREE.Frustum()

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

  // residency & pool
  private pool: TexturePool
  private isExport = false
  private isPlaying = false
  private lastStats = { visibleLayers: 0, totalLayers: 0, visibleShots: 0, totalShots: 0 }

  get budgetMB(): number {
    return this.pool.budgetMB
  }

  set budgetMB(val: number) {
    this.pool.budgetMB = val
  }

  get onInvalidate(): () => void {
    return this.pool.onInvalidate
  }

  set onInvalidate(fn: () => void) {
    this.pool.onInvalidate = fn
  }

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

    this.pool = new TexturePool(
      opts.budgetMB ?? 1024,
      this.renderer.capabilities.maxTextureSize,
      this.renderer.capabilities.getMaxAnisotropy()
    )
    this.pool.onDropTexture = (key: string) => {
      for (const n of this.nodes.values()) {
        if (n.texKey === key) {
          const u = (n.object.material as THREE.ShaderMaterial).uniforms
          if (u.map) u.map.value = null
        }
      }
    }

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
      this.pool.dropAllTextures()
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

  private syncNodes(project: Project): void {
    const alive = new Set<string>()
    for (const layer of project.layers) {
      alive.add(layer.id)
      let node = this.nodes.get(layer.id)
      const rebuild = !node || node.type !== layer.type || (layer.type === 'particles' && node.builtFrom !== layer.props)
      if (rebuild) {
        if (node) disposeNode(node, this.scene, (k) => this.pool.dropTexture(k))
        node = layer.type === 'particles' ? buildParticles(layer as any, this.scene) : buildPlaneNode(layer, this.scene)
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
          this.pool.dropTexture(node.texKey)
          node.builtFrom = layer.props
        }
      }
    }
    for (const [id, node] of this.nodes) {
      if (!alive.has(id)) {
        disposeNode(node, this.scene, (k) => this.pool.dropTexture(k))
        this.nodes.delete(id)
      }
    }
  }

  stats(): ResidencyStats {
    return this.pool.stats(this.lastStats)
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
        const level = this.pool.desiredLevel(el, node.planeW, node.planeH, cam, viewportH, mode.editor ? EDITOR_MIN_LEVEL : 0)
        const entry = this.pool.acquireTexture(el, node, level, ev.t, this.isExport, this.isPlaying)
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
    this.pool.advanceTick()
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
    this.pool.evict()
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
    const editorBg = opts.theme === 'light' ? '#e2e5eb' : '#0c0e14'
    r.setClearColor(new THREE.Color(editorBg), 1)
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
    this.pool.evict()
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
        const level = this.pool.desiredLevel(el, node.planeW, node.planeH, cam, viewportH, 0)
        const e = this.pool.get(node.texKey!)
        if (e) this.pool.touch(node.texKey!)
        if (!e || e.level > level) void this.pool.requestDecode(el.layer.props.assetId, level)
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
      const level = this.pool.desiredLevel(el, node.planeW, node.planeH, cam, viewportH, 0)
      const e = this.pool.get(node.texKey!)
      if (e) this.pool.touch(node.texKey!)
      if (!e || e.level > level) waits.push(this.pool.requestDecode(el.layer.props.assetId, level))
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
    this.pool.disposed = true
    for (const node of this.nodes.values()) disposeNode(node, this.scene, (k) => this.pool.dropTexture(k))
    this.nodes.clear()
    this.pool.dropAllTextures()
    this.helpers?.dispose()
    this.rt.dispose()
    this.editorRt.dispose()
    this.postMat.dispose()
    this.copyMat.dispose()
    this.renderer.dispose()
  }
}
