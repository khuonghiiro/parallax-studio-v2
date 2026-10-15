import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
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
  IconSingle,
  IconTrash
} from '../../icons'
import { AnimateCameraRouteList } from './AnimateCameraRouteList'
import { AnimateShotPlane2D } from './AnimateShotPlane2D'
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

const RESIZE_HANDLES: { id: string; sx: number; sy: number; cursor: string }[] = [
  { id: 'nw', sx: -1, sy: -1, cursor: 'nwse-resize' },
  { id: 'n', sx: 0, sy: -1, cursor: 'ns-resize' },
  { id: 'ne', sx: 1, sy: -1, cursor: 'nesw-resize' },
  { id: 'e', sx: 1, sy: 0, cursor: 'ew-resize' },
  { id: 'se', sx: 1, sy: 1, cursor: 'nwse-resize' },
  { id: 's', sx: 0, sy: 1, cursor: 'ns-resize' },
  { id: 'sw', sx: -1, sy: 1, cursor: 'nesw-resize' },
  { id: 'w', sx: -1, sy: 0, cursor: 'ew-resize' }
]

const BADGE_CORNERS = ['pos-tl', 'pos-br', 'pos-tr', 'pos-bl'] as const

export function AnimateCameraStage() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const selectShot = useEditor((s) => s.selectShot)
  const update = useEditor((s) => s.update)
  const theme = useView((s) => s.theme)
  const animate2dSplit = useView((s) => s.animate2dSplit)
  const setView = useView((s) => s.set)

  const stageRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 680, h: 480 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.28)
  const [autoFitted, setAutoFitted] = useState(false)
  const [isRouteListOpen, setIsRouteListOpen] = useState(true)
  const [, setAssetTick] = useState(0)

  useEffect(() => {
    return assetStore.subscribe(() => setAssetTick((n) => n + 1))
  }, [])

  const stageLayout = useMemo(() => computeShotStageLayout(project, time), [project, time])
  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const frames = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const liveFrame = useMemo(
    () => evaluateLiveCameraFrame2D(project, stageLayout, frames, time),
    [project, stageLayout, frames, time]
  )

  const layersByShot = useMemo(() => {
    const map = new Map<string | null, ProjectedLayer2D[]>()
    for (let idx = 0; idx < stageLayout.length; idx++) {
      const box = stageLayout[idx]
      map.set(box.shotId, projectShotLayers2D(project, ev, box.shotId, idx === 0))
    }
    return map
  }, [stageLayout, project, ev])

  const tol = frameTolerance(project)
  const activeFrameIndex = useMemo(() => {
    const exact = frames.findIndex((f) => Math.abs(f.time - time) <= Math.max(tol, 0.04))
    if (exact >= 0) return exact
    let best = 0
    let bestDiff = Infinity
    frames.forEach((f, idx) => {
      const diff = Math.abs(f.time - time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = idx
      }
    })
    return best
  }, [frames, time, tol])

  const activeFrame = frames[activeFrameIndex] ?? frames[0]

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

  // Spawn next Camera Frame (pan / zoom in / zoom out / target shot)
  const spawnNextCameraFrame = (
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot',
    targetShot?: ShotStageBox
  ): void => {
    const base = activeFrame ?? frames[frames.length - 1]
    if (!base) return

    const stepDur = 2.0
    const isAtKeyframe = frames.some((f) => Math.abs(f.time - time) <= Math.max(tol, 0.04))
    let nextTime = time
    if (!base.isKeyframed) {
      nextTime = stepDur
    } else if (isAtKeyframe) {
      const nextExisting = frames.find((f) => f.time > base.time + 0.05)
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
      // Khung nhỏ hơn nằm trong khung hiện tại => Camera phóng to dần (Zoom In)
      nextScale = clampFrameScale(base.scale * 0.65)
    } else if (mode === 'zoom-out') {
      // Khung to hơn bao ngoài khung hiện tại => Camera thu nhỏ dần (Zoom Out)
      nextScale = clampFrameScale(base.scale * 1.38)
    } else {
      // Lia sang khung tiếp theo: nếu có cảnh tiếp theo thì lia tới cảnh đó, nếu 1 cảnh thì dịch ngang
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
      // Nếu chưa có keyframe nào, ghim Khung Camera #1 tại t = 0s trước
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
    const label =
      mode === 'zoom-in'
        ? 'phóng to (khung nhỏ hơn)'
        : mode === 'zoom-out'
          ? 'thu nhỏ (khung lớn hơn)'
          : targetShot
            ? `lia tới ${targetShot.name}`
            : 'lia tiếp'
    toast(`🎥 Đã tạo Khung Camera tại ${nextTime.toFixed(1)}s (${label})`)
  }

  const deleteFrameAt = (frame: CameraFrame2D): void => {
    if (!frame.isKeyframed || frames.length <= 1) {
      toast('Cần giữ ít nhất 1 khung Camera gốc')
      return
    }
    update((d) => {
      const del = (a: Animatable<unknown>) => {
        a.keyframes = a.keyframes.filter((k) => Math.abs(k.t - frame.time) > Math.max(tol, 0.04))
      }
      del(d.camera.position)
      del(d.camera.target)
      del(d.camera.focusDistance)
    })
    const prev = frames[Math.max(0, frame.index - 1)]
    if (prev) setTime(prev.time)
  }

  // Dragging a Camera Frame's position on the 2D Stage
  const startFrameMoveDrag = (e: React.PointerEvent, frame: CameraFrame2D): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)

    const startClientX = e.clientX
    const startClientY = e.clientY
    const origStageX = frame.stageX
    const origStageY = frame.stageY
    const frameTime = frame.time
    const mergeKey = `anim2d-move-${nanoid(6)}`

    const onMove = (pev: PointerEvent): void => {
      const dxScreen = pev.clientX - startClientX
      const dyScreen = pev.clientY - startClientY
      let nextX = Math.round(origStageX + dxScreen / zoom)
      let nextY = Math.round(origStageY + dyScreen / zoom)
      if (pev.shiftKey) {
        if (Math.abs(dxScreen) >= Math.abs(dyScreen)) nextY = origStageY
        else nextX = origStageX
      }
      update((d) => {
        applyStageFrameToDraft(d, stageLayout, frameTime, nextX, nextY, frame.scale, frame.isKeyframed)
      }, mergeKey)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Resizing a Camera Frame (smaller = zoom in, larger = zoom out)
  const startFrameResizeDrag = (
    e: React.PointerEvent,
    frame: CameraFrame2D,
    sxSign: number,
    sySign: number
  ): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)

    const startClientX = e.clientX
    const startClientY = e.clientY
    const origScale = frame.scale
    const origW = frame.width
    const origH = frame.height
    const frameTime = frame.time
    const mergeKey = `anim2d-scale-${nanoid(6)}`

    const onMove = (pev: PointerEvent): void => {
      const dxStage = (pev.clientX - startClientX) / zoom
      const dyStage = (pev.clientY - startClientY) / zoom
      let deltaScale = 0
      if (sxSign !== 0 && sySign !== 0) {
        const dw = dxStage * sxSign * 2
        const dh = dyStage * sySign * 2
        deltaScale = (dw / project.comp.width + dh / project.comp.height) / 2
      } else if (sxSign !== 0) {
        deltaScale = (dxStage * sxSign * 2) / project.comp.width
      } else {
        deltaScale = (dyStage * sySign * 2) / project.comp.height
      }
      const nextScale = clampFrameScale(
        Math.round((origScale + deltaScale * (origW / project.comp.width || 1)) * 100) / 100
      )
      update((d) => {
        applyStageFrameToDraft(d, stageLayout, frameTime, frame.stageX, frame.stageY, nextScale, frame.isKeyframed)
      }, mergeKey)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
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

  return (
    <div id="animate-camera-stage" className={`anim2d-stage ${theme}`}>
      {/* Thanh công cụ phía trên: Chuyển đổi 2D & 3D + Tạo khung Camera tiếp / Phóng to / Thu nhỏ */}
      <div className="anim2d-toolbar">
        <div className="viewer-mode-seg" title="Chọn bố cục hiển thị cho Lộ trình Camera 2D">
          <button
            id="view-animate2d-split"
            type="button"
            className={`seg-btn${animate2dSplit ? ' active' : ''}`}
            title="Chế độ 2D & 3D: Cột 1 chia 2 hàng (Hàng 1: Camera, Hàng 2: Không gian 3D) · Cột 2: Mặt phẳng 2D của các Cảnh & Khung Camera"
            onClick={() => setView({ animate2dSplit: true })}
          >
            <IconLayout2D3D width={12} height={12} /> 2D &amp; 3D
          </button>
          <button
            id="view-animate2d-single"
            type="button"
            className={`seg-btn${!animate2dSplit ? ' active' : ''}`}
            title="Chỉ hiện Mặt phẳng 2D của các Cảnh & Khung Camera rộng toàn vùng xem"
            onClick={() => setView({ animate2dSplit: false })}
          >
            <IconSingle width={12} height={12} /> Chỉ 2D
          </button>
        </div>

        <div className="anim2d-actions">
          <button
            id="anim2d-add-pan"
            type="button"
            className="btn xs primary"
            onClick={() => spawnNextCameraFrame('pan')}
            title="Tạo thêm Khung Camera tiếp theo để lia (pan) sang vị trí hoặc cảnh kế tiếp"
          >
            <IconPlus width={12} height={12} /> Khung tiếp
          </button>
          <button
            id="anim2d-add-zoom-in"
            type="button"
            className="btn xs"
            onClick={() => spawnNextCameraFrame('zoom-in')}
            title="Tạo Khung Camera NHỎ HƠN nằm trong khung hiện tại -> Camera sẽ phóng to dần (Zoom In)"
          >
            🔍+ Phóng to
          </button>
          <button
            id="anim2d-add-zoom-out"
            type="button"
            className="btn xs"
            onClick={() => spawnNextCameraFrame('zoom-out')}
            title="Tạo Khung Camera LỚN HƠN bao ngoài khung hiện tại -> Camera sẽ thu nhỏ dần (Zoom Out)"
          >
            🔍- Thu nhỏ
          </button>
          <button
            type="button"
            className={`btn xs icon${playing ? ' primary' : ''}`}
            onClick={() => setPlaying(!playing)}
            title={playing ? 'Dừng phát (Space)' : 'Phát lộ trình qua các Khung Camera (Space)'}
          >
            {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
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
            className={`btn xs icon${isRouteListOpen ? ' primary' : ''}`}
            onClick={() => setIsRouteListOpen(!isRouteListOpen)}
            title={isRouteListOpen ? 'Ẩn bảng danh sách lộ trình camera' : 'Hiện bảng danh sách lộ trình camera'}
          >
            <IconRoute width={13} height={13} />
          </button>
        </div>
      </div>

      {/* Bàn dựng Mặt phẳng 2D của các Cảnh & Khung Camera kèm Bảng Lộ trình */}
      <div className="anim2d-body">
        <div
          ref={stageRef}
          className="anim2d-canvas"
          onPointerDown={onStagePointerDown}
          onWheel={onStageWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 1. Các Cảnh 3D được ánh xạ lên mặt phẳng 2D với đầy đủ các layer xếp chồng */}
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
                zoom={zoom}
                screenLeft={topLeft.x}
                screenTop={topLeft.y}
                onSelectShot={selectShot}
                onAddFrameAtShot={(targetBox) => spawnNextCameraFrame('shot', targetBox)}
              />
            )
          })}

          {/* 2. Đường nối lộ trình & tia phóng to/thu nhỏ giữa các Khung Camera (SVG) */}
          <svg className="anim2d-trajectory-svg">
            <defs>
              <marker
                id="anim2d-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--accent-cyan)" />
              </marker>
            </defs>

            {frames.map((f, idx) => {
              if (idx === 0) return null
              const prev = frames[idx - 1]
              const p1 = stageToScreen(prev.stageX, prev.stageY)
              const p2 = stageToScreen(f.stageX, f.stageY)
              const prevTL = stageToScreen(prev.stageX - prev.width / 2, prev.stageY - prev.height / 2)
              const prevBR = stageToScreen(prev.stageX + prev.width / 2, prev.stageY + prev.height / 2)
              const curTL = stageToScreen(f.stageX - f.width / 2, f.stageY - f.height / 2)
              const curBR = stageToScreen(f.stageX + f.width / 2, f.stageY + f.height / 2)
              const hasZoomChange = Math.abs(prev.scale - f.scale) > 0.04

              return (
                <g key={`path-${idx}`}>
                  {/* Đường gióng 4 góc khi phóng to / thu nhỏ giữa 2 khung */}
                  {hasZoomChange && (
                    <g stroke="var(--accent-cyan)" strokeOpacity={0.28} strokeDasharray="3 3" strokeWidth={1}>
                      <line x1={prevTL.x} y1={prevTL.y} x2={curTL.x} y2={curTL.y} />
                      <line x1={prevBR.x} y1={prevTL.y} x2={curBR.x} y2={curTL.y} />
                      <line x1={prevTL.x} y1={prevBR.y} x2={curBR.x} y2={curBR.y} />
                      <line x1={prevBR.x} y1={prevBR.y} x2={curBR.x} y2={curBR.y} />
                    </g>
                  )}
                  {/* Đường mũi tên nối tâm Khung Camera trước -> Khung Camera sau */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="var(--accent-cyan)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    markerEnd="url(#anim2d-arrow)"
                  />
                </g>
              )
            })}
          </svg>

          {/* 3. Khung Camera đang nội suy trực tiếp khi phát (Live Interpolated Camera Box) */}
          {(() => {
            const tl = stageToScreen(
              liveFrame.stageX - liveFrame.width / 2,
              liveFrame.stageY - liveFrame.height / 2
            )
            return (
              <div
                className={`anim2d-live-cam${playing ? ' playing' : ''}`}
                style={{
                  left: tl.x,
                  top: tl.y,
                  width: Math.max(8, liveFrame.width * zoom),
                  height: Math.max(6, liveFrame.height * zoom)
                }}
              />
            )
          })()}

          {/* 4. Các Khung Camera tương tác (#1, #2, #3...) kiểu Adobe Animate */}
          {frames.map((frame, idx) => {
            const isSelected = idx === activeFrameIndex
            const tl = stageToScreen(frame.stageX - frame.width / 2, frame.stageY - frame.height / 2)
            const w = Math.max(24, frame.width * zoom)
            const h = Math.max(16, frame.height * zoom)
            const scalePct = Math.round(frame.scale * 100)
            const prevScale = idx > 0 ? frames[idx - 1].scale : frame.scale
            const zoomTag =
              idx > 0 && frame.scale < prevScale - 0.04
                ? 'Phóng'
                : idx > 0 && frame.scale > prevScale + 0.04
                  ? 'Thu'
                  : 'Khung'
            const cornerClass = BADGE_CORNERS[idx % BADGE_CORNERS.length]

            return (
              <div
                key={`cam-frame-${idx}-${frame.time}`}
                className={`anim2d-cam-frame${isSelected ? ' active' : ''}`}
                style={{
                  left: tl.x,
                  top: tl.y,
                  width: w,
                  height: h,
                  zIndex: isSelected ? 30 : 20 + idx
                }}
                onPointerDown={(e) => startFrameMoveDrag(e, frame)}
              >
                {/* Nhãn ở góc so le của mỗi Khung Camera để không đè lên nhau khi lồng khung */}
                <div
                  className={`anim2d-cam-badge ${cornerClass}`}
                  onPointerDown={(e) => startFrameMoveDrag(e, frame)}
                >
                  <span className="anim2d-cam-num">Cam #{idx + 1}</span>
                  <span className="anim2d-cam-time">{frame.time.toFixed(1)}s</span>
                  <span className="anim2d-cam-scale">
                    {zoomTag} {scalePct}%
                  </span>
                  {isSelected && frames.length > 1 && (
                    <span className="anim2d-cam-quick-btns" onPointerDown={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="danger"
                        title="Xoá khung Camera này"
                        onClick={() => deleteFrameAt(frame)}
                      >
                        <IconTrash width={10} height={10} />
                      </button>
                    </span>
                  )}
                </div>

                {/* Tâm chữ thập của Khung Camera */}
                <div className="anim2d-cam-crosshair" />

                {/* 8 điểm mút co dãn Khung Camera (nhỏ hơn = phóng to, lớn hơn = thu nhỏ) */}
                {RESIZE_HANDLES.map((hItem) => (
                  <div
                    key={hItem.id}
                    className={`anim2d-cam-handle handle-${hItem.id}`}
                    style={{ cursor: hItem.cursor }}
                    title="Kéo thu nhỏ khung để phóng to (Zoom In) · Kéo mở rộng khung để thu nhỏ (Zoom Out)"
                    onPointerDown={(e) => startFrameResizeDrag(e, frame, hItem.sx, hItem.sy)}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* 5. Bảng Danh sách Lộ trình Camera & Bảng Thông số chỉnh sửa */}
        <AnimateCameraRouteList
          project={project}
          stageLayout={stageLayout}
          frames={frames}
          activeFrameIndex={activeFrameIndex}
          currentTime={time}
          layersByShot={layersByShot}
          onSelectFrame={(targetTime) => {
            setPlaying(false)
            setTime(targetTime)
          }}
          onUpdateProject={update}
          onSpawnFrame={spawnNextCameraFrame}
          isOpen={isRouteListOpen}
          onToggleOpen={() => setIsRouteListOpen(!isRouteListOpen)}
        />
      </div>

      {/* Thanh lộ trình các Khung Camera phía dưới (#1 -> #2 -> #3...) */}
      <div className="anim2d-footer">
        <div className="anim2d-frames-strip" title="Danh sách các Khung Camera theo lộ trình thời gian">
          <span className="anim2d-footer-label">Lộ trình:</span>
          {frames.map((f, idx) => {
            const isActive = idx === activeFrameIndex
            const zoomPct = Math.round((1 / f.scale) * 100)
            return (
              <div key={`${f.time}-${idx}`} className="anim2d-frame-step">
                {idx > 0 && <span className="anim2d-step-arrow">➔</span>}
                <button
                  type="button"
                  className={`anim2d-frame-pill${isActive ? ' active' : ''}`}
                  onClick={() => {
                    setPlaying(false)
                    setTime(f.time)
                  }}
                  title={`Khung Camera #${idx + 1} tại ${f.time.toFixed(2)}s · Cảnh: ${f.shotName} · Khung ${Math.round(f.scale * 100)}% (Phóng đại ${zoomPct}%)`}
                >
                  <span className="anim2d-pill-num">#{idx + 1}</span>
                  <span>{f.time.toFixed(1)}s</span>
                  <span className="anim2d-pill-scale">{Math.round(f.scale * 100)}%</span>
                </button>
              </div>
            )
          })}
        </div>
        <span className="anim2d-footer-hint" title="Kéo khung để lia (Pan) · Kéo góc thu nhỏ khung để phóng to dần (Zoom In) · Kéo rộng khung để thu nhỏ dần (Zoom Out) · Cuộn chuột để zoom bàn dựng">
          Kéo khung: Lia · Kéo góc: Phóng/Thu
        </span>
      </div>
    </div>
  )
}
