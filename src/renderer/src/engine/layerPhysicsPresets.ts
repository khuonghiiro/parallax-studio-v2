import type {
  Layer,
  LayerPhysicsColliderZone,
  LayerPhysicsConfig,
  LayerPhysicsMaterial,
  LayerPhysicsRole,
  PhysicsSubMeshRegion,
  Project
} from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { layerNominalSize } from './spatial'

export interface MaterialPhysicsPreset {
  id: LayerPhysicsMaterial
  label: string
  badge: string
  description: string
  defaultRole: LayerPhysicsRole
  defaultZone: LayerPhysicsColliderZone
  mass: number
  stiffness: number
  damping: number
  bounciness: number
  gravityScale: number
  frequencyHz: number
  decayRate: number
  squashRatio: number
}

export const DEFAULT_Z_TOLERANCE = 55

export const MATERIAL_PHYSICS_PRESETS: Record<LayerPhysicsMaterial, MaterialPhysicsPreset> = {
  none: {
    id: 'none',
    label: 'Tắt vật lý (Mặc định)',
    badge: '—',
    description: 'Không áp dụng trọng lực hay phản ứng va chạm chất liệu.',
    defaultRole: 'auto',
    defaultZone: 'full',
    mass: 1.0,
    stiffness: 1.0,
    damping: 0.5,
    bounciness: 0.5,
    gravityScale: 0,
    frequencyHz: 8,
    decayRate: 4,
    squashRatio: 0
  },
  wood_tree: {
    id: 'wood_tree',
    label: '🌳 Thân cây / Gỗ đàn hồi',
    badge: '🌳 Cây / Gỗ',
    description:
      'Gốc bám đất cố định; khi nắm đấm hoặc mũi tên bay tới cùng lớp Z và chạm vào thân/cành sẽ nghiêng uốn và rung bật theo vận tốc.',
    defaultRole: 'prop_target',
    defaultZone: 'trunk_center',
    mass: 4.0,
    stiffness: 1.25,
    damping: 0.28,
    bounciness: 0.85,
    gravityScale: 0,
    frequencyHz: 11.5,
    decayRate: 2.8,
    squashRatio: 0.08
  },
  foliage_bush: {
    id: 'foliage_bush',
    label: '🍃 Tán lá / Bụi cỏ mềm',
    badge: '🍃 Tán lá',
    description:
      'Mềm và nhẹ; khi nhân vật hoặc mũi tên lướt qua cùng lớp Z sẽ dạt mạnh theo chiều vận tốc rồi rung rinh tần số cao.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 0.8,
    stiffness: 0.75,
    damping: 0.22,
    bounciness: 1.1,
    gravityScale: 0,
    frequencyHz: 14.5,
    decayRate: 2.3,
    squashRatio: 0.16
  },
  jelly_slime: {
    id: 'jelly_slime',
    label: '🍮 Thạch / Đệm nhún (Jelly)',
    badge: '🍮 Thạch nhún',
    description:
      'Khi nhân vật nhấn tay hoặc nhảy dẫm lên sẽ lún bẹp xuống (nén dọc - phình ngang bảo toàn thể tích) rồi bật nảy tưng tưng như thạch.',
    defaultRole: 'prop_target',
    defaultZone: 'top_surface',
    mass: 1.5,
    stiffness: 0.55,
    damping: 0.15,
    bounciness: 1.55,
    gravityScale: 0,
    frequencyHz: 8.2,
    decayRate: 1.65,
    squashRatio: 0.42
  },
  stone_wall: {
    id: 'stone_wall',
    label: '🧱 Bờ tường / Đá cứng (Điểm tựa nhảy)',
    badge: '🧱 Tường đá',
    description:
      'Độ cứng rất cao; khi tay nhân vật chống vào để nhảy qua (Vault) hoặc đấm mạnh sẽ rung chấn vi mô và tạo điểm tựa phản lực.',
    defaultRole: 'prop_target',
    defaultZone: 'top_surface',
    mass: 20.0,
    stiffness: 2.1,
    damping: 0.75,
    bounciness: 0.35,
    gravityScale: 0,
    frequencyHz: 25.0,
    decayRate: 6.2,
    squashRatio: 0.025
  },
  metal_armor: {
    id: 'metal_armor',
    label: '🛡️ Kim loại / Giáp sắt / Vũ khí',
    badge: '🛡️ Kim loại',
    description:
      'Khi trúng đòn hoặc mũi tên cắm vào sẽ tạo rung ngân tần số cực cao và giật lùi ngắn (recoil) sắc gọn.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 8.0,
    stiffness: 1.8,
    damping: 0.45,
    bounciness: 0.6,
    gravityScale: 0,
    frequencyHz: 21.0,
    decayRate: 4.2,
    squashRatio: 0.04
  },
  cloth_rope: {
    id: 'cloth_rope',
    label: '🚩 Vải / Dây treo / Cờ',
    badge: '🚩 Vải mềm',
    description: 'Rủ theo trọng lực và uốn lượn sóng mềm mại khi có xung lực tác động.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 0.5,
    stiffness: 0.45,
    damping: 0.2,
    bounciness: 0.95,
    gravityScale: 0.3,
    frequencyHz: 6.0,
    decayRate: 1.8,
    squashRatio: 0.14
  },
  flesh_body: {
    id: 'flesh_body',
    label: '🥊 Nhân vật / Võ sĩ Combat',
    badge: '🥊 Võ sĩ / Nhảy',
    description:
      'Tự động tính vận tốc nắm đấm/bàn tay/bàn chân để gây lực lên cây, tường, thạch ở cùng lớp Z; hỗ trợ trọng lực nhảy parabol và đi vào hang động.',
    defaultRole: 'both',
    defaultZone: 'fist_hand',
    mass: 2.5,
    stiffness: 1.0,
    damping: 0.38,
    bounciness: 0.75,
    gravityScale: 0,
    frequencyHz: 10.0,
    decayRate: 3.5,
    squashRatio: 0.15
  },
  ground_terrain: {
    id: 'ground_terrain',
    label: '🟢 Mặt đất / Địa hình & Hang động',
    badge: '🟢 Mặt đất',
    description:
      'Đóng vai trò mặt đất đỡ trọng lực cho các nhân vật/vật thể ở cùng lớp Z; có thể bật thêm Lối vào Hang động (Depth Portal) để thu nhỏ và phủ bóng tối khi nhân vật đi sâu vào.',
    defaultRole: 'ground_surface',
    defaultZone: 'top_surface',
    mass: 40.0,
    stiffness: 2.2,
    damping: 0.85,
    bounciness: 0.25,
    gravityScale: 0,
    frequencyHz: 22.0,
    decayRate: 7.0,
    squashRatio: 0.015
  }
}

