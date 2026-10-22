import React from 'react'
import type { Project } from '@shared/types'
import type { WorkflowNodeConfigDialogProps } from './WorkflowNodeConfigDialog'
import { renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowCameraMonitor } from './WorkflowCameraMonitor'
import { WorkflowNodeOutput } from './WorkflowNodeDataPanel'

export function WorkflowNodeDialogHeader(props: WorkflowNodeConfigDialogProps) {
  const { node, onClose } = props
  return <div className="wf-node-dialog-header">
    <div className="wf-node-dialog-icon">{renderWorkflowNodeIcon(node.type, { width: 18, height: 18 })}</div>
    <div className="wf-node-dialog-title-group">
      <div className="wf-node-dialog-title-row"><span className="wf-node-dialog-title">{node.title}</span></div>
      <span className="wf-node-dialog-role">{props.activeShotLabel ?? 'Cấu hình node'} · Chỉnh bản nháp, xem thử rồi áp dụng</span>
    </div>
    <div className="wf-node-dialog-actions">
      <button type="button" className={`wf-node-dialog-toggle${node.enabled ? ' on' : ''}`} aria-pressed={node.enabled}
        onClick={() => props.onToggleNode(node.id)}><span className="wf-toggle-dot" />{node.enabled ? 'Đang bật' : 'Đang tắt'}</button>
      <button type="button" className="wf-node-dialog-close" title="Đóng, bỏ bản nháp (Escape)" onClick={onClose}>✕</button>
    </div>
  </div>
}

export function WorkflowNodePreviewPanel(props: WorkflowNodeConfigDialogProps & { project: Project }) {
  const { node, project, previewPending } = props
  return <div className="wf-node-output-panel">
    <div className="wf-node-preview-tools" data-mcp-region="workflow_node_preview_controls">
      <div><strong>Xem thử toàn node</strong><span>Mọi thao tác đang bật cùng được tính</span></div>
      {props.onToggleAutomaticPreview && <label><input type="checkbox" checked={props.automaticPreview !== false} onChange={props.onToggleAutomaticPreview} />Tự cập nhật</label>}
      {props.onRefreshPreview && <button type="button" className="btn ghost sm" onClick={props.onRefreshPreview}>↻ Xem thử</button>}
    </div>
    <WorkflowNodeOutput base={project} preview={props.previewProject} pending={previewPending} paused={props.automaticPreview === false} />
    <WorkflowCameraMonitor key={node.id} project={props.previewProject ?? project} node={node} stale={previewPending} />
  </div>
}
