import type { Layer, Project, Vec3, VirtualLightKind } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { layerNominalSize } from './spatial'
import {
  computePhysicalRayStriation,
  evaluateLightTimeEnvelope,
  evaluatePhysicalSourceDynamics,
  getDefaultOpticalProfile,
  shiftLightColorByThermalState
} from './virtualLightPhysics'
import {
  CAVE_PORTAL_PRESETS,
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS,
  WIND_STRENGTH_VALUES,
  type CavePortalPreset,
  type VirtualLightPreset
} from './virtualLightPresets'

export {
  CAVE_PORTAL_PRESETS,
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS,
  WIND_STRENGTH_VALUES,
  type CavePortalPreset,
  type VirtualLightPreset
}

export interface EvaluatedVirtualLight {
  sourceLayerId: string
  shotId: string | null
  kind: VirtualLightKind
  /** Tọa độ tâm phát sáng trong không gian Shot [x, y, z] (đã cộng độ lệch bạt gió nếu là nến/lửa) */
  position: Vec3
  color: string
  rgb: [number, number, number]
  /** Cường độ sáng thực tế tại thời điểm t (đã tính nhấp nháy do gió / sụt áp / nhịp thở & khoảng thời gian) */
  effectiveIntensity: number
  /** Bán kính chiếu sáng thực tế tại thời điểm t */
  effectiveRadius: number
  /** Vector hướng chiếu (cho đèn nón) hoặc hướng tạt luồng lửa có độ lớn = plumeStretch (cho nguồn tỏa tròn) */
  beamDir: [number, number]
  /** cos(halfConeAngle): -1 nếu tỏa tròn 360°, > -0.98 nếu là chùm sáng hình nón định hướng */
  coneCos: number
  zReach: number
  /** Tầm chiếu chiều sâu Z tối đa về phía trước (tiền cảnh, z < z_light) */
  zReachFront: number
  /** Tầm chiếu chiều sâu Z tối đa về phía sau (hậu cảnh, z > z_light) */
  zReachBack: number
  /** Độ nghiêng/bạt ngọn sáng do gió [offsetX, offsetY] (px) */
  windOffset: [number, number]
  /** Độ dìm tối môi trường ngoài vùng sáng (0..0.85) tạo tương phản vật lý */
  ambientDim: number
  /** Độ mềm vùng bán dạ (0.1..1.0) */
  softness: number
  /** Độ cong khung sáng (-0.8..1.0) */
  beamCurvature: number
  /** Độ kéo giãn bất đối xứng quầng sáng xuôi chiều gió / đối lưu (0..0.72) */
  plumeStretch: number
  /** Cường độ tỉa tia sáng khí quyển Tyndall (0..1) */
  rayIntensity: number
  /** Toggle bật/tắt tia sáng xuất hiện ngẫu nhiên & động theo gió / nhịp (mặc định true) */
  rayDynamic: boolean
  /** Số lượng luồng tia tỉa ra môi trường (3..24) */
  rayCount: number
  /** Độ hội tụ lõi chóa đèn Hotspot vs vành Spill (0..1) */
  hotspotFocus: number
  /** Hệ số ánh xạ / hắt sáng sang các layer môi trường lân cận (0..2) */
  envBounce: number
  /** Pha thời gian của tia khí quyển truyền xuống shader */
  rayAnimPhase: number
}

export function hexToRgb01(hex: string): [number, number, number] {
  const clean = (hex || '#ffffff').replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255
    const g = parseInt(clean[1] + clean[1], 16) / 255
    const b = parseInt(clean[2] + clean[2], 16) / 255
    return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1]
  }
  const num = parseInt(clean.slice(0, 6), 16)
  if (!Number.isFinite(num)) return [1, 0.85, 0.6]
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255]
}

/**
 * Khử trùng lặp nguồn phát sáng khi người dùng gắn 1 Node Ánh sáng lên cả `Khoá Cụm 2.5D` / `Mô hình 3D`
 * khiến nhiều mảnh con cùng mang cấu hình `virtualLight` giống hệt nhau:
 * - Nếu cụm chỉ có 1 mảnh bật đèn (ví dụ mảnh Bóng Đèn trên Cột Đèn) -> giữ nguyên mảnh đó.
 * - Nếu nhiều mảnh trong cùng `instanceId` bị đóng dấu trùng cùng `kind` + `color` -> chỉ giữ `isRoot` (hoặc mảnh đầu tiên),
 *   giúp các mảnh còn lại nhận ánh sáng tự nhiên thay vì phát 5 luồng sáng chồng chập.
 */
