import type { EaseName } from '@shared/types'
import { getActionVerbLabel } from '../viewer/animateCamera/animateCameraActionModes'
import { clampFrameScale } from '../viewer/animateCamera/animateCameraMath'
import type { CameraWaypointItem } from '../viewer/animateCamera/animateCameraRouteLogic'
import '../../styles/cameraActionTuning.css'

interface CameraActionTuningBoxProps {
  activeWaypoint: CameraWaypointItem
  onUpdateStepTiming: (
    waypointIndex: number,
    options: {
      stepDuration?: number
      delaySec?: number
      actionDurationSec?: number
    }
  ) => void
  onUpdatePose: (
    updates: {
      scale?: number
      yaw?: number
      pitch?: number
      roll?: number
      ease?: EaseName
    },
    mergeKey?: string
  ) => void
}

const DELAY_PRESETS = [0, 0.5, 1.0, 1.5, 2.0]

const SPEED_PRESETS: { sec: number; label: string; desc: string }[] = [
  { sec: 0.5, label: '⚡ 0.5s (Rất nhanh)', desc: 'Thực hiện động tác vút nhanh trong 0.5 giây' },
  { sec: 1.0, label: '🏃 1.0s (Nhanh)', desc: 'Thực hiện động tác dứt khoát trong 1.0 giây' },
  { sec: 2.0, label: '🎬 2.0s (Vừa)', desc: 'Thực hiện động tác nhịp điện ảnh chuẩn 2.0 giây' },
  { sec: 3.0, label: '🌊 3.0s (Chậm)', desc: 'Thực hiện động tác êm ái từ tốn trong 3.0 giây' },
  { sec: 4.5, label: '🐢 4.5s (Rất chậm)', desc: 'Thực hiện động tác chầm chậm sâu lắng trong 4.5 giây' }
]

const ACCEL_CHIPS: { ease: EaseName; label: string; title: string }[] = [
  {
    ease: 'easeInOut',
    label: '🌊 Êm mượt',
    title: 'Khởi đầu êm, tăng tốc ở giữa và dừng êm tự nhiên'
  },
  {
    ease: 'easeInOutStrong',
    label: '🚀 Tăng tốc mạnh',
    title: 'Đẩy gia tốc mạnh ở nhịp giữa tạo lực hút thị giác điện ảnh'
  },
  {
    ease: 'easeOut',
    label: '⚡ Vút đầu ➔ Êm cuối',
    title: 'Lao nhanh ngay khi bắt đầu rồi thắng chậm dần khi tới đích'
  },
  {
    ease: 'easeIn',
    label: '🛫 Chậm đầu ➔ Nhanh cuối',
    title: 'Nhích từ từ lúc đầu rồi tăng tốc vút nhanh dần về cuối'
  },
  {
    ease: 'linear',
    label: '📏 Đều tốc',
    title: 'Tốc độ di chuyển đều đặn không đổi từ đầu tới cuối'
  }
]

function getSpeedBadge(sec: number): { text: string; tone: 'fast' | 'normal' | 'slow' } {
  if (sec <= 0.8) return { text: '⚡ Nhịp nhanh', tone: 'fast' }
  if (sec <= 2.4) return { text: '🎬 Nhịp vừa', tone: 'normal' }
  return { text: '🐢 Chầm chậm', tone: 'slow' }
}

