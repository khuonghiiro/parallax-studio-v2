import type { AppliedLayerEffect, Layer } from '@shared/types'
import { migrateLayerMotion } from './motionEffects'

export interface EffectTiming { startTime: number; duration: number }
export type EffectDragMode = 'move' | 'in' | 'out'

/** Snap and constrain a gesture to the composition; unlimited clips retain unlimited duration when moved. */
export function dragEffectTiming(fx: EffectTiming, layerEnd: number, delta: number, mode: EffectDragMode,
  fps: number, compositionEnd: number): EffectTiming {
  const frame = 1 / fps
  const snap = (v: number): number => Math.round(v * fps) / fps
  const end = Math.max(fx.startTime + frame, fx.duration > 0 ? fx.startTime + fx.duration : layerEnd)
  if (mode === 'move') {
    const limit = fx.duration > 0 ? compositionEnd - fx.duration : compositionEnd - frame
    return { startTime: Math.max(0, Math.min(Math.max(0, limit), snap(fx.startTime + delta))), duration: fx.duration }
  }
  if (mode === 'in') {
    const startTime = Math.max(0, Math.min(end - frame, snap(fx.startTime + delta)))
    return { startTime, duration: end - startTime }
  }
  return { startTime: fx.startTime, duration: Math.max(frame, Math.min(compositionEnd, snap(end + delta)) - fx.startTime) }
}

/** Retime owned keys (including disabled stashes) while leaving manual/other effect keys untouched. */
export function retimeLayerEffect(layer: Layer, id: string, timing: EffectTiming): AppliedLayerEffect {
  if (!Number.isFinite(timing.startTime) || timing.startTime < 0 || !Number.isFinite(timing.duration) || timing.duration < 0) {
    throw new Error('Effect timing must be finite and non-negative')
  }
  migrateLayerMotion(layer)
  const fx = layer.appliedEffects?.find((item) => item.id === id)
  if (!fx) throw new Error('Effect not found')
  if (fx.targetProp && timing.duration === 0) throw new Error('Keyframe effects require a positive duration')
  const ratio = fx.duration > 0 && timing.duration > 0 ? timing.duration / fx.duration : 1
  const keys = fx.targetProp ? layer.transform[fx.targetProp].keyframes : []
  const owned = new Set(fx.keyframeIds)
  const retime = (t: number): number => timing.startTime + (t - fx.startTime) * ratio
  for (const key of keys) if (owned.has(key.id)) key.t = retime(key.t)
  keys.sort((a, b) => a.t - b.t)
  const saved = (fx as AppliedLayerEffect & { savedKeyframes?: { t: number }[] }).savedKeyframes
  for (const key of saved ?? []) key.t = retime(key.t)
  Object.assign(fx, timing)
  if (fx.glow) Object.assign(fx.glow, timing)
  return fx
}