export function resolveActiveLightEmitterIds(layers: ReadonlyArray<Layer>): Set<string> {
  const result = new Set<string>()
  const clusterGroups = new Map<string, Layer[]>()

  for (const l of layers) {
    if (!l.visible || !l.virtualLight?.enabled || l.virtualLight.kind === 'none') continue
    const instId = l.composite?.instanceId ?? l.model3d?.instanceId
    if (!instId) {
      result.add(l.id)
      continue
    }
    const sig = `${l.shotId ?? ''}:${instId}:${l.virtualLight.kind}:${(l.virtualLight.color ?? '').toLowerCase()}`
    const arr = clusterGroups.get(sig)
    if (arr) arr.push(l)
    else clusterGroups.set(sig, [l])
  }

  for (const group of clusterGroups.values()) {
    if (group.length === 1) {
      result.add(group[0].id)
    } else {
      const primary = group.find((m) => m.composite?.isRoot) ?? group[0]
      result.add(primary.id)
    }
  }
  return result
}

function evaluateDirectionalConeMask(
  dxPx: number,
  dyPx: number,
  safeRad: number,
  coneCos: number,
  beamDir: [number, number],
  lightSoft: number,
  curv: number,
  focus: number
): { coneAtten: number; rayTheta: number } {
  const bLen = Math.hypot(beamDir[0], beamDir[1])
  const bx = bLen > 0.001 ? beamDir[0] / bLen : 1
  const by = bLen > 0.001 ? beamDir[1] / bLen : 0
  const px = -by
  const py = bx

  const alongPx = dxPx * bx + dyPx * by
  const signedPerpPx = dxPx * px + dyPx * py
  const perpPx = Math.abs(signedPerpPx)
  const rayTheta = Math.atan2(signedPerpPx, alongPx)

  const halfAngle = Math.acos(Math.max(-0.995, Math.min(0.995, coneCos)))
  const tanHalf = Math.min(2.4, Math.max(0.18, Math.tan(halfAngle * 0.92)))
  const nozzlePx = Math.max(10, Math.min(26, safeRad * 0.04))

  const alongNorm = Math.max(0, Math.min(1.2, (alongPx + nozzlePx) / safeRad))
  const curveExp = Math.max(0.42, Math.min(1.65, 1.0 - curv * 0.52))
  const curvedEnvelopeWidth =
    nozzlePx * 0.85 + safeRad * tanHalf * Math.pow(alongNorm, curveExp) * (1.0 + curv * 0.18)

  const widthRatio = perpPx / Math.max(8, curvedEnvelopeWidth)
  const edgeFeather = Math.max(0.22, 0.32 + lightSoft * 0.55)
  const innerEdge = Math.max(0.05, 1.0 - edgeFeather * 0.75)
  const outerEdge = 1.0 + edgeFeather * 0.45
  const tEdge = Math.max(0, Math.min(1, (widthRatio - innerEdge) / Math.max(0.05, outerEdge - innerEdge)))
  const envMask = 1.0 - tEdge * tEdge * (3 - 2 * tEdge)

  const capCurve = 1.0 - (0.35 + curv * 0.35) * Math.min(1.0, widthRatio * widthRatio * 0.45)
  const effR = alongNorm / Math.max(0.45, capCurve)
  const capFade = effR > 1.0 ? Math.max(0, 1.0 - (effR - 1.0) * 3.5) : 1.0

  const tBack = Math.max(0, Math.min(1, (alongPx + nozzlePx * 1.1) / Math.max(8, nozzlePx * 2.1)))
  const backGate = tBack * tBack * (3 - 2 * tBack)

  // Quang học 2 vùng của chóa đèn: lõi Hotspot hội tụ sắc nét ở trục tâm + vành Spill Corona dịu ra môi trường
  const hotspotK = 1.4 + focus * 3.2
  const hotspot = Math.exp(-hotspotK * widthRatio * widthRatio)
  const spillBase = 0.68 - focus * 0.22
  const coreGain = 0.32 + focus * 0.56
  const centerProfile = spillBase + coreGain * hotspot
  return { coneAtten: envMask * centerProfile * backGate * capFade, rayTheta }
}

