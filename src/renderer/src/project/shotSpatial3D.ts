import type { Layer, Project, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { layerNominalSize } from '../engine/spatial'
import {
  applyStageFrameToDraft,
  clampFrameScale,
  computeShotStageLayout,
  extractCameraFrames2D,
  type CameraFrame2D
} from '../ui/viewer/animateCamera/animateCameraMath'
import {
  recordExplicitActionMode,
  type CameraActionMode
} from '../ui/viewer/animateCamera/animateCameraActionModes'
import { setKeyframeEaseAtTime } from '../ui/viewer/animateCamera/animateCameraActionApplier'
import { updateCameraWaypoint } from '../ui/viewer/animateCamera/animateCameraRouteLogic'
import { getClusterMemberLayers, getClusterRootLayer } from './workflowV2ClusterRigAndSwap'

export type Shot3DPlacementPreset =
  | 'right'
  | 'left'
  | 'up'
  | 'down'
  | 'diag_up_right'
  | 'diag_down_right'
  | 'depth_forward'
  | 'depth_back'
  | 'origin'

export interface Shot3DPlacementMeta {
  id: Shot3DPlacementPreset
  icon: string
  label: string
  hint: string
}

export const SHOT_3D_PLACEMENT_PRESETS: Shot3DPlacementMeta[] = [
  { id: 'right', icon: '➡', label: 'Sang phải', hint: 'Đặt cảnh sang bên phải cảnh trước (Camera lia ngang sang phải)' },
  { id: 'left', icon: '⬅', label: 'Sang trái', hint: 'Đặt cảnh sang bên trái cảnh trước (Camera lia ngang sang trái)' },
  { id: 'up', icon: '⬆', label: 'Lên trên', hint: 'Đặt cảnh lên phía trên cảnh trước (Camera lia dọc hướng lên)' },
  { id: 'down', icon: '⬇', label: 'Xuống dưới', hint: 'Đặt cảnh xuống dưới cảnh trước (Camera lia dọc hướng xuống)' },
  { id: 'diag_up_right', icon: '↗', label: 'Chéo trên', hint: 'Đặt cảnh chéo trên bên phải cảnh trước (Camera lia chéo không gian)' },
  { id: 'diag_down_right', icon: '↘', label: 'Chéo dưới', hint: 'Đặt cảnh chéo dưới bên phải cảnh trước (Camera lia chéo xuống)' },
  { id: 'depth_forward', icon: '🚀', label: 'Sâu Z (Bay tới)', hint: 'Đặt cảnh lùi sâu theo trục Z- để Camera 3D bay xuyên chiều sâu tới cảnh' },
  { id: 'depth_back', icon: '🔭', label: 'Lùi Z (Kéo xa)', hint: 'Đặt cảnh ở phía trước theo trục Z+ để Camera kéo lùi lộ cảnh mới' }
]

/** Đọc tâm không gian 3D thế giới hiện tại của một Cảnh */
export function getShotWorldCenter3D(project: Project, shotId: string): Vec3 {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) return [0, 0, 0]
  const ev = evaluate(shot.position, 0)
  return [Math.round(ev[0] || 0), Math.round(ev[1] || 0), Math.round(ev[2] || 0)]
}

/**
 * Dịch chuyển toàn bộ không gian 3D của một Cảnh tới `nextWorldPos` (X, Y, Z),
 * đồng thời tịnh tiến đồng bộ mọi mốc Keyframe Camera 3D thuộc Cảnh đó để lộ trình quay
 * lia chính xác tới vị trí không gian mới (ngang, dọc, chéo hoặc xuyên chiều sâu Z).
 */
