import type { Animatable, EaseName, Project } from '@shared/types'
import { setCompDuration } from '../../../actions'
import { addKeyframe, evaluate } from '../../../animation/keyframes'
import { frameTolerance } from '../../../store/editor'
import {
  applyStageFrameToDraft,
  clampCameraAngle,
  clampFrameScale,
  extractCameraFrames2D,
  findNearestShotByStage2D,
  pose3DToStageFrame,
  type CameraFrame2D,
  type ShotStageBox
} from './animateCameraMath'
import {
  CAMERA_ACTION_CATEGORIES,
  CAMERA_ACTION_MODES,
  getActionModeMeta,
  getActionVerbLabel,
  getWaypointTimingMeta,
  inferWaypointActionClassification,
  isSubWaypointAtTime,
  moveAndShiftWaypointMeta,
  recordExplicitActionMode,
  removeWaypointMetaAtTime,
  setSubWaypointAtTime,
  setWaypointTimingMeta,
  shiftExplicitActionModes,
  type CameraActionCategory,
  type CameraActionMode,
  type CameraActionModeMeta
} from './animateCameraActionModes'
import {
  alignWaypointInShot,
  applyWaypointActionMode,
  setKeyframeEaseAtTime
} from './animateCameraActionApplier'

export {
  alignWaypointInShot,
  applyWaypointActionMode,
  CAMERA_ACTION_CATEGORIES,
  CAMERA_ACTION_MODES,
  getActionModeMeta,
  getActionVerbLabel,
  getWaypointTimingMeta,
  isSubWaypointAtTime,
  recordExplicitActionMode,
  setSubWaypointAtTime,
  setWaypointTimingMeta,
  type CameraActionCategory,
  type CameraActionMode,
  type CameraActionModeMeta
}

export interface CameraWaypointItem extends CameraFrame2D {
  /** Nhãn thứ tự hiển thị (ví dụ '1', '5', '5.1', '5.2') */
  displayLabel: string
  /** True nếu đây là mốc phụ bổ sung vào bước/cảnh cũ (ví dụ #5.1, #5.2) */
  isSubWaypoint: boolean
  /** Nhãn của mốc liền trước trên lộ trình (ví dụ '4', '5', '5.1') */
  prevDisplayLabel: string | null
  /** Nhãn dự kiến của mốc tiếp theo nếu bấm thêm từ mốc này (ví dụ '5.1', '5.2' hoặc '10') */
  nextSpawnLabel: string
  tag: 'start' | 'pan' | 'zoom-in' | 'zoom-out' | 'hold'
  tagLabel: string
  actionMode: CameraActionMode
  angleSummary: string
  durationFromPrev: number
  /** Thời lượng riêng của đoạn xuất phát từ Mốc này (giây: Mốc #1 có 2s -> 0..2s, Mốc #2 có 3s -> 2..5s) */
  stepDuration: number
  /** Thời điểm kết thúc đoạn xuất phát từ Mốc này (= time + stepDuration) */
  endTime: number
  /** Đệm chờ tĩnh ở đầu đoạn trước khi bắt đầu động tác quay (giây) */
  delaySec: number
  /** Thời gian thực hiện động tác quay (giây: càng ít càng nhanh, càng lâu càng chậm) */
  actionDurationSec: number
  zoomPct: number
  isFirstOfShot: boolean
}

/**
 * Xác định chính xác Mốc Lộ Trình đang hoạt động tại thời điểm `time`:
 * - Mốc #1 (2.0s: 0.0s ➔ 2.0s) hoạt động trong [0.00s, 2.00s)
 * - Ngay khi tới 2.00s / 2.01s ➔ 5.00s, chuyển sang Mốc #2 (3.0s)
 */
export function findActiveWaypointIndexAtTime(
  waypoints: CameraWaypointItem[],
  time: number,
  tol = 0.008
): number {
  if (waypoints.length === 0) return 0
  for (let i = waypoints.length - 1; i >= 0; i--) {
    if (time >= waypoints[i].time - tol) {
      return i
    }
  }
  return 0
}

/**
 * Enriches extracted 2D camera frames with waypoint tags, action modes, 3D angle badges,
 * sub-waypoint labels (#5.1, #5.2), step durations, delay/action timing, zoom percentages, and first-of-shot flags.
 */
