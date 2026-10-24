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
  beamCurvature: number
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
    zReach: 1200,
    ambientDim: 0,
    softness: 0.5,
    beamCurvature: 0.25
  },
  candle: {
    kind: 'candle',
    label: '🕯️ Ánh nến / Ngọn đuốc (Nhạy theo gió)',
    badge: '🕯️ Ánh nến',
    description:
      'Ánh sáng vàng cam ấm áp; đứng êm khi lặng gió, chao nghiêng mượt khi gió nhẹ và lập lòe bạt ngang dữ dội khi gió mạnh.',
    color: '#ff9d3b',
    intensity: 1.0,
    radius: 460,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.2,
    zReach: 1500,
    ambientDim: 0.24,
    softness: 0.55,
    beamCurvature: 0.35
  },
  flashlight: {
    kind: 'flashlight',
    label: '🔦 Đèn pin / Đèn đường (Chùm sáng định hướng)',
    badge: '🔦 Đèn pin',
    description:
      'Chùm tia sáng định hướng xuyên qua các layer xếp chồng; tùy chỉnh độ dài, góc hướng, độ mở và độ cong khung sáng.',
    color: '#ffe6a3',
    intensity: 1.15,
    radius: 760,
    coneAngleDeg: 52,
    beamAngleDeg: -90,
    windPreset: 'none',
    flickerSpeed: 0.15,
    zReach: 1800,
    ambientDim: 0.28,
    softness: 0.42,
    beamCurvature: 0.25
  },
  bulb: {
    kind: 'bulb',
    label: '💡 Bóng đèn điện / Cột đèn (Tỏa tròn)',
    badge: '💡 Bóng đèn',
    description:
      'Nguồn sáng điện tỏa đều 360° hoặc chao đèn vòm cong chiếu xuống các layer bên dưới.',
    color: '#ffe6a3',
    intensity: 1.0,
    radius: 560,
    coneAngleDeg: 360,
    beamAngleDeg: -90,
    windPreset: 'none',
    flickerSpeed: 0.25,
    zReach: 1600,
    ambientDim: 0.2,
    softness: 0.6,
    beamCurvature: 0.45
  },
  campfire: {
    kind: 'campfire',
    label: '🔥 Lửa trại / Lò rèn (Bập bùng ấm nóng)',
    badge: '🔥 Lửa trại',
    description:
      'Quầng lửa rộng cam đỏ rực rỡ, dao động bập bùng tự nhiên và bạt theo chiều gió.',
    color: '#ff7828',
    intensity: 1.12,
    radius: 620,
    coneAngleDeg: 360,
    beamAngleDeg: 90,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.5,
    zReach: 1600,
    ambientDim: 0.28,
    softness: 0.52,
    beamCurvature: 0.4
  },
  cave_crystal: {
    kind: 'cave_crystal',
    label: '🔮 Tinh thể Hang động (Phát quang huyền ảo)',
    badge: '🔮 Tinh thể',
    description:
      'Ánh sáng lam ngọc phát quang từ sâu trong lòng hang, giúp chiếu sáng nổi khối nhân vật khi đi vào vùng tối cửa hang.',
    color: '#38bdf8',
    intensity: 1.05,
    radius: 500,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.65,
    zReach: 1500,
    ambientDim: 0.26,
    softness: 0.5,
    beamCurvature: 0.35
  },
  magic_orb: {
    kind: 'magic_orb',
    label: '✨ Cầu phép thuật / Đom đóm',
    badge: '✨ Phép thuật',
    description: 'Quầng sáng tím hồng huyền bí trôi nhẹ và lan tỏa ánh sáng mềm.',
    color: '#c084fc',
    intensity: 0.98,
    radius: 420,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.9,
    zReach: 1400,
    ambientDim: 0.22,
    softness: 0.55,
    beamCurvature: 0.4
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
    softness: preset.softness,
    beamCurvature: preset.beamCurvature
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
  /** Độ cong khung sáng (-0.8..1.0) */
  beamCurvature: number
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
 * Hàm toán học đồng nhất 100% với GLSL `LAYER_FRAG` (`shaders.ts`) để tính toán
 * cường độ chùm sáng tại độ lệch pixel `(dxPx, dyPx)` so với tâm nguồn sáng.
 * Dùng chung cho cả `<canvas>` trong Khung Chỉnh 2.5D và Cam 2D để đảm bảo hiển thị đồng bộ tuyệt đối với Camera 3D.
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
  zDistRatio = 0
): { localLightHalo: number; wickCore: number; coneAtten: number } {
  const safeRad = Math.max(36, radPx)
  const dist2D = Math.hypot(dxPx, dyPx)
  const rNorm = dist2D / safeRad
  if (rNorm >= 1.05 || intensity <= 0.005) {
    return { localLightHalo: 0, wickCore: 0, coneAtten: 0 }
  }

  const zStandoff = safeRad * (0.2 + Math.max(0, Math.min(1, zDistRatio)) * 0.42)
  const lightSoft = Math.max(0.1, Math.min(1.0, softness))
  const curv = Math.max(-0.8, Math.min(1.0, beamCurvature))

  let coneAtten = 1.0
  if (coneCos > -0.98) {
    const bLen = Math.hypot(beamDir[0], beamDir[1])
    const bx = bLen > 0.001 ? beamDir[0] / bLen : 1
    const by = bLen > 0.001 ? beamDir[1] / bLen : 0
    const px = -by
    const py = bx

    const alongPx = dxPx * bx + dyPx * by
    const perpPx = Math.abs(dxPx * px + dyPx * py)

    const halfAngle = Math.acos(Math.max(-0.995, Math.min(0.995, coneCos)))
    const tanHalf = Math.min(2.4, Math.max(0.18, Math.tan(halfAngle * 0.92)))
    const nozzlePx = Math.max(10, Math.min(26, safeRad * 0.04))

    // Độ cong khung sáng (beamCurvature):
    // curv > 0: khung sáng phình vòm bầu parabol ngay từ đầu đèn; curv < 0: chụm tiêu điểm
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

    // Độ cong vòm mũi đèn (front cap curvature)
    const capCurve = 1.0 - (0.35 + curv * 0.35) * Math.min(1.0, widthRatio * widthRatio * 0.45)
    const effR = alongNorm / Math.max(0.45, capCurve)
    const capFade = effR > 1.0 ? Math.max(0, 1.0 - (effR - 1.0) * 3.5) : 1.0

    const tBack = Math.max(
      0,
      Math.min(1, (alongPx + nozzlePx * 1.1) / Math.max(8, nozzlePx * 2.1))
    )
    const backGate = tBack * tBack * (3 - 2 * tBack)
    const centerBoost = 0.72 + 0.28 * Math.exp(-1.6 * widthRatio * widthRatio)
    coneAtten = envMask * centerBoost * backGate * capFade
  } else if (Math.hypot(beamDir[0], beamDir[1]) > 0.01) {
    const bLen = Math.hypot(beamDir[0], beamDir[1])
    const windBias = Math.max(
      -0.3,
      Math.min(0.45, (dxPx * (beamDir[0] / bLen) + dyPx * (beamDir[1] / bLen)) / Math.max(32, safeRad))
    )
    coneAtten = 1.0 + windBias * 0.22
  }

  const falloffK = 3.2 - (lightSoft - 0.1) * 1.55
  const r3D = Math.hypot(rNorm, zStandoff / safeRad)
  const z0Norm = zStandoff / safeRad
  const invSq = (1.0 + z0Norm * z0Norm * falloffK) / (1.0 + falloffK * r3D * r3D)
  const tWin = Math.max(0, Math.min(1, rNorm / 1.05))
  const win = 1.0 - tWin * tWin * (3 - 2 * tWin)
  const radialAtten = invSq * win * win
  const localLightHalo = radialAtten * coneAtten * intensity

  const coreRadPx = Math.max(7, Math.min(20, safeRad * 0.036))
  const wickCore =
    Math.exp((-2.4 * (dist2D * dist2D)) / (coreRadPx * coreRadPx)) * Math.min(1.0, intensity * 0.85)

  return { localLightHalo, wickCore, coneAtten }
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
  const rawZReach = vl.zReach ?? preset.zReach
  // Tự động mở rộng tầm lan tỏa Z cho các giá trị mặc định cũ (280..380) để ánh sáng truyền qua mọi layer xếp chồng trong cùng Shot
  const zReach =
    rawZReach === 280 || rawZReach === 320 || rawZReach === 350 || rawZReach === 380
      ? 1500
      : Math.max(30, rawZReach)
  const ambientDim = Math.max(0, Math.min(0.85, vl.ambientDim ?? preset.ambientDim ?? 0.24))
  const softness = Math.max(0.1, Math.min(1.0, vl.softness ?? preset.softness ?? 0.45))
  const beamCurvature = Math.max(
    -0.8,
    Math.min(1.0, vl.beamCurvature ?? preset.beamCurvature ?? 0.25)
  )

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
    effectiveConeDeg = Math.max(12, Math.min(180, vl.coneAngleDeg ?? 52))
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
    softness,
    beamCurvature
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
 * Tìm nguồn sáng ảo trong cùng Shot chiếu lên `targetLayer` với phép chiếu phối cảnh 2.5D chuẩn:
 * - Đồng bộ hệ số `autoScale` theo khoảng cách tham chiếu Camera (`refD = 1483.64`) để chùm tia từ
 *   một layer nhỏ (ví dụ Cột điện / Đèn pin) truyền thẳng hàng tuyệt đối sang mọi layer nền/đất xếp chồng bên dưới.
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
    if (sl.sourceLayerId === targetLayerId) continue
    const dz = Math.abs(targetPos[2] - sl.position[2])
    if (dz > sl.zReach) continue

    const zRatio = dz / Math.max(1, sl.zReach)
    const zAtten = Math.max(0.22, Math.pow(1 - zRatio * zRatio, 0.9))

    // Phép chiếu phối cảnh 2.5D từ mặt phẳng Z của đèn sang mặt phẳng Z của targetLayer
    const perspRatio = Math.max(150, refD + targetPos[2]) / Math.max(150, refD + sl.position[2])
    const projLightX = sl.position[0] * perspRatio
    const projLightY = sl.position[1] * perspRatio
    const sliceRadius =
      sl.effectiveRadius * perspRatio * Math.sqrt(Math.max(0.35, 1 - zRatio * zRatio * 0.5))

    const dxWorld = projLightX - targetPos[0]
    const dyWorld = projLightY - targetPos[1]
    const localLx = dxWorld * cosR - dyWorld * sinR
    const localLy = dxWorld * sinR + dyWorld * cosR

    // Khoảng cách ngắn nhất từ tâm đèn đã chiếu tới hình chữ nhật của targetLayer
    const nearX = Math.max(-halfW, Math.min(halfW, localLx))
    const nearY = Math.max(-halfH, Math.min(halfH, localLy))
    const distToBox = Math.hypot(localLx - nearX, localLy - nearY)
    if (distToBox > sliceRadius * 1.15) continue

    const xyAtten = Math.pow(Math.max(0.15, 1 - distToBox / Math.max(1, sliceRadius * 1.2)), 1.0)
    const score = sl.effectiveIntensity * zAtten * xyAtten
    if (score > bestScore && score > 0.02) {
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
  const dz = Math.abs(pz - light.position[2])
  if (dz > light.zReach) return 0

  const dx = px - light.position[0]
  const dy = py - light.position[1]
  const zRatio = dz / Math.max(1, light.zReach)
  const zAtten = Math.max(0.2, Math.pow(1 - zRatio * zRatio, 0.95))

  const evalBeam = computeUnified25DLightAtOffset(
    dx,
    dy,
    light.effectiveRadius,
    light.effectiveIntensity,
    light.coneCos,
    light.beamDir,
    light.softness,
    light.beamCurvature,
    zRatio
  )
  return evalBeam.localLightHalo * zAtten
}

export function evaluateCaveDepthPortalForLayer(
  project: Project,
  targetLayer: Layer,
  pos: Vec3,
  t: number
): CavePortalInfluence {
  const shotId = targetLayer.shotId ?? null
  const lights = collectActiveVirtualLights(project, shotId, t)

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
