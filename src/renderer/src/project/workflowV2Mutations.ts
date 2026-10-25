import type { LayerMotionType, Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import {
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  recomputeSharedLogicTargets
} from './workflowV2PhysicsAndValidation'
import { WF_V2_COL_X, layoutWorkflowV2Tree } from './workflowV2Layout'
import {
  applyLogicPresetToNode,
  defaultLogicPreset,
  findLogicPreset,
  type WorkflowV2SpawnCategory
} from './workflowV2LogicPresets'

const NODE_TYPE: Record<WorkflowV2SpawnCategory, WorkflowNode['type']> = {
  action: 'motion_choreography',
  audio: 'audio_lipsync',
  material: 'physics_fx',
  collision: 'physics_fx',
  light: 'physics_fx',
  cave: 'physics_fx',
  fx: 'physics_fx'
}

const AGENT: Record<WorkflowV2SpawnCategory, WorkflowNode['aiAgentRole']> = {
  action: 'MotionChoreographyAgent',
  audio: 'AudioLipSyncAgent',
  material: 'PhysicsLightFxAgent',
  collision: 'PhysicsLightFxAgent',
  light: 'PhysicsLightFxAgent',
  cave: 'PhysicsLightFxAgent',
  fx: 'PhysicsLightFxAgent'
}

function uniqueNodeId(workflow: WorkflowGraph, base: string): string {
  let id = base
  let i = 2
  while (workflow.nodes.some((n) => n.id === id)) id = `${base}-${i++}`
  return id
}

function withEdge(workflow: WorkflowGraph, nodes: WorkflowNode[], edge: WorkflowEdge): WorkflowGraph {
  const edges = [...workflow.edges, edge]
  return { ...workflow, nodes: layoutWorkflowV2Tree(recomputeSharedLogicTargets(nodes, edges), edges), edges }
}

const layerEdge = (layerNodeId: string, nodeId: string): WorkflowEdge => ({
  id: `e-${layerNodeId}-${nodeId}`,
  fromNode: layerNodeId,
  fromPort: 'layers_tree',
  toNode: nodeId,
  toPort: 'layers_tree'
})

/**
 * Gắn (hoặc tái sử dụng) một Node Logic vào một Node Layer theo mẫu logic chung `presetId`
 * (dùng chung cho Timeline, Workflow và MCP):
 * - Layer đã có logic cùng nhóm → tái sử dụng Node đó (và áp mẫu mới nếu có), không tạo trùng.
 * - Va chạm: ưu tiên ghép làm Layer B vào Node Va chạm cùng cảnh đang chờ; nếu không, tạo Node mới chờ nối Layer B
 *   (không tự đoán đối tượng va chạm).
 * - Id Node xác định theo Layer (`v2-<nhóm>-<layerId>`) để Timeline và Workflow luôn trỏ cùng một Node.
 */
export function attachLogicNodeToLayerV2(
  workflow: WorkflowGraph,
  layerNodeId: string,
  category: WorkflowV2SpawnCategory,
  presetId?: string
): { workflow: WorkflowGraph; createdNodeId: string; reusedExisting?: boolean; message?: string } {
  const layerNode = workflow.nodes.find((n) => n.id === layerNodeId)
  if (!layerNode || layerNode.type !== 'layer_assembly' || layerNode.params?.groupKind) {
    return { workflow, createdNodeId: '', message: 'Không tìm thấy Node Layer mục tiêu.' }
  }
  const chosen = (presetId ? findLogicPreset(presetId) : undefined) ?? defaultLogicPreset(category)
  const existing = workflow.edges
    .filter((e) => e.fromNode === layerNodeId)
    .map((e) => workflow.nodes.find((n) => n.id === e.toNode))
    .find((n) => n?.params?.logicCategory === category)
  if (existing) {
    const nodes = presetId ? workflow.nodes.map((n) => (n.id === existing.id ? applyLogicPresetToNode(n, chosen) : n)) : workflow.nodes
    return {
      workflow: { ...workflow, nodes },
      createdNodeId: existing.id,
      reusedExisting: true,
      message: presetId
        ? `Layer "${layerNode.title}" đã có Node ${chosen.title.split(':')[0]} — đã chuyển Node đó sang "${chosen.label}".`
        : `Layer "${layerNode.title}" đã có "${existing.title}" — chọn Node này để tránh trùng logic.`
    }
  }
  if (category === 'collision') {
    const open = workflow.nodes.find(
      (n) =>
        n.params?.logicCategory === 'collision' &&
        (n.params?.sharedLayerNodeIds?.length ?? 0) < 2 &&
        n.params?.shotId === layerNode.params?.shotId
    )
    if (open) {
      return {
        workflow: withEdge(workflow, workflow.nodes, layerEdge(layerNodeId, open.id)),
        createdNodeId: open.id,
        reusedExisting: true,
        message: `Đã ghép "${layerNode.title}" làm Layer B cho "${open.title}".`
      }
    }
  }
  const layerId = layerNodeId.replace(/^v2-layer-/, '')
  const id = uniqueNodeId(workflow, `v2-${category}-${layerId}`)
  const node: WorkflowNode = applyLogicPresetToNode(
    {
      id,
      type: NODE_TYPE[category],
      title: chosen.title,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: category === 'action' ? 'organic_wind_breathe' : category === 'audio' ? 'auto_dialogue_lipsync' : 'rim_glow_particles',
      aiAgentRole: AGENT[category],
      aiDirective: `${chosen.title} cho "${layerNode.title}".`,
      params: {
        shotId: layerNode.params?.shotId,
        logicCategory: category,
        targetMode: 'custom',
        targetLayerIds: [...(layerNode.params?.targetLayerIds ?? [])],
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        timeStart: layerNode.params?.timeStart ?? 0,
        timeEnd: layerNode.params?.timeEnd ?? 5,
        hierarchyParentNodeId: layerNodeId,
        ...(category === 'collision' ? { strikerLayerId: layerNode.params?.targetLayerIds?.[0] } : {})
      }
    },
    chosen
  )
  return {
    workflow: withEdge(workflow, [...workflow.nodes, node], layerEdge(layerNodeId, id)),
    createdNodeId: id,
    message: category === 'collision' ? 'Đã tạo Node Va chạm — nối thêm 1 Layer (Layer B) để va chạm có hiệu lực.' : undefined
  }
}

/** Đồng bộ Node Âm thanh xuống các track đang gắn vào Layer đích (âm lượng, tắt tiếng, nhép môi, mốc bắt đầu) */
function syncAudioNodeToProject(project: Project, node: WorkflowNode, params: WorkflowNodeParams, timeEdited: boolean): void {
  const targets = new Set(params.targetLayerIds ?? [])
  const instanceIds = new Set(
    project.layers
      .filter((l) => targets.has(l.id))
      .flatMap((l) => [l.composite?.instanceId, l.model3d?.instanceId])
      .filter((v): v is string => Boolean(v))
  )
  for (const tr of getProjectAudioTracks(project)) {
    if (!tr.targetId || (!targets.has(tr.targetId) && !instanceIds.has(tr.targetId))) continue
    tr.muted = !node.enabled
    if (typeof params.intensity === 'number') tr.volume = Math.max(0, Math.min(2, params.intensity))
    tr.lipSyncEnabled = Boolean(params.autoLipSync)
    if (timeEdited && typeof params.timeStart === 'number') tr.offset = Math.max(0, params.timeStart)
  }
}

/**
 * Đồng bộ Node Layer / Group xuống Layer thật:
 * - Bật/tắt Node = ẩn/hiện Layer.
 * - Node Layer: chỉ ghi inPoint/outPoint khi người dùng thực sự đổi khoảng mốc (hoặc áp dụng toàn bộ),
 *   và ghi toạ độ X/Y/Z.
 * - Node Group: TUYỆT ĐỐI không san phẳng khoảng thời gian của các Layer con; khi người dùng thu hẹp
 *   khoảng mốc của Group thì chỉ cắt các Layer con vào trong khoảng đó.
 */
function syncLayerOrGroupNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const timeEdited = !patch || 'timeStart' in patch || 'timeEnd' in patch
  const tStart = typeof params.timeStart === 'number' && Number.isFinite(params.timeStart) ? params.timeStart : undefined
  const tEnd = typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd) ? params.timeEnd : undefined
  const isGroup = Boolean(params.groupKind)
  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    l.visible = node.enabled
    if (isGroup) {
      if (!patch || !timeEdited || tStart === undefined || tEnd === undefined) continue
      const nextIn = Math.min(Math.max(l.inPoint ?? 0, tStart), tEnd - 0.1)
      const nextOut = Math.max(Math.min(l.outPoint ?? tEnd, tEnd), nextIn + 0.1)
      l.inPoint = Number(Math.max(0, nextIn).toFixed(2))
      l.outPoint = Number(nextOut.toFixed(2))
      continue
    }
    if (timeEdited && tStart !== undefined) l.inPoint = Math.max(0, tStart)
    if (timeEdited && tEnd !== undefined && tEnd > (l.inPoint ?? 0)) l.outPoint = tEnd
    if (l.transform?.position?.value) {
      const curPos = l.transform.position.value
      const nx = typeof params.transformX === 'number' ? params.transformX : curPos[0]
      const ny = typeof params.transformY === 'number' ? params.transformY : curPos[1]
      const nz = typeof params.transformZ === 'number' ? params.transformZ : curPos[2]
      l.transform.position.value = [nx, ny, nz]
    }
  }
}

