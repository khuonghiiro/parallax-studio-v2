import type { AppliedLayerEffect, GlowSide, Layer, Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { deleteLayerEffect, toggleLayerEffect } from '../ui/timeline/timelineEffects'
import { applyAnimFxPresetToLayer } from './workflowV2AnimFxApply'
import { WORKFLOW_V2_ANIM_FX_OPTIONS } from './workflowV2Options'
import { resolveFxAtomicRole, type FxAtomicRole } from './workflowV2Pipeline'

const FADE_PRESETS = new Set(['fadeIn', 'fadeOut', 'fadeInOut', 'blink', 'breathe'])
const PULSE_PRESETS = new Set(['popIn', 'pulse', 'shake'])
const GLOW_PRESETS = new Set(['neonBreathe', 'neonBlink', 'neonFlicker', 'neonSolid'])

const clampNum = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined

export function fxWfEffectId(nodeId: string): string {
  return `fx-wf-${nodeId}`
}

function isLegacyRoleEffect(fx: AppliedLayerEffect, role: FxAtomicRole): boolean {
  if (fx.id.startsWith('fx-wf-') || fx.category === 'motion') return false
  if (role === 'glow') return fx.category === 'glow' || GLOW_PRESETS.has(fx.presetId)
  if (role === 'pulse') return fx.category === 'transform' || PULSE_PRESETS.has(fx.presetId)
  return fx.category === 'opacity' || FADE_PRESETS.has(fx.presetId)
}

function findOwnedFxEffect(l: Layer, nodeId: string, role: FxAtomicRole): AppliedLayerEffect | undefined {
  const exactId = fxWfEffectId(nodeId)
  const exact = (l.appliedEffects ?? []).find((f) => f.id === exactId)
  if (exact) return exact
  return (l.appliedEffects ?? []).find((f) => isLegacyRoleEffect(f, role))
}

function syncRoleKeyframeEffect(
  l: Layer,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  presetId: string,
  role: FxAtomicRole,
  tol: number,
  patch?: Partial<WorkflowNodeParams>
): void {
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId)
  if (!opt) return
  const existingFx = findOwnedFxEffect(l, node.id, role)
  if (!node.enabled) {
    if (existingFx?.enabled) toggleLayerEffect(l, existingFx.id, false)
    return
  }
  if (existingFx && existingFx.presetId === presetId && !patch) {
    if (!existingFx.enabled) toggleLayerEffect(l, existingFx.id, true)
    return
  }
  if (existingFx) deleteLayerEffect(l, existingFx.id)

  const start = Math.max(0, params.timeStart ?? existingFx?.startTime ?? l.inPoint ?? 0)
  const rawEnd = params.timeEnd ?? start + opt.defaultDuration
  const duration = Math.max(0.1, Number((rawEnd - start).toFixed(2)))
  const count = Math.max(1, Math.round(params.animFxCount ?? existingFx?.count ?? opt.defaultCount ?? 2))
  const intensity = params.intensity ?? existingFx?.intensity ?? opt.defaultIntensity ?? 1.2
  const color = params.animFxColor ?? existingFx?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
  const side: GlowSide = params.animFxSide ?? existingFx?.glow?.side ?? 'outer'
  const thickness = params.animFxThickness ?? existingFx?.glow?.thickness ?? 10
  const speed = params.animFxSpeed ?? existingFx?.glow?.speed ?? (duration > 0 ? Math.max(0.5, count / duration) : 1.5)
  const minIntensity = params.animFxMinIntensity ?? existingFx?.glow?.minIntensity ?? 0.15

  applyAnimFxPresetToLayer(l, opt, {
    fxId: existingFx?.id ?? fxWfEffectId(node.id),
    start,
    duration,
    count,
    intensity,
    color,
    side,
    thickness,
    speed,
    minIntensity,
    tol
  })
}

function applyFadeRole(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  targetIds: Set<string>,
  tol: number,
  patch?: Partial<WorkflowNodeParams>
): void {
  const preset = params.animFxPreset
  const useKeyPreset = Boolean(preset && FADE_PRESETS.has(preset) && preset !== 'fadeInOut')
  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    if (!node.enabled) {
      l.fadeIn = 0
      l.fadeOut = 0
      if (l.type === 'image') {
        l.props.loopFadeInSec = 0
        l.props.loopFadeOutSec = 0
      }
      const owned = findOwnedFxEffect(l, node.id, 'fade')
      if (owned?.enabled) toggleLayerEffect(l, owned.id, false)
      continue
    }
    const fadeIn = clampNum(params.loopFadeInSec, 0, 10)
    const fadeOut = clampNum(params.loopFadeOutSec, 0, 10)
    if (fadeIn !== undefined) {
      l.fadeIn = fadeIn
      if (l.type === 'image') l.props.loopFadeInSec = fadeIn
    }
    if (fadeOut !== undefined) {
      l.fadeOut = fadeOut
      if (l.type === 'image') l.props.loopFadeOutSec = fadeOut
    }
    if (l.type === 'image') {
      if (params.loopEndAction) l.props.loopEndAction = params.loopEndAction
      if (typeof params.timeStart === 'number' && Number.isFinite(params.timeStart)) {
        l.props.loopStartTime = Math.max(0, params.timeStart)
      }
      if (typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd)) {
        l.props.loopEndTime = Math.max(0, params.timeEnd)
      }
    }
    if (useKeyPreset && preset) {
      syncRoleKeyframeEffect(l, node, params, preset, 'fade', tol, patch)
    }
  }
}

