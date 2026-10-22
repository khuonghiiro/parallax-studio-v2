import React, { useMemo, useRef, useState } from 'react'
import type { Project, WorkflowGraph } from '@shared/types'
import { WorkflowNodeConfigDialog, type WorkflowNodeConfigDialogProps } from './WorkflowNodeConfigDialog'
import { evaluateNodeDraft, initializeNodeDraft, patchNodeDraft } from '../../project/workflowNodeDraft'
import { connectWorkflowPort, disconnectWorkflowEdge, getDefaultPartsForNode } from '../../project/workflowEngine'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { useEditor } from '../../store/editor'
import { useWorkflowNodePreview } from './useWorkflowNodePreview'

type Props = WorkflowNodeConfigDialogProps & { project: Project }
export function WorkflowNodeDraftDialog(props: Props) {
  const base = useRef(props.project).current
  const previous = useRef(props.project.workflow?.nodes.find((n) => n.id === props.node.id) ?? props.node).current
  const [node, setNode] = useState(() => initializeNodeDraft(previous, base))
  const [graph, setGraph] = useState(props.workflow)
  const [error, setError] = useState('')
  const workflow = useMemo(() => ({ ...graph, nodes: graph.nodes.map((n) => n.id === node.id ? node : n) }), [graph, node])
  const previewState = useWorkflowNodePreview(base, workflow, node, previous)
  const apply = () => {
    try {
      const state = useEditor.getState()
      const current = state.project.workflow ?? props.workflow
      const nextGraph: WorkflowGraph = { ...current, nodes: current.nodes.map((n) => n.id === node.id ? node
        : workflow.nodes.find((item) => item.id === n.id)?.params?.requireLayerConnection
          ? { ...n, params: { ...n.params, requireLayerConnection: true } } : n),
        edges: [...current.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id),
          ...workflow.edges.filter((e) => e.fromNode === node.id || e.toNode === node.id)] }
      const next = state.project === base && previewState.readyKey === previewState.key && !previewState.error
        ? { ...previewState.preview, workflow: { ...nextGraph, lastAppliedAt: new Date().toISOString() } }
        : evaluateNodeDraft(state.project, nextGraph, node, previous)
      state.update((draft) => { Object.assign(draft, next) })
      props.onClose()
    } catch (cause) { setError(`Chưa áp dụng: ${String(cause)}`) }
  }
  return <WorkflowNodeConfigDialog {...props} node={node} workflow={workflow} project={base}
    previewProject={previewState.preview} previewPending={previewState.pending} draftError={error || previewState.error} onApply={apply}
    automaticPreview={previewState.automatic} onToggleAutomaticPreview={() => previewState.setAutomatic((value) => !value)}
    onRefreshPreview={previewState.refresh}
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
    onDisconnectEdge={(id) => {
      const next = disconnectWorkflowEdge(workflow, { edgeId: id })
      setGraph(next)
      if (next.nodes.find((item) => item.id === node.id)?.params?.requireLayerConnection) {
        setNode((current) => patchNodeDraft(current, { requireLayerConnection: true }))
      }
    }}
  />
}
