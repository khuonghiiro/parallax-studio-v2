import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import {
  computeCursorAnchoredZoom,
  computeSpacePanOffset,
  isEditableElementForSpacePan
} from './cutterHelpers'

export interface UseViewportSpacePanOptions {
  viewportRef: RefObject<HTMLElement | null>
  panOffset: { x: number; y: number }
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
}

export function useViewportSpacePan({
  viewportRef,
  panOffset,
  setPanOffset
}: UseViewportSpacePanOptions) {
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isSpacePanning, setIsSpacePanning] = useState(false)

  const isSpacePressedRef = useRef(false)
  const isSpacePanningRef = useRef(false)
  const panOffsetRef = useRef(panOffset)
  panOffsetRef.current = panOffset

  const panSessionRef = useRef<{
    startX: number
    startY: number
    origPanX: number
    origPanY: number
    pointerId: number
  } | null>(null)

  const syncDomCursor = useCallback(
    (spaceActive: boolean, panningActive: boolean) => {
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('cutter-space-pan-ready', spaceActive && !panningActive)
        document.body.classList.toggle('cutter-space-panning', panningActive)
      }
      const el = viewportRef.current
      if (el) {
        el.style.cursor = panningActive ? 'grabbing' : spaceActive ? 'grab' : ''
      }
    },
    [viewportRef]
  )

  const stopSpacePanSession = useCallback(() => {
    if (isSpacePanningRef.current) {
      isSpacePanningRef.current = false
      setIsSpacePanning(false)
    }
    const session = panSessionRef.current
    if (session && viewportRef.current) {
      try {
        viewportRef.current.releasePointerCapture(session.pointerId)
      } catch {}
    }
    panSessionRef.current = null
    syncDomCursor(isSpacePressedRef.current, false)
  }, [viewportRef, syncDomCursor])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null
      if (isEditableElementForSpacePan(e.target) || isEditableElementForSpacePan(activeEl)) return
      if (activeEl instanceof HTMLElement && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT')) {
        try {
          activeEl.blur()
        } catch {}
      }
      e.preventDefault()
      if (!isSpacePressedRef.current) {
        isSpacePressedRef.current = true
        setIsSpacePressed(true)
        syncDomCursor(true, isSpacePanningRef.current)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null
      if (!isEditableElementForSpacePan(e.target) && !isEditableElementForSpacePan(activeEl)) {
        e.preventDefault()
      }
      if (isSpacePressedRef.current) {
        isSpacePressedRef.current = false
        setIsSpacePressed(false)
      }
      stopSpacePanSession()
      syncDomCursor(false, false)
    }

    const onWindowBlur = () => {
      if (isSpacePressedRef.current) {
        isSpacePressedRef.current = false
        setIsSpacePressed(false)
      }
      stopSpacePanSession()
      syncDomCursor(false, false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
      syncDomCursor(false, false)
    }
  }, [stopSpacePanSession, syncDomCursor])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onPointerDownCapture = (e: PointerEvent) => {
      if (!isSpacePressedRef.current || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      isSpacePanningRef.current = true
      setIsSpacePanning(true)
      syncDomCursor(true, true)
      panSessionRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: panOffsetRef.current.x,
        origPanY: panOffsetRef.current.y,
        pointerId: e.pointerId
      }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {}
    }

    const onPointerMoveCapture = (e: PointerEvent) => {
      if (!isSpacePanningRef.current || !panSessionRef.current) return
      if (!isSpacePressedRef.current) {
        stopSpacePanSession()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const s = panSessionRef.current
      setPanOffset(
        computeSpacePanOffset(s.origPanX, s.origPanY, s.startX, s.startY, e.clientX, e.clientY)
      )
    }

    const onPointerUpCapture = (e: PointerEvent) => {
      if (!isSpacePanningRef.current) return
      e.preventDefault()
      e.stopPropagation()
      stopSpacePanSession()
    }

    const onSuppressWhenSpace = (e: Event) => {
      if (!isSpacePressedRef.current) return
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('pointerdown', onPointerDownCapture, { capture: true })
    el.addEventListener('pointermove', onPointerMoveCapture, { capture: true })
    el.addEventListener('pointerup', onPointerUpCapture, { capture: true })
    el.addEventListener('pointercancel', onPointerUpCapture, { capture: true })
    el.addEventListener('click', onSuppressWhenSpace, { capture: true })
    el.addEventListener('dragstart', onSuppressWhenSpace, { capture: true })

    return () => {
      el.removeEventListener('pointerdown', onPointerDownCapture, { capture: true })
      el.removeEventListener('pointermove', onPointerMoveCapture, { capture: true })
      el.removeEventListener('pointerup', onPointerUpCapture, { capture: true })
      el.removeEventListener('pointercancel', onPointerUpCapture, { capture: true })
      el.removeEventListener('click', onSuppressWhenSpace, { capture: true })
      el.removeEventListener('dragstart', onSuppressWhenSpace, { capture: true })
    }
  }, [viewportRef, setPanOffset, stopSpacePanSession, syncDomCursor])

  const spacePanClassName = isSpacePanning
    ? 'is-space-panning'
    : isSpacePressed
      ? 'is-space-pan-ready'
      : ''

  return {
    isSpacePressed,
    isSpacePanning,
    spacePanClassName
  }
}

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

  const { isSpacePressed, isSpacePanning, spacePanClassName } = useViewportSpacePan({
    viewportRef,
    panOffset,
    setPanOffset
  })

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
    isSpacePressed,
    isSpacePanning,
    spacePanClassName,
    stepZoom,
    handleSetZoomMode,
    resetZoomToFit,
    setZoomMode,
    setPanOffset
  }
}
