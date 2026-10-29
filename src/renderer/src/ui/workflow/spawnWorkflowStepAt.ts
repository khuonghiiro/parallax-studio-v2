import { useEditor } from '../../store/editor'
import { spawnTimedFollowupNodeV2, syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'

/** Same command as the inspector/MCP follow-up, with a canvas drop position. */
export function spawnWorkflowStepAt(sourceId: string, position: { x: number; y: number }): string | null {
  let created: string | null = null
  useEditor.getState().update(draft => {
    if (!draft.workflow) return
    const next = spawnTimedFollowupNodeV2(draft.workflow, sourceId)
    if (!next) return
    draft.workflow = next.workflow
    const node = draft.workflow.nodes.find(n => n.id === next.createdNodeId)!
    node.position = { x: Math.round(position.x), y: Math.round(position.y) }
    draft.comp.duration = Math.max(draft.comp.duration, node.params?.timeEnd ?? 0)
    syncWorkflowV2NodeToProject(draft, node)
    created = node.id
  })
  return created
}
