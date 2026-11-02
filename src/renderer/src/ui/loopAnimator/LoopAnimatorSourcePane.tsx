import React, { useEffect, useRef, useState } from 'react'
import { toast } from '../../actions'
import { applyChromaKeyToImageData, detectCornerKeyColor } from './loopFrameExtractor'
import { resolveLoopAssetUrl } from './sampleLoops'
import { useLoopAnimator } from './loopAnimatorState'
import type { SlicerMode } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function LoopAnimatorSourcePane({ sourceCanvasRef }: Props): React.ReactElement {
  const sourceImageUrl = useLoopAnimator((s) => s.sourceImageUrl)
  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const contourConfig = useLoopAnimator((s) => s.contourConfig)
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const isPlaying = useLoopAnimator((s) => s.playback.isPlaying)
  const setSourceDimensions = useLoopAnimator((s) => s.setSourceDimensions)
  const bumpSourceVersion = useLoopAnimator((s) => s.bumpSourceVersion)
  const setSlicerMode = useLoopAnimator((s) => s.setSlicerMode)
  const setGridConfig = useLoopAnimator((s) => s.setGridConfig)
  const setContourConfig = useLoopAnimator((s) => s.setContourConfig)
  const runContourSlicer = useLoopAnimator((s) => s.runContourSlicer)
  const autoCenterFrames = useLoopAnimator((s) => s.autoCenterFrames)
  const equalizeFrameSizes = useLoopAnimator((s) => s.equalizeFrameSizes)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const updateFrame = useLoopAnimator((s) => s.updateFrame)
  const loadCustomImage = useLoopAnimator((s) => s.loadCustomImage)

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawImageRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [zoom, setZoom] = useState(1)
  const dragBoxRef = useRef<{
    frameIdx: number
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Load source image when URL changes
  useEffect(() => {
    if (!sourceImageUrl) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      rawImageRef.current = img
      const w = img.naturalWidth || img.width || 1024
      const h = img.naturalHeight || img.height || 1024
      setSourceDimensions(w, h)
      renderProcessedSource(img, chromaKey)
      bumpSourceVersion()
    }
    void resolveLoopAssetUrl(sourceImageUrl).then((resolved) => {
      if (!cancelled) img.src = resolved || sourceImageUrl
    })
    return () => {
      cancelled = true
    }
  }, [sourceImageUrl])

  // Re-apply chroma key whenever settings change
  useEffect(() => {
    if (!rawImageRef.current) return
    renderProcessedSource(rawImageRef.current, chromaKey)
    bumpSourceVersion()
  }, [chromaKey])

  // Redraw grid & bounding boxes overlay when frames or selection change
  useEffect(() => {
    drawOverlay()
  }, [frames, selectedFrameIndex, playingFrameIndex, isPlaying, slicerMode, gridConfig])

  function renderProcessedSource(img: HTMLImageElement, chroma: typeof chromaKey): void {
    const canvas = sourceCanvasRef.current
    if (!canvas) return
    const w = img.naturalWidth || img.width || 1024
    const h = img.naturalHeight || img.height || 1024
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    if (chroma.enabled) {
      const imgData = ctx.getImageData(0, 0, w, h)
      applyChromaKeyToImageData(imgData, chroma)
      ctx.putImageData(imgData, 0, 0)
    }
    drawOverlay()
  }

  function drawOverlay(): void {
    const srcCanvas = sourceCanvasRef.current
    const ovCanvas = overlayCanvasRef.current
    if (!srcCanvas || !ovCanvas) return
    if (ovCanvas.width !== srcCanvas.width || ovCanvas.height !== srcCanvas.height) {
      ovCanvas.width = srcCanvas.width
      ovCanvas.height = srcCanvas.height
    }
    const ctx = ovCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ovCanvas.width, ovCanvas.height)

    frames.forEach((f, idx) => {
      const isSelected = idx === selectedFrameIndex
      const isPlayingCursor = isPlaying && idx === playingFrameIndex
      ctx.save()
      if (!f.enabled) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)'
        ctx.fillRect(f.x, f.y, f.width, f.height)
      }
      ctx.strokeStyle = isSelected
        ? '#f59e0b'
        : isPlayingCursor
          ? '#22c55e'
          : f.enabled
            ? 'rgba(56, 189, 248, 0.85)'
            : 'rgba(148, 163, 184, 0.4)'
      ctx.lineWidth = isSelected || isPlayingCursor ? 4 : 2
      if (!f.enabled) ctx.setLineDash([6, 6])
      ctx.strokeRect(f.x + 1, f.y + 1, Math.max(1, f.width - 2), Math.max(1, f.height - 2))

      // Badge number in corner
      const tagW = 34
      const tagH = 22
      ctx.fillStyle = isSelected
        ? '#f59e0b'
        : isPlayingCursor
          ? '#22c55e'
          : f.enabled
            ? 'rgba(15, 23, 42, 0.85)'
            : 'rgba(51, 65, 85, 0.7)'
      ctx.fillRect(f.x + 2, f.y + 2, tagW, tagH)
      ctx.fillStyle = isSelected || isPlayingCursor ? '#0f172a' : '#f8fafc'
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      ctx.fillText(`#${idx + 1}`, f.x + 6, f.y + 17)
      ctx.restore()
    })
  }

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { px: number; py: number } | null {
    const ovCanvas = overlayCanvasRef.current
    if (!ovCanvas) return null
    const rect = ovCanvas.getBoundingClientRect()
    const scaleX = ovCanvas.width / Math.max(1, rect.width)
    const scaleY = ovCanvas.height / Math.max(1, rect.height)
    return {
      px: Math.floor((e.clientX - rect.left) * scaleX),
      py: Math.floor((e.clientY - rect.top) * scaleY)
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void {
    const coords = getCanvasCoords(e)
    if (!coords) return
    const { px, py } = coords

    if (eyedropperActive && rawImageRef.current) {
      const temp = document.createElement('canvas')
      temp.width = rawImageRef.current.naturalWidth || 1024
      temp.height = rawImageRef.current.naturalHeight || 1024
      const tctx = temp.getContext('2d')
      if (tctx) {
        tctx.drawImage(rawImageRef.current, 0, 0)
        const d = tctx.getImageData(px, py, 1, 1).data
        const hex = `#${d[0].toString(16).padStart(2, '0')}${d[1].toString(16).padStart(2, '0')}${d[2].toString(16).padStart(2, '0')}`
        setChromaKey({ enabled: true, keyColor: hex })
      }
      setEyedropperActive(false)
      return
    }

    const hitIndex = frames.findIndex(
      (f) => px >= f.x && px <= f.x + f.width && py >= f.y && py <= f.y + f.height
    )
    if (hitIndex >= 0) {
      selectFrame(hitIndex)
      if (slicerMode === 'manual' || slicerMode === 'contour') {
        const target = frames[hitIndex]
        dragBoxRef.current = {
          frameIdx: hitIndex,
          startX: px,
          startY: py,
          origX: target.x,
          origY: target.y
        }
      }
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void {
    const drag = dragBoxRef.current
    if (!drag) return
    const coords = getCanvasCoords(e)
    if (!coords) return
    const dx = coords.px - drag.startX
    const dy = coords.py - drag.startY
    updateFrame(drag.frameIdx, {
      x: Math.max(0, Math.round(drag.origX + dx)),
      y: Math.max(0, Math.round(drag.origY + dy))
    })
  }

  function handleCanvasMouseUp(): void {
    dragBoxRef.current = null
  }

  function handleAutoDetectKeyColor(): void {
    if (!rawImageRef.current) return
    const temp = document.createElement('canvas')
    const w = rawImageRef.current.naturalWidth || 1024
    const h = rawImageRef.current.naturalHeight || 1024
    temp.width = w
    temp.height = h
    const tctx = temp.getContext('2d')
    if (!tctx) return
    tctx.drawImage(rawImageRef.current, 0, 0)
    const hex = detectCornerKeyColor(tctx, w, h)
    setChromaKey({ enabled: true, keyColor: hex })
  }

  function handleRunContourScan(): void {
    const count = runContourSlicer(sourceCanvasRef.current)
    if (count > 0) {
      toast(`⚡ Đã tự động quét và tách ${count} khung hình theo vùng viền!`)
    } else {
      toast('⚠ Không tìm thấy vùng chi tiết tách biệt. Hãy bật Tách nền Chroma Key trước khi quét.')
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadCustomImage(reader.result, file.name)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const MODES: { id: SlicerMode; label: string; icon: string }[] = [
    { id: 'grid', label: 'Lưới đều (Grid)', icon: '⊞' },
    { id: 'contour', label: 'Tự dò vùng (Contour)', icon: '⚡' },
    { id: 'manual', label: 'Kéo khung tay', icon: '✂' }
  ]

  return (
    <div className="loop-source-pane" data-mcp-region="loop_animator_source">
      <div className="loop-pane-toolbar">
        <div className="loop-mode-pills" role="tablist" aria-label="Chế độ cắt khung">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`loop-mode-pill ${slicerMode === m.id ? 'active' : ''}`}
              onClick={() => {
                setSlicerMode(m.id)
                if (m.id === 'contour') {
                  handleRunContourScan()
                }
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="loop-source-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => fileInputRef.current?.click()}
            title="Tải ảnh Sprite Sheet từ máy tính"
          >
            📂 Tải ảnh Sheet
          </button>
          <div className="loop-zoom-group">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            >
              −
            </button>
            <span className="loop-zoom-val">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Grid Controls */}
      {slicerMode === 'grid' && (
        <div className="loop-grid-controls">
          <div className="loop-ctrl-field">
            <label>Số cột (Cols)</label>
            <input
              type="number"
              min={1}
              max={16}
              value={gridConfig.cols}
              onChange={(e) => setGridConfig({ cols: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Số hàng (Rows)</label>
            <input
              type="number"
              min={1}
              max={16}
              value={gridConfig.rows}
              onChange={(e) => setGridConfig({ rows: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Lề X (px)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={gridConfig.marginX}
              onChange={(e) => setGridConfig({ marginX: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Lề Y (px)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={gridConfig.marginY}
              onChange={(e) => setGridConfig({ marginY: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Khe X (px)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={gridConfig.paddingX}
              onChange={(e) => setGridConfig({ paddingX: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Khe Y (px)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={gridConfig.paddingY}
              onChange={(e) => setGridConfig({ paddingY: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </div>
      )}

      {/* Contour Auto-Island Controls */}
      {slicerMode === 'contour' && (
        <div className="loop-grid-controls loop-contour-controls">
          <div className="loop-ctrl-field">
            <label>Ngưỡng Alpha</label>
            <input
              type="number"
              min={1}
              max={250}
              value={contourConfig.alphaThreshold}
              onChange={(e) => setContourConfig({ alphaThreshold: Math.max(1, Number(e.target.value) || 24) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Gộp mảnh (px)</label>
            <input
              type="number"
              min={0}
              max={64}
              value={contourConfig.mergeGap}
              onChange={(e) => setContourConfig({ mergeGap: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Diện tích tối thiểu</label>
            <input
              type="number"
              min={16}
              max={5000}
              step={50}
              value={contourConfig.minArea}
              onChange={(e) => setContourConfig({ minArea: Math.max(16, Number(e.target.value) || 180) })}
            />
          </div>
          <div className="loop-ctrl-field">
            <label>Điểm neo sàn</label>
            <div className="loop-mini-pills">
              <button
                type="button"
                className={`loop-mini-pill ${(contourConfig.alignAnchor ?? 'bottom') === 'bottom' ? 'active' : ''}`}
                onClick={() => setContourConfig({ alignAnchor: 'bottom' })}
                title="Căn đáy sàn - Cố định chân đế hoạt ảnh"
              >
                ⚓ Đáy
              </button>
              <button
                type="button"
                className={`loop-mini-pill ${contourConfig.alignAnchor === 'center' ? 'active' : ''}`}
                onClick={() => setContourConfig({ alignAnchor: 'center' })}
                title="Căn tâm giữa - Thích hợp phép thuật, vật thể bay"
              >
                🎯 Tâm
              </button>
            </div>
          </div>
          <div className="loop-ctrl-field">
            <label>Thứ tự quét</label>
            <div className="loop-mini-pills">
              <button
                type="button"
                className={`loop-mini-pill ${(contourConfig.readingOrder ?? 'row_first') === 'row_first' ? 'active' : ''}`}
                onClick={() => setContourConfig({ readingOrder: 'row_first' })}
                title="Hàng ngang: Trái qua phải, trên xuống dưới"
              >
                Z Hàng
              </button>
              <button
                type="button"
                className={`loop-mini-pill ${contourConfig.readingOrder === 'snake' ? 'active' : ''}`}
                onClick={() => setContourConfig({ readingOrder: 'snake' })}
                title="Zic-zắc: Hàng 1 trái qua phải, hàng 2 phải qua trái"
              >
                S Rắn
              </button>
              <button
                type="button"
                className={`loop-mini-pill ${contourConfig.readingOrder === 'col_first' ? 'active' : ''}`}
                onClick={() => setContourConfig({ readingOrder: 'col_first' })}
                title="Cột dọc: Trên xuống dưới, trái qua phải"
              >
                N Cột
              </button>
            </div>
          </div>
          <label className="loop-checkbox-label" title="Đồng bộ kích thước tất cả khung hình theo kích thước chuẩn để loại bỏ hoàn toàn nhịp đập co giãn">
            <input
              type="checkbox"
              checked={contourConfig.uniformSize ?? true}
              onChange={(e) => setContourConfig({ uniformSize: e.target.checked })}
            />
            <span>Đồng bộ cỡ khung</span>
          </label>
          <div className="loop-contour-btns">
            <button
              type="button"
              className="btn primary sm"
              onClick={handleRunContourScan}
              title="Quét tự động các đảo pixel không trong suốt để đóng khung từng frame"
            >
              ⚡ Quét tách
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                equalizeFrameSizes()
                toast('📏 Đã đồng bộ kích thước khung hình chuẩn!')
              }}
              title="Đồng bộ kích thước tất cả khung hình hiện tại theo chiều rộng/cao tối đa"
            >
              📏 Đồng bộ cỡ
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                autoCenterFrames(sourceCanvasRef.current)
                toast('🎯 Đã tự động căn tâm và đáy sàn chống nảy cho tất cả frame!')
              }}
              title="Căn chỉnh tâm trọng lượng và đáy sàn của từng frame để hoạt ảnh không bị lệch"
            >
              🎯 Căn chân
            </button>
          </div>
        </div>
      )}

      {/* Manual Slicer Hint */}
      {slicerMode === 'manual' && (
        <div className="loop-manual-hint-bar">
          <span>✂ Click và kéo trực tiếp từng ô trên ảnh để di chuyển vùng cắt, hoặc chỉnh tọa độ X/Y/W/H ở thanh dưới.</span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              autoCenterFrames(sourceCanvasRef.current)
              toast('🎯 Đã căn tâm tự động cho các frame!')
            }}
          >
            🎯 Căn tâm tự động
          </button>
        </div>
      )}

      {/* Chroma Key Controls */}
      <div className="loop-chroma-bar">
        <label className="loop-chroma-toggle">
          <input
            type="checkbox"
            checked={chromaKey.enabled}
            onChange={(e) => setChromaKey({ enabled: e.target.checked })}
          />
          <span>🎨 Tách nền Chroma Key</span>
        </label>

        {chromaKey.enabled && (
          <>
            <div className="loop-color-picker-group">
              <input
                type="color"
                value={chromaKey.keyColor}
                onChange={(e) => setChromaKey({ keyColor: e.target.value })}
                title="Màu nền cần xóa"
              />
              <button
                type="button"
                className={`btn ghost sm ${eyedropperActive ? 'active' : ''}`}
                onClick={() => setEyedropperActive((v) => !v)}
                title="Chấm màu trực tiếp trên ảnh gốc"
              >
                💧 Chấm màu
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={handleAutoDetectKeyColor}
                title="Tự động nhận diện màu nền ở 4 góc ảnh"
              >
                🪄 Tự nhận nền
              </button>
            </div>

            <div className="loop-slider-inline">
              <span>Độ nhạy ({Math.round(chromaKey.similarity * 100)}%)</span>
              <input
                type="range"
                min={0.05}
                max={0.75}
                step={0.01}
                value={chromaKey.similarity}
                onChange={(e) => setChromaKey({ similarity: Number(e.target.value) })}
              />
            </div>

            <div className="loop-slider-inline">
              <span>Mềm biên ({Math.round(chromaKey.smoothness * 100)}%)</span>
              <input
                type="range"
                min={0.01}
                max={0.35}
                step={0.01}
                value={chromaKey.smoothness}
                onChange={(e) => setChromaKey({ smoothness: Number(e.target.value) })}
              />
            </div>

            <div className="loop-slider-inline">
              <span>Khử ám xanh ({Math.round(chromaKey.spill * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={chromaKey.spill}
                onChange={(e) => setChromaKey({ spill: Number(e.target.value) })}
              />
            </div>
          </>
        )}
      </div>

      {/* Canvas Viewport */}
      <div className="loop-source-canvas-scroll">
        <div
          className={`loop-source-canvas-stage ${eyedropperActive ? 'eyedropper-cursor' : ''}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          <canvas ref={sourceCanvasRef} className="loop-source-canvas" />
          <canvas
            ref={overlayCanvasRef}
            className="loop-overlay-canvas"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </div>
    </div>
  )
}
