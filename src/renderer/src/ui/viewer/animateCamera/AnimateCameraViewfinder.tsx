import { useMemo, useState } from 'react'
import { IconPlus, IconTrash } from '../../icons'
import {
  buildReactFlowBezierPath,
  buildReactFlowSmoothStepPath,
  computeBubbleAnchorAttachment,
  type CameraLineStyle
} from './animateCameraEdgePaths'
import { findNearestShotByStage2D, type CameraFrame2D, type ShotStageBox } from './animateCameraMath'
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

export interface BubbleStageOffset {
  dx: number
  dy: number
}

interface CalloutBubbleNode {
  idx: number
  wp: CameraWaypointItem
  bubbleX: number
  bubbleY: number
  anchorX: number
  anchorY: number
  frameLeft: number
  frameTop: number
  frameW: number
  frameH: number
  isCustomMoved: boolean
  isFirstOfShot: boolean
}

interface AnimateCameraViewfinderProps {
  stageLayout: ShotStageBox[]
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
  lineStyle: CameraLineStyle
  showAllFrames: boolean
  showGrid: boolean
  snapGuide: { x: number | null; y: number | null }
  bubbleOffsets: Record<number, BubbleStageOffset>
  stageToScreen: (sx: number, sy: number) => { x: number; y: number }
  onSelectFrame: (frame: CameraFrame2D | CameraWaypointItem, activateRouteTab?: boolean) => void
  onStartBubbleDrag: (
    e: React.PointerEvent,
    idx: number,
    wp: CameraWaypointItem
  ) => void
  onResetBubbleOffset: (idx: number) => void
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
  stageLayout,
  waypoints,
  activeFrameIndex,
  liveFrame,
  playing,
  zoom,
  toolMode,
  lineStyle,
  showAllFrames,
  showGrid,
  snapGuide,
  bubbleOffsets,
  stageToScreen,
  onSelectFrame,
  onStartBubbleDrag,
  onResetBubbleOffset,
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

