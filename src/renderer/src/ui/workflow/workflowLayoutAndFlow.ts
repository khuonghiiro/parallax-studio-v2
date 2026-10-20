import type {
  Project,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'
import {
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import { classifyLayerRole, resolveNodeTargetBinding } from '../../project/workflowTargets'

export const NODE_W = 248
export const HEADER_H = 24
export const SOCKET_PAD_TOP = 3
export const SOCKET_ROW_H = 18

export function estimateNodeCardHeight(node: WorkflowNode): number {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const rows = Math.max(spec?.inputs.length ?? 1, spec?.outputs.length ?? 1, 1)
  return HEADER_H + SOCKET_PAD_TOP * 2 + rows * SOCKET_ROW_H + 108
}

/** Tọa độ tâm chính xác tuyệt đối của chân cắm Port Đầu Ra (nằm đúng trên mép phải khối) */
export function getOutputSocketCoords(
  node: WorkflowNode,
  port: WorkflowPortKind
): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.outputs.indexOf(port) ?? 0)
  return {
    x: node.position.x + NODE_W,
    y: node.position.y + HEADER_H + SOCKET_PAD_TOP + idx * SOCKET_ROW_H + SOCKET_ROW_H / 2
  }
}

/** Tọa độ tâm chính xác tuyệt đối của chân cắm Port Đầu Vào (nằm đúng trên mép trái khối) */
export function getInputSocketCoords(
  node: WorkflowNode,
  port: WorkflowPortKind
): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.inputs.indexOf(port) ?? 0)
  return {
    x: node.position.x,
    y: node.position.y + HEADER_H + SOCKET_PAD_TOP + idx * SOCKET_ROW_H + SOCKET_ROW_H / 2
  }
}

export function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(42, Math.abs(x2 - x1) * 0.48)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

/**
 * Phát hiện bố cục cũ bị dày đặc / chồng lấn (khoảng cách ngang < 60px hoặc dọc < 170px)
 * để tự động nâng cấp sang bố cục thoáng chuẩn mới.
 */
export function isLegacyCrampedWorkflowLayout(nodes: WorkflowNode[]): boolean {
  if (!nodes || nodes.length < 2) return false
  const byType = new Map<WorkflowNodeType, WorkflowNode>(nodes.map((n) => [n.type, n]))
  const assembly = byType.get('layer_assembly')
  const motion = byType.get('motion_choreography')
  const audio = byType.get('audio_lipsync')
  const physics = byType.get('physics_fx')
  const camera = byType.get('camera_director')

  // Bố cục mặc định cũ có layer_assembly.x = 294 hoặc khoảng cách dọc giữa motion và audio <= 165
  if (assembly && assembly.position.x <= 310) return true
  if (motion && audio && Math.abs(audio.position.y - motion.position.y) < 175) return true
  if (physics && camera && Math.abs(camera.position.y - physics.position.y) < 175) return true
  return false
}

export function upgradeCrampedNodePositions(nodes: WorkflowNode[]): WorkflowNode[] {
  if (!isLegacyCrampedWorkflowLayout(nodes)) return nodes
  return nodes.map((n) => ({
    ...n,
    position: { ...(DEFAULT_NODE_POSITIONS[n.type] ?? n.position) }
  }))
}

export interface SmartEdgeGeometry {
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  path: string
  midX: number
  midY: number
  color: string
  label: string
}

/**
 * Tính toán đường cong Bezier thông minh cho dây nối Port.
 * Nếu dây nối bắc qua nhiều cột (multi-column span), tự động định tuyến mượt qua
 * hành lang trống ở giữa (Open Corridor) để dây không đè xuyên qua thân các khối khác.
 */
