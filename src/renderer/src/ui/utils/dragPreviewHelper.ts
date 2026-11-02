import type React from 'react'

export interface DragGhostOptions {
  size?: number
}

/**
 * Thiết lập hình ảnh kéo (Drag Ghost Preview) trong suốt, thanh thoát,
 * chỉ hiển thị chi tiết hình ảnh / mesh tách nền (không có nền thẻ, không có ô caro, không có badge, không có nút bấm).
 *
 * Nguyên lý hoạt động trên Chromium / Blink (`DataTransfer::setDragImage`):
 * 1. Khi người dùng nhấn kéo trực tiếp trên thẻ `<img>` (`e.target instanceof HTMLImageElement`):
 *    KHÔNG gọi `setDragImage` để trình duyệt dùng cơ chế Native Image Drag (`DragImageForImage`),
 *    lấy trực tiếp bitmap PNG tách nền của `<img>` làm bóng mờ (giống hệt cơ chế gốc của tab Lắp Ráp).
 * 2. Khi người dùng nhấn kéo ở vùng viền/tiêu đề của thẻ (`e.target` không phải `<img>`):
 *    Tạo bản sao tách rời DOM (`img.cloneNode(false)` -> `!clone.isConnected`) rồi truyền vào `setDragImage`.
 *    Trong Blink, `HTMLImageElement` với `!isConnected` kích hoạt `setDragImageResource(CachedImage())`
 *    (lấy bitmap gốc tách nền) thay vì `LocalFrame::NodeImage` (vốn chụp dính cả nền thẻ và các badge đè lên).
 */
export function setCleanDragGhost(
  e: React.DragEvent,
  source?: HTMLImageElement | HTMLCanvasElement | string | null,
  _options: DragGhostOptions = {}
): void {
  if (!e.dataTransfer?.setDragImage || typeof document === 'undefined') return

  // 1. Nếu người dùng kéo trực tiếp từ thẻ <img> hiển thị ảnh chi tiết tách nền:
  // Để trình duyệt tự dùng Native Image Drag (không gọi setDragImage để tránh chụp dính nền thẻ / badge)
  if (e.target instanceof HTMLImageElement && e.target.complete && e.target.naturalWidth > 0) {
    return
  }

  // 2. Nếu kéo từ phần viền / tiêu đề thẻ: tìm thẻ <img> đã nạp sẵn trong thẻ và dùng bản sao tách khỏi DOM (!isConnected)
  const domImg =
    source instanceof HTMLImageElement
      ? source
      : (e.currentTarget.querySelector(
          'img.model-3d-thumb-img, img.loop-card-ghost-img, .loop-lib-thumb img, .asset-card-thumb img, img'
        ) as HTMLImageElement | null)

  if (domImg && domImg.complete && domImg.naturalWidth > 0) {
    const detachedImg = domImg.cloneNode(false) as HTMLImageElement
    const w = Math.min(domImg.offsetWidth || domImg.naturalWidth || 96, 160)
    const h = Math.min(domImg.offsetHeight || domImg.naturalHeight || 96, 160)
    e.dataTransfer.setDragImage(detachedImg, Math.round(w * 0.5), Math.round(h * 0.5))
    return
  }

  // 3. Dự phòng nếu source là URL chuỗi và chưa có <img> trong DOM
  if (typeof source === 'string' && source.length > 0) {
    const detachedImg = new Image()
    detachedImg.src = source
    if (detachedImg.complete && detachedImg.naturalWidth > 0) {
      const w = Math.min(detachedImg.naturalWidth || 96, 140)
      const h = Math.min(detachedImg.naturalHeight || 96, 140)
      e.dataTransfer.setDragImage(detachedImg, Math.round(w * 0.5), Math.round(h * 0.5))
    }
  }
}
