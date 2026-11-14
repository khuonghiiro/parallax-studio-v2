import type { EaseName, Layer, Project, Shot, Vec3 } from '@shared/types'
import { addKeyframe, anim, evaluate } from './keyframes'
import { clamp, referenceDistance } from './math'
import { getClusterMemberLayers, getClusterRootLayer } from '../project/workflowV2ClusterRigAndSwap'
import {
  clearExplicitActionModes,
  recordExplicitActionMode,
  type CameraActionMode
} from '../ui/viewer/animateCamera/animateCameraActionModes'

export type CinematicBeatKind =
  | 'establish_corridor'
  | 'track_subject'
  | 'whip_pan'
  | 'punch_zoom'
  | 'match_cut'
  | 'orbit_parallax'
  | 'crane_descent'
  | 'crane_rise'
  | 'hero_low_ascent'
  | 'aerial_dive'
  | 'corkscrew_reveal'

export type ShotTransitionStyle = 'none' | 'cut' | 'silk_fade' | 'whip_glide' | 'flash_dissolve'

export interface CinematicCameraBeat {
  shotId: string
  kind: CinematicBeatKind
  start: number
  end: number
  /** Layer ID or 2.5D Composite instanceId to track / frame */
  subjectId?: string
  /** Secondary Layer ID or instanceId (e.g. whip-pan destination or clash opponent) */
  secondarySubjectId?: string
  /** Relative distance multiplier (`1` = full shot framing, `0.62` = tight close punch-in, `1.08` = wide reveal) */
  startScale?: number
  endScale?: number
  /** Peak punch-in scale at `impactRatio` for `punch_zoom` */
  impactScale?: number
  /** Normalized `[0.1..0.9]` impact moment inside `[start, end]` for `punch_zoom` */
  impactRatio?: number
  /** Duration in seconds to hold freeze/hitstop on impact before pulling back (`0..0.5s`) */
  hitstopSec?: number
  /** Micro camera impact jolt in pixels at `tImpact` */
  impactShakePx?: number
  /** Yaw angle in degrees (orbit parallax perspective) */
  yawStart?: number
  yawEnd?: number
  /** Pitch angle in degrees (`-19` = heroic low angle, `+16` = crane overview) */
  pitchStart?: number
  pitchEnd?: number
  /** Dutch tilt roll in degrees (`±3..15` on whip/clash/corkscrew) */
  rollStart?: number
  rollEnd?: number
  rollImpact?: number
  /** FOV override (`40` default; `< 36` telephoto compression, `> 44` wide dynamic rush) */
  fovStart?: number
  fovEnd?: number
  fovImpact?: number
  /** Framing offset `[dx, dy]` in shot-local pixels (e.g. lead room in movement direction) */
  offsetStart?: [number, number]
  offsetEnd?: [number, number]
  /** Directional continuity vector `[-1 | 1]` for `match_cut` / `whip_glide` across shots */
  continuityDirX?: number
  /** Cut sharply (`hold` keyframe) at the end of this beat when transitioning to another shot */
  cutAtEnd?: boolean
  /** Smooth Donghua optical / motion transition into the next shot (`silk_fade`, `whip_glide`, `flash_dissolve`, `cut`, `none`) */
  transitionAtEnd?: ShotTransitionStyle
  /** Total transition envelope duration in seconds across shot boundary (`0.25..1.2s`, default `0.56s`) */
  transitionDuration?: number
}

interface ResolvedCameraPose {
  t: number
  shot: Shot
  focusLocal: Vec3
  scale: number
  yaw: number
  pitch: number
  roll: number
  fov: number
  ease: EaseName
  actionMode?: CameraActionMode
}

/** `> 0.01s` so `extractCameraFrames2D` preserves both pre-cut and post-cut shot waypoints distinctly. */
const CUT_EPS = 0.012

interface Cinematic3DBeatPreset {
  s0: number
  s1: number
  y0: number
  y1: number
  p0: number
  p1: number
  r0: number
  r1: number
  f0: number
  f1: number
  ease: EaseName
  m0: CameraActionMode
  m1: CameraActionMode
}

const CINEMATIC_3D_BEAT_PRESETS: Record<
  Exclude<CinematicBeatKind, 'track_subject' | 'punch_zoom' | 'orbit_parallax'>,
  Cinematic3DBeatPreset
