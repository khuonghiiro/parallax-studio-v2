import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { createAlphaSampler, type AlphaSampler } from './alphaMeshBuilder'
import { Mesh2DHorizontalBar, type ContextTab } from './Mesh2DHorizontalBar'
import { Mesh2DVerticalPalette, type EditorTool } from './Mesh2DVerticalPalette'
import type { DepthProfileType, MotionType } from './meshEffectsAE'

interface Mesh2DTextureEditorProps {
  face: Face3D | null
  resolvedTexture: ResolvedTexture | null
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
}

interface CellGeometry {
  key: string
  r: number
  c: number
  // Quad vertices in image pixel coords: [TL, TR, BR, BL]
  corners: [number, number][]
  // 2 triangles: each is array of 3 points [x, y]
  triangles: [number, number][][]
  isOpaque: boolean
  isHidden: boolean
  isSelected: boolean
  isPinned: boolean
}

export function Mesh2DTextureEditor({
  face,
  resolvedTexture,
  onUpdateFace
}: Mesh2DTextureEditorProps) {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
  const imagePlaneRef = useRef<HTMLDivElement | null>(null)
  const [tool, setTool] = useState<EditorTool>('bbox-select')
  const [activeTab, setActiveTab] = useState<ContextTab>('grid')
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, startPanX: 0, startPanY: 0 })

  // Bounding box marquee selection state
  const [marquee, setMarquee] = useState<{
    active: boolean
    startX: number
    startY: number
    currX: number
    currY: number
  }>({
    active: false,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0
  })

  // Dimensions
  const imgW = face?.width || 500
  const imgH = face?.height || 500

  // Auto-fit on face change
  useEffect(() => {
    if (!canvasWrapperRef.current || !face) return
    const rect = canvasWrapperRef.current.getBoundingClientRect()
    const pad = 60
    const availW = Math.max(100, rect.width - pad)
    const availH = Math.max(100, rect.height - pad)
    const fitScale = Math.min(availW / imgW, availH / imgH, 1.0)
    setZoom(Math.max(0.2, fitScale))
    setPan({ x: 0, y: 0 })
  }, [face?.id, imgW, imgH])

  if (!face) {
    return (
      <div className="mesh2d-editor-container">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)' }}>
          Chọn một mặt phẳng để chỉnh sửa mesh 2D
        </div>
      </div>
    )
  }

  const isManual = face.meshMode === 'manual'
  const cols = face.gridCols || face.gridRes || 16
  const rows = face.gridRows || face.gridRes || 16
  const rotation = face.gridRotation || 0
  const hiddenCells = useMemo(() => new Set(face.hiddenCells || []), [face.hiddenCells])
  const selectedCells = useMemo(() => new Set(face.selectedCells || []), [face.selectedCells])
  const pinnedCells = useMemo(() => new Set(face.pinnedCells || []), [face.pinnedCells])

  // Get image source URL reliably from resolvedTexture
  const imageUrl = resolvedTexture?.url || resolvedTexture?.image?.src || ''

  // Alpha sampler matching 3D alphaMeshBuilder
  const alphaSampler = useMemo<AlphaSampler | null>(() => {
    if (!resolvedTexture?.image) return null
    return createAlphaSampler(
      resolvedTexture.image,
      Math.max(64, cols * 2),
      Math.max(64, rows * 2)
    )
  }, [resolvedTexture?.image, cols, rows])

  // Compute exact mesh cells matching 3D viewport
  const cells = useMemo<CellGeometry[]>(() => {
    const list: CellGeometry[] = []
    const angleRad = (rotation * Math.PI) / 180
    const cosA = Math.cos(angleRad)
    const sinA = Math.sin(angleRad)

    const transformUV = (u: number, v: number): [number, number] => {
      if (rotation === 0) return [u, v]
      const du = u - 0.5
      const dv = v - 0.5
      return [
        Math.max(0, Math.min(1, 0.5 + (du * cosA - dv * sinA))),
        Math.max(0, Math.min(1, 0.5 + (du * sinA + dv * cosA)))
      ]
    }

    const cellW = imgW / cols
    const cellH = imgH / rows
    const alphaThreshold = 12

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`
        const u0 = c / cols
        const u1 = (c + 1) / cols
        const v0 = 1 - (r + 1) / rows
        const v1 = 1 - r / rows

        const x0 = c * cellW
        const x1 = (c + 1) * cellW
        const y0 = r * cellH
        const y1 = (r + 1) * cellH

        // 4 corners [TL, TR, BR, BL]
        const corners: [number, number][] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1]
        ]

        let isOpaque = true
        let tris: [number, number][][] = [
          [[x0, y0], [x1, y0], [x1, y1]],
          [[x0, y0], [x1, y1], [x0, y1]]
        ]

        if (!isManual && alphaSampler) {
          // Auto mode: calculate exact alpha and diagonal cut
          const uvTL = transformUV(u0, v1)
          const uvTR = transformUV(u1, v1)
          const uvBR = transformUV(u1, v0)
          const uvBL = transformUV(u0, v0)

          const aTL = alphaSampler(uvTL[0], uvTL[1])
          const aTR = alphaSampler(uvTR[0], uvTR[1])
          const aBR = alphaSampler(uvBR[0], uvBR[1])
          const aBL = alphaSampler(uvBL[0], uvBL[1])
          const aCen = alphaSampler((uvTL[0] + uvBR[0]) / 2, (uvTL[1] + uvBR[1]) / 2)

          // If completely transparent, discard cell
          if (
            aTL <= alphaThreshold &&
            aTR <= alphaThreshold &&
            aBR <= alphaThreshold &&
            aBL <= alphaThreshold &&
            aCen <= alphaThreshold
          ) {
            isOpaque = false
            tris = []
          } else {
            // Adaptive diagonal
            const diffSlash = Math.abs(aBL - aTR)
            const diffBackslash = Math.abs(aTL - aBR)
            tris = []
            if (diffSlash <= diffBackslash) {
              if (aTL > alphaThreshold || aBL > alphaThreshold || aTR > alphaThreshold) {
                tris.push([[x0, y0], [x0, y1], [x1, y0]])
              }
              if (aTR > alphaThreshold || aBL > alphaThreshold || aBR > alphaThreshold) {
                tris.push([[x1, y0], [x0, y1], [x1, y1]])
              }
            } else {
              if (aTL > alphaThreshold || aBL > alphaThreshold || aBR > alphaThreshold) {
                tris.push([[x0, y0], [x0, y1], [x1, y1]])
              }
              if (aTL > alphaThreshold || aBR > alphaThreshold || aTR > alphaThreshold) {
                tris.push([[x0, y0], [x1, y1], [x1, y0]])
              }
            }
          }
        }

        list.push({
          key,
          r,
          c,
          corners,
          triangles: tris,
          isOpaque,
          isHidden: hiddenCells.has(key),
          isSelected: selectedCells.has(key),
          isPinned: pinnedCells.has(key)
        })
      }
    }
    return list
  }, [cols, rows, rotation, isManual, alphaSampler, hiddenCells, selectedCells, pinnedCells, imgW, imgH])

  // Convert client cursor coords to Image (0..imgW, 0..imgH) coordinates with 100% precision
  const clientToImageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const plane = imagePlaneRef.current
      if (plane) {
        const rect = plane.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const scaleX = rect.width / imgW
          const scaleY = rect.height / imgH
          return {
            x: (clientX - rect.left) / scaleX,
            y: (clientY - rect.top) / scaleY
          }
        }
      }
      const wrapper = canvasWrapperRef.current
      if (!wrapper) return null
      const rect = wrapper.getBoundingClientRect()
      const cx = rect.left + rect.width / 2 + pan.x
      const cy = rect.top + rect.height / 2 + pan.y
      return {
        x: (clientX - cx) / zoom + imgW / 2,
        y: (clientY - cy) / zoom + imgH / 2
      }
    },
    [imgW, imgH, pan.x, pan.y, zoom]
  )

  // Pointer Down: Marquee drag or Pan
  const handlePointerDown = (e: React.PointerEvent) => {
    // Middle click or right click -> Pan
    if (e.button === 1 || e.button === 2 || tool === 'pan' || (e.shiftKey && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Left click: Start Bounding Box Marquee Selection
    if (e.button === 0) {
      const imgPos = clientToImageCoords(e.clientX, e.clientY)
      if (imgPos) {
        setMarquee({
          active: true,
          startX: imgPos.x,
          startY: imgPos.y,
          currX: imgPos.x,
          currY: imgPos.y
        })
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
    }
  }

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPan({
        x: panStartRef.current.startPanX + dx,
        y: panStartRef.current.startPanY + dy
      })
      return
    }

    if (marquee.active) {
      const imgPos = clientToImageCoords(e.clientX, e.clientY)
      if (imgPos) {
        setMarquee((prev) => ({
          ...prev,
          currX: imgPos.x,
          currY: imgPos.y
        }))
      }
    }
  }

  // Pointer Up: Finalize Marquee Selection
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
      return
    }

    if (marquee.active) {
      const xMin = Math.min(marquee.startX, marquee.currX)
      const xMax = Math.max(marquee.startX, marquee.currX)
      const yMin = Math.min(marquee.startY, marquee.currY)
      const yMax = Math.max(marquee.startY, marquee.currY)
      const isDrag = Math.hypot(xMax - xMin, yMax - yMin) > 5

      const affectedKeys: string[] = []

      cells.forEach((cell) => {
        const cellX0 = cell.corners[0][0]
        const cellX1 = cell.corners[1][0]
        const cellY0 = cell.corners[0][1]
        const cellY1 = cell.corners[2][1]

        const inBox = isDrag
          ? Math.max(xMin, cellX0) < Math.min(xMax, cellX1) &&
            Math.max(yMin, cellY0) < Math.min(yMax, cellY1)
          : xMin >= cellX0 && xMin <= cellX1 && yMin >= cellY0 && yMin <= cellY1

        if (inBox && cell.isOpaque && !cell.isHidden) {
          affectedKeys.push(cell.key)
        }
      })

      if (tool === 'bbox-select') {
        const next = new Set(selectedCells)
        if (e.altKey) {
          // Alt: Deselect
          affectedKeys.forEach((k) => next.delete(k))
        } else if (!isDrag && affectedKeys.length === 1 && next.has(affectedKeys[0])) {
          // Single click toggle off
          next.delete(affectedKeys[0])
        } else {
          // Add to selection
          affectedKeys.forEach((k) => next.add(k))
        }
        onUpdateFace(face.id, { selectedCells: Array.from(next) })
      } else if (tool === 'pin') {
        const next = new Set(pinnedCells)
        if (e.altKey) {
          affectedKeys.forEach((k) => next.delete(k))
        } else if (!isDrag && affectedKeys.length === 1 && next.has(affectedKeys[0])) {
          next.delete(affectedKeys[0])
        } else {
          affectedKeys.forEach((k) => next.add(k))
        }
        onUpdateFace(face.id, { pinnedCells: Array.from(next) })
      } else if (tool === 'erase') {
        const next = new Set(hiddenCells)
        affectedKeys.forEach((k) => next.add(k))
        onUpdateFace(face.id, { hiddenCells: Array.from(next) })
      } else if (tool === 'restore') {
        const next = new Set(hiddenCells)
        affectedKeys.forEach((k) => next.delete(k))
        onUpdateFace(face.id, { hiddenCells: Array.from(next) })
      }

      setMarquee({ active: false, startX: 0, startY: 0, currX: 0, currY: 0 })
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 0.87
    setZoom((prev) => Math.max(0.15, Math.min(6.0, prev * factor)))
  }

  // Quick rotations
  const handleSetRotation = (deg: number) => {
    onUpdateFace(face.id, { gridRotation: deg })
  }

  // Quick grid sizes
  const handleSetGrid = (c: number, r: number) => {
    onUpdateFace(face.id, { gridCols: c, gridRows: r })
  }

  // Toggle Pin (Starch Pin / Puppet Pin) on selected cells
  const handleTogglePinSelected = () => {
    if (!face || selectedCells.size === 0) return
    const current = new Set(face.pinnedCells || [])
    const allPinned = Array.from(selectedCells).every((k) => current.has(k))
    if (allPinned) {
      selectedCells.forEach((k) => current.delete(k))
    } else {
      selectedCells.forEach((k) => current.add(k))
    }
    onUpdateFace(face.id, { pinnedCells: Array.from(current) })
  }

  // Marquee rectangle geometry in image space
  const mqX = Math.min(marquee.startX, marquee.currX)
  const mqY = Math.min(marquee.startY, marquee.currY)
  const mqW = Math.abs(marquee.currX - marquee.startX)
  const mqH = Math.abs(marquee.currY - marquee.startY)

  return (
    <div className="mesh2d-editor-container">
      {/* 1. Horizontal Context Bar (Tab Ngang) */}
      <Mesh2DHorizontalBar
        face={face}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isManual={isManual}
        cols={cols}
        rows={rows}
        rotation={rotation}
        pinnedCellsCount={pinnedCells.size}
        selectedCellsCount={selectedCells.size}
        onUpdateFace={onUpdateFace}
        handleSetGrid={handleSetGrid}
        handleSetRotation={handleSetRotation}
        handleTogglePinSelected={handleTogglePinSelected}
      />

      {/* 2. Workspace Body: Vertical Palette + Canvas */}
      <div className="mesh2d-workspace-body">
        {/* Tab Dọc: Vertical Tool Palette */}
        <Mesh2DVerticalPalette
          tool={tool}
          setTool={setTool}
          selectedCellsCount={selectedCells.size}
          onClearSelection={() => onUpdateFace(face.id, { selectedCells: [] })}
          onResetView={() => {
            setZoom(1.0)
            setPan({ x: 0, y: 0 })
          }}
        />

        {/* Main Canvas Area */}
        <div
          ref={canvasWrapperRef}
          className={`mesh2d-canvas-wrapper tool-${tool}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
        <div
          ref={imagePlaneRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: imgW,
            height: imgH,
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'none'
          }}
        >
          {/* Base Texture Image */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={face.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
              draggable={false}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '2px dashed var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                fontSize: 14
              }}
            >
              Đang tải texture...
            </div>
          )}

          {/* Interactive SVG Mesh Grid Matching 3D Exactly */}
          <svg
            className="mesh2d-svg-overlay"
            viewBox={`0 0 ${imgW} ${imgH}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: '50% 50%'
            }}
          >
            {/* Render Triangles/Quads */}
            {cells.map((cell) => {
              if (!cell.isOpaque) return null

              let fill = 'rgba(56, 189, 248, 0.06)'
              let stroke = 'rgba(56, 189, 248, 0.45)'
              let strokeWidth = 1

              if (cell.isHidden) {
                fill = 'rgba(239, 68, 68, 0.35)'
                stroke = 'rgba(239, 68, 68, 0.8)'
              } else if (cell.isSelected) {
                fill = 'rgba(234, 179, 8, 0.45)'
                stroke = 'rgba(250, 204, 21, 0.95)'
                strokeWidth = 2
              }

              // Draw triangles if triangulated, or quad rect
              if (cell.triangles.length > 0) {
                return (
                  <g key={cell.key}>
                    {cell.triangles.map((tri, triIdx) => (
                      <polygon
                        key={triIdx}
                        points={tri.map((p) => `${p[0]},${p[1]}`).join(' ')}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                      />
                    ))}
                  </g>
                )
              }

              return (
                <rect
                  key={cell.key}
                  x={cell.corners[0][0]}
                  y={cell.corners[0][1]}
                  width={cell.corners[1][0] - cell.corners[0][0]}
                  height={cell.corners[2][1] - cell.corners[0][1]}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
              )
            })}

            {/* Pinned Starch Pin Indicators (After Effects Puppet Pin) */}
            {cells.map((cell) => {
              if (!cell.isPinned || !cell.isOpaque || cell.isHidden) return null
              const cx = (cell.corners[0][0] + cell.corners[2][0]) / 2
              const cy = (cell.corners[0][1] + cell.corners[2][1]) / 2
              const r = Math.min(8, Math.max(3, (imgW / cols) * 0.3))
              return (
                <g key={`pin_${cell.key}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <circle cx={cx} cy={cy} r={r * 0.35} fill="#ffffff" />
                </g>
              )
            })}

            {/* Bounding Frame Outline */}
            <rect
              x={0}
              y={0}
              width={imgW}
              height={imgH}
              fill="none"
              stroke="var(--accent-cyan)"
              strokeWidth={1.5}
              strokeDasharray={rotation !== 0 ? '6 4' : 'none'}
            />

            {/* Marquee Bounding Box Selection Drag Overlay */}
            {marquee.active && mqW > 0 && mqH > 0 && (
              <rect
                x={mqX}
                y={mqY}
                width={mqW}
                height={mqH}
                fill="rgba(234, 179, 8, 0.25)"
                stroke="var(--key)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
          </svg>
        </div>

        {/* Bottom HUD Bar */}
        <div className="mesh2d-hud-bottom">
          <div className="mesh2d-hud-info">
            <span>
              Mặt: <strong>{face.name}</strong>
            </span>
            <span>|</span>
            <span>
              {imgW} × {imgH} px
            </span>
            <span>|</span>
            <span>
              Lưới: <strong>{cols} × {rows}</strong>
            </span>
            <span>|</span>
            <span>
              Xoay: <strong>{rotation}°</strong>
            </span>
            {face.depthProfile && face.depthProfile !== 'none' && (
              <>
                <span>|</span>
                <span style={{ color: 'var(--accent-cyan)' }}>
                  Độ sâu: <strong>{face.depthProfile} ({face.depthIntensity || 0}%)</strong>
                </span>
              </>
            )}
            {face.motionType && face.motionType !== 'none' && (
              <>
                <span>|</span>
                <span style={{ color: '#10b981' }}>
                  Chuyển động: <strong>{face.motionType}</strong>
                </span>
              </>
            )}
            {selectedCells.size > 0 && (
              <>
                <span>|</span>
                <span style={{ color: 'var(--key)' }}>
                  Đang chọn: <strong>{selectedCells.size} ô</strong>
                </span>
              </>
            )}
            {pinnedCells.size > 0 && (
              <>
                <span>|</span>
                <span style={{ color: '#f59e0b' }}>
                  Ghim: <strong>{pinnedCells.size} ô</strong>
                </span>
              </>
            )}
            {hiddenCells.size > 0 && (
              <>
                <span>|</span>
                <span style={{ color: '#ef4444' }}>
                  Đã gọt: <strong>{hiddenCells.size} ô</strong>
                </span>
              </>
            )}
          </div>

          <div className="mesh2d-hud-controls">
            {selectedCells.size > 0 ? (
              <button
                type="button"
                className="mesh2d-tool-btn"
                onClick={() => onUpdateFace(face.id, { selectedCells: [] })}
                title="Bỏ chọn toàn bộ ô"
              >
                Bỏ chọn
              </button>
            ) : (
              <button
                type="button"
                className="mesh2d-tool-btn"
                onClick={() => {
                  const all = cells.filter((c) => c.isOpaque && !c.isHidden).map((c) => c.key)
                  onUpdateFace(face.id, { selectedCells: all })
                }}
                title="Chọn tất cả các ô hiện hữu"
              >
                Chọn tất cả
              </button>
            )}

            {hiddenCells.size > 0 && (
              <button
                type="button"
                className="mesh2d-tool-btn"
                onClick={() => onUpdateFace(face.id, { hiddenCells: [] })}
                title="Khôi phục lại toàn bộ ô đã gọt"
              >
                Khôi phục ({hiddenCells.size})
              </button>
            )}

            <button
              type="button"
              className="mesh2d-zoom-btn"
              onClick={() => setZoom((prev) => Math.max(0.2, prev * 0.85))}
              title="Thu nhỏ (-)"
            >
              -
            </button>
            <span style={{ fontSize: 11, minWidth: 36, textAlign: 'center', color: 'var(--text)' }}>
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              type="button"
              className="mesh2d-zoom-btn"
              onClick={() => setZoom((prev) => Math.min(5.0, prev * 1.15))}
              title="Phóng to (+)"
            >
              +
            </button>
            <button
              type="button"
              className="mesh2d-tool-btn"
              onClick={() => {
                setZoom(1.0)
                setPan({ x: 0, y: 0 })
              }}
              title="Đặt lại 100%"
            >
              100%
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
