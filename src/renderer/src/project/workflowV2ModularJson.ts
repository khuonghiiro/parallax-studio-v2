import type { Layer, LookSettings, Project, Vec3, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  WORKFLOW_V2_LOGIC_PRESETS,
  type WorkflowV2SpawnCategory
} from './workflowV2LogicPresets'
import {
  classifyLayerGroupKind,
  collectRepresentativeLayers,
  getLayerDisplayName,
  getLayerX,
  getLayerY,
  getLayerZ
} from './workflowV2Options'
import { getNodeLogicCategory } from './workflowV2PhysicsAndValidation'
import { resolveWorkflowV2 } from './workflowV2Rebuild'
import {
  V2_SHARED_CLUSTER,
  computeShotRoute,
  extractShotCameraWaypoints,
  layerClusterKey,
  resolveLayerNodeTimeRange,
  v2CameraId,
  v2LayerNodeId,
  v2RootId
} from './workflowV2Scope'

export interface WorkflowShotCameraWaypointSpec {
  nodeId: string
  index: number
  label: string
  isSubWaypoint: boolean
  actionMode: string
  tagLabel: string
  timeStart: number
  timeEnd: number
  stepDuration: number
  zoomPct: number
  stageX: number
  stageY: number
  scale: number
  yaw: number
  pitch: number
  roll: number
  ease: string
}

export interface WorkflowMainShotRef {
  shotId: string
  index: number
  name: string
  file: string
  color: string
  visible: boolean
  position: Vec3
  timeStart: number
  timeEnd: number
  cameraPreset: string
  waypointCount?: number
  layerCount: number
  logicCount: number
}

export interface WorkflowMainConnection {
  edgeId: string
  fromShotId: string
  fromShotName: string
  fromFile: string
  toShotId: string
  toShotName: string
  toFile: string
  transitionAt: number
}

export interface WorkflowMainJson {
  kind: 'parallax-workflow-main'
  version: 2
  name: string
  composition: {
    width: number
    height: number
    fps: number
    duration: number
    background: string
  }
  camera: {
    fov: number
    dofEnabled: boolean
    shakeAmount: number
    shakeSpeed: number
  }
  look: LookSettings
  route: WorkflowMainShotRef[]
  connections: WorkflowMainConnection[]
  sharedFile?: string
  assets: Record<string, string>
}

export interface WorkflowShotLayerSpec {
  id: string
  nodeId: string
  name: string
  type: Layer['type']
  groupKind: 'group_3d' | 'group_25d' | 'group_env'
  asset?: string
  visible: boolean
  position: Vec3
  scale: Vec3
  opacity: number
  timeStart: number
  timeEnd: number
}

export interface WorkflowShotLogicSpec {
  id: string
  category: WorkflowV2SpawnCategory
  presetId?: string
  title: string
  enabled: boolean
  timeStart: number
  timeEnd: number
  targetLayerIds: string[]
  targetLayerNames: string[]
  params: Record<string, unknown>
}

export interface WorkflowShotJson {
  kind: 'parallax-workflow-shot'
  version: 2
  file: string
  mainFile: 'main.json'
  shot: {
    id: string
    index: number
    name: string
    color: string
    visible: boolean
    position: Vec3
    rotation: Vec3
    timeStart: number
    timeEnd: number
  }
  links: {
    prevShotId: string | null
    prevShotFile: string | null
    nextShotId: string | null
    nextShotFile: string | null
    cameraInEdgeId: string | null
    cameraOutEdgeId: string | null
  }
  camera: {
    nodeId: string
    enabled: boolean
    preset: string
    enableDof: boolean
    timeStart: number
    timeEnd: number
    waypoints?: WorkflowShotCameraWaypointSpec[]
  }
  groups: {
    id: string
    kind: 'group_3d' | 'group_25d' | 'group_env'
    title: string
    enabled: boolean
    timeStart: number
    timeEnd: number
    layerCount: number
  }[]
  layers: WorkflowShotLayerSpec[]
  logic: WorkflowShotLogicSpec[]
  graph: {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
  }
}

export interface WorkflowModularBundleJson {
  kind: 'parallax-workflow-bundle'
  version: 2
  main: WorkflowMainJson
  shots: Record<string, WorkflowShotJson>
  files: Record<string, WorkflowMainJson | WorkflowShotJson>
}

