import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { validateWorkflowConnection } from './workflowConnectionRules'
import { connectWorkflowPort } from './workflowEngine'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  type WorkflowLogicNodeCatalogItem,
  type WorkflowLogicNodeCategory
} from './workflowLogicCatalog'
import { getWorkflowNodePorts } from './workflowNodePorts'

export interface ConnectedAtomicNodeInfo {
  node: WorkflowNode
  logicItem: WorkflowLogicNodeCatalogItem | null
  edgeId: string
  icon: string
  shortLabel: string
  categoryLabel: string
  color: string
  intensityPct: number
  enabled: boolean
}

export interface ConnectedMainNodeInfo {
  node: WorkflowNode
  label: string
  icon: string
  kindLabel: string
  edgeId: string
}

export function getAtomicCategoryColor(cat?: WorkflowLogicNodeCategory): string {
  switch (cat) {
    case 'camera':
      return '#22c55e'
    case 'audio':
      return '#06b6d4'
    case 'physics':
      return '#10b981'
    case 'light_fx':
      return '#ec4899'
    case 'motion':
      return '#f59e0b'
    case 'scene':
      return '#38bdf8'
    case 'assembly':
      return '#8b5cf6'
    case 'look':
      return '#eab308'
    default:
      return '#38bdf8'
  }
}

export function isAtomicFunctionNode(node: WorkflowNode): boolean {
  return Boolean(node.params?.logicId)
}

export function isMainWorkflowNode(node: WorkflowNode): boolean {
  if (node.params?.logicId || node.type === 'layer_transform') return false
  return (
    node.type === 'scene_shot' ||
    node.type === 'layer_assembly' ||
    node.type === 'camera_director' ||
    node.type === 'look_output'
  )
}

export function formatMainNodeDisplay(node: WorkflowNode, project?: Project): { label: string; icon: string; kindLabel: string } {
  if (node.type === 'scene_shot') {
    const shot = project?.shots.find((s) => s.id === node.params?.shotId) ?? project?.shots[0]
    return {
      label: shot ? `Cảnh: ${shot.name}` : node.title.replace(/^🎬\s*/, ''),
      icon: '🎬',
      kindLabel: 'Node Cảnh Chính'
    }
  }
  if (node.type === 'layer_assembly') {
    const layer = project?.layers.find((l) => l.id === node.params?.targetLayerIds?.[0])
    const cleanName = layer
      ? layer.composite?.compositeName ?? layer.model3d?.modelName ?? layer.name
      : node.title.replace(/^[^\wÀ-ỹ]+/, '')
    return {
      label: cleanName,
      icon: layer?.composite ? '🎭' : layer?.type === 'particles' ? '✨' : '🖼️',
      kindLabel: 'Node Layer Chính'
    }
  }
  if (node.type === 'camera_director') {
    return {
      label: node.title.replace(/^🎥\s*/, '') || 'Camera 3D',
      icon: '🎥',
      kindLabel: 'Node Camera Chính'
    }
  }
  return {
    label: node.title.replace(/^🌅\s*/, '') || 'Xuất Cảnh',
    icon: '🌅',
    kindLabel: 'Node Xuất Chính'
  }
}

/**
 * Quét toàn bộ các Node chức năng đơn lẻ (Atomic Function Nodes) đang kết nối
 * trực tiếp hoặc nối chuỗi vào một Node Chính (Main Hub Node).
 */
