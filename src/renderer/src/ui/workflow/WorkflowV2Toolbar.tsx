import React from 'react'
import type { Shot } from '@shared/types'
import { WORKFLOW_V2_ALL_SCOPE } from '../../project/workflowV2Engine'
import { CustomSelect } from '../controls/CustomSelect'
import { IconLightning, IconRefresh, IconTree } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'

/** Tối đa số lựa chọn hiển thị dạng pill (quy chuẩn: ≤ 5 lựa chọn dùng pill, nhiều hơn dùng Select) */
const MAX_SCOPE_PILLS = 5

export interface WorkflowV2ToolbarProps {
  layerCount: number
  enabledNodeCount: number
  totalNodeCount: number
  stats: { groups: number; layers: number; logic: number }
  shots: Shot[]
  scope: string
  onSwitchScope: (scope: string) => void
  onRebuild: () => void
  onAutoLayout: () => void
  onApplyAll: () => void
}

export const WorkflowV2Toolbar: React.FC<WorkflowV2ToolbarProps> = ({
  layerCount,
  enabledNodeCount,
  totalNodeCount,
  stats,
  shots,
  scope,
  onSwitchScope,
  onRebuild,
  onAutoLayout,
  onApplyAll
}) => {
  const scopeOptions = [
    { value: WORKFLOW_V2_ALL_SCOPE, label: `Toàn dự án (${shots.length})` },
    ...shots.map((s, idx) => ({ value: s.id, label: `#${idx + 1} ${s.name}` }))
  ]
  return (
    <div className="wf-toolbar wf-v2-toolbar" data-mcp-region="workflow_toolbar">
      <TimelineModeTabs layerCount={layerCount} connectedNodeCount={enabledNodeCount} totalNodeCount={totalNodeCount} />
      <div className="tl-toolbar-divider" />

      <div className="wf-v2-scope" role="group" aria-label="Phạm vi cảnh">
        <span className="wf-v2-scope-label">Phạm vi</span>
        {scopeOptions.length <= MAX_SCOPE_PILLS ? (
          <div className="wf-v2-scope-pills">
            {scopeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`wf-v2-scope-pill${scope === opt.value ? ' active' : ''}`}
                title={opt.label}
                aria-pressed={scope === opt.value}
                onClick={() => onSwitchScope(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <CustomSelect size="sm" value={scope} options={scopeOptions} onChange={onSwitchScope} style={{ minWidth: 180 }} />
        )}
      </div>

      <div className="wf-v2-toolbar-actions">
        <span className="wf-v2-stats" title="Số nhóm / layer / node logic trong phạm vi đang xem">
          <b>{stats.groups}</b> nhóm · <b>{stats.layers}</b> layer · <b>{stats.logic}</b> logic
        </span>
        <button type="button" className="btn ghost sm wf-v2-tool-btn" onClick={onRebuild} title="Đồng bộ cây với Cảnh & Layer hiện tại, giữ nguyên Node Logic đã cấu hình">
          <IconRefresh width={13} height={13} />
          <span>Đồng bộ</span>
        </button>
        <button type="button" className="btn ghost sm wf-v2-tool-btn" onClick={onAutoLayout} title="Tự sắp xếp cây gọn gàng theo 4 cột">
          <IconTree width={13} height={13} />
          <span>Sắp xếp</span>
        </button>
        <button type="button" className="btn primary sm wf-v2-tool-btn primary-apply" onClick={onApplyAll} title="Áp dụng toàn bộ logic, vật liệu, va chạm và khoảng mốc vào cảnh">
          <IconLightning width={13} height={13} />
          <span>Áp dụng vào cảnh</span>
        </button>
      </div>
    </div>
  )
}