export function translateShotInWorld3D(
  project: Project,
  shotId: string,
  nextWorldPos: Vec3,
  opts?: { syncCamera?: boolean }
): Vec3 {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) return [0, 0, 0]

  const layoutBefore = computeShotStageLayout(project, 0)
  const framesBefore = extractCameraFrames2D(project, layoutBefore)
  const ownedFrameTimes = framesBefore
    .filter((f) => f.shotId === shotId)
    .map((f) => f.time)

  const cur = getShotWorldCenter3D(project, shotId)
  const target: Vec3 = [
    Math.round(nextWorldPos[0]),
    Math.round(nextWorldPos[1]),
    Math.round(nextWorldPos[2])
  ]
  const dx = target[0] - cur[0]
  const dy = target[1] - cur[1]
  const dz = target[2] - cur[2]
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(dz) < 0.5) return cur

  shot.position.value = [...target]
  for (const kf of shot.position.keyframes) {
    kf.value = [
      Math.round(kf.value[0] + dx),
      Math.round(kf.value[1] + dy),
      Math.round(kf.value[2] + dz)
    ]
  }

  if (opts?.syncCamera !== false && project.camera) {
    const matchesOwned = (t: number): boolean =>
      ownedFrameTimes.length > 0
        ? ownedFrameTimes.some((ot) => Math.abs(ot - t) <= 0.025)
        : false

    const hasPosKeys = project.camera.position.keyframes.length > 0
    if (hasPosKeys) {
      for (const kf of project.camera.position.keyframes) {
        if (matchesOwned(kf.t)) {
          kf.value = [
            Math.round((kf.value[0] + dx) * 100) / 100,
            Math.round((kf.value[1] + dy) * 100) / 100,
            Math.round((kf.value[2] + dz) * 100) / 100
          ]
        }
      }
      for (const kf of project.camera.target.keyframes) {
        if (matchesOwned(kf.t)) {
          kf.value = [
            Math.round((kf.value[0] + dx) * 100) / 100,
            Math.round((kf.value[1] + dy) * 100) / 100,
            Math.round((kf.value[2] + dz) * 100) / 100
          ]
        }
      }
    } else if ((framesBefore[0]?.shotId ?? project.shots[0]?.id) === shotId) {
      project.camera.position.value = [
        Math.round((project.camera.position.value[0] + dx) * 100) / 100,
        Math.round((project.camera.position.value[1] + dy) * 100) / 100,
        Math.round((project.camera.position.value[2] + dz) * 100) / 100
      ]
      project.camera.target.value = [
        Math.round((project.camera.target.value[0] + dx) * 100) / 100,
        Math.round((project.camera.target.value[1] + dy) * 100) / 100,
        Math.round((project.camera.target.value[2] + dz) * 100) / 100
      ]
    }
  }

  return target
}

/** Đặt nhanh vị trí không gian 3D của Cảnh so với Cảnh liền trước theo hướng điện ảnh */
export function placeShotRelativeToAnchor3D(
  project: Project,
  shotId: string,
  preset: Shot3DPlacementPreset,
  anchorShotId?: string
): Vec3 {
  if (preset === 'origin') {
    return translateShotInWorld3D(project, shotId, [0, 0, 0])
  }
  const idx = project.shots.findIndex((s) => s.id === shotId)
  const anchor =
    (anchorShotId ? project.shots.find((s) => s.id === anchorShotId) : undefined) ??
    (idx > 0 ? project.shots[idx - 1] : undefined)
  const [ax, ay, az] = anchor ? getShotWorldCenter3D(project, anchor.id) : [0, 0, 0]
  const stepX = Math.round((project.comp.width || 1920) * 5.5)
  const stepY = Math.round((project.comp.height || 1080) * 5.5)
  const stepZ = 3200

  let next: Vec3 = [ax + stepX, ay, az]
  switch (preset) {
    case 'right':
      next = [ax + stepX, ay, az]
      break
    case 'left':
      next = [ax - stepX, ay, az]
      break
    case 'up':
      next = [ax, ay + stepY, az]
      break
    case 'down':
      next = [ax, ay - stepY, az]
      break
    case 'diag_up_right':
      next = [ax + Math.round(stepX * 0.8), ay + Math.round(stepY * 0.8), az]
      break
    case 'diag_down_right':
      next = [ax + Math.round(stepX * 0.8), ay - Math.round(stepY * 0.8), az]
      break
    case 'depth_forward':
      next = [ax + Math.round(stepX * 0.25), ay, az - stepZ]
      break
    case 'depth_back':
      next = [ax + Math.round(stepX * 0.25), ay, az + stepZ]
      break
  }
  return translateShotInWorld3D(project, shotId, next)
}

