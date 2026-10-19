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
  onUpdateSegmentDuration: (targetWaypointIndex: number, newDurationSec: number) => void
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
  compDuration,
  onSelectTime,
  onUpdate,
  onUpdateSegmentDuration,
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

  // Cho phép chỉnh thời lượng ngay cả khi đang chọn Mốc #1 (chỉnh đoạn #1 -> #2)
  // hoặc khi chọn Mốc #N (chỉnh đoạn #(N-1) -> #N)
  const isFirstWaypoint = activeWaypoint.index === 0
  const editableDurationWpIndex = isFirstWaypoint ? (nextWp ? 1 : -1) : activeWaypoint.index
  const currentSegmentDuration = isFirstWaypoint
    ? (nextWp ? nextWp.durationFromPrev : 0)
    : activeWaypoint.durationFromPrev
  const durationLabel = isFirstWaypoint
    ? nextWp
      ? 'Thời lượng đoạn (#1 ➔ #2)'
      : 'Thời lượng đoạn (s)'
    : `Thời lượng đoạn (#${activeWaypoint.index} ➔ #${activeWaypoint.index + 1})`

  return (
    <div id="camera-waypoint-detail-panel" className="section active-wp-section">
      {/* Header phân biệt rõ đây là thông số RIÊNG của Mốc đang chọn */}
      <div className="wp-detail-banner">
        <div className="wp-banner-left">
          <span className="scope-badge per-waypoint">
            🎯 RIÊNG MỐC #{activeWaypoint.index + 1}
          </span>
          {activeWaypoint.isFirstOfShot && (
            <span className="scope-badge first-of-shot" title="Mốc camera lộ trình đầu tiên của cảnh này">
              ⚑ MỞ CẢNH
            </span>
          )}
          <span className="wp-banner-time">{activeWaypoint.time.toFixed(1)}s</span>
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

      {/* 1. QUAN TRỌNG NHẤT (ĐƯA LÊN ĐẦU): Thời điểm, Thời lượng đoạn & Kiểu chuyển tiếp */}
      <div className="row-group priority-timing-box">
        <div className="field-header">
          <label>⏱ Thời gian &amp; Thời lượng đoạn</label>
          <span className="timing-hint-tag">Tự dồn mốc sau</span>
        </div>

        <div className="field-row timing-main-row">
          <div className="timing-field-card">
            <label htmlFor="wp-input-timestamp">Thời điểm mốc (Giây)</label>
            <div className="input-prefix-box highlight">
              <span className="prefix">⏱</span>
              <input
                id="wp-input-timestamp"
                type="number"
                step="0.1"
                min="0"
                max={compDuration + 30}
                value={activeWaypoint.time}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val)) onUpdate({ time: Math.max(0, val) })
                }}
              />
              <span className="suffix">s</span>
            </div>
          </div>

          <div className="timing-field-card">
            <label
              htmlFor="wp-input-duration"
              title="Thay đổi thời lượng đoạn này sẽ tự động đẩy lùi/kéo gọn các mốc phía sau tương ứng"
            >
              {durationLabel}
            </label>
            <div className="input-prefix-box highlight">
              <span className="prefix">+</span>
              <input
                id="wp-input-duration"
                type="number"
                step="0.1"
                min="0.1"
                disabled={editableDurationWpIndex < 0}
                value={currentSegmentDuration}
                onChange={(e) => {
                  const dur = parseFloat(e.target.value)
                  if (!isNaN(dur) && editableDurationWpIndex > 0) {
                    onUpdateSegmentDuration(editableDurationWpIndex, Math.max(0.1, dur))
                  }
                }}
              />
              <span className="suffix">s</span>
            </div>
          </div>
        </div>

        {/* Nút chọn nhanh Thời lượng đoạn (1s, 2s, 3s, 4s, 5s) */}
        {editableDurationWpIndex > 0 && (
          <div className="quick-duration-bar">
            <span className="quick-dur-lbl">Nhịp nhanh:</span>
            {QUICK_DURATIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                className={`dur-chip${Math.abs(currentSegmentDuration - sec) < 0.08 ? ' active' : ''}`}
                onClick={() => onUpdateSegmentDuration(editableDurationWpIndex, sec)}
                title={`Đặt thời lượng đoạn này thành +${sec}.0 giây`}
              >
                +{sec}s
              </button>
            ))}
          </div>
        )}

        <div className="field-select-mt">
          <CustomSelect<EaseName>
            id="route-insp-ease-select"
            value={activeWaypoint.ease}
            onChange={(val) => onUpdate({ ease: val })}
            options={EASING_OPTIONS}
            size="sm"
            title="Chọn kiểu gia tốc chuyển động riêng cho mốc này"
          />
        </div>
      </div>

      {/* 2. Động tác Quay Chuyên Nghiệp (20 Kỹ thuật Điện ảnh & Hoạt hình 2.5D) */}
      <div className="row-group">
        <div className="field-header">
          <label>🎬 Động tác Quay tại Mốc #{activeWaypoint.index + 1}</label>
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

        <div className="field-header" style={{ marginTop: 6 }}>
          <label htmlFor="wp-zoom-number-input">🔍 Cỡ Cảnh &amp; Độ Phóng (Zoom)</label>
          <div className="zoom-val-box">
            <input
              id="wp-zoom-number-input"
              type="number"
              min="35"
              max="2000"
              step="5"
              value={activeWaypoint.zoomPct}
              className="zoom-number-input"
              title="Nhập trực tiếp độ phóng từ 35% đến 2000%"
              onChange={(e) => {
                const zoomVal = parseInt(e.target.value, 10)
                if (!isNaN(zoomVal) && zoomVal >= 35 && zoomVal <= 2000) {
                  const nextScale = Math.round((1 / (zoomVal / 100)) * 1000) / 1000
                  onUpdate({ scale: nextScale }, 'wp-zoom')
                }
              }}
            />
            <span className="suffix">%</span>
          </div>
        </div>

        <div className="field-slider">
          <input
            id="wp-zoom-slider"
            type="range"
            min="35"
            max="2000"
            step="5"
            value={activeWaypoint.zoomPct}
            className="zoom-range"
            title={`Kéo thanh trượt độ phóng: ${activeWaypoint.zoomPct}% (tối đa 2000%)`}
            onChange={(e) => {
              const zoomVal = parseInt(e.target.value, 10)
              if (!isNaN(zoomVal) && zoomVal > 0) {
                const nextScale = Math.round((1 / (zoomVal / 100)) * 1000) / 1000
                onUpdate({ scale: nextScale }, 'wp-zoom')
              }
            }}
          />
        </div>

        <div className="preset-row zoom-presets-6">
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct <= 80 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 1.43 })}
            title="Toàn cảnh rộng (Zoom 70%)"
          >
            Toàn 70%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 95 && activeWaypoint.zoomPct <= 105 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 1.0 })}
            title="Khung chuẩn 1:1 (Zoom 100%)"
          >
            Chuẩn 100%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 130 && activeWaypoint.zoomPct <= 160 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.71 })}
            title="Trung cảnh (Zoom 140%)"
          >
            Trung 140%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 230 && activeWaypoint.zoomPct <= 300 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.4 })}
            title="Đặc tả chi tiết (Zoom 250%)"
          >
            Cận 250%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 450 && activeWaypoint.zoomPct <= 650 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.2 })}
            title="Siêu cận cảnh (Zoom 500%)"
          >
            Siêu 500%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 1800 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.05 })}
            title="Độ phóng cực đại (Zoom 2000%)"
          >
            Max 2000%
          </button>
        </div>
      </div>

      {/* 3. Điểm nhìn (Cảnh đích, Layer lấy nét) & Vị trí Lia 2D trong Cảnh */}
      <div className="row-group">
        <div className="field-header">
          <label>📍 Cảnh đích &amp; Vị trí trong Cảnh (ΔX, ΔY)</label>
          <div className="quick-align-strip">
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('left')}
              title={`Lia lệch sang phần bên trái của cảnh “${currentShotBox?.name}”`}
            >
              ↤
            </button>
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('center')}
              title={`Căn tâm Camera về chính giữa cảnh “${currentShotBox?.name}”`}
            >
              ⊡
            </button>
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('right')}
              title={`Lia lệch sang phần bên phải của cảnh “${currentShotBox?.name}”`}
            >
              ↦
            </button>
          </div>
        </div>

        <div className="target-selects-grid">
          {stageLayout.length > 1 && (
            <CustomSelect<string>
              id="route-insp-target-shot"
              value={activeWaypoint.shotId ?? 'global'}
              onChange={(val) => onTargetShot(val)}
              options={stageLayout.map((b) => ({
                value: b.shotId ?? 'global',
                label: `🎬 Cảnh: ${b.name}`
              }))}
              size="sm"
              title="Chọn Cảnh để chuyển Mốc Camera này tới"
            />
          )}

          {activeShotLayers.length > 0 && (
            <CustomSelect<string>
              id="route-insp-target-layer"
              value=""
              placeholder="🎯 Ngắm & Lấy nét vào Layer..."
              onChange={(val) => onTargetLayer(val)}
              options={activeShotLayers.map((l) => ({
                value: l.id,
                label: `🎯 ${l.name}`
              }))}
              size="sm"
              title="Căn Camera tập trung và lấy nét DOF vào một Layer cụ thể trong cảnh"
            />
          )}
        </div>

        <div className="field-row" style={{ marginTop: 4 }}>
          <div
            className="input-prefix-box"
            title={`Độ lệch ngang so với tâm cảnh “${currentShotBox?.name}” (0px = chính giữa)`}
          >
            <span className="prefix">ΔX</span>
            <input
              type="number"
              step="10"
              value={localOffsetX}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) {
                  const nextStageX = (currentShotBox ? currentShotBox.stageX : 0) + val
                  onUpdate({ stageX: nextStageX }, 'wp-pan-x')
                }
              }}
            />
          </div>
          <div
            className="input-prefix-box"
            title={`Độ lệch dọc so với tâm cảnh “${currentShotBox?.name}” (0px = chính giữa)`}
          >
            <span className="prefix">ΔY</span>
            <input
              type="number"
              step="10"
              value={localOffsetY}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) {
                  const nextStageY = (currentShotBox ? currentShotBox.stageY : 0) + val
                  onUpdate({ stageY: nextStageY }, 'wp-pan-y')
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Góc Quay 3D & Nghiêng Máy Nâng Cao (Parallax Yaw, Pitch & Dutch Roll) */}
      <div className="row-group">
        <div className="field-header">
          <label>🌐 Góc Xoay 3D &amp; Nghiêng Máy (Nâng cao)</label>
          {has3DAngle ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => onAlignInShot('reset-angles')}
              title="Đặt lại toàn bộ góc Xoay 3D & Nghiêng máy về 0°"
            >
              ↺ Đặt về 0°
            </button>
          ) : (
            <span className="angle-neutral-tag">Thẳng 0°</span>
          )}
        </div>

        <div className="angle-sliders-stack">
          <div className="angle-slider-row">
            <span className="angle-lbl" title="Xoay ngang 3D quanh điểm nhìn (Trái / Phải)">
              Xoay 3D (Yaw)
            </span>
            <input
              type="range"
              min="-65"
              max="65"
              step="1"
              value={Math.round(activeWaypoint.yaw)}
              className="zoom-range"
              onChange={(e) => onUpdate({ yaw: parseFloat(e.target.value) }, 'wp-yaw')}
            />
            <span className="angle-num">
              {activeWaypoint.yaw > 0 ? '+' : ''}
              {Math.round(activeWaypoint.yaw)}°
            </span>
          </div>

          <div className="angle-slider-row">
            <span className="angle-lbl" title="Góc ngẩng từ dưới lên (-) hoặc nhìn từ trên xuống (+)">
              Cao/Thấp (Pitch)
            </span>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={Math.round(activeWaypoint.pitch)}
              className="zoom-range"
              onChange={(e) => onUpdate({ pitch: parseFloat(e.target.value) }, 'wp-pitch')}
            />
            <span className="angle-num">
              {activeWaypoint.pitch > 0 ? '+' : ''}
              {Math.round(activeWaypoint.pitch)}°
            </span>
          </div>

          <div className="angle-slider-row">
            <span className="angle-lbl" title="Xoay nghiêng đường chân trời (Dutch Angle Roll)">
              Nghiêng (Roll)
            </span>
            <input
              type="range"
              min="-45"
              max="45"
              step="1"
              value={Math.round(activeWaypoint.roll)}
              className="zoom-range"
              onChange={(e) => onUpdate({ roll: parseFloat(e.target.value) }, 'wp-roll')}
            />
            <span className="angle-num">
              {activeWaypoint.roll > 0 ? '+' : ''}
              {Math.round(activeWaypoint.roll)}°
            </span>
          </div>
        </div>
      </div>

      {/* 5. Nút nối tiếp tạo nhanh mốc kế tiếp từ mốc này */}
      <div className="route-insp-actions">
        <button
          type="button"
          className="btn xs primary"
          onClick={() => onSpawnNext('pan')}
          title="Tạo mốc tiếp theo lia sang vị trí hoặc cảnh kế tiếp"
        >
          + Lia tiếp
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={onAddHold}
          title="Tạo mốc dừng ngắm cảnh giữ nguyên vị trí trong 2 giây"
        >
          ⏸ Dừng ngắm (2s)
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={() => onSpawnNext('zoom-in')}
          title="Tạo mốc tiếp theo đẩy cận cảnh"
        >
          🔍+ Đẩy cận
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={() => onSpawnNext('zoom-out')}
          title="Tạo mốc tiếp theo kéo toàn cảnh"
        >
          🔍- Kéo rộng
        </button>
      </div>
    </div>
  )
}
