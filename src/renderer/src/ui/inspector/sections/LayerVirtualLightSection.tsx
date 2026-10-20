import React from 'react'
import type {
  DepthPortalConfig,
  Layer,
  LayerVirtualLight,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import { ColorInput, NumberInput, Row, Select, Switch } from '../../controls'
import type { Setter } from '../types'
import {
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS
} from '../../../engine/virtualLight'
import { createDefaultLayerPhysics } from '../../../engine/layerPhysics'

const LIGHT_KIND_OPTIONS: { value: VirtualLightKind; label: string }[] = [
  { value: 'candle', label: '🕯️ Ánh nến (Phản ứng theo gió thổi yếu / mạnh)' },
  { value: 'flashlight', label: '🔦 Đèn pin (Chùm tia nón định hướng)' },
  { value: 'bulb', label: '💡 Bóng đèn dây tóc / Neon (Toả tròn ổn định)' },
  { value: 'campfire', label: '🔥 Lửa trại / Đuốc (Bập bùng & tạt lửa theo gió)' },
  { value: 'cave_crystal', label: '🔮 Tinh thể hang động (Phát quang nhịp thở trong động)' },
  { value: 'magic_orb', label: '✨ Cầu phép thuật (Lơ lửng phát sáng huyền ảo)' }
]

const WIND_PRESET_OPTIONS: { value: WindStrengthPreset; label: string }[] = [
  { value: 'none', label: '🍃 Đứng gió (Ngọn nến thở êm dịu)' },
  { value: 'gentle', label: '🌬️ Gió thổi nhẹ (Ngọn lửa nghiêng & lắc mềm)' },
  { value: 'strong', label: '💨 Gió thổi mạnh (Chập chờn suýt tắt & tạt lửa)' },
  { value: 'storm', label: '🌪️ Gió bão giật (Chớp tắt dữ dội & bùng lửa)' }
]

export function LayerVirtualLightSection({ layer, set }: { layer: Layer; set: Setter }) {
  const vlight: LayerVirtualLight = layer.virtualLight ?? createDefaultVirtualLight('candle')
  const isLightEnabled = Boolean(layer.virtualLight?.enabled)

  const portal: DepthPortalConfig = layer.physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalEnabled = Boolean(layer.physics?.depthPortal?.enabled)

  const patchLight = (patch: Partial<LayerVirtualLight>, mergeKey = 'virtual-light'): void => {
    set((l) => {
      const base = l.virtualLight ?? createDefaultVirtualLight('candle')
      const next: LayerVirtualLight = { ...base, ...patch }
      if (patch.kind && patch.kind !== base.kind) {
        const p = VIRTUAL_LIGHT_PRESETS[patch.kind]
        if (p) {
          next.color = p.color
          next.intensity = p.intensity
          next.radius = p.radius
          next.zReach = p.zReach
          next.coneAngleDeg = p.coneAngleDeg
          next.flickerSpeed = p.flickerSpeed
          next.windSensitivity = p.windSensitivity
        }
      }
      l.virtualLight = next
    }, mergeKey)
  }

  const patchPortal = (patch: Partial<DepthPortalConfig>, mergeKey = 'depth-portal'): void => {
    set((l) => {
      if (!l.physics) {
        l.physics = createDefaultLayerPhysics('ground_terrain')
        l.physics.enabled = true
      }
      const base = l.physics.depthPortal ?? createDefaultDepthPortal()
      l.physics.depthPortal = { ...base, ...patch }
    }, mergeKey)
  }

  const isFlame = vlight.kind === 'candle' || vlight.kind === 'campfire'
  const isCone = vlight.kind === 'flashlight' || (vlight.coneAngleDeg ?? 360) < 350

  return (
    <div className="section layer-virtual-light-section" data-mcp-region="inspector_virtual_light">
      {/* 1. Cổng Chiều Sâu Hang Động (Cave Depth Portal) */}
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span>🕳️ Lối Vào Hang Động & Độ Sâu 2.5D</span>
        <Switch
          id="layer-depth-portal-enabled"
          on={isPortalEnabled}
          onChange={(on) => patchPortal({ enabled: on })}
        />
      </div>

      {!isPortalEnabled ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            lineHeight: 1.45,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            marginBottom: 10
          }}
        >
          <span>
            Đánh dấu vùng cửa hang/hốc sâu trên ảnh nền: nhân vật đi vào vùng này sẽ tự động nhỏ dần theo độ sâu và bị bóng tối hang động che phủ (trừ khi có Ánh sáng ảo chiếu sáng).
          </span>
          <div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchPortal({ enabled: true })}
            >
              🕳️ Bật Cổng Độ Sâu Hang Động
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Row label="Tâm hang UV" title="Toạ độ tâm lối vào hang động trên ảnh (U: trái->phải, V: đáy->đỉnh)">
            <NumberInput
              axis="u"
              value={portal.centerUV[0]}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.95}
              onChange={(v, k) => patchPortal({ centerUV: [v, portal.centerUV[1]] }, k)}
            />
            <NumberInput
              axis="v"
              value={portal.centerUV[1]}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.95}
              onChange={(v, k) => patchPortal({ centerUV: [portal.centerUV[0], v] }, k)}
            />
          </Row>

          <Row label="Bán kính UV" title="Độ rộng ngang (Rx) và cao (Ry) của vùng cửa hang trên ảnh">
            <NumberInput
              axis="rx"
              value={Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.8}
              onChange={(v, k) => {
                const ry = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)
                patchPortal({ radiusUV: [v, ry] }, k)
              }}
            />
            <NumberInput
              axis="ry"
              value={Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.8}
              onChange={(v, k) => {
                const rx = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)
                patchPortal({ radiusUV: [rx, v] }, k)
              }}
            />
          </Row>

          <Row label="Thu nhỏ / Tối" title="Tỷ lệ thu nhỏ tối đa khi đi sâu vào tâm hang (Min Scale) và độ tối che phủ (Darkness)">
            <NumberInput
              axis="sc"
              value={portal.minScale}
              step={0.05}
              precision={2}
              min={0.1}
              max={0.95}
              onChange={(v, k) => patchPortal({ minScale: v }, k)}
            />
            <NumberInput
              axis="dk"
              value={portal.darkness}
              step={0.05}
              precision={2}
              min={0}
              max={0.98}
              onChange={(v, k) => patchPortal({ darkness: v }, k)}
            />
          </Row>

          <Row label="Lùi Z / Màu" title="Độ lùi sâu Z (px) khi bước vào hang và màu bóng tối trong hang">
            <NumberInput
              axis="z+"
              value={portal.depthPullZ ?? 90}
              step={10}
              precision={0}
              min={0}
              max={500}
              suffix="px"
              onChange={(v, k) => patchPortal({ depthPullZ: v }, k)}
            />
            <ColorInput
              value={portal.shadowTint ?? '#070913'}
              onChange={(val, k) => patchPortal({ shadowTint: val }, k)}
              title="Màu bóng tối trong lòng hang"
            />
          </Row>
        </div>
      )}

      {/* 2. Công Cụ Ánh Sáng Ảo 2.5D (Virtual Light Tool) */}
      <div
        className="section-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: 6,
          borderTop: '1px solid var(--line-soft)'
        }}
      >
        <span>🕯️ Công Cụ Ánh Sáng Ảo 2.5D</span>
        <Switch
          id="layer-virtual-light-enabled"
          on={isLightEnabled}
          onChange={(on) => patchLight({ enabled: on })}
        />
      </div>

      {!isLightEnabled ? (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            lineHeight: 1.45,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <span>
            Biến layer thành nguồn sáng ảo 2.5D (Ánh nến phản ứng gió yếu/mạnh, Đèn pin chùm tia, Bóng đèn, Tinh thể chiếu sáng nhân vật đi sâu trong hang động).
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchLight({ enabled: true, kind: 'candle', windPreset: 'gentle' })}
            >
              🕯️ Ánh nến (Gió)
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchLight({ enabled: true, kind: 'flashlight' })}
            >
              🔦 Đèn pin
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchLight({ enabled: true, kind: 'bulb' })}
            >
              💡 Bóng đèn
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchLight({ enabled: true, kind: 'cave_crystal' })}
            >
              🔮 Tinh thể động
            </button>
          </div>
        </div>
      ) : (
        <>
          <Row label="Loại sáng" title={VIRTUAL_LIGHT_PRESETS[vlight.kind]?.description}>
            <Select
              id="layer-virtual-light-kind"
              value={vlight.kind}
              options={LIGHT_KIND_OPTIONS}
              onChange={(val) => patchLight({ kind: val as VirtualLightKind })}
            />
          </Row>

          {isFlame && (
            <>
              <Row label="Gió thổi lửa" title="Cường độ gió tác động lên ngọn nến / lửa trại (nghiêng ngọn lửa & chập chờn)">
                <Select
                  id="layer-virtual-light-wind"
                  value={vlight.windPreset ?? 'gentle'}
                  options={WIND_PRESET_OPTIONS}
                  onChange={(val) => patchLight({ windPreset: val as WindStrengthPreset })}
                />
              </Row>
              <Row label="Hướng / Nhịp" title="Góc gió thổi (0° = thổi sang phải, 180° = thổi sang trái) và tốc độ bập bùng">
                <NumberInput
                  axis="∠"
                  value={vlight.windDirectionDeg ?? 0}
                  step={5}
                  precision={0}
                  min={-180}
                  max={180}
                  suffix="°"
                  onChange={(v, k) => patchLight({ windDirectionDeg: v }, k)}
                />
                <NumberInput
                  axis="hz"
                  value={vlight.flickerSpeed ?? 1.8}
                  step={0.2}
                  precision={1}
                  min={0.2}
                  max={6.0}
                  onChange={(v, k) => patchLight({ flickerSpeed: v }, k)}
                />
              </Row>
            </>
          )}

          <Row label="Hướng chiếu" title="Chọn nhanh toả tròn 360° hoặc định hướng chùm sáng chiếu theo hướng cụ thể">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, width: '100%' }}>
              {[
                {
                  label: '☀️ 360°',
                  title: 'Tỏa sáng tròn đều 360° mọi hướng',
                  cone: 360,
                  beam: 0,
                  active: !isCone
                },
                {
                  label: '→ Phải',
                  title: 'Chiếu sang phải (0°)',
                  cone: 75,
                  beam: 0,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > -22 && (vlight.beamAngleDeg ?? 0) <= 22
                },
                {
                  label: '↗ Chéo',
                  title: 'Chiếu chéo lên phải (35°)',
                  cone: 75,
                  beam: 35,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > 22 && (vlight.beamAngleDeg ?? 0) <= 65
                },
                {
                  label: '↑ Lên',
                  title: 'Chiếu thẳng lên trên (90°)',
                  cone: 85,
                  beam: 90,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > 65 && (vlight.beamAngleDeg ?? 0) <= 135
                },
                {
                  label: '← Trái',
                  title: 'Chiếu sang trái (180°)',
                  cone: 75,
                  beam: 180,
                  active:
                    isCone &&
                    ((vlight.beamAngleDeg ?? 0) > 135 || (vlight.beamAngleDeg ?? 0) <= -135)
                },
                {
                  label: '↓ Xuống',
                  title: 'Chiếu xuống dưới (-90°)',
                  cone: 85,
                  beam: -90,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > -135 && (vlight.beamAngleDeg ?? 0) <= -22
                }
              ].map((dir) => (
                <button
                  key={dir.label}
                  type="button"
                  title={dir.title}
                  className={`btn sm ${dir.active ? 'primary' : 'ghost'}`}
                  style={{ padding: '2px 2px', fontSize: 10, whiteSpace: 'nowrap', justifyContent: 'center' }}
                  onClick={() =>
                    patchLight({
                      beamAngleDeg: dir.beam,
                      coneAngleDeg: dir.cone
                    })
                  }
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Góc / Mở chóp" title="Góc hướng chiếu sáng (∠: 0°=phải, 90°=lên, 180°=trái, -90°=xuống) và độ mở chóp nón ánh sáng (Δ: 15°..360°)">
            <NumberInput
              axis="∠"
              value={vlight.beamAngleDeg ?? 0}
              step={5}
              precision={0}
              min={-180}
              max={180}
              suffix="°"
              onChange={(v, k) =>
                patchLight(
                  {
                    beamAngleDeg: v,
                    coneAngleDeg: (vlight.coneAngleDeg ?? 360) >= 350 ? 85 : vlight.coneAngleDeg
                  },
                  k
                )
              }
            />
            <NumberInput
              axis="Δ"
              value={vlight.coneAngleDeg ?? 360}
              step={5}
              precision={0}
              min={15}
              max={360}
              suffix="°"
              onChange={(v, k) => patchLight({ coneAngleDeg: v }, k)}
            />
          </Row>

          <Row label="Cường độ sáng" title="Kéo thanh trượt hoặc nhập số để chỉnh độ mạnh yếu của ánh sáng (0.05 = dịu mờ, 0.85 = tự nhiên, 1.5+ = rực sáng)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <input
                id="layer-virtual-light-intensity-slider"
                type="range"
                min={0.05}
                max={3.0}
                step={0.05}
                value={Math.min(3.0, Math.max(0.05, vlight.intensity))}
                onChange={(e) => patchLight({ intensity: Number(e.target.value) }, 'virtual-light-intensity')}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ width: 68, flexShrink: 0 }}>
                <NumberInput
                  axis="I"
                  value={vlight.intensity}
                  step={0.05}
                  precision={2}
                  min={0.05}
                  max={3.0}
                  onChange={(v, k) => patchLight({ intensity: v }, k)}
                />
              </div>
            </div>
          </Row>

          <Row label="Màu ánh sáng" title="Màu sắc nguồn sáng và các nút chọn nhanh mức cường độ sáng">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', flexWrap: 'nowrap' }}>
              <ColorInput
                compact
                value={vlight.color}
                onChange={(val, k) => patchLight({ color: val }, k)}
                title="Chọn màu nguồn sáng ảo"
              />
              <div style={{ display: 'flex', gap: 3, marginLeft: 'auto', flexShrink: 0 }}>
                {[
                  { label: 'Dịu 0.4', val: 0.4 },
                  { label: 'Vừa 0.85', val: 0.85 },
                  { label: 'Rực 1.4', val: 1.4 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`btn sm ${Math.abs(vlight.intensity - preset.val) < 0.06 ? 'primary' : 'ghost'}`}
                    style={{ padding: '2px 5px', fontSize: 10 }}
                    onClick={() => patchLight({ intensity: preset.val })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </Row>

          <Row label="Bán kính / Z" title="Bán kính chiếu sáng XY (px) và độ lan toả theo chiều sâu Z (px)">
            <NumberInput
              axis="r"
              value={vlight.radius}
              step={15}
              precision={0}
              min={40}
              max={1800}
              suffix="px"
              onChange={(v, k) => patchLight({ radius: v }, k)}
            />
            <NumberInput
              axis="z±"
              value={vlight.zReach ?? 350}
              step={10}
              precision={0}
              min={20}
              max={900}
              suffix="px"
              onChange={(v, k) => patchLight({ zReach: v }, k)}
            />
          </Row>

          <Row label="Tâm sáng UV" title="Vị trí tâm phát sáng trên Mesh layer (U: 0..1 ngang, V: 0..1 dọc)">
            <NumberInput
              axis="u"
              value={vlight.originUV?.[0] ?? 0.5}
              step={0.05}
              precision={2}
              min={0}
              max={1}
              onChange={(v, k) => patchLight({ originUV: [v, vlight.originUV?.[1] ?? 0.5] }, k)}
            />
            <NumberInput
              axis="v"
              value={vlight.originUV?.[1] ?? 0.5}
              step={0.05}
              precision={2}
              min={0}
              max={1}
              onChange={(v, k) => patchLight({ originUV: [vlight.originUV?.[0] ?? 0.5, v] }, k)}
            />
          </Row>
        </>
      )}
    </div>
  )
}
