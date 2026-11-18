import type { AppliedLayerEffect, Layer, WorkflowEdge, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { isLoopComboFxId } from './workflowV2LoopCombo'
import { WORKFLOW_V2_ANIM_FX_OPTIONS, WORKFLOW_V2_FX_OPTIONS } from './workflowV2Options'
import { resolveFxAtomicRole, type FxAtomicRole } from './workflowV2Pipeline'
import { resolveLayerNodeTimeRange } from './workflowV2Scope'

export interface AtomicFxDerived {
  present: boolean
  enabled: boolean
  params: Partial<WorkflowNodeParams>
  title: string
}

const r2 = (v: number): number => Number(v.toFixed(2))
const roleToSubTab = (role: FxAtomicRole): 'opacity' | 'pulse' | 'glow' => (role === 'fade' ? 'opacity' : role)

function matchEffectRole(fx: AppliedLayerEffect, role: FxAtomicRole): boolean {
  if (role === 'fade') return fx.category === 'opacity'
  if (role === 'pulse') return fx.category === 'transform'
  return fx.category === 'glow'
}

/** Gom toàn bộ Node Logic nằm xuôi dòng sau `rootId` (hỗ trợ chuỗi nối tiếp B1 -> B2 -> B3...) */
export function collectDownstreamLogicNodes(
  rootId: string,
  edges: WorkflowEdge[],
  byId: Map<string, WorkflowNode>
): WorkflowNode[] {
  const result: WorkflowNode[] = []
  const seen = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const e of edges) {
      if (e.disabled || e.fromPort === 'time_range' || e.fromNode !== cur) continue
      if (seen.has(e.toNode)) continue
      const target = byId.get(e.toNode)
      if (!target || target.params?.logicCategory === 'cluster_lock') continue
      seen.add(e.toNode)
      if (target.params?.logicCategory) result.push(target)
      queue.push(e.toNode)
    }
  }
  return result
}

function pickPrimaryRoleEffect(
  layer: Layer,
  role: FxAtomicRole,
  current?: WorkflowNode,
  animFxOwnedIds?: Set<string>
): AppliedLayerEffect | undefined {
  const candidates = (layer.appliedEffects ?? []).filter(
    (f) => f.category !== 'motion' && !isLoopComboFxId(f.id) && !animFxOwnedIds?.has(f.id) && matchEffectRole(f, role)
  )
  if (current) {
    const owned = candidates.find((f) => f.id === `fx-wf-${current.id}`)
    if (owned) return owned
  }
  return candidates[candidates.length - 1]
}

