import type { Animatable, EaseName, Project } from '@shared/types'
import { setCompDuration } from '../../../actions'
import { addKeyframe, evaluate, keyAt } from '../../../animation/keyframes'
import { frameTolerance } from '../../../store/editor'
import {
  applyStageFrameToDraft,
  clampFrameScale,
  type CameraFrame2D,
  type ShotStageBox
} from './animateCameraMath'

export interface CameraWaypointItem extends CameraFrame2D {
  tag: 'start' | 'pan' | 'zoom-in' | 'zoom-out' | 'hold'
  tagLabel: string
  durationFromPrev: number
  zoomPct: number
}

/**
 * Enriches extracted 2D camera frames with waypoint tags, durations, and zoom percentages
 * for intuitive list display and editing.
 */
export function enrichCameraWaypoints(frames: CameraFrame2D[]): CameraWaypointItem[] {
  return frames.map((f, idx) => {
    const prev = idx > 0 ? frames[idx - 1] : null
    const durationFromPrev = prev ? Math.max(0, Math.round((f.time - prev.time) * 100) / 100) : 0
    const zoomPct = Math.round((1 / Math.max(0.1, f.scale)) * 100)

    let tag: CameraWaypointItem['tag'] = 'hold'
    let tagLabel = durationFromPrev > 0 ? `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)` : 'Điểm dừng'

    if (idx === 0) {
      tag = 'start'
      tagLabel = 'Khung gốc (Bắt đầu)'
    } else if (prev) {
      const scaleDiff = f.scale - prev.scale
      const dist = Math.hypot(f.stageX - prev.stageX, f.stageY - prev.stageY)

      if (dist <= 60 && Math.abs(scaleDiff) <= 0.12 && f.shotId === prev.shotId) {
        tag = 'hold'
        tagLabel = `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)`
      } else if (scaleDiff < -0.04) {
        tag = 'zoom-in'
        tagLabel = `Phóng to (${zoomPct}%)`
      } else if (scaleDiff > 0.04) {
        tag = 'zoom-out'
        tagLabel = `Thu nhỏ (${zoomPct}%)`
      } else if (f.shotId && prev.shotId && f.shotId !== prev.shotId) {
        tag = 'pan'
        tagLabel = `Lia tới ${f.shotName}`
      } else if (dist > 60) {
        tag = 'pan'
        tagLabel = 'Lia góc nhìn'
      } else {
        tag = 'hold'
        tagLabel = `Dừng ngắm (+${durationFromPrev.toFixed(1)}s)`
      }
    }

    return {
      ...f,
      tag,
      tagLabel,
      durationFromPrev,
      zoomPct
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
  const box = layout.find((b) => b.shotId === targetShotId) || layout[0]
  if (!box) return

  if (time > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(time + 1))
  }

  applyStageFrameToDraft(draft, layout, time, box.stageX, box.stageY, scale, true)

  // Update ease curve on position & target keyframes at this timestamp
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
  const box = layout.find((b) => b.shotId === shotId) || layout[0]
  if (!box) return

  const targetStageX = Math.round(box.stageX + layerOffsetX)
  const targetStageY = Math.round(box.stageY + layerOffsetY)

  if (time > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(time + 1))
  }

  applyStageFrameToDraft(draft, layout, time, targetStageX, targetStageY, scale, true)
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
  applyStageFrameToDraft(draft, layout, time, stageX, stageY, clampedScale, true)
  setKeyframeEaseAtTime(draft, time, ease)
}

/**
 * Sets easing curve across all camera transform tracks at given timestamp.
 */
function setKeyframeEaseAtTime(draft: Project, time: number, ease: EaseName): void {
  const tol = frameTolerance(draft)
  const setEase = (anim: Animatable<unknown>) => {
    const k = keyAt(anim, time, tol)
    if (k) k.ease = ease
  }
  setEase(draft.camera.position)
  setEase(draft.camera.target)
  setEase(draft.camera.focusDistance)
}

/**
 * Updates an existing camera waypoint parameters (time, pan X/Y, scale, ease).
 * If timestamp changes, moves keyframes cleanly without creating duplicates.
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
    ease?: EaseName
  }
): void {
  const tol = frameTolerance(draft)
  const newTime = updates.time !== undefined ? Math.max(0, updates.time) : oldTime

  if (newTime > draft.comp.duration) {
    setCompDuration(draft, Math.ceil(newTime + 1))
  }

  // If time changed, remove existing keyframe at old timestamp before re-adding
  if (Math.abs(newTime - oldTime) > 0.001) {
    removeKeyframeAtTime(draft.camera.position, oldTime, tol)
    removeKeyframeAtTime(draft.camera.target, oldTime, tol)
    removeKeyframeAtTime(draft.camera.focusDistance, oldTime, tol)
  }

  // Determine stage coordinates and scale
  const currentPos = evaluate(draft.camera.position, newTime)
  const currentTgt = evaluate(draft.camera.target, newTime)
  const fallbackBox = layout[0]
  const currentScale =
    updates.scale !== undefined
      ? clampFrameScale(updates.scale)
      : Math.hypot(currentTgt[0] - currentPos[0], currentTgt[1] - currentPos[1], currentTgt[2] - currentPos[2]) /
        Math.max(100, draft.comp.width * 1.2)

  const stageX = updates.stageX ?? fallbackBox?.stageX ?? 0
  const stageY = updates.stageY ?? fallbackBox?.stageY ?? 0

  applyStageFrameToDraft(draft, layout, newTime, stageX, stageY, currentScale, true)

  if (updates.ease) {
    setKeyframeEaseAtTime(draft, newTime, updates.ease)
  }
}

/**
 * Removes a keyframe from an Animatable track if within tolerance.
 */
function removeKeyframeAtTime<T>(track: Animatable<T>, time: number, tol: number): void {
  track.keyframes = track.keyframes.filter((k) => Math.abs(k.t - time) > tol)
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
    true
  )
  setKeyframeEaseAtTime(draft, targetTime, sourceFrame.ease)
}

