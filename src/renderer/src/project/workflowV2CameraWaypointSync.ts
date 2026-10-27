import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import {
  applyWaypointActionMode,
  spawnNextCameraWaypoint,
  updateCameraWaypoint,
  updateWaypointStepDuration,
  type CameraActionMode
} from '../ui/viewer/animateCamera/animateCameraRouteLogic'

/**
 * Đồng bộ thay đổi trên một Node con lộ trình quay (`isCameraWaypoint`) xuống dữ liệu keyframe thật của `project.camera`.
 */
export function syncCameraWaypointNodeToProject(
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
    (candidate && (!params.shotId || candidate.shotId === params.shotId || Math.abs(candidate.time - nodeTime) <= 0.1)
      ? candidate
      : undefined) ?? frames.find((f) => Math.abs(f.time - nodeTime) <= 0.05)
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
