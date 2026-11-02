import { isDraft } from 'immer'
import type { Project, WorkflowGraph } from '@shared/types'
import { syncWorkflowV2Graph } from './workflowV2Sync'

/**
 * Workflow V2 — đầu mối export cho toàn bộ engine cây logic.
 * Đồ thị là MỘT không gian chung cho toàn dự án, suy ra từ dữ liệu thật (xem `workflowV2Sync`).
 */
export * from './workflowV2Options'
export {
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  getNodeLogicCategory,
  recomputeSharedLogicTargets,
  validateWorkflowV2Connection,
  wouldCreateWorkflowCycle
} from './workflowV2PhysicsAndValidation'
export * from './shotSpatial3D'
export * from './workflowPartMotionTrigger'
export {
  attachLogicNodeToLayerV2,
  spawnTimedFollowupNodeV2,
  spawnWorkflowV2CameraWaypoint,
  syncWorkflowV2NodeToProject
} from './workflowV2Mutations'
export {
  WF_V2_CAMERA_LANE_X,
  WF_V2_TIME_COL_X,
  WF_V2_CLUSTER_HEADER,
  WF_V2_COL_STEP,
  WF_V2_COL_X,
  WF_V2_NODE_GAP,
  WF_V2_NODE_H,
  WF_V2_NODE_W,
  computeV2Clusters,
  estimateV2NodeHeight,
  findFreeV2Spot,
  layoutWorkflowV2Tree,
  resolveHiddenV2NodeIds,
  resolveV2Overlaps,
  type V2Cluster
} from './workflowV2Layout'
export {
  V2_SHARED_CLUSTER,
  computeShotRoute,
  extractShotCameraWaypoints,
  getShotTimeRange,
  isCameraWaypointNode,
  isClusterLockNode,
  isParentCameraNode,
  isWorkflowV2Graph,
  layerClusterKey,
  resolveGroupTimeRange,
  resolveLayerNodeTimeRange,
  shotIdAtTime,
  v2CameraId,
  v2CameraWaypointId,
  v2ClusterLockId,
  v2GroupId,
  v2LayerNodeId,
  v2RootId,
  type ShotCameraWaypointStep
} from './workflowV2Scope'
export * from './workflowV2ClusterRigAndSwap'
export * from './workflowV2CompositeParts'
export * from './workflowV2BboxMotionAndCollision'
export {
  getCompatibleLogicCatalogForNode
} from './workflowV2LogicPresets'
export { isCameraChainEdge } from './workflowV2Skeleton'
export { syncWorkflowV2Graph, type SyncWorkflowV2Options } from './workflowV2Sync'
export {
  buildMainWorkflowJson,
  buildModularWorkflowBundle,
  buildShotWorkflowJson,
  shotJsonFileName,
  type WorkflowMainConnection,
  type WorkflowMainJson,
  type WorkflowMainShotRef,
  type WorkflowModularBundleJson,
  type WorkflowShotCameraWaypointSpec,
  type WorkflowShotJson,
  type WorkflowShotLayerSpec,
  type WorkflowShotLogicSpec
} from './workflowV2ModularJson'
export {
  applyMainWorkflowJson,
  applyModularWorkflowJson,
  applyShotWorkflowJson,
  type ModularApplyResult
} from './workflowV2ModularApply'

const resolvedWorkflowCache = new WeakMap<Project, WorkflowGraph>()
const liveDragWorkflowCache = new WeakMap<Project, WorkflowGraph>()

/** Đồ thị Workflow V2 khớp dữ liệu Project hiện tại (giữ tham chiếu khi không đổi & cache theo tham chiếu Project) */
export function resolveWorkflowV2(project: Project): WorkflowGraph {
  const dragCached = liveDragWorkflowCache.get(project)
  if (dragCached) return dragCached
  if (!isDraft(project) && Object.isFrozen(project)) {
    const cached = resolvedWorkflowCache.get(project)
    if (cached) return cached
  }
  const next = syncWorkflowV2Graph(project, project.workflow)
  if (!isDraft(project) && Object.isFrozen(project)) {
    resolvedWorkflowCache.set(project, next)
  }
  return next
}

/** Giữ nguyên bộ nhớ đệm đồ thị Workflow V2 khi kéo thả toạ độ trực tiếp trên Viewport (60fps) */
export function preserveWorkflowV2CacheForLiveDrag(prevProject: Project, nextProject: Project): void {
  if (isDraft(nextProject)) return
  const existing =
    liveDragWorkflowCache.get(prevProject) ??
    resolvedWorkflowCache.get(prevProject) ??
    prevProject.workflow
  if (existing) {
    liveDragWorkflowCache.set(nextProject, existing)
  }
}

/** Dựng mới cây Workflow V2 cho toàn dự án từ dữ liệu thật (tham số phạm vi cũ được giữ để tương thích, không còn dùng) */
export function buildWorkflowV2SceneTree(project: Project, _legacyScope?: string, _legacyOptions?: unknown): WorkflowGraph {
  return syncWorkflowV2Graph(project, undefined)
}

/** Khớp đồ thị hiện có với dữ liệu Project (giữ nguyên tham chiếu khi không đổi) */
export function reconcileWorkflowV2WithProject(project: Project, workflow?: WorkflowGraph, _legacyScope?: string): WorkflowGraph {
  if (workflow === project.workflow) {
    return resolveWorkflowV2(project)
  }
  return syncWorkflowV2Graph(project, workflow)
}
