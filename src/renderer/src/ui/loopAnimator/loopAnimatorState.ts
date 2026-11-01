import { create } from 'zustand'
import type {
  LoopFrame,
  LoopSlicerMode,
  GridSlicerConfig,
  ContourSlicerConfig,
  LoopChromaConfig,
  LoopPlaybackConfig,
  LoopAnimationPreset
} from './types'
import {
  DEFAULT_GRID_CONFIG,
  DEFAULT_CONTOUR_CONFIG,
  DEFAULT_CHROMA_CONFIG,
  DEFAULT_PLAYBACK_CONFIG
} from './types'
import { computeLoopGridFrames } from './loopFrameExtractor'
import { BUILTIN_LOOP_PRESETS, SAMPLE_CAMPFIRE_TRANSPARENT } from './sampleLoops'

export interface LoopAnimatorState {
  isOpen: boolean
  name: string
  imageUrl: string
  activePresetId: string | null
  imageNaturalSize: { width: number; height: number }
  frames: LoopFrame[]
  selectedFrameIndex: number
  slicerMode: LoopSlicerMode
  gridConfig: GridSlicerConfig
  contourConfig: ContourSlicerConfig
  chromaConfig: LoopChromaConfig
  playback: LoopPlaybackConfig

  // Actions
  open: (presetOrUrl?: string | LoopAnimationPreset) => void
  close: () => void
  setName: (name: string) => void
  setImageUrl: (url: string) => void
  setImageNaturalSize: (size: { width: number; height: number }) => void
  setSlicerMode: (mode: LoopSlicerMode) => void
  setGridConfig: (patch: Partial<GridSlicerConfig>) => void
  setContourConfig: (patch: Partial<ContourSlicerConfig>) => void
  setChromaConfig: (patch: Partial<LoopChromaConfig>) => void
  setPlayback: (patch: Partial<LoopPlaybackConfig>) => void
  setFrames: (frames: LoopFrame[]) => void
  selectFrame: (index: number) => void
  updateFrame: (index: number, patch: Partial<LoopFrame>) => void
  reorderFrames: (fromIndex: number, toIndex: number) => void
  reverseFrames: () => void
  expandPingPong: () => void
  duplicateFrame: (index: number) => void
  deleteFrame: (index: number) => void
  autoGenerateGridFrames: (w?: number, h?: number) => void
}

