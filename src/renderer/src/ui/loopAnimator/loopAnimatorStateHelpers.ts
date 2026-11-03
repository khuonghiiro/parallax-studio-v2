import {
  rescaleLoopFramesByMeshRatio,
  rescaleLoopGridConfig
} from '../../project/meshRatioSync'
import {
  buildGridFrames,
  extractFirstFramePreviewUrl
} from './loopFrameExtractor'
import {
  buildPackageGroupsMetadata,
  buildStoreSliceForGroup,
  createGroupId,
  createLoopSequenceGroup,
  syncActiveGroupToGroups
} from './loopGroupManager'
import { saveLoopTemplate } from './loopAnimatorStorage'
import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import type {
  ChromaKeyConfig,
  GridSlicerConfig,
  LoopAnimationTemplate,
  LoopFrameBox,
  LoopRhythmConfig,
  LoopSequenceGroup
} from './types'
import type { LoopAnimatorStore } from './loopAnimatorState'

export const DEFAULT_PRESET = SAMPLE_LOOP_PRESETS[0]
export const BLANK_LOOP_NAME = 'Hoạt ảnh Loop mới'

export const BLANK_GRID: GridSlicerConfig = {
  cols: 4,
  rows: 4,
  marginX: 0,
  marginY: 0,
  paddingX: 0,
  paddingY: 0,
  borderPadding: 0
}

export const BLANK_CHROMA: ChromaKeyConfig = {
  enabled: false,
  keyColor: '#00ff00',
  similarity: 0.28,
  smoothness: 0.1,
  spill: 0.35,
  isolationMode: 'all',
  shadowMode: 'off',
  shadowType: 'auto',
  shadowRetention: 68,
  shadowSolidThreshold: 62,
  shadowUnmixColor: true
}

export const DEFAULT_RHYTHM: LoopRhythmConfig = {
  rhythmMode: DEFAULT_PRESET.defaultRhythm?.rhythmMode ?? 'flicker_opacity',
  rhythmRateHz: DEFAULT_PRESET.defaultRhythm?.rhythmRateHz ?? 3.2,
  rhythmIntensity: DEFAULT_PRESET.defaultRhythm?.rhythmIntensity ?? 0.25,
  minOpacity: DEFAULT_PRESET.defaultRhythm?.minOpacity ?? 0.72,
  scaleBeatPct: DEFAULT_PRESET.defaultRhythm?.scaleBeatPct ?? 8
}

export const INITIAL_FRAMES = buildGridFrames(1024, 1024, DEFAULT_PRESET.defaultGrid)

export const INITIAL_GROUP = createLoopSequenceGroup({
  id: 'grp_1_init',
  name: DEFAULT_PRESET.name,
  sourceImageUrl: DEFAULT_PRESET.imageUrl,
  sourceWidth: 1024,
  sourceHeight: 1024,
  baseMeshWidth: Math.round(1024 / DEFAULT_PRESET.defaultGrid.cols),
  baseMeshHeight: Math.round(1024 / DEFAULT_PRESET.defaultGrid.rows),
  slicerMode: 'grid',
  gridConfig: { ...DEFAULT_PRESET.defaultGrid },
  chromaKey: { ...DEFAULT_PRESET.defaultChroma },
  frames: INITIAL_FRAMES,
  fps: DEFAULT_PRESET.defaultFps,
  speed: DEFAULT_PRESET.defaultSpeed ?? 1,
  loopMode: DEFAULT_PRESET.defaultLoopMode ?? 'loop',
  rhythm: { ...DEFAULT_RHYTHM }
})

export function isLoopTemplatePackage(saved: LoopAnimationTemplate): boolean {
  return Boolean(
    saved.loopJsonPath ||
      saved.packageFolder ||
      /loop_animations\/[^/]+/.test(saved.imageUrl || '')
  )
}

export function buildGroupFromSavedTemplate(
  saved: LoopAnimationTemplate,
  fallbackW: number,
  fallbackH: number,
  groupIndex = 0
): { group: LoopSequenceGroup; isPkg: boolean; nextFrames: LoopFrameBox[] } {
  const w = saved.sourceWidth || fallbackW || 1024
  const h = saved.sourceHeight || fallbackH || 1024
  const isPkg = isLoopTemplatePackage(saved)
  const nextFrames =
    saved.frames && saved.frames.length > 0
      ? saved.frames.map((f, idx) => ({ ...f, index: idx }))
      : buildGridFrames(w, h, saved.gridConfig)
  const fW = Math.max(1, ...nextFrames.map((f) => f.width), 256)
  const fH = Math.max(1, ...nextFrames.map((f) => f.height), 256)
  const group = createLoopSequenceGroup({
    id: createGroupId(groupIndex),
    name: groupIndex > 0 ? `Nhóm ${groupIndex + 1}: ${saved.name}` : saved.name,
    sourceImageUrl: saved.imageUrl,
    sourceWidth: w,
    sourceHeight: h,
    baseMeshWidth: saved.baseMeshWidth || fW,
    baseMeshHeight: saved.baseMeshHeight || fH,
    slicerMode: isPkg ? 'grid' : saved.slicerMode || 'grid',
    gridConfig: { ...saved.gridConfig },
    contourConfig: saved.contourConfig,
    chromaKey: isPkg ? { ...saved.chromaKey, enabled: false } : { ...saved.chromaKey },
    frames: nextFrames,
    fps: saved.fps,
    speed: saved.speed ?? 1,
    loopMode: groupIndex > 0 ? 'once' : saved.loopMode || 'loop',
    rhythm: saved.rhythm
  })
  return { group, isPkg, nextFrames }
}

