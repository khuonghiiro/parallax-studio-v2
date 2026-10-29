import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'

export function getWorkflowNodePorts(node: Pick<WorkflowNode, 'type' | 'params'>): { inputs: WorkflowPortKind[]; outputs: WorkflowPortKind[] } {
  if (node.params?.logicCategory === 'collision') return { inputs: ['layers_tree', 'motion_stream', 'vfx_stage', 'time_range'], outputs: ['vfx_stage'] }
  if (node.params?.logicCategory === 'time') return { inputs: [], outputs: ['time_range'] }
  if (node.type === 'layer_assembly' && node.params?.targetLayerIds?.length && !node.params.logicId) {
    return { inputs: ['time_range', 'layers_tree', 'motion_stream', 'vfx_stage', 'audio_mix'], outputs: ['transform_link', 'actors_rig'] }
  }
  if (node.type === 'scene_shot' && Boolean(node.params?.logicId)) {
    return { inputs: ['scene_ctx'], outputs: ['scene_ctx', 'layers_tree'] }
  }
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const baseInputs = [...(spec?.inputs ?? [])]
  if (node.type === 'camera_director' && !baseInputs.includes('camera_cut')) baseInputs.push('camera_cut')
  if (node.type === 'motion_choreography' && !baseInputs.includes('motion_stream')) baseInputs.push('motion_stream')
  if (node.type === 'physics_fx' && !baseInputs.includes('vfx_stage')) baseInputs.push('vfx_stage')
  if (node.type === 'audio_lipsync' && !baseInputs.includes('audio_mix')) baseInputs.push('audio_mix')
  return { inputs: node.type === 'scene_shot' ? baseInputs : [...baseInputs, 'time_range'], outputs: [...(spec?.outputs ?? [])] }
}
