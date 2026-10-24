import type {
  DepthPortalConfig,
  Layer,
  LayerVirtualLight,
  Project,
  Vec3,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { smoothNoise } from '../animation/math'
import { layerNominalSize } from './spatial'

export interface VirtualLightPreset {
  kind: VirtualLightKind
  label: string
  badge: string
  description: string
  color: string
  intensity: number
  radius: number
  coneAngleDeg: number
  beamAngleDeg: number
  windPreset: WindStrengthPreset
  windSensitivity?: number
  flickerSpeed: number
  zReach: number
  ambientDim: number
  softness: number
}

export const VIRTUAL_LIGHT_PRESETS: Record<VirtualLightKind, VirtualLightPreset> = {
  none: {
    kind: 'none',
    label: 'Tắt nguồn sáng ảo',
    badge: '—',
    description: 'Không phát ánh sáng ảo 2.5D.',
    color: '#ffffff',
    intensity: 0,
    radius: 300,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0,
    zReach: 200,
    ambientDim: 0,
    softness: 0.5
  },
  candle: {
    kind: 'candle',
    label: '🕯️ Ánh nến / Ngọn đuốc (Nhạy theo gió)',
    badge: '🕯️ Ánh nến',
    description:
      'Ánh sáng vàng cam ấm áp; đứng êm khi lặng gió, chao nghiêng mượt khi gió nhẹ và lập lòe bạt ngang dữ dội khi gió mạnh.',
    color: '#ff9d3b',
    intensity: 0.92,
    radius: 380,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.2,
    zReach: 280,
    ambientDim: 0.24,
    softness: 0.55
  },
  flashlight: {
    kind: 'flashlight',
    label: '🔦 Đèn pin / Đèn pha (Chùm sáng hình nón)',
    badge: '🔦 Đèn pin',
    description:
      'Chùm tia sáng định hướng hình nón sắc nét tuân theo suy giảm vật lý 1/r²; xoay hướng ngắm để soi sáng hang động tối hoặc vật thể trong đêm.',
    color: '#e8f4ff',
    intensity: 1.1,
    radius: 680,
    coneAngleDeg: 48,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.15,
    zReach: 380,
    ambientDim: 0.34,
    softness: 0.35
  },
  bulb: {
    kind: 'bulb',
    label: '💡 Bóng đèn điện / Đèn đường (Tỏa tròn)',
    badge: '💡 Bóng đèn',
    description:
      'Nguồn sáng điện tỏa đều 360° với vùng bán dạ mềm mại, có thể giữ ổn định hoặc bật nhấp nháy điện áp nhẹ.',
    color: '#ffe6a3',
    intensity: 0.95,
    radius: 500,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.25,
    zReach: 320,
    ambientDim: 0.18,
    softness: 0.6
  },
  campfire: {
    kind: 'campfire',
    label: '🔥 Lửa trại / Lò rèn (Bập bùng ấm nóng)',
    badge: '🔥 Lửa trại',
    description:
      'Quầng lửa rộng cam đỏ rực rỡ, dao động bập bùng tự nhiên và bạt theo chiều gió.',
    color: '#ff7828',
    intensity: 1.08,
    radius: 560,
    coneAngleDeg: 360,
    beamAngleDeg: 90,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.5,
    zReach: 350,
    ambientDim: 0.28,
    softness: 0.52
  },
  cave_crystal: {
    kind: 'cave_crystal',
    label: '🔮 Tinh thể Hang động (Phát quang huyền ảo)',
    badge: '🔮 Tinh thể',
    description:
      'Ánh sáng lam ngọc phát quang từ sâu trong lòng hang, giúp chiếu sáng nổi khối nhân vật khi đi vào vùng tối cửa hang.',
    color: '#38bdf8',
    intensity: 0.98,
    radius: 440,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.65,
    zReach: 320,
    ambientDim: 0.26,
    softness: 0.5
  },
  magic_orb: {
    kind: 'magic_orb',
    label: '✨ Cầu phép thuật / Đom đóm',
    badge: '✨ Phép thuật',
    description: 'Quầng sáng tím hồng huyền bí trôi nhẹ và lan tỏa ánh sáng mềm.',
    color: '#c084fc',
    intensity: 0.92,
    radius: 360,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.9,
    zReach: 280,
    ambientDim: 0.22,
    softness: 0.55
  }
}

export interface CavePortalPreset {
  id: 'standard_cave' | 'ruin_gate' | 'deep_abyss' | 'crystal_cavern'
  label: string
  badge: string
  description: string
  config: Omit<DepthPortalConfig, 'enabled'>
}

export const CAVE_PORTAL_PRESETS: Record<CavePortalPreset['id'], CavePortalPreset> = {
  standard_cave: {
    id: 'standard_cave',
    label: '🕳️ Vòm hang đá chuẩn',
    badge: '🕳️ Vòm hang',
    description: 'Cửa hang vòm đá tự nhiên, nhân vật thu nhỏ dần và chìm vào bóng tối lòng hang.',
    config: {
      centerUV: [0.5, 0.44],
      radiusUV: [0.34, 0.36],
      minScale: 0.38,
      darkness: 0.82,
      shadowTint: '#060812',
      depthPullZ: 140,
      archShape: 'arch',
      feather: 0.55
    }
  },
  ruin_gate: {
    id: 'ruin_gate',
    label: '🚪 Cổng di tích / Đường hầm',
    badge: '🚪 Cổng vòm',
    description: 'Khung vòm cao hẹp cho cổng cổ đại hoặc lối vào đền đài có chiều sâu 2.5D.',
    config: {
      centerUV: [0.5, 0.45],
      radiusUV: [0.27, 0.38],
      minScale: 0.46,
      darkness: 0.72,
      shadowTint: '#080b18',
      depthPullZ: 110,
      archShape: 'arch',
      feather: 0.62
    }
  },
  deep_abyss: {
    id: 'deep_abyss',
    label: '🌑 Hốc sâu thăm thẳm',
    badge: '🌑 Hốc tối',
    description: 'Bóng đêm dày đặc hút sâu nhân vật vào lòng vực tối, chỉ hiện rõ khi có đèn/nến.',
    config: {
      centerUV: [0.5, 0.4],
      radiusUV: [0.38, 0.4],
      minScale: 0.26,
      darkness: 0.94,
      shadowTint: '#030408',
      depthPullZ: 220,
      archShape: 'arch',
      feather: 0.42
    }
  },
  crystal_cavern: {
    id: 'crystal_cavern',
    label: '💎 Động băng / Tinh thể',
    badge: '💎 Động lam',
    description: 'Lòng động ánh xanh đêm sâu thẳm, tôn nổi bật ánh sáng tinh thể hoặc phép thuật.',
    config: {
      centerUV: [0.5, 0.45],
      radiusUV: [0.35, 0.35],
      minScale: 0.38,
      darkness: 0.78,
      shadowTint: '#071526',
      depthPullZ: 160,
      archShape: 'ellipse',
      feather: 0.58
    }
  }
}

export const WIND_STRENGTH_VALUES: Record<WindStrengthPreset, number> = {
  none: 0,
  gentle: 0.38,
  strong: 0.88,
  storm: 1.28
}

export function createDefaultVirtualLight(
  kind: VirtualLightKind = 'candle'
): LayerVirtualLight {
  const preset = VIRTUAL_LIGHT_PRESETS[kind] ?? VIRTUAL_LIGHT_PRESETS.candle
  return {
    enabled: kind !== 'none',
    kind,
    color: preset.color,
    intensity: preset.intensity,
    radius: preset.radius,
    originUV: [0.5, 0.5],
    beamAngleDeg: preset.beamAngleDeg,
    coneAngleDeg: preset.coneAngleDeg,
    windPreset: preset.windPreset,
    windStrength: WIND_STRENGTH_VALUES[preset.windPreset],
    windSensitivity: preset.windSensitivity ?? 1.0,
    windDirectionDeg: 0,
    flickerSpeed: preset.flickerSpeed,
    zReach: preset.zReach,
    ambientDim: preset.ambientDim,
    softness: preset.softness
  }
}

export function createDefaultDepthPortal(): DepthPortalConfig {
  return {
    enabled: true,
    centerUV: [0.5, 0.45],
    radiusUV: [0.35, 0.35],
    minScale: 0.38,
    darkness: 0.82,
    shadowTint: '#060812',
    depthPullZ: 120,
    archShape: 'arch',
    feather: 0.55
  }
}

export interface EvaluatedVirtualLight {
  sourceLayerId: string
  shotId: string | null
  kind: VirtualLightKind
  /** Tọa độ tâm phát sáng trong không gian Shot [x, y, z] (đã cộng độ lệch bạt gió nếu là nến/lửa) */
  position: Vec3
  color: string
  rgb: [number, number, number]
  /** Cường độ sáng thực tế tại thời điểm t (đã tính nhấp nháy do gió / điện áp) */
  effectiveIntensity: number
  /** Bán kính chiếu sáng thực tế tại thời điểm t */
  effectiveRadius: number
  /** Hướng chiếu sáng chuẩn hóa [dx, dy] (dành cho đèn pin hoặc ngọn nến bị gió thổi bạt nghiêng) */
  beamDir: [number, number]
  /** cos(halfConeAngle): -1 nếu tỏa tròn 360°, > -0.99 nếu là chùm sáng hình nón định hướng */
  coneCos: number
  zReach: number
  /** Độ nghiêng/bạt ngọn sáng do gió [offsetX, offsetY] (px) */
  windOffset: [number, number]
  /** Độ dìm tối môi trường ngoài vùng sáng (0..0.85) tạo tương phản vật lý */
  ambientDim: number
  /** Độ mềm vùng bán dạ (0.1..1.0) */
  softness: number
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
 * Tính toán trạng thái tức thời của Nguồn sáng ảo trên `layer` tại thời điểm `t`:
 * - Ánh nến (`candle`) & Lửa trại (`campfire`): Phản ứng vật lý với cường độ gió (`windPreset` / `windStrength`).
 * - Đèn pin (`flashlight`): Chùm sáng hình nón định hướng theo `beamAngleDeg` + góc xoay layer.
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

  const preset = VIRTUAL_LIGHT_PRESETS[vl.kind] ?? VIRTUAL_LIGHT_PRESETS.candle
  const pos = overridePos ?? evaluate(layer.transform.position, t)
  const rot = evaluate(layer.transform.rotation, t)
  const sc = overrideScale ?? evaluate(layer.transform.scale, t)
  const size = overrideSize ?? layerNominalSize(layer)

  const u = vl.originUV?.[0] ?? 0.5
  const v = vl.originUV?.[1] ?? 0.5
  const w = size[0] * Math.abs(sc[0])
  const h = size[1] * Math.abs(sc[1])

  const localX = (u - 0.5) * w
  const localY = (v - 0.5) * h
  const rotZRad = ((rot[2] || 0) * Math.PI) / 180
  const cosR = Math.cos(rotZRad)
  const sinR = Math.sin(rotZRad)

  const baseX = pos[0] + localX * cosR - localY * sinR
  const baseY = pos[1] + localX * sinR + localY * cosR
  const baseZ = pos[2]

  const baseIntensity = Math.max(0.05, vl.intensity ?? preset.intensity)
  const baseRadius = Math.max(40, vl.radius ?? preset.radius)
  const speed = Math.max(0, vl.flickerSpeed ?? preset.flickerSpeed)
  const zReach = Math.max(30, vl.zReach ?? preset.zReach)
  const ambientDim = Math.max(0, Math.min(0.85, vl.ambientDim ?? preset.ambientDim ?? 0.24))
  const softness = Math.max(0.1, Math.min(1.0, vl.softness ?? preset.softness ?? 0.5))

  let effectiveIntensity = baseIntensity
  let effectiveRadius = baseRadius
  let windOffsetX = 0
  let windOffsetY = 0
  let effectiveConeDeg = vl.coneAngleDeg ?? preset.coneAngleDeg
  let effectiveBeamDeg = (vl.beamAngleDeg ?? preset.beamAngleDeg) + (rot[2] || 0)

  if (vl.kind === 'candle' || vl.kind === 'campfire') {
    const presetWind = WIND_STRENGTH_VALUES[vl.windPreset ?? preset.windPreset] ?? 0.38
    const rawWind = vl.windPreset !== undefined ? presetWind : (vl.windStrength ?? presetWind)
    const windStrength = Math.max(0, rawWind * (vl.windSensitivity ?? 1.0))
    const windRad = ((vl.windDirectionDeg ?? 0) * Math.PI) / 180
    const windCos = Math.cos(windRad)
    const windSin = Math.sin(windRad)

    if (windStrength <= 0.03) {
      const calmWave = Math.sin(t * 3.2 * Math.max(0.5, speed)) * 0.045
      effectiveIntensity = baseIntensity * (1 + calmWave)
      effectiveRadius = baseRadius * (1 + calmWave * 0.4)
    } else if (windStrength <= 0.55) {
      const w1 = Math.sin(t * 5.5 * Math.max(0.4, speed))
      const w2 = Math.sin(t * 11.2 * Math.max(0.4, speed) + 1.3) * 0.45
      const gust = 0.65 + 0.35 * smoothNoise(t * 2.2, 4.1)
      const swayPx = (vl.kind === 'candle' ? 24 : 34) * windStrength * gust
      windOffsetX = windCos * swayPx - windSin * w1 * 5 * windStrength
      windOffsetY = windSin * swayPx + Math.abs(w1) * 4 * windStrength
      const mod = (w1 * 0.14 + w2 * 0.09) * (windStrength / 0.4)
      effectiveIntensity = Math.max(0.2, baseIntensity * (1 + mod))
      effectiveRadius = baseRadius * (1 + mod * 0.38)
    } else {
      const fast1 = Math.sin(t * 17.5 * Math.max(0.5, speed))
      const fast2 = Math.sin(t * 29.0 * Math.max(0.5, speed) + 0.7)
      const noiseGust = smoothNoise(t * 6.5, 9.2)
      const snuffDip = noiseGust < -0.35 ? -0.52 * Math.min(1.3, windStrength) : 0
      const flare =
        snuffDip +
        (fast1 * 0.24 + fast2 * 0.16 + noiseGust * 0.22) * Math.min(1.4, windStrength)
      effectiveIntensity = Math.max(baseIntensity * 0.22, baseIntensity * (1 + flare))
      effectiveRadius = Math.max(
        baseRadius * 0.55,
        baseRadius * (1 + flare * 0.35)
      )
      const blowDist = (vl.kind === 'candle' ? 48 : 66) * windStrength * (0.75 + 0.35 * Math.abs(fast1))
      windOffsetX = windCos * blowDist - windSin * fast2 * 10 * windStrength
      windOffsetY = windSin * blowDist - Math.abs(fast1) * 7 * windStrength
    }

    if (effectiveConeDeg >= 350 && windStrength > 0.08) {
      effectiveBeamDeg = vl.windDirectionDeg ?? 0
    }
  } else if (vl.kind === 'flashlight') {
    effectiveConeDeg = Math.max(12, Math.min(160, vl.coneAngleDeg ?? 48))
    if (speed > 0.5) {
      const hum = Math.sin(t * speed * 14) * 0.03
      effectiveIntensity = baseIntensity * (1 + hum)
    }
  } else if (vl.kind === 'bulb') {
    if (speed > 1.2) {
      const spark = smoothNoise(t * speed * 8, 2.7)
      effectiveIntensity = baseIntensity * (spark < -0.4 ? 0.35 : 1 + spark * 0.08)
    }
  } else if (vl.kind === 'cave_crystal' || vl.kind === 'magic_orb') {
    const pulse = Math.sin(t * Math.max(0.4, speed) * 2.8) * 0.13
    effectiveIntensity = baseIntensity * (1 + pulse)
    effectiveRadius = baseRadius * (1 + pulse * 0.25)
  }

  const effectiveBeamRad = (effectiveBeamDeg * Math.PI) / 180
  const coneCos =
    effectiveConeDeg >= 350 ? -1.0 : Math.cos(((effectiveConeDeg * 0.5) * Math.PI) / 180)
  const beamDir: [number, number] = [Math.cos(effectiveBeamRad), Math.sin(effectiveBeamRad)]

  return {
    sourceLayerId: layer.id,
    shotId: layer.shotId ?? null,
    kind: vl.kind,
    position: [baseX + windOffsetX, baseY + windOffsetY, baseZ],
    color: vl.color || preset.color,
    rgb: hexToRgb01(vl.color || preset.color),
    effectiveIntensity,
    effectiveRadius,
    beamDir,
    coneCos,
    zReach,
    windOffset: [windOffsetX, windOffsetY],
    ambientDim,
    softness
  }
}

/**
 * Thu thập tất cả các nguồn sáng ảo đang hoạt động trong cùng Shot tại thời điểm `t`.
 */
export function collectActiveVirtualLights(
  project: Project,
  shotId: string | null,
  t: number
): EvaluatedVirtualLight[] {
  const lights: EvaluatedVirtualLight[] = []
  for (const layer of project.layers) {
    if (!layer.visible || t < layer.inPoint || t > layer.outPoint) continue
    if ((layer.shotId ?? null) !== (shotId ?? null)) continue
    if (!layer.virtualLight?.enabled || layer.virtualLight.kind === 'none') continue
    const evLight = evaluateVirtualLightAtTime(layer, t)
    if (evLight) lights.push(evLight)
  }
  return lights
}

/**
 * Thu thập các nguồn sáng ảo từ danh sách `ev.layers` đã tính toán đầy đủ vị trí vật lý, motion và autoScale
 * để đồng bộ tuyệt đối 1:1 giữa WebGL Camera 3D và Cam 2D.
 */
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
  const lights: EvaluatedVirtualLight[] = []
  for (const el of evLayers) {
    if (!el.active) continue
    if ((el.layer.shotId ?? null) !== (shotId ?? null)) continue
    if (!el.layer.virtualLight?.enabled || el.layer.virtualLight.kind === 'none') continue
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
 * Tìm nguồn sáng ảo lân cận trong cùng Shot chiếu mạnh nhất lên `targetLayer`
 * dựa trên khoảng cách không gian 3D thực (X, Y, Z), vùng giao cắt khung hình chữ nhật của layer,
 * và góc chùm tia hình nón (nếu là Đèn pin / Spotlight).
 */
export function resolveReceivedVirtualLightForLayer(
  targetLayerId: string,
  targetPos: Vec3,
  targetWorldW: number,
  targetWorldH: number,
  targetRotZDeg: number,
  shotLights: ReadonlyArray<EvaluatedVirtualLight>
): ReceivedLayerLightProjection | null {
  if (shotLights.length === 0) return null

  const rotRad = (-targetRotZDeg * Math.PI) / 180
  const cosR = Math.cos(rotRad)
  const sinR = Math.sin(rotRad)
  const halfW = Math.max(16, targetWorldW * 0.5)
  const halfH = Math.max(16, targetWorldH * 0.5)

  let best: ReceivedLayerLightProjection | null = null
  let bestScore = 0

  for (const sl of shotLights) {
    if (sl.sourceLayerId === targetLayerId) continue
    const dz = Math.abs(targetPos[2] - sl.position[2])
    if (dz > sl.zReach) continue

    const zRatio = dz / Math.max(1, sl.zReach)
    const zAtten = Math.pow(1 - zRatio * zRatio, 1.45)
    const sliceRadius = sl.effectiveRadius * Math.sqrt(Math.max(0.18, 1 - zRatio * zRatio * 0.75))

    const dxWorld = sl.position[0] - targetPos[0]
    const dyWorld = sl.position[1] - targetPos[1]
    const localLx = dxWorld * cosR - dyWorld * sinR
    const localLy = dxWorld * sinR + dyWorld * cosR

    // Khoảng cách ngắn nhất từ tâm đèn tới hình chữ nhật của targetLayer
    const nearX = Math.max(-halfW, Math.min(halfW, localLx))
    const nearY = Math.max(-halfH, Math.min(halfH, localLy))
    const distToBox = Math.hypot(localLx - nearX, localLy - nearY)
    if (distToBox > sliceRadius * 1.05) continue

    const xyAtten = Math.pow(Math.max(0, 1 - distToBox / Math.max(1, sliceRadius * 1.1)), 1.2)

    // Nếu là nguồn sáng định hướng (Đèn pin), kiểm tra xem tia sáng có hướng về phía layer không
    let coneFactor = 1.0
    if (sl.coneCos > -0.98) {
      const toBoxX = nearX - localLx
      const toBoxY = nearY - localLy
      const toBoxLen = Math.hypot(toBoxX, toBoxY)
      const localBeamX = sl.beamDir[0] * cosR - sl.beamDir[1] * sinR
      const localBeamY = sl.beamDir[0] * sinR + sl.beamDir[1] * cosR
      if (toBoxLen > 8) {
        const cosToBox = (toBoxX * localBeamX + toBoxY * localBeamY) / toBoxLen
        if (cosToBox < sl.coneCos - 0.35) continue
        coneFactor = Math.max(0.25, Math.min(1, (cosToBox - (sl.coneCos - 0.35)) / Math.max(0.1, 1 - sl.coneCos + 0.35)))
      }
    }

    const score = sl.effectiveIntensity * zAtten * xyAtten * coneFactor
    if (score > bestScore && score > 0.03) {
      bestScore = score
      const localBeamX = sl.beamDir[0] * cosR - sl.beamDir[1] * sinR
      const localBeamY = sl.beamDir[0] * sinR + sl.beamDir[1] * cosR
      best = {
        light: sl,
        relU: 0.5 + localLx / Math.max(32, targetWorldW),
        relV: 0.5 + localLy / Math.max(32, targetWorldH),
        localBeamDir: [localBeamX, localBeamY],
        effectiveIntensity: sl.effectiveIntensity * zAtten,
        projectedRadiusPx: sliceRadius,
        zDistRatio: zRatio
      }
    }
  }

  return best
}

export interface CavePortalInfluence {
  /** Mức độ đi sâu vào lòng hang (0 = ngoài cửa hang, 1 = tâm sâu nhất của hang) */
  penetration: number
  /** Hệ số thu nhỏ nhân vật khi đi vào cửa hang (1.0 -> minScale) */
  scaleMultiplier: number
  /** Độ hút ngang về tâm lối đi trong hang theo phối cảnh */
  xDelta: number
  /** Độ hạ chân theo sàn hang để nhân vật không bị lơ lửng khi thu nhỏ */
  yDelta: number
  /** Độ lùi Z khi tiến vào lòng hang */
  zDelta: number
  /** Độ tối bóng đêm hang động sau khi đã trừ phần được Nguồn sáng ảo chiếu sáng (0..1) */
  effectiveDarkness: number
  /** Độ tối thô của hang động trước khi có đèn chiếu (0..1) */
  rawCaveDarkness: number
  /** Cường độ ánh sáng ảo chiếu lên nhân vật (0..2) */
  lightIllumination: number
  /** Màu ánh sáng ảo chiếu lên nhân vật [r, g, b] */
  lightTintRgb: [number, number, number]
  /** Màu bóng tối của hang [r, g, b] */
  shadowTintRgb: [number, number, number]
}

/**
 * Tính toán độ chiếu sáng vật lý của một `EvaluatedVirtualLight` lên một điểm 3D `[px, py, pz]`:
 * - Áp dụng suy giảm nghịch đảo bình phương mềm (Inverse-Square + Smooth Window) theo cả bán kính XY và độ sâu Z.
 * - Với nguồn sáng hình nón (Đèn pin), tính toán vùng lõi sáng và vùng bán dạ (penumbra) mượt mà.
 */
export function computeLightContributionAtPoint(
  light: EvaluatedVirtualLight,
  px: number,
  py: number,
  pz: number
): number {
  const dz = Math.abs(pz - light.position[2])
  if (dz > light.zReach) return 0

  const dx = px - light.position[0]
  const dy = py - light.position[1]
  const dist2D = Math.hypot(dx, dy)
  if (dist2D > light.effectiveRadius) return 0

  const zNorm = dz / Math.max(1, light.zReach)
  const rNorm = dist2D / Math.max(1, light.effectiveRadius)

  const zAtten = Math.pow(1 - zNorm * zNorm, 1.45)
  const invSq = 1 / (1 + 2.1 * rNorm * rNorm)
  const windowAtten = Math.pow(1 - rNorm, 1.25)
  const radialAtten = invSq * windowAtten * 1.28

  let coneAtten = 1.0
  if (light.coneCos > -0.98 && dist2D > 4) {
    const along = dx * light.beamDir[0] + dy * light.beamDir[1]
    const perp = Math.abs(-dx * light.beamDir[1] + dy * light.beamDir[0])
    const nozzleOffset = Math.max(10, light.effectiveRadius * 0.035)
    if (along < -nozzleOffset * 0.7) return 0
    const cosAng = (along + nozzleOffset) / Math.hypot(along + nozzleOffset, perp)
    if (cosAng < light.coneCos) return 0
    const penumbraSpan = Math.max(0.04, (1 - light.coneCos) * (0.28 + light.softness * 0.35))
    const rawCone = Math.min(1, (cosAng - light.coneCos) / penumbraSpan)
    coneAtten = rawCone * rawCone * (3 - 2 * rawCone)
  }

  return light.effectiveIntensity * radialAtten * zAtten * coneAtten
}

/**
 * Đánh giá hiệu ứng Vùng Độ Sâu / Lối Vào Hang Động (`depthPortal`) và Ánh Sáng Ảo (`virtualLight`)
 * tác động lên `targetLayer` tại thời điểm `t`:
 * - Khi nhân vật đi vào vùng cửa hang trên layer nền/cổng đá:
 *   1. Nhân vật tự động thu nhỏ dần theo phối cảnh (`scaleMultiplier` -> `minScale`), hạ sàn (`yDelta`) và lùi sâu vào Z (`zDelta`).
 *   2. Bóng tối hang động che phủ dần nhân vật (`rawCaveDarkness`).
 *   3. Nếu trong hang động (hoặc trên người nhân vật) có Nguồn sáng ảo (Ánh nến, Đèn pin, Tinh thể),
 *      ánh sáng đó sẽ chiếu sáng phần nhân vật đang ở trong hang, đẩy lùi bóng tối (`effectiveDarkness` giảm)!
 */
export function evaluateCaveDepthPortalForLayer(
  project: Project,
  targetLayer: Layer,
  pos: Vec3,
  t: number
): CavePortalInfluence {
  const shotId = targetLayer.shotId ?? null
  const lights = collectActiveVirtualLights(project, shotId, t)

  // Bản thân layer mang cửa hang không tự thu nhỏ chính nó
  if (targetLayer.physics?.depthPortal?.enabled) {
    let caveAmbientLight = 0
    let accR = 0
    let accG = 0
    let accB = 0
    for (const l of lights) {
      const c =
        l.sourceLayerId === targetLayer.id
          ? l.effectiveIntensity * 0.35
          : computeLightContributionAtPoint(l, pos[0], pos[1], pos[2]) * 0.35
      if (c > 0.01) {
        caveAmbientLight += c
        accR += l.rgb[0] * c
        accG += l.rgb[1] * c
        accB += l.rgb[2] * c
      }
    }
    const tint: [number, number, number] =
      caveAmbientLight > 0.01
        ? [accR / caveAmbientLight, accG / caveAmbientLight, accB / caveAmbientLight]
        : [1, 0.92, 0.78]
    return {
      penetration: 0,
      scaleMultiplier: 1,
      xDelta: 0,
      yDelta: 0,
      zDelta: 0,
      effectiveDarkness: 0,
      rawCaveDarkness: 0,
      lightIllumination: Math.min(0.65, caveAmbientLight),
      lightTintRgb: tint,
      shadowTintRgb: [0.02, 0.03, 0.07]
    }
  }

  let bestPenetration = 0
  let bestScale = 1
  let bestXDelta = 0
  let bestYDelta = 0
  let bestZDelta = 0
  let bestRawDarkness = 0
  let bestShadowRgb: [number, number, number] = [0.02, 0.03, 0.07]

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
    const rxPx = Math.max(24, oW * rxUV)
    const ryPx = Math.max(24, oH * ryUV)

    const dxNorm = (pos[0] - portalX) / rxPx
    const dyNorm = (pos[1] - portalY) / ryPx
    const shape = portal.archShape ?? 'arch'
    // Hình vòm hang tự nhiên: phần đáy cửa hang mở rộng nhẹ để đón bước chân nhân vật
    const archFactor = shape === 'arch' ? 1 - Math.max(-0.5, Math.min(0.5, dyNorm)) * 0.14 : 1
    const normDist = Math.hypot(dxNorm / Math.max(0.7, archFactor), dyNorm)

    if (normDist < 1) {
      const zProx = Math.min(1, Math.max(0.25, 1 - Math.pow(dz / zTol, 2.2) * 0.65))
      const rawP = (1 - normDist) * zProx
      const p = rawP * rawP * (3 - 2 * rawP)
      if (p > bestPenetration) {
        bestPenetration = p
        const minSc = Math.max(0.12, Math.min(0.95, portal.minScale ?? 0.38))
        bestScale = 1 - p * (1 - minSc)
        const pullFactor = p * (1 - bestScale) * 0.38
        bestXDelta = (portalX - pos[0]) * pullFactor
        bestYDelta = (portalY - pos[1]) * pullFactor
        bestZDelta = p * (portal.depthPullZ ?? 120)
        bestRawDarkness = Math.pow(p, 0.88) * Math.max(0, Math.min(0.98, portal.darkness ?? 0.82))
        bestShadowRgb = hexToRgb01(portal.shadowTint ?? '#060812')
      }
    }
  }

  const evalX = pos[0] + bestXDelta
  const evalY = pos[1] + bestYDelta
  const evalZ = pos[2] + bestZDelta

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
    const cBase = computeLightContributionAtPoint(l, pos[0], pos[1], pos[2])
    const cShifted =
      bestPenetration > 0.01 ? computeLightContributionAtPoint(l, evalX, evalY, evalZ) : 0
    const contrib = Math.max(cBase, cShifted)
    if (contrib > 0.01) {
      externalLight += contrib
      accR += l.rgb[0] * contrib
      accG += l.rgb[1] * contrib
      accB += l.rgb[2] * contrib
    }
  }

  const totalRescueLight = externalLight + selfLight
  const weightSum = externalLight + selfLight * 0.5
  const lightTintRgb: [number, number, number] =
    weightSum > 0.01
      ? [accR / weightSum, accG / weightSum, accB / weightSum]
      : [1, 0.92, 0.78]

  const lightRescue = Math.min(bestRawDarkness, totalRescueLight * 0.68)
  const effectiveDarkness = Math.max(0, bestRawDarkness - lightRescue)
  const effectiveIllumination =
    bestPenetration > 0.01 ? Math.min(2, externalLight + selfLight * 0.45) : Math.min(2, externalLight)

  return {
    penetration: bestPenetration,
    scaleMultiplier: bestScale,
    xDelta: bestXDelta,
    yDelta: bestYDelta,
    zDelta: bestZDelta,
    effectiveDarkness,
    rawCaveDarkness: bestRawDarkness,
    lightIllumination: effectiveIllumination,
    lightTintRgb,
    shadowTintRgb: bestShadowRgb
  }
}