export const useLoopAnimator = create<LoopAnimatorState>((set, get) => ({
  isOpen: false,
  name: 'Lửa trại hoạt ảnh lặp',
  imageUrl: SAMPLE_CAMPFIRE_TRANSPARENT.imageUrl,
  activePresetId: SAMPLE_CAMPFIRE_TRANSPARENT.id,
  imageNaturalSize: { width: 1024, height: 1024 },
  frames: computeLoopGridFrames(1024, 1024, DEFAULT_GRID_CONFIG),
  selectedFrameIndex: 0,
  slicerMode: 'grid',
  gridConfig: { ...DEFAULT_GRID_CONFIG },
  contourConfig: { ...DEFAULT_CONTOUR_CONFIG },
  chromaConfig: { ...DEFAULT_CHROMA_CONFIG },
  playback: { ...DEFAULT_PLAYBACK_CONFIG },

  open: (presetOrUrl) => {
    if (typeof presetOrUrl === 'object' && presetOrUrl !== null) {
      const p = presetOrUrl as LoopAnimationPreset
      const grid = { ...DEFAULT_GRID_CONFIG, ...p.defaultGrid }
      const chroma = { ...DEFAULT_CHROMA_CONFIG, ...(p.chromaConfig || {}) }
      set({
        isOpen: true,
        name: p.name,
        imageUrl: p.imageUrl,
        activePresetId: p.id,
        gridConfig: grid,
        chromaConfig: chroma,
        playback: { ...get().playback, fps: p.defaultFps || 12, isPlaying: true, currentFrame: 0 }
      })
      get().autoGenerateGridFrames()
      return
    }

    const matchedPreset = BUILTIN_LOOP_PRESETS.find(
      (p) => p.id === presetOrUrl || p.imageUrl === presetOrUrl
    )

    if (matchedPreset) {
      get().open(matchedPreset)
      return
    }

    if (typeof presetOrUrl === 'string' && presetOrUrl.length > 0) {
      set({
        isOpen: true,
        activePresetId: null,
        imageUrl: presetOrUrl,
        playback: { ...get().playback, isPlaying: true, currentFrame: 0 }
      })
      get().autoGenerateGridFrames()
    } else {
      set({
        isOpen: true,
        playback: { ...get().playback, isPlaying: true, currentFrame: 0 }
      })
    }
  },

  close: () => {
    set({
      isOpen: false,
      playback: { ...get().playback, isPlaying: false }
    })
  },

  setName: (name) => set({ name }),
  setImageUrl: (imageUrl) => set({ imageUrl, activePresetId: null }),
  setImageNaturalSize: (imageNaturalSize) => {
    set({ imageNaturalSize })
    get().autoGenerateGridFrames(imageNaturalSize.width, imageNaturalSize.height)
  },

  setSlicerMode: (slicerMode) => set({ slicerMode }),

  setGridConfig: (patch) => {
    const next = { ...get().gridConfig, ...patch }
    set({ gridConfig: next })
    get().autoGenerateGridFrames()
  },

  setContourConfig: (patch) => {
    set({ contourConfig: { ...get().contourConfig, ...patch } })
  },

  setChromaConfig: (patch) => {
    set({ chromaConfig: { ...get().chromaConfig, ...patch } })
  },

  setPlayback: (patch) => {
    set({ playback: { ...get().playback, ...patch } })
  },

  setFrames: (frames) => {
    set({
      frames,
      selectedFrameIndex: Math.min(get().selectedFrameIndex, Math.max(0, frames.length - 1))
    })
  },

  selectFrame: (selectedFrameIndex) => set({ selectedFrameIndex }),

  updateFrame: (index, patch) => {
    const list = [...get().frames]
    if (index >= 0 && index < list.length) {
      list[index] = { ...list[index], ...patch }
      set({ frames: list })
    }
  },

  reorderFrames: (fromIndex, toIndex) => {
    const list = [...get().frames]
    if (
      fromIndex < 0 ||
      fromIndex >= list.length ||
      toIndex < 0 ||
      toIndex >= list.length ||
      fromIndex === toIndex
    )
      return
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    const reindexed = list.map((f, i) => ({ ...f, index: i }))
    set({ frames: reindexed, selectedFrameIndex: toIndex })
  },

  reverseFrames: () => {
    const list = [...get().frames].reverse()
    const reindexed = list.map((f, i) => ({ ...f, index: i }))
    set({ frames: reindexed })
  },

  expandPingPong: () => {
    const list = [...get().frames]
    if (list.length <= 2) return
    const middle = list.slice(1, -1).reverse()
    const expanded = [
      ...list,
      ...middle.map((f) => ({
        ...f,
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      }))
    ]
    const reindexed = expanded.map((f, i) => ({ ...f, index: i }))
    set({ frames: reindexed })
  },

  duplicateFrame: (index) => {
    const list = [...get().frames]
    if (index < 0 || index >= list.length) return
    const target = list[index]
    const copy: LoopFrame = {
      ...target,
      id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `${target.label} (sao chép)`
    }
    list.splice(index + 1, 0, copy)
    const reindexed = list.map((f, i) => ({ ...f, index: i }))
    set({ frames: reindexed, selectedFrameIndex: index + 1 })
  },

  deleteFrame: (index) => {
    const list = [...get().frames]
    if (list.length <= 1) {
      window.alert('Không thể xóa khung hình cuối cùng!')
      return
    }
    if (index >= 0 && index < list.length) {
      list.splice(index, 1)
      const reindexed = list.map((f, i) => ({ ...f, index: i }))
      set({
        frames: reindexed,
        selectedFrameIndex: Math.min(index, reindexed.length - 1)
      })
    }
  },

  autoGenerateGridFrames: (w, h) => {
    const width = w ?? get().imageNaturalSize.width ?? 1024
    const height = h ?? get().imageNaturalSize.height ?? 1024
    const frames = computeLoopGridFrames(width, height, get().gridConfig)
    set({ frames, selectedFrameIndex: 0 })
  }
}))
