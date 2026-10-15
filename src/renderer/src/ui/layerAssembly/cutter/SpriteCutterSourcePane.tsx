import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type {
  ChromaKeySettings,
  CutterToolMode,
  DetectedIsland,
  CutPoint,
  CutPiece,
  EyedropperTarget,
  EyedropperSample,
  GridSlicerSettings
} from './types'
import { DEFAULT_CHROMA_SETTINGS } from './types'
import {
  applyChromaKey,
  detectOpaqueIslands,
  extractRegionDataUrl,
  createCutterStroke,
  sampleEyedropperAtPoint,
  type CutterStrokeSession
} from './chromaKey'
import { computeGridIslands, rgbToHex } from './chromaAdvancedProcessor'
import { CutterBrushSubBar } from './CutterBrushSubBar'
import { CutterGridSubBar, CutterQuickPartsStrip } from './CutterSlicesBar'
import { PhotoshopEyedropperOverlay } from './PhotoshopEyedropperOverlay'
import {
  SpriteCutterSourceToolbar,
  type CanvasBgMode,
  type TagDisplayMode
} from './SpriteCutterSourceToolbar'
import { SAMPLE_ANIME_SPRITESHEET_URL } from './sampleSpriteSheet'
import { IconScissors, IconUpload, IconRefresh, IconCheck } from '../../icons'

export interface SpriteCutterSourcePaneProps {
  onSelectPiece: (piece: CutPiece | null) => void
  onTransferToTarget: (piece: CutPiece, pos?: { x: number; y: number }) => void
  selectedPiece: CutPiece | null
}

