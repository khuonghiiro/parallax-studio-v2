import { useRef, useState, useEffect } from 'react'
import { isolatedImageGeometry } from './isolatedBrushGeometry'
import type { PixelEditorProps } from './LayerAssemblyEraser'

function isEditingText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (tag === 'input') {
    const type = (target as HTMLInputElement).type?.toLowerCase()
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].includes(type)
  }
  return false
}

function usePixelKeyboard(isErasing: boolean, setSpace: (value: boolean) => void, clearGesture: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const targetEl = e.target as HTMLElement | null
      if (isEditingText(activeEl) || isEditingText(targetEl)) return

      if (e.code === 'Space') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (e.repeat) return
        if (!isErasing) setSpace(true)
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        clearGesture()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setSpace(false)
      }
    }
    const blur = () => {
      setSpace(false)
      clearGesture()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', blur)
    }
  }, [isErasing, clearGesture, setSpace])
}

export function useIsolatedCanvasView(props: PixelEditorProps) {
  const { layer, isErasing } = props
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hand, setHand] = useState(false)
  const [space, setSpace] = useState(false)
  const [hover, setHover] = useState(false)
  const [panning, setPanning] = useState(false)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [area, setArea] = useState({ width: 224, height: 204 })
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const clearGesture = () => { panStart.current = null; setPanning(false); props.onCancel(); props.onCursorLeave() }
  useEffect(() => { reset(); setSize({ width: 1, height: 1 }) }, [layer.id])
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setArea({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  usePixelKeyboard(isErasing, setSpace, clearGesture)
  const wheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    if (isErasing || panning || !canvasRef.current || !e.deltaY) return
    const rect = canvasRef.current.getBoundingClientRect()
    const next = Math.min(15, Math.max(0.25, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    const ratio = next / zoom
    setPan({ x: pan.x * ratio + (e.clientX - rect.left - rect.width / 2) * (1 - ratio),
      y: pan.y * ratio + (e.clientY - rect.top - rect.height / 2) * (1 - ratio) })
    setZoom(next)
  }
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0 && e.button !== 1) return
    e.preventDefault()
    if (hand || space || e.button === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      setPanning(true); e.currentTarget.setPointerCapture(e.pointerId)
    } else props.onPointerDown(e, e.currentTarget.getBoundingClientRect(), { zoom, pan })
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const start = panStart.current
    if (start) setPan({ x: start.panX + e.clientX - start.x, y: start.panY + e.clientY - start.y })
    else if (!hand && !space) props.onPointerMove(e, e.currentTarget.getBoundingClientRect(), { zoom, pan })
  }
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (panStart.current) { panStart.current = null; setPanning(false) }
    else props.onPointerUp(e)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const g = isolatedImageGeometry({ ...area, left: 0, top: 0 }, size.width, size.height, { zoom, pan })
  return { canvasRef, zoom, hand, setHand, space, hover, setHover, panning, setSize, reset, clearGesture, wheel, down, move, up, g }

}
