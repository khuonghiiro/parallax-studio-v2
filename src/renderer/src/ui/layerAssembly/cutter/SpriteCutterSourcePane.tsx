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
  clusterAndFilterIslands,
  extractRegionDataUrl,
  createCutterStroke,
  sampleEyedropperAtPoint,
  type CutterStrokeSession
} from './chromaKey'
import {
  computeGridIslands,
  applyMagicWandFlood
} from './chromaAdvancedProcessor'
import {
  detectCornerBackground,
  computeCanvasPointerCoords
} from './cutterHelpers'
import { CutterBrushSubBar } from './CutterBrushSubBar'
import { CutterGridSubBar, CutterQuickPartsStrip } from './CutterSlicesBar'
import { PhotoshopEyedropperOverlay } from './PhotoshopEyedropperOverlay'
import {
  SpriteCutterSourceToolbar,
  type CanvasBgMode,
  type TagDisplayMode
} from './SpriteCutterSourceToolbar'
import { resolveCanvasBgState } from './CutterCanvasBgToggle'
import { SpriteCutterHeader } from './SpriteCutterHeader'
import { SpriteCutterFooter } from './SpriteCutterFooter'
import { SpriteCutterOverlays } from './SpriteCutterOverlays'
import { useCutterUndoRedo } from './useCutterUndoRedo'
import { useChromaPreviewWorker } from './useChromaPreviewWorker'
import { useCutterViewportZoom } from './useCutterViewportZoom'
import { extractHighResRegionDataUrl } from './highResCutterExport'
import { SAMPLE_ANIME_SPRITESHEET_URL } from './sampleSpriteSheet'

/** Độ phân giải buffer tương tác tối đa để đảm bảo 60fps trên cả ảnh 4K/8K (vẫn giữ ảnh gốc 4K/8K khi cắt xuất mảnh) */
const MAX_WORK_DIM = 1280

export interface SpriteCutterSourcePaneProps {
  onSelectPiece: (piece: CutPiece | null) => void
  onTransferToTarget: (piece: CutPiece, pos?: { x: number; y: number }) => void
  selectedPiece: CutPiece | null
  targetBoardSize?: { width: number; height: number }
}

