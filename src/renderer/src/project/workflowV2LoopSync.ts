import type { ImageProps, Layer, Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { deleteLayerEffect, toggleLayerEffect } from '../ui/timeline/timelineEffects'
import { applyAnimFxPresetToLayer } from './workflowV2AnimFxApply'
import { WORKFLOW_V2_ANIM_FX_OPTIONS } from './workflowV2Options'
import { LOOP_MAX_PLAY_COUNT } from './loopLifecycle'

/**
 * Node Animation chế độ `🔁 Loop & Nhịp` (`animMode: 'loop_sprite'`):
 * - Chu kỳ / tốc độ / Nhịp & Nháy (như trước).
 * - Vòng đời: số lần chạy (`once`), hiện dần lúc xuất hiện, hành vi khi kết thúc (giữ / ẩn / mờ dần).
 *   Mốc bắt đầu & kết thúc lấy từ thời gian Node (đã tính Node Time chung) nên nối Node Time là cả nhóm ăn theo.
 * - Kết hợp hiệu ứng Keyframe / Neon FX chạy song song (mỗi nhóm thuộc tính tối đa 1 hiệu ứng).
 */

/** Nhóm thuộc tính mà hiệu ứng kết hợp ghi vào — 2 hiệu ứng cùng nhóm sẽ giành keyframe của nhau nên chỉ giữ 1 */
export type LoopComboGroup = 'opacity' | 'scale' | 'position' | 'glow'

export interface LoopComboFxOption {
  id: string
  group: LoopComboGroup
  /** Vị trí đặt hiệu ứng trong khoảng thời gian Loop */
  placement: 'enter' | 'sustain'
}

/** Hiệu ứng được phép kết hợp với Loop (Hiện/Mờ dần đã có sẵn trong vòng đời Loop nên không lặp lại) */
export const LOOP_COMBO_FX_OPTIONS: LoopComboFxOption[] = [
  { id: 'popIn', group: 'scale', placement: 'enter' },
  { id: 'pulse', group: 'scale', placement: 'sustain' },
  { id: 'shake', group: 'position', placement: 'enter' },
  { id: 'blink', group: 'opacity', placement: 'sustain' },
  { id: 'breathe', group: 'opacity', placement: 'sustain' },
  { id: 'neonBreathe', group: 'glow', placement: 'sustain' },
  { id: 'neonBlink', group: 'glow', placement: 'sustain' },
  { id: 'neonFlicker', group: 'glow', placement: 'sustain' },
  { id: 'neonSolid', group: 'glow', placement: 'sustain' }
]

const LOOP_COMBO_PREFIX = 'fx-loopcombo-'

export const loopComboFxId = (nodeId: string, presetId: string): string => `${LOOP_COMBO_PREFIX}${nodeId}-${presetId}`
export const isLoopComboFxId = (fxId: string): boolean => fxId.startsWith(LOOP_COMBO_PREFIX)

/** Chuẩn hoá danh sách hiệu ứng kết hợp: bỏ mã lạ, giữ hiệu ứng chọn SAU CÙNG của mỗi nhóm thuộc tính */
export function normalizeLoopComboFx(ids: readonly string[] | undefined): string[] {
  const byGroup = new Map<LoopComboGroup, string>()
  for (const id of ids ?? []) {
    const opt = LOOP_COMBO_FX_OPTIONS.find((o) => o.id === id)
    if (opt) byGroup.set(opt.group, opt.id)
  }
  return LOOP_COMBO_FX_OPTIONS.filter((o) => byGroup.get(o.group) === o.id).map((o) => o.id)
}

/** Bật / tắt một hiệu ứng kết hợp (chọn hiệu ứng mới sẽ thay hiệu ứng cùng nhóm) */
export function toggleLoopComboFx(current: readonly string[] | undefined, id: string): string[] {
  const list = normalizeLoopComboFx(current)
  if (list.includes(id)) return list.filter((x) => x !== id)
  return normalizeLoopComboFx([...list, id])
}

/** Mã hiệu ứng kết hợp đang gắn trên Layer (đọc ngược cho Workflow / Timeline) */
export function readLoopComboFx(layer: Layer): string[] {
  return normalizeLoopComboFx(
    (layer.appliedEffects ?? []).filter((f) => isLoopComboFxId(f.id) && f.enabled !== false).map((f) => f.presetId)
  )
}

/** Gỡ toàn bộ hiệu ứng kết hợp của một Node Loop khỏi Layer */
export function clearLoopComboFx(l: Layer, nodeId: string): void {
  const prefix = `${LOOP_COMBO_PREFIX}${nodeId}-`
  for (const fx of [...(l.appliedEffects ?? [])]) {
    if (fx.id.startsWith(prefix)) deleteLayerEffect(l, fx.id)
  }
}

const LIFECYCLE_KEYS = ['loopPlayCount', 'loopStartTime', 'loopEndTime', 'loopEndAction', 'loopFadeInSec', 'loopFadeOutSec'] as const

/** Xoá cấu hình vòng đời Loop khỏi Layer (khi tắt Node hoặc chuyển Node sang chế độ khác) */
export function clearLoopLifecycle(props: ImageProps): void {
  for (const k of LIFECYCLE_KEYS) delete props[k]
}

const clampNum = (v: number | undefined, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined

function writeLoopLifecycle(props: ImageProps, params: WorkflowNodeParams): void {
  const playCount = clampNum(params.loopPlayCount, 1, LOOP_MAX_PLAY_COUNT)
  if (playCount !== undefined) props.loopPlayCount = Math.round(playCount)
  if (params.loopEndAction) props.loopEndAction = params.loopEndAction
  const fadeIn = clampNum(params.loopFadeInSec, 0, 10)
  if (fadeIn !== undefined) props.loopFadeInSec = fadeIn
  const fadeOut = clampNum(params.loopFadeOutSec, 0, 10)
  if (fadeOut !== undefined) props.loopFadeOutSec = fadeOut
  // Thời gian Node (đã gồm Node Time chung) là mốc vòng đời Loop
  if (typeof params.timeStart === 'number' && Number.isFinite(params.timeStart)) props.loopStartTime = Math.max(0, params.timeStart)
  if (typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd)) props.loopEndTime = Math.max(0, params.timeEnd)
}

function writeLoopRhythm(props: ImageProps, params: WorkflowNodeParams, presetId: string): void {
  if (params.loopSpeed !== undefined) props.speed = params.loopSpeed
  if (params.loopMode !== undefined) props.loopMode = params.loopMode
  if (params.loopTimeOffset !== undefined) props.timeOffset = params.loopTimeOffset
  if (params.loopAutoPlayPaused !== undefined) props.autoPlayPaused = params.loopAutoPlayPaused
  props.loopRhythmMode = params.loopRhythmMode ?? (presetId === 'loop_flicker' ? 'flicker_opacity' : 'sync_both')
  props.loopRhythmRateHz = params.loopRhythmRateHz ?? params.animFxSpeed ?? 2.5
  props.loopRhythmIntensity = params.loopRhythmIntensity ?? params.intensity ?? 0.45
  props.loopMinOpacity = params.loopMinOpacity ?? params.animFxMinIntensity ?? 0.55
  props.loopScaleBeatPct = params.loopScaleBeatPct ?? 12
}

/** Dựng lại các hiệu ứng kết hợp theo khoảng thời gian Loop hiện tại (id cố định nên idempotent) */
function syncLoopComboFx(project: Project, node: WorkflowNode, l: Layer, params: WorkflowNodeParams): void {
  clearLoopComboFx(l, node.id)
  const wanted = normalizeLoopComboFx(params.loopComboFx)
  if (!wanted.length) return
  const start = Math.max(0, params.timeStart ?? l.inPoint ?? 0)
  const end = Math.max(start + 0.1, params.timeEnd ?? l.outPoint ?? project.comp.duration)
  const tol = 1 / Math.max(1, (project.comp.fps || 30) * 2)
  for (const id of wanted) {
    const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === id)
    const combo = LOOP_COMBO_FX_OPTIONS.find((o) => o.id === id)
    if (!opt || !combo) continue
    const duration = combo.placement === 'enter' ? Math.min(end - start, opt.defaultDuration) : end - start
    const count = opt.defaultCount ?? 2
    applyAnimFxPresetToLayer(l, opt, {
      fxId: loopComboFxId(node.id, id),
      start,
      duration: Math.max(0.1, Number(duration.toFixed(2))),
      count: combo.placement === 'sustain' ? Math.max(count, Math.round((end - start) / Math.max(0.2, opt.defaultDuration)) * count) : count,
      intensity: opt.defaultIntensity,
      color: opt.defaultColor ?? '#3dd6f5',
      side: 'outer',
      thickness: 10,
      speed: Math.max(0.5, count / Math.max(0.1, opt.defaultDuration)),
      minIntensity: 0.15,
      tol
    })
  }
}

