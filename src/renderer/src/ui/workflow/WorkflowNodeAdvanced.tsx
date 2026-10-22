import React, { useState } from 'react'
import type { WorkflowNodeConfigDialogProps } from './WorkflowNodeConfigDialog'
import type { ResolvedNodeBinding } from '../../project/workflowTargets'
import { WorkflowActionBuilder } from './WorkflowActionBuilder'
import { WorkflowNodeConnections } from './WorkflowNodeConnections'

type Props = Pick<WorkflowNodeConfigDialogProps, 'node' | 'workflow' | 'onConnectPorts' | 'onDisconnectEdge' | 'onUpdateNodeParams' | 'onShowToast' | 'activeShotLabel' | 'onUpdateNodeDirective'>
  & { binding: ResolvedNodeBinding; canAddActions: boolean }

export function WorkflowNodeAdvanced(props: Props) {
  const { node, binding } = props
  const [connectionsMounted, setConnectionsMounted] = useState(false)
  const [builderMounted, setBuilderMounted] = useState(false)
  const parts = new Set(binding.activeParts.map((part) => part.id))
  return <div className="wf-node-advanced" data-mcp-region="workflow_node_advanced">
    {props.canAddActions && <details onToggle={(event) => { if (event.currentTarget.open) setBuilderMounted(true) }}>
      <summary>＋ Thêm thao tác vào node</summary>
      {builderMounted && <WorkflowActionBuilder draftMode hideRuleList node={node} bindableTargets={binding.boundTargets}
        activeShotLabel={props.activeShotLabel} onUpdateNodeParams={props.onUpdateNodeParams} onShowToast={props.onShowToast} />}
    </details>}
    <details onToggle={(event) => { if (event.currentTarget.open) setConnectionsMounted(true) }}>
      <summary>⇄ Dây nối <span>{props.workflow.edges.filter((edge) => edge.fromNode === node.id || edge.toNode === node.id).length} kết nối</span></summary>
      {connectionsMounted && <WorkflowNodeConnections {...props} />}
    </details>
    {!node.params?.logicId && !!binding.subParts.length && <details>
      <summary>⚙ Kênh tác động nâng cao <span>{parts.size} đang bật</span></summary>
      <div className="wf-part-chips-wrap">{binding.subParts.map((part) => <button type="button" key={part.id}
        className={`wf-part-chip${parts.has(part.id) ? ' active' : ''}`} aria-pressed={parts.has(part.id)}
        onClick={() => props.onUpdateNodeParams(node.id, { targetParts: parts.has(part.id)
          ? [...parts].filter((id) => id !== part.id) : [...parts, part.id] })}>{part.icon} {part.shortLabel}</button>)}</div>
    </details>}
    <details><summary>✎ Ghi chú</summary>
      <textarea className="wf-textarea" rows={3} aria-label="Ghi chú cho node" value={node.aiDirective}
        onChange={(event) => props.onUpdateNodeDirective(node.id, event.target.value)} />
      <p className="wf-node-data-note">Ghi chú không thay đổi hiệu ứng hoặc tính lại hình xem thử.</p>
    </details>
  </div>
}
