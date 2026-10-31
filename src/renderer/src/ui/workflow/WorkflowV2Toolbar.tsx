import React from 'react'
import type { Shot } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import { IconJsonBraces, IconLightning, IconTimeNodePlus, IconTree } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'
import { IconWorkflowCardsList, IconWorkflowGraph } from './workflowIcons'

/** Quy chuẩn: ≤ 6 lựa chọn dùng pill bấm 1 lần (hỗ trợ vuốt ngang trên mobile), nhiều hơn dùng Select */
const MAX_SHOT_PILLS = 6
const ALL = '__all__'

export type WorkflowV2ViewMode = 'graph' | 'cards'

export interface WorkflowV2ToolbarProps {
  layerCount: number
  enabledNodeCount: number
  totalNodeCount: number
  stats: { shots: number; layers: number; logic: number }
  /** Cảnh theo thứ tự camera đi qua */
  shots: { shot: Shot; index: number }[]
  activeShotId: string | null
  focusedShotId: string | null
  jsonMode?: boolean
  viewMode?: WorkflowV2ViewMode
  onChangeViewMode?: (mode: WorkflowV2ViewMode) => void
  onFocusShot: (shotId: string | null) => void
  onToggleJsonMode?: () => void
  onRelayout: () => void
  onApplyAll: () => void
  onAddTime: () => void
}

export const WorkflowV2Toolbar: React.FC<WorkflowV2ToolbarProps> = (props) => {
  const options = [
    { value: ALL, label: 'Toàn cảnh' },
    ...props.shots.map(({ shot, index }) => ({ value: shot.id, label: `#${index + 1} ${shot.name}` }))
  ]
  const current = props.focusedShotId ?? ALL
  return (
    <div className="wf-toolbar wf-v2-toolbar" data-mcp-region="workflow_toolbar">
      <TimelineModeTabs
        layerCount={props.layerCount}
        connectedNodeCount={props.enabledNodeCount}
        totalNodeCount={props.totalNodeCount}
      />
      <div className="tl-toolbar-divider" />

      <div className="wf-v2-scope" role="group" aria-label="Đi tới cảnh trong không gian Workflow">
        <span className="wf-v2-scope-label">Đi tới</span>
        {options.length <= MAX_SHOT_PILLS ? (
          <div className="wf-v2-scope-pills">
            {options.map((opt) => {
              const live = opt.value === props.activeShotId
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`wf-v2-scope-pill${current === opt.value ? ' active' : ''}${live ? ' live' : ''}`}
                  title={live ? `${opt.label} — camera đang quay cảnh này` : opt.label}
                  aria-pressed={current === opt.value}
                  onClick={() => props.onFocusShot(opt.value === ALL ? null : opt.value)}
                >
                  {live && <span className="wf-v2-live-dot" aria-hidden="true" />}
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : (
          <CustomSelect
            size="sm"
            value={current}
            options={options}
            onChange={(v) => props.onFocusShot(v === ALL ? null : v)}
            style={{ minWidth: 168 }}
          />
        )}
      </div>

      <div className="wf-v2-toolbar-actions">
        {props.onChangeViewMode && (
          <div className="wf-v2-view-switch" role="group" aria-label="Chế độ hiển thị Workflow">
            <button
              type="button"
              id="wf-v2-view-graph"
              className={`wf-v2-view-btn${(props.viewMode ?? 'graph') === 'graph' ? ' active' : ''}`}
              aria-pressed={(props.viewMode ?? 'graph') === 'graph'}
              onClick={() => props.onChangeViewMode!('graph')}
              title="Chế độ Sơ đồ Node 2D (Vuốt 1 ngón để di chuyển, chụm 2 ngón để thu phóng)"
            >
              <IconWorkflowGraph width={12} height={12} />
              <span>Sơ đồ</span>
            </button>
            <button
              type="button"
              id="wf-v2-view-cards"
              className={`wf-v2-view-btn${props.viewMode === 'cards' ? ' active' : ''}`}
              aria-pressed={props.viewMode === 'cards'}
              onClick={() => props.onChangeViewMode!('cards')}
              title="Chế độ Danh sách Thẻ gọn (Tối ưu thao tác cảm ứng trên Điện thoại & Máy tính bảng)"
            >
              <IconWorkflowCardsList width={12} height={12} />
              <span>Thẻ</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn ghost sm wf-v2-tool-btn wf-v2-time-btn"
          onClick={props.onAddTime}
          title="Tạo nguồn thời gian chung rồi kéo dây tới các node"
        >
          <IconTimeNodePlus width={13} height={13} />
          <span className="wf-v2-btn-txt">Time</span>
        </button>

        <span className="wf-v2-stats" title="Số cảnh / layer / node logic trong toàn dự án">
          <b>{props.stats.shots}</b> cảnh · <b>{props.stats.layers}</b> layer · <b>{props.stats.logic}</b> logic
        </span>

        {props.onToggleJsonMode && (
          <button
            type="button"
            className={`btn ghost sm wf-v2-tool-btn wf-v2-json-toggle${props.jsonMode ? ' active' : ''}`}
            aria-pressed={Boolean(props.jsonMode)}
            onClick={props.onToggleJsonMode}
            title="Mở bảng JSON độc lập (main.json kết nối + shot-N.json cho từng cảnh)"
          >
            <IconJsonBraces width={13} height={13} />
            <span className="wf-v2-btn-txt">JSON</span>
          </button>
        )}

        <button
          type="button"
          className="btn ghost sm wf-v2-tool-btn"
          onClick={props.onRelayout}
          title="Xếp lại toàn bộ không gian gọn gàng (bỏ ghim các thẻ đã kéo tay)"
        >
          <IconTree width={13} height={13} />
          <span className="wf-v2-btn-txt">Sắp xếp</span>
        </button>

        <button
          type="button"
          className="btn primary sm wf-v2-tool-btn primary-apply"
          onClick={props.onApplyAll}
          title="Áp dụng lại toàn bộ logic của cây xuống cảnh"
        >
          <IconLightning width={13} height={13} />
          <span className="wf-v2-btn-txt">Áp dụng vào cảnh</span>
        </button>
      </div>
    </div>
  )
}
