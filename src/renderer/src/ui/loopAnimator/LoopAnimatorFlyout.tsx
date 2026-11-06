import React, { useEffect, useRef, type ReactNode } from 'react'

export interface LoopAnimatorFlyoutProps {
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
 * Floating popover flyout xuất hiện ngay cạnh icon trên Left Rail hoặc Right Rail của Xưởng Loop Animator.
 * Bắt sự kiện capture phase cho click-outside và phím Escape.
 */
export function LoopAnimatorFlyout({
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
}: LoopAnimatorFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Element | null
      // Nếu click vào popup con chọn màu (portal), không đóng flyout cha
      if (target?.closest?.('.color-picker-popover, .custom-color-picker')) {
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
      className={`la-flyout la-flyout-${side} la-flyout-${placement}`}
      style={{ width, maxWidth: 'calc(100vw - 120px)' }}
      role="dialog"
      aria-label={title}
    >
      <div className="la-flyout-header">
        <div className="la-flyout-title">
          {icon && <span className="la-flyout-icon">{icon}</span>}
          <span>{title}</span>
          {badge !== undefined && <span className="la-flyout-badge">{badge}</span>}
        </div>
        <div className="la-flyout-actions">
          {onReset && (
            <button
              type="button"
              className="la-flyout-btn-reset"
              onClick={onReset}
              title={resetTitle}
            >
              ↺ Đặt lại
            </button>
          )}
          <button
            type="button"
            className="la-flyout-btn-close"
            onClick={onClose}
            title="Đóng bảng (Esc)"
            aria-label="Đóng bảng"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="la-flyout-body">{children}</div>
    </div>
  )
}
