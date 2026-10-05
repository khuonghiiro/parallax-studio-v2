import type { Animatable, EaseName, Project, Vec3 } from '@shared/types'
import { ease } from './easing'
import { addKeyframe, evaluate } from './keyframes'
import { referenceDistance } from './math'
import { evaluateCamera, shotAngledPose, shotFramingPose, shotMatrix, type CameraAnglePreset } from '../engine/evaluateScene'
import * as THREE from 'three'

export type TransitionType = 'fly' | 'arc' | 'cut' | 'fade'

export const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: 'fly', label: 'Bay thẳng' },
  { id: 'arc', label: 'Bay vòng cung' },
  { id: 'cut', label: 'Cắt cảnh' },
  { id: 'fade', label: 'Fade đen' }
]

export type StepAngle = CameraAnglePreset
export type StepMotion = 'push' | 'pull' | 'orbit-left' | 'orbit-right' | 'pan-left' | 'pan-right' | 'static'

export const STEP_ANGLES: { id: StepAngle; label: string }[] = [
  { id: 'front', label: 'Chính diện (0°)' },
  { id: 'left30', label: 'Chéo trái 30°' },
  { id: 'right30', label: 'Chéo phải 30°' },
  { id: 'left45', label: 'Chéo trái 45°' },
  { id: 'right45', label: 'Chéo phải 45°' },
  { id: 'high', label: 'Góc cao (22°)' },
  { id: 'low', label: 'Góc thấp (-15°)' },
  { id: 'top', label: 'Đỉnh đầu (75°)' }
]

export const STEP_MOTIONS: { id: StepMotion; label: string }[] = [
  { id: 'push', label: 'Đẩy vào (Zoom In)' },
  { id: 'pull', label: 'Kéo ra (Zoom Out)' },
  { id: 'orbit-left', label: 'Lượn xoay sang trái' },
  { id: 'orbit-right', label: 'Lượn xoay sang phải' },
  { id: 'pan-left', label: 'Lia ngang sang trái' },
  { id: 'pan-right', label: 'Lia ngang sang phải' },
  { id: 'static', label: 'Giữ cố định (Static)' }
]

export interface PathStep {
  shotId: string
  /** Seconds the camera stays on this shot. */
  hold: number
  /** Transition INTO the next step (ignored for the last step). */
  type: TransitionType
  /** Transition duration in seconds (cut ignores it). */
  transition: number
  /** Camera angle framing this shot. Defaults to 'front'. */
  angle?: StepAngle
  /** Camera motion during the hold. Defaults to 'push'. */
  motion?: StepMotion
}

export interface PathOptions {
  /** 0..0.5 — fraction of the framing distance the camera slowly pushes in during each hold. */
  pushIn?: number
  startAt?: number
}

const EPS = 1e-3

type Pose = { position: Vec3; target: Vec3 }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]

function clearAnim<T extends number | Vec3>(a: Animatable<T>, value?: T): void {
  if (a.keyframes.length) a.value = a.keyframes[0].value
  a.keyframes = []
  if (value !== undefined) a.value = value
}

/**
 * Replace the camera move with a tour through shots. Mutates `project.camera`
 * (use inside an immer producer). Returns the end time of the tour.
 */
