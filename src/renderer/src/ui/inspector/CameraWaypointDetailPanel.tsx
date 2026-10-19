import { useState } from 'react'
import type { EaseName } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import {
  findNearestShotByStage2D,
  type ProjectedLayer2D,
  type ShotStageBox
} from '../viewer/animateCamera/animateCameraMath'
import {
  CAMERA_ACTION_CATEGORIES,
  CAMERA_ACTION_MODES,
  type CameraActionCategory,
  type CameraActionMode,
  type CameraWaypointItem
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { CameraActionTuningBox } from './CameraActionTuningBox'
import { CameraPoseControls } from './CameraPoseControls'

const EASING_OPTIONS: { value: EaseName; label: string }[] = [
  { value: 'easeInOut', label: '🌊 Mượt tự nhiên (easeInOut)' },
  { value: 'easeInOutStrong', label: '🎬 Điện ảnh nhanh-chậm (Strong)' },
  { value: 'easeOut', label: '🛬 Đáp êm cuối cảnh (easeOut)' },
  { value: 'easeIn', label: '🚀 Tăng tốc dần (easeIn)' },
  { value: 'linear', label: '📏 Đều tốc (linear)' },
  { value: 'hold', label: '⚡ Cắt cảnh tức thì (Jump Cut)' }
]

const QUICK_DURATIONS = [1, 2, 3, 4, 5]

interface CameraWaypointDetailPanelProps {
  activeWaypoint: CameraWaypointItem
  waypoints: CameraWaypointItem[]
  stageLayout: ShotStageBox[]
  activeShotLayers: ProjectedLayer2D[]
  compDuration: number
  onSelectTime: (t: number) => void
  onUpdate: (
    updates: {
      time?: number
      stageX?: number
      stageY?: number
      scale?: number
      yaw?: number
      pitch?: number
      roll?: number
      ease?: EaseName
      ripple?: boolean
    },
    mergeKey?: string
  ) => void
  onUpdateStepTiming: (
    waypointIndex: number,
    options: {
      stepDuration?: number
      delaySec?: number
      actionDurationSec?: number
    }
  ) => void
  onApplyActionMode: (mode: CameraActionMode) => void
  onAlignInShot: (align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles') => void
  onTargetShot: (shotId: string) => void
  onTargetLayer: (layerId: string) => void
  onSpawnNext: (mode: 'pan' | 'zoom-in' | 'zoom-out') => void
  onAddHold: () => void
}

export function CameraWaypointDetailPanel({
  activeWaypoint,
  waypoints,
  stageLayout,
  activeShotLayers,
  compDuration: _compDuration,
  onSelectTime,
  onUpdate,
  onUpdateStepTiming,
  onApplyActionMode,
  onAlignInShot,
  onTargetShot,
  onTargetLayer,
  onSpawnNext,
  onAddHold
}: CameraWaypointDetailPanelProps) {
  const [actionCategory, setActionCategory] = useState<'all' | CameraActionCategory>('all')
  const filteredActionModes =
    actionCategory === 'all'
      ? CAMERA_ACTION_MODES
      : CAMERA_ACTION_MODES.filter((m) => m.category === actionCategory)

  const isStartFrame = activeWaypoint.index === 0
  const prevWp = activeWaypoint.index > 0 ? waypoints[activeWaypoint.index - 1] : null
  const nextWp =
    activeWaypoint.index + 1 < waypoints.length ? waypoints[activeWaypoint.index + 1] : null
  const has3DAngle =
    Math.abs(activeWaypoint.yaw) >= 0.5 ||
    Math.abs(activeWaypoint.pitch) >= 0.5 ||
    Math.abs(activeWaypoint.roll) >= 0.5

  const currentShotBox =
    (activeWaypoint.shotId ? stageLayout.find((b) => b.shotId === activeWaypoint.shotId) : null) ??
    findNearestShotByStage2D(stageLayout, activeWaypoint.stageX, activeWaypoint.stageY) ??
    stageLayout[0]

  const localOffsetX = Math.round(
    activeWaypoint.stageX - (currentShotBox ? currentShotBox.stageX : 0)
  )
  const localOffsetY = Math.round(
    activeWaypoint.stageY - (currentShotBox ? currentShotBox.stageY : 0)
  )

  const transitionIndex = activeWaypoint.index > 0 ? activeWaypoint.index - 1 : 0
  const transitionWp = prevWp ?? activeWaypoint
  const currentStepDuration = prevWp
    ? Math.max(0.2, Math.round((activeWaypoint.time - prevWp.time) * 100) / 100)
    : activeWaypoint.stepDuration
  const currentDelaySec = transitionWp.delaySec
  const currentActionDurationSec = transitionWp.actionDurationSec

  const curLabel = activeWaypoint.displayLabel
  const prevLabel = activeWaypoint.prevDisplayLabel ?? `${activeWaypoint.index}`
  const nextSpawnLabel = activeWaypoint.nextSpawnLabel

  return (
    <div id="camera-waypoint-detail-panel" className="section active-wp-section">
      {/* 1. Header Banner phân biệt rõ ràng: Mốc #1 (Khung khởi đầu) vs Mốc #k (Chuyển động từ #k-1 ➔ #k) */}
      <div className="wp-detail-banner">
        <div className="wp-banner-left">
          {isStartFrame ? (
            <>
              <span className="scope-badge first-of-shot">
                🎯 MỐC #{curLabel}: KHUNG KHỞI ĐẦU
              </span>
              <span className="wp-banner-time">0.00s</span>
            </>
          ) : (
            <>
              <span className="scope-badge per-waypoint">
                🎬 MỐC #{curLabel}: TỪ #{prevLabel} ➔ #{curLabel}
              </span>
              <span className="wp-banner-time">
                {prevWp ? prevWp.time.toFixed(1) : '0.0'}s ➔ {activeWaypoint.time.toFixed(1)}s ({currentStepDuration.toFixed(1)}s)
              </span>
            </>
          )}
          <span className="wp-active-shot" style={{ borderColor: activeWaypoint.shotColor }}>
            {activeWaypoint.shotName}
          </span>
        </div>

        <div className="wp-step-nav">
          <button
            type="button"
            className="btn xs icon"
            disabled={!prevWp}
            onClick={() => prevWp && onSelectTime(prevWp.time)}
            title="Chuyển về mốc trước"
          >
            ◀
          </button>
          <button
            type="button"
            className="btn xs icon"
            disabled={!nextWp}
            onClick={() => nextWp && onSelectTime(nextWp.time)}
            title="Chuyển tới mốc tiếp theo"
          >
            ▶
          </button>
        </div>
      </div>

      {/* =========================================================================
          TRƯỜNG HỢP A: MỐC #1 (KHUNG HÌNH KHỞI ĐẦU - STARTING FRAME TẠI 0.0s)
          - Định hình cỡ cảnh (Zoom), vị trí trong cảnh và góc xoay 3D ban đầu.
          - Không hiển thị động tác quay hay slider đệm chờ (vì chưa có chuyển động vào).
         ========================================================================= */}
      {isStartFrame ? (
        <>
          <div className="wp-start-frame-card">
            <div className="start-frame-badge">📍 Khung hình bắt đầu cảnh (0.0s)</div>
            <p className="start-frame-desc">
              Đây là vị trí, cỡ cảnh (Zoom) và góc nhìn ban đầu trước khi bắt đầu chuyển động camera.
            </p>
          </div>

          <CameraPoseControls
            activeWaypoint={activeWaypoint}
            stageLayout={stageLayout}
            activeShotLayers={activeShotLayers}
            currentShotBox={currentShotBox}
            localOffsetX={localOffsetX}
            localOffsetY={localOffsetY}
            has3DAngle={has3DAngle}
            sectionTitlePrefix="Khởi đầu"
            onUpdate={onUpdate}
            onAlignInShot={onAlignInShot}
            onTargetShot={onTargetShot}
            onTargetLayer={onTargetLayer}
          />

          {nextWp && (
            <div className="next-wp-transition-card">
              <div className="next-card-head">
                <span className="next-icon">🎬</span>
                <div className="next-info">
                  <span className="next-title">Chuyển tiếp sang Mốc #{nextWp.displayLabel}</span>
                  <span className="next-time">
                    Thời lượng {activeWaypoint.stepDuration.toFixed(1)}s (đến {nextWp.time.toFixed(1)}s)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn xs primary"
                  onClick={() => onSelectTime(nextWp.time)}
                  title={`Chuyển sang Mốc #${nextWp.displayLabel} để cấu hình kiểu chuyển động, đệm chờ và cỡ cảnh đích`}
                >
                  Sửa Mốc #{nextWp.displayLabel} ➔
                </button>
              </div>
            </div>
          )}

          <div className="next-wp-create-card">
            <div className="create-prompt-head">
              <span>
                {nextWp
                  ? `✨ Bổ sung lộ trình vào "${activeWaypoint.shotName}" (Mốc #${nextSpawnLabel}):`
                  : `✨ Tạo chuyển động đầu tiên sang Mốc #${nextSpawnLabel}:`}
              </span>
            </div>
            <div className="route-insp-actions">
              <button
                type="button"
                className="btn xs primary"
                onClick={() => onSpawnNext('zoom-in')}
                title={`Tạo Mốc #${nextSpawnLabel} đẩy cận cảnh trong "${activeWaypoint.shotName}"`}
              >
                🔍+ Đẩy cận (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnNext('pan')}
                title={`Tạo Mốc #${nextSpawnLabel} lia ngang trong "${activeWaypoint.shotName}"`}
              >
                ↔ Lia tiếp (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnNext('zoom-out')}
                title={`Tạo Mốc #${nextSpawnLabel} kéo toàn cảnh rộng trong "${activeWaypoint.shotName}"`}
              >
                🔍- Kéo rộng (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={onAddHold}
                title={`Tạo Mốc #${nextSpawnLabel} giữ nguyên khung nhìn trong 2 giây`}
              >
                ⏸ Dừng (#{nextSpawnLabel})
              </button>
            </div>
          </div>
        </>
      ) : (
        /* =========================================================================
            TRƯỜNG HỢP B: MỐC #k (k >= 2) - CẤU HÌNH ĐOẠN CHUYỂN ĐỘNG TỪ #k-1 ➔ #k
            - Thời lượng chuyển đoạn (duration), Easing, đệm chờ (delay), tốc độ (speed).
            - Động tác quay và Khung hình đích đến tại Mốc #k.
           ========================================================================= */
        <>
          {/* 1. Thời lượng chuyển động từ Mốc #(k-1) sang Mốc #k & Easing */}
          <div className="row-group priority-timing-box">
            <div className="field-header">
              <label>⏱ Thời lượng chuyển từ #{prevLabel} ➔ #{curLabel}</label>
              <span className="timing-hint-tag">Tự nối tiếp timeline</span>
            </div>

            <div className="field-row timing-main-row">
              <div className="timing-field-card">
                <label
                  htmlFor="wp-input-duration"
                  title={`Thời lượng chuyển động từ Mốc #${prevLabel} sang Mốc #${curLabel}. Thay đổi số giây sẽ tự động tính lại mốc thời gian trên Timeline.`}
                >
                  Thời lượng chuyển (Giây)
                </label>
                <div className="input-prefix-box highlight">
                  <span className="prefix">⏱</span>
                  <input
                    id="wp-input-duration"
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="60"
                    value={currentStepDuration}
                    onChange={(e) => {
                      const dur = parseFloat(e.target.value)
                      if (!isNaN(dur)) {
                        onUpdateStepTiming(transitionIndex, {
                          stepDuration: Math.max(0.2, dur)
                        })
                      }
                    }}
                  />
                  <span className="suffix">s</span>
                </div>
              </div>

              <div className="timing-field-card">
                <label
                  htmlFor="wp-input-timestamp"
                  title="Khung giờ chuyển động thực tế trên thanh Timeline"
                >
                  Khung giờ trên Timeline
                </label>
                <div
                  id="wp-input-timestamp"
                  className="timing-window-readout"
                  title={`Mốc #${curLabel} chuyển từ ${prevWp ? prevWp.time.toFixed(2) : '0.00'}s đến ${activeWaypoint.time.toFixed(2)}s (kéo dài ${currentStepDuration.toFixed(1)}s)`}
                >
                  <span className="win-start">{prevWp ? prevWp.time.toFixed(2) : '0.00'}s</span>
                  <span className="win-arrow">➔</span>
                  <span className="win-end">{activeWaypoint.time.toFixed(2)}s</span>
                </div>
              </div>
            </div>

            {/* Nút chọn nhanh Thời lượng (1s, 2s, 3s, 4s, 5s) */}
            <div className="quick-duration-bar">
              <span className="quick-dur-lbl">Chọn nhanh:</span>
              {QUICK_DURATIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`dur-chip${Math.abs(currentStepDuration - sec) < 0.08 ? ' active' : ''}`}
                  onClick={() =>
                    onUpdateStepTiming(transitionIndex, { stepDuration: sec })
                  }
                  title={`Đặt thời lượng chuyển động thành ${sec}.0 giây`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            <div className="field-select-mt">
              <CustomSelect<EaseName>
                id="route-insp-ease-select"
                value={activeWaypoint.ease}
                onChange={(val) => onUpdate({ ease: val })}
                options={EASING_OPTIONS}
                size="sm"
                title="Chọn kiểu gia tốc chuyển động cho đoạn chuyển này"
              />
            </div>
          </div>

          {/* 2. Động tác Quay Chuyên Nghiệp & Hộp tinh chỉnh Đệm chờ / Tốc độ */}
          <div className="row-group">
            <div className="field-header">
              <label>🎬 Động tác chuyển động sang Mốc #{curLabel}</label>
              <span className="wp-mode-current">{activeWaypoint.tagLabel}</span>
            </div>

            {/* Bộ lọc phân nhóm kỹ thuật quay chuyên nghiệp */}
            <div className="cam-action-cat-tabs" role="tablist" aria-label="Nhóm động tác quay chuyên nghiệp">
              {CAMERA_ACTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={actionCategory === cat.id}
                  className={`cam-action-cat-btn${actionCategory === cat.id ? ' active' : ''}`}
                  onClick={() => setActionCategory(cat.id)}
                  title={cat.hint}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="cam-action-mode-grid">
              {filteredActionModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`cam-mode-btn${activeWaypoint.actionMode === m.id ? ' active' : ''}`}
                  onClick={() => onApplyActionMode(m.id)}
                  title={`${m.badgeLabel}: ${m.hint}`}
                >
                  <span className="mode-ico">{m.icon}</span>
                  <span className="mode-lbl">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Hộp thanh trượt tinh chỉnh Đệm chờ, Tốc độ (Nhanh ⇄ Chậm) & Tăng tốc riêng */}
            <CameraActionTuningBox
              activeWaypoint={{
                ...activeWaypoint,
                stepDuration: currentStepDuration,
                delaySec: currentDelaySec,
                actionDurationSec: currentActionDurationSec
              }}
              shotStageX={currentShotBox ? currentShotBox.stageX : 0}
              shotStageY={currentShotBox ? currentShotBox.stageY : 0}
              onUpdateStepTiming={(_idx, opts) => onUpdateStepTiming(transitionIndex, opts)}
              onUpdatePose={onUpdate}
            />
          </div>

          {/* 3. Khung hình đích đến tại Mốc #k (Zoom, Pan, 3D) */}
          <CameraPoseControls
            activeWaypoint={activeWaypoint}
            stageLayout={stageLayout}
            activeShotLayers={activeShotLayers}
            currentShotBox={currentShotBox}
            localOffsetX={localOffsetX}
            localOffsetY={localOffsetY}
            has3DAngle={has3DAngle}
            sectionTitlePrefix="Khung đích"
            onUpdate={onUpdate}
            onAlignInShot={onAlignInShot}
            onTargetShot={onTargetShot}
            onTargetLayer={onTargetLayer}
          />

          {/* 4. Thao tác tạo nhanh mốc tiếp theo hoặc bổ sung nhánh phụ (#5.1, #5.2) vào cảnh hiện tại */}
          <div className="next-wp-create-card">
            <div className="create-prompt-head">
              <span>
                {nextSpawnLabel.includes('.')
                  ? `✨ Bổ sung tiếp cho "${activeWaypoint.shotName}" từ #${curLabel} (Sẽ tạo #${nextSpawnLabel}):`
                  : `✨ Thêm bước tiếp theo cho "${activeWaypoint.shotName}" (Mốc #${nextSpawnLabel}):`}
              </span>
            </div>
            <div className="route-insp-actions">
              <button
                type="button"
                className="btn xs primary"
                onClick={() => onSpawnNext('pan')}
                title={`Tạo Mốc #${nextSpawnLabel} lia tiếp ngay trong "${activeWaypoint.shotName}"`}
              >
                + Lia tiếp (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={onAddHold}
                title={`Tạo Mốc #${nextSpawnLabel} dừng ngắm cảnh giữ nguyên vị trí trong 2 giây`}
              >
                ⏸ Dừng (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnNext('zoom-in')}
                title={`Tạo Mốc #${nextSpawnLabel} đẩy cận cảnh trong "${activeWaypoint.shotName}"`}
              >
                🔍+ Đẩy cận (#{nextSpawnLabel})
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnNext('zoom-out')}
                title={`Tạo Mốc #${nextSpawnLabel} kéo toàn cảnh rộng trong "${activeWaypoint.shotName}"`}
              >
                🔍- Kéo rộng (#{nextSpawnLabel})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
