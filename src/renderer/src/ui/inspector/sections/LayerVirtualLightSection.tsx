import React, { useState } from 'react'
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
import '../../../styles/virtualLightInspector.css'

const LIGHT_KIND_CARDS: { value: VirtualLightKind; icon: string; name: string; sub: string }[] = [
  { value: 'candle', icon: '🕯️', name: 'Ánh nến', sub: 'Nghiêng theo gió' },
  { value: 'flashlight', icon: '🔦', name: 'Đèn pin / Cột đèn', sub: 'Chùm tia xuyên layer' },
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
  { color: '#ffe6a3', title: 'Vàng ấm bóng đèn đường (3200K)' },
  { color: '#e8f4ff', title: 'Trắng lạnh đèn pin LED (6000K)' },
  { color: '#ff7828', title: 'Cam đỏ lửa trại / đuốc' },
  { color: '#38bdf8', title: 'Lam ngọc tinh thể hang động' },
  { color: '#c084fc', title: 'Tím huyền ảo phép thuật' }
]

const CAVE_SHADOW_SWATCHES = [
  { color: '#060812', title: 'Đen đêm sâu' },
  { color: '#08182b', title: 'Lam động băng' },
  { color: '#1a0f0a', title: 'Nâu hang đất' },
  { color: '#140924', title: 'Tím vực thẳm' }
]

type InspectorSubTab = 'light' | 'portal' | 'both'

