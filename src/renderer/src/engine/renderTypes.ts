import * as THREE from 'three'
import type { BlendMode, Layer } from '@shared/types'
import { LAYER_FRAG, LAYER_VERT, VOLUMETRIC_LIGHT_FRAG } from './shaders'
import type { EvaluatedCamera, EvaluatedLayer, EvaluatedScene } from './evaluateScene'
import {
  collectEvaluatedVirtualLights,
  evaluateVirtualLightAtTime,
  resolveReceivedVirtualLightForLayer
} from './virtualLight'

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
  text: '#0284c7',
  solid: '#f59e6b',
  particles: '#ffc24b'
}

/** Pose a perspective camera from an evaluated camera (depth space → three.js). */
export function applyEvaluatedCamera(cam: THREE.PerspectiveCamera, ev: EvaluatedCamera, aspect: number): void {
  const refD = Math.max(100, ev.refDistance ?? 1483.6378)
  const dx = ev.position[0] - ev.target[0]
  const dy = ev.position[1] - ev.target[1]
  const dz = ev.position[2] - ev.target[2]
  const rawDist = Math.hypot(dx, dy, dz)
  const scale = rawDist > 1e-3 ? rawDist / refD : 1
  const r = rawDist > 1e-3 ? refD / rawDist : 1

  const halfFovRad = Math.atan(Math.tan((ev.fov * Math.PI) / 360) * scale)
  cam.fov = Math.max(0.5, Math.min(150, (halfFovRad * 360) / Math.PI))
  cam.aspect = aspect
  cam.position.set(
    ev.target[0] + dx * r,
    ev.target[1] + dy * r,
    -(ev.target[2] + dz * r)
  )
  cam.up.set(0, 1, 0)
  cam.lookAt(ev.target[0], ev.target[1], -ev.target[2])
  if (ev.roll && Math.abs(ev.roll) > 0.01) {
    cam.rotateZ((-ev.roll * Math.PI) / 180)
  }
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

/** Đồng bộ các uniform Cổng Độ Sâu Hang Động & Ánh Sáng Ảo 2.5D cho mỗi layer plane. */
export function syncLayerCaveAndLightUniforms(
  u: Record<string, THREE.IUniform>,
  el: EvaluatedLayer,
  planeW: number,
  planeH: number,
  ev: EvaluatedScene
): boolean {
  u.shadeDarkness.value = el.caveDarkness ?? 0
  if (el.shadowTintRgb) {
    u.shadeTint.value.setRGB(el.shadowTintRgb[0], el.shadowTintRgb[1], el.shadowTintRgb[2])
  } else {
    u.shadeTint.value.set('#060812')
  }
  u.lightBoost.value = el.lightIllumination ?? 0
  if (el.lightTintRgb) {
    u.lightTint.value.setRGB(el.lightTintRgb[0], el.lightTintRgb[1], el.lightTintRgb[2])
  }

  const portal = el.layer.physics?.depthPortal
  if (portal?.enabled) {
    u.portalOn.value = 1
    const rxUV = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)
    const ryUV = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)
    u.portalParams.value.set(
      portal.centerUV?.[0] ?? 0.5,
      portal.centerUV?.[1] ?? 0.45,
      Math.max(0.05, rxUV),
      Math.max(0.05, ryUV)
    )
    if (u.portalShape) {
      u.portalShape.value.set(
        (portal.archShape ?? 'arch') === 'arch' ? 1 : 0,
        portal.feather ?? 0.55
      )
    }
    u.portalDarkness.value = portal.darkness ?? 0.82
    if (portal.shadowTint) u.shadeTint.value.set(portal.shadowTint)
  } else {
    u.portalOn.value = 0
    u.portalDarkness.value = 0
  }

  const worldW = Math.max(32, planeW * Math.abs(el.scale[0]))
  const worldH = Math.max(32, planeH * Math.abs(el.scale[1]))
  const evVLight = evaluateVirtualLightAtTime(el.layer, ev.t, el.position, [planeW, planeH], el.scale)

  if (evVLight) {
    u.vlightOn.value = 1
    const origU = el.layer.virtualLight?.originUV?.[0] ?? 0.5
    const origV = el.layer.virtualLight?.originUV?.[1] ?? 0.5
    const rotRad = ((-el.rotation[2] || 0) * Math.PI) / 180
    const cosR = Math.cos(rotRad)
    const sinR = Math.sin(rotRad)
    const localWindX = evVLight.windOffset[0] * cosR - evVLight.windOffset[1] * sinR
    const localWindY = evVLight.windOffset[0] * sinR + evVLight.windOffset[1] * cosR
    const shiftU = localWindX / worldW
    const shiftV = localWindY / worldH
    u.vlightUv.value.set(
      Math.max(-0.5, Math.min(1.5, origU + shiftU)),
      Math.max(-0.5, Math.min(1.5, origV + shiftV))
    )
    u.vlightColor.value.set(evVLight.color)
    u.vlightParams.value.set(
      evVLight.effectiveIntensity,
      evVLight.effectiveRadius / Math.max(0.25, Math.abs(el.scale[0])),
      evVLight.coneCos
    )
    const localBeamX = evVLight.beamDir[0] * cosR - evVLight.beamDir[1] * sinR
    const localBeamY = evVLight.beamDir[0] * sinR + evVLight.beamDir[1] * cosR
    u.vlightBeam.value.set(localBeamX, localBeamY)
    if (u.vlightExtra) {
      u.vlightExtra.value.set(evVLight.ambientDim, evVLight.softness, evVLight.beamCurvature)
    }
    return true
  }

  const shotLights = collectEvaluatedVirtualLights(ev.layers, el.layer.shotId ?? null, ev.t)
  const received = resolveReceivedVirtualLightForLayer(
    el.layer.id,
    el.position,
    worldW,
    worldH,
    el.rotation[2] || 0,
    shotLights,
    ev.camera.refDistance ?? 1483.6378
  )
  if (received) {
    u.vlightOn.value = 2
    u.vlightUv.value.set(received.relU, received.relV)
    u.vlightColor.value.set(received.light.color)
    u.vlightParams.value.set(
      received.effectiveIntensity,
      received.projectedRadiusPx / Math.max(0.25, Math.abs(el.scale[0])),
      received.light.coneCos
    )
    u.vlightBeam.value.set(received.localBeamDir[0], received.localBeamDir[1])
    if (u.vlightExtra) {
      u.vlightExtra.value.set(
        received.light.ambientDim,
        received.light.softness,
        received.light.beamCurvature
      )
    }
  } else {
    u.vlightOn.value = 0
  }
  return false
}

