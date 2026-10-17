import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { AssembledLayerItem } from './types'
import {
  buildReactFlowBezierPath,
  buildReactFlowSmoothStepPath,
  computeBubbleAnchorAttachment,
  type CameraLineStyle
} from '../viewer/animateCamera/animateCameraEdgePaths'
import '../../styles/layerAssemblyCallout.css'

export interface LayerCalloutOffset {
  dx: number
  dy: number
}

export interface LayerAssemblyCalloutOverlayProps {
  layers: AssembledLayerItem[]
  selectedLayerId: string | null
  selectedIds?: string[]
  canvasWidth: number
  canvasHeight: number
  zoom: number
  panX?: number
  panY?: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onSelectLayer: (id: string | null, additive?: boolean) => void
  showHud?: boolean
  safeLeft?: number
  safeRight?: number
  safeTop?: number
  safeBottom?: number
  storageKey?: string
}

interface ComputedLayerBubble {
  layer: AssembledLayerItem
  orderNum: number
  anchorX: number
  anchorY: number
  bubbleX: number
  bubbleY: number
  railSide: 'left' | 'right' | 'top' | 'bottom'
  isCustomMoved: boolean
}

function readStoredPrefs(key: string): { enabled: boolean; lineStyle: CameraLineStyle } {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabled: parsed.enabled !== false,
        lineStyle: parsed.lineStyle === 'smoothstep' ? 'smoothstep' : 'bezier'
      }
    }
  } catch {}
  return { enabled: true, lineStyle: 'bezier' }
}

function writeStoredPrefs(key: string, prefs: { enabled: boolean; lineStyle: CameraLineStyle }): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs))
  } catch {}
}

