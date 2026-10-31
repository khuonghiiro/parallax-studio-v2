import type {
  DepthPortalConfig,
  LayerVirtualLight,
  VirtualLightBehaviorMode,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import { getDefaultOpticalProfile, WIND_PRESET_STRENGTH } from './virtualLightPhysics'

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
  behaviorMode: VirtualLightBehaviorMode
  pulseDepth: number
  rayIntensity: number
  rayCount: number
  hotspotFocus: number
  envBounce: number
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
    beamCurvature: 0.25,
    ...getDefaultOpticalProfile('none')
  },
  candle: {
    kind: 'candle',
    label: '🕯️ Ánh nến / Ngọn đuốc (Đối lưu & Nhạy gió)',
    badge: '🕯️ Ánh nến',
    description:
      'Ngọn lửa đối lưu thẳng đứng kèm nhấp nháy nhẹ khi lặng gió; nghiêng êm khi gió nhẹ; bạt ngang, sụt/bùng oxy và đổi nhiệt màu khi gió mạnh.',
    color: '#ff9d3b',
    intensity: 1.0,
    radius: 460,
    coneAngleDeg: 360,
    beamAngleDeg: 90,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.2,
    zReach: 1500,
    ambientDim: 0.24,
    softness: 0.55,
    beamCurvature: 0.35,
    ...getDefaultOpticalProfile('candle')
  },
  flashlight: {
    kind: 'flashlight',
    label: '🔦 Đèn pin / Đèn pha (Chóa hội tụ & Tia khí quyển)',
    badge: '🔦 Đèn pin',
    description:
      'Chùm nón 2 vùng (lõi Hotspot hội tụ + vành Spill lan môi trường), tỉa tia Tyndall xuyên không trung; hỗ trợ ổn định, nhịp đập nhẹ hoặc chập chờn pin yếu.',
    color: '#ffe6a3',
    intensity: 1.15,
    radius: 760,
    coneAngleDeg: 52,
    beamAngleDeg: -90,
    windPreset: 'none',
    flickerSpeed: 0.85,
    zReach: 1800,
    ambientDim: 0.28,
    softness: 0.42,
    beamCurvature: 0.25,
    ...getDefaultOpticalProfile('flashlight')
  },
  bulb: {
    kind: 'bulb',
    label: '💡 Bóng đèn điện / Đèn đường (Tỏa môi trường)',
    badge: '💡 Bóng đèn',
    description:
      'Nguồn sáng điện tỏa tròn 360° hoặc chao vòm chiếu xuống, tỉa tia tán xạ nhẹ và phản xạ ấm lên các layer lân cận.',
    color: '#ffe6a3',
    intensity: 1.0,
    radius: 560,
    coneAngleDeg: 360,
    beamAngleDeg: -90,
    windPreset: 'none',
    flickerSpeed: 0.65,
    zReach: 1600,
    ambientDim: 0.2,
    softness: 0.6,
    beamCurvature: 0.45,
    ...getDefaultOpticalProfile('bulb')
  },
  campfire: {
    kind: 'campfire',
    label: '🔥 Lửa trại / Lò rèn (Bập bùng & Ánh xạ mạnh)',
    badge: '🔥 Lửa trại',
    description:
      'Quầng lửa rộng cam đỏ rực rỡ, đối lưu bập bùng, đổi nhiệt màu theo gió và hắt ánh sáng ấm rộng ra toàn cảnh.',
    color: '#ff7828',
    intensity: 1.14,
    radius: 640,
    coneAngleDeg: 360,
    beamAngleDeg: 90,
    windPreset: 'gentle',
    windSensitivity: 1.0,
    flickerSpeed: 1.45,
    zReach: 1650,
    ambientDim: 0.28,
    softness: 0.52,
    beamCurvature: 0.4,
    ...getDefaultOpticalProfile('campfire')
  },
  cave_crystal: {
    kind: 'cave_crystal',
    label: '🔮 Tinh thể Hang động (Nhịp thở & Tỉa tia)',
    badge: '🔮 Tinh thể',
    description:
      'Ánh sáng lam ngọc có nhịp đập thở nhẹ và tỉa tia khúc xạ từ lòng hang, cứu sáng nổi khối nhân vật trong vùng tối.',
    color: '#38bdf8',
    intensity: 1.05,
    radius: 500,
    coneAngleDeg: 360,
    beamAngleDeg: 0,
    windPreset: 'none',
    flickerSpeed: 0.72,
    zReach: 1500,
    ambientDim: 0.26,
    softness: 0.5,
    beamCurvature: 0.35,
    ...getDefaultOpticalProfile('cave_crystal')
  },
  magic_orb: {
    kind: 'magic_orb',
    label: '✨ Cầu phép thuật / Đom đóm (Nhịp thở huyền ảo)',
    badge: '✨ Phép thuật',
    description:
      'Quầng sáng tím hồng co giãn theo nhịp thở êm ái, tỉa tia hào quang mảnh ra môi trường xung quanh.',
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
    beamCurvature: 0.4,
    ...getDefaultOpticalProfile('magic_orb')
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

export const WIND_STRENGTH_VALUES: Record<WindStrengthPreset, number> = WIND_PRESET_STRENGTH

export function createDefaultVirtualLight(kind: VirtualLightKind = 'candle'): LayerVirtualLight {
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
    beamCurvature: preset.beamCurvature,
    behaviorMode: preset.behaviorMode,
    pulseDepth: preset.pulseDepth,
    rayIntensity: preset.rayIntensity,
    rayCount: preset.rayCount,
    hotspotFocus: preset.hotspotFocus,
    envBounce: preset.envBounce
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
