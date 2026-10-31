import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'

export interface PinchPanUpdate {
  /** Tỉ lệ khoảng cách 2 ngón tay so với frame trước (>1: phóng to, <1: thu nhỏ) */
  scaleFactor: number
  /** Độ dịch chuyển tâm 2 ngón tay theo trục X (px) */
  dx: number
  /** Độ dịch chuyển tâm 2 ngón tay theo trục Y (px) */
  dy: number
  /** Tọa độ X của tâm 2 ngón tay tính từ mép trái phần tử */
  centerX: number
  /** Tọa độ Y của tâm 2 ngón tay tính từ mép trên phần tử */
  centerY: number
  /** Tọa độ clientX của tâm 2 ngón tay */
  clientX: number
  /** Tọa độ clientY của tâm 2 ngón tay */
  clientY: number
  rect: DOMRect
}

/**
 * Hỗ trợ cử chỉ cảm ứng đa điểm (2 ngón tay chụm/mở để Zoom + kéo 2 ngón để Lia/Pan)
 * cho toàn bộ các khung nhìn 2D, 3D và sơ đồ Workflow trên Điện thoại, iPad & Tablet.
 */
export function usePinchPanGesture(
  targetRef: RefObject<HTMLElement | null>,
  onPinchPan: (ev: PinchPanUpdate) => void,
  enabled = true
): MutableRefObject<boolean> {
  const isMultiTouchRef = useRef(false)
  const cbRef = useRef(onPinchPan)
  cbRef.current = onPinchPan

  useEffect(() => {
    const el = targetRef.current
    if (!el || !enabled) return

    let prevDist = 0
    let prevMidX = 0
    let prevMidY = 0
    let active = false

    const measure = (touches: TouchList): { dist: number; midX: number; midY: number } => {
      const t0 = touches[0]!
      const t1 = touches[1]!
      const midX = (t0.clientX + t1.clientX) * 0.5
      const midY = (t0.clientY + t1.clientY) * 0.5
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      return { dist, midX, midY }
    }

    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length >= 2) {
        const m = measure(e.touches)
        prevDist = Math.max(8, m.dist)
        prevMidX = m.midX
        prevMidY = m.midY
        active = true
        isMultiTouchRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent): void => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const m = measure(e.touches)
      if (!active || prevDist <= 0) {
        prevDist = Math.max(8, m.dist)
        prevMidX = m.midX
        prevMidY = m.midY
        active = true
        isMultiTouchRef.current = true
        return
      }

      const nextDist = Math.max(8, m.dist)
      const rawScale = nextDist / prevDist
      const scaleFactor = Math.max(0.75, Math.min(1.35, rawScale))
      const dx = m.midX - prevMidX
      const dy = m.midY - prevMidY

      prevDist = nextDist
      prevMidX = m.midX
      prevMidY = m.midY

      if (Math.abs(scaleFactor - 1) < 0.0015 && Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
        return
      }

      const rect = el.getBoundingClientRect()
      cbRef.current({
        scaleFactor,
        dx,
        dy,
        centerX: m.midX - rect.left,
        centerY: m.midY - rect.top,
        clientX: m.midX,
        clientY: m.midY,
        rect
      })
    }

    const onTouchEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) {
        active = false
        prevDist = 0
        if (e.touches.length === 0) {
          isMultiTouchRef.current = false
        }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      isMultiTouchRef.current = false
    }
  }, [targetRef, enabled])

  return isMultiTouchRef
}