export function getConnectedAtomicNodesForMainNode(
  mainNode: WorkflowNode,
  workflow: WorkflowGraph
): ConnectedAtomicNodeInfo[] {
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]))
  const visited = new Set<string>([mainNode.id])
  const queue: { nodeId: string; firstEdgeId: string }[] = []
  const results: ConnectedAtomicNodeInfo[] = []

  for (const edge of workflow.edges) {
    if (edge.fromPort === 'layers_tree' || edge.toPort === 'layers_tree') continue
    if (edge.fromPort === 'transform_link' || edge.toPort === 'transform_link') continue
    if (edge.fromNode !== mainNode.id && edge.toNode !== mainNode.id) continue
    const otherId = edge.fromNode === mainNode.id ? edge.toNode : edge.fromNode
    const other = byId.get(otherId)
    if (!other || visited.has(other.id)) continue
    if (isAtomicFunctionNode(other)) {
      visited.add(other.id)
      queue.push({ nodeId: other.id, firstEdgeId: edge.id })
    }
  }

  while (queue.length > 0) {
    const { nodeId, firstEdgeId } = queue.shift()!
    const atomic = byId.get(nodeId)
    if (!atomic) continue
    const logicItem = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === atomic.params?.logicId) ?? null
    results.push({
      node: atomic,
      logicItem,
      edgeId: firstEdgeId,
      icon: logicItem?.icon ?? '⚡',
      shortLabel: logicItem?.shortLabel ?? atomic.title,
      categoryLabel: logicItem?.categoryLabel ?? 'Chức năng',
      color: getAtomicCategoryColor(logicItem?.category),
      intensityPct: Math.round((atomic.params?.intensity ?? 1.0) * 100),
      enabled: atomic.enabled
    })

    for (const edge of workflow.edges) {
      if (edge.fromPort === 'layers_tree' || edge.toPort === 'layers_tree') continue
      if (edge.fromPort === 'transform_link' || edge.toPort === 'transform_link') continue
      if (edge.fromNode !== atomic.id && edge.toNode !== atomic.id) continue
      const nextId = edge.fromNode === atomic.id ? edge.toNode : edge.fromNode
      const nextNode = byId.get(nextId)
      if (!nextNode || visited.has(nextNode.id)) continue
      if (isAtomicFunctionNode(nextNode)) {
        visited.add(nextNode.id)
        queue.push({ nodeId: nextNode.id, firstEdgeId: edge.id })
      }
    }
  }

  return results
}

/**
 * Tìm danh sách các Node Chính (Cảnh, Layer, Camera, Xuất) mà một Node Chức Năng Đơn Lẻ đang làm giàu.
 */
export function getConnectedMainNodesForAtomicNode(
  atomicNode: WorkflowNode,
  workflow: WorkflowGraph,
  project?: Project
): ConnectedMainNodeInfo[] {
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]))
  const visited = new Set<string>([atomicNode.id])
  const queue: { nodeId: string; firstEdgeId: string }[] = []
  const results: ConnectedMainNodeInfo[] = []

  for (const edge of workflow.edges) {
    if (edge.fromNode !== atomicNode.id && edge.toNode !== atomicNode.id) continue
    const otherId = edge.fromNode === atomicNode.id ? edge.toNode : edge.fromNode
    if (!visited.has(otherId)) {
      visited.add(otherId)
      queue.push({ nodeId: otherId, firstEdgeId: edge.id })
    }
  }

  while (queue.length > 0) {
    const { nodeId, firstEdgeId } = queue.shift()!
    const cur = byId.get(nodeId)
    if (!cur) continue
    if (isMainWorkflowNode(cur)) {
      const meta = formatMainNodeDisplay(cur, project)
      results.push({
        node: cur,
        label: meta.label,
        icon: meta.icon,
        kindLabel: meta.kindLabel,
        edgeId: firstEdgeId
      })
      continue
    }
    if (isAtomicFunctionNode(cur)) {
      for (const edge of workflow.edges) {
        if (edge.fromNode !== cur.id && edge.toNode !== cur.id) continue
        const nextId = edge.fromNode === cur.id ? edge.toNode : edge.fromNode
        if (!visited.has(nextId)) {
          visited.add(nextId)
          queue.push({ nodeId: nextId, firstEdgeId })
        }
      }
    }
  }

  return results
}

/**
 * Tìm cặp Port hợp lệ tốt nhất để kết nối giữa một Node Chức Năng Đơn Lẻ và một Node Chính.
 */
export function findBestAtomicToMainConnection(
  atomicNode: WorkflowNode,
  mainNode: WorkflowNode
): { fromNode: string; fromPort: WorkflowPortKind; toNode: string; toPort: WorkflowPortKind } | null {
  const atomicPorts = getWorkflowNodePorts(atomicNode)
  const mainPorts = getWorkflowNodePorts(mainNode)

  // Ưu tiên 1: Main Node (actors_rig / scene_ctx / camera_cut) -> Atomic Node
  for (const outP of mainPorts.outputs) {
    if (outP === 'layers_tree' || outP === 'transform_link') continue
    for (const inP of atomicPorts.inputs) {
      if (inP === 'layers_tree' || inP === 'transform_link') continue
      if (validateWorkflowConnection(mainNode, outP, atomicNode, inP).valid) {
        return { fromNode: mainNode.id, fromPort: outP, toNode: atomicNode.id, toPort: inP }
      }
    }
  }

  // Ưu tiên 2: Atomic Node (motion_stream / vfx_stage / audio_mix / camera_cut / scene_ctx) -> Main Node
  for (const outP of atomicPorts.outputs) {
    if (outP === 'layers_tree' || outP === 'transform_link') continue
    for (const inP of mainPorts.inputs) {
      if (inP === 'layers_tree' || inP === 'transform_link') continue
      if (validateWorkflowConnection(atomicNode, outP, mainNode, inP).valid) {
        return { fromNode: atomicNode.id, fromPort: outP, toNode: mainNode.id, toPort: inP }
      }
    }
  }

  return null
}

