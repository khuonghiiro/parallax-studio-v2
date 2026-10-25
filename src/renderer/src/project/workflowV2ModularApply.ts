import type { Project, Vec3, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { createShot, shotSpacing } from './factory'
import {
  applyLogicPresetToNode,
  defaultLogicPreset,
  resolveLogicPreset,
  type WorkflowV2SpawnCategory
} from './workflowV2LogicPresets'
import type {
  WorkflowMainJson,
  WorkflowModularBundleJson,
  WorkflowShotJson,
  WorkflowShotLogicSpec
} from './workflowV2ModularJson'
import { collectRepresentativeLayers, getLayerDisplayName } from './workflowV2Options'
import { getNodeLogicCategory, recomputeSharedLogicTargets } from './workflowV2PhysicsAndValidation'
import { WF_V2_COL_X, layoutWorkflowV2Tree } from './workflowV2Layout'
import {
  applyWorkflowV2ToProject,
  detachWorkflowV2NodeFromProject,
  resolveWorkflowV2
} from './workflowV2Rebuild'
import {
  V2_SHARED_CLUSTER,
  isCameraWaypointNode,
  layerClusterKey,
  v2CameraId,
  v2LayerNodeId,
  v2RootId
} from './workflowV2Scope'
import { syncWorkflowV2Graph } from './workflowV2Sync'

export interface ModularApplyResult {
  kind: 'main' | 'shot' | 'bundle' | 'graph'
  targetShotId: string | null
  updatedShots: number
  updatedLayers: number
  appliedLogics: number
  summary: string
}

const NODE_TYPE: Record<WorkflowV2SpawnCategory, WorkflowNode['type']> = {
  action: 'motion_choreography',
  anim_fx: 'motion_choreography',
  part_swap: 'layer_transform',
  audio: 'audio_lipsync',
  material: 'physics_fx',
  collision: 'physics_fx',
  light: 'physics_fx',
  cave: 'physics_fx',
  fx: 'physics_fx'
}

const AGENT: Record<WorkflowV2SpawnCategory, WorkflowNode['aiAgentRole']> = {
  action: 'MotionChoreographyAgent',
  anim_fx: 'MotionChoreographyAgent',
  part_swap: 'LayerTransformAgent',
  audio: 'AudioLipSyncAgent',
  material: 'PhysicsLightFxAgent',
  collision: 'PhysicsLightFxAgent',
  light: 'PhysicsLightFxAgent',
  cave: 'PhysicsLightFxAgent',
  fx: 'PhysicsLightFxAgent'
}

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
}

function isClusterLogicNode(node: WorkflowNode, clusterKey: string): boolean {
  const cat = getNodeLogicCategory(node)
  if (!cat || cat === 'camera' || cat === 'cluster_lock' || node.type === 'camera_director') return false
  const shotId = node.params?.shotId
  return clusterKey === V2_SHARED_CLUSTER ? !shotId : shotId === clusterKey
}

/**
 * Áp dụng JSON tổng (`main.json`) xuống Project: cập nhật Composition, Look, Camera tổng và danh sách Cảnh.
 */
