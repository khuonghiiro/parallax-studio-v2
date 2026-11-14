import type { EaseName, Layer, Project, Shot, Vec3 } from '@shared/types'
import { addKeyframe, anim, evaluate } from './keyframes'
import { clamp, referenceDistance } from './math'
import { getClusterMemberLayers, getClusterRootLayer } from '../project/workflowV2ClusterRigAndSwap'

export type CinematicBeatKind =
  | 'establish_corridor'
  | 'track_subject'
  | 'whip_pan'
  | 'punch_zoom'
  | 'match_cut'
  | 'orbit_parallax'

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
  /** Pitch angle in degrees (`-8` = heroic low angle, `+10` = high tactical overview) */
  pitchStart?: number
  pitchEnd?: number
  /** Dutch tilt roll in degrees (`±1.5..4.5` on clashes) */
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
  /** Directional continuity vector `[-1 | 1]` for `match_cut` across shots */
  continuityDirX?: number
  /** Cut sharply (`hold` keyframe) at the end of this beat when transitioning to another shot */
  cutAtEnd?: boolean
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
}

const EPS = 0.004

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

/**
 * Projects a shot-local subject point `(lx, ly, lz)` back onto the `z = 0` focal framing plane
 * while keeping a controlled fraction (`0.22`) of real Z depth so camera movement triggers 2.5D parallax
 * without drifting past foreground occluders.
 */
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
}

function sampleTrackSubjectBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const span = Math.max(0.2, beat.end - beat.start)
  const steps = Math.max(3, Math.min(8, Math.ceil(span / 0.85)))
  const startPos = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start) ?? [0, 0, 0]
  const endPos = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.end) ?? startPos
  const moveDx = endPos[0] - startPos[0]
  const autoLeadX = Math.abs(moveDx) > 35 ? Math.sign(moveDx) * 58 : 0

  const poses: ResolvedCameraPose[] = []
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const t = Number((beat.start + span * u).toFixed(3))
    const sub = resolveSubjectLocalPos(project, shot, beat.subjectId, t) ?? [0, 0, 0]
    const ox = (beat.offsetStart?.[0] ?? autoLeadX) * (1 - u) + (beat.offsetEnd?.[0] ?? autoLeadX * 0.6) * u
    const oy = (beat.offsetStart?.[1] ?? 18) * (1 - u) + (beat.offsetEnd?.[1] ?? 12) * u
    const isLast = i === steps
    poses.push({
      t: isLast && beat.cutAtEnd ? Number((beat.end - EPS).toFixed(3)) : t,
      shot,
      focusLocal: subjectToFramingTarget(project.comp.height, sub, [ox, oy]),
      scale: (beat.startScale ?? 0.94) + ((beat.endScale ?? 0.82) - (beat.startScale ?? 0.94)) * u,
      yaw: (beat.yawStart ?? -2.2) + ((beat.yawEnd ?? 2.4) - (beat.yawStart ?? -2.2)) * u,
      pitch: (beat.pitchStart ?? 1.5) + ((beat.pitchEnd ?? -1.5) - (beat.pitchStart ?? 1.5)) * u,
      roll: (beat.rollStart ?? 0) + ((beat.rollEnd ?? 0) - (beat.rollStart ?? 0)) * u,
      fov: (beat.fovStart ?? 40) + ((beat.fovEnd ?? 38.5) - (beat.fovStart ?? 40)) * u,
      ease: isLast && beat.cutAtEnd ? 'hold' : 'easeInOut'
    })
  }
  return poses
}

function samplePunchZoomBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const span = Math.max(0.35, beat.end - beat.start)
  const impRatio = clamp(beat.impactRatio ?? 0.42, 0.14, 0.82)
  const tImpact = Number((beat.start + span * impRatio).toFixed(3))
  const holdDur = clamp(beat.hitstopSec ?? 0.12, 0.04, Math.min(0.32, span * 0.25))
  const tAfterHold = Number(Math.min(beat.end - 0.08, tImpact + holdDur).toFixed(3))
  const tEndPose = beat.cutAtEnd ? Number((beat.end - EPS).toFixed(3)) : Number(beat.end.toFixed(3))

  const sub0 = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start) ?? [0, 0, 0]
  const subImpA = resolveSubjectLocalPos(project, shot, beat.subjectId, tImpact) ?? sub0
  const subImpB = resolveSubjectLocalPos(project, shot, beat.secondarySubjectId, tImpact)
  const clashCenter: Vec3 = subImpB
    ? [(subImpA[0] + subImpB[0]) * 0.5, (subImpA[1] + subImpB[1]) * 0.5, (subImpA[2] + subImpB[2]) * 0.5]
    : subImpA
  const subEnd = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.end) ?? clashCenter

  const focus0 = subjectToFramingTarget(project.comp.height, sub0, beat.offsetStart ?? [0, 12])
  const focusImp = subjectToFramingTarget(project.comp.height, clashCenter, [0, 10])
  const focusEnd = subjectToFramingTarget(project.comp.height, subEnd, beat.offsetEnd ?? [0, 8])

  const sStart = beat.startScale ?? 0.94
  const sImpact = beat.impactScale ?? 0.68
  const sEnd = beat.endScale ?? 0.86
  const rollImp = beat.rollImpact ?? -2.6
  const shake = beat.impactShakePx ?? 18

  const poses: ResolvedCameraPose[] = [
    {
      t: Number(beat.start.toFixed(3)),
      shot,
      focusLocal: focus0,
      scale: sStart,
      yaw: beat.yawStart ?? 1.8,
      pitch: beat.pitchStart ?? 0,
      roll: beat.rollStart ?? 0,
      fov: beat.fovStart ?? 41,
      ease: 'easeOut'
    },
    {
      t: tImpact,
      shot,
      focusLocal: [focusImp[0] + shake, focusImp[1] - shake * 0.55, focusImp[2]],
      scale: sImpact,
      yaw: ((beat.yawStart ?? 1.8) + (beat.yawEnd ?? -2.6)) * 0.5,
      pitch: -2.4,
      roll: rollImp,
      fov: beat.fovImpact ?? 35,
      ease: 'easeOut'
    }
  ]

  if (shake > 2 && tImpact + 0.045 < tAfterHold) {
    poses.push({
      t: Number((tImpact + 0.045).toFixed(3)),
      shot,
      focusLocal: [focusImp[0] - shake * 0.55, focusImp[1] + shake * 0.35, focusImp[2]],
      scale: sImpact * 0.99,
      yaw: ((beat.yawStart ?? 1.8) + (beat.yawEnd ?? -2.6)) * 0.5,
      pitch: -2.2,
      roll: -rollImp * 0.45,
      fov: beat.fovImpact ?? 35,
      ease: 'easeOut'
    })
  }

  poses.push(
    {
      t: tAfterHold,
      shot,
      focusLocal: focusImp,
      scale: sImpact * 1.01,
      yaw: beat.yawEnd ?? -2.6,
      pitch: -1.6,
      roll: rollImp * 0.7,
      fov: (beat.fovImpact ?? 35) + 0.8,
      ease: 'easeInOut'
    },
    {
      t: tEndPose,
      shot,
      focusLocal: focusEnd,
      scale: sEnd,
      yaw: beat.yawEnd ?? -1.2,
      pitch: beat.pitchEnd ?? 0.5,
      roll: beat.rollEnd ?? 0,
      fov: beat.fovEnd ?? 39.5,
      ease: beat.cutAtEnd ? 'hold' : 'easeInOut'
    }
  )
  return poses
}

