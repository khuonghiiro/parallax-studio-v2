import type { LayerMotion, LayerMotionType, Vec3 } from '@shared/types'
import { smoothNoise } from './math'

export const MOTION_TYPES: LayerMotionType[] = ['none', 'drift', 'wind', 'sway', 'float', 'wiggle', 'pulse', 'spin']

export function defaultLayerMotion(type: LayerMotionType): LayerMotion {
  const values: Record<LayerMotionType, [number, Vec3]> = {
    none: [0, [0, 0, 0]], drift: [40, [1500, 12, 0]], wind: [0.6, [8, 2, 1.2]],
    sway: [0.6, [8, 2, 1.2]], float: [0.4, [4, 15, 0]],
    wiggle: [1.5, [15, 15, 0]], pulse: [0.5, [0.05, 0.05, 0]], spin: [25, [0, 0, 360]]
  }
  return { type, enabled: true, speed: values[type][0], amplitude: [...values[type][1]],
    amount: 1, phase: 0, seed: 0, startTime: 0, duration: 0, fadeIn: 0, fadeOut: 0,
    direction: 'right', loopMode: 'uv', loopWidth: 3000 }
}

/** Resolve legacy omitted values identically in controls and renderer. */
export function resolveLayerMotion(m: LayerMotion): LayerMotion & { speed: number; amplitude: Vec3 } {
  const amplitude: Vec3 = m.type === 'drift' ? [1500, 10, 0] : m.type === 'float' ? [4, 15, 0]
    : m.type === 'pulse' ? [0.05, 0.05, 0] : [8, 2, 1.2]
  return { ...m, speed: m.speed ?? (m.type === 'drift' ? 40 : 0.6), amplitude: m.amplitude ?? amplitude }
}

/** Type changes reset type-specific units; partial edits preserve all other controls. */
export function patchLayerMotion(current: LayerMotion | undefined, patch: Partial<LayerMotion>, reset = false): LayerMotion {
  const type = patch.type ?? current?.type ?? 'none'
  const base = reset || type !== current?.type ? defaultLayerMotion(type) : current
  return { ...base, ...patch, type }
}

/** Parses named direction presets or degrees (0-360) into degrees. 0 = right, 90 = up. */
export function parseDirectionAngle(dir?: number | string): number {
  if (typeof dir === 'number' && Number.isFinite(dir)) return ((dir % 360) + 360) % 360
  switch (dir) {
    case 'right':
      return 0
    case 'up-right':
      return 45
    case 'up':
      return 90
    case 'up-left':
      return 135
    case 'left':
      return 180
    case 'down-left':
      return 225
    case 'down':
      return 270
    case 'down-right':
      return 315
    default:
      return 0
  }
}

export interface MotionSample {
  position: Vec3
  rotation: Vec3
  scale: Vec3
  uvOffset?: [number, number]
}

const smooth = (x: number): number => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v) }

export function motionEnvelope(m: LayerMotion, time: number): number {
  const t = time - (m.startTime ?? 0)
  if (m.enabled === false || (m.startTime !== undefined && t < 0)) return 0
  const duration = m.duration ?? 0
  if (duration > 0 && t >= duration) return 0
  const entrance = m.fadeIn ? smooth(t / m.fadeIn) : 1
  const exit = duration > 0 && m.fadeOut ? smooth((duration - t) / m.fadeOut) : 1
  return Math.max(0, Math.min(1, m.amount ?? 1)) * entrance * exit
}

function driftSample(m: LayerMotion, t: number, size: [number, number], out: MotionSample): void {
  const amp = m.amplitude ?? [1500, 10, 0]
  const sp = m.speed ?? 40, ph = m.phase ?? 0
  const rad = parseDirectionAngle(m.direction) * Math.PI / 180
  const dx = Math.cos(rad), dy = Math.sin(rad)
  const mode = m.loopMode ?? 'uv'
  const half = Math.max(0.001, (m.loopWidth ?? (Math.abs(amp[0]) * 2 || 3000)) / 2)
  const angle = t * sp * Math.PI / half + ph
  const dist = mode === 'ping-pong' ? Math.sin(angle) * half : t * sp + ph
  if (mode === 'uv' || mode === 'wrap') out.uvOffset = [-dist * dx / (size[0] || 1), -dist * dy / (size[1] || 1)]
  else { out.position[0] = dist * dx; out.position[1] = dist * dy }
  const sway = (mode === 'ping-pong' ? Math.cos(angle * 0.7) : Math.sin(t * 0.8 + ph)) * amp[1]
  out.position[0] -= sway * dy
  out.position[1] += sway * dx
}

/** Pure sampler shared by preview, viewport and export. Preserves legacy phase/axis conventions. */
export function sampleLayerMotion(m: LayerMotion | undefined, time: number, size: [number, number] = [1920, 1080]): MotionSample {
  const out: MotionSample = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
  if (!m || m.type === 'none') return out
  const weight = motionEnvelope(m, time)
  if (weight === 0) return out
  const t = time - (m.startTime ?? 0)
  const { speed: sp, amplitude: amp } = resolveLayerMotion(m)
  const angle = t * sp * Math.PI * 2 + (m.phase ?? 0)
  if (m.type === 'drift') driftSample(m, t, size, out)
  else if (m.type === 'wind' || m.type === 'sway') {
    out.position = [Math.sin(angle) * amp[0], Math.cos(angle * 0.7) * amp[1], 0]
    out.rotation[2] = Math.sin(angle) * amp[2]
  } else if (m.type === 'float') out.position = [Math.cos(angle * 0.5) * amp[0], Math.sin(angle) * amp[1], 0]
  else if (m.type === 'wiggle') {
    const seed = m.seed ?? 0
    out.position = [smoothNoise(angle, 2.1 + seed) * amp[0], smoothNoise(angle, 5.7 + seed) * amp[1], 0]
    out.rotation[2] = smoothNoise(angle, 8.3 + seed) * amp[2]
  } else if (m.type === 'pulse') {
    out.scale = [1 + Math.sin(angle) * amp[0], 1 + Math.sin(angle) * amp[1], 1]
  }
  for (let i = 0; i < 3; i++) {
    out.position[i] *= weight
    out.rotation[i] *= weight
    out.scale[i] = 1 + (out.scale[i] - 1) * weight
  }
  if (out.uvOffset) out.uvOffset = [out.uvOffset[0] * weight, out.uvOffset[1] * weight]
  return out
}
