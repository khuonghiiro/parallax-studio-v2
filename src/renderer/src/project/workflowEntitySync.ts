import type {
  Layer,
  Project,
  WorkflowExecutionStageResult,
  WorkflowGraph,
  WorkflowNode
} from '@shared/types'
import { buildCameraPath, type PathStep } from '../animation/cameraPath'
import { applyCameraPreset } from '../animation/presets'
import { shotLocalToWorld } from '../engine/evaluateScene'
import { isMouthLayer } from './lipSync'

/**
 * Đồng bộ trạng thái Bật/Tắt (ON/OFF) và kết nối dây của các Node Cảnh (`scene_shot`)
 * và Node Layer con (`layer_assembly` gắn với layer cụ thể) sang thuộc tính `visible`
 * thực tế của Shot và Layer trên Bàn dựng 2D / Camera / 3D tự do.
 */
export function syncWorkflowEntityVisibility(
  project: Project,
  workflow: WorkflowGraph,
  activeNodeIds: Set<string>
): void {
  // 1. Đồng bộ hiển thị cấp độ Phân cảnh (scene_shot)
  for (const node of workflow.nodes) {
    if (node.type !== 'scene_shot') continue
    const shotId = node.params?.shotId
    if (!shotId) continue
    const shot = project.shots.find((s) => s.id === shotId)
    if (shot) {
      shot.visible = Boolean(node.enabled)
    }
  }

  // 2. Đồng bộ hiển thị cấp độ từng Node Layer con (layer_assembly có targetLayerIds riêng)
  for (const node of workflow.nodes) {
    if (node.type !== 'layer_assembly' || node.params?.logicId) continue
    const targetIds = node.params?.targetLayerIds
    if (!targetIds || targetIds.length === 0) continue
    // Chỉ áp dụng cho các node đại diện cho Layer con cụ thể (hoặc cụm Composite 2.5D)
    const isSpecificLayerNode =
      node.id.startsWith('wf-layer-') ||
      (node.params?.targetMode === 'custom' && targetIds.length <= 12)
    if (!isSpecificLayerNode) continue

    const isVisible = Boolean(node.enabled) && activeNodeIds.has(node.id)
    const idSet = new Set(targetIds)

    for (const layer of project.layers) {
      if (idSet.has(layer.id) || (layer.parentId && idSet.has(layer.parentId))) {
        layer.visible = isVisible
      }
    }
  }
}

