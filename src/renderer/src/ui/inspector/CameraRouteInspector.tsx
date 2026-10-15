import { useMemo, useState } from 'react'
import type { EaseName, Project } from '@shared/types'
import { setCompDuration, toast } from '../../actions'
import { evaluateScene } from '../../engine/evaluateScene'
import { frameTolerance, useEditor } from '../../store/editor'
import { CustomSelect } from '../controls/CustomSelect'
import {
  IconCopy,
  IconFocus,
  IconPlus,
  IconRoute,
  IconTrash,
  IconUndo,
  IconWand
} from '../icons'
import {
  applyStageFrameToDraft,
  clampFrameScale,
  computeShotStageLayout,
  extractCameraFrames2D,
  projectShotLayers2D,
  type ProjectedLayer2D,
  type ShotStageBox
} from '../viewer/animateCamera/animateCameraMath'
import {
  applyCameraRoutePreset,
  duplicateCameraWaypoint,
  enrichCameraWaypoints,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  reverseCameraRoute,
  updateCameraWaypoint,
  type CameraWaypointItem
} from '../viewer/animateCamera/animateCameraRouteLogic'

const EASING_OPTIONS: { value: EaseName; label: string }[] = [
  { value: 'easeInOut', label: 'Mượt mà (easeInOut)' },
  { value: 'easeIn', label: 'Tăng tốc (easeIn)' },
  { value: 'easeOut', label: 'Giảm tốc (easeOut)' },
  { value: 'linear', label: 'Đều đặn (linear)' }
]