> = {
  establish_corridor: {
    s0: 1.0, s1: 0.80, y0: -2.0, y1: 2.2, p0: 4.0, p1: -2.0, r0: 0, r1: 0, f0: 42, f1: 38.5,
    ease: 'easeInOut', m0: 'establishing', m1: 'push-in'
  },
  crane_descent: {
    s0: 0.96, s1: 0.78, y0: -2.5, y1: 1.8, p0: 16.5, p1: -5.5, r0: 0, r1: 0, f0: 41.5, f1: 38.5,
    ease: 'easeInOut', m0: 'crane-up', m1: 'crane-down'
  },
  crane_rise: {
    s0: 0.78, s1: 0.98, y0: 1.5, y1: -2.0, p0: -6.0, p1: 17.5, r0: 0, r1: 0, f0: 38.5, f1: 42,
    ease: 'easeInOut', m0: 'low-angle', m1: 'crane-up'
  },
  hero_low_ascent: {
    s0: 0.88, s1: 0.72, y0: -3.5, y1: 4.5, p0: -8.0, p1: -19.5, r0: 0, r1: -2.0, f0: 41, f1: 37.5,
    ease: 'easeInOut', m0: 'low-angle', m1: 'hero-low'
  },
  aerial_dive: {
    s0: 0.98, s1: 0.64, y0: -5.0, y1: 2.5, p0: 27.0, p1: 21.0, r0: 0, r1: 2.5, f0: 44, f1: 37,
    ease: 'easeInOutStrong', m0: 'bird-eye', m1: 'aerial-dive'
  },
  corkscrew_reveal: {
    s0: 0.58, s1: 0.92, y0: -14.0, y1: 6.0, p0: -6.0, p1: 4.0, r0: -15.5, r1: 0, f0: 36.5, f1: 41.5,
    ease: 'easeInOutStrong', m0: 'corkscrew', m1: 'pull-out'
  },
  whip_pan: {
    s0: 0.86, s1: 0.80, y0: -4.5, y1: 7.5, p0: 0, p1: -2.0, r0: 0, r1: 4.5, f0: 40, f1: 39,
    ease: 'easeInOutStrong', m0: 'sweep-right', m1: 'whip-pan'
  },
  match_cut: {
    s0: 0.90, s1: 0.82, y0: -4.0, y1: 3.5, p0: 1.5, p1: -1.5, r0: 3.5, r1: 0, f0: 40, f1: 38.5,
    ease: 'easeOut', m0: 'whip-pan', m1: 'sweep-right'
  }
}

function resolveSubjectLocalPos(project: Project, shot: Shot, subjectId: string | undefined, t: number): Vec3 | null {
  if (!subjectId) return null
  const clusterMembers = getClusterMemberLayers(project, subjectId)
  const directLayer: Layer | undefined =
    getClusterRootLayer(clusterMembers) ?? project.layers.find((l) => l.id === subjectId)
  if (!directLayer) return null
  const rawPos = evaluate(directLayer.transform.position, t)
  if (directLayer.shotId === shot.id) {
    return [rawPos[0], rawPos[1], rawPos[2]]
  }
  const shotPos = evaluate(shot.position, t)
  return [rawPos[0] - shotPos[0], rawPos[1] - shotPos[1], rawPos[2] - shotPos[2]]
}

function subjectToFramingTarget(compHeight: number, subLocal: Vec3, leadXY: [number, number] = [0, 0]): Vec3 {
  const refDist = referenceDistance({ height: compHeight })
  const proj = refDist / Math.max(120, subLocal[2] + refDist)
  return [
    subLocal[0] * proj + leadXY[0],
    subLocal[1] * proj + leadXY[1],
    clamp(subLocal[2] * 0.18, -80, 220)
  ]
}

