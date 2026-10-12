import { nanoid } from 'nanoid'
import type { AppliedLayerEffect, Layer, LayerMotion, LayerMotionType } from '@shared/types'
import { defaultLayerMotion, patchLayerMotion, sampleLayerMotion, type MotionSample } from './proceduralMotion'

export const MOTION_EFFECT_PRESETS = [
  { id: 'motionDrift', type: 'drift', name: 'Offset · Trôi & cuộn', description: 'Cuộn texture hoặc di chuyển theo hướng' },
  { id: 'motionWind', type: 'wind', name: 'Wind · Gió lay', description: 'Lay động vị trí và xoay nhẹ theo gió' },
  { id: 'motionSway', type: 'sway', name: 'Sway · Lắc nhẹ', description: 'Lắc qua lại theo nhịp' },
  { id: 'motionFloat', type: 'float', name: 'Float · Bồng bềnh', description: 'Bay nổi nhẹ theo hai trục' },
  { id: 'motionWiggle', type: 'wiggle', name: 'Wiggle · Rung hữu cơ', description: 'Rung tự nhiên có seed cố định' },
  { id: 'motionPulse', type: 'pulse', name: 'Pulse · Nhịp thở', description: 'Co giãn tuần hoàn theo hai trục' }
] as const
export type MotionEffectPresetId = typeof MOTION_EFFECT_PRESETS[number]['id']

function legacyEffect(layer: Layer): AppliedLayerEffect | undefined {
  const motion = layer.motion
  if (!motion || motion.type === 'none') return undefined
  const preset = MOTION_EFFECT_PRESETS.find((p) => p.type === motion.type)!
  return { id: `legacy-motion-${layer.id}`, presetId: preset.id, name: preset.name, badge: 'FX',
    category: 'motion', startTime: motion.startTime ?? 0, duration: motion.duration ?? 0,
    enabled: motion.enabled !== false, motion: { ...motion } }
}

/** Virtual legacy entry preserves playback without mutating projects on read. */
export function listLayerEffects(layer: Layer): AppliedLayerEffect[] {
  const legacy = legacyEffect(layer)
  return legacy ? [...(layer.appliedEffects ?? []), legacy] : layer.appliedEffects ?? []
}

export function migrateLayerMotion(layer: Layer): void {
  const legacy = legacyEffect(layer)
  if (legacy) (layer.appliedEffects ??= []).push(legacy)
  delete layer.motion
}

export function effectMotion(fx: AppliedLayerEffect): LayerMotion | undefined {
  return fx.motion ? { ...fx.motion, startTime: fx.startTime, duration: fx.duration, enabled: fx.enabled } : undefined
}

export function addMotionEffect(layer: Layer, type: LayerMotionType, start: number, duration: number): AppliedLayerEffect {
  const preset = MOTION_EFFECT_PRESETS.find((p) => p.type === type)
  if (!preset) throw new Error('Unknown motion effect type')
  migrateLayerMotion(layer)
  const fx: AppliedLayerEffect = { id: `fx-${nanoid(8)}`, presetId: preset.id, name: preset.name, badge: 'FX',
    category: 'motion', startTime: start, duration, enabled: true, motion: defaultLayerMotion(type) }
  ;(layer.appliedEffects ??= []).push(fx)
  return fx
}

export function updateMotionEffect(layer: Layer, id: string, patch: Partial<LayerMotion>, reset = false): void {
  migrateLayerMotion(layer)
  const fx = layer.appliedEffects?.find((item) => item.id === id)
  if (!fx?.motion) throw new Error('Motion effect not found')
  // Reset/type changes affect parameters, preserving the timeline interval and bypass state.
  fx.motion = patchLayerMotion(fx.motion, patch, reset)
  if (patch.startTime !== undefined) fx.startTime = patch.startTime
  if (patch.duration !== undefined) fx.duration = patch.duration
  if (patch.enabled !== undefined) fx.enabled = patch.enabled
  const preset = MOTION_EFFECT_PRESETS.find((p) => p.type === fx.motion!.type)
  if (preset) fx.presetId = preset.id
}

/** Positions/angles/UV add, scale factors multiply. Existing Transform keys remain intact. */
export function sampleMotionEffects(layer: Layer, time: number, size: [number, number]): MotionSample {
  const combined = sampleLayerMotion(undefined, time, size)
  // Sample legacy directly so omitted startTime keeps its exact historical behavior.
  const motions = [layer.motion, ...(layer.appliedEffects ?? []).filter((fx) => fx.category === 'motion').map(effectMotion)]
  for (const motion of motions) {
    const s = sampleLayerMotion(motion, time, size)
    for (let i = 0; i < 3; i++) {
      combined.position[i] += s.position[i]
      combined.rotation[i] += s.rotation[i]
      combined.scale[i] *= s.scale[i]
    }
    if (s.uvOffset) combined.uvOffset = [(combined.uvOffset?.[0] ?? 0) + s.uvOffset[0], (combined.uvOffset?.[1] ?? 0) + s.uvOffset[1]]
  }
  return combined
}