/** Suy dẫn đúng 1 Node Hiệu ứng đơn nhiệm (`fade` | `pulse` | `glow`) từ trạng thái thật của Layer */
export function deriveAtomicFxByRole(
  layer: Layer,
  role: FxAtomicRole,
  compDur: number,
  current?: WorkflowNode,
  animFxOwnedIds?: Set<string>
): AtomicFxDerived {
  const range = resolveLayerNodeTimeRange(layer, compDur)
  const primary = pickPrimaryRoleEffect(layer, role, current, animFxOwnedIds)
  const opt =
    WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === (primary?.presetId ?? current?.params?.animFxPreset)) ??
    WORKFLOW_V2_ANIM_FX_OPTIONS[0]

  const start =
    typeof primary?.startTime === 'number'
      ? primary.startTime
      : (current?.params?.timeStart ?? (layer.type === 'image' ? layer.props.loopStartTime : undefined) ?? range.start)
  const end =
    primary?.duration && primary.duration > 0
      ? start + primary.duration
      : (current?.params?.timeEnd ?? (layer.type === 'image' ? layer.props.loopEndTime : undefined) ?? range.end)

  if (role === 'fade') {
    const fadeInSec = Math.max(layer.fadeIn ?? 0, layer.type === 'image' ? (layer.props.loopFadeInSec ?? 0) : 0)
    const fadeOutSec = Math.max(layer.fadeOut ?? 0, layer.type === 'image' ? (layer.props.loopFadeOutSec ?? 0) : 0)
    const endAction =
      layer.type === 'image' && layer.props.loopEndAction === 'fade_out'
        ? 'fade_out'
        : (current?.params?.loopEndAction ?? (fadeOutSec > 0 ? 'fade_out' : 'hold'))
    const hasAppearFade = fadeInSec > 0.01 || fadeOutSec > 0.01 || (layer.type === 'image' && layer.props.loopEndAction === 'fade_out')
    const present = Boolean(primary) || hasAppearFade
    const title = primary
      ? `Hiện/Ẩn: ${opt.label.replace(/^[^\wÀ-ỹ]+\s*/u, '')}`
      : `Hiện/Ẩn: Hiện ${fadeInSec.toFixed(1)}s · Ẩn ${fadeOutSec.toFixed(1)}s`
    return {
      present,
      enabled: present && (primary ? primary.enabled !== false : current ? current.enabled : true),
      params: {
        animMode: 'keyframe_fx',
        fxAtomicRole: 'fade',
        fxSubTab: 'opacity',
        animFxPreset: primary?.presetId ?? current?.params?.animFxPreset ?? 'fadeInOut',
        animFxCount: primary?.count ?? current?.params?.animFxCount ?? opt.defaultCount,
        intensity: primary?.intensity ?? current?.params?.intensity ?? 1,
        loopFadeInSec: fadeInSec > 0 ? r2(fadeInSec) : (current?.params?.loopFadeInSec ?? 0),
        loopFadeOutSec: fadeOutSec > 0 ? r2(fadeOutSec) : (current?.params?.loopFadeOutSec ?? 0),
        loopEndAction: endAction,
        timeStart: r2(start),
        timeEnd: r2(end)
      },
      title
    }
  }

  if (role === 'pulse') {
    const rhythmMode =
      layer.type === 'image' && layer.props.loopRhythmMode && layer.props.loopRhythmMode !== 'none'
        ? layer.props.loopRhythmMode
        : (current?.params?.loopRhythmMode ?? 'none')
    const hasRhythm = layer.type === 'image' && Boolean(layer.props.loopRhythmMode && layer.props.loopRhythmMode !== 'none')
    const present = Boolean(primary) || hasRhythm
    const title = primary
      ? `Nhịp/Rung: ${opt.label.replace(/^[^\wÀ-ỹ]+\s*/u, '')}`
      : `Nhịp Beat (${rhythmMode === 'flicker_opacity' ? 'Nháy mờ' : rhythmMode === 'pulse_scale' ? 'Nhịp Scale' : 'Nhịp & Nháy'})`
    return {
      present,
      enabled: present && (primary ? primary.enabled !== false : current ? current.enabled : true),
      params: {
        animMode: 'keyframe_fx',
        fxAtomicRole: 'pulse',
        fxSubTab: 'pulse',
        ...(primary?.presetId || current?.params?.animFxPreset ? { animFxPreset: primary?.presetId ?? current?.params?.animFxPreset } : {}),
        animFxCount: primary?.count ?? current?.params?.animFxCount ?? opt.defaultCount,
        intensity: primary?.intensity ?? current?.params?.intensity ?? 1,
        loopRhythmMode: rhythmMode,
        loopRhythmRateHz: layer.type === 'image' ? (layer.props.loopRhythmRateHz ?? current?.params?.loopRhythmRateHz ?? 2.5) : 2.5,
        loopRhythmIntensity: layer.type === 'image' ? (layer.props.loopRhythmIntensity ?? current?.params?.loopRhythmIntensity ?? 0.45) : 0.45,
        loopMinOpacity: layer.type === 'image' ? (layer.props.loopMinOpacity ?? current?.params?.loopMinOpacity ?? 0.55) : 0.55,
        loopScaleBeatPct: layer.type === 'image' ? (layer.props.loopScaleBeatPct ?? current?.params?.loopScaleBeatPct ?? 12) : 12,
        timeStart: r2(start),
        timeEnd: r2(end)
      },
      title
    }
  }

  const hasOpticalFx = Boolean(layer.glow?.enabled && (!layer.virtualLight?.enabled || current?.params?.fxKind || primary))
  const present = Boolean(primary) || (Boolean(current?.params?.fxKind && current.params.fxKind !== 'wind_physics') && hasOpticalFx)
  const fxOpt = WORKFLOW_V2_FX_OPTIONS.find((o) => o.id === current?.params?.fxKind)
  const title = primary
    ? `Phát sáng: ${opt.label.replace(/^[^\wÀ-ỹ]+\s*/u, '')}`
    : `Phát sáng: ${fxOpt?.label ?? 'Quang học Neon'}`
  return {
    present,
    enabled: present && (primary ? primary.enabled !== false : current ? current.enabled : true),
    params: {
      animMode: 'keyframe_fx',
      fxAtomicRole: 'glow',
      fxSubTab: roleToSubTab('glow'),
      ...(primary?.presetId || current?.params?.animFxPreset ? { animFxPreset: primary?.presetId ?? current?.params?.animFxPreset } : {}),
      intensity: primary?.intensity ?? layer.glow?.intensity ?? current?.params?.intensity ?? 1.2,
      animFxColor: primary?.glow?.color ?? layer.glow?.color ?? current?.params?.animFxColor ?? opt.defaultColor,
      animFxThickness: primary?.glow?.thickness ?? layer.glow?.thickness ?? current?.params?.animFxThickness,
      animFxSide: primary?.glow?.side ?? layer.glow?.side ?? current?.params?.animFxSide,
      animFxSpeed: primary?.glow?.speed ?? current?.params?.animFxSpeed,
      animFxMinIntensity: primary?.glow?.minIntensity ?? current?.params?.animFxMinIntensity,
      ...(current?.params?.fxKind ? { fxKind: current.params.fxKind } : {}),
      timeStart: r2(start),
      timeEnd: r2(end)
    },
    title
  }
}

/** Tìm Node FX hiện có khớp đúng vai trò nguyên tử trong danh sách Node Logic của Layer/Cụm */
export function findDownstreamFxNodeByRole(downstream: WorkflowNode[], role: FxAtomicRole): WorkflowNode | undefined {
  return downstream.find((n) => n.params?.logicCategory === 'fx' && resolveFxAtomicRole(n) === role)
}
