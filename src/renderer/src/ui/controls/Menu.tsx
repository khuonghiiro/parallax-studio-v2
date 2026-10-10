import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { IconChevronDown } from '../icons'

export interface MenuProps {
  label: string
  icon?: ReactNode
  children: ReactNode
  id?: string
  className?: string
  btnClassName?: string
  disabled?: boolean
  align?: 'left' | 'right'
  title?: string
  style?: CSSProperties
}

/**
 * Reusable dropdown Menu component with 60fps instant opening (0ms),
 * styled via CSS tokens, auto click-outside listener, and Escape key handling.
 * Modeled after the main screen "Thêm layer" menu.
 */
export function Menu({
  label,
  icon,
  children,
  id,
  className = '',
  btnClassName = '',
  disabled = false,
  align = 'left',
  title,
  style
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={`menu-wrap${open ? ' open' : ''} ${className}`} ref={ref} style={style}>
      <button
        id={id}
        type="button"
        className={`btn${btnClassName ? ' ' + btnClassName : ''}${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon}
        {label}
        <IconChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
      </button>
      {open && (
        <div
          className={`menu${align === 'right' ? ' right' : ''}`}
          onClick={() => setOpen(false)}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}
