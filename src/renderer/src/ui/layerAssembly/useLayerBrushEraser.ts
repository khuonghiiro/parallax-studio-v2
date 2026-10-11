import { useState, useRef, useEffect, useCallback } from 'react'
import type { AssembledLayerItem } from './types'
import { createAlphaStroke, type BrushPoint } from './brushStroke'
import { loadBrushCanvas } from './brushImage'
import { isolatedBrushPixel } from './isolatedBrushGeometry'
import { toast } from '../../actions'

export type Assembly2DTool = 'select' | 'eraser'
export interface BrushSettings { size: number; opacity: number; hardness: number }
export interface BrushPreview { id: string; imageUrl: string }
export interface UseLayerBrushEraserOptions {
  selectedLayer: AssembledLayerItem | null
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onPreview: (preview: BrushPreview | null) => void
}
interface Stroke {
  id: string; pointerId: number; canvas: HTMLCanvasElement; pixels: ImageData
  alpha: ReturnType<typeof createAlphaStroke>; last: BrushPoint
  captureTarget: HTMLElement
  isolatedRect: DOMRect
  isolatedTransform?: { zoom: number; pan: { x: number; y: number } }
}

/** Immutable source per stroke; transient preview never enters history or reloads the source. */
export function useLayerBrushEraser({ selectedLayer, onUpdateLayer, onPreview }: UseLayerBrushEraserOptions) {
  const [activeTool, setActiveTool] = useState<Assembly2DTool>('select')
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({ size: 28, opacity: 1, hardness: 0.4 })
  const [isErasing, setIsErasing] = useState(false)
  const [cursorPos, setCursorPos] = useState<(BrushPoint & { isIsolated?: boolean }) | null>(null)
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
    if (current?.captureTarget.hasPointerCapture(current.pointerId)) current.captureTarget.releasePointerCapture(current.pointerId)
    callbacks.current.onPreview(null)
    setIsErasing(false)
  }, [])

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

  const pointIsolated = (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    rect: DOMRect,
    transform?: { zoom: number; pan: { x: number; y: number } }
  ) => {
    if (!selectedLayer) return null
    return isolatedBrushPixel({ x: clientX, y: clientY }, rect, canvas.width, canvas.height,
      transform ?? { zoom: 1, pan: { x: 0, y: 0 } })
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

  const startErasing = (
    event: React.PointerEvent,
    p: BrushPoint | null,
    rect: DOMRect,
    transform?: { zoom: number; pan: { x: number; y: number } }
  ) => {
    if (!p) return
    const canvas = document.createElement('canvas'), original = source.current!.canvas
    canvas.width = original.width; canvas.height = original.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(original, 0, 0)
    try {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const baseFactor = Math.min(rect.width / canvas.width, rect.height / canvas.height)
      const alpha = createAlphaStroke(pixels.data, canvas.width, canvas.height, {
        radiusX: brushSettings.size / baseFactor,
        radiusY: brushSettings.size / baseFactor,
        opacity: brushSettings.opacity, hardness: brushSettings.hardness
      })
      stroke.current = {
        captureTarget: event.currentTarget as HTMLElement,
        id: selectedLayer!.id,
        pointerId: event.pointerId,
        canvas,
        pixels,
        alpha,
        last: p,
        isolatedRect: rect,
        isolatedTransform: transform
      }
      alpha.segment(p, p)
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      event.preventDefault(); setIsErasing(true); preview()
    } catch (error) { toast(`Không thể tẩy ảnh: ${String(error)}`); cancel() }
  }

  const handleIsolatedPointerDown = (
    event: React.PointerEvent,
    rect: DOMRect,
    transform?: { zoom: number; pan: { x: number; y: number } }
  ) => {
    if (activeTool !== 'eraser' || event.button !== 0 || stroke.current
      || !selectedLayer || selectedLayer.locked || selectedLayer.hidden || source.current?.id !== selectedLayer.id) return
    const p = pointIsolated(event.clientX, event.clientY, source.current.canvas, rect, transform)
    startErasing(event, p, rect, transform)
  }

  const moveErasing = (event: React.PointerEvent, current: Stroke) => {
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of samples.length ? samples : [event]) {
      const p = pointIsolated(sample.clientX, sample.clientY, current.canvas, current.isolatedRect, current.isolatedTransform)
      if (p) { current.alpha.segment(current.last, p); current.last = p }
    }
    preview()
  }

  const handleIsolatedPointerMove = (
    event: React.PointerEvent,
    rect: DOMRect,
    _transform?: { zoom: number; pan: { x: number; y: number } }
  ) => {
    if (activeTool !== 'eraser') return
    setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top, isIsolated: true })
    const current = stroke.current
    if (!current || current.pointerId !== event.pointerId || !current.isolatedRect) return
    moveErasing(event, current)
  }

  const handleEraserPointerUp = (event?: React.PointerEvent) => {
    const current = stroke.current
    if (!current || (event && event.pointerId !== current.pointerId)) return
    if (event) moveErasing(event, current)
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
  }
  return { activeTool, setActiveTool, brushSettings, setBrushSettings,
    isErasing, cursorPos, setCursorPos, handleEraserPointerUp,
    handleIsolatedPointerDown, handleIsolatedPointerMove,
    cancelStroke: cancel, resetLayerImage }
}
