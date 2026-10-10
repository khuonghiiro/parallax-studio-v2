import { useState, useRef, useEffect, useCallback } from 'react'
import type { AssembledLayerItem } from './types'
import { brushPixel, createAlphaStroke, type BrushPoint } from './brushStroke'
import { loadBrushCanvas } from './brushImage'
import { toast } from '../../actions'

export type Assembly2DTool = 'select' | 'eraser'
export interface BrushSettings { size: number; opacity: number; hardness: number }
export interface BrushPreview { id: string; imageUrl: string }
export interface UseLayerBrushEraserOptions {
  selectedLayer: AssembledLayerItem | null
  zoom: number
  pan: { x: number; y: number }
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onPreview: (preview: BrushPreview | null) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}
interface Stroke {
  id: string; pointerId: number; canvas: HTMLCanvasElement; pixels: ImageData
  alpha: ReturnType<typeof createAlphaStroke>; last: BrushPoint
}

/** Immutable source per stroke; transient preview never enters history or reloads the source. */
export function useLayerBrushEraser({ selectedLayer, zoom, pan, onUpdateLayer, onPreview, containerRef }: UseLayerBrushEraserOptions) {
  const [activeTool, setActiveTool] = useState<Assembly2DTool>('select')
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({ size: 28, opacity: 1, hardness: 0.4 })
  const [isBrushPopoverOpen, setIsBrushPopoverOpen] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [cursorPos, setCursorPos] = useState<BrushPoint | null>(null)
  const source = useRef<{ id: string; canvas: HTMLCanvasElement } | null>(null)
  const stroke = useRef<Stroke | null>(null)
  const frame = useRef<number | null>(null)
  const lastPreview = useRef(0)
  const callbacks = useRef({ onUpdateLayer, onPreview })
  callbacks.current = { onUpdateLayer, onPreview }

  const cancel = useCallback(() => {
    const current = stroke.current
    stroke.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (current && containerRef.current?.hasPointerCapture(current.pointerId)) containerRef.current.releasePointerCapture(current.pointerId)
    callbacks.current.onPreview(null)
    setIsErasing(false)
  }, [containerRef])

  useEffect(() => {
    let alive = true
    cancel()
    source.current = null
    if (activeTool === 'eraser' && selectedLayer && !selectedLayer.locked && !selectedLayer.hidden) {
      loadBrushCanvas(selectedLayer).then((canvas) => {
        if (alive) source.current = { id: selectedLayer.id, canvas }
      }).catch((error) => { if (alive) toast(String(error.message)) })
    }
    return () => { alive = false }
  }, [selectedLayer?.id, selectedLayer?.assetPath, selectedLayer?.imageUrl, selectedLayer?.locked, selectedLayer?.hidden, activeTool, cancel])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stroke.current) { event.preventDefault(); event.stopImmediatePropagation(); cancel() }
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('blur', cancel)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      callbacks.current.onPreview(null)
    }
  }, [cancel])

  const point = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    if (!selectedLayer || !containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return brushPixel({ x: clientX, y: clientY },
      { x: rect.left + rect.width / 2 + pan.x, y: rect.top + rect.height / 2 + pan.y },
      zoom, selectedLayer, canvas.width, canvas.height)
  }
  const preview = () => {
    if (frame.current !== null) return
    const tick = (now: number) => {
      const current = stroke.current
      if (!current) { frame.current = null; return }
      if (now - lastPreview.current < 60) { frame.current = requestAnimationFrame(tick); return }
      frame.current = null; lastPreview.current = now
      current.canvas.getContext('2d')!.putImageData(current.pixels, 0, 0)
      callbacks.current.onPreview({ id: current.id, imageUrl: current.canvas.toDataURL('image/png') })
    }
    frame.current = requestAnimationFrame(tick)
  }
  const handleEraserPointerDown = (event: React.PointerEvent) => {
    if (activeTool !== 'eraser' || event.button !== 0 || isBrushPopoverOpen || stroke.current
      || !selectedLayer || selectedLayer.locked || selectedLayer.hidden || source.current?.id !== selectedLayer.id) return
    const canvas = document.createElement('canvas'), original = source.current.canvas
    canvas.width = original.width; canvas.height = original.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(original, 0, 0)
    const p = point(event.clientX, event.clientY, canvas)
    if (!p) return
    try {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const factor = Math.min(1, 380 / Math.max(canvas.width, canvas.height)) * Math.abs(selectedLayer.scale)
      const alpha = createAlphaStroke(pixels.data, canvas.width, canvas.height, {
        radiusX: brushSettings.size / (factor * Math.abs(selectedLayer.scaleX ?? 1)),
        radiusY: brushSettings.size / (factor * Math.abs(selectedLayer.scaleY ?? 1)),
        opacity: brushSettings.opacity, hardness: brushSettings.hardness
      })
      stroke.current = { id: selectedLayer.id, pointerId: event.pointerId, canvas, pixels, alpha, last: p }
      alpha.segment(p, p)
      containerRef.current?.setPointerCapture(event.pointerId)
      event.preventDefault(); setIsErasing(true); preview()
    } catch (error) { toast(`Không thể tẩy ảnh: ${String(error)}`); cancel() }
  }
  const handleEraserPointerMove = (event: React.PointerEvent) => {
    if (activeTool !== 'eraser' || isBrushPopoverOpen) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    const current = stroke.current
    if (!current || current.pointerId !== event.pointerId) return
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [event]) {
      const p = point(sample.clientX, sample.clientY, current.canvas)
      if (p) { current.alpha.segment(current.last, p); current.last = p }
    }
    preview()
  }
  const handleEraserPointerUp = (event?: React.PointerEvent) => {
    const current = stroke.current
    if (!current || (event && event.pointerId !== current.pointerId)) return
    if (event) handleEraserPointerMove(event)
    if (current.alpha.changed) {
      current.canvas.getContext('2d')!.putImageData(current.pixels, 0, 0)
      const imageUrl = current.canvas.toDataURL('image/png')
      source.current = { id: current.id, canvas: current.canvas }
      callbacks.current.onUpdateLayer(current.id, { imageUrl })
    }
    cancel()
  }
  const resetLayerImage = () => {
    cancel()
    if (selectedLayer?.assetPath && !selectedLayer.locked) callbacks.current.onUpdateLayer(selectedLayer.id, { imageUrl: undefined })
    else toast('Ảnh này không có nguồn gốc riêng để khôi phục. Dùng Hoàn tác để trở lại nét trước.')
    setIsBrushPopoverOpen(false)
  }
  return { activeTool, setActiveTool, brushSettings, setBrushSettings, isBrushPopoverOpen, setIsBrushPopoverOpen,
    isErasing, cursorPos, setCursorPos, handleEraserPointerDown, handleEraserPointerMove, handleEraserPointerUp,
    cancelStroke: cancel, resetLayerImage }
}
