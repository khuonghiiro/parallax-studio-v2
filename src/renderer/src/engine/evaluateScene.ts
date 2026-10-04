import type { Layer, Project, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor, smoothNoise } from '../animation/math'

export interface EvaluatedCamera {
  position: Vec3
  target: Vec3
  fov: number
  dof: boolean
  focusDistance: number
  aperture: number
}

export interface EvaluatedLayer {
  layer: Layer
  /** Stack index (0 = top). */
  index: number
  active: boolean
  position: Vec3
  rotation: Vec3
  /** Final scale including auto-scale-with-depth. */
  scale: Vec3
  opacity: number
}

export interface EvaluatedScene {
  t: number
  camera: EvaluatedCamera
  layers: EvaluatedLayer[]
}

/** Evaluate the entire scene at time t. Pure: same input → same output. */
export function evaluateScene(project: Project, t: number): EvaluatedScene {
  const cam = project.camera
  const position = [...evaluate(cam.position, t)] as Vec3
  const target = [...evaluate(cam.target, t)] as Vec3

  if (cam.shakeAmount > 0) {
    const s = t * cam.shakeSpeed * Math.PI * 2
    const dx = smoothNoise(s, 1.3) * cam.shakeAmount
    const dy = smoothNoise(s, 7.1) * cam.shakeAmount
    position[0] += dx
    position[1] += dy
    target[0] += dx * 0.3
    target[1] += dy * 0.3
  }

  const camera: EvaluatedCamera = {
    position,
    target,
    fov: evaluate(cam.fov, t),
    dof: cam.dofEnabled,
    focusDistance: evaluate(cam.focusDistance, t),
    aperture: evaluate(cam.aperture, t)
  }

  const layers = project.layers.map((layer, index): EvaluatedLayer => {
    const tr = layer.transform
    const pos = evaluate(tr.position, t)
    const sc = evaluate(tr.scale, t)
    const k = layer.autoScale ? autoScaleFactor(pos[2], project.comp) : 1
    return {
      layer,
      index,
      active: layer.visible && t >= layer.inPoint && t <= layer.outPoint,
      position: pos,
      rotation: evaluate(tr.rotation, t),
      scale: [sc[0] * k, sc[1] * k, sc[2]],
      opacity: Math.max(0, Math.min(1, evaluate(tr.opacity, t)))
    }
  })

  return { t, camera, layers }
}
