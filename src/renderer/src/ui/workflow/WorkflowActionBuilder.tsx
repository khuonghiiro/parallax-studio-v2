import React, { useMemo, useState } from 'react'
import type {
  WorkflowBoundTarget,
  WorkflowCustomActionKind,
  WorkflowCustomActionRule,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import {
  WORKFLOW_CUSTOM_ACTION_CATALOG,
  getCustomActionSpec
} from '../../project/workflowStageEffects'
import { getTargetKindIcon } from './WorkflowNodePreview'

export interface WorkflowActionBuilderProps {
  node: WorkflowNode
  bindableTargets: WorkflowBoundTarget[]
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onShowToast: (msg: string) => void
}

export const WorkflowActionBuilder: React.FC<WorkflowActionBuilderProps> = ({
  node,
  bindableTargets,
  onUpdateNodeParams,
  onShowToast
}) => {
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

  const actionSpec = useMemo(
    () => getCustomActionSpec(actionKind) ?? WORKFLOW_CUSTOM_ACTION_CATALOG[0],
    [actionKind]
  )
  const customRules = node.params?.customRules ?? []

  const actionOptions = useMemo(
    () =>
      WORKFLOW_CUSTOM_ACTION_CATALOG.map((item) => ({
        value: item.kind,
        label: `${item.icon} ${item.label}`
      })),
    []
  )

  const targetOptions = useMemo(() => {
    const base = [
      {
        value: 'all',
        label: '✨ Tất cả Layer gắn với khối này'
      }
    ]
    for (const t of bindableTargets) {
      base.push({
        value: t.id,
        label: `${getTargetKindIcon(t.kind)} ${t.name} (${t.roleLabel})`
      })
    }
    return base
  }, [bindableTargets])

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
    const nextRules = customRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    )
    onUpdateNodeParams(node.id, { customRules: nextRules })
  }

  const handleDeleteRule = (ruleId: string) => {
    const nextRules = customRules.filter((r) => r.id !== ruleId)
    onUpdateNodeParams(node.id, { customRules: nextRules })
    onShowToast('Đã xóa lệnh chuyển động / tính năng khỏi khối!')
  }

  return (
    <div className="wf-binder-section wf-action-builder">
      <div className="wf-binder-head">
        <span className="wf-field-label">
          ➕ Thêm Chuyển động / Tính năng Mới ({customRules.length})
        </span>
        {customRules.length > 0 && (
          <button
            type="button"
            className="wf-binder-mode-btn"
            title="Xóa toàn bộ lệnh chuyển động riêng đã thêm vào khối này"
            onClick={() => onUpdateNodeParams(node.id, { customRules: [] })}
          >
            ✕ Xóa hết
          </button>
        )}
      </div>

      <div className="wf-action-builder-form">
        <div className="wf-action-row">
          <span className="wf-action-lbl">Chức năng:</span>
          <div className="wf-action-ctrl">
            <CustomSelect
              size="sm"
              value={actionKind}
              options={actionOptions}
              dropdownWidth={310}
              onChange={(v) => handleSelectAction(v as WorkflowCustomActionKind)}
              title="Chọn hiệu ứng chuyển động hoặc tính năng 2.5D muốn gắn thêm"
            />
          </div>
        </div>

        <div className="wf-action-row">
          <span className="wf-action-lbl">Áp dụng lên:</span>
          <div className="wf-action-ctrl">
            <CustomSelect
              size="sm"
              value={targetId}
              options={targetOptions}
              dropdownWidth={310}
              onChange={(v) => setTargetId(String(v))}
              title="Chọn Layer hoặc Cụm 2.5D nhận chuyển động này"
            />
          </div>
        </div>

        <div className="wf-action-sliders">
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
        </div>

        <button
          id="wf-btn-add-custom-action"
          type="button"
          className="btn primary sm wf-add-action-btn"
          onClick={handleAddRule}
          title={actionSpec.description}
        >
          <span>
            {actionSpec.icon} + Gắn &quot;{actionSpec.shortLabel}&quot; vào Khối
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
                      Tốc {rule.speed ?? 1}x · Biên {rule.amount ?? 1}
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
