import type { ImageProps } from '@shared/types'

/**
 * Vòng đời xuất hiện của Layer Loop Animate (thuần, không phụ thuộc engine):
 * - Hiện dần từ trong suốt → rõ nét lúc Loop bắt đầu (`loopFadeInSec`).
 * - Chạy `loopPlayCount` lần ở chế độ `once`, hoặc lặp tới mốc `loopEndTime` (thời gian Node / Node Time).
 * - Khi kết thúc: giữ khung cuối (`hold`), ẩn ngay (`hide`) hoặc mờ dần rồi ẩn (`fade_out`).
 * Kết quả là hệ số nhân độ mờ nên cộng dồn tự nhiên với Nhịp & Nháy, keyframe FX và Motion.
 */
export type LoopLifecycleProps = Pick<
  ImageProps,
  | 'loopMode'
  | 'speed'
  | 'loopPlayCount'
  | 'loopStartTime'
  | 'loopEndTime'
  | 'loopEndAction'
  | 'loopFadeInSec'
  | 'loopFadeOutSec'
>

export const LOOP_MAX_PLAY_COUNT = 20

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Số lần chạy hợp lệ của chế độ `once` (1..20) */
export function resolveLoopPlayCount(props: Pick<ImageProps, 'loopPlayCount'>): number {
  const n = finite(props.loopPlayCount) ? Math.round(props.loopPlayCount) : 1
  return Math.max(1, Math.min(LOOP_MAX_PLAY_COUNT, n))
}

/**
 * Mốc gốc của đồng hồ khung hình Loop. Chế độ `once` (hoặc khi đã đặt `loopStartTime`) bắt đầu tại
 * mốc của Layer / Node; các chế độ lặp cũ không có `loopStartTime` giữ đồng hồ timeline toàn cục như trước.
 */
export function resolveLoopClockAnchor(
  props: Pick<ImageProps, 'loopMode' | 'loopStartTime'>,
  layerInPoint = 0
): number {
  if (finite(props.loopStartTime)) return Math.max(0, props.loopStartTime)
  return props.loopMode === 'once' ? Math.max(0, layerInPoint) : 0
}

/** Mốc bắt đầu vòng đời xuất hiện (hiện dần) — mặc định là inPoint của Layer */
export function resolveLoopStartTime(props: Pick<ImageProps, 'loopStartTime'>, layerInPoint = 0): number {
  return finite(props.loopStartTime) ? Math.max(0, props.loopStartTime) : Math.max(0, layerInPoint)
}

/**
 * Mốc giây Loop kết thúc: chế độ `once` = bắt đầu + số lần × chu kỳ / tốc độ;
 * các chế độ lặp vô tận dùng `loopEndTime` (thời gian Node). Không xác định → `undefined`.
 */
export function resolveLoopEndTime(
  props: LoopLifecycleProps,
  layerInPoint: number,
  cycleDurationSec: number | undefined
): number | undefined {
  const start = resolveLoopStartTime(props, layerInPoint)
  if (props.loopMode === 'once' && finite(cycleDurationSec) && cycleDurationSec > 0) {
    const speed = Math.max(0.01, finite(props.speed) ? props.speed : 1)
    return start + (resolveLoopPlayCount(props) * cycleDurationSec) / speed
  }
  return finite(props.loopEndTime) && props.loopEndTime > start ? props.loopEndTime : undefined
}

/** Layer có cấu hình vòng đời cần đánh giá hay không (để bỏ qua nhanh layer thường) */
export function hasLoopLifecycle(props: LoopLifecycleProps): boolean {
  const fadeIn = finite(props.loopFadeInSec) && props.loopFadeInSec > 0
  const endAction = props.loopEndAction ?? 'hold'
  return fadeIn || endAction !== 'hold'
}

/** Hệ số nhân độ mờ (0..1) của vòng đời Loop tại thời điểm `t` */
export function evaluateLoopLifecycle(
  props: LoopLifecycleProps,
  t: number,
  layerInPoint = 0,
  cycleDurationSec?: number
): number {
  if (!hasLoopLifecycle(props) || !finite(t)) return 1
  const start = resolveLoopStartTime(props, layerInPoint)
  let k = 1

  const fadeIn = finite(props.loopFadeInSec) ? Math.max(0, props.loopFadeInSec) : 0
  if (fadeIn > 0) {
    if (t < start) return 0
    if (t < start + fadeIn) k *= (t - start) / fadeIn
  }

  const endAction = props.loopEndAction ?? 'hold'
  if (endAction === 'hold') return k
  const end = resolveLoopEndTime(props, layerInPoint, cycleDurationSec)
  if (end === undefined) return k
  if (t >= end) return 0
  if (endAction === 'fade_out') {
    const fadeOut = Math.min(Math.max(0, end - start), finite(props.loopFadeOutSec) ? Math.max(0, props.loopFadeOutSec) : 0.5)
    if (fadeOut > 0 && t > end - fadeOut) k *= (end - t) / fadeOut
  }
  return Math.max(0, Math.min(1, k))
}
