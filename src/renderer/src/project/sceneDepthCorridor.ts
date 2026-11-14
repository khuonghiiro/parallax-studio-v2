import type { Composition, DepthPortalConfig, ImageLayer, Project, Vec3 } from '@shared/types'
import { clamp, referenceDistance } from '../animation/math'
import { layerNominalSize } from '../engine/spatial'

export interface CorridorSpineSample {
  /** 0 = near foreground entrance, 1 = deep vanishing throat */
  depthRatio: number
  uv: [number, number]
  screenXY: [number, number]
  halfWidthPx: number
  recommendedZ: number
  apparentScaleRatio: number
}

export interface SceneDepthAnalysis {
  shotId: string | null
  layerId: string | null
  imageSize: [number, number]
  corridorType: 'receding_alley' | 'open_courtyard' | 'elevated_arena'
  horizonUVY: number
  horizonScreenY: number
  vanishingPointUV: [number, number]
  vanishingPointScreen: [number, number]
  walkableNearUVY: number
  walkableFarUVY: number
  widthNarrowingRatio: number
  recommendedZPlanes: {
    skyFarZ: number
    archMidZ: number
    corridorFarZ: number
    corridorNearZ: number
    occluderFgZ: number
  }
  recommendedDepthPortal: DepthPortalConfig
  corridorSpine: CorridorSpineSample[]
}

export interface CorridorWorldSample {
  x: number
  y: number
  z: number
  scaleRatio: number
  apparentScale: number
  screenFootXY: [number, number]
}

const r2 = (v: number): number => Math.round(v * 100) / 100
const r3 = (v: number): number => Math.round(v * 1000) / 1000

/**
 * Inverse PerspectiveCamera mapping: places an `autoScale: false` layer or composite cluster
 * at real 3D depth `worldZ` such that its rendered apparent scale equals `apparentScale`
 * AND its feet (`rootY - footOffsetY * apparentScale`) land on `(screenX, screenFootY)` in camera view.
 */
export function projectCorridorFootToWorld(
  comp: Pick<Composition, 'width' | 'height'>,
  screenX: number,
  screenFootY: number,
  worldZ: number,
  apparentScale: number,
  footOffsetY = 0
): CorridorWorldSample {
  const refDist = referenceDistance(comp)
  const safeDepth = Math.max(80, worldZ + refDist)
  const perspProj = refDist / safeDepth
  const worldScaleRatio = Math.max(0.08, Math.min(4.5, apparentScale / perspProj))
  const screenRootY = screenFootY + footOffsetY * apparentScale
  const invProj = safeDepth / refDist
  return {
    x: r2(screenX * invProj),
    y: r2(screenRootY * invProj),
    z: r2(worldZ),
    scaleRatio: r3(worldScaleRatio),
    apparentScale: r3(apparentScale),
    screenFootXY: [r2(screenX), r2(screenFootY)]
  }
}

/**
 * Hyperbolic 1/(Z + d) screen progress for constant 3D ground walking velocity.
 * When moving from far depth `startZ` to near depth `targetZ`, equal steps in real 3D `Z(u)`
 * project to slower pixel growth far away and accelerating pixel growth near the camera.
 */
export function hyperbolicDepthScreenProgress(
  u: number,
  startZ: number,
  targetZ: number,
  comp: Pick<Composition, 'height'>
): number {
  const t = clamp(u, 0, 1)
  if (Math.abs(targetZ - startZ) < 12) return t
  const d = referenceDistance(comp)
  const zCur = startZ + (targetZ - startZ) * t
  const inv0 = 1 / Math.max(80, startZ + d)
  const inv1 = 1 / Math.max(80, targetZ + d)
  const invCur = 1 / Math.max(80, zCur + d)
  const denom = inv1 - inv0
  if (Math.abs(denom) < 1e-6) return t
  return clamp((invCur - inv0) / denom, 0, 1)
}