export function applyMainWorkflowJson(project: Project, main: WorkflowMainJson): ModularApplyResult {
  if (main.name && typeof main.name === 'string') project.comp.name = main.name
  if (main.composition && typeof main.composition === 'object') {
    const c = main.composition
    if (typeof c.width === 'number' && c.width >= 16) project.comp.width = Math.round(c.width)
    if (typeof c.height === 'number' && c.height >= 16) project.comp.height = Math.round(c.height)
    if (typeof c.fps === 'number' && c.fps >= 1) project.comp.fps = Math.min(120, Math.round(c.fps))
    if (typeof c.duration === 'number' && c.duration >= 0.5) project.comp.duration = Number(c.duration.toFixed(2))
    if (typeof c.background === 'string' && c.background) project.comp.background = c.background
  }
  if (main.camera && typeof main.camera === 'object') {
    if (typeof main.camera.fov === 'number' && project.camera?.fov) project.camera.fov.value = main.camera.fov
    if (typeof main.camera.dofEnabled === 'boolean') project.camera.dofEnabled = main.camera.dofEnabled
    if (typeof main.camera.shakeAmount === 'number') project.camera.shakeAmount = main.camera.shakeAmount
    if (typeof main.camera.shakeSpeed === 'number') project.camera.shakeSpeed = main.camera.shakeSpeed
  }
  if (main.look && typeof main.look === 'object') {
    project.look = { ...project.look, ...main.look }
  }

  let updatedShots = 0
  const spacing = shotSpacing(project.comp)
  const wf = structuredClone(resolveWorkflowV2(project))

  if (Array.isArray(main.route)) {
    for (let i = 0; i < main.route.length; i++) {
      const ref = main.route[i]
      if (!ref || typeof ref !== 'object') continue
      let shot = project.shots.find((s) => s.id === ref.shotId) ?? project.shots.find((s) => s.name === ref.name)
      if (!shot) {
        shot = createShot(ref.name || `Cảnh ${i + 1}`, isVec3(ref.position) ? ref.position : [i * spacing, 0, 0], i)
        if (ref.shotId) shot.id = ref.shotId
        project.shots.push(shot)
      } else {
        if (typeof ref.name === 'string' && ref.name.trim()) shot.name = ref.name.trim()
        if (typeof ref.color === 'string' && ref.color.trim()) shot.color = ref.color.trim()
        if (typeof ref.visible === 'boolean') shot.visible = ref.visible
        if (isVec3(ref.position)) shot.position.value = [...ref.position]
      }
      if (ref.cameraPreset) {
        const camNode = wf.nodes.find((n) => n.id === v2CameraId(shot.id))
        if (camNode) camNode.params = { ...camNode.params, camPreset: ref.cameraPreset as never }
      }
      updatedShots++
    }
  }

  project.workflow = syncWorkflowV2Graph(project, wf)
  return {
    kind: 'main',
    targetShotId: null,
    updatedShots,
    updatedLayers: 0,
    appliedLogics: 0,
    summary: `Đã áp dụng main.json (${updatedShots} cảnh, thời lượng ${project.comp.duration}s).`
  }
}

