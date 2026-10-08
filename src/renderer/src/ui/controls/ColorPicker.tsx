import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { nanoid } from 'nanoid'
import {
  hexToHsv,
  hsvToHex,
  isValidHex,
  normalizeHex,
  type HsvColor
} from './colorMath'

// Studio quick palette presets
const STUDIO_PRESETS = [
  '#000000',
  '#1a1d24',
  '#3b4252',
  '#70798c',
  '#ffffff',
  '#ff453a',
  '#ff9f0a',
  '#ffd60a',
  '#30d158',
  '#00e5ff',
  '#0a84ff',
  '#bf5af2'
]

export interface ColorInputProps {
  value: string
  onChange: (v: string, mergeKey: string) => void
  id?: string
  title?: string
  disabled?: boolean
  showText?: boolean
  compact?: boolean
  className?: string
  style?: CSSProperties
}

interface PopoverPos {
  top: number
  left: number
}

/**
 * Professional in-app Color Picker Popover with 60fps smooth dragging,
 * 2D Saturation/Value area, Hue slider, Hex editing, Eyedropper, and Presets.
 */
export function ColorInput({
  value,
  onChange,
  id,
  title,
  disabled = false,
  showText = true,
  compact = false,
  className = '',
  style
}: ColorInputProps) {
  const normValue = normalizeHex(value || '#ffffff')
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0 })

  // HSV representation kept in state while open to preserve Hue when S or V is 0
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(normValue))
  const [hexInput, setHexInput] = useState<string>(normValue)
  const [originalColor, setOriginalColor] = useState<string>(normValue)

  // Stable merge key per interaction session
  const mergeKeyRef = useRef(`color-${nanoid(6)}`)
  const pendingHexRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Schedule store commit throttled to once per animation frame
  const scheduleCommit = (hex: string): void => {
    pendingHexRef.current = hex
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        if (pendingHexRef.current !== null) {
          onChangeRef.current(pendingHexRef.current, mergeKeyRef.current)
        }
      })
    }
  }

  const flushCommit = (finalHex?: string): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const hex = finalHex ?? pendingHexRef.current
    if (hex !== null && hex !== undefined) {
      onChangeRef.current(hex, mergeKeyRef.current)
      pendingHexRef.current = null
    }
    mergeKeyRef.current = `color-${nanoid(6)}`
  }

  // Sync HSV when external value changes from outside (e.g. undo/redo) and not open
  useEffect(() => {
    if (!isOpen) {
      setHsv(hexToHsv(normValue))
      setHexInput(normValue)
    }
  }, [normValue, isOpen])

  // Open popover
  const handleOpen = (): void => {
    if (disabled) return
    const currentNorm = normalizeHex(value || '#ffffff')
    setOriginalColor(currentNorm)
    setHsv(hexToHsv(currentNorm))
    setHexInput(currentNorm)
    mergeKeyRef.current = `color-${nanoid(6)}`
    setIsOpen(true)
  }

  // Calculate popover positioning
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popW = 240
    const popH = 290
    const margin = 8

    let top = rect.bottom + margin
    let left = rect.left

    // If bottom overflows screen, flip to top
    if (top + popH > window.innerHeight && rect.top - popH - margin >= 0) {
      top = rect.top - popH - margin
    }
    // If right overflows screen, align to right
    if (left + popW > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - popW - margin)
    }

    setPos({ top, left })
  }, [isOpen])

  // Click outside and escape handling
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      flushCommit()
      setIsOpen(false)
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        flushCommit()
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isOpen])

  // Interactive 2D Saturation & Value drag
  const handleSVPointer = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    const updateFromCoord = (clientX: number, clientY: number): void => {
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
      const s = x / rect.width
      const v = 1 - y / rect.height
      const nextHsv = { ...hsv, s, v }
      setHsv(nextHsv)
      const nextHex = hsvToHex(nextHsv.h, s, v)
      setHexInput(nextHex)
      scheduleCommit(nextHex)
    }

    updateFromCoord(e.clientX, e.clientY)

    const onPointerMove = (ev: PointerEvent): void => {
      updateFromCoord(ev.clientX, ev.clientY)
    }

    const onPointerUp = (ev: PointerEvent): void => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      updateFromCoord(ev.clientX, ev.clientY)
      flushCommit()
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
  }

  // Interactive 1D Hue slider drag
  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    const updateHue = (clientX: number): void => {
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const h = Math.round((x / rect.width) * 360) % 360
      const nextHsv = { ...hsv, h }
      setHsv(nextHsv)
      const nextHex = hsvToHex(h, nextHsv.s, nextHsv.v)
      setHexInput(nextHex)
      scheduleCommit(nextHex)
    }

    updateHue(e.clientX)

    const onPointerMove = (ev: PointerEvent): void => {
      updateHue(ev.clientX)
    }

    const onPointerUp = (ev: PointerEvent): void => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      updateHue(ev.clientX)
      flushCommit()
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
  }

  // Apply a direct hex (from text input, preset, or eyedropper)
  const applyHex = (hex: string): void => {
    const norm = normalizeHex(hex)
    setHsv(hexToHsv(norm))
    setHexInput(norm)
    flushCommit(norm)
  }

  // Pick color from screen via EyeDropper API if available
  const handleEyeDropper = async (): Promise<void> => {
    try {
      // @ts-expect-error EyeDropper is a standard Web API in Chromium
      if (typeof window !== 'undefined' && window.EyeDropper) {
        // @ts-expect-error EyeDropper constructor
        const eyeDropper = new window.EyeDropper()
        const res = await eyeDropper.open()
        if (res?.sRGBHex) {
          applyHex(res.sRGBHex)
        }
      }
    } catch {
      // User cancelled eyedropper
    }
  }

  const currentColorHex = hsvToHex(hsv.h, hsv.s, hsv.v)
  const hueColor = hsvToHex(hsv.h, 1, 1)

  return (
    <div
      className={`color-picker-wrap${compact ? ' compact' : ''} ${className}`}
      style={style}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="color-swatch-trigger"
        onClick={handleOpen}
        title={title ?? `Chọn màu (Hiện tại: ${normValue})`}
        disabled={disabled}
      >
        <span
          className="color-swatch-preview"
          style={{ backgroundColor: normValue }}
        />
        {showText && !compact && (
          <span className="color-swatch-hex">{normValue}</span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="color-picker-popover"
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              zIndex: 9999
            }}
          >
            {/* 2D Saturation / Value Area */}
            <div
              className="cp-sv-box"
              style={{ backgroundColor: hueColor }}
              onPointerDown={handleSVPointer}
            >
              <div className="cp-sv-white" />
              <div className="cp-sv-black" />
              <div
                className="cp-sv-thumb"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: currentColorHex
                }}
              />
            </div>

            {/* 1D Hue Slider */}
            <div className="cp-hue-slider" onPointerDown={handleHuePointer}>
              <div
                className="cp-hue-thumb"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: hueColor
                }}
              />
            </div>

            {/* Preview, Revert & Eyedropper row */}
            <div className="cp-meta-row">
              <div className="cp-preview-split">
                <button
                  type="button"
                  className="cp-preview-current"
                  style={{ backgroundColor: currentColorHex }}
                  title="Màu đang chọn"
                />
                <button
                  type="button"
                  className="cp-preview-orig"
                  style={{ backgroundColor: originalColor }}
                  onClick={() => applyHex(originalColor)}
                  title="Nhấn để khôi phục màu ban đầu"
                />
              </div>

              {/* Eyedropper button */}
              {typeof window !== 'undefined' && 'EyeDropper' in window && (
                <button
                  type="button"
                  className="cp-eyedropper-btn"
                  onClick={handleEyeDropper}
                  title="Hút màu từ màn hình"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m14 7 3 3m-9 9 9-9a2.12 2.12 0 0 0 0-3l-2-2a2.12 2.12 0 0 0-3 0l-9 9a2 2 0 0 0-.58 1.42V19h3.58a2 2 0 0 0 1.42-.58Z" />
                    <path d="M19 11 21 9a2.12 2.12 0 0 0 0-3l-2-2a2.12 2.12 0 0 0-3 0l-2 2" />
                  </svg>
                </button>
              )}

              {/* Hex Input */}
              <div className="cp-hex-input-wrap">
                <span className="cp-hex-hash">#</span>
                <input
                  type="text"
                  className="cp-hex-input"
                  value={hexInput.replace(/^#/, '')}
                  maxLength={6}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9a-fA-F]/g, '')
                    setHexInput(`#${clean}`)
                    if (isValidHex(clean)) {
                      const fullHex = normalizeHex(clean)
                      setHsv(hexToHsv(fullHex))
                      scheduleCommit(fullHex)
                    }
                  }}
                  onBlur={() => {
                    const norm = normalizeHex(hexInput, originalColor)
                    applyHex(norm)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const norm = normalizeHex(hexInput, originalColor)
                      applyHex(norm)
                      ;(e.target as HTMLInputElement).blur()
                    }
                  }}
                />
              </div>
            </div>

            {/* Quick studio presets */}
            <div className="cp-presets-grid">
              {STUDIO_PRESETS.map((p) => {
                const isSelected = p.toLowerCase() === currentColorHex.toLowerCase()
                return (
                  <button
                    key={p}
                    type="button"
                    className={`cp-preset-chip${isSelected ? ' active' : ''}`}
                    style={{ backgroundColor: p }}
                    onClick={() => applyHex(p)}
                    title={p}
                  />
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
