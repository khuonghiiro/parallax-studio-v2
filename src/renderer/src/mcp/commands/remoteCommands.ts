import type { Animatable, AnimValue, Layer, Project, Vec3 } from '@shared/types'
import { addKeyframe, evaluate } from '../../animation/keyframes'
import { flyCameraToShot } from '../../animation/cameraPath'
import { ParamError, ed, proj, type Handler, type Params } from '../types'
import { bool, has, num, requireLayer, requireShot, round, scale3, setAnim, str, vec3 } from '../params'

function evalVec3(anim: Animatable<Vec3>, t: number): Vec3 {
  const v = evaluate(anim, t)
  return [round(v[0], 2), round(v[1], 2), round(v[2], 2)]
}

function evalNum(anim: Animatable<number>, t: number, digits = 2): number {
  return round(evaluate(anim, t), digits)
}

function writeSmartAnim<T extends AnimValue>(anim: Animatable<T>, value: T, t: number, forceKey?: boolean): void {
  if (forceKey || anim.keyframes.length > 0) {
    addKeyframe(anim, t, value, 'easeInOut')
  } else {
    anim.value = value
  }
}

function orbitAroundTarget(pos: Vec3, target: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
  const ox = pos[0] - target[0]
  const oy = pos[1] - target[1]
  const oz = pos[2] - target[2]
  const radius = Math.max(10, Math.hypot(ox, oy, oz))

  let theta = Math.atan2(ox, oz)
  let phi = Math.asin(Math.max(-0.98, Math.min(0.98, oy / radius)))

  theta += (yawDeg * Math.PI) / 180
  phi = Math.max(-1.4, Math.min(1.4, phi + (pitchDeg * Math.PI) / 180))

  const cosPhi = Math.cos(phi)
  return [
    round(target[0] + radius * cosPhi * Math.sin(theta), 2),
    round(target[1] + radius * Math.sin(phi), 2),
    round(target[2] + radius * cosPhi * Math.cos(theta), 2)
  ]
}

export function buildRemoteStateSnapshot() {
  const state = ed()
  const project = state.project
  const t = state.time
  const activeShotId = state.selectedShotId ?? project.shots[0]?.id ?? null
  const shotLayers = project.layers.filter((l) => !activeShotId || l.shotId === activeShotId)

  // Ensure a sensible layer is highlighted for quick mobile manipulation
  const selectedLayerId =
    state.selectedLayerId && project.layers.some((l) => l.id === state.selectedLayerId)
      ? state.selectedLayerId
      : shotLayers[0]?.id ?? project.layers[0]?.id ?? null

  return {
    comp: {
      name: project.comp.name,
      width: project.comp.width,
      height: project.comp.height,
      fps: project.comp.fps,
      duration: round(project.comp.duration, 2)
    },
    time: round(t, 3),
    playing: state.playing,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    selectedShotId: activeShotId,
    selectedLayerId,
    shots: project.shots.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      visible: s.visible,
      position: evalVec3(s.position, t)
    })),
    layers: shotLayers.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      shotId: l.shotId,
      visible: l.visible,
      locked: l.locked,
      position: evalVec3(l.transform.position, t),
      rotation: evalVec3(l.transform.rotation, t),
      scale: evalVec3(l.transform.scale, t),
      opacity: evalNum(l.transform.opacity, t, 3),
      hasKeyframes:
        l.transform.position.keyframes.length > 0 ||
        l.transform.rotation.keyframes.length > 0 ||
        l.transform.scale.keyframes.length > 0
    })),
    camera: {
      position: evalVec3(project.camera.position, t),
      target: evalVec3(project.camera.target, t),
      fov: evalNum(project.camera.fov, t, 1),
      dofEnabled: Boolean(project.camera.dofEnabled),
      focusDistance: evalNum(project.camera.focusDistance, t, 1),
      aperture: evalNum(project.camera.aperture, t, 2),
      shakeAmount: round(project.camera.shakeAmount ?? 0, 2),
      hasKeyframes:
        project.camera.position.keyframes.length > 0 ||
        project.camera.target.keyframes.length > 0 ||
        project.camera.fov.keyframes.length > 0
    }
  }
}

