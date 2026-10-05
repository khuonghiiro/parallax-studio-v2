import * as THREE from 'three'
import type { Layer, Project, Shot, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor, referenceDistance, smoothNoise } from '../animation/math'
import { composeDepthMatrix, depthToThree, layerNominalSize, threeToDepth, transformedBox } from './spatial'

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
  /** Optional texture UV offset for seamless looping drift. */
  uvOffset?: [number, number]
}

/** Parses named direction presets or degrees (0-360) into degrees. 0 = right, 90 = up. */
export function parseDirectionAngle(dir?: number | string): number {
  if (typeof dir === 'number' && !Number.isNaN(dir)) return ((dir % 360) + 360) % 360
  switch (dir) {
    case 'right':
      return 0
    case 'up-right':
      return 45
    case 'up':
      return 90
    case 'up-left':
      return 135
    case 'left':
      return 180
    case 'down-left':
      return 225
    case 'down':
      return 270
    case 'down-right':
      return 315
    default:
      return 0
  }
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
  const camPos = depthToThree(camera.position)
  const worldById = new Map<string, THREE.Matrix4>()
  const _tempPos = new THREE.Vector3()
  const _tempQuat = new THREE.Quaternion()
  const _tempScale = new THREE.Vector3()
  const _tempRot = new THREE.Matrix4()
  const _upY = new THREE.Vector3(0, 1, 0)

  const layers = project.layers.map((layer, index): EvaluatedLayer => {
    const tr = layer.transform
    const pos = [...evaluate(tr.position, t)] as Vec3
    const rot = [...evaluate(tr.rotation, t)] as Vec3
    const sc = [...evaluate(tr.scale, t)] as Vec3

    let uvOffset: [number, number] | undefined = undefined

    if (layer.motion && layer.motion.type && layer.motion.type !== 'none') {
      const m = layer.motion
      const sp = m.speed ?? (m.type === 'drift' ? 40 : 0.6)
      const ph = m.phase ?? 0
      const amp = m.amplitude ?? (m.type === 'drift' ? [1500, 10, 0] : m.type === 'float' ? [4, 15, 0] : [8, 2, 1.2])
      if (m.type === 'drift') {
        const dirDeg = parseDirectionAngle(m.direction)
        const rad = (dirDeg * Math.PI) / 180
        const dx = Math.cos(rad)
        const dy = Math.sin(rad)
        const mode = m.loopMode ?? 'uv'
        const loopW = m.loopWidth ?? (amp[0] ? Math.abs(amp[0]) * 2 : 3000)

        if (mode === 'uv' || mode === 'wrap') {
          // Seamless toroidal pixel wrap (cửa ra nối cửa vào / After Effects Offset effect)
          // Pixels drift towards one edge and seamlessly re-enter from the opposite edge,
          // creating an infinite running loop without moving or jumping the layer plane.
          const size = layerNominalSize(layer)
          const w = size[0] || comp.width
          const h = size[1] || comp.height
          const dist = t * sp + ph
          uvOffset = [(-dist * dx) / w, (-dist * dy) / h]
          if (amp[1]) {
            // Optional gentle undulating wave perpendicular to drift
            const sway = Math.sin(t * 0.8 + ph) * amp[1]
            pos[0] += sway * -dy
            pos[1] += sway * dx
          }
        } else if (mode === 'ping-pong') {
          // Smooth back-and-forth oscillation along the directional vector
          const halfSpan = loopW > 0 ? loopW / 2 : 1500
          const angle = (t * sp * Math.PI) / halfSpan + ph
          const d = Math.sin(angle) * halfSpan
          pos[0] += d * dx
          pos[1] += d * dy
          if (amp[1]) {
            const sway = Math.cos(angle * 0.7) * amp[1]
            pos[0] += sway * -dy
            pos[1] += sway * dx
          }
        } else {
          // Continuous monotonic drift along vector without reset
          const dist = t * sp + ph
          pos[0] += dist * dx
          pos[1] += dist * dy
          if (amp[1]) {
            const sway = Math.sin(t * 0.8 + ph) * amp[1]
            pos[0] += sway * -dy
            pos[1] += sway * dx
          }
        }
      } else if (m.type === 'wind' || m.type === 'sway') {
        const angle = t * sp * Math.PI * 2 + ph
        pos[0] += Math.sin(angle) * amp[0]
        pos[1] += Math.cos(angle * 0.7) * amp[1]
        rot[2] += Math.sin(angle) * (amp[2] || 0)
      } else if (m.type === 'float') {
        const angle = t * sp * Math.PI * 2 + ph
        pos[0] += Math.cos(angle * 0.5) * amp[0]
        pos[1] += Math.sin(angle) * amp[1]
      } else if (m.type === 'wiggle') {
        const freq = sp || 1
        const amp0 = amp[0] ?? 20
        const amp1 = amp[1] ?? 20
        const amp2 = amp[2] ?? 0
        const s = t * freq * Math.PI * 2 + ph
        pos[0] += smoothNoise(s, 2.1) * amp0
        pos[1] += smoothNoise(s, 5.7) * amp1
        if (amp2) rot[2] += smoothNoise(s, 8.3) * amp2
      } else if (m.type === 'pulse') {
        const p = Math.sin(t * sp * Math.PI * 2 + ph)
        sc[0] *= 1 + p * (amp[0] || 0.05)
        sc[1] *= 1 + p * (amp[1] || 0.05)
      }
    }

    const k = layer.autoScale ? autoScaleFactor(pos[2], comp) : 1
    const scale: Vec3 = [sc[0] * k, sc[1] * k, sc[2]]
    const shot = layer.shotId ? (shotById.get(layer.shotId) ?? null) : null
    const size = layerNominalSize(layer)
    const anchorVal = tr.anchor ? evaluate(tr.anchor, t) : [0, 0, 0]
    const anchor: Vec3 = [anchorVal[0] ?? 0, anchorVal[1] ?? 0, anchorVal[2] ?? 0]

    composeDepthMatrix(pos, rot, scale, local, anchor, size)

    let world: THREE.Matrix4
    if (layer.parentId && worldById.has(layer.parentId)) {
      world = new THREE.Matrix4().multiplyMatrices(worldById.get(layer.parentId)!, local)
    } else {
      world = shot ? new THREE.Matrix4().multiplyMatrices(shot.matrix, local) : local.clone()
    }

    if (layer.autoOrient && layer.autoOrient !== 'none') {
      const layerPos = _tempPos.setFromMatrixPosition(world)
      const lookTarget = layer.autoOrient === 'camera-y'
        ? new THREE.Vector3(camPos.x, layerPos.y, camPos.z)
        : camPos
      if (layerPos.distanceToSquared(lookTarget) > 1e-4) {
        _tempRot.lookAt(layerPos, lookTarget, _upY)
        world.decompose(_tempPos, _tempQuat, _tempScale)
        _tempQuat.setFromRotationMatrix(_tempRot)
        world.compose(_tempPos, _tempQuat, _tempScale)
      }
    }
    worldById.set(layer.id, world)

    const depth = layer.type === 'particles' ? layer.props.area[2] : 1
    const bounds = transformedBox(size[0], size[1], depth, world)
    if (shot) {
      shot.bounds.union(bounds)
      shot.layerCount++
    }

    let opacity = Math.max(0, Math.min(1, evaluate(tr.opacity, t)))
    if (layer.fadeIn && layer.fadeIn > 0 && t >= layer.inPoint && t < layer.inPoint + layer.fadeIn) {
      opacity *= (t - layer.inPoint) / layer.fadeIn
    }
    if (layer.fadeOut && layer.fadeOut > 0 && t > layer.outPoint - layer.fadeOut && t <= layer.outPoint) {
      opacity *= Math.max(0, (layer.outPoint - t) / layer.fadeOut)
    }

    return {
      layer,
      index,
      active: layer.visible && (shot ? shot.shot.visible : true) && t >= layer.inPoint && t <= layer.outPoint,
      position: pos,
      rotation: rot,
      scale,
      opacity,
      shot,
      world,
      worldPosition: threeToDepth(new THREE.Vector3().setFromMatrixPosition(world)),
      size,
      bounds,
      uvOffset
    }
  })

  // Empty shots still get a visible frame-sized box so they can be seen and picked.
  for (const s of shots) {
    if (s.layerCount === 0) transformedBox(comp.width, comp.height, 50, s.matrix, s.bounds)
  }

  return { t, camera, shots, layers }
}

