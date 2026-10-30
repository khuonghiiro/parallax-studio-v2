import { partTimelineCues, evaluatePartTimeline } from './workflowPartTimeline'
import { sampleMotionEffects } from '../animation/motionEffects'
import * as THREE from 'three'
import type { Layer, Project, Shot, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor, referenceDistance, smoothNoise } from '../animation/math'
import { composeDepthMatrix, depthToThree, layerNominalSize, threeToDepth, transformedBox } from './spatial'
import { evaluateCharacterLipSync } from '../project/lipSync'
import { evaluateLayerPhysicsTransform } from './layerPhysics'
import { evaluateVirtualLightAtTime } from './virtualLight'

export interface EvaluatedCamera {
  position: Vec3
  target: Vec3
  fov: number
  roll?: number
  dof: boolean
  focusDistance: number
  aperture: number
  /** 0 = clear, 1 = black. */
  fade: number
  /** Reference distance where a 1:1 layer fills the composition frame at default FOV. */
  refDistance?: number
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
  /** Độ tối bóng đêm khi đi vào vùng cửa hang động (0..1) */
  caveDarkness?: number
  /** Cường độ nguồn sáng ảo 2.5D chiếu lên layer (0..2) */
  lightIllumination?: number
  /** Màu ánh sáng ảo chiếu lên layer [r, g, b] */
  lightTintRgb?: [number, number, number]
  /** Màu bóng tối hang động [r, g, b] */
  shadowTintRgb?: [number, number, number]
  /** Đánh dấu layer đang phát sáng ảo 2.5D */
  vlightEnabled?: boolean
  /** Độ lệch tâm sáng UV trên layer (ví dụ ánh nến nghiêng theo gió) */
  vlightOffsetUV?: [number, number]
}

import { getWaypointTimingMeta } from '../ui/viewer/animateCamera/animateCameraActionModes'

export { parseDirectionAngle } from '../animation/proceduralMotion'

export interface EvaluatedScene {
  t: number
  camera: EvaluatedCamera
  shots: EvaluatedShot[]
  layers: EvaluatedLayer[]
}

function remapCameraSegmentTime(project: Project, t: number): number {
  const keys = project.camera.position.keyframes
  if (keys.length < 2 || t <= keys[0].t || t >= keys[keys.length - 1].t) return t

  let lo = 0
  let hi = keys.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keys[mid].t <= t) lo = mid
    else hi = mid
  }
  const k0 = keys[lo]
  const k1 = keys[hi]
  const span = k1.t - k0.t
  if (span <= 0.05) return t

  const meta0 = getWaypointTimingMeta(k0.t, span)
  const meta1 = getWaypointTimingMeta(k1.t, span)
  const activeMeta = meta0.hasCustomActionTiming
    ? meta0
    : meta1.hasCustomActionTiming
      ? meta1
      : meta0
  if (!activeMeta.hasCustomActionTiming) {
    return t
  }

  const elapsed = Math.max(0, t - k0.t)
  const delay = Math.min(Math.max(0, span - 0.05), activeMeta.delaySec)
  const actDur = Math.max(0.05, Math.min(span - delay, activeMeta.actionDurationSec))
  const uLinear = elapsed <= delay ? 0 : Math.max(0, Math.min(1, (elapsed - delay) / actDur))
  return k0.t + uLinear * span
}

