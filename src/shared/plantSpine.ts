/**
 * Xương motion (Plant Spine): một đường cong vẽ tay từ GỐC lên NGỌN trên bố cục 2D.
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
  /** Bảng Hoạt động: tắt chuyển động gió của trục này (vẫn giữ dữ liệu). */
  muted?: boolean
  /** Góc uốn tối đa tại ngọn (độ). */
  amplitude: number
  /** Số chu kỳ đung đưa mỗi giây. */
  speed: number
  /** 0 = mềm, cả thân cùng cong · 1 = cứng, chỉ phần ngọn cong. */
  stiffness: number
  /** 0..1 — độ rung phụ ở ngọn (lá/cành non phất theo nhịp đôi). */
  flexibility: number
  /** 0..1.2 — độ trễ truyền sóng chữ S từ gốc tới ngọn (0 = uốn chữ C đồng pha · 0.6–0.9 = sóng truyền mượt như lụa/tóc). */
  waveLag?: number
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
 * Chuyển động vẽ tay của xương motion: đường cong góc-ngọn theo thời gian, lặp liền mạch theo chu kỳ duration.
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

export type PlantSpinePresetId = 'grass' | 'sapling' | 'branch' | 'canopy' | 'flower' | 'seaweed' | 'silk' | 'cloak'

export type PlantSpineParams = Pick<
  PlantSpine,
  'amplitude' | 'speed' | 'stiffness' | 'flexibility' | 'waveLag' | 'turbulence' | 'lean' | 'reach' | 'verticalBob'
>

export const PLANT_SPINE_PRESETS: Array<{ id: PlantSpinePresetId; label: string; params: PlantSpineParams }> = [
  { id: 'silk', label: 'Tóc & Dải lụa (S-Wave)', params: { amplitude: 13, speed: 0.68, stiffness: 0.16, flexibility: 0.78, waveLag: 0.78, turbulence: 0.22, lean: 2, reach: 0, verticalBob: 0 } },
  { id: 'cloak', label: 'Áo choàng bay gió', params: { amplitude: 15, speed: 0.58, stiffness: 0.22, flexibility: 0.72, waveLag: 0.72, turbulence: 0.26, lean: 3, reach: 0, verticalBob: 0 } },
  { id: 'grass', label: 'Cỏ lau / Lúa', params: { amplitude: 15, speed: 0.75, stiffness: 0.15, flexibility: 0.55, waveLag: 0.52, turbulence: 0.3, lean: 3, reach: 0, verticalBob: 0.03 } },
  { id: 'sapling', label: 'Cây non', params: { amplitude: 8.5, speed: 0.55, stiffness: 0.35, flexibility: 0.35, waveLag: 0.42, turbulence: 0.22, lean: 1, reach: 0, verticalBob: 0 } },
  { id: 'branch', label: 'Cành cây', params: { amplitude: 6.5, speed: 0.48, stiffness: 0.45, flexibility: 0.45, waveLag: 0.48, turbulence: 0.25, lean: 0, reach: 0, verticalBob: 0 } },
  { id: 'canopy', label: 'Đại thụ / Tán lớn', params: { amplitude: 3.5, speed: 0.32, stiffness: 0.7, flexibility: 0.25, waveLag: 0.35, turbulence: 0.18, lean: 0, reach: 0, verticalBob: 0 } },
  { id: 'flower', label: 'Hoa thân mềm', params: { amplitude: 11, speed: 0.65, stiffness: 0.25, flexibility: 0.58, waveLag: 0.55, turbulence: 0.25, lean: 2, reach: 0, verticalBob: 0.02 } },
  { id: 'seaweed', label: 'Rong biển / Dây leo', params: { amplitude: 20, speed: 0.42, stiffness: 0.05, flexibility: 0.82, waveLag: 0.85, turbulence: 0.15, lean: 0, reach: 0, verticalBob: 0 } }
]

