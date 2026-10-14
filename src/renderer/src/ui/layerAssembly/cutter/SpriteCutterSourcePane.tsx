import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { ChromaKeySettings, CutToolMode, DetectedIsland, CutPoint, CutPiece } from './types'
import {
  applyChromaKey,
  detectOpaqueIslands,
  extractRegionDataUrl,
  createCutterStroke,
  type CutterStrokeSession
} from './chromaKey'
import { CutterBrushSubBar } from './CutterBrushSubBar'
import { SpriteCutterSourceToolbar } from './SpriteCutterSourceToolbar'
import { SAMPLE_ANIME_SPRITESHEET_URL } from './sampleSpriteSheet'
import { IconScissors, IconUpload, IconRefresh, IconCheck } from '../../icons'

export interface SpriteCutterSourcePaneProps {
  onSelectPiece: (piece: CutPiece | null) => void
  onTransferToTarget: (piece: CutPiece) => void
  selectedPiece: CutPiece | null
}

const DEFAULT_CHROMA: ChromaKeySettings = {
  enabled: true,
  keyColor: '#00db4e', // Xanh lá cây Chroma Green
  tolerance: 36,
  smoothness: 2,
  despill: true,
  previewBackground: 'checkerboard'
}

export function SpriteCutterSourcePane({
  onSelectPiece,
  onTransferToTarget,
  selectedPiece
}: SpriteCutterSourcePaneProps) {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_ANIME_SPRITESHEET_URL)
  const [chroma, setChroma] = useState<ChromaKeySettings>(DEFAULT_CHROMA)
  const [tool, setTool] = useState<CutToolMode>('auto')
  const [isPickingColor, setIsPickingColor] = useState(false)
  const [islands, setIslands] = useState<DetectedIsland[]>([])
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null)
  const [minIslandArea, setMinIslandArea] = useState<number>(100)
  const [brushRadius, setBrushRadius] = useState<number>(18)
  const [brushHardness, setBrushHardness] = useState<number>(0.85)
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0)
  const [tagVisibility, setTagVisibility] = useState<'hover' | 'always' | 'hidden'>('hover')
  const [brushCursorPos, setBrushCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Active stroke session and point tracker for continuous interpolation
  const activeStrokeRef = useRef<CutterStrokeSession | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Canvas pixel undo / redo stack
  const undoStackRef = useRef<ImageData[]>([])
  const redoStackRef = useRef<ImageData[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Drag marquee selection
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<CutPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [copiedBadge, setCopiedBadge] = useState(false)

  // Responsive canvas fitting & zoom so the cutout image is never clipped at top/bottom
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number }>({ w: 665, h: 702 })
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 560, h: 520 })
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')

  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportWrapRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = viewportWrapRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load image into raw canvas and process
  const processImage = useCallback(() => {
    if (!imageUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || 665
      const h = img.naturalHeight || 702
      setImgNaturalSize({ w, h })

      // Raw canvas
      let raw = rawCanvasRef.current
      if (!raw) {
        raw = document.createElement('canvas')
        rawCanvasRef.current = raw
      }
      raw.width = w
      raw.height = h
      const rctx = raw.getContext('2d', { willReadFrequently: true })
      if (!rctx) return
      rctx.drawImage(img, 0, 0)

      // Processed canvas
      const proc = procCanvasRef.current
      if (!proc) return
      proc.width = w
      proc.height = h
      const pctx = proc.getContext('2d', { willReadFrequently: true })
      if (!pctx) return

      applyChromaKey(rctx, pctx, w, h, chroma)

      // Auto detect islands if in auto mode
      if (chroma.enabled) {
        const found = detectOpaqueIslands(pctx, w, h, minIslandArea)
        setIslands(found)
      } else {
        setIslands([])
      }
    }
    img.src = imageUrl
  }, [imageUrl, chroma, minIslandArea])

  useEffect(() => {
    processImage()
  }, [processImage])

  // Select an island
  const handleSelectIsland = (isl: DetectedIsland) => {
    const proc = procCanvasRef.current
    if (!proc) return
    setSelectedIslandId(isl.id)
    setMarquee(null)
    setLassoPoints([])

    const dataUrl = extractRegionDataUrl(proc, isl)
    onSelectPiece({
      id: isl.id,
      dataUrl,
      width: isl.width,
      height: isl.height,
      label: isl.label || 'Mảnh cắt',
      sourceBox: isl
    })
  }

  // Canvas Undo / Redo logic
  const handleUndo = useCallback(() => {
    const proc = procCanvasRef.current
    if (!proc || undoStackRef.current.length === 0) return
    const pctx = proc.getContext('2d', { willReadFrequently: true })
    if (!pctx) return
    const currentSnap = pctx.getImageData(0, 0, proc.width, proc.height)
    redoStackRef.current.push(currentSnap)
    const prevSnap = undoStackRef.current.pop()!
    pctx.putImageData(prevSnap, 0, 0)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
    if (chroma.enabled) {
      const found = detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea)
      setIslands(found)
    }
  }, [chroma.enabled, minIslandArea])

  const handleRedo = useCallback(() => {
    const proc = procCanvasRef.current
    if (!proc || redoStackRef.current.length === 0) return
    const pctx = proc.getContext('2d', { willReadFrequently: true })
    if (!pctx) return
    const currentSnap = pctx.getImageData(0, 0, proc.width, proc.height)
    undoStackRef.current.push(currentSnap)
    const nextSnap = redoStackRef.current.pop()!
    pctx.putImageData(nextSnap, 0, 0)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    if (chroma.enabled) {
      const found = detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea)
      setIslands(found)
    }
  }, [chroma.enabled, minIslandArea])

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if (key === 'y') {
        e.preventDefault()
        handleRedo()
      } else if (key === 'c') {
        if (selectedPiece) {
          e.preventDefault()
          handleCopyPiece()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, selectedPiece])

  // Pointer interactions on canvas (Marquee / Lasso / Eyedropper / Brush)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = e.currentTarget.width / rect.width
    const scaleY = e.currentTarget.height / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    }
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e)

    if (isPickingColor) {
      const raw = rawCanvasRef.current
      if (raw) {
        const rctx = raw.getContext('2d')
        if (rctx) {
          const pixel = rctx.getImageData(x, y, 1, 1).data
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`
          setChroma((prev) => ({ ...prev, keyColor: hex, enabled: true }))
          setIsPickingColor(false)
        }
      }
      return
    }

    if (tool === 'eraser' || tool === 'restore') {
      setIsDrawing(true)
      const raw = rawCanvasRef.current
      const proc = procCanvasRef.current
      if (raw && proc) {
        const rctx = raw.getContext('2d', { willReadFrequently: true })
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (rctx && pctx) {
          // Push to undo stack before stroke begins
          const snap = pctx.getImageData(0, 0, proc.width, proc.height)
          undoStackRef.current.push(snap)
          if (undoStackRef.current.length > 25) undoStackRef.current.shift()
          redoStackRef.current = []
          setCanUndo(true)
          setCanRedo(false)

          const stroke = createCutterStroke(pctx, rctx, proc.width, proc.height, {
            radius: brushRadius,
            hardness: brushHardness,
            opacity: brushOpacity,
            isEraser: tool === 'eraser'
          })
          stroke.segment({ x, y }, { x, y })
          stroke.commit()
          activeStrokeRef.current = stroke
          lastPointRef.current = { x, y }
        }
      }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      return
    }

    if (tool === 'box') {
      setIsDrawing(true)
      setSelectedIslandId(null)
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y })
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    } else if (tool === 'lasso') {
      setIsDrawing(true)
      setSelectedIslandId(null)
      setLassoPoints([{ x, y }])
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (tool === 'eraser' || tool === 'restore') {
      setBrushCursorPos({
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top)
      })
    }

    if (!isDrawing) return
    const { x, y } = getCanvasCoords(e)

    if (tool === 'eraser' || tool === 'restore') {
      if (activeStrokeRef.current && lastPointRef.current) {
        const rawSamples = e.nativeEvent.getCoalescedEvents?.() ?? []
        const samples = rawSamples.length ? rawSamples : [e.nativeEvent]
        for (const sample of samples) {
          const scaleX = e.currentTarget.width / rect.width
          const scaleY = e.currentTarget.height / rect.height
          const pt = {
            x: Math.round((sample.clientX - rect.left) * scaleX),
            y: Math.round((sample.clientY - rect.top) * scaleY)
          }
          activeStrokeRef.current.segment(lastPointRef.current, pt)
          lastPointRef.current = pt
        }
        activeStrokeRef.current.commit()
      }
      return
    }

    if (tool === 'box' && marquee) {
      setMarquee({ ...marquee, currentX: x, currentY: y })
    } else if (tool === 'lasso') {
      setLassoPoints((pts) => [...pts, { x, y }])
    }
  }

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setIsDrawing(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}

    const proc = procCanvasRef.current
    if (!proc) return

    if (tool === 'eraser' || tool === 'restore') {
      if (activeStrokeRef.current) {
        activeStrokeRef.current.commit()
        activeStrokeRef.current = null
      }
      lastPointRef.current = null

      // Re-scan islands if auto islands were active
      if (chroma.enabled && rawCanvasRef.current) {
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (pctx) {
          const found = detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea)
          setIslands(found)
        }
      }
      return
    }

    if (tool === 'box' && marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX)
      const minY = Math.min(marquee.startY, marquee.currentY)
      const w = Math.abs(marquee.currentX - marquee.startX)
      const h = Math.abs(marquee.currentY - marquee.startY)

      if (w >= 10 && h >= 10) {
        const box = { x: minX, y: minY, width: w, height: h }
        const dataUrl = extractRegionDataUrl(proc, box)
        const piece: CutPiece = {
          id: `box-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: `Vùng ${w}×${h}px`,
          sourceBox: box
        }
        try {
          ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
        } catch {}
        onSelectPiece(piece)
      }
    } else if (tool === 'lasso' && lassoPoints.length >= 3) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of lassoPoints) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      const w = maxX - minX
      const h = maxY - minY
      if (w >= 10 && h >= 10) {
        const box = { x: minX, y: minY, width: w, height: h }
        const dataUrl = extractRegionDataUrl(proc, box, lassoPoints)
        const piece: CutPiece = {
          id: `lasso-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: `Vùng tự do`,
          sourceBox: box
        }
        try {
          ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
        } catch {}
        onSelectPiece(piece)
      }
    }
  }

  const handleCopyPiece = () => {
    if (!selectedPiece) return
    try {
      ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = selectedPiece
      setCopiedBadge(true)
      setTimeout(() => setCopiedBadge(false), 2000)
    } catch {}
  }

  // Handle Drag Start from Left Pane to Right Pane
  const handleDragStart = (e: React.DragEvent, piece: CutPiece) => {
    e.dataTransfer.setData('application/json', JSON.stringify(piece))
    e.dataTransfer.setData('text/plain', piece.dataUrl)
    e.dataTransfer.effectAllowed = 'copyMove'
    ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const res = ev.target?.result as string
      if (res) {
        setImageUrl(res)
        setSelectedIslandId(null)
        onSelectPiece(null)
      }
    }
    reader.readAsDataURL(file)
  }

  const availW = Math.max(180, viewportSize.w - 36)
  const availH = Math.max(180, viewportSize.h - 44)
  const fitScale = Math.min(1, availW / Math.max(1, imgNaturalSize.w), availH / Math.max(1, imgNaturalSize.h))
  const effectiveScale = zoomMode === 'fit' ? fitScale : zoomMode
  const displayW = Math.max(1, Math.round(imgNaturalSize.w * effectiveScale))
  const displayH = Math.max(1, Math.round(imgNaturalSize.h * effectiveScale))
  const scaleX = displayW / Math.max(1, imgNaturalSize.w)
  const scaleY = displayH / Math.max(1, imgNaturalSize.h)

  const handleSelectTool = (next: CutToolMode) => {
    setTool(next)
    if (next !== 'auto') setSelectedIslandId(null)
    if (next !== 'box' && next !== 'lasso') {
      setMarquee(null)
      setLassoPoints([])
    }
  }

  const stepZoom = (delta: number) => {
    const next = Math.min(2.0, Math.max(0.25, Number((effectiveScale + delta).toFixed(2))))
    setZoomMode(next)
  }

  return (
    <div className="layer-cutter-pane left-pane" ref={containerRef}>
      {/* Pane Header */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconScissors width={14} height={14} />
          <strong>Nguồn ảnh & Tách nền</strong>
          <span className="layer-cutter-badge-pill">{islands.length} mảnh cắt</span>
          <span className="layer-cutter-badge" title="Kích thước ảnh gốc">
            {imgNaturalSize.w}×{imgNaturalSize.h}px
          </span>
        </div>
        <div className="layer-cutter-actions">
          {/* Zoom & Fit-to-View Pill */}
          <div className="layer-cutter-zoom-pill" title="Thu phóng khung nhìn ảnh nguồn">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepZoom(-0.15)}
              title="Thu nhỏ (-15%)"
            >
              -
            </button>
            <button
              type="button"
              className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
              onClick={() => setZoomMode('fit')}
              title="Tự động căn vừa toàn bộ ảnh trong khung nhìn (không khuất chi tiết)"
            >
              Vừa khung ({Math.round(effectiveScale * 100)}%)
            </button>
            <button
              type="button"
              className={`layer-cutter-zoom-mode-btn ${zoomMode === 1 ? 'active' : ''}`}
              onClick={() => setZoomMode(1)}
              title="Xem tỉ lệ 1:1 (100%)"
            >
              100%
            </button>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => stepZoom(0.15)}
              title="Phóng to (+15%)"
            >
              +
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn sm"
            onClick={() => fileInputRef.current?.click()}
            title="Tải ảnh sprite sheet từ máy tính"
          >
            <IconUpload width={12} height={12} /> Tải ảnh
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setImageUrl(SAMPLE_ANIME_SPRITESHEET_URL)
              setZoomMode('fit')
            }}
            title="Nạp lại ảnh mẫu Anime Green Screen"
          >
            <IconRefresh width={12} height={12} /> Ảnh mẫu
          </button>
        </div>
      </div>

      {/* Studio Topbar Ribbon: Row 1 (cutting tools) + Row 2 (compact Chroma Key bar) */}
      <SpriteCutterSourceToolbar
        tool={tool}
        islandCount={islands.length}
        minIslandArea={minIslandArea}
        tagVisibility={tagVisibility}
        chroma={chroma}
        isPickingColor={isPickingColor}
        onSelectTool={handleSelectTool}
        onChangeMinIslandArea={setMinIslandArea}
        onChangeTagVisibility={setTagVisibility}
        onChangeChroma={setChroma}
        onTogglePicking={() => setIsPickingColor((v) => !v)}
      />

      {/* Specialized Sub-toolbar for Eraser / Restore Brush */}
      {(tool === 'eraser' || tool === 'restore') && (
        <CutterBrushSubBar
          tool={tool}
          brushRadius={brushRadius}
          brushHardness={brushHardness}
          brushOpacity={brushOpacity}
          canUndo={canUndo}
          canRedo={canRedo}
          onChangeRadius={setBrushRadius}
          onChangeHardness={setBrushHardness}
          onChangeOpacity={setBrushOpacity}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      )}

      {/* Main Canvas View (Fit-to-Viewport by default so zero top/bottom details are ever clipped) */}
      <div
        ref={viewportWrapRef}
        className={`layer-cutter-canvas-wrap bg-${chroma.previewBackground} ${zoomMode !== 'fit' && effectiveScale > fitScale ? 'is-scrollable' : ''}`}
      >
        <div
          className={`layer-cutter-source-canvas-box tag-mode-${tagVisibility}`}
          style={{ width: `${displayW}px`, height: `${displayH}px` }}
        >
          <canvas
            ref={procCanvasRef}
            className="layer-cutter-canvas"
            style={{
              width: '100%',
              height: '100%',
              cursor: isPickingColor
                ? 'crosshair'
                : tool === 'eraser' || tool === 'restore'
                ? 'none'
                : tool === 'box' || tool === 'lasso'
                ? 'crosshair'
                : 'default'
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={() => setBrushCursorPos(null)}
          />

          {/* Circular Brush Cursor Indicator */}
          {(tool === 'eraser' || tool === 'restore') && brushCursorPos && (
            <div
              className="layer-cutter-brush-cursor"
              style={{
                left: `${brushCursorPos.x}px`,
                top: `${brushCursorPos.y}px`,
                width: `${brushRadius * 2 * scaleX}px`,
                height: `${brushRadius * 2 * scaleY}px`
              }}
            />
          )}

          {/* Render Detected Islands (Auto Mode) */}
          {tool === 'auto' &&
            islands.map((isl) => {
              const isSelected = selectedIslandId === isl.id
              const boxW = isl.width * scaleX
              const boxH = isl.height * scaleY
              const isInside = boxH >= 34 && boxW >= 46
              const isNearTop = isl.y * scaleY < 22
              const tagPlacementClass = isInside
                ? 'inside-top-left'
                : isNearTop
                ? 'outside-bottom'
                : 'outside-top'

              return (
                <div
                  key={isl.id}
                  className={`layer-cutter-island-box ${isSelected ? 'selected' : ''}`}
                  draggable={isSelected}
                  onDragStart={(e) => selectedPiece && handleDragStart(e, selectedPiece)}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectIsland(isl)
                  }}
                  style={{
                    left: `${isl.x * scaleX}px`,
                    top: `${isl.y * scaleY}px`,
                    width: `${boxW}px`,
                    height: `${boxH}px`
                  }}
                  title="Click để chọn · Kéo thả sang phải để gán vào bố cục 2D"
                >
                  <span className={`layer-cutter-island-tag ${tagPlacementClass}`}>
                    {isl.label}
                  </span>
                </div>
              )
            })}

          {/* Render Manual Box Marquee */}
          {tool === 'box' && marquee && (
            <div
              className={`layer-cutter-marquee ${!isDrawing && selectedPiece ? 'ready' : ''}`}
              draggable={!isDrawing && Boolean(selectedPiece)}
              onDragStart={(e) => selectedPiece && handleDragStart(e, selectedPiece)}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${Math.min(marquee.startX, marquee.currentX) * scaleX}px`,
                top: `${Math.min(marquee.startY, marquee.currentY) * scaleY}px`,
                width: `${Math.abs(marquee.currentX - marquee.startX) * scaleX}px`,
                height: `${Math.abs(marquee.currentY - marquee.startY) * scaleY}px`
              }}
              title={!isDrawing && selectedPiece ? 'Kéo thả sang phải hoặc click để đưa vào Bố cục 2D' : undefined}
            >
              {!isDrawing && selectedPiece && (
                <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn sm primary"
                    style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                    onClick={() => onTransferToTarget(selectedPiece)}
                    title="Đưa vùng chọn này vào Bố cục 2D"
                  >
                    Đưa vào 2D ➡️
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                    onClick={handleCopyPiece}
                    title="Sao chép vùng này (Ctrl+C)"
                  >
                    {copiedBadge ? 'Đã chép!' : 'Sao chép'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Render Lasso Path Overlay */}
          {tool === 'lasso' && lassoPoints.length >= 2 && (
            <>
              <svg className="layer-cutter-lasso-svg">
                <polyline
                  points={lassoPoints
                    .map((p) => `${p.x * scaleX},${p.y * scaleY}`)
                    .join(' ')}
                  fill="rgba(251, 191, 36, 0.2)"
                  stroke="var(--key)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              </svg>

              {!isDrawing && selectedPiece && selectedPiece.sourceBox && (
                <div
                  className="layer-cutter-marquee ready"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, selectedPiece)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    left: `${selectedPiece.sourceBox.x * scaleX}px`,
                    top: `${selectedPiece.sourceBox.y * scaleY}px`,
                    width: `${selectedPiece.sourceBox.width * scaleX}px`,
                    height: `${selectedPiece.sourceBox.height * scaleY}px`
                  }}
                  title="Kéo thả sang phải hoặc click để đưa vào Bố cục 2D"
                >
                  <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn sm primary"
                      style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                      onClick={() => onTransferToTarget(selectedPiece)}
                      title="Đưa vùng chọn này vào Bố cục 2D"
                    >
                      Đưa vào 2D ➡️
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                      onClick={handleCopyPiece}
                      title="Sao chép vùng này (Ctrl+C)"
                    >
                      {copiedBadge ? 'Đã chép!' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="layer-cutter-footer">
        <div className="layer-cutter-footer-selected">
          {selectedPiece ? (
            <>
              <img
                src={selectedPiece.dataUrl}
                alt={selectedPiece.label}
                className="layer-cutter-piece-mini-thumb"
              />
              <span>
                <strong>Đang chọn:</strong> {selectedPiece.label}{' '}
                <span className="layer-cutter-val-mono">
                  ({selectedPiece.width}×{selectedPiece.height}px)
                </span>
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>
              Click vào mảnh cắt trên ảnh hoặc khoanh vùng để chọn bộ phận
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <span className="layer-cutter-footer-hint">
            Kéo thả sang phải hoặc <kbd>Ctrl+C</kbd> ➔ <kbd>Ctrl+V</kbd>
          </span>
          <button
            id="btn-copy-piece"
            type="button"
            className="btn sm"
            disabled={!selectedPiece}
            onClick={handleCopyPiece}
            title="Sao chép mảnh đã chọn (Ctrl+C)"
          >
            {copiedBadge ? <><IconCheck width={12} height={12} /> Đã chép!</> : 'Sao chép (Ctrl+C)'}
          </button>
          <button
            id="btn-transfer-to-target"
            type="button"
            className="btn sm primary"
            disabled={!selectedPiece}
            onClick={() => selectedPiece && onTransferToTarget(selectedPiece)}
            title="Thêm mảnh đã chọn thành Layer vào Bố cục 2D"
          >
            Đưa vào Bố cục 2D ➡️
          </button>
        </div>
      </div>
    </div>
  )
}