/** Đồng bộ Node Loop xuống các Layer ảnh đích (props loop + vòng đời + hiệu ứng kết hợp) */
export function syncLoopSpriteNodeToLayers(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const presetId = params.animFxPreset ?? 'loop_rhythm'
  const comboTouched = !patch || 'loopComboFx' in patch || 'timeStart' in patch || 'timeEnd' in patch || 'enabled' in patch
  for (const l of project.layers) {
    if (!targetIds.has(l.id) || l.type !== 'image') continue
    if (!node.enabled) {
      l.props.loopRhythmMode = 'none'
      clearLoopLifecycle(l.props)
      for (const fx of l.appliedEffects ?? []) {
        if (fx.id.startsWith(`${LOOP_COMBO_PREFIX}${node.id}-`) && fx.enabled) toggleLayerEffect(l, fx.id, false)
      }
      continue
    }
    writeLoopRhythm(l.props, params, presetId)
    writeLoopLifecycle(l.props, params)
    if (comboTouched || readLoopComboFx(l).join() !== normalizeLoopComboFx(params.loopComboFx).join()) {
      syncLoopComboFx(project, node, l, params)
    }
  }
}

/** Đọc ngược thông số vòng đời + kết hợp từ Layer cho Node Loop (một logic chung Timeline ⇄ Workflow) */
export function deriveLoopLifecycleParams(layer: Layer, current?: WorkflowNode): Partial<WorkflowNodeParams> {
  if (layer.type !== 'image') return {}
  const p = layer.props
  const cp = current?.params ?? {}
  return {
    loopPlayCount: p.loopPlayCount ?? cp.loopPlayCount ?? 1,
    loopEndAction: p.loopEndAction ?? cp.loopEndAction ?? 'hold',
    loopFadeInSec: p.loopFadeInSec ?? cp.loopFadeInSec ?? 0,
    loopFadeOutSec: p.loopFadeOutSec ?? cp.loopFadeOutSec ?? 0.5,
    loopComboFx: (layer.appliedEffects ?? []).some((f) => isLoopComboFxId(f.id)) ? readLoopComboFx(layer) : (cp.loopComboFx ?? [])
  }
}
