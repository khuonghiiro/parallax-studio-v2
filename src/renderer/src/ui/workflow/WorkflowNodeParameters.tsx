import React from 'react'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { WorkflowNodeOperationFields } from './WorkflowNodeOperationFields'

type Props = {
  node: WorkflowNode
  onChangeNodePreset: (id: string, preset: string) => void
  onUpdateNodeParams: (id: string, patch: Partial<WorkflowNodeParams>) => void
  onUpdateNodeDirective: (id: string, directive: string) => void
}

function NodeSwitches({ node, onUpdateNodeParams }: Pick<Props, 'node' | 'onUpdateNodeParams'>) {
  const p = node.params ?? {}
  const logic = p.logicId
  const allows = (part: string) => !logic || !!WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === logic)?.targetParts.includes(part)
  const controls: { label: string; checked: boolean; patch: (checked: boolean) => Partial<WorkflowNodeParams> }[] = []
  if (node.type === 'scene_shot') controls.push(
    { label: 'Tự xếp độ sâu Z', checked: p.autoArrangeZ !== false, patch: (autoArrangeZ) => ({ autoArrangeZ }) },
    { label: 'Tạo mặt đất 3D', checked: !!p.ensureGround, patch: (ensureGround) => ({ ensureGround }) }
  )
  if (node.type === 'physics_fx' && allows('firefly_particles')) controls.push({ label: 'Thêm lớp hạt FX', checked: !!p.spawnParticles, patch: (spawnParticles) => ({ spawnParticles }) })
  if (node.type === 'camera_director') controls.push(
    { label: 'Xóa phông (DOF)', checked: p.enableDof ?? p.logicId === 'logic-cam-dof', patch: (enableDof) => ({ enableDof }) },
    { label: 'Rung handheld', checked: (p.camShakeAmount ?? (p.logicId === 'logic-cam-shake' || node.preset === 'dramatic_handheld_action' ? 6 : 0)) > 0, patch: (checked) => ({ camShakeAmount: checked ? 6 : 0 }) }
  )
  if (node.type === 'audio_lipsync' && allows('mouth_viseme_25d')) controls.push({ label: 'Tự động lip-sync', checked: p.autoLipSync !== false, patch: (autoLipSync) => ({ autoLipSync }) })
  const relevant = controls.filter((c) => !logic || (c.label === 'Xóa phông (DOF)' ? allows('dof_aperture') : c.label === 'Rung handheld' ? allows('handheld_rig') : true))
  return <div className="wf-check-pills-row">{relevant.map((control) => <label className="wf-check-pill" key={control.label}>
    <input type="checkbox" checked={control.checked} onChange={(event) => onUpdateNodeParams(node.id, control.patch(event.target.checked))} />
    <span>{control.label}</span>
  </label>)}</div>
}

export function WorkflowNodeParameters(props: Props) {
  const { node, onChangeNodePreset, onUpdateNodeParams, onUpdateNodeDirective } = props
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const logic = WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === node.params?.logicId)
  return <div className="wf-subtab-pane">
    {!logic && <div className="wf-node-purpose"><strong>{spec.shortTitle}</strong><p>{spec.description}</p></div>}
    {logic && <div className="wf-node-purpose"><span className="wf-field-label">Nhiệm vụ của node</span><strong>{logic.title}</strong><p>{logic.description}</p></div>}
    {!logic && <div className="wf-preset-cards-list" role="radiogroup" aria-label="Chọn kịch bản xử lý mẫu">
      {spec.presets.map((preset) => <button type="button" role="radio" aria-checked={node.preset === preset.id}
        key={preset.id} className={`wf-preset-option-card${node.preset === preset.id ? ' active' : ''}`}
        onClick={() => onChangeNodePreset(node.id, preset.id)}>
        <div className="wf-preset-option-head"><span>{node.preset === preset.id ? '●' : '○'}</span><strong>{preset.label}</strong></div>
        <div className="wf-preset-option-desc">{preset.summary}</div>
      </button>)}
    </div>}
    <div className="wf-compact-controls-box">
      <label className="wf-field-label">Cường độ tác động <strong>{Math.round((node.params?.intensity ?? 1) * 100)}%</strong>
        <input type="range" className="wf-range" min={0.1} max={2} step={0.05} value={node.params?.intensity ?? 1}
          onChange={(event) => onUpdateNodeParams(node.id, { intensity: Number(event.target.value) })} />
      </label>
      <NodeSwitches node={node} onUpdateNodeParams={onUpdateNodeParams} />
      <WorkflowNodeOperationFields node={node} onUpdateNodeParams={onUpdateNodeParams} />
    </div>
    <label className="wf-field-group"><span className="wf-field-label">Ghi chú cho node · không thực thi như mã lệnh</span>
      <textarea className="wf-textarea" rows={3} value={node.aiDirective} onChange={(event) => onUpdateNodeDirective(node.id, event.target.value)} />
    </label>
  </div>
}