function writeCameraPose(project: Project, pose: ResolvedCameraPose): void {
  const cam = project.camera
  const dist = referenceDistance(project.comp) * clamp(pose.scale, 0.38, 1.45)
  const yawRad = (pose.yaw * Math.PI) / 180
  const pitchRad = (pose.pitch * Math.PI) / 180
  const [sx, sy, sz] = evaluate(pose.shot.position, pose.t)

  const tx = sx + pose.focusLocal[0]
  const ty = sy + pose.focusLocal[1]
  const tz = sz + pose.focusLocal[2]
  const px = tx + dist * Math.sin(yawRad) * Math.cos(pitchRad)
  const py = ty + dist * Math.sin(pitchRad)
  const pz = tz - dist * Math.cos(yawRad) * Math.cos(pitchRad)

  addKeyframe(cam.target, pose.t, [Math.round(tx), Math.round(ty), Math.round(tz)], pose.ease)
  addKeyframe(cam.position, pose.t, [Math.round(px), Math.round(py), Math.round(pz)], pose.ease)
  addKeyframe(cam.focusDistance, pose.t, Math.round(dist), pose.ease)
  addKeyframe(cam.fov, pose.t, Number(pose.fov.toFixed(2)), pose.ease)
  cam.roll ??= anim(0)
  addKeyframe(cam.roll, pose.t, Number(pose.roll.toFixed(2)), pose.ease)
  if (pose.actionMode) {
    recordExplicitActionMode(pose.t, pose.actionMode)
  }
}

function writeShotTransitionFade(
  project: Project,
  boundaryTime: number,
  style: ShotTransitionStyle,
  durationSec = 0.56
): void {
  if (style === 'none' || style === 'cut') return
  const cam = project.camera
  cam.fade ??= anim(0)
  const halfOut = clamp(durationSec * (style === 'flash_dissolve' ? 0.34 : 0.46), 0.12, 0.55)
  const halfIn = clamp(durationSec * (style === 'flash_dissolve' ? 0.44 : 0.54), 0.15, 0.65)
  const peak = style === 'flash_dissolve' ? 0.92 : style === 'whip_glide' ? 0.58 : 0.84
  const tStart = Number(Math.max(0, boundaryTime - halfOut).toFixed(3))
  const tPre = Number(Math.max(0, boundaryTime - CUT_EPS).toFixed(3))
  const tPost = Number(boundaryTime.toFixed(3))
  const tEnd = Number((boundaryTime + halfIn).toFixed(3))

  addKeyframe(cam.fade, tStart, 0, 'easeIn')
  addKeyframe(cam.fade, tPre, peak, 'hold')
  addKeyframe(cam.fade, tPost, peak, 'easeOut')
  addKeyframe(cam.fade, tEnd, 0, 'easeOut')
}

function sampleTrackSubjectBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const span = Math.max(0.25, beat.end - beat.start)
  const steps = Math.max(3, Math.min(5, Math.ceil(span / 1.05)))
  const startPos = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start) ?? [0, 0, 0]
  const endPos = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.end) ?? startPos
  const moveDx = endPos[0] - startPos[0]
  const autoLeadX = Math.abs(moveDx) > 35 ? Math.sign(moveDx) * 58 : 0
  const s0 = beat.startScale ?? 0.94
  const s1 = beat.endScale ?? 0.80

  const poses: ResolvedCameraPose[] = []
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const t = Number((beat.start + span * u).toFixed(3))
    const sub = resolveSubjectLocalPos(project, shot, beat.subjectId, t) ?? [0, 0, 0]
    const ox = (beat.offsetStart?.[0] ?? autoLeadX) * (1 - u) + (beat.offsetEnd?.[0] ?? autoLeadX * 0.6) * u
    const oy = (beat.offsetStart?.[1] ?? 18) * (1 - u) + (beat.offsetEnd?.[1] ?? 10) * u
    const isLast = i === steps
    const scaleVal = s0 + (s1 - s0) * u
    const stepAction: CameraActionMode =
      i === 0
        ? moveDx > 40
          ? 'sweep-right'
          : moveDx < -40
            ? 'sweep-left'
            : 'pan'
        : s1 < s0 - 0.05
          ? 'push-in'
          : s1 > s0 + 0.05
            ? 'pull-out'
            : moveDx >= 0
              ? 'sweep-right'
              : 'sweep-left'
    poses.push({
      t: isLast && beat.cutAtEnd ? Number((beat.end - CUT_EPS).toFixed(3)) : t,
      shot,
      focusLocal: subjectToFramingTarget(project.comp.height, sub, [ox, oy]),
      scale: scaleVal,
      yaw: (beat.yawStart ?? -3.2) + ((beat.yawEnd ?? 3.6) - (beat.yawStart ?? -3.2)) * u,
      pitch: (beat.pitchStart ?? 2.0) + ((beat.pitchEnd ?? -2.0) - (beat.pitchStart ?? 2.0)) * u,
      roll: (beat.rollStart ?? 0) + ((beat.rollEnd ?? 0) - (beat.rollStart ?? 0)) * u,
      fov: (beat.fovStart ?? 40) + ((beat.fovEnd ?? 38.2) - (beat.fovStart ?? 40)) * u,
      ease: isLast && beat.cutAtEnd ? 'hold' : 'easeInOut',
      actionMode: stepAction
    })
  }
  return poses
}

function samplePunchZoomBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const span = Math.max(0.35, beat.end - beat.start)
  const impRatio = clamp(beat.impactRatio ?? 0.42, 0.16, 0.78)
  const tImpact = Number((beat.start + span * impRatio).toFixed(3))
  const holdDur = clamp(beat.hitstopSec ?? 0.18, 0.08, Math.min(0.36, span * 0.28))
  const tAfterHold = Number(Math.min(beat.end - 0.12, tImpact + holdDur).toFixed(3))
  const tEndPose = beat.cutAtEnd ? Number((beat.end - CUT_EPS).toFixed(3)) : Number(beat.end.toFixed(3))

  const sub0 = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start) ?? [0, 0, 0]
  const subImpA = resolveSubjectLocalPos(project, shot, beat.subjectId, tImpact) ?? sub0
  const subImpB = resolveSubjectLocalPos(project, shot, beat.secondarySubjectId, tImpact)
  const clashCenter: Vec3 = subImpB
    ? [(subImpA[0] + subImpB[0]) * 0.5, (subImpA[1] + subImpB[1]) * 0.5, (subImpA[2] + subImpB[2]) * 0.5]
    : subImpA
  const subEnd = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.end) ?? clashCenter

  const focus0 = subjectToFramingTarget(project.comp.height, sub0, beat.offsetStart ?? [0, 12])
  const focusImp = subjectToFramingTarget(project.comp.height, clashCenter, [0, 8])
  const focusEnd = subjectToFramingTarget(project.comp.height, subEnd, beat.offsetEnd ?? [0, 6])

  const sStart = beat.startScale ?? 0.92
  const sImpact = beat.impactScale ?? 0.46
  const sEnd = beat.endScale ?? 0.86
  const rollImp = beat.rollImpact ?? -8.5
  const shake = beat.impactShakePx ?? 14

  return [
    {
      t: Number(beat.start.toFixed(3)),
      shot,
      focusLocal: focus0,
      scale: sStart,
      yaw: beat.yawStart ?? 2.4,
      pitch: beat.pitchStart ?? 0,
      roll: beat.rollStart ?? 0,
      fov: beat.fovStart ?? 41,
      ease: 'easeOut',
      actionMode: 'pan'
    },
    {
      t: tImpact,
      shot,
      focusLocal: [focusImp[0] + shake * 0.5, focusImp[1] - shake * 0.35, focusImp[2]],
      scale: sImpact,
      yaw: ((beat.yawStart ?? 2.4) + (beat.yawEnd ?? -3.0)) * 0.5,
      pitch: -3.2,
      roll: rollImp,
      fov: beat.fovImpact ?? 35,
      ease: 'easeOut',
      actionMode: sImpact <= 0.48 ? 'extreme-closeup' : 'push-in'
    },
    {
      t: tAfterHold,
      shot,
      focusLocal: focusImp,
      scale: Number((sImpact * 1.02).toFixed(3)),
      yaw: beat.yawEnd ?? -3.0,
      pitch: -2.0,
      roll: Math.abs(rollImp) >= 8 ? rollImp : -8.5,
      fov: (beat.fovImpact ?? 35) + 0.8,
      ease: 'easeInOut',
      actionMode: 'dutch-tilt'
    },
    {
      t: tEndPose,
      shot,
      focusLocal: focusEnd,
      scale: sEnd,
      yaw: beat.yawEnd ?? -1.4,
      pitch: beat.pitchEnd ?? 0.5,
      roll: beat.rollEnd ?? 0,
      fov: beat.fovEnd ?? 39.5,
      ease: beat.cutAtEnd ? 'hold' : 'easeInOut',
      actionMode: sEnd > sImpact + 0.06 ? 'pull-out' : 'pan'
    }
  ]
}

