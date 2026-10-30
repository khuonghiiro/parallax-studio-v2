import { WorkflowMotionPathSettings } from './WorkflowMotionPathSettings'
import { resolveMotionMode } from '../../project/workflowMotionMode'
import React, { useState } from 'react'
import type { GlowSide, Layer, LayerGlow, LayerMotion } from '@shared/types'
import { createDefaultLayerPhysics } from '../../engine/layerPhysics'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_RIG_PRESET_OPTIONS,
  bakeCustomMotionPathToScene,
  extractClusterDynamicActions,
  saveClusterCustomAction
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row } from '../controls'
import { deleteLayerEffect, toggleLayerEffect } from '../timeline/timelineEffects'
import { WorkflowV2BboxMotionPanel } from './WorkflowV2BboxMotionPanel'
import { resolveActionTargetLayerIds } from './WorkflowV2MotionAndRigEditors'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import '../../styles/virtualLightInspector.css'

const NEON_SWATCHES = ['#3dd6f5', '#f59e0b', '#ec4899', '#a855f7', '#10b981', '#fb7185']

function resolveTargetLayer(props: WorkflowV2NodeParamsProps): Layer | undefined {
  const ids = props.node.params?.targetLayerIds ?? []
  return (
    props.project.layers.find((l) => ids.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
    props.project.layers.find((l) => ids.includes(l.id))
  )
}

/**
 * Node Animation (`anim_fx`) — Chuyên trách Hành động Nhân vật theo giây (Rig Action Clip)
 * và Nhịp Biến đổi Keyframe FX (Pop-in, Rung chấn, Nhịp đập, Hiện/Mờ dần).
 */
export function WorkflowV2AnimFxParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onScrubTime, onSpawnFollowupNode } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const fxList = (layer?.appliedEffects ?? []).filter((f) => f.category !== 'motion')
  const presetId = p.animFxPreset ?? fxList[fxList.length - 1]?.presetId ?? 'pulse'
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]
  const isGlow = opt.fxCategory === 'glow'

  const isComposite25D = Boolean(layer?.composite?.instanceId || p.instanceId)
  const defaultTab: 'rig_clip' | 'keyframe_fx' =
    p.animMode ??
    (p.rigActionPreset && p.rigActionPreset !== 'none'
      ? 'rig_clip'
      : isComposite25D && !p.animFxPreset
        ? 'rig_clip'
        : 'keyframe_fx')

  const [tab, setTab] = useState<'rig_clip' | 'keyframe_fx'>(defaultTab)
  const activeTab = p.animMode ?? tab

  const countVal = p.animFxCount ?? opt.defaultCount ?? 2
  const intensityVal = p.intensity ?? opt.defaultIntensity ?? (presetId === 'shake' ? 18 : 1.25)
  const colorVal = p.animFxColor ?? layer?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
  const sideVal: GlowSide = p.animFxSide ?? layer?.glow?.side ?? 'outer'
  const thicknessVal = p.animFxThickness ?? layer?.glow?.thickness ?? 10
  const speedVal = p.animFxSpeed ?? layer?.glow?.speed ?? 1.5
  const minIntVal = p.animFxMinIntensity ?? layer?.glow?.minIntensity ?? 0.15

  const activeRigOpt = WORKFLOW_V2_RIG_PRESET_OPTIONS.find((r) => r.id === p.rigActionPreset)
  const effInstId = p.instanceId ?? layer?.composite?.instanceId
  const dynamicActions = extractClusterDynamicActions(props.project, effInstId, layer)
  const activeDynAction = dynamicActions.find((a) => a.id === p.customActionId)
  const [customNameDraft, setCustomNameDraft] = useState('')

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="wf-v2-seg-tabs" role="tablist">
        <button
          type="button"
          className={`wf-v2-seg-tab${activeTab === 'rig_clip' ? ' active' : ''}`}
          onClick={() => {
            setTab('rig_clip')
            onUpdate({ animMode: 'rig_clip' })
          }}
        >
          🦴 Hành động Nhân vật
        </button>
        <button
          type="button"
          className={`wf-v2-seg-tab${activeTab === 'keyframe_fx' ? ' active' : ''}`}
          onClick={() => {
            setTab('keyframe_fx')
            onUpdate({ animMode: 'keyframe_fx' })
          }}
        >
          ⚡ Nhịp Keyframe FX
        </button>
      </div>

      {activeTab === 'rig_clip' ? (
        <>
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
                          `Hoạt ảnh: ${act.name}`
                        )
                      }}
                    >
                      <span>{act.icon} {act.name}</span>
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
                    onUpdate({ customActionId: actId, customActionName: clean }, `Hoạt ảnh: ${clean}`)
                    setCustomNameDraft('')
                  }}
                >
                  💾 Lưu tên
                </button>
              </div>
            </div>
          )}
          <div className="vl-row-header">
            <span className="vl-title">🦴 Hành động Khung xương theo Giây</span>
            <span className="vl-value-badge">
              {activeRigOpt ? activeRigOpt.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '') : 'Chưa chọn'}
            </span>
          </div>

          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {WORKFLOW_V2_RIG_PRESET_OPTIONS.map((ro) => {
              const active = p.rigActionPreset === ro.id
              return (
                <button
                  key={ro.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={`${ro.description} (${ro.duration}s)`}
                  onClick={() => {
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
                      `Hoạt ảnh Xương: ${cleanName}`
                    )
                  }}
                >
                  <span>{ro.shortLabel}</span>
                  <small className="wf-v2-pill-dur">{ro.duration}s</small>
                </button>
              )
            })}
          </div>

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
                  onClick={() => onUpdate({ rigActionPreset: 'none' }, 'Hoạt ảnh Xương (Tắt)')}
                >
                  ⏹ Tắt hành động
                </button>
              )}
              {onSpawnFollowupNode && (
                <button
                  type="button"
                  className="wf-v2-direct-btn"
                  title="Tạo tiếp 1 Node Animation nối đuôi trên Timeline (+3s) để chuỗi hoá hành động nhân vật"
                  onClick={() => onSpawnFollowupNode(3.0)}
                >
                  + Nối chặng Hành động (+3s)
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="vl-row-header">
            <span className="vl-title">⚡ Nhịp Biến Đổi &amp; Keyframe FX</span>
            <span className="vl-value-badge">
              {opt.badge} {opt.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}
            </span>
          </div>

          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {WORKFLOW_V2_ANIM_FX_OPTIONS.map((item, idx) => {
              const active = item.id === opt.id && (!p.rigActionPreset || p.rigActionPreset === 'none')
              const spanFull =
                WORKFLOW_V2_ANIM_FX_OPTIONS.length % 2 === 1 && idx === WORKFLOW_V2_ANIM_FX_OPTIONS.length - 1
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  style={spanFull ? { gridColumn: '1 / -1' } : undefined}
                  title={item.label}
                  onClick={() => {
                    const start = p.timeStart ?? layer?.inPoint ?? 0
                    onUpdate(
                      {
                        animMode: 'keyframe_fx',
                        rigActionPreset: 'none',
                        animFxPreset: item.id,
                        animFxCount: item.defaultCount,
                        intensity: item.defaultIntensity,
                        animFxColor: item.defaultColor,
                        timeEnd: Number((start + item.defaultDuration).toFixed(2))
                      },
                      `Hoạt ảnh FX: ${item.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}`
                    )
                  }}
                >
                  <span>{item.shortLabel}</span>
                  <small className="wf-v2-pill-dur">{item.defaultDuration}s</small>
                </button>
              )
            })}
          </div>

          <div className="vl-subcard">
            {(presetId === 'shake' ||
              presetId === 'popIn' ||
              presetId === 'pulse' ||
              presetId === 'blink' ||
              presetId === 'neonBlink') && (
              <ParamSlider
                label={
                  presetId === 'shake'
                    ? 'Số lần rung'
                    : presetId === 'popIn'
                      ? 'Số lần nảy'
                      : presetId === 'pulse'
                        ? 'Số nhịp đập'
                        : 'Số lần chớp'
                }
                min={1}
                max={16}
                step={1}
                value={countVal}
                format={(v) => `${Math.round(v)} lần`}
                onChange={(v) => onUpdate({ animFxCount: Math.round(v) })}
              />
            )}

            {presetId === 'shake' && (
              <ParamSlider
                label="Biên độ rung"
                min={2}
                max={60}
                step={2}
                value={intensityVal}
                format={(v) => `±${Math.round(v)}px`}
                onChange={(v) => onUpdate({ intensity: v })}
              />
            )}

            {(presetId === 'popIn' || presetId === 'pulse') && (
              <ParamSlider
                label={presetId === 'popIn' ? 'Độ vọt nảy' : 'Cỡ nhịp đập'}
                min={1.05}
                max={1.85}
                step={0.05}
                value={intensityVal}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onUpdate({ intensity: v })}
              />
            )}

            {isGlow && (
              <>
                <Row label="Hướng viền" title="Chiếu viền sáng ra ngoài nét vẽ, vào trong hay cả hai phía">
                  <OptionPills
                    cols={3}
                    options={[
                      { id: 'outer', label: 'Ngoài nét' },
                      { id: 'both', label: '2 phía' },
                      { id: 'inner', label: 'Trong nét' }
                    ]}
                    value={sideVal}
                    onPick={(id) => onUpdate({ animFxSide: id as GlowSide })}
                  />
                </Row>
                <ParamSlider
                  label="Cường độ sáng"
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  value={intensityVal}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => onUpdate({ intensity: v })}
                />
                <ParamSlider
                  label="Độ dày viền"
                  min={2}
                  max={32}
                  step={1}
                  value={thicknessVal}
                  format={(v) => `${Math.round(v)}px`}
                  onChange={(v) => onUpdate({ animFxThickness: v })}
                />
                {presetId !== 'neonSolid' && (
                  <Row label="Nhịp / Đáy" title="Tốc độ nhịp sáng (Hz) và mức sáng tối thiểu khi hạ nhịp">
                    <NumberInput
                      axis="hz"
                      value={speedVal}
                      step={0.2}
                      precision={1}
                      min={0.2}
                      max={8}
                      onChange={(v) => onUpdate({ animFxSpeed: v })}
                    />
                    <NumberInput
                      axis="min"
                      value={minIntVal}
                      step={0.05}
                      precision={2}
                      min={0}
                      max={0.9}
                      onChange={(v) => onUpdate({ animFxMinIntensity: v })}
                    />
                  </Row>
                )}
                <Row label="Màu Neon" title="Màu phát sáng viền Alpha">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                    <ColorInput
                      compact
                      value={colorVal}
                      onChange={(val) => onUpdate({ animFxColor: val })}
                      title="Chọn màu viền Neon"
                    />
                    <div className="vl-swatch-row">
                      {NEON_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          className={`vl-swatch-btn ${colorVal.toLowerCase() === hex ? 'active' : ''}`}
                          style={{ background: hex }}
                          onClick={() => onUpdate({ animFxColor: hex })}
                        />
                      ))}
                    </div>
                  </div>
                </Row>
              </>
            )}
          </div>
        </>
      )}

      {fxList.length > 0 && layer && (
        <div className="vl-subcard">
          <div className="vl-row-header">
            <span className="vl-subtitle">Ngăn xếp hoạt ảnh trên Layer ({fxList.length})</span>
            <button
              type="button"
              className="wf-v2-direct-btn"
              style={{ flex: '0 0 auto', height: 20, padding: '0 7px' }}
              onClick={() => onScrubTime(p.timeStart ?? 0)}
            >
              ▶ Xem thử
            </button>
          </div>
          {fxList.map((fx) => (
            <div key={fx.id} className="wf-v2-fx-stack-item">
              <span>{fx.badge}</span>
              <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fx.name}
              </strong>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-dim)' }}>
                {fx.startTime.toFixed(1)}s–{(fx.startTime + fx.duration).toFixed(1)}s
              </span>
              <button
                type="button"
                className={`wf-v2-icon-btn ${fx.enabled ? 'on' : 'off'}`}
                onClick={() =>
                  useEditor.getState().update((d) => {
                    const l = d.layers.find((x) => x.id === layer.id)
                    if (l) toggleLayerEffect(l, fx.id, !fx.enabled)
                  })
                }
              >
                {fx.enabled ? '●' : '○'}
              </button>
              <button
                type="button"
                className="wf-v2-icon-btn danger"
                title="Gỡ hiệu ứng này"
                onClick={() =>
                  useEditor.getState().update((d) => {
                    const l = d.layers.find((x) => x.id === layer.id)
                    if (l) deleteLayerEffect(l, fx.id)
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
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
              'Motion: Đặt BBox Đích (đầu → đích)'
            )
          }}
          title="Đặt BBox Đích đích dạng mờ như Camera: di chuyển từ đầu tới đích, phóng to/thu nhỏ khớp BBox đích và đi theo chiều sâu Z"
        >
          🎯 BBox Đích (đầu→đích)
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

export function WorkflowV2FxParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const targetIds = p.targetLayerIds ?? (layer ? [layer.id] : [])
  const fxKind = p.fxKind ?? 'wind_physics'
  const phys = layer?.physics ?? createDefaultLayerPhysics('foliage_bush')
  const glow: LayerGlow = layer?.glow ?? {
    enabled: true,
    color: fxKind === 'chromatic' ? '#a855f7' : '#38bdf8',
    intensity: 1.4,
    thickness: 10
  }

  const patchGlow = (patch: Partial<LayerGlow>, mergeKey = 'wf-v2-fx-glow'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        l.glow = { ...(l.glow ?? glow), enabled: node.enabled, ...patch }
      }
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode && patch.intensity !== undefined) {
        wfNode.params = { ...(wfNode.params ?? {}), intensity: patch.intensity }
      }
    }, mergeKey)
  }

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="vl-row-header">
        <span className="vl-title">✨ Hiệu Ứng &amp; Lưới Đàn Hồi 2.5D</span>
      </div>

      <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {WORKFLOW_V2_FX_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`vl-pill-btn ${fxKind === o.id ? 'active-amber' : ''}`}
            onClick={() => onUpdate({ fxKind: o.id }, `Hiệu ứng: ${o.label}`)}
          >
            {o.label.replace(/\s*\/.*$/, '')}
          </button>
        ))}
      </div>

      {fxKind === 'wind_physics' ? (
        <div className="vl-subcard">
          <ParamSlider
            label="Cường độ gió"
            min={0.1}
            max={2.2}
            step={0.05}
            value={p.intensity ?? 1}
            onChange={(v) => onUpdate({ intensity: v })}
          />
          <ParamSlider
            label="Độ cứng lưới"
            min={0.15}
            max={2.4}
            step={0.05}
            value={phys.stiffness ?? 0.8}
            onChange={(v) =>
              useEditor.getState().update((d) => {
                const l = d.layers.find((x) => x.id === layer?.id)
                if (l) l.physics = { ...(l.physics ?? phys), enabled: true, stiffness: v }
              }, 'wf-fx-stiff')
            }
          />
          <ParamSlider
            label="Độ nảy đàn hồi"
            min={0.1}
            max={2.0}
            step={0.05}
            value={phys.bounciness ?? 0.9}
            onChange={(v) =>
              useEditor.getState().update((d) => {
                const l = d.layers.find((x) => x.id === layer?.id)
                if (l) l.physics = { ...(l.physics ?? phys), enabled: true, bounciness: v }
              }, 'wf-fx-bounce')
            }
          />
          <Row label="Vùng neo lưới" title="Vùng giữ cố định khi lưới 2.5D uốn theo gió/lực">
            <OptionPills
              cols={4}
              options={[
                { id: 'foot_bottom', label: '↓ Neo Đáy' },
                { id: 'top_surface', label: '↑ Neo Đỉnh' },
                { id: 'trunk_center', label: '← Thân' },
                { id: 'full', label: 'Tự do' }
              ]}
              value={phys.colliderZone ?? 'foot_bottom'}
              onPick={(zone) =>
                useEditor.getState().update((d) => {
                  const l = d.layers.find((x) => x.id === layer?.id)
                  if (!l) return
                  const base = l.physics ?? phys
                  l.physics = {
                    ...base,
                    enabled: true,
                    colliderZone: zone
                  }
                })
              }
            />
          </Row>
        </div>
      ) : (
        <div className="vl-subcard">
          <ParamSlider
            label="Cường độ sáng"
            min={0.2}
            max={3.0}
            step={0.1}
            value={glow.intensity ?? p.intensity ?? 1.4}
            onChange={(v) => patchGlow({ intensity: v })}
          />
          <ParamSlider
            label="Độ dày viền"
            min={2}
            max={32}
            step={1}
            value={glow.thickness ?? 10}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => patchGlow({ thickness: v })}
          />
          <Row label="Kiểu nhịp sáng" title="Chế độ chuyển động của viền phát sáng">
            <OptionPills
              cols={4}
              options={[
                { id: 'none', label: 'Tĩnh' },
                { id: 'breathe', label: 'Thở' },
                { id: 'blink', label: 'Chớp' },
                { id: 'flicker', label: 'Lập lòe' }
              ]}
              value={glow.animated ?? 'none'}
              onPick={(anim) => patchGlow({ animated: anim as LayerGlow['animated'] })}
            />
          </Row>
          <Row label="Màu hiệu ứng" title="Màu phát sáng viền Alpha">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
              <ColorInput
                compact
                value={glow.color || '#38bdf8'}
                onChange={(val, k) => patchGlow({ color: val }, k)}
                title="Chọn màu hiệu ứng"
              />
              <div className="vl-swatch-row">
                {NEON_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`vl-swatch-btn ${(glow.color || '').toLowerCase() === hex ? 'active' : ''}`}
                    style={{ background: hex }}
                    onClick={() => patchGlow({ color: hex })}
                  />
                ))}
              </div>
            </div>
          </Row>
        </div>
      )}
    </div>
  )
}
