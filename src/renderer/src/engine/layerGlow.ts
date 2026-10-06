import type { GlowSide, Layer, LayerGlow } from '@shared/types'

export interface ActiveGlowState {
  side: GlowSide
  color: string
  thickness: number
  intensity: number
}

/**
 * Computes instantaneous glow intensity at time t for a specific LayerGlow configuration,
 * including animation modulation (breathe, blink, flicker) and boundary fade-in / fade-out.
 */
export function computeGlowIntensity(glow: LayerGlow, t: number): number {
  if (!glow.enabled) return 0
  const glowStart = glow.startTime ?? 0
  const glowDur = glow.duration ?? 0

  if (t < glowStart) return 0
  let timeFactor = 1.0
  if (glowDur > 0) {
    const elapsed = t - glowStart
    if (elapsed > glowDur) return 0
    const fadeIn = Math.min(0.12, glowDur * 0.25)
    const fadeOut = Math.min(0.15, glowDur * 0.25)
    if (elapsed < fadeIn && fadeIn > 0.001) {
      timeFactor = elapsed / fadeIn
    } else if (elapsed > glowDur - fadeOut && fadeOut > 0.001) {
      timeFactor = (glowDur - elapsed) / fadeOut
    }
  }

  const baseIntensity = glow.intensity ?? 1.2
  const minI = (glow.minIntensity ?? 0.15) * baseIntensity
  const spd = glow.speed ?? 2.0
  const localT = Math.max(0, t - glowStart)

  let computedI = baseIntensity
  if (glow.animated === 'breathe') {
    const wave = 0.5 + 0.5 * Math.sin(localT * spd * Math.PI * 2)
    computedI = minI + (baseIntensity - minI) * wave
  } else if (glow.animated === 'blink') {
    const cycle = (localT * spd) % 1
    computedI = cycle < 0.5 ? baseIntensity : minI
  } else if (glow.animated === 'flicker') {
    const f =
      0.5 +
      0.3 * Math.sin(localT * spd * 17.3) +
      0.15 * Math.sin(localT * spd * 31.7) +
      0.05 * Math.sin(localT * spd * 7.1)
    const drop = (localT * spd * 3) % 1 > 0.88 ? 0.3 : 1.0
    computedI = minI + (baseIntensity - minI) * Math.max(0, Math.min(1, f * drop))
  }
  return computedI * timeFactor
}

export interface GlowInstance {
  id: string
  name?: string
  glow: LayerGlow
}

/**
 * Returns all configured glow effects on a layer, whether stored in appliedEffects
 * or as a standalone layer.glow property.
 */
export function getAllGlowConfigs(layer: Layer): GlowInstance[] {
  const list: GlowInstance[] = []
  if (layer.appliedEffects) {
    for (const fx of layer.appliedEffects) {
      if (fx.category === 'glow' && fx.glow) {
        list.push({ id: fx.id, name: fx.name, glow: fx.glow })
      }
    }
  }
  // Fallback to standalone layer.glow if no glow presets exist in appliedEffects
  if (list.length === 0 && layer.glow) {
    list.push({ id: 'standalone', name: 'Viền Neon', glow: layer.glow })
  }
  return list
}

/**
 * Evaluates the layer's glow at time t across all configured neon effects.
 * Supports multiple neon effects on the same layer across different time ranges.
 */
export function evaluateLayerGlow(layer: Layer, t: number): ActiveGlowState | null {
  const configs = getAllGlowConfigs(layer)
  if (configs.length === 0) return null

  let bestCandidate: { glow: LayerGlow; intensity: number } | null = null

  for (const { glow } of configs) {
    if (!glow.enabled) continue
    const start = glow.startTime ?? layer.inPoint
    const dur = glow.duration ?? 0
    if (t < start) continue
    if (dur > 0 && t > start + dur) continue

    const intensity = computeGlowIntensity(glow, t)
    if (intensity > 0.001) {
      // Pick the active glow with the highest instantaneous intensity
      if (!bestCandidate || intensity > bestCandidate.intensity) {
        bestCandidate = { glow, intensity }
      }
    }
  }

  if (!bestCandidate) return null

  const g = bestCandidate.glow
  return {
    side: g.side ?? 'outer',
    color: g.color || '#3dd6f5',
    thickness: Math.max(1, Math.min(60, g.thickness ?? 8)),
    intensity: bestCandidate.intensity
  }
}