export function enrichCameraWaypoints(frames: CameraFrame2D[]): CameraWaypointItem[] {
  const firstIdxByShot = new Map<string, number>()
  const labels: string[] = []
  const subFlags: boolean[] = []
  const mainNums: number[] = []
  const subCountsByMain = new Map<number, number>()
  let mainCounter = 0

  frames.forEach((f, idx) => {
    const shotKey = f.shotId ?? 'global'
    if (!firstIdxByShot.has(shotKey)) {
      firstIdxByShot.set(shotKey, idx)
    }

    const isSub = idx > 0 && isSubWaypointAtTime(f.time)
    subFlags.push(isSub)
    if (!isSub) {
      mainCounter += 1
      mainNums.push(mainCounter)
      subCountsByMain.set(mainCounter, 0)
      labels.push(`${mainCounter}`)
    } else {
      const nextSub = (subCountsByMain.get(mainCounter) ?? 0) + 1
      subCountsByMain.set(mainCounter, nextSub)
      mainNums.push(mainCounter)
      labels.push(`${mainCounter}.${nextSub}`)
    }
  })

  return frames.map((f, idx) => {
    const isFirstOfShot = firstIdxByShot.get(f.shotId ?? 'global') === idx
    const prev = idx > 0 ? frames[idx - 1] : null
    const next = idx + 1 < frames.length ? frames[idx + 1] : null
    const durationFromPrev = prev ? Math.max(0, Math.round((f.time - prev.time) * 100) / 100) : 0
    const rawStepDur = next ? Math.max(0.2, Math.round((next.time - f.time) * 100) / 100) : undefined
    const timingMeta = getWaypointTimingMeta(f.time, rawStepDur ?? 2.5)
    const stepDuration = rawStepDur ?? timingMeta.stepDuration
    const endTime = Math.round((f.time + stepDuration) * 100) / 100
    const delaySec = timingMeta.hasCustomActionTiming
      ? timingMeta.delaySec
      : Math.min(Math.max(0, Math.round((stepDuration - 0.2) * 100) / 100), timingMeta.delaySec)
    const actionDurationSec = timingMeta.hasCustomActionTiming
      ? timingMeta.actionDurationSec
      : Math.max(0.2, Math.round((stepDuration - delaySec) * 100) / 100)
    const zoomPct = Math.round((1 / Math.max(0.045, f.scale)) * 100)

    const { tag, tagLabel, actionMode } = inferWaypointActionClassification(
      f,
      idx,
      prev,
      stepDuration,
      zoomPct
    )

    const angleParts: string[] = []
    if (Math.abs(f.yaw) >= 1) angleParts.push(`Yaw ${f.yaw > 0 ? '+' : ''}${Math.round(f.yaw)}°`)
    if (Math.abs(f.pitch) >= 1) angleParts.push(`Pitch ${f.pitch > 0 ? '+' : ''}${Math.round(f.pitch)}°`)
    if (Math.abs(f.roll) >= 1) angleParts.push(`Roll ${f.roll > 0 ? '+' : ''}${Math.round(f.roll)}°`)
    const angleSummary = angleParts.length > 0 ? angleParts.join(' · ') : 'Thẳng 0°'

    const isLastMain = idx === frames.length - 1 && !subFlags[idx]
    const parentMain = mainNums[idx] ?? idx + 1
    const existingSubs = subCountsByMain.get(parentMain) ?? 0
    const nextSpawnLabel = isLastMain
      ? `${mainCounter + 1}`
      : `${parentMain}.${existingSubs + 1}`

    return {
      ...f,
      displayLabel: labels[idx] ?? `${idx + 1}`,
      isSubWaypoint: subFlags[idx] ?? false,
      prevDisplayLabel: idx > 0 ? (labels[idx - 1] ?? `${idx}`) : null,
      nextSpawnLabel,
      tag,
      tagLabel,
      actionMode,
      angleSummary,
      durationFromPrev,
      stepDuration,
      endTime,
      delaySec,
      actionDurationSec,
      zoomPct,
      isFirstOfShot
    }
  })
}

/**
 * Creates a camera waypoint that pans to the exact center of a target shot.
 */
