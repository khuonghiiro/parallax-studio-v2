import { current, isDraft } from 'immer'
import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  ensureProjectWorkflow,
  connectWorkflowPort,
  applyWorkflowToProject,
  resolveConnectedWorkflowNodes,
  resolveNodeTargetBinding
} from './workflowEngine'
import {
  spawnLogicNodeIntoWorkflow,
  WORKFLOW_LOGIC_NODE_CATALOG,
  type WorkflowLogicNodeCategory,
  type WorkflowLogicNodeCatalogItem
} from './workflowLogicNodes'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { getWorkflowNodePorts } from './workflowNodePorts'
import { validateWorkflowConnection } from './workflowConnectionRules'
import {
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  attachLogicNodeToLayerV2,
  layoutWorkflowV2Tree,
  recomputeSharedLogicTargets,
  syncWorkflowV2NodeToProject
} from './workflowV2Engine'

export interface TimelineLogicCategoryMeta {
  id: WorkflowLogicNodeCategory
  label: string
  shortLabel: string
  icon: string
  accent: string
  defaultLogicId: string
}

/**
 * Bảng cấu hình danh mục Logic chuẩn trên Timeline.
 * Khi mở rộng thêm danh mục hoặc hành vi mới trong tương lai, chỉ cần khai báo tại đây
 * để tự động đồng bộ màu sắc, biểu tượng, bộ lọc và nút gắn nhanh trên toàn bộ Timeline.
 */
export const TIMELINE_LOGIC_CATEGORY_META: Record<
  WorkflowLogicNodeCategory,
  TimelineLogicCategoryMeta
> = {
  motion: {
    id: 'motion',
    label: 'Chuyển động 2.5D',
    shortLabel: 'Chuyển động',
    icon: '🍃',
    accent: '#10b981',
    defaultLogicId: 'logic-motion-breathe'
  },
  light_fx: {
    id: 'light_fx',
    label: 'Ánh sáng & Hào quang',
    shortLabel: 'Ánh sáng',
    icon: '💡',
    accent: '#f59e0b',
    defaultLogicId: 'logic-fx-candle'
  },
  physics: {
    id: 'physics',
    label: 'Vật lý 2.5D',
    shortLabel: 'Vật lý',
    icon: '🪂',
    accent: '#06b6d4',
    defaultLogicId: 'logic-physics-wind'
  },
  camera: {
    id: 'camera',
    label: 'Lộ trình Camera',
    shortLabel: 'Camera',
    icon: '🎥',
    accent: '#3b82f6',
    defaultLogicId: 'logic-cam-fly'
  },
  audio: {
    id: 'audio',
    label: 'Âm thanh & Thoại',
    shortLabel: 'Âm thanh',
    icon: '🎙️',
    accent: '#a855f7',
    defaultLogicId: 'logic-audio-lipsync'
  },
  scene: {
    id: 'scene',
    label: 'Cảnh & Không gian Z',
    shortLabel: 'Không gian Z',
    icon: '🎬',
    accent: '#ec4899',
    defaultLogicId: 'logic-scene-parallax'
  },
  assembly: {
    id: 'assembly',
    label: 'Layer & Thực thể',
    shortLabel: 'Thực thể',
    icon: '🧩',
    accent: '#14b8a6',
    defaultLogicId: 'logic-assembly-billboard'
  },
  look: {
    id: 'look',
    label: 'Màu sắc & Xuất',
    shortLabel: 'Màu & Xuất',
    icon: '🌅',
    accent: '#f97316',
    defaultLogicId: 'logic-look-warm'
  }
}

export const TIMELINE_LOGIC_CATEGORY_LIST: TimelineLogicCategoryMeta[] = [
  TIMELINE_LOGIC_CATEGORY_META.motion,
  TIMELINE_LOGIC_CATEGORY_META.light_fx,
  TIMELINE_LOGIC_CATEGORY_META.physics,
  TIMELINE_LOGIC_CATEGORY_META.camera,
  TIMELINE_LOGIC_CATEGORY_META.audio,
  TIMELINE_LOGIC_CATEGORY_META.scene,
  TIMELINE_LOGIC_CATEGORY_META.assembly,
  TIMELINE_LOGIC_CATEGORY_META.look
]

export interface TimelineLogicNodeEntry {
  node: WorkflowNode
  catalogItem?: WorkflowLogicNodeCatalogItem
  category: WorkflowLogicNodeCategory
  categoryMeta: TimelineLogicCategoryMeta
  connected: boolean
  enabled: boolean
  icon: string
  shortTitle: string
}

