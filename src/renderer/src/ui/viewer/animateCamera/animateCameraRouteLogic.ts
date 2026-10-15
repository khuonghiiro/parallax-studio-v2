import type { Animatable, EaseName, Project } from '@shared/types'
import { setCompDuration } from '../../../actions'
import { addKeyframe, evaluate, keyAt } from '../../../animation/keyframes'
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

export type CameraActionMode =
  | 'hold'
  | 'pan'
  | 'push-in'
  | 'pull-out'
  | 'orbit-left'
  | 'orbit-right'
  | 'high-angle'
  | 'low-angle'
  | 'dutch-tilt'
  | 'cut'

export interface CameraWaypointItem extends CameraFrame2D {
  tag: 'start' | 'pan' | 'zoom-in' | 'zoom-out' | 'hold'
  tagLabel: string
  actionMode: CameraActionMode
  angleSummary: string
  durationFromPrev: number
  zoomPct: number
  isFirstOfShot: boolean
}

/**
 * Enriches extracted 2D camera frames with waypoint tags, action modes, 3D angle badges,
 * durations, zoom percentages, and first-of-shot flags for intuitive list display and editing.
 */
export function enrichCameraWaypoints(frames: CameraFrame2D[]): CameraWaypointItem[] {
  // Xác định mốc đầu tiên của mỗi Cảnh (dựa trên mốc xuất hiện đầu tiên của từng shotId theo trục thời gian)
  const firstIdxByShot = new Map<string, number>()
  frames.forEach((f, idx) => {
    const shotKey = f.shotId ?? 'global'
    if (!firstIdxByShot.has(shotKey)) {
      firstIdxByShot.set(shotKey, idx)
    }
  })

  return frames.map((f, idx) => {
    const isFirstOfShot = firstIdxByShot.get(f.shotId ?? 'global') === idx
    const prev = idx > 0 ? frames[idx - 1] : null
    const durationFromPrev = prev ? Math.max(0, Math.round((f.time - prev.time) * 100) / 100) : 0
    const zoomPct = Math.round((1 / Math.max(0.1, f.scale)) * 100)

    let tag: CameraWaypointItem['tag'] = 'hold'
    let tagLabel = durationFromPrev > 0 ? `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)` : 'Điểm dừng'
    let actionMode: CameraActionMode = 'hold'

    const hasYawLeft = f.yaw <= -10
    const hasYawRight = f.yaw >= 10
    const hasPitchHigh = f.pitch >= 10
    const hasPitchLow = f.pitch <= -10
    const hasRoll = Math.abs(f.roll) >= 4
    const isJumpCut = prev?.ease === 'hold'

    if (idx === 0) {
      tag = 'start'
      tagLabel = 'Khung gốc (Bắt đầu)'
      actionMode = 'pan'
    } else if (prev) {
      const scaleDiff = f.scale - prev.scale
      const dist = Math.hypot(f.stageX - prev.stageX, f.stageY - prev.stageY)
      const angleDiff = Math.hypot(f.yaw - prev.yaw, f.pitch - prev.pitch, f.roll - prev.roll)

      if (dist <= 60 && Math.abs(scaleDiff) <= 0.12 && f.shotId === prev.shotId && angleDiff <= 5) {
        tag = 'hold'
        tagLabel = `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)`
        actionMode = 'hold'
      } else if (scaleDiff < -0.04) {
        tag = 'zoom-in'
        tagLabel = `Phóng to (${zoomPct}%)`
        actionMode = 'push-in'
      } else if (scaleDiff > 0.04) {
        tag = 'zoom-out'
        tagLabel = `Thu nhỏ (${zoomPct}%)`
        actionMode = 'pull-out'
      } else if (f.shotId && prev.shotId && f.shotId !== prev.shotId) {
        tag = 'pan'
        tagLabel = isJumpCut ? `Cắt tới ${f.shotName}` : `Lia tới ${f.shotName}`
        actionMode = isJumpCut ? 'cut' : 'pan'
      } else if (dist > 60 || angleDiff > 5) {
        tag = 'pan'
        tagLabel = angleDiff > 8 ? `Xoay góc 3D (${Math.round(f.yaw)}°)` : 'Lia góc nhìn'
        actionMode = 'pan'
      } else {
        tag = 'hold'
        tagLabel = `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)`
        actionMode = 'hold'
      }
    }

    if (isJumpCut) actionMode = 'cut'
    else if (hasRoll) actionMode = 'dutch-tilt'
    else if (hasYawLeft) actionMode = 'orbit-left'
    else if (hasYawRight) actionMode = 'orbit-right'
    else if (hasPitchHigh) actionMode = 'high-angle'
    else if (hasPitchLow) actionMode = 'low-angle'

    const angleParts: string[] = []
    if (Math.abs(f.yaw) >= 1) angleParts.push(`Yaw ${f.yaw > 0 ? '+' : ''}${Math.round(f.yaw)}°`)
    if (Math.abs(f.pitch) >= 1) angleParts.push(`Pitch ${f.pitch > 0 ? '+' : ''}${Math.round(f.pitch)}°`)
    if (Math.abs(f.roll) >= 1) angleParts.push(`Roll ${f.roll > 0 ? '+' : ''}${Math.round(f.roll)}°`)
    const angleSummary = angleParts.length > 0 ? angleParts.join(' · ') : 'Thẳng 0°'

    return {
      ...f,
      tag,
      tagLabel,
      actionMode,
      angleSummary,
      durationFromPrev,
      zoomPct,
      isFirstOfShot
    }
  })
}

