import React from 'react'
import type { WorkflowBoundTarget, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { editableNodeRules } from './workflowNodeEditing'
import { WorkflowNumberField } from './WorkflowNumberField'

type Props = { node: WorkflowNode; onUpdateNodeParams: (id: string, patch: Partial<WorkflowNodeParams>) => void
  selectedRuleId?: string; targets?: WorkflowBoundTarget[] }

export function WorkflowNodeOperationFields({ node, onUpdateNodeParams, selectedRuleId, targets = [] }: Props) {
  const p = node.params ?? {}
  const update = (patch: Partial<WorkflowNodeParams>) => onUpdateNodeParams(node.id, patch)
  const numberField = (label: string, key: keyof WorkflowNodeParams, value: number, min: number, max: number, step: number) =>
    <WorkflowNumberField key={key} label={label} min={min} max={max} step={step} value={Number(p[key] ?? value)} onChange={(next) => update({ [key]: next })} />
  const rules = editableNodeRules(node)
  const selected = rules.find((rule) => rule.id === selectedRuleId) ?? rules[0]
  return <div className="wf-operation-fields" data-mcp-region="workflow_node_operation">
    {selected && [selected].map((rule) => <fieldset className="wf-operation-rule" key={rule.id}>
      <legend>{rule.label}</legend>
      <label className="wf-check-pill"><input type="checkbox" checked={rule.enabled} onChange={(event) => update({
        customRules: p.customRules!.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item)
      })} />Áp dụng thao tác này</label>
      {(['speed', 'amount'] as const).map((key) => <WorkflowNumberField key={key} label={key === 'speed' ? 'Tốc độ' : 'Biên độ / Độ mạnh'}
        min={0.1} max={key === 'speed' ? 100 : 5} step={0.05} value={rule[key] ?? 1} onChange={(value) => update({
          customRules: p.customRules!.map((item) => item.id === rule.id ? { ...item, [key]: value } : item) })} />)}
      {!node.params?.logicId && <>
        <span className="wf-field-label">Đối tượng của thao tác này</span>
        <div className="wf-part-chips-wrap">{[{ id: 'all', name: 'Trong phạm vi node' }, ...targets].map((target) => <button type="button" key={target.id}
          className={`wf-part-chip${rule.targetId === target.id ? ' active' : ''}`} aria-pressed={rule.targetId === target.id}
          onClick={() => update({ customRules: p.customRules!.map((item) => item.id === rule.id ? { ...item, targetId: target.id, targetName: target.name } : item) })}>{target.name}</button>)}</div>
        <button type="button" className="btn ghost sm" onClick={() => update({ customRules: p.customRules!.filter((item) => item.id !== rule.id) })}>Xóa thao tác này</button>
      </>}
    </fieldset>)}
    {(node.type === 'motion_choreography' || (node.type === 'camera_director' && !['logic-cam-dof', 'logic-cam-shake'].includes(p.logicId ?? ''))) &&
      numberField('Thời lượng (giây)', 'duration', 6, 0.1, 600, 0.1)}
    {node.type === 'camera_director' && (!p.logicId || p.logicId === 'logic-cam-dof') && <>
      {numberField('Khoảng lấy nét', 'camFocusDistance', 1200, 10, 50000, 10)}
      {numberField('Khẩu độ DOF', 'camAperture', 0.028, 0.005, 0.1, 0.001)}
    </>}
    {node.type === 'camera_director' && (!p.logicId || p.logicId === 'logic-cam-shake') && <>
      {numberField('Biên độ rung', 'camShakeAmount', 6, 0, 20, 0.5)}
      {numberField('Tốc độ rung (Hz)', 'camShakeSpeed', 1.2, 0.2, 3, 0.1)}
    </>}
  </div>
}