/**
 * Hàm toán học quang học đồng nhất 100% với GLSL `LAYER_FRAG` & `VOLUMETRIC_LIGHT_FRAG` (`shaders.ts`):
 * - Chùm nón 2 vùng (Hotspot chóa hội tụ + Spill lan môi trường) + độ cong parabol (`beamCurvature`).
 * - Biến dạng giọt nước bất đối xứng xuôi chiều đối lưu / gió cho ngọn lửa (`coneCos <= -0.98`, `|beamDir| = plumeStretch`).
 * - Tỉa tia sáng khí quyển Tyndall / Crepuscular Rays (`rayIntensity`, `rayCount`, `rayAnimPhase`).
 */
export function computeUnified25DLightAtOffset(
  dxPx: number,
  dyPx: number,
  radPx: number,
  intensity: number,
  coneCos: number,
  beamDir: [number, number],
  softness: number,
  beamCurvature = 0.25,
  zDistRatio = 0,
  hotspotFocus = 0.45,
  rayIntensity = 0,
  rayCount = 10,
  rayAnimPhase = 0
): { localLightHalo: number; wickCore: number; coneAtten: number; rayFactor: number } {
  const safeRad = Math.max(36, radPx)
  const dist2D = Math.hypot(dxPx, dyPx)
  const rawRNorm = dist2D / safeRad
  if (rawRNorm >= 1.48 || intensity <= 0.005) {
    return { localLightHalo: 0, wickCore: 0, coneAtten: 0, rayFactor: 1 }
  }

  const zStandoff = safeRad * (0.2 + Math.max(0, Math.min(1, zDistRatio)) * 0.42)
  const lightSoft = Math.max(0.1, Math.min(1.0, softness))
  const curv = Math.max(-0.8, Math.min(1.0, beamCurvature))
  const focus = Math.max(0, Math.min(1.0, hotspotFocus))
  const isCone = coneCos > -0.98

  let effRNorm = rawRNorm
  let coneAtten = 1.0
  let rayTheta = Math.atan2(dyPx, dxPx)

  if (isCone) {
    const coneRes = evaluateDirectionalConeMask(dxPx, dyPx, safeRad, coneCos, beamDir, lightSoft, curv, focus)
    coneAtten = coneRes.coneAtten
    rayTheta = coneRes.rayTheta
  } else {
    const bLen = Math.hypot(beamDir[0], beamDir[1])
    if (bLen > 0.01) {
      const stretch = bLen <= 0.78 ? bLen : 0.24
      const wx = beamDir[0] / bLen
      const wy = beamDir[1] / bLen
      const alongP = dxPx * wx + dyPx * wy
      const perpP = -dxPx * wy + dyPx * wx
      const alongScale = alongP >= 0 ? 1.0 + stretch * 0.58 : Math.max(0.52, 1.0 - stretch * 0.42)
      const perpScale = Math.max(0.72, 1.0 - stretch * 0.22)
      effRNorm = Math.hypot(alongP / alongScale, perpP / perpScale) / safeRad
      const windBias = Math.max(-0.28, Math.min(0.46, alongP / Math.max(32, safeRad)))
      coneAtten = 1.0 + windBias * (0.14 + stretch * 0.28)
    }
  }

  if (effRNorm >= 1.05 || coneAtten <= 0.001) {
    return { localLightHalo: 0, wickCore: 0, coneAtten: 0, rayFactor: 1 }
  }

  const baseFalloff = 3.2 - (lightSoft - 0.1) * 1.55
  const falloffK = isCone ? baseFalloff : baseFalloff * (0.82 + focus * 0.44)
  const z0Norm = zStandoff / safeRad
  const r3D = Math.hypot(effRNorm, z0Norm)
  const invSq = (1.0 + z0Norm * z0Norm * falloffK) / (1.0 + falloffK * r3D * r3D)
  const tWin = Math.max(0, Math.min(1, effRNorm / 1.05))
  const win = 1.0 - tWin * tWin * (3 - 2 * tWin)
  const radialAtten = invSq * win * win

  const rayFactor = computePhysicalRayStriation(
    rayTheta,
    effRNorm,
    rayIntensity,
    rayCount,
    rayAnimPhase,
    isCone
  )
  const localLightHalo = radialAtten * coneAtten * rayFactor * intensity

  const coreRadPx = Math.max(7, Math.min(20, safeRad * 0.036))
  const wickCore =
    Math.exp((-2.4 * (dist2D * dist2D)) / (coreRadPx * coreRadPx)) * Math.min(1.0, intensity * 0.85)

  return { localLightHalo, wickCore, coneAtten, rayFactor }
}

