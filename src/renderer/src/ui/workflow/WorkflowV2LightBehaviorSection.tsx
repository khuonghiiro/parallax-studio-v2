import React from 'react'
import type {
  LayerVirtualLight,
  VirtualLightBehaviorMode,
  WindStrengthPreset
} from '@shared/types'
import { WIND_STRENGTH_VALUES } from '../../engine/virtualLight'
import {
  getDefaultOpticalProfile,
  resolveEffectiveLightBehavior
} from '../../engine/virtualLightPhysics'
import { NumberInput, Row } from '../controls'

const BEHAVIOR_MODE_PILLS: {
  value: Exclude<VirtualLightBehaviorMode, 'auto'>
  label: string
  title: string
}[] = [
  {
    value: 'wind_reactive',
    label: '🌬️ Nhạy theo gió',
    title:
      'Khí động học ngọn nến / đuốc: lặng gió đứng thẳng + nhấp nháy nhẹ; gió nhẹ nghiêng êm; gió mạnh tạt ngang, sụt/bùng oxy & đổi nhiệt màu'
  },
  {
    value: 'steady',
    label: '🔒 Ổn định',
    title: 'Đèn pin / LED nguồn chuẩn: chiếu sáng ổn định kèm vi dao động tự nhiên (~1.5%)'
  },
  {
    value: 'subtle_flicker',
    label: '🕯️ Nhấp nháy nhẹ',
    title: 'Ngọn nến trong phòng kín / đèn sợi đốt ấm: dao động vi mô êm dịu không giật gắt'
  },
  {
    value: 'breathing',
    label: '💓 Nhịp đập nhẹ',
    title: 'Nhịp thở ánh sáng chu kỳ êm ái: cường độ & quầng sáng phồng xẹp mềm mại'
  },
  {
    value: 'intermittent',
    label: '⚡ Chập chờn',
    title: 'Đèn pin yếu pin / tiếp xúc lỏng: sáng bình thường xen các đợt sụt áp chập chờn ngả đỏ ấm'
  },
  {
    value: 'strobe',
    label: '🚨 Nháy chớp',
    title: 'Đèn cảnh báo / chớp tia sáng dứt khoát theo tần số Hz'
  }
]

export const PHYSICAL_WIND_PILLS: {
  value: WindStrengthPreset
  label: string
  title: string
}[] = [
  {
    value: 'none',
    label: '🍃 Lặng',
    title: 'Không có gió: ngọn nến bốc thẳng đứng do đối lưu nhiệt, vẫn nhấp nháy vi mô nhẹ (~5%)'
  },
  {
    value: 'gentle',
    label: '🌬️ Nhẹ',
    title: 'Gió thổi nhẹ: ngọn lửa nghiêng ~26° xuôi gió, quầng sáng kéo dài phản chiếu gợn êm lên môi trường'
  },
  {
    value: 'strong',
    label: '💨 Mạnh',
    title: 'Gió thổi mạnh: lửa tạt ngang ~62°, sụt tối đỏ cam khi thiếu oxy xen các đợt bùng sáng vàng rực'
  },
  {
    value: 'storm',
    label: '🌪️ Bão',
    title: 'Gió bão giật: chớp giật hỗn loạn, có nhịp hụt tắt phụt xuống ~15% rồi quật bùng dữ dội'
  }
]

const RAY_STRIATION_PRESETS: { label: string; val: number; count?: number; title: string }[] = [
  { label: '○ Không tỉa', val: 0, title: 'Quầng sáng mịn đồng nhất, không tách luồng tia' },
  { label: '✧ Tỉa dịu', val: 0.26, count: 10, title: 'Tỉa tia tán xạ nhẹ nhàng tự nhiên quanh nguồn sáng' },
  { label: '🌟 Tia rõ', val: 0.54, count: 9, title: 'Luồng tia Tyndall cắt rõ qua bụi / không khí tối' },
  { label: '☀️ Tia sương', val: 0.84, count: 12, title: 'Tỉa tia khí quyển đậm nét xuyên sương mù / bóng đêm' }
]

