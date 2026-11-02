import type { LoopAnimationMode, LoopRhythmMode } from '@shared/types'

export type SlicerMode = 'grid' | 'contour' | 'manual'
export type { LoopAnimationMode, LoopRhythmMode }

export interface LoopFrameBox {
  id: string
  index: number
  /** Top-left X in source image pixels */
  x: number
  /** Top-left Y in source image pixels */
  y: number
  /** Width in source image pixels */
  width: number
  /** Height in source image pixels */
  height: number
  /** Frame-specific pivot/offset X adjustment (px) for stabilizing jittery sprites */
  offsetX: number
  /** Frame-specific pivot/offset Y adjustment (px) */
  offsetY: number
  /** Whether this frame is included in playback & export */
  enabled: boolean
  /** Frame duration multiplier (1.0 = standard 1/fps) */
  durationRatio: number
}

export interface ChromaKeyConfig {
  enabled: boolean
  /** Hex color to remove, e.g. '#00ff00' */
  keyColor: string
  /** Color distance tolerance (0..1, default 0.28) */
  similarity: number
  /** Edge feathering smoothness (0..1, default 0.10) */
  smoothness: number
  /** Green/color spill suppression on semi-transparent edges (0..1, default 0.35) */
  spill: number
}

export interface GridSlicerConfig {
  cols: number
  rows: number
  marginX: number
  marginY: number
  paddingX: number
  paddingY: number
}

export interface ContourSlicerConfig {
  /** Alpha threshold (1..254) for considering a pixel non-empty */
  alphaThreshold: number
  /** Minimum bounding box area (px²) to ignore tiny dust specks */
  minArea: number
  /** Merge nearby bounding boxes within this pixel distance */
  mergeGap: number
}

export interface LoopRhythmConfig {
  rhythmMode: LoopRhythmMode
  rhythmRateHz: number
  rhythmIntensity: number
  minOpacity: number
  scaleBeatPct: number
}

export interface LoopPlaybackConfig {
  fps: number
  speed: number
  loopMode: LoopAnimationMode
  isPlaying: boolean
  onionSkin: boolean
  onionSkinOpacity: number
  previewBg: 'checker' | 'dark' | 'light' | 'green'
  rhythm: LoopRhythmConfig
}

export interface SampleLoopPreset {
  id: string
  name: string
  category: 'fire' | 'magic' | 'nature' | 'electric' | 'custom'
  badge: string
  description: string
  imageUrl: string
  defaultGrid: GridSlicerConfig
  defaultChroma: ChromaKeyConfig
  defaultFps: number
  defaultLoopMode?: LoopAnimationMode
  defaultSpeed?: number
  defaultRhythm?: Partial<LoopRhythmConfig>
}

export interface LoopAnimationTemplate {
  id: string
  name: string
  category: 'fire' | 'magic' | 'nature' | 'electric' | 'custom'
  badge: string
  description: string
  /** Source sprite sheet url or data URL */
  imageUrl: string
  /** Cropped Frame #1 preview PNG data URL (with Chroma Key removed) */
  thumbUrl?: string
  slicerMode: SlicerMode
  gridConfig: GridSlicerConfig
  contourConfig?: ContourSlicerConfig
  chromaKey: ChromaKeyConfig
  fps: number
  speed?: number
  loopMode: LoopAnimationMode
  rhythm?: LoopRhythmConfig
  frameCount: number
  /** Optional custom frame boxes if edited manually or via contour */
  frames?: LoopFrameBox[]
  isBuiltin?: boolean
  createdAt?: number
  updatedAt?: number
}
