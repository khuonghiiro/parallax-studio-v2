import { useState } from 'react'
import { IconPlus, IconTrash } from '../../icons'
import type { CameraFrame2D } from './animateCameraMath'
import type { CameraWaypointItem } from './animateCameraRouteLogic'

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

export type StageToolMode = 'pan-scale' | 'orbit-3d' | 'aim-target'

interface AnimateCameraViewfinderProps {
  waypoints: CameraWaypointItem[]
  activeFrameIndex: number
  liveFrame: {
    stageX: number
    stageY: number
    scale: number
    width: number
    height: number
    yaw: number
    pitch: number
    roll: number
  }
  playing: boolean
  zoom: number
  toolMode: StageToolMode
  showAllFrames: boolean
  showGrid: boolean
  snapGuide: { x: number | null; y: number | null }
  stageToScreen: (sx: number, sy: number) => { x: number; y: number }
  onSelectFrame: (frame: CameraFrame2D) => void
  onStartMoveDrag: (e: React.PointerEvent, frame: CameraFrame2D) => void
  onStartResizeDrag: (e: React.PointerEvent, frame: CameraFrame2D, sx: number, sy: number) => void
  onStartRotateDrag: (e: React.PointerEvent, frame: CameraFrame2D) => void
  onStartOrbit3DDrag: (e: React.PointerEvent, frame: CameraFrame2D) => void
  onSpawnNextPan: () => void
  onAddHold: () => void
  onResetAngles: (frame: CameraFrame2D) => void
  onDeleteFrame: (frame: CameraFrame2D) => void
}

