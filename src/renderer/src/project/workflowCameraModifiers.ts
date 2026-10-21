import type { Project, WorkflowNode } from '@shared/types'

/** Resolve explicit on/off values before preset defaults, for UI and MCP alike. */
export function syncWorkflowCameraModifiers(project: Project, activeNodes: WorkflowNode[]): void {
  const cameras = activeNodes.filter((node) => node.enabled && node.type === 'camera_director')
  project.camera.dofEnabled = cameras.some((node) => node.params?.enableDof ?? node.params?.logicId === 'logic-cam-dof')
  let amount = 0
  let speed = 0.8
  for (const node of cameras) {
    const params = node.params ?? {}
    const defaultShake = params.logicId === 'logic-cam-shake' || node.preset === 'dramatic_handheld_action'
      || params.targetParts?.includes('handheld_rig')
    const base = params.camShakeAmount ?? (defaultShake ? 6 : 0)
    const intensity = Math.max(0.2, Math.min(2.5, params.intensity ?? 1))
    const candidate = Math.max(0, Math.round(base * intensity))
    if (candidate > amount) {
      amount = candidate
      speed = (params.camShakeSpeed ?? 1.2) * intensity
    }
  }
  project.camera.shakeAmount = amount
  project.camera.shakeSpeed = speed
}
