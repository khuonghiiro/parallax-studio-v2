import type { Layer, Project, Vec3, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { ease } from '../animation/easing'
import { bboxStartPosition } from './workflowMotionStart'
import { stepTimeParams } from './workflowStepGraph'
import { evaluateBboxTrajectoryAt } from './workflowV2BboxMotionAndCollision'
import { getClusterMemberLayers, getClusterRootLayer } from './workflowV2ClusterRigAndSwap'

/** Nghịch đảo hàm `ease('easeInOut', u)` để đổi % quãng đường không gian sang đúng mốc thời gian thực tế */
export function invertEaseInOutSpatialRatio(spatialRatio: number): number {
  const target = Math.max(0, Math.min(1, spatialRatio))
  if (target <= 0) return 0
  if (target >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) * 0.5
    if (ease('easeInOut', mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) * 0.5
}

/** Đọc khoảng thời gian thực thi của một Node Motion mà không gây đệ quy vòng lặp với workflowTiming */
function readMotionTimeRange(project: Project, motionNode: WorkflowNode): { start: number; end: number; cycleDur: number } {
  const wf = project.workflow
  const mp = stepTimeParams(wf, motionNode, motionNode.params ?? {})
  const compDur = Math.max(1, project.comp.duration || 5)
  const start = Math.max(0, mp.timeStart ?? 0)
  const end = Math.max(start + 0.3, Math.min(compDur, mp.timeEnd ?? start + 3))
  const span = Math.max(0.3, end - start)
  const cycleDur = mp.customMotionLoop
    ? Math.max(0.3, Math.min(span, mp.customMotionCycleSec ?? span))
    : span
  return { start, end, cycleDur }
}

/** Tìm Layer gốc đại diện cho hành trình BBox của một Node Motion */
export function resolveMotionLeadLayer(project: Project, motionNode: WorkflowNode): Layer | undefined {
  const mp = motionNode.params ?? {}
  const targetIds = mp.targetLayerIds ?? []
  const direct = project.layers.filter((l) => targetIds.includes(l.id))
  const instId = mp.instanceId ?? direct.find((l) => l.composite?.instanceId)?.composite?.instanceId
  const members = instId ? getClusterMemberLayers(project, instId) : direct
  return getClusterRootLayer(members) ?? direct[0]
}

/** Liệt kê các Node Motion trong cùng cảnh / cùng Cụm có thể liên kết kích hoạt cho Node Bộ phận con */
export function listCompatibleMotionNodesForPart(project: Project, partNode: WorkflowNode): WorkflowNode[] {
  const wf = project.workflow
  if (!wf) return []
  const pp = partNode.params ?? {}
  const partInst = pp.instanceId
  const partShot = pp.shotId
  const partLayerSet = new Set(pp.targetLayerIds ?? [])
  const clusterMembers = partInst ? getClusterMemberLayers(project, partInst) : []
  for (const m of clusterMembers) partLayerSet.add(m.id)

  return wf.nodes
    .filter((n) => {
      if (n.params?.logicCategory !== 'action') return false
      if (partShot && n.params?.shotId && n.params.shotId !== partShot) return false
      return true
    })
    .sort((a, b) => {
      const aSameCluster =
        (partInst && a.params?.instanceId === partInst) ||
        (a.params?.targetLayerIds ?? []).some((id) => partLayerSet.has(id))
          ? 0
          : 1
      const bSameCluster =
        (partInst && b.params?.instanceId === partInst) ||
        (b.params?.targetLayerIds ?? []).some((id) => partLayerSet.has(id))
          ? 0
          : 1
      return aSameCluster - bSameCluster
    })
}

/** Tìm Node Motion đang thực sự liên kết kích hoạt cho Node Bộ phận con (qua dây nối hoặc tham chiếu ID) */
export function findLinkedMotionNodeForPart(
  project: Project,
  partNode: WorkflowNode,
  overrideParams?: WorkflowNodeParams
): WorkflowNode | undefined {
  const wf = project.workflow
  if (!wf) return undefined
  const pp = overrideParams ?? partNode.params ?? {}

  // 1. Ưu tiên dây nối trực tiếp `action -> part_swap` đang bật trên sơ đồ
  const wiredEdge = wf.edges.find((e) => {
    if (e.toNode !== partNode.id || e.disabled) return false
    const src = wf.nodes.find((n) => n.id === e.fromNode)
    return src?.params?.logicCategory === 'action'
  })
  if (wiredEdge) {
    return wf.nodes.find((n) => n.id === wiredEdge.fromNode)
  }

  // 2. Nếu có chỉ định `linkedMotionNodeId` và đang bật chế độ `motion_bbox`
  if (pp.partTriggerMode === 'motion_bbox' && pp.linkedMotionNodeId) {
    const byId = wf.nodes.find((n) => n.id === pp.linkedMotionNodeId && n.params?.logicCategory === 'action')
    if (byId) return byId
  }

  // 3. Nếu bật `motion_bbox` nhưng chưa chọn ID, tự bắt Node Motion của cùng Cụm 2.5D / Layer
  if (pp.partTriggerMode === 'motion_bbox') {
    return listCompatibleMotionNodesForPart(project, partNode)[0]
  }
  return undefined
}

export interface MotionTrajectorySample {
  pct: number
  spatialU: number
  time: number
  x: number
  y: number
  z: number
  scaleRatio: number
}

/** Lấy mẫu chi tiết quỹ đạo BBox #1 -> #2 của một Node Motion để hiển thị và chọn điểm kích hoạt trực quan */
export function sampleMotionNodeTrajectory(
  project: Project,
  motionNode: WorkflowNode,
  steps = 24
): {
  startPos: Vec3
  targetX: number
  targetY: number
  startTime: number
  endTime: number
  samples: MotionTrajectorySample[]
} {
  const mp = motionNode.params ?? {}
  const { start, end, cycleDur } = readMotionTimeRange(project, motionNode)
  const lead = resolveMotionLeadLayer(project, motionNode)
  const startPos: Vec3 = lead ? bboxStartPosition(lead, start, motionNode.id) : [0, 0, 0]
  const targetX = mp.bboxTargetX ?? Math.round(startPos[0] + 280)
  const targetY = mp.bboxTargetY ?? Math.round(startPos[1])
  const startZ = mp.bboxStartZ ?? startPos[2]
  const targetScaleRatio = Math.max(0.15, Math.min(4.0, (mp.bboxTargetScalePct ?? 135) / 100))
  const targetZ =
    mp.depthMode === 'depth_z'
      ? (mp.bboxTargetZ ?? Math.round(startZ - (targetScaleRatio - 1) * 180))
      : startZ
  const pathType = mp.bboxPathType ?? 'shortest'
  const usesSmoothEase = pathType === 'shortest' && !mp.collisionOnPathEnabled

  const samples: MotionTrajectorySample[] = []
  const count = Math.max(2, steps)
  for (let i = 0; i <= count; i++) {
    const spatialU = i / count
    const pct = Math.round(spatialU * 100)
    const timeU = usesSmoothEase ? invertEaseInOutSpatialRatio(spatialU) : spatialU
    const time = Number((start + timeU * cycleDur).toFixed(2))
    const pt = evaluateBboxTrajectoryAt(
      startPos,
      targetX,
      targetY,
      startZ,
      targetZ,
      targetScaleRatio,
      spatialU,
      pathType,
      mp.customMotionPath
    )
    samples.push({
      pct,
      spatialU,
      time,
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      z: Math.round(pt.z),
      scaleRatio: pt.scaleRatio
    })
  }

  return { startPos, targetX, targetY, startTime: start, endTime: end, samples }
}

/** Chiếu một điểm click `(worldX, worldY)` trong cảnh lên điểm gần nhất trên đường đi của Motion BBox */
export function projectWorldPointToMotionPct(
  project: Project,
  motionNode: WorkflowNode,
  worldX: number,
  worldY: number
): { pct: number; snappedX: number; snappedY: number; triggerTime: number } {
  const { samples } = sampleMotionNodeTrajectory(project, motionNode, 50)
  let best = samples[0]
  let bestDist = Infinity
  for (const s of samples) {
    const d = Math.hypot(worldX - s.x, worldY - s.y)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return {
    pct: best.pct,
    snappedX: best.x,
    snappedY: best.y,
    triggerTime: best.time
  }
}

/**
 * Tính khoảng thời gian thực thi `[start, end]` và toạ độ điểm kích hoạt `(X, Y)` cho Node Bộ phận con
 * khi đang gắn với lộ trình di chuyển của Node Motion BBox.
 */
export function resolvePartMotionTriggerWindow(
  project: Project,
  partNode: WorkflowNode,
  rawParams: WorkflowNodeParams
): {
  triggeredByMotion: boolean
  start: number
  end: number
  pct?: number
  triggerXY?: [number, number]
  motionNode?: WorkflowNode
} {
  const compDur = Math.max(1, project.comp.duration || 5)
  const fallbackStart = rawParams.timeStart ?? 0
  const fallbackEnd = rawParams.timeEnd ?? compDur

  if (rawParams.partTriggerMode === 'time') {
    return { triggeredByMotion: false, start: fallbackStart, end: fallbackEnd }
  }

  const motionNode = findLinkedMotionNodeForPart(project, partNode, rawParams)
  if (!motionNode || !motionNode.enabled) {
    return { triggeredByMotion: false, start: fallbackStart, end: fallbackEnd }
  }

  const mp = motionNode.params ?? {}
  const { start: mStart, end: mEnd, cycleDur } = readMotionTimeRange(project, motionNode)
  const lead = resolveMotionLeadLayer(project, motionNode)
  const startPos: Vec3 = lead ? bboxStartPosition(lead, mStart, motionNode.id) : [0, 0, 0]
  const targetX = mp.bboxTargetX ?? Math.round(startPos[0] + 280)
  const targetY = mp.bboxTargetY ?? Math.round(startPos[1])
  const startZ = mp.bboxStartZ ?? startPos[2]
  const targetScaleRatio = Math.max(0.15, Math.min(4.0, (mp.bboxTargetScalePct ?? 135) / 100))
  const targetZ =
    mp.depthMode === 'depth_z'
      ? (mp.bboxTargetZ ?? Math.round(startZ - (targetScaleRatio - 1) * 180))
      : startZ
  const pathType = mp.bboxPathType ?? 'shortest'
  const usesSmoothEase = pathType === 'shortest' && !mp.collisionOnPathEnabled

  const pct = Math.max(0, Math.min(100, rawParams.motionTriggerPct ?? 50))
  const spatialU = pct / 100
  const timeU = usesSmoothEase ? invertEaseInOutSpatialRatio(spatialU) : spatialU
  const triggerTime = Number(
    Math.min(compDur - 0.1, Math.max(0, mStart + timeU * cycleDur)).toFixed(2)
  )

  const pt = evaluateBboxTrajectoryAt(
    startPos,
    targetX,
    targetY,
    startZ,
    targetZ,
    targetScaleRatio,
    spatialU,
    pathType,
    mp.customMotionPath
  )

  const holdForever = rawParams.partSwapHoldAfterEnd ?? true
  const holdSec = Math.max(0.25, rawParams.motionTriggerHoldSec ?? 1.5)
  const endTime = holdForever
    ? Number(Math.max(triggerTime + 0.25, Math.min(compDur, Math.max(mEnd, fallbackEnd))).toFixed(2))
    : Number(Math.min(compDur, Math.max(triggerTime + 0.25, triggerTime + holdSec)).toFixed(2))

  return {
    triggeredByMotion: true,
    start: triggerTime,
    end: endTime,
    pct,
    triggerXY: [Math.round(pt.x), Math.round(pt.y)],
    motionNode
  }
}
