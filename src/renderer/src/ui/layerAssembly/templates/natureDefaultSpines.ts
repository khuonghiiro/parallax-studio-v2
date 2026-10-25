import type { PlantSpine } from '@shared/plantSpine'

/**
 * Xương motion dựng sẵn cho 3 mẫu thiên nhiên (thay cho chuyển động sway/rocking cũ).
 * layerIds dùng ID slot của mẫu; mẫu template tự đổi sang `layer-<slot>` khi tạo composite.
 */
type NatureKey = 'tree' | 'rock' | 'bonsai'

const TREE_SWAYING_SLOTS = [
  'tree-foliage-back', 'tree-foliage-back-gold', 'tree-trunk', 'tree-foliage-mid', 'tree-foliage-mid-gold',
  'tree-foliage-mid-sakura', 'tree-foliage-front', 'tree-foliage-front-gold', 'tree-blossoms',
  'tree-fruits', 'tree-fruits-2', 'tree-fruits-3', 'tree-fruits-4', 'tree-fruits-5', 'tree-fruits-6'
]

const NATURE_SPINES: Record<NatureKey, PlantSpine[]> = {
  tree: [
    {
      id: 'spine-tree-trunk',
      name: 'Thân đại thụ (gió nhẹ)',
      points: [{ x: 0, y: 125 }, { x: 2, y: 60 }, { x: -2, y: 0 }, { x: 1, y: -60 }, { x: 0, y: -120 }],
      layerIds: TREE_SWAYING_SLOTS,
      amplitude: 4,
      speed: 0.3,
      stiffness: 0.65,
      flexibility: 0.3,
      turbulence: 0.2,
      lean: 0,
      phaseOffset: 0,
      reach: 0,
      enabled: true
    }
  ],
  rock: [
    {
      id: 'spine-rock-flowers',
      name: 'Khóm hoa dại & dương xỉ',
      points: [{ x: 36, y: 118 }, { x: 34, y: 70 }, { x: 38, y: 22 }],
      layerIds: ['rock-flowers'],
      amplitude: 10,
      speed: 0.6,
      stiffness: 0.25,
      flexibility: 0.55,
      turbulence: 0.25,
      lean: 1,
      phaseOffset: 0,
      reach: 0,
      enabled: true
    }
  ],
  bonsai: [
    {
      id: 'spine-bonsai-trunk',
      name: 'Thân bonsai',
      points: [{ x: 0, y: 112 }, { x: -6, y: 50 }, { x: 4, y: -20 }, { x: 0, y: -100 }],
      layerIds: ['bonsai-foliage-back', 'bonsai-trunk', 'bonsai-foliage-mid', 'bonsai-foliage-front'],
      amplitude: 4,
      speed: 0.4,
      stiffness: 0.5,
      flexibility: 0.35,
      turbulence: 0.2,
      lean: 0,
      phaseOffset: 0,
      reach: 0,
      enabled: true
    }
  ]
}

/** Bản sao xương dựng sẵn; mapLayerId đổi ID slot sang ID layer thực tế. */
export function natureSpines(key: NatureKey, mapLayerId: (slotId: string) => string = (id) => id): PlantSpine[] {
  return NATURE_SPINES[key].map((s) => ({
    ...structuredClone(s),
    layerIds: s.layerIds.map(mapLayerId)
  }))
}

/** Composite ID dựng sẵn → bộ xương tương ứng. */
export const BUILTIN_NATURE_SPINE_KEYS: Record<string, NatureKey> = {
  'comp-modular-tree': 'tree',
  'comp-modular-rock': 'rock',
  'comp-bonsai-zen': 'bonsai'
}
