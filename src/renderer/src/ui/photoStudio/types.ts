import type { ChromaKeySettings } from '../layerAssembly/cutter/types'

export type PhotoStudioTool = 'pan' | 'wand' | 'eraser' | 'restore' | 'box' | 'lasso' | 'eyedropper'

export type PhotoCanvasBgMode = 'checker-dark' | 'checker-light' | 'dark' | 'light'

export interface PhotoAdjustments {
  /** Độ sáng: -100% (tối) tới +100% (sáng) */
  brightness: number
  /** Độ tương phản: -100% (mờ phẳng) tới +100% (gắt nét) */
  contrast: number
  /** Độ bão hòa màu: -100% (đen trắng) tới +100% (rực rỡ) */
  saturation: number
  /** Nhiệt độ màu: -100% (lạnh/lam) tới +100% (ấm/vàng cam) */
  warmth: number
  /** Xoay tông màu (Hue Shift): -180° tới +180° */
  hue: number
  /** Phơi sáng (Exposure): 0.5 (thiếu sáng) tới 2.0 (thừa sáng), chuẩn 1.0 */
  exposure: number
  /** Đen trắng (Grayscale) */
  grayscale: boolean
  /** Đảo ngược màu (Invert) */
  invert: boolean
}

export const DEFAULT_PHOTO_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  hue: 0,
  exposure: 1.0,
  grayscale: false,
  invert: false
}

export type PhotoFilterPreset =
  | 'original'
  | 'vivid'
  | 'warm_anime'
  | 'cinematic_cool'
  | 'bw'
  | 'invert'

export interface PhotoSaveOptions {
  fileName: string
  title: string
  category: string
  addToScene: boolean
}
