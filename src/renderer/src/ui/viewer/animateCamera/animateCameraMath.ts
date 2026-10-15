import type { EaseName, Layer, Project, Vec3 } from '@shared/types'
import { addKeyframe, evaluate, setValueAt } from '../../../animation/keyframes'
import { referenceDistance } from '../../../animation/math'
import { evaluateScene, type EvaluatedScene } from '../../../engine/evaluateScene'
import { frameTolerance } from '../../../store/editor'

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
  position3D: Vec3
  target3D: Vec3
}

const MIN_FRAME_SCALE = 0.15
const MAX_FRAME_SCALE = 3.0

export function clampFrameScale(scale: number): number {
  return Math.max(MIN_FRAME_SCALE, Math.min(MAX_FRAME_SCALE, scale))
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
  const stepStageX = Math.round(W * 1.28)
  const stepStageY = Math.round(H * 1.32)

  const origin0 = evaluate(shots[0].position, time)
  const placed: ShotStageBox[] = []

  shots.forEach((s, idx) => {
    const pos3d = [...evaluate(s.position, time)] as Vec3
    let sx = 0
    let sy = 0
    if (idx > 0) {
      const dx3d = pos3d[0] - origin0[0]
      const dy3d = pos3d[1] - origin0[1]
      sx = Math.round((dx3d / spacing3DX) * stepStageX)
      sy = Math.round((-dy3d / spacing3DY) * stepStageY)
    }

    // Prevent overlap when shots are placed along the Z depth axis with similar X/Y
    let guard = 0
    while (
      guard < 32 &&
      placed.some(
        (p) => Math.abs(sx - p.stageX) < W * 1.08 && Math.abs(sy - p.stageY) < H * 1.08
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
 * Projects a Shot's stacked 3D layers onto its 2D Stage plane in painter's order
 * (farthest Z background first, nearest Z foreground last) so each shot displays
 * as a complete 2D scene representation of its 3D layer stack.
 */
export function projectShotLayers2D(
  project: Project,
  ev: EvaluatedScene,
  shotId: string | null,
  includeGlobals = false
): ProjectedLayer2D[] {
  const refD = Math.max(100, referenceDistance(project.comp))
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

  return matching.map((el): ProjectedLayer2D => {
    const lz = el.position[2]
    const pFactor = refD / Math.max(80, refD + lz)
    const width = Math.max(4, el.size[0] * el.scale[0] * pFactor)
    const height = Math.max(4, el.size[1] * el.scale[1] * pFactor)
    const offsetX = el.position[0] * pFactor
    const offsetY = -el.position[1] * pFactor
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

    return base
  })
}

function findNearestShotBy3D(layout: ShotStageBox[], target3D: Vec3): ShotStageBox {
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

export function pose3DToStageFrame(
  project: Project,
  layout: ShotStageBox[],
  position3D: Vec3,
  target3D: Vec3
): {
  shotBox: ShotStageBox
  stageX: number
  stageY: number
  scale: number
  width: number
  height: number
} {
  const refD = Math.max(100, referenceDistance(project.comp))
  const shotBox = findNearestShotBy3D(layout, target3D)
  const localDx = target3D[0] - shotBox.worldOrigin[0]
  const localDy = target3D[1] - shotBox.worldOrigin[1]
  const dist = Math.max(
    80,
    Math.hypot(
      target3D[0] - position3D[0],
      target3D[1] - position3D[1],
      target3D[2] - position3D[2]
    )
  )
  const scale = clampFrameScale(dist / refD)
  const stageX = Math.round(shotBox.stageX + localDx)
  const stageY = Math.round(shotBox.stageY - localDy)
  return {
    shotBox,
    stageX,
    stageY,
    scale,
    width: Math.round(project.comp.width * scale),
    height: Math.round(project.comp.height * scale)
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
      ...cam.target.keyframes.map((k) => Math.round(k.t * 1000) / 1000)
    ])
  ).sort((a, b) => a - b)

  if (keyTimes.length === 0) {
    const pos = [...cam.position.value] as Vec3
    const tgt = [...cam.target.value] as Vec3
    const mapped = pose3DToStageFrame(project, layout, pos, tgt)
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
        position3D: pos,
        target3D: tgt
      }
    ]
  }

  return keyTimes.map((t, idx) => {
    const pos = [...evaluate(cam.position, t)] as Vec3
    const tgt = [...evaluate(cam.target, t)] as Vec3
    const keyObj = cam.position.keyframes.find((k) => Math.abs(k.t - t) <= 0.005)
    const mapped = pose3DToStageFrame(project, layout, pos, tgt)
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
      position3D: pos,
      target3D: tgt
    }
  })
}

/**
 * Converts a 2D Stage Camera Frame `(stageX, stageY, scale)` back into 3D camera
 * `position`, `target`, and `focusDistance`.
 */
export function stageFrameTo3DCamera(
  project: Project,
  layout: ShotStageBox[],
  stageX: number,
  stageY: number,
  scale: number
): { position: Vec3; target: Vec3; focusDistance: number; shotId: string | null } {
  const refD = Math.max(100, referenceDistance(project.comp))
  const clampedScale = clampFrameScale(scale)
  const shotBox = findNearestShotByStage2D(layout, stageX, stageY)
  const localDx = Math.round(stageX - shotBox.stageX)
  const localDy = Math.round(-(stageY - shotBox.stageY))
  const dist = Math.round(clampedScale * refD)

  const target: Vec3 = [
    Math.round(shotBox.worldOrigin[0] + localDx),
    Math.round(shotBox.worldOrigin[1] + localDy),
    Math.round(shotBox.worldOrigin[2])
  ]
  const position: Vec3 = [target[0], target[1], Math.round(target[2] - dist)]

  return {
    position,
    target,
    focusDistance: dist,
    shotId: shotBox.shotId
  }
}

/**
 * Applies a 2D Stage Camera Frame edit at time `t` onto the draft project.
 */
export function applyStageFrameToDraft(
  draft: Project,
  layout: ShotStageBox[],
  time: number,
  stageX: number,
  stageY: number,
  scale: number,
  forceKeyframe = false
): void {
  const tol = frameTolerance(draft)
  const { position, target, focusDistance } = stageFrameTo3DCamera(draft, layout, stageX, stageY, scale)
  const hasKeys = draft.camera.position.keyframes.length > 0 || draft.camera.target.keyframes.length > 0
  if (forceKeyframe || hasKeys) {
    addKeyframe(draft.camera.position, time, position, 'easeInOut')
    addKeyframe(draft.camera.target, time, target, 'easeInOut')
    addKeyframe(draft.camera.focusDistance, time, focusDistance, 'easeInOut')
  } else {
    setValueAt(draft.camera.position, time, position, tol)
    setValueAt(draft.camera.target, time, target, tol)
    setValueAt(draft.camera.focusDistance, time, focusDistance, tol)
  }
}

/**
 * Evaluates the live interpolated 2D Camera Frame at arbitrary time `t`
 * so the active viewport frame glides smoothly between keyframes during playback.
 */
export function evaluateLiveCameraFrame2D(
  project: Project,
  layout: ShotStageBox[],
  frames: CameraFrame2D[],
  time: number
): { stageX: number; stageY: number; scale: number; width: number; height: number } {
  if (frames.length === 0) {
    return {
      stageX: 0,
      stageY: 0,
      scale: 1,
      width: project.comp.width,
      height: project.comp.height
    }
  }
  if (frames.length === 1 || time <= frames[0].time) {
    const f = frames[0]
    return { stageX: f.stageX, stageY: f.stageY, scale: f.scale, width: f.width, height: f.height }
  }
  const last = frames[frames.length - 1]
  if (time >= last.time) {
    return { stageX: last.stageX, stageY: last.stageY, scale: last.scale, width: last.width, height: last.height }
  }

  const ev = evaluateScene(project, time)
  const mapped = pose3DToStageFrame(project, layout, ev.camera.position, ev.camera.target)
  return {
    stageX: mapped.stageX,
    stageY: mapped.stageY,
    scale: mapped.scale,
    width: mapped.width,
    height: mapped.height
  }
}
