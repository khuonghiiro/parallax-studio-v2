import React from 'react'
import type { GlowSide, Layer, LayerGlow, LayerMotion } from '@shared/types'
import { createDefaultLayerPhysics } from '../../engine/layerPhysics'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_RIG_PRESET_OPTIONS
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row } from '../controls'
import { deleteLayerEffect, toggleLayerEffect } from '../timeline/timelineEffects'
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

export function WorkflowV2AnimFxParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onScrubTime } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const fxList = (layer?.appliedEffects ?? []).filter((f) => f.category !== 'motion')
  const presetId = p.animFxPreset ?? fxList[fxList.length - 1]?.presetId ?? 'popIn'
  const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === presetId) ?? WORKFLOW_V2_ANIM_FX_OPTIONS[0]
  const isGlow = opt.fxCategory === 'glow'

  const countVal = p.animFxCount ?? opt.defaultCount ?? 2
  const intensityVal = p.intensity ?? opt.defaultIntensity ?? (presetId === 'shake' ? 18 : 1.25)
  const colorVal = p.animFxColor ?? layer?.glow?.color ?? opt.defaultColor ?? '#3dd6f5'
  const sideVal: GlowSide = p.animFxSide ?? layer?.glow?.side ?? 'outer'
  const thicknessVal = p.animFxThickness ?? layer?.glow?.thickness ?? 10
  const speedVal = p.animFxSpeed ?? layer?.glow?.speed ?? 1.5
  const minIntVal = p.animFxMinIntensity ?? layer?.glow?.minIntensity ?? 0.15

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="vl-row-header">
        <span className="vl-title">🎞️ Hiệu Ứng Hoạt Ảnh (Animation FX)</span>
        <span className="vl-value-badge">{opt.badge} {opt.shortLabel.replace(/^[^\w\p{L}]+\s*/u, '')}</span>
      </div>

      <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {WORKFLOW_V2_ANIM_FX_OPTIONS.map((item) => {
          const active = item.id === opt.id
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
                    animFxPreset: item.id,
                    animFxCount: item.defaultCount,
                    intensity: item.defaultIntensity,
                    animFxColor: item.defaultColor,
                    timeEnd: Number((start + item.defaultDuration).toFixed(2))
                  },
                  `Hoạt ảnh FX: ${item.label}`
                )
              }}
            >
              {item.shortLabel}
            </button>
          )
        })}
      </div>

      {/* Điều khiển chi tiết theo từng loại hoạt ảnh */}
      <div className="vl-subcard">
        {(presetId === 'shake' || presetId === 'popIn' || presetId === 'pulse' || presetId === 'blink' || presetId === 'neonBlink') && (
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

      {/* Danh sách các hiệu ứng hoạt ảnh đang áp trên Layer */}
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
            <div
              key={fx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 6px',
                borderRadius: 4,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-soft)',
                fontSize: 10.5
              }}
            >
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