function sampleCinematic3DBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const t0 = Number(beat.start.toFixed(3))
  const tMid = Number(((beat.start + beat.end) * 0.5).toFixed(3))
  const t1 = beat.cutAtEnd ? Number((beat.end - CUT_EPS).toFixed(3)) : Number(beat.end.toFixed(3))
  const subA = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start)
  const subB = resolveSubjectLocalPos(project, shot, beat.secondarySubjectId ?? beat.subjectId, beat.end)
  const dir = beat.continuityDirX ?? 1

  const defaultOffA: [number, number] =
    beat.kind === 'crane_descent'
      ? [0, -88]
      : beat.kind === 'crane_rise'
        ? [0, 18]
        : beat.kind === 'match_cut' || beat.kind === 'whip_pan'
          ? [-dir * 120, 8]
          : [0, 10]
  const defaultOffB: [number, number] =
    beat.kind === 'crane_descent'
      ? [0, 12]
      : beat.kind === 'crane_rise'
        ? [0, -92]
        : beat.kind === 'match_cut' || beat.kind === 'whip_pan'
          ? [dir * 115, 4]
          : [0, 6]

  const focusA = subA
    ? subjectToFramingTarget(project.comp.height, subA, beat.offsetStart ?? defaultOffA)
    : ([beat.offsetStart?.[0] ?? defaultOffA[0], beat.offsetStart?.[1] ?? defaultOffA[1], 0] as Vec3)
  const focusB = subB
    ? subjectToFramingTarget(project.comp.height, subB, beat.offsetEnd ?? defaultOffB)
    : ([beat.offsetEnd?.[0] ?? defaultOffB[0], beat.offsetEnd?.[1] ?? defaultOffB[1], 0] as Vec3)
  const focusMid: Vec3 = [(focusA[0] + focusB[0]) * 0.5, (focusA[1] + focusB[1]) * 0.5, (focusA[2] + focusB[2]) * 0.5]

  if (beat.kind === 'orbit_parallax') {
    const y0 = beat.yawStart ?? -17.5
    const y1 = beat.yawEnd ?? 17.5
    const s0 = beat.startScale ?? 0.94
    const s1 = beat.endScale ?? 0.80
    return [
      {
        t: t0,
        shot,
        focusLocal: focusA,
        scale: s0,
        yaw: y0,
        pitch: beat.pitchStart ?? 3.5,
        roll: beat.rollStart ?? 0,
        fov: beat.fovStart ?? 40,
        ease: 'easeInOut',
        actionMode: y0 <= -14 ? 'orbit-left' : y0 >= 14 ? 'orbit-right' : 'pan'
      },
      {
        t: tMid,
        shot,
        focusLocal: focusMid,
        scale: Number(((s0 + s1) * 0.5).toFixed(3)),
        yaw: Number(((y0 + y1) * 0.5).toFixed(2)),
        pitch: 0.8,
        roll: 0,
        fov: 39,
        ease: 'easeInOut',
        actionMode: s1 < s0 - 0.04 ? 'push-in' : 'pan'
      },
      {
        t: t1,
        shot,
        focusLocal: focusB,
        scale: s1,
        yaw: y1,
        pitch: beat.pitchEnd ?? -2.5,
        roll: beat.rollEnd ?? 0,
        fov: beat.fovEnd ?? 38,
        ease: beat.cutAtEnd ? 'hold' : 'easeInOut',
        actionMode: y1 >= 14 ? 'orbit-right' : y1 <= -14 ? 'orbit-left' : 'push-in'
      }
    ]
  }

  const kindKey = beat.kind as Exclude<CinematicBeatKind, 'track_subject' | 'punch_zoom' | 'orbit_parallax'>
  const base = CINEMATIC_3D_BEAT_PRESETS[kindKey]
  const isDirKind = beat.kind === 'whip_pan' || beat.kind === 'match_cut'
  const y0 = isDirKind ? base.y0 * dir : base.y0
  const y1 = isDirKind ? base.y1 * dir : base.y1
  const r0 = isDirKind ? base.r0 * dir : base.r0
  const r1 = isDirKind ? base.r1 * dir : base.r1
  const m0: CameraActionMode =
    beat.kind === 'whip_pan' ? (dir >= 0 ? 'sweep-right' : 'sweep-left') : base.m0
  const m1: CameraActionMode =
    beat.kind === 'match_cut' ? (dir >= 0 ? 'sweep-right' : 'sweep-left') : base.m1

  return [
    {
      t: t0,
      shot,
      focusLocal: focusA,
      scale: beat.startScale ?? base.s0,
      yaw: beat.yawStart ?? y0,
      pitch: beat.pitchStart ?? base.p0,
      roll: beat.rollStart ?? r0,
      fov: beat.fovStart ?? base.f0,
      ease: base.ease,
      actionMode: m0
    },
    {
      t: t1,
      shot,
      focusLocal: focusB,
      scale: beat.endScale ?? base.s1,
      yaw: beat.yawEnd ?? y1,
      pitch: beat.pitchEnd ?? base.p1,
      roll: beat.rollEnd ?? r1,
      fov: beat.fovEnd ?? base.f1,
      ease: beat.cutAtEnd ? 'hold' : base.ease,
      actionMode: m1
    }
  ]
}

