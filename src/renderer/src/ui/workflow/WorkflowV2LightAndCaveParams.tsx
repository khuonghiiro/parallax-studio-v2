import React from 'react'
import type {
  DepthPortalConfig,
  Layer,
  LayerVirtualLight,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import {
  CAVE_PORTAL_PRESETS,
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS,
  WIND_STRENGTH_VALUES
} from '../../engine/virtualLight'
import { createDefaultLayerPhysics } from '../../engine/layerPhysics'
import { WORKFLOW_V2_CAVE_OPTIONS, WORKFLOW_V2_LIGHT_OPTIONS } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { ColorInput, NumberInput, Row } from '../controls'
import type { WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import '../../styles/virtualLightInspector.css'

const LIGHT_KIND_CARDS: { value: VirtualLightKind; icon: string; name: string }[] = [
  { value: 'candle', icon: '🕯️', name: 'Ánh nến' },
  { value: 'flashlight', icon: '🔦', name: 'Đèn pin / Cột đèn' },
  { value: 'bulb', icon: '💡', name: 'Bóng đèn' },
  { value: 'campfire', icon: '🔥', name: 'Lửa trại' },
  { value: 'cave_crystal', icon: '🔮', name: 'Tinh thể' },
  { value: 'magic_orb', icon: '✨', name: 'Phép thuật' }
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

function resolvePrimaryTargetLayer(props: WorkflowV2NodeParamsProps): Layer | undefined {
  const targetIds = props.node.params?.targetLayerIds ?? []
  return (
    props.project.layers.find((l) => targetIds.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
    props.project.layers.find((l) => targetIds.includes(l.id))
  )
}

export function WorkflowV2LightParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate } = props
  const layer = resolvePrimaryTargetLayer(props)
  const targetIds = node.params?.targetLayerIds ?? (layer ? [layer.id] : [])
  const vlight: LayerVirtualLight = layer?.virtualLight ?? createDefaultVirtualLight('candle')

  const patchLight = (patch: Partial<LayerVirtualLight>, mergeKey = 'wf-v2-light'): void => {
    let resolvedColor = patch.color
    let resolvedIntensity = patch.intensity
    let resolvedMode = node.params?.lightMode
    let nextTitle: string | undefined

    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        const base = l.virtualLight ?? createDefaultVirtualLight('candle')
        const next: LayerVirtualLight = { ...base, enabled: node.enabled, ...patch }
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
          const opt = WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.virtualKind === patch.kind)
          if (opt) {
            resolvedMode = opt.id
            nextTitle = `Ánh sáng: ${opt.label}`
          }
        }
        if (patch.windPreset && patch.windStrength === undefined) {
          next.windStrength = WIND_STRENGTH_VALUES[patch.windPreset]
        }
        resolvedColor = next.color
        resolvedIntensity = next.intensity
        l.virtualLight = next
      }

      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        if (nextTitle) wfNode.title = nextTitle
        wfNode.params = {
          ...(wfNode.params ?? {}),
          ...(resolvedMode ? { lightMode: resolvedMode } : {}),
          ...(resolvedColor ? { lightColor: resolvedColor } : {}),
          ...(resolvedIntensity !== undefined ? { intensity: resolvedIntensity } : {})
        }
      }
    }, mergeKey)

    if (!layer && (patch.color || patch.intensity !== undefined)) {
      onUpdate({
        ...(patch.color ? { lightColor: patch.color } : {}),
        ...(patch.intensity !== undefined ? { intensity: patch.intensity } : {})
      })
    }
  }

  const isFlame = vlight.kind === 'candle' || vlight.kind === 'campfire'
  const coneDeg = vlight.coneAngleDeg ?? 360
  const isCone = vlight.kind === 'flashlight' || coneDeg < 350
  const activeConeWhenDirected = coneDeg < 350 ? coneDeg : vlight.kind === 'flashlight' ? 54 : 68
  const beamCurvature = vlight.beamCurvature ?? 0
  const zReachVal =
    vlight.zReach === undefined || [280, 320, 350, 380].includes(vlight.zReach) ? 1500 : vlight.zReach

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="vl-row-header">
        <span className="vl-title">🕯️ Công Cụ Ánh Sáng Ảo 2.5D (Xuyên Layer)</span>
      </div>

      {/* 6 Preset Kind Cards */}
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

      {/* Cường độ sáng & Dịu nền tối */}
      <div className="vl-subcard">
        <Row label="Độ sáng đèn" title="Cường độ nguồn sáng đồng bộ 1:1 giữa Khung Chỉnh 2.5D và Camera">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            <input
              type="range"
              min={0.05}
              max={2.6}
              step={0.05}
              value={Math.min(2.6, Math.max(0.05, vlight.intensity))}
              onChange={(e) => patchLight({ intensity: Number(e.target.value) }, 'wf-light-intensity')}
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
              onChange={(e) => patchLight({ ambientDim: Number(e.target.value) }, 'wf-light-dim')}
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
              active: isCone && (vlight.beamAngleDeg ?? -90) >= -112 && (vlight.beamAngleDeg ?? -90) <= -68
            },
            {
              label: '↙ Chéo trái',
              title: 'Chiếu chéo xuống bên trái (-130°)',
              cone: activeConeWhenDirected,
              beam: -130,
              active: isCone && (vlight.beamAngleDeg ?? 0) < -112 && (vlight.beamAngleDeg ?? 0) >= -158
            },
            {
              label: '↘ Chéo phải',
              title: 'Chiếu chéo xuống bên phải (-50°)',
              cone: activeConeWhenDirected,
              beam: -50,
              active: isCone && (vlight.beamAngleDeg ?? 0) > -68 && (vlight.beamAngleDeg ?? 0) <= -22
            },
            {
              label: '→ Sang phải',
              title: 'Chiếu ngang sang phải (0°)',
              cone: activeConeWhenDirected,
              beam: 0,
              active: isCone && (vlight.beamAngleDeg ?? 0) > -22 && (vlight.beamAngleDeg ?? 0) <= 22
            },
            {
              label: '← Sang trái',
              title: 'Chiếu ngang sang trái (180°)',
              cone: activeConeWhenDirected,
              beam: 180,
              active: isCone && ((vlight.beamAngleDeg ?? 0) > 158 || (vlight.beamAngleDeg ?? 0) < -158)
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
              onClick={() => patchLight({ beamAngleDeg: dir.beam, coneAngleDeg: dir.cone })}
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
              onChange={(e) => patchLight({ radius: Number(e.target.value) }, 'wf-light-radius')}
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
                  { beamAngleDeg: Number(e.target.value), coneAngleDeg: coneDeg >= 350 ? 64 : coneDeg },
                  'wf-light-beam'
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
                  patchLight({ beamAngleDeg: v, coneAngleDeg: coneDeg >= 350 ? 64 : coneDeg }, k)
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
              onChange={(e) => patchLight({ coneAngleDeg: Number(e.target.value) }, 'wf-light-cone')}
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
                  { beamCurvature: Number(e.target.value), coneAngleDeg: coneDeg >= 350 ? 68 : coneDeg },
                  'wf-light-curv'
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
              onClick={() => patchLight({ beamCurvature: cp.val, coneAngleDeg: coneDeg >= 350 ? 68 : coneDeg })}
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
              onChange={(e) => patchLight({ zReach: Number(e.target.value) }, 'wf-light-zreach')}
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
                    onClick={() => patchLight({ windPreset: w.value, windStrength: WIND_STRENGTH_VALUES[w.value] })}
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
  )
}

