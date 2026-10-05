import type { Project } from '@shared/types'
import { buildCameraPath, flyCameraToShot, TRANSITIONS, type PathStep, type TransitionType } from '../../animation/cameraPath'
import { applyCameraPreset, CAMERA_PRESETS, type CameraPreset } from '../../animation/presets'
import { setCompDuration } from '../../actions'
import { shotLocalToWorld } from '../../engine/evaluateScene'
import { ParamError, ed, proj, type Handler, type Params } from '../types'
import { bool, easeOf, has, num, requireShot, round, setAnim, str, vec3 } from '../params'
import { cameraSummary } from '../summaries'

export const cameraCommands: Record<string, Handler> = {
  get_camera_info: (p) => cameraSummary(proj(), num(p, 'time') ?? ed().time),

  set_camera: (p) => {
    const project = proj()
    ed().update((d) => {
      const c = d.camera
      const pos = vec3(p, 'position')
      if (pos) setAnim(c.position, pos, p, project)
      const tg = vec3(p, 'target')
      if (tg) setAnim(c.target, tg, p, project)
      for (const [param, prop] of [
        ['fov', 'fov'],
        ['focus_distance', 'focusDistance'],
        ['aperture', 'aperture'],
        ['fade', 'fade']
      ] as const) {
        const v = num(p, param)
        if (v !== undefined) setAnim(c[prop], v, p, project)
      }
      if (has(p, 'dof_enabled')) c.dofEnabled = bool(p, 'dof_enabled')!
      if (has(p, 'shake_amount')) c.shakeAmount = num(p, 'shake_amount')!
      if (has(p, 'shake_speed')) c.shakeSpeed = num(p, 'shake_speed')!
    })
    return cameraSummary(proj(), ed().time)
  },

  apply_camera_preset: (p) => {
    const preset = str(p, 'preset', true) as CameraPreset
    if (!CAMERA_PRESETS.some((x) => x.id === preset)) throw new ParamError(`"preset" must be one of ${CAMERA_PRESETS.map((x) => x.id).join(', ')}`)
    const project = proj()
    const shot = has(p, 'shot_id') ? requireShot(project, str(p, 'shot_id')) : null
    const t0 = num(p, 'start') ?? 0
    const t1 = num(p, 'end') ?? project.comp.duration
    ed().update((d) => applyCameraPreset(d.camera as Project['camera'], preset, d.comp as Project['comp'], t0, t1, num(p, 'intensity') ?? 1, shotLocalToWorld(shot, t0)))
    return cameraSummary(proj(), t0)
  },

  camera_fly_to_shot: (p) => {
    const id = requireShot(proj(), str(p, 'shot_id', true)).id
    const t = num(p, 'time') ?? ed().time
    ed().update((d) => flyCameraToShot(d as Project, id, t, num(p, 'duration') ?? 0, easeOf(p)))
    return cameraSummary(proj(), t)
  },

  build_camera_path: (p) => {
    if (!Array.isArray(p.steps) || p.steps.length === 0) throw new ParamError('"steps" must be a non-empty array')
    const project = proj()
    const types = TRANSITIONS.map((x) => x.id)
    const steps: PathStep[] = (p.steps as Params[]).map((s, i) => {
      const type = (str(s, 'transition') ?? 'fly') as TransitionType
      if (!types.includes(type)) throw new ParamError(`steps[${i}].transition must be one of ${types.join(', ')}`)
      return {
        shotId: requireShot(project, str(s, 'shot_id', true)).id,
        hold: num(s, 'hold') ?? 3,
        type,
        transition: num(s, 'transition_duration') ?? (type === 'cut' ? 0 : type === 'fade' ? 1 : 2)
      }
    })
    const fit = bool(p, 'fit_duration') ?? true
    let end = 0
    ed().update((d) => {
      end = buildCameraPath(d as Project, steps, { pushIn: num(p, 'push_in') ?? 0.12, startAt: num(p, 'start_at') ?? 0 })
      if (fit) setCompDuration(d as Project, end)
    })
    ed().setTime(num(p, 'start_at') ?? 0)
    return { end: round(end, 3), duration: proj().comp.duration, steps: steps.length }
  }
}
