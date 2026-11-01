/**
 * Cấu trúc dữ liệu & Thiết lập cho Xưởng Tách Hoạt Ảnh Lặp (Loop Sprite Animator).
 */

export interface LoopFrame {
  id: string
  index: number
  x: number
  y: number
  width: number
  height: number
  enabled: boolean
  durationMultiplier: number
  offsetX: number
  offsetY: number
  label: string
  dataUrl?: string
  trimmedBounds?: { x: number; y: number; width: number; height: number }
}

export type LoopSlicerMode = 'grid' | 'contour' | 'manual'
export type GridOrder = 'row_first' | 'col_first'
export type LoopMode = 'loop' | 'ping-pong' | 'once'
export type CanvasBgType = 'checker-dark' | 'checker-light' | 'black' | 'white'

export interface GridSlicerConfig {
  rows: number
  cols: number
  paddingInset: number
  order: GridOrder
}

export interface ContourSlicerConfig {
  minArea: number
  mergeGap: number
  alphaThreshold: number
}

export type ChromaKeyColorType =
  | 'chroma_magenta'
  | 'chroma_green'
  | 'chroma_blue'
  | 'white'
  | 'black'
  | 'custom'

export interface LoopChromaConfig {
  enabled: boolean
  keyColorType: ChromaKeyColorType
  customHex: string
  tolerance: number
  smoothness: number
  despill: number
}

export interface LoopPlaybackConfig {
  fps: number
  loopMode: LoopMode
  isPlaying: boolean
  currentFrame: number
  onionSkin: boolean
  onionSkinOpacity: number
  canvasBg: CanvasBgType
}

export interface LoopAnimationPreset {
  id: string
  name: string
  description: string
  imageUrl: string
  isChroma: boolean
  defaultGrid: { rows: number; cols: number }
  defaultFps: number
  chromaConfig?: Partial<LoopChromaConfig>
}

export interface LoopAnimationTemplate {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  frameCount: number
  fps: number
  loopMode: LoopMode
  width: number
  height: number
  thumbUrl?: string
  imageUrl: string
  gridConfig: GridSlicerConfig
  chromaConfig: LoopChromaConfig
  frames: LoopFrame[]
}

export const DEFAULT_CHROMA_CONFIG: LoopChromaConfig = {
  enabled: false,
  keyColorType: 'chroma_magenta',
  customHex: '#ff00ff',
  tolerance: 36,
  smoothness: 12,
  despill: 25
}

export const DEFAULT_GRID_CONFIG: GridSlicerConfig = {
  rows: 4,
  cols: 4,
  paddingInset: 0,
  order: 'row_first'
}

export const DEFAULT_CONTOUR_CONFIG: ContourSlicerConfig = {
  minArea: 80,
  mergeGap: 16,
  alphaThreshold: 20
}

export const DEFAULT_PLAYBACK_CONFIG: LoopPlaybackConfig = {
  fps: 12,
  loopMode: 'loop',
  isPlaying: true,
  currentFrame: 0,
  onionSkin: false,
  onionSkinOpacity: 0.35,
  canvasBg: 'checker-dark'
}
