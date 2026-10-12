import type { GlowSide } from '@shared/types'
import { MOTION_EFFECT_PRESETS, type MotionEffectPresetId } from '../../animation/motionEffects'

export type FxPresetId =
  | MotionEffectPresetId
  | 'blink'
  | 'fadeIn'
  | 'fadeOut'
  | 'breathe'
  | 'shake'
  | 'popIn'
  | 'pulse'
  | 'neonBreathe'
  | 'neonBlink'
  | 'neonFlicker'
  | 'neonSolid'

export interface FxPresetInfo {
  id: FxPresetId
  name: string
  badge: string
  description: string
  defaultDuration: number
  category: 'opacity' | 'transform' | 'glow' | 'motion'
}

export const FX_PRESETS: FxPresetInfo[] = [
  ...MOTION_EFFECT_PRESETS.map((p) => ({ ...p, badge: 'FX', defaultDuration: 3, category: 'motion' as const })),
  {
    id: 'neonBreathe',
    name: 'Viền Neon Thở (Breathe)',
    badge: '✨',
    description: 'Viền phát sáng neon bám nét ảnh, mờ dần rồi tỏ sáng tuần hoàn huyền ảo',
    defaultDuration: 1.5,
    category: 'glow'
  },
  {
    id: 'neonBlink',
    name: 'Viền Neon Nhấp nháy (Blink)',
    badge: '🚨',
    description: 'Viền phát sáng neon chớp tắt dứt khoát như đèn tín hiệu / biển hiệu',
    defaultDuration: 1.0,
    category: 'glow'
  },
  {
    id: 'neonFlicker',
    name: 'Viền Neon Chập chờn (Flicker)',
    badge: '💡',
    description: 'Viền phát sáng neon chập chờn tự nhiên như bóng đèn huỳnh quang',
    defaultDuration: 1.2,
    category: 'glow'
  },
  {
    id: 'neonSolid',
    name: 'Viền Neon Tĩnh (Solid Glow)',
    badge: '🔮',
    description: 'Viền phát sáng neon rực rỡ bám sát nét vẽ (sáng liên tục)',
    defaultDuration: 1.0,
    category: 'glow'
  },
  {
    id: 'blink',
    name: 'Nhấp nháy (Blink)',
    badge: '⚡',
    description: 'Chớp tắt liên tục (đèn neon, cảnh báo, chớp mắt)',
    defaultDuration: 1.0,
    category: 'opacity'
  },
  {
    id: 'fadeOut',
    name: 'Mờ dần (Fade Out)',
    badge: '🌓',
    description: 'Từ sáng rõ biến mất dần về 0%',
    defaultDuration: 1.0,
    category: 'opacity'
  },
  {
    id: 'fadeIn',
    name: 'Hiện dần (Fade In)',
    badge: '🌕',
    description: 'Từ mờ đục xuất hiện rõ dần lên 100%',
    defaultDuration: 1.0,
    category: 'opacity'
  },
  {
    id: 'breathe',
    name: 'Thở mờ ảo (Breathe)',
    badge: '💓',
    description: 'Mờ xuống rồi sáng lại một nhịp huyền ảo',
    defaultDuration: 1.2,
    category: 'opacity'
  },
  {
    id: 'shake',
    name: 'Rung chấn (Shake)',
    badge: '📳',
    description: 'Rung lắc vị trí khi có va chạm / giật mình rồi đứng yên',
    defaultDuration: 0.45,
    category: 'transform'
  },
  {
    id: 'popIn',
    name: 'Nảy xuất hiện (Pop In)',
    badge: '🔍',
    description: 'Phóng to đàn hồi hoạt hình (từ 0% nảy lên 115% rồi chuẩn)',
    defaultDuration: 0.5,
    category: 'transform'
  },
  {
    id: 'pulse',
    name: 'Nhịp đập (Pulse Scale)',
    badge: '💥',
    description: 'Phóng to thu nhỏ 1 nhịp dồn dập',
    defaultDuration: 0.4,
    category: 'transform'
  }
]

export interface ApplyFxOptions {
  duration?: number
  targetTime?: number
  intensity?: number
  blinks?: number
  shakes?: number
  bounces?: number
  pulses?: number
  count?: number
  color?: string
  thickness?: number
  side?: GlowSide
  speed?: number
  minIntensity?: number
}