/** Tính khung ngắm Stage 2D (stageX, stageY, scale) ôm gọn BBox của Layer hoặc Cụm 2.5D tại mốc `atTime` */
export function computeEntityStageBBoxFrame(
  project: Project,
  shotId: string | undefined,
  layerIds: string[],
  atTime: number,
  overrideLocalXY?: [number, number],
  scaleMultiplier = 1
): { stageX: number; stageY: number; scale: number } | null {
  const layout = computeShotStageLayout(project, 0)
  const direct = project.layers.filter((l) => layerIds.includes(l.id))
  if (direct.length === 0) return null
  const instId = direct.find((l) => l.composite?.instanceId)?.composite?.instanceId
  const members: Layer[] = instId ? getClusterMemberLayers(project, instId) : direct
  const pool = members.length > 0 ? members : direct
  const root = getClusterRootLayer(pool) ?? pool[0]
  const effShotId = shotId ?? root.shotId ?? project.shots[0]?.id ?? null
  const shotBox = layout.find((b) => b.shotId === effShotId) ?? layout[0]
  if (!shotBox) return null

  const refD = Math.max(100, referenceDistance(project.comp))
  const compW = Math.max(320, project.comp.width || 1920)
  const compH = Math.max(240, project.comp.height || 1080)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const rootPos = evaluate(root.transform.position, atTime)
  const dxOverride = overrideLocalXY ? overrideLocalXY[0] - rootPos[0] : 0
  const dyOverride = overrideLocalXY ? overrideLocalXY[1] - rootPos[1] : 0

  for (const m of pool) {
    if (!m.visible) continue
    const pos = evaluate(m.transform.position, atTime)
    const scl = evaluate(m.transform.scale, atTime)
    const [nw, nh] = layerNominalSize(m)
    const pFactor = refD / Math.max(80, refD + pos[2])
    const cx = (pos[0] + dxOverride) * pFactor
    const cy = (pos[1] + dyOverride) * pFactor
    const hw = Math.max(24, (nw * Math.abs(scl[0] || 1) * scaleMultiplier * pFactor) / 2)
    const hh = Math.max(24, (nh * Math.abs(scl[1] || 1) * scaleMultiplier * pFactor) / 2)
    minX = Math.min(minX, cx - hw)
    maxX = Math.max(maxX, cx + hw)
    minY = Math.min(minY, cy - hh)
    maxY = Math.max(maxY, cy + hh)
  }

  if (!Number.isFinite(minX)) return null
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const spanW = Math.max(160, maxX - minX)
  const spanH = Math.max(120, maxY - minY)
  const fitRatio = Math.max(spanW / compW, spanH / compH) * 1.75
  const scale = clampFrameScale(Math.max(0.45, Math.min(1.25, Number(fitRatio.toFixed(3)))))

  return {
    stageX: Math.round(shotBox.stageX + centerX),
    stageY: Math.round(shotBox.stageY - centerY),
    scale
  }
}

/**
 * 1-Click bắt khung Camera tự động theo BBox của Layer/Cụm hoặc lộ trình Motion BBox #1 -> #2
 * mà người dùng không cần phải tự chuyển qua tab Camera tạo từng mốc thủ công.
 */
export function snapCameraToEntityBBox(
  project: Project,
  opts: {
    shotId?: string
    layerIds: string[]
    atTime: number
    mode?: 'snap_current' | 'follow_bbox_motion'
    endTime?: number
    startXY?: [number, number]
    targetXY?: [number, number]
    targetScalePct?: number
  }
): { startTime: number; endTime?: number } | null {
  const layout = computeShotStageLayout(project, 0)
  const startFrame = computeEntityStageBBoxFrame(
    project,
    opts.shotId,
    opts.layerIds,
    opts.atTime,
    opts.startXY,
    1
  )
  if (!startFrame) return null

  applyStageFrameToDraft(
    project,
    layout,
    opts.atTime,
    startFrame.stageX,
    startFrame.stageY,
    startFrame.scale,
    true,
    { ease: 'easeInOut' }
  )
  recordExplicitActionMode(opts.atTime, startFrame.scale < 0.92 ? 'push-in' : 'pan')

  if (opts.mode === 'follow_bbox_motion' && opts.endTime !== undefined && opts.endTime > opts.atTime + 0.15) {
    const scaleMul = Math.max(0.25, Math.min(3.0, (opts.targetScalePct ?? 100) / 100))
    const endFrame =
      computeEntityStageBBoxFrame(
        project,
        opts.shotId,
        opts.layerIds,
        opts.atTime,
        opts.targetXY,
        scaleMul
      ) ?? startFrame
    applyStageFrameToDraft(
      project,
      layout,
      opts.endTime,
      endFrame.stageX,
      endFrame.stageY,
      endFrame.scale,
      true,
      { ease: 'easeInOut' }
    )
    const endMode: CameraActionMode =
      endFrame.scale < startFrame.scale - 0.04
        ? 'push-in'
        : endFrame.scale > startFrame.scale + 0.04
          ? 'pull-out'
          : 'pan'
    recordExplicitActionMode(opts.endTime, endMode)
    return { startTime: opts.atTime, endTime: opts.endTime }
  }

  return { startTime: opts.atTime }
}

