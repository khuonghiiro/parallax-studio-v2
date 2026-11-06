import React, { useState } from 'react'
import {
  IconAnchor,
  IconGrid,
  IconLightning,
  IconLoopAnimate
} from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import { toast } from '../../actions'
import type { LoopAnimationMode, LoopPlaybackConfig, LoopRhythmMode } from './types'

export type PlayerBottomTabId = 'speed' | 'loop' | 'rhythm' | 'anchor' | 'bg'

const FPS_PRESETS = [6, 8, 12, 16, 24, 30, 60]
const SPEED_PRESETS = [0.5, 1, 1.5, 2]

const LOOP_MODES: { id: LoopAnimationMode; label: string; desc: string }[] = [
  { id: 'loop', label: 'Vòng lặp', desc: 'Phát hết frame rồi lặp lại từ đầu' },
  { id: 'ping-pong', label: 'Lắc lư', desc: 'Phát xuôi rồi phát ngược (Ping-Pong)' },
  { id: 'once', label: 'Một lần', desc: 'Phát một lượt rồi dừng ở frame cuối' },
  { id: 'random', label: 'Ngẫu nhiên', desc: 'Nhảy frame bất kỳ (hiệu ứng tia điện/lửa)' }
]

const RHYTHM_MODES: { id: LoopRhythmMode; label: string }[] = [
  { id: 'none', label: 'Tắt' },
  { id: 'flicker_opacity', label: 'Nháy mờ' },
  { id: 'pulse_scale', label: 'Nhịp nảy' },
  { id: 'sync_both', label: 'Nhịp + Nháy' },
  { id: 'strobe_beat', label: 'Chớp giật' }
]

const BG_OPTIONS: { id: LoopPlaybackConfig['previewBg']; label: string; bgClass: string }[] = [
  { id: 'checker', label: 'Caro', bgClass: 'la-bg-opt--checker' },
  { id: 'dark', label: 'Tối', bgClass: 'la-bg-opt--dark' },
  { id: 'light', label: 'Sáng', bgClass: 'la-bg-opt--light' },
  { id: 'green', label: 'Xanh phông', bgClass: 'la-bg-opt--green' }
]

