import React, { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

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
  width = 280,
  children
}: PhotoStudioFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isOpen) return
    const el = ref.current
    if (!el) return

    const updateVerticalPosition = (): void => {
      const parentItem = el.parentElement
      if (!parentItem) return
      const workspace = el.closest('.ps-workspace-layout') as HTMLElement | null
      const wsRect = workspace
        ? workspace.getBoundingClientRect()
        : { top: 48, bottom: window.innerHeight, height: window.innerHeight - 48 }
      const itemRect = parentItem.getBoundingClientRect()
      const flyoutHeight = el.offsetHeight

      const desiredViewportTop =
        placement === 'bottom' ? itemRect.bottom - flyoutHeight : itemRect.top
      const minTop = wsRect.top + 8
      const maxTop = Math.max(minTop, wsRect.bottom - flyoutHeight - 8)
      const clampedViewportTop = Math.max(minTop, Math.min(maxTop, desiredViewportTop))
      const offsetTop = Math.round(clampedViewportTop - itemRect.top)

      el.style.top = `${offsetTop}px`
      el.style.bottom = 'auto'
      el.style.maxHeight = `${Math.max(180, Math.floor(wsRect.height - 16))}px`
    }

    updateVerticalPosition()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateVerticalPosition) : null
    ro?.observe(el)
    window.addEventListener('resize', updateVerticalPosition)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateVerticalPosition)
    }
  }, [isOpen, placement, children])

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
        // Nếu popup con chọn màu đang mở, để popup con đóng trước
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
      className={`ps-flyout ps-flyout-${side} ps-flyout-${placement}`}
      style={{ width, maxWidth: 'calc(100vw - 120px)' }}
      role="dialog"
      aria-label={title}
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
            title="Đóng bảng này (Esc)"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="ps-flyout-body">{children}</div>
    </div>
  )
}