function buildLogicNodeFromSpec(
  spec: WorkflowShotLogicSpec,
  clusterKey: string,
  repByLayerId: Map<string, { repId: string; memberIds: string[]; y: number; title: string }>,
  repByName: Map<string, { repId: string; memberIds: string[]; y: number; title: string }>,
  existingNode?: WorkflowNode,
  graphNode?: WorkflowNode
): { node: WorkflowNode; edges: WorkflowEdge[] } | null {
  const cat = (spec.category || getNodeLogicCategory(existingNode ?? ({} as WorkflowNode)) || 'action') as WorkflowV2SpawnCategory
  const matchedReps: { repId: string; memberIds: string[]; y: number; title: string }[] = []

  for (const id of spec.targetLayerIds ?? []) {
    const found = repByLayerId.get(id)
    if (found && !matchedReps.includes(found)) matchedReps.push(found)
  }
  if (matchedReps.length === 0 && Array.isArray(spec.targetLayerNames)) {
    for (const rawName of spec.targetLayerNames) {
      const found = repByName.get(rawName.trim().toLowerCase())
      if (found && !matchedReps.includes(found)) matchedReps.push(found)
    }
  }
  if (matchedReps.length === 0) return null

  const preset = (spec.presetId ? resolveLogicPreset(spec.presetId) : undefined) ?? defaultLogicPreset(cat)
  const targetLayerIds = Array.from(new Set(matchedReps.flatMap((r) => r.memberIds)))
  const sharedLayerNodeIds = matchedReps.map((r) => v2LayerNodeId(r.repId))
  const firstRep = matchedReps[0]
  const nodeId = spec.id || existingNode?.id || `v2-${cat}-${firstRep.repId}`
  const posSource = graphNode?.position ?? existingNode?.position ?? { x: WF_V2_COL_X.LOGIC, y: firstRep.y }

  const baseNode: WorkflowNode = applyLogicPresetToNode(
    {
      id: nodeId,
      type: NODE_TYPE[cat],
      title: spec.title || preset.title,
      enabled: spec.enabled !== false,
      position: { ...posSource },
      preset: cat === 'action' ? 'organic_wind_breathe' : cat === 'audio' ? 'auto_dialogue_lipsync' : 'rim_glow_particles',
      aiAgentRole: AGENT[cat],
      aiDirective: `${spec.title || preset.title} cho ${matchedReps.map((r) => r.title).join(', ')}.`,
      params: {
        ...(existingNode?.params ?? {}),
        ...(graphNode?.params ?? {}),
        shotId: clusterKey === V2_SHARED_CLUSTER ? undefined : clusterKey,
        logicCategory: cat,
        targetMode: 'custom',
        targetLayerIds,
        sharedLayerNodeIds,
        requireLayerConnection: true,
        timeStart: typeof spec.timeStart === 'number' ? spec.timeStart : (existingNode?.params?.timeStart ?? 0),
        timeEnd: typeof spec.timeEnd === 'number' ? spec.timeEnd : (existingNode?.params?.timeEnd ?? 5),
        hierarchyParentNodeId: sharedLayerNodeIds[0],
        ...(cat === 'collision' ? { strikerLayerId: firstRep.repId } : {})
      }
    },
    preset
  )

  const mergedParams = {
    ...baseNode.params,
    ...(spec.params ?? {}),
    shotId: clusterKey === V2_SHARED_CLUSTER ? undefined : clusterKey,
    logicCategory: cat,
    targetLayerIds,
    sharedLayerNodeIds,
    timeStart: typeof spec.timeStart === 'number' ? spec.timeStart : baseNode.params?.timeStart,
    timeEnd: typeof spec.timeEnd === 'number' ? spec.timeEnd : baseNode.params?.timeEnd
  }
  const finalNode: WorkflowNode = {
    ...baseNode,
    title: spec.title || baseNode.title,
    enabled: spec.enabled !== false,
    params: mergedParams
  }
  const edges: WorkflowEdge[] = sharedLayerNodeIds.map((layerNodeId) => ({
    id: `e-${layerNodeId}-${nodeId}`,
    fromNode: layerNodeId,
    fromPort: 'layers_tree',
    toNode: nodeId,
    toPort: 'layers_tree'
  }))
  return { node: finalNode, edges }
}

/**
 * Áp dụng JSON đơn lẻ của một cảnh (`shots/shot-N.json`) xuống đúng cảnh đó, giữ nguyên mọi cảnh khác.
 */
