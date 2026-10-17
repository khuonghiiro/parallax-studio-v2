import type { ChromaKeySettings, CutPiece, TemplateSlotDef } from './types'
import { rgbToHex } from './chromaAdvancedProcessor'

export interface DetectedCornerPreset {
  type: ChromaKeySettings['keyColorType']
  hex: string
}

function classifyCornerColor(r: number, g: number, b: number): DetectedCornerPreset {
  const hex = rgbToHex(r, g, b)
  if (g > 110 && g > r + 32 && g > b + 28) return { type: 'chroma_green', hex }
  if (b > 110 && b > r + 28 && b > g + 24) return { type: 'chroma_blue', hex }
  if (r < 30 && g < 30 && b < 30) return { type: 'pure_black', hex: '#000000' }
  if (r > 228 && g > 228 && b > 228) return { type: 'pure_white', hex: '#FFFFFF' }
  return { type: 'custom', hex }
}

/** Tự động phát hiện màu phông bằng cụm màu ổn định nhất trong bốn góc ảnh. */
export function detectCornerBackground(rctx: CanvasRenderingContext2D): DetectedCornerPreset | null {
  const w = Math.max(1, rctx.canvas.width)
  const h = Math.max(1, rctx.canvas.height)
  const size = Math.max(1, Math.min(7, Math.floor(Math.min(w, h) / 12)))
  const inset = Math.max(0, Math.floor(Math.min(w, h) * 0.012))
  const points = [
    [inset, inset],
    [Math.max(0, w - inset - size), inset],
    [inset, Math.max(0, h - inset - size)],
    [Math.max(0, w - inset - size), Math.max(0, h - inset - size)]
  ]
  const samples: Array<{ r: number; g: number; b: number }> = []
  for (const [x, y] of points) {
    const data = rctx.getImageData(x, y, size, size).data
    let rr = 0
    let gg = 0
    let bb = 0
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 30) continue
      rr += data[i]
      gg += data[i + 1]
      bb += data[i + 2]
      count++
    }
    if (count > 0) samples.push({ r: rr / count, g: gg / count, b: bb / count })
  }
  if (samples.length === 0) return null

  const selected = samples.reduce((best, sample) => {
    const distances = samples
      .filter((other) => other !== sample)
      .map((other) => Math.hypot(sample.r - other.r, sample.g - other.g, sample.b - other.b))
      .sort((a, b) => a - b)
    const score = (distances[0] ?? 0) + (distances[1] ?? 0)
    return score < best.score ? { sample, score } : best
  }, { sample: samples[0], score: Number.POSITIVE_INFINITY }).sample

  return classifyCornerColor(Math.round(selected.r), Math.round(selected.g), Math.round(selected.b))
}

export interface CanvasPointerCoords {
  workX: number
  workY: number
  natX: number
  natY: number
  canvasX: number
  canvasY: number
}

/** Tính toạ độ con trỏ chuẩn hoá giữa canvas hiển thị, buffer làm việc và ảnh gốc */
export function computeCanvasPointerCoords(
  e: React.PointerEvent<HTMLCanvasElement>,
  natW: number,
  natH: number
): CanvasPointerCoords {
  const rect = e.currentTarget.getBoundingClientRect()
  const workW = e.currentTarget.width
  const workH = e.currentTarget.height
  const sxWork = workW / Math.max(1, rect.width)
  const syWork = workH / Math.max(1, rect.height)
  const sxNat = natW / Math.max(1, rect.width)
  const syNat = natH / Math.max(1, rect.height)
  return {
    workX: Math.round((e.clientX - rect.left) * sxWork),
    workY: Math.round((e.clientY - rect.top) * syWork),
    natX: Math.round((e.clientX - rect.left) * sxNat),
    natY: Math.round((e.clientY - rect.top) * syNat),
    canvasX: Math.round(e.clientX - rect.left),
    canvasY: Math.round(e.clientY - rect.top)
  }
}

/**
 * Tính tỷ lệ scale tự động khi đưa mảnh cắt từ ảnh nguồn (đặc biệt là ảnh 4K/8K)
 * vào bảng lắp ráp 2D (mặc định 600×600 hoặc 750×1050) để mảnh cắt vừa vặn,
 * không bị phóng to khổng lồ che khuất các bộ phận khác.
 */
