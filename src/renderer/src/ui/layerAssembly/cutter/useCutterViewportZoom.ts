import { useState, useEffect, useCallback, type RefObject } from 'react'
import { computeCursorAnchoredZoom } from './cutterHelpers'

export interface UseCutterViewportZoomOptions {
  viewportRef: RefObject<HTMLElement | null>
  naturalWidth: number
  naturalHeight: number
  padding?: number
  minScale?: number
  maxScale?: number
  defaultViewportSize?: { w: number; h: number }
}

export function useCutterViewportZoom({
  viewportRef,
  naturalWidth,
  naturalHeight,
  padding = 28,
  minScale = 0.15,
  maxScale = 4.0,
  defaultViewportSize = { w: 560, h: 460 }
}: UseCutterViewportZoomOptions) {
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(defaultViewportSize)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewportRef])

  const availW = Math.max(180, viewportSize.w - padding)
  const availH = Math.max(180, viewportSize.h - padding)
  const fitScale = Math.min(
    1,
    availW / Math.max(1, naturalWidth),
    availH / Math.max(1, naturalHeight)
  )
  const effectiveScale = zoomMode === 'fit' ? fitScale : zoomMode
  const displayW = Math.max(1, Math.round(naturalWidth * effectiveScale))
  const displayH = Math.max(1, Math.round(naturalHeight * effectiveScale))
  const scaleX = displayW / Math.max(1, naturalWidth)
  const scaleY = displayH / Math.max(1, naturalHeight)

  const stepZoom = useCallback(
    (delta: number) => {
      const next = Math.min(maxScale, Math.max(minScale, Number((effectiveScale + delta).toFixed(2))))
      setZoomMode(next)
    },
    [effectiveScale, maxScale, minScale]
  )

  const handleSetZoomMode = useCallback((mode: 'fit' | number) => {
    setZoomMode(mode)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  const resetZoomToFit = useCallback(() => {
    setZoomMode('fit')
    setPanOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vpCenterX = rect.left + rect.width / 2
      const vpCenterY = rect.top + rect.height / 2
      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const rawNextScale = effectiveScale * zoomFactor
      const anchored = computeCursorAnchoredZoom({
        cursorClientX: e.clientX,
        cursorClientY: e.clientY,
        viewportCenterX: vpCenterX,
        viewportCenterY: vpCenterY,
        currentPanX: panOffset.x,
        currentPanY: panOffset.y,
        oldScale: effectiveScale,
        newScale: rawNextScale,
        minScale: Math.min(minScale, fitScale * 0.5),
        maxScale
      })
      setZoomMode(anchored.scale)
      setPanOffset({ x: anchored.panX, y: anchored.panY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewportRef, effectiveScale, fitScale, panOffset.x, panOffset.y, minScale, maxScale])

  return {
    viewportSize,
    zoomMode,
    panOffset,
    fitScale,
    effectiveScale,
    displayW,
    displayH,
    scaleX,
    scaleY,
    stepZoom,
    handleSetZoomMode,
    resetZoomToFit,
    setZoomMode,
    setPanOffset
  }
}