export interface LightPhysicsSectionSharedProps {
  vlight: LayerVirtualLight
  onPatch: (patch: Partial<LayerVirtualLight>, mergeKey?: string) => void
  onPatchThrottled: (patch: Partial<LayerVirtualLight>, mergeKey?: string) => void
  onFlush: () => void
}

export function WorkflowV2LightBehaviorPanel({
  vlight,
  onPatch,
  onPatchThrottled,
  onFlush
}: LightPhysicsSectionSharedProps): React.ReactElement {
  const optDefaults = getDefaultOpticalProfile(vlight.kind)
  const effectiveMode = resolveEffectiveLightBehavior(vlight.kind, vlight.behaviorMode)
  const pulseDepth = vlight.pulseDepth ?? optDefaults.pulseDepth
  const speedHz = vlight.flickerSpeed ?? 1.0

  return (
    <div className="vl-subcard vl-physics-behavior-panel" data-mcp-region="workflow_light_behavior">
      <div className="vl-row-header">
        <span className="vl-subtitle">⚡ Hành Vi Vật Lý &amp; Khí Động Học Nguồn Sáng</span>
        <span className="vl-value-badge">{speedHz.toFixed(1)}Hz</span>
      </div>

      <div className="vl-behavior-grid">
        {BEHAVIOR_MODE_PILLS.map((m) => {
          const active = effectiveMode === m.value
          return (
            <button
              key={m.value}
              type="button"
              title={m.title}
              className={`vl-pill-btn ${active ? 'active' : ''}`}
              onClick={() => onPatch({ behaviorMode: m.value }, 'wf-light-behavior')}
            >
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>

      {effectiveMode === 'wind_reactive' && (
        <>
          <Row
            label="Mức gió"
            title="Phản ứng khí động học của ngọn lửa và ánh sáng phản chiếu ra môi trường khi lặng gió / gió nhẹ / gió mạnh / bão"
          >
            <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', width: '100%' }}>
              {PHYSICAL_WIND_PILLS.map((w) => {
                const active = (vlight.windPreset ?? 'gentle') === w.value
                return (
                  <button
                    key={w.value}
                    type="button"
                    title={w.title}
                    className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
                    onClick={() =>
                      onPatch(
                        { windPreset: w.value, windStrength: WIND_STRENGTH_VALUES[w.value] },
                        'wf-light-wind'
                      )
                    }
                  >
                    <span>{w.label}</span>
                  </button>
                )
              })}
            </div>
          </Row>

          <Row label="Hướng / Nhạy" title="Góc chiều gió thổi (-180°..180°, 0° = thổi sang phải) và độ nhạy bạt lửa">
            <NumberInput
              axis="∠"
              value={vlight.windDirectionDeg ?? 0}
              step={5}
              precision={0}
              min={-180}
              max={180}
              suffix="°"
              onChange={(v, k) => onPatch({ windDirectionDeg: v }, k)}
            />
            <NumberInput
              axis="nhạy"
              value={vlight.windSensitivity ?? 1.0}
              step={0.1}
              precision={2}
              min={0.1}
              max={2.2}
              onChange={(v, k) => onPatch({ windSensitivity: v }, k)}
            />
          </Row>
        </>
      )}

      <Row label="Tốc độ nhịp" title="Tần số dao động của ngọn lửa, nhịp thở ánh sáng hoặc tốc độ sụt áp chập chờn (Hz)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <input
            type="range"
            min={0.1}
            max={4.5}
            step={0.05}
            value={Math.min(4.5, Math.max(0.1, speedHz))}
            onChange={(e) => onPatchThrottled({ flickerSpeed: Number(e.target.value) }, 'wf-light-speed')}
            onPointerUp={onFlush}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <div style={{ width: 66, flexShrink: 0 }}>
            <NumberInput
              axis="hz"
              value={speedHz}
              step={0.1}
              precision={2}
              min={0.05}
              max={6.0}
              onChange={(v, k) => onPatch({ flickerSpeed: v }, k)}
            />
          </div>
        </div>
      </Row>

      <Row
        label="Biên độ nhịp"
        title="Độ sâu của nhịp đập thở, mức nhấp nháy lửa hoặc mức tụt sáng khi đèn pin chập chờn yếu pin"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={Math.min(1, Math.max(0, pulseDepth))}
            onChange={(e) => onPatchThrottled({ pulseDepth: Number(e.target.value) }, 'wf-light-pulse')}
            onPointerUp={onFlush}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <div style={{ width: 66, flexShrink: 0 }}>
            <NumberInput
              axis="độ"
              value={pulseDepth}
              step={0.05}
              precision={2}
              min={0}
              max={1}
              onChange={(v, k) => onPatch({ pulseDepth: v }, k)}
            />
          </div>
        </div>
      </Row>
    </div>
  )
}

export function WorkflowV2LightRaysPanel({
  vlight,
  onPatch,
  onPatchThrottled,
  onFlush
}: LightPhysicsSectionSharedProps): React.ReactElement {
  const optDefaults = getDefaultOpticalProfile(vlight.kind)
  const rayIntensity = vlight.rayIntensity ?? optDefaults.rayIntensity
  const rayCount = vlight.rayCount ?? optDefaults.rayCount
  const hotspotFocus = vlight.hotspotFocus ?? optDefaults.hotspotFocus

  return (
    <div className="vl-subcard vl-physics-rays-panel" data-mcp-region="workflow_light_rays">
      <div className="vl-row-header">
        <span className="vl-subtitle">🌟 Tỉa Tia Khí Quyển (Tyndall) &amp; Hội Tụ Chóa Đèn</span>
        <span className="vl-value-badge">
          {rayIntensity > 0.03 ? `${rayCount} tia · ${Math.round(rayIntensity * 100)}%` : 'Mịn'}
        </span>
      </div>

      <div className="vl-ray-preset-grid">
        {RAY_STRIATION_PRESETS.map((rp) => {
          const active = Math.abs(rayIntensity - rp.val) < 0.12
          return (
            <button
              key={rp.label}
              type="button"
              title={rp.title}
              className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
              onClick={() =>
                onPatch(
                  { rayIntensity: rp.val, ...(rp.count !== undefined ? { rayCount: rp.count } : {}) },
                  'wf-light-ray-preset'
                )
              }
            >
              <span>{rp.label}</span>
            </button>
          )
        })}
      </div>

      <Row label="Độ rõ tia tỉa" title="Cường độ các luồng tia sáng tỉa xuyên qua bụi/sương ra ngoài môi trường (0 = mịn, 1 = tia sắc rõ)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={Math.min(1, Math.max(0, rayIntensity))}
            onChange={(e) => onPatchThrottled({ rayIntensity: Number(e.target.value) }, 'wf-light-rays')}
            onPointerUp={onFlush}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <div style={{ width: 66, flexShrink: 0 }}>
            <NumberInput
              axis="tia"
              value={rayIntensity}
              step={0.05}
              precision={2}
              min={0}
              max={1}
              onChange={(v, k) => onPatch({ rayIntensity: v }, k)}
            />
          </div>
        </div>
      </Row>

      <Row label="Số tia &amp; Chóa" title="Số luồng tia tỉa ra không gian (3..24) và độ gom lõi chóa đèn Hotspot vs vành Spill (0..1)">
        <NumberInput
          axis="số"
          value={rayCount}
          step={1}
          precision={0}
          min={3}
          max={24}
          onChange={(v, k) => onPatch({ rayCount: Math.round(v) }, k)}
        />
        <NumberInput
          axis="tâm"
          value={hotspotFocus}
          step={0.05}
          precision={2}
          min={0}
          max={1}
          onChange={(v, k) => onPatch({ hotspotFocus: v }, k)}
        />
      </Row>
    </div>
  )
}
