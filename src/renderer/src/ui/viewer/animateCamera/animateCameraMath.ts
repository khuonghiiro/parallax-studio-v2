import type { EaseName, Layer, Project, Vec3, VirtualLightKind } from '@shared/types'
import { ease } from '../../../animation/easing'
import { addKeyframe, anim, evaluate, setValueAt } from '../../../animation/keyframes'
import { referenceDistance, smoothNoise } from '../../../animation/math'
import { type EvaluatedScene } from '../../../engine/evaluateScene'
import { evaluateLayerGlow } from '../../../engine/layerGlow'
import { collectEvaluatedVirtualLights, evaluateVirtualLightAtTime } from '../../../engine/virtualLight'
import { frameTolerance } from '../../../store/editor'
import { getWaypointTimingMeta } from './animateCameraActionModes'

export interface ShotStageBox {
  shotId: string | null
  name: string
  color: string
  index: number
  visible: boolean
  worldOrigin: Vec3
  stageX: number
  stageY: number
  width: number
  height: number
}

export interface ProjectedLayer2D {
  id: string
  name: string
  type: Layer['type']
  offsetX: number
  offsetY: number
  width: number
  height: number
  rotation: number
  opacity: number
  zDepth: number
  assetId?: string
  text?: string
  textColor?: string
  font?: string
  fontSize?: number
  fontWeight?: number
  align?: 'left' | 'center' | 'right'
  solidColor?: string
  solidColor2?: string
  gradientAngle?: number
  vlight?: {
    kind: VirtualLightKind
    color: string
    intensity: number
    radiusRatio: number
    originU: number
    originV: number
    coneAngleDeg: number
    beamAngleDeg: number
    isReceived?: boolean
  }
  portal?: {
    centerU: number
    centerV: number
    rxU: number
    ryV: number
    darkness: number
    shadowTint: string
  }
  caveDarkness?: number
  shadowTintRgb?: [number, number, number]
  lightBoost?: number
  lightTintRgb?: [number, number, number]
  glow?: {
    color: string
    intensity: number
    thickness: number
  }
  fogAmount?: number
  fogColor?: string
}

export function getLook2DCssFilter(look?: Project['look']): string | undefined {
  if (!look) return undefined
  const parts: string[] = []
  const exp = look.exposure ?? 0
  if (Math.abs(exp) > 0.01) {
    parts.push(`brightness(${Math.pow(2, exp).toFixed(3)})`)
  }
  const con = look.contrast ?? 1
  if (Math.abs(con - 1) > 0.01) {
    parts.push(`contrast(${con.toFixed(3)})`)
  }
  const sat = look.saturation ?? 1
  if (Math.abs(sat - 1) > 0.01) {
    parts.push(`saturate(${sat.toFixed(3)})`)
  }
  return parts.length > 0 ? parts.join(' ') : undefined
}

export function getLayer2DFilterStyle(layer: ProjectedLayer2D, scalePx = 1): string | undefined {
  const filters: string[] = []
  let brightness = 1
  if (layer.caveDarkness && layer.caveDarkness > 0.01) {
    brightness *= Math.max(0.08, 1 - layer.caveDarkness * 0.85)
  }
  if (layer.lightBoost && layer.lightBoost > 0.01) {
    brightness *= 1 + Math.min(0.45, layer.lightBoost * 0.25)
  }
  if (layer.vlight && !layer.vlight.isReceived && layer.vlight.intensity > 0.01) {
    brightness *= 1 + Math.min(0.42, layer.vlight.intensity * 0.24)
  }
  if (Math.abs(brightness - 1) > 0.02) {
    filters.push(`brightness(${brightness.toFixed(2)})`)
  }
  if (layer.vlight && !layer.vlight.isReceived && layer.vlight.intensity > 0.02) {
    const r = Math.max(2, Math.min(14, Math.round(7 * scalePx * Math.min(1.5, layer.vlight.intensity))))
    filters.push(`drop-shadow(0 0 ${r}px ${layer.vlight.color})`)
  }
  if (layer.glow && layer.glow.intensity > 0.05) {
    const r = Math.max(2, Math.min(20, Math.round(layer.glow.thickness * scalePx)))
    filters.push(`drop-shadow(0 0 ${r}px ${layer.glow.color})`)
  }
  if (layer.fogAmount && layer.fogAmount > 0.03) {
    const fogCon = Math.max(0.72, 1 - layer.fogAmount * 0.26)
    const fogSat = Math.max(0.7, 1 - layer.fogAmount * 0.28)
    filters.push(`contrast(${fogCon.toFixed(2)}) saturate(${fogSat.toFixed(2)})`)
  }
  return filters.length > 0 ? filters.join(' ') : undefined
}