export interface LayerTimelineLogicBadge {
  id: string
  kind: 'workflow_node' | 'capability'
  category: WorkflowLogicNodeCategory
  icon: string
  label: string
  tooltip: string
  accent: string
  enabled: boolean
  nodeId?: string
  inspectorSection?: 'virtualLight' | 'physics' | 'motion' | 'glow' | 'layer'
}

export interface LayerCapabilityPlugin {
  id: string
  category: WorkflowLogicNodeCategory
  inspect: (layer: Layer) => Omit<LayerTimelineLogicBadge, 'id' | 'kind' | 'category'> | null
}

/**
 * Hệ thống Plugin kiểm tra năng lực 2.5D của Layer.
 * Khi thêm tính năng/logic mới vào Layer trong tương lai, chỉ cần đăng ký 1 plugin tại đây
 * để thanh Layer Bar trên Timeline tự động hiển thị huy hiệu tương tác.
 */
export const LAYER_CAPABILITY_PLUGINS: LayerCapabilityPlugin[] = [
  {
    id: 'cap-virtual-light',
    category: 'light_fx',
    inspect: (layer) => {
      const vl = layer.virtualLight
      if (!vl || !vl.enabled) return null
      const isBeam = vl.kind === 'flashlight'
      return {
        icon: isBeam ? '🔦' : '🕯️',
        label: isBeam ? 'Chùm sáng 2.5D' : 'Đèn 2.5D',
        tooltip: `Ánh sáng ảo 2.5D (${vl.kind}) · Độ sáng ${(vl.intensity ?? 1).toFixed(1)} — Click để chỉnh`,
        accent: vl.color || '#f59e0b',
        enabled: true,
        inspectorSection: 'virtualLight'
      }
    }
  },
  {
    id: 'cap-cave-portal',
    category: 'scene',
    inspect: (layer) => {
      const portal = layer.physics?.depthPortal
      if (!portal || !portal.enabled) return null
      return {
        icon: '🕳️',
        label: 'Hang 2.5D',
        tooltip: `Lối vào hang động & Độ sâu 2.5D (Độ tối ${Math.round((portal.darkness ?? 0.7) * 100)}%) — Click để chỉnh`,
        accent: '#ec4899',
        enabled: true,
        inspectorSection: 'physics'
      }
    }
  },
  {
    id: 'cap-physics',
    category: 'physics',
    inspect: (layer) => {
      const phys = layer.physics
      if (!phys || !phys.enabled) return null
      return {
        icon: '🪂',
        label: 'Vật lý 2.5D',
        tooltip: `Vật lý chất liệu 2.5D (${phys.material || 'chuẩn'}) — Click để chỉnh`,
        accent: '#06b6d4',
        enabled: true,
        inspectorSection: 'physics'
      }
    }
  },
  {
    id: 'cap-procedural-motion',
    category: 'motion',
    inspect: (layer) => {
      const m = layer.motion
      if (!m || !m.type || m.type === 'none' || m.enabled === false) return null
      const names: Record<string, string> = {
        drift: 'Trôi Drift',
        sway: 'Đung đưa',
        wind: 'Gió lay',
        float: 'Nhịp thở',
        pulse: 'Nhịp đập',
        wiggle: 'Rung nhẹ'
      }
      return {
        icon: '〰️',
        label: names[m.type] ?? `Motion (${m.type})`,
        tooltip: `Chuyển động tự động: ${names[m.type] ?? m.type} — Click để chỉnh`,
        accent: '#10b981',
        enabled: true,
        inspectorSection: 'motion'
      }
    }
  },
  {
    id: 'cap-glow',
    category: 'light_fx',
    inspect: (layer) => {
      if (!layer.glow || !layer.glow.enabled) return null
      return {
        icon: '✨',
        label: 'Viền Neon',
        tooltip: `Phát sáng viền Alpha (${layer.glow.animated || 'tĩnh'}) — Click để chỉnh`,
        accent: layer.glow.color || '#38bdf8',
        enabled: true,
        inspectorSection: 'glow'
      }
    }
  },
  {
    id: 'cap-particles',
    category: 'light_fx',
    inspect: (layer) => {
      if (layer.type !== 'particles') return null
      return {
        icon: '🪄',
        label: 'Hạt 3D',
        tooltip: `Hệ thống hạt không gian 3D (${layer.props?.count ?? 0} hạt) — Click để chỉnh`,
        accent: '#f59e0b',
        enabled: true,
        inspectorSection: 'layer'
      }
    }
  },
  {
    id: 'cap-billboard',
    category: 'assembly',
    inspect: (layer) => {
      if (layer.autoOrient !== 'camera-y') return null
      return {
        icon: '🧭',
        label: 'Neo Chân Y',
        tooltip: 'Tự xoay thẳng đứng hướng về Camera (Billboard Y) — Click để chỉnh',
        accent: '#14b8a6',
        enabled: true,
        inspectorSection: 'layer'
      }
    }
  }
]

