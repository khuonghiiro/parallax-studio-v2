import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  IconScissors,
  IconEyedropper,
  IconGrid,
  IconLayers,
  IconFlame
} from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import {
  applyLoopChromaKeyToImageData,
  autoTrimLoopFrameBounds
} from './loopFrameExtractor'
import { resolveLoopAssetUrl } from './sampleLoops'
import type { ChromaKeyColorType, GridOrder } from './types'

export interface LoopAnimatorSourcePaneProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function LoopAnimatorSourcePane({ sourceCanvasRef }: LoopAnimatorSourcePaneProps) {
  const imageUrl = useLoopAnimator((s) => s.imageUrl)
  const frames = useLoopAnimator((s) => s.frames)
  const setFrames = useLoopAnimator((s) => s.setFrames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const setSlicerMode = useLoopAnimator((s) => s.setSlicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const setGridConfig = useLoopAnimator((s) => s.setGridConfig)
  const chromaConfig = useLoopAnimator((s) => s.chromaConfig)
  const setChromaConfig = useLoopAnimator((s) => s.setChromaConfig)
  const autoGenerateGridFrames = useLoopAnimator((s) => s.autoGenerateGridFrames)
  const setImageNaturalSize = useLoopAnimator((s) => s.setImageNaturalSize)

  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isEyedropperActive, setIsEyedropperActive] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Nạp ảnh gốc và chuẩn bị canvas
  useEffect(() => {
    let active = true
    let blobUrlToRevoke: string | null = null

    async function loadImage() {
      if (!imageUrl) return
      let resolvedSrc = imageUrl

      try {
        const url = await resolveLoopAssetUrl(imageUrl)
        if (url && url !== imageUrl) {
          resolvedSrc = url
          if (url.startsWith('blob:')) {
            blobUrlToRevoke = url
          }
        }
      } catch (err) {
        console.warn('[LoopAnimatorSourcePane] Failed to resolve asset URL:', err)
      }

      if (!active) return

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        if (!active) return
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height

        let raw = rawCanvasRef.current
        if (!raw) {
          raw = document.createElement('canvas')
          rawCanvasRef.current = raw
        }
        raw.width = w
        raw.height = h
        const rctx = raw.getContext('2d')
        if (rctx) {
          rctx.drawImage(img, 0, 0)
        }

        setImageNaturalSize({ width: w, height: h })
        setImageLoaded(true)
      }

      img.onerror = () => {
        console.warn('[LoopAnimatorSourcePane] Failed to load image from:', imageUrl, resolvedSrc)
      }

      img.src = resolvedSrc
    }

    loadImage()

    return () => {
      active = false
      if (blobUrlToRevoke) {
        URL.revokeObjectURL(blobUrlToRevoke)
      }
    }
  }, [imageUrl, setImageNaturalSize])

  // Xử lý Chroma Key và vẽ sang sourceCanvasRef
  const processChroma = useCallback(() => {
    const raw = rawCanvasRef.current
    const source = sourceCanvasRef.current
    if (!raw || !source) return

    const w = raw.width
    const h = raw.height
    if (w === 0 || h === 0) return

    source.width = w
    source.height = h

    const sctx = source.getContext('2d')
    const rctx = raw.getContext('2d')
    if (!sctx || !rctx) return

    const rawData = rctx.getImageData(0, 0, w, h)

    if (chromaConfig.enabled) {
      applyLoopChromaKeyToImageData(rawData, chromaConfig)
    }

    sctx.putImageData(rawData, 0, 0)
  }, [chromaConfig, sourceCanvasRef])

  useEffect(() => {
    if (imageLoaded) {
      processChroma()
    }
  }, [imageLoaded, processChroma])

  // Vẽ các đường cắt lưới & nhãn số thứ tự trên overlay
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    const raw = rawCanvasRef.current
    if (!overlay || !raw) return

    const w = raw.width
    const h = raw.height
    overlay.width = w
    overlay.height = h

