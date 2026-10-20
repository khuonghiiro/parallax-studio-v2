import React from 'react'
import type {
  Layer,
  LayerPhysicsColliderZone,
  LayerPhysicsConfig,
  LayerPhysicsMaterial,
  LayerPhysicsRole,
  PhysicsSubMeshRegion
} from '@shared/types'
import { useEditor } from '../../../store/editor'
import { NumberInput, Row, Select, Switch } from '../../controls'
import type { Setter } from '../types'
import {
  createDefaultLayerPhysics,
  DEFAULT_Z_TOLERANCE,
  evaluateLayerPhysicsTransform,
  MATERIAL_PHYSICS_PRESETS,
  SUB_MESH_REGION_PRESETS,
  triggerLayerPhysicsInteraction
} from '../../../engine/layerPhysics'

const MATERIAL_OPTIONS: { value: LayerPhysicsMaterial; label: string }[] = [
  { value: 'wood_tree', label: '🌳 Thân cây / Gỗ đàn hồi (Đấm rung theo vận tốc)' },
  { value: 'foliage_bush', label: '🍃 Tán lá / Bụi cỏ mềm (Lắc lư & Rung lá)' },
  { value: 'jelly_slime', label: '🍮 Thạch nhún / Đệm lún (Nhấn lún & Bật nảy)' },
  { value: 'stone_wall', label: '🧱 Bờ tường / Đá cứng (Điểm tựa nhảy vượt tường)' },
  { value: 'ground_terrain', label: '⛰️ Mặt đất / Nền địa hình (Đỡ trọng lực cùng Z)' },
  { value: 'metal_armor', label: '🛡️ Giáp kim loại / Mũi tên (Rung chấn tần số cao)' },
  { value: 'cloth_rope', label: '🚩 Vải / Dây treo (Uốn lượn mềm)' },
  { value: 'flesh_body', label: '🥊 Cơ thể Nhân vật Combat (Đấm / Nhảy qua tường)' }
]

const ROLE_OPTIONS: { value: LayerPhysicsRole; label: string }[] = [
  { value: 'auto', label: '✨ Tự động theo chất liệu' },
  { value: 'prop_target', label: '🎯 Vật thể nhận lực (Cây / Thạch / Tường)' },
  { value: 'striker', label: '🥊 Tác nhân va chạm cùng Z (Nắm đấm / Vũ khí)' },
  { value: 'projectile', label: '🏹 Vật phóng xuyên Z (Mũi tên / Đạn bay qua Z mục tiêu)' },
  { value: 'ground_surface', label: '⛰️ Mặt đất đỡ (Tự đỡ các layer cùng Z có trọng lực)' },
  { value: 'vault_jumper', label: '🤸 Nhân vật nhảy vượt tường (Parkour)' },
  { value: 'both', label: '🔄 Cả hai (Vừa tác động vừa nhận lực)' }
]

const COLLIDER_ZONE_OPTIONS: { value: LayerPhysicsColliderZone; label: string }[] = [
  { value: 'full', label: '📦 Toàn bộ khung Mesh Layer' },
  { value: 'fist_hand', label: '🤜 Cạnh nắm đấm / Bàn tay trước' },
  { value: 'arrow_tip', label: '🏹 Đầu nhọn mũi tên / Vật phóng' },
  { value: 'foot_bottom', label: '🦶 Mũi chân / Đáy tiếp đất' },
  { value: 'top_surface', label: '⬆️ Mặt đỉnh trên (Mặt đất / Bờ tường / Đỉnh thạch)' },
  { value: 'trunk_center', label: '🌲 Thân trục giữa (Thân cây / Cột)' },
  { value: 'custom_uv', label: '🎯 Vùng Sub-Mesh UV tùy chỉnh (Chọn 1 phần Mesh)' }
]

const SUB_MESH_PRESET_OPTIONS = [
  { value: '', label: '— Toàn bộ hoặc theo Vùng va chạm —' },
  ...Object.entries(SUB_MESH_REGION_PRESETS).map(([key, p]) => ({
    value: key,
    label: `🎯 ${p.label} (${Math.round(p.minU * 100)}-${Math.round(p.maxU * 100)}% U, ${Math.round(p.minV * 100)}-${Math.round(p.maxV * 100)}% V)`
  })),
  { value: 'custom', label: '✏️ Tự nhập toạ độ Sub-Mesh UV (minU..maxU, minV..maxV)' }
]

