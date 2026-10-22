import React from 'react'
import type { WorkflowBoundTarget, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { WorkflowNodeOperationFields } from './WorkflowNodeOperationFields'
import { editableNodeRules } from './workflowNodeEditing'
import { getCustomActionSpec } from '../../project/workflowStageEffects'

type Props = {
  node: WorkflowNode
  onChangeNodePreset: (id: string, preset: string) => void
  onUpdateNodeParams: (id: string, patch: Partial<WorkflowNodeParams>) => void
  onUpdateNodeDirective: (id: string, directive: string) => void
  selectedRuleId?: string
  onSelectRule?: (id: string) => void
  targets?: WorkflowBoundTarget[]
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
  const { node, onChangeNodePreset, onUpdateNodeParams } = props
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const logic = WORKFLOW_LOGIC_NODE_CATALOG.find((item) => item.id === node.params?.logicId)
  return <div className="wf-subtab-pane">
    {logic && <p className="wf-node-data-note">{logic.description}</p>}
    {!logic && <details className="wf-node-preset-picker" data-mcp-region="workflow_node_preset_picker"><summary>Mẫu xử lý <strong>{spec.presets.find((preset) => preset.id === node.preset)?.label}</strong></summary>
      <div className="wf-preset-cards-list" role="radiogroup" aria-label="Chọn kịch bản xử lý mẫu">
      {spec.presets.map((preset) => <button type="button" role="radio" aria-checked={node.preset === preset.id}
        key={preset.id} className={`wf-preset-option-card${node.preset === preset.id ? ' active' : ''}`}
        onClick={() => onChangeNodePreset(node.id, preset.id)}>
        <div className="wf-preset-option-head"><span>{node.preset === preset.id ? '●' : '○'}</span><strong>{preset.label}</strong></div>
        <div className="wf-preset-option-desc">{preset.summary}</div>
      </button>)}
    </div></details>}
    <div className="wf-compact-controls-box">
      <label className="wf-field-label">Cường độ toàn node <strong>{Math.round((node.params?.intensity ?? 1) * 100)}%</strong>
        <input type="range" className="wf-range" min={0.1} max={2} step={0.05} value={node.params?.intensity ?? 1}
          onChange={(event) => onUpdateNodeParams(node.id, { intensity: Number(event.target.value) })} />
      </label>
      <NodeSwitches node={node} onUpdateNodeParams={onUpdateNodeParams} />
    </div>
    {editableNodeRules(node).length > 1 && <div className="wf-node-rule-picker" data-mcp-region="workflow_node_rule_picker" role="group" aria-label="Chọn thao tác đang chỉnh">
      <span className="wf-field-label">Chọn thao tác để chỉnh riêng</span>
      {editableNodeRules(node).map((rule) => <button type="button" key={rule.id} aria-pressed={props.selectedRuleId === rule.id}
        className={`wf-rule-choice${props.selectedRuleId === rule.id ? ' active' : ''}`} onClick={() => props.onSelectRule?.(rule.id)}>
        <strong>{getCustomActionSpec(rule.actionKind)?.icon} {getCustomActionSpec(rule.actionKind)?.shortLabel ?? rule.label}</strong>
        <span>{rule.targetId === 'all' ? 'Trong phạm vi node' : rule.targetName} · {rule.enabled ? 'Bật' : 'Tắt'}</span>
      </button>)}
    </div>}
    <WorkflowNodeOperationFields node={node} onUpdateNodeParams={onUpdateNodeParams} selectedRuleId={props.selectedRuleId} targets={props.targets} />
  </div>
}