export function buildGroupFromSamplePreset(
  preset: (typeof SAMPLE_LOOP_PRESETS)[number],
  fallbackW: number,
  fallbackH: number,
  groupIndex = 0
): LoopSequenceGroup {
  const w = fallbackW || 1024
  const h = fallbackH || 1024
  const nextFrames = buildGridFrames(w, h, preset.defaultGrid)
  return createLoopSequenceGroup({
    id: createGroupId(groupIndex),
    name: groupIndex > 0 ? `Nhóm ${groupIndex + 1}: ${preset.name}` : preset.name,
    sourceImageUrl: preset.imageUrl,
    sourceWidth: w,
    sourceHeight: h,
    baseMeshWidth: nextFrames[0]?.width || 256,
    baseMeshHeight: nextFrames[0]?.height || 256,
    slicerMode: 'grid',
    gridConfig: { ...preset.defaultGrid },
    chromaKey: { ...preset.defaultChroma },
    frames: nextFrames,
    fps: preset.defaultFps,
    speed: preset.defaultSpeed ?? 1,
    loopMode: groupIndex > 0 ? 'once' : preset.defaultLoopMode ?? 'loop',
    rhythm: {
      rhythmMode: preset.defaultRhythm?.rhythmMode ?? 'none',
      rhythmRateHz: preset.defaultRhythm?.rhythmRateHz ?? 2.2,
      rhythmIntensity: preset.defaultRhythm?.rhythmIntensity ?? 0.35,
      minOpacity: preset.defaultRhythm?.minOpacity ?? 0.5,
      scaleBeatPct: preset.defaultRhythm?.scaleBeatPct ?? 12
    }
  })
}

export function applyUpdatedGroupMeta(
  cur: LoopSequenceGroup,
  patch: Partial<LoopSequenceGroup>
): LoopSequenceGroup {
  return {
    ...cur,
    ...patch,
    triggerFrameIndex:
      patch.triggerFrameIndex !== undefined
        ? Math.max(1, Math.round(patch.triggerFrameIndex))
        : cur.triggerFrameIndex,
    delaySec:
      patch.delaySec !== undefined
        ? Math.max(0, Number(patch.delaySec.toFixed(2)))
        : cur.delaySec,
    holdDurationSec:
      patch.holdDurationSec !== undefined
        ? Math.max(0, Number(patch.holdDurationSec.toFixed(2)))
        : cur.holdDurationSec,
    offsetX: patch.offsetX !== undefined ? Math.round(patch.offsetX) : cur.offsetX,
    offsetY: patch.offsetY !== undefined ? Math.round(patch.offsetY) : cur.offsetY,
    scale:
      patch.scale !== undefined
        ? Math.max(0.1, Math.min(5, Number(patch.scale.toFixed(2))))
        : cur.scale,
    syncChromaKey:
      patch.syncChromaKey !== undefined ? Boolean(patch.syncChromaKey) : cur.syncChromaKey ?? true
  }
}

export function computeSyncedChromaGroups(
  s: LoopAnimatorStore,
  patch: Partial<ChromaKeyConfig>
): { nextChroma: ChromaKeyConfig; nextGroups: LoopSequenceGroup[] } {
  const nextChroma = { ...s.chromaKey, ...patch }
  const synced = syncActiveGroupToGroups({ ...s, chromaKey: nextChroma })
  const activeIdx = Math.max(0, Math.min(Math.max(0, synced.length - 1), s.activeGroupIndex))
  const activeIsSynced = synced[activeIdx]?.syncChromaKey !== false
  const nextGroups =
    s.syncChromaAll && activeIsSynced
      ? synced.map((g, idx) =>
          idx === activeIdx || g.syncChromaKey === false
            ? g
            : { ...g, chromaKey: { ...g.chromaKey, ...patch } }
        )
      : synced
  return { nextChroma, nextGroups }
}