export interface CameraFrame2D {
  /** 0-based index in timeline order */
  index: number
  /** Time in seconds */
  time: number
  /** True if backed by an explicit keyframe on project.camera.position */
  isKeyframed: boolean
  ease: EaseName
  shotId: string | null
  shotName: string
  shotColor: string
  /** Center X on the 2D Stage plane */
  stageX: number
  /** Center Y on the 2D Stage plane */
  stageY: number
  /** Frame scale relative to comp size: < 1 = Zoom In (frame smaller), > 1 = Zoom Out (frame larger) */
  scale: number
  width: number
  height: number
  /** 3D Horizontal Orbit angle around target in degrees (-80..80, 0 = straight front) */
  yaw: number
  /** 3D Vertical Pitch/Tilt angle around target in degrees (-75..75, 0 = level) */
  pitch: number
  /** 2D/3D Camera Roll / Dutch angle in degrees (-180..180, 0 = level) */
  roll: number
  position3D: Vec3
  target3D: Vec3
}

export interface StageFramePoseOptions {
  yaw?: number
  pitch?: number
  roll?: number
  ease?: EaseName
}

const MIN_FRAME_SCALE = 0.05
const MAX_FRAME_SCALE = 3.0
const DEG = 180 / Math.PI
const RAD = Math.PI / 180

export function clampFrameScale(scale: number): number {
  return Math.max(MIN_FRAME_SCALE, Math.min(MAX_FRAME_SCALE, scale))
}

export function clampCameraAngle(val: number, min = -75, max = 75): number {
  return Math.max(min, Math.min(max, Math.round(val * 10) / 10))
}

/**
 * Maps all 3D Shots in the project onto a clean, non-overlapping 2D Stage plane.
 * If the project has no shots yet, returns a single virtual stage box for the global scene.
 */
export function computeShotStageLayout(project: Project, time = 0): ShotStageBox[] {
  const { comp, shots } = project
  const W = comp.width
  const H = comp.height

  if (shots.length === 0) {
    return [
      {
        shotId: null,
        name: comp.name || 'Cảnh chính',
        color: '#38bdf8',
        index: 0,
        visible: true,
        worldOrigin: [0, 0, 0],
        stageX: 0,
        stageY: 0,
        width: W,
        height: H
      }
    ]
  }

  const spacing3DX = Math.max(1, W * 5.5)
  const spacing3DY = Math.max(1, H * 5.5)
  const stepStageX = Math.max(1, Math.round(W * 1.28))
  const stepStageY = Math.max(1, Math.round(H * 1.32))

  const placed: ShotStageBox[] = []

  shots.forEach((s, idx) => {
    const pos3d = [...evaluate(s.position, time)] as Vec3
    let sx = Math.round((pos3d[0] / spacing3DX) * stepStageX) || 0
    const sy = Math.round((-pos3d[1] / spacing3DY) * stepStageY) || 0

    // Auto-offset along X only when shots are separated along the Z depth axis (|dz| > 50) with overlapping X/Y
    let guard = 0
    while (
      guard < 32 &&
      placed.some(
        (p) =>
          Math.abs(pos3d[2] - p.worldOrigin[2]) > 50 &&
          Math.abs(sx - p.stageX) < W * 1.08 &&
          Math.abs(sy - p.stageY) < H * 1.08
      )
    ) {
      sx += stepStageX
      guard++
    }

    placed.push({
      shotId: s.id,
      name: s.name,
      color: s.color,
      index: idx,
      visible: s.visible,
      worldOrigin: pos3d,
      stageX: sx,
      stageY: sy,
      width: W,
      height: H
    })
  })

  return placed
}