function IconSpeedClock({ width = 13, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function LoopPlayerBottomTabs(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<PlayerBottomTabId>('speed')

  const playback = useLoopAnimator((s) => s.playback)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const setFps = useLoopAnimator((s) => s.setFps)
  const setSpeed = useLoopAnimator((s) => s.setSpeed)
  const setLoopMode = useLoopAnimator((s) => s.setLoopMode)
  const setRhythm = useLoopAnimator((s) => s.setRhythm)
  const setContourConfig = useLoopAnimator((s) => s.setContourConfig)
  const equalizeFrameSizes = useLoopAnimator((s) => s.equalizeFrameSizes)

  const r = playback.rhythm
  const currentAnchor = playback.anchor || 'bottom'

  const handleSelectAnchor = (anchor: 'bottom' | 'center' | 'top' | 'left' | 'right') => {
    setPlayback({ anchor })
    setContourConfig({ alignAnchor: anchor })
    equalizeFrameSizes()
    const anchorLabels: Record<string, string> = {
      bottom: 'Đáy / Chân sàn',
      center: 'Tâm khung hình',
      top: 'Đỉnh / Mép trên',
      left: 'Mép trái',
      right: 'Mép phải'
    }
    toast(`⚓ Đã căn theo điểm neo: ${anchorLabels[anchor] || anchor}`)
  }

  return (
    <div className="la-bottom-tabs-shell" data-mcp-region="loop_player_bottom_tabs">
      {/* 1. Dải Tabs Segmented bên dưới Transport (thay thế thanh bên phải) */}
      <div className="la-bottom-tabs-bar" role="tablist">
        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'speed' ? 'active' : ''}`}
          onClick={() => setActiveTab('speed')}
          role="tab"
          aria-selected={activeTab === 'speed'}
        >
          <IconSpeedClock width={13} height={13} />
          <span>Tốc độ</span>
          <span className="la-bottom-tab-badge">{playback.fps}fps</span>
        </button>

        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'loop' ? 'active' : ''}`}
          onClick={() => setActiveTab('loop')}
          role="tab"
          aria-selected={activeTab === 'loop'}
        >
          <IconLoopAnimate width={13} height={13} />
          <span>Kiểu lặp</span>
          <span className="la-bottom-tab-badge">
            {playback.loopMode === 'loop'
              ? 'Vòng'
              : playback.loopMode === 'ping-pong'
                ? 'Lắc'
                : playback.loopMode === 'once'
                  ? '1 lần'
                  : 'Ngẫu'}
          </span>
        </button>

        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'rhythm' ? 'active' : ''}`}
          onClick={() => setActiveTab('rhythm')}
          role="tab"
          aria-selected={activeTab === 'rhythm'}
        >
          <IconLightning width={13} height={13} />
          <span>Nhịp điệu</span>
          <span className={`la-bottom-tab-badge ${r.rhythmMode !== 'none' ? 'highlight' : ''}`}>
            {r.rhythmMode !== 'none' ? 'Bật' : 'Tắt'}
          </span>
        </button>

        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'anchor' ? 'active' : ''}`}
          onClick={() => setActiveTab('anchor')}
          role="tab"
          aria-selected={activeTab === 'anchor'}
        >
          <IconAnchor width={13} height={13} />
          <span>Điểm neo</span>
          <span className="la-bottom-tab-badge">
            {currentAnchor === 'center'
              ? 'Tâm'
              : currentAnchor === 'top'
                ? 'Đỉnh'
                : currentAnchor === 'left'
                  ? 'Trái'
                  : currentAnchor === 'right'
                    ? 'Phải'
                    : 'Chân'}
          </span>
        </button>

        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'bg' ? 'active' : ''}`}
          onClick={() => setActiveTab('bg')}
          role="tab"
          aria-selected={activeTab === 'bg'}
        >
          <IconGrid width={13} height={13} />
          <span>Màu nền</span>
        </button>
      </div>

      {/* 2. Nội dung cấu hình trực tiếp của Tab được chọn */}
      <div className="la-bottom-tab-content">
        {/* Tab 1: Tốc độ */}
        {activeTab === 'speed' && (
          <div className="la-tab-panel">
            <div className="la-tab-row">
              <span className="la-tab-label">Tốc độ khung hình (FPS):</span>
              <strong className="la-tab-val">{playback.fps} FPS</strong>
            </div>
            <div className="la-tab-row">
              <input
                type="range"
                min={1}
                max={60}
                value={playback.fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="la-slider"
              />
            </div>
            <div className="la-tab-chips-grid">
              {FPS_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`la-chip-btn ${playback.fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                >
                  {f} fps
                </button>
              ))}
            </div>

            <div className="la-tab-row" style={{ marginTop: 6 }}>
              <span className="la-tab-label">Hệ số tốc độ (Multiplier):</span>
              <strong className="la-tab-val">{playback.speed}×</strong>
            </div>
            <div className="la-tab-chips-grid">
              {SPEED_PRESETS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  className={`la-chip-btn ${playback.speed === sp ? 'active' : ''}`}
                  onClick={() => setSpeed(sp)}
                >
                  {sp}×
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Kiểu lặp */}
        {activeTab === 'loop' && (
          <div className="la-tab-panel">
            <div className="la-tab-cards-grid">
              {LOOP_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`la-card-btn ${playback.loopMode === m.id ? 'active' : ''}`}
                  onClick={() => setLoopMode(m.id)}
                >
                  <span className="la-card-title">{m.label}</span>
                  <span className="la-card-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Nhịp điệu (Rhythm FX) */}
        {activeTab === 'rhythm' && (
          <div className="la-tab-panel">
            <div className="la-tab-chips-grid">
              {RHYTHM_MODES.map((rm) => (
                <button
                  key={rm.id}
                  type="button"
                  className={`la-chip-btn ${r.rhythmMode === rm.id ? 'active' : ''}`}
                  onClick={() => setRhythm({ rhythmMode: rm.id })}
                >
                  {rm.label}
                </button>
              ))}
            </div>

            {r.rhythmMode !== 'none' && (
              <>
                <div className="la-tab-row" style={{ marginTop: 6 }}>
                  <span className="la-tab-label">Tần số nhịp (Hz):</span>
                  <strong className="la-tab-val">{r.rhythmRateHz || 2} Hz</strong>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={r.rhythmRateHz || 2}
                  onChange={(e) => setRhythm({ rhythmRateHz: Number(e.target.value) })}
                  className="la-slider"
                />

                <div className="la-tab-row">
                  <span className="la-tab-label">Độ mạnh hiệu ứng (%):</span>
                  <strong className="la-tab-val">{Math.round((r.rhythmIntensity ?? 1) * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={r.rhythmIntensity ?? 1}
                  onChange={(e) => setRhythm({ rhythmIntensity: Number(e.target.value) })}
                  className="la-slider"
                />
              </>
            )}
          </div>
        )}

        {/* Tab 4: Điểm neo (Anchor) */}
        {activeTab === 'anchor' && (
          <div className="la-tab-panel">
            <div className="la-tab-row">
              <span className="la-tab-label">Căn điểm neo hiển thị & đồng bộ:</span>
            </div>
            <div className="la-tab-chips-grid">
              {[
                { id: 'bottom', label: 'Đáy / Chân' },
                { id: 'center', label: 'Tâm giữa' },
                { id: 'top', label: 'Đỉnh đầu' },
                { id: 'left', label: 'Mép trái' },
                { id: 'right', label: 'Mép phải' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`la-chip-btn ${currentAnchor === opt.id ? 'active' : ''}`}
                  onClick={() => handleSelectAnchor(opt.id as any)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="la-tab-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="la-btn la-btn--secondary sm"
                onClick={() => {
                  equalizeFrameSizes()
                  toast('📏 Đã đồng bộ kích thước các khung hình')
                }}
                title="Đồng cỡ kích thước tất cả các frame theo khung hình lớn nhất"
              >
                Đồng cỡ kích thước
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Màu nền sân khấu */}
        {activeTab === 'bg' && (
          <div className="la-tab-panel">
            <div className="la-tab-row">
              <span className="la-tab-label">Chọn phông nền sân khấu xem trước:</span>
            </div>
            <div className="la-tab-chips-grid">
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`la-chip-btn ${playback.previewBg === bg.id ? 'active' : ''}`}
                  onClick={() => setPlayback({ previewBg: bg.id })}
                >
                  <span className={`la-bg-swatch ${bg.bgClass}`} />
                  <span>{bg.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