export function panCameraToShot(
  draft: Project,
  layout: ShotStageBox[],
  targetShotId: string,
  time: number,
  scale = 1.0,
  ease: EaseName = 'easeInOut'
): void {
  const box =
    (targetShotId && targetShotId !== 'global'
      ? layout.find((b) => b.shotId === targetShotId)
      : null) ?? layout[0]
  if (!box) return

  if (time > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(time + 1))
  }

  const existing = extractCameraFrames2D(draft, layout).find((f) => Math.abs(f.time - time) <= 0.05)
  applyStageFrameToDraft(draft, layout, time, box.stageX, box.stageY, scale, true, {
    yaw: existing?.yaw ?? 0,
    pitch: existing?.pitch ?? 0,
    roll: existing?.roll ?? 0,
    ease
  })
  setKeyframeEaseAtTime(draft, time, ease)
}

/**
 * Creates a camera waypoint panning directly to a 2D layer's projected coordinates.
 * Also adjusts focus distance to match the target layer's depth (Rack Focus).
 */
export function panCameraToLayer2D(
  draft: Project,
  layout: ShotStageBox[],
  shotId: string | null,
  layerOffsetX: number,
  layerOffsetY: number,
  time: number,
  scale = 0.65,
  ease: EaseName = 'easeInOut',
  layerDepthZ?: number
): void {
  const box =
    (shotId && shotId !== 'global' ? layout.find((b) => b.shotId === shotId) : null) ?? layout[0]
  if (!box) return

  const targetStageX = Math.round(box.stageX + layerOffsetX)
  const targetStageY = Math.round(box.stageY + layerOffsetY)

  if (time > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(time + 1))
  }

  const existing = extractCameraFrames2D(draft, layout).find((f) => Math.abs(f.time - time) <= 0.05)
  applyStageFrameToDraft(draft, layout, time, targetStageX, targetStageY, scale, true, {
    yaw: existing?.yaw ?? 0,
    pitch: existing?.pitch ?? 0,
    roll: existing?.roll ?? 0,
    ease
  })
  setKeyframeEaseAtTime(draft, time, ease)

  if (layerDepthZ !== undefined) {
    const dist = Math.hypot(
      draft.camera.position.keyframes.find((k) => Math.abs(k.t - time) < 0.05)?.value[2] ?? 1000,
      1000
    )
    const focusDist = Math.max(10, Math.round(dist + layerDepthZ))
    addKeyframe(draft.camera.focusDistance, time, focusDist, ease)
  }
}

/**
 * Creates a zoom waypoint (smaller scale = Zoom In, larger scale = Zoom Out) at current or offset time.
 */
export function zoomCameraAtPoint(
  draft: Project,
  layout: ShotStageBox[],
  time: number,
  stageX: number,
  stageY: number,
  targetScale: number,
  ease: EaseName = 'easeInOut'
): void {
  if (time > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(time + 1))
  }

  const clampedScale = clampFrameScale(targetScale)
  applyStageFrameToDraft(draft, layout, time, stageX, stageY, clampedScale, true, { ease })
  setKeyframeEaseAtTime(draft, time, ease)
}

function removeKeyframeAtTime<T>(track: Animatable<T> | undefined, time: number, tol: number): void {
  if (!track) return
  track.keyframes = track.keyframes.filter((k) => Math.abs(k.t - time) > tol)
}

function shiftSubsequentKeyframes<T>(track: Animatable<T> | undefined, afterTime: number, delta: number, tol: number): void {
  if (!track || Math.abs(delta) < 0.001) return
  for (const k of track.keyframes) {
    if (k.t > afterTime + tol) {
      k.t = Math.max(0, Math.round((k.t + delta) * 1000) / 1000)
    }
  }
  track.keyframes.sort((a, b) => a.t - b.t)
}

/**
 * Updates an existing camera waypoint parameters (time, pan X/Y, scale, yaw, pitch, roll, ease).
 * Preserves all unedited parameters of the waypoint accurately!
 */
