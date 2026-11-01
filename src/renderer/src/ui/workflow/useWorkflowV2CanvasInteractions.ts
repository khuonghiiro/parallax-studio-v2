import { useCallback, useRef, useState } from 'react'
import { spawnWorkflowStepAt } from './spawnWorkflowStepAt'
import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WF_V2_NODE_H, WF_V2_NODE_W } from '../../project/workflowV2Engine'
import type { WireDragState } from './WorkflowV2CanvasChrome'
import type { WorkflowV2Viewport } from './useWorkflowV2Viewport'
import { WF_V2_PORT_Y } from './workflowV2Edges'
import { resolveV2NodeLevel, resolveV2NodeTheme } from './workflowV2Theme'
import { useWorkflowMultiSelect } from './workflowMultiSelect'

/** Khung chọn nhiều (toạ độ màn hình tương đối khung nhìn) */
export interface MarqueeRect { x0: number; y0: number; x1: number; y1: number }

type Positions = Record<string, { x: number; y: number }>

export interface CanvasInteractionHandlers {
  onSelectNode: (nodeId: string | null) => void
  onMoveNodes: (positions: Positions) => void
  onConnectNodes: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  /** Kiểm tra kết nối hợp lệ theo luật logic (dùng để tô xanh / đỏ Node đích khi đang kéo dây) */
  validate: (fromNode: string, toNode: string) => { valid: boolean; reason?: string }
}

