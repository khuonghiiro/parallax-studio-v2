import React from 'react'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { resolveNodeTargetBinding } from '../../project/workflowTargets'
import { resolveConnectedWorkflowNodes } from '../../project/workflowEngine'

export function WorkflowNodeInput({ node, workflow, project }: { node: WorkflowNode; workflow: WorkflowGraph; project?: Project }) {
  const binding = resolveNodeTargetBinding(node, project, workflow)
  const incoming = workflow.edges.filter((edge) => edge.toNode === node.id)
  const active = resolveConnectedWorkflowNodes(workflow).activeNodes.some((item) => item.id === node.id)
  return <aside className="wf-node-input-panel" data-mcp-region="workflow_node_input">
    <div className="wf-node-section-heading"><strong>ĐẦU VÀO</strong><span>{incoming.length} kết nối</span></div>
    <p className={`wf-node-run-state${active ? ' ready' : ''}`} role="status">
      {!node.enabled ? '○ Node đang tắt' : active ? '● Sẵn sàng xử lý' : '○ Chưa nối vào luồng'}
    </p>
    <div className="wf-node-input-list">{incoming.map((edge) => {
      const source = workflow.nodes.find((item) => item.id === edge.fromNode)
      return <div className="wf-node-input-item" key={edge.id}><strong>{source?.title ?? edge.fromNode}</strong>
        <span>{WORKFLOW_PORT_SPECS[edge.fromPort]?.shortLabel} → {WORKFLOW_PORT_SPECS[edge.toPort]?.shortLabel}</span>
        {!source?.enabled && <span>Node nguồn đang tắt</span>}
      </div>
    })}</div>
    {!incoming.length && <p className="wf-node-data-note">{node.type === 'scene_shot'
      ? 'Phân cảnh là điểm bắt đầu của luồng.' : 'Mở tab Kết nối để chọn node nguồn.'}</p>}
    <div className="wf-node-section-heading"><strong>ĐỐI TƯỢNG XỬ LÝ</strong><span>{binding.boundTargets.length}</span></div>
    <p className="wf-node-data-note">{node.params?.targetMode === 'custom' ? 'Danh sách chọn thủ công.' : 'Theo dây nối; dùng phạm vi phân cảnh khi chỉ nhận ngữ cảnh cảnh.'}</p>
    <div className="wf-node-input-list">{binding.boundTargets.map((target) => <div className="wf-node-input-item" key={target.id}>
      <strong>{target.name}</strong><span>{target.roleLabel}</span>
    </div>)}</div>
    {!binding.boundTargets.length && <p className="wf-node-data-note">Chưa có đối tượng trong phạm vi này.</p>}
  </aside>
}

export function WorkflowNodeOutput({ base, preview, pending }: { base: Project; preview?: Project; pending?: boolean }) {
  const changed = preview?.layers.filter((layer) => JSON.stringify(base.layers.find((item) => item.id === layer.id)) !== JSON.stringify(layer)) ?? []
  const sections = preview ? [
    ['Camera', base.camera, preview.camera], ['Màu sắc', base.look, preview.look], ['Âm thanh', base.audioTracks, preview.audioTracks]
  ].filter(([, before, after]) => JSON.stringify(before) !== JSON.stringify(after)).map(([name]) => String(name)) : []
  return <div className="wf-node-output-summary" data-mcp-region="workflow_node_output" aria-live="polite">
    <div className="wf-node-section-heading"><strong>ĐẦU RA · BẢN XEM THỬ</strong><span>{pending ? 'Đang tính…' : `${changed.length} layer thay đổi`}</span></div>
    <p className="wf-node-data-note">{pending ? 'Đang cập nhật theo thông số và dây nối.' :
      [...changed.map((layer) => layer.name), ...sections].join(' · ') || 'Thông số hiện tại chưa tạo thay đổi trên dự án.'}</p>
  </div>
}
