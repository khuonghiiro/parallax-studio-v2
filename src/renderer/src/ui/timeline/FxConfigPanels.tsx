import React from 'react'
import type { GlowSide } from '@shared/types'
import type { FxPresetId } from './timelineEffects'

export const NEON_PRESETS = [
  { name: 'Cyan Neon', color: '#3dd6f5' },
  { name: 'Vàng Kim', color: '#f59e0b' },
  { name: 'Hồng Neon', color: '#f43f5e' },
  { name: 'Xanh Ngọc', color: '#10b981' },
  { name: 'Tím Điện', color: '#a855f7' },
  { name: 'Đỏ Rực', color: '#ef4444' },
  { name: 'Trắng Băng', color: '#ffffff' }
]

export interface FxTransformConfigProps {
  selectedId: FxPresetId
  shakes: number
  setShakes: (n: number) => void
  shakeIntensity: number
  setShakeIntensity: (n: number) => void
  bounces: number
  setBounces: (n: number) => void
  bounceScale: number
  setBounceScale: (n: number) => void
  pulses: number
  setPulses: (n: number) => void
  pulseFactor: number
  setPulseFactor: (n: number) => void
}

export function FxTransformConfigFields({
  selectedId,
  shakes,
  setShakes,
  shakeIntensity,
  setShakeIntensity,
  bounces,
  setBounces,
  bounceScale,
  setBounceScale,
  pulses,
  setPulses,
  pulseFactor,
  setPulseFactor
}: FxTransformConfigProps) {
  if (selectedId === 'shake') {
    return (
      <>
        <div className="tl-fx-field">
          <label className="tl-fx-label">Số lần rung lắc ({shakes} lần):</label>
          <div className="tl-fx-duration-pills">
            {[3, 5, 8, 12, 16].map((c) => (
              <button
                key={c}
                type="button"
                className={`tl-fx-pill ${shakes === c ? 'active' : ''}`}
                onClick={() => setShakes(c)}
              >
                {c} lần
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={shakes}
              onChange={(e) => setShakes(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 700,
                width: 44,
                textAlign: 'right'
              }}
            >
              {shakes} lần
            </span>
          </div>
        </div>

        <div className="tl-fx-field">
          <label className="tl-fx-label">Cường độ rung (±{shakeIntensity}px):</label>
          <div className="tl-fx-duration-pills">
            {[
              { label: 'Nhẹ (8px)', val: 8 },
              { label: 'Vừa (18px)', val: 18 },
              { label: 'Mạnh (30px)', val: 30 }
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`tl-fx-pill ${shakeIntensity === item.val ? 'active' : ''}`}
                onClick={() => setShakeIntensity(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="range"
              min={4}
              max={50}
              step={2}
              value={shakeIntensity}
              onChange={(e) => setShakeIntensity(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 700,
                width: 44,
                textAlign: 'right'
              }}
            >
              ±{shakeIntensity}px
            </span>
          </div>
        </div>
      </>
    )
  }

  if (selectedId === 'popIn') {
    return (
      <>
        <div className="tl-fx-field">
          <label className="tl-fx-label">Số lần nảy đàn hồi ({bounces} lần):</label>
          <div className="tl-fx-duration-pills">
            {[1, 2, 3, 4, 5].map((c) => (
              <button
                key={c}
                type="button"
                className={`tl-fx-pill ${bounces === c ? 'active' : ''}`}
                onClick={() => setBounces(c)}
              >
                {c} lần
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={bounces}
              onChange={(e) => setBounces(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 700,
                width: 44,
                textAlign: 'right'
              }}
            >
              {bounces} lần
            </span>
          </div>
        </div>

        <div className="tl-fx-field">
          <label className="tl-fx-label">Độ nảy vọt (phóng đại):</label>
          <div className="tl-fx-duration-pills">
            {[
              { label: 'Nhẹ (112%)', val: 1.12 },
              { label: 'Vừa (120%)', val: 1.2 },
              { label: 'Mạnh (135%)', val: 1.35 }
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`tl-fx-pill ${bounceScale === item.val ? 'active' : ''}`}
                onClick={() => setBounceScale(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (selectedId === 'pulse') {
    return (
      <>
        <div className="tl-fx-field">
          <label className="tl-fx-label">Số nhịp đập ({pulses} nhịp):</label>
          <div className="tl-fx-duration-pills">
            {[1, 2, 3, 4, 6].map((c) => (
              <button
                key={c}
                type="button"
                className={`tl-fx-pill ${pulses === c ? 'active' : ''}`}
                onClick={() => setPulses(c)}
              >
                {c} nhịp
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={pulses}
              onChange={(e) => setPulses(parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 700,
                width: 44,
                textAlign: 'right'
              }}
            >
              {pulses} nhịp
            </span>
          </div>
        </div>

        <div className="tl-fx-field">
          <label className="tl-fx-label">Độ phóng to mỗi nhịp:</label>
          <div className="tl-fx-duration-pills">
            {[
              { label: 'Nhẹ (1.15x)', val: 1.15 },
              { label: 'Vừa (1.25x)', val: 1.25 },
              { label: 'Mạnh (1.40x)', val: 1.4 }
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`tl-fx-pill ${pulseFactor === item.val ? 'active' : ''}`}
                onClick={() => setPulseFactor(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  return null
}
