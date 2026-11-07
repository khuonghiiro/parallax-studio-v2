import { useState, useCallback } from 'react'

export interface UseLayerAssemblySplittersReturn {
  eraserHeight: number
  eraserColWidth: number
  handleRowSplitterPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  handleColSplitterPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
}

/**
 * Quản lý độ rộng cột và chiều cao hàng của khung tẩy xóa (Eraser Splitters)
 * khi người dùng kéo thanh chia trên sân khấu 2D.
 */
export function useLayerAssemblySplitters(
  initialHeight = 250,
  initialColWidth = 380
): UseLayerAssemblySplittersReturn {
  const [eraserHeight, setEraserHeight] = useState(initialHeight)
  const [eraserColWidth, setEraserColWidth] = useState(initialColWidth)

  const handleRowSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startY = e.clientY
      const startHeight = eraserHeight
      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {}

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startY - moveEvent.clientY
        const newHeight = Math.max(160, Math.min(480, startHeight + deltaY))
        setEraserHeight(newHeight)
      }

      const onPointerUp = (upEvent: PointerEvent) => {
        try {
          if (target.hasPointerCapture(upEvent.pointerId)) {
            target.releasePointerCapture(upEvent.pointerId)
          }
        } catch {}
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [eraserHeight]
  )

  const handleColSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = eraserColWidth
      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {}

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX
        const newWidth = Math.max(280, Math.min(580, startWidth + deltaX))
        setEraserColWidth(newWidth)
      }

      const onPointerUp = (upEvent: PointerEvent) => {
        try {
          if (target.hasPointerCapture(upEvent.pointerId)) {
            target.releasePointerCapture(upEvent.pointerId)
          }
        } catch {}
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [eraserColWidth]
  )

  return {
    eraserHeight,
    eraserColWidth,
    handleRowSplitterPointerDown,
    handleColSplitterPointerDown
  }
}