function samplePolylineAt(points: [number, number][], s: number): [number, number] {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return points[0]
  const clamped = clamp(s, 0, 1)
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    lens.push(seg)
    total += seg
  }
  if (total < 1e-4) return points[points.length - 1]
  const target = clamped * total
  let acc = 0
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= target || i === lens.length - 1) {
      const k = lens[i] > 1e-5 ? (target - acc) / lens[i] : 0
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * k,
        points[i][1] + (points[i + 1][1] - points[i][1]) * k
      ]
    }
    acc += lens[i]
  }
  return points[points.length - 1]
}

export interface CorridorTrajectoryInput {
  comp: Pick<Composition, 'width' | 'height'>
  startPos: Vec3
  targetX: number
  targetY: number
  startZ: number
  targetZ: number
  baseWorldScale: number
  targetScaleRatio: number
  u: number
  corridorWaypoints?: [number, number][]
  footOffsetY?: number
}

/**
 * Evaluates a perspective-accurate 3D corridor pose at normalized time `u in [0..1]`.
 * Preserves exact boundary poses at `u=0` (`startPos`, `scaleRatio=1`) and `u=1` (`targetX, targetY, targetZ, targetScaleRatio`),
 * while following hyperbolic `1/(Z+d)` foreshortening and optional S-curved corridor waypoints in between.
 */
export function evaluatePerspectiveCorridorAt(input: CorridorTrajectoryInput): {
  x: number
  y: number
  z: number
  scaleRatio: number
} {
  const { comp, startPos, targetX, targetY, startZ, targetZ, targetScaleRatio } = input
  const t = clamp(input.u, 0, 1)
  const d = referenceDistance(comp)
  const z = startZ + (targetZ - startZ) * t
  const sigma = hyperbolicDepthScreenProgress(t, startZ, targetZ, comp)

  const p0 = d / Math.max(80, startZ + d)
  const p1 = d / Math.max(80, targetZ + d)
  const pCur = d / Math.max(80, z + d)

  const app0 = p0
  const app1 = targetScaleRatio * p1
  const appCur = app0 + (app1 - app0) * sigma
  const scaleRatio = Math.max(0.12, Math.min(4.5, appCur / pCur))

  const footOff = (input.footOffsetY ?? 0) * Math.max(0.1, input.baseWorldScale)
  const screenStartRootX = startPos[0] * p0
  const screenStartRootY = startPos[1] * p0
  const screenEndRootX = targetX * p1
  const screenEndRootY = targetY * p1

  let screenRootX: number
  let screenRootY: number
  const wp = input.corridorWaypoints
  if (wp && wp.length >= 2) {
    const startFoot: [number, number] = [screenStartRootX, screenStartRootY - footOff * app0]
    const endFoot: [number, number] = [screenEndRootX, screenEndRootY - footOff * app1]
    const fullFootPath: [number, number][] = [startFoot, ...wp.slice(1, -1), endFoot]
    const curFoot = samplePolylineAt(fullFootPath, sigma)
    screenRootX = curFoot[0]
    screenRootY = curFoot[1] + footOff * appCur
  } else {
    screenRootX = screenStartRootX + (screenEndRootX - screenStartRootX) * sigma
    const startFootY = screenStartRootY - footOff * app0
    const endFootY = screenEndRootY - footOff * app1
    const curFootY = startFootY + (endFootY - startFootY) * sigma
    screenRootY = curFootY + footOff * appCur
  }

  return {
    x: r2(screenRootX / pCur),
    y: r2(screenRootY / pCur),
    z: r2(z),
    scaleRatio: r3(scaleRatio)
  }
}

function computeLuminanceGrid(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const lum = new Float32Array(w * h)
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255
  }
  return lum
}