export function updateCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  oldTime: number,
  updates: {
    time?: number
    stageX?: number
    stageY?: number
    scale?: number
    yaw?: number
    pitch?: number
    roll?: number
    ease?: EaseName
    ripple?: boolean
  }
): void {
  const tol = Math.max(frameTolerance(draft), 0.02)
  const existingFrames = extractCameraFrames2D(draft, layout)
  const existing = existingFrames.find((f) => Math.abs(f.time - oldTime) <= tol)

  let baseStageX = existing?.stageX
  let baseStageY = existing?.stageY
  let baseScale = existing?.scale
  let baseYaw = existing?.yaw ?? 0
  let basePitch = existing?.pitch ?? 0
  let baseRoll = existing?.roll ?? 0
  const baseEase = existing?.ease ?? 'easeInOut'

  if (baseStageX === undefined || baseStageY === undefined || baseScale === undefined) {
    const pos = evaluate(draft.camera.position, oldTime)
    const tgt = evaluate(draft.camera.target, oldTime)
    const rVal = draft.camera.roll ? evaluate(draft.camera.roll, oldTime) : 0
    const mapped = pose3DToStageFrame(draft, layout, pos, tgt, rVal)
    baseStageX = mapped.stageX
    baseStageY = mapped.stageY
    baseScale = mapped.scale
    baseYaw = mapped.yaw
    basePitch = mapped.pitch
    baseRoll = mapped.roll
  }

  const newTime = updates.time !== undefined ? Math.max(0, Math.round(updates.time * 100) / 100) : oldTime
  const deltaT = newTime - oldTime

  if (Math.abs(deltaT) > 0.001) {
    removeKeyframeAtTime(draft.camera.position, oldTime, tol)
    removeKeyframeAtTime(draft.camera.target, oldTime, tol)
    removeKeyframeAtTime(draft.camera.focusDistance, oldTime, tol)
    removeKeyframeAtTime(draft.camera.roll, oldTime, tol)

    if (updates.ripple) {
      shiftSubsequentKeyframes(draft.camera.position, oldTime, deltaT, tol)
      shiftSubsequentKeyframes(draft.camera.target, oldTime, deltaT, tol)
      shiftSubsequentKeyframes(draft.camera.focusDistance, oldTime, deltaT, tol)
      shiftSubsequentKeyframes(draft.camera.roll, oldTime, deltaT, tol)
    }
    moveAndShiftWaypointMeta(oldTime, newTime, Boolean(updates.ripple))
  }

  const nextStageX = updates.stageX !== undefined ? Math.round(updates.stageX) : baseStageX
  const nextStageY = updates.stageY !== undefined ? Math.round(updates.stageY) : baseStageY
  const nextScale = updates.scale !== undefined ? clampFrameScale(updates.scale) : baseScale
  const nextYaw = updates.yaw !== undefined ? clampCameraAngle(updates.yaw, -85, 85) : baseYaw
  const nextPitch = updates.pitch !== undefined ? clampCameraAngle(updates.pitch, -75, 75) : basePitch
  const nextRoll = updates.roll !== undefined ? clampCameraAngle(updates.roll, -180, 180) : baseRoll
  const nextEase = updates.ease ?? baseEase

  applyStageFrameToDraft(draft, layout, newTime, nextStageX, nextStageY, nextScale, true, {
    yaw: nextYaw,
    pitch: nextPitch,
    roll: nextRoll,
    ease: nextEase
  })
  setKeyframeEaseAtTime(draft, newTime, nextEase)
  draft.camera.position.keyframes = draft.camera.position.keyframes.map((k) => ({ ...k }))

  const maxKeyT = Math.max(
    newTime,
    ...draft.camera.position.keyframes.map((k) => k.t)
  )
  if (maxKeyT > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(maxKeyT + 1))
  }
}

/**
 * Removes a camera waypoint at time `t`. Keeps at least 1 keyframe if any were set.
 */
export function removeCameraWaypoint(draft: Project, time: number): boolean {
  const tol = frameTolerance(draft)
  const posKeys = draft.camera.position.keyframes
  if (posKeys.length <= 1) return false

  removeKeyframeAtTime(draft.camera.position, time, tol)
  removeKeyframeAtTime(draft.camera.target, time, tol)
  removeKeyframeAtTime(draft.camera.focusDistance, time, tol)
  removeKeyframeAtTime(draft.camera.roll, time, tol)
  removeWaypointMetaAtTime(time)
  return true
}

export function shiftSubsequentCameraKeyframes(draft: Project, afterTime: number, delta: number): void {
  const tol = Math.max(frameTolerance(draft), 0.02)
  const hasAfter = draft.camera.position.keyframes.some((k) => k.t > afterTime + tol)
  if (!hasAfter || Math.abs(delta) < 0.001) return
  shiftSubsequentKeyframes(draft.camera.position, afterTime, delta, tol)
  shiftSubsequentKeyframes(draft.camera.target, afterTime, delta, tol)
  shiftSubsequentKeyframes(draft.camera.focusDistance, afterTime, delta, tol)
  shiftSubsequentKeyframes(draft.camera.roll, afterTime, delta, tol)
  shiftExplicitActionModes(afterTime, delta)
  const maxKeyT = Math.max(0, ...draft.camera.position.keyframes.map((k) => k.t))
  if (maxKeyT > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(maxKeyT + 1))
  }
}