export function LayerVirtualLightSection({ layer, set }: { layer: Layer; set: Setter }) {
  const vlight: LayerVirtualLight = layer.virtualLight ?? createDefaultVirtualLight('candle')
  const isLightEnabled = Boolean(layer.virtualLight?.enabled)

  const portal: DepthPortalConfig = layer.physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalEnabled = Boolean(layer.physics?.depthPortal?.enabled)

  const [subTab, setSubTab] = useState<InspectorSubTab>('light')

  const runtimeAsset = layer.type === 'image' ? assetStore.get(layer.props.assetId) : undefined
  const thumbUrl = runtimeAsset?.thumbUrl || runtimeAsset?.url || null
  const layerSize: [number, number] | undefined =
    runtimeAsset?.meta.width && runtimeAsset?.meta.height
      ? [runtimeAsset.meta.width, runtimeAsset.meta.height]
      : undefined

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
          if (patch.beamCurvature === undefined) next.beamCurvature = p.beamCurvature
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
  const activeConeWhenDirected = coneDeg < 350 ? coneDeg : vlight.kind === 'flashlight' ? 54 : 68
  const beamCurvature = vlight.beamCurvature ?? 0
  const zReachVal =
    vlight.zReach === undefined ||
    vlight.zReach === 280 ||
    vlight.zReach === 320 ||
    vlight.zReach === 350 ||
    vlight.zReach === 380
      ? 1500
      : vlight.zReach

  const showLightPanel = subTab === 'light' || subTab === 'both'
  const showPortalPanel = subTab === 'portal' || subTab === 'both'

  return (
    <div
      className="section layer-virtual-light-section vl-inspector-root"
      data-mcp-region="inspector_virtual_light"
    >
      {/* 1. Sticky 2.5D Pad Dock + Segmented Sub-Tab Bar (luôn ghim trên cùng, không bị cuộn trôi) */}
      <div className="vl-sticky-dock">
        <VirtualLightInteractivePad
          imageUrl={thumbUrl}
          layerName={layer.name}
          layerSize={layerSize}
          vlight={vlight}
          isLightEnabled={isLightEnabled}
          portal={portal}
          isPortalEnabled={isPortalEnabled}
          onPatchLight={patchLight}
          onPatchPortal={patchPortal}
        />

        <div className="vl-subtab-bar" role="tablist" aria-label="Chuyển nhanh Ánh sáng ảo và Cửa hang 2.5D">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'light'}
            className={`vl-subtab-btn ${subTab === 'light' ? 'active' : ''}`}
            onClick={() => setSubTab('light')}
            title="Chỉnh Công cụ Ánh Sáng Ảo 2.5D ngay dưới Khung Chỉnh"
          >
            🕯️ Ánh Sáng {isLightEnabled ? '●' : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'portal'}
            className={`vl-subtab-btn ${subTab === 'portal' ? 'active' : ''}`}
            onClick={() => setSubTab('portal')}
            title="Chỉnh Lối Vào Hang Động & Độ Sâu 2.5D ngay dưới Khung Chỉnh"
          >
            🕳️ Cửa Hang {isPortalEnabled ? '●' : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'both'}
            className={`vl-subtab-btn ${subTab === 'both' ? 'active' : ''}`}
            onClick={() => setSubTab('both')}
            title="Hiển thị đồng thời cả hai bảng điều khiển bên dưới Khung Chỉnh ghim cố định"
          >
            ⊞ Hiện Cả Hai
          </button>
        </div>
      </div>

      {/* 2. Bảng Điều Khiển Ánh Sáng Ảo 2.5D */}
      {showLightPanel && (
        <div className="vl-section-card">
          <div className="vl-row-header">
            <span className="vl-title">🕯️ Công Cụ Ánh Sáng Ảo 2.5D (Xuyên Layer)</span>
            <Switch
              id="layer-virtual-light-enabled"
              on={isLightEnabled}
              onChange={(on) => patchLight({ enabled: on })}
            />
          </div>

          {!isLightEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="vl-subtitle" style={{ lineHeight: 1.45 }}>
                Nguồn sáng vật lý 2.5D đồng bộ 1:1 với Camera và chiếu xuyên tự do sang mọi layer xếp chồng (ví dụ: cột đèn chiếu xuống nền đường và nhân vật bên dưới). Chọn nhanh loại đèn:
              </span>
              <div className="vl-kind-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {LIGHT_KIND_CARDS.map((card) => (
                  <button
                    key={card.value}
                    type="button"
                    className="vl-kind-card"
                    onClick={() => patchLight({ enabled: true, kind: card.value })}
                  >
                    <span className="vl-kind-icon">{card.icon}</span>
                    <span className="vl-kind-label">{card.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Preset Kind Cards */}
              <div className="vl-kind-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {LIGHT_KIND_CARDS.map((card) => {
                  const active = vlight.kind === card.value
                  return (
                    <button
                      key={card.value}
                      type="button"
                      title={VIRTUAL_LIGHT_PRESETS[card.value]?.description}
                      className={`vl-kind-card ${active ? 'active' : ''}`}
                      onClick={() => patchLight({ kind: card.value })}
                    >
                      <span className="vl-kind-icon">{card.icon}</span>
                      <span className="vl-kind-label">{card.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* Cường độ sáng & Tương phản tối */}
              <div className="vl-subcard">
                <Row label="Độ sáng đèn" title="Cường độ nguồn sáng đồng bộ 1:1 giữa Khung Chỉnh 2.5D và Camera">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      id="layer-virtual-light-intensity-slider"
                      type="range"
                      min={0.05}
                      max={2.6}
                      step={0.05}
                      value={Math.min(2.6, Math.max(0.05, vlight.intensity))}
                      onChange={(e) =>
                        patchLight({ intensity: Number(e.target.value) }, 'virtual-light-intensity')
                      }
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

                <Row label="Dịu nền tối" title="Làm dịu vùng tối ngoài tầm đèn (Ambient Dim) để quầng sáng nổi bật rõ nét">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={0}
                      max={0.85}
                      step={0.02}
                      value={vlight.ambientDim ?? 0.24}
                      onChange={(e) =>
                        patchLight({ ambientDim: Number(e.target.value) }, 'virtual-light-dim')
                      }
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
              </div>

              {/* Khung Sáng: Độ Dài, Độ Hướng, Độ Mở & Độ Cong */}
              <div className="vl-subcard">
                <div className="vl-row-header">
                  <span className="vl-subtitle">📐 Khung Sáng (Dài • Hướng • Mở • Cong)</span>
                  <span className="vl-value-badge">{isCone ? `${vlight.beamAngleDeg ?? -90}°` : '360°'}</span>
                </div>

                <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {[
                    {
                      label: '↓ Chiếu xuống',
                      title: 'Chiếu thẳng xuống dưới (-90°) — chuẩn cho cột đèn / đèn treo',
                      cone: activeConeWhenDirected,
                      beam: -90,
                      active:
                        isCone &&
                        (vlight.beamAngleDeg ?? -90) >= -112 &&
                        (vlight.beamAngleDeg ?? -90) <= -68
                    },
                    {
                      label: '↙ Chéo trái',
                      title: 'Chiếu chéo xuống bên trái (-130°)',
                      cone: activeConeWhenDirected,
                      beam: -130,
                      active:
                        isCone &&
                        (vlight.beamAngleDeg ?? 0) < -112 &&
                        (vlight.beamAngleDeg ?? 0) >= -158
                    },
                    {
                      label: '↘ Chéo phải',
                      title: 'Chiếu chéo xuống bên phải (-50°)',
                      cone: activeConeWhenDirected,
                      beam: -50,
                      active:
                        isCone &&
                        (vlight.beamAngleDeg ?? 0) > -68 &&
                        (vlight.beamAngleDeg ?? 0) <= -22
                    },
                    {
                      label: '→ Sang phải',
                      title: 'Chiếu ngang sang phải (0°)',
                      cone: activeConeWhenDirected,
                      beam: 0,
                      active:
                        isCone &&
                        (vlight.beamAngleDeg ?? 0) > -22 &&
                        (vlight.beamAngleDeg ?? 0) <= 22
                    },
                    {
                      label: '← Sang trái',
                      title: 'Chiếu ngang sang trái (180°)',
                      cone: activeConeWhenDirected,
                      beam: 180,
                      active:
                        isCone &&
                        ((vlight.beamAngleDeg ?? 0) > 158 || (vlight.beamAngleDeg ?? 0) < -158)
                    },
                    {
                      label: '☀️ Tỏa 360°',
                      title: 'Tỏa sáng tròn đều 360° mọi hướng',
                      cone: 360,
                      beam: 0,
                      active: !isCone
                    }
                  ].map((dir) => (
                    <button
                      key={dir.label}
                      type="button"
                      title={dir.title}
                      className={`vl-pill-btn ${dir.active ? 'active-amber' : ''}`}
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

                <Row label="Độ dài tia" title="Độ dài khung sáng (vượt tự do ra ngoài kích thước layer gốc để chiếu lên các layer khác)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={80}
                      max={2200}
                      step={15}
                      value={Math.min(2200, Math.max(80, vlight.radius))}
                      onChange={(e) =>
                        patchLight({ radius: Number(e.target.value) }, 'virtual-light-radius')
                      }
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div style={{ width: 70, flexShrink: 0 }}>
                      <NumberInput
                        axis="dài"
                        value={vlight.radius}
                        step={20}
                        precision={0}
                        min={60}
                        max={2600}
                        suffix="px"
                        onChange={(v, k) => patchLight({ radius: v }, k)}
                      />
                    </div>
                  </div>
                </Row>

                <Row label="Độ hướng ∠" title="Góc xoay hướng chiếu của khung sáng (-180°..180°, -90° = chiếu thẳng xuống dưới)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={2}
                      value={vlight.beamAngleDeg ?? -90}
                      onChange={(e) =>
                        patchLight(
                          {
                            beamAngleDeg: Number(e.target.value),
                            coneAngleDeg: coneDeg >= 350 ? 64 : coneDeg
                          },
                          'virtual-light-beam-angle'
                        )
                      }
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div style={{ width: 64, flexShrink: 0 }}>
                      <NumberInput
                        axis="∠"
                        value={vlight.beamAngleDeg ?? -90}
                        step={5}
                        precision={0}
                        min={-180}
                        max={180}
                        suffix="°"
                        onChange={(v, k) =>
                          patchLight(
                            {
                              beamAngleDeg: v,
                              coneAngleDeg: coneDeg >= 350 ? 64 : coneDeg
                            },
                            k
                          )
                        }
                      />
                    </div>
                  </div>
                </Row>

                <Row label="Độ mở chóp" title="Góc mở rộng của khung sáng (15° = tia hẹp đèn rọi, 75° = đèn đường, 360° = tỏa tròn)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={15}
                      max={360}
                      step={5}
                      value={coneDeg}
                      onChange={(e) =>
                        patchLight({ coneAngleDeg: Number(e.target.value) }, 'virtual-light-cone')
                      }
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div style={{ width: 64, flexShrink: 0 }}>
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
                    </div>
                  </div>
                </Row>

                <Row label="Độ cong tia" title="Uốn độ cong thành bên của khung sáng (-0.8 = chụm tia đèn pha hẹp, 0 = nón thẳng, +0.8 = vòm parabol tỏa rộng)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={-0.8}
                      max={1.0}
                      step={0.05}
                      value={beamCurvature}
                      onChange={(e) =>
                        patchLight(
                          {
                            beamCurvature: Number(e.target.value),
                            coneAngleDeg: coneDeg >= 350 ? 68 : coneDeg
                          },
                          'virtual-light-curvature'
                        )
                      }
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div style={{ width: 64, flexShrink: 0 }}>
                      <NumberInput
                        axis="⌒"
                        value={beamCurvature}
                        step={0.05}
                        precision={2}
                        min={-0.8}
                        max={1.0}
                        onChange={(v, k) => patchLight({ beamCurvature: v }, k)}
                      />
                    </div>
                  </div>
                </Row>

                <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {[
                    { label: '🔦 Tia hội tụ', val: -0.45, title: 'Khung sáng thuôn hẹp tập trung ở xa' },
                    { label: '📐 Nón thẳng', val: 0, title: 'Khung nón ánh sáng tiêu chuẩn' },
                    { label: '⌒ Vòm parabol', val: 0.55, title: 'Khung sáng uốn vòm rộng ôm trọn cảnh dưới' }
                  ].map((cp) => (
                    <button
                      key={cp.label}
                      type="button"
                      title={cp.title}
                      className={`vl-pill-btn ${Math.abs(beamCurvature - cp.val) < 0.12 ? 'active' : ''}`}
                      onClick={() =>
                        patchLight({
                          beamCurvature: cp.val,
                          coneAngleDeg: coneDeg >= 350 ? 68 : coneDeg
                        })
                      }
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>

                <Row label="Xuyên Z±" title="Tầm truyền ánh sáng sang các layer xếp chồng phía trước & phía sau theo trục Z (px)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <input
                      type="range"
                      min={150}
                      max={2500}
                      step={50}
                      value={Math.min(2500, Math.max(150, zReachVal))}
                      onChange={(e) =>
                        patchLight({ zReach: Number(e.target.value) }, 'virtual-light-zreach')
                      }
                      style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div style={{ width: 70, flexShrink: 0 }}>
                      <NumberInput
                        axis="z±"
                        value={zReachVal}
                        step={50}
                        precision={0}
                        min={100}
                        max={3000}
                        suffix="px"
                        onChange={(v, k) => patchLight({ zReach: v }, k)}
                      />
                    </div>
                  </div>
                </Row>
              </div>

              {isFlame && (
                <div className="vl-subcard">
                  <Row label="Gió thổi lửa" title="Cường độ gió làm nghiêng ngọn lửa và chập chờn ánh sáng">
                    <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', width: '100%' }}>
                      {WIND_PILLS.map((w) => {
                        const active = (vlight.windPreset ?? 'gentle') === w.value
                        return (
                          <button
                            key={w.value}
                            type="button"
                            title={w.title}
                            className={`vl-pill-btn ${active ? 'active' : ''}`}
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
                  <Row label="Hướng / Nhịp" title="Góc gió thổi và tốc độ bập bùng">
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
                </div>
              )}

              {/* Màu & Độ Mềm Viền */}
              <Row label="Màu &amp; Viền" title="Màu nhiệt độ nguồn sáng và độ mềm viền bán dạ (Softness)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                  <ColorInput
                    compact
                    value={vlight.color}
                    onChange={(val, k) => patchLight({ color: val }, k)}
                    title="Chọn màu nguồn sáng ảo"
                  />
                  <div className="vl-swatch-row">
                    {LIGHT_COLOR_SWATCHES.map((sw) => (
                      <button
                        key={sw.color}
                        type="button"
                        title={sw.title}
                        className={`vl-swatch-btn ${vlight.color.toLowerCase() === sw.color ? 'active' : ''}`}
                        style={{ background: sw.color }}
                        onClick={() => patchLight({ color: sw.color })}
                      />
                    ))}
                  </div>
                  <div style={{ width: 64, marginLeft: 'auto', flexShrink: 0 }}>
                    <NumberInput
                      axis="mềm"
                      value={vlight.softness ?? 0.65}
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
      )}

      {/* 3. Bảng Điều Khiển Lối Vào Hang Động & Độ Sâu 2.5D */}
      {showPortalPanel && (
        <div className="vl-section-card">
          <div className="vl-row-header">
            <span className="vl-title">🕳️ Lối Vào Hang Động &amp; Độ Sâu 2.5D</span>
            <Switch
              id="layer-depth-portal-enabled"
              on={isPortalEnabled}
              onChange={(on) => patchPortal({ enabled: on })}
            />
          </div>

          {!isPortalEnabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="vl-subtitle" style={{ lineHeight: 1.45 }}>
                Đánh dấu vòm cửa hang/cổng sâu: tự tạo bóng tối lòng hang và thu nhỏ nhân vật theo luật phối cảnh 2.5D khi bước vào (tự sáng rõ khi có Ánh sáng ảo chiếu tới).
              </span>
              <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {Object.values(CAVE_PORTAL_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="vl-pill-btn"
                    title={preset.description}
                    onClick={() => patchPortal({ enabled: true, ...preset.config })}
                  >
                    {preset.badge}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row label="Mẫu cửa hang" title="Chọn nhanh cấu hình vòm hang đá, cổng di tích, hốc vực tối hoặc động băng">
                <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', width: '100%' }}>
                  {Object.values(CAVE_PORTAL_PRESETS).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.description}
                      className="vl-pill-btn"
                      onClick={() => patchPortal({ ...preset.config })}
                    >
                      {preset.badge}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Dáng vòm" title="Hình dáng hình học của lối vào hang động">
                <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: '100%' }}>
                  {[
                    { id: 'arch' as const, label: '🏛️ Vòm hang' },
                    { id: 'ellipse' as const, label: '⬭ Elip' },
                    { id: 'circle' as const, label: '◯ Tròn' }
                  ].map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      className={`vl-pill-btn ${(portal.archShape ?? 'arch') === sh.id ? 'active' : ''}`}
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

              <Row label="Thu nhỏ sâu" title="Tỷ lệ thu nhỏ của nhân vật khi đi sâu vào tâm hang">
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

              <Row label="Tâm / Cỡ UV" title="Tâm cửa hang (U,V) và bán kính ngang/dọc (Rx,Ry)">
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <ColorInput
                    compact
                    value={portal.shadowTint ?? '#060812'}
                    onChange={(val, k) => patchPortal({ shadowTint: val }, k)}
                    title="Màu bóng tối trong lòng hang"
                  />
                  <div className="vl-swatch-row" style={{ marginLeft: 'auto' }}>
                    {CAVE_SHADOW_SWATCHES.map((sw) => (
                      <button
                        key={sw.color}
                        type="button"
                        title={sw.title}
                        className={`vl-swatch-btn ${(portal.shadowTint ?? '#060812').toLowerCase() === sw.color ? 'active' : ''}`}
                        style={{ background: sw.color }}
                        onClick={() => patchPortal({ shadowTint: sw.color })}
                      />
                    ))}
                  </div>
                </div>
              </Row>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