function estimateHorizonAndVanishingUV(lum: Float32Array, w: number, h: number): [number, number] {
  const yMin = Math.max(2, Math.floor(h * 0.28))
  const yMax = Math.min(h - 3, Math.floor(h * 0.62))
  let bestHorizonY = Math.floor(h * 0.46)
  let bestHorizonScore = -1

  for (let y = yMin; y <= yMax; y++) {
    let vertGradSum = 0
    for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
      vertGradSum += Math.abs(lum[(y + 1) * w + x] - lum[(y - 1) * w + x])
    }
    const centerBias = 1 - Math.abs(y / h - 0.45) * 0.65
    const score = vertGradSum * centerBias
    if (score > bestHorizonScore) {
      bestHorizonScore = score
      bestHorizonY = y
    }
  }

  const bins = 40
  const votes = new Float32Array(bins)
  for (let y = Math.max(2, bestHorizonY + 2); y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const gx = lum[y * w + (x + 1)] - lum[y * w + (x - 1)]
      const gy = lum[(y + 1) * w + x] - lum[(y - 1) * w + x]
      const mag = Math.hypot(gx, gy)
      if (mag < 0.06) continue
      // Edge tangent vector is (-gy, gx); intersect line with y = bestHorizonY
      const tx = -gy
      const ty = gx
      const absSlope = Math.abs(ty / (Math.abs(tx) + 1e-4))
      if (absSlope < 0.28 || absSlope > 3.6) continue
      const hitX = x + ((bestHorizonY - y) * tx) / ty
      if (hitX >= w * 0.12 && hitX <= w * 0.88) {
        const bin = clamp(Math.floor((hitX / w) * bins), 0, bins - 1)
        votes[bin] += mag
      }
    }
  }

  let bestBin = Math.floor(bins / 2)
  let bestVote = -1
  for (let b = 0; b < bins; b++) {
    const smooth = (votes[Math.max(0, b - 1)] + votes[b] * 2 + votes[Math.min(bins - 1, b + 1)]) * 0.25
    if (smooth > bestVote) {
      bestVote = smooth
      bestBin = b
    }
  }
  return [r3((bestBin + 0.5) / bins), r3(bestHorizonY / h)]
}