/**
 * Converts a 2D Stage drag delta (deltaStageX, deltaStageY) into the exact 3D world space delta
 * (delta3DX, delta3DY) so dragging a Shot on the 2D Stage moves the 3D Shot synchronously 1:1.
 */
export function stageDeltaTo3DDelta(
  compWidth: number,
  compHeight: number,
  deltaStageX: number,
  deltaStageY: number
): [number, number] {
  const spacing3DX = Math.max(1, compWidth * 5.5)
  const spacing3DY = Math.max(1, compHeight * 5.5)
  const stepStageX = Math.max(1, Math.round(compWidth * 1.28))
  const stepStageY = Math.max(1, Math.round(compHeight * 1.32))
  return [
    Math.round((deltaStageX / stepStageX) * spacing3DX) || 0,
    Math.round((-deltaStageY / stepStageY) * spacing3DY) || 0
  ]
}

/**
 * Projects a Shot's stacked 3D layers onto its 2D Stage plane in painter's order
 * (farthest Z background first, nearest Z foreground last) so each shot displays
 * as a complete 2D scene representation of its 3D layer stack.
 */
export function projectShotLayers2D(
  project: Project,
  ev: EvaluatedScene,
  shotId: string | null,
  includeGlobals = false,
  cameraAngles?: { yaw?: number; pitch?: number }
): ProjectedLayer2D[] {
  const refD = Math.max(100, referenceDistance(project.comp))
  const yawRad = clampCameraAngle(cameraAngles?.yaw ?? 0, -85, 85) * RAD
  const pitchRad = clampCameraAngle(cameraAngles?.pitch ?? 0, -75, 75) * RAD
  const matching = ev.layers.filter((el) => {
    if (!el.layer.visible || el.opacity <= 0.01) return false
    if (el.layer.shotId === shotId) return true
    if (includeGlobals && el.layer.shotId === null && el.layer.type !== 'particles') return true
    return false
  })

  // Sort back-to-front: largest local Z (farthest) first; ties broken by stack index (bottom first)
  matching.sort((a, b) => {
    const dz = b.position[2] - a.position[2]
    if (Math.abs(dz) > 0.5) return dz
    return b.index - a.index
  })

  const shotLights = collectEvaluatedVirtualLights(ev.layers, shotId, ev.t)

  return matching.map((el): ProjectedLayer2D => {
    const lz = el.position[2]
    const pFactor = refD / Math.max(80, refD + lz)
    const width = Math.max(4, el.size[0] * el.scale[0] * pFactor)
    const height = Math.max(4, el.size[1] * el.scale[1] * pFactor)
    // Apply 2.5D parallax depth shift when 3D camera Yaw / Pitch is non-zero
    const parallaxDx = -Math.tan(yawRad) * lz * 0.35
    const parallaxDy = Math.tan(pitchRad) * lz * 0.35
    const offsetX = (el.position[0] + parallaxDx) * pFactor
    const offsetY = -(el.position[1] + parallaxDy) * pFactor
    const rotation = -el.rotation[2]

    const base: ProjectedLayer2D = {
      id: el.layer.id,
      name: el.layer.name,
      type: el.layer.type,
      offsetX,
      offsetY,
      width,
      height,
      rotation,
      opacity: el.opacity,
      zDepth: lz
    }

    if (el.layer.type === 'image') {
      base.assetId = el.layer.props.assetId
    } else if (el.layer.type === 'text') {
      base.text = el.layer.props.text
      base.textColor = el.layer.props.color
      base.font = el.layer.props.fontFamily
      base.fontSize = el.layer.props.fontSize * el.scale[1] * pFactor
      base.fontWeight = el.layer.props.fontWeight
    } else if (el.layer.type === 'solid') {
      base.solidColor = el.layer.props.color
      base.solidColor2 = el.layer.props.color2
    }

    const worldW = Math.max(32, el.size[0] * Math.abs(el.scale[0]))
    const worldH = Math.max(32, el.size[1] * Math.abs(el.scale[1]))
    const evVLight = evaluateVirtualLightAtTime(el.layer, ev.t, el.position, el.size, el.scale)
    if (evVLight && evVLight.effectiveIntensity > 0.01) {
      const origU = el.layer.virtualLight?.originUV?.[0] ?? 0.5
      const origV = el.layer.virtualLight?.originUV?.[1] ?? 0.5
      const shiftU = evVLight.windOffset[0] / worldW
      const shiftV = evVLight.windOffset[1] / worldH
      const beamDeg = (Math.atan2(evVLight.beamDir[1], evVLight.beamDir[0]) * 180) / Math.PI
      const coneDeg =
        evVLight.coneCos <= -0.98
          ? 360
          : Math.round(((Math.acos(Math.max(-1, Math.min(1, evVLight.coneCos))) * 180) / Math.PI) * 2)
      base.vlight = {
        kind: evVLight.kind,
        color: evVLight.color,
        intensity: evVLight.effectiveIntensity,
        radiusRatio: Math.max(0.25, Math.min(2.2, evVLight.effectiveRadius / Math.max(48, Math.max(worldW, worldH)))),
        originU: Math.max(0.05, Math.min(0.95, origU + shiftU)),
        originV: Math.max(0.05, Math.min(0.95, origV + shiftV)),
        coneAngleDeg: coneDeg,
        beamAngleDeg: beamDeg,
        isReceived: false
      }
    } else if (shotLights.length > 0) {
      let bestLight: (typeof shotLights)[number] | null = null
      let bestScore = 0
      for (const sl of shotLights) {
        if (sl.sourceLayerId === el.layer.id) continue
        const dz = Math.abs(el.position[2] - sl.position[2])
        if (dz > sl.zReach) continue
        const zAtten = 1 - Math.pow(dz / Math.max(1, sl.zReach), 1.6)
        const score = sl.effectiveIntensity * zAtten
        if (score > bestScore) {
          bestScore = score
          bestLight = sl
        }
      }
      if (bestLight && bestScore > 0.04) {
        const perspRatio = Math.max(80, refD + el.position[2]) / Math.max(80, refD + bestLight.position[2])
        const projLightX = bestLight.position[0] * perspRatio
        const projLightY = bestLight.position[1] * perspRatio
        const projRadius = bestLight.effectiveRadius * perspRatio
        const relU = 0.5 + (projLightX - el.position[0]) / worldW
        const relV = 0.5 + (projLightY - el.position[1]) / worldH
        if (relU > -0.8 && relU < 1.8 && relV > -0.8 && relV < 1.8) {
          const beamDeg = (Math.atan2(bestLight.beamDir[1], bestLight.beamDir[0]) * 180) / Math.PI
          const coneDeg =
            bestLight.coneCos <= -0.98
              ? 360
              : Math.round(((Math.acos(Math.max(-1, Math.min(1, bestLight.coneCos))) * 180) / Math.PI) * 2)
          base.vlight = {
            kind: bestLight.kind,
            color: bestLight.color,
            intensity: bestScore * 0.85,
            radiusRatio: Math.max(0.25, Math.min(2.2, projRadius / Math.max(64, Math.max(worldW, worldH)))),
            originU: relU,
            originV: relV,
            coneAngleDeg: coneDeg,
            beamAngleDeg: beamDeg,
            isReceived: true
          }
        }
      }
    }

    const portal = el.layer.physics?.depthPortal
    if (portal?.enabled && (portal.darkness ?? 0) > 0.02) {
      const rxU = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)
      const ryV = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)
      base.portal = {
        centerU: portal.centerUV?.[0] ?? 0.5,
        centerV: portal.centerUV?.[1] ?? 0.45,
        rxU,
        ryV,
        darkness: portal.darkness ?? 0.82,
        shadowTint: portal.shadowTint ?? '#060812'
      }
    }

    if (el.caveDarkness && el.caveDarkness > 0.01) {
      base.caveDarkness = el.caveDarkness
      base.shadowTintRgb = el.shadowTintRgb
    }
    if (el.lightIllumination && el.lightIllumination > 0.01) {
      base.lightBoost = el.lightIllumination
      base.lightTintRgb = el.lightTintRgb
    }

    const activeGlow = evaluateLayerGlow(el.layer, ev.t)
    if (activeGlow && activeGlow.intensity > 0.05) {
      base.glow = {
        color: activeGlow.color,
        intensity: activeGlow.intensity,
        thickness: activeGlow.thickness
      }
    }

    if (project.look?.fogEnabled) {
      const fNear = project.look.fogNear ?? 1200
      const fFar = Math.max(fNear + 1, project.look.fogFar ?? 5200)
      const vDepth = Math.max(80, refD + lz)
      const t = Math.max(0, Math.min(1, (vDepth - fNear) / (fFar - fNear)))
      const smoothFog = t * t * (3 - 2 * t)
      if (smoothFog > 0.015) {
        base.fogAmount = Number(smoothFog.toFixed(3))
        base.fogColor = project.look.fogColor || '#161936'
      }
    }

    return base
  })
}

