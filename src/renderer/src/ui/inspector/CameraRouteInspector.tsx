import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EaseName } from '@shared/types'
import { setCompDuration, toast } from '../../actions'
import { evaluateScene } from '../../engine/evaluateScene'
import { frameTolerance, useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  IconCameraStage,
  IconCopy,
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
  findNearestShotByStage2D,
  projectShotLayers2D,
  type ProjectedLayer2D
} from '../viewer/animateCamera/animateCameraMath'
import {
  addCameraHoldWaypoint,
  alignWaypointInShot,
  applyCameraRoutePreset,
  applyWaypointActionMode,
  CAMERA_ACTION_MODES,
  duplicateCameraWaypoint,
  enrichCameraWaypoints,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  reverseCameraRoute,
  shiftSubsequentCameraKeyframes,
  updateCameraWaypoint,
  type CameraActionMode,
  type CameraRoutePresetType,
  type CameraWaypointItem
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { CameraWaypointDetailPanel } from './CameraWaypointDetailPanel'

export function CameraRouteInspector() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const setTime = useEditor((s) => s.setTime)
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)
  const selectShot = useEditor((s) => s.selectShot)
  const primaryView = useView((s) => s.primary)

  const [showPresetsMenu, setShowPresetsMenu] = useState(false)
  const stackRef = useRef<HTMLDivElement>(null)

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

  // Tự động cuộn danh sách mốc để mốc đang chọn (từ bóng tròn 2D hoặc kẻ phim) luôn nổi bật trong tầm mắt
  useEffect(() => {
    const container = stackRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>('.route-wp-card.active')
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeFrameIndex])

  const handleSelectWaypoint = useCallback(
    (wp: CameraWaypointItem): void => {
      setPlaying(false)
      setTime(wp.time)
      const targetShot =
        wp.shotId ?? findNearestShotByStage2D(stageLayout, wp.stageX, wp.stageY)?.shotId ?? null
      if (targetShot) {
        selectShot(targetShot)
      }
    },
    [stageLayout, selectShot, setPlaying, setTime]
  )

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
    let anchor = base
    let nextStageX = base.stageX
    let nextStageY = base.stageY
    let nextScale = base.scale

    if (mode === 'zoom-in') {
      nextScale = clampFrameScale(base.scale * 0.65)
    } else if (mode === 'zoom-out') {
      nextScale = clampFrameScale(base.scale * 1.38)
    } else {
      for (let i = base.index + 1; i < waypoints.length; i++) {
        if (waypoints[i].shotId === base.shotId) anchor = waypoints[i]
        else break
      }
      const curShotIdx = stageLayout.findIndex((b) => b.shotId === anchor.shotId)
      const nextShot =
        curShotIdx >= 0 && curShotIdx + 1 < stageLayout.length ? stageLayout[curShotIdx + 1] : null
      if (nextShot && Math.hypot(anchor.stageX - nextShot.stageX, anchor.stageY - nextShot.stageY) > 100) {
        nextStageX = nextShot.stageX
        nextStageY = nextShot.stageY
      } else {
        nextStageX = Math.round(anchor.stageX + project.comp.width * 0.22)
        nextStageY = Math.round(anchor.stageY - project.comp.height * 0.06)
      }
    }

    const nextTime = !anchor.isKeyframed
      ? stepDur
      : Math.round((anchor.time + stepDur) * 100) / 100

    update((d) => {
      if (d.camera.position.keyframes.length === 0 && d.camera.target.keyframes.length === 0) {
        applyStageFrameToDraft(d, stageLayout, 0, base.stageX, base.stageY, base.scale, true, {
          yaw: base.yaw,
          pitch: base.pitch,
          roll: base.roll
        })
      }
      shiftSubsequentCameraKeyframes(d, anchor.time, stepDur)
      if (nextTime > d.comp.duration) {
        setCompDuration(d, Math.ceil(nextTime + 1))
      }
      applyStageFrameToDraft(d, stageLayout, nextTime, nextStageX, nextStageY, nextScale, true, {
        yaw: anchor.yaw,
        pitch: anchor.pitch,
        roll: anchor.roll
      })
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
      yaw?: number
      pitch?: number
      roll?: number
      ease?: EaseName
      ripple?: boolean
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

  const handleUpdateSegmentDuration = (targetWaypointIndex: number, newDurationSec: number): void => {
    const targetWp = waypoints[targetWaypointIndex]
    const prevWp = targetWaypointIndex > 0 ? waypoints[targetWaypointIndex - 1] : null
    if (!targetWp || !prevWp) return
    const newTime = Math.max(
      prevWp.time + 0.1,
      Math.round((prevWp.time + newDurationSec) * 100) / 100
    )
    const oldTime = targetWp.time
    update((draft) => {
      updateCameraWaypoint(draft, stageLayout, oldTime, {
        time: newTime,
        ripple: true
      })
    })
    if (targetWaypointIndex === activeFrameIndex) {
      setPlaying(false)
      setTime(newTime)
    }
  }

  const handleApplyActionMode = (mode: CameraActionMode): void => {
    if (!activeWaypoint) return
    update((draft) => {
      applyWaypointActionMode(draft, stageLayout, activeWaypoint.time, mode)
    })
    const def = CAMERA_ACTION_MODES.find((m) => m.id === mode)
    toast(
      def
        ? `🎬 Mốc #${activeWaypoint.index + 1}: ${def.badgeLabel}`
        : 'Đã cập nhật động tác quay cho mốc hiện tại'
    )
  }

  const handleAlignInShot = (
    align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles'
  ): void => {
    if (!activeWaypoint) return
    update((draft) => {
      alignWaypointInShot(draft, stageLayout, activeWaypoint.time, align)
    })
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

  const handlePreset = (preset: CameraRoutePresetType): void => {
    update((draft) => {
      applyCameraRoutePreset(draft, stageLayout, preset)
    })
    setShowPresetsMenu(false)
    setPlaying(false)
    setTime(0)
    toast('🎬 Đã áp dụng kịch bản lộ trình camera mẫu')
  }

  const handleHold = (): void => {
    if (!activeWaypoint) return
    const nextTime = Math.round((activeWaypoint.time + 2.0) * 100) / 100
    update((draft) => {
      addCameraHoldWaypoint(draft, stageLayout, activeWaypoint, 2.0)
    })
    setPlaying(false)
    setTime(nextTime)
    toast('⏸ Đã thêm mốc dừng ngắm cảnh (+2.0s)')
  }

  const setShake = (amount: number, speed: number): void => {
    update((draft) => {
      draft.camera.shakeAmount = amount
      draft.camera.shakeSpeed = speed
    })
    toast(amount === 0 ? 'Đã tắt rung máy toàn lộ trình' : `Đã bật rung máy cầm tay toàn lộ trình (${amount}px)`)
  }

  const handleReverse = (): void => {
    update((draft) => {
      reverseCameraRoute(draft)
    })
    setShowPresetsMenu(false)
    setPlaying(false)
    setTime(0)
    toast('⇄ Đã đảo chiều lộ trình camera')
  }

  const handleTargetShot = (shotId: string): void => {
    if (!activeWaypoint) return
    update((draft) => {
      panCameraToShot(draft, stageLayout, shotId, activeWaypoint.time, activeWaypoint.scale)
    })
    selectShot(shotId === 'global' ? null : shotId)
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
        activeWaypoint.scale,
        activeWaypoint.ease,
        targetLayer.zDepth
      )
    })
    toast(`🎯 Đã ngắm & lấy nét vào layer "${targetLayer.name}"`)
  }

  return (
    <div id="camera-route-inspector" className="camera-route-inspector">
      {/* =====================================================================
          PHẦN 1: THIẾT LẬP DÙNG CHUNG TOÀN LỘ TRÌNH (Global Camera Route)
          ===================================================================== */}
      <div className="section global-route-section">
        <div className="route-global-banner">
          <span className="scope-badge global">🌐 DÙNG CHUNG</span>
          <span className="global-banner-title">Toàn Lộ trình ({waypoints.length} mốc)</span>
          <span className="spacer" />

          <div className="route-head-actions">
            {primaryView !== 'animate2d' && (
              <button
                type="button"
                className="btn xs"
                onClick={() => useView.getState().set({ split: false, primary: 'animate2d' })}
                title="Mở Bàn dựng Cam 2D trên màn hình chính"
              >
                <IconCameraStage width={11} height={11} /> Bàn dựng
              </button>
            )}
            <div className="presets-dropdown-rel">
              <button
                id="route-presets-btn"
                type="button"
                className="btn xs"
                onClick={() => setShowPresetsMenu((v) => !v)}
                title="Chọn kịch bản lộ trình camera mẫu chuyên nghiệp cho toàn video"
              >
                <IconWand width={11} height={11} /> Mẫu ▾
              </button>
              {showPresetsMenu && (
                <div className="route-presets-popover">
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('tour-hold-and-pan')}
                  >
                    🎬 Điện ảnh: Lia &amp; Dừng ngắm
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('hero-crane-epic')}
                  >
                    🦸 Anh hùng &amp; Cần cẩu 3D (Hero Crane)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('whip-action-rush')}
                  >
                    💨 Nhịp nhanh: Lia vút &amp; Đặc tả (Whip Rush)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('aerial-drone-sweep')}
                  >
                    🦅 Flycam Toàn không &amp; Lao xuống (Drone)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('dramatic-story-reveal')}
                  >
                    🎭 Kể chuyện: Đặc tả ➔ Mở cảnh ➔ Ngước trời
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('parallax-orbit')}
                  >
                    🌐 Lượn sóng 2.5D Parallax (Xoay 3D)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('tour-all-shots')}
                  >
                    🗺️ Lia lướt qua {stageLayout.length} Cảnh
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('cinematic-zoom')}
                  >
                    🔍 Đẩy cận &amp; Kéo rộng (Push-in)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('dolly-vertigo')}
                  >
                    🌀 Hiệu ứng Dolly Zoom (Vertigo)
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('action-dutch-cut')}
                  >
                    ⚡ Hành động: Nghiêng máy &amp; Cắt cảnh
                  </button>
                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handlePreset('dramatic-pan')}
                  >
                    📐 Lia ngang góc rộng (Dramatic Pan)
                  </button>
                  <div className="popover-sep" />
                  <button type="button" className="popover-item" onClick={handleReverse}>
                    <IconUndo width={11} height={11} /> Đảo ngược hướng lộ trình
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

        {/* Hiệu ứng Rung Máy Cầm Tay Chung Cho Toàn Lộ Trình (Đặt rõ trong khối Dùng Chung) */}
        <div className="global-shake-card">
          <div className="global-shake-head">
            <span className="shake-title">
              🤚 Rung máy cầm tay <small>(Áp dụng cả lộ trình)</small>
            </span>
            <span className="zoom-val">
              {project.camera.shakeAmount > 0 ? `${project.camera.shakeAmount}px` : 'Tắt'}
            </span>
          </div>
          <div className="preset-row zoom-presets-4">
            <button
              type="button"
              className={`btn xs${project.camera.shakeAmount === 0 ? ' active' : ''}`}
              onClick={() => setShake(0, 1)}
              title="Tắt hiệu ứng rung máy trên toàn lộ trình"
            >
              Tắt
            </button>
            <button
              type="button"
              className={`btn xs${project.camera.shakeAmount === 4 ? ' active' : ''}`}
              onClick={() => setShake(4, 1.5)}
              title="Rung máy cầm tay nhẹ tự nhiên xuyên suốt video"
            >
              ✋ Nhẹ (4px)
            </button>
            <button
              type="button"
              className={`btn xs${project.camera.shakeAmount === 12 ? ' active' : ''}`}
              onClick={() => setShake(12, 2.5)}
              title="Mô phỏng người quay đang bước đi xuyên suốt lộ trình"
            >
              🚶 Bước (12px)
            </button>
            <button
              type="button"
              className={`btn xs${project.camera.shakeAmount === 22 ? ' active' : ''}`}
              onClick={() => setShake(22, 4.0)}
              title="Rung lắc mạnh kiểu hành động kịch tính toàn lộ trình"
            >
              💥 Mạnh (22px)
            </button>
          </div>
        </div>

        {/* Danh sách các mốc lộ trình (Click vào bóng tròn ngoài cảnh sẽ tự active & cuộn tới đây) */}
        <div className="waypoints-list-header">
          <IconRoute width={11} height={11} />
          <span>Danh sách Mốc trên Lộ trình (Bấm để chọn sửa)</span>
        </div>
        <div ref={stackRef} className="route-waypoints-stack">
          {waypoints.map((wp, idx) => {
            const isActive = idx === activeFrameIndex
            const has3D = Math.abs(wp.yaw) >= 1 || Math.abs(wp.pitch) >= 1 || Math.abs(wp.roll) >= 1
            return (
              <div
                key={`wp-card-${wp.time}-${idx}`}
                id={`route-wp-item-${idx + 1}`}
                className={`route-wp-card${wp.isFirstOfShot ? ' first-of-shot' : ''}${isActive ? ' active' : ''}`}
                onClick={() => handleSelectWaypoint(wp)}
                title={`${wp.isFirstOfShot ? `⚑ MỐC MỞ MÀN CẢNH: ${wp.shotName}\n` : ''}Mốc #${idx + 1} tại ${wp.time.toFixed(1)}s · ${wp.shotName}`}
              >
                <div className="wp-card-head">
                  <div className="wp-card-title">
                    <span className={`wp-card-idx${wp.isFirstOfShot ? ' first-of-shot' : ''}`}>
                      #{idx + 1}
                    </span>
                    {wp.isFirstOfShot && (
                      <span className="wp-first-of-shot-badge" title="Mốc camera lộ trình đầu tiên của cảnh này">
                        ⚑ Đầu cảnh
                      </span>
                    )}
                    <span className="wp-card-time">{wp.time.toFixed(1)}s</span>
                    {idx > 0 && <span className="wp-card-dur">+{wp.durationFromPrev.toFixed(1)}s</span>}
                    <span className={`wp-type-badge ${wp.tag}`}>{wp.tagLabel}</span>
                    {isActive && <span className="wp-editing-pill">● Đang sửa</span>}
                  </div>

                  <div className="wp-card-inline-btns" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="wp-mini-icon-btn"
                      onClick={() => handleDuplicate(wp)}
                      title="Nhân bản mốc này"
                    >
                      <IconCopy width={10} height={10} />
                    </button>
                    {waypoints.length > 1 && (
                      <button
                        type="button"
                        className="wp-mini-icon-btn danger"
                        onClick={() => handleDelete(wp)}
                        title="Xoá mốc này"
                      >
                        <IconTrash width={10} height={10} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="wp-card-meta">
                  <span className="wp-meta-shot" style={{ color: wp.shotColor }}>
                    ● {wp.shotName}
                  </span>
                  <span>Zoom {wp.zoomPct}%</span>
                  {has3D && <span className="wp-meta-3d">{wp.angleSummary}</span>}
                  <span className="wp-card-ease">{wp.ease === 'hold' ? '⚡ cut' : wp.ease}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* =====================================================================
          PHẦN 2: CHỈNH SỬA RIÊNG MỐC ĐANG CHỌN (Per-Waypoint Settings)
          ===================================================================== */}
      {activeWaypoint && (
        <CameraWaypointDetailPanel
          activeWaypoint={activeWaypoint}
          waypoints={waypoints}
          stageLayout={stageLayout}
          activeShotLayers={activeShotLayers}
          compDuration={project.comp.duration}
          onSelectTime={(t) => {
            const wp = waypoints.find((w) => Math.abs(w.time - t) <= 0.05)
            if (wp) handleSelectWaypoint(wp)
            else {
              setPlaying(false)
              setTime(t)
            }
          }}
          onUpdate={handleUpdate}
          onUpdateSegmentDuration={handleUpdateSegmentDuration}
          onApplyActionMode={handleApplyActionMode}
          onAlignInShot={handleAlignInShot}
          onTargetShot={handleTargetShot}
          onTargetLayer={handleTargetLayer}
          onSpawnNext={spawnNextFrame}
          onAddHold={handleHold}
        />
      )}
    </div>
  )
}
