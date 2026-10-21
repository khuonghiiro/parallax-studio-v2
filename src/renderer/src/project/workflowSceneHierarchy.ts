import type {
  Layer,
  Project,
  Shot,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode
} from '@shared/types'
import { classifyLayerRole, getDefaultPartsForNode } from './workflowTargets'

/**
 * Tính toán thời lượng ước tính (giây) của một Phân cảnh.
 * Mặc định chia đều thời lượng Comp cho số lượng phân cảnh.
 */
export function getShotDuration(project: Project, _shotId?: string): number {
  const total = project.comp?.duration ?? 4
  const count = Math.max(1, project.shots?.length ?? 1)
  return Math.round((total / count) * 10) / 10
}

/**
 * Tính toán thời lượng hiệu dụng (giây) của Workflow:
 * - Khi không có node nào: trả về 0s (bản vẽ trống).
 * - Khi đang chọn phân cảnh cụ thể: trả về thời lượng của phân cảnh đó.
 * - Khi có node cảnh: lấy thời lượng từ node cảnh hoặc shot tương ứng.
 * - Mặc định: thời lượng của comp dự án.
 */
export function getWorkflowEffectiveDuration(
  workflow: WorkflowGraph,
  project: Project,
  currentShotScope?: string
): number {
  if (!workflow.nodes || workflow.nodes.length === 0) {
    return 0
  }
  if (currentShotScope && currentShotScope !== 'all') {
    return getShotDuration(project, currentShotScope)
  }
  const sceneNodes = workflow.nodes.filter((n) => n.type === 'scene_shot' && n.enabled)
  if (sceneNodes.length > 0) {
    const shotIds = sceneNodes.map((n) => n.params?.shotId).filter(Boolean)
    if (shotIds.length === 1 && shotIds[0] !== 'all') {
      return getShotDuration(project, shotIds[0])
    }
    const customDur = sceneNodes[0].params?.duration
    if (typeof customDur === 'number' && customDur > 0) {
      return customDur
    }
  }
  return project.comp?.duration ?? 0
}

/**
 * Lọc danh sách các Layer gốc (Root Layers) đại diện thuộc một Phân cảnh.
 * Tự động nhóm các layer con của Cụm Composite 2.5D về Layer gốc của cụm.
 */
export function getRootLayersForShot(project: Project, shotId?: string): Layer[] {
  const scopedLayers = project.layers.filter((l) => {
    if (l.locked) return false
    if (project.shots.length <= 1) return true
    if (!shotId || shotId === 'all') return true
    return l.shotId === shotId
  })

  // Chỉ lấy layer không thuộc composite hoặc là layer gốc của composite (isRoot: true)
  const seenComposites = new Set<string>()
  const result: Layer[] = []

  for (const l of scopedLayers) {
    if (l.composite) {
      const instId = l.composite.instanceId || l.composite.compositeId
      if (seenComposites.has(instId)) continue
      seenComposites.add(instId)
      // Ưu tiên layer isRoot, nếu không có thì lấy layer đầu tiên của cụm
      const rootLayer =
        scopedLayers.find((sub) => sub.composite?.instanceId === instId && sub.composite?.isRoot) ??
        l
      result.push(rootLayer)
    } else {
      result.push(l)
    }
  }

  // Sắp xếp theo thứ tự chiều sâu Z từ xa tới gần (Z lớn -> Z nhỏ)
  return result.sort((a, b) => {
    const za = a.transform?.position?.value[2] ?? 0
    const zb = b.transform?.position?.value[2] ?? 0
    return zb - za
  })
}

/**
 * Lấy danh sách tên các bộ phận con của một Layer 2.5D Composite.
 */
export function getCompositeSubPartNames(layer: Layer, project: Project): string[] {
  if (!layer.composite?.instanceId) return []
  const instId = layer.composite.instanceId
  return project.layers
    .filter((l) => l.composite?.instanceId === instId)
    .map((l) => l.name.replace(/^.*[\\/]/, ''))
}

/**
 * Xác định tiêu đề hiển thị và biểu tượng ngữ nghĩa cho một Node Layer con.
 */
