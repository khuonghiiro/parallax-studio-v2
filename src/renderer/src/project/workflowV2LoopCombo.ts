import type { ImageProps, Layer, WorkflowNode, WorkflowNodeParams } from '@shared/types'

/**
 * Phần THUẦN (không phụ thuộc store / timeline) của Node Loop: danh mục hiệu ứng kết hợp, chuẩn hoá lựa chọn
 * và đọc ngược vòng đời từ Layer. Tách riêng để `workflowV2Derive` dùng được mà không kéo theo vòng import
 * store/editor (gây lỗi khởi tạo module khi app nạp).
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

export const LOOP_COMBO_PREFIX = 'fx-loopcombo-'

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

const LIFECYCLE_KEYS = ['loopPlayCount', 'loopStartTime', 'loopEndTime', 'loopEndAction', 'loopFadeInSec', 'loopFadeOutSec'] as const

/** Xoá cấu hình vòng đời Loop khỏi Layer (khi tắt Node hoặc chuyển Node sang chế độ khác) */
export function clearLoopLifecycle(props: ImageProps): void {
  for (const k of LIFECYCLE_KEYS) delete props[k]
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