export function buildSmartEdgeGeometry(
  fromNode: WorkflowNode,
  fromPort: WorkflowPortKind,
  toNode: WorkflowNode,
  toPort: WorkflowPortKind,
  allNodes: WorkflowNode[]
): SmartEdgeGeometry {
  const p1 = getOutputSocketCoords(fromNode, fromPort)
  const p2 = getInputSocketCoords(toNode, toPort)
  const portSpec = WORKFLOW_PORT_SPECS[fromPort]
  const color = portSpec?.color ?? '#38bdf8'
  const label = portSpec?.shortLabel ?? fromPort

  const spanX = p2.x - p1.x
  const intermediateNodes = allNodes.filter(
    (n) =>
      n.id !== fromNode.id &&
      n.id !== toNode.id &&
      n.position.x + NODE_W > p1.x + 20 &&
      n.position.x < p2.x - 20
  )

  if (spanX > NODE_W + 60 && intermediateNodes.length > 0) {
    // Tìm hành lang ngang thông thoáng giữa hàng khối trên và hàng khối dưới
    const topRowBottoms: number[] = []
    const bottomRowTops: number[] = []
    for (const n of allNodes) {
      const h = estimateNodeCardHeight(n)
      if (n.position.y < 100) {
        topRowBottoms.push(n.position.y + h)
      } else if (n.position.y >= 190) {
        bottomRowTops.push(n.position.y)
      }
    }
    const corridorTop = topRowBottoms.length > 0 ? Math.max(...topRowBottoms) : 174
    const corridorBottom = bottomRowTops.length > 0 ? Math.min(...bottomRowTops) : 256

    if (corridorBottom - corridorTop >= 36) {
      const laneOffset = fromPort === 'scene_ctx' ? 0.36 : 0.66
      const corridorY = Math.round(corridorTop + (corridorBottom - corridorTop) * laneOffset)
      const entryX = Math.min(p1.x + 96, (p1.x + p2.x) / 2 - 20)
      const exitX = Math.max(p2.x - 96, (p1.x + p2.x) / 2 + 20)
      const c1 = Math.max(36, (entryX - p1.x) * 0.55)
      const c2 = Math.max(36, ( p2.x - exitX) * 0.55)

      const path = [
        `M ${p1.x} ${p1.y}`,
        `C ${p1.x + c1} ${p1.y}, ${entryX - c1} ${corridorY}, ${entryX} ${corridorY}`,
        `L ${exitX} ${corridorY}`,
        `C ${exitX + c2} ${corridorY}, ${p2.x - c2} ${p2.y}, ${p2.x} ${p2.y}`
      ].join(' ')

      return {
        p1,
        p2,
        path,
        midX: Math.round((entryX + exitX) / 2),
        midY: corridorY,
        color,
        label
      }
    }
  }

  return {
    p1,
    p2,
    path: buildBezierPath(p1.x, p1.y, p2.x, p2.y),
    midX: Math.round((p1.x + p2.x) / 2),
    midY: Math.round((p1.y + p2.y) / 2),
    color,
    label
  }
}

export interface NodeRuntimeTelemetry {
  state: 'running' | 'ready' | 'disconnected' | 'disabled'
  badgeText: string
  liveSummary: string
  progressPct: number
  isStageHighlight: boolean
}

/**
 * Tính toán thông số luồng xử lý thời gian thực (Live Runtime Telemetry) của từng Khối
 * khi chạy video (playing) hoặc tua thời gian (time) trên Timeline.
 */
