import React from 'react'
import type { Shot } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import { IconLightning, IconTree } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'

/** Quy chuẩn: ≤ 5 lựa chọn dùng pill bấm 1 lần, nhiều hơn dùng Select */
const MAX_SHOT_PILLS = 5
const ALL = '__all__'

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
  onFocusShot: (shotId: string | null) => void
  onToggleJsonMode?: () => void
  onRelayout: () => void
  onApplyAll: () => void
}

export const WorkflowV2Toolbar: React.FC<WorkflowV2ToolbarProps> = (props) => {
  const options = [
    { value: ALL, label: 'Toàn cảnh' },
    ...props.shots.map(({ shot, index }) => ({ value: shot.id, label: `#${index + 1} ${shot.name}` }))
  ]
  const current = props.focusedShotId ?? ALL
  return (
    <div className="wf-toolbar wf-v2-toolbar" data-mcp-region="workflow_toolbar">
      <TimelineModeTabs layerCount={props.layerCount} connectedNodeCount={props.enabledNodeCount} totalNodeCount={props.totalNodeCount} />
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
          <CustomSelect size="sm" value={current} options={options} onChange={(v) => props.onFocusShot(v === ALL ? null : v)} style={{ minWidth: 180 }} />
        )}
      </div>

      <div className="wf-v2-toolbar-actions">
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
            <code className="wf-v2-json-glyph">{'{ }'}</code>
            <span>JSON</span>
          </button>
        )}
        <button type="button" className="btn ghost sm wf-v2-tool-btn" onClick={props.onRelayout} title="Xếp lại toàn bộ không gian gọn gàng (bỏ ghim các thẻ đã kéo tay)">
          <IconTree width={13} height={13} />
          <span>Sắp xếp</span>
        </button>
        <button type="button" className="btn primary sm wf-v2-tool-btn primary-apply" onClick={props.onApplyAll} title="Áp dụng lại toàn bộ logic của cây xuống cảnh">
          <IconLightning width={13} height={13} />
          <span>Áp dụng vào cảnh</span>
        </button>
      </div>
    </div>
  )
}