export function findNearestShotBy3D(layout: ShotStageBox[], target3D: Vec3): ShotStageBox {
  let best = layout[0]
  let bestDist = Infinity
  for (const box of layout) {
    const d = Math.hypot(
      target3D[0] - box.worldOrigin[0],
      target3D[1] - box.worldOrigin[1],
      target3D[2] - box.worldOrigin[2]
    )
    if (d < bestDist) {
      bestDist = d
      best = box
    }
  }
  return best
}

export function findNearestShotByStage2D(layout: ShotStageBox[], stageX: number, stageY: number): ShotStageBox {
  let best = layout[0]
  let bestDist = Infinity
  for (const box of layout) {
    const d = Math.hypot(stageX - box.stageX, stageY - box.stageY)
    if (d < bestDist) {
      bestDist = d
      best = box
    }
  }
  return best
}

/**
 * Maps a 3D world coordinate continuously onto the 2D Stage plane:
 * - Inside a shot's local framing zone (|dx| <= W*0.5, |dy| <= H*0.5), preserves 1:1 pixel accuracy.
 * - Across the inter-shot 3D gap between two shots, interpolates monotonically across the 2D stage gap
 *   so camera motion between shots never overshoots or loops back.
 */
function map3DTargetToStageXY(
  project: Project,
  layout: ShotStageBox[],
  target3D: Vec3,
  primaryBox: ShotStageBox
): { stageX: number; stageY: number } {
  const W = project.comp.width
  const H = project.comp.height
  const localDx = target3D[0] - primaryBox.worldOrigin[0]
  const localDy = target3D[1] - primaryBox.worldOrigin[1]

  if (
    layout.length <= 1 ||
    (Math.abs(localDx) <= W * 0.8 && Math.abs(localDy) <= H * 0.8)
  ) {
    return {
      stageX: Math.round(primaryBox.stageX + localDx),
      stageY: Math.round(primaryBox.stageY - localDy)
    }
  }

  // Interpolate X across shots in the same horizontal band so multi-row shots never cross-contaminate
  const rowShots = layout
    .filter((b) => Math.abs(b.worldOrigin[1] - primaryBox.worldOrigin[1]) <= H * 2.5)
    .sort((a, b) => a.worldOrigin[0] - b.worldOrigin[0])

  let mappedX = Math.round(primaryBox.stageX + localDx)
  if (rowShots.length >= 2) {
    for (let i = 0; i < rowShots.length - 1; i++) {
      const a = rowShots[i]
      const b = rowShots[i + 1]
      const span3DX = b.worldOrigin[0] - a.worldOrigin[0]
      if (span3DX > W && target3D[0] >= a.worldOrigin[0] && target3D[0] <= b.worldOrigin[0]) {
        const u = (target3D[0] - a.worldOrigin[0]) / span3DX
        mappedX = Math.round(a.stageX + (b.stageX - a.stageX) * u)
        break
      }
    }
  }

  return {
    stageX: mappedX,
    stageY: Math.round(primaryBox.stageY - localDy)
  }
}

