import { useRef, useState, useCallback, useEffect } from 'react'

export interface UndoSnapshot {
  imageData: ImageData
  alphaOverride: Int16Array
}

export interface UseCutterUndoRedoOptions {
  procCanvasRef: React.RefObject<HTMLCanvasElement | null>
  userAlphaOverrideRef: React.MutableRefObject<Int16Array | null>
  onRescanAfterManualEdit: (pctx: CanvasRenderingContext2D, w: number, h: number) => void
  onCopyPiece?: () => void
  hasSelectedPiece?: boolean
  isEyedropperActive?: boolean
  onCancelEyedropper?: () => void
}

export function useCutterUndoRedo({
  procCanvasRef,
  userAlphaOverrideRef,
  onRescanAfterManualEdit,
  onCopyPiece,
  hasSelectedPiece,
  isEyedropperActive,
  onCancelEyedropper
}: UseCutterUndoRedoOptions) {
  const undoStackRef = useRef<UndoSnapshot[]>([])
  const redoStackRef = useRef<UndoSnapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const clearStacks = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  const pushUndoSnapshot = useCallback(
    (pctx: CanvasRenderingContext2D, w: number, h: number) => {
      const snapImg = pctx.getImageData(0, 0, w, h)
      const snapAlpha = userAlphaOverrideRef.current
        ? new Int16Array(userAlphaOverrideRef.current)
        : new Int16Array(w * h).fill(-1)
      undoStackRef.current.push({ imageData: snapImg, alphaOverride: snapAlpha })
      if (undoStackRef.current.length > 20) undoStackRef.current.shift()
      redoStackRef.current = []
      setCanUndo(true)
      setCanRedo(false)
    },
    [userAlphaOverrideRef]
  )

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
    onRescanAfterManualEdit(pctx, proc.width, proc.height)
  }, [procCanvasRef, userAlphaOverrideRef, onRescanAfterManualEdit])

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
    onRescanAfterManualEdit(pctx, proc.width, proc.height)
  }, [procCanvasRef, userAlphaOverrideRef, onRescanAfterManualEdit])

  // Phím tắt ESC huỷ hút màu, Ctrl+Z / Ctrl+Y / Ctrl+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEyedropperActive) {
        e.preventDefault()
        onCancelEyedropper?.()
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
      } else if (key === 'c' && hasSelectedPiece) {
        e.preventDefault()
        onCopyPiece?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isEyedropperActive,
    onCancelEyedropper,
    handleUndo,
    handleRedo,
    hasSelectedPiece,
    onCopyPiece
  ])

  return {
    canUndo,
    canRedo,
    clearStacks,
    pushUndoSnapshot,
    handleUndo,
    handleRedo
  }
}
