import { useSyncExternalStore } from 'react'
import type { BonePose } from '@shared/layerRig'

/**
 * Bộ công cụ Tạo xương chuẩn Moho Pro:
 * - `select` (Phím S): Chọn xương, kéo khớp gốc / ngọn để chỉnh vị trí, độ dài & góc xương.
 * - `add` (Phím A): Bấm-kéo trực tiếp trên sân khấu 2D để vẽ chuỗi xương mới (hoặc click nhẹ tạo Pin Bone).
 * - `strength` (Phím T): Hiện & kéo bán kính viên nang Vùng ảnh hưởng xương (Bone Strength Envelope).
 * - `manipulate` (Phím Z): Thử bẻ khớp IK/FK trực tiếp ngay trong tab Tạo xương để kiểm tra độ uốn Mesh mà không tạo keyframe.
 */
export type MohoRigTool = 'select' | 'add' | 'strength' | 'manipulate'

export interface RigToolState {
  tool: MohoRigTool
  /** Hiện lớp vỏ viên nang Vùng ảnh hưởng (Bone Strength Capsule) trên khung 2D. */
  showInfluence: boolean
  /** Tự động sinh xương đối xứng Trái ⇄ Phải qua trục X = 0 khi vẽ xương bằng công cụ `add` (A). */
  mirrorDraw: boolean
  /** Tư thế bẻ thử tạm thời khi dùng công cụ `manipulate` (Z) ở tab Tạo xương. */
  testPoses: Record<string, BonePose>
}

const INITIAL_STATE: RigToolState = {
  tool: 'select',
  showInfluence: true,
  mirrorDraw: false,
  testPoses: {}
}

let state: RigToolState = { ...INITIAL_STATE }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getRigToolState(): RigToolState {
  return state
}

export function setRigToolState(patch: Partial<RigToolState>): void {
  state = { ...state, ...patch }
  emit()
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