export function LayerPhysicsSection({ layer, set }: { layer: Layer; set: Setter }) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const updateProject = useEditor((s) => s.update)

  const physics: LayerPhysicsConfig = layer.physics ?? createDefaultLayerPhysics('wood_tree')
  const isEnabled = Boolean(layer.physics?.enabled && layer.physics.material !== 'none')
  const preset =
    MATERIAL_PHYSICS_PRESETS[physics.material === 'none' ? 'wood_tree' : physics.material] ??
    MATERIAL_PHYSICS_PRESETS.wood_tree

  const patchPhysics = (patch: Partial<LayerPhysicsConfig>, mergeKey = 'layer-physics'): void => {
    set((l) => {
      const base = l.physics ?? createDefaultLayerPhysics('wood_tree')
      const next: LayerPhysicsConfig = { ...base, ...patch }
      if (patch.material && patch.material !== 'none' && patch.material !== base.material) {
        const p = MATERIAL_PHYSICS_PRESETS[patch.material]
        if (p) {
          next.stiffness = p.stiffness
          next.damping = p.damping
          next.bounciness = p.bounciness
          next.mass = p.mass
          next.gravityScale = p.gravityScale
          if (patch.role === undefined) {
            next.role = p.defaultRole
          }
          if (patch.colliderZone === undefined) {
            next.colliderZone = p.defaultZone
          }
        }
      }
      l.physics = next
    }, mergeKey)
  }

  const patchMeshRegion = (patch: Partial<PhysicsSubMeshRegion> | undefined, mergeKey = 'mesh-region'): void => {
    if (!patch) {
      patchPhysics({ meshRegion: undefined }, mergeKey)
      return
    }
    const cur = physics.meshRegion ?? {
      label: 'Vùng Sub-Mesh',
      minU: 0.2,
      maxU: 0.8,
      minV: 0.2,
      maxV: 0.8
    }
    patchPhysics({ meshRegion: { ...cur, ...patch }, colliderZone: 'custom_uv' }, mergeKey)
  }

  const toggleEnabled = (on: boolean): void => {
    set((l) => {
      if (!l.physics) {
        l.physics = createDefaultLayerPhysics('wood_tree')
      }
      l.physics.enabled = on
      if (on && l.physics.material === 'none') {
        l.physics.material = 'wood_tree'
      }
    }, 'layer-physics-toggle')
  }

  const handleTriggerAction = (
    action: 'punch_light' | 'punch_heavy' | 'jelly_press' | 'wall_vault' | 'arrow_shot'
  ): void => {
    updateProject((draft) => {
      triggerLayerPhysicsInteraction(draft, layer.id, time, action)
    }, `physics-${action}`)
  }

  const clearImpacts = (): void => {
    set((l) => {
      if (l.physics) {
        l.physics.impacts = []
      }
    }, 'layer-physics-clear')
  }

  const liveEval = isEnabled ? evaluateLayerPhysicsTransform(project, layer, time) : null
  const impactCount = layer.physics?.impacts?.length ?? 0
  const isProjectile = physics.role === 'projectile'
  const isGround = physics.role === 'ground_surface' || physics.material === 'ground_terrain'

  return (
    <div className="section layer-physics-section" data-mcp-region="inspector_physics">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span>⚡ Vật lý Chất liệu & Tương tác 2.5D</span>
        <Switch id="layer-physics-enabled" on={isEnabled} onChange={toggleEnabled} />
      </div>

      {!isEnabled ? (
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
            Gắn nhãn chất liệu & vùng Sub-Mesh (chỉ tương tác khi cùng mặt phẳng Z hoặc mũi tên bay xuyên qua Z mục tiêu; mặt đất tự đỡ các layer cùng Z).
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchPhysics({ enabled: true, material: 'wood_tree', role: 'prop_target' })}
            >
              🌳 Thân cây
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchPhysics({ enabled: true, material: 'jelly_slime', role: 'prop_target' })}
            >
              🍮 Thạch nhún
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                patchPhysics({
                  enabled: true,
                  material: 'ground_terrain',
                  role: 'ground_surface',
                  colliderZone: 'top_surface',
                  meshRegion: { ...SUB_MESH_REGION_PRESETS.ground_strip }
                })
              }
            >
              ⛰️ Mặt đất đỡ
            </button>
            <button
              type="button"
              className="btn sm ghost"
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
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                patchPhysics({
                  enabled: true,
                  material: 'flesh_body',
                  role: 'striker',
                  colliderZone: 'fist_hand'
                })
              }
            >
              🥊 Nhân vật Combat
            </button>
          </div>
        </div>
      ) : (
        <>
          <Row label="Chất liệu" title={preset.description}>
            <Select
              id="layer-physics-material"
              value={physics.material === 'none' ? 'wood_tree' : physics.material}
              options={MATERIAL_OPTIONS}
              onChange={(val) => patchPhysics({ material: val as LayerPhysicsMaterial })}
            />
          </Row>

          <Row label="Vai trò 2.5D" title="Chọn vai trò của layer trong va chạm vật lý 2.5D">
            <Select
              id="layer-physics-role"
              value={physics.role ?? 'auto'}
              options={ROLE_OPTIONS}
              onChange={(val) => patchPhysics({ role: val as LayerPhysicsRole })}
            />
          </Row>

          <Row label="Độ lệch Z" title="Hai layer chỉ va chạm khi |zA - zB| <= Độ lệch Z, hoặc khi Mũi tên bay cắt qua mặt phẳng Z của mục tiêu">
            <NumberInput
              axis="z±"
              value={physics.zTolerance ?? DEFAULT_Z_TOLERANCE}
              step={5}
              precision={0}
              min={5}
              max={600}
              suffix="px"
              onChange={(v, k) => patchPhysics({ zTolerance: v }, k)}
            />
            {isProjectile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-dim)' }}>
                <span>Ghim trúng:</span>
                <Switch
                  id="layer-physics-stick"
                  on={physics.stickOnHit ?? true}
                  onChange={(on) => patchPhysics({ stickOnHit: on })}
                />
              </div>
            )}
          </Row>

          <Row label="Vùng chạm" title="Vùng sub-mesh dùng để tính toán tiếp xúc (cạnh nắm đấm, đầu mũi tên, mặt đất...)">
            <Select
              id="layer-physics-zone"
              value={physics.colliderZone ?? 'full'}
              options={COLLIDER_ZONE_OPTIONS}
              onChange={(val) => patchPhysics({ colliderZone: val as LayerPhysicsColliderZone })}
            />
          </Row>

          <Row label="Nhãn Mesh" title="Chọn nhanh 1 phần vùng ảnh (UV 0..1) để gắn nhãn va chạm hoặc mặt đất">
            <Select
              id="layer-physics-submesh-preset"
              value={
                physics.meshRegion
                  ? Object.entries(SUB_MESH_REGION_PRESETS).find(
                      ([, p]) =>
                        Math.abs(p.minU - physics.meshRegion!.minU) < 0.01 &&
                        Math.abs(p.maxU - physics.meshRegion!.maxU) < 0.01 &&
                        Math.abs(p.minV - physics.meshRegion!.minV) < 0.01 &&
                        Math.abs(p.maxV - physics.meshRegion!.maxV) < 0.01
                    )?.[0] ?? 'custom'
                  : ''
              }
              options={SUB_MESH_PRESET_OPTIONS}
              onChange={(val) => {
                if (!val) {
                  patchMeshRegion(undefined)
                } else if (val === 'custom') {
                  patchMeshRegion({})
                } else {
                  const p = SUB_MESH_REGION_PRESETS[val]
                  if (p) patchMeshRegion({ ...p })
                }
              }}
            />
          </Row>

          {physics.meshRegion && (
            <>
              <Row label="Ngang U1/U2" title="Giới hạn ngang từ trái (0) sang phải (1) của vùng Mesh được gắn nhãn">
                <NumberInput
                  axis="u1"
                  value={physics.meshRegion.minU}
                  step={0.05}
                  precision={2}
                  min={0}
                  max={0.95}
                  onChange={(v, k) => patchMeshRegion({ minU: Math.min(v, physics.meshRegion!.maxU - 0.05) }, k)}
                />
                <NumberInput
                  axis="u2"
                  value={physics.meshRegion.maxU}
                  step={0.05}
                  precision={2}
                  min={0.05}
                  max={1}
                  onChange={(v, k) => patchMeshRegion({ maxU: Math.max(v, physics.meshRegion!.minU + 0.05) }, k)}
                />
              </Row>
              <Row label="Dọc V1/V2" title="Giới hạn dọc từ đáy (0) lên đỉnh (1) của vùng Mesh được gắn nhãn">
                <NumberInput
                  axis="v1"
                  value={physics.meshRegion.minV}
                  step={0.05}
                  precision={2}
                  min={0}
                  max={0.95}
                  onChange={(v, k) => patchMeshRegion({ minV: Math.min(v, physics.meshRegion!.maxV - 0.05) }, k)}
                />
                <NumberInput
                  axis="v2"
                  value={physics.meshRegion.maxV}
                  step={0.05}
                  precision={2}
                  min={0.05}
                  max={1}
                  onChange={(v, k) => patchMeshRegion({ maxV: Math.max(v, physics.meshRegion!.minV + 0.05) }, k)}
                />
              </Row>
            </>
          )}

          <Row label="Cứng / Nảy" title="Độ cứng (Stiffness) và Độ nảy đàn hồi (Bounciness) của chất liệu">
            <NumberInput
              axis="k"
              value={physics.stiffness ?? preset.stiffness}
              step={0.05}
              precision={2}
              min={0.05}
              max={2.0}
              onChange={(v, k) => patchPhysics({ stiffness: v }, k)}
            />
            <NumberInput
              axis="b"
              value={physics.bounciness ?? preset.bounciness}
              step={0.05}
              precision={2}
              min={0}
              max={2.0}
              onChange={(v, k) => patchPhysics({ bounciness: v }, k)}
            />
          </Row>

          <Row label="Giảm / Nhạy" title="Giảm chấn tắt dần (Damping) và Độ nhạy theo vận tốc đấm (Hit Sensitivity)">
            <NumberInput
              axis="d"
              value={physics.damping ?? preset.damping}
              step={0.05}
              precision={2}
              min={0.05}
              max={1.5}
              onChange={(v, k) => patchPhysics({ damping: v }, k)}
            />
            <NumberInput
              axis="v"
              value={physics.hitSensitivity ?? 1.0}
              step={0.1}
              precision={2}
              min={0.1}
              max={3.0}
              onChange={(v, k) => patchPhysics({ hitSensitivity: v }, k)}
            />
          </Row>

          <Row label={isGround ? 'Độ dốc đất' : 'Trọng lực / Y'} title="Hệ số trọng lực (tự động dò layer Mặt đất cùng Z) hoặc cao độ mặt đất Y dự phòng">
            {isGround ? (
              <NumberInput
                axis="∠"
                value={physics.groundSlopeDeg ?? 0}
                step={1}
                precision={1}
                min={-45}
                max={45}
                suffix="°"
                onChange={(v, k) => patchPhysics({ groundSlopeDeg: v }, k)}
              />
            ) : (
              <>
                <NumberInput
                  axis="g"
                  value={physics.gravityScale ?? preset.gravityScale}
                  step={0.1}
                  precision={2}
                  min={0}
                  max={3.0}
                  onChange={(v, k) => patchPhysics({ gravityScale: v }, k)}
                />
                <NumberInput
                  axis="y"
                  value={physics.groundY ?? -360}
                  step={10}
                  precision={0}
                  min={-2000}
                  max={2000}
                  onChange={(v, k) => patchPhysics({ groundY: v }, k)}
                />
              </>
            )}
          </Row>

          <div
            style={{
              marginTop: 8,
              padding: '7px 8px',
              borderRadius: 6,
              background: 'var(--bg-2)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text)'
              }}
            >
              <span>⚡ Tạo tác động tại {time.toFixed(2)}s</span>
              <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 500 }}>
                {liveEval && liveEval.projectileStuck
                  ? '🏹 Đã ghim trúng đích'
                  : liveEval && liveEval.lastImpactSpeed > 0
                    ? `Vận tốc: ${liveEval.lastImpactSpeed} px/s`
                    : `${impactCount} xung lực`}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => handleTriggerAction('punch_light')}
                title="Tạo xung lực đấm vận tốc nhẹ (260 px/s) -> cây/vật thể rung nhẹ"
              >
                🥊 Đấm nhẹ (Rung nhẹ)
              </button>
              <button
                type="button"
                className="btn sm primary"
                onClick={() => handleTriggerAction('punch_heavy')}
                title="Tạo xung lực đấm vận tốc cao (980 px/s) -> thân cây uốn cong & rung mạnh"
              >
                💥 Đấm mạnh (Vận tốc cao)
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => handleTriggerAction('jelly_press')}
                title="Nhấn lún đàn hồi xuống mặt trên -> biến dạng lún & nảy tưng tưng như thạch"
              >
                🍮 Nhấn lún Thạch
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => handleTriggerAction('wall_vault')}
                title="Nhân vật chống tay lên bờ tường rồi nhảy vọt qua theo quỹ đạo trọng lực Parabol"
              >
                🤸 Nhảy vượt tường
              </button>
              <button
                type="button"
                className="btn sm ghost"
                style={{ gridColumn: '1 / -1' }}
                onClick={() => handleTriggerAction('arrow_shot')}
                title="Mô phỏng mũi tên bay xuyên từ layer Z khác cắt đúng vào vùng Mesh của layer này (880 px/s)"
              >
                🏹 Bắn tên xuyên Z (Ghim & Rung chấn)
              </button>
            </div>

            {impactCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 4,
                  borderTop: '1px solid var(--line-soft)',
                  fontSize: 10.5,
                  color: 'var(--text-dim)'
                }}
              >
                <span>Đã ghi {impactCount} mốc va chạm vật lý</span>
                <button
                  type="button"
                  className="btn sm ghost"
                  style={{ padding: '1px 6px', fontSize: 10 }}
                  onClick={clearImpacts}
                >
                  Xoá xung lực
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

