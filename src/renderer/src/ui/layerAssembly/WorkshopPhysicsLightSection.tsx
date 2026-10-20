import React from 'react'
import type {
  DepthPortalConfig,
  LayerPhysicsColliderZone,
  LayerPhysicsConfig,
  LayerPhysicsMaterial,
  LayerPhysicsRole,
  LayerVirtualLight,
  PhysicsSubMeshRegion,
  VirtualLightKind,
  WindStrengthPreset
} from '@shared/types'
import type { AssembledLayerItem } from './types'
import { ColorInput, Select, Switch } from '../controls'
import { IconSparkles } from '../icons'
import {
  createDefaultLayerPhysics,
  DEFAULT_Z_TOLERANCE,
  MATERIAL_PHYSICS_PRESETS,
  SUB_MESH_REGION_PRESETS
} from '../../engine/layerPhysics'
import {
  createDefaultDepthPortal,
  createDefaultVirtualLight,
  VIRTUAL_LIGHT_PRESETS
} from '../../engine/virtualLight'

const MATERIAL_OPTIONS: { value: LayerPhysicsMaterial; label: string }[] = [
  { value: 'ground_terrain', label: '⛰️ Mặt đất / Địa hình (Đỡ trọng lực cùng Z)' },
  { value: 'wood_tree', label: '🌳 Thân cây / Gỗ đàn hồi' },
  { value: 'foliage_bush', label: '🍃 Tán lá / Bụi cỏ mềm' },
  { value: 'jelly_slime', label: '🍮 Thạch nhún / Đệm lún' },
  { value: 'stone_wall', label: '🧱 Bờ tường / Đá cứng' },
  { value: 'metal_armor', label: '🛡️ Kim loại / Mũi tên' },
  { value: 'cloth_rope', label: '🚩 Vải / Dây treo' },
  { value: 'flesh_body', label: '🥊 Cơ thể Nhân vật Combat' }
]

const ROLE_OPTIONS: { value: LayerPhysicsRole; label: string }[] = [
  { value: 'auto', label: '✨ Tự động theo chất liệu' },
  { value: 'ground_surface', label: '⛰️ Mặt đất đỡ (Tự đỡ layer cùng Z)' },
  { value: 'prop_target', label: '🎯 Vật thể nhận lực' },
  { value: 'striker', label: '🥊 Tác nhân va chạm cùng Z' },
  { value: 'projectile', label: '🏹 Vật phóng / Mũi tên bay xuyên Z' },
  { value: 'vault_jumper', label: '🤸 Nhân vật nhảy vượt tường' },
  { value: 'both', label: '🔄 Cả hai' }
]

const SUB_MESH_OPTIONS = [
  { value: '', label: '📦 Toàn bộ khung Mesh (0..1)' },
  ...Object.entries(SUB_MESH_REGION_PRESETS).map(([k, p]) => ({
    value: k,
    label: `🎯 ${p.label} (${Math.round(p.minU * 100)}-${Math.round(p.maxU * 100)}%U, ${Math.round(p.minV * 100)}-${Math.round(p.maxV * 100)}%V)`
  })),
  { value: 'custom', label: '✏️ Tuỳ chỉnh vùng UV (minU..maxU, minV..maxV)' }
]

const LIGHT_KIND_OPTIONS: { value: VirtualLightKind; label: string }[] = [
  { value: 'candle', label: '🕯️ Ánh nến (Phản ứng gió yếu/mạnh)' },
  { value: 'flashlight', label: '🔦 Đèn pin (Chùm tia nón)' },
  { value: 'bulb', label: '💡 Bóng đèn (Toả tròn)' },
  { value: 'campfire', label: '🔥 Lửa trại / Đuốc' },
  { value: 'cave_crystal', label: '🔮 Tinh thể hang động' },
  { value: 'magic_orb', label: '✨ Cầu phép thuật' }
]

const WIND_OPTIONS: { value: WindStrengthPreset; label: string }[] = [
  { value: 'none', label: '🍃 Đứng gió (Thở êm)' },
  { value: 'gentle', label: '🌬️ Gió nhẹ (Nghiêng lắc mềm)' },
  { value: 'strong', label: '💨 Gió mạnh (Chập chờn & tạt lửa)' },
  { value: 'storm', label: '🌪️ Gió bão (Chớp tắt dữ dội)' }
]

