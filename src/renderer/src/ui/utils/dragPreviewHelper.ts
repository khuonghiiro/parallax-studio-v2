import type React from 'react'

export interface DragGhostOptions {
  size?: number
  borderColor?: string
  borderRadius?: number
  borderWidth?: number
}

/**
 * Thiết lập hình ảnh kéo (Drag Ghost Preview) trong suốt, thanh thoát,
 * chỉ hiển thị chi tiết hình ảnh / mesh tách nền (không có nền ô caro, không có badge, không có nút bấm),
 * kèm theo viền mờ tinh tế bo nhẹ bao quanh đúng như thiết kế chuyên nghiệp trong ảnh mẫu người dùng yêu cầu.
 */
export function setCleanDragGhost(
  e: React.DragEvent,
  source: HTMLImageElement | HTMLCanvasElement | string | null | undefined,
  options: DragGhostOptions = {}
): void {
  if (!e.dataTransfer || typeof document === 'undefined') return

  const size = options.size ?? 96
  const borderColor = options.borderColor ?? 'rgba(56, 189, 248, 0.55)'
  const borderWidth = options.borderWidth ?? 1.5
  const borderRadius = options.borderRadius ?? 6

  // 1. Nếu source là một HTMLCanvasElement (ví dụ Frame preview canvas)
  if (source instanceof HTMLCanvasElement) {
    drawCanvasGhost(e, source, size, borderColor, borderWidth, borderRadius)
    return
  }

  // 2. Nếu source là một HTMLImageElement đã tải xong
  if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
    drawImageGhost(e, source, size, borderColor, borderWidth, borderRadius)
    return
  }

  // 3. Nếu source là string URL (Data URL, blob URL hoặc asset path)
  if (typeof source === 'string' && source.length > 0) {
    const tempImg = new Image()
    tempImg.crossOrigin = 'anonymous'
    tempImg.onload = () => {
      // Lưu ý: Nếu user drag thì onload có thể trễ hơn 1 frame,
      // nên fallback vẽ ngay nếu chưa kịp load xong
    }
    tempImg.src = source
    if (tempImg.complete && tempImg.naturalWidth > 0) {
      drawImageGhost(e, tempImg, size, borderColor, borderWidth, borderRadius)
      return
    }
  }

  // 4. Fallback tìm ảnh img hoặc canvas sạch bên trong currentTarget
  const internalImg = e.currentTarget.querySelector('img') as HTMLImageElement | null
  if (internalImg && internalImg.complete && internalImg.naturalWidth > 0) {
    drawImageGhost(e, internalImg, size, borderColor, borderWidth, borderRadius)
    return
  }

  const internalCv = e.currentTarget.querySelector('canvas') as HTMLCanvasElement | null
  if (internalCv && internalCv.width > 0 && internalCv.height > 0) {
    drawCanvasGhost(e, internalCv, size, borderColor, borderWidth, borderRadius)
  }
}

function drawImageGhost(
  e: React.DragEvent,
  img: HTMLImageElement,
  size: number,
  borderColor: string,
  borderWidth: number,
  borderRadius: number
): void {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  // Tính tỷ lệ co giãn căn giữa
  const nw = img.naturalWidth || img.width || 64
  const nh = img.naturalHeight || img.height || 64
  const padding = 10
  const maxInner = size - padding * 2
  const scale = Math.min(maxInner / Math.max(1, nw), maxInner / Math.max(1, nh))
  const dw = Math.max(1, Math.round(nw * scale))
  const dh = Math.max(1, Math.round(nh * scale))
  const dx = Math.round((size - dw) * 0.5)
  const dy = Math.round((size - dh) * 0.5)

  // Vẽ hình ảnh mesh tách nền
  try {
    ctx.drawImage(img, dx, dy, dw, dh)
  } catch {
    /* ignore cross-origin error */
  }

  // Vẽ khung viền bo mờ bán trong suốt bao quanh (như ảnh mẫu)
  drawBorder(ctx, size, borderColor, borderWidth, borderRadius)

  if (e.dataTransfer.setDragImage) {
    e.dataTransfer.setDragImage(canvas, size / 2, size / 2)
  }
}

function drawCanvasGhost(
  e: React.DragEvent,
  sourceCanvas: HTMLCanvasElement,
  size: number,
  borderColor: string,
  borderWidth: number,
  borderRadius: number
): void {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  const cw = sourceCanvas.width
  const ch = sourceCanvas.height
  const padding = 10
  const maxInner = size - padding * 2
  const scale = Math.min(maxInner / Math.max(1, cw), maxInner / Math.max(1, ch))
  const dw = Math.max(1, Math.round(cw * scale))
  const dh = Math.max(1, Math.round(ch * scale))
  const dx = Math.round((size - dw) * 0.5)
  const dy = Math.round((size - dh) * 0.5)

  try {
    ctx.drawImage(sourceCanvas, dx, dy, dw, dh)
  } catch {
    /* ignore */
  }

  drawBorder(ctx, size, borderColor, borderWidth, borderRadius)

  if (e.dataTransfer.setDragImage) {
    e.dataTransfer.setDragImage(canvas, size / 2, size / 2)
  }
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  width: number,
  radius: number
): void {
  const inset = 3
  const x = inset
  const y = inset
  const w = size - inset * 2
  const h = size - inset * 2

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
  } else {
    ctx.rect(x, y, w, h)
  }
  ctx.stroke()
  ctx.restore()
}