/**
 * Duplicates a camera waypoint to a new timestamp `targetTime`.
 * If subsequent waypoints exist, marks the duplicated waypoint as a sub-waypoint (#5.1, #5.2).
 */
export function duplicateCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  sourceFrame: CameraFrame2D,
  targetTime: number
): void {
  const tol = Math.max(frameTolerance(draft), 0.02)
  const hasAfter = draft.camera.position.keyframes.some((k) => k.t > sourceFrame.time + tol)
  const shouldBeSub = hasAfter || isSubWaypointAtTime(sourceFrame.time)
  const delta = Math.max(0.1, targetTime - sourceFrame.time)
  shiftSubsequentCameraKeyframes(draft, sourceFrame.time, delta)
  if (targetTime > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(targetTime + 1))
  }
  applyStageFrameToDraft(
    draft,
    layout,
    targetTime,
    sourceFrame.stageX,
    sourceFrame.stageY,
    sourceFrame.scale,
    true,
    {
      yaw: sourceFrame.yaw,
      pitch: sourceFrame.pitch,
      roll: sourceFrame.roll,
      ease: sourceFrame.ease
    }
  )
  setKeyframeEaseAtTime(draft, targetTime, sourceFrame.ease)
  if (shouldBeSub) {
    setSubWaypointAtTime(targetTime, true)
  }
}

/**
 * Adds a hold waypoint at time + holdSec that maintains the same camera framing,
 * creating a cinematic pause to appreciate the scene before the next movement.
 */
export function addCameraHoldWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  sourceFrame: CameraFrame2D,
  holdSec = 2.0
): void {
  const tol = Math.max(frameTolerance(draft), 0.02)
  const hasAfter = draft.camera.position.keyframes.some((k) => k.t > sourceFrame.time + tol)
  const shouldBeSub = hasAfter || isSubWaypointAtTime(sourceFrame.time)
  const targetTime = Math.round((sourceFrame.time + holdSec) * 100) / 100
  shiftSubsequentCameraKeyframes(draft, sourceFrame.time, holdSec)
  if (targetTime > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(targetTime + 1))
  }
  applyStageFrameToDraft(
    draft,
    layout,
    targetTime,
    sourceFrame.stageX,
    sourceFrame.stageY,
    sourceFrame.scale,
    true,
    {
      yaw: sourceFrame.yaw,
      pitch: sourceFrame.pitch,
      roll: sourceFrame.roll,
      ease: 'easeInOut'
    }
  )
  setKeyframeEaseAtTime(draft, targetTime, 'easeInOut')
  recordExplicitActionMode(targetTime, 'hold')
  if (shouldBeSub) {
    setSubWaypointAtTime(targetTime, true)
  }
}

/**
 * Appends a new camera waypoint centered on `shotId` at the end of the current camera route
 * (or at 0s if no keyframes exist yet), returning the new waypoint's timestamp.
 */
export function appendShotCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  shotId: string,
  stepSec = 2.0
): number | null {
  const box = layout.find((b) => b.shotId === shotId)
  if (!box) return null

  const frames = extractCameraFrames2D(draft, layout)
  const last = frames[frames.length - 1]
  const hasKeyframes =
    draft.camera.position.keyframes.length > 0 || draft.camera.target.keyframes.length > 0

  if (!hasKeyframes && last) {
    applyStageFrameToDraft(draft, layout, 0, last.stageX, last.stageY, last.scale, true, {
      yaw: last.yaw,
      pitch: last.pitch,
      roll: last.roll
    })
  }

  const lastDur = last ? getWaypointTimingMeta(last.time, stepSec).stepDuration : stepSec
  const nextTime =
    !last || (!hasKeyframes && last.shotId === shotId)
      ? 0
      : Math.round(((last?.time ?? 0) + lastDur) * 100) / 100

  if (nextTime > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(nextTime + 1))
  }

  applyStageFrameToDraft(draft, layout, nextTime, box.stageX, box.stageY, 1.0, true, {
    yaw: 0,
    pitch: 0,
    roll: 0,
    ease: 'easeInOut'
  })
  setKeyframeEaseAtTime(draft, nextTime, 'easeInOut')
  return nextTime
}