export function pose3DToStageFrame(
  project: Project,
  layout: ShotStageBox[],
  position3D: Vec3,
  target3D: Vec3,
  rollDeg = 0
): {
  shotBox: ShotStageBox
  stageX: number
  stageY: number
  scale: number
  width: number
  height: number
  yaw: number
  pitch: number
  roll: number
} {
  const refD = Math.max(100, referenceDistance(project.comp))
  const shotBox = findNearestShotBy3D(layout, target3D)

  // Vector from target to camera in Three.js space (where camera in front of shot has vz > 0)
  const vx = position3D[0] - target3D[0]
  const vy = position3D[1] - target3D[1]
  const vz = target3D[2] - position3D[2]
  const dist = Math.max(20, Math.hypot(vx, vy, vz))

  const pitch = clampCameraAngle(Math.asin(Math.max(-1, Math.min(1, vy / dist))) * DEG, -75, 75)
  const yaw = clampCameraAngle(Math.atan2(vx, vz) * DEG, -85, 85)
  const roll = clampCameraAngle(rollDeg, -180, 180)

  const scale = clampFrameScale(dist / refD)
  const { stageX, stageY } = map3DTargetToStageXY(project, layout, target3D, shotBox)
  return {
    shotBox,
    stageX,
    stageY,
    scale,
    width: Math.round(project.comp.width * scale),
    height: Math.round(project.comp.height * scale),
    yaw,
    pitch,
    roll
  }
}

