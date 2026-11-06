import React, { useEffect, useRef, type ReactNode } from 'react'

export interface PhotoStudioFlyoutProps {
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
 * Reusable Photoshop-style floating popover flyout that appears directly
 * next to a tool icon on the left or right rail.
 */
export function PhotoStudioFlyout({
  isOpen,
  onClose,
  side,
  placement = 'top',
  title,
  icon,
  badge,
  onReset,
  resetTitle = 'Đặt lại',
  width = 240,
  children
}: PhotoStudioFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const parentBtn = ref.current.parentElement
        if (!parentBtn?.contains(e.target as Node)) {
          onClose()
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      className={`ps-flyout ps-flyout-${side} ps-flyout-${placement}`}
      style={{ width }}
      role="dialog"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="ps-flyout-header">
        <div className="ps-flyout-title">
          {icon && <span className="ps-flyout-icon">{icon}</span>}
          <span>{title}</span>
          {badge !== undefined && <span className="ps-flyout-badge">{badge}</span>}
        </div>
        <div className="ps-flyout-actions">
          {onReset && (
            <button
              type="button"
              className="ps-flyout-btn-reset"
              onClick={onReset}
              title={resetTitle}
            >
              ↺ Đặt lại
            </button>
          )}
          <button
            type="button"
            className="ps-flyout-btn-close"
            onClick={onClose}
            title="Đóng bảng này"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="ps-flyout-body">{children}</div>
    </div>
  )
}
