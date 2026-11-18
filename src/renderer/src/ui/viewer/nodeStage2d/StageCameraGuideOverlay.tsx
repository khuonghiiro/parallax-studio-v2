import React from 'react'
import type { ShotStageBox } from '../animateCamera/animateCameraMath'
import type { enrichCameraWaypoints } from '../animateCamera/animateCameraRouteLogic'

export interface StageCameraGuideOverlayProps {
  stageW: number
  stageH: number
  shotLeft: number
  shotTop: number
  shotScreenW: number
  shotScreenH: number
  compW: number
  compH: number
  zoom: number
  shotBox: ShotStageBox
  shotWaypoints: ReturnType<typeof enrichCameraWaypoints>
  isCamNode: boolean
  onSelectWaypoint?: (waypointNodeId: string, time: number) => void
}

/**
 * Lớp phủ Khung ngắm Camera tham chiếu & Lưới bố cục 1/3 (Rule of Thirds) trên Màn Khung 2D:
 * Giúp người dùng căn vị trí Nhân vật / Cụm 2.5D khớp chính xác với khung hình thực tế mà Camera 3D sẽ ghi lại,
 * đồng thời cho phép nhấp trực tiếp vào nhãn mốc Camera để nhảy sang đạo diễn lộ trình Camera ngay lập tức.
 */
export const StageCameraGuideOverlay: React.FC<StageCameraGuideOverlayProps> = ({
  stageW,
  stageH,
  shotLeft,
  shotTop,
  shotScreenW,
  shotScreenH,
  compW,
  compH,
  zoom,
  shotBox,
  shotWaypoints,
  isCamNode,
  onSelectWaypoint
}) => {
  const shotCenterX = shotLeft + shotScreenW / 2
  const shotCenterY = shotTop + shotScreenH / 2
  const thirdW = shotScreenW / 3
  const thirdH = shotScreenH / 3

  return (
    <div className="vn2d-cam-guide-layer" aria-hidden="true">
      {/* Lưới bố cục 1/3 điện ảnh trên mặt phẳng 16:9 */}
      <svg className="vn2d-cam-guide-svg" width={stageW} height={stageH}>
        <g stroke="rgba(148, 163, 184, 0.28)" strokeWidth={1} strokeDasharray="4 4">
          <line x1={shotLeft + thirdW} y1={shotTop} x2={shotLeft + thirdW} y2={shotTop + shotScreenH} />
          <line x1={shotLeft + thirdW * 2} y1={shotTop} x2={shotLeft + thirdW * 2} y2={shotTop + shotScreenH} />
          <line x1={shotLeft} y1={shotTop + thirdH} x2={shotLeft + shotScreenW} y2={shotTop + thirdH} />
          <line x1={shotLeft} y1={shotTop + thirdH * 2} x2={shotLeft + shotScreenW} y2={shotTop + thirdH * 2} />
        </g>

        {!isCamNode &&
          shotWaypoints.map((wp, idx) => {
            if (idx === 0) return null
            const prev = shotWaypoints[idx - 1]
            const x1 = shotCenterX + (prev.stageX - shotBox.stageX) * zoom
            const y1 = shotCenterY + (prev.stageY - shotBox.stageY) * zoom
            const x2 = shotCenterX + (wp.stageX - shotBox.stageX) * zoom
            const y2 = shotCenterY + (wp.stageY - shotBox.stageY) * zoom
            return (
              <line
                key={`guide-cam-line-${wp.index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(16, 185, 129, 0.65)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            )
          })}
      </svg>

      {/* Khung viền Viewfinder của các mốc Camera khi đang chỉnh Layer/Cụm */}
      {!isCamNode &&
        shotWaypoints.map((wp, localIdx) => {
          const fw = Math.max(24, compW * wp.scale * zoom)
          const fh = Math.max(16, compH * wp.scale * zoom)
          const fx = shotCenterX + (wp.stageX - shotBox.stageX) * zoom - fw / 2
          const fy = shotCenterY + (wp.stageY - shotBox.stageY) * zoom - fh / 2
          const wpNodeId = `v2-cam-wp-${shotBox.shotId}-${localIdx}`
          return (
            <div
              key={`guide-cam-frame-${wp.index}`}
              className="vn2d-cam-guide-frame"
              style={{ left: fx, top: fy, width: fw, height: fh }}
            >
              <button
                type="button"
                className="vn2d-cam-guide-badge"
                title={`Mốc Camera #${wp.displayLabel} (${wp.zoomPct}%) — Nhấp để chuyển sang kéo khung ngắm Camera này`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectWaypoint?.(wpNodeId, wp.time)
                }}
              >
                Cam #{wp.displayLabel} · {wp.zoomPct}%
              </button>
            </div>
          )
        })}
    </div>
  )
}