/**
 * Tính toán trạng thái vật lý tức thời của Nguồn sáng ảo trên `layer` tại thời điểm `t`:
 * - Kiểm tra khoảng thời gian bật sáng `[startTime, startTime + duration]` (đồng bộ với thanh thời gian Node Ánh sáng).
 * - Mô phỏng khí động học ngọn nến/lửa (lặng gió / gió nhẹ / gió mạnh / bão) + dịch nhiệt màu Blackbody.
 * - Mô phỏng hành vi đèn pin/đèn điện (ổn định, nhấp nháy nhẹ, nhịp đập thở, chập chờn pin yếu, nháy chớp) + tỉa tia Tyndall.
 */
export function evaluateVirtualLightAtTime(
  layer: Layer,
  t: number,
  overridePos?: Vec3,
  overrideSize?: [number, number],
  overrideScale?: Vec3
): EvaluatedVirtualLight | null {
  const vl = layer.virtualLight
  if (!vl || !vl.enabled || vl.kind === 'none') return null

  const timeEnv = evaluateLightTimeEnvelope(vl, layer, t)
  if (timeEnv <= 0.002) return null

  const preset = VIRTUAL_LIGHT_PRESETS[vl.kind] ?? VIRTUAL_LIGHT_PRESETS.candle
  const optDefaults = getDefaultOpticalProfile(vl.kind)
  const pos = overridePos ?? evaluate(layer.transform.position, t)
  const rot = evaluate(layer.transform.rotation, t)
  const sc = overrideScale ?? evaluate(layer.transform.scale, t)
  const size = overrideSize ?? layerNominalSize(layer)

  const u = vl.originUV?.[0] ?? 0.5
  const v = vl.originUV?.[1] ?? 0.5
  const localX = (u - 0.5) * size[0] * Math.abs(sc[0])
  const localY = (v - 0.5) * size[1] * Math.abs(sc[1])
  const rotZDeg = rot[2] || 0
  const rotZRad = (rotZDeg * Math.PI) / 180
  const cosR = Math.cos(rotZRad)
  const sinR = Math.sin(rotZRad)

  const baseX = pos[0] + localX * cosR - localY * sinR
  const baseY = pos[1] + localX * sinR + localY * cosR
  const baseZ = pos[2]

  const baseIntensity = Math.max(0.05, vl.intensity ?? preset.intensity)
  const baseRadius = Math.max(40, vl.radius ?? preset.radius)
  const rawZReach = vl.zReach ?? preset.zReach
  const zReach =
    rawZReach === 280 || rawZReach === 320 || rawZReach === 350 || rawZReach === 380
      ? 1500
      : Math.max(30, rawZReach)
  const zReachFront = Math.max(0, vl.zReachFront ?? zReach)
  const zReachBack = Math.max(0, vl.zReachBack ?? zReach)
  const ambientDim = Math.max(0, Math.min(0.85, vl.ambientDim ?? preset.ambientDim ?? 0.24))
  const softness = Math.max(0, Math.min(1.0, Math.max(0.1, vl.softness ?? preset.softness ?? 0.45)))
  const beamCurvature = Math.max(-0.8, Math.min(1.0, vl.beamCurvature ?? preset.beamCurvature ?? 0.25))

  const rawConeDeg = vl.coneAngleDeg ?? preset.coneAngleDeg
  const effectiveConeDeg =
    vl.kind === 'flashlight' ? Math.max(12, Math.min(180, rawConeDeg >= 350 ? 52 : rawConeDeg)) : rawConeDeg
  const isCone = effectiveConeDeg < 350
  const coneCos = isCone ? Math.cos(((effectiveConeDeg * 0.5) * Math.PI) / 180) : -1.0

  const dyn = evaluatePhysicalSourceDynamics(
    vl,
    layer.id,
    t,
    rotZDeg,
    preset.flickerSpeed,
    preset.beamAngleDeg,
    isCone
  )

  const shiftedColor = shiftLightColorByThermalState(hexToRgb01(vl.color || preset.color), dyn.thermalDelta)

  return {
    sourceLayerId: layer.id,
    shotId: layer.shotId ?? null,
    kind: vl.kind,
    position: [baseX + dyn.windOffset[0], baseY + dyn.windOffset[1], baseZ],
    color: shiftedColor.hex,
    rgb: shiftedColor.rgb,
    effectiveIntensity: baseIntensity * dyn.intensityMultiplier * timeEnv,
    effectiveRadius: Math.max(36, baseRadius * dyn.radiusMultiplier),
    beamDir: dyn.plumeVector,
    coneCos,
    zReach,
    zReachFront,
    zReachBack,
    windOffset: dyn.windOffset,
    ambientDim: ambientDim * timeEnv,
    softness,
    beamCurvature,
    plumeStretch: dyn.plumeStretch,
    rayIntensity: Math.max(0, Math.min(1, (vl.rayIntensity ?? optDefaults.rayIntensity) * dyn.rayIntensityMultiplier)),
    rayDynamic: vl.rayDynamic !== false,
    rayCount: Math.max(3, Math.min(24, Math.round(vl.rayCount ?? optDefaults.rayCount))),
    hotspotFocus: Math.max(0, Math.min(1, vl.hotspotFocus ?? optDefaults.hotspotFocus)),
    envBounce: Math.max(0, Math.min(2, vl.envBounce ?? optDefaults.envBounce)),
    rayAnimPhase: dyn.rayAnimPhase
  }
}

