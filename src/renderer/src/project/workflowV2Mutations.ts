import type { GlowSide, Layer, LayerGlow, LayerMotionType, Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getProjectAudioTracks } from './audioTracks'
import {
  generateBlinkKeys,
  generateBreatheKeys,
  generateFadeKeys,
  generatePopInKeys,
  generatePulseKeys,
  generateShakeKeys
} from '../ui/timeline/fxKeyGenerators'
import { deleteLayerEffect, toggleLayerEffect } from '../ui/timeline/timelineEffects'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import {
  applyWaypointActionMode,
  spawnNextCameraWaypoint,
  updateCameraWaypoint,
  updateWaypointStepDuration,
  type CameraActionMode
} from '../ui/viewer/animateCamera/animateCameraRouteLogic'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import {
  applyCollisionNodeToProject,
  applyMaterialNodeToProject,
  recomputeSharedLogicTargets
} from './workflowV2PhysicsAndValidation'
import { WF_V2_COL_X, layoutWorkflowV2Tree } from './workflowV2Layout'
import {
  applyLogicPresetToNode,
  defaultLogicPreset,
  findLogicPreset,
  type WorkflowV2SpawnCategory
} from './workflowV2LogicPresets'

const NODE_TYPE: Record<WorkflowV2SpawnCategory, WorkflowNode['type']> = {
  action: 'motion_choreography',
  anim_fx: 'motion_choreography',
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
  audio: 'AudioLipSyncAgent',
  material: 'PhysicsLightFxAgent',
  collision: 'PhysicsLightFxAgent',
  light: 'PhysicsLightFxAgent',
  cave: 'PhysicsLightFxAgent',
  fx: 'PhysicsLightFxAgent'
}

function uniqueNodeId(workflow: WorkflowGraph, base: string): string {
  let id = base
  let i = 2
  while (workflow.nodes.some((n) => n.id === id)) id = `${base}-${i++}`
  return id
}

function withEdge(workflow: WorkflowGraph, nodes: WorkflowNode[], edge: WorkflowEdge): WorkflowGraph {
  const edges = [...workflow.edges, edge]
  return { ...workflow, nodes: layoutWorkflowV2Tree(recomputeSharedLogicTargets(nodes, edges), edges), edges }
}

const layerEdge = (layerNodeId: string, nodeId: string): WorkflowEdge => ({
  id: `e-${layerNodeId}-${nodeId}`,
  fromNode: layerNodeId,
  fromPort: 'layers_tree',
  toNode: nodeId,
  toPort: 'layers_tree'
})

/**
 * Gắn (hoặc tái sử dụng) một Node Logic vào một Node Layer theo mẫu logic chung `presetId`
 * (dùng chung cho Timeline, Workflow và MCP):
 * - Layer đã có logic cùng nhóm → tái sử dụng Node đó (và áp mẫu mới nếu có), không tạo trùng.
 * - Va chạm: ưu tiên ghép làm Layer B vào Node Va chạm cùng cảnh đang chờ; nếu không, tạo Node mới chờ nối Layer B
 *   (không tự đoán đối tượng va chạm).
 * - Id Node xác định theo Layer (`v2-<nhóm>-<layerId>`) để Timeline và Workflow luôn trỏ cùng một Node.
 */
