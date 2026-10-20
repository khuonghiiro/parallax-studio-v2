import type {
  Project,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'
import {
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import { formatRuleBadge } from '../../project/workflowStageEffects'
import { classifyLayerRole, resolveNodeTargetBinding } from '../../project/workflowTargets'

export const NODE_W = 248
export const HEADER_H = 24
export const SOCKET_PAD_TOP = 3
export const SOCKET_ROW_H = 18

export function estimateNodeCardHeight(node: WorkflowNode): number {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const rows = Math.max(spec?.inputs.length ?? 1, spec?.outputs.length ?? 1, 1)
  return HEADER_H + SOCKET_PAD_TOP * 2 + Math.min(rows, 3) * SOCKET_ROW_H + 116
}

/** Tọa độ tâm chính xác tuyệt đối của chân cắm Port Đầu Ra (nằm đúng trên tâm vòng tròn pin) */
export function getOutputSocketCoords(
  node: WorkflowNode,
  port: WorkflowPortKind
): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.outputs.indexOf(port) ?? 0)
  return {
    x: node.position.x + NODE_W + 9,
    y: node.position.y + HEADER_H + SOCKET_PAD_TOP + idx * SOCKET_ROW_H + SOCKET_ROW_H / 2
  }
}

/** Tọa độ tâm chính xác tuyệt đối của chân cắm Port Đầu Vào (nằm đúng trên tâm vòng tròn pin) */
export function getInputSocketCoords(
  node: WorkflowNode,
  port: WorkflowPortKind
): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.inputs.indexOf(port) ?? 0)
  return {
    x: node.position.x - 9,
    y: node.position.y + HEADER_H + SOCKET_PAD_TOP + idx * SOCKET_ROW_H + SOCKET_ROW_H / 2
  }
}

/**
 * Tìm cổng Input phù hợp nhất trên targetNode khi nối từ cổng fromPort của sourceNode
 */
export function getBestMatchingInputPort(
  fromPort: WorkflowPortKind,
  targetNode: WorkflowNode
): WorkflowPortKind | null {
  const spec = WORKFLOW_NODE_SPECS[targetNode.type]
  if (!spec || spec.inputs.length === 0) return null

  // 1. Cùng tên cổng chuẩn (ưu tiên tuyệt đối)
  if (spec.inputs.includes(fromPort)) return fromPort

  // 2. Tương thích ngữ nghĩa giữa các khâu
  const compatibilityMap: Record<WorkflowPortKind, WorkflowPortKind[]> = {
    scene_ctx: ['scene_ctx'],
    actors_rig: ['actors_rig', 'scene_ctx'],
    motion_stream: ['motion_stream', 'actors_rig', 'scene_ctx'],
    vfx_stage: ['vfx_stage', 'motion_stream', 'scene_ctx'],
    camera_cut: ['camera_cut', 'scene_ctx'],
    audio_mix: ['audio_mix']
  }

  const candidates = compatibilityMap[fromPort] ?? []
  for (const cand of candidates) {
    if (spec.inputs.includes(cand)) return cand
  }

  // 3. Fallback: cổng vào đầu tiên có sẵn
  return spec.inputs[0]
}

/**
 * Tìm cổng Output phù hợp nhất trên sourceNode khi nối tới cổng toPort của targetNode
 */
export function getBestMatchingOutputPort(
  toPort: WorkflowPortKind,
  sourceNode: WorkflowNode
): WorkflowPortKind | null {
  const spec = WORKFLOW_NODE_SPECS[sourceNode.type]
  if (!spec || spec.outputs.length === 0) return null

  // 1. Cùng tên cổng chuẩn
  if (spec.outputs.includes(toPort)) return toPort

  // 2. Tương thích ngữ nghĩa ngược
  const reverseMap: Record<WorkflowPortKind, WorkflowPortKind[]> = {
    scene_ctx: ['scene_ctx'],
    actors_rig: ['actors_rig'],
    motion_stream: ['motion_stream', 'actors_rig'],
    vfx_stage: ['vfx_stage', 'motion_stream'],
    camera_cut: ['camera_cut'],
    audio_mix: ['audio_mix']
  }

  const candidates = reverseMap[toPort] ?? []
  for (const cand of candidates) {
    if (spec.outputs.includes(cand)) return cand
  }

  return spec.outputs[0]
}

