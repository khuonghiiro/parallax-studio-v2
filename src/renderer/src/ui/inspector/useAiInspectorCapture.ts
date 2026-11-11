import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ScanBox } from './aiUiInspectorGeometry'

/**
 * Bắt sự kiện chuột/phím cho AI UI Inspector:
 *  - Win + Shift (giữ) hoặc nút toolbar `#ai-ui-inspector-btn` → bật chế độ quét (armed).
 *  - Giữ chuột trái + kéo → marquee; nhả chuột → `onFinish(box)`.
 *  - Esc → thoát chế độ quét / đóng xem trước.
 * Mọi listener gắn ở pha capture để chặn sự kiện lọt xuống app (tránh thao tác nhầm).
 */

type Point = { x: number; y: number }
type Placement = 'top' | 'bottom'
export type AiCaptureMode = 'context' | 'code'

interface CaptureCtx {
  mode: { current: AiCaptureMode }
  setMode: (mode: AiCaptureMode) => void
  armed: { current: boolean }
  dragging: { current: boolean }
  placement: { current: Placement }
  suppressClick: { current: boolean }
  start: { current: Point }
  crosshair: RefObject<HTMLDivElement | null>
  setArmed: (v: boolean) => void
  setDragging: (v: boolean) => void
  setPlacement: (v: Placement) => void
  setStart: (p: Point) => void
  setCurrent: (p: Point) => void
  finish: (box: ScanBox, mode: AiCaptureMode) => void
  closePreview: () => boolean
  onArm: () => void
}

const OWN_CONTROL_SELECTOR =
  '.ai-ui-inspector-arm-close, .ai-ui-inspector-toast, .ai-ui-inspector-toast-btn, .ai-ui-inspector-preview-backdrop'

function closestMatch(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && Boolean(target.closest(selector))
}

const isOwnControl = (t: EventTarget | null) => closestMatch(t, OWN_CONTROL_SELECTOR)
const isTriggerBtn = (t: EventTarget | null) => closestMatch(t, '#ai-ui-inspector-btn')
const isWinCtrl = (e: MouseEvent | KeyboardEvent) => e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey
const isWinShift = (e: MouseEvent | KeyboardEvent) => e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey

function swallow(e: Event, prevent = true): void {
  if (prevent) e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
}

function moveCrosshair(ctx: CaptureCtx, x: number, y: number): void {
  const el = ctx.crosshair.current
  if (!el) return
  el.style.setProperty('--x', `${x}px`)
  el.style.setProperty('--y', `${y}px`)
  const coords = el.querySelector('.ai-ui-inspector-crosshair-coords')
  if (coords) coords.textContent = `${Math.round(x)}, ${Math.round(y)}`
}

/** Badge HUD tự né khi chuột tiến gần mép trên/dưới giữa màn hình. */
function autoDodgeHud(ctx: CaptureCtx, x: number, y: number): void {
  const winW = window.innerWidth || 1920
  const winH = window.innerHeight || 1080
  if (Math.abs(x - winW * 0.5) >= 430) return
  if (ctx.placement.current === 'top' && y < 105) {
    ctx.placement.current = 'bottom'
    ctx.setPlacement('bottom')
  } else if (ctx.placement.current === 'bottom' && y > winH - 115) {
    ctx.placement.current = 'top'
    ctx.setPlacement('top')
  }
}

function arm(ctx: CaptureCtx, next: boolean, mode: AiCaptureMode = ctx.mode.current): void {
  ctx.mode.current = mode
  ctx.setMode(mode)
  ctx.armed.current = next
  ctx.setArmed(next)
  if (next) {
    ctx.placement.current = 'top'
    ctx.setPlacement('top')
    ctx.onArm()
  }
}

function startDrag(ctx: CaptureCtx, x: number, y: number): void {
  const pos = { x, y }
  ctx.armed.current = false
  ctx.dragging.current = true
  ctx.suppressClick.current = true
  ctx.start.current = pos
  ctx.setArmed(false)
  ctx.setDragging(true)
  ctx.setStart(pos)
  ctx.setCurrent(pos)
  ctx.onArm()
}

function finishDrag(ctx: CaptureCtx, x: number, y: number): void {
  ctx.dragging.current = false
  ctx.suppressClick.current = true
  window.setTimeout(() => {
    ctx.suppressClick.current = false
  }, 80)
  ctx.setDragging(false)
  const { x: x0, y: y0 } = ctx.start.current
  ctx.finish({ left: Math.min(x0, x), top: Math.min(y0, y), width: Math.abs(x - x0), height: Math.abs(y - y0) }, ctx.mode.current)
}

