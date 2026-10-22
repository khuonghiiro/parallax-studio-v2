import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'
export function getWorkflowNodePorts(node: WorkflowNode): { inputs: WorkflowPortKind[]; outputs: WorkflowPortKind[] } {
  if (node.type === 'layer_assembly' && !node.params?.logicId && node.params?.targetLayerIds?.length) {
    return { inputs: ['layers_tree', 'motion_stream', 'vfx_stage', 'audio_mix'], outputs: ['transform_link', 'actors_rig'] }
  }
  return WORKFLOW_NODE_SPECS[node.type]
}
