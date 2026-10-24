import React from 'react'
import type {
  DepthPortalConfig,
  Layer,
  LayerVirtualLight,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import { ColorInput, NumberInput, Row, Switch } from '../../controls'
import type { Setter } from '../types'
import {
  CAVE_PORTAL_PRESETS,
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS,
  WIND_STRENGTH_VALUES
} from '../../../engine/virtualLight'
import { createDefaultLayerPhysics } from '../../../engine/layerPhysics'
import { assetStore } from '../../../project/assets'
import { VirtualLightInteractivePad } from './VirtualLightInteractivePad'

const LIGHT_KIND_CARDS: { value: VirtualLightKind; icon: string; name: string; sub: string }[] = [
  { value: 'candle', icon: '🕯️', name: 'Ánh nến', sub: 'Nghiêng theo gió' },
  { value: 'flashlight', icon: '🔦', name: 'Đèn pin', sub: 'Chùm tia nón' },
  { value: 'bulb', icon: '💡', name: 'Bóng đèn', sub: 'Toả tròn 360°' },
  { value: 'campfire', icon: '🔥', name: 'Lửa trại', sub: 'Bập bùng ấm' },
  { value: 'cave_crystal', icon: '🔮', name: 'Tinh thể', sub: 'Phát quang động' },
  { value: 'magic_orb', icon: '✨', name: 'Phép thuật', sub: 'Cầu sáng dịu' }
]

const WIND_PILLS: { value: WindStrengthPreset; label: string; title: string }[] = [
  { value: 'none', label: '🍃 Lặng', title: 'Đứng gió: ngọn nến thở êm dịu tại chỗ' },
  { value: 'gentle', label: '🌬️ Nhẹ', title: 'Gió thổi nhẹ: ngọn lửa nghiêng & lắc mềm mại' },
  { value: 'strong', label: '💨 Mạnh', title: 'Gió thổi mạnh: lửa tạt ngang & chập chờn rõ' },
  { value: 'storm', label: '🌪️ Bão', title: 'Gió bão giật: chớp tắt dữ dội & bùng lửa' }
]

const LIGHT_COLOR_SWATCHES = [
  { color: '#ff9d3b', title: 'Vàng cam ánh nến (2200K)' },
  { color: '#ffe6a3', title: 'Vàng ấm bóng đèn (3200K)' },
  { color: '#e8f4ff', title: 'Trắng lạnh đèn pin LED (6000K)' },
  { color: '#ff7828', title: 'Cam đỏ lửa trại / đuốc' },
  { color: '#38bdf8', title: 'Lam ngọc tinh thể hang động' },
  { color: '#c084fc', title: 'Tím huyền ảo phép thuật' }
]

export function LayerVirtualLightSection({ layer, set }: { layer: Layer; set: Setter }) {
  const vlight: LayerVirtualLight = layer.virtualLight ?? createDefaultVirtualLight('candle')
  const isLightEnabled = Boolean(layer.virtualLight?.enabled)

  const portal: DepthPortalConfig = layer.physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalEnabled = Boolean(layer.physics?.depthPortal?.enabled)

  const runtimeAsset = layer.type === 'image' ? assetStore.get(layer.props.assetId) : undefined
  const thumbUrl = runtimeAsset?.thumbUrl || runtimeAsset?.url || null

  const patchLight = (patch: Partial<LayerVirtualLight>, mergeKey = 'virtual-light'): void => {
    set((l) => {
      const base = l.virtualLight ?? createDefaultVirtualLight('candle')
      const next: LayerVirtualLight = { ...base, ...patch }
      if (patch.kind && patch.kind !== base.kind) {
        const p = VIRTUAL_LIGHT_PRESETS[patch.kind]
        if (p) {
          if (patch.color === undefined) next.color = p.color
          if (patch.intensity === undefined) next.intensity = p.intensity
          if (patch.radius === undefined) next.radius = p.radius
          if (patch.zReach === undefined) next.zReach = p.zReach
          if (patch.coneAngleDeg === undefined) next.coneAngleDeg = p.coneAngleDeg
          if (patch.beamAngleDeg === undefined) next.beamAngleDeg = p.beamAngleDeg
          if (patch.flickerSpeed === undefined) next.flickerSpeed = p.flickerSpeed
          if (patch.windSensitivity === undefined) next.windSensitivity = p.windSensitivity
          if (patch.windPreset === undefined) next.windPreset = p.windPreset
          next.windStrength = WIND_STRENGTH_VALUES[next.windPreset ?? 'gentle']
          if (patch.ambientDim === undefined) next.ambientDim = p.ambientDim
          if (patch.softness === undefined) next.softness = p.softness
        }
      }
      if (patch.windPreset && patch.windStrength === undefined) {
        next.windStrength = WIND_STRENGTH_VALUES[patch.windPreset]
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
  const coneDeg = vlight.coneAngleDeg ?? 360
  const isCone = vlight.kind === 'flashlight' || coneDeg < 350
  const activeConeWhenDirected = coneDeg < 350 ? coneDeg : vlight.kind === 'flashlight' ? 48 : 65

  return (
    <div className="section layer-virtual-light-section" data-mcp-region="inspector_virtual_light">
      {/* Khung Kéo Thả Trực Quan 2.5D (dùng chung cho Đèn & Cửa Hang khi bật 1 trong 2) */}
      {(isPortalEnabled || isLightEnabled) && (
        <VirtualLightInteractivePad
          imageUrl={thumbUrl}
          layerName={layer.name}
          vlight={vlight}
          isLightEnabled={isLightEnabled}
          portal={portal}
          isPortalEnabled={isPortalEnabled}
          onPatchLight={patchLight}
          onPatchPortal={patchPortal}
        />
      )}

      {/* 1. Cổng Chiều Sâu Hang Động (Cave Depth Portal) */}
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span>🕳️ Lối Vào Hang Động &amp; Độ Sâu 2.5D</span>
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
            Đánh dấu vòm cửa hang/cổng sâu: tự tạo bóng tối lòng hang và thu nhỏ nhân vật theo luật phối cảnh 2.5D khi bước vào (tự sáng rõ khi có Ánh sáng ảo chiếu tới).
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.values(CAVE_PORTAL_PRESETS).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn sm ghost"
                title={preset.description}
                onClick={() => patchPortal({ enabled: true, ...preset.config })}
              >
                {preset.badge}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="Mẫu cửa hang" title="Chọn nhanh cấu hình vòm hang đá, cổng di tích, hốc vực tối hoặc động băng">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, width: '100%' }}>
              {Object.values(CAVE_PORTAL_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  className="btn sm ghost"
                  style={{ padding: '2px 3px', fontSize: 9.5, justifyContent: 'center' }}
                  onClick={() => patchPortal({ ...preset.config })}
                >
                  {preset.badge}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Dáng vòm" title="Hình dáng hình học của lối vào hang động">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: '100%' }}>
              {[
                { id: 'arch' as const, label: '🏛️ Vòm hang' },
                { id: 'ellipse' as const, label: '⬭ Elip' },
                { id: 'circle' as const, label: '◯ Tròn' }
              ].map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  className={`btn sm ${(portal.archShape ?? 'arch') === sh.id ? 'primary' : 'ghost'}`}
                  style={{ padding: '2px 4px', fontSize: 10, justifyContent: 'center' }}
                  onClick={() =>
                    patchPortal({
                      archShape: sh.id,
                      radiusUV:
                        sh.id === 'circle'
                          ? [
                              Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : 0.34,
                              Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : 0.34
                            ]
                          : portal.radiusUV
                    })
                  }
                >
                  {sh.label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Độ tối hang" title="Mức bóng tối bao phủ lòng hang (0 = không tối, 0.85 = hang tối sâu)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <input
                type="range"
                min={0}
                max={0.98}
                step={0.02}
                value={portal.darkness}
                onChange={(e) => patchPortal({ darkness: Number(e.target.value) }, 'portal-darkness')}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ width: 64, flexShrink: 0 }}>
                <NumberInput
                  axis="dk"
                  value={portal.darkness}
                  step={0.05}
                  precision={2}
                  min={0}
                  max={0.98}
                  onChange={(v, k) => patchPortal({ darkness: v }, k)}
                />
              </div>
            </div>
          </Row>

          <Row label="Thu nhỏ sâu" title="Tỷ lệ thu nhỏ của nhân vật khi đi sâu vào tâm hang (0.35 = nhỏ bằng 35% kích thước ban đầu)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <input
                type="range"
                min={0.15}
                max={0.95}
                step={0.02}
                value={portal.minScale}
                onChange={(e) => patchPortal({ minScale: Number(e.target.value) }, 'portal-scale')}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ width: 64, flexShrink: 0 }}>
                <NumberInput
                  axis="sc"
                  value={portal.minScale}
                  step={0.05}
                  precision={2}
                  min={0.1}
                  max={0.95}
                  onChange={(v, k) => patchPortal({ minScale: v }, k)}
                />
              </div>
            </div>
          </Row>

          <Row label="Viền / Hút Z" title="Độ chuyển mượt ở mép cửa hang (Feather) và độ hút sâu theo trục Z (px)">
            <NumberInput
              axis="mềm"
              value={portal.feather ?? 0.55}
              step={0.05}
              precision={2}
              min={0.1}
              max={1}
              onChange={(v, k) => patchPortal({ feather: v }, k)}
            />
            <NumberInput
              axis="z-"
              value={portal.depthPullZ ?? 140}
              step={10}
              precision={0}
              min={0}
              max={600}
              suffix="px"
              onChange={(v, k) => patchPortal({ depthPullZ: v }, k)}
            />
          </Row>

          <Row label="Tâm / Cỡ UV" title="Tâm cửa hang (U,V) và bán kính ngang/dọc (Rx,Ry) — có thể kéo trực tiếp trên khung phía trên">
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
            <NumberInput
              axis="rx"
              value={Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.34)}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.8}
              onChange={(v, k) => {
                const ry = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.36)
                patchPortal({ radiusUV: [v, ry] }, k)
              }}
            />
            <NumberInput
              axis="ry"
              value={Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.36)}
              step={0.02}
              precision={2}
              min={0.05}
              max={0.8}
              onChange={(v, k) => {
                const rx = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.34)
                patchPortal({ radiusUV: [rx, v] }, k)
              }}
            />
          </Row>

          <Row label="Màu tối hang" title="Màu bóng tối sâu bên trong lòng hang động">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
              <ColorInput
                compact
                value={portal.shadowTint ?? '#070913'}
                onChange={(val, k) => patchPortal({ shadowTint: val }, k)}
                title="Màu bóng tối trong lòng hang"
              />
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {[
                  { c: '#060812', t: 'Đen đêm sâu' },
                  { c: '#08182b', t: 'Lam động băng' },
                  { c: '#1a0f0a', t: 'Nâu hang đất' },
                  { c: '#140924', t: 'Tím vực thẳm' }
                ].map((sw) => (
                  <button
                    key={sw.c}
                    type="button"
                    title={sw.t}
                    onClick={() => patchPortal({ shadowTint: sw.c })}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: sw.c,
                      border:
                        (portal.shadowTint ?? '#070913').toLowerCase() === sw.c
                          ? '2px solid var(--accent-cyan)'
                          : '1px solid var(--line)',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
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
            Nguồn sáng vật lý 2.5D suy giảm tự nhiên 1/r², nổi khối vân bề mặt và giữ trong trẻo vùng nền rỗng. Chọn nhanh loại đèn:
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {LIGHT_KIND_CARDS.map((card) => (
              <button
                key={card.value}
                type="button"
                className="btn sm ghost"
                style={{ justifyContent: 'flex-start', padding: '4px 6px', fontSize: 10.5 }}
                onClick={() => patchLight({ enabled: true, kind: card.value })}
              >
                {card.icon} {card.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 1-Click Visual Preset Grid (replaces truncated combobox) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              marginBottom: 2
            }}
          >
            {LIGHT_KIND_CARDS.map((card) => {
              const active = vlight.kind === card.value
              return (
                <button
                  key={card.value}
                  type="button"
                  title={VIRTUAL_LIGHT_PRESETS[card.value]?.description}
                  onClick={() => patchLight({ kind: card.value })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: active ? '1px solid var(--accent)' : '1px solid var(--line-soft)',
                    background: active ? 'var(--bg-3)' : 'var(--bg-1)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: active ? 'inset 0 0 0 1px var(--accent)' : 'none'
                  }}
                >
                  <span style={{ fontSize: 10.5, fontWeight: 600 }}>
                    {card.icon} {card.name}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{card.sub}</span>
                </button>
              )
            })}
          </div>

          {isFlame && (
            <>
              <Row label="Gió thổi lửa" title="Cường độ gió tác động trực tiếp làm nghiêng ngọn lửa và chập chờn ánh sáng">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, width: '100%' }}>
                  {WIND_PILLS.map((w) => {
                    const active = (vlight.windPreset ?? 'gentle') === w.value
                    return (
                      <button
                        key={w.value}
                        type="button"
                        title={w.title}
                        className={`btn sm ${active ? 'primary' : 'ghost'}`}
                        style={{ padding: '2px 3px', fontSize: 9.5, justifyContent: 'center' }}
                        onClick={() =>
                          patchLight({
                            windPreset: w.value,
                            windStrength: WIND_STRENGTH_VALUES[w.value]
                          })
                        }
                      >
                        {w.label}
                      </button>
                    )
                  })}
                </div>
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
                  value={vlight.flickerSpeed ?? 1.2}
                  step={0.1}
                  precision={1}
                  min={0}
                  max={6.0}
                  onChange={(v, k) => patchLight({ flickerSpeed: v }, k)}
                />
              </Row>
            </>
          )}

          <Row label="Hướng chiếu" title="Chọn toả tròn 360° hoặc định hướng chùm sáng (giữ nguyên độ mở chóp hiện tại)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: '100%' }}>
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
                  cone: activeConeWhenDirected,
                  beam: 0,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > -22 && (vlight.beamAngleDeg ?? 0) <= 22
                },
                {
                  label: '↗ Chéo',
                  title: 'Chiếu chéo lên phải (35°)',
                  cone: activeConeWhenDirected,
                  beam: 35,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > 22 && (vlight.beamAngleDeg ?? 0) <= 65
                },
                {
                  label: '↑ Lên',
                  title: 'Chiếu thẳng lên trên (90°)',
                  cone: activeConeWhenDirected,
                  beam: 90,
                  active: isCone && (vlight.beamAngleDeg ?? 0) > 65 && (vlight.beamAngleDeg ?? 0) <= 135
                },
                {
                  label: '← Trái',
                  title: 'Chiếu sang trái (180°)',
                  cone: activeConeWhenDirected,
                  beam: 180,
                  active:
                    isCone &&
                    ((vlight.beamAngleDeg ?? 0) > 135 || (vlight.beamAngleDeg ?? 0) <= -135)
                },
                {
                  label: '↓ Xuống',
                  title: 'Chiếu xuống dưới (-90°)',
                  cone: activeConeWhenDirected,
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

          <Row label="Góc / Mở chóp" title="Góc hướng tia sáng (∠: -180°..180°) và độ mở chóp nón ánh sáng (Δ: 15°..360°)">
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
                    coneAngleDeg: coneDeg >= 350 ? 60 : coneDeg
                  },
                  k
                )
              }
            />
            <NumberInput
              axis="Δ"
              value={coneDeg}
              step={5}
              precision={0}
              min={15}
              max={360}
              suffix="°"
              onChange={(v, k) => patchLight({ coneAngleDeg: v }, k)}
            />
          </Row>

          <Row label="Cường độ sáng" title="Độ mạnh của nguồn sáng theo chuẩn Filmic (không gây cháy trắng xoá chi tiết ảnh)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <input
                id="layer-virtual-light-intensity-slider"
                type="range"
                min={0.05}
                max={2.5}
                step={0.05}
                value={Math.min(2.5, Math.max(0.05, vlight.intensity))}
                onChange={(e) => patchLight({ intensity: Number(e.target.value) }, 'virtual-light-intensity')}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ width: 64, flexShrink: 0 }}>
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

          <Row label="Tương phản tối" title="Làm dịu vùng tối ngoài tầm đèn (Ambient Dim) để quầng sáng nổi bật tự nhiên mà không cần tăng chói">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.02}
                value={vlight.ambientDim ?? 0.24}
                onChange={(e) => patchLight({ ambientDim: Number(e.target.value) }, 'virtual-light-dim')}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ width: 64, flexShrink: 0 }}>
                <NumberInput
                  axis="dim"
                  value={vlight.ambientDim ?? 0.24}
                  step={0.05}
                  precision={2}
                  min={0}
                  max={0.85}
                  onChange={(v, k) => patchLight({ ambientDim: v }, k)}
                />
              </div>
            </div>
          </Row>

          <Row label="Bán kính / Z" title="Bán kính chiếu sáng XY (px) và tầm lan toả sang các layer lân cận theo chiều sâu Z (px)">
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
              value={vlight.zReach ?? 320}
              step={15}
              precision={0}
              min={20}
              max={900}
              suffix="px"
              onChange={(v, k) => patchLight({ zReach: v }, k)}
            />
          </Row>

          <Row label="Màu &amp; Viền" title="Màu nhiệt độ nguồn sáng và độ mềm viền bán dạ (Softness)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
              <ColorInput
                compact
                value={vlight.color}
                onChange={(val, k) => patchLight({ color: val }, k)}
                title="Chọn màu nguồn sáng ảo"
              />
              <div style={{ display: 'flex', gap: 3 }}>
                {LIGHT_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={sw.color}
                    type="button"
                    title={sw.title}
                    onClick={() => patchLight({ color: sw.color })}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: sw.color,
                      border:
                        vlight.color.toLowerCase() === sw.color
                          ? '2px solid var(--text)'
                          : '1px solid var(--line)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  />
                ))}
              </div>
              <div style={{ width: 64, marginLeft: 'auto', flexShrink: 0 }}>
                <NumberInput
                  axis="mềm"
                  value={vlight.softness ?? 0.5}
                  step={0.05}
                  precision={2}
                  min={0.1}
                  max={1}
                  onChange={(v, k) => patchLight({ softness: v }, k)}
                />
              </div>
            </div>
          </Row>
        </div>
      )}
    </div>
  )
}