export function attachLogicNodeToLayerV2(
  workflow: WorkflowGraph,
  layerNodeId: string,
  category: WorkflowV2SpawnCategory,
  presetId?: string
): { workflow: WorkflowGraph; createdNodeId: string; reusedExisting?: boolean; message?: string } {
  const layerNode = workflow.nodes.find((n) => n.id === layerNodeId)
  if (!layerNode || layerNode.type !== 'layer_assembly' || layerNode.params?.groupKind) {
    return { workflow, createdNodeId: '', message: 'Không tìm thấy Node Layer mục tiêu.' }
  }
  const chosen = (presetId ? findLogicPreset(presetId) : undefined) ?? defaultLogicPreset(category)
  const existing = workflow.edges
    .filter((e) => e.fromNode === layerNodeId)
    .map((e) => workflow.nodes.find((n) => n.id === e.toNode))
    .find((n) => n?.params?.logicCategory === category)
  if (existing) {
    const nodes = presetId ? workflow.nodes.map((n) => (n.id === existing.id ? applyLogicPresetToNode(n, chosen) : n)) : workflow.nodes
    return {
      workflow: { ...workflow, nodes },
      createdNodeId: existing.id,
      reusedExisting: true,
      message: presetId
        ? `Layer "${layerNode.title}" đã có Node ${chosen.title.split(':')[0]} — đã chuyển Node đó sang "${chosen.label}".`
        : `Layer "${layerNode.title}" đã có "${existing.title}" — chọn Node này để tránh trùng logic.`
    }
  }
  if (category === 'collision') {
    const open = workflow.nodes.find(
      (n) =>
        n.params?.logicCategory === 'collision' &&
        (n.params?.sharedLayerNodeIds?.length ?? 0) < 2 &&
        n.params?.shotId === layerNode.params?.shotId
    )
    if (open) {
      return {
        workflow: withEdge(workflow, workflow.nodes, layerEdge(layerNodeId, open.id)),
        createdNodeId: open.id,
        reusedExisting: true,
        message: `Đã ghép "${layerNode.title}" làm Layer B cho "${open.title}".`
      }
    }
  }
  const layerId = layerNodeId.replace(/^v2-layer-/, '')
  const id = uniqueNodeId(workflow, `v2-${category}-${layerId}`)
  const startSec = layerNode.params?.timeStart ?? 0
  const layerEndSec = layerNode.params?.timeEnd ?? 5
  const animDefaultDur =
    category === 'anim_fx'
      ? (WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === chosen.params.animFxPreset)?.defaultDuration ?? 0.6)
      : undefined
  const endSec =
    animDefaultDur !== undefined
      ? Number(Math.max(startSec + 0.2, Math.min(layerEndSec, startSec + animDefaultDur)).toFixed(2))
      : layerEndSec
  const node: WorkflowNode = applyLogicPresetToNode(
    {
      id,
      type: NODE_TYPE[category],
      title: chosen.title,
      enabled: true,
      position: { x: WF_V2_COL_X.LOGIC, y: layerNode.position.y },
      preset: category === 'action' || category === 'anim_fx' ? 'organic_wind_breathe' : category === 'audio' ? 'auto_dialogue_lipsync' : 'rim_glow_particles',
      aiAgentRole: AGENT[category],
      aiDirective: `${chosen.title} cho "${layerNode.title}".`,
      params: {
        shotId: layerNode.params?.shotId,
        logicCategory: category,
        targetMode: 'custom',
        targetLayerIds: [...(layerNode.params?.targetLayerIds ?? [])],
        sharedLayerNodeIds: [layerNodeId],
        requireLayerConnection: true,
        timeStart: startSec,
        timeEnd: endSec,
        hierarchyParentNodeId: layerNodeId,
        ...(category === 'collision' ? { strikerLayerId: layerNode.params?.targetLayerIds?.[0] } : {})
      }
    },
    chosen
  )
  return {
    workflow: withEdge(workflow, [...workflow.nodes, node], layerEdge(layerNodeId, id)),
    createdNodeId: id,
    message: category === 'collision' ? 'Đã tạo Node Va chạm — nối thêm 1 Layer (Layer B) để va chạm có hiệu lực.' : undefined
  }
}

