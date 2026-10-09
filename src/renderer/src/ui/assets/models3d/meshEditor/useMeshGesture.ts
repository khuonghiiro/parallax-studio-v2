import { useRef, useCallback, useEffect } from 'react'
import type { Face3D } from '../types'

interface MeshGestureOptions {
  face: Face3D
  onUpdateFace: (patch: Partial<Face3D>) => void
  onCommitGesture?: () => void
}

export function useMeshGesture({ face, onUpdateFace, onCommitGesture }: MeshGestureOptions) {
  const isDraggingRef = useRef(false)
  const initialFaceSnapshot = useRef<Face3D | null>(null)
  const rafId = useRef<number | null>(null)
  const pendingPatch = useRef<Partial<Face3D> | null>(null)

  const scheduleUpdate = useCallback(
    (patch: Partial<Face3D>) => {
      pendingPatch.current = { ...(pendingPatch.current || {}), ...patch }
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          if (pendingPatch.current) {
            onUpdateFace(pendingPatch.current)
            pendingPatch.current = null
          }
          rafId.current = null
        })
      }
    },
    [onUpdateFace]
  )

  const startGesture = useCallback(() => {
    isDraggingRef.current = true
    initialFaceSnapshot.current = { ...face }
    pendingPatch.current = null
  }, [face])

  const endGesture = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    // Xả hết các patch còn đọng
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    if (pendingPatch.current) {
      onUpdateFace(pendingPatch.current)
      pendingPatch.current = null
    }

    if (onCommitGesture) {
      onCommitGesture()
    }
    initialFaceSnapshot.current = null
  }, [onCommitGesture, onUpdateFace])

  const cancelGesture = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
    pendingPatch.current = null

    // Khôi phục lại trạng thái ban đầu
    if (initialFaceSnapshot.current) {
      onUpdateFace(initialFaceSnapshot.current)
      initialFaceSnapshot.current = null
    }
  }, [onUpdateFace])

  // Lắng nghe phím Escape để hủy gesture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        e.preventDefault()
        cancelGesture()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelGesture])

  return {
    isDragging: isDraggingRef.current,
    startGesture,
    scheduleUpdate,
    endGesture,
    cancelGesture
  }
}
