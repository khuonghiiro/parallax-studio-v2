import React, { useState } from 'react'
import type { LoopRhythmMode } from '@shared/types'
import {
  IconAnchor,
  IconColumns4,
  IconGrid,
  IconLightning,
  IconLoopAnimate
} from '../icons'
import { LoopAnimatorFlyout } from './LoopAnimatorFlyout'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopPlaybackConfig } from './types'

interface Props {
  hasFrames: boolean
  onOpenAlignModal: () => void
}

type RightFlyoutType = 'fps' | 'loop' | 'rhythm' | 'anchor' | 'bg' | null

const FPS_PRESETS = [6, 8, 12, 14, 16, 24, 30]
const SPEED_PRESETS = [0.5, 1, 1.5, 2]

const LOOP_MODES: { id: LoopPlaybackConfig['loopMode']; label: string; title: string }[] = [
  { id: 'loop', label: 'Lặp vòng', title: 'Phát xuôi từ đầu đến cuối và lặp lại' },
  { id: 'ping-pong', label: 'Đảo chiều', title: 'Phát xuôi rồi phát ngược (Ping-pong)' },
  { id: 'once', label: '1 lần', title: 'Chỉ phát một lần rồi dừng ở frame cuối' },
  { id: 'random', label: 'Ngẫu nhiên', title: 'Phát frame ngẫu nhiên' }
]

const RHYTHM_MODES: { id: LoopRhythmMode; label: string; title: string }[] = [
  { id: 'none', label: 'Tắt', title: 'Phát đều nhịp thông thường' },
  { id: 'flicker_opacity', label: 'Nháy mờ', title: 'Nháy độ trong suốt theo nhịp' },
  { id: 'pulse_scale', label: 'Nhịp scale', title: 'Co giãn kích thước phập phồng' },
  { id: 'sync_both', label: 'Nhịp + Nháy', title: 'Kết hợp cả co giãn và nháy sáng' },
  { id: 'strobe_beat', label: 'Chớp beat', title: 'Chớp giật mạnh theo beat âm thanh' }
]

const BG_OPTIONS: { id: LoopPlaybackConfig['previewBg']; label: string }[] = [
  { id: 'checker', label: 'Ô caro trong suốt' },
  { id: 'dark', label: 'Nền tối' },
  { id: 'light', label: 'Nền sáng' },
  { id: 'green', label: 'Nền xanh lá' }
]

const LOOP_MODE_BADGE: Record<string, string> = {
  loop: 'Vòng',
  'ping-pong': 'Đảo',
  once: '1 lần',
  random: 'Ngẫu'
}