export function applyShotWorkflowJson(
  project: Project,
  shotDoc: WorkflowShotJson,
  targetShotIdOverride?: string
): ModularApplyResult {
  const rawShotId = targetShotIdOverride ?? shotDoc.shot?.id ?? V2_SHARED_CLUSTER
  const isShared = rawShotId === V2_SHARED_CLUSTER
  let shot = isShared ? undefined : project.shots.find((s) => s.id === rawShotId)

  if (!isShared && !shot) {
    const idx = project.shots.length
    const spacing = shotSpacing(project.comp)
    shot = createShot(
      shotDoc.shot?.name || `Cảnh ${idx + 1}`,
      isVec3(shotDoc.shot?.position) ? shotDoc.shot.position : [idx * spacing, 0, 0],
      idx
    )
    if (rawShotId) shot.id = rawShotId
    project.shots.push(shot)
  }

  if (shot && shotDoc.shot) {
    if (typeof shotDoc.shot.name === 'string' && shotDoc.shot.name.trim()) shot.name = shotDoc.shot.name.trim()
    if (typeof shotDoc.shot.color === 'string' && shotDoc.shot.color.trim()) shot.color = shotDoc.shot.color.trim()
    if (typeof shotDoc.shot.visible === 'boolean') shot.visible = shotDoc.shot.visible
    if (isVec3(shotDoc.shot.position)) shot.position.value = [...shotDoc.shot.position]
    if (isVec3(shotDoc.shot.rotation)) shot.rotation.value = [...shotDoc.shot.rotation]
  }

  const clusterKey = shot ? shot.id : V2_SHARED_CLUSTER
  const reps = collectRepresentativeLayers(project.layers).filter((it) => layerClusterKey(project, it.layer) === clusterKey)
  let updatedLayers = 0

  if (Array.isArray(shotDoc.layers)) {
    for (const lSpec of shotDoc.layers) {
      if (!lSpec || typeof lSpec !== 'object') continue
      const rep =
        reps.find((it) => it.layer.id === lSpec.id) ??
        reps.find((it) => getLayerDisplayName(it.layer).toLowerCase() === (lSpec.name || '').trim().toLowerCase())
      if (!rep) continue
      const memberSet = new Set(rep.memberIds)
      for (const layer of project.layers) {
        if (!memberSet.has(layer.id)) continue
        if (typeof lSpec.visible === 'boolean') layer.visible = lSpec.visible
        if (typeof lSpec.timeStart === 'number' && Number.isFinite(lSpec.timeStart)) layer.inPoint = Math.max(0, lSpec.timeStart)
        if (typeof lSpec.timeEnd === 'number' && Number.isFinite(lSpec.timeEnd)) {
          layer.outPoint = Math.max((layer.inPoint ?? 0) + 0.1, lSpec.timeEnd)
        }
        if (layer.id === rep.layer.id) {
          if (typeof lSpec.name === 'string' && lSpec.name.trim()) {
            const nextName = lSpec.name.trim()
            if (layer.model3d) layer.model3d.modelName = nextName
            else if (layer.composite) layer.composite.compositeName = nextName
            else layer.name = nextName
          }
          if (isVec3(lSpec.position)) layer.transform.position.value = [...lSpec.position]
          if (isVec3(lSpec.scale)) layer.transform.scale.value = [...lSpec.scale]
          if (typeof lSpec.opacity === 'number') layer.transform.opacity.value = Math.max(0, Math.min(1, lSpec.opacity))
        }
      }
      updatedLayers++
    }
  }

  const baseWf = resolveWorkflowV2(project)
  const oldClusterLogic = baseWf.nodes.filter((n) => isClusterLogicNode(n, clusterKey))
  const existingById = new Map(oldClusterLogic.map((n) => [n.id, n]))
  const graphById = new Map((shotDoc.graph?.nodes ?? []).map((n) => [n.id, n]))

  const repByLayerId = new Map<string, { repId: string; memberIds: string[]; y: number; title: string }>()
  const repByName = new Map<string, { repId: string; memberIds: string[]; y: number; title: string }>()
  for (const it of reps) {
    const layerNode = baseWf.nodes.find((n) => n.id === v2LayerNodeId(it.layer.id))
    const info = {
      repId: it.layer.id,
      memberIds: it.memberIds,
      y: layerNode?.position.y ?? 0,
      title: getLayerDisplayName(it.layer)
    }
    for (const mid of it.memberIds) repByLayerId.set(mid, info)
    repByName.set(info.title.toLowerCase(), info)
    repByName.set(it.layer.name.toLowerCase(), info)
  }

  const nextLogicNodes: WorkflowNode[] = []
  const nextLogicEdges: WorkflowEdge[] = []

  if (Array.isArray(shotDoc.logic)) {
    for (const spec of shotDoc.logic) {
      const built = buildLogicNodeFromSpec(spec, clusterKey, repByLayerId, repByName, existingById.get(spec.id), graphById.get(spec.id))
      if (built) {
        nextLogicNodes.push(built.node)
        nextLogicEdges.push(...built.edges)
      }
    }
  } else if (shotDoc.graph?.nodes) {
    for (const gNode of shotDoc.graph.nodes) {
      if (isClusterLogicNode(gNode, clusterKey)) {
        nextLogicNodes.push(structuredClone(gNode))
      }
    }
    const nextIds = new Set(nextLogicNodes.map((n) => n.id))
    for (const e of shotDoc.graph.edges ?? []) {
      if (nextIds.has(e.toNode)) nextLogicEdges.push(structuredClone(e))
    }
  }

  const keptLogicIds = new Set(nextLogicNodes.map((n) => n.id))
  for (const oldNode of oldClusterLogic) {
    if (!keptLogicIds.has(oldNode.id)) {
      detachWorkflowV2NodeFromProject(project, oldNode)
    }
  }

  const otherNodes = baseWf.nodes
    .filter((n) => !isClusterLogicNode(n, clusterKey))
    .map((n) => {
      if (shot && n.id === v2CameraId(shot.id) && shotDoc.camera) {
        return {
          ...n,
          enabled: shotDoc.camera.enabled !== false,
          params: {
            ...n.params,
            camPreset: (shotDoc.camera.preset as never) ?? n.params?.camPreset,
            enableDof: typeof shotDoc.camera.enableDof === 'boolean' ? shotDoc.camera.enableDof : n.params?.enableDof,
            timeStart: typeof shotDoc.camera.timeStart === 'number' ? shotDoc.camera.timeStart : n.params?.timeStart,
            timeEnd: typeof shotDoc.camera.timeEnd === 'number' ? shotDoc.camera.timeEnd : n.params?.timeEnd
          }
        }
      }
      if (shot && isCameraWaypointNode(n) && n.params?.shotId === shot.id && Array.isArray(shotDoc.camera?.waypoints)) {
        const wSpec =
          shotDoc.camera.waypoints.find((w) => w.nodeId === n.id) ??
          shotDoc.camera.waypoints.find((w) => w.index === (n.params?.waypointLocalIndex ?? 0) + 1)
        if (wSpec) {
          const zoomPct = typeof wSpec.zoomPct === 'number' && wSpec.zoomPct > 5 ? wSpec.zoomPct : n.params?.camZoomPct
          const nextScale =
            typeof wSpec.scale === 'number' && wSpec.scale !== n.params?.camScale
              ? wSpec.scale
              : zoomPct
                ? Number((100 / zoomPct).toFixed(3))
                : n.params?.camScale
          return {
            ...n,
            params: {
              ...n.params,
              camActionMode: (wSpec.actionMode as never) ?? n.params?.camActionMode,
              camZoomPct: zoomPct,
              camScale: nextScale,
              camStageX: typeof wSpec.stageX === 'number' ? wSpec.stageX : n.params?.camStageX,
              camStageY: typeof wSpec.stageY === 'number' ? wSpec.stageY : n.params?.camStageY,
              camYaw: typeof wSpec.yaw === 'number' ? wSpec.yaw : n.params?.camYaw,
              camPitch: typeof wSpec.pitch === 'number' ? wSpec.pitch : n.params?.camPitch,
              camRoll: typeof wSpec.roll === 'number' ? wSpec.roll : n.params?.camRoll,
              camStepDuration: typeof wSpec.stepDuration === 'number' ? wSpec.stepDuration : n.params?.camStepDuration,
              timeStart: typeof wSpec.timeStart === 'number' ? wSpec.timeStart : n.params?.timeStart,
              timeEnd: typeof wSpec.timeEnd === 'number' ? wSpec.timeEnd : n.params?.timeEnd
            }
          }
        }
      }
      const gOverride = graphById.get(n.id)
      if (gOverride?.position && n.id !== v2RootId(clusterKey)) {
        return { ...n, position: { ...gOverride.position }, params: { ...n.params, pinned: gOverride.params?.pinned } }
      }
      return n
    })

  const oldLogicIds = new Set(oldClusterLogic.map((n) => n.id))
  const otherEdges = baseWf.edges.filter((e) => !oldLogicIds.has(e.toNode) && !oldLogicIds.has(e.fromNode))

  const mergedEdges = [...otherEdges, ...nextLogicEdges]
  const mergedNodes = layoutWorkflowV2Tree(
    recomputeSharedLogicTargets([...otherNodes, ...nextLogicNodes], mergedEdges),
    mergedEdges
  )
  const mergedWf: WorkflowGraph = { ...baseWf, nodes: mergedNodes, edges: mergedEdges }

  applyWorkflowV2ToProject(project, mergedWf)
  project.workflow = syncWorkflowV2Graph(project, mergedWf)

  return {
    kind: 'shot',
    targetShotId: shot?.id ?? V2_SHARED_CLUSTER,
    updatedShots: shot ? 1 : 0,
    updatedLayers,
    appliedLogics: nextLogicNodes.length,
    summary: `Đã áp dụng ${shotDoc.file || 'JSON cảnh'} cho "${shot?.name ?? 'Layer dùng chung'}" (${updatedLayers} layer, ${nextLogicNodes.length} logic).`
  }
}