export function SpriteCutterSourcePane({
  onSelectPiece,
  onTransferToTarget,
  selectedPiece
}: SpriteCutterSourcePaneProps) {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_ANIME_SPRITESHEET_URL)
  const [chroma, setChroma] = useState<ChromaKeySettings>(DEFAULT_CHROMA_SETTINGS)
  const [showChromaStudio, setShowChromaStudio] = useState<boolean>(true)
  const [tool, setTool] = useState<CutterToolMode>('auto')
  const [eyedropperTarget, setEyedropperTarget] = useState<EyedropperTarget | null>(null)
  const [eyedropperSample, setEyedropperSample] = useState<EyedropperSample | null>(null)

  const [islands, setIslands] = useState<DetectedIsland[]>([])
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null)
  const [minIslandArea, setMinIslandArea] = useState<number>(80)
  const [gridSettings, setGridSettings] = useState<GridSlicerSettings>({
    rows: 2,
    cols: 3,
    paddingInset: 2
  })

  const [brushRadius, setBrushRadius] = useState<number>(18)
  const [brushHardness, setBrushHardness] = useState<number>(0.85)
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0)
  const [tagDisplayMode, setTagDisplayMode] = useState<TagDisplayMode>('hover')
  const [canvasBg, setCanvasBg] = useState<CanvasBgMode>('checker')
  const [brushCursorPos, setBrushCursorPos] = useState<{ x: number; y: number } | null>(null)

  const activeStrokeRef = useRef<CutterStrokeSession | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const undoStackRef = useRef<ImageData[]>([])
  const redoStackRef = useRef<ImageData[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [marquee, setMarquee] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<CutPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [copiedBadge, setCopiedBadge] = useState(false)

  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number }>({ w: 665, h: 702 })
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 560, h: 460 })
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

  // Tự động phát hiện màu góc ảnh khi nạp ảnh mới
  const detectCornerBgPreset = useCallback((rctx: CanvasRenderingContext2D) => {
    const p = rctx.getImageData(2, 2, 1, 1).data
    const [r, g, b, a] = [p[0], p[1], p[2], p[3]]
    if (a < 30) return
    const hex = rgbToHex(r, g, b)
    if (g > 150 && g > r + 50 && g > b + 50) {
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'chroma_green',
        keyColorHex: hex,
        keyColor: hex,
        fringeColorType: 'chroma_green',
        fringeColorHex: hex
      }))
    } else if (r > 235 && g > 235 && b > 235) {
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'pure_white',
        keyColorHex: '#FFFFFF',
        keyColor: '#FFFFFF',
        fringeColorType: 'pure_white',
        fringeColorHex: '#FFFFFF'
      }))
    } else if (r < 20 && g < 20 && b < 20) {
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'pure_black',
        keyColorHex: '#000000',
        keyColor: '#000000',
        fringeColorType: 'pure_black',
        fringeColorHex: '#000000'
      }))
    } else {
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'custom',
        keyColorHex: hex,
        keyColor: hex,
        fringeColorType: 'custom',
        fringeColorHex: hex
      }))
    }
  }, [])

  const lastLoadedUrlRef = useRef<string>('')

  const processImage = useCallback(() => {
    if (!imageUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || 665
      const h = img.naturalHeight || 702
      setImgNaturalSize({ w, h })

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

      if (lastLoadedUrlRef.current !== imageUrl) {
        lastLoadedUrlRef.current = imageUrl
        detectCornerBgPreset(rctx)
      }

      const proc = procCanvasRef.current
      if (!proc) return
      proc.width = w
      proc.height = h
      const pctx = proc.getContext('2d', { willReadFrequently: true })
      if (!pctx) return

      applyChromaKey(rctx, pctx, w, h, chroma)

      if (chroma.enabled && chroma.previewMode !== 'original') {
        const found = detectOpaqueIslands(pctx, w, h, minIslandArea)
        setIslands(found)
      } else {
        setIslands([])
      }
    }
    img.src = imageUrl
  }, [imageUrl, chroma, minIslandArea, detectCornerBgPreset])

  useEffect(() => {
    processImage()
  }, [processImage])

  const activeIslands = useMemo(() => {
    if (tool === 'grid') {
      return computeGridIslands(imgNaturalSize.w, imgNaturalSize.h, gridSettings)
    }
    return islands
  }, [tool, islands, imgNaturalSize.w, imgNaturalSize.h, gridSettings])

  const handleUpdateChroma = useCallback((patch: Partial<ChromaKeySettings>) => {
    setChroma((prev) => {
      const next = { ...prev, ...patch }
      if (patch.keyColorHex) next.keyColor = patch.keyColorHex
      return next
    })
  }, [])

  const handleSelectIsland = useCallback(
    (isl: DetectedIsland) => {
      const proc = procCanvasRef.current
      if (!proc) return
      setSelectedIslandId(isl.id)
      setMarquee(null)
      setLassoPoints([])

      const dataUrl = extractRegionDataUrl(proc, isl)
      const piece: CutPiece = {
        id: isl.id,
        dataUrl,
        width: isl.width,
        height: isl.height,
        label: isl.label || 'Mảnh cắt',
        sourceBox: isl
      }
      try {
        ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
      } catch {}
      onSelectPiece(piece)
    },
    [onSelectPiece]
  )

  const handleQuickAddIsland = useCallback(
    (isl: DetectedIsland) => {
      const proc = procCanvasRef.current
      if (!proc) return
      const dataUrl = extractRegionDataUrl(proc, isl)
      const piece: CutPiece = {
        id: isl.id,
        dataUrl,
        width: isl.width,
        height: isl.height,
        label: isl.label || 'Mảnh cắt',
        sourceBox: isl
      }
      onSelectPiece(piece)
      onTransferToTarget(piece, { x: 0, y: 0 })
    },
    [onSelectPiece, onTransferToTarget]
  )

  const handleSendAllToBoard = useCallback(() => {
    const proc = procCanvasRef.current
    if (!proc || activeIslands.length === 0) return
    const centerX = imgNaturalSize.w / 2
    const centerY = imgNaturalSize.h / 2
    const scaleToBoard = Math.min(1, 460 / Math.max(imgNaturalSize.w, imgNaturalSize.h))

    for (const isl of activeIslands) {
      const dataUrl = extractRegionDataUrl(proc, isl)
      const relX = Math.round((isl.x + isl.width / 2 - centerX) * scaleToBoard)
      const relY = Math.round((isl.y + isl.height / 2 - centerY) * scaleToBoard)
      onTransferToTarget(
        {
          id: `${isl.id}-${Date.now()}`,
          dataUrl,
          width: isl.width,
          height: isl.height,
          label: isl.label || 'Mảnh cắt',
          sourceBox: isl
        },
        { x: relX, y: relY }
      )
    }
  }, [activeIslands, imgNaturalSize.w, imgNaturalSize.h, onTransferToTarget])

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
      setIslands(detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea))
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
      setIslands(detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea))
    }
  }, [chroma.enabled, minIslandArea])

  // Phím tắt ESC huỷ hút màu, Ctrl+Z / Ctrl+Y / Ctrl+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && eyedropperTarget) {
        e.preventDefault()
        setEyedropperTarget(null)
        setEyedropperSample(null)
        return
      }
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        e.shiftKey ? handleRedo() : handleUndo()
      } else if (key === 'y') {
        e.preventDefault()
        handleRedo()
      } else if (key === 'c' && selectedPiece) {
        e.preventDefault()
        handleCopyPiece()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [eyedropperTarget, handleUndo, handleRedo, selectedPiece])

  const getCurrentTargetHex = useCallback(
    (t: EyedropperTarget | null) => {
      if (t === 'fringe') return chroma.fringeColorHex || chroma.keyColorHex || '#00DB4E'
      if (t === 'smooth') return chroma.smoothColorHex || '#000000'
      return chroma.keyColorHex || '#00DB4E'
    },
    [chroma.fringeColorHex, chroma.keyColorHex, chroma.smoothColorHex]
  )

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.currentTarget.width / Math.max(1, rect.width)
    const sy = e.currentTarget.height / Math.max(1, rect.height)
    return {
      x: Math.round((e.clientX - rect.left) * sx),
      y: Math.round((e.clientY - rect.top) * sy),
      canvasX: Math.round(e.clientX - rect.left),
      canvasY: Math.round(e.clientY - rect.top)
    }
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, canvasX, canvasY } = getCanvasCoords(e)

    if (eyedropperTarget) {
      const sourceCanvas =
        eyedropperTarget === 'key'
          ? rawCanvasRef.current || procCanvasRef.current
          : procCanvasRef.current || rawCanvasRef.current
      if (sourceCanvas) {
        const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
        if (sctx) {
          const sample = sampleEyedropperAtPoint(
            sctx,
            sourceCanvas.width,
            sourceCanvas.height,
            x,
            y,
            e.clientX,
            e.clientY,
            canvasX,
            canvasY,
            getCurrentTargetHex(eyedropperTarget)
          )
          if (eyedropperTarget === 'key') {
            handleUpdateChroma({
              enabled: true,
              keyColorType: 'custom',
              keyColorHex: sample.hex,
              fringeColorType: 'custom',
              fringeColorHex: sample.hex
            })
          } else if (eyedropperTarget === 'fringe') {
            handleUpdateChroma({
              fringeColorType: 'custom',
              fringeColorHex: sample.hex
            })
          } else if (eyedropperTarget === 'smooth') {
            handleUpdateChroma({
              smoothColorType: 'custom',
              smoothColorHex: sample.hex
            })
          }
        }
      }
      setEyedropperTarget(null)
      setEyedropperSample(null)
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
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
      return
    }

    if (tool === 'box') {
      setIsDrawing(true)
      setSelectedIslandId(null)
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y })
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    } else if (tool === 'lasso') {
      setIsDrawing(true)
      setSelectedIslandId(null)
      setLassoPoints([{ x, y }])
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const { x, y, canvasX, canvasY } = getCanvasCoords(e)

    if (eyedropperTarget) {
      const sourceCanvas =
        eyedropperTarget === 'key'
          ? rawCanvasRef.current || procCanvasRef.current
          : procCanvasRef.current || rawCanvasRef.current
      if (sourceCanvas) {
        const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
        if (sctx) {
          setEyedropperSample(
            sampleEyedropperAtPoint(
              sctx,
              sourceCanvas.width,
              sourceCanvas.height,
              x,
              y,
              e.clientX,
              e.clientY,
              canvasX,
              canvasY,
              getCurrentTargetHex(eyedropperTarget)
            )
          )
        }
      }
      return
    }

    if (tool === 'eraser' || tool === 'restore') {
      setBrushCursorPos({ x: canvasX, y: canvasY })
    }

    if (!isDrawing) return

    if (tool === 'eraser' || tool === 'restore') {
      if (activeStrokeRef.current && lastPointRef.current) {
        const rawSamples = e.nativeEvent.getCoalescedEvents?.() ?? []
        const samples = rawSamples.length ? rawSamples : [e.nativeEvent]
        const sx = e.currentTarget.width / Math.max(1, rect.width)
        const sy = e.currentTarget.height / Math.max(1, rect.height)
        for (const s of samples) {
          const pt = {
            x: Math.round((s.clientX - rect.left) * sx),
            y: Math.round((s.clientY - rect.top) * sy)
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
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    const proc = procCanvasRef.current
    if (!proc) return

    if (tool === 'eraser' || tool === 'restore') {
      if (activeStrokeRef.current) {
        activeStrokeRef.current.commit()
        activeStrokeRef.current = null
      }
      lastPointRef.current = null
      if (chroma.enabled && rawCanvasRef.current) {
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (pctx) setIslands(detectOpaqueIslands(pctx, proc.width, proc.height, minIslandArea))
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
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity
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
          label: 'Vùng tự do',
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

  const availW = Math.max(180, viewportSize.w - 32)
  const availH = Math.max(180, viewportSize.h - 36)
  const fitScale = Math.min(
    1,
    availW / Math.max(1, imgNaturalSize.w),
    availH / Math.max(1, imgNaturalSize.h)
  )
  const effectiveScale = zoomMode === 'fit' ? fitScale : zoomMode
  const displayW = Math.max(1, Math.round(imgNaturalSize.w * effectiveScale))
  const displayH = Math.max(1, Math.round(imgNaturalSize.h * effectiveScale))
  const scaleX = displayW / Math.max(1, imgNaturalSize.w)
  const scaleY = displayH / Math.max(1, imgNaturalSize.h)

  const handleSelectTool = (next: CutterToolMode) => {
    setTool(next)
    setEyedropperTarget(null)
    setEyedropperSample(null)
    if (next !== 'auto' && next !== 'grid') setSelectedIslandId(null)
    if (next !== 'box' && next !== 'lasso') {
      setMarquee(null)
      setLassoPoints([])
    }
  }

  const handleToggleEyedropper = (target: EyedropperTarget) => {
    setEyedropperTarget((prev) => {
      const next = prev === target ? null : target
      if (!next) setEyedropperSample(null)
      return next
    })
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
          <strong>Nguồn ảnh & Tách nền Studio</strong>
          <span className="layer-cutter-badge-pill">{activeIslands.length} mảnh cắt</span>
          <span className="layer-cutter-badge" title="Kích thước ảnh gốc">
            {imgNaturalSize.w}×{imgNaturalSize.h}px
          </span>
        </div>
        <div className="layer-cutter-actions">
          <div className="layer-cutter-zoom-pill" title="Thu phóng khung nhìn ảnh nguồn">
            <button type="button" className="stepper-btn" onClick={() => stepZoom(-0.15)}>
              -
            </button>
            <button
              type="button"
              className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
              onClick={() => setZoomMode('fit')}
            >
              Vừa khung ({Math.round(effectiveScale * 100)}%)
            </button>
            <button
              type="button"
              className={`layer-cutter-zoom-mode-btn ${zoomMode === 1 ? 'active' : ''}`}
              onClick={() => setZoomMode(1)}
            >
              100%
            </button>
            <button type="button" className="stepper-btn" onClick={() => stepZoom(0.15)}>
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

      {/* Thanh công cụ + Bảng Studio Tách nền & Khử viền chuyên sâu (2 Sub-tabs) */}
      <SpriteCutterSourceToolbar
        tool={tool}
        islandsCount={islands.length}
        gridSettings={gridSettings}
        tagDisplayMode={tagDisplayMode}
        canvasBg={canvasBg}
        chroma={chroma}
        showChromaStudio={showChromaStudio}
        eyedropperTarget={eyedropperTarget}
        eyedropperSample={eyedropperSample}
        onChangeTool={handleSelectTool}
        onChangeTagDisplayMode={setTagDisplayMode}
        onChangeCanvasBg={setCanvasBg}
        onChangeChroma={handleUpdateChroma}
        onToggleChromaStudio={() => setShowChromaStudio((v) => !v)}
        onToggleEyedropper={handleToggleEyedropper}
        onResetChroma={() => setChroma(DEFAULT_CHROMA_SETTINGS)}
      />

      {/* Thanh cấu hình Cắt Lưới Ma Trận khi ở chế độ Grid */}
      {tool === 'grid' && (
        <CutterGridSubBar
          grid={gridSettings}
          totalCells={activeIslands.length}
          onChangeGrid={(patch) => setGridSettings((prev) => ({ ...prev, ...patch }))}
          onSendAllToBoard={handleSendAllToBoard}
        />
      )}

      {/* Thanh cấu hình Cọ Tẩy / Khôi Phục */}
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

      {/* Vùng hiển thị Canvas Ảnh Nguồn + Kính lúp Hút màu Photoshop */}
      <div
        ref={viewportWrapRef}
        className={`layer-cutter-canvas-wrap bg-${canvasBg} ${
          zoomMode !== 'fit' && effectiveScale > fitScale ? 'is-scrollable' : ''
        }`}
      >
        {/* Banner & Kính lúp Hút màu kiểu Adobe Photoshop */}
        <PhotoshopEyedropperOverlay
          target={eyedropperTarget}
          currentHex={getCurrentTargetHex(eyedropperTarget)}
          sample={eyedropperSample}
          onCancel={() => {
            setEyedropperTarget(null)
            setEyedropperSample(null)
          }}
        />

        <div
          className={`layer-cutter-source-canvas-box tag-mode-${tagDisplayMode}`}
          style={{ width: `${displayW}px`, height: `${displayH}px` }}
        >
          <canvas
            ref={procCanvasRef}
            className="layer-cutter-canvas"
            style={{
              width: '100%',
              height: '100%',
              cursor: eyedropperTarget
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
            onPointerLeave={() => {
              setBrushCursorPos(null)
              setEyedropperSample(null)
            }}
          />

          {(tool === 'eraser' || tool === 'restore') && brushCursorPos && !eyedropperTarget && (
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

          {/* Hiển thị các khung mảnh cắt (Tự động hoặc Lưới) khi không ở chế độ Hút màu */}
          {!eyedropperTarget &&
            (tool === 'auto' || tool === 'grid') &&
            activeIslands.map((isl) => {
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
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    handleQuickAddIsland(isl)
                  }}
                  style={{
                    left: `${isl.x * scaleX}px`,
                    top: `${isl.y * scaleY}px`,
                    width: `${boxW}px`,
                    height: `${boxH}px`
                  }}
                  title="Click để chọn · Nhấp đúp hoặc kéo thả sang phải để đưa vào Bố cục 2D"
                >
                  <span className={`layer-cutter-island-tag ${tagPlacementClass}`}>
                    {isl.label}
                  </span>
                </div>
              )
            })}

          {tool === 'box' && marquee && !eyedropperTarget && (
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
            >
              {!isDrawing && selectedPiece && (
                <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn sm primary"
                    style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                    onClick={() => onTransferToTarget(selectedPiece)}
                  >
                    Đưa vào 2D ➡️
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                    onClick={handleCopyPiece}
                  >
                    {copiedBadge ? 'Đã chép!' : 'Sao chép'}
                  </button>
                </div>
              )}
            </div>
          )}

          {tool === 'lasso' && lassoPoints.length >= 2 && !eyedropperTarget && (
            <>
              <svg className="layer-cutter-lasso-svg">
                <polyline
                  points={lassoPoints.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(' ')}
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
                >
                  <div className="layer-cutter-marquee-badge" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn sm primary"
                      style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                      onClick={() => onTransferToTarget(selectedPiece)}
                    >
                      Đưa vào 2D ➡️
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      style={{ height: 20, padding: '0 6px', fontSize: 10 }}
                      onClick={handleCopyPiece}
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

      {/* Dải Danh Sách Mảnh Cắt Trực Quan giúp chọn nhanh & Đưa tất cả vào 2D */}
      {(tool === 'auto' || tool === 'grid') && (
        <CutterQuickPartsStrip
          mode={tool}
          islands={activeIslands}
          selectedIslandId={selectedIslandId}
          minIslandArea={minIslandArea}
          onChangeMinIslandArea={setMinIslandArea}
          onSelectIsland={handleSelectIsland}
          onQuickAddIsland={handleQuickAddIsland}
          onSendAllToBoard={handleSendAllToBoard}
        />
      )}

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
              Chọn mảnh trong danh sách bên trên hoặc nhấp đúp trên ảnh để đưa sang Bố cục 2D
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <span className="layer-cutter-footer-hint">
            Nhấp đúp mảnh hoặc <kbd>Ctrl+C</kbd> ➔ <kbd>Ctrl+V</kbd>
          </span>
          <button
            id="btn-copy-piece"
            type="button"
            className="btn sm"
            disabled={!selectedPiece}
            onClick={handleCopyPiece}
          >
            {copiedBadge ? (
              <>
                <IconCheck width={12} height={12} /> Đã chép!
              </>
            ) : (
              'Sao chép (Ctrl+C)'
            )}
          </button>
          <button
            id="btn-transfer-to-target"
            type="button"
            className="btn sm primary"
            disabled={!selectedPiece}
            onClick={() => selectedPiece && onTransferToTarget(selectedPiece)}
          >
            Đưa vào Bố cục 2D ➡️
          </button>
        </div>
      </div>
    </div>
  )
}
