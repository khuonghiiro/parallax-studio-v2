import type { Animatable, EaseName, GlowSide, Vec3 } from '@shared/types'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { frameTolerance, useEditor } from '../../store/editor'
import { useToast } from '../../actions'

const toast = (m: string): void => useToast.getState().show(m)

export type FxPresetId =
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
  category: 'opacity' | 'transform' | 'glow'
}

export const FX_PRESETS: FxPresetInfo[] = [
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
  color?: string
  thickness?: number
  side?: GlowSide
  speed?: number
  minIntensity?: number
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function generateBlinkKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  blinks = 4,
  minVal = 0.05,
  tol = 1e-4
): void {
  const currentVal = Math.max(0.1, evaluate(target, start))
  const step = duration / blinks
  addKeyframe(target, round3(start), currentVal, 'easeInOut', tol)

  for (let i = 0; i < blinks; i++) {
    const tMid = round3(start + i * step + step * 0.5)
    const tEnd = round3(start + (i + 1) * step)
    addKeyframe(target, tMid, minVal, 'easeInOut', tol)
    addKeyframe(target, tEnd, currentVal, 'easeInOut', tol)
  }
}

function generateBreatheKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  minVal = 0.2,
  tol = 1e-4
): void {
  const currentVal = Math.max(0.2, evaluate(target, start))
  addKeyframe(target, round3(start), currentVal, 'easeInOut', tol)
  addKeyframe(target, round3(start + duration * 0.5), minVal, 'easeInOut', tol)
  addKeyframe(target, round3(start + duration), currentVal, 'easeInOut', tol)
}

function generateFadeKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  mode: 'in' | 'out',
  tol = 1e-4
): void {
  if (mode === 'out') {
    const currentVal = Math.max(0.1, evaluate(target, start))
    addKeyframe(target, round3(start), currentVal, 'easeInOut', tol)
    addKeyframe(target, round3(start + duration), 0, 'easeInOut', tol)
  } else {
    addKeyframe(target, round3(start), 0, 'easeInOut', tol)
    addKeyframe(target, round3(start + duration), 1, 'easeInOut', tol)
  }
}

function generateShakeKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  intensity = 18,
  shakes = 5,
  tol = 1e-4
): void {
  const orig = evaluate(target, start)
  addKeyframe(target, round3(start), [...orig] as Vec3, 'easeInOut', tol)

  const step = duration / (shakes + 1)
  const offsets: [number, number][] = [
    [intensity, -intensity * 0.4],
    [-intensity * 0.85, intensity * 0.6],
    [intensity * 0.6, -intensity * 0.7],
    [-intensity * 0.4, intensity * 0.3],
    [intensity * 0.2, -intensity * 0.15]
  ]

  for (let i = 0; i < shakes; i++) {
    const t = round3(start + (i + 1) * step)
    const off = offsets[i % offsets.length]
    const p: Vec3 = [orig[0] + off[0], orig[1] + off[1], orig[2]]
    addKeyframe(target, t, p, 'easeInOut', tol)
  }

  addKeyframe(target, round3(start + duration), [...orig] as Vec3, 'easeInOut', tol)
}

function generatePopInKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  tol = 1e-4
): void {
  const orig = evaluate(target, start)
  const baseScale: Vec3 = [orig[0] || 1, orig[1] || 1, orig[2] || 1]

  addKeyframe(target, round3(start), [0.001, 0.001, 1], 'easeOut', tol)
  addKeyframe(
    target,
    round3(start + duration * 0.65),
    [baseScale[0] * 1.18, baseScale[1] * 1.18, 1],
    'easeInOut',
    tol
  )
  addKeyframe(
    target,
    round3(start + duration * 0.85),
    [baseScale[0] * 0.95, baseScale[1] * 0.95, 1],
    'easeInOut',
    tol
  )
  addKeyframe(target, round3(start + duration), baseScale, 'easeOut', tol)
}

function generatePulseKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  factor = 1.25,
  tol = 1e-4
): void {
  const orig = evaluate(target, start)
  const baseScale: Vec3 = [orig[0] || 1, orig[1] || 1, orig[2] || 1]

  addKeyframe(target, round3(start), baseScale, 'easeInOut', tol)
  addKeyframe(
    target,
    round3(start + duration * 0.45),
    [baseScale[0] * factor, baseScale[1] * factor, 1],
    'easeInOut',
    tol
  )
  addKeyframe(target, round3(start + duration), baseScale, 'easeInOut', tol)
}

