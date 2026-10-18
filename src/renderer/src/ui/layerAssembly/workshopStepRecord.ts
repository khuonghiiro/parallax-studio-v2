import { useSyncExternalStore } from 'react'
import type { LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips } from './workshopRig'
import { sameKeyTime, type AnimationAction, type BonePoseEntry } from './workshopAnimation'

export interface StepRecordState {
  /** Khoảng thời gian tự động nhảy tới sau mỗi lần nhấn Enter xác nhận vị trí (giây). */
  stepDuration: number
  /** Đánh dấu người dùng vừa dùng chuột trái chỉnh xương và đang chờ nhấn Enter để chốt vị trí. */
  pendingConfirm: boolean
  /** Số mốc tư thế đã chốt liên tiếp trong phiên. */
  confirmedCount: number
  /** Thông báo trạng thái hiển thị trên thanh HUD và bảng Animation. */
  status: string
}

let state: StepRecordState = {
  stepDuration: 0.3,
  pendingConfirm: false,
  confirmedCount: 0,
  status: ''
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export function getStepRecordState(): StepRecordState {
  return state
}

export function setStepRecordState(patch: Partial<StepRecordState>): void {
  state = { ...state, ...patch }
  emit()
}

export function markBoneAdjusted(boneName?: string, time?: number): void {
  const timeText = time !== undefined ? ` tại ${time.toFixed(2)}s` : ''
  setStepRecordState({
    pendingConfirm: true,
    status: `Đã chỉnh ${boneName ? `"${boneName}"` : 'xương'}${timeText} — Nhấn Enter ⏎ để xác nhận vị trí & sang bước tiếp`
  })
}

export function subscribeStepRecord(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStepRecord(): StepRecordState {
  return useSyncExternalStore(subscribeStepRecord, getStepRecordState, getStepRecordState)
}

/**
 * Tạo các thao tác neo keyframe gốc tại t = 0.00s cho những xương chưa có keyframe nào trước time (> 0),
 * giúp xương giữ nguyên tư thế nghỉ ở đầu clip thay vì bị nhảy về tư thế mới ngay từ 0.00s.
 */
export function buildZeroAnchorOps(rig: LayerRig, boneIds: string[], time: number): AnimationAction[] {
  if (time <= 0.001) return []
  const ops: AnimationAction[] = []
  for (const boneId of boneIds) {
    const keys = rig.tracks[boneId] ?? []
    const hasPriorKey = keys.some((k) => k.time < time - 1e-4)
    if (!hasPriorKey) {
      ops.push({
        action: 'set-key',
        boneId,
        key: { time: 0, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' }
      })
    }
  }
  return ops
}

export interface ConfirmPoseResult {
  composite: LayerComposite
  confirmedTime: number
  nextTime: number
  status: string
}

/**
 * Xác nhận (chốt) vị trí tư thế toàn bộ khung xương tại thời điểm hiện tại khi người dùng nhấn Enter,
 * sau đó tự động đẩy đầu phát sang mốc thời gian kế tiếp (+stepDuration) để chỉnh tiếp theo thứ tự.
 */
export function confirmPoseAndStep(
  composite: LayerComposite,
  currentTime: number,
  stepDuration = state.stepDuration
): ConfirmPoseResult {
  const step = Math.max(0.05, Number(stepDuration.toFixed(2)))
  const { rig } = ensureRigClips(composite.rig ?? emptyRig())
  if (!rig.bones.length) {
    return {
      composite,
      confirmedTime: currentTime,
      nextTime: currentTime,
      status: 'Chưa có khung xương để ghi vị trí'
    }
  }

  const flatRig: LayerRig = { ...rig, loop: false }
  const currentPoses: BonePoseEntry[] = rig.bones.map((b) => {
    const p = sampleBonePose(flatRig, b.id, currentTime)
    return {
      boneId: b.id,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      scaleX: p.scaleX ?? 1,
      scaleY: p.scaleY ?? 1
    }
  })

  // Kiểm tra xem clip hiện tại đã có keyframe nào sau t = 0 chưa
  const hasAnyKeyAfterZero = Object.values(rig.tracks).some((track) =>
    (track ?? []).some((k) => k.time > 0.001)
  )
  // Kiểm tra xem tại t = 0 người dùng đã xoay/dời xương lệch khỏi dáng nghỉ (0°) chưa
  const isModifiedAtZero =
    currentTime <= 0.001 &&
    !hasAnyKeyAfterZero &&
    currentPoses.some(
      (p) =>
        Math.abs(p.rotation ?? 0) > 0.01 ||
        Math.abs(p.x ?? 0) > 0.01 ||
        Math.abs(p.y ?? 0) > 0.01 ||
        Math.abs((p.scaleX ?? 1) - 1) > 0.01 ||
        Math.abs((p.scaleY ?? 1) - 1) > 0.01
    )

  let next = composite
  let confirmedTime = Number(currentTime.toFixed(2))
  let nextTime = Number((currentTime + step).toFixed(2))

  if (isModifiedAtZero) {
    // Người dùng mở clip ở 0.00s, chỉnh xương rồi nhấn Enter ngay cho bước 1:
    // Giữ 0.00s ở dáng nghỉ ban đầu (0°) và đặt dáng vừa chỉnh vào mốc +step, rồi nhảy tiếp tới +2*step!
    confirmedTime = step
    nextTime = Number((step * 2).toFixed(2))
    const restPoses: BonePoseEntry[] = rig.bones.map((b) => ({
      boneId: b.id,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    }))
    next = applyRigAction(next, { action: 'set-pose', time: 0, poses: restPoses })
    next = applyRigAction(next, { action: 'set-pose', time: confirmedTime, poses: currentPoses })
  } else {
    // Nếu đang ở t > 0 mà có xương chưa có mốc gốc ở 0.00s thì neo dáng nghỉ ở 0.00s trước
    if (currentTime > 0.001) {
      const zeroOps: AnimationAction[] = []
      for (const b of rig.bones) {
        const track = rig.tracks[b.id] ?? []
        const hasZero = track.some((k) => sameKeyTime(k.time, 0))
        if (!hasZero) {
          zeroOps.push({
            action: 'set-key',
            boneId: b.id,
            key: { time: 0, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' }
          })
        }
      }
      if (zeroOps.length > 0) {
        next = applyRigAction(next, { action: 'batch', operations: zeroOps })
      }
    }
    next = applyRigAction(next, { action: 'set-pose', time: confirmedTime, poses: currentPoses })
  }

  // Tự động nới thời lượng clip nếu mốc kế tiếp vượt quá thời lượng hiện tại
  if (nextTime > rig.duration - 0.05) {
    const newDuration = Math.min(120, Math.max(rig.duration, Number((nextTime + step).toFixed(2))))
    next = applyRigAction(next, { action: 'settings', duration: newDuration })
  }

  const confirmedCount = state.confirmedCount + 1
  const status = isModifiedAtZero
    ? `✓ Đã chốt Bước 1 (0.00s → ${confirmedTime.toFixed(2)}s) · Sẵn sàng chỉnh Bước 2 tại ${nextTime.toFixed(2)}s`
    : `✓ Đã xác nhận vị trí tại ${confirmedTime.toFixed(2)}s · Sẵn sàng chỉnh tiếp tại ${nextTime.toFixed(2)}s`

  setStepRecordState({
    pendingConfirm: false,
    confirmedCount,
    status
  })

  return {
    composite: next,
    confirmedTime,
    nextTime,
    status
  }
}
