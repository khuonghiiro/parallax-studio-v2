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
import {
  AnimateCameraProFooterBar,
  AnimateCameraVerticalFilmstrip
} from './AnimateCameraFilmstrip'
import { AnimateShotPlane2D } from './AnimateShotPlane2D'
import {
  AnimateCameraViewfinder,
  type BubbleStageOffset,
  type StageToolMode
} from './AnimateCameraViewfinder'
import type { CameraLineStyle } from './animateCameraEdgePaths'
import {
  applyStageFrameToDraft,
  clampFrameScale,
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  findNearestShotByStage2D,
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
  shiftSubsequentCameraKeyframes,
  updateCameraWaypoint,
  type CameraActionMode,
  type CameraWaypointItem
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
  const [lineStyle, setLineStyle] = useState<CameraLineStyle>('smoothstep')
  const [showFilmstripPreview, setShowFilmstripPreview] = useState<boolean>(true)
  const [bubbleOffsets, setBubbleOffsets] = useState<Record<number, BubbleStageOffset>>({})
  const [showAllFrames, setShowAllFrames] = useState(true)
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

  const layersByShot = useMemo(() => {
    const map = new Map<string | null, ProjectedLayer2D[]>()
    const activeYaw = playing ? liveFrame.yaw : (activeFrame?.yaw ?? 0)
    const activePitch = playing ? liveFrame.pitch : (activeFrame?.pitch ?? 0)
    const activeShot = playing ? liveFrame.shotId : activeFrame?.shotId
    for (let idx = 0; idx < stageLayout.length; idx++) {
      const box = stageLayout[idx]
      const angles =
        box.shotId === activeShot ? { yaw: activeYaw, pitch: activePitch } : undefined
      map.set(box.shotId, projectShotLayers2D(project, ev, box.shotId, idx === 0, angles))
    }
    return map
  }, [stageLayout, project, ev, playing, liveFrame, activeFrame])

  // Fit all 2D shot planes and external callout bubbles into the stage viewport
  const fitStage = useCallback(
    (vw = viewportSize.w, vh = viewportSize.h) => {
      if (stageLayout.length === 0 || vw < 40 || vh < 40) return
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const box of stageLayout) {
        minX = Math.min(minX, box.stageX - box.width * 0.6)
        maxX = Math.max(maxX, box.stageX + box.width * 0.6)
        minY = Math.min(minY, box.stageY - box.height * 0.72)
        maxY = Math.max(maxY, box.stageY + box.height * 0.78)
      }
      for (const f of frames) {
        minX = Math.min(minX, f.stageX - f.width * 0.58)
        maxX = Math.max(maxX, f.stageX + f.width * 0.58)
        minY = Math.min(minY, f.stageY - f.height * 0.65)
        maxY = Math.max(maxY, f.stageY + f.height * 0.72)
      }
      const spanW = Math.max(project.comp.width, maxX - minX)
      const spanH = Math.max(project.comp.height, maxY - minY)
      const availW = Math.max(120, vw - 64)
      const availH = Math.max(120, vh - 165)
      const nextZoom = Math.max(0.04, Math.min(0.85, Math.min(availW / spanW, availH / spanH)))
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      setZoom(nextZoom)
      setPan({ x: -cx * nextZoom, y: -cy * nextZoom - 14 })
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

  const prevShotCountRef = useRef(stageLayout.length)
  const lastFittedWRef = useRef(0)

  useEffect(() => {
    if (viewportSize.w > 100 && viewportSize.h > 100) {
      const widthChanged = Math.abs(viewportSize.w - lastFittedWRef.current) > 48
      if (!autoFitted || prevShotCountRef.current !== stageLayout.length || widthChanged) {
        prevShotCountRef.current = stageLayout.length
        lastFittedWRef.current = viewportSize.w
        fitStage(viewportSize.w, viewportSize.h)
        setAutoFitted(true)
      }
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
    startFrameOrbit3DDrag,
    startShotMoveDrag
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

  // Chọn mốc Camera, đồng bộ Cảnh và tự động bật tab Lộ trình khi click bóng tròn / thẻ kẻ phim
  const handleSelectFrame = useCallback(
    (f: CameraFrame2D | CameraWaypointItem, activateRouteTab = false): void => {
      setPlaying(false)
      setTime(f.time)
      const targetShot =
        f.shotId ?? findNearestShotByStage2D(stageLayout, f.stageX, f.stageY)?.shotId ?? null
      if (targetShot) {
        selectShot(targetShot)
      }
      if (activateRouteTab) {
        useEditor.getState().setInspectorTab('route')
      }
    },
    [stageLayout, selectShot, setPlaying, setTime]
  )

  // Cho phép kéo thả di chuyển Bóng Tròn Liên Kết (#1, #2...) ra vị trí thoáng bất kỳ
  const handleStartBubbleDrag = useCallback(
    (e: React.PointerEvent, idx: number, wp: CameraWaypointItem): void => {
      handleSelectFrame(wp, true)
      const startX = e.clientX
      const startY = e.clientY
      const orig = bubbleOffsets[idx] ?? { dx: 0, dy: 0 }
      const safeZoom = Math.max(0.04, zoom)

      const onMove = (pev: PointerEvent): void => {
        const deltaScreenX = pev.clientX - startX
        const deltaScreenY = pev.clientY - startY
        if (Math.hypot(deltaScreenX, deltaScreenY) < 3) return
        setBubbleOffsets((prev) => ({
          ...prev,
          [idx]: {
            dx: Math.round(orig.dx + deltaScreenX / safeZoom),
            dy: Math.round(orig.dy + deltaScreenY / safeZoom)
          }
        }))
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [bubbleOffsets, zoom, handleSelectFrame]
  )

  const handleResetBubbleOffset = useCallback((idx: number): void => {
    setBubbleOffsets((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
    toast(`Đã đặt lại vị trí bóng tròn #${idx + 1}`)
  }, [])

  const hasMovedBubbles = Object.keys(bubbleOffsets).length > 0

  // Spawn next Camera Frame (pan / zoom in / zoom out / target shot)
  const spawnNextCameraFrame = (
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot',
    targetShot?: ShotStageBox
  ): void => {
    const base = activeFrame ?? waypoints[waypoints.length - 1]
    if (!base) return

    const stepDur = 2.0
    let anchor = base
    let nextStageX = base.stageX
    let nextStageY = base.stageY
    let nextScale = base.scale

    if (mode === 'shot' && targetShot) {
      nextStageX = targetShot.stageX
      nextStageY = targetShot.stageY
      nextScale = 1.0
      if (targetShot.shotId !== base.shotId) {
        for (let i = base.index + 1; i < waypoints.length; i++) {
          if (waypoints[i].shotId === base.shotId) anchor = waypoints[i]
          else break
        }
      }
    } else if (mode === 'zoom-in') {
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

  const handleEstablishCenter100 = (): void => {
    if (!activeFrame) return
    const box =
      (activeFrame.shotId ? stageLayout.find((b) => b.shotId === activeFrame.shotId) : null) ??
      findNearestShotByStage2D(stageLayout, activeFrame.stageX, activeFrame.stageY) ??
      stageLayout[0]
    if (!box) return
    update((d) => {
      updateCameraWaypoint(d, stageLayout, activeFrame.time, {
        stageX: box.stageX,
        stageY: box.stageY,
        scale: 1.0,
        yaw: 0,
        pitch: 0,
        roll: 0
      })
    })
    toast(`⊡ Đã căn khung chuẩn 100% vào chính giữa "${box.name}"`)
  }

  const handleQuickAnglePreset = (yaw: number, pitch: number, roll = 0, label = ''): void => {
    if (!activeFrame) return
    update((d) => {
      updateCameraWaypoint(d, stageLayout, activeFrame.time, { yaw, pitch, roll })
    })
    toast(`↻ Đã đặt góc 3D (${label || `Yaw ${yaw}° · Pitch ${pitch}°`}) cho Mốc #${activeFrame.index + 1}`)
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

  // Pan the 2D Stage when dragging empty canvas space (or Orbit 3D if in orbit-3d mode)
  const onStagePointerDown = (e: React.PointerEvent): void => {
    if (toolMode === 'orbit-3d' && activeFrame && e.button === 0 && !e.altKey) {
      startFrameOrbit3DDrag(e, activeFrame)
      return
    }
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

  const activeShotBox = useMemo(() => {
    if (!activeFrame) return stageLayout[0]
    return (
      (activeFrame.shotId ? stageLayout.find((b) => b.shotId === activeFrame.shotId) : null) ??
      findNearestShotByStage2D(stageLayout, activeFrame.stageX, activeFrame.stageY) ??
      stageLayout[0]
    )
  }, [activeFrame, stageLayout])

  const activeShotLayers = useMemo(() => {
    if (!activeShotBox) return []
    return layersByShot.get(activeShotBox.shotId) ?? []
  }, [activeShotBox, layersByShot])

  return (
    <div id="animate-camera-stage" className={`anim2d-stage ${theme}${!animate2dSplit ? ' single-2d' : ''}`}>
      {/* Thanh công cụ 2 dòng siêu gọn */}
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
              title="Chế độ Xoay góc 3D: Kéo trên khung để xoay góc nhìn 3D (Yaw trái/phải, Pitch cao/thấp)"
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

        {/* Dòng 2: Thay đổi linh hoạt theo Tab chế độ đang kích hoạt + nút điều khiển khung nhìn */}
        <div className="anim2d-toolbar-row2">
          <div className="anim2d-actions">
            {toolMode === 'pan-scale' && (
              <>
                <button
                  id="anim2d-add-pan"
                  type="button"
                  className="btn xs primary"
                  onClick={() => spawnNextCameraFrame('pan')}
                  title="Tạo thêm Mốc Camera tiếp theo để lia sang vị trí hoặc cảnh kế tiếp"
                >
                  <IconPlus width={11} height={11} /> Mốc
                </button>
                <button
                  id="anim2d-add-hold"
                  type="button"
                  className="btn xs"
                  onClick={handleAddHold}
                  title="Tạo mốc Dừng ngắm (+2.0s) giữ nguyên khung hình để người xem thưởng thức cảnh"
                >
                  ⏸ Dừng
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
              </>
            )}

            {toolMode === 'orbit-3d' && activeFrame && (
              <>
                <span className="anim2d-mode-pill orbit" title="Góc xoay 3D của mốc đang chọn (Kéo trên cảnh để xoay)">
                  ↻ Y:{Math.round(activeFrame.yaw)}° P:{Math.round(activeFrame.pitch)}° R:{Math.round(activeFrame.roll)}°
                </span>
                <button
                  type="button"
                  className={`btn xs${Math.round(activeFrame.yaw) === -25 ? ' active' : ''}`}
                  onClick={() => handleQuickAnglePreset(-25, activeFrame.pitch, activeFrame.roll, 'Liếc Trái -25°')}
                  title="Xoay góc 3D sang trái (-25° Yaw)"
                >
                  ⟲ Trái 25°
                </button>
                <button
                  type="button"
                  className={`btn xs${Math.abs(activeFrame.yaw) < 1 && Math.abs(activeFrame.pitch) < 1 && Math.abs(activeFrame.roll) < 1 ? ' active' : ''}`}
                  onClick={() => handleQuickAnglePreset(0, 0, 0, 'Thẳng trực diện 0°')}
                  title="Đặt lại góc máy thẳng trực diện 0°"
                >
                  ● Thẳng 0°
                </button>
                <button
                  type="button"
                  className={`btn xs${Math.round(activeFrame.yaw) === 25 ? ' active' : ''}`}
                  onClick={() => handleQuickAnglePreset(25, activeFrame.pitch, activeFrame.roll, 'Liếc Phải +25°')}
                  title="Xoay góc 3D sang phải (+25° Yaw)"
                >
                  ⟳ Phải 25°
                </button>
                <button
                  type="button"
                  className={`btn xs${Math.round(activeFrame.pitch) === 22 ? ' active' : ''}`}
                  onClick={() => handleQuickAnglePreset(activeFrame.yaw, 22, activeFrame.roll, 'Góc cao +22°')}
                  title="Góc nhìn từ trên cao xuống (+22° Pitch)"
                >
                  ⤴ Cao +22°
                </button>
                <button
                  type="button"
                  className={`btn xs${Math.round(activeFrame.pitch) === -16 ? ' active' : ''}`}
                  onClick={() => handleQuickAnglePreset(activeFrame.yaw, -16, activeFrame.roll, 'Góc thấp -16°')}
                  title="Góc nhìn từ dưới hất lên (-16° Pitch)"
                >
                  ⤵ Thấp -16°
                </button>
              </>
            )}

            {toolMode === 'aim-target' && (
              <>
                <span className="anim2d-mode-pill aim" title="Bấm vào thẻ Layer bên dưới hoặc ghim trên cảnh để ngắm & lấy nét">
                  🎯 Ngắm ({activeShotBox?.name ?? 'Cảnh'}):
                </span>
                {activeShotLayers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    className="btn xs aim-layer-chip"
                    onClick={() => activeShotBox && handleAimAtLayer(activeShotBox, layer)}
                    title={`Ngắm & lấy nét Camera vào "${layer.name}" (Độ sâu Z: ${Math.round(layer.zDepth)})`}
                  >
                    🎯 {layer.name}
                  </button>
                ))}
              </>
            )}

            {toolMode === 'pan-scale' && (
              <>
                <span className="viewer-tool-sep" />

                {/* Kiểu Đường Nối Lộ Trình & Dây Liên Kết (ReactFlow Line Styles: Vuông góc bo tròn vs Vòng cung) */}
                <div
                  className="viewer-mode-seg"
                  title="Chọn kiểu đường dây liên kết Lộ trình Camera (Thiết kế chuẩn ReactFlow)"
                >
                  <button
                    id="anim2d-line-smoothstep"
                    type="button"
                    className={`seg-btn${lineStyle === 'smoothstep' ? ' active' : ''}`}
                    onClick={() => setLineStyle('smoothstep')}
                    title="Kiểu đường Vuông góc bo tròn (ReactFlow SmoothStep Edge)"
                  >
                    ╭╯ Vuông bo
                  </button>
                  <button
                    id="anim2d-line-bezier"
                    type="button"
                    className={`seg-btn${lineStyle === 'bezier' ? ' active' : ''}`}
                    onClick={() => setLineStyle('bezier')}
                    title="Kiểu đường Vòng cung mềm mại (ReactFlow Bezier Arc Edge)"
                  >
                    ⌒ Vòng cung
                  </button>
                </div>
              </>
            )}

            {hasMovedBubbles && (
              <button
                id="anim2d-reset-bubbles"
                type="button"
                className="btn xs"
                onClick={() => {
                  setBubbleOffsets({})
                  toast('Đã đặt lại vị trí tất cả bóng tròn về mặc định')
                }}
                title="Đặt lại vị trí các bóng tròn đã kéo về hàng mặc định bên dưới cảnh"
              >
                ↺ Đặt lại bóng
              </button>
            )}
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

      {/* Khu vực chính: Bàn dựng 2D bên trái + Kẻ phim dọc (Vertical Filmstrip Preview) bên phải */}
      <div className="anim2d-workspace-row">
        <div
          ref={stageRef}
          className={`anim2d-canvas mode-${toolMode}`}
          onPointerDown={onStagePointerDown}
          onWheel={onStageWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 1. Các Cảnh 3D được ánh xạ lên mặt phẳng 2D */}
          {stageLayout.map((box) => {
            const layers2D = layersByShot.get(box.shotId) ?? []
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
                onStartShotDrag={startShotMoveDrag}
                onAimCurrentAtShot={handleAimAtShot}
                onAddFrameAtShot={(targetBox) => spawnNextCameraFrame('shot', targetBox)}
                onAimAtLayer={handleAimAtLayer}
                onDoubleClickSpot={handleDoubleClickSpot}
              />
            )
          })}

          {/* 2. Đường bay ReactFlow, Bóng tròn kéo thả tự do & Khung Ngắm Camera Đang Chọn */}
          <AnimateCameraViewfinder
            stageLayout={stageLayout}
            waypoints={waypoints}
            activeFrameIndex={activeFrameIndex}
            liveFrame={liveFrame}
            playing={playing}
            zoom={zoom}
            toolMode={toolMode}
            lineStyle={lineStyle}
            showAllFrames={showAllFrames}
            showGrid={showGrid}
            snapGuide={snapGuide}
            bubbleOffsets={bubbleOffsets}
            stageToScreen={stageToScreen}
            onSelectFrame={handleSelectFrame}
            onStartBubbleDrag={handleStartBubbleDrag}
            onResetBubbleOffset={handleResetBubbleOffset}
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

        {/* 3. Kẻ phim dọc (Vertical Filmstrip Preview) chứa list ảnh từng mốc + thông tin thời gian & lộ trình */}
        <AnimateCameraVerticalFilmstrip
          waypoints={waypoints}
          activeFrameIndex={activeFrameIndex}
          stageLayout={stageLayout}
          layersByShot={layersByShot}
          background={project.comp.background}
          showPreview={showFilmstripPreview}
          onTogglePreview={() => setShowFilmstripPreview((v) => !v)}
          onSelectWaypoint={(wp) => handleSelectFrame(wp, true)}
        />
      </div>

      {/* 4. Thanh công cụ Động tác Quay Chuyên Nghiệp dưới chân (Gọn gàng, đồng nhất) */}
      <AnimateCameraProFooterBar
        activeFrame={activeFrame}
        waypoints={waypoints}
        onSelectWaypoint={(wp) => handleSelectFrame(wp, true)}
        onQuickActionMode={handleQuickActionMode}
        onEstablishCenter100={handleEstablishCenter100}
      />
    </div>
  )
}
