import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph } from '@shared/types'
import { WorkflowNodeConfigDialog, type WorkflowNodeConfigDialogProps } from './WorkflowNodeConfigDialog'
import { evaluateNodeDraft, initializeNodeDraft, patchNodeDraft } from '../../project/workflowNodeDraft'
import { connectWorkflowPort, disconnectWorkflowEdge, getDefaultPartsForNode } from '../../project/workflowEngine'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { useEditor } from '../../store/editor'

type Props = WorkflowNodeConfigDialogProps & { project: Project }
export function WorkflowNodeDraftDialog(props: Props) {
  const base = useRef(props.project).current
  const previous = useRef(props.project.workflow?.nodes.find((n) => n.id === props.node.id) ?? props.node).current
  const [node, setNode] = useState(() => initializeNodeDraft(previous, base))
  const [graph, setGraph] = useState(props.workflow)
  const [preview, setPreview] = useState(base)
  const [readyGraph, setReadyGraph] = useState<WorkflowGraph | null>(null)
  const [error, setError] = useState('')
  const workflow = useMemo(() => ({ ...graph, nodes: graph.nodes.map((n) => n.id === node.id ? node : n) }), [graph, node])
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setPreview(evaluateNodeDraft(base, workflow, node, previous))
        setReadyGraph(workflow); setError('')
      } catch (cause) { setError(`Không thể xem thử: ${String(cause)}`) }
    }, 200)
    return () => clearTimeout(timer)
  }, [base, workflow, node, previous])
  const apply = () => {
    try {
      const state = useEditor.getState()
      const current = state.project.workflow ?? props.workflow
      const nextGraph: WorkflowGraph = { ...current, nodes: current.nodes.map((n) => n.id === node.id ? node : n),
        edges: [...current.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id),
          ...workflow.edges.filter((e) => e.fromNode === node.id || e.toNode === node.id)] }
      const next = evaluateNodeDraft(state.project, nextGraph, node, previous)
      state.update((draft) => { Object.assign(draft, next) })
      props.onClose()
    } catch (cause) { setError(`Chưa áp dụng: ${String(cause)}`) }
  }
  return <WorkflowNodeConfigDialog {...props} node={node} workflow={workflow} project={base}
    previewProject={preview} previewPending={readyGraph !== workflow} draftError={error} onApply={apply}
    onDeleteNode={undefined}
    onToggleNode={() => setNode((n) => ({ ...n, enabled: !n.enabled }))}
    onUpdateNodeParams={(_id, patch) => setNode((n) => patchNodeDraft(n, patch))}
    onUpdateNodeDirective={(_id, aiDirective) => setNode((n) => ({ ...n, aiDirective }))}
    onChangeNodePreset={(_id, preset) => setNode((n) => {
      const spec = WORKFLOW_NODE_SPECS[n.type].presets.find((p) => p.id === preset)
      return { ...n, preset, aiDirective: spec?.defaultDirective ?? n.aiDirective,
        params: { ...n.params, ...spec?.defaultParams, targetParts: getDefaultPartsForNode({ type: n.type, preset }) } }
    })}
    onConnectPorts={(from, output, to, input) => {
      try { setGraph(connectWorkflowPort(workflow, from, output, to, input)) }
      catch (cause) { props.onShowToast(String(cause)) }
    }}
    onDisconnectEdge={(id) => setGraph(disconnectWorkflowEdge(workflow, { edgeId: id }))}
  />
}
