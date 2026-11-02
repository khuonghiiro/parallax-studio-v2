import React from 'react'
import { IconOnionSkin } from '../icons'
import { LoopRangeField } from './LoopChromaControls'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopAnimationMode, LoopRhythmMode } from './types'

const LOOP_MODES: { id: LoopAnimationMode; label: string; title: string }[] = [
  { id: 'loop', label: 'Lặp vòng', title: 'Phát hết rồi quay lại frame đầu' },
  { id: 'ping-pong', label: 'Đảo chiều', title: 'Phát xuôi rồi phát ngược (ping-pong)' },
  { id: 'once', label: '1 lần', title: 'Phát 1 lượt rồi dừng ở frame cuối' },
  { id: 'random', label: 'Ngẫu nhiên', title: 'Nhảy frame ngẫu nhiên — hợp với lửa, tia điện' }
]

const RHYTHM_MODES: { id: LoopRhythmMode; label: string }[] = [
  { id: 'none', label: 'Tắt' },
  { id: 'flicker_opacity', label: 'Nháy mờ' },
  { id: 'pulse_scale', label: 'Nhịp scale' },
  { id: 'sync_both', label: 'Nhịp + Nháy' },
  { id: 'strobe_beat', label: 'Chớp beat' }
]

const FPS_PRESETS = [6, 8, 12, 16, 24, 30]
const SPEEDS = [0.5, 1, 1.5, 2]

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }): React.ReactElement {
  return (
    <section className="loop-settings-section">
      <div className="loop-settings-head">
        <span className="la-label">{title}</span>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Cấu hình phát lặp: FPS, hệ số tốc độ, kiểu lặp, bóng mờ và logic Nhịp & Nháy */
export function LoopPlayerSettings(): React.ReactElement {
  const playback = useLoopAnimator((s) => s.playback)
  const setPlayback = useLoopAnimator((s) => s.setPlayback)
  const setRhythm = useLoopAnimator((s) => s.setRhythm)
  const setFps = useLoopAnimator((s) => s.setFps)
  const setSpeed = useLoopAnimator((s) => s.setSpeed)
  const setLoopMode = useLoopAnimator((s) => s.setLoopMode)
  const r = playback.rhythm
  const showOpacity = r.rhythmMode === 'flicker_opacity' || r.rhythmMode === 'sync_both' || r.rhythmMode === 'strobe_beat'
  const showScale = r.rhythmMode === 'pulse_scale' || r.rhythmMode === 'sync_both' || r.rhythmMode === 'strobe_beat'

  return (
    <div className="loop-player-settings" data-mcp-region="loop_animator_settings">
      <Section title="Tốc độ khung hình" aside={<span className="loop-settings-value">{playback.fps} FPS</span>}>
        <div className="la-seg la-seg--fill">
          {FPS_PRESETS.map((f) => (
            <button key={f} type="button" className={`la-seg-btn${playback.fps === f ? ' active' : ''}`} onClick={() => setFps(f)}>
              {f}
            </button>
          ))}
        </div>
        <LoopRangeField label="Tuỳ chỉnh" value={playback.fps} display={`${playback.fps}`} min={1} max={60} step={1} onChange={setFps} />
      </Section>

      <Section title="Hệ số tốc độ" aside={<span className="loop-settings-value">{playback.speed}×</span>}>
        <div className="la-seg la-seg--fill">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`la-seg-btn${Math.abs(playback.speed - s) < 0.05 ? ' active' : ''}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Kiểu lặp"
        aside={
          <label className="la-check" title="Hiện bóng mờ frame liền trước để căn chỉnh">
            <input type="checkbox" checked={playback.onionSkin} onChange={(e) => setPlayback({ onionSkin: e.target.checked })} />
            <IconOnionSkin width={12} height={12} />
            <span>Bóng mờ</span>
          </label>
        }
      >
        <div className="la-seg la-seg--fill la-seg--wrap">
          {LOOP_MODES.map((m) => (
            <button key={m.id} type="button" className={`la-seg-btn${playback.loopMode === m.id ? ' active' : ''}`} onClick={() => setLoopMode(m.id)} title={m.title}>
              {m.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Nhịp & Nháy (Rhythm FX)">
        <div className="la-seg la-seg--fill la-seg--wrap">
          {RHYTHM_MODES.map((m) => (
            <button key={m.id} type="button" className={`la-seg-btn${r.rhythmMode === m.id ? ' active' : ''}`} onClick={() => setRhythm({ rhythmMode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        {r.rhythmMode !== 'none' && (
          <div className="loop-settings-sliders">
            <LoopRangeField label="Tần số" value={r.rhythmRateHz} display={`${r.rhythmRateHz.toFixed(1)} Hz`} min={0.5} max={10} step={0.1} onChange={(v) => setRhythm({ rhythmRateHz: v })} />
            <LoopRangeField label="Cường độ" value={r.rhythmIntensity} display={`${Math.round(r.rhythmIntensity * 100)}%`} min={0.05} max={1} step={0.05} onChange={(v) => setRhythm({ rhythmIntensity: v })} />
            {showOpacity && (
              <LoopRangeField label="Mờ đáy" value={r.minOpacity} display={`${Math.round(r.minOpacity * 100)}%`} min={0.05} max={0.95} step={0.05} onChange={(v) => setRhythm({ minOpacity: v })} />
            )}
            {showScale && (
              <LoopRangeField label="Biên độ" value={r.scaleBeatPct} display={`+${r.scaleBeatPct}%`} min={2} max={40} step={1} onChange={(v) => setRhythm({ scaleBeatPct: v })} />
            )}
          </div>
        )}
      </Section>
    </div>
  )
}
