import * as THREE from 'three'
import type { BlendMode, Layer } from '@shared/types'
import { LAYER_FRAG } from './shaders'
import type { EvaluatedCamera } from './evaluateScene'

/** Device-pixel rectangle, top-left origin. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface AlphaMask {
  w: number
  h: number
  data: Uint8ClampedArray
}

export interface TexEntry {
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
  /** Active UI color theme. */
  theme?: 'dark' | 'light'
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

export const MAX_LEVEL = 6
export const LOOKAHEAD = [0.4, 0.9, 1.5]
export const EDITOR_MIN_LEVEL = 2
export const CULL_FOV_SCALE = 1.2

export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)

export function sharedUniforms() {
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

export function applyBlend(mat: THREE.ShaderMaterial, mode: BlendMode): void {
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

export const LAYER_COMPOSE_FRAG = LAYER_FRAG.replace(
  'gl_FragColor = vec4(rgb, c.a * opacity);',
  'float aa = c.a * opacity; gl_FragColor = multiplyOut > 0.5 ? vec4(mix(vec3(1.0), rgb, aa), 1.0) : screenOut > 0.5 ? vec4(rgb * aa, aa) : vec4(rgb, aa);'
).replace('uniform float opacity;', 'uniform float opacity;\nuniform float multiplyOut;\nuniform float screenOut;')

export const TYPE_COLORS: Record<Layer['type'], string> = {
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

export function canvasAlpha(canvas: HTMLCanvasElement): AlphaMask {
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