/**
 * Builds a multi-beat Donghua / anime 2.5D camera route with diverse 3D camera action modes
 * (crane descent/rise, heroic low angle, 3D orbit, aerial dive, corkscrew, whip-pan, impact closeup)
 * and silky optical/motion shot-to-shot transitions (`silk_fade`, `whip_glide`, `flash_dissolve`).
 */
export function choreographCinematicCameraRoute(
  project: Project,
  beats: CinematicCameraBeat[],
  options: { clearExisting?: boolean } = {}
): { keyframeCount: number; beatsApplied: number; endTime: number; transitionsApplied: number } {
  if (beats.length === 0) return { keyframeCount: 0, beatsApplied: 0, endTime: 0, transitionsApplied: 0 }
  const cam = project.camera
  if (options.clearExisting !== false) {
    cam.position.keyframes = []
    cam.target.keyframes = []
    cam.focusDistance.keyframes = []
    cam.fov.keyframes = []
    cam.roll ??= anim(0)
    cam.roll.keyframes = []
    cam.fade ??= anim(0)
    cam.fade.keyframes = []
    cam.fade.value = 0
    clearExplicitActionModes()
  }

  const sorted = [...beats].sort((a, b) => a.start - b.start)
  let maxEnd = 0
  let transitionsApplied = 0

  for (let idx = 0; idx < sorted.length; idx++) {
    const beat = { ...sorted[idx] }
    const shot = project.shots.find((s) => s.id === beat.shotId)
    if (!shot) throw new Error(`Shot "${beat.shotId}" không tồn tại trong dự án`)
    const nextBeat = sorted[idx + 1]
    const isCrossShot = Boolean(nextBeat && nextBeat.shotId !== beat.shotId)
    if (beat.cutAtEnd === undefined && isCrossShot) {
      beat.cutAtEnd = true
    }

    const poses =
      beat.kind === 'track_subject'
        ? sampleTrackSubjectBeat(project, shot, beat)
        : beat.kind === 'punch_zoom'
          ? samplePunchZoomBeat(project, shot, beat)
          : sampleCinematic3DBeat(project, shot, beat)

    for (const p of poses) writeCameraPose(project, p)

    if (isCrossShot) {
      const transStyle: ShotTransitionStyle =
        beat.transitionAtEnd ?? (beat.kind === 'whip_pan' || beat.kind === 'match_cut' ? 'whip_glide' : 'silk_fade')
      if (transStyle !== 'none' && transStyle !== 'cut') {
        writeShotTransitionFade(project, beat.end, transStyle, beat.transitionDuration)
        transitionsApplied++
      }
    }
    maxEnd = Math.max(maxEnd, beat.end)
  }

  for (const track of [
    cam.position,
    cam.target,
    cam.focusDistance,
    cam.fov,
    ...(cam.roll ? [cam.roll] : []),
    ...(cam.fade ? [cam.fade] : [])
  ]) {
    track.keyframes.sort((a, b) => a.t - b.t)
  }
  if (cam.position.keyframes.length > 0) {
    cam.position.value = [...cam.position.keyframes[0].value]
    cam.target.value = [...cam.target.keyframes[0].value]
    cam.focusDistance.value = cam.focusDistance.keyframes[0].value
    cam.fov.value = cam.fov.keyframes[0].value
    if (cam.roll && cam.roll.keyframes.length > 0) cam.roll.value = cam.roll.keyframes[0].value
  }
  return {
    keyframeCount: cam.position.keyframes.length,
    beatsApplied: sorted.length,
    endTime: Number(maxEnd.toFixed(3)),
    transitionsApplied
  }
}
