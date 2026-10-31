import { useSyncExternalStore } from 'react'
import type { LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips } from './workshopRig'
import { sameKeyTime, type AnimationAction, type BonePoseEntry } from './workshopAnimation'

export interface StepRecordState {
  /** Khoảng thời gian tự động nhảy tới sau mỗi lần nhấn Enter xác nhận vị trí (giây). */
  stepDuration: number
  /** Số Frame tương ứng cho mỗi bước nhấn Enter (đồng bộ với FPS của clip, mặc định 1 hoặc N frame). */
  stepFrames: number
  /** Đánh dấu người dùng vừa dùng chuột trái chỉnh xương và đang chờ nhấn Enter để chốt vị trí. */
  pendingConfirm: boolean
  /** Số mốc tư thế đã chốt liên tiếp trong phiên. */
  confirmedCount: number
  /** Thông báo trạng thái hiển thị trên thanh HUD và bảng Animation. */
  status: string
}

let state: StepRecordState = {
  stepDuration: 0.3,
  stepFrames: 9,
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

/** Đặt bước nhảy Enter theo số Frame (ví dụ +1F, +2F, +6F, +12F) và tự quy đổi ra giây theo FPS hiện tại. */
export function setStepRecordFrames(frames: number, fps = 30): void {
  const safeFps = Math.max(1, Math.min(120, fps))
  const safeFrames = Math.max(1, Math.min(240, Math.round(frames)))
  const stepDuration = Number((safeFrames / safeFps).toFixed(4))
  setStepRecordState({
    stepFrames: safeFrames,
    stepDuration,
    status: `Bước Enter: +${safeFrames} Frame (${stepDuration.toFixed(2)}s / bước @ ${safeFps}fps)`
  })
}

/** Đặt bước nhảy Enter theo khoảng cách giây mỗi bước (ví dụ 0.04s, 0.25s, 0.50s, 1.00s) và đồng bộ số Frame. */
export function setStepRecordSeconds(seconds: number, fps = 30): void {
  const safeFps = Math.max(1, Math.min(120, fps))
  const safeSec = Math.max(0.01, Math.min(10, Number(seconds.toFixed(4))))
  const stepFrames = Math.max(1, Math.round(safeSec * safeFps))
  setStepRecordState({
    stepDuration: safeSec,
    stepFrames,
    status: `Bước Enter: +${safeSec.toFixed(2)}s (~${stepFrames}F @ ${safeFps}fps)`
  })
}

export function markBoneAdjusted(boneName?: string, time?: number): void {
  const timeText = time !== undefined ? ` tại ${time.toFixed(2)}s` : ''
  setStepRecordState({
    pendingConfirm: true,
    status: `Đã chỉnh ${boneName ? `"${boneName}"` : 'xương'}${timeText} — Nhấn Enter ⏎ để chốt tư thế & tiến +${state.stepDuration.toFixed(2)}s`
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
 * sau đó tự động đẩy đầu phát sang mốc thời gian kế tiếp (+stepDuration) và giữ nguyên tư thế vừa chốt trên cả 2D & 3D.
 */
export function confirmPoseAndStep(
  composite: LayerComposite,
  currentTime: number,
  stepDuration = state.stepDuration
): ConfirmPoseResult {
  const step = Math.max(1 / 120, Number(stepDuration.toFixed(4)))
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

  const hasAnyKeyAfterZero = Object.values(rig.tracks).some((track) =>
    (track ?? []).some((k) => k.time > 0.001)
  )
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
  let confirmedTime = Number(currentTime.toFixed(4))
  let nextTime = Number((currentTime + step).toFixed(4))

  if (isModifiedAtZero) {
    confirmedTime = step
    nextTime = Number((step * 2).toFixed(4))
  }

  // Tự động nới thời lượng clip trước để cả confirmedTime và nextTime luôn nằm trong biên hợp lệ
  if (nextTime > rig.duration - 0.02) {
    const newDuration = Math.min(120, Math.max(rig.duration, Number((nextTime + Math.max(step, 0.2)).toFixed(2))))
    next = applyRigAction(next, { action: 'settings', duration: newDuration })
  }

  if (isModifiedAtZero) {
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

  // Nếu phía sau confirmedTime đã có keyframe cũ (ví dụ chỉnh tiếp trên clip có sẵn), neo luôn tư thế vừa chốt tại nextTime
  // để cả sân khấu 2D và 3D giữ nguyên 100% tư thế khi nhảy sang bước kế tiếp, không bị nội suy trôi khớp!
  const updatedTracks = ensureRigClips(next.rig ?? emptyRig()).rig.tracks
  const hasLaterKeysAfterConfirmed = Object.values(updatedTracks).some((track) =>
    (track ?? []).some((k) => k.time > confirmedTime + 1e-4)
  )
  if (hasLaterKeysAfterConfirmed) {
    next = applyRigAction(next, { action: 'set-pose', time: nextTime, poses: currentPoses })
  }

  const confirmedCount = state.confirmedCount + 1
  const status = isModifiedAtZero
    ? `✓ Đã chốt Bước 1 (0.00s → ${confirmedTime.toFixed(2)}s) · Giữ tư thế sang Bước 2 tại ${nextTime.toFixed(2)}s`
    : `✓ Đã chốt tư thế tại ${confirmedTime.toFixed(2)}s · Giữ tư thế chỉnh tiếp tại ${nextTime.toFixed(2)}s`

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