  // Tính toán vị trí các Bóng tròn điều khiển (Callout Bubbles) nằm NGOÀI khung cảnh
  // Hỗ trợ người dùng kéo thả tự do từng bóng tròn sang vị trí bất kỳ (bubbleOffsets)
  const calloutNodes = useMemo<CalloutBubbleNode[]>(() => {
    if (waypoints.length === 0) return []

    const byShot = new Map<string, { box: ShotStageBox; items: { idx: number; wp: CameraWaypointItem }[] }>()
    waypoints.forEach((wp, idx) => {
      const box =
        stageLayout.find((b) => b.shotId === wp.shotId) ??
        findNearestShotByStage2D(stageLayout, wp.stageX, wp.stageY)
      const key = box?.shotId ?? 'global'
      if (!byShot.has(key)) {
        byShot.set(key, {
          box: box ?? {
            shotId: null,
            name: 'Cảnh',
            color: '#3b82f6',
            index: 0,
            visible: true,
            worldOrigin: [0, 0, 0],
            stageX: 0,
            stageY: 0,
            width: 1920,
            height: 1080
          },
          items: []
        })
      }
      byShot.get(key)!.items.push({ idx, wp })
    })

    const result: CalloutBubbleNode[] = []
    const minSpacing = 54

    for (const { box, items } of byShot.values()) {
      const shotTL = stageToScreen(box.stageX - box.width / 2, box.stageY - box.height / 2)
      const shotBR = stageToScreen(box.stageX + box.width / 2, box.stageY + box.height / 2)
      const shotScreenW = Math.max(80, shotBR.x - shotTL.x)
      const shotCenterX = (shotTL.x + shotBR.x) / 2

      let maxBottomY = shotBR.y
      for (const { wp } of items) {
        const fBottom = stageToScreen(wp.stageX, wp.stageY + wp.height / 2).y
        if (fBottom > maxBottomY) maxBottomY = fBottom
      }

      const useTwoRows = items.length >= 3 && items.length * minSpacing > shotScreenW + 16

      const prepared = items.map(({ idx, wp }, localIdx) => {
        const anchor = stageToScreen(wp.stageX, wp.stageY)
        const tl = stageToScreen(wp.stageX - wp.width / 2, wp.stageY - wp.height / 2)
        const row = useTwoRows ? localIdx % 2 : 0
        const bubbleY = Math.round(maxBottomY + 46 + row * 48)
        return {
          idx,
          wp,
          row,
          anchorX: anchor.x,
          anchorY: anchor.y,
          desiredX: anchor.x,
          bubbleX: anchor.x,
          bubbleY,
          frameLeft: tl.x,
          frameTop: tl.y,
          frameW: Math.max(8, wp.width * zoom),
          frameH: Math.max(6, wp.height * zoom),
          isCustomMoved: false,
          isFirstOfShot: wp.isFirstOfShot ?? localIdx === 0
        }
      })

      for (const r of [0, 1]) {
        const rowItems = prepared.filter((p) => p.row === r)
        if (rowItems.length === 0) continue

        rowItems.sort((a, b) => {
          if (Math.abs(a.desiredX - b.desiredX) > 25) return a.desiredX - b.desiredX
          return a.idx - b.idx
        })

        const step = useTwoRows ? minSpacing + 6 : minSpacing
        const totalW = (rowItems.length - 1) * step
        const rowOffset = r === 1 ? step * 0.42 : -step * 0.15
        const startX = shotCenterX - totalW / 2 + rowOffset

        rowItems.forEach((item, i) => {
          item.bubbleX = Math.round(startX + i * step)
        })
      }

      result.push(...prepared)
    }

    // Khử va chạm cho các bóng ở vị trí mặc định
    const byYBand = new Map<number, CalloutBubbleNode[]>()
    for (const node of result) {
      let foundBand: number | null = null
      for (const yKey of byYBand.keys()) {
        if (Math.abs(yKey - node.bubbleY) < 36) {
          foundBand = yKey
          break
        }
      }
      const bandKey = foundBand ?? node.bubbleY
      if (!byYBand.has(bandKey)) byYBand.set(bandKey, [])
      byYBand.get(bandKey)!.push(node)
    }

    for (const bandNodes of byYBand.values()) {
      bandNodes.sort((a, b) => a.bubbleX - b.bubbleX || a.idx - b.idx)
      for (let i = 1; i < bandNodes.length; i++) {
        if (bandNodes[i].bubbleX < bandNodes[i - 1].bubbleX + minSpacing) {
          bandNodes[i].bubbleX = bandNodes[i - 1].bubbleX + minSpacing
        }
      }
    }

    // Áp dụng độ lệch kéo thả tự do (custom user drag offset) theo không gian sân khấu
    for (const node of result) {
      const custom = bubbleOffsets[node.idx]
      if (custom && (Math.abs(custom.dx) > 0.5 || Math.abs(custom.dy) > 0.5)) {
        node.bubbleX = Math.round(node.bubbleX + custom.dx * zoom)
        node.bubbleY = Math.round(node.bubbleY + custom.dy * zoom)
        node.isCustomMoved = true
      }
    }

    return result.sort((a, b) => a.idx - b.idx)
  }, [waypoints, stageLayout, stageToScreen, zoom, bubbleOffsets])