function inferNodeCategory(
  node: WorkflowNode,
  catalogItem?: WorkflowLogicNodeCatalogItem
): WorkflowLogicNodeCategory {
  if (catalogItem) return catalogItem.category
  const v2Cat = node.params?.logicCategory
  if (v2Cat === 'action') return 'motion'
  if (v2Cat === 'material' || v2Cat === 'collision') return 'physics'
  if (v2Cat === 'light' || v2Cat === 'fx') return 'light_fx'
  if (v2Cat === 'cave') return 'scene'
  if (v2Cat === 'audio') return 'audio'
  if (v2Cat === 'camera') return 'camera'
  switch (node.type) {
    case 'camera_director':
      return 'camera'
    case 'audio_lipsync':
      return 'audio'
    case 'motion_choreography':
      return 'motion'
    case 'physics_fx':
      return node.preset?.includes('candle') || node.preset?.includes('flashlight')
        ? 'light_fx'
        : 'physics'
    case 'scene_shot':
      return 'scene'
    case 'layer_assembly':
      return 'assembly'
    case 'look_output':
    default:
      return 'look'
  }
}

function getV2LogicDisplayMeta(node: WorkflowNode): { icon: string; shortTitle: string; accent: string } | null {
  const v2Cat = node.params?.logicCategory
  if (!v2Cat) return null
  if (v2Cat === 'material') {
    const matOpt = WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === node.params?.materialTag)
    const cleanMat = (matOpt?.shortLabel ?? node.title.replace(/^Vật liệu:\s*/i, '')).replace(
      /^[^\w\p{L}]+\s*/u,
      ''
    )
    return {
      icon: '🏷️',
      shortTitle: cleanMat,
      accent: '#a855f7'
    }
  }
  if (v2Cat === 'collision') {
    const colOpt = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === node.params?.collisionMode)
    const count = Math.max(1, node.params?.sharedLayerNodeIds?.length ?? 1)
    return {
      icon: '💥',
      shortTitle: `${(colOpt?.shortLabel ?? node.title).replace(/^Va chạm:\s*/i, '').replace(/^[^\w\p{L}]+\s*/u, '')} (${count}L)`,
      accent: '#f43f5e'
    }
  }
  if (v2Cat === 'action') {
    return {
      icon: '🏃',
      shortTitle: node.title.replace(/^Hành động:\s*/i, ''),
      accent: '#10b981'
    }
  }
  if (v2Cat === 'cave') {
    return {
      icon: '🕳️',
      shortTitle: node.title.replace(/^Hang động:\s*/i, ''),
      accent: '#ec4899'
    }
  }
  if (v2Cat === 'light') {
    return {
      icon: '💡',
      shortTitle: node.title.replace(/^Ánh sáng:\s*/i, ''),
      accent: '#f59e0b'
    }
  }
  if (v2Cat === 'fx') {
    return {
      icon: '✨',
      shortTitle: node.title.replace(/^Hiệu ứng:\s*/i, ''),
      accent: '#06b6d4'
    }
  }
  if (v2Cat === 'audio') {
    return {
      icon: '🔊',
      shortTitle: node.title.replace(/^Âm thanh:\s*/i, ''),
      accent: '#a855f7'
    }
  }
  return {
    icon: '🎥',
    shortTitle: node.title,
    accent: '#3b82f6'
  }
}

function stripLeadingIcon(title: string, fallbackIcon: string): { icon: string; cleanTitle: string } {
  const trimmed = title.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length > 1 && /^[^\w\p{L}]{1,4}$/u.test(parts[0])) {
    return { icon: parts[0], cleanTitle: parts.slice(1).join(' ') }
  }
  return { icon: fallbackIcon, cleanTitle: trimmed }
}

