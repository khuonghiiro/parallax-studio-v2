import type { GlowSide, Layer, LayerGlow } from '@shared/types'
import {
  generateBlinkKeys,
  generateBreatheKeys,
  generateFadeKeys,
  generatePopInKeys,
  generatePulseKeys,
  generateShakeKeys
} from '../ui/timeline/fxKeyGenerators'
import type { WorkflowV2AnimFxOption } from './workflowV2Options'

/** Thông số đã chuẩn hoá để sinh một hiệu ứng Keyframe / Neon FX lên Layer */
export interface AnimFxApplyOptions {
  fxId: string
  start: number
  duration: number
  count: number
  intensity: number
  color: string
  side: GlowSide
  thickness: number
  speed: number
  minIntensity: number
  /** Dung sai khử trùng keyframe (≈ nửa khung hình) */
  tol: number
}

type FxTargetProp = 'opacity' | 'position' | 'scale' | undefined

function generatePresetKeys(l: Layer, presetId: string, o: AnimFxApplyOptions): { prop: FxTargetProp; ids: string[] } | null {
  const { start, duration, count, intensity, tol } = o
  const ids = (keys: { id: string }[]): string[] => keys.map((k) => k.id)
  switch (presetId) {
    case 'blink':
      return { prop: 'opacity', ids: ids(generateBlinkKeys(l.transform.opacity, start, duration, count, 0.05, tol)) }
    case 'fadeOut':
      return { prop: 'opacity', ids: ids(generateFadeKeys(l.transform.opacity, start, duration, 'out', tol)) }
    case 'fadeIn':
      return { prop: 'opacity', ids: ids(generateFadeKeys(l.transform.opacity, start, duration, 'in', tol)) }
    case 'breathe':
      return { prop: 'opacity', ids: ids(generateBreatheKeys(l.transform.opacity, start, duration, 0.2, tol)) }
    case 'shake':
      return { prop: 'position', ids: ids(generateShakeKeys(l.transform.position, start, duration, intensity, count, tol)) }
    case 'popIn':
      return { prop: 'scale', ids: ids(generatePopInKeys(l.transform.scale, start, duration, count, intensity, tol)) }
    case 'pulse':
      return { prop: 'scale', ids: ids(generatePulseKeys(l.transform.scale, start, duration, count, intensity, tol)) }
    default:
      return null
  }
}

function applyNeonGlow(l: Layer, presetId: string, o: AnimFxApplyOptions): void {
  const animated: LayerGlow['animated'] =
    presetId === 'neonBreathe' ? 'breathe' : presetId === 'neonBlink' ? 'blink' : presetId === 'neonFlicker' ? 'flicker' : 'none'
  l.glow = {
    enabled: true,
    startTime: o.start,
    duration: o.duration,
    side: o.side,
    color: o.color,
    thickness: o.thickness,
    intensity: o.intensity,
    animated,
    speed: o.speed,
    minIntensity: o.minIntensity
  }
}

/**
 * Sinh một hiệu ứng Keyframe FX (Pop In, Rung, Nhịp đập, Hiện/Mờ dần, Nhấp nháy, Thở) hoặc viền Neon
 * lên Layer và ghi mục tương ứng vào `layer.appliedEffects` (để Timeline, Workflow và Undo dùng chung).
 */
export function applyAnimFxPresetToLayer(l: Layer, opt: WorkflowV2AnimFxOption, o: AnimFxApplyOptions): void {
  const keys = generatePresetKeys(l, opt.id, o)
  if (!keys) applyNeonGlow(l, opt.id, o)
  if (!l.appliedEffects) l.appliedEffects = []
  l.appliedEffects.push({
    id: o.fxId,
    presetId: opt.id,
    name: opt.label.replace(/^[^\w\p{L}]+\s*/u, ''),
    badge: opt.badge,
    category: opt.fxCategory,
    startTime: o.start,
    duration: o.duration,
    enabled: true,
    targetProp: keys?.prop,
    keyframeIds: keys?.ids ?? [],
    glow: opt.fxCategory === 'glow' && l.glow ? { ...l.glow } : undefined,
    count: opt.defaultCount !== undefined ? o.count : undefined,
    intensity: opt.defaultIntensity !== undefined ? o.intensity : undefined
  })
}
