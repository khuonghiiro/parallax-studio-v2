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

export type ChromaKeyColorType =
  | 'chroma_green'
  | 'chroma_blue'
  | 'pure_white'
  | 'pure_black'
  | 'custom'

export type ChromaIsolationMode = 'all' | 'outer_only'

export type ChromaCleanupMode = 'all' | 'defringe' | 'smooth' | 'despeckle'

export type ChromaSmoothColorType = 'none' | 'black' | 'white' | 'custom'

export type ChromaPreviewMode = 'transparent' | 'original'

export type ChromaShadowMode = 'off' | 'include' | 'only'

export type ChromaShadowType = 'auto' | 'light' | 'dark'

export interface ChromaKeySettings {
  enabled: boolean
  keyColorHex: string
  /** Alias tương thích ngược cho keyColorHex */
  keyColor?: string
  keyColorType?: ChromaKeyColorType
  isolationMode?: ChromaIsolationMode
  /** `outer_only` thuần (mặc định): chỉ loang nền từ biên ảnh / vùng đã trong suốt, giữ nguyên ruột bên trong. Đặt `false` để bật lại kiểu cũ tự gieo hạt ở khe phông xanh thuần khiết (kẽ tóc). */
  strictOuterIsolation?: boolean
  /** "Xoá bóng" sạch cho hiệu ứng ánh sáng (Xưởng Loop): loại quầng / bóng bán trong suốt dưới ngưỡng Độ nhạy và khử ám màu mép còn lại */
  removeSoftHalo?: boolean
  tolerance: number // 0 to 100
  smoothness: number // Feather: 0 to 30
  despill: boolean
  previewBackground?: 'checkerboard' | 'dark' | 'light'
  /** Chế độ xử lý bóng mờ / mây khói bán trong suốt: 'off' (xoá bóng), 'include' (lấy cả bóng), 'only' (chỉ tách riêng bóng) */
  shadowMode?: ChromaShadowMode
  /** Giữ lại bóng mờ (tương thích ngược) */
  keepShadows?: boolean
  /** Loại bóng cần tách: 'auto' (cả bóng sáng/mây mờ và bóng tối), 'light' (mây/khói/hào quang sáng), 'dark' (bóng đổ tối) */
  shadowType?: ChromaShadowType
  shadowRetention?: number // 0 to 100
  /** Ngưỡng phân tách giữa vật thể đặc và vùng bóng mờ (30..90, mặc định 62) */
  shadowSolidThreshold?: number
  /** Tự động khử màu nền pha lẫn trong bóng mờ (Color Unmixing) */
  shadowUnmixColor?: boolean
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
  isolationMode: 'all',
  strictOuterIsolation: false,
  tolerance: 1,
  smoothness: 0,
  despill: false,
  previewBackground: 'checkerboard',
  shadowMode: 'include',
  shadowType: 'auto',
  shadowRetention: 0,
  shadowSolidThreshold: 100,
  shadowUnmixColor: true,
  strokeWidth: 0,
  strokeColorHex: '#FFFFFF',
  cleanupMode: 'all',
  fringeColorType: 'chroma_green',
  fringeColorHex: '#00DB4E',
  defringeStrength: 0,
  edgeChoke: 0,
  edgeSmooth: 0,
  smoothColorType: 'none',
  smoothColorHex: '#000000',
  despeckleSize: 0,
  whiteSpeckleSensitivity: 0,
  keepLargestIslandOnly: false,
  previewMode: 'transparent'
}

export const CUTTER_CHROMA_CACHE_KEY = 'pxs:sprite-cutter-chroma-settings-v3'

export function getStoredChromaSettings(): ChromaKeySettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_CHROMA_SETTINGS }
  }
  try {
    const raw = window.localStorage.getItem(CUTTER_CHROMA_CACHE_KEY)
    if (!raw) return { ...DEFAULT_CHROMA_SETTINGS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CHROMA_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_CHROMA_SETTINGS }
  }
}

export function saveStoredChromaSettings(settings: Partial<ChromaKeySettings>): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const current = getStoredChromaSettings()
    const merged = { ...current, ...settings }
    window.localStorage.setItem(CUTTER_CHROMA_CACHE_KEY, JSON.stringify(merged))
  } catch {
    /* ignore storage errors */
  }
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
  /** Kích thước gốc của ảnh sprite sheet nguồn (dùng để tự động co tỷ lệ mảnh cắt 4K/8K vừa khung 2D) */
  sourceImageSize?: { width: number; height: number }
}

export interface TemplateSlotDef {
  id: string
  name: string
  category?: 'head' | 'body' | 'limb' | 'accessory' | 'prop'
  /** Default relative X on 2D assembly board (-220 to 220) */
  x: number
  y: number
  /** Visual guide box width */
  width: number
  /** Visual guide box height */
  height: number
  /** Suggested Z order */
  z?: number
  role?: string
  scale?: number
  rotation?: number
}

export interface TemplateSlotPreset {
  id: string
  name: string
  description: string
  category?: 'character' | 'nature' | 'architecture' | 'custom'
  isCustom?: boolean
  createdAt?: string
  slots: TemplateSlotDef[]
}
