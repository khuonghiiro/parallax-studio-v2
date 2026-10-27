import * as THREE from 'three'
import type { DepthPortalConfig, Layer, LayerVirtualLight } from '@shared/types'
import { evaluate } from '../../../animation/keyframes'
import { makeLayerMaterial } from '../../../engine/layerNodes'
import { makeVolumetricLightMaterial } from '../../../engine/renderTypes'
import { evaluateVirtualLightAtTime } from '../../../engine/virtualLight'
import { createImageLayer, DEFAULT_COMP } from '../../../project/factory'
import type { PadFittedBox } from './VirtualLightInteractivePad'

export interface VirtualLightPadRenderParams {
  imageUrl?: string | null
  sourceLayer?: Layer
  time: number
  vlight: LayerVirtualLight
  isLightEnabled: boolean
  portal: DepthPortalConfig
  isPortalEnabled: boolean
  box: PadFittedBox
  worldW: number
  worldH: number
}

/** Use the camera's evaluator; never inflate the radius or invent preview exposure. */
export function evaluatePadLight(p: VirtualLightPadRenderParams) {
  const source = p.sourceLayer ?? createImageLayer(
    { id: 'light-pad', name: 'Light', kind: 'image', mime: 'image/png', width: p.worldW, height: p.worldH }, DEFAULT_COMP
  )
  const layer = { ...source, virtualLight: { ...p.vlight, enabled: p.isLightEnabled } }
  const scale = evaluate(layer.transform.scale, p.time)
  const rotation = evaluate(layer.transform.rotation, p.time)
  const light = evaluateVirtualLightAtTime(layer, p.time, [0, 0, 0], [p.worldW, p.worldH], scale)
  if (!light) return null
  const angle = -rotation[2] * Math.PI / 180
  const local = (x: number, y: number): [number, number] => [
    x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)
  ]
  const wind = local(...light.windOffset)
  return {
    light,
    radius: light.effectiveRadius / Math.max(0.25, Math.abs(scale[0])),
    uv: [(p.vlight.originUV?.[0] ?? 0.5) + wind[0] / Math.max(32, p.worldW * Math.abs(scale[0])),
      (p.vlight.originUV?.[1] ?? 0.5) + wind[1] / Math.max(32, p.worldH * Math.abs(scale[1]))] as [number, number],
    beam: local(...light.beamDir)
  }
}

/** Both the surface and atmospheric beam use the actual camera materials. */
export function syncPadLightMaterials(
  surface: THREE.ShaderMaterial, beam: THREE.ShaderMaterial, p: VirtualLightPadRenderParams
) {
  const evaluated = evaluatePadLight(p)
  surface.uniforms.vlightOn.value = evaluated ? 1 : 0
  if (!evaluated) return null
  const { light, radius, uv, beam: direction } = evaluated
  surface.uniforms.vlightUv.value.set(...uv)
  for (const material of [surface, beam]) {
    const u = material.uniforms
    u.vlightColor.value.setRGB(...light.rgb)
    u.vlightParams.value.set(light.effectiveIntensity, radius, light.coneCos)
    u.vlightBeam.value.set(...direction)
    u.vlightExtra.value.set(light.ambientDim, light.softness, light.beamCurvature)
  }
  beam.uniforms.quadSpanPx.value = radius * 2.25
  return evaluated
}

class LightPadRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  private geometry = new THREE.PlaneGeometry(1, 1)
  private surface = new THREE.Mesh(this.geometry, makeLayerMaterial())
  private beam = new THREE.Mesh(this.geometry, makeVolumetricLightMaterial())
  private texture: THREE.Texture | null = null
  private url: string | null = null
  private latest: VirtualLightPadRenderParams | null = null
  private disposed = false

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.setClearColor(0, 0)
    this.camera.position.z = 2
    this.surface.material.depthWrite = false
    this.beam.material.depthTest = false
    this.beam.renderOrder = 1
    this.scene.add(this.surface, this.beam)
  }

  private loadImage(url: string | null) {
    if (url === this.url) return
    this.url = url
    this.texture?.dispose()
    this.texture = null
    if (!url) return
    new THREE.TextureLoader().load(url, (texture) => {
      if (this.disposed || this.url !== url) { texture.dispose(); return }
      texture.colorSpace = THREE.NoColorSpace
      this.texture = texture
      if (this.latest) this.render(this.latest)
    }, undefined, () => { /* Keep the original image visible if loading fails. */ })
  }

  render(p: VirtualLightPadRenderParams) {
    this.latest = p
    this.loadImage(p.imageUrl ?? null)
    const { box, worldW: w, worldH: h, portal } = p
    const width = Math.max(1, Math.round(this.canvas.clientWidth * window.devicePixelRatio))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * window.devicePixelRatio))
    this.renderer.setSize(width, height, false)
    const frameW = w / box.wNorm
    const frameH = h / box.hNorm
    this.camera.left = -frameW / 2; this.camera.right = frameW / 2
    this.camera.top = frameH / 2; this.camera.bottom = -frameH / 2
    this.camera.updateProjectionMatrix()
    this.surface.scale.set(w, h, 1)
    this.surface.visible = Boolean(this.texture)
    const u = this.surface.material.uniforms
    u.map.value = this.texture
    const img = this.texture?.image as HTMLImageElement | undefined
    u.texSize.value.set(img?.width ?? 1, img?.height ?? 1)
    u.planeSize.value.set(w, h)
    u.portalOn.value = p.isPortalEnabled ? 1 : 0
    const radius = portal.radiusUV ?? [0.35, 0.35]
    u.portalParams.value.set(...(portal.centerUV ?? [0.5, 0.45]),
      ...(Array.isArray(radius) ? radius : [radius, radius]))
    u.portalShape.value.set((portal.archShape ?? 'arch') === 'arch' ? 1 : 0, portal.feather ?? 0.55)
    u.portalDarkness.value = portal.darkness ?? 0.82
    u.shadeTint.value.set(portal.shadowTint ?? '#060812')
    const evaluated = syncPadLightMaterials(this.surface.material, this.beam.material, p)
    this.beam.visible = Boolean(evaluated)
    if (evaluated) {
      const span = evaluated.radius * 2.25
      this.beam.scale.set(span, span, 1)
      this.beam.position.set((evaluated.uv[0] - 0.5) * w, (evaluated.uv[1] - 0.5) * h, 0.01)
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.texture?.dispose()
    this.surface.material.dispose()
    this.beam.material.dispose()
    this.geometry.dispose()
    this.renderer.dispose()
  }
}

const renderers = new WeakMap<HTMLCanvasElement, LightPadRenderer>()
export function renderVirtualLightPadFrame(canvas: HTMLCanvasElement, params: VirtualLightPadRenderParams) {
  let renderer = renderers.get(canvas)
  if (!renderer) { renderer = new LightPadRenderer(canvas); renderers.set(canvas, renderer) }
  renderer.render(params)
}

export function disposeVirtualLightPad(canvas: HTMLCanvasElement) {
  renderers.get(canvas)?.dispose()
  renderers.delete(canvas)
}