export function collectActiveVirtualLights(
  project: Project,
  shotId: string | null,
  t: number
): EvaluatedVirtualLight[] {
  const emitterIds = resolveActiveLightEmitterIds(project.layers)
  const lights: EvaluatedVirtualLight[] = []
  for (const layer of project.layers) {
    if (!emitterIds.has(layer.id)) continue
    if (!layer.visible || t < layer.inPoint || t > layer.outPoint) continue
    if ((layer.shotId ?? null) !== (shotId ?? null)) continue
    const evLight = evaluateVirtualLightAtTime(layer, t)
    if (evLight) lights.push(evLight)
  }
  return lights
}

export function collectEvaluatedVirtualLights(
  evLayers: ReadonlyArray<{
    layer: Layer
    active: boolean
    position: Vec3
    size: [number, number]
    scale: Vec3
  }>,
  shotId: string | null,
  t: number
): EvaluatedVirtualLight[] {
  const activeRawLayers = evLayers.filter((e) => e.active && e.layer.visible).map((e) => e.layer)
  const emitterIds = resolveActiveLightEmitterIds(activeRawLayers)
  const lights: EvaluatedVirtualLight[] = []
  for (const el of evLayers) {
    if (!el.active || !emitterIds.has(el.layer.id)) continue
    if ((el.layer.shotId ?? null) !== (shotId ?? null)) continue
    const evLight = evaluateVirtualLightAtTime(el.layer, t, el.position, el.size, el.scale)
    if (evLight) lights.push(evLight)
  }
  return lights
}

export interface ReceivedLayerLightProjection {
  light: EvaluatedVirtualLight
  relU: number
  relV: number
  localBeamDir: [number, number]
  effectiveIntensity: number
  projectedRadiusPx: number
  zDistRatio: number
}

/**
 * Tìm nguồn sáng ảo trong cùng Shot chiếu mạnh nhất lên `targetLayer` với phép chiếu phối cảnh 2.5D chuẩn:
 * - Xét đồng thời khoảng cách tới khung BBox của `targetLayer`, giao điểm trục tia chùm nón (`beamDir`) và hệ số `envBounce`,
 *   đảm bảo đèn pin rọi ngang qua nền/tường rộng luôn bắt trúng chính xác và đèn quay đi chỗ khác không chiếm nhầm kênh chiếu sáng.
 */