function sampleStandardBeat(project: Project, shot: Shot, beat: CinematicCameraBeat): ResolvedCameraPose[] {
  const t0 = Number(beat.start.toFixed(3))
  const t1 = beat.cutAtEnd ? Number((beat.end - EPS).toFixed(3)) : Number(beat.end.toFixed(3))
  const subA = resolveSubjectLocalPos(project, shot, beat.subjectId, beat.start)
  const subB = resolveSubjectLocalPos(project, shot, beat.secondarySubjectId ?? beat.subjectId, beat.end)
  const dir = beat.continuityDirX ?? 1

  const focusA = subA
    ? subjectToFramingTarget(project.comp.height, subA, beat.offsetStart ?? [0, 12])
    : ([beat.offsetStart?.[0] ?? (beat.kind === 'match_cut' ? -dir * 130 : 0), beat.offsetStart?.[1] ?? 10, 0] as Vec3)
  const focusB = subB
    ? subjectToFramingTarget(project.comp.height, subB, beat.offsetEnd ?? [0, 8])
    : ([beat.offsetEnd?.[0] ?? (beat.kind === 'match_cut' ? dir * 95 : 0), beat.offsetEnd?.[1] ?? 0, 0] as Vec3)

  if (beat.kind === 'orbit_parallax') {
    const steps = 6
    const out: ResolvedCameraPose[] = []
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const isLast = i === steps
      out.push({
        t: isLast ? t1 : Number((beat.start + (beat.end - beat.start) * u).toFixed(3)),
        shot,
        focusLocal: [
          focusA[0] + (focusB[0] - focusA[0]) * u,
          focusA[1] + (focusB[1] - focusA[1]) * u,
          focusA[2] + (focusB[2] - focusA[2]) * u
        ],
        scale: (beat.startScale ?? 0.96) + ((beat.endScale ?? 0.84) - (beat.startScale ?? 0.96)) * u,
        yaw: (beat.yawStart ?? -7.5) + ((beat.yawEnd ?? 7.5) - (beat.yawStart ?? -7.5)) * u,
        pitch: (beat.pitchStart ?? 3.5) + ((beat.pitchEnd ?? -2.0) - (beat.pitchStart ?? 3.5)) * u,
        roll: (beat.rollStart ?? 0) + ((beat.rollEnd ?? 0) - (beat.rollStart ?? 0)) * u,
        fov: (beat.fovStart ?? 40) + ((beat.fovEnd ?? 38) - (beat.fovStart ?? 40)) * u,
        ease: isLast && beat.cutAtEnd ? 'hold' : 'linear'
      })
    }
    return out
  }

  const startEase: EaseName = beat.kind === 'whip_pan' || beat.kind === 'match_cut' ? 'easeOut' : 'easeInOut'
  return [
    {
      t: t0,
      shot,
      focusLocal: focusA,
      scale: beat.startScale ?? (beat.kind === 'establish_corridor' ? 1.02 : 0.92),
      yaw: beat.yawStart ?? (beat.kind === 'match_cut' ? -dir * 3.2 : -1.8),
      pitch: beat.pitchStart ?? (beat.kind === 'establish_corridor' ? 3.2 : 0),
      roll: beat.rollStart ?? (beat.kind === 'match_cut' ? dir * 1.4 : 0),
      fov: beat.fovStart ?? (beat.kind === 'establish_corridor' ? 42 : 40),
      ease: startEase
    },
    {
      t: t1,
      shot,
      focusLocal: focusB,
      scale: beat.endScale ?? 0.82,
      yaw: beat.yawEnd ?? (beat.kind === 'match_cut' ? dir * 2.4 : 2.2),
      pitch: beat.pitchEnd ?? -1.2,
      roll: beat.rollEnd ?? 0,
      fov: beat.fovEnd ?? 38.5,
      ease: beat.cutAtEnd ? 'hold' : startEase
    }
  ]
}

/**
 * Builds a complete multi-beat cinematic camera route (subject tracking, whip-pan,
 * punch-in/out impact zoom with hitstop & shake, directional match-cut continuity, and 3D parallax orbit).
 */
export function choreographCinematicCameraRoute(
  project: Project,
  beats: CinematicCameraBeat[],
  options: { clearExisting?: boolean } = {}
): { keyframeCount: number; beatsApplied: number; endTime: number } {
  if (beats.length === 0) return { keyframeCount: 0, beatsApplied: 0, endTime: 0 }
  const cam = project.camera
  if (options.clearExisting !== false) {
    cam.position.keyframes = []
    cam.target.keyframes = []
    cam.focusDistance.keyframes = []
    cam.fov.keyframes = []
    cam.roll ??= anim(0)
    cam.roll.keyframes = []
  }

  const sorted = [...beats].sort((a, b) => a.start - b.start)
  let maxEnd = 0
  for (let idx = 0; idx < sorted.length; idx++) {
    const beat = { ...sorted[idx] }
    const shot = project.shots.find((s) => s.id === beat.shotId)
    if (!shot) throw new Error(`Shot "${beat.shotId}" không tồn tại trong dự án`)
    const nextBeat = sorted[idx + 1]
    if (beat.cutAtEnd === undefined && nextBeat && nextBeat.shotId !== beat.shotId) {
      beat.cutAtEnd = true
    }

    const poses =
      beat.kind === 'track_subject'
        ? sampleTrackSubjectBeat(project, shot, beat)
        : beat.kind === 'punch_zoom'
          ? samplePunchZoomBeat(project, shot, beat)
          : sampleStandardBeat(project, shot, beat)

    for (const p of poses) writeCameraPose(project, p)
    maxEnd = Math.max(maxEnd, beat.end)
  }

  for (const track of [cam.position, cam.target, cam.focusDistance, cam.fov, ...(cam.roll ? [cam.roll] : [])]) {
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
    endTime: Number(maxEnd.toFixed(3))
  }
}
