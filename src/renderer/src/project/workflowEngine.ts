import type {
  Layer,
  Project,
  WorkflowAiAgentStep,
  WorkflowAiBlueprint,
  WorkflowEdge,
  WorkflowExecutionReport,
  WorkflowExecutionStageResult,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'
import { buildCameraPath, type PathStep } from '../animation/cameraPath'
import { applyCameraPreset } from '../animation/presets'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import { applyMotionTracksToGroup, findMotionTargetGroup } from '../animation/motionEngine'
import { shotLocalToWorld } from '../engine/evaluateScene'
import { createGroundLayer, createParticleLayer, createShot } from './factory'
import { isMouthLayer } from './lipSync'
import {
  CANONICAL_NODE_ORDER,
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS,
  WORKFLOW_TEMPLATES,
  buildStandardEdges
} from './workflowCatalog'

export function createDefaultWorkflow(): WorkflowGraph {
  return WORKFLOW_TEMPLATES[0].buildGraph()
}

export function getWorkflowFromTemplate(presetId: string): WorkflowGraph {
  const found = WORKFLOW_TEMPLATES.find((t) => t.id === presetId)
  if (!found) {
    throw new Error(
      `Unknown workflow preset "${presetId}". Available: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(', ')}`
    )
  }
  return found.buildGraph()
}

export function ensureProjectWorkflow(project: Project): WorkflowGraph {
  if (project.workflow && Array.isArray(project.workflow.nodes) && project.workflow.nodes.length > 0) {
    return project.workflow
  }
  return createDefaultWorkflow()
}

/**
 * Xác định các Node đang BẬT và ĐƯỢC KẾT NỐI PORT hợp lệ trong đồ thị Workflow.
 * Sắp xếp theo thứ tự thực thi chuẩn (Topological / Step Order).
 */
export function resolveConnectedWorkflowNodes(workflow: WorkflowGraph): {
  activeNodes: WorkflowNode[]
  disconnectedNodes: WorkflowNode[]
} {
  const enabledNodes = workflow.nodes.filter((n) => n.enabled)
  const disabledNodes = workflow.nodes.filter((n) => !n.enabled)

  if (enabledNodes.length === 0) {
    return { activeNodes: [], disconnectedNodes: [...disabledNodes] }
  }

  const enabledIds = new Set(enabledNodes.map((n) => n.id))
  const validEdges = workflow.edges.filter(
    (e) => enabledIds.has(e.fromNode) && enabledIds.has(e.toNode) && e.fromNode !== e.toNode
  )

  // Nếu đồ thị chỉ có 1 node đang bật và chưa có cạnh nào, cho phép thực thi node đơn đó
  if (enabledNodes.length === 1 && validEdges.length === 0) {
    return { activeNodes: enabledNodes, disconnectedNodes: disabledNodes }
  }

  const connectedNodeIds = new Set<string>()
  for (const e of validEdges) {
    connectedNodeIds.add(e.fromNode)
    connectedNodeIds.add(e.toNode)
  }

  // BFS từ các node nguồn (hoặc các node có cạnh nối ra) để đảm bảo tính liên thông của chuỗi
  const adj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const n of enabledNodes) {
    if (connectedNodeIds.has(n.id)) {
      adj.set(n.id, [])
      inDegree.set(n.id, 0)
    }
  }
  for (const e of validEdges) {
    adj.get(e.fromNode)?.push(e.toNode)
    inDegree.set(e.toNode, (inDegree.get(e.toNode) ?? 0) + 1)
  }

  const orderIndex = (n: WorkflowNode): number => {
    const idx = CANONICAL_NODE_ORDER.indexOf(n.type)
    return idx >= 0 ? idx : 99
  }

  const activeNodes = enabledNodes
    .filter((n) => connectedNodeIds.has(n.id))
    .sort((a, b) => orderIndex(a) - orderIndex(b))

  const disconnectedNodes = [
    ...disabledNodes,
    ...enabledNodes.filter((n) => !connectedNodeIds.has(n.id))
  ]

  return { activeNodes, disconnectedNodes }
}

