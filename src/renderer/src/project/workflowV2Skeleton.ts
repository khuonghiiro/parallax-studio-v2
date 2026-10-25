import type { Layer, Project, Shot, WorkflowEdge, WorkflowNode } from '@shared/types'
import {
  classifyLayerGroupKind,
  collectClusterInstances,
  collectRepresentativeLayers,
  getLayerDisplayName,
  getLayerX,
  getLayerY,
  getLayerZ,
  type LayerClusterInstanceInfo
} from './workflowV2Options'
import { WF_V2_COL_X } from './workflowV2Layout'
import {
  V2_SHARED_CLUSTER,
  computeShotRoute,
  extractShotCameraWaypoints,
  layerClusterKey,
  resolveGroupTimeRange,
  resolveLayerNodeTimeRange,
  v2CameraId,
  v2ClusterLockId,
  v2GroupId,
  v2LayerNodeId,
  v2RootId,
  type ShotCameraWaypointStep
} from './workflowV2Scope'

type GroupKind = 'group_3d' | 'group_25d' | 'group_env'
type RepItem = ReturnType<typeof collectRepresentativeLayers>[number]

const GROUP_TITLES: Record<GroupKind, string> = {
  group_3d: 'Nhóm 3D & Lắp ráp',
  group_25d: 'Nhóm Layer 2.5D',
  group_env: 'Nhóm Không gian & Bầu trời'
}

