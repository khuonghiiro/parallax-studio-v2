import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SpriteCutterFlyoutProps {
  isOpen: boolean
  onClose: () => void
  side: 'left' | 'right'
  placement?: 'top' | 'bottom'
  title: string
  icon?: ReactNode
  badge?: string | number
  onReset?: () => void
  resetTitle?: string
  width?: number
  isProcessing?: boolean
  children: ReactNode
}

/**
 * Floating popover flyout xuất hiện ngay cạnh icon trên Left Rail hoặc Right Rail của Xưởng Cắt Tách Sprite 2.5D.
 * Định vị cố định (fixed portal) vươn sang phía bên phải của nút để tránh đè lên ảnh đang cắt tách bên trái,
 * đồng thời thoát khỏi mọi vùng overflow: hidden của các pane cha.
 */
export function SpriteCutterFlyout({
  isOpen,
  onClose,
  side,
  placement = 'top',
  title,
  icon,
  badge,
  onReset,
  resetTitle = 'Đặt lại',
  width = 310,
  isProcessing,
  children
}: SpriteCutterFlyoutProps) {
  const flyoutRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const parent = anchorRef.current?.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()

      // Mặc định luôn mở sang phía bên PHẢI của thanh rail (trên khoảng trống của Bố cục 2D)
      let left = rect.right + 10
      if (left + width > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - width - 10)
      }

      let top = rect.top
      const maxTop = window.innerHeight - 560
      if (top > maxTop) {
        top = Math.max(10, maxTop)
      }

      setCoords({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, width])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Element | null
      // Nếu click vào popup con chọn màu (portal), không đóng flyout cha
      if (target?.closest?.('.color-picker-popover, .custom-color-picker, .ps-eyedropper-box')) {
        return
      }

      const parentBtn = anchorRef.current?.parentElement
      if (flyoutRef.current && !flyoutRef.current.contains(target as Node)) {
        if (!parentBtn?.contains(target as Node)) {
          onClose()
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (document.querySelector('.color-picker-popover')) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return <span ref={anchorRef} style={{ display: 'none' }} aria-hidden />
  }

  const flyoutStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords ? coords.top : 20,
    left: coords ? coords.left : 20,
    width,
    maxWidth: 'calc(100vw - 120px)',
    zIndex: 50000
  }

  const content = (
    <div
      ref={flyoutRef}
      className={`sc-flyout sc-flyout-${side} sc-flyout-${placement}`}
      style={flyoutStyle}
      role="dialog"
      aria-label={title}
    >
      <div className="sc-flyout-header">
        <div className="sc-flyout-title">
          {icon && <span className="sc-flyout-icon">{icon}</span>}
          <span>{title}</span>
          {badge !== undefined && <span className="sc-flyout-badge">{badge}</span>}
          {isProcessing && (
            <span
              className="sc-flyout-processing-badge"
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: 'var(--accent-cyan)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              ⏳ Đang xử lý…
            </span>
          )}
        </div>
        <div className="sc-flyout-actions">
          {onReset && (
            <button
              type="button"
              className="sc-flyout-btn-reset"
              onClick={onReset}
              title={resetTitle}
            >
              ↺ Đặt lại
            </button>
          )}
          <button
            type="button"
            className="sc-flyout-btn-close"
            onClick={onClose}
            title="Đóng bảng tinh chỉnh (Esc)"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="sc-flyout-body">{children}</div>
    </div>
  )

  return (
    <>
      <span ref={anchorRef} style={{ display: 'none' }} aria-hidden />
      {typeof document !== 'undefined' ? createPortal(content, document.body) : content}
    </>
  )
}
