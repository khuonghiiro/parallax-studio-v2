import React from 'react'
import type {
  Layer,
  LayerPhysicsColliderZone,
  LayerPhysicsConfig,
  LayerPhysicsMaterial,
  LayerPhysicsRole
} from '@shared/types'
import { useEditor } from '../../../store/editor'
import { NumberInput, Row, Select, Switch } from '../../controls'
import type { Setter } from '../types'
import {
  createDefaultLayerPhysics,
  evaluateLayerPhysicsTransform,
  MATERIAL_PHYSICS_PRESETS,
  triggerLayerPhysicsInteraction
} from '../../../engine/layerPhysics'

const MATERIAL_OPTIONS: { value: LayerPhysicsMaterial; label: string }[] = [
  { value: 'wood_tree', label: '🌳 Thân cây / Gỗ đàn hồi (Đấm rung theo vận tốc)' },
  { value: 'foliage_bush', label: '🍃 Tán lá / Bụi cỏ mềm (Lắc lư & Rung lá)' },
  { value: 'jelly_slime', label: '🍮 Thạch nhún / Đệm lún (Nhấn lún & Bật nảy)' },
  { value: 'stone_wall', label: '🧱 Bờ tường / Đá cứng (Điểm tựa nhảy vượt tường)' },
  { value: 'metal_armor', label: '🛡️ Giáp kim loại (Rung chấn tần số cao)' },
  { value: 'cloth_rope', label: '🚩 Vải / Dây treo (Uốn lượn mềm)' },
  { value: 'flesh_body', label: '🥊 Cơ thể Nhân vật Combat (Đấm / Nhảy qua tường)' }
]

const ROLE_OPTIONS: { value: LayerPhysicsRole; label: string }[] = [
  { value: 'auto', label: '✨ Tự động theo chất liệu' },
  { value: 'prop_target', label: '🎯 Vật thể nhận lực (Cây / Thạch / Tường)' },
  { value: 'striker', label: '🥊 Tác nhân va chạm (Nắm đấm / Vũ khí)' },
  { value: 'vault_jumper', label: '🤸 Nhân vật nhảy vượt tường (Parkour)' },
  { value: 'both', label: '🔄 Cả hai (Vừa tác động vừa nhận lực)' }
]

const COLLIDER_ZONE_OPTIONS: { value: LayerPhysicsColliderZone; label: string }[] = [
  { value: 'full', label: '📦 Toàn bộ khung Mesh Layer' },
  { value: 'fist_hand', label: '🤜 Cạnh nắm đấm / Bàn tay trước' },
  { value: 'foot_bottom', label: '🦶 Mũi chân / Đáy tiếp đất' },
  { value: 'top_surface', label: '⬆️ Mặt đỉnh trên (Bờ tường / Đỉnh thạch)' },
  { value: 'trunk_center', label: '🌲 Thân trục giữa (Thân cây / Cột)' }
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
        }
      }
      l.physics = next
    }, mergeKey)
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
    action: 'punch_light' | 'punch_heavy' | 'jelly_press' | 'wall_vault'
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

  return (
    <div className="section layer-physics-section" data-mcp-region="inspector_physics">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span>⚡ Vật lý Chất liệu & Tương tác Combat</span>
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
            Gắn nhãn chất liệu vật lý cho Mesh (Thân cây, Thạch nhún, Bờ tường, Nhân vật Combat) để tự động tính rung chấn theo vận tốc đấm, lún nảy thạch hoặc chống tay nhảy qua tường.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchPhysics({ enabled: true, material: 'wood_tree', role: 'prop_target' })}
            >
              🌳 Gán Thân cây
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => patchPhysics({ enabled: true, material: 'jelly_slime', role: 'prop_target' })}
            >
              🍮 Gán Thạch nhún
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                patchPhysics({
                  enabled: true,
                  material: 'stone_wall',
                  role: 'prop_target',
                  colliderZone: 'top_surface'
                })
              }
            >
              🧱 Gán Bờ tường
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
              🥊 Gán Nhân vật Combat
            </button>
          </div>
        </div>
      ) : (
        <>
          <Row label="Chất liệu Mesh" title={preset.description}>
            <Select
              id="layer-physics-material"
              value={physics.material === 'none' ? 'wood_tree' : physics.material}
              options={MATERIAL_OPTIONS}
              onChange={(val) => patchPhysics({ material: val as LayerPhysicsMaterial })}
            />
          </Row>

          <Row label="Vai trò tương tác" title="Chọn vai trò của layer trong va chạm vật lý 2.5D">
            <Select
              id="layer-physics-role"
              value={physics.role ?? 'auto'}
              options={ROLE_OPTIONS}
              onChange={(val) => patchPhysics({ role: val as LayerPhysicsRole })}
            />
          </Row>

          <Row label="Vùng va chạm" title="Vùng sub-mesh dùng để tính toán tiếp xúc (cạnh nắm đấm, mặt tường, thân cây...)">
            <Select
              id="layer-physics-zone"
              value={physics.colliderZone ?? 'full'}
              options={COLLIDER_ZONE_OPTIONS}
              onChange={(val) => patchPhysics({ colliderZone: val as LayerPhysicsColliderZone })}
            />
          </Row>

          <Row label="Độ cứng / Đàn hồi" title="Độ cứng (Stiffness) và Độ nảy đàn hồi (Bounciness) của chất liệu">
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

          <Row label="Giảm chấn / Nhạy lực" title="Giảm chấn tắt dần (Damping) và Độ nhạy theo vận tốc đấm (Hit Sensitivity)">
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

          <Row label="Trọng lực / Mặt đất Y" title="Hệ số trọng lực (Gravity Scale) và cao độ mặt đất Y để tính rơi & nảy">
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
                {liveEval && liveEval.lastImpactSpeed > 0
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