export function executeCameraDirectorStage(
  project: Project,
  node: WorkflowNode,
  activeNodes: WorkflowNode[],
  activePartIds: Set<string>,
  partNamesSummary: string,
  intensity: number,
  targetShotFilter: string | null,
  workflow?: WorkflowGraph
): WorkflowExecutionStageResult {
  const logicId = node.params?.logicId ?? ''

  // 1. Tìm Layer được nối dây trực tiếp vào Node Camera này (nếu có)
  let targetLayer: Layer | undefined
  if (workflow) {
    const edges = workflow.edges.filter(
      (e) => (e.fromNode === node.id || e.toNode === node.id)
    )
    for (const e of edges) {
      const otherId = e.fromNode === node.id ? e.toNode : e.fromNode
      const otherNode = workflow.nodes.find((n) => n.id === otherId)
      if (otherNode?.type === 'layer_assembly' && otherNode.params?.targetLayerIds?.length) {
        targetLayer = project.layers.find((l) => otherNode.params!.targetLayerIds!.includes(l.id))
        if (targetLayer) break
      }
    }
  }
  if (!targetLayer && node.params?.camTargetLayerId) {
    targetLayer = project.layers.find((l) => l.id === node.params?.camTargetLayerId)
  }

  // 2. Tìm Phân cảnh (Shot) được nối dây vào Node Camera này (nếu có)
  const connectedShotIds: string[] = []
  if (workflow) {
    const edges = workflow.edges.filter(
      (e) => (e.fromNode === node.id || e.toNode === node.id)
    )
    for (const e of edges) {
      const otherId = e.fromNode === node.id ? e.toNode : e.fromNode
      const otherNode = workflow.nodes.find((n) => n.id === otherId)
      if (otherNode?.type === 'scene_shot' && otherNode.params?.shotId) {
        connectedShotIds.push(otherNode.params.shotId)
      }
    }
  }

  // -------------------------------------------------------------------------
  // KHỐI CHUYÊN BIỆT A: NODE XÓA PHÔNG DOF (Optical Focus Modifier)
  // Không ghi đè hay xóa bỏ keyframes lộ trình camera hiện có
  // -------------------------------------------------------------------------
  if (logicId === 'logic-cam-dof') {
    project.camera.dofEnabled = true
    if (targetLayer) {
      const camZ = Array.isArray(project.camera.position.value) ? project.camera.position.value[2] : 1200
      const layerZ = targetLayer.transform.position.value[2] ?? 0
      project.camera.focusDistance.value = Math.max(10, Math.round(Math.abs(camZ - layerZ)))
    } else if (node.params?.camFocusDistance !== undefined) {
      project.camera.focusDistance.value = node.params.camFocusDistance
    } else {
      project.camera.focusDistance.value = 1200
    }
    project.camera.aperture.value = Number(((node.params?.camAperture ?? 0.028) * intensity).toFixed(3))

    return {
      nodeId: node.id,
      nodeType: node.type,
      title: node.title,
      aiAgentRole: node.aiAgentRole,
      preset: node.preset,
      appliedSummary: targetLayer
        ? `Xóa phông DOF khóa tiêu cự vào layer "${targetLayer.name}" (Khoảng cách: ${project.camera.focusDistance.value}px).`
        : `Bật xóa phông DOF tiêu cự cho Camera 3D (Khẩu độ: ${project.camera.aperture.value}).`,
      affectedCount: 1
    }
  }

  // -------------------------------------------------------------------------
  // KHỐI CHUYÊN BIỆT B: NODE RUNG LẮC CẦM TAY (Handheld Shake Modifier)
  // Không ghi đè hay xóa bỏ keyframes lộ trình camera hiện có
  // -------------------------------------------------------------------------
  if (logicId === 'logic-cam-shake') {
    const baseShake = node.params?.camShakeAmount ?? (activePartIds.has('handheld_rig') ? 6 : 5)
    const baseSpeed = node.params?.camShakeSpeed ?? 1.2
    project.camera.shakeAmount = Math.max(1, Math.round(baseShake * intensity))
    project.camera.shakeSpeed = Number((baseSpeed * intensity).toFixed(2))

    return {
      nodeId: node.id,
      nodeType: node.type,
      title: node.title,
      aiAgentRole: node.aiAgentRole,
      preset: node.preset,
      appliedSummary: `Rung máy quay cầm tay Handheld (Độ rung: ${project.camera.shakeAmount}, Tốc độ: ${project.camera.shakeSpeed}Hz).`,
      affectedCount: 1
    }
  }

  // -------------------------------------------------------------------------
  // KHỐI CHUYÊN BIỆT C: LỘ TRÌNH ĐƯỜNG BAY CAMERA (Trajectory & Presets)
  // (Dolly In, Orbit 3D, Pan Lia Máy, Fly Xuyên Cảnh)
  // -------------------------------------------------------------------------
  const cameraShots = connectedShotIds.length > 0
    ? project.shots.filter((s) => connectedShotIds.includes(s.id))
    : project.shots
  const targetShot =
    (targetShotFilter ? project.shots.find((s) => s.id === targetShotFilter) : null) ??
    cameraShots[0] ??
    project.shots[0] ??
    null

  if (targetLayer) {
    const layerPos = targetLayer.transform.position.value
    project.camera.target.value = [layerPos[0], layerPos[1], layerPos[2]]
  }

  let camPreset: 'dollyIn' | 'orbitRight' | 'truckRight' | 'dollyZoom' | 'fly' = 'dollyIn'
  if (logicId === 'logic-cam-orbit' || node.preset === 'orbit_showcase_3d') {
    camPreset = 'orbitRight'
  } else if (logicId === 'logic-cam-pan') {
    camPreset = 'truckRight'
  } else if (node.preset === 'dramatic_handheld_action') {
    camPreset = 'dollyZoom'
  } else {
    camPreset = 'dollyIn'
  }

  if (cameraShots.length > 1 && !targetLayer) {
    const totalDur = Math.max(4, project.comp.duration || 10)
    const transDur = Number(
      Math.max(1.0, Math.min(2.2, (totalDur / cameraShots.length) * 0.34)).toFixed(1)
    )
    const holdPerShot = Number(
      Math.max(
        1.5,
        (totalDur - transDur * (cameraShots.length - 1)) / cameraShots.length
      ).toFixed(1)
    )
    const stepMotion = camPreset === 'orbitRight' ? 'orbit-right' : camPreset === 'truckRight' ? 'pan-right' : 'push'
    const stepTrans = camPreset === 'orbitRight' ? 'arc' : 'fly'
    const pushAmount =
      node.preset === 'dolly_push_focus' || logicId === 'logic-cam-dolly'
        ? 0.32 * intensity
        : node.preset === 'orbit_showcase_3d' || logicId === 'logic-cam-orbit'
          ? 0.12 * intensity
          : 0.18 * intensity

    const steps: PathStep[] = cameraShots.map((s) => ({
      shotId: s.id,
      hold: holdPerShot,
      type: stepTrans,
      transition: transDur,
      motion: stepMotion
    }))
    buildCameraPath(project, steps, {
      pushIn: Number(Math.min(0.45, pushAmount).toFixed(2)),
      startAt: 0
    })
  } else {
    const toWorldFn = targetLayer
      ? () => targetLayer!.transform.position.value
      : shotLocalToWorld(targetShot, 0)
    applyCameraPreset(
      project.camera,
      camPreset === 'fly' ? 'dollyIn' : camPreset,
      project.comp,
      0,
      project.comp.duration,
      intensity,
      toWorldFn
    )
  }

  // Đồng bộ trạng thái DOF & Shake trên toàn thể active nodes
  const activeCamNodes = activeNodes.filter((n) => n.type === 'camera_director')
  project.camera.dofEnabled = activeCamNodes.some(
    (n) => n.params?.enableDof === true || n.params?.logicId === 'logic-cam-dof'
  )
  const hasShake = activeCamNodes.some(
    (n) =>
      n.params?.logicId === 'logic-cam-shake' ||
      n.preset === 'dramatic_handheld_action' ||
      (n.params?.targetParts ?? []).includes('handheld_rig')
  )
  if (!hasShake) {
    project.camera.shakeAmount = 0
  } else if (project.camera.shakeAmount === 0) {
    project.camera.shakeAmount = Math.max(1, Math.round(1.5 * intensity))
    project.camera.shakeSpeed = 0.8
  }

  const targetDesc = targetLayer
    ? `khóa vào Layer "${targetLayer.name}"`
    : `áp dụng cho ${cameraShots.length} Phân cảnh`

  return {
    nodeId: node.id,
    nodeType: node.type,
    title: node.title,
    aiAgentRole: node.aiAgentRole,
    preset: node.preset,
    appliedSummary: `Tạo lộ trình Camera 3D (${camPreset}) · ${targetDesc} · Bộ phận: ${partNamesSummary}.`,
    affectedCount: Math.max(1, cameraShots.length)
  }
}

