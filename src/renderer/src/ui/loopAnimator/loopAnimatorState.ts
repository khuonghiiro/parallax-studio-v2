import { create } from 'zustand'
import { rescaleLoopFramesByMeshRatio } from '../../project/meshRatioSync'
import {
  autoCenterLoopFrames,
  buildGridFrames,
  detectContourFrames,
  getCachedLoopTemplateSheet
} from './loopFrameExtractor'
import {
  buildStoreSliceForGroup,
  createGroupId,
  createLoopSequenceGroup,
  reconstructSequenceGroupsFromPackage,
  repackSingleRowSheetToThreeRows,
  syncActiveGroupToGroups
} from './loopGroupManager'
import {
  applyUpdatedGroupMeta,
  BLANK_CHROMA,
  BLANK_GRID,
  BLANK_LOOP_NAME,
  buildAndSaveTemplateFromStore,
  buildGroupFromSamplePreset,
  buildGroupFromSavedTemplate,
  computeEqualizedFrames,
  computeSourceDimensionsUpdate,
  DEFAULT_PRESET,
  DEFAULT_RHYTHM,
  INITIAL_FRAMES,
  INITIAL_GROUP
} from './loopAnimatorStateHelpers'
import { canvasToBlobUrl } from './loopSourceProxy'
import { getAllLoopTemplates } from './loopAnimatorStorage'
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
  LoopSequenceGroup,
  SlicerMode
} from './types'

export { BLANK_LOOP_NAME }

export interface LoopAnimatorStore {
  isOpen: boolean
  activePresetId: string | null
  layerName: string
  category: LoopAnimationTemplate['category']
  sourceImageUrl: string | null
  sourceWidth: number
  sourceHeight: number
  /** Kích thước mặt phẳng Mesh chuẩn trong cảnh/xưởng (độc lập với độ phân giải pixel ảnh 2K/4K) */
  baseMeshWidth: number
  baseMeshHeight: number
  /** Đánh dấu đang nâng cấp ảnh nguồn 2K/4K giữ nguyên tỉ lệ Mesh */
  pendingMeshUpgrade: boolean
  sourceVersion: number
  slicerMode: SlicerMode
  gridConfig: GridSlicerConfig
  contourConfig: ContourSlicerConfig
  chromaKey: ChromaKeyConfig
  frames: LoopFrameBox[]
  selectedFrameIndex: number
  /** Chỉ số khung hình đang được người dùng focus trong BBox để dùng làm thumbnail khi lưu (null = mặc định Frame #1) */
  focusedFrameIndex: number | null
  playingFrameIndex: number
  playback: LoopPlaybackConfig

  /** Danh sách các nhóm hiệu ứng nối tiếp / kết hợp frame trong phiên làm việc */
  groups: LoopSequenceGroup[]
  /** Chỉ số nhóm hiệu ứng đang chọn để chỉnh sửa cấu hình */
  activeGroupIndex: number
  /** Bật chế độ xem trước tổ hợp toàn bộ các nhóm hiệu ứng trên sân khấu Preview */
  comboPreviewMode: boolean

  open: (presetId?: string) => void
  /** Bắt đầu phiên tách mới hoàn toàn trống (chưa có ảnh, chưa có frame) */
  startBlank: () => void
  close: () => void
  loadPreset: (presetId: string) => void
  /** Thêm nối tiếp một mẫu có sẵn trong kho thành Nhóm hiệu ứng tiếp theo */
  appendPresetAsGroup: (presetId: string) => void
  loadCustomImage: (dataUrl: string, name?: string) => void
  /**
   * Tải ảnh mới KHÔNG GHI ĐÈ:
   * - Nếu phiên đang trống -> nạp làm Nhóm 1.
   * - Nếu đã có ảnh -> lưu cấu hình nhóm hiện tại và thêm nối tiếp thành Nhóm N+1.
   */
  appendImageAsGroup: (dataUrl: string, name?: string) => void
  /** Thay thế ảnh nguồn của riêng nhóm đang chọn (giữ nguyên các nhóm khác) */
  replaceActiveGroupImage: (dataUrl: string, name?: string) => void
  /** Chọn nhóm hiệu ứng trong thanh trượt để chỉnh sửa cấu hình riêng của nhóm đó */
  selectGroup: (index: number) => void
  /** Đổi thứ tự chạy của nhóm hiệu ứng (kéo thả hoặc nút ◀ ▶ trên slider) */
  reorderGroup: (fromIndex: number, toIndex: number) => void
  /** Xoá 1 nhóm hiệu ứng khỏi chuỗi nối tiếp */
  deleteGroup: (index: number) => void
  /** Cập nhật cấu hình chuỗi chạy / thời gian chờ / kết hợp frame / vị trí lệch của nhóm đang chọn */
  updateActiveGroupMeta: (
    patch: Partial<
      Pick<
        LoopSequenceGroup,
        | 'name'
        | 'triggerMode'
        | 'triggerFrameIndex'
        | 'delaySec'
        | 'holdDurationSec'
        | 'offsetX'
        | 'offsetY'
        | 'scale'
      >
    >
  ) => void
  setComboPreviewMode: (enabled: boolean) => void
  /** Trả về danh sách các nhóm đã đồng bộ mới nhất với trạng thái đang sửa */
  getSyncedGroups: () => LoopSequenceGroup[]