export function AnimateCameraViewfinder({
  waypoints,
  activeFrameIndex,
  liveFrame,
  playing,
  zoom,
  toolMode,
  showAllFrames,
  showGrid,
  snapGuide,
  stageToScreen,
  onSelectFrame,
  onStartMoveDrag,
  onStartResizeDrag,
  onStartRotateDrag,
  onStartOrbit3DDrag,
  onSpawnNextPan,
  onAddHold,
  onResetAngles,
  onDeleteFrame
}: AnimateCameraViewfinderProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const activeWp = waypoints[activeFrameIndex] ?? waypoints[0]

  return (
    <>
      {/* 1. Đường nối lộ trình & tia gióng giữa các mốc Camera (SVG) */}
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
          <marker
            id="anim2d-arrow-active"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--key)" />
          </marker>
        </defs>

        {/* Đường gióng căn giữa (Magnetic Snap Guides) khi đang kéo khung */}
        {snapGuide.x !== null && (
          <line
            x1={stageToScreen(snapGuide.x, -10000).x}
            y1={0}
            x2={stageToScreen(snapGuide.x, 10000).x}
            y2="100%"
            stroke="var(--key)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
          />
        )}
        {snapGuide.y !== null && (
          <line
            x1={0}
            y1={stageToScreen(-10000, snapGuide.y).y}
            x2="100%"
            y2={stageToScreen(10000, snapGuide.y).y}
            stroke="var(--key)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
          />
        )}

        {waypoints.map((f, idx) => {
          if (idx === 0) return null
          const prev = waypoints[idx - 1]
          const p1 = stageToScreen(prev.stageX, prev.stageY)
          const p2 = stageToScreen(f.stageX, f.stageY)
          const isCurrentSeg = idx === activeFrameIndex
          const isCut = prev.ease === 'hold'
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

          // Chỉ vẽ đường gióng 4 góc thu phóng cho đoạn đang chọn để tránh rối mắt
          const prevTL = stageToScreen(prev.stageX - prev.width / 2, prev.stageY - prev.height / 2)
          const prevBR = stageToScreen(prev.stageX + prev.width / 2, prev.stageY + prev.height / 2)
          const curTL = stageToScreen(f.stageX - f.width / 2, f.stageY - f.height / 2)
          const curBR = stageToScreen(f.stageX + f.width / 2, f.stageY + f.height / 2)
          const hasZoomChange = Math.abs(prev.scale - f.scale) > 0.04

          // Đường cong mượt giữa 2 điểm nếu có khoảng cách
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2 - Math.min(36, dist * 0.12)
          const pathD =
            dist > 25 && !isCut
              ? `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`
              : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`

          return (
            <g key={`path-${idx}`}>
              {isCurrentSeg && hasZoomChange && (
                <g stroke="var(--accent-cyan)" strokeOpacity={0.32} strokeDasharray="3 3" strokeWidth={1}>
                  <line x1={prevTL.x} y1={prevTL.y} x2={curTL.x} y2={curTL.y} />
                  <line x1={prevBR.x} y1={prevTL.y} x2={curBR.x} y2={curTL.y} />
                  <line x1={prevTL.x} y1={prevBR.y} x2={curTL.x} y2={curBR.y} />
                  <line x1={prevBR.x} y1={prevBR.y} x2={curBR.x} y2={curBR.y} />
                </g>
              )}
              {dist > 4 && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={isCurrentSeg ? 'var(--key)' : 'var(--accent-cyan)'}
                  strokeWidth={isCurrentSeg ? 2.4 : 1.7}
                  strokeOpacity={isCurrentSeg ? 0.95 : 0.65}
                  strokeDasharray={isCut ? '2 5' : isCurrentSeg ? 'none' : '6 4'}
                  markerEnd={isCurrentSeg ? 'url(#anim2d-arrow-active)' : 'url(#anim2d-arrow)'}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* 2. Khung mờ (Ghost Frames) của các mốc không chọn — chỉ hiện khi bật "Hiện mọi khung" hoặc di chuột vào Pin */}
      {waypoints.map((wp, idx) => {
        if (idx === activeFrameIndex) return null
        const showGhost = showAllFrames || hoveredIdx === idx
        if (!showGhost) return null
        const tl = stageToScreen(wp.stageX - wp.width / 2, wp.stageY - wp.height / 2)
        const w = Math.max(20, wp.width * zoom)
        const h = Math.max(14, wp.height * zoom)
        return (
          <div
            key={`ghost-frame-${idx}-${wp.time}`}
            className={`anim2d-ghost-frame${hoveredIdx === idx ? ' hovered' : ''}`}
            style={{
              left: tl.x,
              top: tl.y,
              width: w,
              height: h,
              transform: wp.roll ? `rotate(${wp.roll}deg)` : undefined
            }}
          />
        )
      })}

      {/* 3. Các Điểm Neo Mốc (Waypoint Pins #1, #2, #3...) gọn gàng, bấm chọn hoặc kéo trực tiếp */}
      {waypoints.map((wp, idx) => {
        const isActive = idx === activeFrameIndex
        const center = stageToScreen(wp.stageX, wp.stageY)
        // Nếu có nhiều mốc trùng tâm (ví dụ mốc Dừng ngắm), dịch nhẹ vị trí pin để không đè lên nhau
        let offsetIdx = 0
        for (let k = 0; k < idx; k++) {
          if (Math.hypot(waypoints[k].stageX - wp.stageX, waypoints[k].stageY - wp.stageY) < 40) {
            offsetIdx++
          }
        }
        const pinLeft = center.x + offsetIdx * 28
        const pinTop = center.y - offsetIdx * 22

        return (
          <div
            key={`wp-pin-${idx}-${wp.time}`}
            className={`anim2d-wp-pin ${wp.tag}${isActive ? ' active' : ''}`}
            style={{
              left: pinLeft,
              top: pinTop,
              zIndex: isActive ? 38 : 26 + idx
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.stopPropagation()
              onSelectFrame(wp)
              onStartMoveDrag(e, wp)
            }}
            title={`Mốc #${idx + 1} (${wp.time.toFixed(1)}s) · ${wp.tagLabel}\nZoom: ${wp.zoomPct}% · ${wp.angleSummary}\n(Bấm để chọn · Kéo để dời vị trí)`}
          >
            <span className="pin-num">#{idx + 1}</span>
            <span className="pin-time">{wp.time.toFixed(1)}s</span>
          </div>
        )
      })}

      {/* 4. Khung Camera đang nội suy trực tiếp khi phát (Live Interpolated Camera Box) */}
      {playing && (
        <div
          className="anim2d-live-cam playing"
          style={{
            left: stageToScreen(liveFrame.stageX - liveFrame.width / 2, liveFrame.stageY - liveFrame.height / 2).x,
            top: stageToScreen(liveFrame.stageX - liveFrame.width / 2, liveFrame.stageY - liveFrame.height / 2).y,
            width: Math.max(8, liveFrame.width * zoom),
            height: Math.max(6, liveFrame.height * zoom),
            transform: liveFrame.roll ? `rotate(${liveFrame.roll}deg)` : undefined
          }}
        />
      )}

      {/* 5. Khung Ngắm Camera Đang Chọn (Active Camera Viewfinder) — Duy nhất 1 khung rõ nét, dễ thao tác */}
      {activeWp && (() => {
        const tl = stageToScreen(
          activeWp.stageX - activeWp.width / 2,
          activeWp.stageY - activeWp.height / 2
        )
        const w = Math.max(36, activeWp.width * zoom)
        const h = Math.max(24, activeWp.height * zoom)
        const hasAngles =
          Math.abs(activeWp.yaw) >= 1 || Math.abs(activeWp.pitch) >= 1 || Math.abs(activeWp.roll) >= 1

        return (
          <div
            id="anim2d-active-viewfinder"
            className={`anim2d-cam-frame active mode-${toolMode}`}
            style={{
              left: tl.x,
              top: tl.y,
              width: w,
              height: h,
              transform: activeWp.roll ? `rotate(${activeWp.roll}deg)` : undefined,
              zIndex: 35
            }}
            onPointerDown={(e) => {
              if (toolMode === 'orbit-3d' || e.altKey) {
                onStartOrbit3DDrag(e, activeWp)
              } else {
                onStartMoveDrag(e, activeWp)
              }
            }}
          >
            {/* Lưới bố cục 1/3 (Rule of Thirds) bên trong khung ngắm */}
            {showGrid && (
              <div className="anim2d-thirds-grid">
                <span className="grid-v v1" />
                <span className="grid-v v2" />
                <span className="grid-h h1" />
                <span className="grid-h h2" />
              </div>
            )}

            {/* 4 góc ngắm điện ảnh (Viewfinder Corner Brackets) */}
            <span className="vf-corner tl" />
            <span className="vf-corner tr" />
            <span className="vf-corner bl" />
            <span className="vf-corner br" />

            {/* Tay nắm Xoay nghiêng máy (Camera Roll / Dutch Angle Handle) phía trên đỉnh khung */}
            <div
              className="anim2d-rot-stem"
              onPointerDown={(e) => onStartRotateDrag(e, activeWp)}
              title={`Kéo để xoay nghiêng máy (Roll / Dutch Angle: ${Math.round(activeWp.roll)}°)\nGiữ Shift để bắt dính góc 15°`}
            >
              <span className="anim2d-rot-knob">↻</span>
            </div>

            {/* Thanh HUD gắn trên đầu Khung Camera Đang Chọn */}
            <div
              className="anim2d-cam-badge active-hud"
              onPointerDown={(e) => onStartMoveDrag(e, activeWp)}
            >
              <span className="anim2d-cam-num">Mốc #{activeWp.index + 1}</span>
              <span className="anim2d-cam-time">{activeWp.time.toFixed(1)}s</span>
              <span className="anim2d-cam-scale">Zoom {activeWp.zoomPct}%</span>
              {hasAngles && (
                <span className="anim2d-cam-angle" title="Góc quay 3D & Nghiêng máy">
                  {activeWp.angleSummary}
                </span>
              )}

              <span className="anim2d-cam-quick-btns" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  title="Tạo mốc Dừng ngắm (+2.0s) giữ nguyên khung hình này"
                  onClick={onAddHold}
                >
                  ⏸ Dừng
                </button>
                <button
                  type="button"
                  className="primary-mini"
                  title="Tạo mốc tiếp theo lia sang vị trí kế tiếp"
                  onClick={onSpawnNextPan}
                >
                  <IconPlus width={9} height={9} /> Tiếp
                </button>
                {hasAngles && (
                  <button
                    type="button"
                    title="Đặt lại góc xoay 3D & Roll về 0° cân bằng"
                    onClick={() => onResetAngles(activeWp)}
                  >
                    0°
                  </button>
                )}
                {waypoints.length > 1 && (
                  <button
                    type="button"
                    className="danger"
                    title="Xoá mốc Camera này"
                    onClick={() => onDeleteFrame(activeWp)}
                  >
                    <IconTrash width={10} height={10} />
                  </button>
                )}
              </span>
            </div>

            {/* Tâm chữ thập & La bàn hiển thị độ lệch góc 3D (Yaw/Pitch) */}
            <div className="anim2d-cam-crosshair">
              {(Math.abs(activeWp.yaw) >= 1 || Math.abs(activeWp.pitch) >= 1) && (
                <div
                  className="anim2d-3d-tilt-vector"
                  style={{
                    transform: `translate(${Math.round(activeWp.yaw * 0.6)}px, ${Math.round(-activeWp.pitch * 0.6)}px)`
                  }}
                />
              )}
            </div>

            {/* 8 điểm mút co dãn Khung Camera (nhỏ hơn = phóng to cận cảnh, lớn hơn = thu nhỏ toàn cảnh) */}
            {RESIZE_HANDLES.map((hItem) => (
              <div
                key={hItem.id}
                className={`anim2d-cam-handle handle-${hItem.id}`}
                style={{ cursor: hItem.cursor }}
                title="Kéo thu nhỏ khung để Phóng to (Zoom In) · Kéo mở rộng khung để Thu nhỏ (Zoom Out)"
                onPointerDown={(e) => onStartResizeDrag(e, activeWp, hItem.sx, hItem.sy)}
              />
            ))}
          </div>
        )
      })()}
    </>
  )
}
