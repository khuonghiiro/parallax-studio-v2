import type { LoopAnimationPackageJson } from '@shared/types'
import { buildGridFrames, computeLoopSheetGrid } from './loopFrameExtractor'
import { canvasToBlobUrl } from './loopSourceProxy'
import type { LoopAnimatorStore } from './loopAnimatorState'
import type {
  ChromaKeyConfig,
  ContourSlicerConfig,
  GridSlicerConfig,
  LoopAnimationMode,
  LoopFrameBox,
  LoopPackageGroupDef,
  LoopPlaybackConfig,
  LoopRhythmConfig,
  LoopSequenceGroup,
  LoopTriggerMode,
  SlicerMode
} from './types'

export interface LoopGroupScheduleItem {
  group: LoopSequenceGroup
  groupIndex: number
  enabledFrames: LoopFrameBox[]
  /** Thời điểm bắt đầu của từng frame bật (0-based trong enabledFrames) tính từ lúc nhóm bắt đầu */
  frameStartTimes: number[]
  /** Thời lượng của từng frame bật (giây) */
  frameDurations: number[]
  /** Thời lượng 1 chu kỳ gốc của nhóm (giây) */
  cycleDuration: number
  /** Thời điểm nhóm bắt đầu xuất hiện trong tổ hợp (giây) */
  startTime: number
  /** Thời lượng nhóm duy trì hiển thị trong tổ hợp (giây) */
  activeDuration: number
  /** Thời điểm nhóm kết thúc trong tổ hợp (giây) */
  endTime: number
}

export interface LoopComboSchedule {
  items: LoopGroupScheduleItem[]
  totalDuration: number
}