/** Theo dõi kéo con trỏ toàn cửa sổ cho tới khi nhả chuột */
function trackPointer(onMove: (ev: PointerEvent) => void, onUp: (ev: PointerEvent) => void): void {
  const up = (ev: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', up)
    onUp(ev)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', up)
}

/**
 * Tương tác chuột trên sơ đồ Workflow V2: kéo nền để cuộn, kéo thẻ tự do 4 hướng,
 * kéo dây từ cổng và thả vào bất kỳ đâu trên thân thẻ đích (hoặc thả ra khoảng trống để gắn nhanh Node Logic).
 */
export function useWorkflowV2CanvasInteractions(
  vp: WorkflowV2Viewport,
  visibleNodes: WorkflowNode[],
  setDragPositions: (p: Positions | null) => void,
  handlers: CanvasInteractionHandlers
) {
  const [wireDrag, setWireDrag] = useState<WireDragState | null>(null)
  const [spawnMenu, setSpawnMenu] = useState<{ layerNodeId: string; clientX: number; clientY: number } | null>(null)
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null)
  const nodesRef = useRef<WorkflowNode[]>(visibleNodes)
  nodesRef.current = visibleNodes
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const hitTest = (wx: number, wy: number, excludeId: string): WorkflowNode | undefined =>
    nodesRef.current.find(
      (n) =>
        n.id !== excludeId &&
        wx >= n.position.x - 12 &&
        wx <= n.position.x + WF_V2_NODE_W + 12 &&
        wy >= n.position.y - 8 &&
        wy <= n.position.y + WF_V2_NODE_H + 8
    )

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (
      target.closest(
        '.wf-v2-card, .wf-canvas-hud, .wf-v2-cluster-head, .wf-v2-quick-spawn-menu, .wf-v2-edge-ctrl, .wf-v2-legend, .wf-v2-mobile-node-bar, button, input, textarea, select, a'
      )
    ) {
      return
    }
    setSpawnMenu(null)
    if ((e.shiftKey && e.pointerType === 'mouse') || useWorkflowMultiSelect.getState().mode) {
      startMarquee(e)
      return
    }
    let start = { x: e.clientX, y: e.clientY }
    let initPan = { ...vp.pan }
    let moved = false
    let sawMultiTouch = false
    const isTouch = e.pointerType === 'touch'
    trackPointer(
      (ev) => {
        if (ev.pointerId !== e.pointerId) return
        if (vp.isMultiTouchRef?.current) {
          sawMultiTouch = true
          start = { x: ev.clientX, y: ev.clientY }
          initPan = { ...vp.pan }
          return
        }
        if (sawMultiTouch) {
          sawMultiTouch = false
          start = { x: ev.clientX, y: ev.clientY }
          initPan = { ...vp.pan }
          return
        }
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) moved = true
        vp.setPan({ x: initPan.x + ev.clientX - start.x, y: initPan.y + ev.clientY - start.y })
      },
      (ev) => {
        if (ev.pointerId !== e.pointerId) return
        if (!moved && !sawMultiTouch && (e.shiftKey || isTouch)) {
          handlersRef.current.onSelectNode(null)
        }
      }
    )
  }

  /** Shift + kéo nền (hoặc chế độ Chọn nhiều trên cảm ứng): vẽ khung chọn mọi thẻ nằm trong / chạm khung */
  const startMarquee = (e: React.PointerEvent<HTMLDivElement>): void => {
    const host = e.currentTarget.getBoundingClientRect()
    const ox = e.clientX - host.left
    const oy = e.clientY - host.top
    let rect: MarqueeRect = { x0: ox, y0: oy, x1: ox, y1: oy }
    let moved = false
    const additive = e.ctrlKey || e.metaKey
    trackPointer(
      (ev) => {
        if (ev.pointerId !== e.pointerId) return
        rect = { x0: ox, y0: oy, x1: ev.clientX - host.left, y1: ev.clientY - host.top }
        if (!moved && Math.hypot(rect.x1 - ox, rect.y1 - oy) > 4) moved = true
        if (moved) setMarquee(rect)
      },
      (ev) => {
        if (ev.pointerId !== e.pointerId) return
        setMarquee(null)
        const multi = useWorkflowMultiSelect.getState()
        if (!moved) {
          if (!multi.mode) { multi.clear(); handlersRef.current.onSelectNode(null) }
          return
        }
        const a = vp.clientToWorld(host.left + Math.min(rect.x0, rect.x1), host.top + Math.min(rect.y0, rect.y1))
        const b = vp.clientToWorld(host.left + Math.max(rect.x0, rect.x1), host.top + Math.max(rect.y0, rect.y1))
        const hits = nodesRef.current
          .filter((n) => n.position.x + WF_V2_NODE_W >= a.x && n.position.x <= b.x && n.position.y + WF_V2_NODE_H >= a.y && n.position.y <= b.y)
          .map((n) => n.id)
        if (additive || multi.mode) multi.add(hits)
        else multi.set(hits)
      }
    )
  }

  const onStartDragNode = useCallback(
    (e: React.PointerEvent, node: WorkflowNode) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const startW = vp.clientToWorld(e.clientX, e.clientY)
      const initPos = { ...node.position }
      const multiIds = useWorkflowMultiSelect.getState().ids
      // Kéo một thẻ đang nằm trong vùng chọn nhiều → dời cả nhóm thẻ đã chọn cùng lúc
      const group = multiIds.length > 1 && multiIds.includes(node.id)
        ? nodesRef.current.filter((n) => multiIds.includes(n.id)).map((n) => ({ id: n.id, pos: { ...n.position } }))
        : [{ id: node.id, pos: initPos }]
      let latest: Positions | null = null
      let abortedByMultiTouch = false
      trackPointer(
        (ev) => {
          if (ev.pointerId !== e.pointerId) return
          if (vp.isMultiTouchRef?.current) {
            abortedByMultiTouch = true
            latest = null
            setDragPositions(null)
            return
          }
          if (abortedByMultiTouch) return
          const cur = vp.clientToWorld(ev.clientX, ev.clientY)
          if (!latest && Math.hypot(cur.x - startW.x, cur.y - startW.y) < 3) return
          latest = Object.fromEntries(group.map((g) => [g.id, { x: Math.round(g.pos.x + cur.x - startW.x), y: Math.round(g.pos.y + cur.y - startW.y) }]))
          setDragPositions(latest)
        },
        (ev) => {
          if (ev.pointerId !== e.pointerId) return
          if (latest && !abortedByMultiTouch) handlersRef.current.onMoveNodes(latest)
          setDragPositions(null)
        }
      )
    },
    [vp, setDragPositions]
  )

  const onStartWireDrag = useCallback(
    (e: React.PointerEvent, nodeId: string, port: WorkflowPortKind, isOutput: boolean) => {
      const src = nodesRef.current.find((n) => n.id === nodeId)
      if (!src) return
      const sx = isOutput ? src.position.x + WF_V2_NODE_W + 6 : src.position.x - 8
      const sy = src.position.y + WF_V2_PORT_Y
      const w = vp.clientToWorld(e.clientX, e.clientY)
      setWireDrag({ nodeId, isOutput, startX: sx, startY: sy, curX: w.x, curY: w.y })
      trackPointer(
        (ev) => {
          const p = vp.clientToWorld(ev.clientX, ev.clientY)
          const hit = hitTest(p.x, p.y, nodeId)
          const check = hit ? (isOutput ? handlersRef.current.validate(nodeId, hit.id) : handlersRef.current.validate(hit.id, nodeId)) : undefined
          setWireDrag((prev) =>
            prev ? { ...prev, curX: p.x, curY: p.y, hoverNodeId: hit?.id, hoverValid: check?.valid, hoverReason: check?.reason } : null
          )
        },
        (ev) => {
          setWireDrag(null)
          const drop = vp.clientToWorld(ev.clientX, ev.clientY)
          const hit = hitTest(drop.x, drop.y, nodeId)
          if (hit) {
            const theme = resolveV2NodeTheme(hit)
            const fromN = isOutput ? src : hit, toN = isOutput ? hit : src
            const sequential = (fromN.params?.logicCategory === 'action' && toN.params?.logicCategory === 'part_swap') || src.params?.logicCategory === hit.params?.logicCategory &&
              ['action', 'collision'].includes(src.params?.logicCategory ?? '')
            if (isOutput) handlersRef.current.onConnectNodes(nodeId, port, hit.id, sequential ? port : theme.portIn)
            else handlersRef.current.onConnectNodes(hit.id, theme.portOut, nodeId, sequential ? theme.portOut : port)
          } else if (isOutput && ['action', 'collision'].includes(src.params?.logicCategory ?? '') &&
            Math.hypot(drop.x - sx, drop.y - sy) > 36) {
            const created = spawnWorkflowStepAt(nodeId, drop)
            if (created) handlersRef.current.onSelectNode(created)
          } else if (
            isOutput &&
            (resolveV2NodeLevel(src) === 'layer' || src.params?.logicCategory === 'cluster_lock') &&
            Math.hypot(drop.x - sx, drop.y - sy) > 36
          ) {
            setSpawnMenu({ layerNodeId: nodeId, clientX: ev.clientX, clientY: ev.clientY })
          }
        }
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vp]
  )

  return { wireDrag, spawnMenu, setSpawnMenu, marquee, onCanvasPointerDown, onStartDragNode, onStartWireDrag }
}
