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
  // Khoảng cách bố cục rộng rãi, triệt tiêu hoàn toàn hiện tượng chồng đè
  const ROW_GAP = 340
  const COL_1_X = 60
  const COL_2_X = 440
  const sceneY = Math.max(80, 80 + Math.round(((Math.max(1, rootLayers.length) - 1) * ROW_GAP) / 2))

  // 1. Tạo Node Cảnh (Scene Shot Node) với ID cố định theo shot.id để không bao giờ bị nhân đôi
  const sceneNodeId = `wf-scene-${shot.id}`
  const sceneNode: WorkflowNode = {
    id: sceneNodeId,
    type: 'scene_shot',
    title: `🎬 Cảnh: ${shot.name} (${shotDuration.toFixed(1)}s)`,
    enabled: true,
    position: { x: COL_1_X, y: sceneY },
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

  // 2. Tạo các Node Layer con với ID cố định theo shot.id và layer.id
  const childNodes: WorkflowNode[] = []
  const childEdges: WorkflowEdge[] = []

  rootLayers.forEach((layer, idx) => {
    const meta = formatLayerNodeLabel(layer, project)
    const childNodeId = `wf-layer-${shot.id}-${layer.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

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
      position: { x: COL_2_X, y: 80 + idx * ROW_GAP },
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
    childNodes.push(childNode)

    // Tạo dây nối từ Node Cảnh tới Node Layer con qua cổng scene_ctx
    childEdges.push({
      id: `edge-${sceneNodeId}-scene_ctx-${childNodeId}-scene_ctx`,
      fromNode: sceneNodeId,
      fromPort: 'scene_ctx',
      toNode: childNodeId,
      toPort: 'scene_ctx'
    })
  })

  // 3. XỬ LÝ LỌC TRÙNG LẶP TRIỆT ĐỂ (Anti-Duplication Guarantee):
  // Gỡ bỏ mọi Node Cảnh cũ cùng phân cảnh (hoặc generic placeholder) và mọi Node Layer cũ của phân cảnh này.
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

  const removedNodeIds = new Set(
    workflow.nodes.filter((n) => isOldSceneForThisShot(n) || isOldLayerForThisShot(n)).map((n) => n.id)
  )

  const retainedNodes = workflow.nodes.filter((n) => !removedNodeIds.has(n.id))
  const nextNodes = [sceneNode, ...childNodes, ...retainedNodes]

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
    const actorChild = childNodes.find((c) => c.title.includes('2.5D') || c.title.includes('Nhân vật')) ?? childNodes[0]
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

  const camNode = nextNodes.find((n) => n.type === 'camera_director')
  if (camNode && !nextEdges.some((e) => e.toNode === camNode.id && e.toPort === 'scene_ctx')) {
    nextEdges.push({
      id: `edge-${sceneNodeId}-scene_ctx-${camNode.id}-scene_ctx`,
      fromNode: sceneNodeId,
      fromPort: 'scene_ctx',
      toNode: camNode.id,
      toPort: 'scene_ctx'
    })
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
    childNodes
  }
}