/** Đồng bộ Node Âm thanh xuống các track đang gắn vào Layer đích (âm lượng, tắt tiếng, nhép môi, mốc bắt đầu) */
function syncAudioNodeToProject(project: Project, node: WorkflowNode, params: WorkflowNodeParams, timeEdited: boolean): void {
  const targets = new Set(params.targetLayerIds ?? [])
  const instanceIds = new Set(
    project.layers
      .filter((l) => targets.has(l.id))
      .flatMap((l) => [l.composite?.instanceId, l.model3d?.instanceId])
      .filter((v): v is string => Boolean(v))
  )
  for (const tr of getProjectAudioTracks(project)) {
    if (!tr.targetId || (!targets.has(tr.targetId) && !instanceIds.has(tr.targetId))) continue
    tr.muted = !node.enabled
    if (typeof params.intensity === 'number') tr.volume = Math.max(0, Math.min(2, params.intensity))
    tr.lipSyncEnabled = Boolean(params.autoLipSync)
    if (timeEdited && typeof params.timeStart === 'number') tr.offset = Math.max(0, params.timeStart)
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

/** Đồng bộ Node Hoạt ảnh FX (`anim_fx`) xuống `layer.appliedEffects` (và keyframe / glow tương ứng) */
function syncAnimFxNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const presetId = params.animFxPreset ?? 'popIn'
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]
  const tol = 1 / Math.max(1, (project.comp.fps || 30) * 2)

  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    const nonMotionList = (l.appliedEffects ?? []).filter((f) => f.category !== 'motion')
    if (!node.enabled) {
      for (const fx of nonMotionList) {
        if (fx.enabled) toggleLayerEffect(l, fx.id, false)
      }
      continue
    }

    const existingFx = nonMotionList[nonMotionList.length - 1]
    if (existingFx && existingFx.presetId === presetId && !patch) {
      if (!existingFx.enabled) toggleLayerEffect(l, existingFx.id, true)
      continue
    }

    if (existingFx) {
      deleteLayerEffect(l, existingFx.id)
    }

    const start = Math.max(0, params.timeStart ?? existingFx?.startTime ?? l.inPoint ?? 0)
    const rawEnd = params.timeEnd ?? (start + opt.defaultDuration)
    const duration = Math.max(0.1, Number((rawEnd - start).toFixed(2)))
    const count = Math.max(1, Math.round(params.animFxCount ?? existingFx?.count ?? opt.defaultCount ?? 2))
    const intensity = params.intensity ?? existingFx?.intensity ?? opt.defaultIntensity ?? 1.2
    const color = params.animFxColor ?? existingFx?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
    const side: GlowSide = params.animFxSide ?? existingFx?.glow?.side ?? 'outer'
    const thickness = params.animFxThickness ?? existingFx?.glow?.thickness ?? 10
    const speed = params.animFxSpeed ?? existingFx?.glow?.speed ?? (duration > 0 ? Math.max(0.5, count / duration) : 1.5)
    const minIntensity = params.animFxMinIntensity ?? existingFx?.glow?.minIntensity ?? 0.15

    let createdKeyIds: string[] = []
    let targetProp: 'opacity' | 'position' | 'scale' | undefined

    if (presetId === 'blink') {
      targetProp = 'opacity'
      createdKeyIds = generateBlinkKeys(l.transform.opacity, start, duration, count, 0.05, tol).map((k) => k.id)
    } else if (presetId === 'fadeOut') {
      targetProp = 'opacity'
      createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'out', tol).map((k) => k.id)
    } else if (presetId === 'fadeIn') {
      targetProp = 'opacity'
      createdKeyIds = generateFadeKeys(l.transform.opacity, start, duration, 'in', tol).map((k) => k.id)
    } else if (presetId === 'breathe') {
      targetProp = 'opacity'
      createdKeyIds = generateBreatheKeys(l.transform.opacity, start, duration, 0.2, tol).map((k) => k.id)
    } else if (presetId === 'shake') {
      targetProp = 'position'
      createdKeyIds = generateShakeKeys(l.transform.position, start, duration, intensity, count, tol).map((k) => k.id)
    } else if (presetId === 'popIn') {
      targetProp = 'scale'
      createdKeyIds = generatePopInKeys(l.transform.scale, start, duration, count, intensity, tol).map((k) => k.id)
    } else if (presetId === 'pulse') {
      targetProp = 'scale'
      createdKeyIds = generatePulseKeys(l.transform.scale, start, duration, count, intensity, tol).map((k) => k.id)
    } else {
      const animated: LayerGlow['animated'] =
        presetId === 'neonBreathe'
          ? 'breathe'
          : presetId === 'neonBlink'
            ? 'blink'
            : presetId === 'neonFlicker'
              ? 'flicker'
              : 'none'
      l.glow = {
        enabled: true,
        startTime: start,
        duration,
        side,
        color,
        thickness,
        intensity,
        animated,
        speed,
        minIntensity
      }
    }

    if (!l.appliedEffects) l.appliedEffects = []
    l.appliedEffects.push({
      id: existingFx?.id ?? `fx-wf-${node.id}`,
      presetId,
      name: opt.label.replace(/^[^\w\p{L}]+\s*/u, ''),
      badge: opt.badge,
      category: opt.fxCategory,
      startTime: start,
      duration,
      enabled: true,
      targetProp,
      keyframeIds: createdKeyIds,
      glow: opt.fxCategory === 'glow' && l.glow ? { ...l.glow } : undefined,
      count: opt.defaultCount !== undefined ? count : undefined,
      intensity: opt.defaultIntensity !== undefined ? intensity : undefined
    })
  }
}

