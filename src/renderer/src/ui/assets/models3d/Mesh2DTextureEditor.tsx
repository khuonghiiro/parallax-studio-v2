import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { faceGridSize, formatFaceLabel, type Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { getImageSilhouette } from './silhouette'
import { buildEditorCells, type EditorCell } from './mesh2dCells'
import { Mesh2DHorizontalBar, type ContextTab } from './Mesh2DHorizontalBar'
import { Mesh2DVerticalPalette, type EditorTool } from './Mesh2DVerticalPalette'
import { IconEye, IconEyeOff } from '../../icons'

interface Mesh2DTextureEditorProps {
  face: Face3D | null
  resolvedTexture: ResolvedTexture | null
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  showMesh?: boolean
  onToggleMesh?: () => void
}

const EMPTY: string[] = []

export function Mesh2DTextureEditor({
  face,
  resolvedTexture,
  onUpdateFace,
  showMesh: showMeshProp,
  onToggleMesh
}: Mesh2DTextureEditorProps) {
  const [internalShowMesh, setInternalShowMesh] = useState(true)
  const showMesh = showMeshProp ?? internalShowMesh
  const handleToggleMesh = onToggleMesh ?? (() => setInternalShowMesh((v) => !v))
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

  const isManual = face?.meshMode === 'manual'
  const { cols, rows } = faceGridSize(face)
  const rotation = face?.gridRotation || 0
  const hiddenCells = useMemo(() => new Set(face?.hiddenCells || EMPTY), [face?.hiddenCells])
  const selectedCells = useMemo(() => new Set(face?.selectedCells || EMPTY), [face?.selectedCells])
  const pinnedCells = useMemo(() => new Set(face?.pinnedCells || EMPTY), [face?.pinnedCells])

  // Get image source URL reliably from resolvedTexture
  const imageUrl = resolvedTexture?.url || resolvedTexture?.image?.src || ''

  // Same pixel silhouette + per-cell clipping as the 3D mesh builder
  const silhouette = useMemo(
    () => (resolvedTexture?.image ? getImageSilhouette(resolvedTexture.image) : null),
    [resolvedTexture?.image]
  )

  const cells = useMemo<EditorCell[]>(
    () =>
      buildEditorCells({
        cols, rows, imgW, imgH, silhouette, rotation, autoTrim: !isManual,
        hidden: hiddenCells, selected: selectedCells, pinned: pinnedCells
      }),
    [cols, rows, rotation, isManual, silhouette, hiddenCells, selectedCells, pinnedCells, imgW, imgH]
  )

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

  if (!face) {
    return (
      <div className="mesh2d-editor-container">
        <div className="mesh2d-empty">Chọn một mặt phẳng để chỉnh sửa mesh 2D</div>
      </div>
    )
  }

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
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
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
          ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
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
        ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch { }
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
        ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch { }
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
        showMesh={showMesh}
        onToggleMesh={handleToggleMesh}
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
          showMesh={showMesh}
          onToggleMesh={handleToggleMesh}
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
              <div className="m2d-loading">Đang tải texture...</div>
            )}

            {/* Interactive SVG Mesh Grid Matching 3D Exactly */}
            <svg
              className="mesh2d-svg-overlay"
              viewBox={`0 0 ${imgW} ${imgH}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: '50% 50%',
                pointerEvents: showMesh ? 'all' : 'none'
              }}
            >
              {showMesh && (
                <>
                  {/* Render contour-clipped mesh triangles (identical to the 3D mesh) */}
                  {cells.map((cell) => {
                    if (!cell.isOpaque) return null
                    const cls = `m2d-cell${cell.isHidden ? ' is-hidden' : cell.isSelected ? ' is-selected' : ''}`
                    if (cell.triangles.length > 0) {
                      return (
                        <g key={cell.key} className={cls}>
                          {cell.triangles.map((tri, triIdx) => (
                            <polygon
                              key={triIdx}
                              points={tri.map((p) => `${p[0]},${p[1]}`).join(' ')}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                        </g>
                      )
                    }
                    return (
                      <rect
                        key={cell.key}
                        className={cls}
                        x={cell.corners[0][0]}
                        y={cell.corners[0][1]}
                        width={cell.corners[1][0] - cell.corners[0][0]}
                        height={cell.corners[2][1] - cell.corners[0][1]}
                        vectorEffect="non-scaling-stroke"
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
                      <g key={`pin_${cell.key}`} className="m2d-pin">
                        <circle cx={cx} cy={cy} r={r} strokeWidth={1.5} />
                        <circle className="m2d-pin-dot" cx={cx} cy={cy} r={r * 0.35} />
                      </g>
                    )
                  })}

                  {/* Bounding Frame Outline */}
                  <rect
                    className="m2d-frame"
                    x={0}
                    y={0}
                    width={imgW}
                    height={imgH}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={rotation !== 0 ? '6 4' : 'none'}
                  />
                </>
              )}

              {/* Marquee Bounding Box Selection Drag Overlay */}
              {marquee.active && mqW > 0 && mqH > 0 && (
                <rect
                  className="m2d-marquee"
                  x={mqX}
                  y={mqY}
                  width={mqW}
                  height={mqH}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="4 3"
                />
              )}
            </svg>
          </div>

          {/* Bottom HUD Bar */}
          <div className="mesh2d-hud-bottom">
            <div className="mesh2d-hud-info">
              <span className="mesh2d-hud-face" title={`Mặt phẳng: ${face.name}`}>
                <span className="mesh2d-hud-face-title">Mặt:</span>
                <strong className="mesh2d-hud-face-name">{formatFaceLabel(face.name)}</strong>
              </span>
              <span className="mesh2d-hud-sep" />
              <span className="mesh2d-hud-item">
                {imgW}×{imgH} px
              </span>
              <span className="mesh2d-hud-sep" />
              <span className="mesh2d-hud-item">
                Lưới: <strong>{cols}×{rows}</strong>
              </span>
              <span className="mesh2d-hud-sep" />
              <span className="mesh2d-hud-item">
                Xoay: <strong>{rotation}°</strong>
              </span>
              {face.depthProfile && face.depthProfile !== 'none' && (
                <>
                  <span className="mesh2d-hud-sep" />
                  <span className="mesh2d-hud-badge tag-cyan">
                    Độ sâu: <strong>{face.depthProfile} ({face.depthIntensity || 0}%)</strong>
                  </span>
                </>
              )}
              {face.motionType && face.motionType !== 'none' && (
                <>
                  <span className="mesh2d-hud-sep" />
                  <span className="mesh2d-hud-badge tag-green">
                    Chuyển động: <strong>{face.motionType}</strong>
                  </span>
                </>
              )}
              {selectedCells.size > 0 && (
                <>
                  <span className="mesh2d-hud-sep" />
                  <span className="mesh2d-hud-badge tag-amber">
                    <strong>{selectedCells.size} ô</strong>
                  </span>
                </>
              )}
              {pinnedCells.size > 0 && (
                <>
                  <span className="mesh2d-hud-sep" />
                  <span className="mesh2d-hud-badge tag-amber">
                    Ghim: <strong>{pinnedCells.size} ô</strong>
                  </span>
                </>
              )}
              {hiddenCells.size > 0 && (
                <>
                  <span className="mesh2d-hud-sep" />
                  <span className="mesh2d-hud-badge tag-red">
                    Đã gọt: <strong>{hiddenCells.size} ô</strong>
                  </span>
                </>
              )}
            </div>

            <div className="mesh2d-hud-controls">
              <button
                type="button"
                className={`mesh2d-tool-btn${showMesh ? ' active' : ''}`}
                onClick={handleToggleMesh}
                title={showMesh ? 'Bấm để ẩn đường lưới Mesh 2D' : 'Bấm để hiện đường lưới Mesh 2D'}
              >
                {showMesh ? <IconEye size={12} /> : <IconEyeOff size={12} />}
                <span>{showMesh ? 'Lưới' : 'Ẩn'}</span>
              </button>

              {selectedCells.size > 0 ? (
                <button
                  type="button"
                  className="mesh2d-tool-btn"
                  onClick={() => onUpdateFace(face.id, { selectedCells: [] })}
                  title="Bỏ chọn toàn bộ ô (Esc)"
                >
                  Bỏ chọn ({selectedCells.size})
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
                  className="mesh2d-tool-btn btn-restore"
                  onClick={() => onUpdateFace(face.id, { hiddenCells: [] })}
                  title="Khôi phục lại toàn bộ ô đã gọt"
                >
                  Khôi phục ({hiddenCells.size})
                </button>
              )}

              <div className="mesh2d-zoom-group">
                <button
                  type="button"
                  className="mesh2d-zoom-btn"
                  onClick={() => setZoom((prev) => Math.max(0.2, prev * 0.85))}
                  title="Thu nhỏ (-)"
                >
                  −
                </button>
                <span className="mesh2d-zoom-val">
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
              </div>

              <button
                type="button"
                className="mesh2d-tool-btn"
                onClick={() => {
                  setZoom(1.0)
                  setPan({ x: 0, y: 0 })
                }}
                title="Đặt lại khung nhìn 100%"
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
