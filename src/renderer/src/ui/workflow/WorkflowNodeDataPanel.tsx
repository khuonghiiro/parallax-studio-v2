import React, { useMemo } from 'react'
import type { Project } from '@shared/types'
import { nodePreviewChanges } from './workflowNodeEditing'

export const WorkflowNodeOutput = React.memo(function WorkflowNodeOutput({ base, preview, pending, paused }: { base: Project; preview?: Project; pending?: boolean; paused?: boolean }) {
  const { layers: changed, sections } = useMemo(() => nodePreviewChanges(base, preview), [base, preview])
  return <div className="wf-node-output-summary" data-mcp-region="workflow_node_output" aria-live="polite">
    <div className="wf-node-section-heading"><strong>KẾT QUẢ XEM THỬ</strong><span>{pending ? paused ? 'Chưa cập nhật' : 'Đang tính…' : `${changed.length} layer thay đổi`}</span></div>
    <p className="wf-node-data-note">{pending ? paused ? 'Nhấn Xem thử để cập nhật các thay đổi vừa chỉnh.' : 'Đang cập nhật theo thông số và dây nối.' :
      [...changed.map((layer) => layer.name), ...sections].join(' · ') || 'Thông số hiện tại chưa tạo thay đổi trên dự án.'}</p>
  </div>
})