export function executeAudioLipSyncStage(
  project: Project,
  node: WorkflowNode,
  activePartIds: Set<string>,
  partNamesSummary: string,
  intensity: number,
  matchesLayer: (l: Layer) => boolean
): WorkflowExecutionStageResult {
  let affected = 0
  const tracks = project.audioTracks ?? []
  const charComposite = project.layers.find((l) => l.composite?.instanceId && matchesLayer(l))
  const mouthLayer = project.layers.find((l) => isMouthLayer(l) && matchesLayer(l))

  for (const tr of tracks) {
    tr.fadeIn = tr.fadeIn || 0.6
    tr.fadeOut = tr.fadeOut || 1.0
    if (
      node.preset === 'voice_lipsync_bgm' ||
      node.params?.autoLipSync ||
      activePartIds.has('mouth_viseme_25d')
    ) {
      tr.tone = tr.characterRole === 'voice' ? 'vocal' : 'warm'
      if (tr.characterRole === 'voice' || tracks.length === 1) {
        tr.lipSyncEnabled = true
        tr.lipSyncIntensity = Number((1.15 * intensity).toFixed(2))
        if (!tr.targetId && charComposite?.composite) {
          tr.targetType = 'character'
          tr.targetId = charComposite.composite.instanceId
          tr.targetName = charComposite.composite.compositeName
        }
        if (!tr.lipSyncLayerId && mouthLayer) {
          tr.lipSyncLayerId = mouthLayer.id
        }
      }
    } else {
      tr.tone = 'warm'
    }
    affected++
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    title: node.title,
    aiAgentRole: node.aiAgentRole,
    preset: node.preset,
    appliedSummary:
      affected > 0
        ? `Cấu hình âm thanh & Lip-Sync (${affected} track) · Bộ phận: ${partNamesSummary}.`
        : `Đã sẵn sàng Lip-Sync (${partNamesSummary}) khi thêm track âm thanh.`,
    affectedCount: affected
  }
}

export function executeLookOutputStage(
  project: Project,
  node: WorkflowNode,
  activePartIds: Set<string>,
  partNamesSummary: string,
  intensity: number
): WorkflowExecutionStageResult {
  const wantFog = activePartIds.has('z_depth_fog') && node.preset !== 'vibrant_anime_clean'
  if (node.preset === 'mystic_night_glow') {
    project.look = {
      ...project.look,
      fogEnabled: wantFog,
      fogColor: '#161936',
      fogNear: 1200,
      fogFar: 5200,
      vignette: Number(Math.min(1, 0.38 * intensity).toFixed(2)),
      grain: 0.06,
      exposure: -0.08,
      contrast: 1.12,
      saturation: 1.08
    }
  } else if (node.preset === 'vibrant_anime_clean') {
    project.look = {
      ...project.look,
      fogEnabled: false,
      vignette: 0.1,
      grain: 0,
      exposure: 0.08,
      contrast: 1.06,
      saturation: Number(Math.min(2, 1.16 * intensity).toFixed(2))
    }
  } else {
    project.look = {
      ...project.look,
      fogEnabled: wantFog,
      fogColor: '#2a2140',
      fogNear: 1400,
      fogFar: 5800,
      vignette: Number(Math.min(1, 0.28 * intensity).toFixed(2)),
      grain: 0.04,
      exposure: 0.02,
      contrast: 1.08,
      saturation: 1.06
    }
  }

  return {
    nodeId: node.id,
    nodeType: node.type,
    title: node.title,
    aiAgentRole: node.aiAgentRole,
    preset: node.preset,
    appliedSummary: `Hoàn thiện màu sắc (${partNamesSummary}) & sẵn sàng xuất bản.`,
    affectedCount: 1
  }
}
