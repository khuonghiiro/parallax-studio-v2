export type Bbox2DHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface BboxHandleDef {
  handle: Bbox2DHandle
  cursor: string
  title: string
  top?: string
  bottom?: string
  left?: string
  right?: string
  transform?: string
}

export const BBOX_2D_HANDLES: BboxHandleDef[] = [
  { handle: 'nw', cursor: 'nwse-resize', title: 'Góc trên-trái (Giữ cố định góc dưới-phải)', top: '-5px', left: '-5px' },
  { handle: 'n', cursor: 'ns-resize', title: 'Cạnh trên (Giữ cố định cạnh dưới)', top: '-5px', left: '50%', transform: 'translateX(-50%)' },
  { handle: 'ne', cursor: 'nesw-resize', title: 'Góc trên-phải (Giữ cố định góc dưới-trái)', top: '-5px', right: '-5px' },
  { handle: 'e', cursor: 'ew-resize', title: 'Cạnh phải (Giữ cố định cạnh trái)', top: '50%', right: '-5px', transform: 'translateY(-50%)' },
  { handle: 'se', cursor: 'nwse-resize', title: 'Góc dưới-phải (Giữ cố định góc trên-trái)', bottom: '-5px', right: '-5px' },
  { handle: 's', cursor: 'ns-resize', title: 'Cạnh dưới (Giữ cố định cạnh trên)', bottom: '-5px', left: '50%', transform: 'translateX(-50%)' },
  { handle: 'sw', cursor: 'nesw-resize', title: 'Góc dưới-trái (Giữ cố định góc trên-phải)', bottom: '-5px', left: '-5px' },
  { handle: 'w', cursor: 'ew-resize', title: 'Cạnh trái (Giữ cố định cạnh phải)', top: '50%', left: '-5px', transform: 'translateY(-50%)' }
]

export interface AnchorPinnedResizeParams {
  handle: Bbox2DHandle
  dx: number // Khoảng di chuột theo trục X (pixel không gian canvas)
  dy: number // Khoảng di chuột theo trục Y (pixel không gian canvas)
  startX: number
  startY: number
  startScale: number
  baseWidth: number
  baseHeight: number
  minDimension?: number
}

export interface ResizeResult {
  x: number
  y: number
  scale: number
}

/**
 * Tính toán co dãn hộp bao (Bounding Box) có cố định cạnh / góc đối diện (Anchor-pinned scaling):
 * - Kéo cạnh phải (e): Cạnh trái giữ nguyên vị trí tuyệt đối
 * - Kéo cạnh trái (w): Cạnh phải giữ nguyên vị trí tuyệt đối
 * - Kéo cạnh trên (n): Cạnh dưới giữ nguyên vị trí tuyệt đối
 * - Kéo cạnh dưới (s): Cạnh trên giữ nguyên vị trí tuyệt đối
 * - Kéo các góc (nw, ne, se, sw): Góc đối diện giữ nguyên vị trí tuyệt đối
 */
export function calculateAnchorPinnedResize({
  handle,
  dx,
  dy,
  startX,
  startY,
  startScale,
  baseWidth,
  baseHeight,
  minDimension = 20
}: AnchorPinnedResizeParams): ResizeResult {
  const safeStartScale = Math.max(0.01, startScale)
  const safeBaseW = Math.max(1, baseWidth)
  const safeBaseH = Math.max(1, baseHeight)

  const startW = safeBaseW * safeStartScale
  const startH = safeBaseH * safeStartScale

  let newX = startX
  let newY = startY
  let newScale = safeStartScale

  switch (handle) {
    case 'e': {
      // Cạnh trái cố định: x_left = startX - startW / 2
      const newW = Math.max(minDimension, startW + dx)
      newScale = (newW / startW) * safeStartScale
      newX = startX + (newW - startW) / 2
      break
    }
    case 'w': {
      // Cạnh phải cố định: x_right = startX + startW / 2
      const newW = Math.max(minDimension, startW - dx)
      newScale = (newW / startW) * safeStartScale
      newX = startX - (newW - startW) / 2
      break
    }
    case 's': {
      // Cạnh trên cố định: y_top = startY - startH / 2
      const newH = Math.max(minDimension, startH + dy)
      newScale = (newH / startH) * safeStartScale
      newY = startY + (newH - startH) / 2
      break
    }
    case 'n': {
      // Cạnh dưới cố định: y_bottom = startY + startH / 2
      const newH = Math.max(minDimension, startH - dy)
      newScale = (newH / startH) * safeStartScale
      newY = startY - (newH - startH) / 2
      break
    }
    case 'se': {
      // Góc trên-trái cố định
      const ratioX = (startW + dx) / startW
      const ratioY = (startH + dy) / startH
      const ratio = Math.max(0.05, Math.abs(dx) > Math.abs(dy) ? ratioX : ratioY)
      const newW = Math.max(minDimension, startW * ratio)
      const newH = Math.max(minDimension, startH * ratio)
      newScale = ratio * safeStartScale
      newX = startX + (newW - startW) / 2
      newY = startY + (newH - startH) / 2
      break
    }
    case 'ne': {
      // Góc dưới-trái cố định
      const ratioX = (startW + dx) / startW
      const ratioY = (startH - dy) / startH
      const ratio = Math.max(0.05, Math.abs(dx) > Math.abs(dy) ? ratioX : ratioY)
      const newW = Math.max(minDimension, startW * ratio)
      const newH = Math.max(minDimension, startH * ratio)
      newScale = ratio * safeStartScale
      newX = startX + (newW - startW) / 2
      newY = startY - (newH - startH) / 2
      break
    }
    case 'sw': {
      // Góc trên-phải cố định
      const ratioX = (startW - dx) / startW
      const ratioY = (startH + dy) / startH
      const ratio = Math.max(0.05, Math.abs(dx) > Math.abs(dy) ? ratioX : ratioY)
      const newW = Math.max(minDimension, startW * ratio)
      const newH = Math.max(minDimension, startH * ratio)
      newScale = ratio * safeStartScale
      newX = startX - (newW - startW) / 2
      newY = startY + (newH - startH) / 2
      break
    }
    case 'nw': {
      // Góc dưới-phải cố định
      const ratioX = (startW - dx) / startW
      const ratioY = (startH - dy) / startH
      const ratio = Math.max(0.05, Math.abs(dx) > Math.abs(dy) ? ratioX : ratioY)
      const newW = Math.max(minDimension, startW * ratio)
      const newH = Math.max(minDimension, startH * ratio)
      newScale = ratio * safeStartScale
      newX = startX - (newW - startW) / 2
      newY = startY - (newH - startH) / 2
      break
    }
  }

  return {
    x: Math.round(newX),
    y: Math.round(newY),
    scale: Number(Math.max(0.05, Math.min(10, newScale)).toFixed(3))
  }
}
