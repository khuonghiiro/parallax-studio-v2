import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Project,
  WorkflowAiBlueprint,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { resolveNodeTargetBinding } from '../../project/workflowEngine'
import { renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowActionBuilder } from './WorkflowActionBuilder'
import { getTargetKindIcon } from './WorkflowNodePreview'

import { createPortal } from 'react-dom'
import { WorkflowCameraMonitor } from './WorkflowCameraMonitor'
import { WorkflowTransformBody } from './WorkflowTransformBody'
import { WorkflowNodeParameters } from './WorkflowNodeParameters'
import { WorkflowNodeConnections } from './WorkflowNodeConnections'

export interface WorkflowNodeConfigDialogProps {
  node: WorkflowNode
  project?: Project
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

export const WorkflowNodeConfigDialog: React.FC<WorkflowNodeConfigDialogProps> = ({
  node,
  project,
  workflow,
  onClose,
  onChangeNodePreset,
  onUpdateNodeDirective,
  onUpdateNodeParams,
  onToggleNode,
  onDeleteNode,
  onPreviewNode,
  onConnectPorts,
  onDisconnectEdge,
  onSpawnLogicNode,
  activeShotLabel,
  onShowToast
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'preset' | 'targets' | 'actions' | 'connections'>('preset')

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])

  const nodeSpec = WORKFLOW_NODE_SPECS[node.type]
  const binding = useMemo(() => resolveNodeTargetBinding(node, project), [node, project])

  const handleToggleTargetLayer = (targetId: string) => {
    if (!binding) return
    const currentCustom = node.params?.targetLayerIds ?? []
    const baseIds =
      node.params?.targetMode === 'custom' && currentCustom.length > 0
        ? currentCustom
        : binding.boundTargets
            .filter((t) => binding.allBindableTargets.some((b) => b.id === t.id))
            .map((t) => t.id)

    const exists = baseIds.includes(targetId)
    const nextIds = exists ? baseIds.filter((id) => id !== targetId) : [...baseIds, targetId]
    if (nextIds.length === 0) {
      onUpdateNodeParams(node.id, { targetMode: 'auto', targetLayerIds: [] })
    } else {
      onUpdateNodeParams(node.id, { targetMode: 'custom', targetLayerIds: nextIds })
    }
  }

  const handleToggleSubPart = (partId: string) => {
    if (!binding) return
    const currentParts = binding.activeParts.map((p) => p.id)
    const exists = currentParts.includes(partId)
    if (exists && currentParts.length <= 1) {
      onShowToast('Cần giữ ít nhất 1 bộ phận tác động cho khối chức năng!')
      return
    }
    const nextParts = exists
      ? currentParts.filter((id) => id !== partId)
      : [...currentParts, partId]
    onUpdateNodeParams(node.id, { targetParts: nextParts })
  }

  const customRuleCount = (node.params?.customRules ?? []).filter((r) => r.enabled).length
  const isRootScene = node.type === 'scene_shot'

