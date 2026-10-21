import React from 'react'
import type {
  Project,
  WorkflowAiBlueprint,
  WorkflowGraph,
  WorkflowNode
} from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { IconPause, IconPlay, IconSparkles } from '../icons'
import { IconWfAutoWire, IconWfJsonCode } from './workflowIcons'
import { TimelineModeTabs } from './TimelineModeTabs'
import { WorkflowAddNodeMenu } from './WorkflowAddNodeMenu'

export interface WorkflowStudioToolbarProps {
  project: Project
  workflow: WorkflowGraph
  activeNodes: WorkflowNode[]
  disconnectedNodes: WorkflowNode[]
  blueprint: WorkflowAiBlueprint
  selectedNode: WorkflowNode | null
  playing: boolean
  liveTime: number
  workflowDuration: number
  currentShotScope: string | undefined
  currentShotIndex: number
  sideMode: 'node' | 'json'
  onSelectNode: (nodeId: string) => void
  onSelectShotScope: (shotId: string | 'all') => void
  onSpawnSceneLayers: () => void
  onAutoWire: () => void
  onAutoLayout: () => void
  onResetCanonical: () => void
  onClearCanvas: () => void
  onRewindToZero: () => void
  onTogglePlayFlow: () => void
  onToggleSideMode: () => void
  onExecuteWorkflow: () => void
}