export function resolveReceivedVirtualLightForLayer(
  targetLayerId: string,
  targetPos: Vec3,
  targetWorldW: number,
  targetWorldH: number,
  targetRotZDeg: number,
  shotLights: ReadonlyArray<EvaluatedVirtualLight>,
  refDistance = 1483.6378
): ReceivedLayerLightProjection | null {
  if (shotLights.length === 0) return null

  const rotRad = (-targetRotZDeg * Math.PI) / 180
  const cosR = Math.cos(rotRad)
  const sinR = Math.sin(rotRad)
  const halfW = Math.max(16, targetWorldW * 0.5)
  const halfH = Math.max(16, targetWorldH * 0.5)
  const refD = Math.max(200, refDistance)

  let best: ReceivedLayerLightProjection | null = null
  let bestScore = 0

  for (const sl of shotLights) {
    if (sl.sourceLayerId === targetLayerId || sl.envBounce <= 0.01) continue
    const zDiff = targetPos[2] - sl.position[2]
    const isBack = zDiff > 0
    const zLimit = isBack ? sl.zReachBack : sl.zReachFront
    const dz = Math.abs(zDiff)
    if (dz > zLimit) continue

    const zRatio = dz / Math.max(1, zLimit)
    const zAtten = Math.max(0.22, Math.pow(1 - zRatio * zRatio, 0.9))

    const perspRatio = Math.max(150, refD + targetPos[2]) / Math.max(150, refD + sl.position[2])
    const projLightX = sl.position[0] * perspRatio
    const projLightY = sl.position[1] * perspRatio
    const sliceRadius =
      sl.effectiveRadius * perspRatio * Math.sqrt(Math.max(0.35, 1 - zRatio * zRatio * 0.5))

    const dxWorld = projLightX - targetPos[0]
    const dyWorld = projLightY - targetPos[1]
    const localLx = dxWorld * cosR - dyWorld * sinR
    const localLy = dxWorld * sinR + dyWorld * cosR

    const nearX = Math.max(-halfW, Math.min(halfW, localLx))
    const nearY = Math.max(-halfH, Math.min(halfH, localLy))
    if (Math.hypot(localLx - nearX, localLy - nearY) > sliceRadius * 1.42) continue

    const localBeam: [number, number] = [
      sl.beamDir[0] * cosR - sl.beamDir[1] * sinR,
      sl.beamDir[0] * sinR + sl.beamDir[1] * cosR
    ]

    const bLen = Math.hypot(localBeam[0], localBeam[1])
    const bUx = bLen > 0.001 ? localBeam[0] / bLen : 1
    const bUy = bLen > 0.001 ? localBeam[1] / bLen : 0
    const projAlong = Math.max(24, -localLx * bUx - localLy * bUy)
    const rayBoxX = Math.max(-halfW, Math.min(halfW, localLx + bUx * projAlong))
    const rayBoxY = Math.max(-halfH, Math.min(halfH, localLy + bUy * projAlong))

    const sampleAt = (sx: number, sy: number) =>
      computeUnified25DLightAtOffset(
        sx - localLx,
        sy - localLy,
        sliceRadius,
        sl.effectiveIntensity,
        sl.coneCos,
        localBeam,
        sl.softness,
        sl.beamCurvature,
        zRatio,
        sl.hotspotFocus
      ).localLightHalo

    const peakSurfaceHalo = Math.max(sampleAt(nearX, nearY), sampleAt(rayBoxX, rayBoxY), sampleAt(0, 0))
    const bounceGain = 0.72 + sl.envBounce * 0.3
    const score = peakSurfaceHalo * zAtten * bounceGain

    if (score > bestScore && score > 0.015) {
      bestScore = score
      best = {
        light: sl,
        relU: 0.5 + localLx / Math.max(32, targetWorldW),
        relV: 0.5 + localLy / Math.max(32, targetWorldH),
        localBeamDir: localBeam,
        effectiveIntensity: sl.effectiveIntensity * zAtten * bounceGain,
        projectedRadiusPx: sliceRadius,
        zDistRatio: zRatio
      }
    }
  }

  return best
}

export interface CavePortalInfluence {
  penetration: number
  scaleMultiplier: number
  xDelta: number
  yDelta: number
  zDelta: number
  effectiveDarkness: number
  rawCaveDarkness: number
  lightIllumination: number
  lightTintRgb: [number, number, number]
  shadowTintRgb: [number, number, number]
}

export function computeLightContributionAtPoint(
  light: EvaluatedVirtualLight,
  px: number,
  py: number,
  pz: number
): number {
  const zDiff = pz - light.position[2]
  const isBack = zDiff > 0
  const zLimit = isBack ? light.zReachBack : light.zReachFront
  const dz = Math.abs(zDiff)
  if (dz > zLimit) return 0

  const zRatio = dz / Math.max(1, zLimit)
  const zAtten = Math.max(0.2, Math.pow(1 - zRatio * zRatio, 0.95))

  const evalBeam = computeUnified25DLightAtOffset(
    px - light.position[0],
    py - light.position[1],
    light.effectiveRadius,
    light.effectiveIntensity,
    light.coneCos,
    light.beamDir,
    light.softness,
    light.beamCurvature,
    zRatio,
    light.hotspotFocus
  )
  return evalBeam.localLightHalo * zAtten * Math.max(0, light.envBounce)
}

