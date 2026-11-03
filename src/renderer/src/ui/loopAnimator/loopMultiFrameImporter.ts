import { BLANK_LOOP_NAME, useLoopAnimator } from './loopAnimatorState'
import { extractFrameCanvas } from './loopFrameExtractor'
import { canvasToBlobUrl, registerMemoryCanvasUrl } from './loopSourceProxy'
import type { GridSlicerConfig, LoopFrameBox } from './types'

/**
 * Trích xuất số thứ tự frame từ tên tệp ảnh (VD: "1.png" -> 1, "5.jpg" -> 5, "frame_04.png" -> 4).
 * Tự động loại bỏ các nhãn độ phân giải phổ biến như 2K, 4K, 8K, 1080p, 720p... để không nhận nhầm thành số frame.
 * Trả về số nguyên dương (1-based, 1..9999) nếu hợp lệ, ngược lại trả về null.
 */
export function extractFrameNumberFromTitle(fileName: string): number | null {
  if (!fileName || typeof fileName !== 'string') return null
  // Bỏ phần mở rộng tệp (.png, .jpg, v.v.)
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim()
  if (!baseName) return null

  // Loại bỏ các nhãn độ phân giải thường gặp (2k, 4k, 8k, 1080p, 720p, uhd, fhd, hd)
  const cleaned = baseName
    .replace(/(?:^|[_\-\s.#])(?:2k|4k|8k|1080p|720p|uhd|fhd|hd)(?:$|[_\-\s.#])/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim()
  if (!cleaned) return null

  const sanitizeNumber = (val: number): number | null => {
    return Number.isFinite(val) && val >= 1 && val <= 9999 ? Math.floor(val) : null
  }

  // 1. Tên tệp chỉ toàn số: "1", "05", "12"
  if (/^\d+$/.test(cleaned)) {
    return sanitizeNumber(parseInt(cleaned, 10))
  }

  // 2. Định dạng có dấu ngoặc: "anim (5)", "frame(12)"
  const parenMatch = cleaned.match(/\((\d+)\)$/)
  if (parenMatch) {
    const res = sanitizeNumber(parseInt(parenMatch[1], 10))
    if (res !== null) return res
  }

  // 3. Số ở cuối sau dấu gạch, dấu cách hoặc dấu chấm: "frame_1", "run-05", "step 3", "layer.8"
  const suffixMatch = cleaned.match(/[_\-\s.#](\d+)$/)
  if (suffixMatch) {
    const res = sanitizeNumber(parseInt(suffixMatch[1], 10))
    if (res !== null) return res
  }

  // 4. Số ở đầu trước dấu gạch, dấu cách hoặc dấu chấm: "1_frame", "05-run", "3 step"
  const prefixMatch = cleaned.match(/^(\d+)[_\-\s.#]/)
  if (prefixMatch) {
    const res = sanitizeNumber(parseInt(prefixMatch[1], 10))
    if (res !== null) return res
  }

  // 5. Nếu trong chuỗi chỉ có duy nhất 1 cụm số: "frame05", "run9"
  const allNumMatches = cleaned.match(/\d+/g)
  if (allNumMatches && allNumMatches.length === 1) {
    const res = sanitizeNumber(parseInt(allNumMatches[0], 10))
    if (res !== null) return res
  }

  return null
}

export interface FrameFileAssignment<T = File | { name: string }> {
  file: T
  targetFrameIndex: number
  sourceTitleNumber: number | null
}

/**
 * Sắp xếp và phân bổ frame cho danh sách tệp theo quy chuẩn:
 * - Ưu tiên số thứ tự frame trong title (VD: 1.png -> frame 1, 5.png -> frame 5).
 * - Nếu title ảnh không hợp lệ (không chứa số, trùng số hoặc số không nhất quán), lấy theo đúng thứ tự chọn (selection order).
 */
export function sortAndAssignFrameFiles<T extends { name: string }>(
  files: T[],
  existingFrameCount = 0
): { assignments: FrameFileAssignment<T>[]; useTitleNumbers: boolean } {
  if (files.length === 0) return { assignments: [], useTitleNumbers: false }

  const parsed = files.map((file, originalIndex) => ({
    file,
    originalIndex,
    titleNumber: extractFrameNumberFromTitle(file.name)
  }))

  const allHaveNumbers = parsed.every((p) => p.titleNumber !== null && p.titleNumber > 0)
  const numbersSet = new Set(parsed.map((p) => p.titleNumber).filter((n): n is number => n !== null))
  const noDuplicates = numbersSet.size === parsed.length

  const validTitleMode = allHaveNumbers && noDuplicates

  if (validTitleMode) {
    // Sắp xếp tăng dần theo số frame trong title
    parsed.sort((a, b) => (a.titleNumber as number) - (b.titleNumber as number))

    const maxNum = Math.max(...(parsed.map((p) => p.titleNumber) as number[]))
    const minNum = Math.min(...(parsed.map((p) => p.titleNumber) as number[]))
    const isConsecutive = minNum === 1 && maxNum === parsed.length

    const assignments: FrameFileAssignment<T>[] = parsed.map((p, idx) => {
      const num = p.titleNumber as number
      // Nếu có sẵn frame và số frame nằm trong phạm vi (hoặc danh sách liên tục 1..N):
      // Số 1 đại diện cho frame 1 (index 0), số 5 đại diện cho frame 5 (index 4)
      let targetFrameIndex: number
      if (existingFrameCount >= maxNum || isConsecutive) {
        targetFrameIndex = Math.max(0, num - 1)
      } else if (existingFrameCount > 0 && num - 1 < existingFrameCount) {
        targetFrameIndex = num - 1
      } else {
        // Nếu các số nhảy cóc không liên tục và không có frame cũ khớp:
        // Lấy theo thứ tự đã sắp xếp tăng dần của title
        targetFrameIndex = idx
      }

      return {
        file: p.file,
        targetFrameIndex,
        sourceTitleNumber: num
      }
    })

    return { assignments, useTitleNumbers: true }
  }

  // Fallback: title không hợp lệ hoặc thiếu số -> lấy theo đúng thứ tự chọn ban đầu
  const assignments: FrameFileAssignment<T>[] = parsed.map((p, idx) => ({
    file: p.file,
    targetFrameIndex: idx,
    sourceTitleNumber: null
  }))

  return { assignments, useTitleNumbers: false }
}

/**
 * Tính số hàng và cột tối ưu khi ghép nhiều frame thành Sprite Sheet:
 * Khi có từ 3 frame trở lên, chia làm 3 hàng với bấy nhiêu cột (chạy từ trái sang phải, từ trên xuống dưới).
 */
export function calculateMultiFrameGrid(
  count: number,
  maxW?: number,
  _maxH?: number,
  maxTextureDimension = 8192
): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 }
  if (count < 3) return { cols: count, rows: 1 }

  const targetRows = 3
  let cols = Math.ceil(count / targetRows)
  if (maxW && maxW > 0) {
    while (cols > 1 && cols * maxW > maxTextureDimension) {
      cols--
    }
  }
  const rows = Math.max(targetRows, Math.ceil(count / cols))
  return { cols, rows }
}

export interface FrameRenderInput {
  source: CanvasImageSource
  width: number
  height: number
  enabled?: boolean
  durationRatio?: number
  offsetX?: number
  offsetY?: number
}

export interface StitchedSpriteSheetResult {
  canvas: HTMLCanvasElement
  dataUrl: string
  frames: LoopFrameBox[]
  cols: number
  rows: number
  width: number
  height: number
  cellWidth: number
  cellHeight: number
}

/** Giới hạn kích thước tối đa của Sprite Sheet ghép từ nhiều tệp 4K để không vượt ngưỡng GPU/RAM */
const MAX_STITCHED_SHEET_DIM = 4096

/**
 * Ghép danh sách các ảnh frame thành 1 Sprite Sheet duy nhất trên Canvas
 */
export function stitchFrameImagesToSpriteSheet(
  framesData: FrameRenderInput[],
  anchor: 'bottom' | 'center' = 'bottom'
): StitchedSpriteSheetResult | null {
  if (typeof document === 'undefined' || framesData.length === 0) return null

  const count = framesData.length
  const rawMaxW = Math.max(1, ...framesData.map((f) => f.width))
  const rawMaxH = Math.max(1, ...framesData.map((f) => f.height))

  const { cols, rows } = calculateMultiFrameGrid(count, rawMaxW, rawMaxH)
  const cellScale = Math.min(
    1,
    MAX_STITCHED_SHEET_DIM / Math.max(1, cols * rawMaxW),
    MAX_STITCHED_SHEET_DIM / Math.max(1, rows * rawMaxH)
  )
  const maxW = Math.max(1, Math.round(rawMaxW * cellScale))
  const maxH = Math.max(1, Math.round(rawMaxH * cellScale))
  const canvasW = cols * maxW
  const canvasH = rows * maxH

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvasW, canvasH)

  const frames: LoopFrameBox[] = []

  for (let i = 0; i < count; i++) {
    const f = framesData[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const cellX = col * maxW
    const cellY = row * maxH

    const fw = Math.max(1, Math.round(f.width * cellScale))
    const fh = Math.max(1, Math.round(f.height * cellScale))
    const drawX = cellX + Math.round((maxW - fw) * 0.5)
    let drawY: number
    if (anchor === 'bottom') {
      drawY = cellY + (maxH - fh)
    } else {
      drawY = cellY + Math.round((maxH - fh) * 0.5)
    }

    try {
      ctx.drawImage(f.source, drawX, drawY, fw, fh)
    } catch {
      // Bỏ qua lỗi vẽ nếu ảnh không hợp lệ
    }

    frames.push({
      id: `frame_${i}`,
      index: i,
      x: cellX,
      y: cellY,
      width: maxW,
      height: maxH,
      offsetX: Math.round((f.offsetX ?? 0) * cellScale),
      offsetY: Math.round((f.offsetY ?? 0) * cellScale),
      enabled: f.enabled !== false,
      durationRatio: f.durationRatio ?? 1
    })
  }

  // Với sheet lớn (> 1MP), ưu tiên ghi thẳng vào memoryCanvasCache để tránh nghẽn đồng bộ toDataURL('image/png')
  const isLargeSheet = canvasW * canvasH > 1024 * 1024
  const dataUrl = isLargeSheet
    ? `blob:loop-stitched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    : canvas.toDataURL('image/png')
  registerMemoryCanvasUrl(dataUrl, canvas)

  return {
    canvas,
    dataUrl,
    frames,
    cols,
    rows,
    width: canvasW,
    height: canvasH,
    cellWidth: maxW,
    cellHeight: maxH
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && file.size > 512 * 1024) {
    return Promise.resolve(URL.createObjectURL(file))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Invalid reader result'))
    }
    reader.onerror = () => reject(new Error('Cannot read file'))
    reader.readAsDataURL(file)
  })
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Cannot load image'))
    img.src = src
  })
}

/**
 * Nâng cấp ảnh 2K/4K từ nhiều tệp ảnh máy tính (hoặc 1 tệp):
 * - Giữ nguyên kích thước baseMeshWidth, baseMeshHeight để không làm lệch tỉ lệ layer trên sân khấu.
 * - Ưu tiên số thứ tự frame trong title (VD: 1.png -> frame 1, 5.png -> frame 5).
 * - Nếu title không chứa số, lấy theo thứ tự chọn trong tệp.
 */
export async function upgradeLoopImageFilesKeepMesh(
  files: File[],
  sourceCanvas?: HTMLCanvasElement | null
): Promise<boolean> {
  const imageFiles = files.filter(
    (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
  )
  if (imageFiles.length === 0) return false

  const state = useLoopAnimator.getState()
  const existingFrames = state.frames
  const existingCount = existingFrames.length

  // Nếu chỉ có 1 file và không phải frame lẻ chỉ định cụ thể:
  const singleTitleNum = imageFiles.length === 1 ? extractFrameNumberFromTitle(imageFiles[0].name) : null
  const isSingleSpriteSheet =
    imageFiles.length === 1 && (existingCount <= 1 || singleTitleNum === null)

  if (isSingleSpriteSheet) {
    const dataUrl = await readFileAsDataUrl(imageFiles[0])
    state.upgradeSourceImageKeepMesh(dataUrl, imageFiles[0].name)
    return true
  }

  const { assignments } = sortAndAssignFrameFiles(imageFiles, existingCount)
  if (assignments.length === 0) return false

  const loadedNewImages = await Promise.all(
    assignments.map(async (a) => {
      const dataUrl = await readFileAsDataUrl(a.file)
      const img = await loadImageElement(dataUrl)
      return {
        targetFrameIndex: a.targetFrameIndex,
        img,
        file: a.file
      }
    })
  )

  const maxAssignedIdx = Math.max(...loadedNewImages.map((l) => l.targetFrameIndex))
  const totalFrames = Math.max(existingCount, maxAssignedIdx + 1, loadedNewImages.length)

  const newImagesByTarget = new Map<number, (typeof loadedNewImages)[0]>()
  for (const item of loadedNewImages) {
    newImagesByTarget.set(item.targetFrameIndex, item)
  }

  const framesData: FrameRenderInput[] = []

  for (let i = 0; i < totalFrames; i++) {
    const newItem = newImagesByTarget.get(i)
    const existing = existingFrames[i]
    if (newItem) {
      framesData.push({
        source: newItem.img,
        width: newItem.img.naturalWidth || 256,
        height: newItem.img.naturalHeight || 256,
        enabled: existing ? existing.enabled : true,
        durationRatio: existing?.durationRatio ?? 1,
        offsetX: existing?.offsetX ?? 0,
        offsetY: existing?.offsetY ?? 0
      })
    } else if (existing && sourceCanvas) {
      const extracted = extractFrameCanvas(sourceCanvas, existing, existing.width, existing.height)
      framesData.push({
        source: extracted,
        width: extracted.width,
        height: extracted.height,
        enabled: existing.enabled,
        durationRatio: existing.durationRatio ?? 1,
        offsetX: existing.offsetX ?? 0,
        offsetY: existing.offsetY ?? 0
      })
    }
  }

  if (framesData.length === 0) return false

  const stitched = stitchFrameImagesToSpriteSheet(framesData)
  if (!stitched) return false
  const stitchedUrl = await canvasToBlobUrl(stitched.canvas)

  const prevMeshW =
    state.baseMeshWidth > 0
      ? state.baseMeshWidth
      : existingFrames[0]?.width || framesData[0].width
  const prevMeshH =
    state.baseMeshHeight > 0
      ? state.baseMeshHeight
      : existingFrames[0]?.height || framesData[0].height

  const primaryName =
    state.layerName && state.layerName !== BLANK_LOOP_NAME
      ? state.layerName
      : imageFiles[0].name.replace(/\.[^.]+$/, '')

  state.upgradeMultipleFramesKeepMesh({
    dataUrl: stitchedUrl,
    frames: stitched.frames,
    sourceWidth: stitched.width,
    sourceHeight: stitched.height,
    baseMeshWidth: prevMeshW,
    baseMeshHeight: prevMeshH,
    layerName: primaryName,
    gridConfig: {
      cols: stitched.cols,
      rows: stitched.rows,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0,
      borderPadding: 0
    }
  })

  return true
}

/**
 * Nạp nhiều tệp ảnh vào phiên tạo hoạt ảnh Loop mới:
 * - Ưu tiên sắp xếp theo số title frame (1.png -> frame 1, 5.png -> frame 5).
 * - Nếu không có số, nạp theo thứ tự chọn tệp.
 */
export async function loadLoopImageFiles(files: File[]): Promise<boolean> {
  const imageFiles = files.filter(
    (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
  )
  if (imageFiles.length === 0) return false

  if (imageFiles.length === 1) {
    const dataUrl = await readFileAsDataUrl(imageFiles[0])
    useLoopAnimator.getState().loadCustomImage(dataUrl, imageFiles[0].name)
    return true
  }

  const { assignments } = sortAndAssignFrameFiles(imageFiles, 0)
  if (assignments.length === 0) return false

  const loadedImages = await Promise.all(
    assignments.map(async (a) => {
      const dataUrl = await readFileAsDataUrl(a.file)
      const img = await loadImageElement(dataUrl)
      return {
        targetFrameIndex: a.targetFrameIndex,
        img,
        file: a.file
      }
    })
  )

  const maxAssignedIdx = Math.max(...loadedImages.map((l) => l.targetFrameIndex))
  const totalFrames = Math.max(maxAssignedIdx + 1, loadedImages.length)

  const newImagesByTarget = new Map<number, (typeof loadedImages)[0]>()
  for (const item of loadedImages) {
    newImagesByTarget.set(item.targetFrameIndex, item)
  }

  const framesData: FrameRenderInput[] = []
  for (let i = 0; i < totalFrames; i++) {
    const item = newImagesByTarget.get(i)
    if (item) {
      framesData.push({
        source: item.img,
        width: item.img.naturalWidth || 256,
        height: item.img.naturalHeight || 256,
        enabled: true,
        durationRatio: 1
      })
    }
  }

  if (framesData.length === 0) return false

  const stitched = stitchFrameImagesToSpriteSheet(framesData)
  if (!stitched) return false
  const stitchedUrl = await canvasToBlobUrl(stitched.canvas)

  const primaryName = imageFiles[0].name.replace(/\.[^.]+$/, '')
  useLoopAnimator.getState().loadCustomMultiFrames({
    dataUrl: stitchedUrl,
    frames: stitched.frames,
    sourceWidth: stitched.width,
    sourceHeight: stitched.height,
    layerName: primaryName,
    gridConfig: {
      cols: stitched.cols,
      rows: stitched.rows,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0,
      borderPadding: 0
    }
  })

  return true
}
