export interface CutPoint {
  x: number
  y: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export type CutterToolMode = 'auto' | 'grid' | 'box' | 'lasso' | 'wand' | 'eraser' | 'restore'
export type CutToolMode = CutterToolMode

export type EyedropperTarget = 'key' | 'fringe' | 'smooth'

export type ChromaKeyColorType = 'chroma_green' | 'pure_white' | 'pure_black' | 'custom'

export type ChromaIsolationMode = 'all' | 'outer_only'

export type ChromaCleanupMode = 'all' | 'defringe' | 'smooth' | 'despeckle'

export type ChromaSmoothColorType = 'none' | 'black' | 'white' | 'custom'

export type ChromaPreviewMode = 'transparent' | 'original'

export interface ChromaKeySettings {
  enabled: boolean
  keyColorHex: string
  /** Alias tương thích ngược cho keyColorHex */
  keyColor?: string
  keyColorType?: ChromaKeyColorType
  isolationMode?: ChromaIsolationMode
  tolerance: number // 0 to 100
  smoothness: number // Feather: 0 to 30
  despill: boolean
  previewBackground?: 'checkerboard' | 'dark' | 'light'
  shadowRetention?: number // 0 to 100
  strokeWidth?: number // 0 to 10
  strokeColorHex?: string

  // Tab 2: Khử viền sượng & Lọc rác (Defringe & Despeckle)
  cleanupMode?: ChromaCleanupMode
  fringeColorType?: ChromaKeyColorType
  fringeColorHex?: string
  defringeStrength?: number // 0 to 100
  edgeChoke?: number // 0 to 10
  edgeSmooth?: number // 0 to 10
  smoothColorType?: ChromaSmoothColorType
  smoothColorHex?: string
  despeckleSize?: number // 0 to 300
  whiteSpeckleSensitivity?: number // 0 to 100
  keepLargestIslandOnly?: boolean

  // Chế độ hiển thị đối chiếu
  previewMode?: ChromaPreviewMode
}

export const DEFAULT_CHROMA_SETTINGS: ChromaKeySettings = {
  enabled: true,
  keyColorHex: '#00DB4E',
  keyColor: '#00DB4E',
  keyColorType: 'chroma_green',
  isolationMode: 'outer_only',
  tolerance: 36,
  smoothness: 2,
  despill: true,
  previewBackground: 'checkerboard',
  shadowRetention: 0,
  strokeWidth: 0,
  strokeColorHex: '#FFFFFF',
  cleanupMode: 'all',
  fringeColorType: 'chroma_green',
  fringeColorHex: '#00DB4E',
  defringeStrength: 45,
  edgeChoke: 0,
  edgeSmooth: 2,
  smoothColorType: 'none',
  smoothColorHex: '#000000',
  despeckleSize: 16,
  whiteSpeckleSensitivity: 0,
  keepLargestIslandOnly: false,
  previewMode: 'transparent'
}

export interface GridSlicerSettings {
  rows: number
  cols: number
  paddingInset: number
}

export interface EyedropperSample {
  clientX: number
  clientY: number
  canvasX: number
  canvasY: number
  imgX: number
  imgY: number
  hex: string
  r: number
  g: number
  b: number
  a: number
  prevHex: string
  /** Ma trận màu 9x9 quanh pixel đang trỏ để vẽ kính lúp phóng đại pixel kiểu Photoshop */
  pixelGrid: string[][]
}

export interface DetectedIsland {
  id: string
  x: number
  y: number
  width: number
  height: number
  area: number
  label?: string
}

export interface CutPiece {
  id: string
  label: string
  dataUrl: string
  width: number
  height: number
  sourceBox?: BoundingBox
}

export interface TemplateSlotDef {
  id: string
  name: string
  category?: 'head' | 'body' | 'limb' | 'accessory' | 'prop'
  /** Default relative X on 2D assembly board (-220 to 220) */
  x: number
  /** Default relative Y on 2D assembly board (-240 to 240) */
  y: number
  /** Visual guide box width */
  width: number
  /** Visual guide box height */
  height: number
  /** Suggested Z order */
  z?: number
}

export interface TemplateSlotPreset {
  id: string
  name: string
  description: string
  isCustom?: boolean
  slots: TemplateSlotDef[]
}
