import { nanoid } from 'nanoid'
import type { Animatable, AppliedLayerEffect, EaseName, GlowSide, Keyframe, Vec3 } from '@shared/types'
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
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  const currentVal = Math.max(0.1, evaluate(target, start))
  const step = duration / blinks
  keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))

  for (let i = 0; i < blinks; i++) {
    const tMid = round3(start + i * step + step * 0.5)
    const tEnd = round3(start + (i + 1) * step)
    keys.push(addKeyframe(target, tMid, minVal, 'easeInOut', tol))
    keys.push(addKeyframe(target, tEnd, currentVal, 'easeInOut', tol))
  }
  return keys
}

function generateBreatheKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  minVal = 0.2,
  tol = 1e-4
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  const currentVal = Math.max(0.2, evaluate(target, start))
  keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))
  keys.push(addKeyframe(target, round3(start + duration * 0.5), minVal, 'easeInOut', tol))
  keys.push(addKeyframe(target, round3(start + duration), currentVal, 'easeInOut', tol))
  return keys
}

function generateFadeKeys(
  target: Animatable<number>,
  start: number,
  duration: number,
  mode: 'in' | 'out',
  tol = 1e-4
): Keyframe<number>[] {
  const keys: Keyframe<number>[] = []
  if (mode === 'out') {
    const currentVal = Math.max(0.1, evaluate(target, start))
    keys.push(addKeyframe(target, round3(start), currentVal, 'easeInOut', tol))
    keys.push(addKeyframe(target, round3(start + duration), 0, 'easeInOut', tol))
  } else {
    keys.push(addKeyframe(target, round3(start), 0, 'easeInOut', tol))
    keys.push(addKeyframe(target, round3(start + duration), 1, 'easeInOut', tol))
  }
  return keys
}

function generateShakeKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  intensity = 18,
  shakes = 5,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const orig = evaluate(target, start)
  keys.push(addKeyframe(target, round3(start), [...orig] as Vec3, 'easeInOut', tol))

  const count = Math.max(1, shakes)
  const step = duration / (count + 1)
  const basePatterns: [number, number][] = [
    [1.0, -0.4],
    [-0.85, 0.6],
    [0.6, -0.7],
    [-0.4, 0.3],
    [0.2, -0.15]
  ]

  for (let i = 0; i < count; i++) {
    const t = round3(start + (i + 1) * step)
    const decay = 1.0 - (i / count) * 0.65
    const pattern = basePatterns[i % basePatterns.length]
    const offX = Math.round(pattern[0] * intensity * decay * 10) / 10
    const offY = Math.round(pattern[1] * intensity * decay * 10) / 10
    const p: Vec3 = [orig[0] + offX, orig[1] + offY, orig[2]]
    keys.push(addKeyframe(target, t, p, 'easeInOut', tol))
  }

  keys.push(addKeyframe(target, round3(start + duration), [...orig] as Vec3, 'easeInOut', tol))
  return keys
}

function generatePopInKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  bounces = 2,
  bounceScale = 1.2,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const orig = evaluate(target, start)
  const baseScale: Vec3 = [orig[0] || 1, orig[1] || 1, orig[2] || 1]

  keys.push(addKeyframe(target, round3(start), [0.001, 0.001, 1], 'easeOut', tol))

  const numBounces = Math.max(1, bounces)
  const riseRatio = Math.min(0.5, 0.3 + 0.15 / numBounces)
  const riseTime = duration * riseRatio
  const bounceWindow = duration - riseTime
  const stepTime = bounceWindow / (numBounces * 2)

  let peakExcess = Math.max(0.06, bounceScale - 1.0)

  for (let i = 0; i < numBounces; i++) {
    const tPeak = round3(start + riseTime + i * 2 * stepTime)
    const peakFactor = round3(1.0 + peakExcess)
    keys.push(
      addKeyframe(
        target,
        tPeak,
        [round3(baseScale[0] * peakFactor), round3(baseScale[1] * peakFactor), 1],
        'easeInOut',
        tol
      )
    )

    if (i < numBounces - 1) {
      const tValley = round3(start + riseTime + (i * 2 + 1) * stepTime)
      const valleyFactor = round3(1.0 - peakExcess * 0.4)
      keys.push(
        addKeyframe(
          target,
          tValley,
          [round3(baseScale[0] * valleyFactor), round3(baseScale[1] * valleyFactor), 1],
          'easeInOut',
          tol
        )
      )
    }

    peakExcess *= 0.35
  }

  keys.push(addKeyframe(target, round3(start + duration), baseScale, 'easeOut', tol))
  return keys
}