function traceWalkableCorridorSpine(
  lum: Float32Array,
  w: number,
  h: number,
  vanishingUV: [number, number],
  comp: Pick<Composition, 'width' | 'height'>
): { spine: CorridorSpineSample[]; narrowingRatio: number } {
  const nearUVY = 0.9
  const farUVY = clamp(vanishingUV[1] + 0.03, 0.36, 0.66)
  const steps = 6
  const rawCenters: number[] = []
  const rawHalfWidths: number[] = []

  let prevCenterUVX = 0.5
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const uvY = nearUVY + (farUVY - nearUVY) * ratio
    const row = clamp(Math.round(uvY * (h - 1)), 1, h - 2)
    const expectedX = 0.5 * (1 - ratio) + vanishingUV[0] * ratio
    const searchRadius = Math.max(0.1, 0.36 * (1 - ratio * 0.62))

    let weightedX = 0
    let weightSum = 0
    for (let x = 1; x < w - 1; x++) {
      const uvX = x / w
      if (Math.abs(uvX - expectedX) > searchRadius) continue
      const val = lum[row * w + x]
      const smoothness = 1 - Math.min(1, Math.abs(lum[row * w + (x + 1)] - lum[row * w + (x - 1)]) * 3)
      const contBias = Math.exp(-Math.pow((uvX - prevCenterUVX) / 0.24, 2))
      const wgt = (0.25 + val * 0.75) * (0.4 + smoothness * 0.6) * contBias
      weightedX += uvX * wgt
      weightSum += wgt
    }
    const centerUVX = weightSum > 1e-4 ? weightedX / weightSum : expectedX
    prevCenterUVX = centerUVX
    rawCenters.push(centerUVX)

    const cx = clamp(Math.round(centerUVX * (w - 1)), 2, w - 3)
    const centerLum = lum[row * w + cx]
    const maxSpanPx = Math.max(3, Math.round(w * (0.42 * (1 - ratio * 0.78) + 0.05)))
    let leftPx = cx
    let rightPx = cx
    for (let dx = 1; dx <= maxSpanPx && cx - dx >= 1; dx++) {
      const edge = Math.abs(lum[row * w + (cx - dx)] - lum[row * w + (cx - dx + 1)])
      if (edge > 0.14 || Math.abs(lum[row * w + (cx - dx)] - centerLum) > 0.26) break
      leftPx = cx - dx
    }
    for (let dx = 1; dx <= maxSpanPx && cx + dx < w - 1; dx++) {
      const edge = Math.abs(lum[row * w + (cx + dx)] - lum[row * w + (cx + dx - 1)])
      if (edge > 0.14 || Math.abs(lum[row * w + (cx + dx)] - centerLum) > 0.26) break
      rightPx = cx + dx
    }
    const measuredHalfUV = clamp(((rightPx - leftPx) * 0.5) / w, 0.035, 0.44)
    const geometricHalfUV = 0.36 * (1 - ratio * 0.8) + 0.04
    rawHalfWidths.push(measuredHalfUV * 0.55 + geometricHalfUV * 0.45)
  }

  const nearHalf = Math.max(0.08, rawHalfWidths[0])
  const farHalf = Math.max(0.03, Math.min(nearHalf * 0.85, rawHalfWidths[steps]))
  const narrowingRatio = r2(nearHalf / farHalf)
  const nearZ = 110
  const farZ = Math.round(clamp(220 + (narrowingRatio - 1) * 280, 480, 1180))

  const spine: CorridorSpineSample[] = rawCenters.map((uvX, idx) => {
    const ratio = idx / steps
    const uvY = nearUVY + (farUVY - nearUVY) * ratio
    const monotonicHalf = nearHalf + (farHalf - nearHalf) * Math.pow(ratio, 0.88)
    const screenX = r2((uvX - 0.5) * comp.width)
    const screenY = r2((0.5 - uvY) * comp.height)
    const recZ = Math.round(nearZ + (farZ - nearZ) * ratio)
    return {
      depthRatio: r2(ratio),
      uv: [r3(uvX), r3(uvY)],
      screenXY: [screenX, screenY],
      halfWidthPx: Math.round(monotonicHalf * comp.width),
      recommendedZ: recZ,
      apparentScaleRatio: r3(monotonicHalf / nearHalf)
    }
  })

  return { spine, narrowingRatio }
}

/** Pure pixel-buffer analyzer — deterministic and directly unit-testable without DOM. */
export function analyzeImageDepthCorridorFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  comp: Pick<Composition, 'width' | 'height'> = { width: 1920, height: 1080 },
  meta: { shotId?: string | null; layerId?: string | null } = {}
): SceneDepthAnalysis {
  const lum = computeLuminanceGrid(rgba, width, height)
  const vanishingUV = estimateHorizonAndVanishingUV(lum, width, height)
  const { spine, narrowingRatio } = traceWalkableCorridorSpine(lum, width, height, vanishingUV, comp)

  const corridorType: SceneDepthAnalysis['corridorType'] =
    narrowingRatio >= 2.6 ? 'receding_alley' : narrowingRatio >= 1.75 ? 'open_courtyard' : 'elevated_arena'
  const farSample = spine[spine.length - 1]
  const nearSample = spine[0]

  return {
    shotId: meta.shotId ?? null,
    layerId: meta.layerId ?? null,
    imageSize: [width, height],
    corridorType,
    horizonUVY: vanishingUV[1],
    horizonScreenY: r2((0.5 - vanishingUV[1]) * comp.height),
    vanishingPointUV: vanishingUV,
    vanishingPointScreen: [
      r2((vanishingUV[0] - 0.5) * comp.width),
      r2((0.5 - vanishingUV[1]) * comp.height)
    ],
    walkableNearUVY: nearSample.uv[1],
    walkableFarUVY: farSample.uv[1],
    widthNarrowingRatio: narrowingRatio,
    recommendedZPlanes: {
      skyFarZ: 2400,
      archMidZ: Math.round((nearSample.recommendedZ + farSample.recommendedZ) * 0.52),
      corridorFarZ: farSample.recommendedZ,
      corridorNearZ: nearSample.recommendedZ,
      occluderFgZ: -220
    },
    recommendedDepthPortal: {
      enabled: corridorType === 'receding_alley',
      centerUV: [farSample.uv[0], clamp(farSample.uv[1] - 0.02, 0.25, 0.7)],
      radiusUV: [0.22, 0.26],
      minScale: clamp(r2(1 / Math.max(1.4, narrowingRatio)), 0.26, 0.65),
      darkness: 0.46,
      shadowTint: '#0b1626',
      depthPullZ: 120,
      archShape: 'arch',
      feather: 0.62
    },
    corridorSpine: spine
  }
}

