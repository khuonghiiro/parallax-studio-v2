import { useState, useRef, useEffect } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import { type Bbox2DHandle, calculateAnchorPinnedResize } from './layerAssembly2DBbox'
import { expandLinkedSelection, getBonesForLayers } from './workshopParts'

export interface UseLayerAssembly2DDragProps {
  zoom: number
  pan: { x: number; y: number }
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  isPanning: boolean
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>
  composite: LayerComposite
  selectedIds?: string[]
  selectedLayerId: string | null
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onChangeComposite?: (update: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  brushActiveTool: string
}

export function useLayerAssembly2DDrag({
  zoom,
  pan,
  setPan,
  isPanning,
  setIsPanning,
  composite,
  selectedIds,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onChangeComposite,
  brushActiveTool
}: UseLayerAssembly2DDragProps) {
  const [isDraggingLayer, setIsDraggingLayer] = useState(false)
  const [isDraggingHandle, setIsDraggingHandle] = useState(false)

  const handleDragRef = useRef<{
    handle: Bbox2DHandle
    layerId: string
    startX: number
    startY: number
    startScale: number
    startMouseX: number
    startMouseY: number
    baseWidth: number
    baseHeight: number
  } | null>(null)

  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    initPositions: Map<string, { x: number; y: number }>
    initBonePositions: Map<string, { x: number; y: number }>
    initPanX: number
    initPanY: number
  }>({
    mouseX: 0,
    mouseY: 0,
    initPositions: new Map(),
    initBonePositions: new Map(),
    initPanX: 0,
    initPanY: 0
  })

  // Phím Escape: huỷ thao tác kéo
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (!isDraggingLayer && !isPanning && !isDraggingHandle)) return
      if (handleDragRef.current) {
        const d = handleDragRef.current
        onUpdateLayer(d.layerId, { x: d.startX, y: d.startY, scale: d.startScale })
        handleDragRef.current = null
        setIsDraggingHandle(false)
      }
      if (isDraggingLayer) {
        dragStartRef.current.initPositions.forEach((position, id) => onUpdateLayer(id, position))
        if (dragStartRef.current.initBonePositions.size > 0 && onChangeComposite) {
          const initBones = dragStartRef.current.initBonePositions
          onChangeComposite((prev) => {
            if (!prev.rig) return prev
            const nextBones = prev.rig.bones.map((b) => {
              const init = initBones.get(b.id)
              if (!init) return b
              return { ...b, x: init.x, y: init.y }
            })
            return { ...prev, rig: { ...prev.rig, bones: nextBones } }
          })
        }
      }
      if (isPanning) setPan({ x: dragStartRef.current.initPanX, y: dragStartRef.current.initPanY })
      setIsDraggingLayer(false)
      setIsPanning(false)
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [isDraggingLayer, isPanning, isDraggingHandle, onUpdateLayer, onChangeComposite, setPan])

  const handleStartDragHandle = (
    e: React.PointerEvent,
    handle: Bbox2DHandle,
    layer: AssembledLayerItem,
    baseW: number,
    baseH: number
  ) => {
    e.stopPropagation()
    if (layer.locked) return
    setIsDraggingHandle(true)
    handleDragRef.current = {
      handle,
      layerId: layer.id,
      startX: layer.x,
      startY: layer.y,
      startScale: layer.scale,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      baseWidth: baseW,
      baseHeight: baseH
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleStartDragLayer = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()

    // Nếu đang ở công cụ Cọ Tẩy (Eraser):
    if (brushActiveTool === 'eraser') {
      if (layer.id !== selectedLayerId) {
        onSelectLayer(layer.id, false)
        return
      }
      return
    }

    const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
    if (isAdditive) {
      onSelectLayer(layer.id, true)
      return
    } else if (!selectedIds?.includes(layer.id)) {
      onSelectLayer(layer.id, false)
    }
    if (layer.locked) return

    setIsDraggingLayer(true)
    const activeSelection = expandLinkedSelection(
      composite,
      selectedIds && selectedIds.includes(layer.id) ? selectedIds : [layer.id]
    )
    const initPositions = new Map<string, { x: number; y: number }>()
    composite.layers.forEach((l) => {
      if (activeSelection.includes(l.id) && !l.locked) {
        initPositions.set(l.id, { x: l.x, y: l.y })
      }
    })
    const initBonePositions = new Map<string, { x: number; y: number }>()
    if (composite.rig && composite.rig.bones.length > 0) {
      const isAllSelected =
        activeSelection.length === composite.layers.length || composite.layers.length === 1
      const bonesToMove = isAllSelected
        ? composite.rig.bones.map((b) => b.id)
        : getBonesForLayers(composite, activeSelection)

      if (bonesToMove.length > 0) {
        composite.rig.bones.forEach((b) => {
          if (bonesToMove.includes(b.id)) {
            initBonePositions.set(b.id, { x: b.x, y: b.y })
          }
        })
      }
    }
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initPositions,
      initBonePositions,
      initPanX: pan.x,
      initPanY: pan.y
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: React.PointerEvent): boolean => {
    if (handleDragRef.current) {
      const d = handleDragRef.current
      const dx = (e.clientX - d.startMouseX) / zoom
      const dy = (e.clientY - d.startMouseY) / zoom
      const res = calculateAnchorPinnedResize({
        handle: d.handle,
        dx,
        dy,
        startX: d.startX,
        startY: d.startY,
        startScale: d.startScale,
        baseWidth: d.baseWidth,
        baseHeight: d.baseHeight
      })
      onUpdateLayer(d.layerId, {
        x: res.x,
        y: res.y,
        scale: res.scale
      })
      return true
    }

    if (!isDraggingLayer) return false
    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
    const roundDx = Math.round(dx)
    const roundDy = Math.round(dy)
    dragStartRef.current.initPositions.forEach((pos, id) => {
      onUpdateLayer(id, {
        x: pos.x + roundDx,
        y: pos.y + roundDy
      })
    })
    if (dragStartRef.current.initBonePositions.size > 0 && onChangeComposite) {
      const initBones = dragStartRef.current.initBonePositions
      onChangeComposite((prev) => {
        if (!prev.rig || !prev.rig.bones) return prev
        const nextBones = prev.rig.bones.map((b) => {
          const init = initBones.get(b.id)
          if (!init) return b
          return { ...b, x: init.x + roundDx, y: init.y + roundDy }
        })
        return { ...prev, rig: { ...prev.rig, bones: nextBones } }
      })
    }
    return true
  }

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (handleDragRef.current) {
      handleDragRef.current = null
      setIsDraggingHandle(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (isDraggingLayer) {
      setIsDraggingLayer(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  return {
    isDraggingLayer,
    isDraggingHandle,
    handleStartDragHandle,
    handleStartDragLayer,
    handleDragPointerMove,
    handleDragPointerUp
  }
}
