import type { WorkflowNodeParams } from '@shared/types'

/** Explicit tab selection wins over saved settings from the other motion tabs. */
export function resolveMotionMode(params: WorkflowNodeParams): 'bbox' | 'path' | 'cycle' {
  if (params.motionMode) return params.motionMode
  if (params.actionPreset === 'bbox_target') return 'bbox'
  if (params.actionPreset === 'custom_draw') return 'path'
  if (params.actionPreset) return 'cycle'
  return (params.customMotionPath?.length ?? 0) >= 2 ? 'path' : 'cycle'
}