export function computeAutoFitPieceScale(
  piece: Pick<CutPiece, 'width' | 'height' | 'sourceImageSize'>,
  boardWidth = 600,
  boardHeight = 600
): number {
  const bw = Math.max(200, boardWidth || 600)
  const bh = Math.max(200, boardHeight || 600)
  const pw = Math.max(1, piece.width || 1)
  const ph = Math.max(1, piece.height || 1)

  let scale = 1
  const srcW = piece.sourceImageSize?.width ?? 0
  const srcH = piece.sourceImageSize?.height ?? 0

  if (srcW > 0 && srcH > 0 && Math.max(srcW, srcH) > Math.max(bw, bh) * 1.15) {
    const sheetScale = ((bw + bh) / (srcW + srcH)) * 1.15
    scale = Math.min(scale, sheetScale)
  }

  const maxPieceW = bw * 0.48
  const maxPieceH = bh * 0.48
  if (pw * scale > maxPieceW || ph * scale > maxPieceH) {
    scale = Math.min(scale, maxPieceW / pw, maxPieceH / ph)
  }

  return Number(Math.max(0.05, Math.min(1, scale)).toFixed(2))
}

/**
 * Tính tỷ lệ scale vừa khít khi thả mảnh cắt vào một ô khuôn mẫu (Template Slot).
 */
export function computeSlotFitPieceScale(
  piece: Pick<CutPiece, 'width' | 'height' | 'sourceImageSize'>,
  slot: Pick<TemplateSlotDef, 'width' | 'height' | 'scale'>,
  boardWidth = 600,
  boardHeight = 600
): number {
  const pw = Math.max(1, piece.width || 1)
  const ph = Math.max(1, piece.height || 1)
  const sw = Math.max(16, slot.width || 100)
  const sh = Math.max(16, slot.height || 100)

  const srcW = piece.sourceImageSize?.width ?? 0
  const srcH = piece.sourceImageSize?.height ?? 0
  const isHighResSource = srcW > 1200 || srcH > 1200 || pw > sw * 2.2 || ph > sh * 2.2

  if (!isHighResSource && typeof slot.scale === 'number' && slot.scale > 0) {
    return Number(Math.max(0.05, Math.min(2, slot.scale)).toFixed(2))
  }

  const fitScale = Math.min(sw / pw, sh / ph) * 1.08
  const fallbackScale = computeAutoFitPieceScale(piece, boardWidth, boardHeight)
  const chosen = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : fallbackScale
  return Number(Math.max(0.05, Math.min(2, chosen)).toFixed(2))
}

export interface CursorAnchoredZoomParams {
  cursorClientX: number
  cursorClientY: number
  viewportCenterX: number
  viewportCenterY: number
  currentPanX: number
  currentPanY: number
  oldScale: number
  newScale: number
  minScale?: number
  maxScale?: number
}

export interface CursorAnchoredZoomResult {
  scale: number
  panX: number
  panY: number
}

/**
 * Tính toán thu phóng ghim cố định điểm ảnh ngay dưới mũi trỏ chuột (Cursor-anchored zoom).
 * Đảm bảo khi người dùng nhấn Ctrl + lăn chuột (hoặc lăn chuột) tại bất kỳ chi tiết nào trên ảnh,
 * chi tiết đó luôn đứng yên ngay dưới con trỏ chuột.
 */
export function computeCursorAnchoredZoom({
  cursorClientX,
  cursorClientY,
  viewportCenterX,
  viewportCenterY,
  currentPanX,
  currentPanY,
  oldScale,
  newScale,
  minScale = 0.15,
  maxScale = 4.0
}: CursorAnchoredZoomParams): CursorAnchoredZoomResult {
  const safeOld = Math.max(0.05, oldScale)
  const safeNew = Math.max(minScale, Math.min(maxScale, Number(newScale.toFixed(3))))
  const ratio = safeNew / safeOld
  const ux = cursorClientX - viewportCenterX
  const uy = cursorClientY - viewportCenterY
  const panX = Math.round(ux - (ux - currentPanX) * ratio)
  const panY = Math.round(uy - (uy - currentPanY) * ratio)
  return {
    scale: safeNew,
    panX,
    panY
  }
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'number', 'password', 'email', 'url', 'tel'])

/** Kiểm tra phần tử đang focus có phải ô nhập văn bản/số cần dùng phím Space hay không */
export function isEditableElementForSpacePan(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') {
    const type = ((target as HTMLInputElement).type || 'text').toLowerCase()
    return TEXT_INPUT_TYPES.has(type)
  }
  return false
}

/** Tính toạ độ dịch chuyển khung nhìn (pan) khi giữ Space + kéo chuột trái */
export function computeSpacePanOffset(
  origPanX: number,
  origPanY: number,
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number
): { x: number; y: number } {
  return {
    x: Math.round(origPanX + (currentClientX - startClientX)),
    y: Math.round(origPanY + (currentClientY - startClientY))
  }
}

