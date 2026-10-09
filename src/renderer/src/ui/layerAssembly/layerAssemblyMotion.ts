import type { LayerMotionSettings } from './types'

export interface ComputedLayerMotion {
  animRotateDeg: number
  animRotateRad: number
  animScaleX: number
  animScaleY: number
  animTranslateX: number
  animTranslateY: number
}

/**
 * Tính toán chuyển động hoạt ảnh 2.5D mượt mà tự nhiên theo thời gian
 * Áp dụng sóng hài bậc hai (harmonic) để mô phỏng ngọn gió lướt êm dịu, không giật cục.
 */
export function computeLayerMotion(motion: LayerMotionSettings, time: number): ComputedLayerMotion {
  const { type, speed, amplitude, phaseOffset = 0 } = motion
  const t = time * speed + phaseOffset
  const cycle = t * Math.PI * 2

  let animRotateDeg = 0
  let animScaleX = 1
  let animScaleY = 1
  let animTranslateX = 0
  let animTranslateY = 0

  if (type === 'sway') {
    // Đung đưa xoay góc quanh điểm neo: sóng sin kết hợp sóng hài bậc 2 tạo độ mềm dẻo như cành cây thật
    const smoothSway = Math.sin(cycle) + Math.sin(cycle * 2) * 0.12
    animRotateDeg = smoothSway * amplitude
  } else if (type === 'breathe') {
    // Phập phồng co giãn tỉ lệ nhịp nhàng
    const factor = 1 + Math.sin(cycle) * (amplitude / 100)
    animScaleX = factor
    animScaleY = factor
  } else if (type === 'float') {
    // Lơ lửng dao động bồng bềnh
    const smoothFloat = Math.sin(cycle) + Math.sin(cycle * 2) * 0.08
    animTranslateY = smoothFloat * amplitude
  } else if (type === 'rocking') {
    // Bập bênh con lắc
    const smoothRock = Math.cos(cycle) + Math.cos(cycle * 2) * 0.1
    animRotateDeg = smoothRock * amplitude
    animTranslateX = Math.sin(cycle) * (amplitude * 0.35)
  }

  return {
    animRotateDeg,
    animRotateRad: (animRotateDeg * Math.PI) / 180,
    animScaleX,
    animScaleY,
    animTranslateX,
    animTranslateY
  }
}
