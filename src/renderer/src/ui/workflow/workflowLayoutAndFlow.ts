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
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'

export const NODE_W = 248
export const HEADER_H = 24
export const SOCKET_PAD_TOP = 3
export const SOCKET_ROW_H = 18

export function estimateNodeCardHeight(node: WorkflowNode): number {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const rows = Math.max(spec?.inputs.length ?? 1, spec?.outputs.length ?? 1, 1)
  const isLogic = Boolean(node.params?.logicId)
  if (isLogic) {
    return HEADER_H + SOCKET_PAD_TOP * 2 + Math.min(rows, 3) * SOCKET_ROW_H + 85
  }
  if (node.type === 'scene_shot') {
    return HEADER_H + SOCKET_PAD_TOP * 2 + Math.min(rows, 3) * SOCKET_ROW_H + 204
  }
  if (node.type === 'layer_transform') {
    return 126
  }
  if (node.type === 'layer_assembly' || Boolean(node.params?.targetLayerIds?.length)) {
    return HEADER_H + SOCKET_PAD_TOP * 2 + Math.min(rows, 3) * SOCKET_ROW_H + 205
  }
  return HEADER_H + SOCKET_PAD_TOP * 2 + Math.min(rows, 3) * SOCKET_ROW_H + 150
}

/** Tọa độ tâm chính xác tuyệt đối của chân cắm Port Đầu Ra (nằm đúng trên tâm vòng tròn pin) */
export function getOutputSocketCoords(
  node: WorkflowNode,
  port: WorkflowPortKind
): { x: number; y: number } {
  // Cổng chân đáy (Bottom Port): layers_tree trên Scene hoặc transform_link trên Layer
  if (port === 'layers_tree' || port === 'transform_link') {
    return {
      x: node.position.x + NODE_W / 2,
      y: node.position.y + estimateNodeCardHeight(node) + 6
    }
  }

  const spec = WORKFLOW_NODE_SPECS[node.type]
  const horizOutputs = (spec?.outputs ?? []).filter((p) => p !== 'layers_tree' && p !== 'transform_link')
  const idx = Math.max(0, horizOutputs.indexOf(port))
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
  // Cổng đỉnh đầu (Top Port): layers_tree trên Layer hoặc transform_link trên Transform
  if (port === 'layers_tree' || port === 'transform_link') {
    return {
      x: node.position.x + NODE_W / 2,
      y: node.position.y - 6
    }
  }

  const spec = WORKFLOW_NODE_SPECS[node.type]
  const horizInputs = (spec?.inputs ?? []).filter((p) => p !== 'layers_tree' && p !== 'transform_link')
  const idx = Math.max(0, horizInputs.indexOf(port))
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
  targetNode: WorkflowNode,
  sourceNode?: WorkflowNode
): WorkflowPortKind | null {
  const spec = WORKFLOW_NODE_SPECS[targetNode.type]
  if (!spec || spec.inputs.length === 0) return null

  // 1. Phân loại cổng dọc đặc biệt (Vertical Hierarchical Ports)
  if (fromPort === 'layers_tree') {
    if (sourceNode) {
      const v = validateWorkflowConnection(sourceNode, fromPort, targetNode, 'layers_tree')
      if (!v.valid) return null
    }
    return spec.inputs.includes('layers_tree') ? 'layers_tree' : null
  }
  if (fromPort === 'transform_link') {
    if (sourceNode) {
      const v = validateWorkflowConnection(sourceNode, fromPort, targetNode, 'transform_link')
      if (!v.valid) return null
    }
    return spec.inputs.includes('transform_link') ? 'transform_link' : null
  }

  // 2. Nếu có sourceNode, kiểm tra toàn bộ danh sách inputs của targetNode theo ma trận logic
  if (sourceNode) {
    if (spec.inputs.includes(fromPort)) {
      const v = validateWorkflowConnection(sourceNode, fromPort, targetNode, fromPort)
      if (v.valid) return fromPort
    }
    for (const inPort of spec.inputs) {
      const v = validateWorkflowConnection(sourceNode, fromPort, targetNode, inPort)
      if (v.valid) return inPort
    }
    return null
  }

  // 3. Không cho phép nối chéo cổng ngang vào cổng dọc hoặc ngược lại
  const validInputs = spec.inputs.filter((p) => p !== 'layers_tree' && p !== 'transform_link')
  if (validInputs.includes(fromPort)) return fromPort

  return null
}

