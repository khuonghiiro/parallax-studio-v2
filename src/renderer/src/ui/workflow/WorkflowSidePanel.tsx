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
import {
  getDefaultPartsForNode,
  resolveNodeTargetBinding,
  validateAndNormalizeWorkflowJson
} from '../../project/workflowEngine'
import { IconCopy, IconSparkles } from '../icons'
import { IconWfJsonCode, renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowNodePreview, getTargetKindIcon } from './WorkflowNodePreview'
import { WorkflowActionBuilder } from './WorkflowActionBuilder'
import { evaluateNodeRuntimeTelemetry } from './workflowLayoutAndFlow'

export type WorkflowInspectorSubTab = 'preset' | 'targets' | 'actions'

export interface WorkflowSidePanelProps {
  workflow: WorkflowGraph
  project?: Project
  playing?: boolean
  time?: number
  blueprint: WorkflowAiBlueprint
  selectedNode: WorkflowNode | null
  sideMode: 'node' | 'json'
  inspectorSubTab?: WorkflowInspectorSubTab
  onChangeSideMode: (mode: 'node' | 'json') => void
  onChangeInspectorSubTab?: (tab: WorkflowInspectorSubTab) => void
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onUpdateNodeDirective: (nodeId: string, directive: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onConnectPorts: (
    fromNode: string,
    fromPort: WorkflowPortKind,
    toNode: string,
    toPort: WorkflowPortKind
  ) => void
  onDisconnectEdge: (edgeId: string) => void
  onApplyJsonGraph: (nextGraph: WorkflowGraph) => void
  onSpawnLogicNode?: (logicId: string) => void
  activeShotLabel?: string
  onShowToast: (msg: string) => void
  onPreviewNode?: (node: WorkflowNode) => void
}

export const WorkflowSidePanel: React.FC<WorkflowSidePanelProps> = ({
  workflow,
  project,
  playing = false,
  time = 0,
  blueprint,
  selectedNode,
  sideMode,
  inspectorSubTab: externalSubTab,
  onChangeSideMode,
  onChangeInspectorSubTab,
  onChangeNodePreset,
  onUpdateNodeDirective,
  onUpdateNodeParams,
  onConnectPorts,
  onDisconnectEdge,
  onApplyJsonGraph,
  onSpawnLogicNode,
  activeShotLabel,
  onShowToast,
  onPreviewNode
}) => {
  const [localSubTab, setLocalSubTab] = useState<WorkflowInspectorSubTab>('preset')
  const activeSubTab = externalSubTab ?? localSubTab
  const setSubTab = (tab: WorkflowInspectorSubTab) => {
    setLocalSubTab(tab)
    onChangeInspectorSubTab?.(tab)
  }

  const [jsonSubTab, setJsonSubTab] = useState<'raw' | 'agents'>('raw')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const activeNodeIds = useMemo(
    () => new Set(blueprint.agents.map((a) => a.nodeId)),
    [blueprint.agents]
  )

  const binding = useMemo(
    () => (selectedNode ? resolveNodeTargetBinding(selectedNode, project) : null),
    [selectedNode, project]
  )

  const serializedJson = useMemo(() => {
    return JSON.stringify(
      {
        ...workflow,
        aiBlueprint: {
          executionOrder: blueprint.executionOrder,
          pipelineSummary: blueprint.pipelineSummary,
          agents: blueprint.agents.map((a) => ({
            step: a.step,
            role: a.aiAgentRole,
            nodeType: a.nodeType,
            preset: a.preset,
            directive: a.aiDirective,
            boundTargets: a.boundTargets.map((t) => ({
              id: t.id,
              name: t.name,
              kind: t.kind,
              role: t.roleLabel
            })),
            activeParts: a.activeParts.map((p) => p.shortLabel),
            mcpTools: a.recommendedMcpTools
          }))
        }
      },
      null,
      2
    )
  }, [workflow, blueprint])

  useEffect(() => {
    setJsonText(serializedJson)
    setJsonError(null)
  }, [serializedJson])

  const handleApplyJson = () => {
    try {
      const normalized = validateAndNormalizeWorkflowJson(jsonText)
      onApplyJsonGraph(normalized)
      setJsonError(null)
      onShowToast('Đã nạp cấu hình Workflow JSON thành công!')
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(serializedJson).catch(() => undefined)
    onShowToast('Đã sao chép JSON Workflow & AI Blueprint vào bộ nhớ tạm!')
  }

  const handleToggleTargetLayer = (targetId: string) => {
    if (!selectedNode || !binding) return
    const currentCustom = selectedNode.params?.targetLayerIds ?? []
    const baseIds =
      selectedNode.params?.targetMode === 'custom' && currentCustom.length > 0
        ? currentCustom
        : binding.boundTargets
            .filter((t) => binding.allBindableTargets.some((b) => b.id === t.id))
            .map((t) => t.id)

    const exists = baseIds.includes(targetId)
    const nextIds = exists ? baseIds.filter((id) => id !== targetId) : [...baseIds, targetId]
    if (nextIds.length === 0) {
      onUpdateNodeParams(selectedNode.id, { targetMode: 'auto', targetLayerIds: [] })
    } else {
      onUpdateNodeParams(selectedNode.id, { targetMode: 'custom', targetLayerIds: nextIds })
    }
  }

  const handleToggleSubPart = (partId: string) => {
    if (!selectedNode || !binding) return
    const currentParts = binding.activeParts.map((p) => p.id)
    const exists = currentParts.includes(partId)
    if (exists && currentParts.length <= 1) {
      onShowToast('Cần giữ ít nhất 1 bộ phận tác động cho khối chức năng!')
      return
    }
    const nextParts = exists
      ? currentParts.filter((id) => id !== partId)
      : [...currentParts, partId]
    onUpdateNodeParams(selectedNode.id, { targetParts: nextParts })
  }

  const nodeSpec = selectedNode ? WORKFLOW_NODE_SPECS[selectedNode.type] : null
  const customRuleCount = (selectedNode?.params?.customRules ?? []).filter((r) => r.enabled).length

  return (
    <aside className="wf-side-panel" data-mcp-region="workflow_inspector">
      {/* Side Panel Mode Header */}
      <div className="wf-side-header">
        <button
          type="button"
          className={`wf-side-tab${sideMode === 'node' ? ' active' : ''}`}
          onClick={() => onChangeSideMode('node')}
        >
          <IconSparkles width={12} height={12} />
          <span>Cấu hình Khối & 2.5D</span>
        </button>
        <button
          id="wf-tab-json-blueprint"
          type="button"
          className={`wf-side-tab${sideMode === 'json' ? ' active' : ''}`}
          onClick={() => onChangeSideMode('json')}
        >
          <IconWfJsonCode width={12} height={12} />
          <span>JSON & Tác nhân AI</span>
        </button>
      </div>

      {sideMode === 'node' ? (
        <div className="wf-side-body">
          {selectedNode && nodeSpec && binding ? (
            <>
              {/* 1. Thanh tiêu đề Khối đang chọn */}
              <div className="wf-inspector-card compact">
                <div className="wf-inspector-title-row">
                  <span className="wf-node-icon" style={{ background: nodeSpec.color }}>
                    {renderWorkflowNodeIcon(selectedNode.type, { width: 13, height: 13 })}
                  </span>
                  <div className="wf-inspector-title-text">
                    <strong>{selectedNode.params?.logicId ? selectedNode.title : nodeSpec.title}</strong>
                    <span className="wf-agent-role-badge" title="Tác nhân logic AI điều khiển qua MCP">
                      🤖 {selectedNode.aiAgentRole}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm wf-preview-try-btn"
                    title="Áp dụng và chạy thử hiệu ứng này ngay trên khung nhìn 3D"
                    onClick={() => onPreviewNode?.(selectedNode)}
                  >
                    ▶ Xem thử 3D
                  </button>
                </div>
              </div>

              {/* 2. Thanh 3 Tab con gọn gàng (Không cần cuộn dài rối mắt) */}
              <div className="wf-inspector-subtabs" role="tablist">
                <button
                  id="wf-subtab-preset"
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === 'preset'}
                  className={`wf-inspector-subtab${activeSubTab === 'preset' ? ' active' : ''}`}
                  onClick={() => setSubTab('preset')}
                  title="Chọn kịch bản xử lý mẫu, thanh trượt cường độ và cổng kết nối"
                >
                  ⚙️ Chế độ
                </button>
                <button
                  id="wf-subtab-targets"
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === 'targets'}
                  className={`wf-inspector-subtab${activeSubTab === 'targets' ? ' active' : ''}`}
                  onClick={() => setSubTab('targets')}
                  title="Gán Layer 2.5D và chọn bộ phận con chịu tác động"
                >
                  🎯 Layer ({binding.boundTargets.length})
                </button>
                <button
                  id="wf-subtab-actions"
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === 'actions'}
                  className={`wf-inspector-subtab${activeSubTab === 'actions' ? ' active' : ''}`}
                  onClick={() => setSubTab('actions')}
                  title="Kho Node Logic để thả vào sơ đồ kết nối theo luồng, hoặc gắn nhanh hiệu ứng chuyển động & ánh sáng 2.5D"
                >
                  🧩 Kho Node & FX ({customRuleCount})
                </button>
              </div>

              {/* TAB 1: CHẾ ĐỘ XỬ LÝ (PRESET CARDS 1 CHẠM - KHÔNG COMBOBOX), CƯỜNG ĐỘ & CỔNG */}
              {activeSubTab === 'preset' && (
                <div className="wf-subtab-pane">
                  <div className="wf-preset-cards-list" role="radiogroup" aria-label="Chọn kịch bản xử lý mẫu">
                    {nodeSpec.presets.map((p) => {
                      const isCurrent = selectedNode.preset === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`wf-preset-option-card${isCurrent ? ' active' : ''}`}
                          style={{ ['--node-c' as string]: nodeSpec.color }}
                          onClick={() => onChangeNodePreset(selectedNode.id, p.id)}
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

                  {/* Thanh trượt Cường độ + Công tắc nhanh trên cùng 1 khung gọn */}
                  <div className="wf-compact-controls-box">
                    <div className="wf-field-row">
                      <label className="wf-field-label">
                        Cường độ tác động:{' '}
                        <strong>{((selectedNode.params?.intensity ?? 1.0) * 100).toFixed(0)}%</strong>
                      </label>
                      <input
                        type="range"
                        className="wf-range"
                        min={0.3}
                        max={2.0}
                        step={0.05}
                        value={selectedNode.params?.intensity ?? 1.0}
                        onChange={(e) =>
                          onUpdateNodeParams(selectedNode.id, { intensity: parseFloat(e.target.value) })
                        }
                      />
                    </div>

                    <div className="wf-quick-switches">
                      {selectedNode.type === 'scene_shot' && (
                        <>
                          <label className="wf-check-pill">
                            <input
                              type="checkbox"
                              checked={selectedNode.params?.autoArrangeZ !== false}
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, { autoArrangeZ: e.target.checked })
                              }
                            />
                            <span>Tự giãn tầng Z</span>
                          </label>
                          <label className="wf-check-pill">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedNode.params?.ensureGround)}
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, { ensureGround: e.target.checked })
                              }
                            />
                            <span>Tạo mặt đất 3D</span>
                          </label>
                        </>
                      )}
                      {selectedNode.type === 'physics_fx' && (
                        <label className="wf-check-pill">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedNode.params?.spawnParticles)}
                            onChange={(e) =>
                              onUpdateNodeParams(selectedNode.id, { spawnParticles: e.target.checked })
                            }
                          />
                          <span>Tự thêm lớp Hạt FX</span>
                        </label>
                      )}
                      {selectedNode.type === 'camera_director' && (
                        <>
                          <label className="wf-check-pill">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.params?.enableDof === true ||
                                selectedNode.params?.logicId === 'logic-cam-dof'
                              }
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, { enableDof: e.target.checked })
                              }
                            />
                            <span>Xóa phông (DOF)</span>
                          </label>
                          <label className="wf-check-pill">
                            <input
                              type="checkbox"
                              checked={
                                selectedNode.params?.logicId === 'logic-cam-shake' ||
                                (selectedNode.params?.camShakeAmount ?? 0) > 0 ||
                                selectedNode.preset === 'dramatic_handheld_action'
                              }
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, {
                                  camShakeAmount: e.target.checked ? 6 : 0
                                })
                              }
                            />
                            <span>Rung Handheld</span>
                          </label>
                        </>
                      )}
                      {selectedNode.type === 'audio_lipsync' && (
                        <label className="wf-check-pill">
                          <input
                            type="checkbox"
                            checked={selectedNode.params?.autoLipSync !== false}
                            onChange={(e) =>
                              onUpdateNodeParams(selectedNode.id, { autoLipSync: e.target.checked })
                            }
                          />
                          <span>Tự động Lip-Sync miệng</span>
                        </label>
                      )}
                    </div>

                    {/* Điều khiển tinh chỉnh dành riêng cho Node Camera */}
                    {selectedNode.type === 'camera_director' && (
                      <div className="wf-node-fine-tuning" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(selectedNode.params?.logicId === 'logic-cam-shake' ||
                          (selectedNode.params?.camShakeAmount ?? 0) > 0) && (
                          <div className="wf-field-row">
                            <label className="wf-field-label" style={{ fontSize: 11 }}>
                              Độ rung Handheld: <strong>{selectedNode.params?.camShakeAmount ?? 6}px</strong>
                            </label>
                            <input
                              type="range"
                              className="wf-range"
                              min={1}
                              max={16}
                              step={1}
                              value={selectedNode.params?.camShakeAmount ?? 6}
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, { camShakeAmount: parseInt(e.target.value, 10) })
                              }
                            />
                          </div>
                        )}
                        {(selectedNode.params?.logicId === 'logic-cam-dof' ||
                          selectedNode.params?.enableDof) && (
                          <div className="wf-field-row">
                            <label className="wf-field-label" style={{ fontSize: 11 }}>
                              Khoảng tiêu cự: <strong>{selectedNode.params?.camFocusDistance ?? 1200}px</strong>
                            </label>
                            <input
                              type="range"
                              className="wf-range"
                              min={200}
                              max={3200}
                              step={50}
                              value={selectedNode.params?.camFocusDistance ?? 1200}
                              onChange={(e) =>
                                onUpdateNodeParams(selectedNode.id, { camFocusDistance: parseInt(e.target.value, 10) })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Port Wiring Matrix */}
                  {nodeSpec.outputs.length > 0 && (
                    <div className="wf-field-group">
                      <label className="wf-field-label">Kết nối Cổng đầu ra (Bấm 1 chạm để Nối / Ngắt)</label>
                      <div className="wf-port-links-list">
                        {nodeSpec.outputs.map((outPort) => {
                          const pSpec = WORKFLOW_PORT_SPECS[outPort]
                          const compatibleTargets = workflow.nodes.filter(
                            (t) =>
                              t.id !== selectedNode.id &&
                              WORKFLOW_NODE_SPECS[t.type]?.inputs.includes(outPort)
                          )
                          return compatibleTargets.map((target) => {
                            const existingEdge = workflow.edges.find(
                              (e) =>
                                e.fromNode === selectedNode.id &&
                                e.fromPort === outPort &&
                                e.toNode === target.id &&
                                e.toPort === outPort
                            )
                            return (
                              <button
                                key={`${outPort}-${target.id}`}
                                type="button"
                                className={`wf-quick-link-btn${existingEdge ? ' connected' : ''}`}
                                onClick={() => {
                                  if (existingEdge) onDisconnectEdge(existingEdge.id)
                                  else onConnectPorts(selectedNode.id, outPort, target.id, outPort)
                                }}
                              >
                                <span
                                  className="wf-port-dot"
                                  style={{ background: pSpec?.color ?? '#38bdf8' }}
                                />
                                <span className="wf-quick-link-text">
                                  {pSpec?.shortLabel} ➔{' '}
                                  <strong>{WORKFLOW_NODE_SPECS[target.type]?.shortTitle}</strong>
                                </span>
                                <span className="wf-quick-link-state">
                                  {existingEdge ? 'Đang nối ✓' : '+ Nối cổng'}
                                </span>
                              </button>
                            )
                          })
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mô phỏng trực quan chức năng */}
                  <WorkflowNodePreview
                    node={selectedNode}
                    project={project}
                    mode="inspector"
                    runtimeTelemetry={evaluateNodeRuntimeTelemetry(
                      selectedNode,
                      project,
                      time,
                      playing,
                      activeNodeIds.has(selectedNode.id),
                      blueprint.agents.find((a) => a.nodeId === selectedNode.id)?.step,
                      Math.max(1, blueprint.agents.length),
                      workflow,
                      activeNodeIds
                    )}
                    onPreviewInViewport={onPreviewNode}
                  />
                </div>
              )}

              {/* TAB 2: GẮN LAYER / CỤM 2.5D & BỘ PHẬN TÁC ĐỘNG */}
              {activeSubTab === 'targets' && (
                <div className="wf-subtab-pane" data-mcp-region="workflow_target_binder">
                  <div className="wf-binder-section">
                    <div className="wf-binder-head">
                      <span className="wf-field-label">
                        🎯 Layer / Cụm 2.5D ({binding.boundTargets.length})
                      </span>
                      <div className="wf-binder-mode-tabs">
                        <button
                          type="button"
                          className={`wf-binder-mode-btn${binding.mode === 'auto' ? ' active' : ''}`}
                          title="Tự động nhận diện Layer, Cụm 2.5D và Mô hình 3D theo đúng vai trò"
                          onClick={() =>
                            onUpdateNodeParams(selectedNode.id, {
                              targetMode: 'auto',
                              targetLayerIds: []
                            })
                          }
                        >
                          🔄 Tự động
                        </button>
                        <button
                          type="button"
                          className={`wf-binder-mode-btn${binding.mode === 'custom' ? ' active' : ''}`}
                          title="Chỉ định đích danh Layer hoặc Cụm 2.5D được khối này xử lý"
                          onClick={() => {
                            const seedIds = binding.boundTargets
                              .filter((t) => binding.allBindableTargets.some((b) => b.id === t.id))
                              .map((t) => t.id)
                            onUpdateNodeParams(selectedNode.id, {
                              targetMode: 'custom',
                              targetLayerIds:
                                seedIds.length > 0
                                  ? seedIds
                                  : binding.allBindableTargets.slice(0, 2).map((b) => b.id)
                            })
                          }}
                        >
                          🎯 Chỉ định
                        </button>
                      </div>
                    </div>

                    {binding.allBindableTargets.length > 0 ? (
                      <div className="wf-target-checklist">
                        {binding.allBindableTargets.map((item) => {
                          const isBound = binding.boundTargets.some((b) => b.id === item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`wf-target-row${isBound ? ' bound' : ''}`}
                              onClick={() => handleToggleTargetLayer(item.id)}
                              title={`Bấm để ${isBound ? 'bỏ gắn' : 'gắn'} "${item.name}" vào khối ${nodeSpec.shortTitle}`}
                            >
                              <span className={`wf-target-check${isBound ? ' on' : ''}`}>
                                {isBound ? '✓' : ''}
                              </span>
                              <span className="wf-target-kind-ic">{getTargetKindIcon(item.kind)}</span>
                              <div className="wf-target-info">
                                <div className="wf-target-name-line">
                                  <strong>{item.name}</strong>
                                  <span className="wf-target-role-tag">{item.roleLabel}</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="wf-target-empty">
                        {binding.boundTargets.map((t) => (
                          <span key={t.id} className="wf-target-chip">
                            {getTargetKindIcon(t.kind)} {t.name} ({t.roleLabel})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="wf-binder-section">
                    <div className="wf-binder-head">
                      <span className="wf-field-label">
                        🦴 Bộ phận 2.5D ({binding.activeParts.length}/{binding.subParts.length})
                      </span>
                      <button
                        type="button"
                        className="wf-binder-mode-btn"
                        title="Khôi phục các bộ phận mặc định của Preset hiện tại"
                        onClick={() =>
                          onUpdateNodeParams(selectedNode.id, {
                            targetParts: getDefaultPartsForNode(selectedNode)
                          })
                        }
                      >
                        ↺ Mặc định
                      </button>
                    </div>

                    <div className="wf-subparts-grid">
                      {binding.subParts.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          className={`wf-subpart-btn${part.active ? ' active' : ''}`}
                          title={part.description}
                          onClick={() => handleToggleSubPart(part.id)}
                        >
                          <span className="wf-subpart-check">{part.active ? '✓' : '+'}</span>
                          <span className="wf-subpart-ic">{part.icon}</span>
                          <span className="wf-subpart-text">{part.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KHO NODE LOGIC & THÊM CHUYỂN ĐỘNG / TÍNH NĂNG MỚI (1 CHẠM - KHÔNG COMBOBOX) */}
              {activeSubTab === 'actions' && (
                <div className="wf-subtab-pane">
                  <WorkflowActionBuilder
                    node={selectedNode}
                    bindableTargets={binding.allBindableTargets}
                    activeShotLabel={activeShotLabel}
                    onUpdateNodeParams={onUpdateNodeParams}
                    onSpawnLogicNode={onSpawnLogicNode}
                    onShowToast={onShowToast}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="wf-empty-note">Chọn một khối chức năng trên sơ đồ để tinh chỉnh.</div>
          )}
        </div>
      ) : (
        <div className="wf-side-body wf-json-panel" data-mcp-region="workflow_json_panel">
          <div className="wf-json-subtabs">
            <button
              type="button"
              className={`wf-json-subtab${jsonSubTab === 'raw' ? ' active' : ''}`}
              onClick={() => setJsonSubTab('raw')}
            >
              JSON
            </button>
            <button
              type="button"
              className={`wf-json-subtab${jsonSubTab === 'agents' ? ' active' : ''}`}
              onClick={() => setJsonSubTab('agents')}
            >
              Tác nhân AI ({blueprint.agents.length})
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn ghost sm"
              title="Sao chép JSON Workflow & AI Blueprint"
              onClick={handleCopyJson}
            >
              <IconCopy width={12} height={12} />
              <span>Copy</span>
            </button>
            {jsonSubTab === 'raw' && (
              <button
                type="button"
                className="btn primary sm"
                title="Áp dụng chỉnh sửa JSON vào sơ đồ Workflow"
                onClick={handleApplyJson}
              >
                Nạp JSON
              </button>
            )}
          </div>

          {jsonError && <div className="wf-json-error">{jsonError}</div>}

          {jsonSubTab === 'raw' ? (
            <textarea
              className="wf-json-textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              aria-label="Cấu hình Workflow JSON"
            />
          ) : (
            <div className="wf-agents-blueprint-list">
              {blueprint.agents.map((ag) => (
                <div key={ag.nodeId} className="wf-agent-step-card">
                  <div className="wf-agent-step-head">
                    <span className="wf-agent-step-idx">#{ag.step}</span>
                    <strong>{ag.aiAgentRole}</strong>
                    <span className="wf-agent-preset-tag">{ag.preset}</span>
                  </div>
                  <div className="wf-agent-directive">{ag.aiDirective}</div>
                  {ag.boundTargets && ag.boundTargets.length > 0 && (
                    <div className="wf-agent-tools">
                      <span>🎯 Gắn:</span>
                      {ag.boundTargets.slice(0, 3).map((t) => (
                        <code key={t.id}>
                          {t.name} ({t.roleLabel})
                        </code>
                      ))}
                    </div>
                  )}
                  {ag.activeParts && ag.activeParts.length > 0 && (
                    <div className="wf-agent-tools">
                      <span>🦴 Bộ phận:</span>
                      {ag.activeParts.map((p) => (
                        <code key={p.id}>{p.shortLabel}</code>
                      ))}
                    </div>
                  )}
                  <div className="wf-agent-tools">
                    <span>MCP:</span>
                    {ag.recommendedMcpTools.slice(0, 4).map((t) => (
                      <code key={t}>{t}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