  return createPortal(
    <div
      className="wf-node-dialog-backdrop"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') { e.preventDefault(); onClose() }
        if (e.key === 'Tab') {
          const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea, [tabindex="0"]') ?? [])
            .filter((element) => element.getClientRects().length > 0)
          const first = controls[0], last = controls[controls.length - 1]
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last?.focus() }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="wf-node-dialog-window wf-node-config-modal"
        data-mcp-region="workflow_node_config"
        data-mcp-dialog="true"
        role="dialog"
        aria-modal="true"
        aria-label={`Cấu hình khối ${node.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div className="wf-node-dialog-header">
          <div className="wf-node-dialog-icon">
            {renderWorkflowNodeIcon(node.type, { width: 15, height: 15 })}
          </div>
          <div className="wf-node-dialog-title-group">
            <div className="wf-node-dialog-title-row">
              <span className="wf-node-dialog-title">{node.title}</span>
              <span className="wf-node-dialog-tag">{nodeSpec?.shortTitle ?? node.type}</span>
            </div>
            <span className="wf-node-dialog-role">{activeShotLabel ?? 'Cấu hình node'}</span>
          </div>

          <div className="wf-node-dialog-actions">
            <button
              type="button"
              className={`wf-node-dialog-toggle${node.enabled ? ' on' : ''}`}
              title={node.enabled ? 'Khối đang BẬT (Bấm để tắt)' : 'Khối đang TẮT (Bấm để bật)'}
              onClick={() => onToggleNode(node.id)}
            >
              {node.enabled ? '✓ Đang Bật' : '⛔ Tắt'}
            </button>
            <button
              type="button"
              className="wf-node-dialog-close"
              title="Đóng và giữ cấu hình (Escape)"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="wf-node-dialog-workspace">
          {project && <WorkflowCameraMonitor key={node.id} project={project} node={node} />}
          <section className="wf-node-dialog-settings" data-mcp-region="workflow_node_settings">
        {/* 2. Dải Tab Điều Khiển */}
        <div className="wf-node-dialog-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preset'}
            className={`wf-node-dialog-tab${activeTab === 'preset' ? ' active' : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            ⚙ Thông số
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'targets'}
            className={`wf-node-dialog-tab${activeTab === 'targets' ? ' active' : ''}`}
            onClick={() => setActiveTab('targets')}
          >
            ◎ Đối tượng ({binding.boundTargets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'actions'}
            className={`wf-node-dialog-tab${activeTab === 'actions' ? ' active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            ✦ Hiệu ứng ({customRuleCount})
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'connections'} className={`wf-node-dialog-tab${activeTab === 'connections' ? ' active' : ''}`} onClick={() => setActiveTab('connections')}>⇄ Kết nối</button>
        </div>

        {/* 3. Thân Cuộn Nội Dung */}
        <div className="wf-node-dialog-body">
          {activeTab === 'preset' && node.type === 'layer_transform' && <WorkflowTransformBody node={node} project={project} onUpdateNodeParams={onUpdateNodeParams} />}
          {activeTab === 'preset' && node.type !== 'layer_transform' && <WorkflowNodeParameters node={node} onChangeNodePreset={onChangeNodePreset} onUpdateNodeParams={onUpdateNodeParams} onUpdateNodeDirective={onUpdateNodeDirective} />}
          {activeTab === 'connections' && <WorkflowNodeConnections node={node} workflow={workflow} onConnectPorts={onConnectPorts} onDisconnectEdge={onDisconnectEdge} />}
          {activeTab === 'targets' && (
            <div className="wf-subtab-pane">
              {binding ? (
                <>
                  {/* Chế độ gán Layer: Tự động vs Thủ công */}
                  <div className="wf-target-mode-bar">
                    <button
                      type="button"
                      className={`wf-preset-pill${node.params?.targetMode !== 'custom' ? ' active' : ''}`}
                      onClick={() =>
                        onUpdateNodeParams(node.id, { targetMode: 'auto', targetLayerIds: [] })
                      }
                    >
                      ⚡ Tự động theo vai trò (Auto)
                    </button>
                    <button
                      type="button"
                      className={`wf-preset-pill${node.params?.targetMode === 'custom' ? ' active' : ''}`}
                      onClick={() =>
                        onUpdateNodeParams(node.id, {
                          targetMode: 'custom',
                          targetLayerIds: (binding.boundTargets ?? []).map((t) => t.id)
                        })
                      }
                    >
                      🎯 Chọn thủ công từng Layer
                    </button>
                  </div>

                  {/* Danh sách Layer gán mục tiêu */}
                  <div className="wf-field-group">
                    <label className="wf-field-label">
                      Danh sách Layer trong phân cảnh ({(binding.boundTargets ?? []).length}/{(binding.allBindableTargets ?? []).length} đang gán):
                    </label>
                    <div className="wf-target-layers-grid">
                      {(binding.allBindableTargets ?? []).map((item) => {
                        const isSelected = (binding.boundTargets ?? []).some((t) => t.id === item.id)
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`wf-target-layer-card${isSelected ? ' selected' : ''}`}
                            onClick={() => handleToggleTargetLayer(item.id)}
                          >
                            <span className="wf-target-check">{isSelected ? '☑' : '☐'}</span>
                            <span className="wf-target-kind">{getTargetKindIcon(item.kind)}</span>
                            <span className="wf-target-name">{item.name}</span>
                            <span className="wf-target-depth">Z: {item.zDepth}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Các bộ phận con chịu tác động */}
                  {binding.subParts && binding.subParts.length > 0 && (
                    <div className="wf-field-group">
                      <label className="wf-field-label">Bộ phận con chịu tác động:</label>
                      <div className="wf-part-chips-wrap">
                        {binding.subParts.map((p) => {
                          const isActive = binding.activeParts?.some((ap) => ap.id === p.id) ?? false
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`wf-part-chip${isActive ? ' active' : ''}`}
                              onClick={() => handleToggleSubPart(p.id)}
                            >
                              <span>{p.icon}</span>
                              <span>{p.label}</span>
                              <span className="wf-part-chip-check">{isActive ? '✓' : '+'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="wf-target-empty">
                  <span>Chưa có dữ liệu liên kết Layer cho khối này</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="wf-subtab-pane">
              <WorkflowActionBuilder
                node={node}
                bindableTargets={binding?.allBindableTargets ?? []}
                activeShotLabel={activeShotLabel}
                onUpdateNodeParams={onUpdateNodeParams}
                onSpawnLogicNode={onSpawnLogicNode}
                onShowToast={onShowToast}
              />
            </div>
          )}
        </div>

          </section>
        </div>
        {/* 4. Footer */}
        <div className="wf-node-dialog-footer">
          {!isRootScene && onDeleteNode ? (
            <button
              type="button"
              className="wf-node-dialog-del-btn"
              title="Xóa khối này khỏi sơ đồ và ngắt hiệu ứng"
              onClick={() => {
                onDeleteNode(node.id)
                onClose()
              }}
            >
              🗑️ Xóa khối này
            </button>
          ) : (
            <span />
          )}

          <span className="wf-node-save-hint">Thay đổi cập nhật trực tiếp · Có thể hoàn tác bằng Ctrl+Z</span>
          <button
            type="button"
            className="btn primary sm"
            onClick={onClose}
          >
            Xong · Lưu cấu hình
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
