import type { Layer, Project, Shot } from '@shared/types'
import { shotAtTime } from '../animation/cameraPath'
import { evaluate } from '../animation/keyframes'
import { evaluateCamera, shotFramingPose } from '../engine/evaluateScene'
import type { CameraProp } from '../store/editor'
import { keyedProps, r3, round } from './params'

export function layerSummary(l: Layer, t: number) {
  const tr = l.transform
  return {
    id: l.id,
    name: l.name,
    type: l.type,
    shot_id: l.shotId,
    visible: l.visible,
    locked: l.locked,
    in_point: l.inPoint,
    out_point: l.outPoint,
    blend_mode: l.blendMode,
    position: r3(evaluate(tr.position, t)),
    scale: r3(evaluate(tr.scale, t)),
    opacity: round(evaluate(tr.opacity, t), 3),
    animated: keyedProps(tr, ['position', 'rotation', 'scale', 'opacity']),
    ...(l.type === 'text' ? { text: l.props.text } : {}),
    ...(l.type === 'image' ? { asset_id: l.props.assetId, size: [l.props.width, l.props.height] } : {})
  }
}

export function shotSummary(s: Shot, project: Project, t: number) {
  const pose = shotFramingPose(project, s, t)
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    visible: s.visible,
    position: r3(evaluate(s.position, t)),
    rotation: r3(evaluate(s.rotation, t)),
    animated: keyedProps(s, ['position', 'rotation']),
    layer_count: project.layers.filter((l) => l.shotId === s.id).length,
    framing_camera: { position: r3(pose.position), target: r3(pose.target) }
  }
}

export function cameraSummary(project: Project, t: number) {
  const c = project.camera
  const ev = evaluateCamera(project, t)
  return {
    at_time: t,
    position: r3(ev.position),
    target: r3(ev.target),
    fov: round(ev.fov),
    focus_distance: round(ev.focusDistance),
    aperture: round(ev.aperture, 3),
    fade: round(ev.fade, 3),
    dof_enabled: c.dofEnabled,
    shake_amount: c.shakeAmount,
    shake_speed: c.shakeSpeed,
    looking_at_shot: shotAtTime(project, t),
    keyframes: Object.fromEntries(
      (['position', 'target', 'fov', 'focusDistance', 'aperture', 'fade'] as CameraProp[]).map((k) => [
        k,
        c[k].keyframes.map((kf) => ({ t: round(kf.t, 3), value: kf.value, ease: kf.ease }))
      ])
    )
  }
}