export function formatLayerNodeLabel(layer: Layer, project: Project): {
  icon: string
  title: string
  badgeLabel: string
  zDepth: number
  partNames: string[]
} {
  const zDepth = Math.round(layer.transform?.position?.value[2] ?? 0)
  const partNames = getCompositeSubPartNames(layer, project)

  if (layer.composite) {
    const compName = layer.composite.compositeName || layer.name
    return {
      icon: '🧩',
      title: `🧩 Layer 2.5D: ${compName}`,
      badgeLabel: `2.5D (${partNames.length > 0 ? partNames.length : 1} bộ phận)`,
      zDepth,
      partNames
    }
  }
  if (layer.model3d) {
    return {
      icon: '🏛️',
      title: `🏛️ Mô hình 3D: ${layer.name}`,
      badgeLabel: '3D Geometry',
      zDepth,
      partNames: []
    }
  }
  if (layer.type === 'particles') {
    return {
      icon: '🪄',
      title: `🪄 Layer Hạt: ${layer.name}`,
      badgeLabel: 'Particles',
      zDepth,
      partNames: []
    }
  }
  const isGround =
    layer.name.toLowerCase().includes('mặt đất') ||
    (layer.transform?.rotation?.value?.[0] ?? 0) <= -65
  if (isGround) {
    return {
      icon: '⛰️',
      title: `⛰️ Mặt đất 3D: ${layer.name}`,
      badgeLabel: 'Ground 3D',
      zDepth,
      partNames: []
    }
  }
  if (layer.type === 'text') {
    return {
      icon: '🔤',
      title: `🔤 Layer Chữ: ${layer.name}`,
      badgeLabel: 'Text',
      zDepth,
      partNames: []
    }
  }
  if (layer.type === 'solid') {
    return {
      icon: '⬛',
      title: `⬛ Nền Solid: ${layer.name}`,
      badgeLabel: 'Solid',
      zDepth,
      partNames: []
    }
  }

  // Mặc định: Layer Ảnh 2.5D
  return {
    icon: '🖼️',
    title: `🖼️ Layer: ${layer.name}`,
    badgeLabel: `Z: ${zDepth}`,
    zDepth,
    partNames: []
  }
}

/**
 * Bung một Cảnh (Shot) thành 1 Node Cảnh trung tâm kèm toàn bộ các Node Layer con,
 * tự động nối dây cổng `scene_ctx` từ Node Cảnh tới từng Node Layer con.
 */
