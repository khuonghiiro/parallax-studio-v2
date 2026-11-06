import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { ChromaKeySettings, CutPoint } from '../layerAssembly/cutter/types'
import { DEFAULT_CHROMA_SETTINGS } from '../layerAssembly/cutter/types'
import {
  processAdvancedChromaPixelData
} from '../layerAssembly/cutter/chromaAdvancedProcessor'
import {
  detectCornerBackground,
  computeCanvasPointerCoords,
  computeCursorAnchoredZoom,
  computeSpacePanOffset
} from '../layerAssembly/cutter/cutterHelpers'
import { PhotoshopEyedropperOverlay } from '../layerAssembly/cutter/PhotoshopEyedropperOverlay'
import { sampleEyedropperAtPoint } from '../layerAssembly/cutter/chromaKey'
import { applyMagicWandFlood } from '../layerAssembly/cutter/chromaAdvancedProcessor'
import type { EyedropperSample } from '../layerAssembly/cutter/types'
import { SAMPLE_ANIME_SPRITESHEET_URL } from '../layerAssembly/cutter/sampleSpriteSheet'
import type { PhotoStudioTool, PhotoCanvasBgMode, PhotoAdjustments } from './types'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'
import { applyColorAdjustments, isDefaultAdjustments } from './photoAdjustments'
import { PhotoStudioToolbar } from './PhotoStudioToolbar'
import { PhotoStudioChromaBar } from './PhotoStudioChromaBar'
import { PhotoStudioAdjustmentsBar } from './PhotoStudioAdjustmentsBar'
import { PhotoStudioSaveModal } from './PhotoStudioSaveModal'
import { importBuiltInAsset, toast } from '../../actions'
import './photoStudio.css'

const MAX_WORK_DIM = 2048

export interface PhotoStudioDialogProps {
  onClose: () => void
  initialImageUrl?: string | null
}

