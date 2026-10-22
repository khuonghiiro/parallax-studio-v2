import { getWorkflowNodePorts } from '../../project/workflowNodePorts'
import React, { useState } from 'react'
import type { WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'

type Props = {
  node: WorkflowNode; workflow: WorkflowGraph
  onConnectPorts?: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge?: (id: string) => void
}
export function WorkflowNodeConnections({ node, workflow, onConnectPorts, onDisconnectEdge }: Props) {
  const [direction, setDirection] = useState<'inputs' | 'outputs'>('inputs')
  const [query, setQuery] = useState('')
  const incoming = direction === 'inputs'
  const ports = getWorkflowNodePorts(node)[direction]
  const wired = workflow.edges.filter((edge) => incoming ? edge.toNode === node.id : edge.fromNode === node.id)
  return <div className="wf-subtab-pane wf-node-connections" data-mcp-region="workflow_node_connections">
    <div className="wf-port-direction" role="group" aria-label="Chiều kết nối">
      <button type="button" className={`wf-preset-pill${incoming ? ' active' : ''}`} aria-pressed={incoming} onClick={() => setDirection('inputs')}>↘ Đầu vào</button>
      <button type="button" className={`wf-preset-pill${!incoming ? ' active' : ''}`} aria-pressed={!incoming} onClick={() => setDirection('outputs')}>↗ Đầu ra</button>
    </div>
    <p className="wf-node-data-note">Dữ liệu đi từ cổng ra node nguồn đến cổng vào node đích. Dây nối được lưu khi bấm Áp dụng.</p>
    {!!wired.length && <div className="wf-field-group"><strong className="wf-field-label">Đang nối ({wired.length})</strong>
      {wired.map((edge) => <button type="button" className="wf-target-chip wired" key={edge.id} disabled={!onDisconnectEdge}
        title="Ngắt kết nối trong bản nháp" onClick={() => onDisconnectEdge?.(edge.id)}>
        {workflow.nodes.find((item) => item.id === (incoming ? edge.fromNode : edge.toNode))?.title}
        {' · '}{WORKFLOW_PORT_SPECS[incoming ? edge.fromPort : edge.toPort]?.shortLabel} · ✕ Ngắt
      </button>)}
    </div>}
    <label className="wf-field-group"><span className="wf-field-label">Tìm node {incoming ? 'nguồn' : 'đích'}</span>
      <input type="search" value={query} placeholder="Tên node…" onChange={(event) => setQuery(event.target.value)} />
    </label>
    {!ports.length && <p className="wf-field-label">Node này không có cổng {incoming ? 'đầu vào' : 'đầu ra'}.</p>}
    {ports.map((port) => {
      const targets = workflow.nodes.filter((target) => target.id !== node.id && target.enabled && target.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).flatMap((target) =>
        getWorkflowNodePorts(target)[incoming ? 'outputs' : 'inputs'].filter((input) => (incoming
          ? validateWorkflowConnection(target, input, node, port) : validateWorkflowConnection(node, port, target, input)).valid)
          .map((input) => ({ target, input })))
      return <div className="wf-field-group" key={port}>
        <strong className="wf-field-label">{WORKFLOW_PORT_SPECS[port].shortLabel}</strong>
        <div className="wf-port-target-chips">{targets.map(({ target, input }) => {
          const [from, output, to, targetPort] = incoming ? [target.id, input, node.id, port] as const : [node.id, port, target.id, input] as const
          const edge = wired.find((e) => e.fromNode === from && e.fromPort === output && e.toNode === to && e.toPort === targetPort)
          return <button key={`${target.id}:${input}`} type="button" className={`wf-target-chip${edge ? ' wired' : ''}`} aria-pressed={!!edge}
            disabled={edge ? !onDisconnectEdge : !onConnectPorts}
            onClick={() => edge ? onDisconnectEdge?.(edge.id) : onConnectPorts?.(from, output, to, targetPort)}>
            {edge ? '●' : '○'} {target.title} · {WORKFLOW_PORT_SPECS[input].shortLabel}
          </button>
        })}</div>
        {!targets.length && <span className="wf-field-label">Chưa có cổng đích phù hợp.</span>}
      </div>
    })}
  </div>
}