/**
 * Đồng bộ trực tiếp thay đổi trên một Node V2 xuống dữ liệu Project thực tế
 * (bao gồm Node Nhãn Vật liệu, Va chạm Vật lý 2 Layer và Hoạt ảnh FX).
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

  // 0. Node Cảnh (Scene Shot Root)
  if (node.type === 'scene_shot' && params.shotId) {
    const shot = project.shots.find((s) => s.id === params.shotId)
    if (shot) {
      shot.visible = node.enabled
    }
    return
  }

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

  // 3b. Node Hoạt ảnh FX (Animation FX: Pop In, Shake, Pulse, Blink, Fade, Neon...)
  if (params.logicCategory === 'anim_fx') {
    syncAnimFxNodeToProject(project, node, params, patch)
    return
  }

  // 4. Node Hành động (Motion / Action) — tắt Node chỉ tắt chuyển động, giữ kiểu để bật lại không mất cấu hình
  if (node.type === 'motion_choreography' || params.logicCategory === 'action') {
    const actOpt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === params.actionPreset)
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const motionType = (actOpt?.motionType ?? (params.actionPreset as LayerMotionType | undefined) ?? l.motion?.type ?? 'float') as LayerMotionType
      if (!node.enabled) {
        l.motion = { ...(l.motion ?? { speed: 1, amount: 0 }), type: motionType, enabled: false }
        continue
      }
      const startSec = tStart ?? l.inPoint ?? 0
      const endSec = tEnd ?? l.outPoint ?? project.comp.duration
      l.motion = {
        ...(l.motion ?? {}),
        enabled: true,
        type: motionType,
        speed: actOpt?.defaultSpeed ?? l.motion?.speed ?? 1,
        amount: Math.max(0.1, Math.min(2.0, params.intensity ?? actOpt?.defaultAmount ?? 0.6)),
        startTime: startSec,
        duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
      }
    }
    return
  }

  // 4b. Node Âm thanh — ghi xuống track âm thanh đang gắn vào Layer
  if (node.type === 'audio_lipsync' || params.logicCategory === 'audio') {
    syncAudioNodeToProject(project, node, params, !patch || 'timeStart' in patch)
    return
  }

  // 5. Node Hang động / Vùng độ sâu (Cave Depth Portal)
  if (params.logicCategory === 'cave') {
    const archShape = params.caveArchShape ?? 'arch'
    const darkness = Math.max(0.1, Math.min(1.0, params.caveDarkness ?? params.intensity ?? 0.82))
    const minScale = params.caveMinScale ?? 0.38
    for (const l of project.layers) {
      if (!targetIds.has(l.id)) continue
      const prevPortal = l.physics?.depthPortal
      l.physics = {
        ...(l.physics ?? { enabled: true, material: 'none' }),
        enabled: node.enabled,
        colliderZone: 'cave_portal',
        depthPortal: {
          centerUV: prevPortal?.centerUV ?? [0.5, 0.45],
          radiusUV: prevPortal?.radiusUV ?? [0.35, 0.35],
          shadowTint: prevPortal?.shadowTint ?? '#060812',
          depthPullZ: prevPortal?.depthPullZ ?? 140,
          feather: prevPortal?.feather ?? 0.55,
          ...(prevPortal ?? {}),
          enabled: node.enabled,
          minScale,
          darkness,
          archShape
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
          ...(l.glow ?? {}),
          enabled: node.enabled,
          color,
          intensity: Math.min(3, intensity),
          thickness: l.glow?.thickness ?? 12,
          startTime: startSec,
          duration: Math.max(0.1, Number((endSec - startSec).toFixed(2)))
        }
      }
      const prevVl = l.virtualLight
      l.virtualLight = {
        radius: prevVl?.radius ?? 460,
        originUV: prevVl?.originUV ?? [0.5, 0.5],
        zReach: prevVl?.zReach ?? 320,
        ...(prevVl ?? {}),
        enabled: node.enabled,
        kind: lightOpt.virtualKind,
        color,
        intensity
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

  // 8. Node Camera 3D hoặc Node con lộ trình quay / cảnh con của Camera
  if (node.type === 'camera_director' || params.logicCategory === 'camera') {
    if (params.isCameraWaypoint) {
      syncCameraWaypointNodeToProject(project, node, params, patch)
      return
    }
    if (project.camera) {
      if (typeof params.enableDof === 'boolean') project.camera.dofEnabled = params.enableDof
      if (typeof params.camShakeAmount === 'number') project.camera.shakeAmount = params.camShakeAmount
      if (typeof params.camShakeSpeed === 'number') project.camera.shakeSpeed = params.camShakeSpeed
    }
  }
}

/**
 * Đồng bộ thay đổi trên một Node con lộ trình quay (`isCameraWaypoint`) xuống dữ liệu keyframe thật của `project.camera`.
 */
function syncCameraWaypointNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const layout = computeShotStageLayout(project, 0)
  const frames = extractCameraFrames2D(project, layout)
  const wpIdx = typeof params.waypointIndex === 'number' ? params.waypointIndex : 0
  const nodeTime = node.params?.timeStart ?? params.timeStart ?? 0
  const candidate = frames[wpIdx]
  const frame =
    (candidate && (!params.shotId || candidate.shotId === params.shotId || Math.abs(candidate.time - nodeTime) <= 0.1) ? candidate : undefined) ??
    frames.find((f) => Math.abs(f.time - nodeTime) <= 0.05)
  const shotBox = layout.find((b) => b.shotId === params.shotId)
  const baseStageX = frame?.stageX ?? shotBox?.stageX ?? 0
  const baseStageY = frame?.stageY ?? shotBox?.stageY ?? 0
  const baseScale = frame?.scale ?? 1
  const baseYaw = frame?.yaw ?? 0
  const basePitch = frame?.pitch ?? 0
  const baseRoll = frame?.roll ?? 0
  let wpTime = frame?.time ?? nodeTime

  if (patch?.camActionMode) {
    applyWaypointActionMode(project, layout, wpTime, patch.camActionMode as CameraActionMode)
  }

  const hasPosePatch =
    !patch ||
    'camZoomPct' in patch ||
    'camScale' in patch ||
    'camYaw' in patch ||
    'camPitch' in patch ||
    'camRoll' in patch ||
    'camStageX' in patch ||
    'camStageY' in patch

  if (hasPosePatch && !patch?.camActionMode) {
    const nextScale =
      patch && 'camZoomPct' in patch && typeof params.camZoomPct === 'number' && params.camZoomPct > 5
        ? Number((100 / params.camZoomPct).toFixed(3))
        : typeof params.camScale === 'number' && (!patch || 'camScale' in patch)
          ? params.camScale
          : typeof params.camZoomPct === 'number' && params.camZoomPct > 5
            ? Number((100 / params.camZoomPct).toFixed(3))
            : baseScale
    const nextStageX = typeof params.camStageX === 'number' ? params.camStageX : baseStageX
    const nextStageY = typeof params.camStageY === 'number' ? params.camStageY : baseStageY
    const nextYaw = typeof params.camYaw === 'number' ? params.camYaw : baseYaw
    const nextPitch = typeof params.camPitch === 'number' ? params.camPitch : basePitch
    const nextRoll = typeof params.camRoll === 'number' ? params.camRoll : baseRoll
    const poseChanged =
      Math.abs(nextStageX - baseStageX) > 0.01 ||
      Math.abs(nextStageY - baseStageY) > 0.01 ||
      Math.abs(nextScale - baseScale) > 0.002 ||
      Math.abs(nextYaw - baseYaw) > 0.01 ||
      Math.abs(nextPitch - basePitch) > 0.01 ||
      Math.abs(nextRoll - baseRoll) > 0.01
    if (poseChanged || Boolean(patch)) {
      updateCameraWaypoint(project, layout, wpTime, {
        stageX: nextStageX,
        stageY: nextStageY,
        scale: nextScale,
        yaw: nextYaw,
        pitch: nextPitch,
        roll: nextRoll
      })
    }
  }

  if (patch && ('camStepDuration' in patch || 'timeEnd' in patch || 'timeStart' in patch)) {
    if ('timeStart' in patch && typeof patch.timeStart === 'number' && wpIdx > 0 && Math.abs(patch.timeStart - wpTime) > 0.01) {
      updateCameraWaypoint(project, layout, wpTime, { time: patch.timeStart, ripple: false })
      wpTime = patch.timeStart
    }
    const desiredDur =
      typeof patch.camStepDuration === 'number'
        ? patch.camStepDuration
        : typeof params.timeEnd === 'number' && typeof params.timeStart === 'number'
          ? Math.max(0.2, Number((params.timeEnd - params.timeStart).toFixed(2)))
          : undefined
    if (desiredDur !== undefined) {
      updateWaypointStepDuration(project, layout, wpIdx, { stepDuration: desiredDur })
    }
  }
}

/**
 * Thêm một cảnh con / mốc lộ trình quay mới vào đúng Cảnh `shotId` (hoặc chèn ngay sau `fromWaypointTime`).
 */
export function spawnWorkflowV2CameraWaypoint(
  project: Project,
  shotId: string,
  mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold' = 'zoom-in',
  fromWaypointTime?: number
): { nextTime: number; displayLabel: string; shotName: string; isSubWaypoint: boolean } | null {
  const layout = computeShotStageLayout(project, 0)
  const targetBox = layout.find((b) => b.shotId === shotId)
  const res = spawnNextCameraWaypoint(project, layout, {
    mode: targetBox ? mode : 'shot',
    activeTime: fromWaypointTime ?? 0,
    selectedShotId: shotId,
    targetShot: targetBox,
    fromWaypointTime,
    stepSec: 2.0
  })
  if (!res) return null
  return {
    nextTime: res.nextTime,
    displayLabel: res.displayLabel,
    shotName: res.shotName,
    isSubWaypoint: res.isSubWaypoint
  }
}