export function WorkflowV2CaveParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate } = props
  const layer = resolvePrimaryTargetLayer(props)
  const targetIds = node.params?.targetLayerIds ?? (layer ? [layer.id] : [])
  const portal: DepthPortalConfig = layer?.physics?.depthPortal ?? createDefaultDepthPortal()

  const patchPortal = (patch: Partial<DepthPortalConfig>, mergeKey = 'wf-v2-cave'): void => {
    useEditor.getState().update((d) => {
      const idSet = new Set(targetIds)
      for (const l of d.layers) {
        if (!idSet.has(l.id)) continue
        if (!l.physics) {
          l.physics = createDefaultLayerPhysics('ground_terrain')
          l.physics.enabled = true
        }
        const base = l.physics.depthPortal ?? createDefaultDepthPortal()
        l.physics.depthPortal = { ...base, enabled: node.enabled, ...patch }
      }
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        const opt = patch.archShape ? WORKFLOW_V2_CAVE_OPTIONS.find((o) => o.id === patch.archShape) : undefined
        if (opt) wfNode.title = `Hang động: ${opt.label}`
        wfNode.params = {
          ...(wfNode.params ?? {}),
          ...(patch.archShape ? { caveArchShape: patch.archShape } : {}),
          ...(patch.darkness !== undefined ? { caveDarkness: patch.darkness, intensity: patch.darkness } : {}),
          ...(patch.minScale !== undefined ? { caveMinScale: patch.minScale } : {})
        }
      }
    }, mergeKey)

    if (!layer && (patch.archShape || patch.darkness !== undefined || patch.minScale !== undefined)) {
      onUpdate({
        ...(patch.archShape ? { caveArchShape: patch.archShape } : {}),
        ...(patch.darkness !== undefined ? { caveDarkness: patch.darkness, intensity: patch.darkness } : {}),
        ...(patch.minScale !== undefined ? { caveMinScale: patch.minScale } : {})
      })
    }
  }

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="vl-row-header">
        <span className="vl-title">🕳️ Lối Vào Hang Động &amp; Độ Sâu 2.5D</span>
      </div>

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
              onClick={() => patchPortal({ archShape: sh.id })}
            >
              {sh.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Độ tối hang" title="Mức bóng tối bao phủ lòng hang">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <input
            type="range"
            min={0}
            max={0.98}
            step={0.02}
            value={portal.darkness}
            onChange={(e) => patchPortal({ darkness: Number(e.target.value) }, 'wf-portal-darkness')}
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
            onChange={(e) => patchPortal({ minScale: Number(e.target.value) }, 'wf-portal-scale')}
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

      <Row label="Màu bóng tối" title="Sắc độ bóng tối bên trong lòng hang">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          <ColorInput
            compact
            value={portal.shadowTint}
            onChange={(val, k) => patchPortal({ shadowTint: val }, k)}
            title="Chọn màu bóng tối lòng hang"
          />
          <div className="vl-swatch-row">
            {CAVE_SHADOW_SWATCHES.map((sw) => (
              <button
                key={sw.color}
                type="button"
                title={sw.title}
                className={`vl-swatch-btn ${portal.shadowTint.toLowerCase() === sw.color ? 'active' : ''}`}
                style={{ background: sw.color }}
                onClick={() => patchPortal({ shadowTint: sw.color })}
              />
            ))}
          </div>
        </div>
      </Row>
    </div>
  )
}