export function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(42, Math.abs(x2 - x1) * 0.48)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
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

    if (corridorBottom - corridorTop >= 12) {
      const laneOffset = fromPort === 'scene_ctx' ? 0.36 : 0.66
      const corridorY = Math.round(corridorTop + (corridorBottom - corridorTop) * laneOffset)
      const entryX = Math.min(p1.x + 96, (p1.x + p2.x) / 2 - 20)
      const exitX = Math.max(p2.x - 96, (p1.x + p2.x) / 2 + 20)
      const c1 = Math.max(36, (entryX - p1.x) * 0.55)
      const c2 = Math.max(36, (p2.x - exitX) * 0.55)

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

/**
 * Mô tả tường minh cấu hình kỹ thuật / thông số chuyển động của từng Khối
 * để người dùng nhìn vào biết ngay khối đó cấu hình ra sao.
 */
export function describeNodeConcreteConfig(node: WorkflowNode, project?: Project): string {
  const intensity = node.params?.intensity ?? 1.0
  const pct = `${Math.round(intensity * 100)}%`
  const customRules = (node.params?.customRules ?? []).filter((r) => r.enabled)

  if (customRules.length > 0) {
    const ruleSummary = customRules.map((r) => formatRuleBadge(r)).join(' · ')
    return `${ruleSummary}`
  }

  switch (node.type) {
    case 'scene_shot':
      if (node.preset === 'intimate_portrait_stage') {
        return `Tầng Z cận: 1400 ➔ 750 ➔ 320 ➔ 0 ➔ -60 (${pct})`
      }
      if (node.preset === 'grounded_3d_stage') {
        return `Sàn 3D (-90°) + Giãn 5 tầng Z (3200 ➔ -120)`
      }
      return `Giãn 5 tầng Z: 3200 ➔ 1800 ➔ 850 ➔ 0 ➔ -120 (${pct})`

    case 'layer_assembly':
      if (node.preset === 'arch3d_and_props') {
        return `Giữ khối 3D kiến trúc · Khóa nhóm Composite`
      }
      if (node.preset === 'expr_variant_actors') {
        return `Nhóm bộ phận 2.5D · Đổi biểu cảm Mắt/Miệng`
      }
      return `Neo chân [0, -0.5] · Tự hướng Camera (Billboard Y)`

    case 'motion_choreography':
      if (node.preset === 'character_walk_depth') {
        return `Bước đi trục Z (${node.params?.duration ?? 6}s) + Gió cây (${pct})`
      }
      if (node.preset === 'dynamic_action_arc') {
        return `Bật nhảy Parabol (${node.params?.duration ?? 5}s) + Tà áo bay (${pct})`
      }
      return `Cây: Gió ${(0.85 * intensity).toFixed(2)}Hz · Mây: Trôi ${Math.round(18 * intensity)}px/s · Thở ${(0.7 * intensity).toFixed(2)}Hz`

    case 'physics_fx':
      if (node.preset === 'combat_elastic_glow') {
        return `Mesh đàn hồi (Nảy ${(1.15 * intensity).toFixed(2)}) + Viền Glow 8px`
      }
      if (node.preset === 'cave_portal_flashlight') {
        return `Cửa hang UV (Tối 82%) + Đèn pin 54° (R:520)`
      }
      return `Đèn nến 2.5D (R:440, Gió nhẹ) + Hạt đom đóm`

    case 'camera_director': {
      const shots = project?.shots.length ?? 1
      const dofOn = project ? project.camera.dofEnabled : node.params?.enableDof !== false
      const dof = dofOn ? 'DOF Xóa phông' : 'Nét toàn cảnh'
      if (project && project.camera.position.keyframes.length > 0) {
        const kfCount = project.camera.position.keyframes.length
        const visitedShotIds = new Set<string>()
        for (const k of project.camera.target.keyframes) {
          const s = project.shots.find(
            (sh) =>
              Math.hypot(sh.position.value[0] - k.value[0], sh.position.value[1] - k.value[1]) <
              1200
          )
          if (s) visitedShotIds.add(s.id)
        }
        const shakeVal = project.camera.shakeAmount ?? 0
        const shakeTag = shakeVal > 0.2 ? ` · Rung ${shakeVal}` : ''
        return `Lộ trình ${kfCount} mốc (${Math.max(1, visitedShotIds.size || shots)} cảnh) · ${dof}${shakeTag}`
      }
      if (node.preset === 'cinematic_fly_push') {
        return `Bay qua ${shots} cảnh (Push-in ${Math.round(14 * intensity)}%) · ${dof}`
      }
      if (node.preset === 'orbit_showcase_3d') {
        return `Quỹ đạo xoay vòng 3D Orbit · Rung máy nhẹ`
      }
      if (node.preset === 'dramatic_handheld_action') {
        return `Dolly Zoom kịch tính · Rung Handheld (${Math.round(6 * intensity)})`
      }
      return `Đẩy cận Slow Dolly-In (${node.params?.duration ?? 8}s) · ${dof}`
    }

    case 'audio_lipsync':
      if (node.preset === 'voice_lipsync_bgm' || node.params?.autoLipSync) {
        return `Nhép môi 2.5D theo sóng âm + EQ Thoại & Fade`
      }
      return `Nhạc nền EQ Ấm (Warm) · Fade vào 0.6s / ra 1.0s`

    case 'look_output':
      if (project?.look) {
        const lk = project.look
        const satPct = Math.round((lk.saturation ?? 1) * 100)
        if (lk.fogEnabled) {
          return `Sương ${lk.fogColor} (Z:${lk.fogNear}→${lk.fogFar}) · Tương phản ${(lk.contrast ?? 1).toFixed(2)} · Rực ${satPct}%`
        }
        const exp = lk.exposure ?? 0
        return `Tắt sương · Phơi sáng ${exp >= 0 ? '+' : ''}${exp.toFixed(2)} · Tương phản ${(lk.contrast ?? 1).toFixed(2)} · Rực ${satPct}%`
      }
      if (node.preset === 'mystic_night_glow') {
        return `Sương đêm #161936 (Z:1200→5200) · Vignette 0.38`
      }
      if (node.preset === 'vibrant_anime_clean') {
        return `Tắt sương · Tăng rực màu 116% · Phơi sáng +0.08`
      }
      return `Sương mù 3D (Z:1400→5800) · Tương phản 1.08 · Vignette 0.28`
  }
}

/**
 * Chẩn đoán lý do vì sao một Khối bị ngắt khỏi luồng thực thi (Disconnected / Unpowered).
 */
export function diagnoseNodeDisconnectReason(
  node: WorkflowNode,
  workflow: WorkflowGraph | undefined,
  activeNodeIds: Set<string>
): string {
  if (!node.enabled) {
    return '○ Khối đang TẮT (OFF) — Bấm ON để kích hoạt'
  }
  const spec = WORKFLOW_NODE_SPECS[node.type]
  if (!workflow || !spec) {
    return '⛔ Chưa nối cổng Port vào luồng thực thi'
  }
  if (spec.inputs.length === 0) {
    return '⛔ Đứt luồng: Hãy nối cổng [Cảnh 3D] sang Lắp ráp hoặc Camera 3D'
  }

  const incomingEdges: WorkflowEdge[] = workflow.edges.filter((e) => e.toNode === node.id)
  if (incomingEdges.length === 0) {
    const portNames = spec.inputs.map((p) => WORKFLOW_PORT_SPECS[p]?.shortLabel ?? p).join(' / ')
    return `⛔ Đứt luồng: Chưa nối dây vào cổng [${portNames}]`
  }

  const upstreamNodeIds = incomingEdges.map((e) => e.fromNode)
  const anyActiveUpstream = upstreamNodeIds.some((id) => activeNodeIds.has(id))
  if (!anyActiveUpstream) {
    const firstUp = workflow.nodes.find((n) => n.id === upstreamNodeIds[0])
    const upName = firstUp ? (WORKFLOW_NODE_SPECS[firstUp.type]?.shortTitle ?? firstUp.title) : 'Khối trước'
    return `⚠️ Mất nguồn: "${upName}" chưa được nối từ Phân cảnh #1`
  }

  return '⛔ Chưa nối vào lộ trình thực thi'
}

export interface NodeRuntimeTelemetry {
  state: 'running' | 'ready' | 'disconnected' | 'disabled'
  badgeText: string
  routeText: string
  configSummary: string
  liveSummary: string
  progressPct: number
  isStageHighlight: boolean
}

/**
 * Tính toán thông số lộ trình, cấu hình chuyển động và luồng xử lý thời gian thực của từng Khối.
 */
export function evaluateNodeRuntimeTelemetry(
  node: WorkflowNode,
  project: Project | undefined,
  rawTime: number,
  playing: boolean,
  isConnected: boolean,
  stepNum?: number,
  totalSteps = 7,
  workflow?: WorkflowGraph,
  activeNodeIds?: Set<string>
): NodeRuntimeTelemetry {
  const time = Number.isFinite(rawTime) ? rawTime : 0
  const configSummary = describeNodeConcreteConfig(node, project)

  if (!node.enabled) {
    return {
      state: 'disabled',
      badgeText: 'Đã tắt',
      routeText: 'Đã tắt (OFF)',
      configSummary,
      liveSummary: '○ Khối đang TẮT (OFF) — Đã ngắt hiệu ứng khỏi cảnh.',
      progressPct: 0,
      isStageHighlight: false
    }
  }

  if (!isConnected) {
    const reason = diagnoseNodeDisconnectReason(
      node,
      workflow,
      activeNodeIds ?? new Set<string>()
    )
    return {
      state: 'disconnected',
      badgeText: 'Đứt luồng',
      routeText: 'Ngắt kết nối',
      configSummary,
      liveSummary: reason,
      progressPct: 0,
      isStageHighlight: false
    }
  }

  const duration = Math.max(1, project?.comp.duration ?? 10)
  const timelinePct = Math.max(0, Math.min(100, Math.round((time / duration) * 100)))

  // Sóng lộ trình tuần tự đi qua từng Bước #1 -> #N để người dùng nhìn rõ thứ tự xử lý
  const stepIndex = Math.max(0, (stepNum ?? 1) - 1)
  const activeStepCursor = Math.floor((time * 1.8) % Math.max(1, totalSteps))
  const isStageHighlight = playing && activeStepCursor === stepIndex

  const routeText = `Lộ trình Bước #${stepNum ?? 1}/${totalSteps}`

  if (!project) {
    return {
      state: playing ? 'running' : 'ready',
      badgeText: isStageHighlight ? `⚡ Đang xử lý #${stepNum}` : `✓ Bước #${stepNum}`,
      routeText,
      configSummary,
      liveSummary: `${routeText} · Sẵn sàng xử lý`,
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
      const camTarget = project.camera.target.keyframes.length
        ? project.camera.target.keyframes.reduce((best, k) =>
            Math.abs(k.t - time) < Math.abs(best.t - time) ? k : best
          ).value
        : project.camera.target.value
      const activeShot =
        project.shots.find(
          (s) => Math.hypot(s.position.value[0] - camTarget[0], s.position.value[1] - camTarget[1]) < 1200
        ) ?? project.shots[0]
      const shotName = activeShot?.name ?? 'Cảnh 1'
      liveSummary = `Bước #${stepNum}: Đang nạp "${shotName}" (${visibleAtTime.length}/${matchedLayers.length} lớp hiển thị)`
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
          ? `Bước #${stepNum}: Khóa gốc xoay ${rigCount} cụm (${visibleAtTime.length} lớp)`
          : `Bước #${stepNum}: Đồng bộ gốc neo cho ${visibleAtTime.length} lớp 2.5D`
      break
    }
    case 'motion_choreography': {
      const movingLayers = visibleAtTime.filter(
        (l) =>
          (l.motion && l.motion.enabled && l.motion.type !== 'none') ||
          l.transform.position.keyframes.length > 0 ||
          l.transform.rotation.keyframes.length > 0
      )
      const customCount = (node.params?.customRules ?? []).filter((r) => r.enabled).length
      liveSummary =
        movingLayers.length > 0
          ? `Bước #${stepNum}: Đang chạy chuyển động trên ${movingLayers.length} lớp${customCount > 0 ? ` (+${customCount} quy tắc riêng)` : ''}`
          : `Bước #${stepNum}: Sẵn sàng tác động lên ${visibleAtTime.length} lớp`
      break
    }
    case 'physics_fx': {
      const physCount = visibleAtTime.filter((l) => l.physics?.enabled).length
      const lightCount = visibleAtTime.filter((l) => l.virtualLight?.enabled).length
      const glowCount = visibleAtTime.filter((l) => l.glow?.enabled).length
      const ptCount = project.layers.filter(
        (l) => l.type === 'particles' && l.visible && l.inPoint <= time && time <= l.outPoint
      ).length
      liveSummary = `Bước #${stepNum}: Đèn ảo (${lightCount}) · Mesh (${physCount}) · Hạt/Glow (${ptCount + glowCount})`
      break
    }
    case 'camera_director': {
      const kfCount = project.camera.position.keyframes.length
      const zNow = Math.round(project.camera.position.value[2] ?? 1000)
      liveSummary =
        kfCount > 0
          ? `Bước #${stepNum}: Đang bay Camera (${kfCount} mốc · Tiến độ ${timelinePct}% · Z:${zNow})`
          : `Bước #${stepNum}: Giữ góc máy tĩnh Z:${zNow} · FOV ${project.camera.fov.value}°`
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
      liveSummary =
        tracks.length > 0
          ? `Bước #${stepNum}: Phát ${activeTracks.length}/${tracks.length} kênh${lipSyncActive ? ' · Đang nhép môi 2.5D' : ''}`
          : `Bước #${stepNum}: Chờ gắn track âm thanh (${visibleAtTime.filter((l) => classifyLayerRole(l) === 'character').length} nhân vật)`
      break
    }
    case 'look_output': {
      const fps = project.comp.fps ?? 30
      const curFrame = Math.min(Math.floor(duration * fps), Math.floor(time * fps))
      const totalFrames = Math.floor(duration * fps)
      liveSummary = `Bước #${stepNum}: Kết xuất Khung #${curFrame}/${totalFrames} (${timelinePct}%)`
      break
    }
  }

  return {
    state: playing ? 'running' : 'ready',
    badgeText: isStageHighlight ? `⚡ Đang xử lý` : `✓ Bước #${stepNum}`,
    routeText,
    configSummary,
    liveSummary,
    progressPct: timelinePct,
    isStageHighlight
  }
}