export function computeLightContributionOnLayerBox(
  light: EvaluatedVirtualLight,
  centerPos: Vec3,
  halfW: number,
  halfH: number
): number {
  const nearX = Math.max(centerPos[0] - halfW, Math.min(centerPos[0] + halfW, light.position[0]))
  const nearY = Math.max(centerPos[1] - halfH, Math.min(centerPos[1] + halfH, light.position[1]))
  const cCenter = computeLightContributionAtPoint(light, centerPos[0], centerPos[1], centerPos[2])
  const cNear = computeLightContributionAtPoint(light, nearX, nearY, centerPos[2])

  const bLen = Math.hypot(light.beamDir[0], light.beamDir[1])
  let cBeam = 0
  if (bLen > 0.01) {
    const bUx = light.beamDir[0] / bLen
    const bUy = light.beamDir[1] / bLen
    const along = Math.max(24, (centerPos[0] - light.position[0]) * bUx + (centerPos[1] - light.position[1]) * bUy)
    const bx = Math.max(centerPos[0] - halfW, Math.min(centerPos[0] + halfW, light.position[0] + bUx * along))
    const by = Math.max(centerPos[1] - halfH, Math.min(centerPos[1] + halfH, light.position[1] + bUy * along))
    cBeam = computeLightContributionAtPoint(light, bx, by, centerPos[2])
  }
  return Math.max(cCenter, cCenter * 0.35 + Math.max(cNear, cBeam) * 0.65)
}

function findDeepestCavePortalHit(
  project: Project,
  targetLayer: Layer,
  shotId: string | null,
  pos: Vec3,
  t: number
): {
  penetration: number
  scale: number
  xDelta: number
  yDelta: number
  zDelta: number
  rawDarkness: number
  shadowRgb: [number, number, number]
} {
  let penetration = 0
  let scale = 1
  let xDelta = 0
  let yDelta = 0
  let zDelta = 0
  let rawDarkness = 0
  let shadowRgb: [number, number, number] = [0.02, 0.03, 0.07]

  for (const other of project.layers) {
    if (other.id === targetLayer.id || !other.visible) continue
    if ((other.shotId ?? null) !== shotId) continue
    const portal = other.physics?.depthPortal
    if (!portal?.enabled) continue

    const oPos = evaluate(other.transform.position, t)
    const zTol = Math.max(400, (portal.depthPullZ ?? 120) * 3.5, (other.physics?.zTolerance ?? 55) * 6)
    const dz = Math.abs(pos[2] - oPos[2])
    if (dz > zTol) continue

    const oScale = evaluate(other.transform.scale, t)
    const oSize = layerNominalSize(other)
    const oW = Math.max(32, oSize[0] * Math.abs(oScale[0]))
    const oH = Math.max(32, oSize[1] * Math.abs(oScale[1]))

    const portalX = oPos[0] + ((portal.centerUV?.[0] ?? 0.5) - 0.5) * oW
    const portalY = oPos[1] + ((portal.centerUV?.[1] ?? 0.45) - 0.5) * oH
    const rxUV = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)
    const ryUV = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)
    const dxNorm = (pos[0] - portalX) / Math.max(24, oW * rxUV)
    const dyNorm = (pos[1] - portalY) / Math.max(24, oH * ryUV)
    const archFactor = (portal.archShape ?? 'arch') === 'arch' ? 1 - Math.max(-0.5, Math.min(0.5, dyNorm)) * 0.14 : 1
    const normDist = Math.hypot(dxNorm / Math.max(0.7, archFactor), dyNorm)

    if (normDist < 1) {
      const zProx = Math.min(1, Math.max(0.25, 1 - Math.pow(dz / zTol, 2.2) * 0.65))
      const rawP = (1 - normDist) * zProx
      const p = rawP * rawP * (3 - 2 * rawP)
      if (p > penetration) {
        penetration = p
        const minSc = Math.max(0.12, Math.min(0.95, portal.minScale ?? 0.38))
        scale = 1 - p * (1 - minSc)
        const pullFactor = p * (1 - scale) * 0.38
        xDelta = (portalX - pos[0]) * pullFactor
        yDelta = (portalY - pos[1]) * pullFactor
        zDelta = p * (portal.depthPullZ ?? 120)
        rawDarkness = Math.pow(p, 0.88) * Math.max(0, Math.min(0.98, portal.darkness ?? 0.82))
        shadowRgb = hexToRgb01(portal.shadowTint ?? '#060812')
      }
    }
  }
  return { penetration, scale, xDelta, yDelta, zDelta, rawDarkness, shadowRgb }
}

