import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T = string | number> {
  value: T
  label: string
  sub?: string
  icon?: ReactNode
}

export interface CustomSelectProps<T = string | number> {
  value: T
  onChange: (value: T) => void
  options: (SelectOption<T> | T)[]
  id?: string
  className?: string
  title?: string
  disabled?: boolean
  placeholder?: string
  style?: CSSProperties
  dropdownWidth?: number | string
  zIndex?: number
  size?: 'sm' | 'md'
}

interface DropdownPos {
  top: number
  left: number
  width: number
  flipUp: boolean
}

/**
 * High-performance, lightweight in-app Select/Combobox component.
 * Opens in 0ms (no native OS window spawn or 2s freeze on initial startup).
 * Supports keyboard navigation, auto-flip positioning, and theme variables.
 */
export function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  id,
  className = '',
  title,
  disabled = false,
  placeholder,
  style,
  dropdownWidth,
  zIndex = 50000,
  size
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0, flipUp: false })

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption<T>[] = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
      return opt as SelectOption<T>
    }
    return {
      value: opt as T,
      label: String(opt)
    }
  })

  const currentOption = normalizedOptions.find((o) => o.value === value)
  const displayLabel = currentOption ? currentOption.label : placeholder ?? String(value)

  // Calculate position on open
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const margin = 4
    const approxH = Math.min(260, normalizedOptions.length * 30 + 8)

    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < approxH && rect.top > approxH

    const top = flipUp ? rect.top - approxH - margin : rect.bottom + margin
    const left = rect.left
    const width = typeof dropdownWidth === 'number' ? dropdownWidth : rect.width

    setPos({ top, left, width, flipUp })
  }, [isOpen, normalizedOptions.length, dropdownWidth])

  // Open & set highlight to current selected index
  const handleOpen = (): void => {
    if (disabled) return
    const idx = normalizedOptions.findIndex((o) => o.value === value)
    setHighlightIdx(idx >= 0 ? idx : 0)
    setIsOpen(true)
  }

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightIdx < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('.custom-select-item')
    const target = items[highlightIdx] as HTMLElement | undefined
    target?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, highlightIdx])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleOpen()
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => (prev + 1) % normalizedOptions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlightIdx >= 0 && highlightIdx < normalizedOptions.length) {
        onChange(normalizedOptions[highlightIdx].value)
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
  }

  const handleSelectOption = (opt: SelectOption<T>): void => {
    onChange(opt.value)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={`custom-select-wrap ${size ? size + ' ' : ''}${className}`} style={style}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`custom-select-trigger${size === 'sm' ? ' sm' : ''}${isOpen ? ' open' : ''}`}
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        onKeyDown={handleKeyDown}
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-label">
          {currentOption?.icon && <span className="custom-select-icon">{currentOption.icon}</span>}
          {displayLabel}
        </span>
        <span className="custom-select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            className={`custom-select-dropdown${pos.flipUp ? ' flip-up' : ''}`}
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              minWidth: `${pos.width}px`,
              zIndex
            }}
            role="listbox"
          >
            {normalizedOptions.map((opt, i) => {
              const isSelected = opt.value === value
              const isHighlighted = i === highlightIdx
              return (
                <div
                  key={String(opt.value)}
                  className={`custom-select-item${isSelected ? ' selected' : ''}${
                    isHighlighted ? ' highlighted' : ''
                  }`}
                  onClick={() => handleSelectOption(opt)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {opt.icon && <span className="custom-select-item-icon">{opt.icon}</span>}
                  <span className="custom-select-item-text">{opt.label}</span>
                  {opt.sub && <span className="custom-select-item-sub">{opt.sub}</span>}
                  {isSelected && <span className="custom-select-item-check">✓</span>}
                </div>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