export function CameraRouteInspector() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const setTime = useEditor((s) => s.setTime)
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)

  const [showPresetsMenu, setShowPresetsMenu] = useState(false)

  const stageLayout = useMemo(() => computeShotStageLayout(project, time), [project, time])
  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const frames = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const waypoints = useMemo(() => enrichCameraWaypoints(frames), [frames])

  const tol = frameTolerance(project)
  const activeFrameIndex = useMemo(() => {
    const exact = waypoints.findIndex((f) => Math.abs(f.time - time) <= Math.max(tol, 0.04))
    if (exact >= 0) return exact
    let best = 0
    let bestDiff = Infinity
    waypoints.forEach((f, idx) => {
      const diff = Math.abs(f.time - time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = idx
      }
    })
    return best
  }, [waypoints, time, tol])

  const activeWaypoint: CameraWaypointItem | undefined = waypoints[activeFrameIndex] ?? waypoints[0]

  const layersByShot = useMemo(() => {
    const map = new Map<string | null, ProjectedLayer2D[]>()
    for (let idx = 0; idx < stageLayout.length; idx++) {
      const box = stageLayout[idx]
      map.set(box.shotId, projectShotLayers2D(project, ev, box.shotId, idx === 0))
    }
    return map
  }, [stageLayout, project, ev])

  const activeShotLayers = useMemo(() => {
    if (!activeWaypoint?.shotId) return layersByShot.get(null) ?? []
    return layersByShot.get(activeWaypoint.shotId) ?? []
  }, [activeWaypoint?.shotId, layersByShot])

  const spawnNextFrame = (mode: 'pan' | 'zoom-in' | 'zoom-out'): void => {
    const base = activeWaypoint ?? waypoints[waypoints.length - 1]
    if (!base) return

    const stepDur = 2.0
    const isAtKeyframe = waypoints.some((f) => Math.abs(f.time - time) <= Math.max(tol, 0.04))
    let nextTime = time
    if (!base.isKeyframed) {
      nextTime = stepDur
    } else if (isAtKeyframe) {
      const nextExisting = waypoints.find((f) => f.time > base.time + 0.05)
      nextTime = nextExisting
        ? Math.round(((base.time + nextExisting.time) / 2) * 100) / 100
        : Math.round((base.time + stepDur) * 100) / 100
    }

    let nextStageX = base.stageX
    let nextStageY = base.stageY
    let nextScale = base.scale

    if (mode === 'zoom-in') {
      nextScale = clampFrameScale(base.scale * 0.65)
    } else if (mode === 'zoom-out') {
      nextScale = clampFrameScale(base.scale * 1.38)
    } else {
      const curShotIdx = stageLayout.findIndex((b) => b.shotId === base.shotId)
      const nextShot =
        curShotIdx >= 0 && curShotIdx + 1 < stageLayout.length ? stageLayout[curShotIdx + 1] : null
      if (nextShot && Math.hypot(base.stageX - nextShot.stageX, base.stageY - nextShot.stageY) > 100) {
        nextStageX = nextShot.stageX
        nextStageY = nextShot.stageY
      } else {
        nextStageX = Math.round(base.stageX + project.comp.width * 0.22)
        nextStageY = Math.round(base.stageY - project.comp.height * 0.06)
      }
    }

    update((d) => {
      if (d.camera.position.keyframes.length === 0 && d.camera.target.keyframes.length === 0) {
        applyStageFrameToDraft(d, stageLayout, 0, base.stageX, base.stageY, base.scale, true)
      }
      if (nextTime > d.comp.duration) {
        setCompDuration(d, Math.ceil(nextTime + 1))
      }
      applyStageFrameToDraft(d, stageLayout, nextTime, nextStageX, nextStageY, nextScale, true)
    })

    setPlaying(false)
    setTime(nextTime)
    toast(`🎥 Đã tạo mốc lộ trình camera tại ${nextTime.toFixed(1)}s`)
  }

  const handleUpdate = (
    updates: {
      time?: number
      stageX?: number
      stageY?: number
      scale?: number
      ease?: EaseName
    },
    mergeKey?: string
  ): void => {
    if (!activeWaypoint) return
    const oldTime = activeWaypoint.time
    update((draft) => {
      updateCameraWaypoint(draft, stageLayout, oldTime, updates)
    }, mergeKey)
    if (updates.time !== undefined && Math.abs(updates.time - oldTime) > 0.001) {
      setPlaying(false)
      setTime(updates.time)
    }
  }

  const handleDelete = (wp: CameraWaypointItem): void => {
    if (waypoints.length <= 1) {
      toast('Cần giữ lại ít nhất 1 mốc camera')
      return
    }
    update((draft) => {
      removeCameraWaypoint(draft, wp.time)
    })
    const prev = waypoints[Math.max(0, wp.index - 1)]
    if (prev) {
      setPlaying(false)
      setTime(prev.time)
    }
    toast(`Đã xoá mốc camera #${wp.index + 1}`)
  }

  const handleDuplicate = (wp: CameraWaypointItem): void => {
    const nextTime = Math.round((wp.time + 2.0) * 100) / 100
    update((draft) => {
      duplicateCameraWaypoint(draft, stageLayout, wp, nextTime)
    })
    setPlaying(false)
    setTime(nextTime)
    toast(`Đã nhân bản mốc camera #${wp.index + 1} tại ${nextTime.toFixed(1)}s`)
  }

  const handlePreset = (preset: 'tour-all-shots' | 'cinematic-zoom' | 'dramatic-pan'): void => {
    update((draft) => {
      applyCameraRoutePreset(draft, stageLayout, preset)
    })
    setShowPresetsMenu(false)
    setPlaying(false)
    setTime(0)
    toast('Đã áp dụng lộ trình camera mẫu')
  }

  const handleReverse = (): void => {
    update((draft) => {
      reverseCameraRoute(draft)
    })
    setPlaying(false)
    setTime(0)
    toast('Đã đảo chiều lộ trình camera')
  }

  const handleTargetShot = (shotId: string): void => {
    if (!activeWaypoint) return
    update((draft) => {
      panCameraToShot(draft, stageLayout, shotId, activeWaypoint.time, activeWaypoint.scale)
    })
    toast('Đã căn camera tới cảnh được chọn')
  }

  const handleTargetLayer = (layerId: string): void => {
    if (!activeWaypoint) return
    const targetLayer = activeShotLayers.find((l) => l.id === layerId)
    if (!targetLayer) return

    update((draft) => {
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

  return (
    <div id="camera-route-inspector" className="camera-route-inspector">
      {/* 1. Tiêu đề tổng quan & Thao tác lộ trình mẫu */}
      <div className="section">
        <div className="section-title">
          <IconRoute width={13} height={13} className="accent-icon" />
          <span>Lộ trình Camera 2D</span>
          <span className="route-badge">{waypoints.length} mốc</span>
          <span className="spacer" />

          <div className="route-head-actions">
            <div className="presets-dropdown-rel">
              <button
                type="button"
                className="btn xs icon"
                onClick={() => setShowPresetsMenu((v) => !v)}
                title="Lộ trình camera mẫu & Đảo chiều"
              >
                <IconWand width={12} height={12} />
              </button>
              {showPresetsMenu && (
                <div className="route-presets-popover">
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('tour-all-shots')}
                  >
                    🌐 Lia qua tất cả Cảnh ({stageLayout.length} cảnh)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('cinematic-zoom')}
                  >
                    🔍 Phóng to điện ảnh (Push-in &amp; Pull-out)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('dramatic-pan')}
                  >
                    🎬 Lia ngang góc rộng (Dramatic Pan)
                  </button>
                  <div className="popover-sep" />
                  <button type="button" className="popover-item" onClick={handleReverse}>
                    <IconUndo width={11} height={11} /> Đảo ngược hướng đi
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn xs primary icon"
              onClick={() => spawnNextFrame('pan')}
              title="Thêm mốc lộ trình tiếp theo"
            >
              <IconPlus width={12} height={12} />
            </button>
          </div>
        </div>

        {/* Danh sách các mốc lộ trình dạng flow dọc tinh gọn */}
        <div className="route-waypoints-stack">
          {waypoints.map((wp, idx) => {
            const isActive = idx === activeFrameIndex
            return (
              <div
                key={`wp-card-${wp.time}-${idx}`}
                className={`route-wp-card${isActive ? ' active' : ''}`}
                onClick={() => {
                  setPlaying(false)
                  setTime(wp.time)
                }}
              >
                <div className="wp-card-head">
                  <div className="wp-card-title">
                    <span className="wp-card-idx">#{idx + 1}</span>
                    <span className="wp-card-time">{wp.time.toFixed(1)}s</span>
                    {idx > 0 && <span className="wp-card-dur">+{wp.durationFromPrev.toFixed(1)}s</span>}
                  </div>
                  <span className={`wp-type-badge ${wp.tag}`}>{wp.tagLabel}</span>
                </div>

                <div className="wp-card-meta">
                  <span>X: {wp.stageX} · Y: {wp.stageY}</span>
                  <span>Zoom {wp.zoomPct}%</span>
                  <span className="wp-card-ease">{wp.ease}</span>
                </div>

                {isActive && (
                  <div className="wp-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn xs icon"
                      onClick={() => {
                        setPlaying(false)
                        setTime(wp.time)
                      }}
                      title="Nhảy thời gian tới mốc này"
                    >
                      <IconFocus width={11} height={11} />
                    </button>
                    <button
                      type="button"
                      className="btn xs icon"
                      onClick={() => handleDuplicate(wp)}
                      title="Nhân bản mốc này"
                    >
                      <IconCopy width={11} height={11} />
                    </button>
                    {waypoints.length > 1 && (
                      <button
                        type="button"
                        className="btn xs icon danger"
                        onClick={() => handleDelete(wp)}
                        title="Xoá mốc này"
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
      </div>

      {/* 2. Bảng Thông Số Chi Tiết Mốc Đang Chọn */}
      {activeWaypoint && (
        <div className="section active-wp-section">
          <div className="section-title">
            <span>Thông số Mốc #{activeWaypoint.index + 1} ({activeWaypoint.time.toFixed(1)}s)</span>
            <span className="spacer" />
            <span className="wp-active-shot">{activeWaypoint.shotName}</span>
          </div>

          {/* Thời điểm & Thời lượng */}
          <div className="row-group">
            <div className="field-row">
              <label>Thời điểm (s)</label>
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
            <div className="field-row">
              <label>Thời lượng (s)</label>
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

          {/* Vị trí Lia (Pan Stage) */}
          <div className="row-group">
            <div className="field-header">
              <label>Vị trí Lia (Pan 2D)</label>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  const currentShot =
                    stageLayout.find((b) => b.shotId === activeWaypoint.shotId) || stageLayout[0]
                  if (currentShot) handleUpdate({ stageX: currentShot.stageX, stageY: currentShot.stageY })
                }}
                title="Căn tâm camera về chính giữa Cảnh hiện tại"
              >
                Căn tâm cảnh
              </button>
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
                    if (!isNaN(val)) handleUpdate({ stageX: val }, 'wp-pan-x')
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
                    if (!isNaN(val)) handleUpdate({ stageY: val }, 'wp-pan-y')
                  }}
                />
              </div>
            </div>

            {/* Menu lia tới Cảnh */}
            {stageLayout.length > 1 && (
              <div className="field-select-mt">
                <CustomSelect<string>
                  id="route-insp-target-shot"
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

            {/* Menu lia vào Layer */}
            {activeShotLayers.length > 0 && (
              <div className="field-select-mt">
                <CustomSelect<string>
                  id="route-insp-target-layer"
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

          {/* Độ Phóng To (Zoom) */}
          <div className="row-group">
            <div className="field-header">
              <label>Độ Phóng To (Zoom)</label>
              <span className="zoom-val">{activeWaypoint.zoomPct}%</span>
            </div>

            <div className="field-slider">
              <input
                type="range"
                min="30"
                max="350"
                step="5"
                value={activeWaypoint.zoomPct}
                className="zoom-range"
                onChange={(e) => {
                  const zoomVal = parseInt(e.target.value, 10)
                  if (!isNaN(zoomVal) && zoomVal > 0) {
                    const nextScale = Math.round((1 / (zoomVal / 100)) * 100) / 100
                    handleUpdate({ scale: nextScale }, 'wp-zoom')
                  }
                }}
              />
            </div>

            <div className="preset-row">
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

          {/* Đường cong chuyển động (Easing) */}
          <div className="row-group">
            <div className="field-header">
              <label>Đường cong Easing</label>
            </div>
            <CustomSelect<EaseName>
              id="route-insp-ease-select"
              value={activeWaypoint.ease}
              onChange={(val) => handleUpdate({ ease: val })}
              options={EASING_OPTIONS}
              size="sm"
              title="Chọn kiểu đường cong nội suy chuyển động"
            />
          </div>

          {/* Nút tạo mốc tiếp theo */}
          <div className="route-insp-actions">
            <button
              type="button"
              className="btn xs primary"
              onClick={() => spawnNextFrame('pan')}
              title="Tạo mốc tiếp theo lia sang vị trí kế tiếp"
            >
              + Lia tiếp
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => spawnNextFrame('zoom-in')}
              title="Tạo mốc tiếp theo phóng to cận cảnh"
            >
              🔍+ Phóng to
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => spawnNextFrame('zoom-out')}
              title="Tạo mốc tiếp theo thu nhỏ mở rộng"
            >
              🔍- Thu nhỏ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