/**
 * Tìm cổng Output phù hợp nhất trên sourceNode khi nối tới cổng toPort của targetNode
 */
export function getBestMatchingOutputPort(
  toPort: WorkflowPortKind,
  sourceNode: WorkflowNode,
  targetNode?: WorkflowNode
): WorkflowPortKind | null {
  const spec = WORKFLOW_NODE_SPECS[sourceNode.type]
  if (!spec || spec.outputs.length === 0) return null

  // 1. Phân loại cổng dọc đặc biệt
  if (toPort === 'layers_tree') {
    if (targetNode) {
      const v = validateWorkflowConnection(sourceNode, 'layers_tree', targetNode, toPort)
      if (v.valid) return 'layers_tree'
      const vRig = validateWorkflowConnection(sourceNode, 'actors_rig', targetNode, toPort)
      if (vRig.valid) return 'actors_rig'
      return null
    }
    return spec.outputs.includes('layers_tree') ? 'layers_tree' : null
  }
  if (toPort === 'transform_link') {
    if (targetNode) {
      const v = validateWorkflowConnection(sourceNode, 'transform_link', targetNode, toPort)
      if (!v.valid) return null
    }
    return spec.outputs.includes('transform_link') ? 'transform_link' : null
  }

  // 2. Nếu có targetNode, kiểm tra danh sách outputs của sourceNode theo ma trận logic
  if (targetNode) {
    if (spec.outputs.includes(toPort)) {
      const v = validateWorkflowConnection(sourceNode, toPort, targetNode, toPort)
      if (v.valid) return toPort
    }
    for (const outPort of spec.outputs) {
      const v = validateWorkflowConnection(sourceNode, outPort, targetNode, toPort)
      if (v.valid) return outPort
    }
    return null
  }

  const validOutputs = spec.outputs.filter((p) => p !== 'layers_tree' && p !== 'transform_link')
  if (validOutputs.includes(toPort)) return toPort

  return null
}

export function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const distX = Math.abs(x2 - x1)
  const distY = Math.abs(y2 - y1)
  const dx = Math.max(72, Math.min(320, distX * 0.45 + distY * 0.16))
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
 * Tính toán đường cong Bezier thông minh chuẩn mực cho dây nối Port.
 * Triệt tiêu hoàn toàn các đoạn gãy khúc, bảo đảm tiếp tuyến 2 đầu chân cắm luôn nằm ngang
 * tuyệt đối (dy/dx = 0) và uốn lượn mềm mại chuẩn Unreal Engine / Blender / ComfyUI.
 */
