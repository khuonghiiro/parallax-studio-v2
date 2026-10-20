import React, { useMemo, useState } from 'react'
import type {
  Project,
  WorkflowBoundTarget,
  WorkflowCustomActionKind,
  WorkflowCustomActionRule,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  WORKFLOW_CUSTOM_ACTION_CATALOG,
  applyRuleMutationToProjectLayer,
  getCustomActionSpec
} from '../../project/workflowStageEffects'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  type WorkflowLogicNodeCategory
} from '../../project/workflowLogicNodes'
import { getTargetKindIcon } from './WorkflowNodePreview'

export interface WorkflowActionBuilderProps {
  node: WorkflowNode
  bindableTargets: WorkflowBoundTarget[]
  activeShotLabel?: string
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onSpawnLogicNode?: (logicId: string) => void
  onShowToast: (msg: string) => void
}

export const WorkflowActionBuilder: React.FC<WorkflowActionBuilderProps> = ({
  node,
  bindableTargets,
  activeShotLabel,
  onUpdateNodeParams,
  onSpawnLogicNode,
  onShowToast
}) => {
  const [logicCategory, setLogicCategory] = useState<'all' | WorkflowLogicNodeCategory>('all')
  const defaultAction: WorkflowCustomActionKind =
    node.type === 'physics_fx'
      ? 'virtual_light_candle'
      : node.type === 'layer_assembly'
        ? 'mesh_elastic'
        : 'wind'

  const [actionKind, setActionKind] = useState<WorkflowCustomActionKind>(defaultAction)
  const [targetId, setTargetId] = useState<string>('all')
  const [speed, setSpeed] = useState<number>(1.0)
  const [amount, setAmount] = useState<number>(1.0)

  const filteredLogicNodes = useMemo(
    () =>
      logicCategory === 'all'
        ? WORKFLOW_LOGIC_NODE_CATALOG
        : WORKFLOW_LOGIC_NODE_CATALOG.filter((item) => item.category === logicCategory),
    [logicCategory]
  )

  const actionSpec = useMemo(
    () => getCustomActionSpec(actionKind) ?? WORKFLOW_CUSTOM_ACTION_CATALOG[0],
    [actionKind]
  )
  const customRules = node.params?.customRules ?? []

  const handleSelectAction = (nextKind: WorkflowCustomActionKind) => {
    setActionKind(nextKind)
    const spec = getCustomActionSpec(nextKind)
    if (spec) {
      setSpeed(spec.defaultSpeed)
      setAmount(spec.defaultAmount)
    }
  }

  const handleAddRule = () => {
    const targetObj = bindableTargets.find((t) => t.id === targetId)
    const targetName = targetId === 'all' ? 'Tất cả Layer' : targetObj?.name ?? 'Layer chỉ định'
    const newRule: WorkflowCustomActionRule = {
      id: `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      label: `${actionSpec.shortLabel} (${targetName})`,
      targetId,
      targetName,
      actionKind,
      speed: Number(speed.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      enabled: true
    }
    const nextRules = [...customRules, newRule]
    onUpdateNodeParams(node.id, { customRules: nextRules })
    onShowToast(`➕ Đã thêm "${actionSpec.shortLabel}" cho ${targetName} và áp dụng lên Cảnh 3D!`)
  }

  const handleToggleRule = (ruleId: string) => {
    const targetRule = customRules.find((r) => r.id === ruleId)
    if (targetRule) {
      const nextEnabled = !targetRule.enabled
      useEditor.getState().update((draft) => {
        applyRuleMutationToProjectLayer(draft as Project, targetRule, nextEnabled)
      })
    }
    const nextRules = customRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    )
    onUpdateNodeParams(node.id, { customRules: nextRules })
  }

  const handleDeleteRule = (ruleId: string) => {
    const targetRule = customRules.find((r) => r.id === ruleId)
    if (targetRule) {
      useEditor.getState().update((draft) => {
        applyRuleMutationToProjectLayer(draft as Project, targetRule, false)
      })
    }
    const nextRules = customRules.filter((r) => r.id !== ruleId)
    onUpdateNodeParams(node.id, { customRules: nextRules })
    onShowToast('Đã xóa lệnh chuyển động / tính năng và đồng bộ tắt trên Layer!')
  }

  return (
    <div
      className="wf-binder-section wf-action-builder"
      data-mcp-region="workflow_action_builder"
    >
      {/* PHẦN A: KHO NODE LOGIC ĐỘC LẬP (MỖI NODE ĐẠI DIỆN 1 LOGIC — KẾT NỐI ĐỂ CHẠY THEO LUỒNG) */}
      {onSpawnLogicNode && (
        <div className="wf-logic-node-catalog">
          <div className="wf-binder-head">
            <span className="wf-field-label">
              🧩 Kho Node Logic (Bấm để thả Node vào luồng {activeShotLabel ? `· ${activeShotLabel}` : ''})
            </span>
          </div>
          <div className="wf-action-target-pills" role="tablist" aria-label="Danh mục Node Logic">
            <button
              type="button"
              className={`wf-target-select-pill${logicCategory === 'all' ? ' active' : ''}`}
              onClick={() => setLogicCategory('all')}
            >
              ✨ Tất cả ({WORKFLOW_LOGIC_NODE_CATALOG.length})
            </button>
            {WORKFLOW_LOGIC_NODE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`wf-target-select-pill${logicCategory === cat.id ? ' active' : ''}`}
                onClick={() => setLogicCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="wf-action-chip-grid wf-logic-node-grid">
            {filteredLogicNodes.map((item) => (
              <button
                key={item.id}
                id={`wf-spawn-logic-${item.id}`}
                type="button"
                className="wf-action-chip-btn wf-logic-spawn-btn"
                title={`${item.title}\n${item.description}\n➔ Bấm để thả Node Logic này vào sơ đồ và tự nối dây theo luồng!`}
                onClick={() => onSpawnLogicNode(item.id)}
              >
                <span className="wf-action-chip-ic">{item.icon}</span>
                <span className="wf-action-chip-txt">{item.shortLabel}</span>
                <span className="wf-logic-plus-tag">+Node</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="wf-binder-head">
        <span className="wf-field-label">
          ⚡ Gắn nhanh hiệu ứng vào khối đang chọn ({node.title})
        </span>
        {customRules.length > 0 && (
          <button
            type="button"
            className="wf-binder-mode-btn"
            title="Xóa toàn bộ lệnh chuyển động riêng đã thêm vào khối này"
            onClick={() => {
              useEditor.getState().update((draft) => {
                for (const r of customRules) {
                  applyRuleMutationToProjectLayer(draft as Project, r, false)
                }
              })
              onUpdateNodeParams(node.id, { customRules: [] })
            }}
          >
            ✕ Xóa hết ({customRules.length})
          </button>
        )}
      </div>

      {/* Lưới Nút Bấm Trực Tiếp (Không dùng Combobox) */}
      <div className="wf-action-chip-grid" role="radiogroup" aria-label="Chọn chức năng chuyển động">
        {WORKFLOW_CUSTOM_ACTION_CATALOG.map((item) => {
          const active = item.kind === actionKind
          return (
            <button
              key={item.kind}
              type="button"
              className={`wf-action-chip-btn${active ? ' active' : ''}`}
              title={`${item.label}\n${item.description}`}
              onClick={() => handleSelectAction(item.kind)}
            >
              <span className="wf-action-chip-ic">{item.icon}</span>
              <span className="wf-action-chip-txt">{item.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Chọn đối tượng Layer bằng Pill trực tiếp */}
      <div className="wf-action-section-lbl">2. Áp dụng lên đối tượng:</div>
      <div className="wf-action-target-pills" role="radiogroup" aria-label="Chọn Layer áp dụng">
        <button
          type="button"
          className={`wf-target-select-pill${targetId === 'all' ? ' active' : ''}`}
          onClick={() => setTargetId('all')}
          title="Áp dụng cho tất cả Layer gắn với khối này"
        >
          ✨ Tất cả Layer ({bindableTargets.length})
        </button>
        {bindableTargets.slice(0, 8).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`wf-target-select-pill${targetId === t.id ? ' active' : ''}`}
            onClick={() => setTargetId(t.id)}
            title={`${t.name} (${t.roleLabel})`}
          >
            <span>{getTargetKindIcon(t.kind)}</span>
            <span className="wf-pill-trunc">{t.name}</span>
          </button>
        ))}
      </div>

      {/* Thanh trượt Tốc độ & Biên độ + Nút Thêm */}
      <div className="wf-action-bottom-bar">
        <label className="wf-action-slider-col" title="Tốc độ dao động hoặc di chuyển">
          <span>
            Tốc độ: <strong>{speed.toFixed(2)}x</strong>
          </span>
          <input
            type="range"
            className="wf-range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
          />
        </label>
        <label className="wf-action-slider-col" title="Biên độ chuyển động hoặc cường độ hiệu ứng">
          <span>
            Biên độ: <strong>{amount.toFixed(2)}</strong>
          </span>
          <input
            type="range"
            className="wf-range"
            min={0.2}
            max={2.0}
            step={0.05}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value))}
          />
        </label>
        <button
          id="wf-btn-add-custom-action"
          type="button"
          className="btn primary sm wf-add-action-btn"
          onClick={handleAddRule}
          title={actionSpec.description}
        >
          <span>
            {actionSpec.icon} + Gắn &quot;{actionSpec.shortLabel}&quot;
          </span>
        </button>
      </div>

      {/* Danh sách các lệnh chuyển động / tính năng đã thêm */}
      {customRules.length > 0 && (
        <div className="wf-custom-rules-list">
          {customRules.map((rule) => {
            const spec = getCustomActionSpec(rule.actionKind) ?? WORKFLOW_CUSTOM_ACTION_CATALOG[0]
            return (
              <div
                key={rule.id}
                className={`wf-custom-rule-item${rule.enabled ? ' enabled' : ' disabled'}`}
              >
                <button
                  type="button"
                  className={`wf-target-check${rule.enabled ? ' on' : ''}`}
                  title={rule.enabled ? 'Đang bật (Bấm để tạm tắt)' : 'Đang tắt (Bấm để bật)'}
                  onClick={() => handleToggleRule(rule.id)}
                >
                  {rule.enabled ? '✓' : ''}
                </button>
                <span className="wf-rule-ic">{spec.icon}</span>
                <div className="wf-rule-info">
                  <div className="wf-rule-title-line">
                    <strong>{spec.shortLabel}</strong>
                    <span className="wf-rule-param-pill">
                      {rule.id.startsWith('inspector-') ? '⇄ Inspector · ' : ''}Tốc {rule.speed ?? 1}x · Biên {rule.amount ?? 1}
                    </span>
                  </div>
                  <div className="wf-rule-target-line">🎯 {rule.targetName}</div>
                </div>
                <button
                  type="button"
                  className="wf-rule-del-btn"
                  title="Xóa lệnh chuyển động này"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
