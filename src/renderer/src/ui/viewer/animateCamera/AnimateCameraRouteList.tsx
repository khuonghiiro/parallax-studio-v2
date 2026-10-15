import { useMemo, useState } from 'react'
import type { EaseName, Project } from '@shared/types'
import { toast } from '../../../actions'
import { CustomSelect } from '../../controls/CustomSelect'
import {
  IconChevronDown,
  IconCopy,
  IconFocus,
  IconPlus,
  IconRoute,
  IconTrash,
  IconUndo,
  IconWand
} from '../../icons'
import type { CameraFrame2D, ProjectedLayer2D, ShotStageBox } from './animateCameraMath'
import {
  applyCameraRoutePreset,
  duplicateCameraWaypoint,
  enrichCameraWaypoints,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  reverseCameraRoute,
  updateCameraWaypoint,
  zoomCameraAtPoint,
  type CameraWaypointItem
} from './animateCameraRouteLogic'

interface AnimateCameraRouteListProps {
  project: Project
  stageLayout: ShotStageBox[]
  frames: CameraFrame2D[]
  activeFrameIndex: number
  currentTime: number
  layersByShot: Map<string | null, ProjectedLayer2D[]>
  onSelectFrame: (time: number) => void
  onUpdateProject: (updater: (draft: Project) => void, label?: string) => void
  onSpawnFrame: (mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot', targetShot?: ShotStageBox) => void
  isOpen: boolean
  onToggleOpen: () => void
}

const EASING_OPTIONS: { value: EaseName; label: string }[] = [
  { value: 'easeInOut', label: 'Mượt mà (easeInOut)' },
  { value: 'easeIn', label: 'Tăng tốc (easeIn)' },
  { value: 'easeOut', label: 'Giảm tốc (easeOut)' },
  { value: 'linear', label: 'Đều đặn (linear)' }
]

export function AnimateCameraRouteList({
  project,
  stageLayout,
  frames,
  activeFrameIndex,
  currentTime: _currentTime,
  layersByShot,
  onSelectFrame,
  onUpdateProject,
  onSpawnFrame,
  isOpen,
  onToggleOpen
}: AnimateCameraRouteListProps) {
  const waypoints = useMemo(() => enrichCameraWaypoints(frames), [frames])
  const activeWaypoint: CameraWaypointItem | undefined = waypoints[activeFrameIndex] ?? waypoints[0]
  const [showPresetsMenu, setShowPresetsMenu] = useState(false)

  // Layers belonging to active waypoint's shot for quick layer targeting
  const activeShotLayers = useMemo(() => {
    if (!activeWaypoint?.shotId) return layersByShot.get(null) ?? []
    return layersByShot.get(activeWaypoint.shotId) ?? []
  }, [activeWaypoint?.shotId, layersByShot])

  const handleUpdate = (
    updates: {
      time?: number
      stageX?: number
      stageY?: number
      scale?: number
      ease?: EaseName
    },
    mergeKey?: string
  ) => {
    if (!activeWaypoint) return
    const oldTime = activeWaypoint.time
    onUpdateProject((draft) => {
      updateCameraWaypoint(draft, stageLayout, oldTime, updates)
    }, mergeKey)
    if (updates.time !== undefined && Math.abs(updates.time - oldTime) > 0.001) {
      onSelectFrame(updates.time)
    }
  }

  const handleDelete = (wp: CameraWaypointItem) => {
    if (waypoints.length <= 1) {
      toast('Cần giữ lại ít nhất 1 điểm dừng camera')
      return
    }
    onUpdateProject((draft) => {
      removeCameraWaypoint(draft, wp.time)
    })
    const prev = waypoints[Math.max(0, wp.index - 1)]
    if (prev) onSelectFrame(prev.time)
    toast(`Đã xoá điểm camera #${wp.index + 1}`)
  }

  const handleDuplicate = (wp: CameraWaypointItem) => {
    const nextTime = Math.round((wp.time + 2.0) * 100) / 100
    onUpdateProject((draft) => {
      duplicateCameraWaypoint(draft, stageLayout, wp, nextTime)
    })
    onSelectFrame(nextTime)
    toast(`Đã nhân bản điểm camera #${wp.index + 1} tại ${nextTime.toFixed(1)}s`)
  }

  const handlePreset = (preset: 'tour-all-shots' | 'cinematic-zoom' | 'dramatic-pan') => {
    onUpdateProject((draft) => {
      applyCameraRoutePreset(draft, stageLayout, preset)
    })
    setShowPresetsMenu(false)
    onSelectFrame(0)
    toast('Đã áp dụng lộ trình camera mẫu')
  }

  const handleReverse = () => {
    onUpdateProject((draft) => {
      reverseCameraRoute(draft)
    })
    onSelectFrame(0)
    toast('Đã đảo chiều lộ trình camera')
  }

  const handleTargetShot = (shotId: string) => {
    if (!activeWaypoint) return
    onUpdateProject((draft) => {
      panCameraToShot(draft, stageLayout, shotId, activeWaypoint.time, activeWaypoint.scale)
    })
    toast('Đã căn tâm camera tới cảnh được chọn')
  }

  const handleTargetLayer = (layerId: string) => {
    if (!activeWaypoint) return
    const targetLayer = activeShotLayers.find((l) => l.id === layerId)
    if (!targetLayer) return

    onUpdateProject((draft) => {
      panCameraToLayer2D(
        draft,
        stageLayout,
        activeWaypoint.shotId,
        targetLayer.offsetX,
        targetLayer.offsetY,
        activeWaypoint.time,
        activeWaypoint.scale
      )
    })
    toast(`Đã lia camera vào layer "${targetLayer.name}"`)
  }

  if (!isOpen) {
    return (
      <button
        id="anim2d-open-route-panel"
        type="button"
        className="anim2d-route-toggle-btn collapsed"
        onClick={onToggleOpen}
        title="Mở Bảng Danh sách Lộ trình Camera"
      >
        <IconRoute width={13} height={13} />
        <span>Lộ trình ({waypoints.length})</span>
      </button>
    )
  }

  return (
    <div id="anim2d-route-sidebar" className="anim2d-route-panel">
      {/* 1. Header danh sách lộ trình */}
      <div className="anim2d-route-header">
        <div className="anim2d-route-title">
          <IconRoute width={14} height={14} className="accent-icon" />
          <span>Lộ trình Camera</span>
          <span className="anim2d-route-count">{waypoints.length} điểm</span>
        </div>

        <div className="anim2d-route-head-actions">
          <div className="anim2d-presets-dropdown-wrapper">
            <button
              type="button"
              className="btn xs icon"
              onClick={() => setShowPresetsMenu((v) => !v)}
              title="Lộ trình mẫu & Thao tác lộ trình"
            >
              <IconWand width={12} height={12} />
            </button>
            {showPresetsMenu && (
              <div className="anim2d-presets-menu">
                <button
                  type="button"
                  className="preset-item"
                  onClick={() => handlePreset('tour-all-shots')}
                >
                  🌐 Lia qua tất cả Cảnh ({stageLayout.length} cảnh)
                </button>
                <button
                  type="button"
                  className="preset-item"
                  onClick={() => handlePreset('cinematic-zoom')}
                >
                  🔍 Phóng to điện ảnh (Push-in &amp; Pull-out)
                </button>
                <button
                  type="button"
                  className="preset-item"
                  onClick={() => handlePreset('dramatic-pan')}
                >
                  🎬 Lia ngang góc rộng (Dramatic Pan)
                </button>
                <div className="preset-sep" />
                <button type="button" className="preset-item" onClick={handleReverse}>
                  <IconUndo width={11} height={11} /> Đảo ngược hướng đi
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn xs primary icon"
            onClick={() => onSpawnFrame('pan')}
            title="Thêm điểm dừng camera tiếp theo"
          >
            <IconPlus width={12} height={12} />
          </button>

          <button
            type="button"
            className="btn xs icon"
            onClick={onToggleOpen}
            title="Thu gọn bảng lộ trình camera"
          >
            <IconChevronDown width={12} height={12} className="rotate-270" />
          </button>
        </div>
      </div>

      {/* 2. Danh sách các điểm dừng (Scrollable Waypoint List) */}
      <div className="anim2d-waypoints-list">
        {waypoints.map((wp, idx) => {
          const isActive = idx === activeFrameIndex
          return (
            <div
              key={`wp-${wp.time}-${idx}`}
              className={`anim2d-wp-card${isActive ? ' active' : ''}`}
              onClick={() => onSelectFrame(wp.time)}
            >
              <div className="anim2d-wp-row-1">
                <div className="anim2d-wp-badge">
                  <span className="wp-num">#{idx + 1}</span>
                  <span className="wp-time">{wp.time.toFixed(1)}s</span>
                  {idx > 0 && <span className="wp-dur">+{wp.durationFromPrev.toFixed(1)}s</span>}
                </div>
                <span className={`anim2d-wp-tag ${wp.tag}`}>{wp.tagLabel}</span>
              </div>

              <div className="anim2d-wp-row-2">
                <span className="wp-meta-item" title="Tọa độ tâm camera trên sân khấu">
                  X:{wp.stageX} Y:{wp.stageY}
                </span>
                <span className="wp-meta-item" title="Độ phóng đại khung nhìn">
                  Zoom {wp.zoomPct}%
                </span>
                <span className="wp-meta-item ease" title="Đường cong nội suy chuyển động">
                  {wp.ease}
                </span>
              </div>

              {isActive && (
                <div className="anim2d-wp-quick-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn xs icon"
                    onClick={() => onSelectFrame(wp.time)}
                    title="Nhảy thời gian tới điểm này"
                  >
                    <IconFocus width={11} height={11} />
                  </button>
                  <button
                    type="button"
                    className="btn xs icon"
                    onClick={() => handleDuplicate(wp)}
                    title="Nhân bản điểm này"
                  >
                    <IconCopy width={11} height={11} />
                  </button>
                  {waypoints.length > 1 && (
                    <button
                      type="button"
                      className="btn xs icon danger"
                      onClick={() => handleDelete(wp)}
                      title="Xoá điểm dừng này"
                    >
                      <IconTrash width={11} height={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 3. Bảng Chi Tiết Thông Số Điểm Dừng Đang Chọn (Waypoint Parameter Inspector) */}
      {activeWaypoint && (
        <div className="anim2d-wp-inspector">
          <div className="anim2d-inspector-head">
            <span className="head-title">
              Thông số Điểm #{activeWaypoint.index + 1} ({activeWaypoint.time.toFixed(1)}s)
            </span>
            <span className="head-shot-name">{activeWaypoint.shotName}</span>
          </div>

          <div className="anim2d-inspector-body">
            {/* Nhóm 1: Thời điểm & Thời lượng */}
            <div className="anim2d-prop-group">
              <label className="prop-label">Thời điểm &amp; Thời lượng</label>
              <div className="prop-row dual">
                <div className="input-with-label" title="Thời điểm chính xác trên thanh thời gian (giây)">
                  <span className="input-prefix">Mốc (s)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={project.comp.duration}
                    value={activeWaypoint.time}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) handleUpdate({ time: Math.max(0, val) })
                    }}
                  />
                </div>
                <div className="input-with-label" title="Thời lượng chuyển tiếp từ điểm trước (giây)">
                  <span className="input-prefix">Lượng (s)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    disabled={activeWaypoint.index === 0}
                    value={activeWaypoint.durationFromPrev}
                    onChange={(e) => {
                      const dur = parseFloat(e.target.value)
                      if (!isNaN(dur) && activeWaypoint.index > 0) {
                        const prevT = waypoints[activeWaypoint.index - 1].time
                        handleUpdate({ time: Math.max(prevT + 0.1, prevT + dur) })
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Nhóm 2: Vị trí Lia Camera (Pan X, Pan Y) */}
            <div className="anim2d-prop-group">
              <div className="prop-label-row">
                <label className="prop-label">Vị trí Lia (Pan Stage)</label>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    const currentShot = stageLayout.find((b) => b.shotId === activeWaypoint.shotId) || stageLayout[0]
                    if (currentShot) handleUpdate({ stageX: currentShot.stageX, stageY: currentShot.stageY })
                  }}
                  title="Căn tâm camera về chính giữa Cảnh hiện tại"
                >
                  Tâm cảnh
                </button>
              </div>

              <div className="prop-row dual">
                <div className="input-with-label" title="Tọa độ X ngang trên mặt phẳng 2D">
                  <span className="input-prefix">X</span>
                  <input
                    type="number"
                    step="10"
                    value={activeWaypoint.stageX}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) handleUpdate({ stageX: val }, 'wp-pan-x')
                    }}
                  />
                </div>
                <div className="input-with-label" title="Tọa độ Y dọc trên mặt phẳng 2D">
                  <span className="input-prefix">Y</span>
                  <input
                    type="number"
                    step="10"
                    value={activeWaypoint.stageY}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) handleUpdate({ stageY: val }, 'wp-pan-y')
                    }}
                  />
                </div>
              </div>

              {/* Lia nhanh tới Cảnh mục tiêu */}
              {stageLayout.length > 1 && (
                <div className="prop-row mt-4">
                  <CustomSelect<string>
                    id="wp-target-shot"
                    value={activeWaypoint.shotId ?? 'global'}
                    onChange={(val) => handleTargetShot(val)}
                    options={stageLayout.map((b) => ({
                      value: b.shotId ?? 'global',
                      label: `Lia tới: ${b.name}`
                    }))}
                    size="sm"
                    title="Chọn cảnh để lia tâm camera tới"
                  />
                </div>
              )}

              {/* Lia nhanh tới Layer trong Cảnh */}
              {activeShotLayers.length > 0 && (
                <div className="prop-row mt-4">
                  <CustomSelect<string>
                    id="wp-target-layer"
                    value=""
                    placeholder="Lia vào Layer mục tiêu..."
                    onChange={(val) => handleTargetLayer(val)}
                    options={activeShotLayers.map((l) => ({
                      value: l.id,
                      label: `🎯 ${l.name}`
                    }))}
                    size="sm"
                    title="Căn camera tập trung vào một layer cụ thể"
                  />
                </div>
              )}
            </div>

            {/* Nhóm 3: Phóng to / Thu nhỏ (Zoom / Scale) */}
            <div className="anim2d-prop-group">
              <div className="prop-label-row">
                <label className="prop-label">Độ Phóng To (Zoom)</label>
                <span className="prop-val-badge">{activeWaypoint.zoomPct}%</span>
              </div>

              <div className="prop-row">
                <input
                  type="range"
                  min="30"
                  max="350"
                  step="5"
                  value={activeWaypoint.zoomPct}
                  className="range-slider"
                  onChange={(e) => {
                    const zoomVal = parseInt(e.target.value, 10)
                    if (!isNaN(zoomVal) && zoomVal > 0) {
                      const nextScale = Math.round((1 / (zoomVal / 100)) * 100) / 100
                      handleUpdate({ scale: nextScale }, 'wp-zoom')
                    }
                  }}
                />
              </div>

              {/* Preset Zoom một chạm */}
              <div className="prop-row preset-buttons">
                <button
                  type="button"
                  className={`btn xs${activeWaypoint.zoomPct >= 170 ? ' active' : ''}`}
                  onClick={() => handleUpdate({ scale: 0.55 })}
                  title="Phóng to cận cảnh (Zoom In 180%)"
                >
                  🔍 Cận cảnh (180%)
                </button>
                <button
                  type="button"
                  className={`btn xs${activeWaypoint.zoomPct >= 95 && activeWaypoint.zoomPct <= 105 ? ' active' : ''}`}
                  onClick={() => handleUpdate({ scale: 1.0 })}
                  title="Khung chuẩn 100%"
                >
                  ⊡ Chuẩn (100%)
                </button>
                <button
                  type="button"
                  className={`btn xs${activeWaypoint.zoomPct <= 70 ? ' active' : ''}`}
                  onClick={() => handleUpdate({ scale: 1.65 })}
                  title="Thu nhỏ toàn cảnh (Zoom Out 60%)"
                >
                  🌐 Toàn cảnh (60%)
                </button>
              </div>
            </div>

            {/* Nhóm 4: Đường cong chuyển động (Easing) */}
            <div className="anim2d-prop-group">
              <label className="prop-label">Đường cong chuyển động (Easing)</label>
              <div className="prop-row">
                <CustomSelect<EaseName>
                  id="wp-ease-select"
                  value={activeWaypoint.ease}
                  onChange={(val) => handleUpdate({ ease: val })}
                  options={EASING_OPTIONS}
                  size="sm"
                  title="Chọn kiểu đường cong nội suy camera"
                />
              </div>
            </div>

            {/* Nhóm 5: Các nút hành động tạo điểm tiếp theo từ điểm này */}
            <div className="anim2d-inspector-actions">
              <button
                type="button"
                className="btn xs primary"
                onClick={() => onSpawnFrame('pan')}
                title="Tạo điểm tiếp theo lia tới vị trí kế tiếp"
              >
                + Lia tiếp
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnFrame('zoom-in')}
                title="Tạo điểm tiếp theo phóng to cận cảnh"
              >
                🔍+ Phóng to
              </button>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSpawnFrame('zoom-out')}
                title="Tạo điểm tiếp theo thu nhỏ toàn cảnh"
              >
                🔍- Thu nhỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