/**
 * Liệt kê các Node Logic trên Workflow đang áp dụng cho Layer hoặc Phân cảnh hiện tại
 * (hỗ trợ đồng bộ cả Workflow V1 và Cây phân cấp Workflow V2).
 */
export function listTimelineLogicNodes(
  project: Project,
  workflow: WorkflowGraph,
  layer?: Layer,
  shotId?: string
): TimelineLogicNodeEntry[] {
  const activeIds = new Set(resolveConnectedWorkflowNodes(workflow).activeNodes.map((n) => n.id))
  const resolvedShotId = layer?.shotId || shotId || 'all'
  const matched = workflow.nodes.filter((node) => {
    const isV2Logic = Boolean(node.params?.logicCategory)
    const isV1Logic = Boolean(node.params?.logicId)
    if (!isV2Logic && !isV1Logic) return false
    if (layer) {
      if (isV2Logic) {
        return Boolean(node.params?.targetLayerIds?.includes(layer.id))
      }
      return resolveNodeTargetBinding(node, project, workflow).matchesLayer(layer)
    }
    return (
      !node.params?.shotId ||
      resolvedShotId === 'all' ||
      node.params.shotId === 'all' ||
      node.params.shotId === resolvedShotId
    )
  })

  return matched.map((node) => {
    const catalogItem = node.params?.logicId
      ? WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === node.params?.logicId)
      : undefined
    const category = inferNodeCategory(node, catalogItem)
    const v2Meta = getV2LogicDisplayMeta(node)
    const categoryMeta = v2Meta
      ? { ...TIMELINE_LOGIC_CATEGORY_META[category], accent: v2Meta.accent }
      : TIMELINE_LOGIC_CATEGORY_META[category]
    const parsed = stripLeadingIcon(
      catalogItem?.shortLabel || v2Meta?.shortTitle || node.title,
      catalogItem?.icon || v2Meta?.icon || categoryMeta.icon
    )
    return {
      node,
      catalogItem,
      category,
      categoryMeta,
      connected: activeIds.has(node.id),
      enabled: node.enabled !== false,
      icon: catalogItem?.icon || v2Meta?.icon || parsed.icon,
      shortTitle: catalogItem?.shortLabel || v2Meta?.shortTitle || parsed.cleanTitle
    }
  })
}

/**
 * Trích xuất danh sách huy hiệu Logic & Năng lực 2.5D hiển thị trực tiếp trên thanh Layer Bar của Timeline.
 */
export function getLayerTimelineLogicBadges(
  layer: Layer,
  project: Project,
  workflow: WorkflowGraph
): LayerTimelineLogicBadge[] {
  const badges: LayerTimelineLogicBadge[] = []

  // 1. Huy hiệu từ các Node Logic trong Workflow (V1 & V2) áp dụng cho Layer này
  const matchedNodes = workflow.nodes.filter((node) => {
    if (node.params?.logicCategory) {
      return Boolean(node.params?.targetLayerIds?.includes(layer.id))
    }
    if (!node.params?.logicId) return false
    return resolveNodeTargetBinding(node, project, workflow).matchesLayer(layer)
  })

  for (const node of matchedNodes) {
    const catalogItem = node.params?.logicId
      ? WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === node.params?.logicId)
      : undefined
    const category = inferNodeCategory(node, catalogItem)
    const v2Meta = getV2LogicDisplayMeta(node)
    const meta = TIMELINE_LOGIC_CATEGORY_META[category]
    const parsed = stripLeadingIcon(
      catalogItem?.shortLabel || v2Meta?.shortTitle || node.title,
      v2Meta?.icon || meta.icon
    )
    badges.push({
      id: `wf-${node.id}`,
      kind: 'workflow_node',
      category,
      icon: catalogItem?.icon || v2Meta?.icon || parsed.icon,
      label: catalogItem?.shortLabel || v2Meta?.shortTitle || parsed.cleanTitle,
      tooltip: `Node Logic: ${node.title} ${node.enabled ? '' : '[Đã tắt]'} — Click để cấu hình`,
      accent: v2Meta?.accent || meta.accent,
      enabled: node.enabled !== false,
      nodeId: node.id
    })
  }

  // 2. Huy hiệu từ các Capability Plugins của Layer
  for (const plugin of LAYER_CAPABILITY_PLUGINS) {
    const inspected = plugin.inspect(layer)
    if (inspected) {
      badges.push({
        id: `${plugin.id}-${layer.id}`,
        kind: 'capability',
        category: plugin.category,
        ...inspected
      })
    }
  }

  return badges
}

