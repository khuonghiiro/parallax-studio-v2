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
  { id: 'random', label: 'Ngẫu nhiên', desc: 'Nhảy frame bất kỳ (tia điện/lửa)' }
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

function IconSpeedClock({ width = 12, height = 12 }: { width?: number; height?: number }) {
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
      {/* 1. Dải Tabs Segmented bên dưới Transport */}
      <div className="la-bottom-tabs-bar" role="tablist">
        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'speed' ? 'active' : ''}`}
          onClick={() => setActiveTab('speed')}
          role="tab"
          aria-selected={activeTab === 'speed'}
          title="Tốc độ phát (FPS & Hệ số tốc độ)"
        >
          <IconSpeedClock width={11} height={11} />
          <span className="la-bottom-tab-label">FPS</span>
          <span className="la-bottom-tab-badge">{playback.fps}</span>
        </button>

        <button
          type="button"
          className={`la-bottom-tab-btn ${activeTab === 'loop' ? 'active' : ''}`}
          onClick={() => setActiveTab('loop')}
          role="tab"
          aria-selected={activeTab === 'loop'}
          title="Kiểu lặp khung hình (Vòng lặp, Lắc lư, 1 lần, Ngẫu nhiên)"
        >
          <IconLoopAnimate width={11} height={11} />
          <span className="la-bottom-tab-label">Lặp</span>
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
          title="Nhịp điệu & Hiệu ứng chớp giật theo nhịp"
        >
          <IconLightning width={11} height={11} />
          <span className="la-bottom-tab-label">Nhịp</span>
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
          title="Điểm neo căn chỉnh (Chân sàn, Tâm, Đỉnh, Trái, Phải)"
        >
          <IconAnchor width={11} height={11} />
          <span className="la-bottom-tab-label">Neo</span>
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
          title="Màu nền sân khấu xem trước (Caro, Tối, Sáng, Xanh phông)"
        >
          <IconGrid width={11} height={11} />
          <span className="la-bottom-tab-label">Nền</span>
        </button>
      </div>

      {/* 2. Nội dung cấu hình trực tiếp của Tab được chọn */}
      <div className="la-bottom-tab-content">
        {activeTab === 'speed' && (
          <div className="la-tab-panel">
            <div className="la-tab-row">
              <span className="la-tab-label">Khung hình/giây:</span>
              <input
                type="range"
                min={1}
                max={60}
                value={playback.fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="la-slider"
                style={{ flex: 1, margin: '0 6px' }}
              />
              <strong className="la-tab-val">{playback.fps} FPS</strong>
            </div>
            <div className="la-tab-chips-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {FPS_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`la-chip-btn ${playback.fps === f ? 'active' : ''}`}
                  onClick={() => setFps(f)}
                  style={{ padding: '3px 2px', fontSize: 10.5 }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="la-tab-row" style={{ marginTop: 4 }}>
              <span className="la-tab-label">Hệ số tốc độ:</span>
              <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                {SPEED_PRESETS.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`la-chip-btn ${playback.speed === sp ? 'active' : ''}`}
                    onClick={() => setSpeed(sp)}
                    style={{ minWidth: 44 }}
                  >
                    {sp}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
                <div className="la-tab-row" style={{ marginTop: 4 }}>
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
                  onClick={() => handleSelectAnchor(opt.id as 'bottom' | 'center' | 'top' | 'left' | 'right')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="la-tab-actions" style={{ marginTop: 6 }}>
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
