import * as THREE from 'three'
import type { Layer, Project, Shot, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor, referenceDistance, smoothNoise } from '../animation/math'
import { composeDepthMatrix, layerNominalSize, threeToDepth, transformedBox } from './spatial'

export interface EvaluatedCamera {
  position: Vec3
  target: Vec3
  fov: number
  dof: boolean
  focusDistance: number
  aperture: number
  /** 0 = clear, 1 = black. */
  fade: number
}

export interface EvaluatedShot {
  shot: Shot
  index: number
  position: Vec3
  rotation: Vec3
  /** Shot → world (three.js space, no scale). */
  matrix: THREE.Matrix4
  /** World AABB (three.js space) of the shot's layers; a default frame box when empty. */
  bounds: THREE.Box3
  layerCount: number
}

export interface EvaluatedLayer {
  layer: Layer
  /** Stack index (0 = top). */
  index: number
  active: boolean
  /** LOCAL position (relative to the shot, depth space). */
  position: Vec3
  rotation: Vec3
  /** Final scale including auto-scale-with-depth. */
  scale: Vec3
  opacity: number
  shot: EvaluatedShot | null
  /** Layer → world (three.js space, includes scale). Plane geometry is size[0] × size[1]. */
  world: THREE.Matrix4
  /** World position (depth space). */
  worldPosition: Vec3
  /** Nominal plane size (world units, before scale). */
  size: [number, number]
  /** World AABB (three.js space). */
  bounds: THREE.Box3
}

export interface EvaluatedScene {
  t: number
  camera: EvaluatedCamera
  shots: EvaluatedShot[]
  layers: EvaluatedLayer[]
}

export function evaluateCamera(project: Project, t: number): EvaluatedCamera {
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

  return {
    position,
    target,
    fov: evaluate(cam.fov, t),
    dof: cam.dofEnabled,
    focusDistance: evaluate(cam.focusDistance, t),
    aperture: evaluate(cam.aperture, t),
    fade: Math.max(0, Math.min(1, cam.fade ? evaluate(cam.fade, t) : 0))
  }
}

/** Shot → world matrix at time t (three.js space). */
export function shotMatrix(shot: Shot, t: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  return composeDepthMatrix(evaluate(shot.position, t), evaluate(shot.rotation, t), [1, 1, 1], out)
}

/** Function mapping shot-local depth coordinates to world depth coordinates (identity for null). */
export function shotLocalToWorld(shot: Shot | null | undefined, t: number): (p: Vec3) => Vec3 {
  if (!shot) return (p) => [...p] as Vec3
  const m = shotMatrix(shot, t)
  const v = new THREE.Vector3()
  return (p) => threeToDepth(v.set(p[0], p[1], -p[2]).applyMatrix4(m))
}

/** Evaluate the entire scene at time t. Pure: same input → same output. */
export function evaluateScene(project: Project, t: number): EvaluatedScene {
  const camera = evaluateCamera(project, t)
  const { comp } = project

  const shots: EvaluatedShot[] = project.shots.map((shot, index) => ({
    shot,
    index,
    position: evaluate(shot.position, t),
    rotation: evaluate(shot.rotation, t),
    matrix: shotMatrix(shot, t),
    bounds: new THREE.Box3(),
    layerCount: 0
  }))
  const shotById = new Map(shots.map((s) => [s.shot.id, s]))

  const local = new THREE.Matrix4()
  const layers = project.layers.map((layer, index): EvaluatedLayer => {
    const tr = layer.transform
    const pos = evaluate(tr.position, t)
    const rot = evaluate(tr.rotation, t)
    const sc = evaluate(tr.scale, t)
    const k = layer.autoScale ? autoScaleFactor(pos[2], comp) : 1
    const scale: Vec3 = [sc[0] * k, sc[1] * k, sc[2]]
    const shot = layer.shotId ? (shotById.get(layer.shotId) ?? null) : null

    composeDepthMatrix(pos, rot, scale, local)
    const world = shot ? new THREE.Matrix4().multiplyMatrices(shot.matrix, local) : local.clone()
    const size = layerNominalSize(layer)
    const depth = layer.type === 'particles' ? layer.props.area[2] : 1
    const bounds = transformedBox(size[0], size[1], depth, world)
    if (shot) {
      shot.bounds.union(bounds)
      shot.layerCount++
    }

    return {
      layer,
      index,
      active: layer.visible && (shot ? shot.shot.visible : true) && t >= layer.inPoint && t <= layer.outPoint,
      position: pos,
      rotation: rot,
      scale,
      opacity: Math.max(0, Math.min(1, evaluate(tr.opacity, t))),
      shot,
      world,
      worldPosition: threeToDepth(new THREE.Vector3().setFromMatrixPosition(world)),
      size,
      bounds
    }
  })

  // Empty shots still get a visible frame-sized box so they can be seen and picked.
  for (const s of shots) {
    if (s.layerCount === 0) transformedBox(comp.width, comp.height, 50, s.matrix, s.bounds)
  }

  return { t, camera, shots, layers }
}

/** The camera pose that frames a shot like the default v1 camera frames the world. */
export function shotFramingPose(project: Project, shot: Shot, t: number, push = 0): { position: Vec3; target: Vec3 } {
  const m = shotMatrix(shot, t)
  const d = referenceDistance(project.comp) * (1 - push)
  const p = new THREE.Vector3(0, 0, d).applyMatrix4(m) // local depth -d == three +d
  const tg = new THREE.Vector3(0, 0, 0).applyMatrix4(m)
  return { position: threeToDepth(p), target: threeToDepth(tg) }
}