/**
 * Ensures `shotId` has a waypoint in `draft` (returning the existing waypoint time for `shotId`
 * if `preferExisting` is true, or appending a new waypoint at the end of the route if `shotId`
 * has no waypoint yet).
 */
export function ensureShotWaypointTime(
  draft: Project,
  layout: ShotStageBox[],
  shotId: string,
  fallbackTime: number,
  preferLast = false
): number {
  const frames = extractCameraFrames2D(draft, layout)
  const inShot = frames.filter((f) => f.shotId === shotId)
  if (inShot.length > 0) {
    return (preferLast ? inShot[inShot.length - 1] : inShot[0]).time
  }
  const spawned = appendShotCameraWaypoint(draft, layout, shotId, 2.0)
  return spawned ?? fallbackTime
}

/**
 * Tạo mốc lộ trình tiếp theo hoặc chèn bổ sung nhánh phụ (#5.1, #5.2...) vào bước/cảnh cũ đang chọn:
 * - Giữ nguyên cảnh đang chọn (tuyệt đối không nhảy sang cảnh kế tiếp làm lạc cảnh).
 * - Nếu sau bước đang chọn đã có các mốc khác (ví dụ Cảnh 2 có #4/#5/#6, Cảnh 3 có #7/#8/#9 và đang chọn #5 ở Cảnh 2),
 *   mốc mới sẽ chèn ngay sau chuỗi nhánh của #5 và đánh số #5.1, #5.2... đồng thời giữ nguyên #6, #7, #8, #9.
 */
