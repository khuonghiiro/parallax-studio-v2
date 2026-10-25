import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkflowNode } from '@shared/types'
import { WF_V2_NODE_H, WF_V2_NODE_W } from '../../project/workflowV2Engine'

export const WF_V2_MIN_ZOOM = 0.3
export const WF_V2_MAX_ZOOM = 1.6
const FIT_PAD_X = 28
const FIT_PAD_Y = 12
/** Không thu nhỏ quá mức này khi "vừa khung" để chữ trên thẻ luôn đọc được (phần dư cuộn dọc) */
const FIT_MIN_READABLE = 0.62

export interface WorkflowV2Viewport {
  viewportRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  pan: { x: number; y: number }
  setPan: (p: { x: number; y: number }) => void
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void
  fitToView: () => void
  focusNode: (nodeId: string) => void
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
  return { minX: minX - 12, minY: minY - 40, maxX: maxX + 12, maxY: maxY + 12 }
}

/**
 * Quản lý khung nhìn sơ đồ Workflow V2:
 * - Lăn chuột = cuộn sơ đồ (dọc; Shift = ngang) — phù hợp dock thấp; Ctrl/Alt + lăn = thu phóng quanh con trỏ.
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

  const fitToView = useCallback(() => {
    const el = viewportRef.current
    const nodes = nodesRef.current
    if (!el || nodes.length === 0) return
    const b = boundsOf(nodes)
    const availW = Math.max(240, el.clientWidth - FIT_PAD_X * 2)
    const availH = Math.max(120, el.clientHeight - FIT_PAD_Y * 2)
    const fitBoth = Math.min(availW / (b.maxX - b.minX), availH / (b.maxY - b.minY))
    const fitWidth = availW / (b.maxX - b.minX)
    const z = Number(Math.min(1, Math.max(fitBoth, FIT_MIN_READABLE, fitWidth)).toFixed(2))
    const graphW = (b.maxX - b.minX) * z
    const x = Math.round(FIT_PAD_X + Math.max(0, (availW - graphW) / 2) - b.minX * z)
    apply(z, { x, y: Math.round(FIT_PAD_Y - b.minY * z) })
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

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    }
  }, [])

  return { viewportRef, zoom, pan, setPan, zoomBy, fitToView, focusNode, clientToWorld }
}