export function PhotoStudioDialog({
  onClose,
  initialImageUrl
}: PhotoStudioDialogProps) {
  const [imageUrl, setImageUrl] = useState<string>(
    () => initialImageUrl || SAMPLE_ANIME_SPRITESHEET_URL
  )
  const [fileName, setFileName] = useState<string>(() => {
    if (initialImageUrl) {
      const parts = initialImageUrl.split(/[\\/]/)
      return parts[parts.length - 1] || 'photo.png'
    }
    return 'Chibi Hanfu Character.png'
  })

  const [tool, setTool] = useState<PhotoStudioTool>('wand')
  const [canvasBg, setCanvasBg] = useState<PhotoCanvasBgMode>('checker-dark')
  const [chroma, setChroma] = useState<ChromaKeySettings>(DEFAULT_CHROMA_SETTINGS)
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(DEFAULT_PHOTO_ADJUSTMENTS)

  const [brushRadius, setBrushRadius] = useState<number>(18)
  const [wandTolerance, setWandTolerance] = useState<number>(36)
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number }>({ w: 941, h: 1671 })

  // Eyedropper & Marquee & Lasso
  const [eyedropperSample, setEyedropperSample] = useState<EyedropperSample | null>(null)
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currX: number; currY: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<CutPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [savePreviewUrl, setSavePreviewUrl] = useState('')

  // Undo/Redo Stacks cho Manual Mask
  const [undoStack, setUndoStack] = useState<Int16Array[]>([])
  const [redoStack, setRedoStack] = useState<Int16Array[]>([])

  // Canvases
  const fullRawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workRawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workRawDataRef = useRef<ImageData | null>(null)
  const userAlphaOverrideRef = useRef<Int16Array | null>(null)
  const workScaleRef = useRef<number>(1)
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Viewport Zoom & Pan
  const [scale, setScale] = useState<number>(0.5)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false)
  const [isSpacePanning, setIsSpacePanning] = useState<boolean>(false)
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)
  const lastStrokePointRef = useRef<{ x: number; y: number } | null>(null)

  // 1. Nạp ảnh
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const nw = img.naturalWidth || img.width
      const nh = img.naturalHeight || img.height
      setImgNaturalSize({ w: nw, h: nh })

      // Buffer gốc
      let full = fullRawCanvasRef.current
      if (!full) {
        full = document.createElement('canvas')
        fullRawCanvasRef.current = full
      }
      full.width = nw
      full.height = nh
      const fctx = full.getContext('2d')
      if (fctx) {
        fctx.clearRect(0, 0, nw, nh)
        fctx.drawImage(img, 0, 0)
      }

      // Buffer tương tác 60fps
      const maxDim = Math.max(nw, nh)
      const sc = maxDim > MAX_WORK_DIM ? MAX_WORK_DIM / maxDim : 1
      workScaleRef.current = sc
      const ww = Math.max(1, Math.round(nw * sc))
      const wh = Math.max(1, Math.round(nh * sc))

      let workRaw = workRawCanvasRef.current
      if (!workRaw) {
        workRaw = document.createElement('canvas')
        workRawCanvasRef.current = workRaw
      }
      workRaw.width = ww
      workRaw.height = wh
      const rctx = workRaw.getContext('2d', { willReadFrequently: true })
      if (!rctx) return
      rctx.imageSmoothingEnabled = true
      rctx.imageSmoothingQuality = 'high'
      rctx.clearRect(0, 0, ww, wh)
      rctx.drawImage(img, 0, 0, ww, wh)

      workRawDataRef.current = rctx.getImageData(0, 0, ww, wh)
      userAlphaOverrideRef.current = new Int16Array(ww * wh).fill(-1)
      setUndoStack([])
      setRedoStack([])

      const proc = procCanvasRef.current
      if (proc) {
        proc.width = ww
        proc.height = wh
      }

      // Tự động phát hiện màu phông
      const preset = detectCornerBackground(rctx)
      if (preset) {
        setChroma((prev) => ({
          ...prev,
          enabled: true,
          keyColorType: preset.type,
          keyColorHex: preset.hex,
          keyColor: preset.hex
        }))
      }

      // Auto fit zoom
      if (viewportRef.current) {
        const vw = viewportRef.current.clientWidth - 40
        const vh = viewportRef.current.clientHeight - 40
        const fitScale = Math.min(1.0, Math.min(vw / ww, vh / wh))
        setScale(Number(Math.max(0.15, fitScale).toFixed(2)))
        setPan({ x: 0, y: 0 })
      }
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  // 2. Chạy pipeline xử lý render ra display canvas
  const renderPipeline = useCallback(() => {
    const rawData = workRawDataRef.current
    const proc = procCanvasRef.current
    if (!rawData || !proc) return
    const pctx = proc.getContext('2d')
    if (!pctx) return

    const w = rawData.width
    const h = rawData.height
    // Tạo bản sao Uint8ClampedArray từ ảnh gốc
    const outputData = new Uint8ClampedArray(rawData.data)

    // Bước A: Tách nền Chroma
    if (chroma.enabled && chroma.previewMode !== 'original') {
      const scaledChroma: ChromaKeySettings = {
        ...chroma,
        smoothness: Number(((chroma.smoothness ?? 2) * workScaleRef.current).toFixed(2)),
        edgeChoke: Number(((chroma.edgeChoke ?? 0) * workScaleRef.current).toFixed(2)),
        strokeWidth:
          (chroma.strokeWidth ?? 0) > 0
            ? Math.max(1, Math.round((chroma.strokeWidth ?? 0) * workScaleRef.current))
            : 0
      }
      processAdvancedChromaPixelData(outputData, w, h, scaledChroma)
    }

    // Bước B: Ghi đè Manual Mask (Cọ tẩy/Khôi phục)
    const override = userAlphaOverrideRef.current
    if (override) {
      for (let p = 0; p < w * h; p++) {
        const ov = override[p]
        if (ov >= 0) {
          const idx = p * 4
          outputData[idx + 3] = ov
          // Nếu khôi phục pixel gốc thì lấy lại màu gốc 0ms
          if (ov > 0 && outputData[idx + 3] > 0) {
            outputData[idx] = rawData.data[idx]
            outputData[idx + 1] = rawData.data[idx + 1]
            outputData[idx + 2] = rawData.data[idx + 2]
          }
        }
      }
    }

    // Bước C: Chỉnh sửa màu sắc & Bộ lọc ảnh
    if (!isDefaultAdjustments(adjustments)) {
      applyColorAdjustments(outputData, w, h, adjustments)
    }

    // Ghi vào display canvas
    const imgData = new ImageData(outputData, w, h)
    pctx.putImageData(imgData, 0, 0)
  }, [chroma, adjustments])

  useEffect(() => {
    renderPipeline()
  }, [renderPipeline])

  // Lưu snapshot Undo
  const pushUndo = useCallback(() => {
    if (!userAlphaOverrideRef.current) return
    const snap = new Int16Array(userAlphaOverrideRef.current)
    setUndoStack((prev) => [...prev.slice(-20), snap])
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !userAlphaOverrideRef.current) return
    const current = new Int16Array(userAlphaOverrideRef.current)
    const prev = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, current])
    userAlphaOverrideRef.current.set(prev)
    renderPipeline()
  }, [undoStack, renderPipeline])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !userAlphaOverrideRef.current) return
    const current = new Int16Array(userAlphaOverrideRef.current)
    const next = redoStack[redoStack.length - 1]
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, current])
    userAlphaOverrideRef.current.set(next)
    renderPipeline()
  }, [redoStack, renderPipeline])

  // Phím tắt bàn phím (Space để pan, Ctrl+Z, Ctrl+Y, Delete)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setIsSpacePressed(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Xóa vùng marquee nếu đang có
        if (marquee && userAlphaOverrideRef.current && workRawDataRef.current) {
          pushUndo()
          const { width: w, height: h } = workRawDataRef.current
          const x0 = Math.max(0, Math.min(marquee.startX, marquee.currX))
          const x1 = Math.min(w - 1, Math.max(marquee.startX, marquee.currX))
          const y0 = Math.max(0, Math.min(marquee.startY, marquee.currY))
          const y1 = Math.min(h - 1, Math.max(marquee.startY, marquee.currY))
          for (let y = y0; y <= y1; y++) {
            const row = y * w
            for (let x = x0; x <= x1; x++) {
              userAlphaOverrideRef.current[row + x] = 0
            }
          }
          setMarquee(null)
          renderPipeline()
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        setIsSpacePanning(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [handleUndo, handleRedo, marquee, pushUndo, renderPipeline])

  // Xử lý vẽ nét cọ (Eraser / Restore)
  const applyBrushAtPoint = useCallback((cx: number, cy: number, isEraser: boolean) => {
    const rawData = workRawDataRef.current
    const override = userAlphaOverrideRef.current
    if (!rawData || !override) return
    const { width: w, height: h } = rawData
    const r = Math.max(1, Math.round(brushRadius * workScaleRef.current))
    const rSq = r * r
    const y0 = Math.max(0, cy - r)
    const y1 = Math.min(h - 1, cy + r)
    const x0 = Math.max(0, cx - r)
    const x1 = Math.min(w - 1, cx + r)

    for (let ny = y0; ny <= y1; ny++) {
      const dy = ny - cy
      const row = ny * w
      for (let nx = x0; nx <= x1; nx++) {
        const dx = nx - cx
        if (dx * dx + dy * dy <= rSq) {
          override[row + nx] = isEraser ? 0 : 255
        }
      }
    }
  }, [brushRadius])

  // Pointer interactions trên canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = computeCanvasPointerCoords(e, imgNaturalSize.w, imgNaturalSize.h)
    if (isSpacePressed || tool === 'pan' || e.button === 1) {
      setIsSpacePanning(true)
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y
      }
      return
    }

    if (tool === 'eyedropper') {
      const proc = procCanvasRef.current
      if (!proc) return
      const ctx = proc.getContext('2d')
      if (!ctx) return
      const sample = sampleEyedropperAtPoint(
        ctx,
        proc.width,
        proc.height,
        coords.workX,
        coords.workY,
        e.clientX,
        e.clientY,
        coords.workX,
        coords.workY,
        chroma.keyColorHex || '#00DB4E'
      )
      setEyedropperSample(sample)
      setChroma((prev) => ({
        ...prev,
        enabled: true,
        keyColorType: 'custom',
        keyColorHex: sample.hex,
        keyColor: sample.hex
      }))
      return
    }

    if (tool === 'wand') {
      pushUndo()
      const rawData = workRawDataRef.current
      const override = userAlphaOverrideRef.current
      if (rawData && override) {
        applyMagicWandFlood(
          rawData.data,
          rawData.data,
          rawData.width,
          rawData.height,
          coords.workX,
          coords.workY,
          wandTolerance,
          'erase',
          override
        )
        renderPipeline()
      }
      return
    }

    if (tool === 'eraser' || tool === 'restore') {
      pushUndo()
      setIsDrawing(true)
      lastStrokePointRef.current = { x: coords.workX, y: coords.workY }
      applyBrushAtPoint(coords.workX, coords.workY, tool === 'eraser')
      renderPipeline()
      return
    }

    if (tool === 'box') {
      setIsDrawing(true)
      setMarquee({
        startX: coords.workX,
        startY: coords.workY,
        currX: coords.workX,
        currY: coords.workY
      })
      return
    }

    if (tool === 'lasso') {
      setIsDrawing(true)
      setLassoPoints([{ x: coords.workX, y: coords.workY }])
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isSpacePanning && panStartRef.current) {
      const nextPan = computeSpacePanOffset(
        panStartRef.current.panX,
        panStartRef.current.panY,
        panStartRef.current.clientX,
        panStartRef.current.clientY,
        e.clientX,
        e.clientY
      )
      setPan(nextPan)
      return
    }

    const coords = computeCanvasPointerCoords(e, imgNaturalSize.w, imgNaturalSize.h)

    if (tool === 'eyedropper' && eyedropperSample) {
      const proc = procCanvasRef.current
      if (proc) {
        const ctx = proc.getContext('2d')
        if (ctx) {
          const sample = sampleEyedropperAtPoint(
            ctx,
            proc.width,
            proc.height,
            coords.workX,
            coords.workY,
            e.clientX,
            e.clientY,
            coords.workX,
            coords.workY,
            chroma.keyColorHex || '#00DB4E'
          )
          setEyedropperSample(sample)
        }
      }
      return
    }

    if (isDrawing && (tool === 'eraser' || tool === 'restore')) {
      const last = lastStrokePointRef.current
      if (last) {
        const dist = Math.hypot(coords.workX - last.x, coords.workY - last.y)
        const step = Math.max(1, brushRadius * 0.35)
        const steps = Math.ceil(dist / step)
        for (let s = 1; s <= steps; s++) {
          const t = s / steps
          const ix = Math.round(last.x + (coords.workX - last.x) * t)
          const iy = Math.round(last.y + (coords.workY - last.y) * t)
          applyBrushAtPoint(ix, iy, tool === 'eraser')
        }
      }
      lastStrokePointRef.current = { x: coords.workX, y: coords.workY }
      renderPipeline()
      return
    }

    if (isDrawing && tool === 'box' && marquee) {
      setMarquee({ ...marquee, currX: coords.workX, currY: coords.workY })
      return
    }

    if (isDrawing && tool === 'lasso') {
      setLassoPoints((pts) => [...pts, { x: coords.workX, y: coords.workY }])
    }
  }

  const handlePointerUp = () => {
    setIsSpacePanning(false)
    panStartRef.current = null
    lastStrokePointRef.current = null
    setIsDrawing(false)

    if (tool === 'eyedropper') {
      setEyedropperSample(null)
    }
  }

  // Zoom lăn chuột
  const handleWheel = (e: React.WheelEvent) => {
    if (!viewportRef.current) return
    e.preventDefault()
    const rect = viewportRef.current.getBoundingClientRect()
    const delta = e.deltaY < 0 ? 0.12 : -0.12
    const nextScale = Math.max(0.1, Math.min(3.5, scale + delta))
    const res = computeCursorAnchoredZoom({
      cursorClientX: e.clientX,
      cursorClientY: e.clientY,
      viewportCenterX: rect.left + rect.width / 2,
      viewportCenterY: rect.top + rect.height / 2,
      currentPanX: pan.x,
      currentPanY: pan.y,
      oldScale: scale,
      newScale: nextScale
    })
    setScale(res.scale)
    setPan({ x: res.panX, y: res.panY })
  }

  // Mở modal lưu ảnh
  const handleOpenSaveModal = () => {
    const proc = procCanvasRef.current
    if (!proc) return
    try {
      const dataUrl = proc.toDataURL('image/png')
      setSavePreviewUrl(dataUrl)
      setIsSaveModalOpen(true)
    } catch (err) {
      console.error('[PhotoStudioDialog] Failed to prepare save preview:', err)
    }
  }

  // Lưu vào Thư viện tài nguyên & Cảnh
  const handleSaveToLibrary = async (opts: {
    fileName: string
    title: string
    category: string
    addToScene: boolean
  }) => {
    const proc = procCanvasRef.current
    if (!proc) return
    const dataUrl = proc.toDataURL('image/png')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

    const res = await window.api.importBuiltInAssetFile({
      name: opts.fileName,
      buffer: bytes,
      folder: opts.category,
      title: opts.title
    })

    if (!res.ok) {
      toast(`Lỗi khi lưu ảnh: ${res.error || 'Không rõ'}`)
      return
    }

    toast(`Đã lưu ảnh vào Thư viện: ${res.relPath}`)

    if (opts.addToScene && res.item) {
      await importBuiltInAsset(res.item, true)
    }
  }

  const handleDownloadFile = (fName: string) => {
    const proc = procCanvasRef.current
    if (!proc) return
    const a = document.createElement('a')
    a.href = proc.toDataURL('image/png')
    a.download = fName || 'photo_export.png'
    a.click()
  }

  const handleUploadImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const url = evt.target?.result as string
      if (url) {
        setImageUrl(url)
        setFileName(file.name)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="ps-backdrop" onPointerDown={onClose}>
      <div
        className="ps-modal-container"
        role="dialog"
        aria-modal="true"
        aria-label="Xưởng Tách Nền & Chỉnh Sửa Ảnh"
        data-mcp-region="photo_editor"
        data-mcp-dialog
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* 1. Header Toolbar */}
        <PhotoStudioToolbar
          tool={tool}
          onChangeTool={setTool}
          canvasBg={canvasBg}
          onChangeCanvasBg={setCanvasBg}
          zoomScale={scale}
          onStepZoom={(d) => setScale((s) => Math.max(0.1, Math.min(3.5, Number((s + d).toFixed(2)))))}
          onFitZoom={() => {
            if (viewportRef.current && workRawDataRef.current) {
              const vw = viewportRef.current.clientWidth - 40
              const vh = viewportRef.current.clientHeight - 40
              const fit = Math.min(1.0, Math.min(vw / workRawDataRef.current.width, vh / workRawDataRef.current.height))
              setScale(Number(Math.max(0.15, fit).toFixed(2)))
              setPan({ x: 0, y: 0 })
            }
          }}
          onResetZoom={() => {
            setScale(1.0)
            setPan({ x: 0, y: 0 })
          }}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          brushRadius={brushRadius}
          onChangeBrushRadius={setBrushRadius}
          wandTolerance={wandTolerance}
          onChangeWandTolerance={setWandTolerance}
          imageSize={imgNaturalSize}
          fileName={fileName}
          onUploadImage={handleUploadImage}
          onLoadSample={() => {
            setImageUrl(SAMPLE_ANIME_SPRITESHEET_URL)
            setFileName('Chibi Hanfu Character.png')
          }}
          onOpenSaveModal={handleOpenSaveModal}
          onClose={onClose}
        />

        {/* 2. Control Bars (Chroma Strip + Adjustments Strip) */}
        <div className="ps-controls-dock">
          <PhotoStudioChromaBar
            chroma={chroma}
            onChangeChroma={(patch) => setChroma((c) => ({ ...c, ...patch }))}
            onPickEyedropper={() => setTool('eyedropper')}
          />
          <PhotoStudioAdjustmentsBar
            adjustments={adjustments}
            onChangeAdjustments={(patch) => setAdjustments((a) => ({ ...a, ...patch }))}
            onResetAdjustments={() => setAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)}
          />
        </div>

        {/* 3. Central Canvas Viewport */}
        <div
          ref={viewportRef}
          className={`ps-viewport-wrap ${canvasBg}`}
          onWheel={handleWheel}
          data-mcp-region="photo_editor_canvas"
        >
          {isSpacePressed && (
            <div className="ps-pan-hint">
              <span>✋ {isSpacePanning ? 'Đang kéo di chuyển…' : 'Giữ chuột trái + kéo để dịch chuyển ảnh'}</span>
            </div>
          )}

          <div
            className="ps-canvas-box"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center'
            }}
          >
            <canvas
              ref={procCanvasRef}
              className="ps-main-canvas"
              style={{
                cursor: isSpacePanning
                  ? 'grabbing'
                  : isSpacePressed || tool === 'pan'
                    ? 'grab'
                    : tool === 'eyedropper'
                      ? 'crosshair'
                      : tool === 'eraser' || tool === 'restore'
                        ? 'crosshair'
                        : tool === 'wand' || tool === 'box' || tool === 'lasso'
                          ? 'crosshair'
                          : 'default'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            {/* Marquee Rect Overlay */}
            {marquee && (
              <div
                className="ps-marquee-box"
                style={{
                  left: `${Math.min(marquee.startX, marquee.currX)}px`,
                  top: `${Math.min(marquee.startY, marquee.currY)}px`,
                  width: `${Math.abs(marquee.currX - marquee.startX)}px`,
                  height: `${Math.abs(marquee.currY - marquee.startY)}px`
                }}
              />
            )}

            {/* Lasso Polygon Overlay */}
            {lassoPoints.length > 1 && (
              <svg className="ps-lasso-svg">
                <polyline
                  points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  className="ps-lasso-line"
                />
              </svg>
            )}
          </div>

          {/* Eyedropper Magnifier Overlay */}
          <PhotoshopEyedropperOverlay
            target={tool === 'eyedropper' ? 'key' : null}
            currentHex={chroma.keyColorHex || '#00DB4E'}
            sample={eyedropperSample}
            onCancel={() => {
              setTool('wand')
              setEyedropperSample(null)
            }}
          />
        </div>

        {/* 4. Save to Manifest Modal */}
        <PhotoStudioSaveModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          previewDataUrl={savePreviewUrl}
          defaultName={fileName}
          imageSize={imgNaturalSize}
          onSaveToLibrary={handleSaveToLibrary}
          onDownloadFile={handleDownloadFile}
        />
      </div>
    </div>
  )
}
