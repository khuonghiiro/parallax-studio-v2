import { useSyncExternalStore } from 'react'
import type { BonePose } from '@shared/layerRig'

/**
 * Bộ công cụ Tạo xương chuẩn Moho Pro:
 * - `select` (Phím S): Chọn xương, kéo khớp gốc / ngọn để chỉnh vị trí, độ dài & góc xương.
 * - `add` (Phím A): Bấm-kéo trực tiếp trên sân khấu 2D để vẽ chuỗi xương mới (hoặc click nhẹ chọn xương).
 * - `strength` (Phím T): Hiện & kéo bán kính viên nang Vùng ảnh hưởng xương (Bone Strength Envelope).
 * - `manipulate` (Phím Z): Thử bẻ khớp IK/FK trực tiếp ngay trong tab Tạo xương để kiểm tra độ uốn Mesh mà không tạo keyframe.
 */
export type MohoRigTool = 'select' | 'add' | 'strength' | 'manipulate'

export interface PendingBoneDashedLink {
  parentBoneId: string
  parentBoneName: string
  parentJoint: 'head' | 'tail'
  /** Điểm đặt khớp gốc của xương mới (đầu cuối của Nét 1 vẽ từ vỏ uốn) */
  anchorPoint: { x: number; y: number }
}

export interface RigToolState {
  tool: MohoRigTool
  /** Hiện lớp vỏ viên nang Vùng ảnh hưởng (Bone Strength Capsule) & tay kéo bán kính uốn trên khung 2D. */
  showInfluence: boolean
  /** Chế độ Đối xứng Trái ⇄ Phải qua trục X = 0 (vẽ xương, chỉnh khớp, chỉnh vùng uốn & thử bẻ khớp đối xứng). */
  mirrorDraw: boolean
  /** Tự động hàn khít khớp nối cha-con khi kéo chỉnh xương ở Frame 0 (giữ Alt để tách rời tạm thời). */
  autoWeld: boolean
  /** Dòng phản hồi trạng thái tức thì khi bật/tắt công cụ Vỏ / Đối xứng / Hàn khớp. */
  statusHint: string | null
  /** Tư thế bẻ thử tạm thời khi dùng công cụ `manipulate` (Z) ở tab Tạo xương. */
  testPoses: Record<string, BonePose>
  /** Nét 1 (Nét đứt kết nối từ vỏ uốn đến điểm đặt khớp) đang chờ vẽ Nét 2 (Nét tạo xương). */
  pendingDashedLink: PendingBoneDashedLink | null
}

const INITIAL_STATE: RigToolState = {
  tool: 'select',
  showInfluence: true,
  mirrorDraw: false,
  autoWeld: true,
  statusHint: null,
  testPoses: {},
  pendingDashedLink: null
}

let state: RigToolState = { ...INITIAL_STATE }
const listeners = new Set<() => void>()
let activeOverlayCancelHandler: (() => boolean) | null = null

function emit() {
  listeners.forEach((l) => l())
}

export function getRigToolState(): RigToolState {
  return state
}

export function setRigToolState(patch: Partial<RigToolState>): void {
  const nextTool = patch.tool ?? state.tool
  const clearPendingLink =
    patch.pendingDashedLink === undefined && nextTool !== 'add' && state.pendingDashedLink !== null
  state = {
    ...state,
    ...patch,
    ...(clearPendingLink ? { pendingDashedLink: null } : {})
  }
  emit()
}

export function registerBoneOverlayCancelHandler(fn: (() => boolean) | null): () => void {
  activeOverlayCancelHandler = fn
  return () => {
    if (activeOverlayCancelHandler === fn) activeOverlayCancelHandler = null
  }
}

/**
 * Huỷ thao tác đang vẽ xương hoặc huỷ Nét 1 (nét đứt kết nối từ vỏ uốn) khi nhấn phím Escape.
 * Trả về `true` nếu có thao tác vẽ / nét đứt vừa được huỷ.
 */
export function cancelActiveBoneOverlayOrLink(): boolean {
  if (activeOverlayCancelHandler && activeOverlayCancelHandler()) {
    return true
  }
  if (state.pendingDashedLink) {
    setRigToolState({
      pendingDashedLink: null,
      statusHint:
        'Đã huỷ nét đứt (Nét 1). Kéo lại từ vỏ uốn để xác định điểm khớp mới hoặc nhấn Esc lần nữa để bỏ chọn xương.'
    })
    return true
  }
  return false
}

export function setTestBonePose(boneId: string, patch: Partial<BonePose>): void {
  const prev = state.testPoses[boneId] ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
  state = {
    ...state,
    testPoses: {
      ...state.testPoses,
      [boneId]: { ...prev, ...patch }
    }
  }
  emit()
}

export function resetTestPoses(): void {
  if (Object.keys(state.testPoses).length === 0) return
  state = { ...state, testPoses: {} }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useRigToolStore(): RigToolState {
  return useSyncExternalStore(subscribe, getRigToolState, getRigToolState)
}
