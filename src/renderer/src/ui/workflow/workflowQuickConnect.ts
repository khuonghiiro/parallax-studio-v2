import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'
import { getWorkflowNodePorts } from '../../project/workflowNodePorts'

const normalizeSearch = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export function getQuickConnectItems(
  source: WorkflowNode, port: WorkflowPortKind, isOutput: boolean, query = ''
) {
  const search = normalizeSearch(query.trim())
  return WORKFLOW_LOGIC_NODE_CATALOG.filter((item) => {
    if (item.id === 'logic-scene-spawn-layers' || item.id === 'logic-assembly-child') return false
    const spec = WORKFLOW_NODE_SPECS[item.nodeType]
    const candidate: WorkflowNode = {
      id: `${source.id}-candidate`, type: item.nodeType, title: item.title,
      enabled: true, position: { x: 0, y: 0 }, preset: item.preset,
      aiAgentRole: spec.aiAgentRole, aiDirective: item.description,
      params: { logicId: item.id }
    }
    const candPorts = getWorkflowNodePorts(candidate)
    const compatible = (isOutput ? candPorts.inputs : candPorts.outputs).some((otherPort) =>
      isOutput ? validateWorkflowConnection(source, port, candidate, otherPort).valid
        : validateWorkflowConnection(candidate, otherPort, source, port).valid)
    return compatible && (!search || normalizeSearch(
      `${item.title} ${item.shortLabel} ${item.description} ${item.categoryLabel}`
    ).includes(search))
  })
}
