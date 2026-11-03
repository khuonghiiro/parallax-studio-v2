import { useEffect, useState, type RefObject } from 'react'

export interface FitSize {
  width: number
  height: number
}

/**
 * Tính kích thước hiển thị "contain" (giữ đúng tỉ lệ ảnh, vừa khít khung) cho ảnh nguồn
 * `srcW × srcH` bên trong phần tử `containerRef` (trừ padding) — tự cập nhật khi khung đổi kích thước.
 * Dùng thay cho `aspect-ratio + max-height` vì khi bị chặn chiều cao trình duyệt sẽ bóp méo canvas.
 */
export function useContainFitSize(
  containerRef: RefObject<HTMLElement | null>,
  srcW: number,
  srcH: number,
  maxWidth = 960
): FitSize {
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = (): void => {
      const cs = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
      const h = el.clientHeight - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0')
      setBox((prev) => (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return computeContainFit(srcW, srcH, Math.min(maxWidth, box.w), box.h)
}

/** Kích thước lớn nhất giữ nguyên tỉ lệ `srcW:srcH` nằm gọn trong `availW × availH` (thuần, dễ kiểm thử) */
export function computeContainFit(srcW: number, srcH: number, availW: number, availH: number): FitSize {
  const sw = Math.max(1, srcW || 1)
  const sh = Math.max(1, srcH || 1)
  const aw = Math.max(0, availW)
  const ah = Math.max(0, availH)
  if (aw <= 0 || ah <= 0) return { width: 0, height: 0 }
  const scale = Math.min(aw / sw, ah / sh)
  return { width: Math.floor(sw * scale), height: Math.floor(sh * scale) }
}