export function shotJsonFileName(index1Based: number, isShared = false): string {
  return isShared ? 'shots/shared.json' : `shots/shot-${index1Based}.json`
}

function buildCompactAssetAliases(project: Project): { aliases: Record<string, string>; idToAlias: Map<string, string> } {
  const aliases: Record<string, string> = {}
  const idToAlias = new Map<string, string>()
  for (const a of project.assets) {
    const base = (a.name || 'asset')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'asset'
    let key = base
    let n = 2
    while (key in aliases) key = `${base}_${n++}`
    aliases[key] = a.assetPath || a.path || a.name
    idToAlias.set(a.id, `@${key}`)
  }
  return { aliases, idToAlias }
}

function inferPresetId(node: WorkflowNode, cat: WorkflowV2SpawnCategory): string | undefined {
  const p = node.params ?? {}
  const opt =
    cat === 'action' ? p.actionPreset
    : cat === 'anim_fx' ? p.animFxPreset
    : cat === 'part_swap' ? (p.swapMode === 'expression' && p.swapVariant === 'face-happy' ? 'expr_happy' : p.swapMode === 'expression' ? 'expr_normal' : p.swapMode === 'accessory' ? 'toggle_glasses' : p.swapMode === 'replace_composite' ? 'replace_composite' : 'replace_layer')
    : cat === 'material' ? p.materialTag
    : cat === 'collision' ? p.collisionMode
    : cat === 'light' ? p.lightMode
    : cat === 'cave' ? p.caveArchShape
    : cat === 'fx' ? p.fxKind
    : 'voice'
  const candidate = opt ? `v2:${cat}:${opt}` : undefined
  return candidate && WORKFLOW_V2_LOGIC_PRESETS.some((pr) => pr.id === candidate) ? candidate : undefined
}

function extractCleanLogicParams(node: WorkflowNode, cat: WorkflowV2SpawnCategory): Record<string, unknown> {
  const p = node.params ?? {}
  if (cat === 'action') return { actionPreset: p.actionPreset ?? 'sway', intensity: p.intensity ?? 0.6, ...(p.rigActionPreset ? { rigActionPreset: p.rigActionPreset } : {}), ...(p.staggerPhase ? { staggerPhase: p.staggerPhase } : {}) }
  if (cat === 'part_swap') {
    return {
      swapMode: p.swapMode ?? 'expression',
      ...(p.swapSlot ? { swapSlot: p.swapSlot } : {}),
      ...(p.swapVariant ? { swapVariant: p.swapVariant } : {}),
      ...(p.swapTargetLayerId ? { swapTargetLayerId: p.swapTargetLayerId } : {}),
      ...(p.swapAssetId ? { swapAssetId: p.swapAssetId } : {}),
      ...(p.swapTemplateId ? { swapTemplateId: p.swapTemplateId } : {})
    }
  }
  if (cat === 'anim_fx') {
    return {
      animFxPreset: p.animFxPreset ?? 'popIn',
      ...(p.animFxCount !== undefined ? { animFxCount: p.animFxCount } : {}),
      ...(p.intensity !== undefined ? { intensity: p.intensity } : {}),
      ...(p.animFxColor ? { animFxColor: p.animFxColor } : {}),
      ...(p.animFxSide ? { animFxSide: p.animFxSide } : {}),
      ...(p.animFxThickness !== undefined ? { animFxThickness: p.animFxThickness } : {})
    }
  }
  if (cat === 'material') {
    return {
      materialTag: p.materialTag ?? 'wood_plank',
      materialStiffness: p.materialStiffness ?? 0.65,
      materialBounciness: p.materialBounciness ?? 0.45,
      materialGravity: p.materialGravity ?? 0.5
    }
  }
  if (cat === 'collision') {
    return {
      collisionMode: p.collisionMode ?? 'elastic_bounce',
      collisionForce: p.collisionForce ?? 0.75,
      deformIntensity: p.deformIntensity ?? 0.35,
      ...(p.strikerLayerId ? { strikerLayerId: p.strikerLayerId } : {})
    }
  }
  if (cat === 'light') return { lightMode: p.lightMode ?? 'rim', lightColor: p.lightColor ?? '#38bdf8', intensity: p.intensity ?? 1.3 }
  if (cat === 'cave') return { caveArchShape: p.caveArchShape ?? 'arch', caveDarkness: p.caveDarkness ?? 0.82, caveMinScale: p.caveMinScale ?? 0.38 }
  if (cat === 'fx') return { fxKind: p.fxKind ?? 'wind_physics', intensity: p.intensity ?? 1.0 }
  return { intensity: p.intensity ?? 1.0, autoLipSync: Boolean(p.autoLipSync ?? true) }
}