export type CameraAnglePreset =
  | 'front'
  | 'left30'
  | 'right30'
  | 'left45'
  | 'right45'
  | 'high'
  | 'low'
  | 'top'

/** The camera pose with specified angle preset and offsets relative to a shot. */
export function shotAngledPose(
  project: Project,
  shot: Shot,
  t: number,
  anglePreset: CameraAnglePreset = 'front',
  push = 0,
  yawOffset = 0,
  pitchOffset = 0,
  targetOffset?: Vec3
): { position: Vec3; target: Vec3 } {
  let baseYaw = 0
  let basePitch = 0
  switch (anglePreset) {
    case 'left30':
      baseYaw = -30
      break
    case 'right30':
      baseYaw = 30
      break
    case 'left45':
      baseYaw = -45
      break
    case 'right45':
      baseYaw = 45
      break
    case 'high':
      basePitch = 22
      break
    case 'low':
      basePitch = -15
      break
    case 'top':
      basePitch = 75
      break
    default:
      break
  }

  const yaw = (baseYaw + yawOffset) * (Math.PI / 180)
  const pitch = Math.max(-85, Math.min(85, basePitch + pitchOffset)) * (Math.PI / 180)

  const m = shotMatrix(shot, t)
  const d = referenceDistance(project.comp) * (1 - push)

  // Local camera position in Three.js space orbiting around local origin (or targetOffset)
  const toX = targetOffset ? targetOffset[0] : 0
  const toY = targetOffset ? targetOffset[1] : 0
  const toZ = targetOffset ? -targetOffset[2] : 0

  const lx = toX + d * Math.cos(pitch) * Math.sin(yaw)
  const ly = toY + d * Math.sin(pitch)
  const lz = toZ + d * Math.cos(pitch) * Math.cos(yaw)

  const p = new THREE.Vector3(lx, ly, lz).applyMatrix4(m)
  const tg = new THREE.Vector3(toX, toY, toZ).applyMatrix4(m)

  return { position: threeToDepth(p), target: threeToDepth(tg) }
}

/** The camera pose that frames a shot like the default v1 camera frames the world. */
export function shotFramingPose(project: Project, shot: Shot, t: number, push = 0): { position: Vec3; target: Vec3 } {
  return shotAngledPose(project, shot, t, 'front', push)
}

