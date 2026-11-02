import { create } from 'zustand'
import {
  autoCenterLoopFrames,
  buildGridFrames,
  detectContourFrames,
  extractFirstFramePreviewUrl,
  extractAllFramesAsDataUrls
} from './loopFrameExtractor'
import { getAllLoopTemplates, saveLoopTemplate } from './loopAnimatorStorage'
import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import type {
  ChromaKeyConfig,
  ContourSlicerConfig,
  GridSlicerConfig,
  LoopAnimationMode,
  LoopAnimationTemplate,
  LoopFrameBox,
  LoopPlaybackConfig,
  LoopRhythmConfig,
  SlicerMode
} from './types'

export interface LoopAnimatorStore {
  isOpen: boolean
  activePresetId: string | null
  layerName: string
  category: LoopAnimationTemplate['category']
  sourceImageUrl: string | null
  sourceWidth: number
  sourceHeight: number
  sourceVersion: number
  slicerMode: SlicerMode
  gridConfig: GridSlicerConfig
  contourConfig: ContourSlicerConfig
  chromaKey: ChromaKeyConfig
  frames: LoopFrameBox[]
  selectedFrameIndex: number
  playingFrameIndex: number
  playback: LoopPlaybackConfig

  open: (presetId?: string) => void
  /** Bắt đầu phiên tách mới hoàn toàn trống (chưa có ảnh, chưa có frame) */
  startBlank: () => void
  close: () => void
  loadPreset: (presetId: string) => void
  loadCustomImage: (dataUrl: string, name?: string) => void
  setSourceDimensions: (width: number, height: number) => void
  bumpSourceVersion: () => void
  setLayerName: (name: string) => void
  setCategory: (category: LoopAnimationTemplate['category']) => void
  setSlicerMode: (mode: SlicerMode) => void
  setGridConfig: (patch: Partial<GridSlicerConfig>) => void
  setContourConfig: (patch: Partial<ContourSlicerConfig>) => void
  runContourSlicer: (sourceCanvas: HTMLCanvasElement | null) => number
  autoCenterFrames: (sourceCanvas: HTMLCanvasElement | null) => void
  equalizeFrameSizes: () => void
  setChromaKey: (patch: Partial<ChromaKeyConfig>) => void
  selectFrame: (index: number) => void
  setPlayingFrame: (index: number) => void
  updateFrame: (index: number, patch: Partial<LoopFrameBox>) => void
  toggleFrameEnabled: (index: number) => void
  reorderFrame: (fromIndex: number, toIndex: number) => void
  reverseFrames: () => void
  duplicateFrame: (index: number) => void
  deleteFrame: (index: number) => void
  addManualFrame: () => void
  setPlayback: (patch: Partial<LoopPlaybackConfig>) => void
  setRhythm: (patch: Partial<LoopRhythmConfig>) => void
  togglePlaying: () => void
  setFps: (fps: number) => void
  setSpeed: (speed: number) => void
  setLoopMode: (mode: LoopAnimationMode) => void
  saveCurrentToLibrary: (sourceCanvas?: HTMLCanvasElement | null) => LoopAnimationTemplate | null
}

const DEFAULT_PRESET = SAMPLE_LOOP_PRESETS[0]

export const BLANK_LOOP_NAME = 'Hoạt ảnh Loop mới'

const BLANK_GRID: GridSlicerConfig = { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 }

const BLANK_CHROMA: ChromaKeyConfig = {
  enabled: false,
  keyColor: '#00ff00',
  similarity: 0.28,
  smoothness: 0.1,
  spill: 0.35
}

const DEFAULT_RHYTHM: LoopRhythmConfig = {
  rhythmMode: DEFAULT_PRESET.defaultRhythm?.rhythmMode ?? 'flicker_opacity',
  rhythmRateHz: DEFAULT_PRESET.defaultRhythm?.rhythmRateHz ?? 3.2,
  rhythmIntensity: DEFAULT_PRESET.defaultRhythm?.rhythmIntensity ?? 0.25,
  minOpacity: DEFAULT_PRESET.defaultRhythm?.minOpacity ?? 0.72,
  scaleBeatPct: DEFAULT_PRESET.defaultRhythm?.scaleBeatPct ?? 8
}