function createHandlers(ctx: CaptureCtx) {
  const onDown = (e: MouseEvent) => {
    if (isTriggerBtn(e.target)) return swallow(e, false)
    if (isOwnControl(e.target)) return
    if (e.type === 'mousedown' && ctx.dragging.current) return swallow(e)
    if ((isWinShift(e) || isWinCtrl(e) || ctx.armed.current) && e.button === 0) {
      swallow(e)
      if (!ctx.dragging.current && (isWinShift(e) || isWinCtrl(e))) {
        ctx.mode.current = isWinCtrl(e) ? 'code' : 'context'
        ctx.setMode(ctx.mode.current)
      }
      if (!ctx.dragging.current) startDrag(ctx, e.clientX, e.clientY)
    }
  }
  const onMove = (e: MouseEvent) => {
    if (ctx.armed.current || ctx.dragging.current) moveCrosshair(ctx, e.clientX, e.clientY)
    if (ctx.armed.current) autoDodgeHud(ctx, e.clientX, e.clientY)
    if (!ctx.dragging.current) return
    swallow(e)
    ctx.setCurrent({ x: e.clientX, y: e.clientY })
  }
  const onUp = (e: MouseEvent) => {
    if (isTriggerBtn(e.target)) return swallow(e, false)
    if (!ctx.dragging.current) {
      if (e.type === 'mouseup' && ctx.suppressClick.current) swallow(e)
      return
    }
    swallow(e)
    finishDrag(ctx, e.clientX, e.clientY)
  }
  const onClick = (e: MouseEvent) => {
    if (isTriggerBtn(e.target)) {
      swallow(e)
      return arm(ctx, !ctx.armed.current, 'context')
    }
    if (isOwnControl(e.target)) return
    if (ctx.suppressClick.current) {
      ctx.suppressClick.current = false
      swallow(e)
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('.ai-code-handoff-modal')) return
    if ((isWinShift(e) || isWinCtrl(e)) && !ctx.dragging.current) {
      swallow(e)
      arm(ctx, true, isWinCtrl(e) ? 'code' : 'context')
    }
    if (e.key !== 'Escape') return
    if (ctx.dragging.current || ctx.armed.current) {
      swallow(e)
      ctx.dragging.current = false
      ctx.setDragging(false)
      arm(ctx, false)
    } else if (ctx.closePreview()) {
      swallow(e)
    }
  }
  const onToggle = () => arm(ctx, !ctx.armed.current)
  return { onDown, onMove, onUp, onClick, onKey, onToggle }
}

export function useAiInspectorCapture(options: {
  onFinish: (box: ScanBox, mode: AiCaptureMode) => void
  onArm: () => void
  closePreview: () => boolean
  crosshairRef: RefObject<HTMLDivElement | null>
}) {
  const [mode, setMode] = useState<AiCaptureMode>('context')
  const [isArmed, setIsArmed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [armHudPlacement, setArmHudPlacement] = useState<Placement>('top')
  const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState<Point>({ x: 0, y: 0 })

  const optsRef = useRef(options)
  optsRef.current = options
  const ctxRef = useRef<CaptureCtx | null>(null)
  if (!ctxRef.current) {
    ctxRef.current = {
      mode: { current: 'context' },
      setMode,
      armed: { current: false },
      dragging: { current: false },
      placement: { current: 'top' },
      suppressClick: { current: false },
      start: { current: { x: 0, y: 0 } },
      crosshair: options.crosshairRef,
      setArmed: setIsArmed,
      setDragging: setIsDragging,
      setPlacement: setArmHudPlacement,
      setStart: setStartPos,
      setCurrent: setCurrentPos,
      finish: (box, mode) => optsRef.current.onFinish(box, mode),
      closePreview: () => optsRef.current.closePreview(),
      onArm: () => optsRef.current.onArm()
    }
  }

  useEffect(() => {
    const h = createHandlers(ctxRef.current as CaptureCtx)
    const pairs: Array<[string, EventListener]> = [
      ['pointerdown', h.onDown as EventListener],
      ['mousedown', h.onDown as EventListener],
      ['pointermove', h.onMove as EventListener],
      ['mousemove', h.onMove as EventListener],
      ['pointerup', h.onUp as EventListener],
      ['mouseup', h.onUp as EventListener],
      ['click', h.onClick as EventListener],
      ['keydown', h.onKey as EventListener]
    ]
    for (const [type, fn] of pairs) window.addEventListener(type, fn, true)
    window.addEventListener('pxs:toggle-ai-inspector', h.onToggle)
    return () => {
      for (const [type, fn] of pairs) window.removeEventListener(type, fn, true)
      window.removeEventListener('pxs:toggle-ai-inspector', h.onToggle)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('ai-ui-inspector-active', isArmed || isDragging)
  }, [isArmed, isDragging])

  const disarm = () => arm(ctxRef.current as CaptureCtx, false)
  return { mode, isArmed, isDragging, armHudPlacement, startPos, currentPos, disarm }
}
