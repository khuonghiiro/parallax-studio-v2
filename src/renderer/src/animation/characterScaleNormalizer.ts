import type { Composition, ImageLayer } from '@shared/types'
import { autoScaleFactor } from './math'

/**
 * Phân hạng kích thước cơ thể chuẩn (Canonical Body Class) của nhân vật trong phim hoạt hình 2D/2.5D:
 * Giúp chuẩn hoá kích thước hiển thị thực tế trên màn hình 1080p giữa mọi phân cảnh,
 * triệt tiêu hoàn toàn lỗi "cùng 1 nhân vật lúc quá to lúc quá nhỏ".
 */
export type CharacterBodyClass =
  | 'petite_chibi' // Nhân vật nhỏ bé: Tiểu Khô Lâu, Linh thú nhỏ, Robot Hệ Thống (~500px ở Medium Shot)
  | 'ots_foreground' // Vai/đầu nhìn qua vai ở tiền cảnh (~540px ở OTS)
  | 'standard_human' // Nhân vật cỡ người chuẩn: Bạch Cốt Tinh, Đường Tăng (~650px ở Medium Shot)
  | 'hero_warrior' // Nhân vật chiến binh / Hầu Vương Tôn Ngộ Không (~700px ở Medium Shot)
  | 'boss_imposing' // Nhóm phản diện áp bức / Cự Thú khổng lồ (~820px ở Medium Shot)
  | 'distant_mini' // Nhóm nhân vật toàn thân đứng ở viễn cảnh đồi/thung lũng xa (~210px)

/** Cỡ cảnh quay điện ảnh chuẩn (Shot Framing Size) */
export type ShotFramingKind =
  | 'EWS' // Extreme Wide Shot (Viễn cảnh đại cảnh)
  | 'WS' // Wide Shot (Toàn cảnh thấy toàn thân)
  | 'MS' // Medium Shot (Trung cảnh tiêu chuẩn ngang hông/ngực)
  | 'MCU' // Medium Close-Up (Trung cận ngang ngực/vai)
  | 'CU' // Close-Up (Cận cảnh biểu cảm gương mặt)
  | 'ECU' // Extreme Close-Up (Đặc tả ánh mắt / chi tiết)
  | 'OTS' // Over-the-Shoulder (Góc nhìn qua vai)

/** Chiều cao chuẩn trên màn hình 1080p (pixel) tại cỡ cảnh Trung (MS = 1.0x) */
export const CANONICAL_BODY_HEIGHT_PX: Record<CharacterBodyClass, number> = {
  petite_chibi: 510,
  ots_foreground: 540,
  standard_human: 650,
  hero_warrior: 700,
  boss_imposing: 820,
  distant_mini: 210
}

/** Hệ số nhân theo cỡ cảnh điện ảnh (giữ chênh lệch hợp lý giữa WS / MS / CU mà không bị nhảy kích thước đột ngột) */
export const SHOT_FRAMING_MULTIPLIER: Record<ShotFramingKind, number> = {
  EWS: 0.38,
  WS: 0.82,
  MS: 1.0,
  OTS: 1.02,
  MCU: 1.12,
  CU: 1.22,
  ECU: 1.35
}

/**
 * Tính toán hệ số `scale` chuẩn hoá cho một Layer nhân vật dựa trên chiều cao pixel gốc của asset,
 * độ sâu Z và cỡ cảnh điện ảnh (`framing`), đảm bảo nhân vật giữ kích thước nhất quán xuyên suốt bộ phim.
 */
export function computeNormalizedCharacterScale(opts: {
  assetHeight: number
  z: number
  comp: Pick<Composition, 'width' | 'height'>
  bodyClass: CharacterBodyClass
  framing?: ShotFramingKind
  autoScale?: boolean
  customMultiplier?: number
}): number {
  const { assetHeight, z, comp, bodyClass, framing = 'MS', autoScale = false, customMultiplier = 1 } = opts
  const compScale = (comp.height || 1080) / 1080
  const baseScreenHeight = CANONICAL_BODY_HEIGHT_PX[bodyClass] * compScale
  const framingMul = SHOT_FRAMING_MULTIPLIER[framing] ?? 1.0
  const desiredScreenHeight = baseScreenHeight * framingMul * customMultiplier
  const perspK = autoScale ? 1 : autoScaleFactor(z, comp)
  const rawScale = (desiredScreenHeight * perspK) / Math.max(64, assetHeight)
  return Number(Math.max(0.15, Math.min(3.2, rawScale)).toFixed(3))
}

/**
 * Áp dụng kích thước chuẩn hoá lên `ImageLayer` nhân vật và (nếu là ảnh bán thân `anchorBustBottom`)
 * đặt mép dưới của ảnh vừa khít dưới đáy khung hình 16:9 mà KHÔNG tự ý phóng đại làm sai lệch tỷ lệ nhân vật.
 */
export function applyNormalizedCharacterStaging(
  layer: ImageLayer,
  comp: Pick<Composition, 'width' | 'height'>,
  opts: {
    bodyClass: CharacterBodyClass
    framing?: ShotFramingKind
    anchorBustBottom?: boolean
    maxCamScale?: number
    customMultiplier?: number
  }
): number {
  const pos = layer.transform.position.value
  const normScale = computeNormalizedCharacterScale({
    assetHeight: layer.props.height || 700,
    z: pos[2],
    comp,
    bodyClass: opts.bodyClass,
    framing: opts.framing ?? 'MS',
    autoScale: layer.autoScale,
    customMultiplier: opts.customMultiplier ?? 1
  })
  layer.transform.scale.value = [normScale, normScale, 1]

  if (opts.anchorBustBottom) {
    const perspK = layer.autoScale ? 1 : autoScaleFactor(pos[2], comp)
    const halfHWorld = layer.props.height * normScale * 0.5
    const maxCamScale = opts.maxCamScale ?? 1.0
    const safeBottomWorld = -(comp.height * 0.5 * maxCamScale + 48) * perspK
    const currentBottomWorld = pos[1] - halfHWorld
    if (currentBottomWorld > safeBottomWorld) {
      const dy = Math.round(safeBottomWorld - currentBottomWorld)
      layer.transform.position.value = [pos[0], pos[1] + dy, pos[2]]
    }
  }
  return normScale
}