/**
 * Extracts all Camera Frames along the timeline from `project.camera`.
 * If no keyframes exist yet, returns a single initial frame at t = 0.
 */
export function extractCameraFrames2D(project: Project, layout: ShotStageBox[]): CameraFrame2D[] {
  const cam = project.camera
  const keyTimes = Array.from(
    new Set([
      ...cam.position.keyframes.map((k) => Math.round(k.t * 1000) / 1000),
      ...cam.target.keyframes.map((k) => Math.round(k.t * 1000) / 1000),
      ...(cam.roll?.keyframes.map((k) => Math.round(k.t * 1000) / 1000) ?? [])
    ])
  ).sort((a, b) => a - b)

  if (keyTimes.length === 0) {
    const pos = [...cam.position.value] as Vec3
    const tgt = [...cam.target.value] as Vec3
    const rollVal = cam.roll ? cam.roll.value : 0
    const mapped = pose3DToStageFrame(project, layout, pos, tgt, rollVal)
    return [
      {
        index: 0,
        time: 0,
        isKeyframed: false,
        ease: 'easeInOut',
        shotId: mapped.shotBox.shotId,
        shotName: mapped.shotBox.name,
        shotColor: mapped.shotBox.color,
        stageX: mapped.stageX,
        stageY: mapped.stageY,
        scale: mapped.scale,
        width: mapped.width,
        height: mapped.height,
        yaw: mapped.yaw,
        pitch: mapped.pitch,
        roll: mapped.roll,
        position3D: pos,
        target3D: tgt
      }
    ]
  }

  // Merge timestamps that are within 0.01s of each other
  const mergedTimes: number[] = []
  for (const t of keyTimes) {
    if (mergedTimes.length === 0 || Math.abs(t - mergedTimes[mergedTimes.length - 1]) > 0.01) {
      mergedTimes.push(t)
    }
  }

  return mergedTimes.map((t, idx) => {
    const pos = [...evaluate(cam.position, t)] as Vec3
    const tgt = [...evaluate(cam.target, t)] as Vec3
    const rollVal = cam.roll ? evaluate(cam.roll, t) : 0
    const keyObj = cam.position.keyframes.find((k) => Math.abs(k.t - t) <= 0.015)
    const mapped = pose3DToStageFrame(project, layout, pos, tgt, rollVal)
    return {
      index: idx,
      time: t,
      isKeyframed: true,
      ease: keyObj?.ease ?? 'easeInOut',
      shotId: mapped.shotBox.shotId,
      shotName: mapped.shotBox.name,
      shotColor: mapped.shotBox.color,
      stageX: mapped.stageX,
      stageY: mapped.stageY,
      scale: mapped.scale,
      width: mapped.width,
      height: mapped.height,
      yaw: mapped.yaw,
      pitch: mapped.pitch,
      roll: mapped.roll,
      position3D: pos,
      target3D: tgt
    }
  })
}