export function buildSmartEdgeGeometry(
  fromNode: WorkflowNode,
  fromPort: WorkflowPortKind,
  toNode: WorkflowNode,
  toPort: WorkflowPortKind,
  _allNodes?: WorkflowNode[]
): SmartEdgeGeometry {
  const p1 = getOutputSocketCoords(fromNode, fromPort)
  const p2 = getInputSocketCoords(toNode, toPort)
  const portSpec = WORKFLOW_PORT_SPECS[fromPort]
  const color = portSpec?.color ?? '#38bdf8'
  const label = portSpec?.shortLabel ?? fromPort

  if (fromPort === 'transform_link' || toPort === 'transform_link') {
    // Thước nối thẳng đứng (Laser tether) giữa Layer và Companion Transform Plate
    const path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
    return {
      p1,
      p2,
      path,
      midX: Math.round((p1.x + p2.x) / 2),
      midY: Math.round((p1.y + p2.y) / 2),
      color: '#0284c7',
      label
    }
  }

  if (fromPort === 'layers_tree' || toPort === 'layers_tree') {
    // Dây nối nan quạt dọc từ đáy Cảnh gốc tới đỉnh Layer con theo đường cong spline tự nhiên
    const dy = Math.max(48, Math.min(240, Math.abs(p2.y - p1.y) * 0.5))
    const path = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + dy}, ${p2.x} ${p2.y - dy}, ${p2.x} ${p2.y}`
    return {
      p1,
      p2,
      path,
      midX: Math.round((p1.x + p2.x) / 2),
      midY: Math.round((p1.y + p2.y) / 2),
      color: '#8b5cf6',
      label
    }
  }

  // Dây nối ngang chuẩn mực giữa các cổng bên phải và bên trái (Smooth Horizontal Cubic Bezier)
  // Tiếp tuyến tại cổng ra luôn hướng ngang sang phải (+X), tại cổng vào luôn hướng ngang từ trái (+X)
  const distX = Math.abs(p2.x - p1.x)
  const distY = Math.abs(p2.y - p1.y)
  const dx = Math.max(72, Math.min(320, distX * 0.45 + distY * 0.16))
  const path = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`

  return {
    p1,
    p2,
    path,
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

    case 'layer_transform': {
      const boundLayer = project?.layers.find((l) => node.params?.targetLayerIds?.includes(l.id))
      if (boundLayer) {
        const x = Math.round(boundLayer.transform.position.value[0] ?? 0)
        const y = Math.round(boundLayer.transform.position.value[1] ?? 0)
        const z = Math.round(boundLayer.transform.position.value[2] ?? 0)
        const rot = Math.round(boundLayer.transform.rotation.value[2] ?? 0)
        return `X: ${x > 0 ? '+' : ''}${x}px · Y: ${y > 0 ? '+' : ''}${y}px · Z: ${z}px · Xoay: ${rot}°`
      }
      return 'Điều khiển trực tiếp X/Y/Z & Góc xoay 60fps'
    }

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
      if (node.preset === 'pan_and_dolly' || node.params?.camChoreography === 'pan_and_dolly') {
        const dur = node.params?.duration ?? 6
        const panPct = Math.round((node.params?.camPanDurationRatio ?? 0.45) * 100)
        return `Lia máy (${panPct}%) ➔ Zoom to dần (${dur}s) · ${dof}`
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

/**
 * Logic Đẩy Node Ra (Collision Avoidance & Repulsion) khi kéo thả.
 * Nếu vị trí thả của thẻ node bị giao cắt / đè lên bất kỳ node nào khác,
 * thuật toán tự động đẩy thẻ ra khoảng trống an toàn gần nhất theo trục Y/X.
 */
export function resolveNodeCollisionPush(
  targetNode: WorkflowNode,
  proposedPos: { x: number; y: number },
  allNodes: WorkflowNode[]
): { x: number; y: number } {
  let resolvedX = Math.round(proposedPos.x)
  let resolvedY = Math.max(20, Math.round(proposedPos.y))
  const targetH = estimateNodeCardHeight(targetNode)
  const PAD_X = 28
  const PAD_Y = 24

  // Lặp tối đa 4 lượt để giải quyết va chạm liên hoàn (cascading collision)
  for (let pass = 0; pass < 4; pass++) {
    let collided = false

    for (const other of allNodes) {
      if (other.id === targetNode.id) continue

      const otherH = estimateNodeCardHeight(other)
      const isOverlapX =
        resolvedX < other.position.x + NODE_W + PAD_X &&
        resolvedX + NODE_W + PAD_X > other.position.x
      const isOverlapY =
        resolvedY < other.position.y + otherH + PAD_Y &&
        resolvedY + targetH + PAD_Y > other.position.y

      if (isOverlapX && isOverlapY) {
        collided = true
        const centerTargetY = resolvedY + targetH / 2
        const centerOtherY = other.position.y + otherH / 2

        if (centerTargetY >= centerOtherY) {
          // Đẩy xuống dưới node bị đè
          resolvedY = other.position.y + otherH + PAD_Y
        } else {
          // Đẩy lên trên nếu còn khoảng trống, ngược lại đẩy xuống
          const candidateUp = other.position.y - targetH - PAD_Y
          resolvedY = candidateUp >= 20 ? candidateUp : other.position.y + otherH + PAD_Y
        }
      }
    }

    if (!collided) break
  }

  return { x: resolvedX, y: resolvedY }
}

/**
 * Thuật toán Khử Chồng Đè Toàn Diện (Comprehensive Anti-Overlap Relaxation Pass):
 * Kiểm tra tất cả các cặp node sau bố cục. Nếu có bất kỳ sự giao cắt bounding box nào,
 * thuật toán tự động đẩy dãn khoảng cách đảm bảo triệt tiêu hoàn toàn hiện tượng chồng đè (0% overlap).
 */
export function relaxOverlappingPositions(
  positions: Record<string, { x: number; y: number }>,
  nodes: WorkflowNode[]
): Record<string, { x: number; y: number }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const ids = Object.keys(positions)
  const PAD_X = 28
  const PAD_Y = 24

  for (let pass = 0; pass < 5; pass++) {
    let hadCollision = false
    for (let i = 0; i < ids.length; i++) {
      const idA = ids[i]
      const posA = positions[idA]
      const nodeA = nodeMap.get(idA)
      if (!posA || !nodeA) continue
      const hA = estimateNodeCardHeight(nodeA)

      for (let j = i + 1; j < ids.length; j++) {
        const idB = ids[j]
        const posB = positions[idB]
        const nodeB = nodeMap.get(idB)
        if (!posB || !nodeB) continue
        const hB = estimateNodeCardHeight(nodeB)

        const overlapX =
          posA.x < posB.x + NODE_W + PAD_X &&
          posA.x + NODE_W + PAD_X > posB.x
        const overlapY =
          posA.y < posB.y + hB + PAD_Y &&
          posA.y + hA + PAD_Y > posB.y

        if (overlapX && overlapY) {
          hadCollision = true
          if (Math.abs(posA.x - posB.x) < NODE_W * 0.7) {
            if (posB.y >= posA.y) {
              posB.y = posA.y + hA + PAD_Y
            } else {
              posA.y = posB.y + hB + PAD_Y
            }
          } else {
            if (posB.x >= posA.x) {
              posB.x = posA.x + NODE_W + PAD_X
            } else {
              posA.x = posB.x + NODE_W + PAD_X
            }
          }
        }
      }
    }
    if (!hadCollision) break
  }

  return positions
}

/**
 * Thuật toán Tự Động Sắp Xếp Toàn Bộ Sơ Đồ Gọn Gàng (Smart Hierarchical Auto-Layout).
 * Phân chia theo 6 cột logic chức năng, căn đều trục dọc và căn giữa theo Cảnh/Layer,
 * triệt tiêu 100% hiện tượng chồng đè UI (0% overlap guarantee).
 */
export function solveSpaciousWorkflowLayout(
  nodes: WorkflowNode[],
  _edges: WorkflowEdge[],
  project?: Project
): Record<string, { x: number; y: number }> {
  if (!nodes || nodes.length === 0) return {}

  const sceneNodes = nodes.filter((n) => n.type === 'scene_shot')
  const layerNodes = nodes.filter((n) => n.type === 'layer_assembly')
  const transformNodes = nodes.filter((n) => n.type === 'layer_transform')
  const camNodes = nodes.filter((n) => n.type === 'camera_director')

  // Bố cục phân cấp Thông minh (Smart Hierarchical Z-Depth Layout):
  // Nếu có phân cảnh và các Layer con, bố trí theo cấu trúc 2 tầng gọn gàng:
  // - Hàng 1 (Y=40): Node Cảnh (X=60) -> Node Camera (X=356) -> Khối hạ nguồn Hàng 1
  // - Hàng 2 (Y=350): Các Node Layer xếp hàng ngang từ trái sang phải theo Z-index (xa -> gần)
  // - Dưới đáy mỗi Node Layer: Node Companion Transform plate tương ứng (cách 14px)
  // - Hành lang giữa 2 hàng (Y: 270 -> 340): Dành riêng cho bus dây nối phân nhánh
  if (sceneNodes.length > 0 && layerNodes.length > 0) {
    const newPositions: Record<string, { x: number; y: number }> = {}

    // Sắp xếp các Layer con từ trái sang phải theo Z-index (từ xa tới gần)
    const sortedLayers = [...layerNodes].sort((a, b) => {
      const za = project?.layers.find((l) => a.params?.targetLayerIds?.includes(l.id))?.transform?.position?.value[2] ?? 0
      const zb = project?.layers.find((l) => b.params?.targetLayerIds?.includes(l.id))?.transform?.position?.value[2] ?? 0
      return zb - za
    })

    const zVals = sortedLayers.map((n) => {
      return project?.layers.find((l) => n.params?.targetLayerIds?.includes(l.id))?.transform?.position?.value[2] ?? 0
    })
    const zMax = zVals.length > 0 ? Math.max(...zVals) : 0
    const zMin = zVals.length > 0 ? Math.min(...zVals) : 0
    const zSpan = Math.max(1, zMax - zMin)

    // Khoảng cách cột rộng thoáng 72px để các khối không bị dính sát nhau
    const COL_GAP = 72
    const layersStartX = 80
    const layersCount = sortedLayers.length
    const layersTotalW = layersCount * NODE_W + Math.max(0, layersCount - 1) * COL_GAP
    const layersCenterX = layersStartX + layersTotalW / 2
    const CAM_GAP = 54

    // 1. Căn giữa cặp khối Cảnh gốc & Camera 3D trên cao (Y=40), đối xứng hoàn mỹ phía trên cụm Layer con
    const sceneNode = sceneNodes[0]
    const sceneX = Math.max(layersStartX, Math.round(layersCenterX - NODE_W - CAM_GAP / 2))
    const sceneY = 40
    newPositions[sceneNode.id] = { x: sceneX, y: sceneY }

    // Các scene nodes khác (nếu có nhiều cảnh) - xếp sang trái hàng 1 để không đè lên layer bên dưới
    sceneNodes.slice(1).forEach((sc, scIdx) => {
      newPositions[sc.id] = { x: Math.max(20, sceneX - (scIdx + 1) * (NODE_W + CAM_GAP)), y: sceneY }
    })

    // Node Camera nằm trực tiếp bên phải Node Cảnh gốc trên Hàng 1
    if (camNodes.length > 0) {
      const primaryCam = camNodes[0]
      newPositions[primaryCam.id] = { x: sceneX + NODE_W + CAM_GAP, y: sceneY }
      camNodes.slice(1).forEach((c, cIdx) => {
        newPositions[c.id] = { x: sceneX + (cIdx + 1) * (NODE_W + CAM_GAP) + NODE_W + CAM_GAP, y: sceneY }
      })
    }

    // 2. Định vị các Layer con ở tầng dưới kèm dốc chiều sâu Z trực quan
    sortedLayers.forEach((node, idx) => {
      const layerZ = project?.layers.find((l) => node.params?.targetLayerIds?.includes(l.id))?.transform?.position?.value[2] ?? 0
      const normZ = (layerZ - zMin) / zSpan
      const childX = layersStartX + idx * (NODE_W + COL_GAP)
      // Dốc chiều sâu Z rõ nét: Layer ở xa (normZ = 1) ở cao hơn tại Y=340, Layer ở gần (normZ = 0) ở thấp hơn tại Y=500
      const childY = 340 + Math.round((1 - normZ) * 160)
      newPositions[node.id] = { x: childX, y: childY }

      // Tìm companion transform node của layer này
      const targetLayerId = node.params?.targetLayerIds?.[0]
      const companionTrans = transformNodes.find(
        (t) =>
          (targetLayerId && t.params?.targetLayerIds?.includes(targetLayerId)) ||
          t.id.endsWith(node.id.replace('wf-layer-', ''))
      )
      if (companionTrans) {
        // Khoảng cách 54px thoáng mắt giữa Layer và Transform Plate, tạo khoảng trống rõ ràng
        newPositions[companionTrans.id] = {
          x: childX,
          y: childY + estimateNodeCardHeight(node) + 54
        }
      }
    })

    // Các transform nodes còn lại chưa được gán (xếp dãn cách đều, không dồn cục)
    let unassignedTransIdx = 0
    transformNodes.forEach((t) => {
      if (!newPositions[t.id]) {
        newPositions[t.id] = {
          x: layersStartX + unassignedTransIdx * (NODE_W + COL_GAP),
          y: 760
        }
        unassignedTransIdx++
      }
    })

    // 3. Các node hạ nguồn khác (motion, physics, audio, look) xếp gọn theo lưới 2 tầng đối xứng ở bên phải
    const downstreamNodes = nodes.filter((n) => !newPositions[n.id])
    const layersEndX = layersStartX + layersTotalW
    const camEndX = (newPositions[camNodes[0]?.id]?.x ?? sceneX) + NODE_W
    const nextColX = Math.max(layersEndX + 72, camEndX + 72)

    // Sắp xếp thứ tự ưu tiên các khối hạ nguồn theo luồng sản xuất chuẩn:
    // Cột 1: Chuyển động (trên, Y=60), Vật lý/FX (dưới, Y=380)
    // Cột 2: Âm thanh (trên, Y=60), Màu & Xuất (dưới, Y=380)
    const motionNode = downstreamNodes.find((n) => n.type === 'motion_choreography')
    const physicsNode = downstreamNodes.find((n) => n.type === 'physics_fx')
    const audioNode = downstreamNodes.find((n) => n.type === 'audio_lipsync')
    const lookNode = downstreamNodes.find((n) => n.type === 'look_output')
    const otherDownstream = downstreamNodes.filter(
      (n) => n !== motionNode && n !== physicsNode && n !== audioNode && n !== lookNode
    )

    const col1X = nextColX
    const col2X = nextColX + NODE_W + COL_GAP

    const row0MaxH = Math.max(
      motionNode ? estimateNodeCardHeight(motionNode) : 0,
      audioNode ? estimateNodeCardHeight(audioNode) : 0,
      280
    )
    const row1Y = Math.max(420, 60 + row0MaxH + 54)

    if (motionNode) newPositions[motionNode.id] = { x: col1X, y: 60 }
    if (physicsNode) newPositions[physicsNode.id] = { x: col1X, y: row1Y }
    if (audioNode) newPositions[audioNode.id] = { x: col2X, y: 60 }
    if (lookNode) newPositions[lookNode.id] = { x: col2X, y: row1Y }

    otherDownstream.forEach((n, idx) => {
      const extraCol = Math.floor(idx / 2) + 2
      const row = idx % 2
      newPositions[n.id] = {
        x: nextColX + extraCol * (NODE_W + COL_GAP),
        y: row === 0 ? 60 : row1Y
      }
    })

    return relaxOverlappingPositions(newPositions, nodes)
  }

  // Fallback: 6 cột chuẩn nếu không có phân cảnh hoặc sơ đồ tự do
  const columns: WorkflowNode[][] = [[], [], [], [], [], []]
  const COL_X = [60, 440, 840, 1240, 1640, 2040]
  const GAP_Y = 44

  for (const n of nodes) {
    const logicId = n.params?.logicId ?? ''
    const isLayerNode = Boolean(n.params?.targetLayerIds && n.params.targetLayerIds.length > 0)

    if (n.type === 'scene_shot') {
      columns[0].push(n)
    } else if (isLayerNode || n.type === 'layer_assembly' || n.type === 'layer_transform') {
      columns[1].push(n)
    } else if (
      n.type === 'motion_choreography' ||
      logicId.includes('motion') ||
      logicId.includes('wind') ||
      logicId.includes('drift') ||
      logicId.includes('breathe') ||
      logicId.includes('walk') ||
      logicId.includes('jump')
    ) {
      columns[2].push(n)
    } else if (
      n.type === 'physics_fx' ||
      logicId.includes('fx') ||
      logicId.includes('candle') ||
      logicId.includes('elastic') ||
      logicId.includes('sway') ||
      logicId.includes('rimglow') ||
      logicId.includes('flashlight') ||
      logicId.includes('bounce')
    ) {
      columns[3].push(n)
    } else if (n.type === 'camera_director' || n.type === 'audio_lipsync') {
      columns[4].push(n)
    } else {
      // look_output hoặc các khối hoàn thiện
      columns[5].push(n)
    }
  }

  // 2. Tính chiều cao tối đa của cột trung tâm để làm mốc căn giữa
  const columnHeights = columns.map((col) => {
    if (col.length === 0) return 0
    return col.reduce((sum, node) => sum + estimateNodeCardHeight(node), 0) + (col.length - 1) * GAP_Y
  })
  const maxCenterH = Math.max(...columnHeights, 280)

  // 3. Định vị toạ độ chính xác cho từng Node trong từng cột
  const newPositions: Record<string, { x: number; y: number }> = {}

  columns.forEach((col, colIdx) => {
    if (col.length === 0) return

    const colH = columnHeights[colIdx]
    const startY = Math.max(60, Math.round((maxCenterH - colH) / 2))
    let currentY = startY

    for (const node of col) {
      newPositions[node.id] = {
        x: COL_X[colIdx] ?? (60 + colIdx * 400),
        y: currentY
      }
      currentY += estimateNodeCardHeight(node) + GAP_Y
    }
  })

  return relaxOverlappingPositions(newPositions, nodes)
}
