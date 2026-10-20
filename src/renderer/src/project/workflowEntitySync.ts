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
  targetShotFilter: string | null
): WorkflowExecutionStageResult {
  const cameraShots = project.shots
  const targetShot =
    (targetShotFilter ? project.shots.find((s) => s.id === targetShotFilter) : null) ??
    project.shots[0] ??
    null

  if (cameraShots.length > 1) {
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
    const stepMotion = node.preset === 'orbit_showcase_3d' ? 'orbit-right' : 'push'
    const stepTrans = node.preset === 'orbit_showcase_3d' ? 'arc' : 'fly'
    const pushAmount =
      node.preset === 'dolly_push_focus'
        ? 0.24 * intensity
        : node.preset === 'dramatic_handheld_action'
          ? 0.28 * intensity
          : node.preset === 'orbit_showcase_3d'
            ? 0.12 * intensity
            : 0.16 * intensity

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
    const camPreset =
      node.preset === 'orbit_showcase_3d'
        ? 'orbitRight'
        : node.preset === 'dramatic_handheld_action'
          ? 'dollyZoom'
          : 'dollyIn'
    applyCameraPreset(
      project.camera,
      camPreset,
      project.comp,
      0,
      project.comp.duration,
      intensity,
      shotLocalToWorld(targetShot, 0)
    )
  }

  const activeCamNodes = activeNodes.filter((n) => n.type === 'camera_director')
  project.camera.dofEnabled = activeCamNodes.some(
    (n) => n.params?.enableDof === true || n.params?.logicId === 'logic-cam-dof'
  )
  project.camera.shakeAmount = activePartIds.has('handheld_rig')
    ? node.preset === 'dramatic_handheld_action'
      ? Math.round(6 * intensity)
      : Math.round(1.5 * intensity)
    : Math.round(0.8 * intensity)
  project.camera.shakeSpeed = node.preset === 'dramatic_handheld_action' ? 1.2 : 0.6

  return {
    nodeId: node.id,
    nodeType: node.type,
    title: node.title,
    aiAgentRole: node.aiAgentRole,
    preset: node.preset,
    appliedSummary: `Tạo đường bay Camera 3D · Bộ phận: ${partNamesSummary}.`,
    affectedCount: Math.max(1, project.shots.length)
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
