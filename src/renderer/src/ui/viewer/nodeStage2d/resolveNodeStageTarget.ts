import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { bboxStepsForLayer, isBboxStep } from '../../../project/workflowBboxSteps'
import {
  getClusterMemberLayers,
  getCompatibleLogicCatalogForNode,
  v2CameraId,
  v2LayerNodeId,
  v2RootId
} from '../../../project/workflowV2Engine'
import { resolveActiveLayerForInspector } from '../../workflow/WorkflowV2LayerLogicSection'
import {
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  type WorkflowV2SpawnCategory
} from '../../workflow/workflowV2Theme'

export type NodeStagePrimaryMode = 'scene_bbox' | 'logic_25d' | 'part_25d'

/**
 * Tự động chọn Node phù hợp nhất để hiển thị trên Màn Khung 2D ở Khung nhìn chính
 * ngay cả khi người dùng chưa mở sơ đồ Workflow (chỉ đang chọn Layer hoặc Cảnh trên Timeline / Viewport).
 */
export function resolveEffectiveStageNode(
  project: Project,
  workflow: WorkflowGraph,
  selectedNode: WorkflowNode | null,
  selectedLayerId: string | null,
  selectedShotId: string | null,
  activeShotId: string | null,
  selectionScope: 'layer' | 'cluster' = 'layer'
): WorkflowNode | null {
  if (selectedNode && workflow.nodes.some((n) => n.id === selectedNode.id)) {
    return selectedNode
  }

  if (selectedLayerId) {
    const selLayer = project.layers.find((l) => l.id === selectedLayerId)
    const instId = selLayer?.composite?.instanceId ?? selLayer?.model3d?.instanceId
    const isLocked = Boolean(
      selLayer?.composite?.lockedGroup !== false || selLayer?.model3d?.lockedGroup !== false
    )
    if (instId && (selectionScope === 'cluster' || isLocked)) {
      const clusterLock = workflow.nodes.find(
        (n) => n.params?.logicCategory === 'cluster_lock' && n.params?.instanceId === instId
      )
      if (clusterLock) return clusterLock
    }
    const directLayerNode =
      workflow.nodes.find((n) => n.id === v2LayerNodeId(selectedLayerId)) ??
      workflow.nodes.find(
        (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(selectedLayerId)
      ) ??
      workflow.nodes.find((n) => n.params?.targetLayerIds?.includes(selectedLayerId))
    if (directLayerNode) return directLayerNode
  }

  const targetShotId = selectedShotId ?? activeShotId ?? project.shots[0]?.id ?? null
  if (targetShotId) {
    const firstClusterInShot = workflow.nodes.find(
      (n) => n.params?.logicCategory === 'cluster_lock' && n.params?.shotId === targetShotId
    )
    if (firstClusterInShot) return firstClusterInShot

    const firstLayerInShot = workflow.nodes.find(
      (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.shotId === targetShotId
    )
    if (firstLayerInShot) return firstLayerInShot

    const camWp = workflow.nodes.find(
      (n) => n.type === 'camera_director' && n.params?.shotId === targetShotId
    )
    if (camWp) return camWp

    const rootNode = workflow.nodes.find((n) => n.id === v2RootId(targetShotId) || n.id === v2CameraId(targetShotId))
    if (rootNode) return rootNode
  }

  return workflow.nodes[0] ?? null
}

/** Xác định chế độ khung 2D chuyên biệt mặc định của Node đang chọn */
export function resolveNodeStagePrimaryMode(node: WorkflowNode | null): NodeStagePrimaryMode {
  if (!node) return 'scene_bbox'
  const cat = resolveV2LogicCategory(node)
  if (cat === 'part_swap') return 'part_25d'
  if (cat && ['light', 'cave', 'material', 'fx'].includes(cat)) return 'logic_25d'
  return 'scene_bbox'
}

export interface StageLayerNodeContext {
  activeLayer: Layer | undefined
  attachTargetNodeId: string
  layerOrClusterNode: WorkflowNode | null
  logicNodes: WorkflowNode[]
  bboxSteps: ReturnType<typeof bboxStepsForLayer>
  partChildren: WorkflowNode[]
  compatibleCategories: {
    id: WorkflowV2SpawnCategory
    presetId?: string
    label: string
    icon: string
    accent: string
    hint: string
  }[]
  clusterMemberCount: number
}

/** Gom toàn bộ các Node cùng Layer / Cụm 2.5D và danh mục tạo nhanh Hành động trực tiếp trên Màn Khung 2D */
export function buildStageLayerNodeContext(
  project: Project,
  workflow: WorkflowGraph,
  node: WorkflowNode | null,
  selectedLayerId: string | null
): StageLayerNodeContext {
  const activeLayer = resolveActiveLayerForInspector(project, node, selectedLayerId)
  if (!activeLayer) {
    return {
      activeLayer: undefined,
      attachTargetNodeId: '',
      layerOrClusterNode: null,
      logicNodes: [],
      bboxSteps: [],
      partChildren: [],
      compatibleCategories: [],
      clusterMemberCount: 0
    }
  }

  const instId =
    node?.params?.instanceId ?? activeLayer.composite?.instanceId ?? activeLayer.model3d?.instanceId
  const clusterMembers = instId ? getClusterMemberLayers(project, instId, activeLayer) : []

  const layerNode =
    workflow.nodes.find(
      (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(activeLayer.id)
    ) ?? null

  const clusterLockNode = instId
    ? (workflow.nodes.find(
        (n) => n.params?.logicCategory === 'cluster_lock' && n.params?.instanceId === instId
      ) ?? null)
    : null

  const preferCluster = Boolean(
    node?.params?.logicCategory === 'cluster_lock' ||
      (clusterLockNode && clusterLockNode.enabled && clusterLockNode.params?.lockedGroup !== false)
  )
  const layerOrClusterNode = preferCluster ? (clusterLockNode ?? layerNode) : (layerNode ?? clusterLockNode)
  const attachTargetNodeId = layerOrClusterNode?.id ?? ''

  const bboxSteps = bboxStepsForLayer(workflow, activeLayer.id, instId)
  const logicNodes = workflow.nodes.filter(
    (n) =>
      resolveV2NodeLevel(n) === 'logic' &&
      n.params?.logicCategory !== 'cluster_lock' &&
      n.type !== 'camera_director' &&
      !n.params?.isPartChild &&
      !isBboxStep(n) &&
      (n.params?.targetLayerIds?.includes(activeLayer.id) || (instId && n.params?.instanceId === instId))
  )

  const partChildren = workflow.nodes.filter(
    (n) =>
      n.params?.logicCategory === 'part_swap' &&
      Boolean(n.params?.isPartChild) &&
      (instId ? n.params?.instanceId === instId : n.params?.targetLayerIds?.includes(activeLayer.id))
  )

  const compat = layerOrClusterNode
    ? getCompatibleLogicCatalogForNode(layerOrClusterNode, project)
    : { categories: [] }

  return {
    activeLayer,
    attachTargetNodeId,
    layerOrClusterNode,
    logicNodes,
    bboxSteps,
    partChildren,
    compatibleCategories: compat.categories,
    clusterMemberCount: clusterMembers.length
  }
}