/**
 * Reverses the camera path so camera travels in opposite direction over the same total duration.
 */
export function reverseCameraRoute(draft: Project): void {
  const cam = draft.camera
  const reverseTrack = (track: Animatable<unknown>) => {
    if (track.keyframes.length < 2) return
    const minT = track.keyframes[0].t
    const maxT = track.keyframes[track.keyframes.length - 1].t
    track.keyframes = track.keyframes.map((k) => ({
      ...k,
      t: Math.round((maxT - (k.t - minT)) * 1000) / 1000
    }))
    track.keyframes.sort((a, b) => a.t - b.t)
  }
  reverseTrack(cam.position)
  reverseTrack(cam.target)
  reverseTrack(cam.focusDistance)
}

export type CameraRoutePresetType =
  | 'tour-all-shots'
  | 'tour-hold-and-pan'
  | 'cinematic-zoom'
  | 'dramatic-pan'
  | 'dolly-vertigo'

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
    true
  )
  setKeyframeEaseAtTime(draft, targetTime, 'easeInOut')
}

/**
 * Generates automated high-quality camera route presets across project shots.
 */
export function applyCameraRoutePreset(
  draft: Project,
  layout: ShotStageBox[],
  preset: CameraRoutePresetType
): void {
  // Clear existing camera keyframes
  draft.camera.position.keyframes = []
  draft.camera.target.keyframes = []
  draft.camera.focusDistance.keyframes = []

  if (preset === 'tour-all-shots') {
    const count = layout.length
    if (count === 0) return
    const durPerShot = Math.max(1.8, Math.min(4.0, draft.comp.duration / Math.max(1, count)))
    layout.forEach((box, i) => {
      const t = Math.round(i * durPerShot * 100) / 100
      applyStageFrameToDraft(draft, layout, t, box.stageX, box.stageY, 1.0, true)
    })
    const totalT = Math.round(count * durPerShot * 100) / 100
    if (totalT > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(totalT))
    }
  } else if (preset === 'tour-hold-and-pan') {
    // Cinematic hold & pan: At each shot, pause for 1.8s, then smoothly pan to the next
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    const holdSec = 1.8
    const panSec = 2.0

    layout.forEach((box, i) => {
      // Arrival / Start framing
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.0, true)

      // Hold framing at shot with subtle creep-in to 0.92
      curTime = Math.round((curTime + holdSec) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.92, true)

      if (i < count - 1) {
        curTime = Math.round((curTime + panSec) * 100) / 100
      }
    })

    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'cinematic-zoom') {
    // Shot center overview -> Push in close-up -> Pull out
    const box = layout[0]
    if (!box) return
    const t0 = 0
    const t1 = Math.round((draft.comp.duration * 0.45) * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    applyStageFrameToDraft(draft, layout, t0, box.stageX, box.stageY, 1.2, true)
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.55, true)
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
  } else if (preset === 'dolly-vertigo') {
    // Alfred Hitchcock Dolly Zoom: Camera physically pushes in while wide angles compress
    const box = layout[0]
    if (!box) return
    const t0 = 0
    const t1 = Math.round((draft.comp.duration * 0.5) * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    applyStageFrameToDraft(draft, layout, t0, box.stageX, box.stageY, 1.4, true)
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.45, true)
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
  } else if (preset === 'dramatic-pan') {
    // Pan across width of first shot or between first two shots with slight angle
    const b0 = layout[0]
    const b1 = layout[1] || layout[0]
    const t0 = 0
    const t1 = Math.round((draft.comp.duration * 0.5) * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    const startX = b0.stageX - draft.comp.width * 0.25
    const midX = b1.stageX
    const endX = b1.stageX + draft.comp.width * 0.2

    applyStageFrameToDraft(draft, layout, t0, startX, b0.stageY, 1.1, true)
    applyStageFrameToDraft(draft, layout, t1, midX, b1.stageY, 0.75, true)
    applyStageFrameToDraft(draft, layout, t2, endX, b1.stageY, 0.95, true)
  }
}