function applyPulseRole(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  targetIds: Set<string>,
  tol: number,
  patch?: Partial<WorkflowNodeParams>
): void {
  const preset = params.animFxPreset
  const useKeyPreset = Boolean(preset && PULSE_PRESETS.has(preset))
  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    if (!node.enabled) {
      if (l.type === 'image') l.props.loopRhythmMode = 'none'
      const owned = findOwnedFxEffect(l, node.id, 'pulse')
      if (owned?.enabled) toggleLayerEffect(l, owned.id, false)
      continue
    }
    if (l.type === 'image') {
      if (params.loopRhythmMode !== undefined) l.props.loopRhythmMode = params.loopRhythmMode
      if (params.loopRhythmRateHz !== undefined) l.props.loopRhythmRateHz = params.loopRhythmRateHz
      if (params.loopRhythmIntensity !== undefined) l.props.loopRhythmIntensity = params.loopRhythmIntensity
      if (params.loopMinOpacity !== undefined) l.props.loopMinOpacity = params.loopMinOpacity
      if (params.loopScaleBeatPct !== undefined) l.props.loopScaleBeatPct = params.loopScaleBeatPct
    }
    if (useKeyPreset && preset) {
      syncRoleKeyframeEffect(l, node, params, preset, 'pulse', tol, patch)
    }
  }
}

function applyGlowRole(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  targetIds: Set<string>,
  tol: number,
  patch?: Partial<WorkflowNodeParams>
): void {
  const preset = params.animFxPreset
  if (preset && GLOW_PRESETS.has(preset)) {
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      syncRoleKeyframeEffect(l, node, params, preset, 'glow', tol, patch)
      if (!node.enabled && l.glow) l.glow = { ...l.glow, enabled: false }
    }
    return
  }
  const intensity = params.intensity ?? 1.0
  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    const startSec = params.timeStart ?? l.inPoint ?? 0
    const endSec = params.timeEnd ?? l.outPoint ?? project.comp.duration
    l.glow = {
      enabled: node.enabled,
      color: params.animFxColor ?? (params.fxKind === 'chromatic' ? '#a855f7' : '#38bdf8'),
      intensity: Math.min(3, intensity * 1.4),
      thickness: params.animFxThickness ?? 10,
      side: params.animFxSide ?? 'outer',
      startTime: startSec,
      duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
    }
  }
}

/** Áp dụng đúng 1 vai trò nguyên tử của Node Hiệu ứng (`fade` | `pulse` | `glow`), không ghi đè vai trò khác */
export function applyAtomicFxNodeToLayer(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  if (targetIds.size === 0) return
  const tol = 1 / Math.max(1, (project.comp.fps || 30) * 2)
  const role = resolveFxAtomicRole({ ...node, params })
  if (role === 'fade') applyFadeRole(project, node, params, targetIds, tol, patch)
  else if (role === 'pulse') applyPulseRole(project, node, params, targetIds, tol, patch)
  else applyGlowRole(project, node, params, targetIds, tol, patch)
}

/** Gỡ sạch đúng hiệu ứng thuộc Node FX nguyên tử khỏi Layer, giữ nguyên hiệu ứng của các Node FX khác */
export function detachAtomicFxNodeFromLayer(l: Layer, node: WorkflowNode): void {
  const role = resolveFxAtomicRole(node)
  const exactId = fxWfEffectId(node.id)
  for (const fx of [...(l.appliedEffects ?? [])]) {
    if (fx.id === exactId || isLegacyRoleEffect(fx, role)) {
      deleteLayerEffect(l, fx.id)
    }
  }
  if (role === 'fade') {
    l.fadeIn = 0
    l.fadeOut = 0
    if (l.type === 'image') {
      l.props.loopFadeInSec = 0
      l.props.loopFadeOutSec = 0
      if (l.props.loopEndAction === 'fade_out') l.props.loopEndAction = 'hold'
    }
  } else if (role === 'pulse') {
    if (l.type === 'image') l.props.loopRhythmMode = 'none'
  } else if (role === 'glow') {
    if (!l.virtualLight?.enabled) delete l.glow
    else if (l.glow) l.glow = { ...l.glow, enabled: false }
  }
}
