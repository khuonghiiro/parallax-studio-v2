import type { EaseName } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import type { ProjectedLayer2D, ShotStageBox } from '../viewer/animateCamera/animateCameraMath'
import type { CameraWaypointItem } from '../viewer/animateCamera/animateCameraRouteLogic'

interface CameraPoseControlsProps {
  activeWaypoint: CameraWaypointItem
  stageLayout: ShotStageBox[]
  activeShotLayers: ProjectedLayer2D[]
  currentShotBox?: ShotStageBox
  localOffsetX: number
  localOffsetY: number
  has3DAngle: boolean
  sectionTitlePrefix?: string
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
  onAlignInShot: (align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles') => void
  onTargetShot: (shotId: string) => void
  onTargetLayer: (layerId: string) => void
}

export function CameraPoseControls({
  activeWaypoint,
  stageLayout,
  activeShotLayers,
  currentShotBox,
  localOffsetX,
  localOffsetY,
  has3DAngle,
  sectionTitlePrefix,
  onUpdate,
  onAlignInShot,
  onTargetShot,
  onTargetLayer
}: CameraPoseControlsProps) {
  const prefixStr = sectionTitlePrefix ? `${sectionTitlePrefix}: ` : ''

  return (
    <>
      {/* 1. Cỡ Cảnh & Độ Phóng (Zoom) */}
      <div className="row-group">
        <div className="field-header">
          <label htmlFor="wp-zoom-number-input">
            🔍 {prefixStr}Cỡ Cảnh &amp; Độ Phóng (Zoom)
          </label>
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
                const zoomVal = parseFloat(e.target.value)
                if (!isNaN(zoomVal) && zoomVal >= 35 && zoomVal <= 2000) {
                  onUpdate({ scale: 100 / zoomVal }, 'wp-zoom')
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
              const zoomVal = parseFloat(e.target.value)
              if (!isNaN(zoomVal) && zoomVal > 0) {
                onUpdate({ scale: 100 / zoomVal }, 'wp-zoom')
              }
            }}
          />
        </div>

        <div className="preset-row zoom-presets-6">
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct <= 80 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 100 / 70 })}
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
            onClick={() => onUpdate({ scale: 100 / 140 })}
            title="Trung cảnh (Zoom 140%)"
          >
            Trung 140%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 230 && activeWaypoint.zoomPct <= 300 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 100 / 250 })}
            title="Đặc tả chi tiết (Zoom 250%)"
          >
            Cận 250%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 450 && activeWaypoint.zoomPct <= 650 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 100 / 500 })}
            title="Siêu cận cảnh (Zoom 500%)"
          >
            Siêu 500%
          </button>
          <button
            type="button"
            className={`btn xs${activeWaypoint.zoomPct >= 1800 ? ' active' : ''}`}
            onClick={() => onUpdate({ scale: 100 / 2000 })}
            title="Độ phóng cực đại (Zoom 2000%)"
          >
            Max 2000%
          </button>
        </div>
      </div>

      {/* 2. Điểm nhìn (Cảnh đích, Layer lấy nét) & Vị trí Lia 2D trong Cảnh */}
      <div className="row-group">
        <div className="field-header">
          <label>📍 {prefixStr}Vị trí trong Cảnh (ΔX, ΔY)</label>
          <div className="quick-align-strip">
            <button
              type="button"
              className="mini-chip-btn"
              onClick={() => onAlignInShot('left')}
              title={`Căn khung sang lề trái cảnh “${currentShotBox?.name}”`}
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
              title={`Căn khung sang lề phải cảnh “${currentShotBox?.name}”`}
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
              title="Căn Camera tập trung và lấy nét vào một Layer cụ thể trong cảnh"
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

      {/* 3. Góc Quay 3D & Nghiêng Máy Nâng Cao (Parallax Yaw, Pitch & Dutch Roll) */}
      <div className="row-group">
        <div className="field-header">
          <label>🌐 {prefixStr}Góc Xoay 3D &amp; Nghiêng Máy</label>
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
    </>
  )
}
