import type React from 'react'

export interface DragGhostOptions {
  size?: number
}

/**
 * Thiết lập hình ảnh kéo (Drag Ghost Preview) trong suốt, thanh thoát,
 * chỉ hiển thị chi tiết hình ảnh / mesh tách nền (không có nền thẻ, không có ô caro, không có badge, không có nút bấm),
 * hoạt động ổn định 100% trên Chromium / Electron bằng cách sử dụng trực tiếp phần tử DOM hiển thị (<img> hoặc <canvas>).
 */
export function setCleanDragGhost(
  e: React.DragEvent,
  source?: HTMLImageElement | HTMLCanvasElement | string | null,
  _options: DragGhostOptions = {}
): void {
  if (!e.dataTransfer?.setDragImage || typeof document === 'undefined') return

  // 1. Nếu source là một HTMLImageElement đã tải xong và gắn trong DOM
  if (source instanceof HTMLImageElement && source.isConnected && source.complete && source.naturalWidth > 0) {
    const w = Math.min(source.offsetWidth || source.naturalWidth || 80, 160)
    const h = Math.min(source.offsetHeight || source.naturalHeight || 80, 160)
    e.dataTransfer.setDragImage(source, Math.round(w * 0.5), Math.round(h * 0.5))
    return
  }

  // 2. Nếu source là một HTMLCanvasElement trong DOM
  if (source instanceof HTMLCanvasElement && source.isConnected && source.width > 0 && source.height > 0) {
    const w = Math.min(source.offsetWidth || source.width || 80, 160)
    const h = Math.min(source.offsetHeight || source.height || 80, 160)
    e.dataTransfer.setDragImage(source, Math.round(w * 0.5), Math.round(h * 0.5))
    return
  }

  // 3. Tìm phần tử <img> hiển thị hình ảnh chi tiết bên trong thẻ đang kéo
  const img = e.currentTarget.querySelector(
    'img.model-3d-thumb-img, img.loop-card-ghost-img, .loop-lib-thumb img, .asset-card-thumb img, img'
  ) as HTMLImageElement | null
  if (img && img.isConnected && img.complete && img.naturalWidth > 0) {
    const w = Math.min(img.offsetWidth || img.naturalWidth || 80, 160)
    const h = Math.min(img.offsetHeight || img.naturalHeight || 80, 160)
    e.dataTransfer.setDragImage(img, Math.round(w * 0.5), Math.round(h * 0.5))
    return
  }

  // 4. Tìm phần tử <canvas> hiển thị chi tiết tách nền bên trong thẻ đang kéo
  const cv = e.currentTarget.querySelector('canvas') as HTMLCanvasElement | null
  if (cv && cv.isConnected && cv.width > 0 && cv.height > 0) {
    const w = Math.min(cv.offsetWidth || cv.width || 80, 160)
    const h = Math.min(cv.offsetHeight || cv.height || 80, 160)
    e.dataTransfer.setDragImage(cv, Math.round(w * 0.5), Math.round(h * 0.5))
    return
  }
}