/**
 * Chuyển cảnh (Cut tức thì hoặc Lia mượt 3D) một mốc lộ trình Camera sang thẳng BBox của một Cảnh đích
 * hoặc BBox của một Chủ thể/Layer đích.
 */
export function transitionCameraWaypointToTargetBBox(
  project: Project,
  waypointTime: number,
  target: { shotId?: string; layerIds?: string[]; style: 'cut' | 'fly' }
): boolean {
  const layout = computeShotStageLayout(project, 0)
  const frames = extractCameraFrames2D(project, layout)
  const curIdx = frames.findIndex((f) => Math.abs(f.time - waypointTime) <= 0.05)
  const prev =
    curIdx > 0
      ? frames[curIdx - 1]
      : [...frames].reverse().find((f) => f.time < waypointTime - 0.05) ?? null

  let stageX = 0
  let stageY = 0
  let scale = 1.0

  if (target.layerIds && target.layerIds.length > 0) {
    const entityFrame = computeEntityStageBBoxFrame(project, target.shotId, target.layerIds, waypointTime)
    if (!entityFrame) return false
    stageX = entityFrame.stageX
    stageY = entityFrame.stageY
    scale = entityFrame.scale
  } else if (target.shotId) {
    const shotBox = layout.find((b) => b.shotId === target.shotId)
    if (!shotBox) return false
    stageX = shotBox.stageX
    stageY = shotBox.stageY
    scale = 1.0
  } else {
    return false
  }

  updateCameraWaypoint(project, layout, waypointTime, {
    stageX,
    stageY,
    scale,
    yaw: 0,
    pitch: 0,
    roll: 0,
    ease: 'easeInOut'
  })

  if (prev) {
    setKeyframeEaseAtTime(project, prev.time, target.style === 'cut' ? 'hold' : 'easeInOut')
  }
  recordExplicitActionMode(
    waypointTime,
    target.style === 'cut'
      ? 'cut'
      : prev && scale < prev.scale - 0.04
        ? 'push-in'
        : prev && scale > prev.scale + 0.04
          ? 'pull-out'
          : 'pan'
  )
  return true
}

export interface WaypointBBoxGeometryAnalysis {
  relation: 'first' | 'cross_shot' | 'smaller' | 'larger' | 'same_size'
  panned: boolean
  panDistPx: number
  prevZoomPct: number
  curZoomPct: number
  prevWidthPx: number
  curWidthPx: number
  summaryBadge: string
  /** Kiểm tra một động tác quay có mâu thuẫn với quan hệ kích thước BBox 1 -> BBox 2 hiện tại hay không */
  isContradictoryWithCurrentBBox: (modeId: string) => boolean
  contradictionReason: (modeId: string) => string | undefined
}

/**
 * Phân tích quan hệ hình học thật giữa BBox mốc trước (BBox 1) và BBox mốc hiện tại (BBox 2):
 * - Nếu BBox 1 to hơn BBox 2 (`cur.scale < prev.scale`): chỉ có thể là Đẩy cận / Lia + Đẩy cận / Chuyển cảnh (không thể gắn mác Kéo rộng nếu không mở to BBox 2).
 * - Nếu BBox 1 nhỏ hơn BBox 2 (`cur.scale > prev.scale`): chỉ có thể là Kéo rộng / Lia + Kéo rộng / Chuyển cảnh (không thể gắn mác Đẩy cận nếu không thu nhỏ BBox 2).
 */