export function WorkshopPhysicsLightSection({
  layer,
  onUpdateLayer
}: {
  layer: AssembledLayerItem
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
}) {
  const physics: LayerPhysicsConfig = layer.physics ?? createDefaultLayerPhysics('wood_tree')
  const isPhysicsOn = Boolean(layer.physics?.enabled && layer.physics.material !== 'none')

  const portal: DepthPortalConfig = layer.physics?.depthPortal ?? createDefaultDepthPortal()
  const isPortalOn = Boolean(layer.physics?.depthPortal?.enabled)

  const vlight: LayerVirtualLight = layer.virtualLight ?? createDefaultVirtualLight('candle')
  const isLightOn = Boolean(layer.virtualLight?.enabled)

  const patchPhysics = (patch: Partial<LayerPhysicsConfig>) => {
    const base = layer.physics ?? createDefaultLayerPhysics('wood_tree')
    const next: LayerPhysicsConfig = { ...base, ...patch }
    if (patch.material && patch.material !== 'none' && patch.material !== base.material) {
      const p = MATERIAL_PHYSICS_PRESETS[patch.material]
      if (p) {
        next.stiffness = p.stiffness
        next.damping = p.damping
        next.bounciness = p.bounciness
        next.mass = p.mass
        next.gravityScale = p.gravityScale
        if (patch.role === undefined) next.role = p.defaultRole
        if (patch.colliderZone === undefined) next.colliderZone = p.defaultZone
      }
    }
    onUpdateLayer(layer.id, { physics: next })
  }

  const patchMeshRegion = (patch: Partial<PhysicsSubMeshRegion> | undefined) => {
    if (!patch) {
      patchPhysics({ meshRegion: undefined, colliderZone: 'full' as LayerPhysicsColliderZone })
      return
    }
    const cur = physics.meshRegion ?? {
      label: 'Vùng Sub-Mesh',
      minU: 0.2,
      maxU: 0.8,
      minV: 0.2,
      maxV: 0.8
    }
    patchPhysics({ meshRegion: { ...cur, ...patch }, colliderZone: 'custom_uv' })
  }

  const patchPortal = (patch: Partial<DepthPortalConfig>) => {
    const basePhys = layer.physics ?? { ...createDefaultLayerPhysics('ground_terrain'), enabled: true }
    const basePortal = basePhys.depthPortal ?? createDefaultDepthPortal()
    onUpdateLayer(layer.id, {
      physics: {
        ...basePhys,
        depthPortal: { ...basePortal, ...patch }
      }
    })
  }

  const patchLight = (patch: Partial<LayerVirtualLight>) => {
    const base = layer.virtualLight ?? createDefaultVirtualLight('candle')
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
    onUpdateLayer(layer.id, { virtualLight: next })
  }

  const selectedSubMeshKey = physics.meshRegion
    ? Object.entries(SUB_MESH_REGION_PRESETS).find(
        ([, p]) =>
          Math.abs(p.minU - physics.meshRegion!.minU) < 0.01 &&
          Math.abs(p.maxU - physics.meshRegion!.maxU) < 0.01 &&
          Math.abs(p.minV - physics.meshRegion!.minV) < 0.01 &&
          Math.abs(p.maxV - physics.meshRegion!.maxV) < 0.01
      )?.[0] ?? 'custom'
    : ''

  return (
    <section className="lw-prop-section lw-physics-light-section" data-mcp-region="layer_assembly_physics">
      {/* 1. Gắn Nhãn Vật Lý & Sub-Mesh UV */}
      <div className="lw-prop-head">
        <span className="lw-prop-title">
          <IconSparkles width={13} height={13} /> Nhãn Vật lý &amp; Sub-Mesh
        </span>
        <Switch
          on={isPhysicsOn}
          onChange={(on) =>
            patchPhysics({
              enabled: on,
              material: on && physics.material === 'none' ? 'wood_tree' : physics.material
            })
          }
        />
      </div>

      {!isPhysicsOn ? (
        <div className="lw-chip-row" style={{ marginBottom: 6 }}>
          <button
            type="button"
            className="lw-chip"
            onClick={() =>
              patchPhysics({
                enabled: true,
                material: 'ground_terrain',
                role: 'ground_surface',
                meshRegion: { ...SUB_MESH_REGION_PRESETS.ground_strip }
              })
            }
            title="Gắn nhãn Mặt đất đỡ trọng lực cho các layer cùng mặt phẳng Z"
          >
            ⛰️ Mặt đất đỡ
          </button>
          <button
            type="button"
            className="lw-chip"
            onClick={() =>
              patchPhysics({
                enabled: true,
                material: 'wood_tree',
                role: 'prop_target',
                meshRegion: { ...SUB_MESH_REGION_PRESETS.tree_trunk_core }
              })
            }
          >
            🌳 Thân cây
          </button>
          <button
            type="button"
            className="lw-chip"
            onClick={() =>
              patchPhysics({
                enabled: true,
                material: 'foliage_bush',
                role: 'prop_target',
                meshRegion: { ...SUB_MESH_REGION_PRESETS.upper_canopy }
              })
            }
          >
            🍃 Tán lá
          </button>
          <button
            type="button"
            className="lw-chip"
            onClick={() =>
              patchPhysics({
                enabled: true,
                material: 'metal_armor',
                role: 'projectile',
                colliderZone: 'arrow_tip',
                stickOnHit: true
              })
            }
          >
            🏹 Mũi tên xuyên Z
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <div className="lw-prop-grid">
            <div className="lw-field">
              <span className="lw-field-label">Chất liệu</span>
              <Select
                size="sm"
                value={physics.material === 'none' ? 'wood_tree' : physics.material}
                options={MATERIAL_OPTIONS}
                onChange={(v) => patchPhysics({ material: v as LayerPhysicsMaterial })}
              />
            </div>
            <div className="lw-field">
              <span className="lw-field-label">Vai trò 2.5D</span>
              <Select
                size="sm"
                value={physics.role ?? 'auto'}
                options={ROLE_OPTIONS}
                onChange={(v) => patchPhysics({ role: v as LayerPhysicsRole })}
              />
            </div>
          </div>

          <div className="lw-field">
            <span className="lw-field-label">Chọn 1 phần Mesh để gắn nhãn (Sub-Mesh UV)</span>
            <Select
              size="sm"
              value={selectedSubMeshKey}
              options={SUB_MESH_OPTIONS}
              onChange={(val) => {
                if (!val) patchMeshRegion(undefined)
                else if (val === 'custom') patchMeshRegion({})
                else if (SUB_MESH_REGION_PRESETS[String(val)]) {
                  patchMeshRegion({ ...SUB_MESH_REGION_PRESETS[String(val)] })
                }
              }}
            />
          </div>

          {physics.meshRegion && (
            <div className="lw-prop-grid">
              <label className="lw-field">
                <span className="lw-field-label">Ngang U1..U2</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    className="lw-input"
                    type="number"
                    step={0.05}
                    min={0}
                    max={0.95}
                    value={physics.meshRegion.minU}
                    onChange={(e) => patchMeshRegion({ minU: Number(e.target.value) })}
                  />
                  <input
                    className="lw-input"
                    type="number"
                    step={0.05}
                    min={0.05}
                    max={1}
                    value={physics.meshRegion.maxU}
                    onChange={(e) => patchMeshRegion({ maxU: Number(e.target.value) })}
                  />
                </div>
              </label>
              <label className="lw-field">
                <span className="lw-field-label">Dọc V1..V2</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    className="lw-input"
                    type="number"
                    step={0.05}
                    min={0}
                    max={0.95}
                    value={physics.meshRegion.minV}
                    onChange={(e) => patchMeshRegion({ minV: Number(e.target.value) })}
                  />
                  <input
                    className="lw-input"
                    type="number"
                    step={0.05}
                    min={0.05}
                    max={1}
                    value={physics.meshRegion.maxV}
                    onChange={(e) => patchMeshRegion({ maxV: Number(e.target.value) })}
                  />
                </div>
              </label>
            </div>
          )}

          <div className="lw-prop-grid">
            <label className="lw-field" title="Chỉ tương tác khi hai layer có |zA - zB| <= Độ lệch Z">
              <span className="lw-field-label">Độ lệch Z tương tác (px)</span>
              <input
                className="lw-input"
                type="number"
                step={5}
                min={5}
                max={500}
                value={physics.zTolerance ?? DEFAULT_Z_TOLERANCE}
                onChange={(e) => patchPhysics({ zTolerance: Number(e.target.value) })}
              />
            </label>
            <label className="lw-field" title="Hệ số trọng lực rơi xuống layer Mặt đất cùng Z">
              <span className="lw-field-label">Trọng lực (Gravity)</span>
              <input
                className="lw-input"
                type="number"
                step={0.1}
                min={0}
                max={3}
                value={physics.gravityScale ?? 0}
                onChange={(e) => patchPhysics({ gravityScale: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      )}

      {/* 2. Cổng Chiều Sâu Hang Động (Cave Depth Portal) */}
      <div className="lw-prop-head" style={{ paddingTop: 6, borderTop: '1px solid var(--line-soft)' }}>
        <span className="lw-prop-title">🕳️ Cửa Hang Động (Thu nhỏ &amp; Bóng tối)</span>
        <Switch on={isPortalOn} onChange={(on) => patchPortal({ enabled: on })} />
      </div>

      {isPortalOn && (
        <div className="lw-prop-grid" style={{ marginBottom: 8 }}>
          <label className="lw-field" title="Tâm cửa hang trên ảnh (U, V từ 0..1)">
            <span className="lw-field-label">Tâm hang (U / V)</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="lw-input"
                type="number"
                step={0.05}
                min={0.05}
                max={0.95}
                value={portal.centerUV[0]}
                onChange={(e) => patchPortal({ centerUV: [Number(e.target.value), portal.centerUV[1]] })}
              />
              <input
                className="lw-input"
                type="number"
                step={0.05}
                min={0.05}
                max={0.95}
                value={portal.centerUV[1]}
                onChange={(e) => patchPortal({ centerUV: [portal.centerUV[0], Number(e.target.value)] })}
              />
            </div>
          </label>
          <label className="lw-field" title="Tỷ lệ thu nhỏ tối đa & Độ tối bóng hang che phủ">
            <span className="lw-field-label">Thu nhỏ / Độ tối</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="lw-input"
                type="number"
                step={0.05}
                min={0.1}
                max={0.95}
                value={portal.minScale}
                onChange={(e) => patchPortal({ minScale: Number(e.target.value) })}
              />
              <input
                className="lw-input"
                type="number"
                step={0.05}
                min={0}
                max={0.98}
                value={portal.darkness}
                onChange={(e) => patchPortal({ darkness: Number(e.target.value) })}
              />
            </div>
          </label>
        </div>
      )}

      {/* 3. Nguồn Sáng Ảo 2.5D (Virtual Light Tool) */}
      <div className="lw-prop-head" style={{ paddingTop: 6, borderTop: '1px solid var(--line-soft)' }}>
        <span className="lw-prop-title">🕯️ Ánh Sáng Ảo 2.5D (Nến / Đèn pin)</span>
        <Switch on={isLightOn} onChange={(on) => patchLight({ enabled: on })} />
      </div>

      {isLightOn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="lw-prop-grid">
            <div className="lw-field">
              <span className="lw-field-label">Loại ánh sáng</span>
              <Select
                size="sm"
                value={vlight.kind}
                options={LIGHT_KIND_OPTIONS}
                onChange={(v) => patchLight({ kind: v as VirtualLightKind })}
              />
            </div>
            <div className="lw-field">
              <span className="lw-field-label">Gió thổi lửa</span>
              <Select
                size="sm"
                value={vlight.windPreset ?? 'gentle'}
                options={WIND_OPTIONS}
                onChange={(v) => patchLight({ windPreset: v as WindStrengthPreset })}
              />
            </div>
          </div>

          <div className="lw-field">
            <span className="lw-field-label">
              Cường độ sáng ({vlight.intensity.toFixed(2)})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="range"
                min={0.05}
                max={3.0}
                step={0.05}
                value={Math.min(3.0, Math.max(0.05, vlight.intensity))}
                onChange={(e) => patchLight({ intensity: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <input
                className="lw-input"
                type="number"
                step={0.05}
                min={0.05}
                max={3.0}
                value={vlight.intensity}
                onChange={(e) => patchLight({ intensity: Number(e.target.value) })}
                style={{ width: 64 }}
              />
            </div>
          </div>

          <div className="lw-prop-grid">
            <div className="lw-field">
              <span className="lw-field-label">Màu ánh sáng</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ColorInput
                  value={vlight.color}
                  onChange={(val) => patchLight({ color: val })}
                  title="Màu nguồn sáng ảo"
                />
              </div>
            </div>
            <label className="lw-field">
              <span className="lw-field-label">Bán kính sáng (px)</span>
              <input
                className="lw-input"
                type="number"
                step={20}
                min={40}
                max={1800}
                value={vlight.radius}
                onChange={(e) => patchLight({ radius: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="lw-prop-grid">
            <label className="lw-field" title="Hướng chiếu sáng (0°=phải, 90°=lên, 180°=trái, -90°=xuống)">
              <span className="lw-field-label">Hướng chiếu ∠ (°)</span>
              <input
                className="lw-input"
                type="number"
                step={10}
                min={-180}
                max={180}
                value={vlight.beamAngleDeg ?? 0}
                onChange={(e) =>
                  patchLight({
                    beamAngleDeg: Number(e.target.value),
                    coneAngleDeg: (vlight.coneAngleDeg ?? 360) >= 350 ? 85 : vlight.coneAngleDeg
                  })
                }
              />
            </label>
            <label className="lw-field" title="Góc mở chùm sáng (360° = toả tròn, <350° = chiếu chùm nón định hướng)">
              <span className="lw-field-label">Góc mở chóp Δ (°)</span>
              <input
                className="lw-input"
                type="number"
                step={10}
                min={15}
                max={360}
                value={vlight.coneAngleDeg ?? 360}
                onChange={(e) => patchLight({ coneAngleDeg: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
