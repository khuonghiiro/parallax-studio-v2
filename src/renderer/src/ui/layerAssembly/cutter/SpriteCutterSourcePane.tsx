import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { ChromaKeySettings, CutToolMode, DetectedIsland, CutPoint, CutPiece } from './types'
import { applyChromaKey, detectOpaqueIslands, extractRegionDataUrl, applyBrushToCanvas } from './chromaKey'
import { SAMPLE_ANIME_SPRITESHEET_URL } from './sampleSpriteSheet'
import { IconScissors, IconWand, IconDropper, IconUpload, IconRefresh, IconCheck, IconTrash } from '../../icons'

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

  // Drag marquee selection
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<CutPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [copiedBadge, setCopiedBadge] = useState(false)

  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load image into raw canvas and process
  const processImage = useCallback(() => {
    if (!imageUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight

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
          applyBrushToCanvas(pctx, rctx, x, y, brushRadius, tool === 'eraser')
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
    if (!isDrawing) return
    const { x, y } = getCanvasCoords(e)

    if (tool === 'eraser' || tool === 'restore') {
      const raw = rawCanvasRef.current
      const proc = procCanvasRef.current
      if (raw && proc) {
        const rctx = raw.getContext('2d', { willReadFrequently: true })
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (rctx && pctx) {
          applyBrushToCanvas(pctx, rctx, x, y, brushRadius, tool === 'eraser')
        }
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
        onSelectPiece({
          id: `box-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: `Vùng ${w}×${h}px`,
          sourceBox: box
        })
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
        onSelectPiece({
          id: `lasso-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: `Vùng tự do`,
          sourceBox: box
        })
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

  return (
    <div className="layer-cutter-pane left-pane" ref={containerRef}>
      {/* Pane Header */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconScissors width={14} height={14} />
          <strong>Nguồn ảnh & Tách nền</strong>
          <span className="layer-cutter-badge">Pane 1</span>
        </div>
        <div className="layer-cutter-actions">
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
            onClick={() => setImageUrl(SAMPLE_ANIME_SPRITESHEET_URL)}
            title="Nạp lại ảnh mẫu Anime Green Screen"
          >
            <IconRefresh width={12} height={12} /> Ảnh mẫu Anime
          </button>
        </div>
      </div>

      {/* Chroma Key Controls Toolbar */}
      <div className="layer-cutter-toolbar">
        <label className="layer-cutter-control-row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={chroma.enabled}
            onChange={(e) => setChroma({ ...chroma, enabled: e.target.checked })}
          />
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Tách nền Chroma</span>
        </label>

        {chroma.enabled && (
          <>
            <div className="layer-cutter-control-row">
              <span>Màu:</span>
              <button
                type="button"
                className="layer-cutter-color-swatch"
                style={{ backgroundColor: chroma.keyColor }}
                title={`Màu khóa: ${chroma.keyColor}`}
                onClick={() => setIsPickingColor(!isPickingColor)}
              />
              <button
                type="button"
                className={`btn sm icon ${isPickingColor ? 'primary' : ''}`}
                style={{ height: 24, padding: '0 6px' }}
                title="Hút màu trực tiếp trên ảnh"
                onClick={() => setIsPickingColor(!isPickingColor)}
              >
                <IconDropper width={12} height={12} /> Hút màu
              </button>
            </div>

            <div className="layer-cutter-control-row">
              <span>Độ nhạy:</span>
              <input
                type="range"
                min={5}
                max={90}
                value={chroma.tolerance}
                onChange={(e) => setChroma({ ...chroma, tolerance: Number(e.target.value) })}
              />
              <span>{chroma.tolerance}%</span>
            </div>

            <div className="layer-cutter-control-row">
              <span>Khử viền:</span>
              <input
                type="checkbox"
                checked={chroma.despill}
                onChange={(e) => setChroma({ ...chroma, despill: e.target.checked })}
              />
            </div>
          </>
        )}

        {/* Tool modes */}
        <div className="layer-cutter-tool-group" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'auto' ? 'active' : ''}`}
            onClick={() => { setTool('auto'); setMarquee(null); setLassoPoints([]) }}
            title="Tự động phát hiện các đảo pixel không dính nhau"
          >
            <IconWand width={12} height={12} /> Quét tự động ({islands.length})
          </button>
          <button
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'box' ? 'active' : ''}`}
            onClick={() => { setTool('box'); setSelectedIslandId(null) }}
            title="Kéo chuột vẽ khung chữ nhật bao quanh bộ phận"
          >
            Khung chữ nhật
          </button>
          <button
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'lasso' ? 'active' : ''}`}
            onClick={() => { setTool('lasso'); setSelectedIslandId(null) }}
            title="Vẽ vùng chọn tự do theo hình dáng"
          >
            Lasso
          </button>
          <button
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => { setTool('eraser'); setSelectedIslandId(null); setMarquee(null); setLassoPoints([]) }}
            title="Cọ tẩy: Quét chuột để xóa viền xanh hoặc chi tiết thừa"
          >
            Cọ tẩy
          </button>
          <button
            type="button"
            className={`layer-cutter-tool-btn ${tool === 'restore' ? 'active' : ''}`}
            onClick={() => { setTool('restore'); setSelectedIslandId(null); setMarquee(null); setLassoPoints([]) }}
            title="Khôi phục: Quét chuột để lấy lại pixel gốc nguyên bản"
          >
            Khôi phục
          </button>
        </div>

        {/* Extra sub-controls depending on active tool */}
        {(tool === 'eraser' || tool === 'restore') && (
          <div className="layer-cutter-control-row" style={{ marginLeft: 6 }}>
            <span>Cỡ cọ:</span>
            <input
              type="range"
              min={4}
              max={60}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
            />
            <span>{brushRadius}px</span>
          </div>
        )}

        {tool === 'auto' && (
          <div className="layer-cutter-control-row" style={{ marginLeft: 6 }}>
            <span>Lọc hạt &lt;</span>
            <input
              type="range"
              min={40}
              max={400}
              step={10}
              value={minIslandArea}
              onChange={(e) => setMinIslandArea(Number(e.target.value))}
              title="Kích thước pixel tối thiểu để xem là một bộ phận"
            />
            <span>{minIslandArea}px</span>
          </div>
        )}
      </div>

      {/* Main Canvas View */}
      <div className={`layer-cutter-canvas-wrap bg-${chroma.previewBackground}`}>
        <div className="layer-cutter-source-canvas-box">
          <canvas
            ref={procCanvasRef}
            className="layer-cutter-canvas"
            style={{
              cursor: isPickingColor
                ? 'crosshair'
                : tool === 'eraser' || tool === 'restore'
                ? 'cell'
                : tool === 'box' || tool === 'lasso'
                ? 'crosshair'
                : 'default'
            }}

            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
          />

          {/* Render Detected Islands (Auto Mode) */}
          {tool === 'auto' &&
            islands.map((isl) => {
              const isSelected = selectedIslandId === isl.id
              const canvas = procCanvasRef.current
              if (!canvas) return null
              const scaleX = canvas.clientWidth / canvas.width
              const scaleY = canvas.clientHeight / canvas.height

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
                    width: `${isl.width * scaleX}px`,
                    height: `${isl.height * scaleY}px`
                  }}
                  title="Click để chọn · Kéo thả sang phải để gán vào bố cục 2D"
                >
                  <span className="layer-cutter-island-tag">{isl.label}</span>
                </div>
              )
            })}

          {/* Render Manual Box Marquee */}
          {tool === 'box' && marquee && procCanvasRef.current && (
            <div
              className="layer-cutter-marquee"
              style={{
                left: `${(Math.min(marquee.startX, marquee.currentX) * procCanvasRef.current.clientWidth) / procCanvasRef.current.width}px`,
                top: `${(Math.min(marquee.startY, marquee.currentY) * procCanvasRef.current.clientHeight) / procCanvasRef.current.height}px`,
                width: `${(Math.abs(marquee.currentX - marquee.startX) * procCanvasRef.current.clientWidth) / procCanvasRef.current.width}px`,
                height: `${(Math.abs(marquee.currentY - marquee.startY) * procCanvasRef.current.clientHeight) / procCanvasRef.current.height}px`
              }}
            />
          )}

          {/* Render Lasso Path Overlay */}
          {tool === 'lasso' && lassoPoints.length >= 2 && procCanvasRef.current && (
            <svg className="layer-cutter-lasso-svg">
              <polyline
                points={lassoPoints
                  .map(
                    (p) =>
                      `${(p.x * procCanvasRef.current!.clientWidth) / procCanvasRef.current!.width},${(p.y * procCanvasRef.current!.clientHeight) / procCanvasRef.current!.height}`
                  )
                  .join(' ')}
                fill="rgba(251, 191, 36, 0.2)"
                stroke="var(--key)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="layer-cutter-footer">
        <div>
          {selectedPiece ? (
            <span>
              <strong>Đang chọn:</strong> {selectedPiece.label} ({selectedPiece.width}×{selectedPiece.height}px)
            </span>
          ) : (
            <span style={{ color: 'var(--text-faint)' }}>Chưa chọn mảnh nào. Click vào mảnh hoặc vẽ khung để chọn.</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="layer-cutter-footer-hint">
            Kéo thả sang phải hoặc <kbd>Ctrl+C</kbd> rồi <kbd>Ctrl+V</kbd>
          </span>
          <button
            type="button"
            className="btn sm"
            disabled={!selectedPiece}
            onClick={handleCopyPiece}
            title="Sao chép mảnh đã chọn (Ctrl+C)"
          >
            {copiedBadge ? <><IconCheck width={12} height={12} /> Đã chép!</> : 'Sao chép (Ctrl+C)'}
          </button>
          <button
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