  return (
    <>
      {/* 1. Đường nối lộ trình Camera & Dây liên kết (ReactFlow SmoothStep / Bezier Edges) */}
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

        {/* Đường bay nối giữa các mốc trên Lộ trình Camera (ReactFlow Edge Style) */}
        {waypoints.map((f, idx) => {
          if (idx === 0) return null
          const prev = waypoints[idx - 1]
          const p1 = stageToScreen(prev.stageX, prev.stageY)
          const p2 = stageToScreen(f.stageX, f.stageY)
          const isCurrentSeg = idx === activeFrameIndex
          const isCut = prev.ease === 'hold'
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

          const pathD =
            lineStyle === 'smoothstep'
              ? buildReactFlowSmoothStepPath(p1.x, p1.y, p2.x, p2.y, 'horizontal', 14)
              : buildReactFlowBezierPath(p1.x, p1.y, p2.x, p2.y, 'horizontal', 0.36)

          return (
            <g key={`path-${idx}`}>
              {dist > 4 && (
                <>
                  {/* Lớp viền phát sáng mờ kiểu ReactFlow Edge Halo */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isCurrentSeg ? 'var(--key)' : 'var(--accent-cyan)'}
                    strokeWidth={isCurrentSeg ? 6 : 4}
                    strokeOpacity={isCurrentSeg ? 0.18 : 0.08}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Đường chính ReactFlow Edge */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isCurrentSeg ? 'var(--key)' : 'var(--accent-cyan)'}
                    strokeWidth={isCurrentSeg ? 2.4 : 1.7}
                    strokeOpacity={isCurrentSeg ? 0.96 : 0.72}
                    strokeDasharray={isCut ? '2 5' : isCurrentSeg ? 'none' : '6 4'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={isCurrentSeg ? 'url(#anim2d-arrow-active)' : 'url(#anim2d-arrow)'}
                  />
                </>
              )}
            </g>
          )
        })}

        {/* Sợi dây liên kết (Tether Lines) nối từ Bóng tròn ngoài khung cảnh vào Lộ trình Camera */}
        {calloutNodes.map((node) => {
          const isActive = node.idx === activeFrameIndex
          const isHovered = node.idx === hoveredIdx
          const highlight = isActive || isHovered

          const attach = computeBubbleAnchorAttachment(
            node.bubbleX,
            node.bubbleY,
            node.anchorX,
            node.anchorY,
            18
          )
          const startX = attach.startX
          const startY = attach.startY
          const endX = node.anchorX
          const endY = node.anchorY

          const tetherPath =
            lineStyle === 'smoothstep'
              ? buildReactFlowSmoothStepPath(startX, startY, endX, endY, attach.flowMode, 12)
              : buildReactFlowBezierPath(startX, startY, endX, endY, attach.flowMode, 0.38)

          const frameBottomLeftX = node.frameLeft
          const frameBottomRightX = node.frameLeft + node.frameW
          const frameCornerY =
            node.bubbleY < node.frameTop ? node.frameTop : node.frameTop + node.frameH

          return (
            <g key={`tether-${node.idx}`}>
              {/* Tia gióng phụ nối từ bóng tròn vào 2 góc của Viền khung Camera khi active/hover */}
              {highlight && (
                <g
                  stroke={isActive ? 'var(--accent-cyan)' : 'var(--key)'}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                >
                  <line x1={startX} y1={startY} x2={frameBottomLeftX} y2={frameCornerY} />
                  <line x1={startX} y1={startY} x2={frameBottomRightX} y2={frameCornerY} />
                </g>
              )}

              {/* Halo nền dưới dây liên kết kiểu ReactFlow khi đang chọn/hover */}
              {highlight && (
                <path
                  d={tetherPath}
                  fill="none"
                  stroke={isActive ? 'var(--accent-cyan)' : 'var(--key)'}
                  strokeWidth={5.5}
                  strokeOpacity={0.16}
                  strokeLinecap="round"
                />
              )}

              {/* Sợi dây liên kết chính (Vuông góc bo tròn hoặc Vòng cung) */}
              <path
                d={tetherPath}
                fill="none"
                stroke={isActive ? 'var(--accent-cyan)' : isHovered ? 'var(--key)' : 'var(--accent-cyan)'}
                strokeWidth={highlight ? 2.1 : 1.4}
                strokeDasharray={isActive ? 'none' : '4 3'}
                strokeOpacity={highlight ? 0.96 : 0.58}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Điểm nút cổng kết nối trên viền bóng tròn (ReactFlow Handle Port) */}
              <circle
                cx={startX}
                cy={startY}
                r={highlight ? 3.5 : 2.5}
                fill={isActive ? '#ffffff' : 'var(--accent-cyan)'}
                stroke="var(--bg-2)"
                strokeWidth={1.2}
              />

              {/* Điểm nút neo ngay trên tâm Lộ trình Camera bên trong cảnh */}
              <circle
                cx={endX}
                cy={endY}
                r={highlight ? 5.5 : 4}
                fill={isActive ? 'var(--accent-cyan)' : isHovered ? 'var(--key)' : 'var(--bg-2)'}
                stroke={isActive ? '#ffffff' : 'var(--accent-cyan)'}
                strokeWidth={1.8}
              />
            </g>
          )
        })}
      </svg>

      {/* 2. Viền khung mờ (Subtle Frame Outlines) của các mốc khác trên cảnh */}
      {calloutNodes.map((node) => {
        if (node.idx === activeFrameIndex) return null
        const isHovered = hoveredIdx === node.idx
        if (!showAllFrames && !isHovered) return null
        const { wp } = node
        const isSmallFrame = wp.zoomPct >= 135
        return (
          <div
            key={`ghost-frame-${node.idx}-${wp.time}`}
            className={`anim2d-ghost-frame${isSmallFrame ? ' closeup' : ''}${isHovered ? ' hovered' : ''}`}
            style={{
              left: node.frameLeft,
              top: node.frameTop,
              width: node.frameW,
              height: node.frameH,
              transform: wp.roll ? `rotate(${wp.roll}deg)` : undefined
            }}
          >
            {isHovered && (
              <span className="anim2d-ghost-tag">
                #{node.idx + 1} · {wp.zoomPct}%
              </span>
            )}
          </div>
        )
      })}