/**
 * Tự động nối tất cả các Node đang bật theo chuẩn quy trình tạo video chuyên nghiệp.
 */
export function autoWireWorkflowNodes(workflow: WorkflowGraph): WorkflowGraph {
  return {
    ...workflow,
    edges: buildStandardEdges(workflow.nodes)
  }
}

/**
 * Kết nối một cổng đầu ra (fromPort) của Node nguồn tới cổng đầu vào (toPort) của Node đích.
 */
export function connectWorkflowPort(
  workflow: WorkflowGraph,
  fromNodeId: string,
  fromPort: WorkflowPortKind,
  toNodeId: string,
  toPort: WorkflowPortKind
): WorkflowGraph {
  if (fromNodeId === toNodeId) return workflow
  const fromNode = workflow.nodes.find((n) => n.id === fromNodeId || n.type === fromNodeId)
  const toNode = workflow.nodes.find((n) => n.id === toNodeId || n.type === toNodeId)
  if (!fromNode || !toNode) {
    throw new Error(`Node not found when connecting ${fromNodeId}:${fromPort} -> ${toNodeId}:${toPort}`)
  }

  const exists = workflow.edges.some(
    (e) =>
      e.fromNode === fromNode.id &&
      e.fromPort === fromPort &&
      e.toNode === toNode.id &&
      e.toPort === toPort
  )
  if (exists) return workflow

  const newEdge: WorkflowEdge = {
    id: `edge-${fromNode.id}-${fromPort}-${toNode.id}-${toPort}`,
    fromNode: fromNode.id,
    fromPort,
    toNode: toNode.id,
    toPort
  }

  return {
    ...workflow,
    edges: [...workflow.edges, newEdge]
  }
}

/**
 * Ngắt kết nối một cạnh (Edge) hoặc cổng giữa 2 Node.
 */
export function disconnectWorkflowEdge(
  workflow: WorkflowGraph,
  filter: {
    edgeId?: string
    fromNode?: string
    fromPort?: string
    toNode?: string
    toPort?: string
  }
): WorkflowGraph {
  const resolveId = (idOrType?: string): string | undefined => {
    if (!idOrType) return undefined
    const found = workflow.nodes.find((n) => n.id === idOrType || n.type === idOrType)
    return found ? found.id : idOrType
  }
  const fNode = resolveId(filter.fromNode)
  const tNode = resolveId(filter.toNode)

  const nextEdges = workflow.edges.filter((e) => {
    if (filter.edgeId && e.id === filter.edgeId) return false
    const matchFrom = !fNode || e.fromNode === fNode
    const matchFromPort = !filter.fromPort || e.fromPort === filter.fromPort
    const matchTo = !tNode || e.toNode === tNode
    const matchToPort = !filter.toPort || e.toPort === filter.toPort
    if ((filter.fromNode || filter.toNode || filter.fromPort || filter.toPort) && matchFrom && matchFromPort && matchTo && matchToPort) {
      return false
    }
    return true
  })

  return {
    ...workflow,
    edges: nextEdges
  }
}

/**
 * Biên dịch đồ thị Workflow thành bản thiết kế Tác nhân Logic (AI Blueprint)
 * để AI Agent (qua MCP) hiểu chính xác luồng xử lý, vai trò tác nhân và các lệnh MCP tương ứng.
 */
