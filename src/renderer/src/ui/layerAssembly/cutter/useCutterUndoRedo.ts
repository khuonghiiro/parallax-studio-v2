import { useRef, useState, useCallback, useEffect } from 'react'

export interface UndoSnapshot {
  alphaOverride: Int16Array
}

export interface UseCutterUndoRedoOptions {
  userAlphaOverrideRef: React.MutableRefObject<Int16Array | null>
  onRestoreSnapshot: () => void
  onCopyPiece?: () => void
  hasSelectedPiece?: boolean
  isEyedropperActive?: boolean
  onCancelEyedropper?: () => void
}

export function useCutterUndoRedo({
  userAlphaOverrideRef,
  onRestoreSnapshot,
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
    (w: number, h: number) => {
      const snapAlpha = userAlphaOverrideRef.current
        ? new Int16Array(userAlphaOverrideRef.current)
        : new Int16Array(w * h).fill(-1)
      undoStackRef.current.push({ alphaOverride: snapAlpha })
      if (undoStackRef.current.length > 20) undoStackRef.current.shift()
      redoStackRef.current = []
      setCanUndo(true)
      setCanRedo(false)
    },
    [userAlphaOverrideRef]
  )

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const currentAlpha = userAlphaOverrideRef.current
    if (!currentAlpha) return
    const currentSnap: UndoSnapshot = {
      alphaOverride: new Int16Array(currentAlpha)
    }
    redoStackRef.current.push(currentSnap)
    const prevSnap = undoStackRef.current.pop()!
    userAlphaOverrideRef.current = new Int16Array(prevSnap.alphaOverride)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
    onRestoreSnapshot()
  }, [userAlphaOverrideRef, onRestoreSnapshot])

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const currentAlpha = userAlphaOverrideRef.current
    if (!currentAlpha) return
    const currentSnap: UndoSnapshot = {
      alphaOverride: new Int16Array(currentAlpha)
    }
    undoStackRef.current.push(currentSnap)
    const nextSnap = redoStackRef.current.pop()!
    userAlphaOverrideRef.current = new Int16Array(nextSnap.alphaOverride)
    setCanUndo(true)
    setCanRedo(redoStackRef.current.length > 0)
    onRestoreSnapshot()
  }, [userAlphaOverrideRef, onRestoreSnapshot])

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