export function computeToggleGroupSyncChroma(
  s: LoopAnimatorStore,
  groupIndex: number,
  enabled?: boolean
): { nextGroups: LoopSequenceGroup[]; adoptActive: boolean } | null {
  const synced = syncActiveGroupToGroups(s)
  if (groupIndex < 0 || groupIndex >= synced.length) return null
  const cur = synced[groupIndex]
  const nextSync = enabled !== undefined ? enabled : !(cur.syncChromaKey !== false)
  const activeIdx = Math.max(0, Math.min(synced.length - 1, s.activeGroupIndex))
  const activeGroup = synced[activeIdx]
  const adoptActive =
    nextSync && s.syncChromaAll && groupIndex !== activeIdx && activeGroup?.syncChromaKey !== false
  const updated: LoopSequenceGroup = {
    ...cur,
    syncChromaKey: nextSync,
    ...(adoptActive ? { chromaKey: { ...s.chromaKey } } : {})
  }
  const nextGroups = [...synced]
  nextGroups[groupIndex] = updated
  return { nextGroups, adoptActive }
}

export function computeSourceDimensionsUpdate(
  s: LoopAnimatorStore,
  width: number,
  height: number
): Partial<LoopAnimatorStore> {
  const oldW = s.sourceWidth || width
  const oldH = s.sourceHeight || height
  const changed = (oldW !== width || oldH !== height) && oldW > 0 && oldH > 0
  const nextGrid = changed
    ? rescaleLoopGridConfig(s.gridConfig, oldW, oldH, width, height)
    : s.gridConfig

  let nextFrames: LoopFrameBox[]
  if (!changed && s.frames.length > 0) {
    nextFrames = s.frames
  } else if (s.slicerMode === 'grid') {
    const freshGridFrames = buildGridFrames(width, height, nextGrid)
    if (s.frames.length > 0 && s.frames.length <= freshGridFrames.length && changed) {
      const sx = width / oldW
      const sy = height / oldH
      nextFrames = freshGridFrames.slice(0, s.frames.length).map((gf, idx) => {
        const prev = s.frames[idx]
        return prev
          ? {
              ...gf,
              enabled: prev.enabled,
              durationRatio: prev.durationRatio,
              offsetX: Math.round((prev.offsetX || 0) * sx),
              offsetY: Math.round((prev.offsetY || 0) * sy)
            }
          : gf
      })
    } else {
      nextFrames = freshGridFrames
    }
  } else if (changed && s.frames.length > 0) {
    nextFrames = rescaleLoopFramesByMeshRatio(s.frames, oldW, oldH, width, height)
  } else {
    nextFrames = s.frames
  }

  const enabled = nextFrames.filter((f) => f.enabled)
  const refList = enabled.length > 0 ? enabled : nextFrames
  const fW = refList.length > 0 ? Math.max(1, ...refList.map((f) => f.width)) : 256
  const fH = refList.length > 0 ? Math.max(1, ...refList.map((f) => f.height)) : 256

  return {
    sourceWidth: width,
    sourceHeight: height,
    gridConfig: nextGrid,
    frames: nextFrames,
    baseMeshWidth: s.baseMeshWidth > 0 ? s.baseMeshWidth : fW,
    baseMeshHeight: s.baseMeshHeight > 0 ? s.baseMeshHeight : fH
  }
}