export function spawnSceneWithChildLayers(
  project: Project,
  workflow: WorkflowGraph,
  targetShotId?: string
): {
  workflow: WorkflowGraph
  sceneNode: WorkflowNode
  childNodes: WorkflowNode[]
} {
  const shot: Shot =
    (targetShotId && targetShotId !== 'all'
      ? project.shots.find((s) => s.id === targetShotId)
      : null) ??
    project.shots[0] ?? {
      id: 'shot-default',
      name: 'Cảnh 1',
      color: '#38bdf8',
      visible: true,
      position: { value: [0, 0, 0] },
      rotation: { value: [0, 0, 0] }
    }

  const rootLayers = getRootLayersForShot(project, shot.id)
  const shotDuration = getShotDuration(project, shot.id)

  const NODE_W = 248
  const COL_GAP = 36
  const sceneX = 60
  const sceneY = 40

  // 1. Tạo Node Cảnh (Scene Shot Node) với ID cố định theo shot.id để không bao giờ bị nhân đôi
  const sceneNodeId = `wf-scene-${shot.id}`
  const sceneNode: WorkflowNode = {
    id: sceneNodeId,
    type: 'scene_shot',
    title: `🎬 Cảnh: ${shot.name} (${shotDuration.toFixed(1)}s)`,
    enabled: true,
    position: { x: sceneX, y: sceneY },
    preset: 'deep_parallax_stage',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: `Phân cảnh gốc "${shot.name}" (${shotDuration.toFixed(1)}s) điều phối ${rootLayers.length} layer con và không gian Z.`,
    params: {
      shotId: shot.id,
      duration: shotDuration,
      autoArrangeZ: true,
      targetMode: 'custom',
      targetLayerIds: rootLayers.map((l) => l.id)
    }
  }

  // 2. Tạo Node Lộ trình Camera 3D bên phải Node Cảnh (Pan lia máy rồi Zoom đẩy cận)
  const camX = sceneX + NODE_W + 48
  const camY = sceneY
  const camNodeId = `wf-cam-${shot.id}`
  const camNode: WorkflowNode = {
    id: camNodeId,
    type: 'camera_director',
    title: `🎥 Camera: ${shot.name}`,
    enabled: true,
    position: { x: camX, y: camY },
    preset: 'pan_and_dolly',
    aiAgentRole: 'CameraDirectorAgent',
    aiDirective: `Lia camera từ toàn cảnh tới vị trí/layer mục tiêu rồi zoom to dần vào chủ thể.`,
    params: {
      shotId: shot.id,
      duration: shotDuration,
      camChoreography: 'pan_and_dolly',
      camPanDurationRatio: 0.45,
      intensity: 1.15
    }
  }

  const childLayerNodes: WorkflowNode[] = []
  const childTransformNodes: WorkflowNode[] = []
  const childEdges: WorkflowEdge[] = []

  // Nối cổng scene_ctx từ Node Cảnh sang Node Camera bên phải
  childEdges.push({
    id: `edge-${sceneNodeId}-scene_ctx-${camNodeId}-scene_ctx`,
    fromNode: sceneNodeId,
    fromPort: 'scene_ctx',
    toNode: camNodeId,
    toPort: 'scene_ctx'
  })

  // 3. Sắp xếp các Layer con từ trái sang phải theo Z-index (từ xa tới gần) kèm độ dốc chiều sâu Z
  const zValues = rootLayers.map((l) => l.transform?.position?.value[2] ?? 0)
  const zMax = zValues.length > 0 ? Math.max(...zValues) : 0
  const zMin = zValues.length > 0 ? Math.min(...zValues) : 0
  const zSpan = Math.max(1, zMax - zMin)

  rootLayers.forEach((layer, idx) => {
    const meta = formatLayerNodeLabel(layer, project)
    const childNodeId = `wf-layer-${shot.id}-${layer.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    const transNodeId = `wf-trans-${shot.id}-${layer.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

    const layerZ = layer.transform?.position?.value[2] ?? 0
    const normZ = (layerZ - zMin) / zSpan // 1.0 = sâu nhất (bầu trời), 0.0 = tiền cảnh
    const childX = 60 + idx * (NODE_W + COL_GAP)
    // Tầng Z sâu hơn (normZ ~ 1) ở cao hơn tại Y=350, tiền cảnh (normZ ~ 0) ở thấp hơn tại Y=378 tạo dốc Z trực quan nhẹ
    const childY = 350 + Math.round((1 - normZ) * 28)

    // Gom tất cả ID của layer trong cụm composite (nếu có)
    const allLayerIdsInGroup = layer.composite?.instanceId
      ? project.layers
          .filter((l) => l.composite?.instanceId === layer.composite?.instanceId)
          .map((l) => l.id)
      : [layer.id]

    const childNode: WorkflowNode = {
      id: childNodeId,
      type: 'layer_assembly',
      title: meta.title,
      enabled: layer.visible !== false,
      position: { x: childX, y: childY },
      preset: layer.composite ? 'character_and_foliage_rig' : 'character_and_foliage_rig',
      aiAgentRole: 'AssemblyRigAgent',
      aiDirective: `Cấu hình logic chuyên biệt cho layer "${layer.name}" (Z: ${meta.zDepth}) trong cảnh ${shot.name}.`,
      params: {
        shotId: shot.id,
        targetMode: 'custom',
        targetLayerIds: allLayerIdsInGroup,
        targetParts:
          meta.partNames.length > 0
            ? meta.partNames
            : getDefaultPartsForNode({ type: 'layer_assembly', preset: 'character_and_foliage_rig' })
      }
    }
    childLayerNodes.push(childNode)

    // Tạo dây nối từ bottom port layers_tree của Node Cảnh tới top port layers_tree của Node Layer con
    childEdges.push({
      id: `edge-${sceneNodeId}-layers_tree-${childNodeId}-layers_tree`,
      fromNode: sceneNodeId,
      fromPort: 'layers_tree',
      toNode: childNodeId,
      toPort: 'layers_tree'
    })

    // 4. Tạo companion node layer_transform mặc định kết nối sẵn dưới đáy mỗi node layer (cách 14px)
    const transY = childY + 205 + 14
    const transformNode: WorkflowNode = {
      id: transNodeId,
      type: 'layer_transform',
      title: `🎯 Tọa độ: ${layer.name}`,
      enabled: layer.visible !== false,
      position: { x: childX, y: transY },
      preset: 'layer_transform_controller',
      aiAgentRole: 'LayerTransformAgent',
      aiDirective: `Điều khiển trực tiếp trục X, Y, Z và góc xoay hướng cho layer "${layer.name}".`,
      params: {
        shotId: shot.id,
        targetMode: 'custom',
        targetLayerIds: [layer.id],
        transformX: Math.round(layer.transform?.position?.value[0] ?? 0),
        transformY: Math.round(layer.transform?.position?.value[1] ?? 0),
        transformZ: Math.round(layer.transform?.position?.value[2] ?? 0),
        transformRotation: Math.round(layer.transform?.rotation?.value[2] ?? 0)
      }
    }
    childTransformNodes.push(transformNode)

    // Dây nối cố định vĩnh viễn (Permanent Wire) từ bottom port transform_link sang top port transform_link
    childEdges.push({
      id: `edge-${childNodeId}-transform_link-${transNodeId}-transform_link`,
      fromNode: childNodeId,
      fromPort: 'transform_link',
      toNode: transNodeId,
      toPort: 'transform_link'
    })
  })

  // 5. XỬ LÝ LỌC TRÙNG LẶP TRIỆT ĐỂ (Anti-Duplication Guarantee):
  const isOldSceneForThisShot = (n: WorkflowNode) =>
    n.type === 'scene_shot' &&
    (n.params?.shotId === shot.id ||
      n.id === sceneNodeId ||
      n.id.startsWith(`wf-scene-${shot.id}`) ||
      (n.id === 'wf-scene_shot' && (!n.params?.shotId || n.params.shotId === shot.id)))

  const isOldLayerForThisShot = (n: WorkflowNode) =>
    n.type === 'layer_assembly' &&
    (n.params?.shotId === shot.id ||
      n.id.startsWith(`wf-layer-${shot.id}`) ||
      n.id === 'wf-layer_assembly')

  const isOldTransformForThisShot = (n: WorkflowNode) =>
    n.type === 'layer_transform' &&
    (n.params?.shotId === shot.id ||
      n.id.startsWith(`wf-trans-${shot.id}`) ||
      n.id.startsWith(`wf-transform-${shot.id}`))

  const isOldCamForThisShot = (n: WorkflowNode) =>
    n.type === 'camera_director' &&
    (n.params?.shotId === shot.id || n.id === camNodeId || n.id === 'wf-camera_director')

  const removedNodeIds = new Set(
    workflow.nodes
      .filter(
        (n) =>
          isOldSceneForThisShot(n) ||
          isOldLayerForThisShot(n) ||
          isOldTransformForThisShot(n) ||
          isOldCamForThisShot(n)
      )
      .map((n) => n.id)
  )

  const retainedNodes = workflow.nodes.filter((n) => !removedNodeIds.has(n.id))
  const nextNodes = [sceneNode, camNode, ...childLayerNodes, ...childTransformNodes, ...retainedNodes]

  // Giữ lại các edge không dính tới node bị xóa
  const retainedEdges = workflow.edges.filter(
    (e) => !removedNodeIds.has(e.fromNode) && !removedNodeIds.has(e.toNode)
  )

  const nextEdges: WorkflowEdge[] = [...childEdges]
  for (const e of retainedEdges) {
    if (!nextEdges.some((x) => x.id === e.id)) {
      nextEdges.push(e)
    }
  }

  // Tự động nối dây bổ sung cho các khối chức năng hạ nguồn nếu còn thiếu mạch
  const motionNode = nextNodes.find((n) => n.type === 'motion_choreography')
  if (motionNode && !nextEdges.some((e) => e.toNode === motionNode.id && e.toPort === 'actors_rig')) {
    const actorChild = childLayerNodes.find((c) => c.title.includes('2.5D') || c.title.includes('Nhân vật')) ?? childLayerNodes[0]
    if (actorChild) {
      nextEdges.push({
        id: `edge-${actorChild.id}-actors_rig-${motionNode.id}-actors_rig`,
        fromNode: actorChild.id,
        fromPort: 'actors_rig',
        toNode: motionNode.id,
        toPort: 'actors_rig'
      })
    }
  }

  const audioNode = nextNodes.find((n) => n.type === 'audio_lipsync')
  if (audioNode && !nextEdges.some((e) => e.toNode === audioNode.id && e.toPort === 'scene_ctx')) {
    nextEdges.push({
      id: `edge-${sceneNodeId}-scene_ctx-${audioNode.id}-scene_ctx`,
      fromNode: sceneNodeId,
      fromPort: 'scene_ctx',
      toNode: audioNode.id,
      toPort: 'scene_ctx'
    })
  }

  return {
    workflow: {
      ...workflow,
      targetShotId: shot.id,
      nodes: nextNodes,
      edges: nextEdges
    },
    sceneNode,
    childNodes: childLayerNodes,
    transformNodes: childTransformNodes
  }
}

/**
 * Tự động phát hiện và bổ sung các Layer mới được thêm vào phân cảnh
 * nếu sơ đồ Workflow hiện tại đã được bung các Layer con trước đó.
 */
export function syncMissingLayersToWorkflow(
  workflow: WorkflowGraph,
  project: Project,
  currentShotScope?: string
): { workflow: WorkflowGraph; addedCount: number } | null {
  const sceneNode = workflow.nodes.find((n) => n.type === 'scene_shot')
  const hasUnpackedLayers = workflow.nodes.some(
    (n) => n.type === 'layer_assembly' && n.id.startsWith('wf-layer-')
  )
  if (!sceneNode || !hasUnpackedLayers) return null

  const existingLayerIds = new Set(
    workflow.nodes
      .filter((n) => n.type === 'layer_assembly' && n.id.startsWith('wf-layer-'))
      .flatMap((n) => n.params?.targetLayerIds ?? [])
  )

  const missingLayers = project.layers.filter(
    (l) =>
      !l.locked &&
      (currentShotScope === 'all' || !l.shotId || l.shotId === currentShotScope) &&
      !existingLayerIds.has(l.id)
  )

  if (missingLayers.length === 0) return null

  const nextNodes = [...workflow.nodes]
  const nextEdges = [...workflow.edges]

  for (const ml of missingLayers) {
    const layerNodeId = `wf-layer-${ml.id}`
    const transNodeId = `wf-trans-${ml.id}`
    if (nextNodes.some((n) => n.id === layerNodeId)) continue

    const posX = ml.transform.position.value[0] ?? 0
    const posY = ml.transform.position.value[1] ?? 0
    const posZ = ml.transform.position.value[2] ?? 0
    const rotZ = ml.transform.rotation.value[2] ?? 0

    nextNodes.push({
      id: layerNodeId,
      type: 'layer_assembly',
      title: ml.name,
      enabled: true,
      preset: 'character_puppet_25d',
      aiAgentRole: 'LayerAssemblyAgent',
      position: { x: 100, y: 340 },
      params: {
        targetLayerIds: [ml.id],
        shotId: ml.shotId || currentShotScope
      }
    })

    nextNodes.push({
      id: transNodeId,
      type: 'layer_transform',
      title: `Tọa độ: ${ml.name}`,
      enabled: true,
      preset: 'layer_transform_controller',
      aiAgentRole: 'LayerTransformAgent',
      position: { x: 100, y: 580 },
      params: {
        targetLayerIds: [ml.id],
        transformX: posX,
        transformY: posY,
        transformZ: posZ,
        transformRotation: rotZ
      }
    })

    nextEdges.push({
      id: `edge-${sceneNode.id}-layers_tree-${layerNodeId}-layers_tree`,
      fromNode: sceneNode.id,
      fromPort: 'layers_tree',
      toNode: layerNodeId,
      toPort: 'layers_tree'
    })

    nextEdges.push({
      id: `edge-${layerNodeId}-transform_link-${transNodeId}-transform_link`,
      fromNode: layerNodeId,
      fromPort: 'transform_link',
      toNode: transNodeId,
      toPort: 'transform_link'
    })
  }

  return {
    workflow: {
      ...workflow,
      nodes: nextNodes,
      edges: nextEdges
    },
    addedCount: missingLayers.length
  }
}

