import type { Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  createTimeGroup,
  linkToTimeGroup,
  listTimeGroups,
  resolveTimeTargets,
  setTimeGroupRange,
  shiftTimeGroup,
  unlinkFromTimeGroup,
  updateTimeGroupMeta
} from '../../project/workflowTimeGroups'
import { ensureProjectWorkflow } from '../../project/workflowEngine'
import { num, str } from '../params'
import { ParamError, type Handler } from '../types'

const ed = () => useEditor.getState()
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : [])

const ACTIONS = ['list', 'create', 'link', 'unlink', 'set_range', 'shift', 'rename'] as const
type TimeGroupAction = (typeof ACTIONS)[number]

/** Ghi thao tác vào Project qua `update()` (một bước Undo, hiển thị realtime trên Workflow ⇄ Timeline) */
function mutate<T>(fn: (draft: Project) => T): T {
  let out: T | undefined
  ed().update((d) => {
    if (!d.workflow) d.workflow = structuredClone(ensureProjectWorkflow(ed().project))
    out = fn(d as Project)
  })
  return out as T
}

function requireTimeId(p: Record<string, unknown>): string {
  const id = str(p, 'time_node_id')
  if (!id) throw new ParamError('time_node_id is required for this action')
  return id
}

/**
 * MCP `time_group`: quản lý nhóm Time chung (Node Time) — cùng logic với làn "Thời gian chung" trên Workflow,
 * thanh chọn nhiều, Inspector và nút "Gom Time" trên Timeline.
 */
export const timeGroupCommands: Record<string, Handler> = {
  time_group: (p) => {
    const action = (str(p, 'action') ?? 'list').replace('-', '_') as TimeGroupAction
    if (!ACTIONS.includes(action)) throw new ParamError(`Unknown action "${action}". Use: ${ACTIONS.join(', ')}`)
    const nodeIds = ids(p.node_ids)
    const layerIds = ids(p.layer_ids)
    if (layerIds.some((id) => !ed().project.layers.some((l) => l.id === id))) throw new ParamError('Unknown layer ID in layer_ids')
    let timeNodeId: string | undefined
    let affected = 0
    try {
      if (action === 'create') {
        timeNodeId = mutate((d) => createTimeGroup(d, resolveTimeTargets(d, nodeIds, layerIds), {
          start: num(p, 'start'), end: num(p, 'end'), title: str(p, 'title'), color: str(p, 'color')
        }).id)
      } else if (action === 'link') {
        timeNodeId = requireTimeId(p)
        affected = mutate((d) => linkToTimeGroup(d, timeNodeId!, resolveTimeTargets(d, nodeIds, layerIds)))
      } else if (action === 'unlink') {
        const targets = [...nodeIds, ...layerIds.map((id) => `v2-layer-${id}`)]
        if (!targets.length) throw new ParamError('node_ids or layer_ids is required for unlink')
        affected = mutate((d) => unlinkFromTimeGroup(d, targets))
      } else if (action === 'set_range') {
        timeNodeId = requireTimeId(p)
        mutate((d) => setTimeGroupRange(d, timeNodeId!, num(p, 'start', true)!, num(p, 'end', true)!))
      } else if (action === 'shift') {
        timeNodeId = requireTimeId(p)
        mutate((d) => shiftTimeGroup(d, timeNodeId!, num(p, 'delta', true)!))
      } else if (action === 'rename') {
        timeNodeId = requireTimeId(p)
        mutate((d) => updateTimeGroupMeta(d, timeNodeId!, { title: str(p, 'title'), color: str(p, 'color') }))
      }
    } catch (error) {
      if (error instanceof ParamError) throw error
      throw new ParamError(error instanceof Error ? error.message : String(error))
    }
    return { ok: true, action, time_node_id: timeNodeId, affected, groups: listTimeGroups(ed().project) }
  }
}
