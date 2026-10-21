import React from 'react'
import type { WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS, WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'

type Props = {
  node: WorkflowNode; workflow: WorkflowGraph
  onConnectPorts?: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge?: (id: string) => void
}
export function WorkflowNodeConnections({ node, workflow, onConnectPorts, onDisconnectEdge }: Props) {
  const outputs = WORKFLOW_NODE_SPECS[node.type].outputs
  return <div className="wf-subtab-pane">
    <p className="wf-field-label">Chọn cổng đích để nối hoặc ngắt. Chỉ hiển thị các kết nối tương thích.</p>
    {outputs.length === 0 && <p className="wf-field-label">Node này không có cổng đầu ra.</p>}
    {outputs.map((port) => {
      const targets = workflow.nodes.filter((target) => target.id !== node.id).flatMap((target) =>
        WORKFLOW_NODE_SPECS[target.type].inputs.filter((input) => validateWorkflowConnection(node, port, target, input).valid)
          .map((input) => ({ target, input })))
      return <div className="wf-field-group" key={port}>
        <strong className="wf-field-label">{WORKFLOW_PORT_SPECS[port].shortLabel}</strong>
        <div className="wf-port-target-chips">{targets.map(({ target, input }) => {
          const edge = workflow.edges.find((e) => e.fromNode === node.id && e.fromPort === port && e.toNode === target.id && e.toPort === input)
          return <button key={`${target.id}:${input}`} type="button" className={`wf-target-chip${edge ? ' wired' : ''}`} aria-pressed={!!edge}
            onClick={() => edge ? onDisconnectEdge?.(edge.id) : onConnectPorts?.(node.id, port, target.id, input)}>
            {edge ? '●' : '○'} {target.title} · {WORKFLOW_PORT_SPECS[input].shortLabel}
          </button>
        })}</div>
        {!targets.length && <span className="wf-field-label">Chưa có cổng đích phù hợp.</span>}
      </div>
    })}
  </div>
}