/**
 * Bật / tắt nhanh một Node Logic ngay từ thanh Timeline và đồng bộ vào cảnh (hỗ trợ cả V1 và V2).
 */
export function toggleTimelineLogicNode(project: Project, nodeId: string): boolean {
  const baseWf = ensureProjectWorkflow(isDraft(project) ? current(project) : project)
  const target = baseWf.nodes.find((n) => n.id === nodeId)
  if (!target) return false
  const nextEnabled = !target.enabled
  const nextGraph: WorkflowGraph = {
    ...structuredClone(baseWf),
    nodes: baseWf.nodes.map((n) => (n.id === nodeId ? { ...n, enabled: nextEnabled } : { ...n }))
  }
  if (baseWf.presetId === 'v2_scene_hierarchy') {
    project.workflow = nextGraph
    const updatedNode = nextGraph.nodes.find((n) => n.id === nodeId)
    if (updatedNode) {
      syncWorkflowV2NodeToProject(project, updatedNode)
    }
    return nextEnabled
  }
  applyWorkflowToProject(project, nextGraph)
  return nextEnabled
}

/**
 * Xoá một Node Logic khỏi luồng xử lý ngay từ thanh Timeline (hỗ trợ cả V1 và V2).
 */
export function removeTimelineLogicNode(project: Project, nodeId: string): void {
  const baseWf = ensureProjectWorkflow(isDraft(project) ? current(project) : project)
  const target = baseWf.nodes.find((n) => n.id === nodeId)
  const remainEdges = baseWf.edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId)
  const remainNodes = baseWf.nodes.filter((n) => n.id !== nodeId)

  if (baseWf.presetId === 'v2_scene_hierarchy') {
    if (target) {
      syncWorkflowV2NodeToProject(project, { ...target, enabled: false })
    }
    const synced = recomputeSharedLogicTargets(remainNodes, remainEdges)
    const laidOut = layoutWorkflowV2Tree(synced, remainEdges)
    project.workflow = {
      ...structuredClone(baseWf),
      nodes: laidOut,
      edges: remainEdges
    }
    return
  }

  const nextGraph: WorkflowGraph = {
    ...structuredClone(baseWf),
    nodes: remainNodes,
    edges: remainEdges
  }
  applyWorkflowToProject(project, nextGraph)
}

function contextNode(
  id: string,
  type: WorkflowNode['type'],
  title: string,
  shotId: string,
  layerIds?: string[]
): WorkflowNode {
  const spec = WORKFLOW_NODE_SPECS[type]
  return {
    id,
    type,
    title,
    enabled: true,
    preset: spec.presets[0].id,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: '',
    position: { x: 80, y: type === 'scene_shot' ? 40 : 360 },
    params: { shotId, targetMode: layerIds ? 'custom' : 'auto', targetLayerIds: layerIds }
  }
}

function wireSource(
  graph: WorkflowGraph,
  source: WorkflowNode,
  node: WorkflowNode
): WorkflowGraph | null {
  const from = getWorkflowNodePorts(source)
  const to = getWorkflowNodePorts(node)
  for (const port of from.outputs) {
    if (to.inputs.includes(port) && validateWorkflowConnection(source, port, node, port).valid) {
      return connectWorkflowPort(graph, source.id, port, node.id, port)
    }
  }
  return null
}

