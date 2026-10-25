import type { AssembledLayerItem, LayerComposite, LayerMotionSettings, MotionAnchor, MotionType } from './types'

/**
 * Hệ thống Hòa Âm Chuyển Động Layer 2.5D (2.5D Layer Harmonic Motion Choreography).
 * Bổ trợ cho Tab "Motion" của Xưởng Lắp Ráp 2.5D:
 * - Bên cạnh Xương uốn cong (PlantSpine), cho phép tạo chuyển động sóng hài (Sway, Breathe, Float, Wave, Rocking)
 *   cho từng mảnh Layer của Nhân vật 2.5D, Đạo cụ hoặc Cụm thiên nhiên chỉ với 1-Click.
 * - Tự động phân bổ độ lệch pha theo Tỉ lệ vàng (Golden Ratio φ ≈ 0.618) và co giãn biên độ theo Độ sâu Z / Chiều cao Y.
 */

export type LayerHarmonyPresetId =
  | 'anatomy-breathe'
  | 'parallax-wind'
  | 'cloth-hair-wave'
  | 'magic-float'
  | 'pendulum-rock'
  | 'reset-none'

export interface LayerHarmonyPresetMeta {
  id: LayerHarmonyPresetId
  label: string
  icon: string
  hint: string
}

export const LAYER_HARMONY_PRESETS: LayerHarmonyPresetMeta[] = [
  {
    id: 'anatomy-breathe',
    label: 'Nhịp thở Giải phẫu 2.5D',
    icon: '🌬️',
    hint: 'Ngực thở phập phồng, đầu nhấp nhô trễ nhịp, hai tay đung đưa nhẹ từ vai, tóc/áo lượn sóng, chân trụ vững'
  },
  {
    id: 'parallax-wind',
    label: 'Gió lướt Phân tầng Z',
    icon: '🍃',
    hint: 'Các lớp đung đưa lệch pha Tỉ lệ vàng (0.618s), lớp càng cao và gần camera càng lắc mềm mại'
  },
  {
    id: 'cloth-hair-wave',
    label: 'Phất phơ Tóc & Tà áo',
    icon: '🌊',
    hint: 'Tự lọc các mảnh tóc, kính, tay áo, áo choàng, đuôi, tán lá để gắn chuyển động Lượn sóng (Wave)'
  },
  {
    id: 'magic-float',
    label: 'Lơ lửng Phép thuật',
    icon: '✨',
    hint: 'Các mảnh bay bổng lệch pha tự nhiên theo chiều sâu 2.5D (phù hợp nhân vật bay, đảo nổi, linh thạch)'
  },
  {
    id: 'pendulum-rock',
    label: 'Bập bênh Nhịp nhàng',
    icon: '⚓',
    hint: 'Chuyển động con lắc bập bênh đồng điệu cho đạo cụ, thuyền, đèn lồng hoặc cụm cảnh'
  },
  {
    id: 'reset-none',
    label: 'Tắt Motion Layer',
    icon: '⏹️',
    hint: 'Đưa toàn bộ chuyển động rời của Layer về Tắt (None) để chỉ dùng Khung xương Rig'
  }
]

export interface LayerMotionHarmonyOptions {
  preset: LayerHarmonyPresetId
  targetLayerIds?: string[]
  /** Nhân tốc độ chung (0.2 .. 3.0, chuẩn 1.0) */
  speedMultiplier?: number
  /** Nhân biên độ chung (0.2 .. 3.0, chuẩn 1.0) */
  amplitudeMultiplier?: number
  /** Bật lệch pha Tỉ lệ vàng giữa các layer */
  staggerPhase?: boolean
}

const GOLDEN_PHASE = 0.61803398875
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r2 = (v: number) => Number(v.toFixed(2))