/**
 * Apply an animation FX preset at playhead or specified time on the currently selected layer.
 */
export function applyFxPresetToSelectedLayer(presetId: FxPresetId, options?: ApplyFxOptions): boolean {
  const st = useEditor.getState()
  const { selectedLayerId, project } = st
  if (!selectedLayerId) {
    toast('Hãy chọn một layer trước khi áp dụng hiệu ứng')
    return false
  }

  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return false
  if (layer.locked) {
    toast('Layer đang bị khóa, hãy mở khóa trước')
    return false
  }

  const preset = FX_PRESETS.find((p) => p.id === presetId)
  if (!preset) return false

  const start = options?.targetTime ?? st.time
  const duration = Math.max(0.1, options?.duration ?? preset.defaultDuration)
  const tol = frameTolerance(project)

  st.update((d) => {
    const l = d.layers.find((x) => x.id === selectedLayerId)
    if (!l) return

    switch (presetId) {
      case 'blink':
        generateBlinkKeys(l.transform.opacity, start, duration, options?.blinks ?? 4, 0.05, tol)
        break
      case 'fadeOut':
        generateFadeKeys(l.transform.opacity, start, duration, 'out', tol)
        break
      case 'fadeIn':
        generateFadeKeys(l.transform.opacity, start, duration, 'in', tol)
        break
      case 'breathe':
        generateBreatheKeys(l.transform.opacity, start, duration, 0.2, tol)
        break
      case 'shake':
        generateShakeKeys(l.transform.position, start, duration, options?.intensity ?? 18, 5, tol)
        break
      case 'popIn':
        generatePopInKeys(l.transform.scale, start, duration, tol)
        break
      case 'pulse':
        generatePulseKeys(l.transform.scale, start, duration, 1.25, tol)
        break
      case 'neonBreathe':
        l.glow = {
          enabled: true,
          startTime: start,
          duration: options?.duration !== undefined ? options.duration : duration,
          side: options?.side ?? 'outer',
          color: options?.color ?? '#3dd6f5',
          thickness: options?.thickness ?? 10,
          intensity: options?.intensity ?? 1.5,
          animated: 'breathe',
          speed: options?.speed ?? (duration > 0 ? 1 / duration : 1.5),
          minIntensity: options?.minIntensity ?? 0.15
        }
        break
      case 'neonBlink':
        l.glow = {
          enabled: true,
          startTime: start,
          duration: options?.duration !== undefined ? options.duration : duration,
          side: options?.side ?? 'outer',
          color: options?.color ?? '#f59e0b',
          thickness: options?.thickness ?? 10,
          intensity: options?.intensity ?? 1.6,
          animated: 'blink',
          speed: options?.speed ?? (options?.blinks && duration > 0 ? options.blinks / duration : 2.0),
          minIntensity: options?.minIntensity ?? 0.1
        }
        break
      case 'neonFlicker':
        l.glow = {
          enabled: true,
          startTime: start,
          duration: options?.duration !== undefined ? options.duration : duration,
          side: options?.side ?? 'outer',
          color: options?.color ?? '#ec4899',
          thickness: options?.thickness ?? 12,
          intensity: options?.intensity ?? 1.8,
          animated: 'flicker',
          speed: options?.speed ?? 2.5,
          minIntensity: options?.minIntensity ?? 0.15
        }
        break
      case 'neonSolid':
        l.glow = {
          enabled: true,
          startTime: start,
          duration: options?.duration !== undefined ? options.duration : duration,
          side: options?.side ?? 'outer',
          color: options?.color ?? '#3dd6f5',
          thickness: options?.thickness ?? 8,
          intensity: options?.intensity ?? 1.3,
          animated: 'none'
        }
        break
    }
  })

  const durText = (options?.duration === 0) ? 'suốt layer' : `${duration.toFixed(1)}s`
  toast(`${preset.badge} Đã tạo hiệu ứng "${preset.name}" (${durText}) tại ${start.toFixed(2)}s`)
  return true
}
