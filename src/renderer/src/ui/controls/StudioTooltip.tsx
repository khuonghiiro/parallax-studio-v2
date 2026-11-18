import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../styles/studioTooltip.css'

export type StudioTooltipPlacement = 'top' | 'bottom' | 'left' | 'right'
export type StudioTooltipBadgeTone = 'cyan' | 'amber' | 'green' | 'neutral'

export interface StudioTooltipCoords {
  left: number
  top: number
  effectiveSide: StudioTooltipPlacement
  caretOffsetPx: number
}

/**
 * Tính toạ độ hiển thị `<StudioTooltip>` bám sát nút kích hoạt, tự động lật hướng nếu hết chỗ
 * và kẹp biên an toàn trong khung cửa sổ để không bao giờ bị cắt chữ ở mép màn hình.
 */
export function computeStudioTooltipPosition(
  anchor: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  tipSize: { width: number; height: number },
  viewport: { width: number; height: number },
  preferred: StudioTooltipPlacement = 'top',
  gap = 8
): StudioTooltipCoords {
  const pad = 8
  let side = preferred

  if (side === 'right' && anchor.right + gap + tipSize.width > viewport.width - pad && anchor.left - gap - tipSize.width >= pad) {
    side = 'left'
  } else if (side === 'left' && anchor.left - gap - tipSize.width < pad && anchor.right + gap + tipSize.width <= viewport.width - pad) {
    side = 'right'
  } else if (side === 'top' && anchor.top - gap - tipSize.height < pad && anchor.bottom + gap + tipSize.height <= viewport.height - pad) {
    side = 'bottom'
  } else if (side === 'bottom' && anchor.bottom + gap + tipSize.height > viewport.height - pad && anchor.top - gap - tipSize.height >= pad) {
    side = 'top'
  }

  const anchorCx = anchor.left + anchor.width / 2
  const anchorCy = anchor.top + anchor.height / 2

  if (side === 'right' || side === 'left') {
    const rawLeft = side === 'right' ? anchor.right + gap : anchor.left - gap - tipSize.width
    const left = Math.max(pad, Math.min(rawLeft, viewport.width - tipSize.width - pad))
    const rawTop = anchorCy - tipSize.height / 2
    const top = Math.max(pad, Math.min(rawTop, viewport.height - tipSize.height - pad))
    const caretOffsetPx = Math.max(10, Math.min(tipSize.height - 10, Math.round(anchorCy - top)))
    return { left: Math.round(left), top: Math.round(top), effectiveSide: side, caretOffsetPx }
  }

  const rawTop = side === 'top' ? anchor.top - gap - tipSize.height : anchor.bottom + gap
  const top = Math.max(pad, Math.min(rawTop, viewport.height - tipSize.height - pad))
  const rawLeft = anchorCx - tipSize.width / 2
  const left = Math.max(pad, Math.min(rawLeft, viewport.width - tipSize.width - pad))
  const caretOffsetPx = Math.max(12, Math.min(tipSize.width - 12, Math.round(anchorCx - left)))
  return { left: Math.round(left), top: Math.round(top), effectiveSide: side, caretOffsetPx }
}

export interface StudioTooltipProps {
  /** Tiêu đề chính ngắn gọn (VD: "Vẽ quỹ đạo tự do", "Tất cả tài nguyên") */
  title: string
  /** Mô tả ngắn giải thích tác dụng của công cụ */
  description?: string
  /** Nhãn phụ / phím tắt / trạng thái góc phải tiêu đề (VD: "BBox", "Đang bật", "Space") */
  badge?: string
  badgeTone?: StudioTooltipBadgeTone
  /** Dòng thông tin phụ dưới đáy (VD: khoảng thời gian "0.20s → 4.60s", số lượng mục) */
  meta?: string
  /** Hướng ưu tiên hiển thị so với nút */
  placement?: StudioTooltipPlacement
  /** Độ trễ mở tooltip (ms) — mặc định 70ms phản hồi tức thì như thanh Tài nguyên */
  delayMs?: number
  disabled?: boolean
  children: React.ReactElement
}

/**
 * Tooltip chuẩn Studio của Parallax Studio V2 (đồng bộ với thanh Icon Tài nguyên):
 * Render qua Portal `document.body` (`z-index: 55000`), chống cắt khuất bởi `overflow: hidden`,
 * tự ẩn khi nhấn chuột/cuộn/chạm cảm ứng và không chồng đè với `title` mặc định của trình duyệt.
 */
export const StudioTooltip: React.FC<StudioTooltipProps> = ({
  title,
  description,
  badge,
  badgeTone = 'cyan',
  meta,
  placement = 'top',
  delayMs = 35,
  disabled = false,
  children
}) => {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const lastTouchRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<StudioTooltipCoords | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearTimer()
    setOpen(false)
  }, [clearTimer])

  const openFromAnchor = useCallback(() => {
    const el = wrapRef.current
    if (el) {
      const targetEl = (el.firstElementChild as HTMLElement | null) ?? el
      const anchor = targetEl.getBoundingClientRect()
      setCoords(
        computeStudioTooltipPosition(
          anchor,
          { width: 204, height: description ? 58 : 34 },
          { width: window.innerWidth, height: window.innerHeight },
          placement
        )
      )
    }
    setOpen(true)
  }, [description, placement])

  const handleMouseEnter = useCallback(() => {
    if (disabled || lastTouchRef.current) return
    clearTimer()
    if (delayMs <= 0) {
      openFromAnchor()
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      openFromAnchor()
    }, delayMs)
  }, [disabled, clearTimer, delayMs, openFromAnchor])

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      lastTouchRef.current = e.pointerType === 'touch'
      if (disabled || e.pointerType === 'touch') return
      handleMouseEnter()
    },
    [disabled, handleMouseEnter]
  )

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !tipRef.current) return
    const targetEl = (wrapRef.current.firstElementChild as HTMLElement | null) ?? wrapRef.current
    const anchor = targetEl.getBoundingClientRect()
    const tipRect = tipRef.current.getBoundingClientRect()
    setCoords(
      computeStudioTooltipPosition(
        anchor,
        { width: tipRect.width || 204, height: tipRect.height || 54 },
        { width: window.innerWidth, height: window.innerHeight },
        placement
      )
    )
  }, [open, placement, title, description, badge, meta])

  useEffect(() => {
    if (!open) return
    const onDismiss = (): void => setOpen(false)
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <span
      ref={wrapRef}
      className="pxs-tooltip-anchor"
      onPointerEnter={handlePointerEnter}
      onMouseEnter={handleMouseEnter}
      onPointerLeave={hide}
      onMouseLeave={hide}
      onPointerDown={(e) => {
        lastTouchRef.current = e.pointerType === 'touch'
        hide()
      }}
    >
      {children}
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={tipRef}
            className="pxs-studio-tooltip"
            role="tooltip"
            data-side={coords?.effectiveSide ?? placement}
            style={{
              left: coords?.left ?? -9999,
              top: coords?.top ?? -9999,
              ['--caret-offset' as string]: coords ? `${coords.caretOffsetPx}px` : '50%'
            }}
          >
            <div className="pxs-tooltip-head">
              <span className="pxs-tooltip-title">{title}</span>
              {badge && <span className={`pxs-tooltip-badge is-${badgeTone}`}>{badge}</span>}
            </div>
            {description && <div className="pxs-tooltip-desc">{description}</div>}
            {meta && <div className="pxs-tooltip-meta">{meta}</div>}
          </div>,
          document.body
        )}
    </span>
  )
}
