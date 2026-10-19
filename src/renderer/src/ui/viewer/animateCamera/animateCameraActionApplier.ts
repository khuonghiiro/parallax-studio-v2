import type { Animatable, EaseName, Project } from '@shared/types'
import { keyAt } from '../../../animation/keyframes'
import { frameTolerance } from '../../../store/editor'
import {
  clampFrameScale,
  extractCameraFrames2D,
  findNearestShotByStage2D,
  type ShotStageBox
} from './animateCameraMath'
import {
  recordExplicitActionMode,
  type CameraActionMode
} from './animateCameraActionModes'
import {
  addCameraHoldWaypoint,
  updateCameraWaypoint
} from './animateCameraRouteLogic'

/**
 * Sets easing curve across all camera transform tracks at given timestamp.
 */
export function setKeyframeEaseAtTime(draft: Project, time: number, ease: EaseName): void {
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
        yaw: 0,
        pitch: 0,
        roll: 0,
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
        yaw: 0,
        pitch: 0,
        roll: 0,
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
        yaw: 0,
        pitch: 0,
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
        yaw: 0,
        pitch: 0,
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
