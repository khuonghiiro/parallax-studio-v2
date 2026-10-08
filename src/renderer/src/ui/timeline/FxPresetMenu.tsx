import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GlowSide } from '@shared/types'
import {
  applyFxPresetToSelectedLayer,
  FX_PRESETS,
  type FxPresetId,
  type FxPresetInfo
} from './timelineEffects'
import { IconSparkles } from '../icons'
import { ColorInput } from '../controls'
import { renderFxIcon } from './fxIcons'

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

const POPOVER_W = 560
const POPOVER_H = 460

import { NEON_PRESETS, FxTransformConfigFields } from './FxConfigPanels'

export function FxPresetMenu({ time, hasSelectedLayer }: FxPresetMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<FxPresetId>('neonBreathe')
  const [duration, setDuration] = useState<number>(1.5)
  const [blinks, setBlinks] = useState<number>(4)
  const [shakes, setShakes] = useState<number>(5)
  const [shakeIntensity, setShakeIntensity] = useState<number>(18)
  const [bounces, setBounces] = useState<number>(2)
  const [bounceScale, setBounceScale] = useState<number>(1.2)
  const [pulses, setPulses] = useState<number>(2)
  const [pulseFactor, setPulseFactor] = useState<number>(1.25)
  const [glowColor, setGlowColor] = useState<string>('#3dd6f5')
  const [glowSide, setGlowSide] = useState<GlowSide>('outer')
  const [glowThickness, setGlowThickness] = useState<number>(10)
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
    if (p.id === 'shake') {
      setShakes(5)
      setShakeIntensity(18)
    } else if (p.id === 'popIn') {
      setBounces(2)
      setBounceScale(1.2)
    } else if (p.id === 'pulse') {
      setPulses(2)
      setPulseFactor(1.25)
    }
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
    const isGlow = activePreset.category === 'glow'
    let intensity: number | undefined = undefined
    if (selectedId === 'shake') intensity = shakeIntensity
    else if (selectedId === 'popIn') intensity = bounceScale
    else if (selectedId === 'pulse') intensity = pulseFactor

    const success = applyFxPresetToSelectedLayer(selectedId, {
      duration,
      targetTime: currentTime,
      blinks: selectedId === 'blink' || selectedId === 'neonBlink' ? blinks : undefined,
      shakes: selectedId === 'shake' ? shakes : undefined,
      bounces: selectedId === 'popIn' ? bounces : undefined,
      pulses: selectedId === 'pulse' ? pulses : undefined,
      intensity,
      color: isGlow ? glowColor : undefined,
      side: isGlow ? glowSide : undefined,
      thickness: isGlow ? glowThickness : undefined
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
        title="Tạo hiệu ứng hoạt ảnh tại Playhead (Viền Neon, Nhấp nháy, Mờ dần, Rung lắc...)"
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
                    Hiệu Ứng Hoạt Ảnh &amp; Viền Phát Sáng
                    {anchorPos?.layerName ? ` · ${anchorPos.layerName}` : ''}
                  </span>
                </div>
                <span className="tl-fx-time-badge">@ {currentTime.toFixed(2)}s</span>
              </div>

              <div className="tl-fx-popover-body">
                {/* Left list of presets */}
                <div className="tl-fx-list">
                  <div className="tl-fx-group-label" style={{ color: 'var(--accent-cyan)' }}>
                    ✨ Phát sáng viền Neon
                  </div>
                  {FX_PRESETS.filter((p) => p.category === 'glow').map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`tl-fx-item ${selectedId === p.id ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(p)}
                    >
                      <span className="tl-fx-item-badge" style={{ display: 'grid', placeItems: 'center' }}>
                        {renderFxIcon(p.id, 14)}
                      </span>
                      <div className="tl-fx-item-text">
                        <span className="tl-fx-item-name">{p.name}</span>
                      </div>
                    </button>
                  ))}

                  <div className="tl-fx-group-label" style={{ marginTop: 6 }}>
                    Độ mờ &amp; Chớp tắt
                  </div>
                  {FX_PRESETS.filter((p) => p.category === 'opacity').map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`tl-fx-item ${selectedId === p.id ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(p)}
                    >
                      <span className="tl-fx-item-badge" style={{ display: 'grid', placeItems: 'center' }}>
                        {renderFxIcon(p.id, 14)}
                      </span>
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
                      <span className="tl-fx-item-badge" style={{ display: 'grid', placeItems: 'center' }}>
                        {renderFxIcon(p.id, 14)}
                      </span>
                      <div className="tl-fx-item-text">
                        <span className="tl-fx-item-name">{p.name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right configuration panel */}
                <div className="tl-fx-config">
                  <div className="tl-fx-config-scroll">
                    <div className="tl-fx-desc-card">
                    <div className="tl-fx-desc-header">
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {renderFxIcon(activePreset.id, 16)}
                      </span>
                      <strong>{activePreset.name}</strong>
                    </div>
                    <p className="tl-fx-desc-p">{activePreset.description}</p>
                  </div>

                  {activePreset.category === 'glow' ? (
                    <>
                      {/* Màu phát sáng */}
                      <div className="tl-fx-field">
                        <label className="tl-fx-label">Màu ánh sáng Neon:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ColorInput
                            value={glowColor}
                            onChange={(val) => setGlowColor(val)}
                            title="Chọn màu ánh sáng Neon"
                          />
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                            {NEON_PRESETS.map((p) => {
                              const sel = glowColor.toLowerCase() === p.color.toLowerCase()
                              return (
                                <button
                                  key={p.color}
                                  type="button"
                                  onClick={() => setGlowColor(p.color)}
                                  title={p.name}
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    backgroundColor: p.color,
                                    border: sel ? '2px solid var(--text)' : '1px solid var(--line-soft)',
                                    boxShadow: sel ? `0 0 6px ${p.color}` : 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    transform: sel ? 'scale(1.15)' : 'none'
                                  }}
                                />
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Vị trí viền */}
                      <div className="tl-fx-field">
                        <label className="tl-fx-label">Vị trí viền sáng:</label>
                        <div className="tl-fx-duration-pills">
                          <button
                            type="button"
                            className={`tl-fx-pill ${glowSide === 'outer' ? 'active' : ''}`}
                            onClick={() => setGlowSide('outer')}
                          >
                            Viền ngoài
                          </button>
                          <button
                            type="button"
                            className={`tl-fx-pill ${glowSide === 'inner' ? 'active' : ''}`}
                            onClick={() => setGlowSide('inner')}
                          >
                            Viền trong
                          </button>
                          <button
                            type="button"
                            className={`tl-fx-pill ${glowSide === 'both' ? 'active' : ''}`}
                            onClick={() => setGlowSide('both')}
                          >
                            Cả hai
                          </button>
                        </div>
                      </div>

                      {/* Độ dày viền */}
                      <div className="tl-fx-field">
                        <label className="tl-fx-label">Độ dày viền ({glowThickness}px):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="range"
                            min={2}
                            max={30}
                            step={1}
                            value={glowThickness}
                            onChange={(e) => setGlowThickness(Number(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                          />
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[6, 10, 16].map((th) => (
                              <button
                                key={th}
                                type="button"
                                className={`tl-fx-pill ${glowThickness === th ? 'active' : ''}`}
                                style={{ padding: '2px 5px', minWidth: 28 }}
                                onClick={() => setGlowThickness(th)}
                              >
                                {th}p
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tùy chọn riêng theo từng preset */}
                      {selectedId === 'neonBlink' && (
                        <div className="tl-fx-field">
                          <label className="tl-fx-label">Số lần nhấp nháy:</label>
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

                      {/* Thời lượng phát sáng (giây) */}
                      <div className="tl-fx-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="tl-fx-label">Thời lượng phát sáng:</label>
                          <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 600 }}>
                            Từ @ {currentTime.toFixed(2)}s
                          </span>
                        </div>
                        <div className="tl-fx-duration-pills">
                          {[
                            { label: '0.5s', val: 0.5 },
                            { label: '1.0s', val: 1.0 },
                            { label: '1.5s', val: 1.5 },
                            { label: '2.5s', val: 2.5 },
                            { label: 'Suốt layer', val: 0 }
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              className={`tl-fx-pill ${duration === item.val ? 'active' : ''}`}
                              onClick={() => setDuration(item.val)}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {duration > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <input
                              type="range"
                              min={0.2}
                              max={6.0}
                              step={0.1}
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
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Duration configuration for standard keyframe presets */}
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

                      {/* Transform preset specific options: shake, popIn, pulse */}
                      <FxTransformConfigFields
                        selectedId={selectedId}
                        shakes={shakes}
                        setShakes={setShakes}
                        shakeIntensity={shakeIntensity}
                        setShakeIntensity={setShakeIntensity}
                        bounces={bounces}
                        setBounces={setBounces}
                        bounceScale={bounceScale}
                        setBounceScale={setBounceScale}
                        pulses={pulses}
                        setPulses={setPulses}
                        pulseFactor={pulseFactor}
                        setPulseFactor={setPulseFactor}
                      />
                    </>
                  )}

                  </div>

                  {/* Action Button */}
                  <div className="tl-fx-footer">
                    <button
                      type="button"
                      className="btn primary sm tl-fx-apply-btn"
                      onClick={handleApply}
                    >
                      <span>
                        {activePreset.category === 'glow'
                          ? `✨ Bật viền phát sáng (${duration === 0 ? 'Suốt layer' : `${duration.toFixed(1)}s`}) tại ${currentTime.toFixed(2)}s`
                          : selectedId === 'shake'
                          ? `Áp dụng rung chấn (${shakes} lần · ±${shakeIntensity}px) tại ${currentTime.toFixed(2)}s`
                          : selectedId === 'popIn'
                          ? `Áp dụng nảy xuất hiện (${bounces} lần nảy) tại ${currentTime.toFixed(2)}s`
                          : selectedId === 'pulse'
                          ? `Áp dụng nhịp đập (${pulses} nhịp) tại ${currentTime.toFixed(2)}s`
                          : `Áp dụng tại ${currentTime.toFixed(2)}s`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