async function decodeImageRgbaInDom(srcUrl: string, targetW = 160, targetH = 90): Promise<Uint8ClampedArray | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, targetW, targetH)
        resolve(ctx.getImageData(0, 0, targetW, targetH).data)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = srcUrl
  })
}

/** Analyzes the deepest background ImageLayer of a shot (or explicit `layerId`) in Electron/Node. */
export async function analyzeShotDepthCorridor(
  project: Project,
  shotId?: string | null,
  layerId?: string | null
): Promise<SceneDepthAnalysis> {
  const candidates = project.layers.filter(
    (l): l is ImageLayer =>
      l.type === 'image' &&
      l.visible !== false &&
      (!layerId || l.id === layerId) &&
      (!shotId || l.shotId === shotId)
  )
  const bgLayer =
    (layerId ? candidates.find((l) => l.id === layerId) : undefined) ??
    [...candidates].sort((a, b) => (b.transform.position.value[2] ?? 0) - (a.transform.position.value[2] ?? 0))[0]

  const asset = bgLayer ? project.assets.find((a) => a.id === bgLayer.props.assetId) : undefined
  const srcCandidates = [asset?.dataUrl, asset?.path, asset?.assetPath ? `assets/${asset.assetPath}` : undefined].filter(
    (s): s is string => Boolean(s)
  )

  for (const src of srcCandidates) {
    const rgba = await decodeImageRgbaInDom(src, 160, 90)
    if (rgba) {
      return analyzeImageDepthCorridorFromRgba(rgba, 160, 90, project.comp, {
        shotId: bgLayer?.shotId ?? shotId ?? null,
        layerId: bgLayer?.id ?? null
      })
    }
  }

  // Deterministic geometric synthesis when running in headless Node without DOM canvas
  const [nomW, nomH] = bgLayer ? layerNominalSize(bgLayer) : [project.comp.width, project.comp.height]
  const portal = bgLayer?.physics?.depthPortal
  const vx = portal?.centerUV?.[0] ?? 0.48
  const vy = portal?.centerUV?.[1] ?? 0.45
  const synthW = 80
  const synthH = 45
  const synth = new Uint8Array(synthW * synthH * 4)
  for (let y = 0; y < synthH; y++) {
    const uvY = y / synthH
    const ratio = clamp((0.92 - uvY) / Math.max(0.15, 0.92 - vy), 0, 1)
    const center = 0.5 * (1 - ratio) + vx * ratio
    const halfW = 0.34 * (1 - ratio * 0.78) + 0.04
    for (let x = 0; x < synthW; x++) {
      const uvX = x / synthW
      const inSky = uvY < vy
      const inAlley = !inSky && Math.abs(uvX - center) <= halfW
      const v = inSky ? 95 : inAlley ? 175 : 42
      const idx = (y * synthW + x) * 4
      synth[idx] = v
      synth[idx + 1] = v
      synth[idx + 2] = v
      synth[idx + 3] = 255
    }
  }
  const res = analyzeImageDepthCorridorFromRgba(synth, synthW, synthH, project.comp, {
    shotId: bgLayer?.shotId ?? shotId ?? null,
    layerId: bgLayer?.id ?? null
  })
  res.imageSize = [nomW, nomH]
  return res
}