function makeVolumetricLightMaterial(): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    vertexShader: LAYER_VERT,
    fragmentShader: VOLUMETRIC_LIGHT_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcColorFactor,
    uniforms: {
      uvRepeat: { value: new THREE.Vector2(1, 1) },
      uvOffset: { value: new THREE.Vector2(0, 0) },
      vlightColor: { value: new THREE.Color('#ffe6a3') },
      vlightParams: { value: new THREE.Vector3(1, 500, -1) },
      vlightBeam: { value: new THREE.Vector2(1, 0) },
      vlightExtra: { value: new THREE.Vector3(0.25, 0.45, 0.25) },
      quadSpanPx: { value: 1200 }
    }
  })
  return mat
}

const _beamLocalMat = new THREE.Matrix4()
const _beamScaleMat = new THREE.Matrix4()

/**
 * Tạo và cập nhật các mặt phẳng luồng sáng khí quyển (Volumetric Light Beams) độc lập hoàn toàn với kích thước layer nguồn:
 * Khi gắn đèn pin vào một layer nhỏ (như Cột điện), luồng sáng vẫn vươn dài đủ bán kính `effectiveRadius`
 * xuyên qua không gian cảnh và truyền xuống mọi layer bên dưới.
 */
export function syncShotVolumetricLightBeams(
  scene: THREE.Scene,
  beamMeshes: Map<string, THREE.Mesh>,
  ev: EvaluatedScene,
  baseRenderOrder: number
): void {
  const activeIds = new Set<string>()
  const refD = Math.max(200, ev.camera.refDistance ?? 1483.6378)
  let orderOffset = 0

  for (const el of ev.layers) {
    if (!el.active || !el.layer.visible) continue
    if (!el.layer.virtualLight?.enabled || el.layer.virtualLight.kind === 'none') continue
    const evLight = evaluateVirtualLightAtTime(el.layer, ev.t, el.position, el.size, el.scale)
    if (!evLight || evLight.effectiveIntensity <= 0.01) continue

    activeIds.add(el.layer.id)
    let mesh = beamMeshes.get(el.layer.id)
    if (!mesh) {
      mesh = new THREE.Mesh(UNIT_PLANE, makeVolumetricLightMaterial())
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      scene.add(mesh)
      beamMeshes.set(el.layer.id, mesh)
    }

    const perspK = el.layer.autoScale ? Math.max(0.2, (refD + evLight.position[2]) / refD) : 1
    const worldRad = evLight.effectiveRadius * perspK
    const spanPx = evLight.effectiveRadius * 2.25
    const spanWorld = worldRad * 2.25

    _beamLocalMat.makeTranslation(evLight.position[0], evLight.position[1], -(evLight.position[2] - 0.5))
    _beamScaleMat.makeScale(spanWorld, spanWorld, 1)
    _beamLocalMat.multiply(_beamScaleMat)

    if (el.shot) {
      mesh.matrix.multiplyMatrices(el.shot.matrix, _beamLocalMat)
    } else {
      mesh.matrix.copy(_beamLocalMat)
    }
    mesh.updateMatrixWorld(true)
    mesh.visible = true
    mesh.renderOrder = baseRenderOrder + orderOffset++

    const mat = mesh.material as THREE.ShaderMaterial
    const u = mat.uniforms
    u.vlightColor.value.set(evLight.color)
    u.vlightParams.value.set(evLight.effectiveIntensity, evLight.effectiveRadius, evLight.coneCos)
    u.vlightBeam.value.set(evLight.beamDir[0], evLight.beamDir[1])
    u.vlightExtra.value.set(evLight.ambientDim, evLight.softness, evLight.beamCurvature)
    u.quadSpanPx.value = spanPx
  }

  for (const [id, mesh] of beamMeshes) {
    if (!activeIds.has(id)) {
      mesh.visible = false
    }
  }
}
