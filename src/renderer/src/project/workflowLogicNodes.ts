import type {
  Layer,
  Project,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType
} from '@shared/types'
import {
  CANONICAL_NODE_ORDER,
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS,
  buildStandardEdges
} from './workflowCatalog'
import { getDefaultPartsForNode } from './workflowTargets'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  type WorkflowLogicNodeCategory,
  type WorkflowLogicNodeCatalogItem
} from './workflowLogicCatalog'

export {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  type WorkflowLogicNodeCategory,
  type WorkflowLogicNodeCatalogItem
}

/**
 * Thả một Node Logic mới lên mặt phẳng Workflow Canvas và tự động nối dây (Port)
 * vào luồng xử lý của Phân cảnh hoặc Layer đang chọn.
 */
export function spawnLogicNodeIntoWorkflow(
  workflow: WorkflowGraph,
  logicId: string,
  targetShotId?: string
): { workflow: WorkflowGraph; spawnedNode: WorkflowNode } {
  const item = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === logicId)
  if (!item) {
    throw new Error(`Không tìm thấy Node Logic "${logicId}" trong Kho Node Logic.`)
  }

  const spec = WORKFLOW_NODE_SPECS[item.nodeType]
  const basePos = DEFAULT_NODE_POSITIONS[item.nodeType] ?? { x: 600, y: 120 }
  const sameTypeNodes = workflow.nodes.filter((n) => n.type === item.nodeType)

  const newPos = {
    x: basePos.x + (sameTypeNodes.length % 2 === 1 ? 26 : 0),
    y: basePos.y + sameTypeNodes.length * 310
  }

  const uniqueSuffix = Math.random().toString(36).slice(2, 6)
  const newNodeId = `wf-${item.id}-${uniqueSuffix}`
  const scopedShot = targetShotId ?? workflow.targetShotId ?? 'all'

  const newNode: WorkflowNode = {
    id: newNodeId,
    type: item.nodeType,
    title: `${item.icon} ${item.title}`,
    enabled: true,
    position: newPos,
    preset: item.preset,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: item.description,
    params: {
      intensity: 1.0,
      targetMode: 'auto',
      shotId: scopedShot,
      logicId: item.id,
      targetParts: [...item.targetParts],
      enableDof: item.enableDof ?? false,
      ensureGround: item.ensureGround ?? false,
      spawnParticles: item.spawnParticles ?? false,
      customRules: item.buildRules ? item.buildRules() : []
    }
  }

  const nextEdges: WorkflowEdge[] = [...workflow.edges]
  const addEdgeIfMissing = (fromNode: string, fromPort: any, toNode: string, toPort: any) => {
    if (fromNode === toNode) return
    const exists = nextEdges.some(
      (e) =>
        e.fromNode === fromNode &&
        e.fromPort === fromPort &&
        e.toNode === toNode &&
        e.toPort === toPort
    )
    if (!exists) {
      nextEdges.push({
        id: `edge-${fromNode}-${fromPort}-${toNode}-${toPort}`,
        fromNode,
        fromPort,
        toNode,
        toPort
      })
    }
  }

  const sceneNode =
    workflow.nodes.find((n) => n.type === 'scene_shot' && n.enabled) ?? workflow.nodes[0]
  const assemblyNodes = workflow.nodes.filter((n) => n.type === 'layer_assembly' && n.enabled)
  const firstAssemblyNode = assemblyNodes[0]
  const motionNodes = workflow.nodes.filter((n) => n.type === 'motion_choreography' && n.enabled)
  const lastMotionNode = motionNodes.length > 0 ? motionNodes[motionNodes.length - 1] : null
  const fxNodes = workflow.nodes.filter((n) => n.type === 'physics_fx' && n.enabled)
  const lastFxNode = fxNodes.length > 0 ? fxNodes[fxNodes.length - 1] : null
  const camNode = workflow.nodes.find((n) => n.type === 'camera_director' && n.enabled)
  const audioNode = workflow.nodes.find((n) => n.type === 'audio_lipsync' && n.enabled)
  const lookNode = workflow.nodes.find((n) => n.type === 'look_output' && n.enabled)

  if (item.nodeType === 'scene_shot') {
    // Node Cảnh nối tới các Layer con hoặc chuyển động
    if (firstAssemblyNode) {
      addEdgeIfMissing(newNode.id, 'scene_ctx', firstAssemblyNode.id, 'scene_ctx')
    } else if (lastMotionNode) {
      addEdgeIfMissing(newNode.id, 'scene_ctx', lastMotionNode.id, 'scene_ctx')
    }
    if (camNode) {
      addEdgeIfMissing(newNode.id, 'scene_ctx', camNode.id, 'scene_ctx')
    }
  } else if (item.nodeType === 'layer_assembly') {
    // Node Layer nhận scene_ctx từ Cảnh và nối sang chuyển động / audio
    if (sceneNode) addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    if (lastMotionNode) addEdgeIfMissing(newNode.id, 'actors_rig', lastMotionNode.id, 'actors_rig')
    if (audioNode) addEdgeIfMissing(newNode.id, 'actors_rig', audioNode.id, 'actors_rig')
  } else if (item.nodeType === 'motion_choreography') {
    // Node Chuyển động nhận từ Layer con hoặc Cảnh
    if (lastMotionNode) {
      addEdgeIfMissing(lastMotionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    } else if (firstAssemblyNode) {
      addEdgeIfMissing(firstAssemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    } else if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    }
    if (lastFxNode) {
      addEdgeIfMissing(newNode.id, 'motion_stream', lastFxNode.id, 'motion_stream')
    }
    if (camNode) {
      addEdgeIfMissing(newNode.id, 'motion_stream', camNode.id, 'motion_stream')
    }
    if (!lastFxNode && lookNode) {
      addEdgeIfMissing(newNode.id, 'motion_stream', lookNode.id, 'motion_stream')
    }
  } else if (item.nodeType === 'physics_fx') {
    // Node Vật lý / Ánh sáng nối từ Layer con hoặc Chuyển động
    if (firstAssemblyNode) {
      addEdgeIfMissing(firstAssemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    } else if (lastFxNode) {
      addEdgeIfMissing(lastFxNode.id, 'vfx_stage', newNode.id, 'vfx_stage')
    } else if (lastMotionNode) {
      addEdgeIfMissing(lastMotionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    } else if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    }
    if (lookNode) {
      addEdgeIfMissing(newNode.id, 'vfx_stage', lookNode.id, 'vfx_stage')
    }
  } else if (item.nodeType === 'camera_director') {
    // Node Lộ trình nhận scene_ctx từ Cảnh và bám theo Layer / Chuyển động
    if (sceneNode) addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    if (lastMotionNode) addEdgeIfMissing(lastMotionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    else if (firstAssemblyNode) addEdgeIfMissing(firstAssemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    if (lookNode) addEdgeIfMissing(newNode.id, 'camera_cut', lookNode.id, 'camera_cut')
  } else if (item.nodeType === 'audio_lipsync') {
    // Node Audio nhận từ Layer con (cho lip-sync/sfx) hoặc Cảnh (cho BGM)
    if (firstAssemblyNode) addEdgeIfMissing(firstAssemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    else if (sceneNode) addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    if (lookNode) addEdgeIfMissing(newNode.id, 'audio_mix', lookNode.id, 'audio_mix')
  } else if (item.nodeType === 'look_output') {
    if (lastFxNode) addEdgeIfMissing(lastFxNode.id, 'vfx_stage', newNode.id, 'vfx_stage')
    if (camNode) addEdgeIfMissing(camNode.id, 'camera_cut', newNode.id, 'camera_cut')
    if (audioNode) addEdgeIfMissing(audioNode.id, 'audio_mix', newNode.id, 'audio_mix')
    if (!lastFxNode && lastMotionNode) {
      addEdgeIfMissing(lastMotionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    }
    if (!firstAssemblyNode && !lastMotionNode && sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    }
  }

  return {
    workflow: {
      ...workflow,
      nodes: [...workflow.nodes, newNode],
      edges: nextEdges
    },
    spawnedNode: newNode
  }
}

/**
 * Xác định phạm vi Phân cảnh (Shot ID) thực tế của một Node.
 */
export function resolveNodeShotScope(
  node: WorkflowNode,
  workflow: WorkflowGraph
): string | null {
  if (node.params?.shotId && node.params.shotId !== 'all') {
    return node.params.shotId
  }
  const sceneRootIds = new Set(
    workflow.nodes.filter((n) => n.type === 'scene_shot' && n.enabled).map((n) => n.id)
  )
  for (const e of workflow.edges) {
    if (e.toNode === node.id && sceneRootIds.has(e.fromNode)) {
      const src = workflow.nodes.find((n) => n.id === e.fromNode)
      if (src?.params?.shotId && src.params.shotId !== 'all') {
        return src.params.shotId
      }
    }
  }
  const primaryScene = workflow.nodes.find((n) => n.type === 'scene_shot' && n.enabled)
  if (primaryScene?.params?.shotId && primaryScene.params.shotId !== 'all') {
    return primaryScene.params.shotId
  }
  if (workflow.targetShotId && workflow.targetShotId !== 'all') {
    return workflow.targetShotId
  }
  return null
}

/**
 * Kiểm tra và chuẩn hóa dữ liệu JSON Workflow.
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
    const type = (
      validTypes.has(n.type) ? n.type : CANONICAL_NODE_ORDER[i % CANONICAL_NODE_ORDER.length]
    ) as WorkflowNodeType
    const spec = WORKFLOW_NODE_SPECS[type]
    const presetObj = spec.presets.find((p) => p.id === n.preset) ?? spec.presets[0]
    const defaultParts = getDefaultPartsForNode({ type, preset: presetObj.id })
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
      params: {
        targetMode: 'auto',
        targetParts: defaultParts,
        ...presetObj.defaultParams,
        ...(n.params ?? {})
      }
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
          fromPort: e.fromPort,
          toNode: e.toNode,
          toPort: e.toPort
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

/**
 * Áp dụng trực tiếp các dây nối từ Node Logic vào từng Layer con đích (Blender-like Per-Layer Logic Routing).
 * Khi một Layer được nối dây từ Node Gió/Vật lý/Ánh sáng/LipSync, layer đó lập tức nhận hiệu ứng.
 */
export function applyConnectedLogicEdgesToLayers(
  project: Project,
  workflow: WorkflowGraph,
  activeNodes: WorkflowNode[]
): number {
  const activeNodeMap = new Map(activeNodes.map((n) => [n.id, n]))
  let affected = 0

  const layerNodes = workflow.nodes.filter(
    (n) => n.params?.targetLayerIds && n.params.targetLayerIds.length > 0
  )
  if (layerNodes.length === 0) return 0

  for (const lNode of layerNodes) {
    const layerId = lNode.params?.targetLayerIds?.[0]
    if (!layerId) continue
    const layer = project.layers.find((l) => l.id === layerId)
    if (!layer || layer.locked) continue

    const incomingEdges = workflow.edges.filter(
      (e) => e.toNode === lNode.id && activeNodeMap.has(e.fromNode)
    )

    // 1. Luồng Chuyển động (motion_stream)
    const motionEdge = incomingEdges.find((e) => e.toPort === 'motion_stream')
    if (motionEdge) {
      const src = activeNodeMap.get(motionEdge.fromNode)
      if (src) {
        const intensity = src.params?.intensity ?? 1.0
        const logicId = src.params?.logicId ?? ''
        if (logicId.includes('wind') || src.preset === 'organic_wind_breathe') {
          layer.motion = {
            enabled: true,
            type: 'wind',
            speed: Number((0.85 * intensity).toFixed(2)),
            amount: 0.9,
            amplitude: [10, 4, 3]
          }
          affected++
        } else if (logicId.includes('drift')) {
          layer.motion = {
            enabled: true,
            type: 'drift',
            speed: Math.round(18 * intensity),
            direction: 'right',
            loopMode: 'ping-pong',
            amount: 0.85
          }
          affected++
        } else if (logicId.includes('breathe') || logicId.includes('float')) {
          layer.motion = {
            enabled: true,
            type: 'float',
            speed: Number((0.7 * intensity).toFixed(2)),
            amount: 0.75,
            amplitude: [2, 6, 0]
          }
          affected++
        } else if (logicId.includes('walk')) {
          layer.motion = {
            enabled: true,
            type: 'pulse',
            speed: Number((1.0 * intensity).toFixed(2)),
            amount: 1.0
          }
          affected++
        } else if (logicId.includes('jump')) {
          layer.motion = {
            enabled: true,
            type: 'wiggle',
            speed: Number((1.15 * intensity).toFixed(2)),
            amount: 1.05
          }
          affected++
        }
      }
    }

    // 2. Luồng Vật lý & Ánh sáng FX (vfx_stage)
    const vfxEdge = incomingEdges.find((e) => e.toPort === 'vfx_stage')
    if (vfxEdge) {
      const src = activeNodeMap.get(vfxEdge.fromNode)
      if (src) {
        const intensity = src.params?.intensity ?? 1.0
        const logicId = src.params?.logicId ?? ''
        if (logicId.includes('candle')) {
          layer.virtualLight = {
            enabled: true,
            kind: 'candle',
            color: '#ffaa33',
            intensity: Number((1.25 * intensity).toFixed(2)),
            radius: 450,
            flickerSpeed: 1.4,
            zReach: 300
          }
          affected++
        } else if (logicId.includes('flashlight')) {
          layer.virtualLight = {
            enabled: true,
            kind: 'flashlight',
            color: '#fef08a',
            intensity: Number((1.45 * intensity).toFixed(2)),
            radius: 520,
            beamAngleDeg: 0,
            coneAngleDeg: 54,
            flickerSpeed: 0.6,
            zReach: 340
          }
          affected++
        } else if (logicId.includes('rimglow')) {
          layer.glow = {
            enabled: true,
            side: 'outer',
            color: '#38bdf8',
            thickness: 8,
            intensity: Number((1.35 * intensity).toFixed(2)),
            animated: 'breathe',
            speed: 1.8
          }
          affected++
        } else if (logicId.includes('elastic') || logicId.includes('bounce')) {
          layer.physics = {
            enabled: true,
            material: 'foliage_bush',
            stiffness: 1.2,
            damping: 0.25,
            bounciness: Number((1.15 * intensity).toFixed(2))
          }
          affected++
        } else if (logicId.includes('sway')) {
          layer.physics = {
            enabled: true,
            material: 'wood_tree',
            stiffness: 0.8,
            damping: 0.4,
            bounciness: 0.9
          }
          affected++
        }
      }
    }

    // 3. Luồng Thoại & Âm thanh (audio_mix)
    const audioEdge = incomingEdges.find((e) => e.toPort === 'audio_mix')
    if (audioEdge) {
      const src = activeNodeMap.get(audioEdge.fromNode)
      if (src) {
        const intensity = src.params?.intensity ?? 1.0
        const tracks = project.audioTracks ?? []
        for (const tr of tracks) {
          tr.lipSyncEnabled = true
          tr.lipSyncLayerId = layer.id
          tr.lipSyncIntensity = Number((1.0 * intensity).toFixed(2))
        }
        affected++
      }
    }
  }

  return affected
}
