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

type DialogTab = 'preset' | 'targets' | 'actions' | 'connections'

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
  onConnectPorts,
  onDisconnectEdge,
  onSpawnLogicNode,
  activeShotLabel,
  onShowToast
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<DialogTab>('preset')

  // Restore focus on unmount
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])

  const nodeSpec = WORKFLOW_NODE_SPECS[node.type]
  const nodeColor = nodeSpec?.color ?? '#38bdf8'
  const binding = useMemo(() => resolveNodeTargetBinding(node, project), [node, project])

  // --- Derived flags -------------------------------------------------------
  /** Entity nodes render the Transform slider body instead of preset/targets UI */
  const isEntity = node.type === 'layer_transform'
    || (node.type === 'layer_assembly'
      && !node.params?.logicId
      && !!node.params?.targetLayerIds?.length)
  const isRootScene = node.type === 'scene_shot'
  const canAddActions = (node.type === 'motion_choreography' || node.type === 'physics_fx')
    && !node.params?.logicId
  const customRuleCount = (node.params?.customRules ?? []).filter((r) => r.enabled).length
  const boundCount = binding?.boundTargets?.length ?? 0

  // --- Tab validation: reset stale tab when node changes or flags shift -----
  const availableTabs = useMemo<DialogTab[]>(() => {
    const tabs: DialogTab[] = ['preset']
    if (!isEntity) tabs.push('targets')
    if (canAddActions) tabs.push('actions')
    tabs.push('connections')
    return tabs
  }, [isEntity, canAddActions])

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) setActiveTab('preset')
  }, [availableTabs, activeTab])

  // Reset to preset tab when switching to a different node
  useEffect(() => { setActiveTab('preset') }, [node.id])

  // --- Handlers ------------------------------------------------------------
  const handleToggleTargetLayer = (targetId: string) => {
    if (!binding) return
    const currentCustom = node.params?.targetLayerIds ?? []
    const baseIds =
      node.params?.targetMode === 'custom' && currentCustom.length > 0
        ? currentCustom
        : (binding.boundTargets ?? [])
            .filter((t) => (binding.allBindableTargets ?? []).some((b) => b.id === t.id))
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
    const currentParts = (binding.activeParts ?? []).map((p) => p.id)
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

  const handleDelete = () => {
    // Parent already clears configNodeId after delete — no need to call onClose
    onDeleteNode?.(node.id)
  }

  // --- Tab definitions -----------------------------------------------------
  const tabDefs = useMemo(() => {
    const tabs: { id: DialogTab; label: string; badge?: number }[] = [
      { id: 'preset', label: '⚙ Thông số' }
    ]
    if (!isEntity) tabs.push({ id: 'targets', label: '◎ Đối tượng', badge: boundCount })
    if (canAddActions) tabs.push({ id: 'actions', label: '✦ Hiệu ứng', badge: customRuleCount })
    tabs.push({ id: 'connections', label: '⇄ Kết nối' })
    return tabs
  }, [isEntity, canAddActions, boundCount, customRuleCount])

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
        style={{ ['--wf-node-color' as string]: nodeColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Header ─────────────────────────────────────────────── */}
        <div className="wf-node-dialog-header">
          <div className="wf-node-dialog-icon" style={{ background: `color-mix(in srgb, ${nodeColor} 14%, var(--bg-2))`, color: nodeColor }}>
            {renderWorkflowNodeIcon(node.type, { width: 18, height: 18 })}
          </div>
          <div className="wf-node-dialog-title-group">
            <div className="wf-node-dialog-title-row">
              <span className="wf-node-dialog-title">{node.title}</span>
              <span className="wf-node-dialog-tag" style={{ borderColor: `color-mix(in srgb, ${nodeColor} 40%, var(--line))`, color: nodeColor }}>
                {nodeSpec?.shortTitle ?? node.type}
              </span>
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
              <span className="wf-toggle-dot" />
              <span className="wf-toggle-text">{node.enabled ? 'Bật' : 'Tắt'}</span>
            </button>
            <button
              type="button"
              className="wf-node-dialog-close"
              title="Đóng (Escape)"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 2. Workspace ──────────────────────────────────────────── */}
        <div className="wf-node-dialog-workspace">
          {project && <WorkflowCameraMonitor key={node.id} project={project} node={node} />}
          <section className="wf-node-dialog-settings" data-mcp-region="workflow_node_settings">
            {/* Tab strip */}
            <div className="wf-node-dialog-tabs" role="tablist">
              {tabDefs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`wf-node-dialog-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="wf-tab-label">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="wf-tab-badge">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="wf-node-dialog-body">
              {activeTab === 'preset' && isEntity && (
                <WorkflowTransformBody
                  node={node}
                  project={project}
                  onUpdateNodeParams={onUpdateNodeParams}
                />
              )}
              {activeTab === 'preset' && !isEntity && (
                <WorkflowNodeParameters
                  node={node}
                  onChangeNodePreset={onChangeNodePreset}
                  onUpdateNodeParams={onUpdateNodeParams}
                  onUpdateNodeDirective={onUpdateNodeDirective}
                />
              )}
              {activeTab === 'connections' && (
                <WorkflowNodeConnections
                  node={node}
                  workflow={workflow}
                  onConnectPorts={onConnectPorts}
                  onDisconnectEdge={onDisconnectEdge}
                />
              )}

              {activeTab === 'targets' && (
                <div className="wf-subtab-pane">
                  {binding ? (
                    <>
                      {/* Target mode: Auto vs Custom */}
                      <div className="wf-target-mode-bar">
                        <button
                          type="button"
                          className={`wf-preset-pill${node.params?.targetMode !== 'custom' ? ' active' : ''}`}
                          onClick={() =>
                            onUpdateNodeParams(node.id, { targetMode: 'auto', targetLayerIds: [] })
                          }
                        >
                          ⚡ Tự động theo vai trò
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
                          🎯 Chọn thủ công
                        </button>
                      </div>

                      {/* Bindable layer list */}
                      <div className="wf-field-group">
                        <label className="wf-field-label">
                          Layer trong phân cảnh ({boundCount}/{(binding.allBindableTargets ?? []).length} đang gán):
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
                                <span className={`wf-target-check${isSelected ? ' on' : ''}`}>
                                  {isSelected ? '✓' : ''}
                                </span>
                                <span className="wf-target-kind">{getTargetKindIcon(item.kind)}</span>
                                <span className="wf-target-name">{item.name}</span>
                                <span className="wf-target-depth">Z: {item.zDepth ?? 0}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Sub-parts toggle */}
                      {(binding.subParts ?? []).length > 0 && (
                        <div className="wf-field-group">
                          <label className="wf-field-label">Bộ phận con chịu tác động:</label>
                          <div className="wf-part-chips-wrap">
                            {(binding.subParts ?? []).map((p) => {
                              const isActive = (binding.activeParts ?? []).some((ap) => ap.id === p.id)
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

        {/* ── 3. Footer ────────────────────────────────────────────── */}
        <div className="wf-node-dialog-footer">
          {!isRootScene && onDeleteNode ? (
            <button
              type="button"
              className="wf-node-dialog-del-btn"
              title="Xóa khối này khỏi sơ đồ và ngắt hiệu ứng"
              onClick={handleDelete}
            >
              🗑️ Xóa khối
            </button>
          ) : <span className="wf-footer-spacer" />}

          <span className="wf-node-save-hint">Thay đổi cập nhật trực tiếp · Ctrl+Z để hoàn tác</span>
          <button type="button" className="btn primary sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
