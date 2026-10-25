import type {
  Layer,
  Project,
  Shot,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import {
  WF_V2_COL_X,
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  buildWorkflowV2SceneTree,
  classifyLayerGroupKind,
  collectRepresentativeLayers,
  getLayerDisplayName,
  getLayerX,
  getLayerY,
  getLayerZ,
  getShotTimeRange,
  layoutWorkflowV2Tree,
  recomputeSharedLogicTargets
} from './workflowV2Engine'

/**
 * Gắn thêm hoặc tái sử dụng một Node Logic (Hành động, Vật liệu, Va chạm, Ánh sáng, Hang động, Hiệu ứng, Âm thanh)
 * vào một Node Layer, có kiểm tra chống trùng lặp logic trên cùng 1 Layer.
 */
export function attachLogicNodeToLayerV2(
  workflow: WorkflowGraph,
  layerNodeId: string,
  category: 'action' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio'
): { workflow: WorkflowGraph; createdNodeId: string; reusedExisting?: boolean; message?: string } {
  const layerNode = workflow.nodes.find((n) => n.id === layerNodeId)
  if (!layerNode) {
    return { workflow, createdNodeId: '', message: 'Không tìm thấy Node Layer mục tiêu.' }
  }
  const layerName = layerNode.title ?? 'Layer'

  // 1. KIỂM TRA CHỐNG TRÙNG LOGIC TRÊN CÙNG 1 LAYER
  const existingSameCategoryNode = workflow.edges
    .filter((e) => e.fromNode === layerNodeId)
    .map((e) => workflow.nodes.find((n) => n.id === e.toNode))
    .find((n) => n && n.params?.logicCategory === category)

  if (existingSameCategoryNode) {
    return {
      workflow,
      createdNodeId: existingSameCategoryNode.id,
      reusedExisting: true,
      message: `Layer "${layerName}" đã có sẵn "${existingSameCategoryNode.title}". Đã chọn trực tiếp Node này để tránh trùng logic!`
    }
  }

  // 2. NẾU LÀ NODE VA CHẠM: Ưu tiên ghép đôi vào một Node Va chạm đang chờ Layer thứ 2
  if (category === 'collision') {
    const openCollisionNode = workflow.nodes.find(
      (n) =>
        n.params?.logicCategory === 'collision' &&
        (n.params?.sharedLayerNodeIds?.length ?? 0) < 2 &&
        !workflow.edges.some((e) => e.fromNode === layerNodeId && e.toNode === n.id)
    )
    if (openCollisionNode) {
      const nextEdges: WorkflowEdge[] = [
        ...workflow.edges,
        {
          id: `e-${layerNodeId}-${openCollisionNode.id}`,
          fromNode: layerNodeId,
          fromPort: 'layers_tree',
          toNode: openCollisionNode.id,
          toPort: 'layers_tree'
        }
      ]
      const synced = recomputeSharedLogicTargets(workflow.nodes, nextEdges)
      const laidOut = layoutWorkflowV2Tree(synced, nextEdges)
      return {
        workflow: { ...workflow, nodes: laidOut, edges: nextEdges },
        createdNodeId: openCollisionNode.id,
        reusedExisting: true,
        message: `Đã ghép "${layerName}" làm đối tượng va chạm thứ 2 vào "${openCollisionNode.title}"!`
      }
    }
  }

  const targetLayerIds = layerNode.params?.targetLayerIds ?? []
  const tStart = layerNode.params?.timeStart ?? 0
  const tEnd = layerNode.params?.timeEnd ?? 5
  const shotId = layerNode.params?.shotId ?? workflow.targetShotId
  const suffix = `${Date.now().toString(36).slice(-4)}`
  const createdNodeId = `v2-${category}-${suffix}`
  let newNode: WorkflowNode
  const extraEdges: WorkflowEdge[] = []

  if (category === 'action') {
    const opt = WORKFLOW_V2_ACTION_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'motion_choreography',
      title: `Hành động: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'organic_wind_breathe',
      aiAgentRole: 'MotionChoreographyAgent',
      aiDirective: `Thực thi hành động "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'action',
        actionPreset: opt.id,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultAmount,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'material') {
    const opt = WORKFLOW_V2_MATERIAL_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Vật liệu: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Gắn nhãn vật liệu "${opt.label}" (${opt.deformDesc}) cho "${layerName}".`,
      params: {
        shotId,
        logicCategory: 'material',
        materialTag: opt.id,
        materialStiffness: opt.defaultStiffness,
        materialBounciness: opt.defaultBounciness,
        materialGravity: opt.defaultGravity,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultBounciness,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'collision') {
    const opt = WORKFLOW_V2_COLLISION_OPTIONS[0]
    const partnerLayerNode =
      workflow.nodes.find(
        (n) =>
          n.type === 'layer_assembly' &&
          !n.params?.groupKind &&
          n.id !== layerNodeId &&
          n.params?.hierarchyParentNodeId === layerNode.params?.hierarchyParentNodeId
      ) ??
      workflow.nodes.find(
        (n) => n.type === 'layer_assembly' && !n.params?.groupKind && n.id !== layerNodeId
      )
    const partnerLayerIds = partnerLayerNode?.params?.targetLayerIds ?? []
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Va chạm: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Mô phỏng va chạm vật lý "${opt.label}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'collision',
        collisionMode: opt.id,
        collisionForce: opt.defaultForce,
        deformIntensity: opt.defaultDeform,
        strikerLayerId: targetLayerIds[0],
        targetColliderLayerId: partnerLayerIds[0],
        targetMode: 'custom',
        targetLayerIds: [...targetLayerIds, ...partnerLayerIds],
        sharedLayerNodeIds: partnerLayerNode ? [layerNodeId, partnerLayerNode.id] : [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultForce,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
    if (partnerLayerNode) {
      extraEdges.push({
        id: `e-${partnerLayerNode.id}-${createdNodeId}`,
        fromNode: partnerLayerNode.id,
        fromPort: 'layers_tree',
        toNode: createdNodeId,
        toPort: 'layers_tree'
      })
    }
  } else if (category === 'light') {
    const opt = WORKFLOW_V2_LIGHT_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Ánh sáng: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Chiếu sáng "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'light',
        lightMode: opt.id,
        lightColor: opt.defaultColor,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultIntensity,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'cave') {
    const opt = WORKFLOW_V2_CAVE_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Hang động: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Tạo vùng độ sâu cửa hang "${opt.label}" trên "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'cave',
        caveArchShape: opt.id,
        caveDarkness: opt.defaultDarkness,
        caveMinScale: opt.defaultMinScale,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultDarkness,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else if (category === 'fx') {
    const opt = WORKFLOW_V2_FX_OPTIONS[0]
    newNode = {
      id: createdNodeId,
      type: 'physics_fx',
      title: `Hiệu ứng: ${opt.label}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'rim_glow_particles',
      aiAgentRole: 'PhysicsLightFxAgent',
      aiDirective: `Áp dụng hiệu ứng "${opt.label}" cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'fx',
        fxKind: opt.id,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: opt.defaultIntensity,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  } else {
    newNode = {
      id: createdNodeId,
      type: 'audio_lipsync',
      title: `Âm thanh: ${layerName}`,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: 'auto_dialogue_lipsync',
      aiAgentRole: 'AudioLipSyncAgent',
      aiDirective: `Phát âm thanh / nhép môi cho "${layerName}" từ ${tStart}s đến ${tEnd}s.`,
      params: {
        shotId,
        logicCategory: 'audio',
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        intensity: 1.0,
        autoLipSync: true,
        timeStart: tStart,
        timeEnd: tEnd,
        hierarchyParentNodeId: layerNodeId
      }
    }
  }

  const nextEdges: WorkflowEdge[] = [
    ...workflow.edges,
    {
      id: `e-${layerNodeId}-${createdNodeId}`,
      fromNode: layerNodeId,
      fromPort: 'layers_tree',
      toNode: createdNodeId,
      toPort: 'layers_tree'
    },
    ...extraEdges
  ]
  const syncedNodes = recomputeSharedLogicTargets([...workflow.nodes, newNode], nextEdges)
  const nextNodes = layoutWorkflowV2Tree(syncedNodes, nextEdges)
  return {
    workflow: {
      ...workflow,
      nodes: nextNodes,
      edges: nextEdges
    },
    createdNodeId
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

  // 4. Node Hành động (Motion / Action)
  if (node.type === 'motion_choreography' || params.logicCategory === 'action') {
    const actOpt =
      WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === params.actionPreset) ?? WORKFLOW_V2_ACTION_OPTIONS[0]
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      if (!node.enabled) {
        l.motion = { enabled: false, type: 'none', speed: 1, amount: 0 }
      } else {
        const startSec = tStart ?? l.inPoint ?? 0
        const endSec = tEnd ?? l.outPoint ?? project.comp.duration
        l.motion = {
          enabled: true,
          type: actOpt.motionType,
          speed: actOpt.defaultSpeed,
          amount: Math.max(0.1, Math.min(2.0, params.intensity ?? actOpt.defaultAmount)),
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
    }
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
        ...(l.physics ?? { enabled: true, material: 'stone_wall' }),
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

export { reconcileWorkflowV2WithProject } from './workflowV2Reconcile'