function resolveTargetLayer(project: Project, p: Params): Layer {
  const explicitId = str(p, 'layer_id')
  if (explicitId) return requireLayer(project, explicitId)
  const selId = ed().selectedLayerId
  if (selId) {
    const found = project.layers.find((l) => l.id === selId)
    if (found) return found
  }
  const activeShotId = ed().selectedShotId ?? project.shots[0]?.id
  const inShot = project.layers.find((l) => l.shotId === activeShotId && !l.locked)
  if (inShot) return inShot
  if (project.layers[0]) return project.layers[0]
  throw new ParamError('Không có layer nào trong cảnh để điều khiển')
}

export function executeRemoteAction(p: Params) {
  const action = str(p, 'action', true)
  const state = ed()
  const project = proj()
  const t = num(p, 'time') ?? state.time
  const forceKey = bool(p, 'keyframe')

    switch (action) {
      case 'toggle_play':
        state.setPlaying(!state.playing)
        break

      case 'play':
        state.setPlaying(true)
        break

      case 'pause':
        state.setPlaying(false)
        break

      case 'seek': {
        const dt = num(p, 'delta_time')
        const nextT = dt !== undefined ? state.time + dt : (num(p, 'time') ?? state.time)
        state.setPlaying(false)
        state.setTime(Math.max(0, Math.min(project.comp.duration, nextT)))
        break
      }

      case 'undo':
        state.undo()
        break

      case 'redo':
        state.redo()
        break

      case 'select_shot': {
        const shot = requireShot(project, str(p, 'shot_id', true))
        state.selectShot(shot.id)
        if (bool(p, 'fly') ?? false) {
          state.update((d) => {
            flyCameraToShot(d as Project, shot.id, t, num(p, 'duration') ?? 0, 'easeInOut')
          })
        }
        break
      }

      case 'select_layer': {
        const layer = requireLayer(project, str(p, 'layer_id', true))
        state.selectLayer(layer.id)
        if (layer.shotId) state.selectShot(layer.shotId)
        break
      }

      case 'toggle_layer_visible': {
        const target = resolveTargetLayer(project, p)
        state.update((d) => {
          const l = d.layers.find((x) => x.id === target.id)
          if (l) l.visible = !l.visible
        })
        break
      }

      case 'toggle_layer_lock': {
        const target = resolveTargetLayer(project, p)
        state.update((d) => {
          const l = d.layers.find((x) => x.id === target.id)
          if (l) l.locked = !l.locked
        })
        break
      }

      case 'nudge_camera': {
        const dx = num(p, 'dx') ?? 0
        const dy = num(p, 'dy') ?? 0
        const dz = num(p, 'dz') ?? 0
        const dfov = num(p, 'dfov') ?? 0
        const mode = str(p, 'mode') ?? 'pan'

        state.update((d) => {
          const cam = d.camera
          const curPos = evalVec3(cam.position as Animatable<Vec3>, t)
          const curTgt = evalVec3(cam.target as Animatable<Vec3>, t)

          if (mode === 'orbit') {
            const nextPos = orbitAroundTarget(curPos, curTgt, dx, dy)
            writeSmartAnim(cam.position as Animatable<Vec3>, [nextPos[0], nextPos[1], round(nextPos[2] + dz, 2)], t, forceKey)
          } else if (mode === 'dolly') {
            const nextPos: Vec3 = [round(curPos[0] + dx, 2), curPos[1], round(curPos[2] + dz + dy, 2)]
            const nextTgt: Vec3 = [round(curTgt[0] + dx, 2), curTgt[1], round(curTgt[2] + dz + dy, 2)]
            writeSmartAnim(cam.position as Animatable<Vec3>, nextPos, t, forceKey)
            writeSmartAnim(cam.target as Animatable<Vec3>, nextTgt, t, forceKey)
          } else {
            // Default: 'pan' (trucks X/Y/Z together)
            const nextPos: Vec3 = [round(curPos[0] + dx, 2), round(curPos[1] + dy, 2), round(curPos[2] + dz, 2)]
            const nextTgt: Vec3 = [round(curTgt[0] + dx, 2), round(curTgt[1] + dy, 2), round(curTgt[2] + dz, 2)]
            writeSmartAnim(cam.position as Animatable<Vec3>, nextPos, t, forceKey)
            writeSmartAnim(cam.target as Animatable<Vec3>, nextTgt, t, forceKey)
          }

          if (dfov !== 0) {
            const curFov = evalNum(cam.fov as Animatable<number>, t, 2)
            writeSmartAnim(cam.fov as Animatable<number>, Math.max(12, Math.min(120, round(curFov + dfov, 1))), t, forceKey)
          }
        })
        break
      }

      case 'set_camera_transform': {
        state.update((d) => {
          const cam = d.camera
          const pos = vec3(p, 'position')
          if (pos) setAnim(cam.position, pos, p, project)
          const tgt = vec3(p, 'target')
          if (tgt) setAnim(cam.target, tgt, p, project)
          const z = num(p, 'z')
          if (z !== undefined && !pos) {
            const curPos = evalVec3(cam.position as Animatable<Vec3>, t)
            writeSmartAnim(cam.position as Animatable<Vec3>, [curPos[0], curPos[1], round(z, 2)], t, forceKey)
          }
          const fov = num(p, 'fov')
          if (fov !== undefined) writeSmartAnim(cam.fov as Animatable<number>, Math.max(12, Math.min(120, fov)), t, forceKey)
          const focus = num(p, 'focus_distance')
          if (focus !== undefined) writeSmartAnim(cam.focusDistance as Animatable<number>, Math.max(10, focus), t, forceKey)
          if (has(p, 'dof_enabled')) cam.dofEnabled = Boolean(bool(p, 'dof_enabled'))
          if (has(p, 'shake_amount')) cam.shakeAmount = Math.max(0, num(p, 'shake_amount') ?? 0)
        })
        break
      }

      case 'reset_camera': {
        state.update((d) => {
          const cam = d.camera
          writeSmartAnim(cam.position as Animatable<Vec3>, [0, 0, 1200], t, forceKey)
          writeSmartAnim(cam.target as Animatable<Vec3>, [0, 0, 0], t, forceKey)
          writeSmartAnim(cam.fov as Animatable<number>, 50, t, forceKey)
        })
        break
      }

      case 'nudge_layer': {
        const target = resolveTargetLayer(project, p)
        if (target.locked) throw new ParamError(`Layer "${target.name}" đang bị khoá`)
        const dx = num(p, 'dx') ?? 0
        const dy = num(p, 'dy') ?? 0
        const dz = num(p, 'dz') ?? 0
        const drx = num(p, 'drx') ?? 0
        const dry = num(p, 'dry') ?? 0
        const drz = num(p, 'drz') ?? 0
        const ds = num(p, 'ds') ?? 0
        const dsx = num(p, 'dsx') ?? ds
        const dsy = num(p, 'dsy') ?? ds
        const dop = num(p, 'dopacity') ?? 0

        state.selectLayer(target.id)
        state.update((d) => {
          const l = d.layers.find((x) => x.id === target.id)
          if (!l) return
          if (dx !== 0 || dy !== 0 || dz !== 0) {
            const cur = evalVec3(l.transform.position as Animatable<Vec3>, t)
            writeSmartAnim(
              l.transform.position as Animatable<Vec3>,
              [round(cur[0] + dx, 2), round(cur[1] + dy, 2), round(cur[2] + dz, 2)],
              t,
              forceKey
            )
          }
          if (drx !== 0 || dry !== 0 || drz !== 0) {
            const cur = evalVec3(l.transform.rotation as Animatable<Vec3>, t)
            writeSmartAnim(
              l.transform.rotation as Animatable<Vec3>,
              [round(cur[0] + drx, 2), round(cur[1] + dry, 2), round(cur[2] + drz, 2)],
              t,
              forceKey
            )
          }
          if (dsx !== 0 || dsy !== 0) {
            const cur = evalVec3(l.transform.scale as Animatable<Vec3>, t)
            writeSmartAnim(
              l.transform.scale as Animatable<Vec3>,
              [round(Math.max(0.05, cur[0] + dsx), 3), round(Math.max(0.05, cur[1] + dsy), 3), cur[2]],
              t,
              forceKey
            )
          }
          if (dop !== 0) {
            const cur = evalNum(l.transform.opacity as Animatable<number>, t, 3)
            writeSmartAnim(
              l.transform.opacity as Animatable<number>,
              round(Math.max(0, Math.min(1, cur + dop)), 3),
              t,
              forceKey
            )
          }
        })
        break
      }

      case 'set_layer_transform': {
        const target = resolveTargetLayer(project, p)
        if (target.locked) throw new ParamError(`Layer "${target.name}" đang bị khoá`)
        state.selectLayer(target.id)
        state.update((d) => {
          const l = d.layers.find((x) => x.id === target.id)
          if (!l) return
          const pos = vec3(p, 'position')
          if (pos) writeSmartAnim(l.transform.position as Animatable<Vec3>, pos, t, forceKey)
          const z = num(p, 'z')
          if (z !== undefined && !pos) {
            const cur = evalVec3(l.transform.position as Animatable<Vec3>, t)
            writeSmartAnim(l.transform.position as Animatable<Vec3>, [cur[0], cur[1], round(z, 2)], t, forceKey)
          }
          const rot = vec3(p, 'rotation')
          if (rot) writeSmartAnim(l.transform.rotation as Animatable<Vec3>, rot, t, forceKey)
          const sc = scale3(p, 'scale')
          if (sc) writeSmartAnim(l.transform.scale as Animatable<Vec3>, sc, t, forceKey)
          const op = num(p, 'opacity')
          if (op !== undefined) {
            writeSmartAnim(l.transform.opacity as Animatable<number>, Math.max(0, Math.min(1, op)), t, forceKey)
          }
        })
        break
      }

      case 'reset_layer_transform': {
        const target = resolveTargetLayer(project, p)
        if (target.locked) throw new ParamError(`Layer "${target.name}" đang bị khoá`)
        state.selectLayer(target.id)
        state.update((d) => {
          const l = d.layers.find((x) => x.id === target.id)
          if (!l) return
          const curPos = evalVec3(l.transform.position as Animatable<Vec3>, t)
          writeSmartAnim(l.transform.position as Animatable<Vec3>, [0, 0, curPos[2]], t, forceKey)
          writeSmartAnim(l.transform.rotation as Animatable<Vec3>, [0, 0, 0], t, forceKey)
          writeSmartAnim(l.transform.scale as Animatable<Vec3>, [1, 1, 1], t, forceKey)
        })
        break
      }

      case 'keyframe': {
        const kind = str(p, 'target_kind') ?? 'layer'
        if (kind === 'camera') {
          state.update((d) => {
            const cam = d.camera
            addKeyframe(cam.position as Animatable<Vec3>, t, evalVec3(cam.position as Animatable<Vec3>, t), 'easeInOut')
            addKeyframe(cam.target as Animatable<Vec3>, t, evalVec3(cam.target as Animatable<Vec3>, t), 'easeInOut')
            addKeyframe(cam.fov as Animatable<number>, t, evalNum(cam.fov as Animatable<number>, t, 1), 'easeInOut')
          })
        } else {
          const target = resolveTargetLayer(project, p)
          state.selectLayer(target.id)
          state.update((d) => {
            const l = d.layers.find((x) => x.id === target.id)
            if (!l) return
            addKeyframe(l.transform.position as Animatable<Vec3>, t, evalVec3(l.transform.position as Animatable<Vec3>, t), 'easeInOut')
            addKeyframe(l.transform.rotation as Animatable<Vec3>, t, evalVec3(l.transform.rotation as Animatable<Vec3>, t), 'easeInOut')
            addKeyframe(l.transform.scale as Animatable<Vec3>, t, evalVec3(l.transform.scale as Animatable<Vec3>, t), 'easeInOut')
          })
        }
        break
      }

      default:
        throw new ParamError(`Unknown remote action "${action}"`)
    }

  return buildRemoteStateSnapshot()
}

export const remoteCommands: Record<string, Handler> = {
  get_remote_state: () => buildRemoteStateSnapshot(),
  remote_control_action: (p) => executeRemoteAction(p)
}
