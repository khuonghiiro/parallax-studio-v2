import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Animatable } from '@shared/types'
import { setCompDuration, toast } from '../../../actions'
import { evaluateScene } from '../../../engine/evaluateScene'
import { assetStore } from '../../../project/assets'
import { frameTolerance, useEditor } from '../../../store/editor'
import { useView } from '../../../store/view'
import {
  IconFocus,
  IconLayout2D3D,
  IconPause,
  IconPlay,
  IconPlus,
  IconRoute,
  IconSingle
} from '../../icons'
import { AnimateShotPlane2D } from './AnimateShotPlane2D'
import { AnimateCameraViewfinder, type StageToolMode } from './AnimateCameraViewfinder'
import {
  applyStageFrameToDraft,
  clampFrameScale,
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  projectShotLayers2D,
  type CameraFrame2D,
  type ProjectedLayer2D,
  type ShotStageBox
} from './animateCameraMath'
import {
  addCameraHoldWaypoint,
  alignWaypointInShot,
  applyWaypointActionMode,
  enrichCameraWaypoints,
  panCameraToLayer2D,
  panCameraToShot,
  updateCameraWaypoint,
  type CameraActionMode
} from './animateCameraRouteLogic'
import { useCameraStageDrag } from './useCameraStageDrag'

export function AnimateCameraStage() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const selectShot = useEditor((s) => s.selectShot)
  const update = useEditor((s) => s.update)
  const inspectorTab = useEditor((s) => s.inspectorTab)
  const theme = useView((s) => s.theme)
  const animate2dSplit = useView((s) => s.animate2dSplit)
  const setView = useView((s) => s.set)

  const stageRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 680, h: 480 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.28)
  const [autoFitted, setAutoFitted] = useState(false)
  const [toolMode, setToolMode] = useState<StageToolMode>('pan-scale')
  const [showAllFrames, setShowAllFrames] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [, setAssetTick] = useState(0)

  useEffect(() => {
    return assetStore.subscribe(() => setAssetTick((n) => n + 1))
  }, [])

  const stageLayout = useMemo(() => computeShotStageLayout(project, time), [project, time])
  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const frames = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const waypoints = useMemo(() => enrichCameraWaypoints(frames), [frames])
  const liveFrame = useMemo(
    () => evaluateLiveCameraFrame2D(project, stageLayout, frames, time),
    [project, stageLayout, frames, time]
  )

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

  const activeFrame = waypoints[activeFrameIndex] ?? waypoints[0]

  // Fit all 2D shot planes into the stage viewport
  const fitStage = useCallback(
    (vw = viewportSize.w, vh = viewportSize.h) => {
      if (stageLayout.length === 0 || vw < 40 || vh < 40) return
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const box of stageLayout) {
        minX = Math.min(minX, box.stageX - box.width * 0.65)
        maxX = Math.max(maxX, box.stageX + box.width * 0.65)
        minY = Math.min(minY, box.stageY - box.height * 0.72)
        maxY = Math.max(maxY, box.stageY + box.height * 0.72)
      }
      for (const f of frames) {
        minX = Math.min(minX, f.stageX - f.width * 0.6)
        maxX = Math.max(maxX, f.stageX + f.width * 0.6)
        minY = Math.min(minY, f.stageY - f.height * 0.65)
        maxY = Math.max(maxY, f.stageY + f.height * 0.65)
      }
      const spanW = Math.max(project.comp.width, maxX - minX)
      const spanH = Math.max(project.comp.height, maxY - minY)
      const availW = Math.max(120, vw - 76)
      const availH = Math.max(120, vh - 124)
      const nextZoom = Math.max(0.06, Math.min(0.85, Math.min(availW / spanW, availH / spanH)))
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      setZoom(nextZoom)
      setPan({ x: -cx * nextZoom, y: -cy * nextZoom + 18 })
    },
    [stageLayout, frames, project.comp.width, project.comp.height, viewportSize.w, viewportSize.h]
  )

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      if (w > 20 && h > 20) {
        setViewportSize({ w, h })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!autoFitted && viewportSize.w > 100 && viewportSize.h > 100) {
      fitStage(viewportSize.w, viewportSize.h)
      setAutoFitted(true)
    }
  }, [autoFitted, viewportSize.w, viewportSize.h, fitStage, stageLayout.length])

  const stageToScreen = (sx: number, sy: number): { x: number; y: number } => ({
    x: viewportSize.w / 2 + pan.x + sx * zoom,
    y: viewportSize.h / 2 + pan.y + sy * zoom
  })

  const {
    startFrameMoveDrag,
    startFrameResizeDrag,
    startFrameRotateDrag,
    startFrameOrbit3DDrag
  } = useCameraStageDrag({
    compWidth: project.comp.width,
    compHeight: project.comp.height,
    zoom,
    stageLayout,
    stageRef,
    stageToScreen,
    setPlaying,
    setTime,
    setSnapGuide,
    update
  })

  // Spawn next Camera Frame (pan / zoom in / zoom out / target shot)
  const spawnNextCameraFrame = (
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot',
    targetShot?: ShotStageBox
  ): void => {
    const base = activeFrame ?? waypoints[waypoints.length - 1]
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

    if (mode === 'shot' && targetShot) {
      nextStageX = targetShot.stageX
      nextStageY = targetShot.stageY
      nextScale = 1.0
    } else if (mode === 'zoom-in') {
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
        applyStageFrameToDraft(d, stageLayout, 0, base.stageX, base.stageY, base.scale, true, {
          yaw: base.yaw,
          pitch: base.pitch,
          roll: base.roll
        })
      }
      if (nextTime > d.comp.duration) {
        setCompDuration(d, Math.ceil(nextTime + 1))
      }
      applyStageFrameToDraft(d, stageLayout, nextTime, nextStageX, nextStageY, nextScale, true, {
        yaw: base.yaw,
        pitch: base.pitch,
        roll: base.roll
      })
    })

    setPlaying(false)
    setTime(nextTime)
    const label =
      mode === 'zoom-in'
        ? 'phóng to cận cảnh'
        : mode === 'zoom-out'
          ? 'thu nhỏ toàn cảnh'
          : targetShot
            ? `lia tới ${targetShot.name}`
            : 'lia tiếp'
    toast(`🎥 Đã tạo Mốc Camera tại ${nextTime.toFixed(1)}s (${label})`)
  }

  const handleAddHold = (): void => {
    if (!activeFrame) return
    const nextTime = Math.round((activeFrame.time + 2.0) * 100) / 100
    update((d) => {
      if (d.camera.position.keyframes.length === 0) {
        applyStageFrameToDraft(d, stageLayout, 0, activeFrame.stageX, activeFrame.stageY, activeFrame.scale, true)
      }
      addCameraHoldWaypoint(d, stageLayout, activeFrame, 2.0)
    })
    setPlaying(false)
    setTime(nextTime)
    toast(`⏸ Đã tạo mốc Dừng ngắm tại ${nextTime.toFixed(1)}s`)
  }

  const handleQuickActionMode = (mode: CameraActionMode): void => {
    if (!activeFrame) return
    update((d) => {
      applyWaypointActionMode(d, stageLayout, activeFrame.time, mode)
    })
  }

  const deleteFrameAt = (frame: CameraFrame2D): void => {
    if (!frame.isKeyframed || frames.length <= 1) {
      toast('Cần giữ ít nhất 1 mốc Camera gốc')
      return
    }
    update((d) => {
      const del = (a?: Animatable<unknown>) => {
        if (!a) return
        a.keyframes = a.keyframes.filter((k) => Math.abs(k.t - frame.time) > Math.max(tol, 0.04))
      }
      del(d.camera.position)
      del(d.camera.target)
      del(d.camera.focusDistance)
      del(d.camera.roll)
    })
    const prev = frames[Math.max(0, frame.index - 1)]
    if (prev) setTime(prev.time)
  }

  // Pan the 2D Stage when dragging empty canvas space
  const onStagePointerDown = (e: React.PointerEvent): void => {
    const startX = e.clientX
    const startY = e.clientY
    const origPan = { ...pan }
    const onMove = (pev: PointerEvent): void => {
      setPan({
        x: origPan.x + (pev.clientX - startX),
        y: origPan.y + (pev.clientY - startY)
      })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onStageWheel = (e: React.WheelEvent): void => {
    e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    setZoom((z) => Math.max(0.05, Math.min(1.5, Math.round(z * factor * 1000) / 1000)))
  }

  const handleAimAtShot = (box: ShotStageBox): void => {
    if (!activeFrame || !box.shotId) return
    update((d) => {
      panCameraToShot(d, stageLayout, box.shotId!, activeFrame.time, activeFrame.scale, activeFrame.ease)
    })
    toast(`⊡ Đã căn khung Camera vào chính giữa "${box.name}"`)
  }

  const handleAimAtLayer = (box: ShotStageBox, layer: ProjectedLayer2D): void => {
    if (!activeFrame) return
    update((d) => {
      panCameraToLayer2D(
        d,
        stageLayout,
        box.shotId,
        layer.offsetX,
        layer.offsetY,
        activeFrame.time,
        activeFrame.scale,
        activeFrame.ease,
        layer.zDepth
      )
    })
    toast(`🎯 Đã ngắm & lấy nét Camera vào "${layer.name}"`)
  }

  const handleDoubleClickSpot = (stageX: number, stageY: number): void => {
    if (!activeFrame) return
    update((d) => {
      updateCameraWaypoint(d, stageLayout, activeFrame.time, { stageX, stageY })
    })
    toast(`📍 Đã dời tâm Camera tới (${stageX}, ${stageY})`)
  }

  return (
    <div id="animate-camera-stage" className={`anim2d-stage ${theme}`}>
      {/* Thanh công cụ 2 dòng siêu gọn: Dòng 1 nhường góc phải cho bộ nút chuyển View chính, Dòng 2 chứa đầy đủ nút tạo mốc & điều khiển */}
      <div className="anim2d-toolbar">
        <div className="anim2d-toolbar-row1">
          {/* 1. Bố cục 2D & 3D / Chỉ 2D */}
          <div className="viewer-mode-seg" title="Chọn bố cục hiển thị cho Lộ trình Camera 2D">
            <button
              id="view-animate2d-split"
              type="button"
              className={`seg-btn${animate2dSplit ? ' active' : ''}`}
              title="Chế độ 2D & 3D: Cột trái hiện Camera kết quả & Không gian 3D · Cột phải hiện Bàn dựng 2D"
              onClick={() => setView({ animate2dSplit: true })}
            >
              <IconLayout2D3D width={12} height={12} /> 2D &amp; 3D
            </button>
            <button
              id="view-animate2d-single"
              type="button"
              className={`seg-btn${!animate2dSplit ? ' active' : ''}`}
              title="Chỉ hiện Bàn dựng Mặt phẳng 2D rộng toàn vùng xem"
              onClick={() => setView({ animate2dSplit: false })}
            >
              <IconSingle width={12} height={12} /> Chỉ 2D
            </button>
          </div>

          <span className="viewer-tool-sep" />

          {/* 2. Chế độ công cụ thao tác trực tiếp trên Bàn dựng 2D */}
          <div className="viewer-mode-seg" title="Chế độ thao tác chuột trên Khung Camera">
            <button
              id="anim2d-mode-pan"
              type="button"
              className={`seg-btn${toolMode === 'pan-scale' ? ' active' : ''}`}
              onClick={() => setToolMode('pan-scale')}
              title="Chế độ Lia & Khung: Kéo khung để Lia (Pan), kéo 8 góc để Phóng/Thu (Zoom), kéo đỉnh để Xoay nghiêng (Roll)"
            >
              ✢ Lia &amp; Zoom
            </button>
            <button
              id="anim2d-mode-orbit"
              type="button"
              className={`seg-btn${toolMode === 'orbit-3d' ? ' active' : ''}`}
              onClick={() => setToolMode('orbit-3d')}
              title="Chế độ Xoay góc 3D: Kéo bên trong khung để xoay góc nhìn 3D (Yaw trái/phải, Pitch cao/thấp) tạo hiệu ứng Parallax"
            >
              ↻ Xoay 3D
            </button>
            <button
              id="anim2d-mode-aim"
              type="button"
              className={`seg-btn${toolMode === 'aim-target' ? ' active' : ''}`}
              onClick={() => setToolMode('aim-target')}
              title="Chế độ Bấm chọn chủ thể: Bấm trực tiếp vào bất kỳ Layer nào trên cảnh 2D để ngắm và lấy nét"
            >
              🎯 Ngắm Layer
            </button>
          </div>
        </div>

        {/* 3. Dòng 2: Các nút tạo mốc & điều khiển khung nhìn (hiển thị trọn vẹn không bao giờ bị che) */}
        <div className="anim2d-toolbar-row2">
          <div className="anim2d-actions">
            <button
              id="anim2d-add-pan"
              type="button"
              className="btn xs primary"
              onClick={() => spawnNextCameraFrame('pan')}
              title="Tạo thêm Mốc Camera tiếp theo để lia sang vị trí hoặc cảnh kế tiếp"
            >
              <IconPlus width={11} height={11} /> Mốc tiếp
            </button>
            <button
              id="anim2d-add-hold"
              type="button"
              className="btn xs"
              onClick={handleAddHold}
              title="Tạo mốc Dừng ngắm (+2.0s) giữ nguyên khung hình để người xem thưởng thức cảnh"
            >
              ⏸ Dừng (2s)
            </button>
            <button
              id="anim2d-add-zoom-in"
              type="button"
              className="btn xs"
              onClick={() => spawnNextCameraFrame('zoom-in')}
              title="Tạo mốc Đẩy cận cảnh (Zoom In)"
            >
              🔍+ Cận
            </button>
            <button
              id="anim2d-add-zoom-out"
              type="button"
              className="btn xs"
              onClick={() => spawnNextCameraFrame('zoom-out')}
              title="Tạo mốc Kéo toàn cảnh (Zoom Out)"
            >
              🔍- Rộng
            </button>
          </div>

          <div className="anim2d-actions">
            <button
              type="button"
              className={`btn xs icon${playing ? ' primary' : ''}`}
              onClick={() => setPlaying(!playing)}
              title={playing ? 'Dừng phát (Space)' : 'Phát thử lộ trình Camera (Space)'}
            >
              {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
            </button>
            <button
              type="button"
              className={`btn xs icon${showAllFrames ? ' active' : ''}`}
              onClick={() => setShowAllFrames((v) => !v)}
              title="Bật/Tắt hiển thị khung viền mờ của tất cả các mốc cùng lúc"
            >
              #
            </button>
            <button
              type="button"
              className={`btn xs icon${showGrid ? ' active' : ''}`}
              onClick={() => setShowGrid((v) => !v)}
              title="Bật/Tắt lưới bố cục 1/3 (Rule of Thirds) trong khung ngắm"
            >
              ⊞
            </button>
            <button
              type="button"
              className="btn xs icon"
              onClick={() => fitStage()}
              title="Căn vừa toàn bộ các Cảnh 2D và Khung Camera vào màn hình"
            >
              <IconFocus width={13} height={13} />
            </button>
            <button
              id="view-toggle-route-panel"
              type="button"
              className={`btn xs${inspectorTab === 'route' ? ' primary' : ''}`}
              onClick={() => useEditor.getState().setInspectorTab('route')}
              title="Mở Bảng Lộ trình Camera ở cột bên phải (Inspector)"
            >
              <IconRoute width={12} height={12} /> Lộ trình
            </button>
          </div>
        </div>
      </div>

      {/* Bàn dựng Mặt phẳng 2D của các Cảnh & Khung Camera */}
      <div
        ref={stageRef}
        className={`anim2d-canvas mode-${toolMode}`}
        onPointerDown={onStagePointerDown}
        onWheel={onStageWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 1. Các Cảnh 3D được ánh xạ lên mặt phẳng 2D */}
        {stageLayout.map((box, idx) => {
          const layers2D = projectShotLayers2D(project, ev, box.shotId, idx === 0)
          const topLeft = stageToScreen(box.stageX - box.width / 2, box.stageY - box.height / 2)
          return (
            <AnimateShotPlane2D
              key={box.shotId ?? 'global'}
              box={box}
              layers={layers2D}
              background={project.comp.background}
              isSelectedShot={selectedShotId === box.shotId}
              isActiveCameraShot={activeFrame?.shotId === box.shotId}
              aimMode={toolMode === 'aim-target'}
              zoom={zoom}
              screenLeft={topLeft.x}
              screenTop={topLeft.y}
              onSelectShot={selectShot}
              onAimCurrentAtShot={handleAimAtShot}
              onAddFrameAtShot={(targetBox) => spawnNextCameraFrame('shot', targetBox)}
              onAimAtLayer={handleAimAtLayer}
              onDoubleClickSpot={handleDoubleClickSpot}
            />
          )
        })}

        {/* 2. Đường bay, Điểm neo mốc & Khung Ngắm Camera Đang Chọn */}
        <AnimateCameraViewfinder
          waypoints={waypoints}
          activeFrameIndex={activeFrameIndex}
          liveFrame={liveFrame}
          playing={playing}
          zoom={zoom}
          toolMode={toolMode}
          showAllFrames={showAllFrames}
          showGrid={showGrid}
          snapGuide={snapGuide}
          stageToScreen={stageToScreen}
          onSelectFrame={(f) => {
            setPlaying(false)
            setTime(f.time)
          }}
          onStartMoveDrag={startFrameMoveDrag}
          onStartResizeDrag={startFrameResizeDrag}
          onStartRotateDrag={startFrameRotateDrag}
          onStartOrbit3DDrag={startFrameOrbit3DDrag}
          onSpawnNextPan={() => spawnNextCameraFrame('pan')}
          onAddHold={handleAddHold}
          onResetAngles={(f) => {
            update((d) => {
              alignWaypointInShot(d, stageLayout, f.time, 'reset-angles')
            })
            toast('Đã đặt lại góc xoay 3D & Roll về 0°')
          }}
          onDeleteFrame={deleteFrameAt}
        />
      </div>

      {/* Thanh Trạng thái Quay & Lộ trình các Mốc phía dưới */}
      <div className="anim2d-footer">
        <div className="anim2d-frames-strip" title="Danh sách các Mốc Camera theo trình tự thời gian">
          <span className="anim2d-footer-label">Mốc:</span>
          {waypoints.map((wp, idx) => {
            const isActive = idx === activeFrameIndex
            return (
              <div key={`${wp.time}-${idx}`} className="anim2d-frame-step">
                {idx > 0 && (
                  <span className="anim2d-step-arrow" title={`Thời lượng: +${wp.durationFromPrev.toFixed(1)}s (${wp.ease})`}>
                    {wp.actionMode === 'cut' ? '⚡' : '➔'}
                  </span>
                )}
                <button
                  type="button"
                  className={`anim2d-frame-pill${isActive ? ' active' : ''}`}
                  onClick={() => {
                    setPlaying(false)
                    setTime(wp.time)
                  }}
                  title={`Mốc #${idx + 1} tại ${wp.time.toFixed(1)}s · ${wp.tagLabel}\nCảnh: ${wp.shotName} · Zoom ${wp.zoomPct}% · ${wp.angleSummary}`}
                >
                  <span className="anim2d-pill-num">#{idx + 1}</span>
                  <span>{wp.time.toFixed(1)}s</span>
                  <span className="anim2d-pill-scale">{wp.zoomPct}%</span>
                  {(Math.abs(wp.yaw) >= 1 || Math.abs(wp.roll) >= 1) && (
                    <span className="anim2d-pill-angle">3D</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Bộ chọn nhanh Chế độ quay cho Mốc đang chọn ngay dưới chân trang */}
        {activeFrame && (
          <div className="anim2d-footer-modes" title="Chuyển nhanh chế độ động tác quay tại mốc đang chọn">
            <button
              type="button"
              className={`mode-chip${activeFrame.actionMode === 'hold' ? ' active' : ''}`}
              onClick={() => handleQuickActionMode('hold')}
              title="Giữ nguyên khung hình của mốc trước (Dừng ngắm)"
            >
              ⏸ Giữ khung
            </button>
            <button
              type="button"
              className={`mode-chip${activeFrame.actionMode === 'orbit-left' ? ' active' : ''}`}
              onClick={() => handleQuickActionMode('orbit-left')}
              title="Xoay góc 3D sang trái (-25°) tạo chiều sâu Parallax"
            >
              ↺ 3D Trái
            </button>
            <button
              type="button"
              className={`mode-chip${activeFrame.actionMode === 'orbit-right' ? ' active' : ''}`}
              onClick={() => handleQuickActionMode('orbit-right')}
              title="Xoay góc 3D sang phải (+25°) tạo chiều sâu Parallax"
            >
              ↻ 3D Phải
            </button>
            <button
              type="button"
              className={`mode-chip${activeFrame.actionMode === 'dutch-tilt' ? ' active' : ''}`}
              onClick={() => handleQuickActionMode('dutch-tilt')}
              title="Xoay nghiêng máy kịch tính (Dutch Angle ±12°)"
            >
              📐 Nghiêng
            </button>
            <button
              type="button"
              className={`mode-chip${activeFrame.actionMode === 'cut' ? ' active' : ''}`}
              onClick={() => handleQuickActionMode('cut')}
              title="Cắt cảnh tức thì (Jump Cut) không lia máy giữa chừng"
            >
              ⚡ Cắt cảnh
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
