import { useEditor } from '../../../store/editor'
import { guardWorkflowNodeEvent } from '../../workflow/workflowFocusGuard'

type FocusEvent = { shiftKey: boolean; preventDefault(): void; stopPropagation(): void }
export function focusCameraWaypoint(event: FocusEvent, index: number): boolean {
  const state = useEditor.getState()
  const node = state.project.workflow?.nodes.find(n => n.params?.isCameraWaypoint && n.params.waypointIndex === index)
  if (!node) {
    if (!state.selectedWorkflowNodeId || event.shiftKey) return true
    event.preventDefault()
    event.stopPropagation()
    return false
  }
  if (!guardWorkflowNodeEvent(event, node.id)) return false
  if (state.selectedWorkflowNodeId !== node.id) state.setSelectedWorkflowNodeId(node.id)
  return true
}