/**
 * Converts a 2D Stage Camera Frame `(stageX, stageY, scale, yaw, pitch)` back into 3D camera
 * `position`, `target`, and `focusDistance`.
 */
export function stageFrameTo3DCamera(
  project: Project,
  layout: ShotStageBox[],
  stageX: number,
  stageY: number,
  scale: number,
  angles?: { yaw?: number; pitch?: number }
): { position: Vec3; target: Vec3; focusDistance: number; shotId: string | null } {
  const refD = Math.max(100, referenceDistance(project.comp))
  const clampedScale = clampFrameScale(scale)
  const shotBox = findNearestShotByStage2D(layout, stageX, stageY)
  const localDx = Math.round(stageX - shotBox.stageX)
  const localDy = Math.round(-(stageY - shotBox.stageY))
  const dist = Math.round(clampedScale * refD * 100) / 100

  const target: Vec3 = [
    Math.round(shotBox.worldOrigin[0] + localDx),
    Math.round(shotBox.worldOrigin[1] + localDy),
    Math.round(shotBox.worldOrigin[2])
  ]

  const yawRad = clampCameraAngle(angles?.yaw ?? 0, -85, 85) * RAD
  const pitchRad = clampCameraAngle(angles?.pitch ?? 0, -75, 75) * RAD

  const vx = dist * Math.cos(pitchRad) * Math.sin(yawRad)
  const vy = dist * Math.sin(pitchRad)
  const vz = dist * Math.cos(pitchRad) * Math.cos(yawRad)

  const position: Vec3 = [
    Math.round((target[0] + vx) * 100) / 100,
    Math.round((target[1] + vy) * 100) / 100,
    Math.round((target[2] - vz) * 100) / 100
  ]

  return {
    position,
    target,
    focusDistance: Math.round(dist),
    shotId: shotBox.shotId
  }
}

/**
 * Applies a 2D Stage Camera Frame edit at time `t` onto the draft project.
 * Supports optional 3D orbit angles (`yaw`, `pitch`), camera `roll` (Dutch angle), and `ease`.
 */
export function applyStageFrameToDraft(
  draft: Project,
  layout: ShotStageBox[],
  time: number,
  stageX: number,
  stageY: number,
  scale: number,
  forceKeyframe = false,
  opts?: StageFramePoseOptions
): void {
  const tol = Math.max(frameTolerance(draft), 0.02)
  const ease: EaseName = opts?.ease ?? 'easeInOut'
  const { position, target, focusDistance } = stageFrameTo3DCamera(draft, layout, stageX, stageY, scale, {
    yaw: opts?.yaw,
    pitch: opts?.pitch
  })

  if (!draft.camera.roll) {
    draft.camera.roll = anim(0)
  }
  const rollVal = opts?.roll !== undefined ? clampCameraAngle(opts.roll, -180, 180) : evaluate(draft.camera.roll, time)

  const hasKeys =
    draft.camera.position.keyframes.length > 0 ||
    draft.camera.target.keyframes.length > 0 ||
    draft.camera.roll.keyframes.length > 0

  if (forceKeyframe || hasKeys) {
    if (draft.camera.roll.keyframes.length === 0 && draft.camera.position.keyframes.length > 0) {
      const baseRoll = draft.camera.roll.value ?? 0
      for (const pk of draft.camera.position.keyframes) {
        if (Math.abs(pk.t - time) > tol) {
          addKeyframe(draft.camera.roll, pk.t, baseRoll, pk.ease, tol)
        }
      }
    }
    addKeyframe(draft.camera.position, time, position, ease, tol)
    addKeyframe(draft.camera.target, time, target, ease, tol)
    addKeyframe(draft.camera.focusDistance, time, focusDistance, ease, tol)
    addKeyframe(draft.camera.roll, time, rollVal, ease, tol)
  } else {
    setValueAt(draft.camera.position, time, position, tol)
    setValueAt(draft.camera.target, time, target, tol)
    setValueAt(draft.camera.focusDistance, time, focusDistance, tol)
    if (opts?.roll !== undefined) {
      setValueAt(draft.camera.roll, time, rollVal, tol)
    }
  }
}

