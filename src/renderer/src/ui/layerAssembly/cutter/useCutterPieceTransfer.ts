import { useCallback } from 'react'
import type { ChromaKeySettings, CutPiece, CutPoint, DetectedIsland } from './types'
import { extractRegionDataUrl } from './chromaKey'
import { extractHighResRegionDataUrl } from './highResCutterExport'

export interface UseCutterPieceTransferOptions {
  procCanvasRef: React.RefObject<HTMLCanvasElement | null>
  fullRawCanvasRef: React.RefObject<HTMLCanvasElement | null>
  userAlphaOverrideRef: React.RefObject<Int16Array | null>
  chroma: ChromaKeySettings
  imgNaturalSize: { w: number; h: number }
  targetBoardSize?: { width: number; height: number }
  activeIslands: DetectedIsland[]
  onSelectPiece: (piece: CutPiece | null) => void
  onTransferToTarget: (piece: CutPiece, pos?: { x: number; y: number }) => void
  setSelectedIslandId: (id: string | null) => void
  setMarquee: (m: null) => void
  setLassoPoints: (p: CutPoint[]) => void
}

export function useCutterPieceTransfer({
  procCanvasRef,
  fullRawCanvasRef,
  userAlphaOverrideRef,
  chroma,
  imgNaturalSize,
  targetBoardSize,
  activeIslands,
  onSelectPiece,
  onTransferToTarget,
  setSelectedIslandId,
  setMarquee,
  setLassoPoints
}: UseCutterPieceTransferOptions) {
  const extractPieceFromBox = useCallback(
    async (
      box: { x: number; y: number; width: number; height: number },
      polygon?: CutPoint[],
      siblingBoxes?: Array<{ x: number; y: number; width: number; height: number }>
    ) => {
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
          hasManualEdits,
          siblingBoxes
        )
      } catch {
        return extractRegionDataUrl(proc, box, polygon, fullRawCanvasRef.current, chroma, siblingBoxes)
      }
    },
    [chroma, fullRawCanvasRef, procCanvasRef, userAlphaOverrideRef]
  )

  const handleSelectIsland = useCallback(
    async (isl: DetectedIsland) => {
      setSelectedIslandId(isl.id)
      setMarquee(null)
      setLassoPoints([])

      const siblingBoxes = activeIslands.filter((o) => o.id !== isl.id)
      const dataUrl = await extractPieceFromBox(isl, undefined, siblingBoxes)
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
    [activeIslands, extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onSelectPiece, setLassoPoints, setMarquee, setSelectedIslandId]
  )

  const handleQuickAddIsland = useCallback(
    async (isl: DetectedIsland) => {
      const siblingBoxes = activeIslands.filter((o) => o.id !== isl.id)
      const dataUrl = await extractPieceFromBox(isl, undefined, siblingBoxes)
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
    [activeIslands, extractPieceFromBox, imgNaturalSize.w, imgNaturalSize.h, onSelectPiece, onTransferToTarget]
  )

  const handleSendAllToBoard = useCallback(async () => {
    if (activeIslands.length === 0) return
    const centerX = imgNaturalSize.w / 2
    const centerY = imgNaturalSize.h / 2
    const boardMin = Math.min(targetBoardSize?.width || 600, targetBoardSize?.height || 600)
    const scaleToBoard = Math.min(1, (boardMin * 0.76) / Math.max(imgNaturalSize.w, imgNaturalSize.h))

    for (const isl of activeIslands) {
      const siblingBoxes = activeIslands.filter((o) => o.id !== isl.id)
      const dataUrl = await extractPieceFromBox(isl, undefined, siblingBoxes)
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

  return {
    extractPieceFromBox,
    handleSelectIsland,
    handleQuickAddIsland,
    handleSendAllToBoard
  }
}
