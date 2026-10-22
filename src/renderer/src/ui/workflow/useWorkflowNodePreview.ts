import { useEffect, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { evaluateNodeDraft } from '../../project/workflowNodeDraft'
import { nodePreviewKey } from './workflowNodeEditing'
import { createNodePreviewScheduler } from './nodePreviewScheduler'

export function useWorkflowNodePreview(base: Project, workflow: WorkflowGraph, node: WorkflowNode, previous: WorkflowNode) {
  const [automatic, setAutomatic] = useState(true)
  const [result, setResult] = useState({ key: '', project: base, error: '' })
  const key = nodePreviewKey(workflow)
  const latest = useRef({ workflow, node, key })
  latest.current = { workflow, node, key }
  const scheduler = useRef(createNodePreviewScheduler()).current
  const evaluate = () => {
    const snapshot = latest.current
    try {
      setResult({ key: snapshot.key, project: evaluateNodeDraft(base, snapshot.workflow, snapshot.node, previous), error: '' })
    } catch (cause) { setResult((last) => ({ ...last, key: snapshot.key, error: `Không thể xem thử: ${String(cause)}` })) }
  }
  useEffect(() => {
    if (automatic && result.key !== key) scheduler.schedule(evaluate)
    else scheduler.cancel()
    return scheduler.cancel
  }, [key, automatic, base, previous, scheduler, result.key])
  return { preview: result.project, error: result.error, pending: result.key !== key, automatic,
    setAutomatic, refresh: () => scheduler.schedule(evaluate, true), readyKey: result.key, key }
}