export const useLoopAnimator = create<LoopAnimatorStore>((set, get) => ({
  isOpen: false,
  activePresetId: DEFAULT_PRESET.id,
  layerName: DEFAULT_PRESET.name,
  category: DEFAULT_PRESET.category,
  sourceImageUrl: DEFAULT_PRESET.imageUrl,
  sourceWidth: 1024,
  sourceHeight: 1024,
  sourceVersion: 0,
  slicerMode: 'grid',
  gridConfig: { ...DEFAULT_PRESET.defaultGrid },
  contourConfig: {
    alphaThreshold: 24,
    minArea: 180,
    mergeGap: 8,
    uniformSize: true,
    alignAnchor: 'bottom',
    readingOrder: 'row_first'
  },
  chromaKey: { ...DEFAULT_PRESET.defaultChroma },
  frames: buildGridFrames(1024, 1024, DEFAULT_PRESET.defaultGrid),
  selectedFrameIndex: 0,
  playingFrameIndex: 0,
  playback: {
    fps: DEFAULT_PRESET.defaultFps,
    speed: DEFAULT_PRESET.defaultSpeed ?? 1,
    loopMode: DEFAULT_PRESET.defaultLoopMode ?? 'loop',
    isPlaying: true,
    onionSkin: false,
    onionSkinOpacity: 0.3,
    previewBg: 'checker',
    rhythm: { ...DEFAULT_RHYTHM }
  },

  open: (presetId) => {
    // Không truyền mẫu → giữ nguyên phiên hiện tại (kể cả phiên trống), không tự nạp mẫu cũ
    if (presetId) get().loadPreset(presetId)
    set({ isOpen: true })
  },

  startBlank: () =>
    set((s) => ({
      isOpen: true,
      activePresetId: null,
      layerName: BLANK_LOOP_NAME,
      category: 'custom',
      sourceImageUrl: null,
      sourceVersion: s.sourceVersion + 1,
      slicerMode: 'grid',
      gridConfig: { ...BLANK_GRID },
      chromaKey: { ...BLANK_CHROMA },
      frames: [],
      selectedFrameIndex: 0,
      playingFrameIndex: 0,
      playback: {
        ...s.playback,
        fps: 12,
        speed: 1,
        loopMode: 'loop',
        isPlaying: true,
        onionSkin: false,
        rhythm: { ...DEFAULT_RHYTHM, rhythmMode: 'none' }
      }
    })),

  close: () => set({ isOpen: false }),

  loadPreset: (presetId) => {
    const allTemplates = getAllLoopTemplates()
    const saved = allTemplates.find((t) => t.id === presetId)
    if (saved) {
      const s = get()
      const w = s.sourceWidth || 1024
      const h = s.sourceHeight || 1024
      const nextFrames =
        saved.frames && saved.frames.length > 0
          ? saved.frames.map((f, idx) => ({ ...f, index: idx }))
          : buildGridFrames(w, h, saved.gridConfig)
      set({
        activePresetId: saved.id,
        layerName: saved.name,
        category: saved.category,
        sourceImageUrl: saved.imageUrl,
        slicerMode: saved.slicerMode || 'grid',
        gridConfig: { ...saved.gridConfig },
        contourConfig: saved.contourConfig
          ? { ...saved.contourConfig }
          : { alphaThreshold: 24, minArea: 180, mergeGap: 8 },
        chromaKey: { ...saved.chromaKey },
        frames: nextFrames,
        selectedFrameIndex: 0,
        playingFrameIndex: 0,
        playback: {
          ...s.playback,
          fps: saved.fps,
          speed: saved.speed ?? 1,
          loopMode: saved.loopMode || 'loop',
          isPlaying: true,
          rhythm: saved.rhythm
            ? { ...saved.rhythm }
            : {
                rhythmMode: 'none',
                rhythmRateHz: 2.2,
                rhythmIntensity: 0.35,
                minOpacity: 0.5,
                scaleBeatPct: 12
              }
        }
      })
      return
    }

    const preset = SAMPLE_LOOP_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET
    const s = get()
    const w = s.sourceWidth || 1024
    const h = s.sourceHeight || 1024
    set({
      activePresetId: preset.id,
      layerName: preset.name,
      category: preset.category,
      sourceImageUrl: preset.imageUrl,
      slicerMode: 'grid',
      gridConfig: { ...preset.defaultGrid },
      chromaKey: { ...preset.defaultChroma },
      frames: buildGridFrames(w, h, preset.defaultGrid),
      selectedFrameIndex: 0,
      playingFrameIndex: 0,
      playback: {
        ...s.playback,
        fps: preset.defaultFps,
        speed: preset.defaultSpeed ?? 1,
        loopMode: preset.defaultLoopMode ?? 'loop',
        isPlaying: true,
        rhythm: {
          rhythmMode: preset.defaultRhythm?.rhythmMode ?? 'none',
          rhythmRateHz: preset.defaultRhythm?.rhythmRateHz ?? 2.2,
          rhythmIntensity: preset.defaultRhythm?.rhythmIntensity ?? 0.35,
          minOpacity: preset.defaultRhythm?.minOpacity ?? 0.5,
          scaleBeatPct: preset.defaultRhythm?.scaleBeatPct ?? 12
        }
      }
    })
  },

  loadCustomImage: (dataUrl, name) => {
    const s = get()
    const cleanName = name ? name.replace(/\.[^.]+$/, '') : 'Hoạt ảnh Loop mới'
    set({
      activePresetId: `loop_custom_${Date.now().toString(36)}`,
      layerName: cleanName,
      category: 'custom',
      sourceImageUrl: dataUrl,
      slicerMode: 'grid',
      selectedFrameIndex: 0,
      playingFrameIndex: 0,
      frames: buildGridFrames(s.sourceWidth, s.sourceHeight, s.gridConfig)
    })
  },

  setSourceDimensions: (width, height) => {
    const s = get()
    const nextFrames =
      s.slicerMode === 'grid' ? buildGridFrames(width, height, s.gridConfig) : s.frames
    set({
      sourceWidth: width,
      sourceHeight: height,
      frames: nextFrames
    })
  },

  bumpSourceVersion: () => set((s) => ({ sourceVersion: s.sourceVersion + 1 })),

  setLayerName: (layerName) => set({ layerName }),
  setCategory: (category) => set({ category }),

  setSlicerMode: (slicerMode) => {
    const s = get()
    const nextFrames =
      slicerMode === 'grid'
        ? buildGridFrames(s.sourceWidth, s.sourceHeight, s.gridConfig)
        : s.frames
    set({ slicerMode, frames: nextFrames })
  },

  setGridConfig: (patch) => {
    const s = get()
    const nextGrid = { ...s.gridConfig, ...patch }
    const nextFrames = buildGridFrames(s.sourceWidth, s.sourceHeight, nextGrid)
    set({
      gridConfig: nextGrid,
      slicerMode: 'grid',
      frames: nextFrames,
      selectedFrameIndex: Math.min(s.selectedFrameIndex, Math.max(0, nextFrames.length - 1)),
      playingFrameIndex: 0
    })
  },

  setContourConfig: (patch) =>
    set((s) => ({ contourConfig: { ...s.contourConfig, ...patch } })),

  runContourSlicer: (sourceCanvas) => {
    if (!sourceCanvas) return 0
    const s = get()
    const detected = detectContourFrames(sourceCanvas, s.contourConfig)
    if (detected.length === 0) return 0
    set({
      slicerMode: 'contour',
      frames: detected,
      selectedFrameIndex: 0,
      playingFrameIndex: 0
    })
    return detected.length
  },

  autoCenterFrames: (sourceCanvas) => {
    if (!sourceCanvas) return
    const s = get()
    const centered = autoCenterLoopFrames(
      sourceCanvas,
      s.frames,
      s.contourConfig.alphaThreshold || 24,
      s.contourConfig.alignAnchor ?? 'bottom'
    )
    set({ frames: centered })
  },

  equalizeFrameSizes: () => {
    const s = get()
    if (s.frames.length === 0) return
    const maxW = Math.max(1, ...s.frames.map((f) => f.width))
    const maxH = Math.max(1, ...s.frames.map((f) => f.height))
    const anchor = s.contourConfig.alignAnchor ?? 'bottom'
    const w = s.sourceWidth || 1024
    const h = s.sourceHeight || 1024

    const equalized = s.frames.map((f) => {
      const centerX = f.x + f.width * 0.5
      const newX = Math.max(0, Math.min(w - maxW, Math.round(centerX - maxW * 0.5)))
      let newY: number
      if (anchor === 'bottom') {
        const bottomY = f.y + f.height
        newY = Math.max(0, Math.min(h - maxH, Math.round(bottomY - maxH)))
      } else {
        const centerY = f.y + f.height * 0.5
        newY = Math.max(0, Math.min(h - maxH, Math.round(centerY - maxH * 0.5)))
      }
      return {
        ...f,
        x: newX,
        y: newY,
        width: maxW,
        height: maxH
      }
    })
    set({ frames: equalized })
  },

  setChromaKey: (patch) =>
    set((s) => ({
      chromaKey: { ...s.chromaKey, ...patch }
    })),

  selectFrame: (index) =>
    set((s) => ({
      selectedFrameIndex: Math.max(0, Math.min(Math.max(0, s.frames.length - 1), index)),
      playingFrameIndex: Math.max(0, Math.min(Math.max(0, s.frames.length - 1), index))
    })),

  setPlayingFrame: (index) =>
    set((s) => {
      if (s.playingFrameIndex === index) return s
      return { playingFrameIndex: index }
    }),

  updateFrame: (index, patch) =>
    set((s) => ({
      frames: s.frames.map((f, i) => (i === index ? { ...f, ...patch } : f))
    })),

  toggleFrameEnabled: (index) =>
    set((s) => ({
      frames: s.frames.map((f, i) => (i === index ? { ...f, enabled: !f.enabled } : f))
    })),

  reorderFrame: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex < 0 || fromIndex >= s.frames.length) return s
      if (toIndex < 0 || toIndex >= s.frames.length || fromIndex === toIndex) return s
      const copy = [...s.frames]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return {
        frames: copy.map((f, idx) => ({ ...f, index: idx })),
        selectedFrameIndex: toIndex
      }
    }),

  reverseFrames: () =>
    set((s) => ({
      frames: [...s.frames].reverse().map((f, idx) => ({ ...f, index: idx }))
    })),

  duplicateFrame: (index) =>
    set((s) => {
      const target = s.frames[index]
      if (!target) return s
      const clone: LoopFrameBox = {
        ...target,
        id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      }
      const next = [...s.frames]
      next.splice(index + 1, 0, clone)
      return {
        frames: next.map((f, idx) => ({ ...f, index: idx })),
        selectedFrameIndex: index + 1
      }
    }),

  deleteFrame: (index) =>
    set((s) => {
      if (s.frames.length <= 1) return s
      const next = s.frames.filter((_, i) => i !== index).map((f, idx) => ({ ...f, index: idx }))
      return {
        frames: next,
        selectedFrameIndex: Math.min(s.selectedFrameIndex, Math.max(0, next.length - 1)),
        playingFrameIndex: 0
      }
    }),

  addManualFrame: () =>
    set((s) => {
      const size = Math.round(Math.min(s.sourceWidth, s.sourceHeight) * 0.25)
      const newFrame: LoopFrameBox = {
        id: `frame_manual_${Date.now()}`,
        index: s.frames.length,
        x: Math.round((s.sourceWidth - size) * 0.5),
        y: Math.round((s.sourceHeight - size) * 0.5),
        width: size,
        height: size,
        offsetX: 0,
        offsetY: 0,
        enabled: true,
        durationRatio: 1
      }
      return {
        slicerMode: 'manual',
        frames: [...s.frames, newFrame],
        selectedFrameIndex: s.frames.length
      }
    }),

  setPlayback: (patch) =>
    set((s) => ({
      playback: { ...s.playback, ...patch }
    })),

  setRhythm: (patch) =>
    set((s) => ({
      playback: {
        ...s.playback,
        rhythm: { ...s.playback.rhythm, ...patch }
      }
    })),

  togglePlaying: () =>
    set((s) => ({
      playback: { ...s.playback, isPlaying: !s.playback.isPlaying }
    })),

  setFps: (fps) =>
    set((s) => ({
      playback: { ...s.playback, fps: Math.max(1, Math.min(60, Math.round(fps))) }
    })),

  setSpeed: (speed) =>
    set((s) => ({
      playback: { ...s.playback, speed: Math.max(0.1, Math.min(4, Number(speed.toFixed(2)))) }
    })),

  setLoopMode: (loopMode) =>
    set((s) => ({
      playback: { ...s.playback, loopMode }
    })),

  saveCurrentToLibrary: (sourceCanvas) => {
    const s = get()
    if (!s.sourceImageUrl) return null
    const id = s.activePresetId || `loop_${Date.now().toString(36)}`
    const enabledCount = s.frames.filter((f) => f.enabled).length
    const categoryBadgeMap: Record<LoopAnimationTemplate['category'], string> = {
      fire: `🔥 Lửa ${enabledCount}F`,
      magic: `✨ Phép ${enabledCount}F`,
      nature: `🦋 Sinh vật ${enabledCount}F`,
      electric: `⚡ Điện ${enabledCount}F`,
      custom: `🎞 Loop ${enabledCount}F`
    }
    const thumbUrl = sourceCanvas
      ? extractFirstFramePreviewUrl(sourceCanvas, s.frames, 256)
      : undefined
    const renderedFrames = sourceCanvas
      ? extractAllFramesAsDataUrls(sourceCanvas, s.frames)
      : undefined
    const transparentSheetUrl = sourceCanvas
      ? sourceCanvas.toDataURL('image/png')
      : undefined

    const template: LoopAnimationTemplate = {
      id,
      name: s.layerName.trim() || 'Hoạt ảnh Loop',
      category: s.category,
      badge: categoryBadgeMap[s.category] || `🎞 Loop ${enabledCount}F`,
      description: `Hoạt ảnh lặp ${enabledCount} frame (${s.playback.fps} FPS • ${s.playback.loopMode})`,
      imageUrl: s.sourceImageUrl,
      thumbUrl,
      renderedFrames,
      transparentSheetUrl,
      slicerMode: s.slicerMode,
      gridConfig: { ...s.gridConfig },
      contourConfig: { ...s.contourConfig },
      chromaKey: { ...s.chromaKey },
      fps: s.playback.fps,
      speed: s.playback.speed,
      loopMode: s.playback.loopMode,
      rhythm: { ...s.playback.rhythm },
      frameCount: enabledCount,
      frames: s.frames.map((f) => ({ ...f }))
    }
    const saved = saveLoopTemplate(template)
    set({ activePresetId: saved.id })
    return saved
  }
}))