function generatePulseKeys(
  target: Animatable<Vec3>,
  start: number,
  duration: number,
  pulses = 1,
  factor = 1.25,
  tol = 1e-4
): Keyframe<Vec3>[] {
  const keys: Keyframe<Vec3>[] = []
  const orig = evaluate(target, start)
  const baseScale: Vec3 = [orig[0] || 1, orig[1] || 1, orig[2] || 1]

  const count = Math.max(1, pulses)
  const cycleDur = duration / count

  keys.push(addKeyframe(target, round3(start), baseScale, 'easeInOut', tol))

  for (let i = 0; i < count; i++) {
    const cycleStart = start + i * cycleDur
    const midT = round3(cycleStart + cycleDur * 0.45)
    const endT = round3(cycleStart + cycleDur)

    keys.push(
      addKeyframe(
        target,
        midT,
        [round3(baseScale[0] * factor), round3(baseScale[1] * factor), 1],
        'easeInOut',
        tol
      )
    )
    keys.push(addKeyframe(target, endT, baseScale, 'easeInOut', tol))
  }
  return keys
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

    let createdKeyIds: string[] = []
    let targetProp: 'opacity' | 'position' | 'scale' | undefined = undefined

    switch (presetId) {
      case 'blink':
        targetProp = 'opacity'
        createdKeyIds = generateBlinkKeys(l.transform.opacity, start, duration, options?.blinks ?? 4, 0.05, tol).map((k) => k.id)
        break
      case 'fadeOut':
        targetProp = 'opacity'
        createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'out', tol).map((k) => k.id)
        break
      case 'fadeIn':
        targetProp = 'opacity'
        createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'in', tol).map((k) => k.id)
        break
      case 'breathe':
        targetProp = 'opacity'
        createdKeyIds = generateBreatheKeys(l.transform.opacity, start, duration, 0.2, tol).map((k) => k.id)
        break
      case 'shake': {
        targetProp = 'position'
        const count = options?.shakes ?? options?.count ?? 5
        const intensity = options?.intensity ?? 18
        createdKeyIds = generateShakeKeys(
          l.transform.position,
          start,
          duration,
          intensity,
          count,
          tol
        ).map((k) => k.id)
        break
      }
      case 'popIn': {
        targetProp = 'scale'
        const count = options?.bounces ?? options?.count ?? 2
        const intensity = options?.intensity ?? 1.2
        createdKeyIds = generatePopInKeys(
          l.transform.scale,
          start,
          duration,
          count,
          intensity,
          tol
        ).map((k) => k.id)
        break
      }
      case 'pulse': {
        targetProp = 'scale'
        const count = options?.pulses ?? options?.count ?? 2
        const intensity = options?.intensity ?? 1.25
        createdKeyIds = generatePulseKeys(
          l.transform.scale,
          start,
          duration,
          count,
          intensity,
          tol
        ).map((k) => k.id)
        break
      }
      case 'neonBreathe': {
        const glowConfig: LayerGlow = {
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
        l.glow = glowConfig
        break
      }
      case 'neonBlink': {
        const glowConfig: LayerGlow = {
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
        l.glow = glowConfig
        break
      }
      case 'neonFlicker': {
        const glowConfig: LayerGlow = {
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
        l.glow = glowConfig
        break
      }
      case 'neonSolid': {
        const glowConfig: LayerGlow = {
          enabled: true,
          startTime: start,
          duration: options?.duration !== undefined ? options.duration : duration,
          side: options?.side ?? 'outer',
          color: options?.color ?? '#3dd6f5',
          thickness: options?.thickness ?? 8,
          intensity: options?.intensity ?? 1.3,
          animated: 'none'
        }
        l.glow = glowConfig
        break
      }
    }

    let count: number | undefined = undefined
    if (presetId === 'blink' || presetId === 'neonBlink') count = options?.blinks ?? 4
    else if (presetId === 'shake') count = options?.shakes ?? options?.count ?? 5
    else if (presetId === 'popIn') count = options?.bounces ?? options?.count ?? 2
    else if (presetId === 'pulse') count = options?.pulses ?? options?.count ?? 2

    // Record applied effect instance for distinct icon & stack management
    if (!l.appliedEffects) l.appliedEffects = []
    l.appliedEffects.push({
      id: `fx-${nanoid(6)}`,
      presetId,
      name: preset.name,
      badge: preset.badge,
      category: preset.category,
      startTime: start,
      duration: options?.duration !== undefined ? options.duration : duration,
      enabled: true,
      targetProp,
      keyframeIds: createdKeyIds,
      glow: preset.category === 'glow' && l.glow ? { ...l.glow } : undefined,
      count,
      intensity: options?.intensity
    })
  })

  const countLabel =
    presetId === 'shake'
      ? ` · ${options?.shakes ?? options?.count ?? 5} lần rung`
      : presetId === 'popIn'
      ? ` · ${options?.bounces ?? options?.count ?? 2} lần nảy`
      : presetId === 'pulse'
      ? ` · ${options?.pulses ?? options?.count ?? 2} nhịp đập`
      : presetId === 'blink' || presetId === 'neonBlink'
      ? ` · ${options?.blinks ?? 4} chớp`
      : ''
  const durText = options?.duration === 0 ? 'suốt layer' : `${duration.toFixed(1)}s`
  toast(`${preset.badge} Đã tạo hiệu ứng "${preset.name}" (${durText}${countLabel}) tại ${start.toFixed(2)}s`)
  return true
}