export function spawnNextCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  options: {
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold' | 'shot'
    activeTime: number
    selectedShotId?: string | null
    targetShot?: ShotStageBox
    fromWaypointTime?: number
    stepSec?: number
  }
): {
  nextTime: number
  displayLabel: string
  shotId: string | null
  shotName: string
  isSubWaypoint: boolean
} | null {
  const frames = extractCameraFrames2D(draft, layout)
  const waypoints = enrichCameraWaypoints(frames)
  if (waypoints.length === 0) return null

  const tol = Math.max(frameTolerance(draft), 0.02)
  const activeIdx = findActiveWaypointIndexAtTime(waypoints, options.activeTime, tol)
  const activeWp = waypoints[activeIdx] ?? waypoints[waypoints.length - 1]

  let base: CameraWaypointItem = activeWp
  let isNewShotAppend = false
  let targetShotBox: ShotStageBox | undefined

  if (options.fromWaypointTime !== undefined) {
    const found = waypoints.find((w) => Math.abs(w.time - options.fromWaypointTime!) <= tol)
    if (found) base = found
  } else if (options.mode === 'shot' && options.targetShot) {
    targetShotBox = options.targetShot
    const inTargetShot = waypoints.filter((w) => w.shotId === options.targetShot!.shotId)
    if (activeWp.shotId === options.targetShot.shotId) {
      base = activeWp
    } else if (inTargetShot.length > 0) {
      base = inTargetShot[inTargetShot.length - 1]
    } else {
      base = waypoints[waypoints.length - 1]
      isNewShotAppend = true
    }
  } else if (options.selectedShotId && activeWp.shotId !== options.selectedShotId) {
    const inSelectedShot = waypoints.filter((w) => w.shotId === options.selectedShotId)
    if (inSelectedShot.length > 0) {
      base = inSelectedShot[inSelectedShot.length - 1]
    } else {
      targetShotBox = layout.find((b) => b.shotId === options.selectedShotId)
      base = waypoints[waypoints.length - 1]
      if (targetShotBox) isNewShotAppend = true
    }
  }

  // Nếu bước gốc (#5) đã có sẵn các nhánh phụ (#5.1, #5.2...) ngay sau nó trong cùng cảnh,
  // tự động nối tiếp vào cuối chuỗi nhánh phụ đó để sinh ra #5.2, #5.3 đúng thứ tự thời gian.
  let anchor = base
  if (!isNewShotAppend) {
    for (let i = base.index + 1; i < waypoints.length; i++) {
      if (waypoints[i].isSubWaypoint && waypoints[i].shotId === base.shotId) {
        anchor = waypoints[i]
      } else {
        break
      }
    }
  }

  const box =
    targetShotBox ??
    (anchor.shotId ? layout.find((b) => b.shotId === anchor.shotId) : null) ??
    findNearestShotByStage2D(layout, anchor.stageX, anchor.stageY) ??
    layout[0]

  let nextStageX = anchor.stageX
  let nextStageY = anchor.stageY
  let nextScale = anchor.scale

  if (isNewShotAppend && box) {
    nextStageX = box.stageX
    nextStageY = box.stageY
    nextScale =
      options.mode === 'zoom-in'
        ? clampFrameScale(0.65)
        : options.mode === 'zoom-out'
          ? clampFrameScale(1.38)
          : 1.0
  } else if (options.mode === 'hold') {
    nextStageX = anchor.stageX
    nextStageY = anchor.stageY
    nextScale = anchor.scale
  } else if (options.mode === 'zoom-in') {
    nextStageX = anchor.stageX
    nextStageY = anchor.stageY
    nextScale = clampFrameScale(anchor.scale * 0.68)
  } else if (options.mode === 'zoom-out') {
    nextStageX = anchor.stageX
    nextStageY = anchor.stageY
    nextScale = clampFrameScale(anchor.scale * 1.35)
  } else if (box) {
    // Lia máy bên trong phạm vi của cảnh hiện tại (tuyệt đối không nhảy sang cảnh kế tiếp!)
    const maxOffsetX = Math.round(box.width * 0.28)
    const maxOffsetY = Math.round(box.height * 0.2)
    const relX = anchor.stageX - box.stageX
    const relY = anchor.stageY - box.stageY
    const stepX = Math.round(box.width * 0.18)
    const stepY = Math.round(box.height * 0.05)

    let nextRelX = relX + stepX
    if (nextRelX > maxOffsetX) {
      nextRelX = relX - stepX >= -maxOffsetX ? relX - stepX : 0
    }
    let nextRelY = relY - stepY
    if (Math.abs(nextRelY) > maxOffsetY) {
      nextRelY = Math.round(relY * 0.5)
    }
    nextStageX = Math.round(box.stageX + nextRelX)
    nextStageY = Math.round(box.stageY + nextRelY)
    nextScale = anchor.scale
  }

  const hasKeyframes =
    draft.camera.position.keyframes.length > 0 || draft.camera.target.keyframes.length > 0
  if (!hasKeyframes) {
    applyStageFrameToDraft(draft, layout, 0, base.stageX, base.stageY, base.scale, true, {
      yaw: base.yaw,
      pitch: base.pitch,
      roll: base.roll
    })
  }

  const hasSubsequentWaypoints = !isNewShotAppend && (anchor.index < waypoints.length - 1 || anchor.isSubWaypoint)
  const stepDur = options.stepSec ?? 2.0
  const nextTime = !hasKeyframes
    ? stepDur
    : Math.round((anchor.time + stepDur) * 100) / 100

  shiftSubsequentCameraKeyframes(draft, anchor.time, stepDur)
  if (nextTime > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(nextTime + 1))
  }

  const nextYaw = isNewShotAppend ? 0 : anchor.yaw
  const nextPitch = isNewShotAppend ? 0 : anchor.pitch
  const nextRoll = isNewShotAppend ? 0 : anchor.roll

  applyStageFrameToDraft(draft, layout, nextTime, nextStageX, nextStageY, nextScale, true, {
    yaw: nextYaw,
    pitch: nextPitch,
    roll: nextRoll,
    ease: 'easeInOut'
  })
  setKeyframeEaseAtTime(draft, nextTime, 'easeInOut')

  if (hasSubsequentWaypoints) {
    setSubWaypointAtTime(nextTime, true)
  } else {
    setSubWaypointAtTime(nextTime, false)
  }

  const explicitMode: CameraActionMode =
    options.mode === 'zoom-in'
      ? 'push-in'
      : options.mode === 'zoom-out'
        ? 'pull-out'
        : options.mode === 'hold'
          ? 'hold'
          : 'pan'
  recordExplicitActionMode(nextTime, explicitMode)

  const afterWps = enrichCameraWaypoints(extractCameraFrames2D(draft, layout))
  const spawned =
    afterWps.find((w) => Math.abs(w.time - nextTime) <= 0.05) ?? afterWps[afterWps.length - 1]

  return {
    nextTime: spawned?.time ?? nextTime,
    displayLabel: spawned?.displayLabel ?? `${afterWps.length}`,
    shotId: spawned?.shotId ?? box?.shotId ?? null,
    shotName: spawned?.shotName ?? box?.name ?? 'Cảnh',
    isSubWaypoint: Boolean(spawned?.isSubWaypoint)
  }
}