export function compileWorkflowBlueprint(workflow: WorkflowGraph, project?: Project): WorkflowAiBlueprint {
  const { activeNodes } = resolveConnectedWorkflowNodes(workflow)
  const nodeById = new Map(workflow.nodes.map((n) => [n.id, n]))
  const activeSet = new Set(activeNodes.map((n) => n.id))

  const agents: WorkflowAiAgentStep[] = activeNodes.map((node, idx) => {
    const spec = WORKFLOW_NODE_SPECS[node.type]
    const presetSpec = spec?.presets.find((p) => p.id === node.preset) ?? spec?.presets[0]

    const inputsFrom = workflow.edges
      .filter((e) => e.toNode === node.id && activeSet.has(e.fromNode))
      .map((e) => ({
        nodeId: e.fromNode,
        nodeTitle: nodeById.get(e.fromNode)?.title ?? e.fromNode,
        port: e.fromPort
      }))

    const outputsTo = workflow.edges
      .filter((e) => e.fromNode === node.id && activeSet.has(e.toNode))
      .map((e) => ({
        nodeId: e.toNode,
        nodeTitle: nodeById.get(e.toNode)?.title ?? e.toNode,
        port: e.toPort
      }))

    return {
      step: idx + 1,
      nodeId: node.id,
      nodeType: node.type,
      title: node.title,
      aiAgentRole: node.aiAgentRole,
      preset: node.preset,
      presetLabel: presetSpec?.label ?? node.preset,
      summary: presetSpec?.summary ?? '',
      aiDirective: node.aiDirective || presetSpec?.defaultDirective || '',
      inputsFrom,
      outputsTo,
      recommendedMcpTools: presetSpec?.recommendedMcpTools ?? [],
      mcpActionHint: {
        ...(presetSpec?.mcpHint ?? {}),
        ...(node.params ?? {}),
        ...(project
          ? {
              projectShots: project.shots.length,
              projectLayers: project.layers.length
            }
          : {})
      }
    }
  })

  const hasScene = activeNodes.some((n) => n.type === 'scene_shot')
  const hasOutput = activeNodes.some((n) => n.type === 'look_output' || n.type === 'camera_director')

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    presetId: workflow.presetId,
    description: workflow.description,
    totalNodes: workflow.nodes.length,
    connectedNodesCount: activeNodes.length,
    isPipelineComplete: hasScene && hasOutput && activeNodes.length >= 2,
    pipelineSummary:
      agents.length > 0
        ? agents.map((a) => `[${a.step}. ${a.aiAgentRole}: ${a.presetLabel}]`).join(' ➔ ')
        : 'Chưa có khối chức năng nào được nối Port kích hoạt.',
    executionOrder: activeNodes.map((n) => n.type),
    agents
  }
}

/**
 * Kiểm tra và chuẩn hóa dữ liệu JSON Workflow từ người dùng hoặc AI MCP.
 */