  /** Nạp nhiều frame ảnh mới theo thứ tự frame đã sắp xếp */
  loadCustomMultiFrames: (payload: {
    dataUrl: string
    frames: LoopFrameBox[]
    sourceWidth: number
    sourceHeight: number
    layerName?: string
    gridConfig?: GridSlicerConfig
  }) => void
  /** Nâng cấp ảnh Sprite Sheet lên 2K/4K giữ nguyên tỉ lệ Mesh, cấu hình cắt và khớp khung hình */
  upgradeSourceImageKeepMesh: (dataUrl: string, name?: string) => void
  /** Nâng cấp nhiều frame ảnh lên 2K/4K giữ nguyên tỉ lệ Mesh */
  upgradeMultipleFramesKeepMesh: (payload: {
    dataUrl: string
    frames: LoopFrameBox[]
    sourceWidth: number
    sourceHeight: number
    baseMeshWidth: number
    baseMeshHeight: number
    layerName?: string
    gridConfig?: GridSlicerConfig
  }) => void
  /** Tinh chỉnh offsetX/offsetY theo vùng Alpha Mesh sau khi ảnh nâng cấp 2K/4K đã tách nền xong */
  alignUpgradedFramesByMesh: (sourceCanvas: HTMLCanvasElement | null) => void
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
  clearFocusedFrame: () => void
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

export const useLoopAnimator = create<LoopAnimatorStore>((rawSet, get) => {
  // Tự động đồng bộ cấu hình đang chỉnh vào `groups[activeGroupIndex]` sau mỗi lần cập nhật
  const set: typeof rawSet = (partial, replace) => {
    rawSet((state) => {
      const nextPatch = typeof partial === 'function' ? partial(state) : partial
      const merged = { ...state, ...nextPatch } as LoopAnimatorStore
      if (!merged.sourceImageUrl) {
        return { ...nextPatch, groups: [], activeGroupIndex: 0, comboPreviewMode: false }
      }
      const syncedGroups = syncActiveGroupToGroups(merged)
      return {
        ...nextPatch,
        groups: syncedGroups,
        activeGroupIndex: Math.max(
          0,
          Math.min(Math.max(0, syncedGroups.length - 1), merged.activeGroupIndex)
        )
      }
    }, replace as false)
  }

  return {
    isOpen: false,
    activePresetId: DEFAULT_PRESET.id,
    layerName: DEFAULT_PRESET.name,
    category: DEFAULT_PRESET.category,
    sourceImageUrl: DEFAULT_PRESET.imageUrl,
    sourceWidth: 1024,
    sourceHeight: 1024,
    baseMeshWidth: Math.round(1024 / DEFAULT_PRESET.defaultGrid.cols),
    baseMeshHeight: Math.round(1024 / DEFAULT_PRESET.defaultGrid.rows),
    pendingMeshUpgrade: false,
    sourceVersion: 0,
    slicerMode: 'grid',
    gridConfig: { ...DEFAULT_PRESET.defaultGrid },
    contourConfig: {
      alphaThreshold: 24,
      minArea: 48,
      mergeGap: 8,
      uniformSize: true,
      alignAnchor: 'bottom',
      readingOrder: 'row_first'
    },
    chromaKey: { ...DEFAULT_PRESET.defaultChroma },
    frames: INITIAL_FRAMES,
    selectedFrameIndex: 0,
    focusedFrameIndex: null,
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
    groups: [INITIAL_GROUP],
    activeGroupIndex: 0,
    comboPreviewMode: false,

    open: (presetId) => {
      if (presetId) get().loadPreset(presetId)
      rawSet({ isOpen: true })
    },

    startBlank: () =>
      rawSet((s) => ({
        isOpen: true,
        activePresetId: null,
        layerName: BLANK_LOOP_NAME,
        category: 'custom',
        sourceImageUrl: null,
        baseMeshWidth: 0,
        baseMeshHeight: 0,
        pendingMeshUpgrade: false,
        sourceVersion: s.sourceVersion + 1,
        slicerMode: 'grid',
        gridConfig: { ...BLANK_GRID },
        chromaKey: { ...BLANK_CHROMA },
        frames: [],
        selectedFrameIndex: 0,
        focusedFrameIndex: null,
        playingFrameIndex: 0,
        groups: [],
        activeGroupIndex: 0,
        comboPreviewMode: false,
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

    close: () => rawSet({ isOpen: false }),

    loadPreset: (presetId) => {
      const allTemplates = getAllLoopTemplates()
      const saved = allTemplates.find((t) => t.id === presetId)
      if (saved) {
        const s = get()
        if (saved.sequenceGroups && saved.sequenceGroups.length > 0) {
          const first = saved.sequenceGroups[0]
          rawSet({
            activePresetId: saved.id,
            layerName: saved.name,
            category: saved.category,
            comboPreviewMode: saved.sequenceGroups.length > 1,
            ...buildStoreSliceForGroup(first, 0, saved.sequenceGroups, s.playback, s.sourceVersion)
          })
          return
        }
        const { group: initGroup, isPkg, nextFrames } = buildGroupFromSavedTemplate(
          saved,
          s.sourceWidth,
          s.sourceHeight,
          0
        )
        rawSet({
          activePresetId: saved.id,
          layerName: saved.name,
          category: saved.category,
          comboPreviewMode: false,
          ...buildStoreSliceForGroup(initGroup, 0, [initGroup], s.playback, s.sourceVersion),
          selectedFrameIndex: saved.thumbnailFrameIndex ?? 0,
          focusedFrameIndex: saved.thumbnailFrameIndex ?? null
        })

        if (isPkg) {
          void getCachedLoopTemplateSheet(saved).then(async (sheet) => {
            if (!sheet || get().activePresetId !== saved.id) return
            const stripUrl = await canvasToBlobUrl(sheet.canvas)
            if (get().activePresetId !== saved.id) return
            const pkg = sheet.packageJson
            const cur = get()
            if (pkg) {
              const restoredGroups = reconstructSequenceGroupsFromPackage(
                stripUrl,
                sheet.canvas.width,
                sheet.canvas.height,
                sheet.frameW,
                sheet.frameH,
                sheet.frames,
                pkg
              )
              const g0 = restoredGroups[0]
              const thumbIdx = pkg.thumbnailFrameIndex ?? saved.thumbnailFrameIndex
              rawSet({
                layerName: pkg.name || cur.layerName,
                category: (pkg.category as any) || cur.category,
                comboPreviewMode: restoredGroups.length > 1,
                ...buildStoreSliceForGroup(g0, 0, restoredGroups, cur.playback, cur.sourceVersion),
                selectedFrameIndex: thumbIdx ?? 0,
                focusedFrameIndex: thumbIdx ?? null
              })
            }
          })
        } else if (
          nextFrames.length >= 3 &&
          saved.imageUrl &&
          (saved.gridConfig.rows === 1 || nextFrames.every((f) => Math.abs(f.y - nextFrames[0].y) < 2))
        ) {
          void repackSingleRowSheetToThreeRows(saved.imageUrl, nextFrames).then((repacked) => {
            if (!repacked || get().activePresetId !== saved.id) return
            set((cur) => ({
              sourceImageUrl: repacked.dataUrl,
              sourceWidth: repacked.width,
              sourceHeight: repacked.height,
              slicerMode: 'grid',
              gridConfig: {
                ...cur.gridConfig,
                cols: repacked.cols,
                rows: repacked.rows,
                marginX: 0,
                marginY: 0,
                paddingX: 0,
                paddingY: 0
              },
              frames: repacked.frames
            }))
          })
        }
        return
      }

      const preset = SAMPLE_LOOP_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET
      const s = get()
      const g0 = buildGroupFromSamplePreset(preset, s.sourceWidth, s.sourceHeight, 0)
      rawSet({
        activePresetId: preset.id,
        layerName: preset.name,
        category: preset.category,
        comboPreviewMode: false,
        ...buildStoreSliceForGroup(g0, 0, [g0], s.playback, s.sourceVersion)
      })
    },

    appendPresetAsGroup: (presetId) => {
      const s = get()
      if (!s.sourceImageUrl || s.groups.length === 0) {
        get().loadPreset(presetId)
        return
      }
      const synced = syncActiveGroupToGroups(s)
      const newIndex = synced.length
      const allTemplates = getAllLoopTemplates()
      const saved = allTemplates.find((t) => t.id === presetId)
      const newGroup = saved
        ? buildGroupFromSavedTemplate(saved, s.sourceWidth, s.sourceHeight, newIndex).group
        : buildGroupFromSamplePreset(
            SAMPLE_LOOP_PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET,
            s.sourceWidth,
            s.sourceHeight,
            newIndex
          )
      const nextGroups = [...synced, newGroup]
      rawSet({
        comboPreviewMode: true,
        ...buildStoreSliceForGroup(newGroup, newIndex, nextGroups, s.playback, s.sourceVersion)
      })
    },

    loadCustomImage: (dataUrl, name) => {
      const s = get()
      const cleanName = name ? name.replace(/\.[^.]+$/, '') : 'Hoạt ảnh Loop mới'
      const nextFrames = buildGridFrames(s.sourceWidth, s.sourceHeight, s.gridConfig)
      const g0 = createLoopSequenceGroup({
        id: createGroupId(0),
        name: `Nhóm 1: ${cleanName}`,
        sourceImageUrl: dataUrl,
        sourceWidth: s.sourceWidth || 1024,
        sourceHeight: s.sourceHeight || 1024,
        baseMeshWidth: 0,
        baseMeshHeight: 0,
        slicerMode: 'grid',
        gridConfig: { ...s.gridConfig },
        chromaKey: { ...s.chromaKey },
        frames: nextFrames,
        fps: s.playback.fps,
        speed: s.playback.speed,
        loopMode: s.playback.loopMode,
        rhythm: { ...s.playback.rhythm }
      })
      rawSet({
        activePresetId: `loop_custom_${Date.now().toString(36)}`,
        layerName: cleanName,
        category: 'custom',
        comboPreviewMode: false,
        ...buildStoreSliceForGroup(g0, 0, [g0], s.playback, s.sourceVersion)
      })
    },

    appendImageAsGroup: (dataUrl, name) => {
      const s = get()
      const cleanName = name ? name.replace(/\.[^.]+$/, '') : ''
      if (!s.sourceImageUrl) {
        get().loadCustomImage(dataUrl, name)
        return
      }
      const synced = syncActiveGroupToGroups(s)
      const newIndex = synced.length
      const prevGroup = synced[newIndex - 1]
      const prevEnabledCount = prevGroup ? prevGroup.frames.filter((f) => f.enabled).length : 4
      const newGroup = createLoopSequenceGroup({
        id: createGroupId(newIndex),
        name: cleanName ? `Nhóm ${newIndex + 1}: ${cleanName}` : `Nhóm ${newIndex + 1}`,
        sourceImageUrl: dataUrl,
        sourceWidth: 1024,
        sourceHeight: 1024,
        baseMeshWidth: 0,
        baseMeshHeight: 0,
        slicerMode: 'grid',
        gridConfig: { ...BLANK_GRID },
        chromaKey: { ...BLANK_CHROMA },
        fps: s.playback.fps || 12,
        speed: 1,
        loopMode: 'once',
        rhythm: { ...DEFAULT_RHYTHM, rhythmMode: 'none' },
        triggerMode: 'sequential',
        triggerFrameIndex: Math.max(1, Math.ceil(prevEnabledCount * 0.5)),
        delaySec: 0,
        holdDurationSec: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1
      })
      const nextGroups = [...synced, newGroup]
      const nextLayerName =
        s.layerName && s.layerName !== BLANK_LOOP_NAME
          ? s.layerName
          : cleanName || 'Tổ hợp Hoạt ảnh Loop'
      rawSet({
        activePresetId: s.activePresetId || `loop_combo_${Date.now().toString(36)}`,
        layerName: nextLayerName,
        comboPreviewMode: true,
        ...buildStoreSliceForGroup(newGroup, newIndex, nextGroups, s.playback, s.sourceVersion)
      })
    },

    replaceActiveGroupImage: (dataUrl, name) => {
      const s = get()
      if (!s.sourceImageUrl || s.groups.length === 0) {
        get().loadCustomImage(dataUrl, name)
        return
      }
      const cleanName = name ? name.replace(/\.[^.]+$/, '') : ''
      const synced = syncActiveGroupToGroups(s)
      const idx = Math.max(0, Math.min(synced.length - 1, s.activeGroupIndex))
      const curGroup = synced[idx]
      const updated: LoopSequenceGroup = {
        ...curGroup,
        name: cleanName ? `Nhóm ${idx + 1}: ${cleanName}` : curGroup.name,
        sourceImageUrl: dataUrl,
        baseMeshWidth: 0,
        baseMeshHeight: 0
      }
      const nextGroups = [...synced]
      nextGroups[idx] = updated
      rawSet({
        ...buildStoreSliceForGroup(updated, idx, nextGroups, s.playback, s.sourceVersion)
      })
    },

    selectGroup: (index) => {
      const s = get()
      const synced = syncActiveGroupToGroups(s)
      if (index < 0 || index >= synced.length) return
      const target = synced[index]
      rawSet({
        ...buildStoreSliceForGroup(target, index, synced, s.playback, s.sourceVersion)
      })
    },

    reorderGroup: (fromIndex, toIndex) => {
      const s = get()
      const synced = syncActiveGroupToGroups(s)
      if (
        fromIndex < 0 ||
        fromIndex >= synced.length ||
        toIndex < 0 ||
        toIndex >= synced.length ||
        fromIndex === toIndex
      ) {
        return
      }
      const next = [...synced]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      const activeGroup = next[toIndex]
      rawSet({
        ...buildStoreSliceForGroup(activeGroup, toIndex, next, s.playback, s.sourceVersion)
      })
    },

    deleteGroup: (index) => {
      const s = get()
      const synced = syncActiveGroupToGroups(s)
      if (index < 0 || index >= synced.length) return
      if (synced.length <= 1) {
        get().startBlank()
        return
      }
      const next = synced.filter((_, i) => i !== index)
      const nextActiveIdx = Math.max(
        0,
        Math.min(next.length - 1, s.activeGroupIndex >= index ? s.activeGroupIndex - 1 : s.activeGroupIndex)
      )
      const target = next[nextActiveIdx]
      rawSet({
        comboPreviewMode: next.length > 1 ? s.comboPreviewMode : false,
        ...buildStoreSliceForGroup(target, nextActiveIdx, next, s.playback, s.sourceVersion)
      })
    },

    updateActiveGroupMeta: (patch) => {
      const s = get()
      const synced = syncActiveGroupToGroups(s)
      if (synced.length === 0) return
      const idx = Math.max(0, Math.min(synced.length - 1, s.activeGroupIndex))
      const next = [...synced]
      next[idx] = applyUpdatedGroupMeta(synced[idx], patch)
      rawSet({ groups: next })
    },

    setComboPreviewMode: (enabled) => rawSet({ comboPreviewMode: enabled }),

    getSyncedGroups: () => syncActiveGroupToGroups(get()),

    loadCustomMultiFrames: (payload) => {
      const s = get()
      const cleanName = payload.layerName ? payload.layerName.replace(/\.[^.]+$/, '') : 'Hoạt ảnh Loop mới'
      set({
        activePresetId: s.activePresetId || `loop_custom_${Date.now().toString(36)}`,
        layerName: s.groups.length > 1 ? s.layerName : cleanName,
        category: 'custom',
        sourceImageUrl: payload.dataUrl,
        sourceWidth: payload.sourceWidth,
        sourceHeight: payload.sourceHeight,
        baseMeshWidth: 0,
        baseMeshHeight: 0,
        pendingMeshUpgrade: false,
        slicerMode: 'manual',
        gridConfig: payload.gridConfig || s.gridConfig,
        selectedFrameIndex: 0,
        playingFrameIndex: 0,
        frames: payload.frames
      })
    },

    upgradeSourceImageKeepMesh: (dataUrl, name) => {
      const s = get()
      const enabled = s.frames.filter((f) => f.enabled)
      const refList = enabled.length > 0 ? enabled : s.frames
      const maxW = refList.length > 0 ? Math.max(1, ...refList.map((f) => f.width)) : 256
      const maxH = refList.length > 0 ? Math.max(1, ...refList.map((f) => f.height)) : 256
      const cleanName =
        s.layerName && s.layerName !== BLANK_LOOP_NAME
          ? s.layerName
          : name
            ? name.replace(/\.[^.]+$/, '')
            : 'Hoạt ảnh Loop 2K/4K'
      set({
        activePresetId: s.activePresetId || `loop_custom_${Date.now().toString(36)}`,
        layerName: cleanName,
        sourceImageUrl: dataUrl,
        baseMeshWidth: s.baseMeshWidth > 0 ? s.baseMeshWidth : maxW,
        baseMeshHeight: s.baseMeshHeight > 0 ? s.baseMeshHeight : maxH,
        pendingMeshUpgrade: true
      })
    },

    upgradeMultipleFramesKeepMesh: (payload) => {
      const s = get()
      const cleanName =
        s.layerName && s.layerName !== BLANK_LOOP_NAME
          ? s.layerName
          : payload.layerName
            ? payload.layerName.replace(/\.[^.]+$/, '')
            : 'Hoạt ảnh Loop 2K/4K'
      set({
        activePresetId: s.activePresetId || `loop_custom_${Date.now().toString(36)}`,
        layerName: cleanName,
        sourceImageUrl: payload.dataUrl,
        sourceWidth: payload.sourceWidth,
        sourceHeight: payload.sourceHeight,
        baseMeshWidth: payload.baseMeshWidth,
        baseMeshHeight: payload.baseMeshHeight,
        frames: payload.frames,
        slicerMode: 'manual',
        gridConfig: payload.gridConfig || s.gridConfig,
        selectedFrameIndex: 0,
        playingFrameIndex: 0,
        pendingMeshUpgrade: true
      })
    },

    alignUpgradedFramesByMesh: (sourceCanvas) => {
      const s = get()
      if (!s.pendingMeshUpgrade) return
      if (!sourceCanvas || s.frames.length === 0) {
        set({ pendingMeshUpgrade: false })
        return
      }
      const logicalW = s.sourceWidth || sourceCanvas.width
      const logicalH = s.sourceHeight || sourceCanvas.height
      const aligned = rescaleLoopFramesByMeshRatio(
        s.frames,
        logicalW,
        logicalH,
        logicalW,
        logicalH,
        sourceCanvas,
        s.contourConfig.alignAnchor ?? 'bottom',
        s.contourConfig.alphaThreshold || 16
      )
      set({ frames: aligned, pendingMeshUpgrade: false })
    },

    setSourceDimensions: (width, height) => set(computeSourceDimensionsUpdate(get(), width, height)),

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

    equalizeFrameSizes: () => set((s) => ({ frames: computeEqualizedFrames(s) })),

    setChromaKey: (patch) =>
      set((s) => ({
        chromaKey: { ...s.chromaKey, ...patch }
      })),

    selectFrame: (index) =>
      set((s) => {
        const clamped = Math.max(0, Math.min(Math.max(0, s.frames.length - 1), index))
        return {
          selectedFrameIndex: clamped,
          focusedFrameIndex: clamped,
          playingFrameIndex: clamped
        }
      }),

    clearFocusedFrame: () => set({ focusedFrameIndex: null }),

    setPlayingFrame: (index) =>
      rawSet((s) => {
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
      rawSet((s) => ({
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
      const res = buildAndSaveTemplateFromStore(get(), sourceCanvas)
      if (!res) return null
      rawSet({ activePresetId: res.saved.id, groups: res.syncedGroups })
      return res.saved
    }
  }
})
