import React from 'react'
import type { GlowSide, Layer, LayerGlow, LoopEndAction } from '@shared/types'
import {
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  resolveFxAtomicRole
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row } from '../controls'
import { deleteLayerEffect, toggleLayerEffect } from '../timeline/timelineEffects'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

const NEON_SWATCHES = ['#3dd6f5', '#f59e0b', '#ec4899', '#a855f7', '#10b981', '#fb7185']

function resolveTargetLayer(props: WorkflowV2NodeParamsProps): Layer | undefined {
  const ids = props.node.params?.targetLayerIds ?? []
  return (
    props.project.layers.find((l) => ids.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
    props.project.layers.find((l) => ids.includes(l.id))
  )
}

const OPACITY_PRESET_IDS = new Set(['fadeInOut', 'blink', 'breathe'])
const PULSE_PRESET_IDS = new Set(['popIn', 'pulse', 'shake'])
const GLOW_PRESET_IDS = new Set(['neonBreathe', 'neonBlink', 'neonFlicker', 'neonSolid'])

/**
 * Node Hiệu ứng (`logicCategory: 'fx'`):
 * Đơn trách nhiệm cho toàn bộ hiệu ứng thị giác, xuất hiện / ẩn đi và nhịp biến đổi của Layer
 * (kết hợp tự do với Node Animation Loop, Node Motion hoặc Node Time):
 * 1. `🌗 Hiện / Ẩn & Mờ`: Hiện dần từ mờ → nét (Fade In), Ẩn ngay / Mờ dần khi hết thời gian (Fade Out), Nhấp nháy (Blink), Thở mờ ảo (Breathe).
 * 2. `💥 Nhịp & Biến đổi`: Nhịp đập (Pulse), Nảy Pop-in, Rung chấn (Shake) & Nhịp Beat liên tục (Nháy mờ / Nhịp Scale).
 * 3. `✨ Phát sáng & Quang học`: Viền Neon phát sáng (Thở / Chớp / Chập chờn / Tĩnh) & Quang học (Bloom / Làm mờ / Tán sắc RGB / Vignette / Đom đóm).
 */
export function WorkflowV2FxParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onScrubTime } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const targetIds = p.targetLayerIds ?? (layer ? [layer.id] : [])
  const fxList = (layer?.appliedEffects ?? []).filter((f) => f.category !== 'motion')
  const presetId = p.animFxPreset ?? fxList[fxList.length - 1]?.presetId ?? 'fadeInOut'
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]

  const atomicRole = resolveFxAtomicRole(node)
  const activeTab: 'opacity' | 'pulse' | 'glow' = atomicRole === 'fade' ? 'opacity' : atomicRole
  const roleBadgeText =
    atomicRole === 'fade'
      ? '🌗 Node đơn nhiệm: Hiện / Ẩn & Mờ'
      : atomicRole === 'pulse'
        ? '💥 Node đơn nhiệm: Nhịp & Biến đổi'
        : '✨ Node đơn nhiệm: Phát sáng & Quang học'

  const fadeInSec =
    p.loopFadeInSec ??
    layer?.fadeIn ??
    (layer?.type === 'image' ? layer.props.loopFadeInSec : 0) ??
    0
  const fadeOutSec =
    p.loopFadeOutSec ??
    layer?.fadeOut ??
    (layer?.type === 'image' ? layer.props.loopFadeOutSec : 0) ??
    0
  const endAction: LoopEndAction =
    p.loopEndAction ??
    (layer?.type === 'image' && layer.props.loopEndAction
      ? layer.props.loopEndAction
      : fadeOutSec > 0.01
        ? 'fade_out'
        : 'hold')

  const rhythmMode =
    p.loopRhythmMode ??
    (layer?.type === 'image' && layer.props.loopRhythmMode ? layer.props.loopRhythmMode : 'none')

  const countVal = p.animFxCount ?? opt.defaultCount ?? 2
  const intensityVal = p.intensity ?? opt.defaultIntensity ?? (presetId === 'shake' ? 18 : 1.25)
  const colorVal = p.animFxColor ?? layer?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
  const sideVal: GlowSide = p.animFxSide ?? layer?.glow?.side ?? 'outer'
  const thicknessVal = p.animFxThickness ?? layer?.glow?.thickness ?? 10
  const speedVal = p.animFxSpeed ?? layer?.glow?.speed ?? 1.5
  const minIntVal = p.animFxMinIntensity ?? layer?.glow?.minIntensity ?? 0.15

  const glow: LayerGlow = layer?.glow ?? {
    enabled: true,
    color: colorVal,
    intensity: intensityVal,
    thickness: thicknessVal
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

  const opacityOptions = WORKFLOW_V2_ANIM_FX_OPTIONS.filter((o) => OPACITY_PRESET_IDS.has(o.id))
  const pulseOptions = WORKFLOW_V2_ANIM_FX_OPTIONS.filter((o) => PULSE_PRESET_IDS.has(o.id))
  const glowOptions = WORKFLOW_V2_ANIM_FX_OPTIONS.filter((o) => GLOW_PRESET_IDS.has(o.id))

  return (
    <div className="vl-section-card">
      <div className="wf-v2-atomic-banner" data-role={atomicRole}>
        <span className="wf-v2-atomic-banner-title">{roleBadgeText}</span>
        <span className="wf-v2-atomic-banner-tip">
          Mỗi Node đảm nhiệm 1 logic · Kéo cổng phải để nối thêm hiệu ứng khác vào chuỗi
        </span>
      </div>

      {activeTab === 'opacity' && (
        <div className="vl-subcard" data-mcp-region="workflow_loop_lifecycle">
          <div className="vl-row-header">
            <span className="vl-title">🌗 Xuất hiện Mờ → Nét &amp; Mờ dần khi Ẩn</span>
            <span className="vl-value-badge">
              In {fadeInSec.toFixed(1)}s · Out {fadeOutSec.toFixed(1)}s
            </span>
          </div>

          <ParamSlider
            label="Hiện dần từ mờ → nét (Fade In)"
            min={0}
            max={3.0}
            step={0.05}
            value={fadeInSec}
            format={(v) => (v <= 0.001 ? 'Tắt' : `${v.toFixed(2)}s`)}
            onChange={(v) =>
              onUpdate(
                { fxSubTab: 'opacity', loopFadeInSec: v },
                v > 0.01 ? `Hiệu ứng: Hiện dần ${v.toFixed(1)}s` : undefined
              )
            }
          />

          <div className="vl-row-header" style={{ marginTop: 4 }}>
            <span className="vl-subtitle">Khi kết thúc thời gian Node / Hết vòng lặp</span>
          </div>
          <OptionPills
            cols={3}
            options={[
              { id: 'hold', label: '⏸ Giữ nguyên' },
              { id: 'hide', label: '🙈 Ẩn ngay' },
              { id: 'fade_out', label: '🌫 Mờ dần rồi ẩn' }
            ]}
            value={endAction}
            onPick={(id) => {
              const nextEnd = id as LoopEndAction
              const nextFadeOut = nextEnd === 'fade_out' && fadeOutSec <= 0.01 ? 0.35 : nextEnd !== 'fade_out' ? 0 : fadeOutSec
              onUpdate(
                {
                  fxSubTab: 'opacity',
                  loopEndAction: nextEnd,
                  loopFadeOutSec: nextFadeOut
                },
                nextEnd === 'fade_out'
                  ? `Hiệu ứng: Ẩn mờ dần ${nextFadeOut.toFixed(1)}s`
                  : nextEnd === 'hide'
                    ? 'Hiệu ứng: Ẩn ngay khi hết giờ'
                    : 'Hiệu ứng: Giữ nguyên cuối'
              )
            }}
          />

          <ParamSlider
            label="Thời gian mờ dần khi ẩn (Fade Out)"
            min={0}
            max={3.0}
            step={0.05}
            value={fadeOutSec}
            format={(v) => (v <= 0.001 ? 'Tắt' : `${v.toFixed(2)}s`)}
            onChange={(v) =>
              onUpdate(
                {
                  fxSubTab: 'opacity',
                  loopFadeOutSec: v,
                  loopEndAction: v > 0.01 ? 'fade_out' : endAction === 'fade_out' ? 'hold' : endAction
                },
                v > 0.01 ? `Hiệu ứng: Ẩn mờ dần ${v.toFixed(1)}s` : undefined
              )
            }
          />

          <div className="vl-row-header" style={{ marginTop: 6 }}>
            <span className="vl-title">✨ Mẫu Keyframe Độ Mờ (Chớp &amp; Thở)</span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {opacityOptions.map((item) => {
              const active = presetId === item.id && fxList.some((f) => f.presetId === item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={item.label}
                  onClick={() => {
                    const start = p.timeStart ?? layer?.inPoint ?? 0
                    onUpdate(
                      {
                        fxSubTab: 'opacity',
                        animMode: 'keyframe_fx',
                        animFxPreset: item.id,
                        animFxCount: item.defaultCount,
                        intensity: item.defaultIntensity,
                        timeEnd: Number((start + item.defaultDuration).toFixed(2))
                      },
                      `Hiệu ứng: ${item.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}`
                    )
                  }}
                >
                  <span>{item.shortLabel}</span>
                </button>
              )
            })}
          </div>
          {presetId === 'blink' && (
            <ParamSlider
              label="Số lần nhấp nháy"
              min={1}
              max={16}
              step={1}
              value={countVal}
              format={(v) => `${Math.round(v)} lần`}
              onChange={(v) => onUpdate({ animFxCount: Math.round(v) })}
            />
          )}
        </div>
      )}

      {activeTab === 'pulse' && (
        <div className="vl-subcard" data-mcp-region="workflow_loop_combo_fx">
          <div className="vl-row-header">
            <span className="vl-title">💥 Nhịp Biến Đổi Keyframe (Pop-in · Đập · Rung)</span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {pulseOptions.map((item) => {
              const active = presetId === item.id && fxList.some((f) => f.presetId === item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={item.label}
                  onClick={() => {
                    const start = p.timeStart ?? layer?.inPoint ?? 0
                    onUpdate(
                      {
                        fxSubTab: 'pulse',
                        animMode: 'keyframe_fx',
                        animFxPreset: item.id,
                        animFxCount: item.defaultCount,
                        intensity: item.defaultIntensity,
                        timeEnd: Number((start + item.defaultDuration).toFixed(2))
                      },
                      `Hiệu ứng: ${item.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}`
                    )
                  }}
                >
                  <span>{item.shortLabel}</span>
                </button>
              )
            })}
          </div>

          {PULSE_PRESET_IDS.has(presetId) && (
            <>
              <ParamSlider
                label={
                  presetId === 'shake'
                    ? 'Số lần rung'
                    : presetId === 'popIn'
                      ? 'Số lần nảy'
                      : 'Số nhịp đập'
                }
                min={1}
                max={16}
                step={1}
                value={countVal}
                format={(v) => `${Math.round(v)} lần`}
                onChange={(v) => onUpdate({ animFxCount: Math.round(v) })}
              />
              {presetId === 'shake' ? (
                <ParamSlider
                  label="Biên độ rung"
                  min={2}
                  max={60}
                  step={2}
                  value={intensityVal}
                  format={(v) => `±${Math.round(v)}px`}
                  onChange={(v) => onUpdate({ intensity: v })}
                />
              ) : (
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
            </>
          )}

          <div className="vl-row-header" style={{ marginTop: 6 }}>
            <span className="vl-title">⚡ Nhịp Beat &amp; Nháy Sáng Liên Tục</span>
            <span className="vl-value-badge">{rhythmMode}</span>
          </div>
          <OptionPills
            cols={2}
            options={[
              { id: 'none', label: '⏹ Tắt nhịp' },
              { id: 'flicker_opacity', label: '✨ Nháy độ mờ' },
              { id: 'pulse_scale', label: '💓 Tạo nhịp đập' },
              { id: 'sync_both', label: '🔥 Nhịp + Nháy' },
              { id: 'strobe_beat', label: '⚡ Chớp Beat' }
            ]}
            value={rhythmMode}
            onPick={(id) =>
              onUpdate(
                {
                  fxSubTab: 'pulse',
                  loopRhythmMode: id as 'none' | 'flicker_opacity' | 'pulse_scale' | 'sync_both' | 'strobe_beat'
                },
                id === 'none' ? 'Hiệu ứng: Tắt nhịp Beat' : `Hiệu ứng: Nhịp Beat (${id})`
              )
            }
          />
          {rhythmMode !== 'none' && (
            <>
              <ParamSlider
                label="Tần số nhịp (Hz)"
                min={0.2}
                max={12}
                step={0.1}
                value={p.loopRhythmRateHz ?? 2.5}
                format={(v) => `${v.toFixed(1)} Hz`}
                onChange={(v) => onUpdate({ loopRhythmRateHz: v })}
              />
              <ParamSlider
                label="Cường độ nháy / nhịp"
                min={0.05}
                max={1}
                step={0.05}
                value={p.loopRhythmIntensity ?? 0.45}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onUpdate({ loopRhythmIntensity: v })}
              />
              <ParamSlider
                label="Độ mờ tối thiểu (Floor)"
                min={0.05}
                max={0.95}
                step={0.05}
                value={p.loopMinOpacity ?? 0.55}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onUpdate({ loopMinOpacity: v })}
              />
              <ParamSlider
                label="Biên độ phóng nhịp Scale"
                min={2}
                max={45}
                step={1}
                value={p.loopScaleBeatPct ?? 12}
                format={(v) => `+${Math.round(v)}%`}
                onChange={(v) => onUpdate({ loopScaleBeatPct: v })}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'glow' && (
        <div className="vl-subcard">
          <div className="vl-row-header">
            <span className="vl-title">✨ Viền Neon Alpha &amp; Quang Học 2.5D</span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {glowOptions.map((item) => {
              const active = presetId === item.id && !p.fxKind
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={item.label}
                  onClick={() => {
                    const start = p.timeStart ?? layer?.inPoint ?? 0
                    onUpdate(
                      {
                        fxSubTab: 'glow',
                        fxKind: undefined,
                        animMode: 'keyframe_fx',
                        animFxPreset: item.id,
                        animFxCount: item.defaultCount,
                        intensity: item.defaultIntensity,
                        animFxColor: item.defaultColor,
                        timeEnd: Number((start + item.defaultDuration).toFixed(2))
                      },
                      `Hiệu ứng: ${item.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}`
                    )
                  }}
                >
                  <span>{item.shortLabel}</span>
                </button>
              )
            })}
            {WORKFLOW_V2_FX_OPTIONS.map((o) => {
              const active = p.fxKind === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={o.label}
                  onClick={() =>
                    onUpdate(
                      { fxSubTab: 'glow', fxKind: o.id, animFxPreset: undefined },
                      `Hiệu ứng: ${o.label}`
                    )
                  }
                >
                  <span>{o.label.replace(/\s*\/.*$/, '')}</span>
                </button>
              )
            })}
          </div>

          <Row label="Hướng viền" title="Chiếu viền sáng ra ngoài nét vẽ, vào trong hay cả hai phía">
            <OptionPills
              cols={3}
              options={[
                { id: 'outer', label: 'Ngoài nét' },
                { id: 'both', label: '2 phía' },
                { id: 'inner', label: 'Trong nét' }
              ]}
              value={sideVal}
              onPick={(id) => {
                onUpdate({ animFxSide: id as GlowSide })
                patchGlow({ side: id as GlowSide })
              }}
            />
          </Row>
          <ParamSlider
            label="Cường độ sáng"
            min={0.2}
            max={3.0}
            step={0.1}
            value={glow.intensity ?? intensityVal}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => {
              onUpdate({ intensity: v })
              patchGlow({ intensity: v })
            }}
          />
          <ParamSlider
            label="Độ dày viền"
            min={2}
            max={32}
            step={1}
            value={glow.thickness ?? thicknessVal}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => {
              onUpdate({ animFxThickness: v })
              patchGlow({ thickness: v })
            }}
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
          <Row label="Màu hiệu ứng" title="Màu phát sáng viền Alpha">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
              <ColorInput
                compact
                value={colorVal}
                onChange={(val, k) => {
                  onUpdate({ animFxColor: val })
                  patchGlow({ color: val }, k)
                }}
                title="Chọn màu hiệu ứng"
              />
              <div className="vl-swatch-row">
                {NEON_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`vl-swatch-btn ${colorVal.toLowerCase() === hex ? 'active' : ''}`}
                    style={{ background: hex }}
                    onClick={() => {
                      onUpdate({ animFxColor: hex })
                      patchGlow({ color: hex })
                    }}
                  />
                ))}
              </div>
            </div>
          </Row>
        </div>
      )}

      {fxList.length > 0 && layer && (
        <div className="vl-subcard">
          <div className="vl-row-header">
            <span className="vl-subtitle">Ngăn xếp hiệu ứng trên Layer ({fxList.length})</span>
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