export function evaluateCamera(project: Project, rawT: number): EvaluatedCamera {
  const t = Number.isFinite(rawT) ? rawT : 0
  const cam = project.camera
  const camT = remapCameraSegmentTime(project, t)
  const position = [...evaluate(cam.position, camT)] as Vec3
  const target = [...evaluate(cam.target, camT)] as Vec3
  let roll = cam.roll ? evaluate(cam.roll, camT) : 0

  if (cam.shakeAmount > 0) {
    const s = t * cam.shakeSpeed * Math.PI * 2
    const dx = smoothNoise(s, 1.3) * cam.shakeAmount
    const dy = smoothNoise(s, 7.1) * cam.shakeAmount
    position[0] += dx
    position[1] += dy
    target[0] += dx * 0.3
    target[1] += dy * 0.3
    roll += smoothNoise(s * 0.7, 3.7) * (cam.shakeAmount * 0.05)
  }

  return {
    position,
    target,
    fov: evaluate(cam.fov, camT),
    roll,
    dof: cam.dofEnabled,
    focusDistance: evaluate(cam.focusDistance, camT),
    aperture: evaluate(cam.aperture, camT),
    fade: Math.max(0, Math.min(1, cam.fade ? evaluate(cam.fade, t) : 0)),
    refDistance: referenceDistance(project.comp)
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
export function evaluateScene(project: Project, rawT: number): EvaluatedScene {
  const t = Number.isFinite(rawT) ? rawT : 0
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
  let refHalfW = comp.width / 2
  let refHalfH = comp.height / 2
  let refMinLocalZ = -25
  let refMaxLocalZ = 25

  const hasPortalOrLight = project.layers.some(
    (l) =>
      l.visible &&
      (Boolean(l.physics?.depthPortal?.enabled) ||
        Boolean(l.virtualLight?.enabled && l.virtualLight.kind !== 'none'))
  )

  const partCues = partTimelineCues(project)
  const layers = project.layers.map((sourceLayer, index): EvaluatedLayer => {
    const part = evaluatePartTimeline(sourceLayer, partCues, t)
    const layer = part.layer
    const tr = layer.transform
    const pos = [...evaluate(tr.position, t)] as Vec3
    const rot = [...evaluate(tr.rotation, t)] as Vec3
    const sc = [...evaluate(tr.scale, t)] as Vec3

    pos[0] += part.offset[0]
    pos[1] += part.offset[1]
    rot[2] += part.rotation
    sc[0] *= part.scale
    sc[1] *= part.scale

    const size = layerNominalSize(layer)
    const motion = sampleMotionEffects(layer, t, size)
    const uvOffset = motion.uvOffset
    for (let axis = 0; axis < 3; axis++) {
      pos[axis] += motion.position[axis]
      rot[axis] += motion.rotation[axis]
      sc[axis] *= motion.scale[axis]
    }

    // Đánh giá chuyển động miệng / Lip-sync từ audio giọng nói nhân vật theo thời gian thực
    const lipSync = evaluateCharacterLipSync(project, layer, t)
    if (lipSync.active) {
      sc[0] *= lipSync.scaleX
      sc[1] *= lipSync.scaleY
      pos[1] += lipSync.offsetY
    }

    let caveDarkness: number | undefined
    let lightIllumination: number | undefined
    let lightTintRgb: [number, number, number] | undefined
    let shadowTintRgb: [number, number, number] | undefined

    // Đánh giá Vật lý 2.5D, Trọng lực, Vùng Độ Sâu Hang Động & Nguồn sáng ảo
    const hasLayerPhys = Boolean(layer.physics?.enabled && layer.physics.material !== 'none')
    if (hasLayerPhys || hasPortalOrLight) {
      const phys = evaluateLayerPhysicsTransform(project, layer, t, size)
      pos[0] += phys.positionDelta[0]
      pos[1] += phys.positionDelta[1]
      pos[2] += phys.positionDelta[2]
      rot[0] += phys.rotationDelta[0]
      rot[1] += phys.rotationDelta[1]
      rot[2] += phys.rotationDelta[2]
      sc[0] *= phys.scaleMultiplier[0]
      sc[1] *= phys.scaleMultiplier[1]
      sc[2] *= phys.scaleMultiplier[2]
      caveDarkness = phys.caveDarkness
      lightIllumination = phys.lightIllumination
      lightTintRgb = phys.lightTintRgb
      shadowTintRgb = phys.shadowTintRgb
    }

    const k = layer.autoScale ? autoScaleFactor(pos[2], comp) : 1
    const scale: Vec3 = [sc[0] * k, sc[1] * k, sc[2]]
    const shot = layer.shotId ? (shotById.get(layer.shotId) ?? null) : null
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
      if (!layer.parentId) {
        const halfW = (size[0] * Math.abs(scale[0])) / 2
        const halfH = (size[1] * Math.abs(scale[1])) / 2
        refHalfW = Math.max(refHalfW, Math.abs(pos[0] - halfW), Math.abs(pos[0] + halfW))
        refHalfH = Math.max(refHalfH, Math.abs(pos[1] - halfH), Math.abs(pos[1] + halfH))
        const lz = -pos[2]
        refMinLocalZ = Math.min(refMinLocalZ, lz)
        refMaxLocalZ = Math.max(refMaxLocalZ, lz)
      }
    }
    if (layer.type === 'image' && layer.mesh?.skin) {
      bounds.expandByScalar(Math.max(size[0], size[1]) * 0.25 + 150)
    }

    let opacity = Math.max(0, Math.min(1, evaluate(tr.opacity, t)))
    if (layer.fadeIn && layer.fadeIn > 0 && t >= layer.inPoint && t < layer.inPoint + layer.fadeIn) {
      opacity *= (t - layer.inPoint) / layer.fadeIn
    }
    if (layer.fadeOut && layer.fadeOut > 0 && t > layer.outPoint - layer.fadeOut && t <= layer.outPoint) {
      opacity *= Math.max(0, (layer.outPoint - t) / layer.fadeOut)
    }

    let vlightEnabled: boolean | undefined
    let vlightOffsetUV: [number, number] | undefined
    if (layer.virtualLight?.enabled && layer.virtualLight.kind !== 'none') {
      const evLight = evaluateVirtualLightAtTime(layer, t, pos, size, sc)
      if (evLight) {
        vlightEnabled = true
        const refW = Math.max(32, Math.min(480, size[0] * Math.abs(sc[0])))
        const refH = Math.max(32, Math.min(480, size[1] * Math.abs(sc[1])))
        vlightOffsetUV = [evLight.windOffset[0] / refW, evLight.windOffset[1] / refH]
      }
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
      uvOffset,
      caveDarkness,
      lightIllumination,
      lightTintRgb,
      shadowTintRgb,
      vlightEnabled,
      vlightOffsetUV
    }
  })

  // Empty or sparse shots get a consistent stage box matching the project's reference shot volume.
  const refBox = new THREE.Box3()
  const refCorner = new THREE.Vector3()
  for (const s of shots) {
    if (s.layerCount === 0 || shots.length > 1) {
      refBox.makeEmpty()
      for (const x of [-refHalfW, refHalfW]) {
        for (const y of [-refHalfH, refHalfH]) {
          for (const z of [refMinLocalZ, refMaxLocalZ]) {
            refBox.expandByPoint(refCorner.set(x, y, z).applyMatrix4(s.matrix))
          }
        }
      }
      s.bounds.union(refBox)
    }
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

