import React, { useState } from 'react'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import type { ResolvedNodeBinding } from '../../project/workflowTargets'

type Props = { node: WorkflowNode; binding: ResolvedNodeBinding; fixed: boolean
  onUpdateNodeParams: (id: string, patch: Partial<WorkflowNodeParams>) => void }

export function WorkflowNodeScope({ node, binding, fixed, onUpdateNodeParams }: Props) {
  const [query, setQuery] = useState('')
  const names = binding.boundTargets.filter((target) => target.kind !== 'shot').map((target) => target.name)
  const update = (patch: Partial<WorkflowNodeParams>) => onUpdateNodeParams(node.id, patch)
  const toggle = (id: string) => {
    const ids = node.params?.targetMode === 'custom' ? node.params.targetLayerIds ?? []
      : binding.boundTargets.filter((target) => binding.allBindableTargets.some((item) => item.id === target.id)).map((target) => target.id)
    update({ targetMode: 'custom', targetLayerIds: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] })
  }
  return <section className="wf-node-input-panel wf-node-scope" data-mcp-region="workflow_node_input">
    <div className="wf-scope-heading"><strong>Phạm vi toàn node</strong><span>{names.length} đối tượng</span></div>
    <p className="wf-scope-names" title={names.join(', ')}>{names.join(', ') || 'Chưa có đối tượng được gán'}</p>
    {!fixed && <details className="wf-scope-picker" data-mcp-region="workflow_node_scope_picker">
      <summary>Đổi đối tượng <span>{node.params?.targetMode === 'custom' ? 'Chọn thủ công' : 'Theo dây nối'}</span></summary>
      <div className="wf-scope-picker-body">
        <div className="wf-port-direction">
          <button type="button" className={`wf-preset-pill${node.params?.targetMode !== 'custom' ? ' active' : ''}`}
            onClick={() => update({ targetMode: 'auto', targetLayerIds: [] })}>Theo dây nối</button>
          <button type="button" className={`wf-preset-pill${node.params?.targetMode === 'custom' ? ' active' : ''}`}
            onClick={() => update({ targetMode: 'custom', targetLayerIds: binding.boundTargets.map((target) => target.id) })}>Chọn thủ công</button>
        </div>
        <input type="search" aria-label="Tìm đối tượng trong node" placeholder="Tìm layer…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="wf-scope-target-list">{binding.allBindableTargets.filter((target) => target.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((target) => {
          const selected = binding.boundTargets.some((item) => item.id === target.id)
          return <button type="button" key={target.id} className={`wf-target-chip${selected ? ' wired' : ''}`} aria-pressed={selected} onClick={() => toggle(target.id)}>
            {selected ? '✓' : '○'} {target.name}
          </button>
        })}</div>
      </div>
    </details>}
  </section>
}