export function analyzeWaypointBBoxTransition(
  prev: CameraFrame2D | null,
  cur: CameraFrame2D | null
): WaypointBBoxGeometryAnalysis {
  if (!cur) {
    return {
      relation: 'first',
      panned: false,
      panDistPx: 0,
      prevZoomPct: 100,
      curZoomPct: 100,
      prevWidthPx: 1920,
      curWidthPx: 1920,
      summaryBadge: 'Mốc mở đầu (100%)',
      isContradictoryWithCurrentBBox: () => false,
      contradictionReason: () => undefined
    }
  }
  const curZoomPct = Math.round(100 / Math.max(0.1, cur.scale))
  const curWidthPx = Math.round(cur.width)
  if (!prev) {
    return {
      relation: 'first',
      panned: false,
      panDistPx: 0,
      prevZoomPct: curZoomPct,
      curZoomPct,
      prevWidthPx: curWidthPx,
      curWidthPx,
      summaryBadge: `BBox gốc #1 · Khung ${curWidthPx}px (Zoom ${curZoomPct}%)`,
      isContradictoryWithCurrentBBox: () => false,
      contradictionReason: () => undefined
    }
  }

  const prevZoomPct = Math.round(100 / Math.max(0.1, prev.scale))
  const prevWidthPx = Math.round(prev.width)
  const panDistPx = Math.round(Math.hypot(cur.stageX - prev.stageX, cur.stageY - prev.stageY))
  const panned = panDistPx > 45
  const crossShot = Boolean(prev.shotId && cur.shotId && prev.shotId !== cur.shotId)
  const scaleDiff = cur.scale - prev.scale

  const relation: WaypointBBoxGeometryAnalysis['relation'] = crossShot
    ? 'cross_shot'
    : scaleDiff < -0.04
      ? 'smaller'
      : scaleDiff > 0.04
        ? 'larger'
        : 'same_size'

  const summaryBadge =
    relation === 'cross_shot'
      ? `Chuyển cảnh: ${prev.shotName} ➔ ${cur.shotName} (${curZoomPct}%)`
      : relation === 'smaller'
        ? `BBox trước (${prevWidthPx}px) > BBox này (${curWidthPx}px) · ${panned ? 'Lia + Đẩy cận' : 'Đẩy cận'}`
        : relation === 'larger'
          ? `BBox trước (${prevWidthPx}px) < BBox này (${curWidthPx}px) · ${panned ? 'Lia + Kéo rộng' : 'Kéo rộng'}`
          : `BBox bằng nhau (${curWidthPx}px) · ${panned ? `Lia ${panDistPx}px` : 'Giữ khung'}`

  const isContradictoryWithCurrentBBox = (modeId: string): boolean => {
    if (relation === 'smaller' && (modeId === 'pull-out' || modeId === 'bird-eye')) return true
    if (relation === 'larger' && (modeId === 'push-in' || modeId === 'extreme-closeup' || modeId === 'corkscrew')) return true
    if (panned && modeId === 'hold') return true
    return false
  }

  const contradictionReason = (modeId: string): string | undefined => {
    if (relation === 'smaller' && (modeId === 'pull-out' || modeId === 'bird-eye')) {
      return `BBox trước (${prevWidthPx}px) đang TO hơn BBox này (${curWidthPx}px) nên không thể là Kéo rộng — bấm nếu muốn mở rộng BBox này to hơn BBox trước.`
    }
    if (relation === 'larger' && (modeId === 'push-in' || modeId === 'extreme-closeup' || modeId === 'corkscrew')) {
      return `BBox trước (${prevWidthPx}px) đang NHỎ hơn BBox này (${curWidthPx}px) nên không thể là Đẩy cận — bấm nếu muốn thu hẹp BBox này nhỏ hơn BBox trước.`
    }
    if (panned && modeId === 'hold') {
      return 'BBox này đã lệch tâm so với BBox trước — bấm Dừng ngắm sẽ đưa khung khớp lại vị trí BBox trước.'
    }
    return undefined
  }

  return {
    relation,
    panned,
    panDistPx,
    prevZoomPct,
    curZoomPct,
    prevWidthPx,
    curWidthPx,
    summaryBadge,
    isContradictoryWithCurrentBBox,
    contradictionReason
  }
}
