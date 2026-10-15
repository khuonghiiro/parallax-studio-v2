import type { Animatable, Project } from '@shared/types'
import { setCompDuration } from '../../../actions'
import { anim } from '../../../animation/keyframes'
import { applyStageFrameToDraft, type ShotStageBox } from './animateCameraMath'

export type CameraRoutePresetType =
  | 'tour-all-shots'
  | 'tour-hold-and-pan'
  | 'parallax-orbit'
  | 'cinematic-zoom'
  | 'dramatic-pan'
  | 'dolly-vertigo'
  | 'action-dutch-cut'

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
}

/**
 * Generates automated high-quality camera route presets across project shots.
 */
export function applyCameraRoutePreset(
  draft: Project,
  layout: ShotStageBox[],
  preset: CameraRoutePresetType
): void {
  draft.camera.position.keyframes = []
  draft.camera.target.keyframes = []
  draft.camera.focusDistance.keyframes = []
  if (!draft.camera.roll) draft.camera.roll = anim(0)
  draft.camera.roll.keyframes = []
  draft.camera.roll.value = 0

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
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    const holdSec = 1.8
    const panSec = 2.0

    layout.forEach((box, i) => {
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.0, true)
      curTime = Math.round((curTime + holdSec) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.92, true)
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
      const startYaw = i % 2 === 0 ? -22 : 22
      const endYaw = i % 2 === 0 ? 18 : -18
      const offsetX = i % 2 === 0 ? 110 : -110
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 1.0, true, {
        yaw: startYaw,
        pitch: 6
      })
      curTime = Math.round((curTime + 2.2) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX + offsetX, box.stageY - 28, 0.56, true, {
        yaw: endYaw,
        pitch: -5,
        roll: i % 2 === 0 ? 6 : -6
      })
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
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.55, true)
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
  } else if (preset === 'dolly-vertigo') {
    const box = layout[0]
    if (!box) return
    const t0 = 0
    const t1 = Math.round(draft.comp.duration * 0.5 * 100) / 100
    const t2 = Math.round(draft.comp.duration * 100) / 100

    applyStageFrameToDraft(draft, layout, t0, box.stageX, box.stageY, 1.4, true)
    applyStageFrameToDraft(draft, layout, t1, box.stageX, box.stageY, 0.45, true)
    applyStageFrameToDraft(draft, layout, t2, box.stageX, box.stageY, 1.0, true)
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
    applyStageFrameToDraft(draft, layout, t1, midX, b1.stageY, 0.75, true)
    applyStageFrameToDraft(draft, layout, t2, endX, b1.stageY, 0.95, true)
  } else if (preset === 'action-dutch-cut') {
    const count = layout.length
    if (count === 0) return
    let curTime = 0
    layout.forEach((box, i) => {
      const rollSign = i % 2 === 0 ? -10 : 10
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.95, true, {
        yaw: i % 2 === 0 ? -14 : 14,
        pitch: -6,
        roll: rollSign,
        ease: 'easeOut'
      })
      curTime = Math.round((curTime + 1.6) * 100) / 100
      applyStageFrameToDraft(draft, layout, curTime, box.stageX, box.stageY, 0.65, true, {
        yaw: 0,
        pitch: 0,
        roll: 0,
        ease: i < count - 1 ? 'hold' : 'easeInOut'
      })
      if (i < count - 1) {
        curTime = Math.round((curTime + 0.1) * 100) / 100
      }
    })
    if (curTime > draft.comp.duration) {
      setCompDuration(draft, Math.ceil(curTime))
    }
  }
}