export type SubMeshPresetId =
  | 'full'
  | 'ground_strip'
  | 'ground_bottom'
  | 'top_ledge'
  | 'tree_trunk_core'
  | 'center_core'
  | 'upper_canopy'
  | 'arrow_right'
  | 'arrow_left'

export const SUB_MESH_REGION_PRESETS: Record<
  string,
  PhysicsSubMeshRegion & { label: string }
> = {
  full: {
    label: '📦 Toàn bộ Mesh',
    minU: 0,
    maxU: 1,
    minV: 0,
    maxV: 1
  },
  ground_strip: {
    label: '⛰️ Dải mặt đất giữa-dưới',
    minU: 0,
    maxU: 1,
    minV: 0.15,
    maxV: 0.72
  },
  ground_bottom: {
    label: '🟢 Thềm đất dưới',
    minU: 0,
    maxU: 1,
    minV: 0,
    maxV: 0.38
  },
  top_ledge: {
    label: '🧱 Đỉnh tường / Mặt trên',
    minU: 0.08,
    maxU: 0.92,
    minV: 0.65,
    maxV: 1
  },
  tree_trunk_core: {
    label: '🌳 Thân cây trục giữa',
    minU: 0.3,
    maxU: 0.7,
    minV: 0.05,
    maxV: 0.65
  },
  center_core: {
    label: '🎯 Trục giữa / Thân cột',
    minU: 0.25,
    maxU: 0.75,
    minV: 0.12,
    maxV: 0.88
  },
  upper_canopy: {
    label: '🍃 Tán lá / Phần trên',
    minU: 0.08,
    maxU: 0.92,
    minV: 0.45,
    maxV: 0.98
  },
  arrow_right: {
    label: '🏹 Mũi tên nhọn phải',
    minU: 0.7,
    maxU: 1.0,
    minV: 0.32,
    maxV: 0.68
  },
  arrow_left: {
    label: '🏹 Mũi tên nhọn trái',
    minU: 0,
    maxU: 0.3,
    minV: 0.32,
    maxV: 0.68
  }
}