export function buildCameraPath(project: Project, steps: PathStep[], opts: PathOptions = {}): number {
  if (steps.length === 0) return opts.startAt ?? 0
  const cam = project.camera
  const push = Math.max(0, Math.min(0.5, opts.pushIn ?? 0))
  clearAnim(cam.position)
  clearAnim(cam.target)
  clearAnim(cam.focusDistance)
  clearAnim(cam.fade, 0)

  const key = (t: number, p: Pose, e: EaseName): void => {
    addKeyframe(cam.position, t, p.position, e)
    addKeyframe(cam.target, t, p.target, e)
    addKeyframe(cam.focusDistance, t, Math.round(len(sub(p.target, p.position))), e)
  }
  const shotOf = (id: string) => {
    const s = project.shots.find((x) => x.id === id)
    if (!s) throw new Error(`Shot ${id} không tồn tại`)
    return s
  }

  let t = opts.startAt ?? 0 // nominal start of the current hold
  let startKeyTime = t // when the camera actually arrives (cut/fade arrive early)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const shot = shotOf(step.shotId)
    const holdEnd = t + Math.max(0, step.hold)
    const ang = step.angle ?? 'front'
    const mot = step.motion ?? 'push'
    const panW = project.comp.width * 0.15

    let A: Pose
    let B: Pose
    switch (mot) {
      case 'pull':
        A = shotAngledPose(project, shot, startKeyTime, ang, push)
        B = shotAngledPose(project, shot, holdEnd, ang, 0)
        break
      case 'orbit-left':
        A = shotAngledPose(project, shot, startKeyTime, ang, push * 0.5, 12, 0)
        B = shotAngledPose(project, shot, holdEnd, ang, push * 0.5, -12, 0)
        break
      case 'orbit-right':
        A = shotAngledPose(project, shot, startKeyTime, ang, push * 0.5, -12, 0)
        B = shotAngledPose(project, shot, holdEnd, ang, push * 0.5, 12, 0)
        break
      case 'pan-left':
        A = shotAngledPose(project, shot, startKeyTime, ang, 0, 0, 0, [panW, 0, 0])
        B = shotAngledPose(project, shot, holdEnd, ang, 0, 0, 0, [-panW, 0, 0])
        break
      case 'pan-right':
        A = shotAngledPose(project, shot, startKeyTime, ang, 0, 0, 0, [-panW, 0, 0])
        B = shotAngledPose(project, shot, holdEnd, ang, 0, 0, 0, [panW, 0, 0])
        break
      case 'static':
        A = shotAngledPose(project, shot, startKeyTime, ang, 0)
        B = shotAngledPose(project, shot, holdEnd, ang, 0)
        break
      case 'push':
      default:
        A = shotAngledPose(project, shot, startKeyTime, ang, 0)
        B = shotAngledPose(project, shot, holdEnd, ang, push)
        break
    }
    key(startKeyTime, A, 'easeInOut')
    const next = steps[i + 1]
    if (!next) {
      if (holdEnd > startKeyTime + EPS) key(holdEnd, B, 'easeInOut')
      t = holdEnd
      break
    }
    const T = Math.max(0, step.transition)
    switch (step.type) {
      case 'fly':
        key(holdEnd, B, 'easeInOut')
        t = holdEnd + T
        startKeyTime = t
        break
      case 'arc': {
        const nextAng = next.angle ?? 'front'
        const arrive = shotAngledPose(project, shotOf(next.shotId), holdEnd + T, nextAng, 0)
        const back = sub(B.position, B.target)
        const bl = len(back) || 1
        const dist = len(sub(arrive.position, B.position))
        const mid = lerp3(B.position, arrive.position, 0.5)
        const ctrl: Vec3 = [
          mid[0] + (back[0] / bl) * dist * 0.45,
          mid[1] + (back[1] / bl) * dist * 0.45 + dist * 0.12,
          mid[2] + (back[2] / bl) * dist * 0.45
        ]
        const n = 10
        for (let k = 0; k < n; k++) {
          const u = ease('easeInOut', k / n)
          const a = (1 - u) * (1 - u)
          const b = 2 * (1 - u) * u
          const c = u * u
          const p: Vec3 = [
            a * B.position[0] + b * ctrl[0] + c * arrive.position[0],
            a * B.position[1] + b * ctrl[1] + c * arrive.position[1],
            a * B.position[2] + b * ctrl[2] + c * arrive.position[2]
          ]
          key(holdEnd + (T * k) / n, { position: p, target: lerp3(B.target, arrive.target, u) }, 'linear')
        }
        t = holdEnd + T
        startKeyTime = t
        break
      }
      case 'cut':
        key(holdEnd, B, 'hold')
        t = holdEnd
        startKeyTime = holdEnd + EPS
        break
      case 'fade': {
        const half = Math.max(EPS * 2, T / 2)
        key(holdEnd, B, 'hold')
        addKeyframe(cam.fade, holdEnd, 0, 'easeIn')
        addKeyframe(cam.fade, holdEnd + half, 1, 'easeOut')
        addKeyframe(cam.fade, holdEnd + half * 2, 0, 'linear')
        t = holdEnd + half * 2
        startKeyTime = holdEnd + half + EPS
        break
      }
    }
  }
  return t
}

/**
 * After-Effects-style "fly the camera here": key the shot's framing pose at time `t`.
 * With `duration`, also key the current pose at `t - duration` so the move takes that long.
 */
export function flyCameraToShot(project: Project, shotId: string, t: number, duration = 0, easeName: EaseName = 'easeInOut', anglePreset: CameraAnglePreset = 'front'): void {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot ${shotId} không tồn tại`)
  const cam = project.camera
  const pose = shotAngledPose(project, shot, t, anglePreset)
  const focus = Math.round(len(sub(pose.target, pose.position)))
  const animated = cam.position.keyframes.length > 0 || cam.target.keyframes.length > 0
  if (!animated && t <= EPS) {
    cam.position.value = pose.position
    cam.target.value = pose.target
    cam.focusDistance.value = focus
    return
  }
  if (duration > 0 || !animated) {
    // Key where the camera is right before the move starts (t=0 when it was static).
    const startT = duration > 0 ? Math.max(0, t - duration) : 0
    addKeyframe(cam.position, startT, [...evaluate(cam.position, startT)] as Vec3, easeName)
    addKeyframe(cam.target, startT, [...evaluate(cam.target, startT)] as Vec3, easeName)
    addKeyframe(cam.focusDistance, startT, Math.round(evaluate(cam.focusDistance, startT)), easeName)
  }
  addKeyframe(cam.position, t, pose.position, easeName)
  addKeyframe(cam.target, t, pose.target, easeName)
  addKeyframe(cam.focusDistance, t, focus, easeName)
}

/** Which shot the camera is looking at, at time t (nearest shot origin to the camera target). */
export function shotAtTime(project: Project, t: number): string | null {
  if (project.shots.length === 0) return null
  const ev = evaluateCamera(project, t)
  if (ev.fade > 0.98) return null
  const target = new THREE.Vector3(ev.target[0], ev.target[1], -ev.target[2])
  const limit = referenceDistance(project.comp) * 1.6
  let best: string | null = null
  let bestD = Infinity
  const o = new THREE.Vector3()
  for (const s of project.shots) {
    if (!s.visible) continue
    o.setFromMatrixPosition(shotMatrix(s, t))
    const d = o.distanceTo(target)
    if (d < bestD) {
      bestD = d
      best = s.id
    }
  }
  return bestD <= limit ? best : null
}
