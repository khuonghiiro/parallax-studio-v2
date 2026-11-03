import React, { useEffect, useRef, useState } from 'react'
import { toast } from '../../actions'
import { IconGrid, IconLightning, IconScissors } from '../icons'
import { LoopChromaControls } from './LoopChromaControls'
import { LoopSlicerControls } from './LoopSlicerControls'
import { LoopSourceEmptyState } from './LoopSourceEmptyState'
import {
  applyChromaKeyToImageData,
  clearGridBorderPadding,
  detectCornerKeyColor
} from './loopFrameExtractor'
import {
  clearLoopSourceCanvasMeta,
  getLoopSourceLogicalSize,
  getRegisteredMemoryCanvas,
  MAX_LOOP_SOURCE_WORK_DIM,
  scaleGridConfigForWorkCanvas,
  setLoopSourceCanvasMeta
} from './loopSourceProxy'
import { loadLoopImageFile, loadLoopImageFiles } from './loopAnimatorLauncher'
import { useLoopAnimator } from './loopAnimatorState'
import { resolveLoopAssetUrl } from './sampleLoops'
import { useContainFitSize } from './useContainFit'
import type {
  ChromaKeyConfig,
  GridSlicerConfig,
  LoopAnimationTemplate,
  LoopFrameBox,
  SlicerMode
} from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
  onRequestUpload: () => void
  templates: LoopAnimationTemplate[]
}

const MODES: { id: SlicerMode; label: string; icon: React.ReactElement; title: string }[] = [
  { id: 'grid', label: 'Lưới đều', icon: <IconGrid width={12} height={12} />, title: 'Chia ảnh thành lưới hàng × cột bằng nhau' },
  { id: 'contour', label: 'Tự dò vùng', icon: <IconLightning width={12} height={12} />, title: 'Tự dò từng chi tiết tách biệt trong ảnh' },
  { id: 'manual', label: 'Kéo tay', icon: <IconScissors width={12} height={12} />, title: 'Tự kéo / chỉnh từng khung cắt' }
]

function drawFrameOverlay(
  ctx: CanvasRenderingContext2D,
  frames: LoopFrameBox[],
  selected: number,
  playing: number,
  isPlaying: boolean,
  slicerMode: SlicerMode,
  borderPadding: number,
  sx = 1,
  sy = 1
): void {
  const sUniform = (sx + sy) * 0.5
  const pad = slicerMode === 'grid' ? Math.max(0, Math.round(borderPadding * sUniform)) : 0
  frames.forEach((f, idx) => {
    const fx = Math.round(f.x * sx)
    const fy = Math.round(f.y * sy)
    const fw = Math.max(1, Math.round(f.width * sx))
    const fh = Math.max(1, Math.round(f.height * sy))
    const isSelected = idx === selected
    const isCursor = isPlaying && idx === playing
    ctx.save()
    if (pad > 0) {
      // Vẽ dải viền lưới mở rộng theo đúng độ dày Padding viền đã cắt bỏ
      ctx.strokeStyle = isSelected
        ? 'rgba(245, 158, 11, 0.38)'
        : 'rgba(56, 189, 248, 0.28)'
      ctx.lineWidth = pad
      ctx.strokeRect(
        fx - pad * 0.5,
        fy - pad * 0.5,
        fw + pad,
        fh + pad
      )
    }
    if (!f.enabled) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)'
      ctx.fillRect(fx, fy, fw, fh)
      ctx.setLineDash([6, 6])
    }
    const color = isSelected ? '#f59e0b' : isCursor ? '#22c55e' : f.enabled ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.4)'
    ctx.strokeStyle = color
    ctx.lineWidth = isSelected || isCursor ? 3 : 2
    ctx.strokeRect(fx + 1, fy + 1, Math.max(1, fw - 2), Math.max(1, fh - 2))
    ctx.fillStyle = isSelected || isCursor ? color : f.enabled ? 'rgba(15, 23, 42, 0.85)' : 'rgba(51, 65, 85, 0.7)'
    ctx.fillRect(fx + 2, fy + 2, 34, 22)
    ctx.fillStyle = isSelected || isCursor ? '#0f172a' : '#f8fafc'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText(`#${idx + 1}`, fx + 6, fy + 17)
    ctx.restore()
  })
}

function getSourceNaturalSize(src: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  if ('naturalWidth' in src) {
    return { w: src.naturalWidth || src.width || 1024, h: src.naturalHeight || src.height || 1024 }
  }
  return { w: src.width || 1024, h: src.height || 1024 }
}

