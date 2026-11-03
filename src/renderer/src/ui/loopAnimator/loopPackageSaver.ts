import { toUnaccentedSnakeCase } from '../../../../shared/slugify'
import type {
  LoopAnimationMode,
  LoopAnimationPackageJson,
  LoopColorConfig
} from '../../../../shared/types'
import {
  applyChromaKeyToImageData,
  clearGridBorderPadding,
  computeLoopSheetGrid,
  extractFrameCanvas,
  primeCachedLoopTemplateSheet
} from './loopFrameExtractor'
import { buildPackageGroupsMetadata, createLoopSequenceGroup } from './loopGroupManager'
import { invalidateLoopPackageCache } from './loopPackageLoader'
import {
  MAX_LOOP_SOURCE_WORK_DIM,
  getRegisteredMemoryCanvas,
  scaleGridConfigForWorkCanvas,
  setLoopSourceCanvasMeta
} from './loopSourceProxy'
import { saveLoopTemplate } from './loopAnimatorStorage'
import { resolveLoopAssetUrl } from './sampleLoops'
import type {
  ContourSlicerConfig,
  GridSlicerConfig,
  ChromaKeyConfig,
  LoopAnimationTemplate,
  LoopCategorySlug,
  LoopFrameBox,
  LoopRhythmConfig,
  LoopSequenceGroup,
  SlicerMode
} from './types'

export interface SaveLoopProgressInfo {
  current: number
  total: number
  phase: 'extract' | 'write' | 'sync'
  message: string
}

export interface SaveLoopPackageOptions {
  name: string
  sourceCanvas: HTMLCanvasElement
  frames: LoopFrameBox[]
  fps: number
  speed?: number
  loopMode?: LoopAnimationMode
  category?: LoopCategorySlug
  rhythm?: LoopRhythmConfig
  colorConfig?: LoopColorConfig
  baseMeshWidth?: number
  baseMeshHeight?: number
  /** Chỉ số khung hình (0-based) đang focus trong BBox để dùng làm thumbnail (mặc định 0 = Frame #1) */
  thumbnailFrameIndex?: number
  sourceConfig?: {
    slicerMode?: SlicerMode
    gridConfig?: GridSlicerConfig
    chromaKey?: ChromaKeyConfig
    contourConfig?: ContourSlicerConfig
  }
  /** Danh sách các nhóm hiệu ứng nối tiếp / kết hợp frame trong phiên */
  sequenceGroups?: LoopSequenceGroup[]
  /** Chỉ số nhóm đang hiển thị trên sourceCanvas */
  activeGroupIndex?: number
  onProgress?: (info: SaveLoopProgressInfo) => void
}

export interface SaveLoopPackageOutput {
  ok: boolean
  slug: string
  folderPath?: string
  jsonRelPath: string
  thumbnailRelPath: string
  packageJson: LoopAnimationPackageJson
  template: LoopAnimationTemplate
  frameCanvases: HTMLCanvasElement[]
  /** Các canvas đã tách riêng cho từng nhóm hiệu ứng để chèn đa nhóm vào cảnh không cần cắt lại */
  groupFrameCanvases?: HTMLCanvasElement[][]
  stripCanvas: HTMLCanvasElement
  error?: string
}

/** Chuyển Canvas 2D thành mảng byte Uint8Array của định dạng PNG */
export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        const dataUrl = canvas.toDataURL('image/png')
        const bin = atob(dataUrl.split(',')[1] || '')
        const u8 = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        resolve(u8)
        return
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(() => {
          const dataUrl = canvas.toDataURL('image/png')
          const bin = atob(dataUrl.split(',')[1] || '')
          const u8 = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
          resolve(u8)
        })
    }, 'image/png')
  })
}