    const ctx = overlay.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    frames.forEach((f, idx) => {
      const isSelected = f.index === selectedFrameIndex

      // Đường bao khung hình
      ctx.strokeStyle = isSelected
        ? '#38bdf8'
        : f.enabled
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(239, 68, 68, 0.35)'
      ctx.lineWidth = isSelected ? 3 : 1
      ctx.setLineDash(isSelected ? [] : [4, 4])
      ctx.strokeRect(f.x, f.y, f.width, f.height)

      // Nhãn số thứ tự kèm mũi tên chuyển động
      ctx.fillStyle = isSelected
        ? '#0284c7'
        : f.enabled
          ? 'rgba(15, 23, 42, 0.85)'
          : 'rgba(239, 68, 68, 0.85)'
      ctx.fillRect(f.x + 4, f.y + 4, 28, 20)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`#${idx + 1}`, f.x + 18, f.y + 14)

      // Mũi tên chỉ hướng chuyển động (sang phải hoặc xuống dưới)
      if (f.enabled && idx < frames.length - 1) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(f.x + f.width - 12, f.y + f.height / 2)
        ctx.lineTo(f.x + f.width - 4, f.y + f.height / 2)
        ctx.stroke()
      }
    })
  }, [frames, selectedFrameIndex, imageLoaded])

  // Click vào canvas để chọn frame hoặc lấy màu Eyedropper
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return

    const rect = overlay.getBoundingClientRect()
    const scaleX = overlay.width / rect.width
    const scaleY = overlay.height / rect.height
    const cx = Math.round((e.clientX - rect.left) * scaleX)
    const cy = Math.round((e.clientY - rect.top) * scaleY)

    if (isEyedropperActive) {
      const raw = rawCanvasRef.current
      if (raw) {
        const rctx = raw.getContext('2d')
        if (rctx) {
          const p = rctx.getImageData(cx, cy, 1, 1).data
          const hex = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)}`
          setChromaConfig({
            enabled: true,
            keyColorType: 'custom',
            customHex: hex
          })
          setIsEyedropperActive(false)
        }
      }
      return
    }

    // Tìm frame được click trúng
    const hitIdx = frames.findIndex(
      (f) => cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height
    )
    if (hitIdx >= 0) {
      selectFrame(hitIdx)
    }
  }

  // Tự động khử viền trong suốt cho toàn bộ frame
  const handleAutoTrimAll = () => {
    const source = sourceCanvasRef.current
    if (!source) return
    const sctx = source.getContext('2d')
    if (!sctx) return

    const trimmed = frames.map((f) => {
      const b = autoTrimLoopFrameBounds(sctx, f)
      return {
        ...f,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height
      }
    })
    setFrames(trimmed)
  }

  return (
    <div className="loop-source-card" data-mcp-region="loop_animator_toolbar">
      {/* Toolbar chế độ cắt tách & Chroma */}
      <div className="loop-source-toolbar">
        <div className="loop-toolbar-group">
          <span className="loop-toolbar-label">Chế độ tách:</span>
          <button
            type="button"
            className={`btn sm ghost${slicerMode === 'grid' ? ' active' : ''}`}
            onClick={() => setSlicerMode('grid')}
            title="Tách theo lưới ma trận số hàng và số cột đều nhau"
          >
            <IconGrid width={13} height={13} />
            <span>Tách lưới ({gridConfig.rows}×{gridConfig.cols})</span>
          </button>
          <button
            type="button"
            className={`btn sm ghost${slicerMode === 'contour' ? ' active' : ''}`}
            onClick={() => setSlicerMode('contour')}
            title="Tách theo cụm chi tiết hoặc đảo pixel có biên trong suốt"
          >
            <IconLayers width={13} height={13} />
            <span>Tách chi tiết</span>
          </button>
        </div>

        <div className="loop-toolbar-divider" />

        {/* Nút bật/tắt Chroma Key */}
        <div className="loop-toolbar-group">
          <button
            type="button"
            className={`btn sm ${chromaConfig.enabled ? 'accent' : 'ghost'}`}
            onClick={() => setChromaConfig({ enabled: !chromaConfig.enabled })}
            title="Bật/Tắt tách nền tự động (Chroma Key)"
          >
            <IconScissors width={13} height={13} />
            <span>{chromaConfig.enabled ? 'Đang tách nền' : 'Tách nền'}</span>
          </button>
        </div>

        <div className="loop-toolbar-divider" />

        {/* Nút Khử viền trong suốt */}
        <div className="loop-toolbar-group">
          <button
            type="button"
            className="btn sm ghost"
            onClick={handleAutoTrimAll}
            title="Tự động thu hẹp bounding box bám sát phần hình ảnh của từng frame"
          >
            <span>Khử viền thừa</span>
          </button>
        </div>
      </div>

      {/* Thanh cấu hình Lưới (Grid Settings) */}
      {slicerMode === 'grid' && (
        <div className="loop-grid-bar">
          <div className="loop-param-item">
            <span className="loop-param-label">Hàng:</span>
            <input
              type="number"
              min={1}
              max={16}
              value={gridConfig.rows}
              onChange={(e) => setGridConfig({ rows: Math.max(1, Number(e.target.value)) })}
              className="loop-number-input"
            />
          </div>
          <div className="loop-param-item">
            <span className="loop-param-label">Cột:</span>
            <input
              type="number"
              min={1}
              max={16}
              value={gridConfig.cols}
              onChange={(e) => setGridConfig({ cols: Math.max(1, Number(e.target.value)) })}
              className="loop-number-input"
            />
          </div>
          <div className="loop-param-item">
            <span className="loop-param-label">Lùi biên (px):</span>
            <input
              type="number"
              min={0}
              max={40}
              value={gridConfig.paddingInset}
              onChange={(e) => setGridConfig({ paddingInset: Math.max(0, Number(e.target.value)) })}
              className="loop-number-input"
            />
          </div>
          <div className="loop-param-item">
            <span className="loop-param-label">Thứ tự:</span>
            <div className="loop-mode-segmented">
              {(
                [
                  { id: 'row_first', label: 'Trái qua phải (Hàng)' },
                  { id: 'col_first', label: 'Trên xuống dưới (Cột)' }
                ] as { id: GridOrder; label: string }[]
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`loop-mode-btn${gridConfig.order === o.id ? ' active' : ''}`}
                  onClick={() => setGridConfig({ order: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => autoGenerateGridFrames()}
            title="Phân chia lại lưới theo số hàng/cột mới"
          >
            Tách lại
          </button>
        </div>
      )}

      {/* Thanh cấu hình Tách nền Chroma Key */}
      {chromaConfig.enabled && (
        <div className="loop-chroma-bar" data-mcp-region="loop_animator_chroma">
          <div className="loop-chroma-colors">
            <span className="loop-param-label">Màu nền:</span>
            {(
              [
                { id: 'chroma_magenta', label: 'Hồng Magenta', color: '#ff00ff' },
                { id: 'chroma_green', label: 'Xanh lá Green', color: '#00ff00' },
                { id: 'chroma_blue', label: 'Xanh dương Blue', color: '#0000ff' },
                { id: 'white', label: 'Trắng', color: '#ffffff' },
                { id: 'black', label: 'Đen', color: '#000000' }
              ] as { id: ChromaKeyColorType; label: string; color: string }[]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`loop-color-chip${chromaConfig.keyColorType === c.id ? ' active' : ''}`}
                style={{ backgroundColor: c.color }}
                title={c.label}
                onClick={() => setChromaConfig({ keyColorType: c.id })}
              />
            ))}

            {/* Nút hút màu Eyedropper */}
            <button
              type="button"
              className={`btn sm ghost${isEyedropperActive ? ' active' : ''}`}
              title="Chấm vào ảnh để hút màu nền cần khử"
              onClick={() => setIsEyedropperActive(!isEyedropperActive)}
            >
              <IconEyedropper width={13} height={13} />
              <span>{isEyedropperActive ? 'Đang chấm màu…' : 'Hút màu'}</span>
            </button>
          </div>

          <div className="loop-chroma-sliders">
            <div className="loop-param-slider">
              <span className="loop-param-label">Độ lệch: {chromaConfig.tolerance}</span>
              <input
                type="range"
                min={1}
                max={100}
                value={chromaConfig.tolerance}
                onChange={(e) => setChromaConfig({ tolerance: Number(e.target.value) })}
              />
            </div>
            <div className="loop-param-slider">
              <span className="loop-param-label">Làm mịn: {chromaConfig.smoothness}</span>
              <input
                type="range"
                min={0}
                max={40}
                value={chromaConfig.smoothness}
                onChange={(e) => setChromaConfig({ smoothness: Number(e.target.value) })}
              />
            </div>
            <div className="loop-param-slider">
              <span className="loop-param-label">Khử ám: {chromaConfig.despill}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={chromaConfig.despill}
                onChange={(e) => setChromaConfig({ despill: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Vùng hiển thị Canvas Ảnh gốc & Lưới cắt */}
      <div
        className={`loop-source-viewport${isEyedropperActive ? ' cursor-crosshair' : ''}`}
        onClick={handleCanvasClick}
      >
        <canvas ref={sourceCanvasRef} className="loop-source-canvas" />
        <canvas ref={overlayCanvasRef} className="loop-overlay-canvas" />
      </div>
    </div>
  )
}