export function LoopAnimatorSourcePane({ sourceCanvasRef, onRequestUpload, templates }: Props): React.ReactElement {
  const sourceImageUrl = useLoopAnimator((s) => s.sourceImageUrl)
  const sourceWidth = useLoopAnimator((s) => s.sourceWidth)
  const sourceHeight = useLoopAnimator((s) => s.sourceHeight)
  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const chromaKey = useLoopAnimator((s) => s.chromaKey)
  const frames = useLoopAnimator((s) => s.frames)
  const selectedFrameIndex = useLoopAnimator((s) => s.selectedFrameIndex)
  const focusedFrameIndex = useLoopAnimator((s) => s.focusedFrameIndex)
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const isPlaying = useLoopAnimator((s) => s.playback.isPlaying)
  const setSourceDimensions = useLoopAnimator((s) => s.setSourceDimensions)
  const bumpSourceVersion = useLoopAnimator((s) => s.bumpSourceVersion)
  const setSlicerMode = useLoopAnimator((s) => s.setSlicerMode)
  const runContourSlicer = useLoopAnimator((s) => s.runContourSlicer)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const clearFocusedFrame = useLoopAnimator((s) => s.clearFocusedFrame)
  const updateFrame = useLoopAnimator((s) => s.updateFrame)

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Hiển thị đúng tỉ lệ ảnh gốc (contain-fit), không bóp méo để xem trước khớp với lúc tách
  const fit = useContainFitSize(scrollRef, sourceWidth, sourceHeight)
  const rawImageRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null)
  /** Bộ đệm ImageData gốc đã thu nhỏ xuống kích thước proxy (<= 1280px) để kéo thanh trượt Chroma Key tức thì không phải đọc lại GPU 4K */
  const baseWorkDataRef = useRef<ImageData | null>(null)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [zoom, setZoom] = useState(1)
  const dragBoxRef = useRef<{ frameIdx: number; startX: number; startY: number; origX: number; origY: number } | null>(null)

  function drawOverlay(): void {
    const src = sourceCanvasRef.current
    const ov = overlayCanvasRef.current
    if (!src || !ov) return
    if (ov.width !== src.width || ov.height !== src.height) {
      ov.width = src.width
      ov.height = src.height
    }
    const ctx = ov.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ov.width, ov.height)
    const { sx, sy } = getLoopSourceLogicalSize(src)
    drawFrameOverlay(
      ctx,
      frames,
      focusedFrameIndex ?? -1,
      playingFrameIndex,
      isPlaying,
      slicerMode,
      gridConfig.borderPadding ?? 0,
      sx,
      sy
    )
  }

  function renderProcessedSource(
    img: HTMLImageElement | HTMLCanvasElement,
    chroma: ChromaKeyConfig,
    grid: GridSlicerConfig,
    rebuildBaseWork = false
  ): void {
    const canvas = sourceCanvasRef.current
    if (!canvas) return
    const { w: logicalW, h: logicalH } = getSourceNaturalSize(img)
    const workScale = Math.min(1, MAX_LOOP_SOURCE_WORK_DIM / Math.max(1, logicalW, logicalH))
    const workW = Math.max(1, Math.round(logicalW * workScale))
    const workH = Math.max(1, Math.round(logicalH * workScale))
    const sx = workW / Math.max(1, logicalW)
    const sy = workH / Math.max(1, logicalH)

    if (canvas.width !== workW || canvas.height !== workH) {
      canvas.width = workW
      canvas.height = workH
      rebuildBaseWork = true
    }

    setLoopSourceCanvasMeta(canvas, {
      logicalWidth: logicalW,
      logicalHeight: logicalH,
      workScaleX: sx,
      workScaleY: sy,
      rawImage: img,
      chromaKey: chroma,
      gridConfig: grid
    })

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    if (rebuildBaseWork || !baseWorkDataRef.current || baseWorkDataRef.current.width !== workW || baseWorkDataRef.current.height !== workH) {
      ctx.clearRect(0, 0, workW, workH)
      ctx.drawImage(img, 0, 0, workW, workH)
      try {
        baseWorkDataRef.current = ctx.getImageData(0, 0, workW, workH)
      } catch {
        baseWorkDataRef.current = null
      }
    }

    const hasBorderPad = (grid.borderPadding ?? 0) > 0
    if (hasBorderPad || chroma.enabled) {
      const base = baseWorkDataRef.current
      const data = base
        ? new ImageData(new Uint8ClampedArray(base.data), workW, workH)
        : ctx.getImageData(0, 0, workW, workH)
      if (hasBorderPad) {
        clearGridBorderPadding(data, scaleGridConfigForWorkCanvas(grid, sx, sy))
      }
      if (chroma.enabled) {
        applyChromaKeyToImageData(data, chroma)
      }
      ctx.putImageData(data, 0, 0)
    } else if (baseWorkDataRef.current) {
      ctx.putImageData(baseWorkDataRef.current, 0, 0)
    }
    drawOverlay()
  }

  // Nạp ảnh nguồn khi URL đổi; phiên trống → xoá sạch canvas để không còn ảnh cũ
  useEffect(() => {
    if (!sourceImageUrl) {
      rawImageRef.current = null
      baseWorkDataRef.current = null
      clearLoopSourceCanvasMeta(sourceCanvasRef.current)
      for (const c of [sourceCanvasRef.current, overlayCanvasRef.current]) {
        if (c) {
          c.width = 0
          c.height = 0
        }
      }
      bumpSourceVersion()
      return
    }

    const applyLoadedSource = (src: HTMLImageElement | HTMLCanvasElement): void => {
      rawImageRef.current = src
      setZoom(1)
      const { w, h } = getSourceNaturalSize(src)
      setSourceDimensions(w, h)
      const st = useLoopAnimator.getState()
      renderProcessedSource(src, st.chromaKey, st.gridConfig, true)
      if (st.pendingMeshUpgrade) {
        st.alignUpgradedFramesByMesh(sourceCanvasRef.current)
      }
      bumpSourceVersion()
    }

    // Ưu tiên lấy trực tiếp từ bộ nhớ đệm Canvas RAM (khi vừa mở gói 4K hoặc ghép nhiều frame) -> 0ms
    const memCanvas = getRegisteredMemoryCanvas(sourceImageUrl)
    if (memCanvas && memCanvas.width > 0 && memCanvas.height > 0) {
      applyLoadedSource(memCanvas)
      return
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      applyLoadedSource(img)
    }
    img.onerror = () => !cancelled && toast('⚠ Không đọc được ảnh nguồn')
    void resolveLoopAssetUrl(sourceImageUrl).then((resolved) => {
      if (cancelled) return
      const resolvedMem = getRegisteredMemoryCanvas(resolved || sourceImageUrl)
      if (resolvedMem && resolvedMem.width > 0 && resolvedMem.height > 0) {
        applyLoadedSource(resolvedMem)
        return
      }
      img.src = resolved || sourceImageUrl
    })
    return () => {
      cancelled = true
    }
  }, [sourceImageUrl])

  useEffect(() => {
    if (!rawImageRef.current) return
    let rafId = requestAnimationFrame(() => {
      rafId = 0
      if (!rawImageRef.current) return
      renderProcessedSource(rawImageRef.current, chromaKey, gridConfig, false)
      bumpSourceVersion()
    })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [chromaKey, gridConfig.borderPadding, gridConfig.cols, gridConfig.rows, gridConfig.marginX, gridConfig.marginY, gridConfig.paddingX, gridConfig.paddingY])

  useEffect(() => {
    drawOverlay()
  }, [frames, selectedFrameIndex, focusedFrameIndex, playingFrameIndex, isPlaying, slicerMode, gridConfig.borderPadding])

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { px: number; py: number } | null {
    const ov = overlayCanvasRef.current
    const src = sourceCanvasRef.current
    if (!ov) return null
    const rect = ov.getBoundingClientRect()
    const { logicalW, logicalH } = src ? getLoopSourceLogicalSize(src) : { logicalW: ov.width, logicalH: ov.height }
    return {
      px: Math.floor(((e.clientX - rect.left) * Math.max(1, logicalW)) / Math.max(1, rect.width)),
      py: Math.floor(((e.clientY - rect.top) * Math.max(1, logicalH)) / Math.max(1, rect.height))
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void {
    const c = canvasCoords(e)
    if (!c) return
    if (eyedropperActive && rawImageRef.current) {
      const base = baseWorkDataRef.current
      const src = sourceCanvasRef.current
      if (base && src) {
        const { sx, sy } = getLoopSourceLogicalSize(src)
        const wx = Math.max(0, Math.min(base.width - 1, Math.floor(c.px * sx)))
        const wy = Math.max(0, Math.min(base.height - 1, Math.floor(c.py * sy)))
        const off = (wy * base.width + wx) * 4
        const r = base.data[off]
        const g = base.data[off + 1]
        const b = base.data[off + 2]
        setChromaKey({ enabled: true, keyColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` })
      }
      setEyedropperActive(false)
      return
    }
    const hit = frames.findIndex((f) => c.px >= f.x && c.px <= f.x + f.width && c.py >= f.y && c.py <= f.y + f.height)
    if (hit < 0) {
      clearFocusedFrame()
      return
    }
    selectFrame(hit)
    if (slicerMode !== 'grid') {
      dragBoxRef.current = { frameIdx: hit, startX: c.px, startY: c.py, origX: frames[hit].x, origY: frames[hit].y }
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void {
    const drag = dragBoxRef.current
    const c = drag ? canvasCoords(e) : null
    if (!drag || !c) return
    updateFrame(drag.frameIdx, {
      x: Math.max(0, Math.round(drag.origX + c.px - drag.startX)),
      y: Math.max(0, Math.round(drag.origY + c.py - drag.startY))
    })
  }

  function handleAutoDetect(): void {
    const img = rawImageRef.current
    if (!img) return
    const { w: rawW, h: rawH } = getSourceNaturalSize(img)
    const sampleScale = Math.min(1, 512 / Math.max(1, rawW, rawH))
    const sw = Math.max(1, Math.round(rawW * sampleScale))
    const sh = Math.max(1, Math.round(rawH * sampleScale))
    const temp = document.createElement('canvas')
    temp.width = sw
    temp.height = sh
    const ctx = temp.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(img, 0, 0, sw, sh)
    setChromaKey({
      enabled: true,
      keyColor: detectCornerKeyColor(
        ctx,
        sw,
        sh,
        Math.round((gridConfig.borderPadding ?? 0) * sampleScale)
      )
    })
  }

  function handleRunContour(): void {
    const count = runContourSlicer(sourceCanvasRef.current)
    toast(count > 0 ? `⚡ Đã tự dò và tách ${count} khung hình` : '⚠ Không tìm thấy vùng tách biệt. Hãy bật Tách nền trước khi quét.')
  }

  const hasSource = Boolean(sourceImageUrl)

  return (
    <div className="loop-source-pane" data-mcp-region="loop_animator_source">
      <div className="loop-pane-toolbar">
        <div className="loop-pane-heading">
          <span className="loop-step">1</span>
          <span>Cắt khung hình</span>
        </div>
        <div className="la-seg" role="tablist" aria-label="Chế độ cắt khung">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={slicerMode === m.id}
              className={`la-seg-btn${slicerMode === m.id ? ' active' : ''}`}
              disabled={!hasSource}
              title={m.title}
              onClick={() => {
                setSlicerMode(m.id)
                if (m.id === 'contour') handleRunContour()
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="loop-zoom-group" aria-label="Thu phóng ảnh nguồn">
          <button type="button" className="la-icon-btn" disabled={!hasSource} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Thu nhỏ" aria-label="Thu nhỏ">
            −
          </button>
          <button
            type="button"
            className="loop-zoom-val loop-zoom-reset-btn"
            disabled={!hasSource}
            onClick={() => setZoom(1)}
            title="Bấm để vừa khít khung nhìn (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="la-icon-btn" disabled={!hasSource} onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))} title="Phóng to" aria-label="Phóng to">
            +
          </button>
        </div>
      </div>

      {hasSource && (
        <div className="loop-controls-stack">
          <LoopSlicerControls sourceCanvasRef={sourceCanvasRef} onRunContour={handleRunContour} />
          <LoopChromaControls eyedropperActive={eyedropperActive} onToggleEyedropper={() => setEyedropperActive((v) => !v)} onAutoDetect={handleAutoDetect} />
        </div>
      )}

      <div
        className={`loop-source-canvas-scroll${zoom <= 1 ? ' is-fit' : ''}`}
        ref={scrollRef}
        onDragOver={(e) => hasSource && e.preventDefault()}
        onDrop={(e) => {
          if (!hasSource) return
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files ?? []).filter(
            (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
          )
          if (files.length === 1) loadLoopImageFile(files[0])
          else if (files.length > 1) void loadLoopImageFiles(files)
        }}
      >
        {!hasSource && <LoopSourceEmptyState onRequestUpload={onRequestUpload} templates={templates} />}
        <div
          className={`loop-source-canvas-stage${eyedropperActive ? ' eyedropper-cursor' : ''}`}
          hidden={!hasSource}
          style={{
            aspectRatio: `${Math.max(1, sourceWidth)} / ${Math.max(1, sourceHeight)}`,
            ...(fit.width > 0
              ? {
                  width: Math.max(1, Math.round(fit.width * zoom)),
                  height: Math.max(1, Math.round(fit.height * zoom))
                }
              : {})
          }}
        >
          <canvas ref={sourceCanvasRef} className="loop-source-canvas" />
          <canvas
            ref={overlayCanvasRef}
            className="loop-overlay-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => (dragBoxRef.current = null)}
            onMouseLeave={() => (dragBoxRef.current = null)}
          />
        </div>
      </div>
    </div>
  )
}