/**
 * Toggle an applied effect on/off by fxId.
 * When disabled: stashes keyframes into fx.savedKeyframes and removes them from the track.
 * When enabled: restores keyframes back to the track.
 */
export function toggleLayerEffect(layer: Layer, fxId: string, enabled: boolean): boolean {
  if (!layer.appliedEffects) return false
  const targetFx = layer.appliedEffects.find((x) => x.id === fxId)
  if (!targetFx) return false

  let savedKeyframes = (targetFx as any).savedKeyframes

  // Glow category
  if (targetFx.category === 'glow') {
    if (targetFx.glow) {
      targetFx.glow.enabled = enabled
    }
    targetFx.enabled = enabled

    layer.appliedEffects = layer.appliedEffects.map((x) =>
      x.id === fxId ? { ...x, enabled, glow: x.glow ? { ...x.glow, enabled } : undefined } : x
    )

    // Sync layer.glow with the remaining active glow, or turn off if all disabled
    const activeGlows = layer.appliedEffects.filter((x) => x.category === 'glow' && x.enabled && x.glow)
    if (activeGlows.length > 0) {
      layer.glow = { ...activeGlows[activeGlows.length - 1].glow!, enabled: true }
    } else if (layer.glow) {
      layer.glow.enabled = false
    }
    return true
  }

  // Keyframe category (opacity, position, scale)
  if (targetFx.targetProp) {
    const targetAnim = layer.transform[targetFx.targetProp]
    if (targetAnim) {
      if (!enabled) {
        const idSet = new Set(targetFx.keyframeIds ?? [])
        const toSave = targetAnim.keyframes.filter((k: any) => idSet.has(k.id))
        if (toSave.length > 0) {
          savedKeyframes = toSave
          targetAnim.keyframes = targetAnim.keyframes.filter((k: any) => !idSet.has(k.id))
          if (targetAnim.keyframes.length === 0) {
            if (targetFx.targetProp === 'opacity') targetAnim.value = 1
            else if (targetFx.targetProp === 'scale') targetAnim.value = [1, 1, 1]
          }
        }
      } else {
        if (savedKeyframes && savedKeyframes.length > 0) {
          targetAnim.keyframes = [...targetAnim.keyframes, ...savedKeyframes].sort((a: any, b: any) => a.t - b.t)
          savedKeyframes = undefined
        }
      }
    }
  }

  layer.appliedEffects = layer.appliedEffects.map((x) =>
    x.id === fxId ? { ...x, enabled, savedKeyframes } : x
  )
  return true
}

/**
 * Permanently delete an applied effect from a layer and clean up its keyframes / glow.
 */
export function deleteLayerEffect(layer: Layer, fxId: string): boolean {
  const fx = (layer.appliedEffects as any)?.find((x: any) => x.id === fxId)
  if (!fx) return false

  if (fx.targetProp) {
    const targetAnim = layer.transform[fx.targetProp]
    if (targetAnim && targetAnim.keyframes) {
      const idSet = new Set(fx.keyframeIds ?? [])
      targetAnim.keyframes = targetAnim.keyframes.filter((k: any) => !idSet.has(k.id))
      if (targetAnim.keyframes.length === 0) {
        if (fx.targetProp === 'opacity') targetAnim.value = 1
        else if (fx.targetProp === 'scale') targetAnim.value = [1, 1, 1]
      }
    }
  }

  layer.appliedEffects = layer.appliedEffects?.filter((x: any) => x.id !== fxId)

  if (fx.category === 'glow') {
    // If other glow effects remain on the layer, keep layer.glow synced to one of them
    const remainingGlow = layer.appliedEffects?.find((x) => x.category === 'glow' && x.glow)?.glow
    if (remainingGlow) {
      layer.glow = { ...remainingGlow }
    } else {
      delete layer.glow
    }
  }
  return true
}

