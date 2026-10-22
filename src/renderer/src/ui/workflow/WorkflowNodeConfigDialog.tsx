import '../../styles/workflowNodeDialogTabs.css'
import '../../styles/workflowNodeDataFlow.css'
import '../../styles/workflowNodeEditor.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Project, WorkflowAiBlueprint, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { resolveNodeTargetBinding } from '../../project/workflowTargets'
import { WorkflowNodeDialogHeader, WorkflowNodePreviewPanel } from './WorkflowNodeDialogChrome'
import { WorkflowTransformBody } from './WorkflowTransformBody'
import { WorkflowNodeParameters } from './WorkflowNodeParameters'
import { WorkflowNodeScope } from './WorkflowNodeScope'
import { WorkflowNodeAdvanced } from './WorkflowNodeAdvanced'
import { editableNodeRules, nodeEditingLabel, nodePreviewKey } from './workflowNodeEditing'

export interface WorkflowNodeConfigDialogProps {
  node: WorkflowNode
  project?: Project
  previewProject?: Project
  previewPending?: boolean
  automaticPreview?: boolean
  onToggleAutomaticPreview?: () => void
  onRefreshPreview?: () => void
  draftError?: string
  onApply?: () => void
  workflow: WorkflowGraph
  blueprint: WorkflowAiBlueprint
  onClose: () => void
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onUpdateNodeDirective: (nodeId: string, directive: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onToggleNode: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  onPreviewNode?: (node: WorkflowNode) => void
  onConnectPorts?: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge?: (edgeId: string) => void
  onSpawnLogicNode?: (logicId: string) => void
  activeShotLabel?: string
  onShowToast: (msg: string) => void
}

export const WorkflowNodeConfigDialog: React.FC<WorkflowNodeConfigDialogProps> = (props) => {
  const { node, project, workflow, onClose, previewPending, draftError } = props
  const dialogRef = useRef<HTMLDivElement>(null)
  const [editingRuleId, setEditingRuleId] = useState<string>()
  const previewKey = nodePreviewKey(workflow)
  const binding = useMemo(() => resolveNodeTargetBinding(node, project, workflow), [project, previewKey])
  const rules = editableNodeRules(node)
  const selectedRule = rules.find((rule) => rule.id === editingRuleId) ?? rules[0]
  const isEntity = node.type === 'layer_transform' || (node.type === 'layer_assembly' && !node.params?.logicId && !!node.params?.targetLayerIds?.length)
  const canAddActions = ['motion_choreography', 'physics_fx'].includes(node.type) && !node.params?.logicId
  const label = isEntity ? 'Vị trí & góc xoay' : nodeEditingLabel(node, selectedRule?.id)
  const targetLabel = selectedRule && selectedRule.targetId !== 'all' ? selectedRule.targetName
    : binding.boundTargets.filter((target) => target.kind !== 'shot').map((target) => target.name).join(', ') || 'Chưa có đối tượng'
  const updateParams = (id: string, patch: Partial<WorkflowNodeParams>) => {
    const added = patch.customRules?.find((rule) => !node.params?.customRules?.some((item) => item.id === rule.id))
    if (added) setEditingRuleId(added.id)
    props.onUpdateNodeParams(id, patch)
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key !== 'Tab') return
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea, summary, [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0)
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const status = draftError || (previewPending ? props.automaticPreview === false ? 'Có thay đổi chưa xem thử' : 'Đang cập nhật hình xem thử…' : 'Bản nháp · Chưa lưu vào dự án')
  return createPortal(
    <div className="wf-node-dialog-backdrop" onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()} onKeyDown={handleKeyDown}>
      <div ref={dialogRef} tabIndex={-1} className="wf-node-dialog-window wf-node-config-modal wf-node-config-simple"
        data-mcp-region="workflow_node_config" data-mcp-dialog="true" role="dialog" aria-modal="true"
        aria-label={`Cấu hình khối ${node.title}`} style={{ ['--wf-node-color' as string]: WORKFLOW_NODE_SPECS[node.type]?.color ?? 'var(--accent)' }}>
        <WorkflowNodeDialogHeader {...props} />
        <div className="wf-node-dialog-workspace">
          <section className="wf-node-dialog-settings" data-mcp-region="workflow_node_settings">
            <div className="wf-node-edit-context" data-mcp-region="workflow_node_edit_context">
              <span>ĐANG CHỈNH</span><strong>{label}</strong>
              <p title={targetLabel}>Áp dụng lên: {targetLabel}</p>
              {(!node.enabled || selectedRule?.enabled === false) && <p className="wf-edit-disabled">{!node.enabled ? 'Node đang tắt' : 'Thao tác này đang tắt'} — bật để xem tác động.</p>}
            </div>
            <WorkflowNodeScope node={node} binding={binding} fixed={isEntity} onUpdateNodeParams={updateParams} />
            <div className="wf-node-dialog-body">
              {isEntity ? <WorkflowTransformBody draftMode={!!props.onApply} node={node} project={project} onUpdateNodeParams={updateParams} />
                : <WorkflowNodeParameters node={node} onChangeNodePreset={props.onChangeNodePreset}
                  onUpdateNodeParams={updateParams} onUpdateNodeDirective={props.onUpdateNodeDirective}
                  selectedRuleId={selectedRule?.id} onSelectRule={setEditingRuleId} targets={binding.boundTargets} />}
              <WorkflowNodeAdvanced {...props} onUpdateNodeParams={updateParams} binding={binding} canAddActions={canAddActions} />
            </div>
          </section>
          {project && <WorkflowNodePreviewPanel {...props} project={project} />}
        </div>
        <div className="wf-node-dialog-footer">
          <span className="wf-node-save-hint" role={draftError ? 'alert' : 'status'}>{status}</span>
          <button type="button" className="btn ghost sm" onClick={onClose}>Hủy</button>
          <button type="button" className="btn primary sm" disabled={!!draftError} onClick={props.onApply ?? onClose}>Áp dụng toàn node</button>
        </div>
      </div>
    </div>, document.body)
}