export function evaluateCaveDepthPortalForLayer(
  project: Project,
  targetLayer: Layer,
  pos: Vec3,
  t: number
): CavePortalInfluence {
  const shotId = targetLayer.shotId ?? null
  const lights = collectActiveVirtualLights(project, shotId, t)
  const tScale = evaluate(targetLayer.transform.scale, t)
  const tSize = layerNominalSize(targetLayer)
  const targetHalfW = Math.max(16, tSize[0] * Math.abs(tScale[0]) * 0.5)
  const targetHalfH = Math.max(16, tSize[1] * Math.abs(tScale[1]) * 0.5)

  if (targetLayer.physics?.depthPortal?.enabled) {
    let caveAmbient = 0
    let accR = 0
    let accG = 0
    let accB = 0
    for (const l of lights) {
      const c =
        l.sourceLayerId === targetLayer.id
          ? l.effectiveIntensity * 0.35
          : computeLightContributionOnLayerBox(l, pos, targetHalfW, targetHalfH) * 0.35
      if (c > 0.01) {
        caveAmbient += c
        accR += l.rgb[0] * c
        accG += l.rgb[1] * c
        accB += l.rgb[2] * c
      }
    }
    const tint: [number, number, number] =
      caveAmbient > 0.01 ? [accR / caveAmbient, accG / caveAmbient, accB / caveAmbient] : [1, 0.92, 0.78]
    return {
      penetration: 0,
      scaleMultiplier: 1,
      xDelta: 0,
      yDelta: 0,
      zDelta: 0,
      effectiveDarkness: 0,
      rawCaveDarkness: 0,
      lightIllumination: Math.min(0.65, caveAmbient),
      lightTintRgb: tint,
      shadowTintRgb: [0.02, 0.03, 0.07]
    }
  }

  const hit = findDeepestCavePortalHit(project, targetLayer, shotId, pos, t)
  const evalPos: Vec3 = [pos[0] + hit.xDelta, pos[1] + hit.yDelta, pos[2] + hit.zDelta]

  let externalLight = 0
  let selfLight = 0
  let accR = 0
  let accG = 0
  let accB = 0

  for (const l of lights) {
    if (l.sourceLayerId === targetLayer.id) {
      selfLight += l.effectiveIntensity * 0.88
      accR += l.rgb[0] * l.effectiveIntensity * 0.5
      accG += l.rgb[1] * l.effectiveIntensity * 0.5
      accB += l.rgb[2] * l.effectiveIntensity * 0.5
      continue
    }
    const cBase = computeLightContributionOnLayerBox(l, pos, targetHalfW, targetHalfH)
    const cShifted =
      hit.penetration > 0.01
        ? computeLightContributionOnLayerBox(l, evalPos, targetHalfW * hit.scale, targetHalfH * hit.scale)
        : 0
    const contrib = Math.max(cBase, cShifted)
    if (contrib > 0.01) {
      externalLight += contrib
      accR += l.rgb[0] * contrib
      accG += l.rgb[1] * contrib
      accB += l.rgb[2] * contrib
    }
  }

  const weightSum = externalLight + selfLight * 0.5
  const lightTintRgb: [number, number, number] =
    weightSum > 0.01 ? [accR / weightSum, accG / weightSum, accB / weightSum] : [1, 0.92, 0.78]

  const lightRescue = Math.min(hit.rawDarkness, (externalLight + selfLight) * 0.68)
  const effectiveDarkness = Math.max(0, hit.rawDarkness - lightRescue)
  const lightIllumination =
    hit.penetration > 0.01 ? Math.min(2, externalLight + selfLight * 0.45) : Math.min(2, externalLight)

  return {
    penetration: hit.penetration,
    scaleMultiplier: hit.scale,
    xDelta: hit.xDelta,
    yDelta: hit.yDelta,
    zDelta: hit.zDelta,
    effectiveDarkness,
    rawCaveDarkness: hit.rawDarkness,
    lightIllumination,
    lightTintRgb,
    shadowTintRgb: hit.shadowRgb
  }
}