/**
 * Khởi tạo cấu hình vật lý mặc định chuẩn theo từng loại chất liệu.
 */
export function createDefaultLayerPhysics(
  material: LayerPhysicsMaterial = 'wood_tree'
): LayerPhysicsConfig {
  const preset = MATERIAL_PHYSICS_PRESETS[material] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
  return {
    enabled: material !== 'none',
    material,
    role: preset.defaultRole,
    colliderZone: preset.defaultZone,
    zTolerance: DEFAULT_Z_TOLERANCE,
    mass: preset.mass,
    gravityScale: preset.gravityScale,
    stiffness: preset.stiffness,
    damping: preset.damping,
    bounciness: preset.bounciness,
    hitSensitivity: 1.0,
    impacts: []
  }
}

export function resolveEffectiveRole(cfg: LayerPhysicsConfig): LayerPhysicsRole {
  if (cfg.role && cfg.role !== 'auto') return cfg.role
  return MATERIAL_PHYSICS_PRESETS[cfg.material]?.defaultRole ?? 'prop_target'
}

/**
 * Tự động tìm cao độ mặt đất Y (`groundY`) tại hoành độ `x` và lớp chiều sâu `z`:
 * - Ưu tiên `layer.physics.groundY` nếu được gán tường minh.
 * - Nếu không, tự động dò các layer trong cùng Shot và cùng lớp Z (`|z_ground - z| <= zTol * 2`)
 *   được gắn nhãn `role === 'ground_surface'` hoặc `material === 'ground_terrain'`,
 *   tính toán mặt phẳng đỡ dựa trên vùng Sub-mesh (`meshRegion`) và độ dốc (`groundSlopeDeg`).
 */
export function resolveGroundSurfaceY(
  project: Project,
  layer: Layer,
  x: number,
  z: number,
  t: number
): number | undefined {
  const cfg = layer.physics
  if (!cfg) return undefined

  const zTol = Math.max(25, (cfg.zTolerance ?? DEFAULT_Z_TOLERANCE) * 2)
  const shotId = layer.shotId ?? null

  for (const other of project.layers) {
    if (other.id === layer.id || !other.visible) continue
    if ((other.shotId ?? null) !== shotId) continue
    const oCfg = other.physics
    if (!oCfg?.enabled) continue
    const oRole = resolveEffectiveRole(oCfg)
    if (oRole !== 'ground_surface' && oCfg.material !== 'ground_terrain') continue

    const oPos = evaluate(other.transform.position, t)
    if (Math.abs(oPos[2] - z) > zTol) continue

    const oScale = evaluate(other.transform.scale, t)
    const oSize = layerNominalSize(other)
    const fullW = Math.max(16, oSize[0] * Math.abs(oScale[0]))
    const fullH = Math.max(16, oSize[1] * Math.abs(oScale[1]))

    const reg = oCfg.meshRegion
    const minX = oPos[0] - fullW * 0.5 + (reg ? reg.minU * fullW : 0)
    const maxX = oPos[0] - fullW * 0.5 + (reg ? reg.maxU * fullW : fullW)
    if (x < minX - 40 || x > maxX + 40) continue

    const topV = reg ? reg.maxV : oCfg.colliderZone === 'top_surface' ? 0.65 : 0.45
    const baseSurfaceY = oPos[1] - fullH * 0.5 + topV * fullH
    const slopeRad = ((oCfg.groundSlopeDeg ?? 0) * Math.PI) / 180
    const slopeOffset = (x - oPos[0]) * Math.tan(slopeRad)
    return baseSurfaceY + slopeOffset
  }

  return cfg.groundY
}
