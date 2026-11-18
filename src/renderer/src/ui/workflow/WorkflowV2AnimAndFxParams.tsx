import { WorkflowMotionPathSettings } from './WorkflowMotionPathSettings'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import React, { useState } from 'react'
import type { Layer, LayerMotion } from '@shared/types'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_RIG_PRESET_OPTIONS,
  extractClusterDynamicActions,
  saveClusterCustomAction
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { WorkflowV2BboxMotionPanel } from './WorkflowV2BboxMotionPanel'
import { resolveActionTargetLayerIds } from './WorkflowV2MotionAndRigEditors'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import { WorkflowV2RigPresetPicker } from './WorkflowV2RigPresetPicker'
import '../../styles/virtualLightInspector.css'

export { WorkflowV2FxParams } from './WorkflowV2FxParams'

function resolveTargetLayer(props: WorkflowV2NodeParamsProps): Layer | undefined {
  const ids = props.node.params?.targetLayerIds ?? []
  return (
    props.project.layers.find((l) => ids.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
    props.project.layers.find((l) => ids.includes(l.id))
  )
}

/**
 * Node Hành động Nhân vật (`anim_fx`) — Đơn trách nhiệm cho Hành động Nhân vật / Cụm 2.5D
 * theo giây (Rig Action Clip & Động tác Tên động Cụm 2.5D).
 * Không nhồi nhét logic Loop hay Hiệu ứng vào đây.
 */
export function WorkflowV2AnimFxParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onSpawnFollowupNode } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const activeRigOpt = WORKFLOW_V2_RIG_PRESET_OPTIONS.find((r) => r.id === p.rigActionPreset)
  const effInstId = p.instanceId ?? layer?.composite?.instanceId
  const dynamicActions = extractClusterDynamicActions(props.project, effInstId, layer)
  const activeDynAction = dynamicActions.find((a) => a.id === p.customActionId)
  const [customNameDraft, setCustomNameDraft] = useState('')

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      {dynamicActions.length > 0 && (
        <div className="vl-subcard" style={{ marginBottom: 6 }}>
          <div className="vl-row-header">
            <span className="vl-title">🎭 Động tác Cụm 2.5D (Tên động theo Xưởng)</span>
            <span className="vl-value-badge">
              {activeDynAction?.name || p.customActionName || `${dynamicActions.length} động tác`}
            </span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {dynamicActions.map((act, idx) => {
              const isSel = p.customActionId === act.id
              const spanFull = dynamicActions.length % 2 === 1 && idx === dynamicActions.length - 1
              return (
                <button
                  key={act.id}
                  type="button"
                  className={`vl-pill-btn ${isSel ? 'active-amber' : ''}`}
                  style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                  title={`${act.name} (${act.speedHz}Hz · ${act.layerIds.length} mảnh)`}
                  onClick={() => {
                    const start = p.timeStart ?? layer?.inPoint ?? 0
                    onUpdate(
                      {
                        animMode: 'rig_clip',
                        customActionId: act.id,
                        customActionName: act.name,
                        customActionSpeedHz: act.speedHz,
                        rigActionPreset: 'none',
                        timeEnd: Number((start + act.duration).toFixed(2))
                      },
                      `Hành động Nhân vật: ${act.name}`
                    )
                  }}
                >
                  <span>
                    {act.icon} {act.name}
                  </span>
                  <small className="wf-v2-pill-dur">{act.duration}s</small>
                </button>
              )
            })}
          </div>
          {activeDynAction && (
            <ParamSlider
              label="Tốc độ nhịp (Nhép/Nháy)"
              min={0.3}
              max={8.0}
              step={0.1}
              value={p.customActionSpeedHz ?? activeDynAction.speedHz ?? 3.5}
              format={(v) => `${v.toFixed(1)} Hz`}
              onChange={(v) => onUpdate({ customActionSpeedHz: v })}
            />
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              type="text"
              value={customNameDraft}
              onChange={(e) => setCustomNameDraft(e.target.value)}
              placeholder={activeDynAction ? `Đổi tên "${activeDynAction.name}"...` : 'Đặt tên động tác mới (VD: Nhép miệng)...'}
              style={{
                flex: 1,
                minWidth: 0,
                height: 24,
                padding: '0 7px',
                fontSize: 10.5,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line-soft)',
                background: 'var(--bg-1)',
                color: 'var(--text)'
              }}
            />
            <button
              type="button"
              className="wf-v2-mini-btn active"
              onClick={() => {
                const clean = customNameDraft.trim()
                if (!clean) return
                const actId = activeDynAction?.id ?? `act-${Date.now().toString(36)}`
                const isBlink = /nháy|mắt|blink/i.test(clean)
                useEditor.getState().update((d) => {
                  saveClusterCustomAction(
                    d,
                    effInstId,
                    {
                      id: actId,
                      name: clean,
                      icon: isBlink ? '👁' : '👄',
                      kind: 'sprite_cycle',
                      layerIds: activeDynAction?.layerIds ?? (p.targetLayerIds ?? []),
                      speedHz: p.customActionSpeedHz ?? (isBlink ? 0.8 : 4.2),
                      duration: 2.5,
                      loop: true
                    },
                    d.layers.find((l) => l.id === layer?.id)
                  )
                }, 'wf-save-dyn-action')
                onUpdate({ customActionId: actId, customActionName: clean }, `Hành động Nhân vật: ${clean}`)
                setCustomNameDraft('')
              }}
            >
              💾 Lưu tên
            </button>
          </div>
        </div>
      )}

      <div className="vl-row-header">
        <span className="vl-title">🦴 Hành động Khung xương Nhân vật theo Giây</span>
        <span className="vl-value-badge">
          {activeRigOpt ? activeRigOpt.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '') : 'Chưa chọn'}
        </span>
      </div>

      <WorkflowV2RigPresetPicker
        value={p.rigActionPreset}
        variant="amber"
        cols={2}
        onPick={(ro) => {
          const start = p.timeStart ?? layer?.inPoint ?? 0
          const cleanName = ro.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')
          onUpdate(
            {
              animMode: 'rig_clip',
              customActionId: undefined,
              customActionName: undefined,
              rigActionPreset: ro.id,
              intensity: p.intensity ?? 1.0,
              timeEnd: Number((start + ro.duration).toFixed(2))
            },
            `Hành động Nhân vật: ${cleanName}`
          )
        }}
      />

      <div className="vl-subcard">
        <ParamSlider
          label="Biên độ cử động"
          min={0.2}
          max={2.0}
          step={0.05}
          value={p.intensity ?? 1.0}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdate({ intensity: v })}
        />
        <OptionPills
          cols={2}
          options={[
            { id: 'stagger', label: '🌊 Lệch pha tự nhiên' },
            { id: 'sync', label: '🔗 Đồng bộ cùng pha' }
          ]}
          value={p.staggerPhase !== false ? 'stagger' : 'sync'}
          onPick={(id) => onUpdate({ staggerPhase: id === 'stagger' })}
        />
        <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
          {p.rigActionPreset && p.rigActionPreset !== 'none' && (
            <button
              type="button"
              className="wf-v2-direct-btn"
              onClick={() => onUpdate({ rigActionPreset: 'none' }, 'Hành động Nhân vật (Tắt)')}
            >
              ⏹ Tắt hành động
            </button>
          )}
          {onSpawnFollowupNode && (
            <button
              type="button"
              className="wf-v2-direct-btn"
              title="Tạo tiếp 1 Node Hành động Nhân vật nối đuôi trên Timeline (+3s)"
              onClick={() => onSpawnFollowupNode(3.0)}
            >
              + Nối chặng Hành động (+3s)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Node Motion (`action`) — Chuyên trách Quỹ đạo Di chuyển (A → B) và Dao động Chu kỳ trong không gian 2.5D.
 */
export function WorkflowV2ActionParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onSpawnFollowupNode } = props
  const p = node.params ?? {}
  const targetIds = React.useMemo(() => resolveActionTargetLayerIds(props), [props])
  const layer = props.project.layers.find((l) => targetIds.includes(l.id))
  const motion: LayerMotion = layer?.motion ?? {
    enabled: true,
    type: 'float',
    speed: 1,
    amount: p.intensity ?? 0.65
  }

  const activeMode = resolveMotionMode(p)

  const patchMotion = (patch: Partial<LayerMotion>, mergeKey = 'wf-v2-motion'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        l.motion = {
          ...(l.motion ?? { enabled: true, type: 'float', speed: 1, amount: 0.65, amplitude: [8, 12, 0] }),
          ...patch
        }
      }
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode && patch.amount !== undefined) {
        wfNode.params = { ...(wfNode.params ?? {}), intensity: patch.amount }
      }
    }, mergeKey)
    if (!layer && patch.amount !== undefined) onUpdate({ intensity: patch.amount })
  }

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="wf-v2-seg-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === 'bbox'}
          className={`wf-v2-seg-tab${activeMode === 'bbox' ? ' active' : ''}`}
          onClick={() => {
            onUpdate(
              {
                motionMode: 'bbox',
                actionPreset: 'bbox_target',
                bboxPathType: p.bboxPathType ?? 'shortest',
                bboxTargetScalePct: p.bboxTargetScalePct ?? 135,
                depthMode: p.depthMode ?? 'flat_2d'
              },
              'Motion: Đặt BBox Đích'
            )
          }}
          title="Đặt BBox Đích: di chuyển từ vị trí đầu tới đích, phóng to/thu nhỏ và đi theo chiều sâu Z"
        >
          🎯 BBox Đích
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === 'path'}
          className={`wf-v2-seg-tab${activeMode === 'path' ? ' active' : ''}`}
          onClick={() => {
            onUpdate({ motionMode: 'path', actionPreset: 'custom_draw' })
          }}
        >
          ✏️ Vẽ Line
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === 'cycle'}
          className={`wf-v2-seg-tab${activeMode === 'cycle' ? ' active' : ''}`}
          onClick={() => {
            onUpdate({
              motionMode: 'cycle',
              actionPreset:
                p.actionPreset === 'custom_draw' || p.actionPreset === 'bbox_target'
                  ? 'float'
                  : p.actionPreset ?? 'float'
            })
          }}
        >
          🌊 Động Tác Nhanh
        </button>
      </div>

      {activeMode === 'bbox' ? (
        <WorkflowV2BboxMotionPanel props={props} onSpawnFollowupNode={onSpawnFollowupNode} />
      ) : activeMode === 'path' ? (
        <WorkflowMotionPathSettings props={props} />
      ) : (
        <>
          <div className="vl-row-header">
            <span className="vl-title">🌊 Chọn Động Tác Nhanh</span>
            <button
              type="button"
              className="wf-v2-mini-btn active"
              title="Phát thử (Preview) chuyển động trong cảnh"
              onClick={() => {
                const ed = useEditor.getState()
                ed.setTime(p.timeStart ?? 0)
                ed.setPlaying(!ed.playing)
              }}
            >
              ▶ Preview
            </button>
          </div>

          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {WORKFLOW_V2_ACTION_OPTIONS.map((o, idx) => {
              const active = (p.actionPreset ?? motion.type) === o.id
              const spanFull =
                WORKFLOW_V2_ACTION_OPTIONS.length % 2 === 1 && idx === WORKFLOW_V2_ACTION_OPTIONS.length - 1
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                  onClick={() =>
                    onUpdate(
                      {
                        motionMode: 'cycle',
                        actionPreset: o.id,
                        rigActionPreset: 'none',
                        intensity: o.defaultAmount
                      },
                      `Motion: ${o.label.replace(/\s*\(.*\)/, '')}`
                    )
                  }
                >
                  {o.label.replace(/\s*\(.*\)/, '')}
                </button>
              )
            })}
          </div>

          <div className="vl-subcard">
            <ParamSlider
              label="Biên độ chuyển động"
              min={0.1}
              max={2.0}
              step={0.05}
              value={motion.amount ?? p.intensity ?? 0.65}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patchMotion({ amount: v }, 'wf-motion-amt')}
            />
            <ParamSlider
              label="Tốc độ nhịp"
              min={0.2}
              max={3.5}
              step={0.1}
              value={motion.speed ?? 1}
              format={(v) => `${v.toFixed(1)}x`}
              onChange={(v) => patchMotion({ speed: v }, 'wf-motion-spd')}
            />
          </div>
        </>
      )}
    </div>
  )
}
