export interface ChromaKeySettings {
  enabled: boolean
  keyColor: string // hex #rrggbb
  tolerance: number // 0..100
  smoothness: number // 0..20
  despill: boolean
  previewBackground: 'checkerboard' | 'dark' | 'light'
}

export type CutToolMode = 'auto' | 'box' | 'lasso' | 'eraser' | 'restore'

export interface DetectedIsland {
  id: string
  x: number
  y: number
  width: number
  height: number
  area: number
  label?: string
}

export interface CutPoint {
  x: number
  y: number
}

export interface CutPiece {
  id: string
  dataUrl: string
  width: number
  height: number
  label: string
  sourceBox: { x: number; y: number; width: number; height: number }
}

export interface TemplateSlotDef {
  id: string
  name: string
  role?: string
  x: number
  y: number
  width: number
  height: number
  z?: number
  scale?: number
  rotation?: number
}

export interface TemplateSlotPreset {
  id: string
  name: string
  category?: string
  description?: string
  slots: TemplateSlotDef[]
  isCustom?: boolean
  createdAt?: string
}