/**
 * Evaluates the live interpolated 2D Camera Frame at arbitrary time `t`
 * directly across the 2D Stage keyframes so the active viewport frame glides
 * smoothly along the trajectory between shots without overshooting or looping.
 */
export function evaluateLiveCameraFrame2D(
  project: Project,
  _layout: ShotStageBox[],
  frames: CameraFrame2D[],
  time: number
): {
  time: number
  stageX: number
  stageY: number
  scale: number
  width: number
  height: number
  yaw: number
  pitch: number
  roll: number
} {
  if (frames.length === 0) {
    return {
      time,
      stageX: 0,
      stageY: 0,
      scale: 1,
      width: project.comp.width,
      height: project.comp.height,
      yaw: 0,
      pitch: 0,
      roll: 0
    }
  }
  if (frames.length === 1 || time <= frames[0].time) {
    const f = frames[0]
    return {
      time,
      stageX: f.stageX,
      stageY: f.stageY,
      scale: f.scale,
      width: f.width,
      height: f.height,
      yaw: f.yaw,
      pitch: f.pitch,
      roll: f.roll
    }
  }
  const last = frames[frames.length - 1]
  if (time >= last.time) {
    return {
      time,
      stageX: last.stageX,
      stageY: last.stageY,
      scale: last.scale,
      width: last.width,
      height: last.height,
      yaw: last.yaw,
      pitch: last.pitch,
      roll: last.roll
    }
  }

  let lo = 0
  let hi = frames.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid].time <= time) lo = mid
    else hi = mid
  }
  const f0 = frames[lo]
  const f1 = frames[hi]
  const span = Math.max(0.05, f1.time - f0.time)

  // Support per-waypoint buffer delay (delaySec) and action speed/duration (actionDurationSec)
  const meta0 = getWaypointTimingMeta(f0.time, span)
  const meta1 = getWaypointTimingMeta(f1.time, span)
  const activeMeta = meta0.hasCustomActionTiming
    ? meta0
    : meta1.hasCustomActionTiming
      ? meta1
      : meta0

  const elapsed = Math.max(0, time - f0.time)
  const delay = Math.min(Math.max(0, span - 0.05), activeMeta.delaySec)
  const actDur = Math.max(0.05, Math.min(span - delay, activeMeta.actionDurationSec))
  const rawU = elapsed <= delay ? 0 : Math.max(0, Math.min(1, (elapsed - delay) / actDur))

  const segEase: EaseName =
    f0.ease === 'hold' || f1.ease === 'hold'
      ? 'hold'
      : f0.ease !== 'easeInOut'
        ? f0.ease
        : f1.ease
  const u = ease(segEase, rawU)

  let stageX = f0.stageX + (f1.stageX - f0.stageX) * u
  let stageY = f0.stageY + (f1.stageY - f0.stageY) * u
  const scale = clampFrameScale(f0.scale + (f1.scale - f0.scale) * u)
  const yaw = clampCameraAngle(f0.yaw + (f1.yaw - f0.yaw) * u, -85, 85)
  const pitch = clampCameraAngle(f0.pitch + (f1.pitch - f0.pitch) * u, -75, 75)
  let roll = clampCameraAngle(f0.roll + (f1.roll - f0.roll) * u, -180, 180)

  if (project.camera.shakeAmount > 0) {
    const s = time * project.camera.shakeSpeed * Math.PI * 2
    stageX += smoothNoise(s, 1.3) * project.camera.shakeAmount * 0.3
    stageY -= smoothNoise(s, 7.1) * project.camera.shakeAmount * 0.3
    roll += smoothNoise(s * 0.7, 3.7) * (project.camera.shakeAmount * 0.05)
  }

  return {
    time,
    stageX: Math.round(stageX),
    stageY: Math.round(stageY),
    scale,
    width: Math.round(project.comp.width * scale),
    height: Math.round(project.comp.height * scale),
    yaw,
    pitch,
    roll
  }
}