function computeAnatomyLayerMotion(
  layer: AssembledLayerItem,
  idx: number,
  speedMul: number,
  ampMul: number,
  stagger: boolean
): LayerMotionSettings {
  const tag = `${layer.id} ${layer.name} ${layer.slot ?? ''}`.toLowerCase()
  const basePhase = stagger ? r2((idx * GOLDEN_PHASE) % 2.0) : 0

  // Chân / Đùi / Giày: giữ cố định trên mặt đất
  if (/(thigh|shin|foot|feet|shoe|sneaker|boot|leg|đùi|cẳng chân|ống quần|bàn chân|giày)/i.test(tag)) {
    return { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom', phaseOffset: 0 }
  }
  // Tóc / Áo choàng / Đuôi / Cánh: Lượn sóng (Wave) từ đỉnh
  if (/(hair|ponytail|braid|cape|cloak|scarf|tail|wing|tóc|áo choàng|khăn|đuôi|cánh)/i.test(tag)) {
    return {
      type: 'wave',
      speed: r2(0.85 * speedMul),
      amplitude: r2(5.5 * ampMul),
      anchor: 'top',
      phaseOffset: r2(0.35 + basePhase * 0.3)
    }
  }
  // Tay / Cẳng tay / Bàn tay: Đung đưa nhẹ quanh khớp vai/khuỷu trên
  if (/(arm|forearm|hand|sleeve|bắp tay|cẳng tay|bàn tay|tay áo)/i.test(tag)) {
    const isForearm = /(forearm|hand|cẳng tay|bàn tay)/i.test(tag)
    return {
      type: 'sway',
      speed: r2(0.65 * speedMul),
      amplitude: r2((isForearm ? 3.2 : 2.0) * ampMul),
      anchor: 'top',
      phaseOffset: r2((isForearm ? 0.4 : 0.2) + basePhase * 0.2)
    }
  }
  // Đầu / Mặt / Kính / Mũ: Nhấp nhô nhẹ theo nhịp ngực nhưng trễ pha 0.18s
  if (/(head|face|eye|mouth|brow|glass|hat|đầu|mặt|mắt|miệng|kính|mũ)/i.test(tag)) {
    return {
      type: 'float',
      speed: r2(0.65 * speedMul),
      amplitude: r2(2.8 * ampMul),
      anchor: 'bottom',
      phaseOffset: 0.18
    }
  }
  // Thân / Ngực (Torso): Phập phồng nhịp thở chủ đạo
  return {
    type: 'breathe',
    speed: r2(0.65 * speedMul),
    amplitude: r2(2.6 * ampMul),
    anchor: 'bottom',
    phaseOffset: 0
  }
}

/** Áp dụng Hòa âm Chuyển động Layer 2.5D cho Composite */
export function applyLayerMotionHarmony(
  composite: LayerComposite,
  options: LayerMotionHarmonyOptions
): LayerComposite {
  const speedMul = clamp(options.speedMultiplier ?? 1.0, 0.1, 4.0)
  const ampMul = clamp(options.amplitudeMultiplier ?? 1.0, 0.1, 4.0)
  const stagger = options.staggerPhase !== false
  const targetSet =
    options.targetLayerIds && options.targetLayerIds.length > 0
      ? new Set(options.targetLayerIds)
      : null

  const nextLayers = composite.layers.map((layer, idx) => {
    if (layer.locked) return layer
    if (targetSet && !targetSet.has(layer.id)) return layer

    if (options.preset === 'reset-none') {
      return {
        ...layer,
        motion: { type: 'none' as MotionType, speed: 1, amplitude: 0, anchor: 'center' as MotionAnchor, phaseOffset: 0 }
      }
    }

    if (options.preset === 'anatomy-breathe') {
      return {
        ...layer,
        motion: computeAnatomyLayerMotion(layer, idx, speedMul, ampMul, stagger)
      }
    }

    const phaseOffset = stagger ? r2((idx * GOLDEN_PHASE) % 2.4) : 0
    const depthScale = clamp(1 - (layer.z ?? 0) / 220, 0.45, 1.5)
    const heightScale = clamp(1 - layer.y / Math.max(240, composite.height || 480), 0.5, 1.6)

    if (options.preset === 'parallax-wind') {
      return {
        ...layer,
        motion: {
          type: 'sway' as MotionType,
          speed: r2(0.75 * speedMul),
          amplitude: r2(6.0 * ampMul * depthScale * heightScale),
          anchor: 'bottom' as MotionAnchor,
          phaseOffset
        }
      }
    }

    if (options.preset === 'cloth-hair-wave') {
      const tag = `${layer.id} ${layer.name} ${layer.slot ?? ''}`.toLowerCase()
      const isClothOrSoft = /(hair|ponytail|cape|cloak|scarf|skirt|sleeve|tail|wing|foliage|leaf|flower|branch|glass|tóc|áo choàng|khăn|váy|tay áo|đuôi|cánh|tán lá|hoa|cành|kính)/i.test(tag)
      if (!isClothOrSoft && !targetSet) return layer
      return {
        ...layer,
        motion: {
          type: 'wave' as MotionType,
          speed: r2(0.9 * speedMul),
          amplitude: r2(6.5 * ampMul * depthScale),
          anchor: 'top' as MotionAnchor,
          phaseOffset
        }
      }
    }

    if (options.preset === 'magic-float') {
      return {
        ...layer,
        motion: {
          type: 'float' as MotionType,
          speed: r2(0.6 * speedMul),
          amplitude: r2(8.0 * ampMul * depthScale),
          anchor: 'center' as MotionAnchor,
          phaseOffset
        }
      }
    }

    // 'pendulum-rock'
    return {
      ...layer,
      motion: {
        type: 'rocking' as MotionType,
        speed: r2(0.7 * speedMul),
        amplitude: r2(5.0 * ampMul * depthScale),
        anchor: 'bottom' as MotionAnchor,
        phaseOffset
      }
    }
  })

  return { ...composite, layers: nextLayers }
}