/** Shared entry point for timeline and MCP. Only the new processor is executed. */
export function addTimelineLogic(
  project: Project,
  logicId: string,
  layerId?: string,
  targetShotId?: string
): string {
  const layer = layerId ? project.layers.find((item) => item.id === layerId) : undefined
  if (layerId && !layer) throw new Error('Layer không còn tồn tại.')
  if (layer?.locked) throw new Error('Mở khóa layer trước khi thêm logic.')
  const shotId = layer?.shotId || targetShotId || 'all'
  if (shotId !== 'all' && !project.shots.some((item) => item.id === shotId)) {
    throw new Error('Cảnh không còn tồn tại.')
  }
  let graph = structuredClone(ensureProjectWorkflow(isDraft(project) ? current(project) : project))
  if (graph.presetId === 'v2_scene_hierarchy') {
    const targetLayerNode =
      (layer
        ? graph.nodes.find(
            (n) =>
              n.type === 'layer_assembly' &&
              !n.params?.groupKind &&
              n.params?.targetLayerIds?.includes(layer.id)
          )
        : undefined) ??
      graph.nodes.find((n) => n.type === 'layer_assembly' && !n.params?.groupKind)
    if (targetLayerNode) {
      const catItem = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === logicId)
      const lowerId = logicId.toLowerCase()
      const v2Cat: 'action' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio' =
        lowerId.includes('collision') || lowerId.includes('punch') || lowerId.includes('bounce')
          ? 'collision'
          : lowerId.includes('material') || catItem?.category === 'physics'
            ? 'material'
            : lowerId.includes('cave') || catItem?.category === 'scene'
              ? 'cave'
              : catItem?.category === 'light_fx'
                ? 'light'
                : catItem?.category === 'audio'
                  ? 'audio'
                  : catItem?.category === 'motion'
                    ? 'action'
                    : 'fx'
      const res = attachLogicNodeToLayerV2(graph, targetLayerNode.id, v2Cat)
      project.workflow = res.workflow
      const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (created) {
        syncWorkflowV2NodeToProject(project, created)
      }
      return res.createdNodeId
    }
  }
  const column = Math.max(0, ...graph.nodes.map((item) => item.position.x)) + 360
  const result = spawnLogicNodeIntoWorkflow(graph, logicId, shotId, { autoConnect: false })
  graph = result.workflow
  const node = result.spawnedNode
  node.position = { x: column + 360, y: 360 }
  if (layer) node.params = { ...node.params, targetMode: 'custom', targetLayerIds: [layer.id] }
  if (node.type === 'scene_shot') {
    const ids = layer
      ? [layer.id]
      : project.layers
          .filter((item) => shotId === 'all' || item.shotId === shotId)
          .map((item) => item.id)
    const output = contextNode(`tl-output-${node.id}`, 'layer_assembly', 'Layer của cảnh', shotId, ids)
    output.position = { x: node.position.x, y: node.position.y + 340 }
    graph.nodes.push(output)
    graph = connectWorkflowPort(graph, node.id, 'layers_tree', output.id, 'layers_tree')
  } else {
    let source = graph.nodes.find(
      (item) => item.type === 'scene_shot' && item.enabled && item.params?.shotId === shotId
    )
    if (!source) {
      source = contextNode(
        `tl-scene-${shotId}`,
        'scene_shot',
        project.shots.find((item) => item.id === shotId)?.name ?? 'Toàn dự án',
        shotId
      )
      if (graph.nodes.some((item) => item.id === source!.id)) source.id += `-${node.id}`
      source.position = { x: column, y: 40 }
      graph.nodes.push(source)
    }
    let connected: WorkflowGraph | null = null
    if (layer && getWorkflowNodePorts(node).inputs.includes('actors_rig')) {
      let entity = graph.nodes.find(
        (item) =>
          item.type === 'layer_assembly' &&
          !item.params?.logicId &&
          item.enabled &&
          item.params?.targetLayerIds?.length === 1 &&
          item.params.targetLayerIds[0] === layer.id
      )
      if (!entity) {
        entity = contextNode(`tl-layer-${layer.id}-${node.id}`, 'layer_assembly', layer.name, shotId, [
          layer.id
        ])
        entity.position = { x: column, y: 360 }
        graph.nodes.push(entity)
      }
      const peerCount = graph.edges.filter(
        (e) => e.fromNode === entity!.id && e.fromPort !== 'transform_link' && e.fromPort !== 'layers_tree'
      ).length
      node.position = {
        x: entity.position.x + 290,
        y: Math.max(40, entity.position.y - 30 + peerCount * 195)
      }
      graph = connectWorkflowPort(graph, source.id, 'layers_tree', entity.id, 'layers_tree')
      connected = wireSource(graph, entity, node)
    }
    if (!connected) {
      const peerCount = graph.edges.filter(
        (e) => e.fromNode === source!.id && e.fromPort !== 'layers_tree'
      ).length
      node.position = {
        x: source.position.x + 310,
        y: Math.max(40, source.position.y + peerCount * 195)
      }
    }
    graph = connected ?? wireSource(graph, source, node) ?? graph
    if (!graph.edges.some((edge) => edge.toNode === node.id)) {
      throw new Error('Logic này chưa có cổng nguồn tương thích.')
    }
  }
  applyWorkflowToProject(project, graph, { onlyNodeIds: new Set([node.id]) })
  return node.id
}