export const WorkflowStudioToolbar: React.FC<WorkflowStudioToolbarProps> = ({
  project,
  workflow,
  activeNodes,
  disconnectedNodes,
  blueprint,
  selectedNode,
  playing,
  liveTime,
  workflowDuration,
  currentShotScope,
  currentShotIndex,
  sideMode,
  onSelectNode,
  onSelectShotScope,
  onSpawnSceneLayers,
  onAutoWire,
  onAutoLayout,
  onResetCanonical,
  onClearCanvas,
  onRewindToZero,
  onTogglePlayFlow,
  onToggleSideMode,
  onExecuteWorkflow
}) => {
  return (
    <div className="timeline-toolbar wf-toolbar" data-mcp-region="workflow_toolbar">
      {/* Nhóm 1: Chế độ, Trạng thái luồng & Phạm vi Cảnh (Scope & Health) */}
      <div className="wf-toolbar-cluster scope-health">
        <TimelineModeTabs
          layerCount={project.layers.length}
          connectedNodeCount={activeNodes.length}
          totalNodeCount={workflow.nodes.length}
        />

        <div
          className={`wf-pipeline-health-badge${
            blueprint.isPipelineComplete && disconnectedNodes.length === 0
              ? ' complete'
              : activeNodes.length > 0
                ? ' building'
                : ' broken'
          }`}
          title={blueprint.pipelineSummary}
        >
          <span
            className={`wf-health-dot${
              blueprint.isPipelineComplete && disconnectedNodes.length === 0 ? ' pulsing' : ''
            }`}
          />
          <span className="wf-health-text">
            {blueprint.isPipelineComplete && disconnectedNodes.length === 0
              ? `✓ Thông mạch (${activeNodes.length}/${workflow.nodes.length})`
              : activeNodes.length > 0
                ? `⚡ Luồng (${activeNodes.length}/${workflow.nodes.length})`
                : `⛔ Đứt luồng`}
          </span>
        </div>

        {project.shots.length > 1 && (
          <div className="wf-toolbar-pill-group wf-shot-scope-group" role="radiogroup">
            <span className="wf-toolbar-label">Cảnh:</span>
            <button
              type="button"
              className={`wf-toolbar-pill-btn${!currentShotScope ? ' active' : ''}`}
              title="Xem và điều khiển toàn bộ các cảnh trong dự án"
              onClick={() => onSelectShotScope('all')}
            >
              <span>⇄ Tất cả ({project.shots.length})</span>
            </button>
            {project.shots.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`wf-toolbar-pill-btn${currentShotScope === s.id ? ' active' : ''}`}
                title={`Lọc khối và layer cho Cảnh #${idx + 1}: ${s.name}`}
                onClick={() => onSelectShotScope(s.id)}
              >
                <span>#{idx + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="wf-toolbar-sep" />

      {/* Nhóm 2: Thao tác Bản vẽ (Canvas Operations) */}
      <div className="wf-toolbar-cluster canvas-ops">
        <WorkflowAddNodeMenu onSpawnSceneLayers={onSpawnSceneLayers} />

        <button
          id="wf-btn-spawn-scene-layers"
          type="button"
          className="btn ghost sm tl-action-btn wf-spawn-scene-btn"
          title="Bung toàn bộ Layer của phân cảnh ra thành các Node độc lập kèm Tấm điều khiển tọa độ Z"
          onClick={onSpawnSceneLayers}
        >
          <span>🎬 Bung Cảnh & Layer</span>
        </button>

        <button
          id="wf-btn-autowire"
          type="button"
          className="btn ghost sm tl-action-btn wf-autowire-btn"
          title="Tự động nối chuẩn tất cả cổng (Port) giữa các khối chức năng đang bật"
          onClick={onAutoWire}
        >
          <IconWfAutoWire width={13} height={13} />
          <span>Tự nối</span>
        </button>

        <button
          id="wf-btn-toolbar-autolayout"
          type="button"
          className="btn ghost sm tl-action-btn wf-autolayout-btn"
          title="Tự động sắp xếp toàn bộ sơ đồ gọn gàng theo thứ tự luồng, chống đè lấn 100% (Phím tắt: Alt + L)"
          onClick={onAutoLayout}
        >
          <IconSparkles width={13} height={13} />
          <span>Sắp xếp</span>
        </button>

        <button
          id="wf-btn-reset-canonical"
          type="button"
          className="btn ghost sm tl-action-btn"
          title="Đặt lại sơ đồ về luồng chuẩn 7 khâu xử lý hoàn chỉnh"
          onClick={onResetCanonical}
        >
          <span>↺ Chuẩn</span>
        </button>

        <button
          id="wf-btn-clear-canvas"
          type="button"
          className="btn ghost sm tl-action-btn"
          title="Xóa trắng sơ đồ để tự do thiết kế luồng xử lý từ đầu"
          onClick={onClearCanvas}
        >
          <span>✕ Xóa</span>
        </button>
      </div>

      <div className="wf-toolbar-sep" />

      {/* Nhóm 3: Mô phỏng & Chạy Luồng (Simulation & Playback) */}
      <div className="wf-toolbar-cluster flow-ops">
        <button
          id="wf-btn-rewind-zero"
          type="button"
          className="btn ghost sm tl-action-btn wf-rewind-btn"
          title="Tua playhead về 0.0s (Bắt đầu phân cảnh)"
          onClick={onRewindToZero}
        >
          <span>⏮ 0s</span>
        </button>

        <button
          id="wf-btn-play-flow"
          type="button"
          className={`btn ghost sm tl-action-btn wf-play-flow-btn${playing ? ' playing' : ''}${
            activeNodes.length === 0 ? ' broken' : ''
          }`}
          disabled={workflow.nodes.length === 0}
          title={
            workflow.nodes.length === 0
              ? 'Bản vẽ đang trống (0.0s) — Bấm "🎬 Bung Cảnh & Layer" hoặc thêm Node Logic trước khi chạy luồng'
              : activeNodes.length === 0
                ? 'Luồng đang đứt — Bấm "Tự nối" trước khi chạy'
                : playing
                  ? 'Đang phát video & mô phỏng lộ trình xử lý theo từng bước (Bấm để tạm dừng)'
                  : 'Phát video để quan sát lộ trình xử lý tuần tự qua từng khối chức năng'
          }
          onClick={onTogglePlayFlow}
        >
          {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
          <span>{playing ? 'Đang chạy' : 'Chạy luồng'}</span>
          <span
            className={`wf-play-time-tag ${workflow.nodes.length > 0 ? 'clickable' : 'empty'}`}
            title={
              workflow.nodes.length === 0
                ? 'Bản vẽ đang trống (0.0s). Bấm để tua về 0.0s'
                : `Thời gian hiện tại / Thời lượng luồng (${workflowDuration.toFixed(1)}s). Bấm để tua về 0.0s`
            }
            onClick={(e) => {
              e.stopPropagation()
              onRewindToZero()
            }}
          >
            {workflow.nodes.length === 0
              ? '0.0s / 0.0s'
              : `${liveTime.toFixed(1)}s / ${workflowDuration.toFixed(1)}s`}
            {workflow.nodes.length === 0 && <span className="wf-time-empty-hint"> (Trống)</span>}
          </span>
        </button>

        <div
          className={`wf-pipeline-flow-pill${playing && activeNodes.length > 0 ? ' playing' : ''}${
            activeNodes.length === 0 ? ' broken' : ''
          }`}
          title={blueprint.pipelineSummary}
        >
          <span
            className={`wf-flow-dot${
              playing && activeNodes.length > 0 ? ' pulsing' : ''
            }${activeNodes.length === 0 ? ' broken' : ''}`}
          />
          {activeNodes.length > 0 ? (
            <div className="wf-flow-steps">
              {activeNodes.map((n, idx) => {
                const spec = WORKFLOW_NODE_SPECS[n.type]
                const cycleIdx = Math.floor((liveTime * 2.2) % Math.max(1, activeNodes.length))
                const isStepPulse = playing && cycleIdx === idx
                const isNodeSel = selectedNode?.id === n.id
                return (
                  <React.Fragment key={n.id}>
                    {idx > 0 && <span className="wf-flow-arrow">➔</span>}
                    <button
                      type="button"
                      className={`wf-flow-step-chip${isStepPulse ? ' pulsing' : ''}${
                        isNodeSel ? ' selected' : ''
                      }`}
                      style={{ ['--step-c' as string]: spec?.color ?? '#38bdf8' }}
                      onClick={() => onSelectNode(n.id)}
                      title={`Bước #${idx + 1}: ${spec?.title} — Bấm để xem Layer & Cấu hình`}
                    >
                      #{idx + 1} {spec?.shortTitle ?? n.title}
                    </button>
                  </React.Fragment>
                )
              })}
              {disconnectedNodes.length > 0 && (
                <span
                  className="wf-flow-broken-tag"
                  title={`Các khối đang đứt dây / tắt: ${disconnectedNodes
                    .map((d) => WORKFLOW_NODE_SPECS[d.type]?.shortTitle ?? d.title)
                    .join(', ')}`}
                >
                  ⛔ {disconnectedNodes.length} đứt
                </span>
              )}
            </div>
          ) : (
            <span className="wf-flow-text broken">
              ⛔ Luồng đứt từ Phân cảnh #1 — Bấm &quot;Tự nối&quot;
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Nhóm 4: Cấu hình JSON & Áp dụng thực thi (Deploy) */}
      <div className="wf-toolbar-cluster deploy-ops">
        <button
          id="wf-btn-toggle-json"
          type="button"
          className={`btn ghost sm tl-action-btn${sideMode === 'json' ? ' active' : ''}`}
          title="Xem & chỉnh sửa cấu hình JSON và bản thiết kế Tác nhân AI (MCP Blueprint)"
          onClick={onToggleSideMode}
        >
          <IconWfJsonCode width={13} height={13} />
          <span>JSON & AI</span>
        </button>

        <button
          id="wf-btn-apply"
          type="button"
          className="btn primary sm tl-action-btn wf-apply-btn"
          title="Áp dụng toàn bộ cấu hình chuyển động và hiệu ứng của các khối đang thông mạch vào phân cảnh"
          onClick={onExecuteWorkflow}
        >
          <span>⚡ Áp dụng</span>
        </button>
      </div>
    </div>
  )
}
