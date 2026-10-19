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
import {
  CAMERA_ACTION_CATEGORIES,
  CAMERA_ACTION_MODES,
  getActionModeMeta,
  inferWaypointActionClassification,
  moveExplicitActionMode,
  recordExplicitActionMode,
  shiftExplicitActionModes,
  type CameraActionCategory,
  type CameraActionMode,
  type CameraActionModeMeta
} from './animateCameraActionModes'

export {
  CAMERA_ACTION_CATEGORIES,
  CAMERA_ACTION_MODES,
  getActionModeMeta,
  type CameraActionCategory,
  type CameraActionMode,
  type CameraActionModeMeta
}

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
    const zoomPct = Math.round((1 / Math.max(0.045, f.scale)) * 100)

    const { tag, tagLabel, actionMode } = inferWaypointActionClassification(
      f,
      idx,
      prev,
      durationFromPrev,
      zoomPct
    )

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
      shiftExplicitActionModes(oldTime, deltaT)
    }
    moveExplicitActionMode(oldTime, newTime)
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
 * Applies a high-level professional Camera Action Mode (20 cinematography & animation techniques)
 * to the waypoint at `waypointTime`.
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
  const box =
    (cur.shotId ? layout.find((b) => b.shotId === cur.shotId) : null) ??
    findNearestShotByStage2D(layout, cur.stageX, cur.stageY) ??
    layout[0]

  if (mode !== 'cut' && prev && prev.ease === 'hold') {
    setKeyframeEaseAtTime(draft, prev.time, 'easeInOut')
  }

  recordExplicitActionMode(cur.time, mode)

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
    case 'extreme-closeup': {
      updateCameraWaypoint(draft, layout, cur.time, {
        scale: 0.42,
        yaw: 0,
        pitch: -4,
        roll: 0,
        ease: 'easeInOutStrong'
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
    case 'establishing': {
      updateCameraWaypoint(draft, layout, cur.time, {
        stageX: box ? box.stageX : cur.stageX,
        stageY: box ? box.stageY : cur.stageY,
        scale: 1.0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'cut': {
      if (prev) {
        setKeyframeEaseAtTime(draft, prev.time, 'hold')
      } else {
        setKeyframeEaseAtTime(draft, cur.time, 'hold')
      }
      updateCameraWaypoint(draft, layout, cur.time, {
        ease: 'hold'
      })
      break
    }
    case 'whip-pan': {
      const nextX = box
        ? Math.abs(cur.stageX - box.stageX) < 40
          ? Math.round(box.stageX + box.width * 0.2)
          : cur.stageX
        : cur.stageX
      updateCameraWaypoint(draft, layout, cur.time, {
        stageX: nextX,
        roll: cur.roll >= 0 ? -4 : 4,
        ease: 'easeInOutStrong'
      })
      if (prev) setKeyframeEaseAtTime(draft, prev.time, 'easeInOutStrong')
      break
    }
    case 'crane-up': {
      const targetY = box ? Math.round(box.stageY - box.height * 0.2) : Math.round(cur.stageY - 180)
      updateCameraWaypoint(draft, layout, cur.time, {
        stageY: targetY,
        scale: clampFrameScale(Math.max(0.92, cur.scale)),
        yaw: 0,
        pitch: -10,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'crane-down': {
      const targetY = box ? Math.round(box.stageY + box.height * 0.16) : Math.round(cur.stageY + 150)
      updateCameraWaypoint(draft, layout, cur.time, {
        stageY: targetY,
        scale: clampFrameScale(Math.min(0.85, cur.scale)),
        yaw: 0,
        pitch: 8,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'sweep-left': {
      const targetX = box ? Math.round(box.stageX - box.width * 0.22) : Math.round(cur.stageX - 320)
      updateCameraWaypoint(draft, layout, cur.time, {
        stageX: targetX,
        yaw: -8,
        pitch: 0,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'sweep-right': {
      const targetX = box ? Math.round(box.stageX + box.width * 0.22) : Math.round(cur.stageX + 320)
      updateCameraWaypoint(draft, layout, cur.time, {
        stageX: targetX,
        yaw: 8,
        pitch: 0,
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'tilt-sky': {
      const targetY = box ? Math.round(box.stageY - box.height * 0.24) : Math.round(cur.stageY - 220)
      updateCameraWaypoint(draft, layout, cur.time, {
        stageY: targetY,
        yaw: 0,
        pitch: -24,
        roll: 0,
        ease: 'easeOut'
      })
      break
    }
    case 'aerial-dive': {
      const targetY = box ? Math.round(box.stageY + box.height * 0.06) : cur.stageY
      updateCameraWaypoint(draft, layout, cur.time, {
        stageX: box ? box.stageX : cur.stageX,
        stageY: targetY,
        scale: 0.56,
        yaw: 0,
        pitch: 14,
        roll: 0,
        ease: 'easeInOutStrong'
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
    case 'hero-low':
    case 'low-angle': {
      const targetY = box ? Math.round(box.stageY + box.height * 0.08) : cur.stageY
      updateCameraWaypoint(draft, layout, cur.time, {
        stageY: targetY,
        yaw: 0,
        pitch: -18,
        scale: Math.min(cur.scale, 0.78),
        roll: 0,
        ease: 'easeInOut'
      })
      break
    }
    case 'bird-eye':
    case 'high-angle': {
      const targetY = box ? Math.round(box.stageY - box.height * 0.12) : cur.stageY
      updateCameraWaypoint(draft, layout, cur.time, {
        stageY: targetY,
        yaw: 0,
        pitch: 24,
        scale: Math.max(cur.scale, 1.15),
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
    case 'corkscrew': {
      const nextRoll = cur.roll >= 10 ? -18 : 18
      const nextYaw = cur.yaw >= 8 ? -16 : 16
      updateCameraWaypoint(draft, layout, cur.time, {
        scale: 0.58,
        yaw: nextYaw,
        pitch: -6,
        roll: nextRoll,
        ease: 'easeInOutStrong'
      })
      break
    }
  }
  recordExplicitActionMode(cur.time, mode)
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
 */
export function duplicateCameraWaypoint(
  draft: Project,
  layout: ShotStageBox[],
  sourceFrame: CameraFrame2D,
  targetTime: number
): void {
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

  const nextTime =
    !last || (!hasKeyframes && last.shotId === shotId)
      ? 0
      : Math.round(((last?.time ?? 0) + stepSec) * 100) / 100

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

export {
  applyCameraRoutePreset,
  reverseCameraRoute,
  type CameraRoutePresetType
} from './animateCameraRoutePresets'

