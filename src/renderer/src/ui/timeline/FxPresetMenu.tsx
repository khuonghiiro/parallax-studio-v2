import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  applyFxPresetToSelectedLayer,
  FX_PRESETS,
  type FxPresetId,
  type FxPresetInfo
} from './timelineEffects'
import { IconSparkles } from '../icons'

export interface OpenFxMenuOptions {
  x: number
  y: number
  targetTime: number
  from?: 'button' | 'context'
  layerName?: string
}

type Listener = (opts: OpenFxMenuOptions) => void
const listeners = new Set<Listener>()

/** Programmatically open the FX preset menu at specific screen coordinates and time */
export function openFxPresetMenu(opts: OpenFxMenuOptions): void {
  listeners.forEach((fn) => fn(opts))
}

interface FxPresetMenuProps {
  time: number
  hasSelectedLayer: boolean
}

const POPOVER_W = 440
const POPOVER_H = 345

export function FxPresetMenu({ time, hasSelectedLayer }: FxPresetMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<FxPresetId>('blink')
  const [duration, setDuration] = useState<number>(1.0)
  const [blinks, setBlinks] = useState<number>(4)
  const [anchorPos, setAnchorPos] = useState<OpenFxMenuOptions | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const activePreset: FxPresetInfo =
    FX_PRESETS.find((p) => p.id === selectedId) ?? FX_PRESETS[0]

  // Listen to open requests from context menu or programmatic triggers
  useEffect(() => {
    const handleOpen = (opts: OpenFxMenuOptions) => {
      setAnchorPos(opts)
      setIsOpen(true)
    }
    listeners.add(handleOpen)
    return () => {
      listeners.delete(handleOpen)
    }
  }, [])

  // Update default duration when switching preset
  const handleSelectPreset = (p: FxPresetInfo) => {
    setSelectedId(p.id)
    setDuration(p.defaultDuration)
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const currentTime = anchorPos ? anchorPos.targetTime : time

  const handleApply = () => {
    const success = applyFxPresetToSelectedLayer(selectedId, {
      duration,
      targetTime: currentTime,
      blinks: selectedId === 'blink' ? blinks : undefined
    })
    if (success) {
      setIsOpen(false)
    }
  }

  const handleToolbarButtonClick = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setAnchorPos({
        x: rect.left,
        y: rect.top,
        targetTime: time,
        from: 'button'
      })
      setIsOpen(true)
    }
  }

  // Calculate intelligent viewport-clamped position
  let calculatedTop = 100
  let calculatedLeft = 100

  if (anchorPos) {
    // 1. Horizontal position clamping
    let left = anchorPos.x
    if (left + POPOVER_W > window.innerWidth - 16) {
      left = window.innerWidth - POPOVER_W - 16
    }
    if (left < 16) {
      left = 16
    }
    calculatedLeft = left

    // 2. Vertical position clamping (prefer opening above since timeline is at bottom)
    let top = 0
    if (anchorPos.from === 'button') {
      top = anchorPos.y - POPOVER_H - 8
      if (top < 16) {
        top = anchorPos.y + 36
      }
    } else {
      // From right-click context menu on layer bar
      top = anchorPos.y - POPOVER_H - 6
      if (top < 16) {
        top = anchorPos.y + 8
      }
    }

    if (top + POPOVER_H > window.innerHeight - 16) {
      top = window.innerHeight - POPOVER_H - 16
    }
    if (top < 16) {
      top = 16
    }
    calculatedTop = top
  }

  return (
    <div className="tl-fx-dropdown-container">
      <button
        ref={buttonRef}
        type="button"
        className={`btn ghost sm tl-action-btn tl-btn-fx ${isOpen ? 'active' : ''}`}
        title="Tạo hiệu ứng hoạt ảnh tại Playhead (Nhấp nháy, Mờ dần, Rung lắc...)"
        disabled={!hasSelectedLayer}
        onClick={handleToolbarButtonClick}
        style={{
          color: isOpen ? 'var(--accent-cyan)' : undefined,
          borderColor: isOpen ? 'var(--accent-cyan)' : undefined
        }}
      >
        <IconSparkles width={13} height={13} />
        <span>Hiệu ứng</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="tl-fx-popover-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background: 'transparent',
              pointerEvents: 'auto'
            }}
            onMouseDown={() => setIsOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault()
              setIsOpen(false)
            }}
          >
            <div
              ref={popoverRef}
              className="tl-fx-popover"
              style={{
                position: 'fixed',
                top: `${Math.round(calculatedTop)}px`,
                left: `${Math.round(calculatedLeft)}px`,
                width: `${POPOVER_W}px`,
                margin: 0,
                zIndex: 99999
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
            >
              <div className="tl-fx-popover-header">
                <div className="tl-fx-popover-title">
                  <IconSparkles width={14} height={14} style={{ color: 'var(--accent-cyan)' }} />
                  <span>
                    Hiệu Ứng Hoạt Ảnh
                    {anchorPos?.layerName ? ` · ${anchorPos.layerName}` : ''}
                  </span>
                </div>
                <span className="tl-fx-time-badge">@ {currentTime.toFixed(2)}s</span>
              </div>

              <div className="tl-fx-popover-body">
                {/* Left list of presets */}
                <div className="tl-fx-list">
                  <div className="tl-fx-group-label">Độ mờ &amp; Chớp tắt</div>
                  {FX_PRESETS.filter((p) => p.category === 'opacity').map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`tl-fx-item ${selectedId === p.id ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(p)}
                    >
                      <span className="tl-fx-item-badge">{p.badge}</span>
                      <div className="tl-fx-item-text">
                        <span className="tl-fx-item-name">{p.name}</span>
                      </div>
                    </button>
                  ))}

                  <div className="tl-fx-group-label" style={{ marginTop: 6 }}>
                    Vị trí &amp; Phóng to
                  </div>
                  {FX_PRESETS.filter((p) => p.category === 'transform').map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`tl-fx-item ${selectedId === p.id ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(p)}
                    >
                      <span className="tl-fx-item-badge">{p.badge}</span>
                      <div className="tl-fx-item-text">
                        <span className="tl-fx-item-name">{p.name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right configuration panel */}
                <div className="tl-fx-config">
                  <div className="tl-fx-desc-card">
                    <div className="tl-fx-desc-header">
                      <span style={{ fontSize: 16 }}>{activePreset.badge}</span>
                      <strong>{activePreset.name}</strong>
                    </div>
                    <p className="tl-fx-desc-p">{activePreset.description}</p>
                  </div>

                  {/* Duration configuration */}
                  <div className="tl-fx-field">
                    <label className="tl-fx-label">Thời lượng hiệu ứng (giây):</label>
                    <div className="tl-fx-duration-pills">
                      {[0.3, 0.5, 1.0, 1.5, 2.0].map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`tl-fx-pill ${duration === d ? 'active' : ''}`}
                          onClick={() => setDuration(d)}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <input
                        type="range"
                        min={0.1}
                        max={4.0}
                        step={0.05}
                        value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                      />
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          fontWeight: 700,
                          width: 38,
                          textAlign: 'right'
                        }}
                      >
                        {duration.toFixed(2)}s
                      </span>
                    </div>
                  </div>

                  {/* Specific options for blink */}
                  {selectedId === 'blink' && (
                    <div className="tl-fx-field">
                      <label className="tl-fx-label">Số lần chớp tắt (chu kỳ):</label>
                      <div className="tl-fx-duration-pills">
                        {[2, 4, 6, 8].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`tl-fx-pill ${blinks === c ? 'active' : ''}`}
                            onClick={() => setBlinks(c)}
                          >
                            {c} lần
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    className="btn primary sm tl-fx-apply-btn"
                    onClick={handleApply}
                  >
                    <span>Áp dụng tại {currentTime.toFixed(2)}s</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