export function createGroupId(index = 0): string {
  return `grp_${index + 1}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Tạo nhóm hiệu ứng mới với cấu hình độc lập */
export function createLoopSequenceGroup(params: {
  id?: string
  name: string
  sourceImageUrl: string
  sourceWidth?: number
  sourceHeight?: number
  baseMeshWidth?: number
  baseMeshHeight?: number
  slicerMode?: SlicerMode
  gridConfig?: GridSlicerConfig
  contourConfig?: ContourSlicerConfig
  chromaKey?: ChromaKeyConfig
  frames?: LoopFrameBox[]
  fps?: number
  speed?: number
  loopMode?: LoopAnimationMode
  rhythm?: LoopRhythmConfig
  triggerMode?: LoopTriggerMode
  triggerFrameIndex?: number
  delaySec?: number
  holdDurationSec?: number
  offsetX?: number
  offsetY?: number
  scale?: number
}): LoopSequenceGroup {
  const w = params.sourceWidth || 1024
  const h = params.sourceHeight || 1024
  const grid: GridSlicerConfig = params.gridConfig
    ? { ...params.gridConfig }
    : { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0, borderPadding: 0 }
  const frames =
    params.frames && params.frames.length > 0
      ? params.frames.map((f, idx) => ({ ...f, index: idx }))
      : buildGridFrames(w, h, grid)
  const enabled = frames.filter((f) => f.enabled)
  const refFrames = enabled.length > 0 ? enabled : frames
  const fW = refFrames.length > 0 ? Math.max(1, ...refFrames.map((f) => f.width)) : 256
  const fH = refFrames.length > 0 ? Math.max(1, ...refFrames.map((f) => f.height)) : 256

  return {
    id: params.id || createGroupId(0),
    name: params.name.trim() || 'Nhóm hiệu ứng',
    sourceImageUrl: params.sourceImageUrl,
    sourceWidth: w,
    sourceHeight: h,
    baseMeshWidth: params.baseMeshWidth && params.baseMeshWidth > 0 ? params.baseMeshWidth : fW,
    baseMeshHeight: params.baseMeshHeight && params.baseMeshHeight > 0 ? params.baseMeshHeight : fH,
    slicerMode: params.slicerMode || 'grid',
    gridConfig: grid,
    contourConfig: params.contourConfig
      ? { ...params.contourConfig }
      : {
          alphaThreshold: 24,
          minArea: 48,
          mergeGap: 8,
          uniformSize: true,
          alignAnchor: 'bottom',
          readingOrder: 'row_first'
        },
    chromaKey: params.chromaKey
      ? { ...params.chromaKey }
      : {
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
        },
    frames,
    selectedFrameIndex: 0,
    focusedFrameIndex: null,
    fps: params.fps ?? 12,
    speed: params.speed ?? 1,
    loopMode: params.loopMode ?? 'loop',
    rhythm: params.rhythm
      ? { ...params.rhythm }
      : {
          rhythmMode: 'none',
          rhythmRateHz: 2.2,
          rhythmIntensity: 0.35,
          minOpacity: 0.5,
          scaleBeatPct: 12
        },
    triggerMode: params.triggerMode ?? 'sequential',
    triggerFrameIndex: Math.max(1, Math.round(params.triggerFrameIndex ?? 1)),
    delaySec: Math.max(0, Number((params.delaySec ?? 0).toFixed(2))),
    holdDurationSec: Math.max(0, Number((params.holdDurationSec ?? 0).toFixed(2))),
    offsetX: Math.round(params.offsetX ?? 0),
    offsetY: Math.round(params.offsetY ?? 0),
    scale: Math.max(0.1, Math.min(5, Number((params.scale ?? 1).toFixed(2))))
  }
}

/**
 * Đồng bộ trạng thái đang chỉnh sửa trực tiếp trên Store vào phần tử `groups[activeGroupIndex]`
 * để đảm bảo mỗi nhóm giữ nguyên cấu hình riêng khi chuyển đổi, sắp xếp hoặc lưu gói.
 */
export function syncActiveGroupToGroups(state: LoopAnimatorStore): LoopSequenceGroup[] {
  if (!state.sourceImageUrl) return state.groups
  const activeIdx = Math.max(0, Math.min(Math.max(0, state.groups.length - 1), state.activeGroupIndex))
  const existing = state.groups[activeIdx]
  const groupId = existing?.id || createGroupId(activeIdx)
  const groupName = existing?.name || state.layerName || `Nhóm ${activeIdx + 1}`

  const taggedFrames = state.frames.map((f, idx) => ({
    ...f,
    index: idx,
    groupId,
    groupIndex: activeIdx,
    groupName,
    localFrameIndex: idx
  }))

  const updatedGroup: LoopSequenceGroup = {
    id: groupId,
    name: groupName,
    sourceImageUrl: state.sourceImageUrl,
    sourceWidth: state.sourceWidth,
    sourceHeight: state.sourceHeight,
    baseMeshWidth: state.baseMeshWidth,
    baseMeshHeight: state.baseMeshHeight,
    slicerMode: state.slicerMode,
    gridConfig: { ...state.gridConfig },
    contourConfig: { ...state.contourConfig },
    chromaKey: { ...state.chromaKey },
    frames: taggedFrames,
    selectedFrameIndex: state.selectedFrameIndex,
    focusedFrameIndex: state.focusedFrameIndex,
    fps: state.playback.fps,
    speed: state.playback.speed,
    loopMode: state.playback.loopMode,
    rhythm: { ...state.playback.rhythm },
    triggerMode: existing?.triggerMode ?? 'sequential',
    triggerFrameIndex: existing?.triggerFrameIndex ?? 1,
    delaySec: existing?.delaySec ?? 0,
    holdDurationSec: existing?.holdDurationSec ?? 0,
    offsetX: existing?.offsetX ?? 0,
    offsetY: existing?.offsetY ?? 0,
    scale: existing?.scale ?? 1
  }

  if (state.groups.length === 0) {
    return [updatedGroup]
  }
  const next = [...state.groups]
  next[activeIdx] = updatedGroup
  return next
}

/** Áp dụng cấu hình của 1 nhóm lên các trường làm việc chính của Store */
export function buildStoreSliceForGroup(
  group: LoopSequenceGroup,
  groupIndex: number,
  groups: LoopSequenceGroup[],
  currentPlayback: LoopPlaybackConfig,
  sourceVersion: number
): Partial<LoopAnimatorStore> {
  return {
    groups,
    activeGroupIndex: groupIndex,
    sourceImageUrl: group.sourceImageUrl,
    sourceWidth: group.sourceWidth,
    sourceHeight: group.sourceHeight,
    baseMeshWidth: group.baseMeshWidth,
    baseMeshHeight: group.baseMeshHeight,
    pendingMeshUpgrade: false,
    sourceVersion: sourceVersion + 1,
    slicerMode: group.slicerMode,
    gridConfig: { ...group.gridConfig },
    contourConfig: { ...group.contourConfig },
    chromaKey: { ...group.chromaKey },
    frames: group.frames.map((f, idx) => ({
      ...f,
      index: idx,
      groupId: group.id,
      groupIndex,
      groupName: group.name,
      localFrameIndex: idx
    })),
    selectedFrameIndex: Math.max(0, Math.min(Math.max(0, group.frames.length - 1), group.selectedFrameIndex || 0)),
    focusedFrameIndex: group.focusedFrameIndex,
    playingFrameIndex: 0,
    playback: {
      ...currentPlayback,
      fps: group.fps,
      speed: group.speed,
      loopMode: group.loopMode,
      rhythm: { ...group.rhythm }
    }
  }
}

/**
 * Tính lịch trình thời gian của chuỗi các nhóm hiệu ứng (sequential / on_frame / parallel + delaySec + holdDurationSec)
 * Dùng chung cho cả Sân khấu Xem trước Tổ hợp (Combo Preview) và Bộ xuất Layer / Node Animation Loop vào Cảnh.
 */
export function computeLoopGroupsSchedule(groups: LoopSequenceGroup[]): LoopComboSchedule {
  if (groups.length === 0) {
    return { items: [], totalDuration: 0.5 }
  }
  const items: LoopGroupScheduleItem[] = []

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const enabledFrames = g.frames.filter((f) => f.enabled)
    const effFps = Math.max(1, Math.min(60, g.fps || 12))
    const effSpeed = Math.max(0.1, g.speed || 1)
    const baseFrameDur = 1 / (effFps * effSpeed)

    const frameStartTimes: number[] = []
    const frameDurations: number[] = []
    let cycleDuration = 0
    for (let fIdx = 0; fIdx < enabledFrames.length; fIdx++) {
      frameStartTimes.push(cycleDuration)
      const d = Math.max(0.016, baseFrameDur * (enabledFrames[fIdx].durationRatio || 1))
      frameDurations.push(d)
      cycleDuration += d
    }
    if (cycleDuration <= 0.01) cycleDuration = 0.5

    let startTime = 0
    const delay = Math.max(0, g.delaySec || 0)
    if (i === 0) {
      startTime = delay
    } else {
      const prev = items[i - 1]
      if (g.triggerMode === 'parallel') {
        startTime = prev.startTime + delay
      } else if (g.triggerMode === 'on_frame') {
        const targetFrameIdx = Math.max(
          0,
          Math.min(Math.max(0, prev.frameStartTimes.length - 1), (g.triggerFrameIndex || 1) - 1)
        )
        const triggerOffset = prev.frameStartTimes[targetFrameIdx] ?? 0
        startTime = prev.startTime + triggerOffset + delay
      } else {
        // 'sequential': chạy nối tiếp sau khi nhóm trước hoàn tất + thời gian chờ delaySec
        startTime = prev.endTime + delay
      }
    }

    const activeDuration =
      g.holdDurationSec && g.holdDurationSec > 0 ? Math.max(0.05, g.holdDurationSec) : cycleDuration
    const endTime = startTime + activeDuration

    items.push({
      group: g,
      groupIndex: i,
      enabledFrames,
      frameStartTimes,
      frameDurations,
      cycleDuration,
      startTime: Number(startTime.toFixed(3)),
      activeDuration: Number(activeDuration.toFixed(3)),
      endTime: Number(endTime.toFixed(3))
    })
  }

  const totalDuration = Math.max(0.1, ...items.map((it) => it.endTime))
  return { items, totalDuration: Number(totalDuration.toFixed(3)) }
}

/**
 * Tìm chỉ số frame đang hiển thị của 1 nhóm tại thời điểm `localTime` (tính từ `item.startTime`)
 */
export function resolveGroupFrameAtLocalTime(
  item: LoopGroupScheduleItem,
  localTime: number
): LoopFrameBox | null {
  const { enabledFrames, frameStartTimes, frameDurations, cycleDuration, group } = item
  if (enabledFrames.length === 0) return null
  if (enabledFrames.length === 1 || cycleDuration <= 0.001) return enabledFrames[0]

  let tInCycle = localTime
  if (group.loopMode === 'once' && (!group.holdDurationSec || group.holdDurationSec <= 0)) {
    if (localTime >= cycleDuration) return enabledFrames[enabledFrames.length - 1]
    tInCycle = Math.max(0, localTime)
  } else if (group.loopMode === 'ping-pong') {
    const doubleCycle = cycleDuration * 2
    const mod = ((localTime % doubleCycle) + doubleCycle) % doubleCycle
    tInCycle = mod <= cycleDuration ? mod : doubleCycle - mod
  } else {
    tInCycle = ((localTime % cycleDuration) + cycleDuration) % cycleDuration
  }

  for (let i = 0; i < enabledFrames.length; i++) {
    if (tInCycle >= frameStartTimes[i] && tInCycle < frameStartTimes[i] + frameDurations[i] + 1e-4) {
      return enabledFrames[i]
    }
  }
  return enabledFrames[enabledFrames.length - 1]
}

/**
 * Xây dựng mảng `LoopPackageGroupDef[]` lưu vào `animation.json` kèm xác nhận từng frame thuộc nhóm nào
 */
export function buildPackageGroupsMetadata(groups: LoopSequenceGroup[]): {
  packageGroups: LoopPackageGroupDef[]
  flatFramesWithGroupMeta: Array<{
    frame: LoopFrameBox
    group: LoopSequenceGroup
    groupIndex: number
    localFrameIndex: number
    globalFrameIndex: number
  }>
} {
  const packageGroups: LoopPackageGroupDef[] = []
  const flatFramesWithGroupMeta: Array<{
    frame: LoopFrameBox
    group: LoopSequenceGroup
    groupIndex: number
    localFrameIndex: number
    globalFrameIndex: number
  }> = []

  let globalCursor = 0
  groups.forEach((g, gIdx) => {
    const enabled = g.frames.filter((f) => f.enabled)
    const startFrameIndex = globalCursor
    const frameIndices: number[] = []

    enabled.forEach((f, localIdx) => {
      const globalIdx = globalCursor++
      frameIndices.push(globalIdx)
      flatFramesWithGroupMeta.push({
        frame: {
          ...f,
          groupId: g.id,
          groupIndex: gIdx,
          groupName: g.name,
          localFrameIndex: localIdx
        },
        group: g,
        groupIndex: gIdx,
        localFrameIndex: localIdx,
        globalFrameIndex: globalIdx
      })
    })

    packageGroups.push({
      id: g.id,
      name: g.name,
      index: gIdx,
      frameCount: enabled.length,
      startFrameIndex,
      frameIndices,
      fps: g.fps,
      speed: g.speed,
      loopMode: g.loopMode,
      rhythm: g.rhythm ? { ...g.rhythm } : undefined,
      triggerMode: gIdx === 0 ? 'sequential' : g.triggerMode,
      triggerFrameIndex: Math.max(1, g.triggerFrameIndex || 1),
      delaySec: Math.max(0, g.delaySec || 0),
      holdDurationSec: Math.max(0, g.holdDurationSec || 0),
      offsetX: Math.round(g.offsetX || 0),
      offsetY: Math.round(g.offsetY || 0),
      scale: Number((g.scale || 1).toFixed(2)),
      sourceConfig: {
        slicerMode: g.slicerMode,
        gridConfig: g.gridConfig as unknown as Record<string, unknown>,
        chromaKey: g.chromaKey as unknown as Record<string, unknown>,
        contourConfig: g.contourConfig as unknown as Record<string, unknown>
      }
    })
  })

  return { packageGroups, flatFramesWithGroupMeta }
}

/**
 * Khôi phục danh sách nhóm hiệu ứng (`LoopSequenceGroup[]`) từ tệp `animation.json` đã lưu
 */
export function reconstructSequenceGroupsFromPackage(
  stripUrl: string,
  sheetWidth: number,
  sheetHeight: number,
  frameW: number,
  frameH: number,
  allFrames: LoopFrameBox[],
  pkg: LoopAnimationPackageJson
): LoopSequenceGroup[] {
  if (!pkg.groups || pkg.groups.length === 0) {
    const grid = computeLoopSheetGrid(allFrames.length)
    return [
      createLoopSequenceGroup({
        id: 'grp_1',
        name: pkg.name || 'Nhóm 1',
        sourceImageUrl: stripUrl,
        sourceWidth: sheetWidth,
        sourceHeight: sheetHeight,
        baseMeshWidth: pkg.baseMeshWidth || frameW,
        baseMeshHeight: pkg.baseMeshHeight || frameH,
        slicerMode: 'grid',
        gridConfig: {
          cols: grid.cols,
          rows: grid.rows,
          marginX: 0,
          marginY: 0,
          paddingX: 0,
          paddingY: 0,
          borderPadding: 0
        },
        chromaKey: {
          enabled: false,
          keyColor: '#00ff00',
          similarity: 0.28,
          smoothness: 0.1,
          spill: 0.35
        },
        frames: allFrames.map((f, idx) => ({ ...f, index: idx })),
        fps: pkg.fps || 12,
        speed: pkg.speed ?? 1,
        loopMode: pkg.loopMode || 'loop',
        rhythm: pkg.rhythm
          ? {
              rhythmMode: pkg.rhythm.rhythmMode ?? 'none',
              rhythmRateHz: pkg.rhythm.rhythmRateHz ?? 2.2,
              rhythmIntensity: pkg.rhythm.rhythmIntensity ?? 0.35,
              minOpacity: pkg.rhythm.minOpacity ?? 0.5,
              scaleBeatPct: pkg.rhythm.scaleBeatPct ?? 12
            }
          : undefined
      })
    ]
  }

  const grid = computeLoopSheetGrid(allFrames.length)
  return pkg.groups.map((gDef, gIdx) => {
    const indices =
      gDef.frameIndices && gDef.frameIndices.length > 0
        ? gDef.frameIndices
        : Array.from(
            { length: Math.max(1, gDef.frameCount || 1) },
            (_, k) => (gDef.startFrameIndex || 0) + k
          )
    const groupFrames = indices
      .map((globalIdx, localIdx) => {
        const f = allFrames[globalIdx]
        if (!f) return null
        return {
          ...f,
          index: localIdx,
          groupId: gDef.id,
          groupIndex: gIdx,
          groupName: gDef.name,
          localFrameIndex: localIdx
        }
      })
      .filter((f): f is NonNullable<typeof f> => Boolean(f))

    return createLoopSequenceGroup({
      id: gDef.id || createGroupId(gIdx),
      name: gDef.name || `Nhóm ${gIdx + 1}`,
      sourceImageUrl: stripUrl,
      sourceWidth: sheetWidth,
      sourceHeight: sheetHeight,
      baseMeshWidth: pkg.baseMeshWidth || frameW,
      baseMeshHeight: pkg.baseMeshHeight || frameH,
      slicerMode: 'manual',
      gridConfig: {
        cols: grid.cols,
        rows: grid.rows,
        marginX: 0,
        marginY: 0,
        paddingX: 0,
        paddingY: 0,
        borderPadding: 0
      },
      chromaKey: {
        enabled: false,
        keyColor: '#00ff00',
        similarity: 0.28,
        smoothness: 0.1,
        spill: 0.35
      },
      frames: groupFrames.length > 0 ? groupFrames : allFrames.map((f, idx) => ({ ...f, index: idx })),
      fps: gDef.fps || pkg.fps || 12,
      speed: gDef.speed ?? pkg.speed ?? 1,
      loopMode: gDef.loopMode || pkg.loopMode || 'loop',
      rhythm: gDef.rhythm
        ? {
            rhythmMode: gDef.rhythm.rhythmMode ?? 'none',
            rhythmRateHz: gDef.rhythm.rhythmRateHz ?? 2.2,
            rhythmIntensity: gDef.rhythm.rhythmIntensity ?? 0.35,
            minOpacity: gDef.rhythm.minOpacity ?? 0.5,
            scaleBeatPct: gDef.rhythm.scaleBeatPct ?? 12
          }
        : undefined,
      triggerMode: gDef.triggerMode || 'sequential',
      triggerFrameIndex: gDef.triggerFrameIndex || 1,
      delaySec: gDef.delaySec ?? 0,
      holdDurationSec: gDef.holdDurationSec ?? 0,
      offsetX: gDef.offsetX ?? 0,
      offsetY: gDef.offsetY ?? 0,
      scale: gDef.scale ?? 1
    })
  })
}

export async function repackSingleRowSheetToThreeRows(
  imageUrl: string,
  frames: LoopFrameBox[]
): Promise<{
  dataUrl: string
  width: number
  height: number
  cols: number
  rows: number
  frames: LoopFrameBox[]
} | null> {
  if (typeof document === 'undefined' || frames.length < 3) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const frameW = Math.max(1, ...frames.map((f) => f.width))
      const frameH = Math.max(1, ...frames.map((f) => f.height))
      const grid = computeLoopSheetGrid(frames.length)
      const canvas = document.createElement('canvas')
      canvas.width = frameW * grid.cols
      canvas.height = frameH * grid.rows
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      const nextFrames: LoopFrameBox[] = frames.map((f, idx) => {
        const col = idx % grid.cols
        const row = Math.floor(idx / grid.cols)
        const x = col * frameW
        const y = row * frameH
        const drawX = x + Math.round((frameW - f.width) * 0.5)
        const drawY = y + Math.round((frameH - f.height) * 0.5)
        ctx.drawImage(img, f.x, f.y, f.width, f.height, drawX, drawY, f.width, f.height)
        return {
          ...f,
          index: idx,
          x,
          y,
          width: frameW,
          height: frameH
        }
      })
      void canvasToBlobUrl(canvas).then((dataUrl) => {
        resolve({
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          cols: grid.cols,
          rows: grid.rows,
          frames: nextFrames
        })
      })
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}
