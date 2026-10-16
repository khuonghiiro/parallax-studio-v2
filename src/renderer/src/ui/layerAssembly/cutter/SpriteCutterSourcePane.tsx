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
  scanRawIslandsFromData,
  clusterAndFilterIslands,
  extractRegionDataUrl,
  createCutterStroke,
  sampleEyedropperAtPoint,
  type CutterStrokeSession
} from './chromaKey'
import {
  computeGridIslands,
  rgbToHex,
  applyMagicWandFlood
} from './chromaAdvancedProcessor'
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

/** Độ phân giải buffer tương tác tối đa để đảm bảo 60fps trên cả ảnh 4K/8K (vẫn giữ ảnh gốc 4K/8K khi cắt xuất mảnh) */
const MAX_WORK_DIM = 1280

interface UndoSnapshot {
  imageData: ImageData
  alphaOverride: Int16Array
}

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

  const [rawIslands, setRawIslands] = useState<DetectedIsland[]>([])
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null)
  const [minIslandArea, setMinIslandArea] = useState<number>(80)
  const [mergeGap, setMergeGap] = useState<number>(18)
  const [gridSettings, setGridSettings] = useState<GridSlicerSettings>({
    rows: 2,
    cols: 3,
    paddingInset: 2
  })

  const [brushRadius, setBrushRadius] = useState<number>(18)
  const [brushHardness, setBrushHardness] = useState<number>(0.85)
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0)
  const [wandTolerance, setWandTolerance] = useState<number>(38)
  const [tagDisplayMode, setTagDisplayMode] = useState<TagDisplayMode>('hover')
  const [canvasBg, setCanvasBg] = useState<CanvasBgMode>('checker')

  const activeStrokeRef = useRef<CutterStrokeSession | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const brushCursorElRef = useRef<HTMLDivElement | null>(null)

  const undoStackRef = useRef<UndoSnapshot[]>([])
  const redoStackRef = useRef<UndoSnapshot[]>([])
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
  const [imageDecodeRev, setImageDecodeRev] = useState<number>(0)

  // Buffer gốc 4K/8K (dùng khi trích xuất mảnh cắt sắc nét) & Buffer làm việc 60fps
  const fullRawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workRawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workRawDataRef = useRef<ImageData | null>(null)
  const userAlphaOverrideRef = useRef<Int16Array | null>(null)
  const workScaleRef = useRef<number>(1)
  const detectedCornerHexRef = useRef<{ type: ChromaKeySettings['keyColorType']; hex: string }>({
    type: 'chroma_green',
    hex: '#00DB4E'
  })

  const procCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportWrapRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const rafIdRef = useRef<number | null>(null)

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
    if (g > 130 && g > r + 40 && g > b + 40) {
      detectedCornerHexRef.current = { type: 'chroma_green', hex }
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'chroma_green',
        keyColorHex: hex,
        keyColor: hex,
        fringeColorType: 'chroma_green',
        fringeColorHex: hex
      }))
    } else if (r > 235 && g > 235 && b > 235) {
      detectedCornerHexRef.current = { type: 'pure_white', hex: '#FFFFFF' }
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'pure_white',
        keyColorHex: '#FFFFFF',
        keyColor: '#FFFFFF',
        fringeColorType: 'pure_white',
        fringeColorHex: '#FFFFFF'
      }))
    } else if (r < 20 && g < 20 && b < 20) {
      detectedCornerHexRef.current = { type: 'pure_black', hex: '#000000' }
      setChroma((prev) => ({
        ...prev,
        keyColorType: 'pure_black',
        keyColorHex: '#000000',
        keyColor: '#000000',
        fringeColorType: 'pure_black',
        fringeColorHex: '#000000'
      }))
    } else {
      detectedCornerHexRef.current = { type: 'custom', hex }
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

  // Bước 1: Giải mã ảnh CHỈ KHI imageUrl thay đổi (loại bỏ hoàn toàn việc decode lại ảnh 4K/8K khi kéo slider)
  useEffect(() => {
    if (!imageUrl) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const naturalW = img.naturalWidth || 665
      const naturalH = img.naturalHeight || 702
      setImgNaturalSize({ w: naturalW, h: naturalH })

      // 1. Lưu ảnh gốc 4K/8K vào fullRawCanvasRef để cắt xuất mảnh sắc nét 100%
      let fullRaw = fullRawCanvasRef.current
      if (!fullRaw) {
        fullRaw = document.createElement('canvas')
        fullRawCanvasRef.current = fullRaw
      }
      fullRaw.width = naturalW
      fullRaw.height = naturalH
      const fctx = fullRaw.getContext('2d', { willReadFrequently: true })
      if (fctx) fctx.drawImage(img, 0, 0)

      // 2. Tạo working buffer (tối đa 1280px) để mọi thao tác tách nền & cọ vẽ chạy mượt 60fps
      const wScale = Math.min(1, MAX_WORK_DIM / Math.max(naturalW, naturalH))
      const workW = Math.max(1, Math.round(naturalW * wScale))
      const workH = Math.max(1, Math.round(naturalH * wScale))
      workScaleRef.current = wScale

      let workRaw = workRawCanvasRef.current
      if (!workRaw) {
        workRaw = document.createElement('canvas')
        workRawCanvasRef.current = workRaw
      }
      workRaw.width = workW
      workRaw.height = workH
      const rctx = workRaw.getContext('2d', { willReadFrequently: true })
      if (!rctx) return
      rctx.imageSmoothingEnabled = true
      rctx.imageSmoothingQuality = 'high'
      rctx.drawImage(img, 0, 0, workW, workH)
      workRawDataRef.current = rctx.getImageData(0, 0, workW, workH)
      userAlphaOverrideRef.current = new Int16Array(workW * workH).fill(-1)

      undoStackRef.current = []
      redoStackRef.current = []
      setCanUndo(false)
      setCanRedo(false)

      const proc = procCanvasRef.current
      if (proc) {
        proc.width = workW
        proc.height = workH
      }

      detectCornerBgPreset(rctx)
      setImageDecodeRev((r) => r + 1)
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl, detectCornerBgPreset])

  // Bước 2: Chạy bộ lọc Chroma Key trên working buffer qua requestAnimationFrame (60fps, <5ms/frame)
  const runChromaAndScan = useCallback(() => {
    const workRaw = workRawCanvasRef.current
    const proc = procCanvasRef.current
    const cachedRawData = workRawDataRef.current
    if (!workRaw || !proc || !cachedRawData) return

    const rctx = workRaw.getContext('2d', { willReadFrequently: true })
    const pctx = proc.getContext('2d', { willReadFrequently: true })
    if (!rctx || !pctx) return

    const workW = workRaw.width
    const workH = workRaw.height
    const wScale = workScaleRef.current

    // Quy đổi các bán kính sang tỷ lệ working buffer để viền hiển thị khớp với ảnh gốc
    const scaledChroma: ChromaKeySettings =
      wScale < 1
        ? {
            ...chroma,
            featherRadius: Number((chroma.featherRadius * wScale).toFixed(2)),
            chokeAmount: Number((chroma.chokeAmount * wScale).toFixed(2)),
            strokeWidth: chroma.strokeWidth > 0 ? Math.max(1, Math.round(chroma.strokeWidth * wScale)) : 0,
            despeckleArea: Math.max(0, Math.round(chroma.despeckleArea * wScale * wScale))
          }
        : chroma

    applyChromaKey(
      rctx,
      pctx,
      workW,
      workH,
      scaledChroma,
      cachedRawData,
      userAlphaOverrideRef.current
    )

    if (chroma.enabled && chroma.previewMode !== 'original') {
      const pData = pctx.getImageData(0, 0, workW, workH).data
      const scanned = scanRawIslandsFromData(pData, workW, workH, 1 / wScale)
      setRawIslands(scanned)
    } else {
      setRawIslands([])
    }
  }, [chroma])

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      runChromaAndScan()
    })
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [runChromaAndScan, imageDecodeRev])

  // Bước 3: Gom cụm & lọc mảnh cắt trong <0.1ms khi kéo thanh trượt Lọc vụn / Gom nét gần (không quét lại pixel)
  const islands = useMemo(() => {
    if (!chroma.enabled || chroma.previewMode === 'original' || rawIslands.length === 0) {
      return []
    }
    return clusterAndFilterIslands(
      rawIslands,
      imgNaturalSize.w,
      imgNaturalSize.h,
      minIslandArea,
      mergeGap
    )
  }, [rawIslands, imgNaturalSize.w, imgNaturalSize.h, minIslandArea, mergeGap, chroma.enabled, chroma.previewMode])

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

  const extractPieceFromBox = useCallback(
    (box: { x: number; y: number; width: number; height: number }, polygon?: CutPoint[]) => {
      const proc = procCanvasRef.current
      if (!proc) return ''
      return extractRegionDataUrl(proc, box, polygon, fullRawCanvasRef.current, chroma)
    },
    [chroma]
  )

  const handleSelectIsland = useCallback(
    (isl: DetectedIsland) => {
      setSelectedIslandId(isl.id)
      setMarquee(null)
      setLassoPoints([])

      const dataUrl = extractPieceFromBox(isl)
      if (!dataUrl) return
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
    [extractPieceFromBox, onSelectPiece]
  )

  const handleQuickAddIsland = useCallback(
    (isl: DetectedIsland) => {
      const dataUrl = extractPieceFromBox(isl)
      if (!dataUrl) return
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
    [extractPieceFromBox, onSelectPiece, onTransferToTarget]
  )

  const handleSendAllToBoard = useCallback(() => {
    if (activeIslands.length === 0) return
    const centerX = imgNaturalSize.w / 2
    const centerY = imgNaturalSize.h / 2
    const scaleToBoard = Math.min(1, 460 / Math.max(imgNaturalSize.w, imgNaturalSize.h))

    for (const isl of activeIslands) {
      const dataUrl = extractPieceFromBox(isl)
      if (!dataUrl) continue
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
  }, [activeIslands, extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onTransferToTarget])

  const rescanAfterManualEdit = useCallback((pctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (chroma.enabled && chroma.previewMode !== 'original') {
      const pData = pctx.getImageData(0, 0, w, h).data
      setRawIslands(scanRawIslandsFromData(pData, w, h, 1 / workScaleRef.current))
    }
  }, [chroma.enabled, chroma.previewMode])

  const pushUndoSnapshot = useCallback((pctx: CanvasRenderingContext2D, w: number, h: number) => {
    const snapImg = pctx.getImageData(0, 0, w, h)
    const snapAlpha = userAlphaOverrideRef.current
      ? new Int16Array(userAlphaOverrideRef.current)
      : new Int16Array(w * h).fill(-1)
    undoStackRef.current.push({ imageData: snapImg, alphaOverride: snapAlpha })
    if (undoStackRef.current.length > 20) undoStackRef.current.shift()
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const handleUndo = useCallback(() => {
    const proc = procCanvasRef.current
    if (!proc || undoStackRef.current.length === 0) return
    const pctx = proc.getContext('2d', { willReadFrequently: true })
    if (!pctx) return
    const currentSnap: UndoSnapshot = {
      imageData: pctx.getImageData(0, 0, proc.width, proc.height),
      alphaOverride: userAlphaOverrideRef.current
        ? new Int16Array(userAlphaOverrideRef.current)
        : new Int16Array(proc.width * proc.height).fill(-1)
    }
    redoStackRef.current.push(currentSnap)
    const prevSnap = undoStackRef.current.pop()!
    pctx.putImageData(prevSnap.imageData, 0, 0)
    userAlphaOverrideRef.current = new Int16Array(prevSnap.alphaOverride)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
    rescanAfterManualEdit(pctx, proc.width, proc.height)
  }, [rescanAfterManualEdit])

  const handleRedo = useCallback(() => {
    const proc = procCanvasRef.current
    if (!proc || redoStackRef.current.length === 0) return
    const pctx = proc.getContext('2d', { willReadFrequently: true })
    if (!pctx) return
    const currentSnap: UndoSnapshot = {
      imageData: pctx.getImageData(0, 0, proc.width, proc.height),
      alphaOverride: userAlphaOverrideRef.current
        ? new Int16Array(userAlphaOverrideRef.current)
        : new Int16Array(proc.width * proc.height).fill(-1)
    }
    undoStackRef.current.push(currentSnap)
    const nextSnap = redoStackRef.current.pop()!
    pctx.putImageData(nextSnap.imageData, 0, 0)
    userAlphaOverrideRef.current = new Int16Array(nextSnap.alphaOverride)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    rescanAfterManualEdit(pctx, proc.width, proc.height)
  }, [rescanAfterManualEdit])

  const handleCopyPiece = useCallback(() => {
    if (!selectedPiece) return
    try {
      ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = selectedPiece
      setCopiedBadge(true)
      setTimeout(() => setCopiedBadge(false), 2000)
    } catch {}
  }, [selectedPiece])

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
  }, [eyedropperTarget, handleUndo, handleRedo, selectedPiece, handleCopyPiece])

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
    const workW = e.currentTarget.width
    const workH = e.currentTarget.height
    const sxWork = workW / Math.max(1, rect.width)
    const syWork = workH / Math.max(1, rect.height)
    const sxNat = imgNaturalSize.w / Math.max(1, rect.width)
    const syNat = imgNaturalSize.h / Math.max(1, rect.height)
    return {
      workX: Math.round((e.clientX - rect.left) * sxWork),
      workY: Math.round((e.clientY - rect.top) * syWork),
      natX: Math.round((e.clientX - rect.left) * sxNat),
      natY: Math.round((e.clientY - rect.top) * syNat),
      canvasX: Math.round(e.clientX - rect.left),
      canvasY: Math.round(e.clientY - rect.top)
    }
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { workX, workY, natX, natY, canvasX, canvasY } = getCanvasCoords(e)

    if (eyedropperTarget) {
      const sourceCanvas =
        eyedropperTarget === 'key'
          ? workRawCanvasRef.current || procCanvasRef.current
          : procCanvasRef.current || workRawCanvasRef.current
      if (sourceCanvas) {
        const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
        if (sctx) {
          const sample = sampleEyedropperAtPoint(
            sctx,
            sourceCanvas.width,
            sourceCanvas.height,
            workX,
            workY,
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

    // Công cụ Đũa thần (Magic Wand): Click 1 phát xóa sạch (hoặc Alt+Click khôi phục) hốc nền kẹt kín
    if (tool === 'wand') {
      const workRaw = workRawCanvasRef.current
      const proc = procCanvasRef.current
      const rawData = workRawDataRef.current
      if (workRaw && proc && rawData) {
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (pctx) {
          pushUndoSnapshot(pctx, proc.width, proc.height)
          const pImg = pctx.getImageData(0, 0, proc.width, proc.height)
          const changed = applyMagicWandFlood(
            pImg.data,
            rawData.data,
            proc.width,
            proc.height,
            workX,
            workY,
            wandTolerance,
            e.altKey ? 'restore' : 'erase',
            userAlphaOverrideRef.current
          )
          if (changed > 0) {
            pctx.putImageData(pImg, 0, 0)
            rescanAfterManualEdit(pctx, proc.width, proc.height)
          }
        }
      }
      return
    }

    if (tool === 'eraser' || tool === 'restore') {
      setIsDrawing(true)
      const workRaw = workRawCanvasRef.current
      const proc = procCanvasRef.current
      if (workRaw && proc) {
        const rctx = workRaw.getContext('2d', { willReadFrequently: true })
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (rctx && pctx) {
          pushUndoSnapshot(pctx, proc.width, proc.height)
          const scaledRadius = Math.max(1, brushRadius * workScaleRef.current)
          const stroke = createCutterStroke(
            pctx,
            rctx,
            proc.width,
            proc.height,
            {
              radius: scaledRadius,
              hardness: brushHardness,
              opacity: brushOpacity,
              isEraser: tool === 'eraser'
            },
            userAlphaOverrideRef.current
          )
          stroke.segment({ x: workX, y: workY }, { x: workX, y: workY })
          stroke.commit()
          activeStrokeRef.current = stroke
          lastPointRef.current = { x: workX, y: workY }
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
      setMarquee({ startX: natX, startY: natY, currentX: natX, currentY: natY })
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    } else if (tool === 'lasso') {
      setIsDrawing(true)
      setSelectedIslandId(null)
      setLassoPoints([{ x: natX, y: natY }])
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const { workX, workY, natX, natY, canvasX, canvasY } = getCanvasCoords(e)

    if (eyedropperTarget) {
      const sourceCanvas =
        eyedropperTarget === 'key'
          ? workRawCanvasRef.current || procCanvasRef.current
          : procCanvasRef.current || workRawCanvasRef.current
      if (sourceCanvas) {
        const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
        if (sctx) {
          setEyedropperSample(
            sampleEyedropperAtPoint(
              sctx,
              sourceCanvas.width,
              sourceCanvas.height,
              workX,
              workY,
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

    // Cập nhật vị trí vòng tròn con trỏ cọ trực tiếp qua DOM ref (không gây re-render React)
    if ((tool === 'eraser' || tool === 'restore') && brushCursorElRef.current) {
      brushCursorElRef.current.style.display = 'block'
      brushCursorElRef.current.style.left = `${canvasX}px`
      brushCursorElRef.current.style.top = `${canvasY}px`
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
      setMarquee({ ...marquee, currentX: natX, currentY: natY })
    } else if (tool === 'lasso') {
      setLassoPoints((pts) => [...pts, { x: natX, y: natY }])
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
      const pctx = proc.getContext('2d', { willReadFrequently: true })
      if (pctx) rescanAfterManualEdit(pctx, proc.width, proc.height)
      return
    }

    if (tool === 'box' && marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX)
      const minY = Math.min(marquee.startY, marquee.currentY)
      const w = Math.abs(marquee.currentX - marquee.startX)
      const h = Math.abs(marquee.currentY - marquee.startY)
      if (w >= 10 && h >= 10) {
        const box = { x: minX, y: minY, width: w, height: h }
        const dataUrl = extractPieceFromBox(box)
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
        const dataUrl = extractPieceFromBox(box, lassoPoints)
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

  const handleResetAllChroma = useCallback(() => {
    if (userAlphaOverrideRef.current) {
      userAlphaOverrideRef.current.fill(-1)
    }
    const corner = detectedCornerHexRef.current
    setChroma({
      ...DEFAULT_CHROMA_SETTINGS,
      keyColorType: corner.type,
      keyColorHex: corner.hex,
      keyColor: corner.hex,
      fringeColorType: corner.type === 'pure_black' ? 'pure_white' : corner.type,
      fringeColorHex: corner.hex
    })
  }, [])

  const availW = Math.max(180, viewportSize.w - 28)
  const availH = Math.max(180, viewportSize.h - 28)
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
    const next = Math.min(2.5, Math.max(0.15, Number((effectiveScale + delta).toFixed(2))))
    setZoomMode(next)
  }

  return (
    <div className="layer-cutter-pane left-pane" ref={containerRef}>
      {/* Pane Header: Tiêu đề + Nhãn/Nền + Thu phóng + Nạp ảnh (Không bao giờ bị che khuất) */}
      <div className="layer-cutter-header">
        <div className="layer-cutter-title">
          <IconScissors width={14} height={14} />
          <strong>Nguồn ảnh & Tách nền Studio</strong>
          <span className="layer-cutter-badge-pill">{activeIslands.length} mảnh</span>
          <span className="layer-cutter-badge" title="Kích thước ảnh gốc">
            {imgNaturalSize.w}×{imgNaturalSize.h}px
          </span>
        </div>

        <div className="layer-cutter-actions">
          {(tool === 'auto' || tool === 'grid') && (
            <div className="layer-cutter-seg-mini" title="Chế độ hiển thị nhãn tên trên mảnh cắt">
              <span className="seg-label">Nhãn</span>
              {(['hover', 'always', 'hidden'] as TagDisplayMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`seg-btn ${tagDisplayMode === m ? 'active' : ''}`}
                  onClick={() => setTagDisplayMode(m)}
                >
                  {m === 'hover' ? 'Trỏ' : m === 'always' ? 'Luôn' : 'Ẩn'}
                </button>
              ))}
            </div>
          )}

          <div className="layer-cutter-seg-mini" title="Phông nền vùng làm việc để soi viền ảnh">
            <span className="seg-label">Nền</span>
            {(['checker', 'dark', 'light'] as CanvasBgMode[]).map((bg) => (
              <button
                key={bg}
                type="button"
                className={`seg-btn ${canvasBg === bg ? 'active' : ''}`}
                onClick={() => setCanvasBg(bg)}
              >
                {bg === 'checker' ? 'Caro' : bg === 'dark' ? 'Tối' : 'Sáng'}
              </button>
            ))}
          </div>

          <div className="layer-cutter-zoom-pill" title="Thu phóng khung nhìn ảnh nguồn">
            <button type="button" className="stepper-btn" onClick={() => stepZoom(-0.15)}>
              -
            </button>
            <button
              type="button"
              className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
              onClick={() => setZoomMode('fit')}
            >
              Vừa ({Math.round(effectiveScale * 100)}%)
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
            title="Tải ảnh sprite sheet từ máy tính (Hỗ trợ mượt ảnh 4K/8K)"
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
            <IconRefresh width={12} height={12} /> Mẫu
          </button>
        </div>
      </div>

      {/* Thanh công cụ + Bảng Studio Tách nền & Khử viền chuyên sâu (2 Sub-tabs gọn gàng) */}
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
        onResetChroma={handleResetAllChroma}
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

      {/* Thanh cấu hình Đũa Thần / Cọ Tẩy / Khôi Phục */}
      {(tool === 'wand' || tool === 'eraser' || tool === 'restore') && (
        <CutterBrushSubBar
          tool={tool}
          brushRadius={brushRadius}
          brushHardness={brushHardness}
          brushOpacity={brushOpacity}
          wandTolerance={wandTolerance}
          canUndo={canUndo}
          canRedo={canRedo}
          onChangeRadius={setBrushRadius}
          onChangeHardness={setBrushHardness}
          onChangeOpacity={setBrushOpacity}
          onChangeWandTolerance={setWandTolerance}
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
                  : tool === 'wand' || tool === 'box' || tool === 'lasso'
                    ? 'crosshair'
                    : 'default'
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={() => {
              if (brushCursorElRef.current) {
                brushCursorElRef.current.style.display = 'none'
              }
              setEyedropperSample(null)
            }}
          />

          {(tool === 'eraser' || tool === 'restore') && !eyedropperTarget && (
            <div
              ref={brushCursorElRef}
              className="layer-cutter-brush-cursor"
              style={{
                display: 'none',
                width: `${Math.max(4, brushRadius * 2 * scaleX)}px`,
                height: `${Math.max(4, brushRadius * 2 * scaleY)}px`
              }}
            />
          )}

          {/* Hiển thị các khung mảnh cắt (Tự động hoặc Lưới) */}
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
                  title={`${isl.label} — Click chọn · Nhấp đúp hoặc kéo sang phải để đưa vào Bố cục 2D`}
                >
                  <span className={`layer-cutter-island-tag ${tagPlacementClass}`}>
                    {isl.label?.replace(/\s*\(\d+×\d+\)$/, '')}
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
          mergeGap={mergeGap}
          onChangeMinIslandArea={setMinIslandArea}
          onChangeMergeGap={setMergeGap}
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
              Chọn mảnh bên trên hoặc nhấp đúp trên ảnh để đưa sang Bố cục 2D
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