/**
 * Nhận diện và áp dụng mọi định dạng JSON Workflow V2:
 * - `main.json` (`parallax-workflow-main`)
 * - `shots/shot-N.json` (`parallax-workflow-shot`)
 * - `bundle.json` (`parallax-workflow-bundle`)
 * - Hoặc `WorkflowGraph` trực tiếp.
 */
export function applyModularWorkflowJson(
  project: Project,
  rawInput: unknown,
  defaultShotId?: string | null
): ModularApplyResult {
  let parsed: unknown = rawInput
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput)
    } catch (err) {
      throw new Error(`Lỗi cú pháp JSON: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Dữ liệu JSON phải là một đối tượng (Object).')
  }

  const obj = parsed as Record<string, unknown>

  if (obj.kind === 'parallax-workflow-main' || (Array.isArray(obj.route) && Array.isArray(obj.connections))) {
    return applyMainWorkflowJson(project, obj as unknown as WorkflowMainJson)
  }

  if (obj.kind === 'parallax-workflow-shot' || (obj.shot && (Array.isArray(obj.logic) || Array.isArray(obj.layers)))) {
    return applyShotWorkflowJson(project, obj as unknown as WorkflowShotJson, defaultShotId ?? undefined)
  }

  if (obj.kind === 'parallax-workflow-bundle' || (obj.main && obj.shots && typeof obj.shots === 'object')) {
    const bundle = obj as unknown as WorkflowModularBundleJson
    applyMainWorkflowJson(project, bundle.main)
    let totalLayers = 0
    let totalLogics = 0
    for (const [shotKey, shotDoc] of Object.entries(bundle.shots ?? {})) {
      if (shotDoc && typeof shotDoc === 'object') {
        const r = applyShotWorkflowJson(project, shotDoc, shotKey)
        totalLayers += r.updatedLayers
        totalLogics += r.appliedLogics
      }
    }
    const mainRes = applyMainWorkflowJson(project, bundle.main)
    return {
      kind: 'bundle',
      targetShotId: null,
      updatedShots: mainRes.updatedShots,
      updatedLayers: totalLayers,
      appliedLogics: totalLogics,
      summary: `Đã áp dụng trọn bộ JSON (${mainRes.updatedShots} cảnh, ${totalLayers} layer, ${totalLogics} logic).`
    }
  }

  if (Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
    const wf = obj as unknown as WorkflowGraph
    const prevWf = resolveWorkflowV2(project)
    const nextIds = new Set(wf.nodes.map((n) => n.id))
    for (const oldNode of prevWf.nodes) {
      if (!nextIds.has(oldNode.id)) detachWorkflowV2NodeFromProject(project, oldNode)
    }
    applyWorkflowV2ToProject(project, wf)
    project.workflow = syncWorkflowV2Graph(project, wf)
    return {
      kind: 'graph',
      targetShotId: null,
      updatedShots: project.shots.length,
      updatedLayers: project.layers.length,
      appliedLogics: wf.nodes.length,
      summary: `Đã áp dụng sơ đồ Workflow (${wf.nodes.length} node, ${wf.edges.length} dây nối).`
    }
  }

  throw new Error('Không nhận diện được cấu trúc JSON. Hãy dùng định dạng main.json, shot-N.json hoặc bundle.json.')
}
