import { useCallback, useRef, useState } from 'react'
import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import { WF_V2_NODE_H, WF_V2_NODE_W } from '../../project/workflowV2Engine'
import type { WireDragState } from './WorkflowV2CanvasChrome'
import type { WorkflowV2Viewport } from './useWorkflowV2Viewport'
import { WF_V2_PORT_Y } from './workflowV2Edges'
import { resolveV2NodeLevel, resolveV2NodeTheme } from './workflowV2Theme'

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
    const target = e.target as HTMLElement
    if (target !== e.currentTarget && !target.classList.contains('wf-v2-world')) return
    setSpawnMenu(null)
    const start = { x: e.clientX, y: e.clientY }
    const initPan = { ...vp.pan }
    let moved = false
    trackPointer(
      (ev) => {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) moved = true
        vp.setPan({ x: initPan.x + ev.clientX - start.x, y: initPan.y + ev.clientY - start.y })
      },
      () => {
        if (!moved) handlersRef.current.onSelectNode(null)
      }
    )
  }

  const onStartDragNode = useCallback(
    (e: React.PointerEvent, node: WorkflowNode) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const startW = vp.clientToWorld(e.clientX, e.clientY)
      const initPos = { ...node.position }
      let latest: Positions | null = null
      trackPointer(
        (ev) => {
          const cur = vp.clientToWorld(ev.clientX, ev.clientY)
          if (!latest && Math.hypot(cur.x - startW.x, cur.y - startW.y) < 3) return
          latest = { [node.id]: { x: Math.round(initPos.x + cur.x - startW.x), y: Math.round(initPos.y + cur.y - startW.y) } }
          setDragPositions(latest)
        },
        () => {
          if (latest) handlersRef.current.onMoveNodes(latest)
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
            if (isOutput) handlersRef.current.onConnectNodes(nodeId, port, hit.id, theme.portIn)
            else handlersRef.current.onConnectNodes(hit.id, theme.portOut, nodeId, port)
          } else if (isOutput && resolveV2NodeLevel(src) === 'layer' && Math.hypot(drop.x - sx, drop.y - sy) > 36) {
            setSpawnMenu({ layerNodeId: nodeId, clientX: ev.clientX, clientY: ev.clientY })
          }
        }
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vp]
  )

  return { wireDrag, spawnMenu, setSpawnMenu, onCanvasPointerDown, onStartDragNode, onStartWireDrag }
}
