import React, { useEffect, useMemo, useState } from 'react'
import type {
  Project,
  WorkflowAiBlueprint,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { WORKFLOW_NODE_SPECS, WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { resolveNodeTargetBinding } from '../../project/workflowEngine'
import { renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowActionBuilder } from './WorkflowActionBuilder'
import { WorkflowNodePreview, getTargetKindIcon } from './WorkflowNodePreview'

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
  const [activeTab, setActiveTab] = useState<'preset' | 'targets' | 'actions'>('preset')

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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

  return (
    <div
      className="wf-node-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
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
          <div className="wf-node-dialog-icon" style={{ background: nodeSpec?.color ?? '#38bdf8' }}>
            {renderWorkflowNodeIcon(node.type, { width: 15, height: 15 })}
          </div>
          <div className="wf-node-dialog-title-group">
            <div className="wf-node-dialog-title-row">
              <span className="wf-node-dialog-title">{node.title}</span>
              <span className="wf-node-dialog-tag">{nodeSpec?.category ?? node.type}</span>
            </div>
            <span className="wf-node-dialog-role">🤖 {node.aiAgentRole}</span>
          </div>

          <div className="wf-node-dialog-actions">
            {onPreviewNode && (
              <button
                type="button"
                className="btn ghost sm"
                title="Chạy thử hiệu ứng khối này trên Cảnh 3D"
                onClick={() => onPreviewNode(node)}
              >
                👁 Xem thử 3D
              </button>
            )}
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
              title="Đóng (Escape)"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. Dải Tab Điều Khiển */}
        <div className="wf-node-dialog-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preset'}
            className={`wf-node-dialog-tab${activeTab === 'preset' ? ' active' : ''}`}
            onClick={() => setActiveTab('preset')}
          >
            ⚙️ Chế độ & Cường độ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'targets'}
            className={`wf-node-dialog-tab${activeTab === 'targets' ? ' active' : ''}`}
            onClick={() => setActiveTab('targets')}
          >
            🎯 Gán Layer 2.5D ({binding.boundTargets.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'actions'}
            className={`wf-node-dialog-tab${activeTab === 'actions' ? ' active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            🧩 Kho Node & FX ({customRuleCount})
          </button>
        </div>

        {/* 3. Thân Cuộn Nội Dung */}
        <div className="wf-node-dialog-body">
          {activeTab === 'preset' && (
            <div className="wf-subtab-pane">
              {/* Presets 1-Click Cards */}
              {nodeSpec && nodeSpec.presets.length > 0 && (
                <div className="wf-preset-cards-list" role="radiogroup" aria-label="Chọn kịch bản xử lý mẫu">
                  {nodeSpec.presets.map((p) => {
                    const isCurrent = node.preset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`wf-preset-option-card${isCurrent ? ' active' : ''}`}
                        style={{ ['--node-c' as string]: nodeSpec.color }}
                        onClick={() => onChangeNodePreset(node.id, p.id)}
                      >
                        <div className="wf-preset-option-head">
                          <span className={`wf-preset-radio${isCurrent ? ' on' : ''}`}>
                            {isCurrent ? '●' : '○'}
                          </span>
                          <strong>{p.label}</strong>
                        </div>
                        <div className="wf-preset-option-desc">{p.summary}</div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Thanh trượt Cường độ & Tốc độ */}
              <div className="wf-compact-controls-box">
                <div className="wf-field-row">
                  <label className="wf-field-label">
                    Cường độ tác động:{' '}
                    <strong>{((node.params?.intensity ?? 1.0) * 100).toFixed(0)}%</strong>
                  </label>
                  <input
                    type="range"
                    className="wf-range"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={node.params?.intensity ?? 1.0}
                    onChange={(e) =>
                      onUpdateNodeParams(node.id, { intensity: parseFloat(e.target.value) })
                    }
                  />
                </div>

                <div className="wf-field-row">
                  <label className="wf-field-label">
                    Tốc độ / Tần số:{' '}
                    <strong>{(node.params?.speedMultiplier ?? 1.0).toFixed(2)}x</strong>
                  </label>
                  <input
                    type="range"
                    className="wf-range"
                    min={0.25}
                    max={3.0}
                    step={0.05}
                    value={node.params?.speedMultiplier ?? 1.0}
                    onChange={(e) =>
                      onUpdateNodeParams(node.id, { speedMultiplier: parseFloat(e.target.value) })
                    }
                  />
                </div>

                {/* Các công tắc chuyên biệt theo từng loại node */}
                <div className="wf-check-pills-row">
                  {node.type === 'scene_shot' && (
                    <>
                      <label className="wf-check-pill">
                        <input
                          type="checkbox"
                          checked={node.params?.autoArrangeZ !== false}
                          onChange={(e) =>
                            onUpdateNodeParams(node.id, { autoArrangeZ: e.target.checked })
                          }
                        />
                        <span>Tự xếp độ sâu Z</span>
                      </label>
                      <label className="wf-check-pill">
                        <input
                          type="checkbox"
                          checked={Boolean(node.params?.ensureGround)}
                          onChange={(e) =>
                            onUpdateNodeParams(node.id, { ensureGround: e.target.checked })
                          }
                        />
                        <span>Tạo mặt đất 3D</span>
                      </label>
                    </>
                  )}
                  {node.type === 'physics_fx' && (
                    <label className="wf-check-pill">
                      <input
                        type="checkbox"
                        checked={Boolean(node.params?.spawnParticles)}
                        onChange={(e) =>
                          onUpdateNodeParams(node.id, { spawnParticles: e.target.checked })
                        }
                      />
                      <span>Tự thêm lớp Hạt FX</span>
                    </label>
                  )}
                  {node.type === 'camera_director' && (
                    <>
                      <label className="wf-check-pill">
                        <input
                          type="checkbox"
                          checked={
                            node.params?.enableDof === true ||
                            node.params?.logicId === 'logic-cam-dof'
                          }
                          onChange={(e) =>
                            onUpdateNodeParams(node.id, { enableDof: e.target.checked })
                          }
                        />
                        <span>Xóa phông (DOF)</span>
                      </label>
                      <label className="wf-check-pill">
                        <input
                          type="checkbox"
                          checked={
                            node.params?.logicId === 'logic-cam-shake' ||
                            (node.params?.camShakeAmount ?? 0) > 0 ||
                            node.preset === 'dramatic_handheld_action'
                          }
                          onChange={(e) =>
                            onUpdateNodeParams(node.id, {
                              camShakeAmount: e.target.checked ? 6 : 0
                            })
                          }
                        />
                        <span>Rung Handheld</span>
                      </label>
                    </>
                  )}
                  {node.type === 'audio_lipsync' && (
                    <label className="wf-check-pill">
                      <input
                        type="checkbox"
                        checked={node.params?.autoLipSync !== false}
                        onChange={(e) =>
                          onUpdateNodeParams(node.id, { autoLipSync: e.target.checked })
                        }
                      />
                      <span>Tự động Lip-Sync miệng</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Chỉ thị AI Directive */}
              <div className="wf-field-group">
                <label className="wf-field-label">Chỉ thị cho AI & Lệnh xử lý:</label>
                <textarea
                  className="wf-textarea"
                  rows={2}
                  value={node.aiDirective}
                  onChange={(e) => onUpdateNodeDirective(node.id, e.target.value)}
                  placeholder="Ghi chú hoặc chỉ thị cho tác nhân AI khi điều khiển khối này..."
                />
              </div>

              {/* Danh sách chân cắm Port và tình trạng kết nối */}
              {nodeSpec && nodeSpec.outputs.length > 0 && onConnectPorts && onDisconnectEdge && (
                <div className="wf-field-group">
                  <label className="wf-field-label">Kết nối Cổng đầu ra (Bấm 1 chạm để Nối / Ngắt):</label>
                  <div className="wf-port-links-list">
                    {nodeSpec.outputs.map((outPort) => {
                      const pSpec = WORKFLOW_PORT_SPECS[outPort]
                      const compatibleTargets = workflow.nodes.filter(
                        (n) => n.id !== node.id && WORKFLOW_NODE_SPECS[n.type]?.inputs.includes(outPort)
                      )
                      const existingEdges = workflow.edges.filter(
                        (e) => e.fromNode === node.id && e.fromPort === outPort
                      )
                      return (
                        <div key={outPort} className="wf-port-link-row">
                          <span className="wf-port-chip" style={{ color: pSpec?.color }}>
                            {pSpec?.shortLabel ?? outPort}
                          </span>
                          <span className="wf-port-arrow">➔</span>
                          <div className="wf-port-target-chips">
                            {compatibleTargets.length === 0 ? (
                              <span className="wf-port-none">Chưa có khối đích nhận cổng này</span>
                            ) : (
                              compatibleTargets.map((tgt) => {
                                const isWired = existingEdges.some((e) => e.toNode === tgt.id)
                                const edge = existingEdges.find((e) => e.toNode === tgt.id)
                                return (
                                  <button
                                    key={tgt.id}
                                    type="button"
                                    className={`wf-target-chip${isWired ? ' wired' : ''}`}
                                    title={
                                      isWired
                                        ? `Đang nối tới "${tgt.title}". Bấm để NGẮT DÂY.`
                                        : `Chưa nối tới "${tgt.title}". Bấm để NỐI DÂY NGAY.`
                                    }
                                    onClick={() => {
                                      if (isWired && edge) {
                                        onDisconnectEdge(edge.id)
                                      } else {
                                        onConnectPorts(node.id, outPort, tgt.id, outPort)
                                      }
                                    }}
                                  >
                                    <span className="wf-chip-dot">{isWired ? '●' : '○'}</span>
                                    <span>{tgt.title}</span>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

          <button
            type="button"
            className="btn primary sm"
            onClick={onClose}
          >
            ✓ Đóng (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