/**
 * Cập nhật Thời lượng riêng (`stepDuration`), Đệm chờ (`delaySec`) và Thời gian thực hiện động tác (`actionDurationSec`)
 * cho đoạn chuyển xuất phát từ Mốc `waypointIndex` (`#(waypointIndex + 1) ➔ #(waypointIndex + 2)`):
 * - Giữ nguyên thời điểm bắt đầu của Mốc `waypointIndex` (với Mốc #1 luôn neo chuẩn tại 0.0s).
 * - Tự động dời Mốc kế tiếp và các mốc phía sau để đoạn chuyển kéo dài đúng `stepDuration` giây.
 */
export function updateWaypointStepDuration(
  draft: Project,
  layout: ShotStageBox[],
  waypointIndex: number,
  options: {
    stepDuration?: number
    delaySec?: number
    actionDurationSec?: number
  }
): number {
  const frames = extractCameraFrames2D(draft, layout)
  const cur = frames[waypointIndex]
  if (!cur) return 0

  if (waypointIndex === 0 && cur.time > 0.001) {
    const offsetToZero = -cur.time
    updateCameraWaypoint(draft, layout, cur.time, {
      time: 0,
      ripple: true
    })
    cur.time = 0
    for (let i = 1; i < frames.length; i++) {
      frames[i].time = Math.max(0, Math.round((frames[i].time + offsetToZero) * 100) / 100)
    }
  }

  const next = waypointIndex + 1 < frames.length ? frames[waypointIndex + 1] : null
  const currentRawStepDur = next
    ? Math.max(0.2, Math.round((next.time - cur.time) * 100) / 100)
    : getWaypointTimingMeta(cur.time, 2.5).stepDuration
  const currentMeta = getWaypointTimingMeta(cur.time, currentRawStepDur)

  let nextDelay =
    options.delaySec !== undefined
      ? Math.max(0, Math.round(options.delaySec * 100) / 100)
      : currentMeta.delaySec
  let nextActionDur =
    options.actionDurationSec !== undefined
      ? Math.max(0.2, Math.round(options.actionDurationSec * 100) / 100)
      : currentMeta.actionDurationSec
  let nextStepDur: number

  if (options.stepDuration !== undefined) {
    nextStepDur = Math.max(0.2, Math.round(options.stepDuration * 100) / 100)
    if (nextDelay > nextStepDur - 0.2) {
      nextDelay = Math.max(0, Math.round((nextStepDur - 0.2) * 100) / 100)
    }
    if (options.actionDurationSec === undefined) {
      nextActionDur = Math.max(0.2, Math.round((nextStepDur - nextDelay) * 100) / 100)
    }
  } else if (options.actionDurationSec !== undefined || options.delaySec !== undefined) {
    nextStepDur = Math.max(0.2, Math.round((nextDelay + nextActionDur) * 100) / 100)
  } else {
    nextStepDur = currentMeta.stepDuration
  }

  const isCustomActionTiming =
    options.delaySec !== undefined ||
    options.actionDurationSec !== undefined ||
    currentMeta.hasCustomActionTiming

  if (next) {
    const newNextTime = Math.max(
      cur.time + 0.2,
      Math.round((cur.time + nextStepDur) * 100) / 100
    )
    updateCameraWaypoint(draft, layout, next.time, {
      time: newNextTime,
      ripple: true
    })
  }

  setWaypointTimingMeta(cur.time, {
    stepDuration: nextStepDur,
    delaySec: nextDelay,
    actionDurationSec: nextActionDur,
    hasCustomActionTiming: isCustomActionTiming
  })

  // Bảo đảm Immer luôn sinh ra tham chiếu project mới để React/Zustand re-render tức thì
  draft.camera.position.keyframes = draft.camera.position.keyframes.map((k) => ({ ...k }))

  const maxEnd = Math.max(
    cur.time + nextStepDur,
    ...draft.camera.position.keyframes.map((k) => k.t + 1)
  )
  if (maxEnd > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(maxEnd))
  }

  return cur.time
}

export {
  applyCameraRoutePreset,
  reverseCameraRoute,
  type CameraRoutePresetType
} from './animateCameraRoutePresets'