      {/* 3. Hệ thống Bóng Tròn / Vuông Bo Góc Điều Khiển Ngoài Khung Cảnh (Cho phép Kéo Thả Di Chuyển Tự Do & Click Mở Tab Lộ Trình) */}
      {calloutNodes.map((node) => {
        const { idx, wp, isCustomMoved, isFirstOfShot } = node
        const isActive = idx === activeFrameIndex
        const isHovered = idx === hoveredIdx
        const isSmallFrame = wp.zoomPct >= 135

        return (
          <div
            key={`callout-bubble-${idx}-${wp.time}`}
            id={`anim2d-bubble-${idx + 1}`}
            className={`anim2d-callout-bubble ${wp.tag}${isFirstOfShot ? ' first-of-shot' : ''}${isActive ? ' active' : ''}${isHovered ? ' hovered' : ''}${isSmallFrame ? ' closeup' : ''}${isCustomMoved ? ' custom-moved' : ''}`}
            style={{
              left: node.bubbleX,
              top: node.bubbleY,
              zIndex: isActive ? 45 : isHovered ? 42 : 30 + idx
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.stopPropagation()
              onStartBubbleDrag(e, idx, wp)
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectFrame(wp, true)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onResetBubbleOffset(idx)
            }}
            title={`${isFirstOfShot ? `⚑ MỐC MỞ MÀN CẢNH: ${wp.shotName}\n` : ''}Bóng điều khiển Mốc #${idx + 1} (${wp.time.toFixed(1)}s) · ${wp.tagLabel}\nCỡ khung: Zoom ${wp.zoomPct}% · ${wp.angleSummary}\n👉 Click: Chọn khung #${idx + 1} & mở tab Lộ trình để sửa\n✋ Kéo thả: Di chuyển bóng ra chỗ thoáng tùy ý\n↺ Đúp chuột: Đặt lại vị trí mặc định`}
          >
            <div className="bubble-circle">
              {isFirstOfShot && (
                <span className="bubble-first-flag" title="Mốc camera lộ trình đầu tiên của cảnh này">
                  ⚑
                </span>
              )}
              <span className="bubble-num">#{idx + 1}</span>
            </div>
            <div className="bubble-meta">
              <span className="bubble-time">{wp.time.toFixed(1)}s</span>
              <span className="bubble-zoom">{wp.zoomPct}%</span>
            </div>
          </div>
        )
      })}

