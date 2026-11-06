import React, { useEffect, useRef, type ReactNode } from 'react'

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
  children: ReactNode
}

/**
 * Floating popover flyout xuất hiện ngay cạnh icon trên Left Rail hoặc Right Rail của Xưởng Cắt Tách Sprite 2.5D.
 * Bắt sự kiện capture phase cho click-outside và phím Escape, ngăn chặn việc đóng nhầm dialog lớn.
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
  width = 280,
  children
}: SpriteCutterFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Element | null
      // Nếu click vào popup con chọn màu (portal), không đóng flyout cha
      if (target?.closest?.('.color-picker-popover, .custom-color-picker, .ps-eyedropper-box')) {
        return
      }

      if (ref.current && !ref.current.contains(target as Node)) {
        const parentBtn = ref.current.parentElement
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

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      className={`sc-flyout sc-flyout-${side} sc-flyout-${placement}`}
      style={{ width, maxWidth: 'calc(100vw - 120px)' }}
      role="dialog"
      aria-label={title}
    >
      <div className="sc-flyout-header">
        <div className="sc-flyout-title">
          {icon && <span className="sc-flyout-icon">{icon}</span>}
          <span>{title}</span>
          {badge !== undefined && <span className="sc-flyout-badge">{badge}</span>}
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
}
