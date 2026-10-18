/**
 * Xương thực vật (Plant Spine): một đường cong vẽ tay từ GỐC lên NGỌN trên bố cục 2D.
 * Các layer gắn vào sẽ uốn cong mềm mại theo đường này như thân cây / cành / cỏ đung đưa trong gió.
 * Toạ độ điểm dùng hệ toạ độ cụm layer (composite): X sang phải, Y hướng xuống, gốc ở tâm khung.
 */
export interface PlantSpinePoint {
  x: number
  y: number
}

export interface PlantSpine {
  id: string
  name: string
  /** points[0] là gốc (đứng yên), điểm cuối là ngọn (uốn nhiều nhất). */
  points: PlantSpinePoint[]
  /** Các layer uốn theo xương này. */
  layerIds: string[]
  /** Góc uốn tối đa tại ngọn (độ). */
  amplitude: number
  /** Số chu kỳ đung đưa mỗi giây. */
  speed: number
  /** 0 = mềm, cả thân cùng cong · 1 = cứng, chỉ phần ngọn cong. */
  stiffness: number
  /** 0..1 — độ rung phụ ở ngọn (lá/cành non phất theo nhịp đôi). */
  flexibility: number
  /** 0..1 — gió giật thất thường. */
  turbulence: number
  /** Độ nghiêng cố định theo hướng gió (độ, dương = nghiêng phải). */
  lean?: number
  /** Lệch pha (giây) để nhiều cây đung đưa so le. */
  phaseOffset?: number
  /** Bán kính ảnh hưởng quanh xương (px). 0 hoặc bỏ trống = toàn bộ layer uốn theo. */
  reach?: number
  /** Độ co giãn & nhún lên xuống theo chiều dọc thân (0..1, ví dụ 0.15 = co giãn tối đa ±15% chiều dài). */
  verticalBob?: number
  enabled?: boolean
  /** Chuyển động vẽ tay (ghi lại khi nắm ngọn kéo). Có thì thay thế sóng gió tự động. */
  motion?: PlantSpineMotion
}

/** Một mốc của chuyển động vẽ tay: góc uốn tại ngọn (độ) ở thời điểm t (giây, 0 ≤ t < duration). */
export interface PlantMotionKey {
  t: number
  angle: number
  /** Hệ số co giãn dọc thân tại mốc này (0 = nghỉ, > 0 = kéo dài lên, < 0 = nhún xuống). */
  stretch?: number
}

/**
 * Chuyển động vẽ tay của xương thực vật: đường cong góc-ngọn theo thời gian, lặp liền mạch theo chu kỳ duration.
 * Gốc đứng yên; độ uốn phân bố dọc thân theo stiffness; ngọn trễ nhịp theo lag (đánh roi tự nhiên).
 */
export interface PlantSpineMotion {
  keys: PlantMotionKey[]
  /** Chu kỳ lặp (giây). */
  duration: number
  /** Hệ số tốc độ phát lại (1 = đúng nhịp tay). */
  speed?: number
  /** Độ trễ của ngọn so với gốc (giây) — tạo cảm giác thân mềm đánh roi. */
  lag?: number
  /** 0..1 — trộn thêm gió tự nhiên (theo amplitude/speed) chồng lên chuyển động vẽ tay. */
  windMix?: number
  /** Độ co giãn & nhún lên xuống theo chiều dọc thân (0..1). */
  verticalBob?: number
}

export type PlantSpinePresetId = 'grass' | 'sapling' | 'branch' | 'canopy' | 'flower' | 'seaweed'

export type PlantSpineParams = Pick<
  PlantSpine,
  'amplitude' | 'speed' | 'stiffness' | 'flexibility' | 'turbulence' | 'lean' | 'reach' | 'verticalBob'
>

export const PLANT_SPINE_PRESETS: Array<{ id: PlantSpinePresetId; label: string; params: PlantSpineParams }> = [
  { id: 'grass', label: 'Cỏ lau / Lúa', params: { amplitude: 16, speed: 0.9, stiffness: 0.15, flexibility: 0.55, turbulence: 0.35, lean: 3, reach: 0, verticalBob: 0.12 } },
  { id: 'sapling', label: 'Cây non', params: { amplitude: 9, speed: 0.6, stiffness: 0.35, flexibility: 0.35, turbulence: 0.25, lean: 1, reach: 0, verticalBob: 0.08 } },
  { id: 'branch', label: 'Cành cây', params: { amplitude: 7, speed: 0.7, stiffness: 0.45, flexibility: 0.45, turbulence: 0.3, lean: 0, reach: 0, verticalBob: 0.15 } },
  { id: 'canopy', label: 'Đại thụ / Tán lớn', params: { amplitude: 3.5, speed: 0.35, stiffness: 0.7, flexibility: 0.25, turbulence: 0.2, lean: 0, reach: 0, verticalBob: 0.05 } },
  { id: 'flower', label: 'Hoa thân mềm', params: { amplitude: 12, speed: 0.8, stiffness: 0.25, flexibility: 0.6, turbulence: 0.3, lean: 2, reach: 0, verticalBob: 0.18 } },
  { id: 'seaweed', label: 'Rong biển / Dây leo', params: { amplitude: 22, speed: 0.45, stiffness: 0.05, flexibility: 0.8, turbulence: 0.15, lean: 0, reach: 0, verticalBob: 0.20 } }
]

