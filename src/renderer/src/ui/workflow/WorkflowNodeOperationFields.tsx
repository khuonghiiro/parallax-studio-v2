import React from 'react'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'

type Props = { node: WorkflowNode; onUpdateNodeParams: (id: string, patch: Partial<WorkflowNodeParams>) => void }

export function WorkflowNodeOperationFields({ node, onUpdateNodeParams }: Props) {
  const p = node.params ?? {}
  const update = (patch: Partial<WorkflowNodeParams>) => onUpdateNodeParams(node.id, patch)
  const numberField = (label: string, key: keyof WorkflowNodeParams, value: number, min: number, max: number, step: number) =>
    <label className="wf-operation-field" key={key}><span>{label}</span><input type="number" min={min} max={max} step={step}
      value={Number(p[key] ?? value)} onChange={(event) => {
        const next = event.target.valueAsNumber
        if (Number.isFinite(next)) update({ [key]: Math.max(min, Math.min(max, next)) })
      }} /></label>
  return <div className="wf-operation-fields" data-mcp-region="workflow_node_operation">
    {(p.customRules ?? []).map((rule, index) => <fieldset className="wf-operation-rule" key={rule.id}>
      <legend>{rule.label}</legend>
      <label className="wf-check-pill"><input type="checkbox" checked={rule.enabled} onChange={(event) => update({
        customRules: p.customRules!.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item)
      })} />Áp dụng thao tác này</label>
      {(['speed', 'amount'] as const).map((key) => <label className="wf-operation-field" key={key}>
        <span>{key === 'speed' ? 'Tốc độ' : 'Biên độ / Độ mạnh'}</span>
        <input type="number" min={0.1} max={key === 'speed' ? 100 : 5} step={0.05} value={rule[key] ?? 1}
          onChange={(event) => {
            const value = event.target.valueAsNumber
            if (Number.isFinite(value)) update({ customRules: p.customRules!.map((item, i) => i === index ? {
              ...item, [key]: Math.max(0.1, Math.min(key === 'speed' ? 100 : 5, value)) } : item) })
          }} />
      </label>)}
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
