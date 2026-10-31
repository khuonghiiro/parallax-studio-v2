import type {
  Layer,
  LayerVirtualLight,
  VirtualLightBehaviorMode,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import { smoothNoise } from '../animation/math'

export const WIND_PRESET_STRENGTH: Record<WindStrengthPreset, number> = {
  none: 0,
  gentle: 0.38,
  strong: 0.88,
  storm: 1.28
}

export interface PhysicalLightDynamicsResult {
  effectiveBehavior: Exclude<VirtualLightBehaviorMode, 'auto'>
  intensityMultiplier: number
  radiusMultiplier: number
  windOffset: [number, number]
  /** Vector hướng chiếu (cho đèn nón) hoặc hướng tạt luồng lửa có độ lớn = độ kéo giãn plume (0..0.72) */
  plumeVector: [number, number]
  /** Độ kéo giãn bất đối xứng của quầng sáng theo hướng gió / đối lưu (0..0.72) */
  plumeStretch: number
  /** Độ dịch nhiệt độ màu vật lý (-0.5 = đỏ cam trầm thiếu oxy / sụt áp, +0.4 = bùng sáng vàng trắng) */
  thermalDelta: number
  /** Pha thời gian truyền xuống shader để tia Tyndall chuyển động sống động */
  rayAnimPhase: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / Math.max(1e-5, e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Băm nhẹ deterministic từ ID layer để nhiều ngọn nến / đèn đường trong cùng cảnh không nháy trùng nhịp cơ học */
export function layerLightPhaseSeed(layerId: string): number {
  let h = 2166136261
  for (let i = 0; i < layerId.length; i++) {
    h ^= layerId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) * 0.0137
}

/** Giải quyết chế độ hành vi thực tế từ cấu hình 'auto' hoặc lựa chọn tường minh của người dùng */
export function resolveEffectiveLightBehavior(
  kind: VirtualLightKind,
  mode?: VirtualLightBehaviorMode
): Exclude<VirtualLightBehaviorMode, 'auto'> {
  if (mode && mode !== 'auto') return mode
  switch (kind) {
    case 'candle':
    case 'campfire':
      return 'wind_reactive'
    case 'flashlight':
      return 'steady'
    case 'bulb':
      return 'subtle_flicker'
    case 'cave_crystal':
    case 'magic_orb':
      return 'breathing'
    default:
      return 'steady'
  }
}

/** Mặc định vật lý cho tia tỉa Tyndall, hội tụ chóa đèn & ánh xạ môi trường theo từng loại nguồn sáng */
export function getDefaultOpticalProfile(kind: VirtualLightKind): {
  behaviorMode: VirtualLightBehaviorMode
  pulseDepth: number
  rayIntensity: number
  rayCount: number
  hotspotFocus: number
  envBounce: number
} {
  switch (kind) {
    case 'candle':
      return {
        behaviorMode: 'wind_reactive',
        pulseDepth: 0.22,
        rayIntensity: 0.24,
        rayCount: 10,
        hotspotFocus: 0.42,
        envBounce: 0.9
      }
    case 'campfire':
      return {
        behaviorMode: 'wind_reactive',
        pulseDepth: 0.3,
        rayIntensity: 0.3,
        rayCount: 12,
        hotspotFocus: 0.36,
        envBounce: 1.05
      }
    case 'flashlight':
      return {
        behaviorMode: 'steady',
        pulseDepth: 0.2,
        rayIntensity: 0.52,
        rayCount: 9,
        hotspotFocus: 0.62,
        envBounce: 0.92
      }
    case 'bulb':
      return {
        behaviorMode: 'subtle_flicker',
        pulseDepth: 0.1,
        rayIntensity: 0.28,
        rayCount: 12,
        hotspotFocus: 0.38,
        envBounce: 0.88
      }
    case 'cave_crystal':
      return {
        behaviorMode: 'breathing',
        pulseDepth: 0.24,
        rayIntensity: 0.38,
        rayCount: 11,
        hotspotFocus: 0.46,
        envBounce: 0.95
      }
    case 'magic_orb':
      return {
        behaviorMode: 'breathing',
        pulseDepth: 0.28,
        rayIntensity: 0.42,
        rayCount: 14,
        hotspotFocus: 0.44,
        envBounce: 0.92
      }
    default:
      return {
        behaviorMode: 'steady',
        pulseDepth: 0,
        rayIntensity: 0,
        rayCount: 8,
        hotspotFocus: 0.35,
        envBounce: 0.8
      }
  }
}

/**
 * Kiểm tra khoảng thời gian bật sáng `[startTime, startTime + duration]` của Node Ánh sáng,
 * kèm biên độ bừng sáng / tắt dịu vật lý (~0.09s) khi đèn bật/tắt giữa chừng cảnh.
 */
export function evaluateLightTimeEnvelope(vl: LayerVirtualLight, layer: Layer, t: number): number {
  const layerIn = layer.inPoint ?? 0
  const layerOut = layer.outPoint ?? 999999
  const hasStart = typeof vl.startTime === 'number' && Number.isFinite(vl.startTime)
  const hasDur = typeof vl.duration === 'number' && Number.isFinite(vl.duration) && vl.duration > 0
  if (!hasStart && !hasDur) return 1

  const start = hasStart ? vl.startTime! : layerIn
  const end = hasDur ? start + vl.duration! : layerOut
  if (t < start - 0.001 || t > end + 0.001) return 0

  let env = 1
  if (start > layerIn + 0.03) {
    env *= smoothstep(start, start + Math.min(0.1, (end - start) * 0.25), t)
  }
  if (end < layerOut - 0.03) {
    env *= 1 - smoothstep(end - Math.min(0.12, (end - start) * 0.25), end, t)
  }
  return clamp(env, 0, 1)
}

function rgb01ToHex(rgb: [number, number, number]): string {
  const toHex = (c: number): string =>
    Math.round(clamp(c, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

/**
 * Dịch chuyển nhiệt độ màu Blackbody vật lý khi ngọn lửa sụt/bùng oxy hoặc đèn pin sụt áp pin yếu:
 * - `thermalDelta < 0`: ngả ấm đỏ cam trầm (1750K–2000K).
 * - `thermalDelta > 0`: rực sáng vàng trắng nóng (2600K–3400K).
 */
export function shiftLightColorByThermalState(
  baseRgb: [number, number, number],
  thermalDelta: number
): { rgb: [number, number, number]; hex: string } {
  const d = clamp(thermalDelta, -0.55, 0.45)
  if (Math.abs(d) < 0.008) {
    return { rgb: baseRgb, hex: rgb01ToHex(baseRgb) }
  }
  let r = baseRgb[0]
  let g = baseRgb[1]
  let b = baseRgb[2]
  if (d < 0) {
    const coolLoss = -d
    r = clamp(r * (1 + coolLoss * 0.1), 0, 1)
    g = clamp(g * (1 - coolLoss * 0.34), 0, 1)
    b = clamp(b * (1 - coolLoss * 0.62), 0, 1)
  } else {
    r = clamp(r + (1 - r) * d * 0.35, 0, 1)
    g = clamp(g + (0.97 - g) * d * 0.42, 0, 1)
    b = clamp(b + (0.88 - b) * d * 0.48, 0, 1)
  }
  const rgb: [number, number, number] = [r, g, b]
  return { rgb, hex: rgb01ToHex(rgb) }
}

/**
 * Mô phỏng động lực học vật lý theo thời gian của từng nguồn sáng:
 * - Khí động học ngọn nến/lửa: hợp lực đối lưu thẳng đứng Archimedes + lực tạt ngang của gió (Lặng / Nhẹ / Mạnh / Bão).
 * - Quang học điện tử đèn pin/bóng đèn: ổn định vi rung, nhấp nháy nhẹ, nhịp đập thở, chập chờn sụt áp pin yếu, nháy cảnh báo.
 */
export function evaluatePhysicalSourceDynamics(
  vl: LayerVirtualLight,
  layerId: string,
  t: number,
  rotZDeg: number,
  defaultSpeed: number,
  defaultBeamDeg: number,
  isCone: boolean
): PhysicalLightDynamicsResult {
  const optDefaults = getDefaultOpticalProfile(vl.kind)
  const behavior = resolveEffectiveLightBehavior(vl.kind, vl.behaviorMode)
  const seed = layerLightPhaseSeed(layerId)
  const speed = Math.max(0.05, vl.flickerSpeed ?? defaultSpeed ?? 1.0)
  const depth = clamp(vl.pulseDepth ?? optDefaults.pulseDepth, 0, 1)
  const beamRad = (((vl.beamAngleDeg ?? defaultBeamDeg) + rotZDeg) * Math.PI) / 180
  const baseBeamDir: [number, number] = [Math.cos(beamRad), Math.sin(beamRad)]

  let intensityMul = 1
  let radiusMul = 1
  let windOffsetX = 0
  let windOffsetY = 0
  let plumeStretch = 0
  let plumeDir: [number, number] = isCone ? baseBeamDir : [0, 1]
  let thermalDelta = 0

  if (behavior === 'wind_reactive') {
    const presetWind = WIND_PRESET_STRENGTH[vl.windPreset ?? 'gentle'] ?? 0.38
    const rawWind = vl.windPreset !== undefined ? presetWind : (vl.windStrength ?? presetWind)
    const wEff = Math.max(0, rawWind * (vl.windSensitivity ?? 1.0))
    const windRad = ((vl.windDirectionDeg ?? 0) * Math.PI) / 180
    const wCos = Math.cos(windRad)
    const wSin = Math.sin(windRad)

    // Hợp lực khí động học giữa lực nâng đối lưu nhiệt thẳng đứng (0, +1) và áp lực gió ngang
    const forceX = wCos * wEff * 1.95
    const forceY = 1.0 + wSin * wEff * 1.35 - Math.min(0.62, wEff * 0.42)
    const fLen = Math.max(0.01, Math.hypot(forceX, forceY))
    plumeDir = [forceX / fLen, forceY / fLen]

    const flameScale = vl.kind === 'campfire' ? 1.38 : 1.0
    const depthScale = 0.55 + depth * 1.15

    if (wEff <= 0.04) {
      // 1. Lặng gió: Ngọn nến đứng thẳng do đối lưu nhiệt, vẫn có vi thở & nhấp nháy nhẹ tự nhiên (~4-7%)
      const slowConv = Math.sin(t * 2.3 * speed + seed) * 0.55 + Math.sin(t * 5.1 * speed + seed * 1.7) * 0.45
      const microDiff = smoothNoise(t * 2.8 * speed + seed, 3.1)
      const mod = (slowConv * 0.042 + microDiff * 0.026) * depthScale
      intensityMul = clamp(1 + mod, 0.84, 1.16)
      radiusMul = 1 + mod * 0.45
      windOffsetX = microDiff * 1.6 * flameScale
      windOffsetY = (1.5 + slowConv * 1.8) * flameScale
      plumeStretch = 0.11
      thermalDelta = mod * 0.8
    } else if (wEff <= 0.55) {
      // 2. Gió nhẹ: Ngọn lửa nghiêng mềm theo hướng gió, ánh sáng gợn sóng êm lên bề mặt môi trường xuôi gió
      const w1 = Math.sin(t * 4.8 * speed + seed)
      const w2 = Math.sin(t * 10.4 * speed + seed * 2.1 + 1.1) * 0.48
      const gust = 0.68 + 0.32 * smoothNoise(t * 2.1 + seed, 4.7)
      const swayPx = 26 * flameScale * wEff * gust
      windOffsetX = plumeDir[0] * swayPx - plumeDir[1] * w1 * 4.5 * wEff
      windOffsetY = (plumeDir[1] - 0.35) * swayPx * 0.55 + Math.abs(w1) * 3.5 * wEff
      const mod = (w1 * 0.13 + w2 * 0.08 + (gust - 0.68) * 0.25) * (wEff / 0.38) * depthScale
      intensityMul = clamp(1 + mod, 0.52, 1.28)
      radiusMul = clamp(1 + mod * 0.42, 0.78, 1.2)
      plumeStretch = clamp(0.14 + wEff * 0.42 * gust, 0.12, 0.38)
      thermalDelta = clamp(mod * 1.05, -0.24, 0.2)
    } else if (wEff <= 1.05) {
      // 3. Gió mạnh: Xoáy rối khí động, lửa tạt ngang, sụt tối đỏ cam khi bị gió đè & bùng vàng rực khi oxy ùa vào
      const fast1 = Math.sin(t * 13.5 * speed + seed)
      const fast2 = Math.sin(t * 24.2 * speed + seed * 1.4 + 0.7)
      const gustWave = smoothNoise(t * 4.8 * speed + seed, 8.3)
      const oxygenDip = gustWave < -0.22 ? (gustWave + 0.22) * 0.72 * wEff : 0
      const oxygenFlare = gustWave > 0.3 ? (gustWave - 0.3) * 0.55 * wEff : 0
      const turbulence = (fast1 * 0.18 + fast2 * 0.12) * Math.min(1.25, wEff) * depthScale
      const netDelta = oxygenDip + oxygenFlare + turbulence
      intensityMul = clamp(1 + netDelta, 0.34, 1.34)
      radiusMul = clamp(1 + netDelta * 0.38, 0.64, 1.24)
      const blowDist = 46 * flameScale * wEff * (0.76 + 0.28 * Math.abs(fast1))
      windOffsetX = wCos * blowDist - wSin * fast2 * 8.5 * wEff
      windOffsetY = wSin * blowDist - Math.abs(fast1) * 6.5 * wEff
      plumeStretch = clamp(0.34 + (wEff - 0.5) * 0.44, 0.28, 0.58)
      thermalDelta = clamp(netDelta * 0.95, -0.42, 0.3)
    } else {
      // 4. Gió bão giật: Chớp giật hỗn loạn, có nhịp hụt tắt phụt (near-blowout) xuống ~16% rồi bùng quật dữ dội
      const whip1 = Math.sin(t * 19.5 * speed + seed)
      const whip2 = Math.sin(t * 33.0 * speed + seed * 1.9)
      const stormGust = smoothNoise(t * 7.6 * speed + seed, 11.4)
      const nearBlowout = stormGust < -0.32 ? -0.76 : 0
      const flare = nearBlowout + (whip1 * 0.22 + whip2 * 0.15 + stormGust * 0.26) * depthScale
      intensityMul = clamp(1 + flare, 0.15, 1.42)
      radiusMul = clamp(1 + flare * 0.4, 0.48, 1.28)
      const blowDist = 62 * flameScale * Math.min(1.45, wEff) * (0.78 + 0.32 * Math.abs(whip1))
      windOffsetX = wCos * blowDist - wSin * whip2 * 12
      windOffsetY = wSin * blowDist - (4 + Math.abs(whip1) * 9)
      plumeStretch = clamp(0.54 + Math.abs(stormGust) * 0.16, 0.48, 0.7)
      thermalDelta = nearBlowout < 0 ? -0.48 : clamp(flare * 0.85, -0.45, 0.34)
    }
  } else if (behavior === 'steady') {
    const micro = smoothNoise(t * 1.8 * speed + seed, 1.9) * 0.015 + Math.sin(t * 2.4 * speed + seed) * 0.008
    intensityMul = 1 + micro * (0.4 + depth)
    radiusMul = 1 + micro * 0.25
  } else if (behavior === 'subtle_flicker') {
    const amp = 0.04 + depth * 0.18
    const n1 = smoothNoise(t * 4.2 * speed + seed, 2.7)
    const n2 = Math.sin(t * 7.6 * speed + seed * 1.3) * 0.42 + Math.sin(t * 3.1 * speed + seed) * 0.58
    const mod = (n1 * 0.55 + n2 * 0.45) * amp
    intensityMul = clamp(1 + mod, 0.55, 1.24)
    radiusMul = 1 + mod * 0.35
    thermalDelta = mod * 0.75
  } else if (behavior === 'breathing') {
    const amp = 0.08 + depth * 0.42
    const wave = Math.sin(t * speed * Math.PI * 1.6 + seed)
    // Dạng sóng nhịp thở tự nhiên: đỉnh tròn đầy, đáy êm dịu không tắt đột ngột
    const shaped = wave * 0.78 + Math.sin(t * speed * Math.PI * 3.2 + seed) * 0.12
    intensityMul = clamp(1 + shaped * amp, 0.35, 1.45)
    radiusMul = clamp(1 + shaped * amp * 0.48, 0.7, 1.32)
    thermalDelta = shaped * amp * 0.45
  } else if (behavior === 'intermittent') {
    // Đèn pin sắp hết pin / bóng đèn đường lỏng mạch: sáng bình thường xen các cụm sụt áp chập chờn
    const severity = 0.25 + depth * 0.75
    const clusterEnv = smoothNoise(t * 1.35 * speed + seed, 5.4)
    const rapidChatter = smoothNoise(t * 16.5 * speed + seed * 2.3, 9.7)
    const contactSpike = Math.sin(t * 27.0 * speed + seed)
    if (clusterEnv < -0.08) {
      const dipStrength = clamp((-clusterEnv - 0.08) * 1.85, 0, 1) * severity
      const chatterGate = rapidChatter < 0.12 || contactSpike < -0.35 ? 1 : 0.28
      const drop = dipStrength * chatterGate * 0.82
      intensityMul = clamp(1 - drop, 0.14, 1.05)
      radiusMul = clamp(1 - drop * 0.32, 0.65, 1.04)
      thermalDelta = -drop * 0.52
    } else {
      const hum = Math.sin(t * 11.0 * speed + seed) * 0.022 * severity
      intensityMul = 1 + hum
      radiusMul = 1 + hum * 0.2
    }
  } else if (behavior === 'strobe') {
    const duty = 0.32
    const cyc = ((t * Math.max(0.4, speed * 1.6) + seed * 0.2) % 1 + 1) % 1
    const floor = clamp(1 - (0.45 + depth * 0.52), 0.04, 0.6)
    const pulse = cyc < duty ? 1 - smoothstep(duty * 0.55, duty, cyc) * 0.35 : 0
    intensityMul = floor + (1.15 - floor) * pulse
    radiusMul = 0.86 + 0.22 * pulse
    thermalDelta = (pulse - 0.4) * 0.28
  }

  const finalPlumeVector: [number, number] = isCone
    ? baseBeamDir
    : [plumeDir[0] * plumeStretch, plumeDir[1] * plumeStretch]

  return {
    effectiveBehavior: behavior,
    intensityMultiplier: intensityMul,
    radiusMultiplier: radiusMul,
    windOffset: [windOffsetX, windOffsetY],
    plumeVector: finalPlumeVector,
    plumeStretch: isCone ? 0 : plumeStretch,
    thermalDelta,
    rayAnimPhase: (t * (0.35 + speed * 0.22) + seed) % 62.8318
  }
}

/**
 * Hàm tỉa tia sáng khí quyển Tyndall / Crepuscular Rays đồng nhất 100% với GLSL shader:
 * Trả về hệ số điều biến tia sáng (ví dụ 0.72 .. 1.38) tại góc cực `thetaRad` và bán kính chuẩn hoá `rNorm`.
 */
export function computePhysicalRayStriation(
  thetaRad: number,
  rNorm: number,
  rayIntensity: number,
  rayCount: number,
  animPhase: number,
  isCone: boolean
): number {
  const amt = clamp(rayIntensity, 0, 1)
  if (amt <= 0.01 || rNorm <= 0.04) return 1

  const count = Math.max(3, Math.min(24, Math.round(rayCount || (isCone ? 9 : 12))))
  const freq = isCone ? count * 2.2 : count
  const s1 = Math.sin(thetaRad * freq + animPhase * 0.75)
  const s2 = Math.sin(thetaRad * (freq * 1.93) - animPhase * 0.52 + 1.4)
  const s3 = Math.sin(thetaRad * (freq * 3.17) + animPhase * 1.15 + 2.7)
  const rawWave = s1 * 0.52 + s2 * 0.31 + s3 * 0.17
  const ridge = Math.pow(clamp(rawWave * 0.5 + 0.5, 0, 1), 1.55)

  const emerge = smoothstep(0.05, 0.26, rNorm)
  const outerFade = 1 - smoothstep(0.75, 1.06, rNorm) * 0.35
  const envelope = emerge * outerFade
  return 1 + (ridge - 0.42) * amt * 0.82 * envelope
}

/** Tóm tắt ngắn gọn trạng thái vật lý nguồn sáng bằng tiếng Việt cho thẻ Inspector */
export function describeActiveLightPhysicsVi(vl: LayerVirtualLight): string {
  const mode = resolveEffectiveLightBehavior(vl.kind, vl.behaviorMode)
  const rays = (vl.rayIntensity ?? getDefaultOpticalProfile(vl.kind).rayIntensity) > 0.05
  const raySuffix = rays ? ` · Tỉa ${vl.rayCount ?? getDefaultOpticalProfile(vl.kind).rayCount} luồng tia` : ''

  if (mode === 'wind_reactive') {
    const wp = vl.windPreset ?? 'gentle'
    if (wp === 'none') return `Đối lưu thẳng đứng lặng gió · Nhấp nháy nhẹ tự nhiên (~5%)${raySuffix}`
    if (wp === 'gentle') return `Gió nhẹ nghiêng lửa ~26° · Gợn sáng ấm xuôi gió${raySuffix}`
    if (wp === 'strong') return `Gió mạnh tạt ngang ~62° · Sụt/bùng oxy & đổi nhiệt màu${raySuffix}`
    return `Gió bão quật bạt lửa · Hụt tắt phụt & quét bóng dữ dội${raySuffix}`
  }
  if (mode === 'intermittent') return `Chập chờn sụt áp (pin yếu / lỏng mạch) · Đỏ ấm khi tụt sáng${raySuffix}`
  if (mode === 'breathing') return `Nhịp đập / thở ánh sáng êm (${(vl.flickerSpeed ?? 0.9).toFixed(1)}Hz)${raySuffix}`
  if (mode === 'subtle_flicker') return `Nhấp nháy vi mô ấm áp tự nhiên${raySuffix}`
  if (mode === 'strobe') return `Nháy nhịp cảnh báo / chớp sáng dứt khoát${raySuffix}`
  return `Nguồn sáng ổn định · Chiếu & phản xạ xuyên môi trường${raySuffix}`
}