/**
 * Đồng bộ trực tiếp thay đổi trên một Node V2 xuống dữ liệu Project thực tế
 * (bao gồm Node Nhãn Vật liệu và Node Va chạm Vật lý 2 Layer).
 */
export function syncWorkflowV2NodeToProject(
  project: Project,
  node: WorkflowNode,
  patch?: Partial<WorkflowNodeParams>
): void {
  const params: WorkflowNodeParams = { ...(node.params ?? {}), ...(patch ?? {}) }
  const mergedNode: WorkflowNode = { ...node, params }
  const targetIds = new Set(params.targetLayerIds ?? [])
  const tStart = params.timeStart
  const tEnd = params.timeEnd

  // 1. Node Layer hoặc Group Layer
  if (node.type === 'layer_assembly') {
    syncLayerOrGroupNodeToProject(project, node, params, patch)
    return
  }

  // 2. Node Nhãn Vật liệu (Material Tag)
  if (params.logicCategory === 'material') {
    applyMaterialNodeToProject(project, mergedNode)
    return
  }

  // 3. Node Va chạm Vật lý (2-Layer Collision Physics)
  if (params.logicCategory === 'collision') {
    applyCollisionNodeToProject(project, project.workflow, mergedNode)
    return
  }

  // 4. Node Hành động (Motion / Action) — tắt Node chỉ tắt chuyển động, giữ kiểu để bật lại không mất cấu hình
  if (node.type === 'motion_choreography' || params.logicCategory === 'action') {
    const actOpt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === params.actionPreset)
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const motionType = (actOpt?.motionType ?? (params.actionPreset as LayerMotionType | undefined) ?? l.motion?.type ?? 'float') as LayerMotionType
      if (!node.enabled) {
        l.motion = { ...(l.motion ?? { speed: 1, amount: 0 }), type: motionType, enabled: false }
        continue
      }
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      l.motion = {
        ...(l.motion ?? {}),
        enabled: true,
        type: motionType,
        speed: actOpt?.defaultSpeed ?? l.motion?.speed ?? 1,
        amount: Math.max(0.1, Math.min(2.0, params.intensity ?? actOpt?.defaultAmount ?? 0.6)),
        startTime: startSec,
        duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
      }
    }
    return
  }

  // 4b. Node Âm thanh — ghi xuống track âm thanh đang gắn vào Layer
  if (node.type === 'audio_lipsync' || params.logicCategory === 'audio') {
    syncAudioNodeToProject(project, node, params, !patch || 'timeStart' in patch)
    return
  }

  // 5. Node Hang động / Vùng độ sâu (Cave Depth Portal)
  if (params.logicCategory === 'cave') {
    const archShape = params.caveArchShape ?? 'arch'
    const darkness = Math.max(0.1, Math.min(1.0, params.caveDarkness ?? params.intensity ?? 0.82))
    const minScale = params.caveMinScale ?? 0.38
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      l.physics = {
        ...(l.physics ?? { enabled: true, material: 'none' }),
        enabled: node.enabled,
        colliderZone: 'cave_portal',
        depthPortal: {
          enabled: node.enabled,
          centerUV: [0.5, 0.45],
          radiusUV: [0.35, 0.35],
          minScale,
          darkness,
          shadowTint: '#060812',
          depthPullZ: 140,
          archShape,
          feather: 0.55
        }
      }
    }
    return
  }

  // 6. Node Ánh sáng (Light)
  if (params.logicCategory === 'light') {
    const color = params.lightColor || '#38bdf8'
    const intensity = params.intensity ?? 1.3
    const mode = params.lightMode || 'rim'
    const lightOpt =
      WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === mode) ?? WORKFLOW_V2_LIGHT_OPTIONS[0]
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      if (mode === 'glow' || mode === 'rim') {
        l.glow = {
          enabled: node.enabled,
          color,
          intensity: Math.min(3, intensity),
          thickness: 12,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
      l.virtualLight = {
        enabled: node.enabled,
        kind: lightOpt.virtualKind,
        color,
        intensity,
        radius: 460,
        originUV: [0.5, 0.5],
        zReach: 320
      }
    }
    return
  }

  // 7. Node Hiệu ứng & Vật lý (FX)
  if (params.logicCategory === 'fx') {
    const fxKind = params.fxKind || 'wind_physics'
    const intensity = params.intensity ?? 1.0
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      if (fxKind === 'wind_physics') {
        l.physics = {
          ...(l.physics ?? { material: 'foliage_bush' }),
          enabled: node.enabled,
          material: l.physics?.material ?? 'foliage_bush',
          stiffness: 0.8 * intensity,
          damping: 0.35,
          bounciness: 0.9 * intensity
        }
      } else {
        const startSec = tStart ?? l.inPoint ?? 0
        const endSec = tEnd ?? l.outPoint ?? project.comp.duration
        l.glow = {
          enabled: node.enabled,
          color: fxKind === 'chromatic' ? '#a855f7' : '#38bdf8',
          intensity: Math.min(3, intensity * 1.4),
          thickness: 10,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
    }
    return
  }

  // 8. Node Camera 3D
  if (node.type === 'camera_director' || params.logicCategory === 'camera') {
    if (project.camera && typeof params.enableDof === 'boolean') {
      project.camera.dofEnabled = params.enableDof
    }
  }
}

