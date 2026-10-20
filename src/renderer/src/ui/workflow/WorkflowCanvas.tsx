import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import {
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import { renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowNodePreview } from './WorkflowNodePreview'
import {
  HEADER_H,
  NODE_W,
  SOCKET_PAD_TOP,
  SOCKET_ROW_H,
  buildBezierPath,
  buildSmartEdgeGeometry,
  estimateNodeCardHeight,
  evaluateNodeRuntimeTelemetry,
  getInputSocketCoords,
  getOutputSocketCoords
} from './workflowLayoutAndFlow'

const SNAP_RADIUS = 28
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
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onConnectPorts: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
  onPreviewNode?: (node: WorkflowNode) => void
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
  onChangeNodePreset,
  onConnectPorts,
  onDisconnectEdge,
  onPreviewNode
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 14, y: 6 })
  const [isPanning, setIsPanning] = useState(false)
  const [clusterMoveMode, setClusterMoveMode] = useState(false)

  const [pendingSource, setPendingSource] = useState<{
    nodeId: string
    port: WorkflowPortKind
    x: number
    y: number
  } | null>(null)
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null)
  const [snappedTarget, setSnappedTarget] = useState<{
    nodeId: string
    port: WorkflowPortKind
    x: number
    y: number
  } | null>(null)

  const nodeById = useMemo(() => new Map(workflow.nodes.map((n) => [n.id, n])), [workflow.nodes])

  /** Tự động tính toán Zoom & Pan để toàn bộ cụm khối nằm gọn giữa khung nhìn */
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

      const graphW = Math.max(400, maxX - minX)
      const graphH = Math.max(200, maxY - minY)
      const fitZ = Math.min(
        1.0,
        Math.max(MIN_ZOOM, Math.min((vw - 24) / graphW, (vh - 14) / graphH))
      )
      const nx = Math.round((vw - graphW * fitZ) / 2 - minX * fitZ)
      const ny = Math.round((vh - graphH * fitZ) / 2 - minY * fitZ)
      setZoom(Number(fitZ.toFixed(2)))
      setPan({ x: Math.max(8, nx), y: Math.max(6, ny) })
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

  /** Kéo mặt phẳng (Pan Canvas) khi nắm kéo vùng trống hoặc chuột giữa */
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

    const onMove = (ev: PointerEvent) => {
      setPan({
        x: Math.round(origPanX + (ev.clientX - startX)),
        y: Math.round(origPanY + (ev.clientY - startY))
      })
    }
    const onUp = () => {
      setIsPanning(false)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  /** Kéo 1 khối hoặc Kéo cả cụm (khi bật "Kéo cả cụm" hoặc giữ phím Shift/Alt) */
  const startNodeDrag = useCallback(
    (e: React.PointerEvent, node: WorkflowNode) => {
      if (
        (e.target as HTMLElement).closest(
          'button, input, .custom-select-trigger, .wf-socket-hit, .wf-socket-pin'
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

      const onMove = (ev: PointerEvent) => {
        const dx = Math.round((ev.clientX - startX) / zoom)
        const dy = Math.round((ev.clientY - startY) / zoom)
        const patch: Record<string, { x: number; y: number }> = {}
        for (const [id, orig] of initialPositions.entries()) {
          patch[id] = {
            x: Math.max(8, orig.x + dx),
            y: Math.max(8, orig.y + dy)
          }
        }
        onMoveNodes(patch, moveCluster ? 'wf-move-cluster' : `wf-move-${node.id}`)
      }

      const onUp = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [clusterMoveMode, onMoveNodes, onSelectNode, workflow.nodes, zoom]
  )

  /** Tìm chân cắm Input tương thích gần nhất để hút nam châm (Magnetic Snap) khi kéo dây */
  const findMagneticTarget = useCallback(
    (worldX: number, worldY: number, sourceNodeId: string, port: WorkflowPortKind) => {
      let best: { nodeId: string; port: WorkflowPortKind; x: number; y: number; dist: number } | null = null
      for (const n of workflow.nodes) {
        if (n.id === sourceNodeId) continue
        const spec = WORKFLOW_NODE_SPECS[n.type]
        if (!spec?.inputs.includes(port)) continue
        const coords = getInputSocketCoords(n, port)
        const dist = Math.hypot(coords.x - worldX, coords.y - worldY)
        if (dist <= SNAP_RADIUS && (!best || dist < best.dist)) {
          best = { nodeId: n.id, port, x: coords.x, y: coords.y, dist }
        }
      }
      return best ? { nodeId: best.nodeId, port: best.port, x: best.x, y: best.y } : null
    },
    [workflow.nodes]
  )

  /** Bắt đầu kéo dây hoặc bấm chọn từ chân cắm Output */
  const handleOutputSocketPointerDown = (
    e: React.PointerEvent,
    node: WorkflowNode,
    port: WorkflowPortKind
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const startCoords = getOutputSocketCoords(node, port)
    setPendingSource({ nodeId: node.id, port, x: startCoords.x, y: startCoords.y })
    setCursorWorld(startCoords)
    setSnappedTarget(null)

    const onMove = (ev: PointerEvent) => {
      const w = clientToWorld(ev.clientX, ev.clientY)
      setCursorWorld(w)
      setSnappedTarget(findMagneticTarget(w.x, w.y, node.id, port))
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const w = clientToWorld(ev.clientX, ev.clientY)
      const snap = findMagneticTarget(w.x, w.y, node.id, port)
      if (snap) {
        onConnectPorts(node.id, port, snap.nodeId, snap.port)
        setPendingSource(null)
        setCursorWorld(null)
        setSnappedTarget(null)
      }
      // Nếu không thả trúng đích ngay (user chỉ click 1 cái), giữ pendingSource để hỗ trợ Click-to-connect
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Bấm vào chân cắm Input để hoàn tất nối dây hoặc ngắt dây hiện có */
  const handleInputSocketClick = (e: React.MouseEvent, node: WorkflowNode, port: WorkflowPortKind) => {
    e.stopPropagation()
    if (pendingSource) {
      if (pendingSource.nodeId !== node.id && pendingSource.port === port) {
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
  }

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pendingSource) return
    const w = clientToWorld(e.clientX, e.clientY)
    setCursorWorld(w)
    setSnappedTarget(findMagneticTarget(w.x, w.y, pendingSource.nodeId, pendingSource.port))
  }

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
        workflow.nodes
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
  }, [workflow.edges, workflow.nodes, nodeById, activeNodeIds])

  const previewTarget = snappedTarget ?? cursorWorld

  return (
    <div
      ref={viewportRef}
      className={`wf-canvas-viewport${isPanning ? ' panning' : ''}${clusterMoveMode ? ' cluster-mode' : ''}`}
      data-mcp-region="workflow_canvas"
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${Math.max(10, Math.round(18 * zoom))}px ${Math.max(10, Math.round(18 * zoom))}px`
      }}
      onWheel={handleWheel}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
    >
      {/* Hướng dẫn nổi khi đang kéo nối dây Port */}
      {pendingSource && (
        <div className="wf-connecting-banner">
          <span>
            Đang nối cổng <strong>{WORKFLOW_PORT_SPECS[pendingSource.port]?.label}</strong> — Kéo thả hoặc bấm vào{' '}
            <strong>chân cắm tròn phát sáng [◉] bên mép trái</strong> của khối đích để kết nối
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

      {/* Mặt phẳng thế giới biến đổi theo Pan & Zoom Sắc Nét Vector (Không dùng GPU Bitmap Blur) */}
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
          {/* Lớp dây nối SVG Bezier + Hạt truyền dữ liệu */}
          <svg className="wf-edges-svg" width={2200} height={1000} viewBox="0 0 2200 1000">
            <defs>
              <filter id="wf-wire-glow" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

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
                  filter={isActive ? 'url(#wf-wire-glow)' : undefined}
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

            {/* Dây đang kéo trực tiếp kèm vòng nam châm bắt điểm */}
            {pendingSource && previewTarget && (
              <g className="wf-edge-preview-group">
                <path
                  d={buildBezierPath(
                    pendingSource.x,
                    pendingSource.y,
                    previewTarget.x,
                    previewTarget.y
                  )}
                  className="wf-edge-preview"
                  stroke={WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8'}
                />
                <circle
                  cx={previewTarget.x}
                  cy={previewTarget.y}
                  r={snappedTarget ? 8 : 4.5}
                  fill="none"
                  stroke={WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8'}
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* Các Khối Chức Năng (Functional Nodes) */}
          {workflow.nodes.map((node) => {
            const spec = WORKFLOW_NODE_SPECS[node.type]
            const isSelected = node.id === selectedNodeId
            const isConnected = activeNodeIds.has(node.id)
            const stepNum = executionStepMap.get(node.id)
            const inputs = spec?.inputs ?? []
            const outputs = spec?.outputs ?? []
            const socketRowCount = Math.max(inputs.length, outputs.length, 1)
            const telemetry = evaluateNodeRuntimeTelemetry(
              node,
              project,
              time,
              playing,
              isConnected,
              stepNum,
              Math.max(1, activeNodeIds.size), workflow, activeNodeIds
            )

            const presetOptions = (spec?.presets ?? []).map((p) => ({
              value: p.id,
              label: p.label
            }))

            return (
              <div
                key={node.id}
                id={`wf-node-${node.type}`}
                className={`wf-node-card${isSelected ? ' selected' : ''}${isConnected ? ' connected' : ' disconnected'}${!node.enabled ? ' disabled' : ''}${telemetry.isStageHighlight ? ' running stage-highlight' : ''}`}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: NODE_W,
                  ['--wf-node-color' as string]: spec?.color ?? '#38bdf8'
                }}
                onPointerDown={(e) => startNodeDrag(e, node)}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectNode(node.id)
                }}
              >
                {/* 1. Thanh tiêu đề Khối */}
                <div className="wf-node-header">
                  <span className="wf-node-icon" style={{ background: spec?.color }}>
                    {renderWorkflowNodeIcon(node.type, { width: 12, height: 12 })}
                  </span>
                  <span className="wf-node-title" title={node.title}>
                    {spec?.shortTitle ?? node.title}
                  </span>
                  {onPreviewNode && (
                    <button
                      type="button"
                      className="wf-node-eye-btn"
                      title="Áp dụng & Xem thử hiệu ứng khối này trên Cảnh 3D"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectNode(node.id)
                        onPreviewNode(node)
                      }}
                    >
                      👁
                    </button>
                  )}
                  <span
                    className={`wf-node-status-pill${isConnected ? ' on' : ' disconnected'}${telemetry.isStageHighlight ? ' running' : ''}`}
                    title={
                      !node.enabled
                        ? 'Khối đang tắt'
                        : isConnected
                          ? `Bước thực thi #${stepNum} (${node.aiAgentRole}) — ${telemetry.liveSummary}`
                          : telemetry.liveSummary
                    }
                  >
                    {!node.enabled
                      ? 'Tắt'
                      : isConnected
                        ? telemetry.isStageHighlight
                          ? `⚡ #${stepNum}`
                          : `✓ #${stepNum}`
                        : '⛔ Đứt'}
                  </span>
                  <button
                    type="button"
                    className={`wf-node-toggle${node.enabled ? ' on' : ''}`}
                    title={node.enabled ? 'Đang bật (Bấm để tắt khối này)' : 'Đang tắt (Bấm để bật)'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleNode(node.id)
                    }}
                  >
                    {node.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 2. Khu vực Chân cắm Port (Protruding Socket Pins trên mép trái & phải) */}
                <div
                  className="wf-socket-matrix"
                  style={{ height: SOCKET_PAD_TOP * 2 + socketRowCount * SOCKET_ROW_H }}
                >
                  {Array.from({ length: socketRowCount }).map((_, rowIdx) => {
                    const inPort = inputs[rowIdx]
                    const outPort = outputs[rowIdx]
                    const inSpec = inPort ? WORKFLOW_PORT_SPECS[inPort] : null
                    const outSpec = outPort ? WORKFLOW_PORT_SPECS[outPort] : null

                    const inWired = inPort
                      ? workflow.edges.some((e) => e.toNode === node.id && e.toPort === inPort)
                      : false
                    const outWired = outPort
                      ? workflow.edges.some((e) => e.fromNode === node.id && e.fromPort === outPort)
                      : false

                    const isCompatibleTarget = Boolean(
                      inPort &&
                        pendingSource &&
                        pendingSource.nodeId !== node.id &&
                        pendingSource.port === inPort
                    )
                    const isSnapped = Boolean(
                      inPort &&
                        snappedTarget &&
                        snappedTarget.nodeId === node.id &&
                        snappedTarget.port === inPort
                    )
                    const isInDimmed = Boolean(inPort && pendingSource && !isCompatibleTarget)
                    const isOutPending = Boolean(
                      outPort &&
                        pendingSource?.nodeId === node.id &&
                        pendingSource?.port === outPort
                    )

                    return (
                      <div
                        key={`row-${rowIdx}`}
                        className="wf-socket-row"
                        style={{ height: SOCKET_ROW_H }}
                      >
                        {/* Cổng Đầu Vào (Mép Trái) */}
                        {inPort && inSpec ? (
                          <button
                            type="button"
                            className={`wf-socket-hit in${inWired ? ' wired' : ''}${isCompatibleTarget ? ' compatible' : ''}${isSnapped ? ' snapped' : ''}${isInDimmed ? ' dimmed' : ''}`}
                            style={{ ['--port-c' as string]: inSpec.color }}
                            title={
                              isCompatibleTarget
                                ? `Thả hoặc bấm vào đây để nối cổng "${inSpec.label}"`
                                : inWired
                                  ? `Cổng vào: ${inSpec.label} (Đang nối — Bấm để ngắt dây)`
                                  : `Cổng vào: ${inSpec.label} (Chưa nối)`
                            }
                            onClick={(e) => handleInputSocketClick(e, node, inPort)}
                          >
                            <span className="wf-socket-pin in">
                              <span className="wf-socket-pin-core" />
                            </span>
                            <span className="wf-socket-label">{inSpec.shortLabel}</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        {/* Cổng Đầu Ra (Mép Phải) */}
                        {outPort && outSpec ? (
                          <button
                            type="button"
                            className={`wf-socket-hit out${outWired ? ' wired' : ''}${isOutPending ? ' pending' : ''}`}
                            style={{ ['--port-c' as string]: outSpec.color }}
                            title={`Cổng ra: ${outSpec.label} — Nắm kéo hoặc bấm để nối sang khối tiếp theo`}
                            onPointerDown={(e) => handleOutputSocketPointerDown(e, node, outPort)}
                          >
                            <span className="wf-socket-label">{outSpec.shortLabel}</span>
                            <span className="wf-socket-pin out">
                              <span className="wf-socket-pin-core" />
                            </span>
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 3. Chọn Preset, Preview Chức năng & Gắn Layer / Bộ phận 2.5D */}
                <div className="wf-node-body">
                  <CustomSelect
                    size="sm"
                    value={node.preset}
                    options={presetOptions}
                    dropdownWidth={260}
                    onChange={(val) => onChangeNodePreset(node.id, String(val))}
                    title="Chọn chế độ xử lý cho khối chức năng này"
                  />
                  <WorkflowNodePreview
                    node={node}
                    project={project}
                    mode="card"
                    runtimeTelemetry={telemetry}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Thanh Điều Khiển Nổi Trên Mặt Phẳng (Canvas HUD: Di chuyển cả cụm, Căn gọn, Zoom theo chuột) */}
      <div className="wf-canvas-hud" data-mcp-region="workflow_canvas_hud">
        <button
          id="wf-btn-cluster-drag"
          type="button"
          className={`wf-hud-btn${clusterMoveMode ? ' active' : ''}`}
          title="Khi bật (hoặc giữ phím Shift khi kéo), nắm kéo bất kỳ khối nào sẽ di chuyển toàn bộ cả cụm cùng lúc"
          onClick={(e) => {
            e.stopPropagation()
            setClusterMoveMode((v) => !v)
          }}
        >
          <span>⛓ Kéo cả cụm: {clusterMoveMode ? 'BẬT' : 'TẮT'}</span>
        </button>

        <div className="wf-hud-sep" />

        <button
          id="wf-btn-autolayout"
          type="button"
          className="wf-hud-btn"
          title="Tự động dàn thoáng vị trí 7 khối và căn vừa khít khung nhìn"
          onClick={(e) => {
            e.stopPropagation()
            const resetNodes = workflow.nodes.map((n) => ({
              ...n,
              position: { ...(DEFAULT_NODE_POSITIONS[n.type] ?? n.position) }
            }))
            onAutoLayout()
            fitClusterToView(resetNodes)
          }}
        >
          <span>⊞ Căn gọn cụm</span>
        </button>

        <button
          id="wf-btn-fit-view"
          type="button"
          className="wf-hud-btn"
          title="Thu phóng và đưa cả cụm về chính giữa khung nhìn"
          onClick={(e) => {
            e.stopPropagation()
            fitClusterToView()
          }}
        >
          <span>⊡ Khớp khung</span>
        </button>

        <div className="wf-hud-sep" />

        <button
          type="button"
          className="wf-hud-btn icon"
          title="Thu nhỏ (Hoặc lăn con lăn chuột)"
          onClick={(e) => {
            e.stopPropagation()
            zoomByStep(-0.1)
          }}
        >
          −
        </button>
        <button
          type="button"
          className="wf-hud-btn wf-hud-zoom-val"
          title="Bấm để đặt về tỷ lệ chuẩn 100% (1:1 Sắc nét tuyệt đối) · Lăn chuột để Zoom theo con trỏ"
          onClick={(e) => {
            e.stopPropagation()
            setZoom(1)
            setPan({ x: 14, y: 6 })
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="wf-hud-btn icon"
          title="Phóng to (Hoặc lăn con lăn chuột)"
          onClick={(e) => {
            e.stopPropagation()
            zoomByStep(0.1)
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