export function computeEqualizedFrames(s: LoopAnimatorStore): LoopFrameBox[] {
  if (s.frames.length === 0) return s.frames
  const maxW = Math.max(1, ...s.frames.map((f) => f.width))
  const maxH = Math.max(1, ...s.frames.map((f) => f.height))
  const anchor = s.contourConfig.alignAnchor ?? 'bottom'
  const w = s.sourceWidth || 1024
  const h = s.sourceHeight || 1024

  return s.frames.map((f) => {
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
}

export function buildAndSaveTemplateFromStore(
  s: LoopAnimatorStore,
  sourceCanvas?: HTMLCanvasElement | null
): { saved: LoopAnimationTemplate; syncedGroups: LoopSequenceGroup[] } | null {
  if (!s.sourceImageUrl) return null
  const syncedGroups = syncActiveGroupToGroups(s)
  const { packageGroups, flatFramesWithGroupMeta } = buildPackageGroupsMetadata(syncedGroups)
  const id = s.activePresetId || `loop_${Date.now().toString(36)}`
  const enabledCount = flatFramesWithGroupMeta.length || s.frames.filter((f) => f.enabled).length
  const categoryBadgeMap: Record<LoopAnimationTemplate['category'], string> = {
    fire: `🔥 Lửa ${enabledCount}F`,
    magic: `✨ Phép ${enabledCount}F`,
    nature: `🦋 Sinh vật ${enabledCount}F`,
    electric: `⚡ Điện ${enabledCount}F`,
    custom: `🎞 Loop ${enabledCount}F`
  }
  const thumbIdx = s.focusedFrameIndex ?? 0
  const thumbUrl = sourceCanvas
    ? extractFirstFramePreviewUrl(sourceCanvas, s.frames, 256, thumbIdx)
    : undefined
  const enabledFrames = s.frames.filter((f) => f.enabled)
  const refFrames = enabledFrames.length > 0 ? enabledFrames : s.frames
  const maxFrameW = refFrames.length > 0 ? Math.max(1, ...refFrames.map((f) => f.width)) : 256
  const maxFrameH = refFrames.length > 0 ? Math.max(1, ...refFrames.map((f) => f.height)) : 256
  const template: LoopAnimationTemplate = {
    id,
    name: s.layerName.trim() || 'Hoạt ảnh Loop',
    category: s.category,
    badge:
      syncedGroups.length > 1
        ? `${categoryBadgeMap[s.category] || `🎞 Loop ${enabledCount}F`} · ${syncedGroups.length} nhóm`
        : categoryBadgeMap[s.category] || `🎞 Loop ${enabledCount}F`,
    description:
      syncedGroups.length > 1
        ? `Tổ hợp ${syncedGroups.length} nhóm hiệu ứng (${enabledCount} frame • ${s.playback.fps} FPS)`
        : `Hoạt ảnh lặp ${enabledCount} frame (${s.playback.fps} FPS • ${s.playback.loopMode})`,
    imageUrl: s.sourceImageUrl,
    thumbUrl,
    thumbnailFrameIndex: thumbIdx,
    slicerMode: s.slicerMode,
    gridConfig: { ...s.gridConfig },
    contourConfig: { ...s.contourConfig },
    chromaKey: { ...s.chromaKey },
    fps: s.playback.fps,
    speed: s.playback.speed,
    loopMode: s.playback.loopMode,
    rhythm: { ...s.playback.rhythm },
    frameCount: enabledCount,
    sourceWidth: s.sourceWidth || undefined,
    sourceHeight: s.sourceHeight || undefined,
    baseMeshWidth: s.baseMeshWidth > 0 ? s.baseMeshWidth : maxFrameW,
    baseMeshHeight: s.baseMeshHeight > 0 ? s.baseMeshHeight : maxFrameH,
    frames: s.frames.map((f) => ({ ...f })),
    groups: packageGroups,
    sequenceGroups: syncedGroups
  }
  const saved = saveLoopTemplate(template)
  return { saved, syncedGroups }
}

export function computeCustomMultiFramesState(
  s: LoopAnimatorStore,
  payload: {
    dataUrl: string
    frames: LoopFrameBox[]
    sourceWidth: number
    sourceHeight: number
    layerName?: string
    gridConfig?: GridSlicerConfig
    resetGroups?: boolean
  }
): Partial<LoopAnimatorStore> {
  const cleanName = payload.layerName ? payload.layerName.replace(/\.[^.]+$/, '') : 'Hoạt ảnh Loop mới'
  if (payload.resetGroups) {
    const g0 = createLoopSequenceGroup({
      id: createGroupId(0),
      name: `Nhóm 1: ${cleanName}`,
      sourceImageUrl: payload.dataUrl,
      sourceWidth: payload.sourceWidth,
      sourceHeight: payload.sourceHeight,
      baseMeshWidth: 0,
      baseMeshHeight: 0,
      slicerMode: 'manual',
      gridConfig: payload.gridConfig || s.gridConfig,
      chromaKey: { ...s.chromaKey },
      frames: payload.frames,
      fps: s.playback.fps,
      speed: s.playback.speed,
      loopMode: s.playback.loopMode,
      rhythm: { ...s.playback.rhythm }
    })
    return {
      activePresetId: `loop_custom_${Date.now().toString(36)}`,
      layerName: cleanName,
      category: 'custom',
      comboPreviewMode: false,
      ...buildStoreSliceForGroup(g0, 0, [g0], s.playback, s.sourceVersion)
    }
  }

  const synced = syncActiveGroupToGroups(s)
  const idx = Math.max(0, Math.min(synced.length - 1, s.activeGroupIndex))
  if (synced[idx]) {
    synced[idx] = {
      ...synced[idx],
      sourceImageUrl: payload.dataUrl,
      sourceWidth: payload.sourceWidth,
      sourceHeight: payload.sourceHeight,
      slicerMode: 'manual',
      gridConfig: payload.gridConfig || s.gridConfig,
      frames: payload.frames,
      baseMeshWidth: 0,
      baseMeshHeight: 0
    }
  }
  return {
    activePresetId: s.activePresetId || `loop_custom_${Date.now().toString(36)}`,
    layerName: s.groups.length > 1 ? s.layerName : cleanName,
    category: 'custom',
    groups: synced,
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
  }
}