      {/* 4. Khung Camera đang nội suy trực tiếp khi phát hoặc kéo thanh thời gian giữa 2 mốc */}
      {(playing || (activeWp && Math.abs(liveFrame.time - activeWp.time) > 0.05)) && (
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

      {/* 5. Thanh HUD nổi cố định ở góc trên-trái bàn dựng 2D */}
      {activeWp && (() => {
        const hasAngles =
          Math.abs(activeWp.yaw) >= 1 || Math.abs(activeWp.pitch) >= 1 || Math.abs(activeWp.roll) >= 1
        return (
          <div
            className="anim2d-cam-badge active-hud"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="anim2d-cam-num">Mốc #{activeWp.index + 1}</span>
            <span className="anim2d-cam-time">{activeWp.time.toFixed(1)}s</span>
            <span className="anim2d-cam-scale">Zoom {activeWp.zoomPct}%</span>
            <span className="anim2d-cam-shot-tag">{activeWp.shotName}</span>
            {hasAngles && (
              <span className="anim2d-cam-angle" title="Góc quay 3D & Nghiêng máy">
                {activeWp.angleSummary}
              </span>
            )}

            <span className="anim2d-cam-quick-btns">
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
                title="Tạo mốc Camera tiếp theo từ vị trí này"
                onClick={onSpawnNextPan}
              >
                <IconPlus width={9} height={9} /> Tiếp
              </button>
              {hasAngles && (
                <button
                  type="button"
                  title="Đặt lại góc xoay 3D & nghiêng máy về 0°"
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
                  <IconTrash width={9} height={9} />
                </button>
              )}
            </span>
          </div>
        )
      })()}

      {/* 6. Viền Khung Ngắm Camera Đang Active Trên Cảnh (Active Camera Viewfinder) */}
      {activeWp && (() => {
        const isScrubbingBetween = Math.abs(liveFrame.time - activeWp.time) > 0.05
        const useLive = playing || isScrubbingBetween
        const dispX = useLive ? liveFrame.stageX : activeWp.stageX
        const dispY = useLive ? liveFrame.stageY : activeWp.stageY
        const dispW = useLive ? liveFrame.width : activeWp.width
        const dispH = useLive ? liveFrame.height : activeWp.height
        const dispRoll = useLive ? liveFrame.roll : activeWp.roll
        const dispYaw = useLive ? liveFrame.yaw : activeWp.yaw
        const dispPitch = useLive ? liveFrame.pitch : activeWp.pitch

        const tl = stageToScreen(dispX - dispW / 2, dispY - dispH / 2)
        const w = Math.max(8, dispW * zoom)
        const h = Math.max(6, dispH * zoom)
        const hasAngles =
          Math.abs(dispYaw) >= 1 || Math.abs(dispPitch) >= 1 || Math.abs(dispRoll) >= 1

        const transforms: string[] = []
        if (toolMode === 'orbit-3d' || hasAngles) {
          const tiltX = Math.max(-24, Math.min(24, dispPitch * 0.35))
          const tiltY = Math.max(-28, Math.min(28, -dispYaw * 0.35))
          if (Math.abs(tiltX) >= 0.5 || Math.abs(tiltY) >= 0.5) {
            transforms.push(`perspective(900px) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg)`)
          }
        }
        if (dispRoll) {
          transforms.push(`rotate(${dispRoll}deg)`)
        }

        return (
          <div
            id="anim2d-active-viewfinder"
            className={`anim2d-cam-frame active mode-${toolMode}${playing ? ' is-playing' : ''}`}
            style={{
              left: tl.x,
              top: tl.y,
              width: w,
              height: h,
              transform: transforms.length > 0 ? transforms.join(' ') : undefined,
              pointerEvents: toolMode === 'aim-target' ? 'none' : 'auto',
              zIndex: toolMode === 'aim-target' ? 18 : 35
            }}
            onPointerDown={(e) => {
              if (toolMode === 'aim-target') return
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
            {toolMode !== 'aim-target' && (
              <div
                className="anim2d-rot-stem"
                onPointerDown={(e) => onStartRotateDrag(e, activeWp)}
                title={`Kéo để xoay nghiêng máy (Roll / Dutch Angle: ${Math.round(activeWp.roll)}°)\nGiữ Shift để bắt dính góc 15°`}
              >
                <span className="anim2d-rot-knob">↻</span>
              </div>
            )}

            {/* Vòng Con Quay Xoay Góc 3D (Interactive 3D Orbit Gyroscope) khi ở chế độ Xoay 3D */}
            {toolMode === 'orbit-3d' && (
              <div
                className="anim2d-orbit-gizmo"
                title="Kéo chuột Trái/Phải để xoay ngang 3D (Yaw) · Kéo Lên/Xuống để xoay dọc 3D (Pitch)"
              >
                <div className="orbit-ring ring-h" />
                <div className="orbit-ring ring-v" />
                <div
                  className="orbit-puck"
                  style={{
                    transform: `translate(${Math.max(-24, Math.min(24, Math.round(dispYaw * 0.45)))}px, ${Math.max(-24, Math.min(24, Math.round(-dispPitch * 0.45)))}px)`
                  }}
                />
                <div className="orbit-readout-pill">
                  <span>3D Yaw {Math.round(dispYaw)}° · Pitch {Math.round(dispPitch)}°</span>
                  {hasAngles && (
                    <button
                      type="button"
                      className="orbit-reset-mini"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onResetAngles(activeWp)
                      }}
                      title="Đặt lại góc 3D về 0°"
                    >
                      0°
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tâm ngắm chính giữa kèm vector hiển thị hướng nghiêng 3D */}
            <div className="anim2d-cam-crosshair">
              {hasAngles && (
                <span
                  className="anim2d-3d-tilt-vector"
                  style={{
                    transform: `translate(${Math.round(dispYaw * 0.35)}px, ${Math.round(-dispPitch * 0.35)}px)`
                  }}
                />
              )}
            </div>

            {/* 8 Điểm Kéo Co Dãn Khung (Resize Handles) bám chuột 1:1 — chỉ hiện ở chế độ Lia & Zoom */}
            {toolMode === 'pan-scale' &&
              RESIZE_HANDLES.map((h) => (
                <div
                  key={h.id}
                  className={`anim2d-cam-handle handle-${h.id}`}
                  style={{ cursor: h.cursor }}
                  onPointerDown={(e) => onStartResizeDrag(e, activeWp, h.sx, h.sy)}
                  title="Kéo góc/cạnh để Phóng to (khung nhỏ lại) hoặc Thu nhỏ (khung rộng ra)"
                />
              ))}
          </div>
        )
      })()}
    </>
  )
}