export function SpriteCutterSourcePane({
  onSelectPiece,
  onTransferToTarget,
  selectedPiece,
  targetBoardSize
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
  const [canvasBg, setCanvasBg] = useState<CanvasBgMode>('checker-dark')

  const activeStrokeRef = useRef<CutterStrokeSession | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const brushCursorElRef = useRef<HTMLDivElement | null>(null)
  const isManualEditingRef = useRef(false)

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

  const {
    zoomMode,
    panOffset,
    effectiveScale,
    displayW,
    displayH,
    scaleX,
    scaleY,
    stepZoom,
    handleSetZoomMode,
    resetZoomToFit
  } = useCutterViewportZoom({
    viewportRef: viewportWrapRef,
    naturalWidth: imgNaturalSize.w,
    naturalHeight: imgNaturalSize.h
  })

  const { requestProcessing: requestChromaProcessing } = useChromaPreviewWorker({
    chroma,
    imageRevision: imageDecodeRev,
    rawDataRef: workRawDataRef,
    procCanvasRef,
    alphaOverrideRef: userAlphaOverrideRef,
    workScaleRef,
    pausedRef: isManualEditingRef,
    onIslands: setRawIslands
  })

  // Tự động phát hiện màu góc ảnh khi nạp ảnh mới
  const detectCornerBgPreset = useCallback((rctx: CanvasRenderingContext2D) => {
    const preset = detectCornerBackground(rctx)
    if (!preset) return
    detectedCornerHexRef.current = preset
    const { type, hex } = preset
    setChroma((prev) => ({
      ...prev,
      keyColorType: type,
      keyColorHex: hex,
      keyColor: hex,
      fringeColorType: type === 'pure_black' ? 'pure_white' : type,
      fringeColorHex: type === 'pure_black' ? '#FFFFFF' : hex
    }))
  }, [])

  // Tái quét mảnh cắt sau khi chỉnh sửa thủ công
  const rescanAfterManualEdit = useCallback(
    () => requestChromaProcessing(),
    [requestChromaProcessing]
  )

  const handleCopyPiece = useCallback(() => {
    if (!selectedPiece) return
    try {
      ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = selectedPiece
      setCopiedBadge(true)
      setTimeout(() => setCopiedBadge(false), 2000)
    } catch {}
  }, [selectedPiece])

  // Hook quản lý hoàn tác Undo/Redo & Phím tắt
  const {
    canUndo,
    canRedo,
    clearStacks,
    pushUndoSnapshot,
    handleUndo,
    handleRedo
  } = useCutterUndoRedo({
    userAlphaOverrideRef,
    onRestoreSnapshot: requestChromaProcessing,
    onCopyPiece: handleCopyPiece,
    hasSelectedPiece: Boolean(selectedPiece),
    isEyedropperActive: Boolean(eyedropperTarget),
    onCancelEyedropper: () => {
      setEyedropperTarget(null)
      setEyedropperSample(null)
    }
  })

  // Bước 1: Nạp ảnh gốc và khởi tạo buffer làm việc downscaled nếu ảnh > MAX_WORK_DIM
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const natW = img.naturalWidth || img.width
      const natH = img.naturalHeight || img.height
      setImgNaturalSize({ w: natW, h: natH })

      // Buffer gốc chuẩn 4K/8K
      let full = fullRawCanvasRef.current
      if (!full) {
        full = document.createElement('canvas')
        fullRawCanvasRef.current = full
      }
      full.width = natW
      full.height = natH
      // Canvas gốc chỉ dùng draw/crop; không ép CPU backing store để tránh khựng khi nạp 8K.
      const fctx = full.getContext('2d')
      if (fctx) {
        fctx.clearRect(0, 0, natW, natH)
        fctx.drawImage(img, 0, 0)
      }

      // Buffer làm việc (Downscale tỷ lệ thuận nếu vượt MAX_WORK_DIM để chạy 60fps)
      const maxDim = Math.max(natW, natH)
      const scale = maxDim > MAX_WORK_DIM ? MAX_WORK_DIM / maxDim : 1
      workScaleRef.current = scale
      const workW = Math.max(1, Math.round(natW * scale))
      const workH = Math.max(1, Math.round(natH * scale))

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
      rctx.clearRect(0, 0, workW, workH)
      rctx.drawImage(img, 0, 0, workW, workH)

      // Lưu lại bản raw ImageData để các công cụ cọ khôi phục pixel gốc tức thì 0ms
      workRawDataRef.current = rctx.getImageData(0, 0, workW, workH)
      userAlphaOverrideRef.current = new Int16Array(workW * workH).fill(-1)
      clearStacks()

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
  }, [imageUrl, detectCornerBgPreset, clearStacks])

  // Bước 2: Worker tách nền + quét đảo ngoài main thread; UI chỉ gom cụm kết quả.
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
    async (box: { x: number; y: number; width: number; height: number }, polygon?: CutPoint[]) => {
      const proc = procCanvasRef.current
      if (!proc) return ''
      const hasManualEdits = Boolean(
        userAlphaOverrideRef.current?.some((alpha) => alpha >= 0)
      )
      try {
        return await extractHighResRegionDataUrl(
          proc,
          box,
          polygon,
          fullRawCanvasRef.current,
          chroma,
          hasManualEdits
        )
      } catch {
        return extractRegionDataUrl(proc, box, polygon, fullRawCanvasRef.current, chroma)
      }
    },
    [chroma]
  )

  const handleSelectIsland = useCallback(
    async (isl: DetectedIsland) => {
      setSelectedIslandId(isl.id)
      setMarquee(null)
      setLassoPoints([])

      const dataUrl = await extractPieceFromBox(isl)
      if (!dataUrl) return
      const piece: CutPiece = {
        id: isl.id,
        dataUrl,
        width: isl.width,
        height: isl.height,
        label: isl.label || 'Mảnh cắt',
        sourceBox: isl,
        sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
      }
      try {
        ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
      } catch {}
      onSelectPiece(piece)
    },
    [extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onSelectPiece]
  )

  const handleQuickAddIsland = useCallback(
    async (isl: DetectedIsland) => {
      const dataUrl = await extractPieceFromBox(isl)
      if (!dataUrl) return
      const piece: CutPiece = {
        id: isl.id,
        dataUrl,
        width: isl.width,
        height: isl.height,
        label: isl.label || 'Mảnh cắt',
        sourceBox: isl,
        sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
      }
      onSelectPiece(piece)
      onTransferToTarget(piece, { x: 0, y: 0 })
    },
    [extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onSelectPiece, onTransferToTarget]
  )

  const handleSendAllToBoard = useCallback(async () => {
    if (activeIslands.length === 0) return
    const centerX = imgNaturalSize.w / 2
    const centerY = imgNaturalSize.h / 2
    const boardMin = Math.min(targetBoardSize?.width || 600, targetBoardSize?.height || 600)
    const scaleToBoard = Math.min(1, (boardMin * 0.76) / Math.max(imgNaturalSize.w, imgNaturalSize.h))

    for (const isl of activeIslands) {
      const dataUrl = await extractPieceFromBox(isl)
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
          sourceBox: isl,
          sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
        },
        { x: relX, y: relY }
      )
    }
  }, [activeIslands, extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onTransferToTarget, targetBoardSize])

  const getCurrentTargetHex = useCallback(
    (t: EyedropperTarget | null) => {
      if (t === 'fringe') return chroma.fringeColorHex || chroma.keyColorHex || '#00DB4E'
      if (t === 'smooth') return chroma.smoothColorHex || '#000000'
      return chroma.keyColorHex || '#00DB4E'
    },
    [chroma.fringeColorHex, chroma.keyColorHex, chroma.smoothColorHex]
  )

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { workX, workY, natX, natY, canvasX, canvasY } = computeCanvasPointerCoords(
      e,
      imgNaturalSize.w,
      imgNaturalSize.h
    )

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

    // Công cụ Đũa thần (Magic Wand)
    if (tool === 'wand') {
      const workRaw = workRawCanvasRef.current
      const proc = procCanvasRef.current
      const rawData = workRawDataRef.current
      if (workRaw && proc && rawData) {
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (pctx) {
          pushUndoSnapshot(proc.width, proc.height)
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
            rescanAfterManualEdit()
          }
        }
      }
      return
    }

    if (tool === 'eraser' || tool === 'restore') {
      isManualEditingRef.current = true
      setIsDrawing(true)
      const workRaw = workRawCanvasRef.current
      const proc = procCanvasRef.current
      if (workRaw && proc) {
        const rctx = workRaw.getContext('2d', { willReadFrequently: true })
        const pctx = proc.getContext('2d', { willReadFrequently: true })
        if (rctx && pctx) {
          pushUndoSnapshot(proc.width, proc.height)
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
            userAlphaOverrideRef.current,
            workRawDataRef.current
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
    const { workX, workY, natX, natY, canvasX, canvasY } = computeCanvasPointerCoords(
      e,
      imgNaturalSize.w,
      imgNaturalSize.h
    )

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

  const handleCanvasPointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setIsDrawing(false)
    if (tool === 'eraser' || tool === 'restore') isManualEditingRef.current = false
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
      if (pctx) rescanAfterManualEdit()
      return
    }

    if (tool === 'box' && marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX)
      const minY = Math.min(marquee.startY, marquee.currentY)
      const w = Math.abs(marquee.currentX - marquee.startX)
      const h = Math.abs(marquee.currentY - marquee.startY)
      if (w >= 10 && h >= 10) {
        const box = { x: minX, y: minY, width: w, height: h }
        const dataUrl = await extractPieceFromBox(box)
        const piece: CutPiece = {
          id: `box-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: `Vùng ${w}×${h}px`,
          sourceBox: box,
          sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
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
        const dataUrl = await extractPieceFromBox(box, lassoPoints)
        const piece: CutPiece = {
          id: `lasso-${Date.now()}`,
          dataUrl,
          width: w,
          height: h,
          label: 'Vùng tự do',
          sourceBox: box,
          sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
        }
        try {
          ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = piece
        } catch {}
        onSelectPiece(piece)
      }
    }
  }

  const handleDragStart = (e: React.DragEvent, piece: CutPiece) => {
    const enriched: CutPiece = piece.sourceImageSize
      ? piece
      : { ...piece, sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h } }
    e.dataTransfer.setData('application/json', JSON.stringify(enriched))
    e.dataTransfer.setData('text/plain', enriched.dataUrl)
    e.dataTransfer.effectAllowed = 'copyMove'
    ;(window as unknown as { __parallax_cut_part?: CutPiece }).__parallax_cut_part = enriched
  }

  const handleIslandDragStart = (e: React.DragEvent, isl: DetectedIsland) => {
    setSelectedIslandId(isl.id)
    if (selectedPiece && selectedPiece.id === isl.id && selectedPiece.dataUrl) {
      handleDragStart(e, selectedPiece)
      return
    }
    const proc = procCanvasRef.current
    if (!proc) return
    const syncDataUrl = extractRegionDataUrl(
      proc,
      isl,
      undefined,
      fullRawCanvasRef.current,
      chroma
    )
    if (!syncDataUrl) return
    const syncPiece: CutPiece = {
      id: isl.id,
      dataUrl: syncDataUrl,
      width: isl.width,
      height: isl.height,
      label: isl.label || 'Mảnh cắt',
      sourceBox: isl,
      sourceImageSize: { width: imgNaturalSize.w, height: imgNaturalSize.h }
    }
    handleDragStart(e, syncPiece)
    onSelectPiece(syncPiece)
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

  const bgCssClass = resolveCanvasBgState(canvasBg).cssClass

  return (
    <div className="layer-cutter-pane left-pane" ref={containerRef}>
      {/* Pane Header: Tiêu đề + Nhãn/Nền + Thu phóng + Nạp ảnh */}
      <SpriteCutterHeader
        activeIslandsCount={activeIslands.length}
        imgNaturalSize={imgNaturalSize}
        tool={tool}
        tagDisplayMode={tagDisplayMode}
        canvasBg={canvasBg}
        zoomMode={zoomMode}
        effectiveScale={effectiveScale}
        onChangeTagDisplayMode={setTagDisplayMode}
        onChangeCanvasBg={setCanvasBg}
        onStepZoom={stepZoom}
        onSetZoomMode={handleSetZoomMode}
        onFileUpload={(e) => {
          handleFileUpload(e)
          resetZoomToFit()
        }}
        onResetSample={() => {
          setImageUrl(SAMPLE_ANIME_SPRITESHEET_URL)
          resetZoomToFit()
        }}
      />

      {/* Thanh công cụ + Bảng Studio Tách nền & Khử viền chuyên sâu */}
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
        className={`layer-cutter-canvas-wrap ${bgCssClass}`}
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
          style={{
            width: `${displayW}px`,
            height: `${displayH}px`,
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`
          }}
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
            onPointerCancel={handleCanvasPointerUp}
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

          {/* Các khung mảnh cắt, marquee, lasso */}
          <SpriteCutterOverlays
            tool={tool}
            eyedropperTarget={eyedropperTarget}
            activeIslands={activeIslands}
            selectedIslandId={selectedIslandId}
            selectedPiece={selectedPiece}
            scaleX={scaleX}
            scaleY={scaleY}
            marquee={marquee}
            lassoPoints={lassoPoints}
            isDrawing={isDrawing}
            copiedBadge={copiedBadge}
            onSelectIsland={handleSelectIsland}
            onQuickAddIsland={handleQuickAddIsland}
            onDragStart={handleDragStart}
            onIslandDragStart={handleIslandDragStart}
            onTransferToTarget={onTransferToTarget}
            onCopyPiece={handleCopyPiece}
          />
        </div>
      </div>

      {/* Dải Danh Sách Mảnh Cắt Trực Quan */}
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
          onIslandDragStart={handleIslandDragStart}
          onSendAllToBoard={handleSendAllToBoard}
        />
      )}

      {/* Footer Info & Actions */}
      <SpriteCutterFooter
        selectedPiece={selectedPiece}
        copiedBadge={copiedBadge}
        onCopyPiece={handleCopyPiece}
        onTransferToTarget={(piece) => onTransferToTarget(piece)}
      />
    </div>
  )
}