function isClusterNode(node: WorkflowNode, clusterKey: string): boolean {
  if (node.id === v2RootId(clusterKey)) return true
  const shotId = node.params?.shotId
  return clusterKey === V2_SHARED_CLUSTER ? !shotId : shotId === clusterKey
}

/**
 * Tạo JSON tổng (`main.json`) kết nối lộ trình Camera và toàn bộ các cảnh độc lập của dự án.
 */
export function buildMainWorkflowJson(project: Project, wfInput?: WorkflowGraph): WorkflowMainJson {
  const wf = wfInput ?? resolveWorkflowV2(project)
  const route = computeShotRoute(project)
  const waypointsByShot = extractShotCameraWaypoints(project)
  const reps = collectRepresentativeLayers(project.layers)
  const { aliases } = buildCompactAssetAliases(project)
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))

  const routeRefs: WorkflowMainShotRef[] = route.order.map((shot, idx) => {
    const range = route.ranges.get(shot.id) ?? { start: 0, end: compDur }
    const camNode = wf.nodes.find((n) => n.id === v2CameraId(shot.id))
    const shotLayers = reps.filter((it) => layerClusterKey(project, it.layer) === shot.id)
    const logicNodes = wf.nodes.filter((n) => {
      const cat = getNodeLogicCategory(n)
      return cat && cat !== 'camera' && cat !== 'cluster_lock' && n.type !== 'camera_director' && n.params?.shotId === shot.id
    })
    return {
      shotId: shot.id,
      index: idx + 1,
      name: shot.name,
      file: shotJsonFileName(idx + 1),
      color: shot.color || '#38bdf8',
      visible: shot.visible !== false,
      position: [...(shot.position?.value ?? [0, 0, 0])] as Vec3,
      timeStart: range.start,
      timeEnd: range.end,
      cameraPreset: String(camNode?.params?.camPreset ?? 'dollyIn'),
      waypointCount: waypointsByShot.get(shot.id)?.length ?? 1,
      layerCount: shotLayers.length,
      logicCount: logicNodes.length
    }
  })

  const connections: WorkflowMainConnection[] = []
  for (let i = 0; i + 1 < routeRefs.length; i++) {
    const a = routeRefs[i]
    const b = routeRefs[i + 1]
    connections.push({
      edgeId: `e-camchain-${a.shotId}-${b.shotId}`,
      fromShotId: a.shotId,
      fromShotName: a.name,
      fromFile: a.file,
      toShotId: b.shotId,
      toShotName: b.name,
      toFile: b.file,
      transitionAt: a.timeEnd
    })
  }

  const hasShared = reps.some((it) => layerClusterKey(project, it.layer) === V2_SHARED_CLUSTER)
  return {
    kind: 'parallax-workflow-main',
    version: 2,
    name: project.comp.name,
    composition: {
      width: project.comp.width,
      height: project.comp.height,
      fps: project.comp.fps,
      duration: compDur,
      background: project.comp.background
    },
    camera: {
      fov: project.camera?.fov?.value ?? 50,
      dofEnabled: Boolean(project.camera?.dofEnabled),
      shakeAmount: project.camera?.shakeAmount ?? 0,
      shakeSpeed: project.camera?.shakeSpeed ?? 1.5
    },
    look: { ...project.look },
    route: routeRefs,
    connections,
    ...(hasShared ? { sharedFile: shotJsonFileName(0, true) } : {}),
    assets: aliases
  }
}

/**
 * Tạo JSON đơn lẻ (`shots/shot-N.json`) cho một cảnh cụ thể, chứa trọn vẹn Camera, Layer, Logic và đồ thị của cảnh đó.
 */