export function validateAndNormalizeWorkflowJson(raw: unknown): WorkflowGraph {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dữ liệu Workflow JSON phải là một Object hợp lệ.')
  }
  const obj = parsed as Partial<WorkflowGraph>
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error('Workflow JSON phải chứa mảng "nodes" không rỗng.')
  }

  const validTypes = new Set<string>(CANONICAL_NODE_ORDER)
  const validPorts = new Set<string>(Object.keys(WORKFLOW_PORT_SPECS))

  const nodes: WorkflowNode[] = obj.nodes.map((n, i) => {
    const type = (validTypes.has(n.type) ? n.type : CANONICAL_NODE_ORDER[i % CANONICAL_NODE_ORDER.length]) as WorkflowNodeType
    const spec = WORKFLOW_NODE_SPECS[type]
    const presetObj = spec.presets.find((p) => p.id === n.preset) ?? spec.presets[0]
    return {
      id: typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `wf-${type}`,
      type,
      title: typeof n.title === 'string' && n.title.trim() ? n.title.trim() : spec.title,
      enabled: typeof n.enabled === 'boolean' ? n.enabled : true,
      position:
        n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
          ? { x: Math.round(n.position.x), y: Math.round(n.position.y) }
          : { ...DEFAULT_NODE_POSITIONS[type] },
      preset: presetObj.id,
      aiAgentRole: spec.aiAgentRole,
      aiDirective:
        typeof n.aiDirective === 'string' && n.aiDirective.trim()
          ? n.aiDirective.trim()
          : presetObj.defaultDirective,
      params: { ...presetObj.defaultParams, ...(n.params ?? {}) }
    }
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: WorkflowEdge[] = Array.isArray(obj.edges)
    ? obj.edges
        .filter(
          (e) =>
            e &&
            nodeIds.has(e.fromNode) &&
            nodeIds.has(e.toNode) &&
            validPorts.has(e.fromPort) &&
            validPorts.has(e.toPort)
        )
        .map((e, idx) => ({
          id: e.id || `edge-${e.fromNode}-${e.fromPort}-${e.toNode}-${idx}`,
          fromNode: e.fromNode,
          fromPort: e.fromPort as WorkflowPortKind,
          toNode: e.toNode,
          toPort: e.toPort as WorkflowPortKind
        }))
    : buildStandardEdges(nodes)

  return {
    version: 1,
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : 'wf-custom',
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Quy trình Tạo Video Tùy chỉnh',
    presetId: obj.presetId,
    description:
      typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : 'Quy trình Node-Port cấu hình kịch bản dựng cảnh và chuyển động 2.5D.',
    nodes,
    edges,
    lastAppliedAt: obj.lastAppliedAt
  }
}

function classifyLayerRole(layer: Layer): 'sky' | 'foliage' | 'character' | 'ground' | 'prop' {
  const n = (layer.name || '').toLowerCase()
  if (layer.transform.rotation.value[0] <= -65) return 'ground'
  if (
    n.includes('sky') ||
    n.includes('trời') ||
    n.includes('cloud') ||
    n.includes('mây') ||
    n.includes('fog') ||
    n.includes('sương') ||
    layer.transform.position.value[2] >= 2200
  ) {
    return 'sky'
  }
  if (
    layer.composite ||
    n.includes('hero') ||
    n.includes('nhân vật') ||
    n.includes('character') ||
    n.includes('knight') ||
    n.includes('girl') ||
    n.includes('boy')
  ) {
    return 'character'
  }
  if (
    n.includes('tree') ||
    n.includes('cây') ||
    n.includes('bush') ||
    n.includes('bụi') ||
    n.includes('leaf') ||
    n.includes('lá') ||
    n.includes('flower') ||
    n.includes('hoa') ||
    n.includes('grass') ||
    n.includes('cỏ')
  ) {
    return 'foliage'
  }
  return 'prop'
}

/**
 * Thực thi trực tiếp chuỗi Node đã kết nối trong Workflow lên dữ liệu Project.
 */
export function applyWorkflowToProject(
  project: Project,
  workflowInput?: WorkflowGraph
): WorkflowExecutionReport {
  const workflow = workflowInput ? structuredClone(workflowInput) : structuredClone(ensureProjectWorkflow(project))
  const { activeNodes, disconnectedNodes } = resolveConnectedWorkflowNodes(workflow)
  const executedStages: WorkflowExecutionStageResult[] = []

  for (const node of activeNodes) {
    const intensity = Math.max(0.2, Math.min(2.5, node.params?.intensity ?? 1.0))

    if (node.type === 'scene_shot') {
      let affected = 0
      if (project.shots.length === 0) {
        const s = createShot('Cảnh 1', [0, 0, 0], 0)
        project.shots.push(s)
        for (const l of project.layers) {
          if (!l.shotId) l.shotId = s.id
        }
        affected++
      }

      const zTiers =
        node.preset === 'intimate_portrait_stage'
          ? [1400, 750, 320, 0, -60]
          : [3200, 1800, 850, 280, 0, -120]

      if (node.params?.autoArrangeZ !== false) {
        for (const shot of project.shots) {
          const standalone = project.layers.filter(
            (l) => l.shotId === shot.id && l.type === 'image' && !l.composite && !l.model3d && !l.locked
          )
          // Chỉ tự động giãn Z nếu các layer đang bị trùng độ sâu Z (chưa phân tầng)
          const uniqueZs = new Set(standalone.map((l) => Math.round(l.transform.position.value[2] / 50)))
          if (standalone.length > 1 && uniqueZs.size <= 1) {
            standalone.forEach((l, idx) => {
              const targetZ = Math.round((zTiers[idx % zTiers.length] ?? 0) * intensity)
              l.transform.position.value[2] = targetZ
              affected++
            })
          } else {
            affected += standalone.length
          }
        }
      }

      if (node.params?.ensureGround || node.preset === 'grounded_3d_stage') {
        const hasGround = project.layers.some((l) => l.transform.rotation.value[0] <= -65)
        if (!hasGround) {
          const g = createGroundLayer(project.comp, 'Mặt đất 3D (Workflow)')
          g.shotId = project.shots[0]?.id ?? null
          project.layers.push(g)
          affected++
        }
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Chuẩn hóa ${project.shots.length} phân cảnh & phân tầng độ sâu Z (${node.preset}).`,
        affectedCount: affected
      })
    } else if (node.type === 'layer_assembly') {
      let affected = 0
      for (const l of project.layers) {
        if (l.locked) continue
        if (l.composite) {
          l.composite.lockedGroup = true
          if (l.composite.isRoot && node.preset !== 'arch3d_and_props') {
            l.autoOrient = 'camera-y'
            if (l.transform.anchor) l.transform.anchor.value = [0, -0.5, 0]
          }
          affected++
        } else if (l.model3d) {
          affected++
        } else if (classifyLayerRole(l) === 'character' || classifyLayerRole(l) === 'foliage') {
          if (l.transform.anchor) l.transform.anchor.value = [0, -0.5, 0]
          affected++
        }
      }
      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Đồng bộ neo gốc & hướng camera cho ${affected} lớp lắp ráp 2.5D/3D.`,
        affectedCount: affected
      })
    } else if (node.type === 'motion_choreography') {
      let affected = 0
      for (const l of project.layers) {
        if (l.locked || l.type === 'solid') continue
        const role = classifyLayerRole(l)
        if (role === 'sky') {
          l.motion = {
            enabled: true,
            type: 'drift',
            speed: Math.round(18 * intensity),
            direction: 'right',
            loopMode: 'ping-pong',
            amount: 0.85
          }
          affected++
        } else if (role === 'foliage') {
          l.motion = {
            enabled: true,
            type: 'wind',
            speed: Number((0.85 * intensity).toFixed(2)),
            amplitude: [Math.round(10 * intensity), Math.round(4 * intensity), 3],
            amount: 0.9
          }
          affected++
        } else if (role === 'character' && (!l.motion || l.motion.type === 'none')) {
          l.motion = {
            enabled: true,
            type: 'float',
            speed: Number((0.7 * intensity).toFixed(2)),
            amplitude: [2, Math.round(6 * intensity), 0],
            amount: 0.75
          }
          affected++
        }
      }

      if (node.preset === 'character_walk_depth' || node.preset === 'dynamic_action_arc') {
        const focal =
          project.layers.find((l) => l.composite?.isRoot) ??
          project.layers.find((l) => classifyLayerRole(l) === 'character')
        if (focal) {
          const targetId = focal.composite?.instanceId || focal.id
          const group = findMotionTargetGroup(project, targetId)
          if (group && group.layers.length > 0) {
            const presetId = node.preset === 'dynamic_action_arc' ? 'jump_arc' : 'walk_into_depth'
            const tracks = generatePresetSpatialTracks(
              presetId,
              {
                position: group.centerPosition,
                rotation: group.layers[0].transform.rotation.value,
                scale: [1, 1, 1],
                opacity: group.layers[0].transform.opacity.value
              },
              {
                time: 0,
                duration: Math.min(project.comp.duration, node.params?.duration ?? 5)
              }
            )
            applyMotionTracksToGroup(group, tracks)
            affected += group.layers.length
          }
        }
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Kích hoạt chuyển động tự nhiên & hoạt họa cho ${affected} layer.`,
        affectedCount: affected
      })
    } else if (node.type === 'physics_fx') {
      let affected = 0
      const focalLayer =
        project.layers.find((l) => l.composite?.isRoot) ??
        project.layers.find((l) => classifyLayerRole(l) === 'character') ??
        project.layers.find((l) => l.type === 'image' && !l.locked)

      if (node.preset === 'combat_elastic_glow') {
        for (const l of project.layers) {
          if (l.locked || l.type !== 'image') continue
          const role = classifyLayerRole(l)
          if (role === 'foliage' || role === 'prop' || role === 'character') {
            l.physics = {
              enabled: true,
              material: role === 'foliage' ? 'foliage_bush' : role === 'character' ? 'flesh_body' : 'wood_tree',
              role: role === 'character' ? 'striker' : 'prop_target',
              stiffness: 1.2,
              damping: 0.25,
              bounciness: Number((1.15 * intensity).toFixed(2))
            }
            affected++
          }
        }
        if (focalLayer) {
          focalLayer.glow = {
            enabled: true,
            side: 'outer',
            color: '#38bdf8',
            thickness: 8,
            intensity: Number((1.35 * intensity).toFixed(2)),
            animated: 'breathe',
            speed: 1.8
          }
          affected++
        }
      } else if (node.preset === 'cave_portal_flashlight') {
        const bgLayer = project.layers.find(
          (l) => l.type === 'image' && l.transform.position.value[2] >= 600 && !l.locked
        )
        if (bgLayer) {
          bgLayer.physics = {
            ...(bgLayer.physics ?? { enabled: true, material: 'stone_wall' }),
            enabled: true,
            depthPortal: {
              enabled: true,
              centerUV: [0.5, 0.45],
              radiusUV: [0.35, 0.35],
              minScale: 0.4,
              darkness: 0.82,
              shadowTint: '#060814',
              depthPullZ: 140
            }
          }
          affected++
        }
        if (focalLayer) {
          focalLayer.virtualLight = {
            enabled: true,
            kind: 'flashlight',
            color: '#fef08a',
            intensity: Number((1.6 * intensity).toFixed(2)),
            radius: 520,
            beamAngleDeg: 0,
            coneAngleDeg: 54,
            flickerSpeed: 0.6,
            zReach: 340
          }
          affected++
        }
      } else {
        if (focalLayer) {
          focalLayer.virtualLight = {
            enabled: true,
            kind: 'candle',
            color: '#ffbe6b',
            intensity: Number((1.35 * intensity).toFixed(2)),
            radius: 440,
            windPreset: 'gentle',
            windStrength: 0.45,
            windSensitivity: 1.0,
            flickerSpeed: 1.4,
            zReach: 300
          }
          affected++
        }
      }

      if (node.params?.spawnParticles && !project.layers.some((l) => l.type === 'particles')) {
        const pLayer = createParticleLayer(project.comp)
        pLayer.name = 'Hạt Đom Đóm Khí Quyển (Workflow)'
        pLayer.shotId = project.shots[0]?.id ?? null
        project.layers.unshift(pLayer)
        affected++
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Thiết lập Vật lý 2.5D, Ánh sáng ảo & Hạt FX (${affected} hạng mục).`,
        affectedCount: affected
      })
    } else if (node.type === 'camera_director') {
      const targetShot = project.shots[0] ?? null
      if (node.preset === 'cinematic_fly_push' && project.shots.length > 1) {
        const holdPerShot = Math.max(2, Number(((project.comp.duration / project.shots.length) * 0.65).toFixed(1)))
        const steps: PathStep[] = project.shots.map((s) => ({
          shotId: s.id,
          hold: holdPerShot,
          type: 'fly',
          transition: 1.8
        }))
        buildCameraPath(project, steps, { pushIn: Number((0.14 * intensity).toFixed(2)), startAt: 0 })
      } else {
        const camPreset =
          node.preset === 'orbit_showcase_3d'
            ? 'orbitRight'
            : node.preset === 'dramatic_handheld_action'
              ? 'dollyZoom'
              : 'dollyIn'
        applyCameraPreset(
          project.camera,
          camPreset,
          project.comp,
          0,
          project.comp.duration,
          intensity,
          shotLocalToWorld(targetShot, 0)
        )
      }

      project.camera.dofEnabled = Boolean(node.params?.enableDof ?? true)
      project.camera.shakeAmount =
        node.preset === 'dramatic_handheld_action' ? Math.round(6 * intensity) : Math.round(1.2 * intensity)
      project.camera.shakeSpeed = node.preset === 'dramatic_handheld_action' ? 1.2 : 0.6

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Tạo đường bay Camera 3D (${node.preset}) · DOF ${project.camera.dofEnabled ? 'Bật' : 'Tắt'}.`,
        affectedCount: Math.max(1, project.shots.length)
      })
    } else if (node.type === 'audio_lipsync') {
      let affected = 0
      const tracks = project.audioTracks ?? []
      const charComposite = project.layers.find((l) => l.composite?.instanceId)
      const mouthLayer = project.layers.find((l) => isMouthLayer(l))

      for (const tr of tracks) {
        tr.fadeIn = tr.fadeIn || 0.6
        tr.fadeOut = tr.fadeOut || 1.0
        if (node.preset === 'voice_lipsync_bgm' || node.params?.autoLipSync) {
          tr.tone = tr.characterRole === 'voice' ? 'vocal' : 'warm'
          if (tr.characterRole === 'voice' || tracks.length === 1) {
            tr.lipSyncEnabled = true
            tr.lipSyncIntensity = Number((1.15 * intensity).toFixed(2))
            if (!tr.targetId && charComposite?.composite) {
              tr.targetType = 'character'
              tr.targetId = charComposite.composite.instanceId
              tr.targetName = charComposite.composite.compositeName
            }
            if (!tr.lipSyncLayerId && mouthLayer) {
              tr.lipSyncLayerId = mouthLayer.id
            }
          }
        } else {
          tr.tone = 'warm'
        }
        affected++
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary:
          affected > 0
            ? `Cấu hình âm thanh & đồng bộ Lip-Sync cho ${affected} track.`
            : 'Đã sẵn sàng cấu hình Lip-Sync & EQ khi thêm track âm thanh.',
        affectedCount: affected
      })
    } else if (node.type === 'look_output') {
      if (node.preset === 'mystic_night_glow') {
        project.look = {
          ...project.look,
          fogEnabled: true,
          fogColor: '#161936',
          fogNear: 1200,
          fogFar: 5200,
          vignette: Number(Math.min(1, 0.38 * intensity).toFixed(2)),
          grain: 0.06,
          exposure: -0.08,
          contrast: 1.12,
          saturation: 1.08
        }
      } else if (node.preset === 'vibrant_anime_clean') {
        project.look = {
          ...project.look,
          fogEnabled: false,
          vignette: 0.1,
          grain: 0,
          exposure: 0.08,
          contrast: 1.06,
          saturation: Number(Math.min(2, 1.16 * intensity).toFixed(2))
        }
      } else {
        project.look = {
          ...project.look,
          fogEnabled: true,
          fogColor: '#2a2140',
          fogNear: 1400,
          fogFar: 5800,
          vignette: Number(Math.min(1, 0.28 * intensity).toFixed(2)),
          grain: 0.04,
          exposure: 0.02,
          contrast: 1.08,
          saturation: 1.06
        }
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Hoàn thiện màu sắc điện ảnh (${node.preset}) & sẵn sàng xuất bản.`,
        affectedCount: 1
      })
    }
  }

  workflow.lastAppliedAt = new Date().toISOString()
  project.workflow = workflow

  return {
    ok: true,
    workflowId: workflow.id,
    workflowName: workflow.name,
    executedStages,
    skippedDisconnectedNodes: disconnectedNodes.map((n) => n.id),
    blueprint: compileWorkflowBlueprint(workflow, project)
  }
}