export function CameraActionTuningBox({
  activeWaypoint,
  onUpdateStepTiming,
  onUpdatePose
}: CameraActionTuningBoxProps) {
  const mode = activeWaypoint.actionMode
  const verb = getActionVerbLabel(mode)
  const wpIdx = activeWaypoint.index
  const delaySec = activeWaypoint.delaySec
  const actionDurSec = activeWaypoint.actionDurationSec
  const speedBadge = getSpeedBadge(actionDurSec)

  const isPitchAction =
    mode === 'crane-up' ||
    mode === 'crane-down' ||
    mode === 'tilt-sky' ||
    mode === 'aerial-dive' ||
    mode === 'hero-low' ||
    mode === 'low-angle' ||
    mode === 'bird-eye' ||
    mode === 'high-angle'
  const isYawAction =
    mode === 'orbit-left' ||
    mode === 'orbit-right' ||
    mode === 'sweep-left' ||
    mode === 'sweep-right' ||
    mode === 'corkscrew'
  const isRollAction = mode === 'dutch-tilt' || mode === 'corkscrew' || mode === 'whip-pan'

  if (mode === 'cut') {
    return (
      <div className="cam-action-tuning-box" data-mcp-region="inspector_body">
        <div className="tuning-box-head">
          <span className="tuning-box-title">⚡ Tinh chỉnh: {activeWaypoint.tagLabel}</span>
          <span className="tuning-speed-pill fast">Chuyển tức thì (0s)</span>
        </div>
        <div className="tuning-cut-note">
          Chế độ <b>Cắt cảnh tức thì (Jump Cut)</b> nhảy thẳng sang góc máy của Mốc #{wpIdx + 1}{' '}
          ngay tại <b>{activeWaypoint.time.toFixed(2)}s</b> và giữ khung hình trong{' '}
          <b>{activeWaypoint.stepDuration.toFixed(1)}s</b>.
        </div>
      </div>
    )
  }

  return (
    <div className="cam-action-tuning-box">
      <div className="tuning-box-head">
        <span className="tuning-box-title">🎛 Tinh chỉnh động tác: {activeWaypoint.tagLabel}</span>
        <span className={`tuning-speed-pill ${speedBadge.tone}`}>{speedBadge.text}</span>
      </div>

      {/* 1. SLIDER ĐỆM CHỜ TRƯỚC KHI THỰC HIỆN ĐỘNG TÁC (Buffer Delay) */}
      <div className="tuning-slider-block">
        <div className="tuning-slider-top">
          <label htmlFor="wp-action-delay-slider" className="tuning-slider-label">
            ⏳ Đệm giây trước khi {verb}
          </label>
          <div className="tuning-num-wrap">
            <input
              id="wp-action-delay-input"
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={delaySec}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) {
                  onUpdateStepTiming(wpIdx, { delaySec: Math.max(0, v) })
                }
              }}
            />
            <span>s</span>
          </div>
        </div>

        <input
          id="wp-action-delay-slider"
          type="range"
          className="route-zoom-slider"
          min={0}
          max={4.0}
          step={0.1}
          value={Math.min(4.0, delaySec)}
          onChange={(e) =>
            onUpdateStepTiming(wpIdx, { delaySec: parseFloat(e.target.value) })
          }
        />

        <div className="tuning-quick-chips">
          {DELAY_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              className={`tuning-chip${Math.abs(delaySec - d) < 0.06 ? ' active' : ''}`}
              onClick={() => onUpdateStepTiming(wpIdx, { delaySec: d })}
              title={
                d === 0
                  ? `Thực hiện ${verb} ngay khi vào Mốc #${wpIdx + 1}`
                  : `Đợi ${d.toFixed(1)} giây rồi mới bắt đầu ${verb}`
              }
            >
              {d === 0 ? '0s (Ngay)' : `+${d.toFixed(1)}s`}
            </button>
          ))}
        </div>
      </div>

      {/* 2. SLIDER THỜI GIAN & TỐC ĐỘ ĐỘNG TÁC (Ít giây = Nhanh, Nhiều giây = Chầm chậm) */}
      <div className="tuning-slider-block">
        <div className="tuning-slider-top">
          <label htmlFor="wp-action-dur-slider" className="tuning-slider-label">
            ⚡ Thời gian {verb} <small>(Ít s = Nhanh · Nhiều s = Chậm)</small>
          </label>
          <div className="tuning-num-wrap">
            <input
              id="wp-action-dur-input"
              type="number"
              min={0.2}
              max={15}
              step={0.1}
              value={actionDurSec}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) {
                  onUpdateStepTiming(wpIdx, { actionDurationSec: Math.max(0.2, v) })
                }
              }}
            />
            <span>s</span>
          </div>
        </div>

        <input
          id="wp-action-dur-slider"
          type="range"
          className="route-zoom-slider"
          min={0.2}
          max={6.0}
          step={0.1}
          value={Math.min(6.0, actionDurSec)}
          onChange={(e) =>
            onUpdateStepTiming(wpIdx, { actionDurationSec: parseFloat(e.target.value) })
          }
        />

        <div className="tuning-scale-ends">
          <span>⚡ 0.2s (Đẩy/lia cực nhanh)</span>
          <span>🐢 6.0s (Chầm chậm êm ái)</span>
        </div>

        <div className="tuning-quick-chips">
          {SPEED_PRESETS.map((sp) => (
            <button
              key={sp.sec}
              type="button"
              className={`tuning-chip${Math.abs(actionDurSec - sp.sec) < 0.08 ? ' active' : ''}`}
              onClick={() => onUpdateStepTiming(wpIdx, { actionDurationSec: sp.sec })}
              title={sp.desc}
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. TĂNG TỐC & GIA TỐC ĐỘNG TÁC */}
      <div className="tuning-slider-block">
        <div className="tuning-slider-top">
          <span className="tuning-slider-label">🚀 Kiểu tăng tốc khi {verb}</span>
        </div>
        <div className="tuning-accel-grid">
          {ACCEL_CHIPS.map((ac) => (
            <button
              key={ac.ease}
              type="button"
              className={`tuning-chip${activeWaypoint.ease === ac.ease ? ' active' : ''}`}
              onClick={() => onUpdatePose({ ease: ac.ease })}
              title={ac.title}
            >
              {ac.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. SLIDER BIÊN ĐỘ CỰ LY (Độ phóng cận/rộng) & GÓC QUAY THEO ĐỘNG TÁC */}
      <div className="tuning-slider-block">
        <div className="tuning-slider-top">
          <label htmlFor="wp-action-zoom-slider" className="tuning-slider-label">
            🔍 Cự ly khung ngắm (Độ cận / rộng)
          </label>
          <span className="tuning-val-badge">{activeWaypoint.zoomPct}%</span>
        </div>
        <input
          id="wp-action-zoom-slider"
          type="range"
          className="route-zoom-slider"
          min={50}
          max={350}
          step={5}
          value={Math.max(50, Math.min(350, activeWaypoint.zoomPct))}
          onChange={(e) => {
            const pct = parseFloat(e.target.value)
            onUpdatePose({ scale: clampFrameScale(100 / pct) }, 'wp-action-zoom')
          }}
        />
        <div className="tuning-scale-ends">
          <span>50% (Kéo rộng)</span>
          <span>100% (Chuẩn)</span>
          <span>350% (Đẩy cận sâu)</span>
        </div>
      </div>

      {isPitchAction && (
        <div className="tuning-slider-block">
          <div className="tuning-slider-top">
            <label htmlFor="wp-action-pitch-slider" className="tuning-slider-label">
              ↕ Biên độ góc Cần cẩu / Ngước - Cúi (Pitch)
            </label>
            <span className="tuning-val-badge">
              {activeWaypoint.pitch > 0 ? `+${activeWaypoint.pitch}°` : `${activeWaypoint.pitch}°`}
            </span>
          </div>
          <input
            id="wp-action-pitch-slider"
            type="range"
            className="route-zoom-slider"
            min={-45}
            max={45}
            step={1}
            value={Math.max(-45, Math.min(45, activeWaypoint.pitch))}
            onChange={(e) =>
              onUpdatePose({ pitch: parseFloat(e.target.value) }, 'wp-action-pitch')
            }
          />
        </div>
      )}

      {isYawAction && (
        <div className="tuning-slider-block">
          <div className="tuning-slider-top">
            <label htmlFor="wp-action-yaw-slider" className="tuning-slider-label">
              🌐 Biên độ xoay vòng 3D (Yaw)
            </label>
            <span className="tuning-val-badge">
              {activeWaypoint.yaw > 0 ? `+${activeWaypoint.yaw}°` : `${activeWaypoint.yaw}°`}
            </span>
          </div>
          <input
            id="wp-action-yaw-slider"
            type="range"
            className="route-zoom-slider"
            min={-60}
            max={60}
            step={1}
            value={Math.max(-60, Math.min(60, activeWaypoint.yaw))}
            onChange={(e) =>
              onUpdatePose({ yaw: parseFloat(e.target.value) }, 'wp-action-yaw')
            }
          />
        </div>
      )}

      {isRollAction && (
        <div className="tuning-slider-block">
          <div className="tuning-slider-top">
            <label htmlFor="wp-action-roll-slider" className="tuning-slider-label">
              ⟳ Biên độ nghiêng máy (Roll / Dutch Tilt)
            </label>
            <span className="tuning-val-badge">
              {activeWaypoint.roll > 0 ? `+${activeWaypoint.roll}°` : `${activeWaypoint.roll}°`}
            </span>
          </div>
          <input
            id="wp-action-roll-slider"
            type="range"
            className="route-zoom-slider"
            min={-45}
            max={45}
            step={1}
            value={Math.max(-45, Math.min(45, activeWaypoint.roll))}
            onChange={(e) =>
              onUpdatePose({ roll: parseFloat(e.target.value) }, 'wp-action-roll')
            }
          />
        </div>
      )}
    </div>
  )
}