async function buildProcessedGroupSourceCanvas(group: LoopSequenceGroup): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null
  const mem = getRegisteredMemoryCanvas(group.sourceImageUrl)
  const resolvedUrl = mem ? null : (await resolveLoopAssetUrl(group.sourceImageUrl)) || group.sourceImageUrl
  const srcEl: HTMLImageElement | HTMLCanvasElement | null = mem
    ? mem
    : await new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = resolvedUrl || group.sourceImageUrl
      })
  if (!srcEl) return null

  const logicalW =
    'naturalWidth' in srcEl ? srcEl.naturalWidth || srcEl.width || group.sourceWidth || 1024 : srcEl.width || 1024
  const logicalH =
    'naturalHeight' in srcEl ? srcEl.naturalHeight || srcEl.height || group.sourceHeight || 1024 : srcEl.height || 1024
  const workScale = Math.min(1, MAX_LOOP_SOURCE_WORK_DIM / Math.max(1, logicalW, logicalH))
  const workW = Math.max(1, Math.round(logicalW * workScale))
  const workH = Math.max(1, Math.round(logicalH * workScale))
  const canvas = document.createElement('canvas')
  canvas.width = workW
  canvas.height = workH
  setLoopSourceCanvasMeta(canvas, {
    logicalWidth: logicalW,
    logicalHeight: logicalH,
    workScaleX: workW / Math.max(1, logicalW),
    workScaleY: workH / Math.max(1, logicalH),
    rawImage: srcEl,
    chromaKey: group.chromaKey,
    gridConfig: group.gridConfig
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(srcEl, 0, 0, workW, workH)
  const pad = group.gridConfig.borderPadding ?? 0
  if (pad > 0 || group.chromaKey.enabled) {
    const imgData = ctx.getImageData(0, 0, workW, workH)
    if (pad > 0) {
      clearGridBorderPadding(imgData, scaleGridConfigForWorkCanvas(group.gridConfig, workScale, workScale))
    }
    if (group.chromaKey.enabled) {
      applyChromaKeyToImageData(imgData, group.chromaKey)
    }
    ctx.putImageData(imgData, 0, 0)
  }
  return canvas
}

/**
 * Tách và lưu hoạt ảnh lặp thành một gói thư mục không dấu `assets/loop_animations/<slug>/`
 * chứa danh sách các tệp frame ảnh PNG đã tách nền sẵn, thumbnail.png và animation.json
 * (bao gồm thông tin xác nhận từng frame thuộc nhóm nào và danh sách cấu hình `groups`).
 */
export async function saveLoopAnimationAsPackage(
  options: SaveLoopPackageOptions
): Promise<SaveLoopPackageOutput> {
  const {
    name,
    sourceCanvas,
    frames,
    fps,
    speed = 1,
    loopMode = 'loop',
    category = 'custom',
    rhythm,
    colorConfig,
    baseMeshWidth,
    baseMeshHeight,
    thumbnailFrameIndex,
    sourceConfig,
    sequenceGroups,
    activeGroupIndex = 0,
    onProgress
  } = options

  const effectiveGroups: LoopSequenceGroup[] =
    sequenceGroups && sequenceGroups.length > 0
      ? sequenceGroups
      : [
          createLoopSequenceGroup({
            id: 'grp_1',
            name: name.trim() || 'Nhóm 1',
            sourceImageUrl: '',
            sourceWidth: sourceCanvas.width || 1024,
            sourceHeight: sourceCanvas.height || 1024,
            baseMeshWidth,
            baseMeshHeight,
            slicerMode: sourceConfig?.slicerMode,
            gridConfig: sourceConfig?.gridConfig,
            contourConfig: sourceConfig?.contourConfig,
            chromaKey: sourceConfig?.chromaKey,
            frames,
            fps,
            speed,
            loopMode,
            rhythm
          })
        ]

  const { packageGroups, flatFramesWithGroupMeta } = buildPackageGroupsMetadata(effectiveGroups)
  if (flatFramesWithGroupMeta.length === 0) {
    throw new Error('Cần ít nhất 1 khung hình (frame) được bật để lưu gói hoạt ảnh.')
  }

  const rawName = name.trim() || 'Hoạt ảnh Loop'
  const slug = toUnaccentedSnakeCase(rawName, 'loop_anim')
  const maxW = Math.max(1, ...flatFramesWithGroupMeta.map((item) => item.frame.width))
  const maxH = Math.max(1, ...flatFramesWithGroupMeta.map((item) => item.frame.height))
  const totalFrames = flatFramesWithGroupMeta.length

  // Giải mã trước Canvas nguồn đã tách nền cho từng nhóm
  const groupSourceCanvases: HTMLCanvasElement[] = []
  for (let gIdx = 0; gIdx < effectiveGroups.length; gIdx++) {
    if (gIdx === activeGroupIndex || effectiveGroups.length === 1) {
      groupSourceCanvases.push(sourceCanvas)
    } else {
      const built = await buildProcessedGroupSourceCanvas(effectiveGroups[gIdx])
      groupSourceCanvases.push(built || sourceCanvas)
    }
  }

  // 1. Trích xuất canvas và chuyển thành PNG bytes cho từng frame kèm báo cáo tiến trình
  const frameCanvases: HTMLCanvasElement[] = []
  const groupFrameCanvases: HTMLCanvasElement[][] = effectiveGroups.map(() => [])
  const framePayloads: Array<{ fileName: string; data: Uint8Array }> = []

  const grid = computeLoopSheetGrid(totalFrames)
  const stripScale = Math.min(
    1,
    3072 / Math.max(1, maxW * grid.cols),
    3072 / Math.max(1, maxH * grid.rows)
  )
  const stripCellW = Math.max(1, Math.round(maxW * stripScale))
  const stripCellH = Math.max(1, Math.round(maxH * stripScale))
  const stripCanvas = document.createElement('canvas')
  stripCanvas.width = stripCellW * grid.cols
  stripCanvas.height = stripCellH * grid.rows
  const stripCtx = stripCanvas.getContext('2d')
  const stripFrames: LoopFrameBox[] = []

  let totalDuration = 0
  for (let i = 0; i < totalFrames; i++) {
    const entry = flatFramesWithGroupMeta[i]
    const fMeta = entry.frame
    const gMeta = entry.group
    const gSrcCanvas = groupSourceCanvases[entry.groupIndex] || sourceCanvas
    const fileName = `frame_${String(i).padStart(3, '0')}.png`
    onProgress?.({
      current: i + 1,
      total: totalFrames,
      phase: 'extract',
      message: `Đang xử lý & đóng gói ${i + 1}/${totalFrames} frame (${gMeta.name} · ${fileName})…`
    })
    if (i % 2 === 1) {
      await new Promise((r) => setTimeout(r, 0))
    }

    const fc = extractFrameCanvas(gSrcCanvas, fMeta, maxW, maxH)
    frameCanvases.push(fc)
    groupFrameCanvases[entry.groupIndex]?.push(fc)

    const col = i % grid.cols
    const row = Math.floor(i / grid.cols)
    const cellX = col * stripCellW
    const cellY = row * stripCellH
    if (stripCtx) {
      stripCtx.drawImage(fc, 0, 0, fc.width, fc.height, cellX, cellY, stripCellW, stripCellH)
    }
    stripFrames.push({
      id: `frame_${i}`,
      index: i,
      x: cellX,
      y: cellY,
      width: stripCellW,
      height: stripCellH,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: fMeta.durationRatio ?? 1,
      groupId: gMeta.id,
      groupIndex: entry.groupIndex,
      groupName: gMeta.name,
      localFrameIndex: entry.localFrameIndex
    })

    const pngBytes = await canvasToPngBytes(fc)
    framePayloads.push({ fileName, data: pngBytes })
    const groupBaseFrameDur = 1 / Math.max(1, Math.min(60, gMeta.fps || fps))
    totalDuration += Math.max(0.016, groupBaseFrameDur * (fMeta.durationRatio || 1))
  }

  // 2. Thumbnail gọn nhẹ từ frame đang được focus trong BBox (hoặc mặc định Frame #1 = index 0)
  const resolvedThumbIdx =
    typeof thumbnailFrameIndex === 'number' &&
    thumbnailFrameIndex >= 0 &&
    thumbnailFrameIndex < frameCanvases.length
      ? thumbnailFrameIndex
      : 0
  const firstCanvas = frameCanvases[resolvedThumbIdx] || frameCanvases[0]
  const thumbScale = Math.min(1, 256 / Math.max(1, firstCanvas.width, firstCanvas.height))
  let thumbCanvas = firstCanvas
  if (thumbScale < 0.99) {
    thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = Math.max(1, Math.round(firstCanvas.width * thumbScale))
    thumbCanvas.height = Math.max(1, Math.round(firstCanvas.height * thumbScale))
    const tctx = thumbCanvas.getContext('2d')
    if (tctx) tctx.drawImage(firstCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
  }
  const thumbBytes = await canvasToPngBytes(thumbCanvas)
  const thumbDataUrl = thumbCanvas.toDataURL('image/png')

  // 3. Xây dựng cấu trúc animation.json (kèm danh sách groups và xác nhận nhóm của từng frame)
  onProgress?.({
    current: totalFrames,
    total: totalFrames,
    phase: 'write',
    message: `Đang lưu cấu hình animation.json vào loop_animations/${slug}/…`
  })
  await new Promise((r) => setTimeout(r, 0))

  const packageJson: LoopAnimationPackageJson = {
    version: '1.0',
    id: slug,
    name: rawName,
    slug,
    category,
    fps,
    speed,
    loopMode,
    frameCount: totalFrames,
    width: maxW,
    height: maxH,
    baseMeshWidth: baseMeshWidth && baseMeshWidth > 0 ? baseMeshWidth : maxW,
    baseMeshHeight: baseMeshHeight && baseMeshHeight > 0 ? baseMeshHeight : maxH,
    duration: Math.max(0.05, totalDuration),
    thumbnail: 'thumbnail.png',
    thumbnailFrameIndex: resolvedThumbIdx,
    colorConfig: colorConfig || {
      tintColor: null,
      tintIntensity: 0,
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      hueRotate: 0,
      blendMode: 'normal',
      opacity: 1.0
    },
    rhythm: rhythm
      ? {
          rhythmMode: rhythm.rhythmMode,
          rhythmRateHz: rhythm.rhythmRateHz,
          rhythmIntensity: rhythm.rhythmIntensity,
          minOpacity: rhythm.minOpacity,
          scaleBeatPct: rhythm.scaleBeatPct
        }
      : undefined,
    frames: flatFramesWithGroupMeta.map((entry, idx) => ({
      index: idx,
      file: `frame_${String(idx).padStart(3, '0')}.png`,
      durationRatio: entry.frame.durationRatio ?? 1,
      offsetX: entry.group.offsetX || 0,
      offsetY: entry.group.offsetY || 0,
      groupId: entry.group.id,
      groupIndex: entry.groupIndex,
      groupName: entry.group.name,
      localFrameIndex: entry.localFrameIndex
    })),
    groups: packageGroups,
    sourceConfig: sourceConfig
      ? {
          slicerMode: sourceConfig.slicerMode,
          gridConfig: sourceConfig.gridConfig as unknown as Record<string, unknown>,
          chromaKey: sourceConfig.chromaKey as unknown as Record<string, unknown>,
          contourConfig: sourceConfig.contourConfig as unknown as Record<string, unknown>
        }
      : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const jsonContent = JSON.stringify(packageJson, null, 2)
  const relPath = `loop_animations/${slug}`
  const jsonRelPath = `${relPath}/animation.json`
  const thumbnailRelPath = `${relPath}/thumbnail.png`

  // 4. Ghi lên đĩa qua IPC
  let folderPath: string | undefined
  if (typeof window !== 'undefined' && window.api?.saveLoopAnimationPackage) {
    try {
      const res = await window.api.saveLoopAnimationPackage({
        folderName: slug,
        name: rawName,
        category,
        jsonContent,
        frames: framePayloads,
        thumbnail: { fileName: 'thumbnail.png', data: thumbBytes }
      })
      if (res.ok) {
        folderPath = res.folderPath
      }
    } catch (e) {
      console.warn('[loopPackageSaver] Failed to save package via IPC:', e)
    }
  }

  // 5. Ghi sẵn dải frame ngang đã tách nền vào RAM cache để hiển thị 0ms không cần cắt lại
  invalidateLoopPackageCache(jsonRelPath)
  primeCachedLoopTemplateSheet(slug, {
    canvas: stripCanvas,
    frames: stripFrames,
    frameW: stripCellW,
    frameH: stripCellH,
    packageJson
  })

  // 6. Đồng bộ cấu trúc LoopAnimationTemplate gọn nhẹ vào kho lưu trữ
  const template: LoopAnimationTemplate = {
    id: slug,
    name: rawName,
    category,
    badge:
      packageGroups.length > 1
        ? `🎞 ${totalFrames}F · ${packageGroups.length} nhóm`
        : `🎞 ${totalFrames}F`,
    description:
      packageGroups.length > 1
        ? `Tổ hợp ${packageGroups.length} nhóm hiệu ứng (${totalFrames} frame • ${fps} FPS)`
        : `Hoạt ảnh lặp ${totalFrames} frame (${fps} FPS • ${loopMode})`,
    imageUrl: `assets/${thumbnailRelPath}`,
    thumbUrl: thumbDataUrl,
    thumbnailFrameIndex: resolvedThumbIdx,
    loopJsonPath: jsonRelPath,
    packageFolder: relPath,
    framePaths: flatFramesWithGroupMeta.map((_, idx) => `${relPath}/frame_${String(idx).padStart(3, '0')}.png`),
    colorConfig: packageJson.colorConfig,
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
    contourConfig: sourceConfig?.contourConfig,
    chromaKey: {
      ...(sourceConfig?.chromaKey || {
        enabled: false,
        keyColor: '#00ff00',
        similarity: 0.28,
        smoothness: 0.1,
        spill: 0.35
      }),
      enabled: false
    },
    fps,
    speed,
    loopMode,
    rhythm,
    frameCount: totalFrames,
    sourceWidth: stripCellW * grid.cols,
    sourceHeight: stripCellH * grid.rows,
    baseMeshWidth: packageJson.baseMeshWidth,
    baseMeshHeight: packageJson.baseMeshHeight,
    frames: stripFrames,
    groups: packageGroups,
    sequenceGroups: effectiveGroups
  }

  saveLoopTemplate(template)

  return {
    ok: true,
    slug,
    folderPath,
    jsonRelPath,
    thumbnailRelPath,
    packageJson,
    template,
    frameCanvases,
    groupFrameCanvases,
    stripCanvas
  }
}
