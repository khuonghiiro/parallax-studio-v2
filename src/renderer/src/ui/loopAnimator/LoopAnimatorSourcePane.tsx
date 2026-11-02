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
import { loadLoopImageFile } from './loopAnimatorLauncher'
import { useLoopAnimator } from './loopAnimatorState'
import { resolveLoopAssetUrl } from './sampleLoops'
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
  borderPadding: number
): void {
  const pad = slicerMode === 'grid' ? Math.max(0, Math.round(borderPadding)) : 0
  frames.forEach((f, idx) => {
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
        f.x - pad * 0.5,
        f.y - pad * 0.5,
        f.width + pad,
        f.height + pad
      )
    }
    if (!f.enabled) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)'
      ctx.fillRect(f.x, f.y, f.width, f.height)
      ctx.setLineDash([6, 6])
    }
    const color = isSelected ? '#f59e0b' : isCursor ? '#22c55e' : f.enabled ? 'rgba(56, 189, 248, 0.85)' : 'rgba(148, 163, 184, 0.4)'
    ctx.strokeStyle = color
    ctx.lineWidth = isSelected || isCursor ? 4 : 2
    ctx.strokeRect(f.x + 1, f.y + 1, Math.max(1, f.width - 2), Math.max(1, f.height - 2))
    ctx.fillStyle = isSelected || isCursor ? color : f.enabled ? 'rgba(15, 23, 42, 0.85)' : 'rgba(51, 65, 85, 0.7)'
    ctx.fillRect(f.x + 2, f.y + 2, 34, 22)
    ctx.fillStyle = isSelected || isCursor ? '#0f172a' : '#f8fafc'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText(`#${idx + 1}`, f.x + 6, f.y + 17)
    ctx.restore()
  })
}

function readRawImage(img: HTMLImageElement): CanvasRenderingContext2D | null {
  const temp = document.createElement('canvas')
  temp.width = img.naturalWidth || 1024
  temp.height = img.naturalHeight || 1024
  const ctx = temp.getContext('2d', { willReadFrequently: true })
  ctx?.drawImage(img, 0, 0)
  return ctx
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
  const playingFrameIndex = useLoopAnimator((s) => s.playingFrameIndex)
  const isPlaying = useLoopAnimator((s) => s.playback.isPlaying)
  const setSourceDimensions = useLoopAnimator((s) => s.setSourceDimensions)
  const bumpSourceVersion = useLoopAnimator((s) => s.bumpSourceVersion)
  const setSlicerMode = useLoopAnimator((s) => s.setSlicerMode)
  const runContourSlicer = useLoopAnimator((s) => s.runContourSlicer)
  const setChromaKey = useLoopAnimator((s) => s.setChromaKey)
  const selectFrame = useLoopAnimator((s) => s.selectFrame)
  const updateFrame = useLoopAnimator((s) => s.updateFrame)

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawImageRef = useRef<HTMLImageElement | null>(null)
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
    drawFrameOverlay(
      ctx,
      frames,
      selectedFrameIndex,
      playingFrameIndex,
      isPlaying,
      slicerMode,
      gridConfig.borderPadding ?? 0
    )
  }

  function renderProcessedSource(
    img: HTMLImageElement,
    chroma: ChromaKeyConfig,
    grid: GridSlicerConfig
  ): void {
    const canvas = sourceCanvasRef.current
    if (!canvas) return
    const w = img.naturalWidth || 1024
    const h = img.naturalHeight || 1024
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const hasBorderPad = (grid.borderPadding ?? 0) > 0
    if (hasBorderPad || chroma.enabled) {
      const data = ctx.getImageData(0, 0, w, h)
      if (hasBorderPad) {
        clearGridBorderPadding(data, grid)
      }
      if (chroma.enabled) {
        applyChromaKeyToImageData(data, chroma)
      }
      ctx.putImageData(data, 0, 0)
    }
    drawOverlay()
  }

  // Nạp ảnh nguồn khi URL đổi; phiên trống → xoá sạch canvas để không còn ảnh cũ
  useEffect(() => {
    if (!sourceImageUrl) {
      rawImageRef.current = null
      for (const c of [sourceCanvasRef.current, overlayCanvasRef.current]) {
        if (c) {
          c.width = 0
          c.height = 0
        }
      }
      bumpSourceVersion()
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      rawImageRef.current = img
      setSourceDimensions(img.naturalWidth || 1024, img.naturalHeight || 1024)
      const st = useLoopAnimator.getState()
      renderProcessedSource(img, st.chromaKey, st.gridConfig)
      if (st.pendingMeshUpgrade) {
        st.alignUpgradedFramesByMesh(sourceCanvasRef.current)
      }
      bumpSourceVersion()
    }
    img.onerror = () => !cancelled && toast('⚠ Không đọc được ảnh nguồn')
    void resolveLoopAssetUrl(sourceImageUrl).then((resolved) => {
      if (!cancelled) img.src = resolved || sourceImageUrl
    })
    return () => {
      cancelled = true
    }
  }, [sourceImageUrl])

  useEffect(() => {
    if (!rawImageRef.current) return
    renderProcessedSource(rawImageRef.current, chromaKey, gridConfig)
    bumpSourceVersion()
  }, [chromaKey, gridConfig.borderPadding, gridConfig.cols, gridConfig.rows, gridConfig.marginX, gridConfig.marginY, gridConfig.paddingX, gridConfig.paddingY])

  useEffect(() => {
    drawOverlay()
  }, [frames, selectedFrameIndex, playingFrameIndex, isPlaying, slicerMode, gridConfig.borderPadding])

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { px: number; py: number } | null {
    const ov = overlayCanvasRef.current
    if (!ov) return null
    const rect = ov.getBoundingClientRect()
    return {
      px: Math.floor(((e.clientX - rect.left) * ov.width) / Math.max(1, rect.width)),
      py: Math.floor(((e.clientY - rect.top) * ov.height) / Math.max(1, rect.height))
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void {
    const c = canvasCoords(e)
    if (!c) return
    if (eyedropperActive && rawImageRef.current) {
      const d = readRawImage(rawImageRef.current)?.getImageData(c.px, c.py, 1, 1).data
      if (d) setChromaKey({ enabled: true, keyColor: `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` })
      setEyedropperActive(false)
      return
    }
    const hit = frames.findIndex((f) => c.px >= f.x && c.px <= f.x + f.width && c.py >= f.y && c.py <= f.y + f.height)
    if (hit < 0) return
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
    const ctx = img ? readRawImage(img) : null
    if (!img || !ctx) return
    setChromaKey({
      enabled: true,
      keyColor: detectCornerKeyColor(
        ctx,
        img.naturalWidth || 1024,
        img.naturalHeight || 1024,
        gridConfig.borderPadding ?? 0
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
          <span className="loop-zoom-val">{Math.round(zoom * 100)}%</span>
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
        className="loop-source-canvas-scroll"
        onDragOver={(e) => hasSource && e.preventDefault()}
        onDrop={(e) => {
          if (!hasSource) return
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) loadLoopImageFile(file)
        }}
      >
        {!hasSource && <LoopSourceEmptyState onRequestUpload={onRequestUpload} templates={templates} />}
        <div
          className={`loop-source-canvas-stage${eyedropperActive ? ' eyedropper-cursor' : ''}`}
          hidden={!hasSource}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            aspectRatio: `${Math.max(1, sourceWidth)} / ${Math.max(1, sourceHeight)}`
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
