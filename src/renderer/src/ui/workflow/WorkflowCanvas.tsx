import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import {
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import { WorkflowNodeCard } from './WorkflowNodeCard'
import { WorkflowCanvasHUD } from './WorkflowCanvasHUD'
import {
  NODE_W,
  buildBezierPath,
  buildSmartEdgeGeometry,
  estimateNodeCardHeight,
  resolveNodeCollisionPush,
  getBestMatchingInputPort,
  getBestMatchingOutputPort,
  getInputSocketCoords,
  getOutputSocketCoords
} from './workflowLayoutAndFlow'

const SNAP_RADIUS = 60
const MIN_ZOOM = 0.42
const MAX_ZOOM = 1.75

export interface WorkflowCanvasProps {
  workflow: WorkflowGraph
  project?: Project
  playing?: boolean
  time?: number
  activeNodeIds: Set<string>
  executionStepMap: Map<string, number>
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onMoveNodes: (positions: Record<string, { x: number; y: number }>, mergeKey?: string) => void
  onAutoLayout: () => void
  onToggleNode: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onConnectPorts: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
  onPreviewNode?: (node: WorkflowNode) => void
  onDropLogicNode?: (logicId: string, worldPos: { x: number; y: number }) => void
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  project,
  playing = false,
  time = 0,
  activeNodeIds,
  executionStepMap,
  selectedNodeId,
  onSelectNode,
  onMoveNodes,
  onAutoLayout,
  onToggleNode,
  onDeleteNode,
  onChangeNodePreset,
  onUpdateNodeParams,
  onConnectPorts,
  onDisconnectEdge,
  onPreviewNode,
  onDropLogicNode
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 44, y: 8 })
  const [isPanning, setIsPanning] = useState(false)
  const [clusterMoveMode, setClusterMoveMode] = useState(false)
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const [isDragOverPalette, setIsDragOverPalette] = useState(false)

  const [pendingSource, setPendingSource] = useState<{
    nodeId: string
    port: WorkflowPortKind
    isOutput: boolean
    x: number
    y: number
  } | null>(null)
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null)
  const [snappedTarget, setSnappedTarget] = useState<{
    nodeId: string
    port: WorkflowPortKind
    isInput: boolean
    x: number
    y: number
    targetCardOnly?: boolean
  } | null>(null)

  const effectiveNodes = useMemo(() => {
    if (!dragPositions) return workflow.nodes
    return workflow.nodes.map((n) =>
      dragPositions[n.id] ? { ...n, position: dragPositions[n.id] } : n
    )
  }, [workflow.nodes, dragPositions])

  const nodeById = useMemo(() => new Map(effectiveNodes.map((n) => [n.id, n])), [effectiveNodes])

  // Phím tắt Alt + L tự động sắp xếp gọn gàng toàn bộ sơ đồ
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.altKey &&
        (e.key === 'l' || e.key === 'L') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault()
        onAutoLayout()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onAutoLayout])

  /** Tự động tính toán Zoom & Pan để toàn bộ cụm khối nằm gọn giữa khung nhìn (chừa mép trái 38px cho thanh Icon dọc) */
  const fitClusterToView = useCallback(
    (customNodes?: WorkflowNode[]) => {
      const el = viewportRef.current
      const list = customNodes ?? workflow.nodes
      if (!el || list.length === 0) return
      const vw = el.clientWidth || 1200
      const vh = el.clientHeight || 280

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const n of list) {
        const cardH = estimateNodeCardHeight(n)
        minX = Math.min(minX, n.position.x - 16)
        minY = Math.min(minY, n.position.y - 10)
        maxX = Math.max(maxX, n.position.x + NODE_W + 16)
        maxY = Math.max(maxY, n.position.y + cardH + 14)
      }

      const leftDockW = 40
      const availW = Math.max(320, vw - leftDockW - 20)
      const graphW = Math.max(400, maxX - minX)
      const graphH = Math.max(200, maxY - minY)
      const fitZ = Math.min(
        1.0,
        Math.max(MIN_ZOOM, Math.min(availW / graphW, (vh - 14) / graphH))
      )
      const nx = Math.round(leftDockW + (availW - graphW * fitZ) / 2 - minX * fitZ)
      const ny = Math.round((vh - graphH * fitZ) / 2 - minY * fitZ)
      setZoom(Number(fitZ.toFixed(2)))
      setPan({ x: nx, y: ny })
    },
    [workflow.nodes]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => fitClusterToView(), 40)
    return () => window.clearTimeout(timer)
    // Chỉ tự căn khung khi đổi mẫu workflow hoặc lần đầu mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id, workflow.presetId])

  /** Chuyển đổi tọa độ chuột màn hình sang tọa độ thế giới (World Space) trên mặt phẳng */
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      }
    },
    [pan.x, pan.y, zoom]
  )

  /** Phóng to / thu nhỏ neo chính xác theo vị trí con trỏ chuột */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0014)
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom * factor).toFixed(3))))
      const ratio = nextZoom / zoom
      setPan({
        x: Math.round(mx - (mx - pan.x) * ratio),
        y: Math.round(my - (my - pan.y) * ratio)
      })
      setZoom(nextZoom)
    },
    [pan.x, pan.y, zoom]
  )

  const zoomByStep = (delta: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    const cx = rect ? rect.width / 2 : 540
    const cy = rect ? rect.height / 2 : 170
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((zoom + delta).toFixed(2))))
    const ratio = nextZoom / zoom
    setPan({
      x: Math.round(cx - (cx - pan.x) * ratio),
      y: Math.round(cy - (cy - pan.y) * ratio)
    })
    setZoom(nextZoom)
  }

  /** Kéo mặt phẳng (Pan Canvas) mượt 60fps khi nắm kéo vùng trống */
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.wf-node-card, .wf-canvas-hud, .wf-edge-badge')) return
    if (pendingSource) {
      setPendingSource(null)
      setCursorWorld(null)
      setSnappedTarget(null)
      return
    }
    e.stopPropagation()
    setIsPanning(true)
    const startX = e.clientX
    const startY = e.clientY
    const origPanX = pan.x
    const origPanY = pan.y
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    let rafId = 0
    const onMove = (ev: PointerEvent) => {
      const nx = Math.round(origPanX + (ev.clientX - startX))
      const ny = Math.round(origPanY + (ev.clientY - startY))
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setPan({ x: nx, y: ny })
      })
    }
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      setIsPanning(false)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  /**
   * Kéo 1 khối hoặc Kéo cả cụm tự do 4 hướng (Trái / Phải / Lên / Xuống) mượt 60fps:
   * Cập nhật tọa độ cục bộ qua requestAnimationFrame và chỉ commit vào store 1 lần khi thả chuột.
   */
  const startNodeDrag = useCallback(
    (e: React.PointerEvent, node: WorkflowNode) => {
      if (pendingSource) return
      if (
        (e.target as HTMLElement).closest(
          'button, input, .wf-socket-hit, .wf-socket-pin, .wf-preset-pill'
        )
      ) {
        return
      }
      e.stopPropagation()
      onSelectNode(node.id)

      const moveCluster = clusterMoveMode || e.shiftKey || e.altKey
      const targetNodes = moveCluster ? workflow.nodes : [node]
      const initialPositions = new Map(targetNodes.map((n) => [n.id, { ...n.position }]))

      const startX = e.clientX
      const startY = e.clientY
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)

      let lastPatch: Record<string, { x: number; y: number }> | null = null
      let rafId = 0

      const onMove = (ev: PointerEvent) => {
        const dx = Math.round((ev.clientX - startX) / zoom)
        const dy = Math.round((ev.clientY - startY) / zoom)
        const patch: Record<string, { x: number; y: number }> = {}
        for (const [id, orig] of initialPositions.entries()) {
          patch[id] = {
            x: Math.max(-1400, Math.min(3800, orig.x + dx)),
            y: Math.max(-900, Math.min(2400, orig.y + dy))
          }
        }
        lastPatch = patch
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          setDragPositions(patch)
        })
      }

      const onUp = () => {
        if (rafId) cancelAnimationFrame(rafId)
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
        setDragPositions(null)

        if (!lastPatch) return

        // Logic tự động đẩy thẻ ra (Anti-Overlap Push) khi thả chuột nếu bị đè lên thẻ khác
        if (!moveCluster && lastPatch[node.id]) {
          const currentPos = lastPatch[node.id]
          const otherNodes = workflow.nodes.filter((n) => n.id !== node.id)
          const resolved = resolveNodeCollisionPush(node, currentPos, otherNodes)
          onMoveNodes({ [node.id]: resolved }, `wf-move-${node.id}`)
        } else {
          onMoveNodes(lastPatch, 'wf-move-cluster')
        }
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [clusterMoveMode, onMoveNodes, onSelectNode, pendingSource, workflow.nodes, zoom]
  )

  /**
   * Tìm chân cắm mục tiêu hoặc Thẻ khối đích gần nhất để hút nam châm (Magnetic Snap).
   * Hỗ trợ 2 chiều: Kéo từ Output ➔ hút Input; Kéo từ Input ➔ hút Output.
   * Đồng thời hỗ trợ thả dây trực tiếp lên bất kỳ vị trí nào trên thẻ khối đích (Whole Card Drop)!
   */
  const findMagneticTarget = useCallback(
    (
      worldX: number,
      worldY: number,
      sourceNodeId: string,
      sourcePort: WorkflowPortKind,
      isSourceOutput: boolean
    ) => {
      let bestSocket: {
        nodeId: string
        port: WorkflowPortKind
        isInput: boolean
        x: number
        y: number
        dist: number
      } | null = null

      // 1. Kiểm tra khoảng cách tới tất cả các chân cắm phù hợp của các khối khác
      for (const n of effectiveNodes) {
        if (n.id === sourceNodeId) continue
        const spec = WORKFLOW_NODE_SPECS[n.type]
        if (!spec) continue

        const targetPorts = isSourceOutput ? spec.inputs : spec.outputs
        if (targetPorts.length === 0) continue

        for (const targetPort of targetPorts) {
          const coords = isSourceOutput
            ? getInputSocketCoords(n, targetPort)
            : getOutputSocketCoords(n, targetPort)
          const dist = Math.hypot(coords.x - worldX, coords.y - worldY)
          const effectiveDist = targetPort === sourcePort ? dist * 0.7 : dist
          if (dist <= SNAP_RADIUS && (!bestSocket || effectiveDist < bestSocket.dist)) {
            bestSocket = {
              nodeId: n.id,
              port: targetPort,
              isInput: isSourceOutput,
              x: coords.x,
              y: coords.y,
              dist: effectiveDist
            }
          }
        }
      }
      if (bestSocket) {
        return {
          nodeId: bestSocket.nodeId,
          port: bestSocket.port,
          isInput: bestSocket.isInput,
          x: bestSocket.x,
          y: bestSocket.y
        }
      }

      // 2. Thả dây vào BẤT KỲ ĐÂU trên thẻ Khối đích (Whole Card Drop Hitbox)
      for (const n of effectiveNodes) {
        if (n.id === sourceNodeId) continue
        const spec = WORKFLOW_NODE_SPECS[n.type]
        if (!spec) continue
        const cardH = estimateNodeCardHeight(n)
        if (
          worldX >= n.position.x - 24 &&
          worldX <= n.position.x + NODE_W + 24 &&
          worldY >= n.position.y - 16 &&
          worldY <= n.position.y + cardH + 24
        ) {
          if (isSourceOutput) {
            const bestPort = getBestMatchingInputPort(sourcePort, n)
            if (bestPort) {
              const coords = getInputSocketCoords(n, bestPort)
              return { nodeId: n.id, port: bestPort, isInput: true, x: coords.x, y: coords.y, targetCardOnly: true }
            }
          } else {
            const bestPort = getBestMatchingOutputPort(sourcePort, n)
            if (bestPort) {
              const coords = getOutputSocketCoords(n, bestPort)
              return { nodeId: n.id, port: bestPort, isInput: false, x: coords.x, y: coords.y, targetCardOnly: true }
            }
          }
        }
      }

      return null
    },
    [effectiveNodes]
  )

  /** Theo dõi chuột toàn màn hình và phím ESC khi đang ở chế độ nối dây Click-to-Connect */
  useEffect(() => {
    if (!pendingSource) return

    const handleGlobalPointerMove = (ev: PointerEvent) => {
      const w = clientToWorld(ev.clientX, ev.clientY)
      setCursorWorld(w)
      setSnappedTarget(
        findMagneticTarget(
          w.x,
          w.y,
          pendingSource.nodeId,
          pendingSource.port,
          pendingSource.isOutput
        )
      )
    }

    const handleGlobalKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setPendingSource(null)
        setCursorWorld(null)
        setSnappedTarget(null)
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [pendingSource, clientToWorld, findMagneticTarget])

  /**
   * Bắt đầu kéo dây hoặc bấm chọn từ chân cắm (Hỗ trợ 2 chiều: Output ➔ Input hoặc Input ➔ Output).
   * Phân biệt chuẩn xác giữa Drag & Drop (kéo thả) và Click-to-Connect (bấm chọn).
   */
  const startConnecting = useCallback(
    (
      startEv: React.PointerEvent,
      node: WorkflowNode,
      port: WorkflowPortKind,
      isOutput: boolean
    ) => {
      startEv.stopPropagation()
      startEv.preventDefault()

      const startCoords = isOutput
        ? getOutputSocketCoords(node, port)
        : getInputSocketCoords(node, port)

      const startClientPos = { x: startEv.clientX, y: startEv.clientY }
      let hasDragged = false

      setPendingSource({
        nodeId: node.id,
        port,
        isOutput,
        x: startCoords.x,
        y: startCoords.y
      })
      setCursorWorld(startCoords)
      setSnappedTarget(null)

      const onMove = (ev: PointerEvent) => {
        if (
          !hasDragged &&
          Math.hypot(ev.clientX - startClientPos.x, ev.clientY - startClientPos.y) > 5
        ) {
          hasDragged = true
        }
        const w = clientToWorld(ev.clientX, ev.clientY)
        setCursorWorld(w)
        setSnappedTarget(findMagneticTarget(w.x, w.y, node.id, port, isOutput))
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)

        if (hasDragged) {
          const w = clientToWorld(ev.clientX, ev.clientY)
          const snap = findMagneticTarget(w.x, w.y, node.id, port, isOutput)
          if (snap) {
            if (isOutput) {
              onConnectPorts(node.id, port, snap.nodeId, snap.port)
            } else {
              onConnectPorts(snap.nodeId, snap.port, node.id, port)
            }
          }
          setPendingSource(null)
          setCursorWorld(null)
          setSnappedTarget(null)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [clientToWorld, findMagneticTarget, onConnectPorts]
  )

  /** Bấm vào chân cắm Input */
  const handleInputSocketClick = useCallback(
    (e: React.MouseEvent, node: WorkflowNode, port: WorkflowPortKind) => {
      e.stopPropagation()
      if (pendingSource) {
        if (pendingSource.nodeId !== node.id && pendingSource.isOutput) {
          onConnectPorts(pendingSource.nodeId, pendingSource.port, node.id, port)
        }
        setPendingSource(null)
        setCursorWorld(null)
        setSnappedTarget(null)
        return
      }
      const existingEdge = workflow.edges.find((ed) => ed.toNode === node.id && ed.toPort === port)
      if (existingEdge) {
        onDisconnectEdge(existingEdge.id)
      }
    },
    [pendingSource, workflow.edges, onConnectPorts, onDisconnectEdge]
  )

  /** Bấm vào chân cắm Output */
  const handleOutputSocketClick = useCallback(
    (e: React.MouseEvent, node: WorkflowNode, port: WorkflowPortKind) => {
      e.stopPropagation()
      if (pendingSource) {
        if (pendingSource.nodeId !== node.id && !pendingSource.isOutput) {
          onConnectPorts(node.id, port, pendingSource.nodeId, pendingSource.port)
        }
        setPendingSource(null)
        setCursorWorld(null)
        setSnappedTarget(null)
        return
      }
    },
    [pendingSource, onConnectPorts]
  )

  const renderedEdges = useMemo(() => {
    const out: {
      edge: WorkflowEdge
      p1: { x: number; y: number }
      p2: { x: number; y: number }
      path: string
      midX: number
      midY: number
      color: string
      label: string
      isActive: boolean
    }[] = []

    for (const edge of workflow.edges) {
      const fromNode = nodeById.get(edge.fromNode)
      const toNode = nodeById.get(edge.toNode)
      if (!fromNode || !toNode) continue
      const geom = buildSmartEdgeGeometry(
        fromNode,
        edge.fromPort,
        toNode,
        edge.toPort,
        effectiveNodes
      )
      const isActive =
        fromNode.enabled &&
        toNode.enabled &&
        activeNodeIds.has(fromNode.id) &&
        activeNodeIds.has(toNode.id)

      out.push({
        edge,
        p1: geom.p1,
        p2: geom.p2,
        path: geom.path,
        midX: geom.midX,
        midY: geom.midY,
        color: geom.color,
        label: geom.label,
        isActive
      })
    }
    return out
  }, [workflow.edges, effectiveNodes, nodeById, activeNodeIds])

  const previewTarget = snappedTarget ?? cursorWorld

  return (
    <div
      ref={viewportRef}
      className={`wf-canvas-viewport${isPanning ? ' panning' : ''}${clusterMoveMode ? ' cluster-mode' : ''}${isDragOverPalette ? ' palette-drag-over' : ''}`}
      data-mcp-region="workflow_canvas"
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${Math.max(10, Math.round(18 * zoom))}px ${Math.max(10, Math.round(18 * zoom))}px`
      }}
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-pxs-logic-id')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          if (!isDragOverPalette) setIsDragOverPalette(true)
        }
      }}
      onDragLeave={() => {
        if (isDragOverPalette) setIsDragOverPalette(false)
      }}
      onDrop={(e) => {
        setIsDragOverPalette(false)
        const logicId = e.dataTransfer.getData('application/x-pxs-logic-id')
        if (!logicId || !onDropLogicNode) return
        e.preventDefault()
        const w = clientToWorld(e.clientX, e.clientY)
        onDropLogicNode(logicId, {
          x: Math.round(w.x - NODE_W / 2),
          y: Math.round(w.y - 40)
        })
      }}
      onContextMenu={(e) => {
        if (pendingSource) {
          e.preventDefault()
          setPendingSource(null)
          setCursorWorld(null)
          setSnappedTarget(null)
        }
      }}
    >
      {/* Hướng dẫn nổi khi đang kéo nối dây Port */}
      {pendingSource && (
        <div className="wf-connecting-banner">
          <span>
            Đang nối từ <strong>{WORKFLOW_PORT_SPECS[pendingSource.port]?.label}</strong> — Thả hoặc bấm trực tiếp vào{' '}
            <strong>thẻ khối đích hoặc chân cắm [◉]</strong> để kết nối
          </span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={(e) => {
              e.stopPropagation()
              setPendingSource(null)
              setCursorWorld(null)
              setSnappedTarget(null)
            }}
          >
            Hủy nối (Esc)
          </button>
        </div>
      )}

      {/* Mặt phẳng thế giới biến đổi theo Pan & Zoom Sắc Nét Vector */}
      <div
        className="wf-canvas-pan"
        style={{
          left: `${Math.round(pan.x)}px`,
          top: `${Math.round(pan.y)}px`
        }}
      >
        <div
          className="wf-canvas-world"
          style={{
            zoom
          }}
        >
          {/* Lớp dây nối SVG Bezier không giới hạn tọa độ âm/dương (không dùng feGaussianBlur nặng GPU) */}
          <svg
            className="wf-edges-svg"
            width={6000}
            height={4000}
            viewBox="-1500 -1000 6000 4000"
            style={{ left: -1500, top: -1000 }}
          >
            {renderedEdges.map(({ edge, p1, p2, path, midX, midY, color, label, isActive }) => (
              <g
                key={edge.id}
                className={`wf-edge-group${isActive ? ' active' : ' muted'}${isActive && playing ? ' playing' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDisconnectEdge(edge.id)
                }}
              >
                <title>{`Cổng ${label} — Bấm để ngắt kết nối`}</title>
                <path d={path} className="wf-edge-hit" />
                <path d={path} className="wf-edge-glow-bg" stroke={color} />
                <path
                  d={path}
                  className="wf-edge-line"
                  stroke={color}
                />
                {isActive && (
                  <path d={path} className={`wf-edge-flow${playing ? ' playing' : ''}`} />
                )}

                {/* Hạt xung tín hiệu (Signal Packets) bay dọc theo dây nối khi chạy Video */}
                {isActive && playing && (
                  <>
                    <circle r="4.2" fill="#ffffff" stroke={color} strokeWidth="2" className="wf-edge-packet">
                      <animateMotion dur="1.25s" repeatCount="indefinite" path={path} />
                    </circle>
                    <circle r="3.4" fill={color} className="wf-edge-packet trail">
                      <animateMotion dur="1.25s" begin="0.62s" repeatCount="indefinite" path={path} />
                    </circle>
                  </>
                )}

                {/* Điểm đầu & cuối cắm khít vào tâm chân Port */}
                <circle cx={p1.x} cy={p1.y} r="3.4" fill={color} />
                <circle cx={p2.x} cy={p2.y} r="3.4" fill={color} />

                {/* Nút ngắt dây gọn ở tâm đường cong */}
                <g transform={`translate(${midX}, ${midY})`} className="wf-edge-badge">
                  <circle r="7" className="wf-edge-badge-ring" style={{ stroke: color }} />
                  <circle r="2.6" className="wf-edge-badge-dot" style={{ fill: color }} />
                  <text x="0" y="3" textAnchor="middle" className="wf-edge-badge-x">
                    ✕
                  </text>
                </g>
              </g>
            ))}

            {/* Dây đang kéo trực tiếp kèm vòng nam châm bắt điểm (Hỗ trợ 2 chiều mượt mà) */}
            {pendingSource && previewTarget && (
              <g className="wf-edge-preview-group">
                <path
                  d={
                    pendingSource.isOutput
                      ? buildBezierPath(
                          pendingSource.x,
                          pendingSource.y,
                          previewTarget.x,
                          previewTarget.y
                        )
                      : buildBezierPath(
                          previewTarget.x,
                          previewTarget.y,
                          pendingSource.x,
                          pendingSource.y
                        )
                  }
                  className="wf-edge-preview"
                  stroke={WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8'}
                />
                <circle
                  cx={previewTarget.x}
                  cy={previewTarget.y}
                  r={snappedTarget ? 9 : 5}
                  fill={snappedTarget ? (WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8') : 'none'}
                  fillOpacity={snappedTarget ? 0.35 : 0}
                  stroke={WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8'}
                  strokeWidth={snappedTarget ? 3 : 2}
                />
              </g>
            )}
          </svg>

          {/* Các Khối Chức Năng (Functional Nodes) */}
          {effectiveNodes.map((node) => (
            <WorkflowNodeCard
              key={node.id}
              node={node}
              project={project}
              workflow={workflow}
              playing={playing}
              time={time}
              isSelected={node.id === selectedNodeId}
              isConnected={activeNodeIds.has(node.id)}
              stepNum={executionStepMap.get(node.id)}
              activeNodeIds={activeNodeIds}
              pendingSource={pendingSource}
              snappedTarget={snappedTarget}
              onSelectNode={onSelectNode}
              onStartNodeDrag={startNodeDrag}
              onToggleNode={onToggleNode}
              onDeleteNode={onDeleteNode}
              onChangeNodePreset={onChangeNodePreset}
              onUpdateNodeParams={onUpdateNodeParams}
              onPreviewNode={onPreviewNode}
              onStartConnecting={startConnecting}
              onInputSocketClick={handleInputSocketClick}
              onOutputSocketClick={handleOutputSocketClick}
              onConnectPorts={onConnectPorts}
              onClearPendingWire={() => {
                setPendingSource(null)
                setCursorWorld(null)
                setSnappedTarget(null)
              }}
            />
          ))}
        </div>
      </div>

      {/* Thanh Công Cụ Dọc Dạng Icon (Vertical Icon HUD Dock ở mép trái Canvas) */}
      <WorkflowCanvasHUD
        clusterMoveMode={clusterMoveMode}
        zoom={zoom}
        onToggleClusterMove={() => setClusterMoveMode((v) => !v)}
        onAutoLayout={() => {
          onAutoLayout()
          setTimeout(() => fitClusterToView(), 50)
        }}
        onFitView={fitClusterToView}
        onZoomByStep={zoomByStep}
        onResetZoom={() => {
          setZoom(1)
          setPan({ x: 44, y: 8 })
        }}
      />
    </div>
  )
}
