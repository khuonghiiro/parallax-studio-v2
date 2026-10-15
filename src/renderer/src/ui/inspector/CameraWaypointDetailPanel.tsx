import type { EaseName } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import type { ProjectedLayer2D, ShotStageBox } from '../viewer/animateCamera/animateCameraMath'
import type {
  CameraActionMode,
  CameraWaypointItem
} from '../viewer/animateCamera/animateCameraRouteLogic'

const EASING_OPTIONS: { value: EaseName; label: string }[] = [
  { value: 'easeInOut', label: '🌊 Mượt tự nhiên (easeInOut)' },
  { value: 'easeInOutStrong', label: '🎬 Điện ảnh nhanh-chậm (Strong)' },
  { value: 'easeOut', label: '🛬 Đáp êm cuối cảnh (easeOut)' },
  { value: 'easeIn', label: '🚀 Tăng tốc dần (easeIn)' },
  { value: 'linear', label: '📏 Đều tốc (linear)' },
  { value: 'hold', label: '⚡ Cắt cảnh tức thì (Jump Cut)' }
]

const ACTION_MODES: { id: CameraActionMode; icon: string; label: string; hint: string }[] = [
  { id: 'hold', icon: '⏸', label: 'Dừng ngắm', hint: 'Giữ nguyên khung hình của mốc trước để dừng ngắm cảnh' },
  { id: 'pan', icon: '↔', label: 'Lia cân bằng', hint: 'Lia máy mượt mà với góc nhìn thẳng 0° cân bằng' },
  { id: 'push-in', icon: '🔍+', label: 'Đẩy cận', hint: 'Thu nhỏ khung camera để đẩy cận cảnh vào chủ thể (Dolly In)' },
  { id: 'pull-out', icon: '🔍-', label: 'Kéo rộng', hint: 'Mở rộng khung camera để lấy toàn cảnh (Dolly Out)' },
  { id: 'orbit-left', icon: '↺', label: '3D Trái', hint: 'Xoay góc máy 3D sang trái (-25°) tạo chiều sâu Parallax 2.5D' },
  { id: 'orbit-right', icon: '↻', label: '3D Phải', hint: 'Xoay góc máy 3D sang phải (+25°) tạo chiều sâu Parallax 2.5D' },
  { id: 'dutch-tilt', icon: '📐', label: 'Nghiêng máy', hint: 'Xoay nghiêng máy kịch tính (Dutch Angle Roll ±12°)' },
  { id: 'cut', icon: '⚡', label: 'Cắt cảnh', hint: 'Chuyển thẳng sang khung hình này không lia giữa chừng (Jump Cut)' }
]

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
  onApplyActionMode,
  onAlignInShot,
  onTargetShot,
  onTargetLayer,
  onSpawnNext,
  onAddHold
}: CameraWaypointDetailPanelProps) {
  const prevWp = activeWaypoint.index > 0 ? waypoints[activeWaypoint.index - 1] : null
  const nextWp =
    activeWaypoint.index + 1 < waypoints.length ? waypoints[activeWaypoint.index + 1] : null
  const has3DAngle =
    Math.abs(activeWaypoint.yaw) >= 0.5 ||
    Math.abs(activeWaypoint.pitch) >= 0.5 ||
    Math.abs(activeWaypoint.roll) >= 0.5

  return (
    <div className="section active-wp-section">
      {/* Header điều hướng nhanh giữa các Mốc */}
      <div className="section-title wp-detail-head">
        <span>
          Mốc #{activeWaypoint.index + 1} · <b>{activeWaypoint.time.toFixed(1)}s</b>
        </span>
        <span className="wp-active-shot" style={{ borderColor: activeWaypoint.shotColor }}>
          {activeWaypoint.shotName}
        </span>
        <span className="spacer" />
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

      {/* 1. Chế độ Quay & Động tác tại Mốc (Camera State & Action Mode) */}
      <div className="row-group">
        <div className="field-header">
          <label>Chế độ Quay tại Mốc</label>
          <span className="wp-mode-current">{activeWaypoint.tagLabel}</span>
        </div>
        <div className="cam-action-mode-grid">
          {ACTION_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`cam-mode-btn${activeWaypoint.actionMode === m.id ? ' active' : ''}`}
              onClick={() => onApplyActionMode(m.id)}
              title={m.hint}
            >
              <span className="mode-ico">{m.icon}</span>
              <span className="mode-lbl">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Điểm nhìn (Cảnh, Layer) & Vị trí Lia 2D */}
      <div className="row-group">
        <div className="field-header">
          <label>Vị trí Lia &amp; Điểm Ngắm (Pan 2D)</label>
          <div className="quick-align-strip">
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('left')}
              title="Lia lệch sang phần bên trái của Cảnh"
            >
              ↤ Trái
            </button>
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('center')}
              title="Căn tâm Camera về chính giữa Cảnh hiện tại"
            >
              ⊡ Tâm
            </button>
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('right')}
              title="Lia lệch sang phần bên phải của Cảnh"
            >
              Phải ↦
            </button>
          </div>
        </div>

        <div className="field-row">
          <div className="input-prefix-box">
            <span className="prefix">X</span>
            <input
              type="number"
              step="10"
              value={activeWaypoint.stageX}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) onUpdate({ stageX: val }, 'wp-pan-x')
              }}
            />
          </div>
          <div className="input-prefix-box">
            <span className="prefix">Y</span>
            <input
              type="number"
              step="10"
              value={activeWaypoint.stageY}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) onUpdate({ stageY: val }, 'wp-pan-y')
              }}
            />
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
                label: `🎬 ${b.name}`
              }))}
              size="sm"
              title="Chọn Cảnh để lia tâm Camera tới"
            />
          )}

          {activeShotLayers.length > 0 && (
            <CustomSelect<string>
              id="route-insp-target-layer"
              value=""
              placeholder="🎯 Ngắm & Lấy nét Layer..."
              onChange={(val) => onTargetLayer(val)}
              options={activeShotLayers.map((l) => ({
                value: l.id,
                label: `🎯 ${l.name}`
              }))}
              size="sm"
              title="Căn Camera tập trung và lấy nét DOF vào một Layer cụ thể"
            />
          )}
        </div>
      </div>

      {/* 3. Cỡ Cảnh & Độ Phóng Đại (Zoom) */}
      <div className="row-group">
        <div className="field-header">
          <label>Cỡ Cảnh &amp; Độ Phóng (Zoom)</label>
          <span className="zoom-val">{activeWaypoint.zoomPct}%</span>
        </div>

        <div className="field-slider">
          <input
            type="range"
            min="35"
            max="320"
            step="5"
            value={activeWaypoint.zoomPct}
            className="zoom-range"
            onChange={(e) => {
              const zoomVal = parseInt(e.target.value, 10)
              if (!isNaN(zoomVal) && zoomVal > 0) {
                const nextScale = Math.round((1 / (zoomVal / 100)) * 100) / 100
                onUpdate({ scale: nextScale }, 'wp-zoom')
              }
            }}
          />
        </div>

        <div className="preset-row zoom-presets-5">
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
            className={`btn xs${activeWaypoint.zoomPct >= 130 && activeWaypoint.zoomPct <= 155 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.71 })}
            title="Trung cảnh (Zoom 140%)"
          >
            Trung 140%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 170 && activeWaypoint.zoomPct <= 210 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.55 })}
            title="Cận cảnh (Zoom 180%)"
          >
            Cận 180%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 235 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 0.4 })}
            title="Đặc tả chi tiết (Zoom 250%)"
          >
            Đặc tả 250%
          </button>
        </div>
      </div>

      {/* 4. Góc Quay 3D & Nghiêng Máy (Orbit Yaw, Pitch & Dutch Roll) */}
      <div className="row-group">
        <div className="field-header">
          <label>Góc Quay 3D &amp; Xoay Máy (Parallax)</label>
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

        <div className="preset-row zoom-presets-5">
          <button
            type="button"
            className={`btn xs${activeWaypoint.yaw <= -20 ? ' active' : ''}`}
            onClick={() => onUpdate({ yaw: -28, pitch: 4 })}
            title="Góc chéo trái -28°"
          >
            -28° Trái
          </button>
          <button
            type="button"
            className={`btn xs${!has3DAngle ? ' active' : ''}`}
            onClick={() => onAlignInShot('reset-angles')}
            title="Chính diện thẳng 0°"
          >
            0° Thẳng
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.yaw >= 20 ? ' active' : ''}`}
            onClick={() => onUpdate({ yaw: 28, pitch: 4 })}
            title="Góc chéo phải +28°"
          >
            +28° Phải
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.pitch >= 15 ? ' active' : ''}`}
            onClick={() => onUpdate({ yaw: 0, pitch: 22 })}
            title="Góc cao nhìn xuống +22°"
          >
            +22° Cao
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.pitch <= -12 ? ' active' : ''}`}
            onClick={() => onUpdate({ yaw: 0, pitch: -16 })}
            title="Góc thấp ngước lên -16°"
          >
            -16° Thấp
          </button>
        </div>
      </div>

      {/* 5. Thời gian & Chuyển tiếp (Timing & Easing) */}
      <div className="row-group">
        <div className="field-row">
          <div>
            <label>Thời điểm (s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max={compDuration + 10}
              value={activeWaypoint.time}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onUpdate({ time: Math.max(0, val) })
              }}
            />
          </div>
          <div>
            <label title="Đổi thời lượng đoạn này sẽ tự động dồn các mốc phía sau">
              Thời lượng đoạn (s)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              disabled={activeWaypoint.index === 0}
              value={activeWaypoint.durationFromPrev}
              onChange={(e) => {
                const dur = parseFloat(e.target.value)
                if (!isNaN(dur) && activeWaypoint.index > 0 && prevWp) {
                  onUpdate({
                    time: Math.max(prevWp.time + 0.1, Math.round((prevWp.time + dur) * 100) / 100),
                    ripple: true
                  })
                }
              }}
            />
          </div>
        </div>

        <div className="field-select-mt">
          <CustomSelect<EaseName>
            id="route-insp-ease-select"
            value={activeWaypoint.ease}
            onChange={(val) => onUpdate({ ease: val })}
            options={EASING_OPTIONS}
            size="sm"
            title="Chọn kiểu đường cong chuyển tiếp từ mốc này sang mốc kế tiếp"
          />
        </div>
      </div>

      {/* 6. Nút tạo nhanh mốc kế tiếp */}
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
