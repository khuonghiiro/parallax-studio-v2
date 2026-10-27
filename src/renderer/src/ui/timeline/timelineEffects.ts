import { addMotionEffect, migrateLayerMotion, MOTION_EFFECT_PRESETS } from '../../animation/motionEffects'
import { nanoid } from 'nanoid'
import type { GlowSide, Layer, LayerGlow, Vec3 } from '@shared/types'
import { frameTolerance, useEditor } from '../../store/editor'
import { useToast } from '../../actions'

const toast = (m: string): void => useToast.getState().show(m)

export { FX_PRESETS } from './fxPresets'
export type { FxPresetId, FxPresetInfo, ApplyFxOptions } from './fxPresets'
import { FX_PRESETS, type FxPresetId, type ApplyFxOptions } from './fxPresets'
import { generateBlinkKeys, generateBreatheKeys, generateFadeKeys, generateShakeKeys, generatePopInKeys, generatePulseKeys } from './fxKeyGenerators'

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

  const motionPreset = MOTION_EFFECT_PRESETS.find((p) => p.id === presetId)
  if (motionPreset) {
    st.update((d) => {
      const l = d.layers.find((x) => x.id === selectedLayerId)!
      addMotionEffect(l, motionPreset.type, start, options?.duration ?? preset.defaultDuration)
    })
    return true
  }

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

function restoreSettledScaleValue(targetAnim: { value: Vec3; keyframes: { value: Vec3 }[] }, removedKeys: { value: Vec3 }[]): void {
  const curVal = targetAnim.value
  if (curVal && Math.abs(curVal[0]) >= 0.05 && Math.abs(curVal[1]) >= 0.05) {
    return
  }
  const lastValid = [...removedKeys].reverse().find((k) => Array.isArray(k.value) && Math.abs(k.value[0]) >= 0.05)
  if (lastValid) {
    targetAnim.value = [...lastValid.value] as Vec3
  } else {
    targetAnim.value = [1, 1, 1]
  }
}

/**
 * Toggle an applied effect on/off by fxId.
 * When disabled: stashes keyframes into fx.savedKeyframes and removes them from the track.
 * When enabled: restores keyframes back to the track.
 */
export function toggleLayerEffect(layer: Layer, fxId: string, enabled: boolean): boolean {
  migrateLayerMotion(layer)
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
          targetAnim.keyframes = (targetAnim.keyframes as any).filter((k: any) => !idSet.has(k.id))
          if (targetAnim.keyframes.length === 0) {
            if (targetFx.targetProp === 'opacity') targetAnim.value = 1
            else if (targetFx.targetProp === 'scale') restoreSettledScaleValue(targetAnim as any, toSave as any)
          }
        }
      } else {
        if (savedKeyframes && savedKeyframes.length > 0) {
          targetAnim.keyframes = ([...targetAnim.keyframes, ...savedKeyframes] as any).sort((a: any, b: any) => a.t - b.t)
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
  migrateLayerMotion(layer)
  const fx = (layer.appliedEffects as any)?.find((x: any) => x.id === fxId)
  if (!fx) return false

  if (fx.targetProp) {
    const targetAnim = (layer.transform as any)[fx.targetProp]
    if (targetAnim && targetAnim.keyframes) {
      const idSet = new Set(fx.keyframeIds ?? [])
      const removed = targetAnim.keyframes.filter((k: any) => idSet.has(k.id))
      targetAnim.keyframes = targetAnim.keyframes.filter((k: any) => !idSet.has(k.id))
      if (targetAnim.keyframes.length === 0) {
        if (fx.targetProp === 'opacity') targetAnim.value = 1
        else if (fx.targetProp === 'scale') restoreSettledScaleValue(targetAnim, removed)
      }
    }
  }

  layer.appliedEffects = layer.appliedEffects?.filter((x: any) => x.id !== fxId)

  if (fx.category === 'glow') {
    const remainingGlow = layer.appliedEffects?.find((x) => x.category === 'glow' && x.glow)?.glow
    if (remainingGlow) {
      layer.glow = { ...remainingGlow }
    } else {
      delete layer.glow
    }
  }
  return true
}
