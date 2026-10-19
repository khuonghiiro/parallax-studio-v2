import type { Animatable, Project } from '@shared/types'
import { setCompDuration } from '../../../actions'
import { anim } from '../../../animation/keyframes'
import {
  clearExplicitActionModes,
  recordExplicitActionMode
} from './animateCameraActionModes'
import { applyStageFrameToDraft, type ShotStageBox } from './animateCameraMath'

export type CameraRoutePresetType =
  | 'tour-all-shots'
  | 'tour-hold-and-pan'
  | 'parallax-orbit'
  | 'cinematic-zoom'
  | 'dramatic-pan'
  | 'dolly-vertigo'
  | 'action-dutch-cut'
  | 'hero-crane-epic'
  | 'whip-action-rush'
  | 'aerial-drone-sweep'
  | 'dramatic-story-reveal'

/**
 * Reverses the camera path so camera travels in opposite direction over the same total duration.
 */
export function reverseCameraRoute(draft: Project): void {
  const cam = draft.camera
  const reverseTrack = (track?: Animatable<unknown>) => {
    if (!track || track.keyframes.length < 2) return
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
  reverseTrack(cam.roll)
  clearExplicitActionModes()
}

/**
 * Generates automated high-quality camera route presets across project shots.
 */
export function applyCameraRoutePreset(
  draft: Project,
  layout: ShotStageBox[],
  preset: CameraRoutePresetType
): void {
  clearExplicitActionModes()
  draft.camera.position.keyframes = []
  draft.camera.target.keyframes = []
  draft.camera.focusDistance.keyframes = []
  if (!draft.camera.roll) draft.camera.roll = anim(0)
  draft.camera.roll.keyframes = []
  draft.camera.roll.value = 0

  const W = draft.comp.width
  const H = draft.comp.height

  if (preset === 'tour-all-shots') {
    const count = layout.length
    if (count === 0) return
    const durPerShot = Math.max(1.8, Math.min(4.0, draft.comp.duration / Math.max(1, count)))
    layout.forEach((box, i) => {
      const t = Math.round(i * durPerShot * 100) / 100
      applyStageFrameToDraft(draft, layout, t, box.stageX, box.stageY, 1.0, true)
      recordExplicitActionMode(t, i === 0 ? 'establishing' : 'pan')
    })
    const totalT = Math.round(count * durPerShot * 100) / 100
    if (totalT > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(totalT))
    }
  } else if (preset === 'tour-hold-and-pan') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    const holdSec = 1.8
    const panSec = 2.0

    layout.forEach((box, i) => {
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.0, true)
      recordExplicitActionMode(curTime, i === 0 ? 'establishing' : 'pan')
      curTime = Math.round((curTime + holdSec) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.92, true)
      recordExplicitActionMode(curTime, 'hold')
      if (i < count - 1) {
        curTime = Math.round((curTime + panSec) * 100) / 100
      }
    })

    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'parallax-orbit') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      const startYaw = i % 2 === 0 ? -24 : 24
      const endYaw = i % 2 === 0 ? 22 : -22
      const offsetX = i % 2 === 0 ? 110 : -110
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.0, true, {
        yaw: startYaw,
        pitch: 6
      })
      recordExplicitActionMode(curTime, startYaw < 0 ? 'orbit-left' : 'orbit-right')
      curTime = Math.round((curTime + 2.2) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX + offsetX, box.stageY - 28, 0.58, true, {
        yaw: endYaw,
        pitch: -5,
        roll: i % 2 === 0 ? 6 : -6
      })
      recordExplicitActionMode(curTime, endYaw < 0 ? 'orbit-left' : 'orbit-right')
      if (i < count - 1) {
        curTime = Math.round((curTime + 1.8) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'hero-crane-epic') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, Math.round(box.stageY + H * 0.1), 0.72, true, {
        yaw: i % 2 === 0 ? -14 : 14,
        pitch: -22,
        roll: i % 2 === 0 ? -4 : 4,
        ease: 'easeOut'
      })
      recordExplicitActionMode(curTime, 'hero-low')
      curTime = Math.round((curTime + 2.2) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, Math.round(box.stageY - H * 0.16), 0.92, true, {
        yaw: 0,
        pitch: 18,
        roll: 0,
        ease: 'easeInOut'
      })
      recordExplicitActionMode(curTime, 'crane-up')
      if (i < count - 1) {
        curTime = Math.round((curTime + 1.8) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'whip-action-rush') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      const sign = i % 2 === 0 ? 1 : -1
      applyStageFrameToDraft(draft, layout, curTime, Math.round(box.stageX - sign * W * 0.14), box.stageY, 0.88, true, {
        yaw: -sign * 14,
        pitch: 4,
        roll: sign * 6,
        ease: 'easeInOutStrong'
      })
      recordExplicitActionMode(curTime, 'whip-pan')
      curTime = Math.round((curTime + 1.4) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.54, true, {
        yaw: sign * 16,
        pitch: -8,
        roll: sign * 16,
        ease: 'easeInOutStrong'
      })
      recordExplicitActionMode(curTime, 'corkscrew')
      if (i < count - 1) {
        curTime = Math.round((curTime + 1.0) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'aerial-drone-sweep') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, Math.round(box.stageY - H * 0.14), 1.12, true, {
        yaw: i % 2 === 0 ? -12 : 12,
        pitch: 30,
        roll: 0,
        ease: 'easeInOut'
      })
      recordExplicitActionMode(curTime, 'bird-eye')
      curTime = Math.round((curTime + 2.2) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, Math.round(box.stageY + H * 0.05), 0.58, true, {
        yaw: 0,
        pitch: 22,
        roll: i % 2 === 0 ? -6 : 6,
        ease: 'easeInOutStrong'
      })
      recordExplicitActionMode(curTime, 'aerial-dive')
      if (i < count - 1) {
        curTime = Math.round((curTime + 1.8) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'dramatic-story-reveal') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.42, true, {
        yaw: 0,
        pitch: -4,
        roll: 0,
        ease: 'easeInOutStrong'
      })
      recordExplicitActionMode(curTime, 'extreme-closeup')
      curTime = Math.round((curTime + 2.2) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.18, true, {
        yaw: i % 2 === 0 ? -16 : 16,
        pitch: 10,
        roll: 0,
        ease: 'easeOut'
      })
      recordExplicitActionMode(curTime, 'pull-out')
      if (i < count - 1) {
        curTime = Math.round((curTime + 1.8) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  } else if (preset === 'cinematic-zoom') {
    const box = layout[0]
    if (!box) return
    const t0 = 0
    const t1 = Math.round(draft.comp.duration * 0.45 * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    applyStageFrameToDraft(draft, layout, t0, box.stageX, box.stageY, 1.2, true)
    recordExplicitActionMode(t0, 'pull-out')
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.55, true)
    recordExplicitActionMode(t1, 'push-in')
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
    recordExplicitActionMode(t2, 'establishing')
  } else if (preset === 'dolly-vertigo') {
    const box = layout[0]
    if (!box) return
    const t0 = 0
    const t1 = Math.round(draft.comp.duration * 0.5 * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    applyStageFrameToDraft(draft, layout, t0, box.stageX, box.stageY, 1.4, true)
    recordExplicitActionMode(t0, 'pull-out')
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.45, true)
    recordExplicitActionMode(t1, 'extreme-closeup')
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
    recordExplicitActionMode(t2, 'establishing')
  } else if (preset === 'dramatic-pan') {
    const b0 = layout[0]
    const b1 = layout[1] || layout[0]
    const t0 = 0
    const t1 = Math.round(draft.comp.duration * 0.5 * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    const startX = b0.stageX - draft.comp.width * 0.25
    const midX = b1.stageX
    const endX = b1.stageX + draft.comp.width * 0.2

    applyStageFrameToDraft(draft, layout, t0, startX, b0.stageY, 1.1, true)
    recordExplicitActionMode(t0, 'sweep-left')
    applyStageFrameToDraft(draft, layout, t1, midX, b1.stageY, 0.75, true)
    recordExplicitActionMode(t1, 'push-in')
    applyStageFrameToDraft(draft, layout, t2, endX, b1.stageY, 0.95, true)
    recordExplicitActionMode(t2, 'sweep-right')
  } else if (preset === 'action-dutch-cut') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      const rollSign = i % 2 === 0 ? -14 : 14
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.92, true, {
        yaw: i % 2 === 0 ? -14 : 14,
        pitch: -6,
        roll: rollSign,
        ease: 'easeOut'
      })
      recordExplicitActionMode(curTime, 'dutch-tilt')
      curTime = Math.round((curTime + 1.6) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.62, true, {
        yaw: 0,
        pitch: 0,
        roll: 0,
        ease: i < count - 1 ? 'hold' : 'easeInOut'
      })
      recordExplicitActionMode(curTime, 'push-in')
      if (i < count - 1) {
        curTime = Math.round((curTime + 0.1) * 100) / 100
        recordExplicitActionMode(curTime, 'cut')
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  }
}