function IconSpeed({ width = 18, height = 18 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/**
 * Thanh điều khiển bên phải Xưởng Tách Hoạt Ảnh Loop (Loop Controls Rail).
 * Chứa các icon công cụ: Tốc độ FPS, Kiểu lặp, Rhythm FX, Điểm neo, Nền sân khấu, So sánh đa cột.
 */
export function LoopAnimatorRightRail({ hasFrames, onOpenAlignModal }: Props): React.ReactElement {
  const [activeFlyout, setActiveFlyout] = useState<RightFlyoutType>(null)

  const playback = useLoopAnimator((s) => s.playback)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)

  const toggleFlyout = (f: RightFlyoutType): void => {
    setActiveFlyout((prev) => (prev === f ? null : f))
  }

  return (
    <aside className="la-right-rail" aria-label="Thanh điều khiển hoạt họa & phát thử">
      {/* 1. Tốc độ khung hình (FPS & Speed) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${activeFlyout === 'fps' ? ' active' : ''}`}
          onClick={() => toggleFlyout('fps')}
          title="Tốc độ khung hình (FPS) & Hệ số tốc độ"
          aria-label="Tốc độ khung hình"
        >
          <IconSpeed width={18} height={18} />
          <span className="la-rail-label">Tốc độ</span>
          <span className="la-rail-badge">{playback.fps}fps</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'fps'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Tốc độ khung hình (FPS)"
          icon={<IconSpeed width={14} height={14} />}
          badge={`${playback.fps} FPS · ${playback.speed}×`}
          width={280}
        >
          <div className="la-field-group">
            <div className="la-field-row">
              <span className="la-field-label">Mốc FPS chuẩn:</span>
              <span className="la-field-val">{playback.fps} FPS</span>
            </div>
            <div className="la-pills-grid">
              {FPS_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`la-pill-btn${playback.fps === f ? ' active' : ''}`}
                  onClick={() => setPlayback({ fps: f })}
                >
                  {f} fps
                </button>
              ))}
            </div>

            <div className="la-field-row" style={{ marginTop: 6 }}>
              <span className="la-field-label">Tuỳ chỉnh FPS:</span>
            </div>
            <div className="la-slider-row">
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={playback.fps}
                onChange={(e) => setPlayback({ fps: Number(e.target.value) })}
              />
              <span className="la-field-val">{playback.fps}</span>
            </div>

            <div className="la-field-row" style={{ marginTop: 6 }}>
              <span className="la-field-label">Hệ số tốc độ:</span>
            </div>
            <div className="la-pills-grid">
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`la-pill-btn${playback.speed === s ? ' active' : ''}`}
                  onClick={() => setPlayback({ speed: s })}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 2. Kiểu lặp (Loop Mode) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${activeFlyout === 'loop' ? ' active' : ''}`}
          onClick={() => toggleFlyout('loop')}
          title="Chế độ phát lặp (Loop, Ping-Pong, Once, Random)"
          aria-label="Kiểu lặp"
        >
          <IconLoopAnimate width={18} height={18} />
          <span className="la-rail-label">Kiểu lặp</span>
          <span className="la-rail-badge">{LOOP_MODE_BADGE[playback.loopMode] || 'Loop'}</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'loop'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Chế độ phát lặp"
          icon={<IconLoopAnimate width={14} height={14} />}
          badge={LOOP_MODE_BADGE[playback.loopMode]}
          width={280}
        >
          <div className="la-field-group">
            <div className="la-pills-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {LOOP_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`la-pill-btn${playback.loopMode === m.id ? ' active' : ''}`}
                  onClick={() => setPlayback({ loopMode: m.id })}
                  title={m.title}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(playback.onionSkin)}
                  onChange={(e) => setPlayback({ onionSkin: e.target.checked })}
                />
                <span>Bóng mờ khung hình (Onion Skin)</span>
              </label>
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 3. Hiệu ứng Nhịp Điệu (Rhythm FX) */}
      <div className="la-rail-item">
        <button
          type="button"
          className={`la-rail-btn${playback.rhythm.rhythmMode !== 'none' ? ' modified' : ''}`}
          onClick={() => toggleFlyout('rhythm')}
          title="Hiệu ứng nhịp điệu & chớp nháy theo beat âm thanh"
          aria-label="Nhịp & Nháy"
        >
          <IconLightning width={18} height={18} />
          <span className="la-rail-label">Nhịp điệu</span>
          <span className="la-rail-badge">{playback.rhythm.rhythmMode !== 'none' ? 'Bật' : 'Tắt'}</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'rhythm'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Hiệu ứng Nhịp & Nháy (Rhythm FX)"
          icon={<IconLightning width={14} height={14} />}
          badge={playback.rhythm.rhythmMode !== 'none' ? 'Đang bật' : 'Tắt'}
          width={280}
        >
          <div className="la-field-group">
            <div className="la-pills-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {RHYTHM_MODES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`la-pill-btn${playback.rhythm.rhythmMode === r.id ? ' active' : ''}`}
                  onClick={() =>
                    setPlayback({
                      rhythm: { ...playback.rhythm, rhythmMode: r.id }
                    })
                  }
                  title={r.title}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      <div className="la-rail-separator" />

      {/* 4. Trục Neo (Anchor Point) */}
      <div className="la-rail-item">
        <button
          type="button"
          className="la-rail-btn"
          onClick={() => toggleFlyout('anchor')}
          title="Điểm neo sân khấu khi phát thử (Chân hoặc Tâm)"
          aria-label="Điểm neo"
        >
          <IconAnchor width={18} height={18} />
          <span className="la-rail-label">Điểm neo</span>
          <span className="la-rail-badge">{playback.anchor === 'center' ? 'Tâm' : 'Chân'}</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'anchor'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Điểm neo sân khấu"
          icon={<IconAnchor width={14} height={14} />}
          badge={playback.anchor === 'center' ? 'Tâm' : 'Chân'}
          width={260}
        >
          <div className="la-field-group">
            <div className="la-pills-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`la-pill-btn${playback.anchor !== 'center' ? ' active' : ''}`}
                onClick={() => setPlayback({ anchor: 'bottom' })}
                title="Giữ đáy frame cố định trên mặt sàn"
              >
                Chân (Mặt sàn)
              </button>
              <button
                type="button"
                className={`la-pill-btn${playback.anchor === 'center' ? ' active' : ''}`}
                onClick={() => setPlayback({ anchor: 'center' })}
                title="Căn giữa sân khấu (bay lơ lửng)"
              >
                Tâm (Giữa)
              </button>
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 5. Nền sân khấu (Stage Background) */}
      <div className="la-rail-item">
        <button
          type="button"
          className="la-rail-btn"
          onClick={() => toggleFlyout('bg')}
          title="Màu nền sân khấu xem trước"
          aria-label="Màu nền sân khấu"
        >
          <IconGrid width={18} height={18} />
          <span className="la-rail-label">Màu nền</span>
        </button>

        <LoopAnimatorFlyout
          isOpen={activeFlyout === 'bg'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Màu nền sân khấu"
          icon={<IconGrid width={14} height={14} />}
          width={240}
        >
          <div className="la-field-group">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  className={`la-pill-btn${playback.previewBg === bg.id ? ' active' : ''}`}
                  onClick={() => setPlayback({ previewBg: bg.id })}
                  style={{ textAlign: 'left' }}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>
        </LoopAnimatorFlyout>
      </div>

      {/* 6. So sánh Đa Cột */}
      {hasFrames && (
        <div className="la-rail-item">
          <button
            type="button"
            className="la-rail-btn"
            onClick={onOpenAlignModal}
            title="Mở Khung So Sánh Đa Cột & Căn Chỉnh Vị Trí Chạy"
            aria-label="So sánh đa cột"
          >
            <IconColumns4 width={18} height={18} />
            <span className="la-rail-label">So sánh</span>
          </button>
        </div>
      )}
    </aside>
  )
}