/**
 * Lọc danh sách các Node Chính trên bản vẽ tương thích với một Node Chức Năng Đơn Lẻ.
 */
export function getCompatibleMainNodesForAtomicNode(
  atomicNode: WorkflowNode,
  workflow: WorkflowGraph,
  project?: Project
): ConnectedMainNodeInfo[] {
  const results: ConnectedMainNodeInfo[] = []
  for (const n of workflow.nodes) {
    if (!isMainWorkflowNode(n) || n.id === atomicNode.id) continue
    const pair = findBestAtomicToMainConnection(atomicNode, n)
    if (!pair) continue
    const meta = formatMainNodeDisplay(n, project)
    results.push({
      node: n,
      label: meta.label,
      icon: meta.icon,
      kindLabel: meta.kindLabel,
      edgeId: ''
    })
  }
  return results
}

/**
 * Kết nối trực tiếp một Node Chức Năng Đơn Lẻ vào một Node Chính trên bản vẽ.
 */
export function connectAtomicNodeToMainNode(
  workflow: WorkflowGraph,
  atomicNodeId: string,
  mainNodeId: string
): WorkflowGraph {
  const atomicNode = workflow.nodes.find((n) => n.id === atomicNodeId)
  const mainNode = workflow.nodes.find((n) => n.id === mainNodeId)
  if (!atomicNode || !mainNode) return workflow
  const pair = findBestAtomicToMainConnection(atomicNode, mainNode)
  if (!pair) return workflow
  return connectWorkflowPort(workflow, pair.fromNode, pair.fromPort, pair.toNode, pair.toPort)
}

/**
 * Đổi chức năng của một Node Đơn Lẻ ngay tại chỗ (giữ nguyên vị trí, cường độ và kết nối tương thích).
 */
export function switchAtomicNodeFunction(
  workflow: WorkflowGraph,
  nodeId: string,
  newLogicId: string
): WorkflowGraph {
  const targetNode = workflow.nodes.find((n) => n.id === nodeId)
  const item = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === newLogicId)
  if (!targetNode || !item) return workflow

  const spec = WORKFLOW_NODE_SPECS[item.nodeType]
  const updatedNode: WorkflowNode = {
    ...targetNode,
    type: item.nodeType,
    title: `${item.icon} ${item.title}`,
    preset: item.preset,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: item.description,
    params: {
      ...targetNode.params,
      logicId: item.id,
      targetParts: [...item.targetParts],
      enableDof: item.enableDof ?? false,
      ensureGround: item.ensureGround ?? false,
      spawnParticles: item.spawnParticles ?? false,
      customRules: item.buildRules ? item.buildRules() : []
    }
  }

  const nextNodes = workflow.nodes.map((n) => (n.id === nodeId ? updatedNode : n))
  const byId = new Map(nextNodes.map((n) => [n.id, n]))

  // Tự động nâng cấp hoặc bảo toàn dây nối sang cổng mới tương thích
  const nextEdges: WorkflowEdge[] = []
  for (const edge of workflow.edges) {
    const from = byId.get(edge.fromNode)
    const to = byId.get(edge.toNode)
    if (!from || !to) continue
    if (validateWorkflowConnection(from, edge.fromPort, to, edge.toPort).valid) {
      nextEdges.push(edge)
    } else if (edge.fromNode === nodeId || edge.toNode === nodeId) {
      const other = edge.fromNode === nodeId ? to : from
      const pair = findBestAtomicToMainConnection(updatedNode, other)
      if (pair) {
        nextEdges.push({
          id: `edge-${pair.fromNode}-${pair.fromPort}-${pair.toNode}-${pair.toPort}`,
          fromNode: pair.fromNode,
          fromPort: pair.fromPort,
          toNode: pair.toNode,
          toPort: pair.toPort
        })
      }
    }
  }

  return {
    ...workflow,
    nodes: nextNodes,
    edges: nextEdges
  }
}