export function buildShotWorkflowJson(project: Project, shotIdOrShared: string, wfInput?: WorkflowGraph): WorkflowShotJson {
  const wf = wfInput ?? resolveWorkflowV2(project)
  const route = computeShotRoute(project)
  const reps = collectRepresentativeLayers(project.layers)
  const { idToAlias } = buildCompactAssetAliases(project)
  const compDur = Math.max(1, Number((project.comp.duration || 5).toFixed(2)))

  const isShared = shotIdOrShared === V2_SHARED_CLUSTER
  const routeIdx = isShared ? -1 : route.order.findIndex((s) => s.id === shotIdOrShared)
  const shot = isShared ? undefined : (route.order[routeIdx] ?? project.shots.find((s) => s.id === shotIdOrShared))
  const clusterKey = shot ? shot.id : V2_SHARED_CLUSTER
  const index1 = routeIdx >= 0 ? routeIdx + 1 : 0
  const range = shot ? (route.ranges.get(shot.id) ?? { start: 0, end: compDur }) : { start: 0, end: compDur }
  const prevShot = routeIdx > 0 ? route.order[routeIdx - 1] : null
  const nextShot = routeIdx >= 0 && routeIdx + 1 < route.order.length ? route.order[routeIdx + 1] : null

  const clusterNodes = wf.nodes.filter((n) => isClusterNode(n, clusterKey))
  const nodeIdSet = new Set(clusterNodes.map((n) => n.id))
  const clusterEdges = wf.edges.filter((e) => nodeIdSet.has(e.fromNode) && nodeIdSet.has(e.toNode))

  const camNode = shot ? wf.nodes.find((n) => n.id === v2CameraId(shot.id)) : undefined
  const shotWaypoints: WorkflowShotCameraWaypointSpec[] = shot
    ? (extractShotCameraWaypoints(project).get(shot.id) ?? []).map((w) => ({
        nodeId: w.nodeId,
        index: w.localIndex + 1,
        label: w.displayLabel,
        isSubWaypoint: w.isSubWaypoint,
        actionMode: w.actionMode,
        tagLabel: w.tagLabel,
        timeStart: w.timeStart,
        timeEnd: w.timeEnd,
        stepDuration: w.stepDuration,
        zoomPct: w.zoomPct,
        stageX: w.stageX,
        stageY: w.stageY,
        scale: w.scale,
        yaw: w.yaw,
        pitch: w.pitch,
        roll: w.roll,
        ease: w.ease
      }))
    : []
  const groupNodes = clusterNodes.filter((n) => n.type === 'layer_assembly' && Boolean(n.params?.groupKind))
  const shotReps = reps.filter((it) => layerClusterKey(project, it.layer) === clusterKey)

  const layers: WorkflowShotLayerSpec[] = shotReps.map((it) => {
    const l = it.layer
    const lr = resolveLayerNodeTimeRange(l, compDur)
    const assetAlias = l.type === 'image' && l.props.assetId ? idToAlias.get(l.props.assetId) : undefined
    return {
      id: l.id,
      nodeId: v2LayerNodeId(l.id),
      name: getLayerDisplayName(l),
      type: l.type,
      groupKind: classifyLayerGroupKind(l),
      ...(assetAlias ? { asset: assetAlias } : {}),
      visible: l.visible !== false,
      position: [getLayerX(l), getLayerY(l), getLayerZ(l)],
      scale: [...(l.transform.scale?.value ?? [1, 1, 1])] as Vec3,
      opacity: Number((l.transform.opacity?.value ?? 1).toFixed(2)),
      timeStart: lr.start,
      timeEnd: lr.end
    }
  })

  const layerNameById = new Map(layers.map((l) => [l.id, l.name]))
  const logicNodes = clusterNodes.filter((n) => {
    const cat = getNodeLogicCategory(n)
    return Boolean(cat) && cat !== 'camera' && cat !== 'cluster_lock' && n.type !== 'camera_director'
  })

  const logic: WorkflowShotLogicSpec[] = logicNodes.map((n) => {
    const cat = (getNodeLogicCategory(n) ?? 'action') as WorkflowV2SpawnCategory
    const targetIds = (n.params?.targetLayerIds ?? []).filter((id) => layerNameById.has(id) || project.layers.some((l) => l.id === id))
    const repNames = Array.from(
      new Set(
        targetIds
          .map((id) => layerNameById.get(id) ?? getLayerDisplayName(project.layers.find((l) => l.id === id)!))
          .filter(Boolean)
      )
    )
    return {
      id: n.id,
      category: cat,
      presetId: inferPresetId(n, cat),
      title: n.title,
      enabled: n.enabled,
      timeStart: Number((n.params?.timeStart ?? range.start).toFixed(2)),
      timeEnd: Number((n.params?.timeEnd ?? range.end).toFixed(2)),
      targetLayerIds: targetIds,
      targetLayerNames: repNames,
      params: extractCleanLogicParams(n, cat)
    }
  })

  return {
    kind: 'parallax-workflow-shot',
    version: 2,
    file: shotJsonFileName(index1, !shot),
    mainFile: 'main.json',
    shot: {
      id: shot?.id ?? V2_SHARED_CLUSTER,
      index: index1,
      name: shot?.name ?? 'Layer dùng chung',
      color: shot?.color ?? '#64748b',
      visible: shot ? shot.visible !== false : true,
      position: [...(shot?.position?.value ?? [0, 0, 0])] as Vec3,
      rotation: [...(shot?.rotation?.value ?? [0, 0, 0])] as Vec3,
      timeStart: range.start,
      timeEnd: range.end
    },
    links: {
      prevShotId: prevShot?.id ?? null,
      prevShotFile: prevShot ? shotJsonFileName(routeIdx) : null,
      nextShotId: nextShot?.id ?? null,
      nextShotFile: nextShot ? shotJsonFileName(routeIdx + 2) : null,
      cameraInEdgeId: prevShot && shot ? `e-camchain-${prevShot.id}-${shot.id}` : null,
      cameraOutEdgeId: nextShot && shot ? `e-camchain-${shot.id}-${nextShot.id}` : null
    },
    camera: {
      nodeId: shot ? v2CameraId(shot.id) : 'v2-camera-shared',
      enabled: camNode ? camNode.enabled : true,
      preset: String(camNode?.params?.camPreset ?? 'dollyIn'),
      enableDof: Boolean(camNode?.params?.enableDof ?? project.camera?.dofEnabled),
      timeStart: Number((camNode?.params?.timeStart ?? range.start).toFixed(2)),
      timeEnd: Number((camNode?.params?.timeEnd ?? range.end).toFixed(2)),
      waypoints: shotWaypoints
    },
    groups: groupNodes.map((g) => ({
      id: g.id,
      kind: (g.params?.groupKind ?? 'group_25d') as 'group_3d' | 'group_25d' | 'group_env',
      title: g.title,
      enabled: g.enabled,
      timeStart: Number((g.params?.timeStart ?? range.start).toFixed(2)),
      timeEnd: Number((g.params?.timeEnd ?? range.end).toFixed(2)),
      layerCount: Number(g.params?.childLayerCount ?? 0)
    })),
    layers,
    logic,
    graph: {
      nodes: structuredClone(clusterNodes),
      edges: structuredClone(clusterEdges)
    }
  }
}

/**
 * Đóng gói trọn bộ dự án theo kiến trúc JSON độc lập: `main.json` + từng `shots/shot-N.json`.
 */
export function buildModularWorkflowBundle(project: Project, wfInput?: WorkflowGraph): WorkflowModularBundleJson {
  const wf = wfInput ?? resolveWorkflowV2(project)
  const main = buildMainWorkflowJson(project, wf)
  const shots: Record<string, WorkflowShotJson> = {}
  const files: Record<string, WorkflowMainJson | WorkflowShotJson> = { 'main.json': main }

  for (const item of main.route) {
    const shotDoc = buildShotWorkflowJson(project, item.shotId, wf)
    shots[item.shotId] = shotDoc
    files[item.file] = shotDoc
  }
  if (main.sharedFile) {
    const sharedDoc = buildShotWorkflowJson(project, V2_SHARED_CLUSTER, wf)
    shots[V2_SHARED_CLUSTER] = sharedDoc
    files[main.sharedFile] = sharedDoc
  }
  return {
    kind: 'parallax-workflow-bundle',
    version: 2,
    main,
    shots,
    files
  }
}