export function LayerAssemblyCalloutOverlay({
  layers,
  selectedLayerId,
  selectedIds,
  canvasWidth,
  canvasHeight,
  zoom,
  panX = 0,
  panY = 0,
  containerRef,
  onSelectLayer,
  showHud = true,
  safeLeft = 56,
  safeRight = 14,
  safeTop = 44,
  safeBottom = 52,
  storageKey = 'parallax.layerAssembly.callouts.v1'
}: LayerAssemblyCalloutOverlayProps) {
  const initialPrefs = useMemo(() => readStoredPrefs(storageKey), [storageKey])
  const [enabled, setEnabled] = useState<boolean>(initialPrefs.enabled)
  const [lineStyle, setLineStyle] = useState<CameraLineStyle>(initialPrefs.lineStyle)
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null)
  const [customOffsets, setCustomOffsets] = useState<Record<string, LayerCalloutOffset>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 560, h: 620 })

  const dragRef = useRef<{
    layerId: string
    pointerId: number
    startX: number
    startY: number
    initDx: number
    initDy: number
    moved: boolean
    additive: boolean
  } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      setViewportSize({
        w: Math.max(240, el.clientWidth || 560),
        h: Math.max(240, el.clientHeight || 620)
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  const handleToggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      writeStoredPrefs(storageKey, { enabled: next, lineStyle })
      return next
    })
  }, [storageKey, lineStyle])

  const handleChangeLineStyle = useCallback(
    (nextStyle: CameraLineStyle) => {
      setLineStyle(nextStyle)
      writeStoredPrefs(storageKey, { enabled: true, lineStyle: nextStyle })
      if (!enabled) setEnabled(true)
    },
    [storageKey, enabled]
  )

  const visibleEntries = useMemo(() => {
    const out: { layer: AssembledLayerItem; orderNum: number }[] = []
    layers.forEach((layer, idx) => {
      if (!layer.hidden) {
        out.push({ layer, orderNum: idx + 1 })
      }
    })
    return out
  }, [layers])

  const computedBubbles = useMemo<ComputedLayerBubble[]>(() => {
    if (visibleEntries.length === 0) return []

    const vw = viewportSize.w
    const vh = viewportSize.h
    const cx = vw / 2 + panX
    const cy = vh / 2 + panY
    const boxW = Math.max(60, canvasWidth * zoom)
    const boxH = Math.max(60, canvasHeight * zoom)

    const boxLeft = cx - boxW / 2
    const boxRight = cx + boxW / 2
    const boxTop = cy - boxH / 2
    const boxBottom = cy + boxH / 2

    const minSpacing = 32
    const maxPerVerticalRail = 12

    const leftRailX = boxLeft - 26
    const rightRailX = boxRight + 26
    const topRailY = boxTop - 26
    const bottomRailY = boxBottom + 26

    const items = visibleEntries.map(({ layer, orderNum }) => {
      const anchorX = cx + layer.x * zoom
      const anchorY = cy + layer.y * zoom
      return {
        layer,
        orderNum,
        anchorX,
        anchorY
      }
    })

    // Tách các layer về phía Trái / Phải theo toạ độ X (nếu X rất gần 0 thì chia chẵn/lẻ cân đối)
    const leftCandidate: typeof items = []
    const rightCandidate: typeof items = []

    items.forEach((item) => {
      if (item.layer.x < -6) {
        leftCandidate.push(item)
      } else if (item.layer.x > 6) {
        rightCandidate.push(item)
      } else if (leftCandidate.length <= rightCandidate.length) {
        leftCandidate.push(item)
      } else {
        rightCandidate.push(item)
      }
    })

    // Cân bằng nếu một bên quá đông so với bên kia
    while (leftCandidate.length > maxPerVerticalRail && rightCandidate.length < maxPerVerticalRail) {
      const moved = leftCandidate.pop()!
      rightCandidate.push(moved)
    }
    while (rightCandidate.length > maxPerVerticalRail && leftCandidate.length < maxPerVerticalRail) {
      const moved = rightCandidate.pop()!
      leftCandidate.push(moved)
    }

    leftCandidate.sort((a, b) => a.anchorY - b.anchorY || a.orderNum - b.orderNum)
    rightCandidate.sort((a, b) => a.anchorY - b.anchorY || a.orderNum - b.orderNum)

    const overflowTop: typeof items = []
    const overflowBottom: typeof items = []

    while (leftCandidate.length > maxPerVerticalRail) {
      const first = leftCandidate.shift()!
      overflowTop.push(first)
      if (leftCandidate.length > maxPerVerticalRail) {
        overflowBottom.push(leftCandidate.pop()!)
      }
    }
    while (rightCandidate.length > maxPerVerticalRail) {
      const first = rightCandidate.shift()!
      overflowTop.push(first)
      if (rightCandidate.length > maxPerVerticalRail) {
        overflowBottom.push(rightCandidate.pop()!)
      }
    }

    const distributeVertical = (
      group: typeof items,
      railX: number,
      side: 'left' | 'right'
    ): ComputedLayerBubble[] => {
      if (group.length === 0) return []
      const halfSpan = Math.max((boxH - 16) / 2, ((group.length - 1) * minSpacing) / 2)
      const groupMinY = cy - halfSpan
      const groupMaxY = cy + halfSpan
      const ys = group.map((g) => Math.max(groupMinY, Math.min(groupMaxY, g.anchorY)))
      // Khử va chạm theo chiều dọc quanh tâm cy của khung caro
      for (let pass = 0; pass < 6; pass++) {
        for (let i = 1; i < ys.length; i++) {
          if (ys[i] < ys[i - 1] + minSpacing) {
            const mid = (ys[i] + ys[i - 1]) / 2
            ys[i - 1] = mid - minSpacing / 2
            ys[i] = mid + minSpacing / 2
          }
        }
        if (ys[0] < groupMinY) {
          const shift = groupMinY - ys[0]
          for (let i = 0; i < ys.length; i++) ys[i] += shift
        }
        if (ys[ys.length - 1] > groupMaxY) {
          const shift = ys[ys.length - 1] - groupMaxY
          for (let i = 0; i < ys.length; i++) ys[i] -= shift
        }
      }
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] < ys[i - 1] + minSpacing) {
          ys[i] = ys[i - 1] + minSpacing
        }
      }
      return group.map((g, i) => ({
        layer: g.layer,
        orderNum: g.orderNum,
        anchorX: g.anchorX,
        anchorY: g.anchorY,
        bubbleX: Math.round(railX),
        bubbleY: Math.round(ys[i]),
        railSide: side,
        isCustomMoved: false
      }))
    }

    const distributeHorizontal = (
      group: typeof items,
      railY: number,
      side: 'top' | 'bottom'
    ): ComputedLayerBubble[] => {
      if (group.length === 0) return []
      group.sort((a, b) => a.anchorX - b.anchorX || a.orderNum - b.orderNum)
      const halfSpanX = Math.max((boxW - 16) / 2, ((group.length - 1) * (minSpacing + 4)) / 2)
      const groupMinX = cx - halfSpanX
      const groupMaxX = cx + halfSpanX
      const xs = group.map((g) => Math.max(groupMinX, Math.min(groupMaxX, g.anchorX)))
      for (let i = 1; i < xs.length; i++) {
        if (xs[i] < xs[i - 1] + minSpacing + 4) {
          xs[i] = xs[i - 1] + minSpacing + 4
        }
      }
      return group.map((g, i) => ({
        layer: g.layer,
        orderNum: g.orderNum,
        anchorX: g.anchorX,
        anchorY: g.anchorY,
        bubbleX: Math.round(xs[i]),
        bubbleY: Math.round(railY),
        railSide: side,
        isCustomMoved: false
      }))
    }

    const allNodes = [
      ...distributeVertical(leftCandidate, leftRailX, 'left'),
      ...distributeVertical(rightCandidate, rightRailX, 'right'),
      ...distributeHorizontal(overflowTop, topRailY, 'top'),
      ...distributeHorizontal(overflowBottom, bottomRailY, 'bottom')
    ]

    // Áp dụng độ lệch kéo thả tự do của người dùng
    for (const node of allNodes) {
      const off = customOffsets[node.layer.id]
      if (off && (Math.abs(off.dx) > 0.5 || Math.abs(off.dy) > 0.5)) {
        node.bubbleX = Math.round(node.bubbleX + off.dx * zoom)
        node.bubbleY = Math.round(node.bubbleY + off.dy * zoom)
        node.isCustomMoved = true
      }
    }

    return allNodes.sort((a, b) => a.orderNum - b.orderNum)
  }, [
    visibleEntries,
    viewportSize,
    panX,
    panY,
    canvasWidth,
    canvasHeight,
    zoom,
    safeLeft,
    safeRight,
    safeTop,
    safeBottom,
    customOffsets
  ])

  const handleBubblePointerDown = (e: React.PointerEvent, node: ComputedLayerBubble) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const existing = customOffsets[node.layer.id] ?? { dx: 0, dy: 0 }
    dragRef.current = {
      layerId: node.layer.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initDx: existing.dx,
      initDy: existing.dy,
      moved: false,
      additive: e.ctrlKey || e.metaKey || e.shiftKey
    }
    setDraggingId(node.layer.id)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleBubblePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    const deltaX = e.clientX - d.startX
    const deltaY = e.clientY - d.startY
    if (!d.moved && Math.hypot(deltaX, deltaY) > 3) {
      d.moved = true
    }
    if (d.moved) {
      const invZoom = 1 / Math.max(0.2, zoom)
      setCustomOffsets((prev) => ({
        ...prev,
        [d.layerId]: {
          dx: d.initDx + deltaX * invZoom,
          dy: d.initDy + deltaY * invZoom
        }
      }))
    }
  }

  const handleBubblePointerUp = (e: React.PointerEvent, node: ComputedLayerBubble) => {
    const d = dragRef.current
    if (!d) return
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(d.pointerId)
    } catch {}
    const wasMoved = d.moved
    const additive = d.additive
    dragRef.current = null
    setDraggingId(null)

    // Nếu người dùng click (hoặc vừa kéo vừa chọn), luôn chọn layer đó để thao tác ngay
    if (!wasMoved) {
      onSelectLayer(node.layer.id, additive)
    } else {
      onSelectLayer(node.layer.id, false)
    }
  }

  const handleResetOffset = (layerId: string) => {
    setCustomOffsets((prev) => {
      const next = { ...prev }
      delete next[layerId]
      return next
    })
  }

  const hasCustomOffsets = Object.keys(customOffsets).length > 0

  if (visibleEntries.length === 0) return null

  return (
    <div className="lw-callout-layer-root">
      {/* Thanh điều khiển Bóng chọn Layer & Kiểu dây nối ReactFlow */}
      {showHud && (
        <div
          className="lw-callout-hud"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`lw-callout-hud-btn${enabled ? ' active' : ''}`}
            onClick={handleToggleEnabled}
            title="Bật/tắt các bóng tròn chọn nhanh Layer nằm ngoài khung caro (giúp chọn dễ dàng khi nhiều layer đè lên nhau)"
          >
            <span>🫧 Bóng Layer ({visibleEntries.length})</span>
          </button>

          {enabled && (
            <>
              <div className="lw-callout-hud-sep" />
              <button
                type="button"
                className={`lw-callout-hud-btn${lineStyle === 'bezier' ? ' active' : ''}`}
                onClick={() => handleChangeLineStyle('bezier')}
                title="Kiểu dây nối Vòng cung mềm mại (ReactFlow Bezier)"
              >
                〜 Cung tròn
              </button>
              <button
                type="button"
                className={`lw-callout-hud-btn${lineStyle === 'smoothstep' ? ' active' : ''}`}
                onClick={() => handleChangeLineStyle('smoothstep')}
                title="Kiểu dây nối Vuông góc bo tròn (ReactFlow SmoothStep)"
              >
                ∟ Vuông bo
              </button>
              {hasCustomOffsets && (
                <button
                  type="button"
                  className="lw-callout-hud-btn"
                  onClick={() => setCustomOffsets({})}
                  title="Đặt lại vị trí các bóng tròn về hàng dọc hai bên ngoài khung caro"
                >
                  ↺
                </button>
              )}
            </>
          )}
        </div>
      )}

      {enabled && (
        <>
          {/* 1. SVG Dây liên kết nối từ Bóng tròn ngoài khung caro vào Tâm từng Layer */}
          <svg className="lw-callout-svg">
            {computedBubbles.map((node) => {
              const isSelected = selectedIds
                ? selectedIds.includes(node.layer.id)
                : node.layer.id === selectedLayerId
              const isHovered = hoveredLayerId === node.layer.id
              const highlight = isSelected || isHovered

              const attach = computeBubbleAnchorAttachment(
                node.bubbleX,
                node.bubbleY,
                node.anchorX,
                node.anchorY,
                14
              )

              const tetherPath =
                lineStyle === 'smoothstep'
                  ? buildReactFlowSmoothStepPath(
                      attach.startX,
                      attach.startY,
                      node.anchorX,
                      node.anchorY,
                      attach.flowMode,
                      12
                    )
                  : buildReactFlowBezierPath(
                      attach.startX,
                      attach.startY,
                      node.anchorX,
                      node.anchorY,
                      attach.flowMode,
                      0.38
                    )

              return (
                <g key={`layer-tether-${node.layer.id}`}>
                  {/* Halo phát sáng dưới dây khi đang chọn hoặc hover */}
                  {highlight && (
                    <path
                      d={tetherPath}
                      fill="none"
                      stroke={isSelected ? 'var(--accent-cyan)' : 'var(--key)'}
                      strokeWidth={5}
                      strokeOpacity={0.18}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Sợi dây liên kết chính (Cung tròn hoặc Vuông bo) */}
                  <path
                    d={tetherPath}
                    fill="none"
                    stroke={
                      isSelected
                        ? 'var(--accent-cyan)'
                        : isHovered
                          ? 'var(--key)'
                          : 'var(--accent-cyan)'
                    }
                    strokeWidth={highlight ? 2 : 1.25}
                    strokeDasharray={isSelected ? 'none' : '4 3'}
                    strokeOpacity={highlight ? 0.96 : 0.46}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Cổng nối trên viền bóng tròn (ReactFlow Port) */}
                  <circle
                    cx={attach.startX}
                    cy={attach.startY}
                    r={highlight ? 3.2 : 2.2}
                    fill={isSelected ? '#ffffff' : 'var(--accent-cyan)'}
                    stroke="var(--bg-2)"
                    strokeWidth={1.1}
                  />

                  {/* Điểm neo tâm Layer bên trong khung caro */}
                  <circle
                    cx={node.anchorX}
                    cy={node.anchorY}
                    r={highlight ? 5 : 3.2}
                    fill={
                      isSelected
                        ? 'var(--accent-cyan)'
                        : isHovered
                          ? 'var(--key)'
                          : 'var(--bg-2)'
                    }
                    stroke={isSelected ? '#ffffff' : 'var(--accent-cyan)'}
                    strokeWidth={highlight ? 1.8 : 1.3}
                    opacity={highlight ? 1 : 0.72}
                  />
                </g>
              )
            })}
          </svg>

          {/* 2. Vòng tròn tâm nổi bật trên Layer khi Hover hoặc Chọn qua Bóng tròn */}
          {computedBubbles.map((node) => {
            const isSelected = selectedIds
              ? selectedIds.includes(node.layer.id)
              : node.layer.id === selectedLayerId
            const isHovered = hoveredLayerId === node.layer.id
            if (!isHovered && !isSelected) return null

            return (
              <div
                key={`target-pin-${node.layer.id}`}
                className={`lw-callout-target-pin${isSelected ? ' active' : ''}`}
                style={{ left: node.anchorX, top: node.anchorY }}
              >
                <div className="lw-callout-target-ring" />
                {isHovered && (
                  <span className="lw-callout-target-tag">
                    #{node.orderNum} · {node.layer.name} · Z:{node.layer.z ?? 0}
                  </span>
                )}
              </div>
            )
          })}

          {/* 3. Các Bóng Tròn Layer (#1, #2, #3...) nằm ngoài khung caro */}
          {computedBubbles.map((node) => {
            const isSelected = selectedIds
              ? selectedIds.includes(node.layer.id)
              : node.layer.id === selectedLayerId
            const isHovered = hoveredLayerId === node.layer.id
            const isDragging = draggingId === node.layer.id

            // Chọn hướng mở nhãn tên để không bao giờ bị tràn ra ngoài mép viewport
            const pillSide =
              node.bubbleX < viewportSize.w * 0.5 ? 'side-left' : 'side-right'

            return (
              <div
                key={`layer-bubble-${node.layer.id}`}
                className={`lw-layer-callout-bubble${isSelected ? ' active' : ''}${isHovered ? ' hovered' : ''}${isDragging ? ' dragging' : ''}${node.layer.locked ? ' locked' : ''}`}
                style={{ left: node.bubbleX, top: node.bubbleY }}
                onPointerEnter={() => setHoveredLayerId(node.layer.id)}
                onPointerLeave={() =>
                  setHoveredLayerId((prev) => (prev === node.layer.id ? null : prev))
                }
                onPointerDown={(e) => handleBubblePointerDown(e, node)}
                onPointerMove={handleBubblePointerMove}
                onPointerUp={(e) => handleBubblePointerUp(e, node)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (node.isCustomMoved) {
                    handleResetOffset(node.layer.id)
                  }
                }}
                title={`Layer #${node.orderNum}: ${node.layer.name} (Z: ${node.layer.z ?? 0})\n• Click: Chọn layer (giữ Ctrl/Shift để chọn nhiều)\n• Kéo giữ: Di chuyển bóng tròn ra chỗ khác${node.isCustomMoved ? '\n• Nhấp đúp: Đặt lại vị trí bóng mặc định' : ''}`}
              >
                <div className="lw-layer-bubble-circle">
                  <span className="lw-layer-bubble-num">#{node.orderNum}</span>
                </div>
                <span className={`lw-layer-bubble-pill ${pillSide}`}>
                  {node.layer.name}
                </span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
