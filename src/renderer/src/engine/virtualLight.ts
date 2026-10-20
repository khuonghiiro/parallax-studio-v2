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
    zReach: 200
  },
  candle: {
    kind: 'candle',
    label: '🕯️ Ánh nến / Ngọn đuốc (Nhạy theo gió)',
    badge: '🕯️ Ánh nến',
    description:
      'Ánh sáng vàng cam ấm áp; đứng êm khi lặng gió, chao nghiêng mượt khi gió nhẹ và lập lòe bạt ngang dữ dội khi gió mạnh.',
    color: '#ff9d3b',
    intensity: 0.85,
    radius: 360,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'gentle',
    flickerSpeed: 1.2,
    zReach: 260
  },
  flashlight: {
    kind: 'flashlight',
    label: '🔦 Đèn pin / Đèn pha (Chùm sáng hình nón)',
    badge: '🔦 Đèn pin',
    description:
      'Chùm tia sáng định hướng hình nón sắc nét; xoay theo hướng ngắm để soi sáng hang động tối hoặc vật thể trong đêm.',
    color: '#e8f4ff',
    intensity: 1.05,
    radius: 640,
    coneAngleDeg: 48,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.2,
    zReach: 340
  },
  bulb: {
    kind: 'bulb',
    label: '💡 Bóng đèn điện / Đèn đường (Tỏa tròn)',
    badge: '💡 Bóng đèn',
    description:
      'Nguồn sáng điện tỏa đều 360°, có thể giữ ổn định hoặc bật nhấp nháy điện áp nhẹ.',
    color: '#ffe6a3',
    intensity: 0.9,
    radius: 480,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.3,
    zReach: 300
  },
  campfire: {
    kind: 'campfire',
    label: '🔥 Lửa trại / Lò rèn (Bập bùng ấm nóng)',
    badge: '🔥 Lửa trại',
    description:
      'Quầng lửa rộng cam đỏ rực rỡ, dao động bập bùng tự nhiên và bạt theo chiều gió.',
    color: '#ff7828',
    intensity: 1.0,
    radius: 520,
    coneAngleDeg: 360,
    beamAngleDeg: 90,
    windPreset: 'gentle',
    flickerSpeed: 1.5,
    zReach: 320
  },
  cave_crystal: {
    kind: 'cave_crystal',
    label: '🔮 Tinh thể Hang động (Phát quang huyền ảo)',
    badge: '🔮 Tinh thể',
    description:
      'Ánh sáng lam ngọc phát quang từ sâu trong lòng hang, giúp chiếu sáng nhân vật khi đi vào vùng tối cửa hang.',
    color: '#38bdf8',
    intensity: 0.9,
    radius: 420,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.65,
    zReach: 290
  },
  magic_orb: {
    kind: 'magic_orb',
    label: '✨ Cầu phép thuật / Đom đóm',
    badge: '✨ Phép thuật',
    description: 'Quầng sáng tím hồng huyền bí trôi nhẹ và lan tỏa ánh sáng mềm.',
    color: '#c084fc',
    intensity: 0.85,
    radius: 340,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.9,
    zReach: 250
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
    windDirectionDeg: 0,
    flickerSpeed: preset.flickerSpeed,
    zReach: preset.zReach
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
    depthPullZ: 120
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
 *   + Không gió (`0`): Sáng êm dịu, nhịp thở 4%.
 *   + Gió nhẹ (`~0.38`): Ngọn sáng nghiêng nhẹ theo chiều gió (~16px), cường độ dao động êm ±18%.
 *   + Gió mạnh / Bão (`0.85 .. 1.28`): Ngọn nến lập lòe tần số cao (đôi lúc suýt tắt 0.28x rồi bùng lên 1.4x),
 *     tâm sáng bị thổi bạt mạnh (40-70px) và kéo dài theo hướng gió.
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

  const baseX = pos[0] + (u - 0.5) * w
  const baseY = pos[1] + (v - 0.5) * h
  const baseZ = pos[2]

  const baseIntensity = Math.max(0.05, vl.intensity ?? preset.intensity)
  const baseRadius = Math.max(40, vl.radius ?? preset.radius)
  const speed = Math.max(0, vl.flickerSpeed ?? preset.flickerSpeed)
  const zReach = Math.max(30, vl.zReach ?? preset.zReach)

  let effectiveIntensity = baseIntensity
  let effectiveRadius = baseRadius
  let windOffsetX = 0
  let windOffsetY = 0
  let effectiveConeDeg = vl.coneAngleDeg ?? preset.coneAngleDeg
  const effectiveBeamDeg = (vl.beamAngleDeg ?? preset.beamAngleDeg) + (rot[2] || 0)

  if (vl.kind === 'candle' || vl.kind === 'campfire') {
    const windStrength =
      vl.windStrength !== undefined
        ? vl.windStrength
        : WIND_STRENGTH_VALUES[vl.windPreset ?? preset.windPreset] ?? 0.38
    const windRad = ((vl.windDirectionDeg ?? 0) * Math.PI) / 180
    const windCos = Math.cos(windRad)
    const windSin = Math.sin(windRad)

    if (windStrength <= 0.03) {
      // Lặng gió: ánh nến đứng thẳng, nhịp thở ấm rất nhẹ
      const calmWave = Math.sin(t * 3.2 * Math.max(0.5, speed)) * 0.045
      effectiveIntensity = baseIntensity * (1 + calmWave)
      effectiveRadius = baseRadius * (1 + calmWave * 0.5)
    } else if (windStrength <= 0.55) {
      // Gió nhẹ: ngọn nến chao nghiêng mềm mại theo chiều gió, ánh sáng chập chờn êm
      const w1 = Math.sin(t * 5.5 * Math.max(0.4, speed))
      const w2 = Math.sin(t * 11.2 * Math.max(0.4, speed) + 1.3) * 0.45
      const gust = 0.65 + 0.35 * smoothNoise(t * 2.2, 4.1)
      const swayPx = (vl.kind === 'candle' ? 26 : 36) * windStrength * gust
      windOffsetX = windCos * swayPx + -windSin * w1 * 5 * windStrength
      windOffsetY = windSin * swayPx + Math.abs(w1) * 4 * windStrength
      const mod = (w1 * 0.14 + w2 * 0.09) * (windStrength / 0.4)
      effectiveIntensity = Math.max(0.2, baseIntensity * (1 + mod))
      effectiveRadius = baseRadius * (1 + mod * 0.45)
    } else {
      // Gió mạnh / Bão tố: ngọn lửa bị thổi bạt ngang mạnh, lập lòe dữ dội (suýt tắt rồi bùng sáng)
      const fast1 = Math.sin(t * 17.5 * Math.max(0.5, speed))
      const fast2 = Math.sin(t * 29.0 * Math.max(0.5, speed) + 0.7)
      const noiseGust = smoothNoise(t * 6.5, 9.2)
      // Đôi lúc gió tạt mạnh làm ngọn nến sụt sáng sâu rồi bùng lên
      const snuffDip = noiseGust < -0.35 ? -0.52 * Math.min(1.3, windStrength) : 0
      const flare =
        snuffDip +
        (fast1 * 0.24 + fast2 * 0.16 + noiseGust * 0.22) * Math.min(1.4, windStrength)
      effectiveIntensity = Math.max(baseIntensity * 0.22, baseIntensity * (1 + flare))
      effectiveRadius = Math.max(
        baseRadius * 0.55,
        baseRadius * (1 + flare * 0.38)
      )
      const blowDist = (vl.kind === 'candle' ? 52 : 72) * windStrength * (0.75 + 0.35 * Math.abs(fast1))
      windOffsetX = windCos * blowDist + -windSin * fast2 * 11 * windStrength
      windOffsetY = windSin * blowDist - Math.abs(fast1) * 8 * windStrength
    }
  } else if (vl.kind === 'flashlight') {
    effectiveConeDeg = Math.max(12, Math.min(160, vl.coneAngleDeg ?? 48))
    if (speed > 0.5) {
      const hum = Math.sin(t * speed * 14) * 0.03
      effectiveIntensity = baseIntensity * (1 + hum)
    }
  } else if (vl.kind === 'bulb') {
    if (speed > 1.2) {
      // Chế độ bóng đèn điện chập chờn
      const spark = smoothNoise(t * speed * 8, 2.7)
      effectiveIntensity = baseIntensity * (spark < -0.4 ? 0.35 : 1 + spark * 0.08)
    }
  } else if (vl.kind === 'cave_crystal' || vl.kind === 'magic_orb') {
    const pulse = Math.sin(t * Math.max(0.4, speed) * 2.8) * 0.14
    effectiveIntensity = baseIntensity * (1 + pulse)
    effectiveRadius = baseRadius * (1 + pulse * 0.3)
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
    windOffset: [windOffsetX, windOffsetY]
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

export interface CavePortalInfluence {
  /** Mức độ đi sâu vào lòng hang (0 = ngoài cửa hang, 1 = tâm sâu nhất của hang) */
  penetration: number
  /** Hệ số thu nhỏ nhân vật khi đi vào cửa hang (1.0 -> minScale) */
  scaleMultiplier: number
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
 * Tính toán độ chiếu sáng của một `EvaluatedVirtualLight` lên một điểm `[px, py, pz]`.
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

  const zAtten = 1 - Math.pow(dz / Math.max(1, light.zReach), 1.6)
  const radialAtten = Math.pow(1 - dist2D / Math.max(1, light.effectiveRadius), 1.45)

  let coneAtten = 1.0
  if (light.coneCos > -0.98 && dist2D > 4) {
    const dirX = dx / dist2D
    const dirY = dy / dist2D
    const dot = dirX * light.beamDir[0] + dirY * light.beamDir[1]
    if (dot < light.coneCos) return 0
    coneAtten = Math.min(1, (dot - light.coneCos) / Math.max(0.05, 1 - light.coneCos))
  }

  return light.effectiveIntensity * radialAtten * zAtten * coneAtten
}

/**
 * Đánh giá hiệu ứng Vùng Độ Sâu / Lối Vào Hang Động (`depthPortal`) và Ánh Sáng Ảo (`virtualLight`)
 * tác động lên `targetLayer` tại thời điểm `t`:
 * - Khi nhân vật đi vào vùng cửa hang trên layer mặt đất/nền:
 *   1. Nhân vật tự động thu nhỏ dần (`scaleMultiplier` giảm về `minScale`) và lùi sâu nhẹ vào Z (`zDelta`).
 *   2. Bóng tối hang động che phủ dần nhân vật (`rawCaveDarkness`).
 *   3. Nếu trong hang động (hoặc trên người nhân vật) có Nguồn sáng ảo (Ánh nến, Đèn pin, Tinh thể),
 *      ánh sáng đó sẽ chiếu sáng phần nhân vật đang ở trong hang, xua tan bóng tối (`effectiveDarkness` giảm)!
 */
export function evaluateCaveDepthPortalForLayer(
  project: Project,
  targetLayer: Layer,
  pos: Vec3,
  t: number
): CavePortalInfluence {
  const shotId = targetLayer.shotId ?? null
  const lights = collectActiveVirtualLights(project, shotId, t)

  let externalLight = 0
  let selfLight = 0
  let accR = 0
  let accG = 0
  let accB = 0

  for (const l of lights) {
    if (l.sourceLayerId === targetLayer.id) {
      selfLight += l.effectiveIntensity * 0.85
      accR += l.rgb[0] * l.effectiveIntensity * 0.5
      accG += l.rgb[1] * l.effectiveIntensity * 0.5
      accB += l.rgb[2] * l.effectiveIntensity * 0.5
      continue
    }
    const contrib = computeLightContributionAtPoint(l, pos[0], pos[1], pos[2])
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

  // Bản thân layer mang cửa hang không tự thu nhỏ chính nó
  if (targetLayer.physics?.depthPortal?.enabled) {
    return {
      penetration: 0,
      scaleMultiplier: 1,
      zDelta: 0,
      effectiveDarkness: 0,
      rawCaveDarkness: 0,
      lightIllumination: Math.min(2, externalLight),
      lightTintRgb,
      shadowTintRgb: [0.02, 0.03, 0.07]
    }
  }

  let bestPenetration = 0
  let bestScale = 1
  let bestZDelta = 0
  let bestRawDarkness = 0
  let bestShadowRgb: [number, number, number] = [0.02, 0.03, 0.07]

  for (const other of project.layers) {
    if (other.id === targetLayer.id || !other.visible) continue
    if ((other.shotId ?? null) !== shotId) continue
    const portal = other.physics?.depthPortal
    if (!portal?.enabled) continue

    const oPos = evaluate(other.transform.position, t)
    const zTol = Math.max(160, (other.physics?.zTolerance ?? 55) * 4)
    if (Math.abs(pos[2] - oPos[2]) > zTol) continue

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

    const normDist = Math.hypot((pos[0] - portalX) / rxPx, (pos[1] - portalY) / ryPx)
    if (normDist < 1) {
      // Mức độ tiến sâu vào tâm cửa hang (smoothstep từ mép ngoài vào tâm)
      const rawP = 1 - normDist
      const p = rawP * rawP * (3 - 2 * rawP)
      if (p > bestPenetration) {
        bestPenetration = p
        const minSc = Math.max(0.12, Math.min(0.95, portal.minScale ?? 0.38))
        bestScale = 1 - p * (1 - minSc)
        bestZDelta = p * (portal.depthPullZ ?? 120)
        bestRawDarkness = p * Math.max(0, Math.min(0.98, portal.darkness ?? 0.82))
        bestShadowRgb = hexToRgb01(portal.shadowTint ?? '#060812')
      }
    }
  }

  // Nếu có ánh sáng ảo trong hang chiếu tới nhân vật, bóng tối bị đẩy lùi!
  const lightRescue = Math.min(bestRawDarkness, totalRescueLight * 0.62)
  const effectiveDarkness = Math.max(0, bestRawDarkness - lightRescue)
  const effectiveIllumination =
    bestPenetration > 0.01 ? Math.min(2, externalLight + selfLight * 0.45) : Math.min(2, externalLight)

  return {
    penetration: bestPenetration,
    scaleMultiplier: bestScale,
    zDelta: bestZDelta,
    effectiveDarkness,
    rawCaveDarkness: bestRawDarkness,
    lightIllumination: effectiveIllumination,
    lightTintRgb,
    shadowTintRgb: bestShadowRgb
  }
}
