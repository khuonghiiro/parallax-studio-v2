import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkflowNode } from '@shared/types'
import { WF_V2_NODE_H, WF_V2_NODE_W } from '../../project/workflowV2Engine'
import { usePinchPanGesture } from '../../hooks/usePinchPanGesture'

export const WF_V2_MIN_ZOOM = 0.3
export const WF_V2_MAX_ZOOM = 1.6
const FIT_PAD_X = 28
const FIT_PAD_Y = 12
/** Chừa lề phải cho cột HUD dọc để thẻ không bị che */
const HUD_RESERVE = 52
/** Không thu nhỏ quá mức này khi "vừa khung" để chữ trên thẻ luôn đọc được (phần dư cuộn dọc) */
const FIT_MIN_READABLE = 0.62

export interface WorkflowV2Viewport {
  viewportRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  pan: { x: number; y: number }
  /** Kích thước khung nhìn (px màn hình) */
  size: { w: number; h: number }
  setPan: (p: { x: number; y: number }) => void
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void
  fitToView: (all?: boolean) => void
  focusNode: (nodeId: string) => void
  focusBounds: (b: { x: number; y: number; w: number; h: number }) => void
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number }
}

function boundsOf(nodes: WorkflowNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + WF_V2_NODE_W)
    maxY = Math.max(maxY, n.position.y + WF_V2_NODE_H)
  }
  return { minX: minX - 40, minY: Math.min(minY - 48, 0), maxX: maxX + 16, maxY: maxY + 16 }
}

/**
 * Quản lý khung nhìn sơ đồ Workflow V2:
 * - Lăn chuột = cuộn sơ đồ (dọc; Shift = ngang) — phù hợp dock thấp; Ctrl/Alt + lăn = thu phóng quanh con trỏ.
 * - Cảm ứng 2 ngón (Điện thoại / iPad / Tablet) = chụm/mở để thu phóng quanh tâm 2 ngón + kéo 2 ngón để lia sơ đồ.
 * - "Vừa khung" ưu tiên vừa bề ngang ở mức chữ còn đọc được và căn đỉnh, phần dư cuộn dọc.
 */
export function useWorkflowV2Viewport(visibleNodes: WorkflowNode[]): WorkflowV2Viewport {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoomState] = useState(0.85)
  const [pan, setPanState] = useState({ x: 24, y: 8 })
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  const nodesRef = useRef(visibleNodes)
  nodesRef.current = visibleNodes

  const apply = useCallback((z: number, p: { x: number; y: number }) => {
    zoomRef.current = z
    panRef.current = p
    setZoomState(z)
    setPanState(p)
  }, [])

  const setPan = useCallback((p: { x: number; y: number }) => apply(zoomRef.current, p), [apply])

  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      const el = viewportRef.current
      const cur = zoomRef.current
      const next = Number(Math.max(WF_V2_MIN_ZOOM, Math.min(WF_V2_MAX_ZOOM, cur * factor)).toFixed(3))
      if (Math.abs(next - cur) < 0.001) return
      const ax = anchor?.x ?? (el ? el.clientWidth / 2 : 0)
      const ay = anchor?.y ?? (el ? el.clientHeight / 2 : 0)
      const wx = (ax - panRef.current.x) / cur
      const wy = (ay - panRef.current.y) / cur
      apply(next, { x: Math.round(ax - wx * next), y: Math.round(ay - wy * next) })
    },
    [apply]
  )

  /** Vừa khung: mặc định ưu tiên chữ đọc được (căn đỉnh, phần dư cuộn dọc); `all` = thu nhỏ để thấy toàn bộ không gian */
  const fitToView = useCallback((all = false) => {
    const el = viewportRef.current
    const nodes = nodesRef.current
    if (!el || nodes.length === 0) return
    const b = boundsOf(nodes)
    const availW = Math.max(240, el.clientWidth - FIT_PAD_X * 2 - HUD_RESERVE)
    const availH = Math.max(120, el.clientHeight - FIT_PAD_Y * 2)
    const fitBoth = Math.min(availW / (b.maxX - b.minX), availH / (b.maxY - b.minY))
    const fitWidth = availW / (b.maxX - b.minX)
    const z = all
      ? Number(Math.max(WF_V2_MIN_ZOOM, Math.min(1, fitBoth)).toFixed(2))
      : Number(Math.min(1, Math.max(fitBoth, FIT_MIN_READABLE, fitWidth)).toFixed(2))
    const graphW = (b.maxX - b.minX) * z
    const graphH = (b.maxY - b.minY) * z
    const x = Math.round(FIT_PAD_X + Math.max(0, (availW - graphW) / 2) - b.minX * z)
    const y = Math.round(FIT_PAD_Y + (all ? Math.max(0, (availH - graphH) / 2) : 0) - b.minY * z)
    apply(z, { x, y })
  }, [apply])

  const focusNode = useCallback(
    (nodeId: string) => {
      const el = viewportRef.current
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (!el || !node) return
      const z = zoomRef.current
      const sx = node.position.x * z + panRef.current.x
      const sy = node.position.y * z + panRef.current.y
      const inside = sx >= 0 && sy >= 0 && sx + WF_V2_NODE_W * z <= el.clientWidth && sy + WF_V2_NODE_H * z <= el.clientHeight
      if (inside) return
      apply(z, {
        x: Math.round(el.clientWidth / 2 - (node.position.x + WF_V2_NODE_W / 2) * z),
        y: Math.round(el.clientHeight / 2 - (node.position.y + WF_V2_NODE_H / 2) * z)
      })
    },
    [apply]
  )

  /** Đưa một vùng (khung cụm cảnh) vào tầm nhìn: căn đỉnh-trái, giữ mức zoom đọc được */
  const focusBounds = useCallback(
    (b: { x: number; y: number; w: number; h: number }) => {
      const el = viewportRef.current
      if (!el) return
      const z = Number(Math.min(1, Math.max(FIT_MIN_READABLE, (el.clientWidth - FIT_PAD_X * 2 - HUD_RESERVE) / b.w)).toFixed(2))
      const offsetX = Math.max(FIT_PAD_X, (el.clientWidth - HUD_RESERVE - b.w * z) / 2)
      apply(z, { x: Math.round(offsetX - b.x * z), y: Math.round(FIT_PAD_Y - b.y * z) })
    },
    [apply]
  )

  // Kích thước khung nhìn (để chỉ render các thẻ nằm trong tầm nhìn)
  const [size, setSize] = useState({ w: 1200, h: 300 })
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = (): void => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const rect = el.getBoundingClientRect()
        const delta = Math.max(-180, Math.min(180, e.deltaY))
        zoomBy(Math.exp(-delta * 0.0018), { x: e.clientX - rect.left, y: e.clientY - rect.top })
        return
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX
      const dy = e.shiftKey ? 0 : e.deltaY
      setPan({ x: Math.round(panRef.current.x - dx), y: Math.round(panRef.current.y - dy) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy, setPan])

  usePinchPanGesture(viewportRef, ({ scaleFactor, dx, dy, centerX, centerY }) => {
    if (Math.abs(scaleFactor - 1) > 0.002) {
      zoomBy(scaleFactor, { x: centerX, y: centerY })
    }
    if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) {
      setPan({ x: Math.round(panRef.current.x + dx), y: Math.round(panRef.current.y + dy) })
    }
  })

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    }
  }, [])

  return { viewportRef, zoom, pan, size, setPan, zoomBy, fitToView, focusNode, focusBounds, clientToWorld }
}