export interface V2Skeleton {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

interface ClusterCtx {
  key: string
  shot?: Shot
  shotIndex: number
  range: { start: number; end: number }
  compDur: number
}

export function v2Edge(fromNode: string, toNode: string, port: WorkflowEdge['fromPort']): WorkflowEdge {
  return { id: `e-${fromNode}-${toNode}`, fromNode, fromPort: port, toNode, toPort: port }
}

function rootNode(ctx: ClusterCtx, layerCount: number, project: Project): WorkflowNode {
  const title = ctx.shot ? `#${ctx.shotIndex + 1} ${ctx.shot.name}` : project.shots.length ? 'Layer dùng chung' : 'Toàn dự án'
  return {
    id: v2RootId(ctx.key),
    type: 'scene_shot',
    title,
    enabled: ctx.shot ? ctx.shot.visible !== false : true,
    position: { x: WF_V2_COL_X.ROOT, y: 0 },
    preset: 'deep_parallax_stage',
    aiAgentRole: 'SceneLayoutAgent',
    aiDirective: `Cảnh "${title}" [${ctx.range.start}s – ${ctx.range.end}s] điều phối Camera và các nhóm Layer.`,
    params: { shotId: ctx.shot?.id, timeStart: ctx.range.start, timeEnd: ctx.range.end, childLayerCount: layerCount }
  }
}

function cameraNode(ctx: ClusterCtx, project: Project, waypoints: ShotCameraWaypointStep[]): WorkflowNode {
  const shot = ctx.shot!
  const tStart = waypoints.length ? Math.min(ctx.range.start, waypoints[0].timeStart) : ctx.range.start
  const tEnd = waypoints.length ? Math.max(ctx.range.end, waypoints[waypoints.length - 1].timeEnd) : ctx.range.end
  return {
    id: v2CameraId(shot.id),
    type: 'camera_director',
    title: `Camera · ${shot.name}`,
    enabled: true,
    position: { x: WF_V2_COL_X.ROOT, y: 0 },
    preset: 'cinematic_fly_push',
    aiAgentRole: 'CameraDirectorAgent',
    aiDirective: `Camera quay cảnh "${shot.name}" gồm ${waypoints.length} mốc lộ trình trong [${tStart}s – ${tEnd}s].`,
    params: {
      shotId: shot.id,
      logicCategory: 'camera',
      camPreset: 'dollyIn',
      enableDof: Boolean(project.camera?.dofEnabled),
      childLayerCount: waypoints.length,
      timeStart: tStart,
      timeEnd: tEnd,
      hierarchyParentNodeId: v2RootId(ctx.key)
    }
  }
}

function cameraWaypointNode(step: ShotCameraWaypointStep, shot: Shot): WorkflowNode {
  const title = `#${step.displayLabel} · ${step.tagLabel}`
  return {
    id: step.nodeId,
    type: 'camera_director',
    title,
    enabled: true,
    position: { x: WF_V2_COL_X.ROOT, y: 0 },
    preset: 'cinematic_fly_push',
    aiAgentRole: 'CameraDirectorAgent',
    aiDirective: `Cảnh con #${step.displayLabel} (${step.tagLabel}, Zoom ${step.zoomPct}%) thuộc "${shot.name}" [${step.timeStart}s – ${step.timeEnd}s].`,
    params: {
      shotId: shot.id,
      logicCategory: 'camera',
      isCameraWaypoint: true,
      waypointIndex: step.globalIndex,
      waypointLocalIndex: step.localIndex,
      waypointLabel: step.displayLabel,
      isSubWaypoint: step.isSubWaypoint,
      isFirstOfShot: step.isFirstOfShot,
      camActionMode: step.actionMode,
      camTagLabel: step.tagLabel,
      camZoomPct: step.zoomPct,
      camStageX: step.stageX,
      camStageY: step.stageY,
      camScale: step.scale,
      camYaw: step.yaw,
      camPitch: step.pitch,
      camRoll: step.roll,
      camEase: step.ease,
      camStepDuration: step.stepDuration,
      timeStart: step.timeStart,
      timeEnd: step.timeEnd,
      hierarchyParentNodeId: v2CameraId(shot.id)
    }
  }
}

function groupNode(ctx: ClusterCtx, kind: GroupKind, items: RepItem[]): WorkflowNode {
  const range = resolveGroupTimeRange(items.map((it) => it.layer), ctx.compDur, ctx.range)
  return {
    id: v2GroupId(kind, ctx.key),
    type: 'layer_assembly',
    title: GROUP_TITLES[kind],
    enabled: items.some((it) => it.layer.visible !== false),
    position: { x: WF_V2_COL_X.GROUP, y: 0 },
    preset: 'character_prop_cluster',
    aiAgentRole: 'AssemblyRigAgent',
    aiDirective: `${GROUP_TITLES[kind]} gồm ${items.length} đối tượng.`,
    params: {
      shotId: ctx.shot?.id,
      groupKind: kind,
      isAssemblyRoot: true,
      childLayerCount: items.length,
      targetMode: 'custom',
      targetLayerIds: items.flatMap((it) => it.memberIds),
      timeStart: range.start,
      timeEnd: range.end,
      hierarchyParentNodeId: v2RootId(ctx.key)
    }
  }
}

export function layerNode(item: RepItem, groupId: string, compDur: number, shotId?: string): WorkflowNode {
  const l: Layer = item.layer
  const { start, end } = resolveLayerNodeTimeRange(l, compDur)
  const title = getLayerDisplayName(l)
  const instId = l.composite?.instanceId || l.model3d?.instanceId
  return {
    id: v2LayerNodeId(l.id),
    type: 'layer_assembly',
    title,
    enabled: l.visible !== false,
    position: { x: WF_V2_COL_X.LAYER, y: 0 },
    preset: 'character_prop_cluster',
    aiAgentRole: 'AssemblyRigAgent',
    aiDirective: `Layer "${title}" hoạt động từ ${start}s đến ${end}s.`,
    params: {
      shotId,
      targetMode: 'custom',
      targetLayerIds: item.memberIds,
      requireLayerConnection: true,
      assemblyKind: l.model3d ? 'model3d' : l.composite ? 'composite' : undefined,
      instanceId: instId,
      compositeId: l.composite?.compositeId,
      modelId: l.model3d?.modelId,
      lockedGroup: l.composite ? l.composite.lockedGroup !== false : l.model3d ? l.model3d.lockedGroup !== false : undefined,
      rootLayerId: l.composite?.isRoot ? l.id : undefined,
      childLayerCount: item.memberIds.length,
      transformX: getLayerX(l),
      transformY: getLayerY(l),
      transformZ: getLayerZ(l),
      timeStart: start,
      timeEnd: end,
      hierarchyParentNodeId: groupId
    }
  }
}

function clusterLockNode(inst: LayerClusterInstanceInfo, ctx: ClusterCtx): WorkflowNode {
  const range = resolveGroupTimeRange(inst.memberLayers, ctx.compDur, ctx.range)
  const root = inst.rootLayer
  const scalePct = Math.round(Math.abs(root.transform?.scale?.value?.[0] ?? 1) * 100)
  const prefix = inst.kind === 'model3d' ? 'Khoá khối 3D' : 'Khoá cụm'
  return {
    id: v2ClusterLockId(inst.instanceId),
    type: 'layer_transform',
    title: `${prefix}: ${inst.name}`,
    enabled: inst.lockedGroup,
    position: { x: WF_V2_COL_X.LOGIC, y: 0 },
    preset: 'character_prop_cluster',
    aiAgentRole: 'LayerTransformAgent',
    aiDirective: `Node Khoá Cụm "${inst.name}" (${inst.memberIds.length} lớp, ${inst.lockedGroup ? 'Đang khoá cả cụm' : 'Đang mở khoá chỉnh lẻ'}).`,
    params: {
      shotId: ctx.shot?.id,
      logicCategory: 'cluster_lock',
      assemblyKind: inst.kind,
      instanceId: inst.instanceId,
      compositeId: root.composite?.compositeId,
      modelId: root.model3d?.modelId,
      lockedGroup: inst.lockedGroup,
      rootLayerId: root.id,
      childLayerCount: inst.memberIds.length,
      targetMode: 'custom',
      targetLayerIds: [...inst.memberIds],
      sharedLayerNodeIds: inst.memberIds.map((id) => v2LayerNodeId(id)),
      requireLayerConnection: true,
      transformX: getLayerX(root),
      transformY: getLayerY(root),
      transformZ: getLayerZ(root),
      clusterScalePct: scalePct,
      timeStart: range.start,
      timeEnd: range.end,
      hierarchyParentNodeId: v2LayerNodeId(root.id)
    }
  }
}

function groupItems(items: RepItem[]): [GroupKind, RepItem[]][] {
  const by = (kind: GroupKind): RepItem[] => items.filter((it) => classifyLayerGroupKind(it.layer) === kind)
  const list: [GroupKind, RepItem[]][] = [
    ['group_3d', by('group_3d')],
    ['group_25d', by('group_25d').sort((a, b) => getLayerZ(a.layer) - getLayerZ(b.layer))],
    ['group_env', by('group_env').sort((a, b) => getLayerZ(b.layer) - getLayerZ(a.layer))]
  ]
  return list.filter(([, its]) => its.length > 0)
}

function buildCluster(
  project: Project,
  ctx: ClusterCtx,
  items: RepItem[],
  waypointsByShot: Map<string, ShotCameraWaypointStep[]>,
  out: V2Skeleton
): void {
  const rootId = v2RootId(ctx.key)
  out.nodes.push(rootNode(ctx, items.length, project))
  if (ctx.shot) {
    const camId = v2CameraId(ctx.shot.id)
    const steps = waypointsByShot.get(ctx.shot.id) ?? []
    out.nodes.push(cameraNode(ctx, project, steps))
    out.edges.push(v2Edge(rootId, camId, 'scene_ctx'))
    let prevCamNodeId = camId
    for (const step of steps) {
      out.nodes.push(cameraWaypointNode(step, ctx.shot))
      out.edges.push(v2Edge(prevCamNodeId, step.nodeId, 'camera_cut'))
      prevCamNodeId = step.nodeId
    }
  }
  for (const [kind, its] of groupItems(items)) {
    const group = groupNode(ctx, kind, its)
    out.nodes.push(group)
    out.edges.push(v2Edge(rootId, group.id, 'scene_ctx'))
    for (const it of its) {
      out.nodes.push(layerNode(it, group.id, ctx.compDur, ctx.shot?.id))
      out.edges.push(v2Edge(group.id, v2LayerNodeId(it.layer.id), 'layers_tree'))
    }
    if (kind === 'group_3d') {
      const clusterInstances = collectClusterInstances(its.map((it) => it.layer))
      for (const inst of clusterInstances) {
        const lockNode = clusterLockNode(inst, ctx)
        out.nodes.push(lockNode)
        for (const memberId of inst.memberIds) {
          out.edges.push(v2Edge(v2LayerNodeId(memberId), lockNode.id, 'layers_tree'))
        }
      }
    }
  }
}

/**
 * Bộ khung cây suy ra 100% từ dữ liệu thật của Project: mỗi Cảnh (theo thứ tự camera đi qua) là một cụm
 * Root → Camera → Các cảnh con lộ trình quay / Nhóm → Layer; các Camera nối tiếp nhau bằng dây chuyển cảnh.
 */
export function buildV2Skeleton(project: Project): V2Skeleton {
  const compDur = Math.max(1, project.comp.duration || 5)
  const route = computeShotRoute(project)
  const waypointsByShot = extractShotCameraWaypoints(project)
  const reps = collectRepresentativeLayers(project.layers)
  const out: V2Skeleton = { nodes: [], edges: [] }
  const sharedItems = reps.filter((it) => layerClusterKey(project, it.layer) === V2_SHARED_CLUSTER)
  if (sharedItems.length > 0 || project.shots.length === 0) {
    buildCluster(project, { key: V2_SHARED_CLUSTER, shotIndex: -1, range: { start: 0, end: compDur }, compDur }, sharedItems, waypointsByShot, out)
  }
  route.order.forEach((shot) => {
    const ctx: ClusterCtx = {
      key: shot.id,
      shot,
      shotIndex: project.shots.findIndex((s) => s.id === shot.id),
      range: route.ranges.get(shot.id) ?? { start: 0, end: compDur },
      compDur
    }
    buildCluster(project, ctx, reps.filter((it) => layerClusterKey(project, it.layer) === shot.id), waypointsByShot, out)
  })
  for (let i = 0; i + 1 < route.order.length; i++) {
    const from = v2CameraId(route.order[i].id)
    const to = v2CameraId(route.order[i + 1].id)
    out.edges.push({ id: `e-camchain-${route.order[i].id}-${route.order[i + 1].id}`, fromNode: from, fromPort: 'camera_cut', toNode: to, toPort: 'camera_cut' })
  }
  return out
}

/** Dây nối Camera chuyển cảnh (chỉ hiển thị theo lộ trình camera, không nối tay) */
export const isCameraChainEdge = (edge: WorkflowEdge): boolean => edge.id.startsWith('e-camchain-')