export function evaluateNodeRuntimeTelemetry(
  node: WorkflowNode,
  project: Project | undefined,
  time: number,
  playing: boolean,
  isConnected: boolean,
  stepNum?: number,
  totalSteps = 7
): NodeRuntimeTelemetry {
  if (!node.enabled) {
    return {
      state: 'disabled',
      badgeText: 'Đã tắt',
      liveSummary: 'Khối này đang tắt — bỏ qua trong luồng xử lý.',
      progressPct: 0,
      isStageHighlight: false
    }
  }

  if (!isConnected) {
    return {
      state: 'disconnected',
      badgeText: 'Chưa nối',
      liveSummary: 'Chưa nối cổng Port vào chuỗi thực thi.',
      progressPct: 0,
      isStageHighlight: false
    }
  }

  const duration = Math.max(1, project?.comp.duration ?? 10)
  const fps = project?.comp.fps ?? 30
  const timelinePct = Math.max(0, Math.min(100, Math.round((time / duration) * 100)))

  // Hiệu ứng sóng luồng chạy tuần tự qua các bước #1 -> #7 khi video đang phát
  const stepIndex = Math.max(0, (stepNum ?? 1) - 1)
  const cyclePos = (time * 2.2) % Math.max(1, totalSteps)
  const isStageHighlight = playing && Math.abs(cyclePos - stepIndex) < 0.85

  if (!project) {
    return {
      state: playing ? 'running' : 'ready',
      badgeText: playing ? '⚡ Đang chạy' : '● Sẵn sàng',
      liveSummary: `Bước #${stepNum ?? 1} · Sẵn sàng xử lý cảnh`,
      progressPct: playing ? timelinePct : 100,
      isStageHighlight
    }
  }

  const binding = resolveNodeTargetBinding(node, project)
  const matchedLayers = project.layers.filter((l) => binding.matchesLayer(l))
  const visibleAtTime = matchedLayers.filter(
    (l) => l.visible && l.inPoint <= time && time <= l.outPoint
  )

  let liveSummary = ''
  switch (node.type) {
    case 'scene_shot': {
      const activeShot =
        project.shots.find((s) => time >= s.start && time <= s.start + s.duration) ??
        project.shots[0]
      const shotName = activeShot?.name ?? 'Cảnh 1'
      liveSummary = `${shotName} · ${visibleAtTime.length}/${matchedLayers.length} lớp hiển thị @ ${time.toFixed(1)}s`
      break
    }
    case 'layer_assembly': {
      const compIds = new Set(
        visibleAtTime.map((l) => l.composite?.instanceId).filter(Boolean)
      )
      const modelIds = new Set(
        visibleAtTime.map((l) => l.model3d?.instanceId).filter(Boolean)
      )
      const rigCount = compIds.size + modelIds.size
      liveSummary =
        rigCount > 0
          ? `Đang đồng bộ ${rigCount} cụm 2.5D/3D (${visibleAtTime.length} lớp) · Neo Billboard`
          : `Đồng bộ ${visibleAtTime.length} lớp cảnh 2.5D · Gốc xoay chuẩn`
      break
    }
    case 'motion_choreography': {
      const movingCount = visibleAtTime.filter(
        (l) =>
          (l.motion && l.motion.enabled && l.motion.type !== 'none') ||
          l.transform.position.keyframes.length > 0 ||
          l.transform.rotation.keyframes.length > 0
      ).length
      const waveVal = Math.round(Math.sin(time * 2.4) * 100)
      liveSummary =
        movingCount > 0
          ? `${movingCount} lớp đang diễn hoạt (Gió/Thở) · Nhịp ${waveVal >= 0 ? `+${waveVal}` : waveVal}%`
          : `Nội suy chuyển động cho ${visibleAtTime.length} lớp (${ binding.activeParts.length} kênh)`
      break
    }
    case 'physics_fx': {
      const physCount = visibleAtTime.filter((l) => l.physics?.enabled).length
      const lightCount = visibleAtTime.filter((l) => l.virtualLight?.enabled).length
      const glowCount = visibleAtTime.filter((l) => l.glow?.enabled).length
      const ptCount = project.layers.filter(
        (l) => l.type === 'particles' && l.visible && l.inPoint <= time && time <= l.outPoint
      ).length
      const totalFx = physCount + lightCount + glowCount + ptCount
      liveSummary =
        totalFx > 0
          ? `Mesh: ${physCount} · Đèn ảo: ${lightCount} · Hạt/Glow: ${ptCount + glowCount} đang phát`
          : `Mô phỏng Vật lý 2.5D & Ánh sáng theo gió @ ${time.toFixed(1)}s`
      break
    }
    case 'camera_director': {
      const kfCount = project.camera.position.keyframes.length
      const zNow = Math.round(project.camera.position.value[2] ?? 1000)
      const dofTag = project.camera.dofEnabled ? 'DOF Bật' : 'Phối cảnh 3D'
      liveSummary =
        kfCount > 0
          ? `Bay Spline (${kfCount} mốc · ${timelinePct}%) · Z:${zNow} · ${dofTag}`
          : `Máy quay 3D Z:${zNow} · FOV ${project.camera.fov.value}° · ${dofTag}`
      break
    }
    case 'audio_lipsync': {
      const tracks = project.audioTracks ?? []
      const activeTracks = tracks.filter((tr) => {
        if (tr.muted) return false
        const start = tr.offset ?? 0
        const end = start + (tr.duration || duration)
        return time >= start && time <= end
      })
      const lipSyncActive = activeTracks.some((tr) => tr.lipSyncEnabled)
      const mouthCount = visibleAtTime.filter((l) => classifyLayerRole(l) === 'character').length
      liveSummary =
        tracks.length > 0
          ? `Phát ${activeTracks.length}/${tracks.length} kênh âm thanh${lipSyncActive ? ' · Đang nhép môi 2.5D' : ''}`
          : `Sẵn sàng bộ lọc thoại & Lip-Sync (${mouthCount} lớp nhân vật)`
      break
    }
    case 'look_output': {
      const curFrame = Math.min(Math.floor(duration * fps), Math.floor(time * fps))
      const totalFrames = Math.floor(duration * fps)
      const fogTag = project.look.fogEnabled ? 'Fog 3D' : 'Màu trong'
      liveSummary = `Khung #${curFrame}/${totalFrames} (${timelinePct}%) · ${fogTag} + Vignette`
      break
    }
  }

  return {
    state: playing ? 'running' : 'ready',
    badgeText: playing ? `⚡ Đang xử lý` : `● Sẵn sàng`,
    liveSummary,
    progressPct: timelinePct,
    isStageHighlight
  }
}