export function WorkflowV2ActionParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate } = props
  const p = node.params ?? {}
  const layer = resolveTargetLayer(props)
  const targetIds = p.targetLayerIds ?? (layer ? [layer.id] : [])
  const motion: LayerMotion = layer?.motion ?? {
    enabled: true,
    type: 'float',
    speed: 1,
    amount: p.intensity ?? 0.65
  }

  const patchMotion = (patch: Partial<LayerMotion>, mergeKey = 'wf-v2-motion'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        l.motion = {
          ...(l.motion ?? { enabled: true, type: 'float', speed: 1, amount: 0.65 }),
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
      {layer?.composite?.instanceId && (
        <div className="vl-subcard" style={{ marginBottom: 6 }}>
          <div className="vl-row-header" style={{ marginBottom: 4 }}>
            <span className="vl-subtitle">🦴 Hành động Xương Nhân vật 2.5D (Rig Animation)</span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {WORKFLOW_V2_RIG_PRESET_OPTIONS.map((ro) => {
              const active = p.rigActionPreset === ro.id || p.actionPreset === `rig_${ro.id}`
              return (
                <button
                  key={ro.id}
                  type="button"
                  className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                  title={ro.description}
                  onClick={() =>
                    onUpdate(
                      { actionPreset: `rig_${ro.id}`, rigActionPreset: ro.id, intensity: 1.0 },
                      `Hành động 2.5D: ${ro.label.replace(/^[^\w\p{L}]+\s*/u, '')}`
                    )
                  }
                >
                  {ro.shortLabel}
                </button>
              )
            })}
            <button
              type="button"
              className={`vl-pill-btn ${!p.rigActionPreset || p.rigActionPreset === 'none' ? 'active-amber' : ''}`}
              onClick={() => onUpdate({ rigActionPreset: 'none' })}
            >
              ⏹ Tắt Rig xương
            </button>
          </div>
          <div style={{ marginTop: 5 }}>
            <OptionPills
              cols={2}
              options={[
                { id: 'stagger', label: '🌊 Lệch pha giữa các mảnh' },
                { id: 'sync', label: '🔗 Đồng loạt cùng pha' }
              ]}
              value={p.staggerPhase ? 'stagger' : 'sync'}
              onPick={(id) => onUpdate({ staggerPhase: id === 'stagger' })}
            />
          </div>
        </div>
      )}

      <div className="vl-row-header">
        <span className="vl-title">🏃 Chuyển Động Tự Động 2.5D (Motion)</span>
      </div>

      <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {WORKFLOW_V2_ACTION_OPTIONS.map((o) => {
          const active = (p.actionPreset ?? motion.type) === o.id
          return (
            <button
              key={o.id}
              type="button"
              className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
              onClick={() => onUpdate({ actionPreset: o.id, rigActionPreset: 'none', intensity: o.defaultAmount }, `Hành động: ${o.label}`)}
            >
              {o.label.replace(/\s*\(.*\)/, '')}
            </button>
          )
        })}
      </div>

      <div className="vl-subcard">
        <ParamSlider
          label="Biên độ (Amt)"
          min={0.1}
          max={2.0}
          step={0.05}
          value={motion.amount ?? p.intensity ?? 0.65}
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
        <Row label="Biên X / Y" title="Biên độ dịch chuyển ngang (X px) và dọc (Y px)">
          <NumberInput
            axis="x"
            value={motion.amplitude?.[0] ?? 16}
            step={2}
            precision={0}
            min={0}
            max={240}
            suffix="px"
            onChange={(v, k) => {
              const cur = motion.amplitude ?? ([16, 14, 0] as const)
              patchMotion({ amplitude: [v, cur[1], cur[2]] }, k)
            }}
          />
          <NumberInput
            axis="y"
            value={motion.amplitude?.[1] ?? 14}
            step={2}
            precision={0}
            min={0}
            max={240}
            suffix="px"
            onChange={(v, k) => {
              const cur = motion.amplitude ?? ([16, 14, 0] as const)
              patchMotion({ amplitude: [cur[0], v, cur[2]] }, k)
            }}
          />
        </Row>
        <Row label="Nghiêng / Vào-Ra" title="Góc lắc nghiêng (°) và thời gian hòa trộn vào/ra mượt (giây)">
          <NumberInput
            axis="∠"
            value={motion.amplitude?.[2] ?? 4}
            step={1}
            precision={0}
            min={0}
            max={45}
            suffix="°"
            onChange={(v, k) => {
              const cur = motion.amplitude ?? ([16, 14, 4] as const)
              patchMotion({ amplitude: [cur[0], cur[1], v] }, k)
            }}
          />
          <NumberInput
            axis="in"
            value={motion.fadeIn ?? 0.25}
            step={0.05}
            precision={2}
            min={0}
            max={3}
            suffix="s"
            onChange={(v, k) => patchMotion({ fadeIn: v, fadeOut: v }, k)}
          />
        </Row>
      </div>
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