/**
 * Sets easing curve across all camera transform tracks at given timestamp.
 */
function setKeyframeEaseAtTime(draft: Project, time: number, ease: EaseName): void {
  const tol = frameTolerance(draft)
  const setEase = (track?: Animatable<unknown>) => {
    if (!track) return
    const k = keyAt(track, time, tol)
    if (k) k.ease = ease
  }
  setEase(draft.camera.position)
  setEase(draft.camera.target)
  setEase(draft.camera.focusDistance)
  setEase(draft.camera.roll)
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

  // If ripple is requested and time changed, shift later keyframes first (or after)
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

  const maxKeyT = Math.max(
    newTime,
    ...draft.camera.position.keyframes.map((k) => k.t)
  )
  if (maxKeyT > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(maxKeyT + 1))
  }
}

/**
 * Applies a high-level professional Camera Action Mode to the waypoint at `waypointTime`.
 */
export function applyWaypointActionMode(
  draft: Project,
  layout: ShotStageBox[],
  waypointTime: number,
  mode: CameraActionMode
): void {
  const frames = extractCameraFrames2D(draft, layout)
  const tol = Math.max(frameTolerance(draft), 0.04)
  let idx = frames.findIndex((f) => Math.abs(f.time - waypointTime) <= tol)
  if (idx < 0 && frames.length > 0) {
    let bestDist = Infinity
    for (let i = 0; i < frames.length; i++) {
      const d = Math.abs(frames[i].time - waypointTime)
      if (d < bestDist) {
        bestDist = d
        idx = i
      }
    }
  }
  const cur = idx >= 0 ? frames[idx] : null
  if (!cur) return
  const prev = idx > 0 ? frames[idx - 1] : null

  switch (mode) {
    case 'hold': {
      if (prev) {
        updateCameraWaypoint(draft, layout, cur.time, {
          stageX: prev.stageX,
          stageY: prev.stageY,
          scale: prev.scale,
          yaw: prev.yaw,
          pitch: prev.pitch,
          roll: prev.roll,
          ease: 'easeInOut'
        })
      } else {
        addCameraHoldWaypoint(draft, layout, cur, 2.0)
      }
      break
    }
    case 'pan': {
      updateCameraWaypoint(draft, layout, cur.time, {
        yaw: 0,
        pitch: 0,
        roll: 0,
        ease: 'easeInOut'
      })
      if (prev) setKeyframeEaseAtTime(draft, prev.time, 'easeInOut')
      break
    }
    case 'push-in': {
      const targetScale = clampFrameScale(prev ? Math.min(0.68, prev.scale * 0.68) : 0.68)
      updateCameraWaypoint(draft, layout, cur.time, {
        scale: targetScale,
        ease: 'easeInOut'
      })
      break
    }
    case 'pull-out': {
      const targetScale = clampFrameScale(prev ? Math.max(1.25, prev.scale * 1.32) : 1.32)
      updateCameraWaypoint(draft, layout, cur.time, {
        scale: targetScale,
        ease: 'easeInOut'
      })
      break
    }
    case 'orbit-left': {
      updateCameraWaypoint(draft, layout, cur.time, {
        yaw: -25,
        pitch: 4,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'orbit-right': {
      updateCameraWaypoint(draft, layout, cur.time, {
        yaw: 25,
        pitch: 4,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'high-angle': {
      updateCameraWaypoint(draft, layout, cur.time, {
        yaw: 0,
        pitch: 22,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'low-angle': {
      updateCameraWaypoint(draft, layout, cur.time, {
        yaw: 0,
        pitch: -16,
        scale: Math.min(cur.scale, 0.82),
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'dutch-tilt': {
      const nextRoll = cur.roll >= 8 ? -12 : 12
      updateCameraWaypoint(draft, layout, cur.time, {
        roll: nextRoll,
        scale: Math.min(cur.scale, 0.85),
        ease: 'easeInOut'
      })
      break
    }
    case 'cut': {
      // Jump Cut: previous keyframe holds pose until this waypoint's timestamp
      if (prev) {
        setKeyframeEaseAtTime(draft, prev.time, 'hold')
      } else {
        setKeyframeEaseAtTime(draft, cur.time, 'hold')
      }
      break
    }
  }
}

/**
 * Aligns a waypoint within its active shot (Left, Center, Right, Top, Bottom, or Reset 3D angles).
 */
export function alignWaypointInShot(
  draft: Project,
  layout: ShotStageBox[],
  waypointTime: number,
  align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles'
): void {
  const frames = extractCameraFrames2D(draft, layout)
  const tol = Math.max(frameTolerance(draft), 0.04)
  let cur = frames.find((f) => Math.abs(f.time - waypointTime) <= tol)
  if (!cur && frames.length > 0) {
    let bestDist = Infinity
    for (const f of frames) {
      const d = Math.abs(f.time - waypointTime)
      if (d < bestDist) {
        bestDist = d
        cur = f
      }
    }
  }
  if (!cur) return

  const box =
    (cur.shotId ? layout.find((b) => b.shotId === cur.shotId) : null) ??
    findNearestShotByStage2D(layout, cur.stageX, cur.stageY) ??
    layout[0]
  if (!box) return

  if (align === 'reset-angles') {
    updateCameraWaypoint(draft, layout, cur.time, { yaw: 0, pitch: 0, roll: 0 })
    return
  }

  let sx = cur.stageX
  let sy = cur.stageY
  if (align === 'center') {
    sx = box.stageX
    sy = box.stageY
  } else if (align === 'left') {
    sx = Math.round(box.stageX - box.width * 0.2)
  } else if (align === 'right') {
    sx = Math.round(box.stageX + box.width * 0.2)
  } else if (align === 'top') {
    sy = Math.round(box.stageY - box.height * 0.18)
  } else if (align === 'bottom') {
    sy = Math.round(box.stageY + box.height * 0.18)
  }

  updateCameraWaypoint(draft, layout, cur.time, { stageX: sx, stageY: sy })
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
  return true
}

/**
 * Duplicates a camera waypoint to a new timestamp `targetTime`.
 */
export function duplicateCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  sourceFrame: CameraFrame2D,
  targetTime: number
): void {
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
  const targetTime = Math.round((sourceFrame.time + holdSec) * 100) / 100
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
}

export {
  applyCameraRoutePreset,
  reverseCameraRoute,
  type CameraRoutePresetType
} from './animateCameraRoutePresets'

