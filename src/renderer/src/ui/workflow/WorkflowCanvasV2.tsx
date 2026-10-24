import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import {
  WF_V2_COL_X,
  WF_V2_NODE_W,
  estimateV2NodeHeight
} from '../../project/workflowV2Engine'
import { WorkflowNodeCardV2, resolveV2NodeTheme } from './WorkflowNodeCardV2'
import { WorkflowTimeRulerV2 } from './WorkflowTimeRulerV2'

export interface WorkflowCanvasV2Props {
  workflow: WorkflowGraph
  project: Project
  currentTime: number
  playing: boolean
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onMoveNodes: (positions: Record<string, { x: number; y: number }>) => void
  onToggleNodeEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onAttachLogicToLayer: (layerNodeId: string, category: 'action' | 'light' | 'cave' | 'fx' | 'audio') => void
  onConnectNodes: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
  onAutoLayout: () => void
  onRebuildSceneTree: () => void
}

const MIN_Z = 0.22
const MAX_Z = 1.6

/**
 * Tạo đường dẫn Smooth-Step bo góc tròn chuẩn React Flow / n8n / Whimsical:
 * Đi ngang từ cổng ra (x1, y1) -> rẽ dọc mượt tại trục kênh (channelX) -> rẽ ngang mượt vào cổng đích (x2, y2).
 */
function buildSmoothStepWirePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  channelX: number,
  cornerRadius = 14
): string {
  const dy = y2 - y1
  if (Math.abs(dy) <= 2 || x2 <= x1 + 24) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }
  const dirY = dy > 0 ? 1 : -1
  const r = Math.max(
    4,
    Math.min(
      cornerRadius,
      Math.abs(channelX - x1) * 0.45,
      Math.abs(x2 - channelX) * 0.45,
      Math.abs(dy) * 0.45
    )
  )
  return [
    `M ${x1} ${y1}`,
    `L ${channelX - r} ${y1}`,
    `Q ${channelX} ${y1} ${channelX} ${y1 + dirY * r}`,
    `L ${channelX} ${y2 - dirY * r}`,
    `Q ${channelX} ${y2} ${channelX + r} ${y2}`,
    `L ${x2} ${y2}`
  ].join(' ')
}

export const WorkflowCanvasV2: React.FC<WorkflowCanvasV2Props> = ({
  workflow,
  project,
  currentTime,
  playing,
  selectedNodeId,
  onSelectNode,
  onSetTime,
  onTogglePlay,
  onMoveNodes,
  onToggleNodeEnable,
  onDeleteNode,
  onUpdateNodeParams,
  onAttachLogicToLayer,
  onConnectNodes,
  onDisconnectEdge,
  onAutoLayout,
  onRebuildSceneTree
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number>(0.72)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 36, y: 16 })
  const [wireStyle, setWireStyle] = useState<'smoothstep' | 'bezier'>('smoothstep')
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef(pan)
  panRef.current = pan

  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const [wireDrag, setWireDrag] = useState<{
    nodeId: string
    port: WorkflowPortKind
    isOutput: boolean
    startX: number
    startY: number
    curX: number
    curY: number
  } | null>(null)
  const [spawnMenu, setSpawnMenu] = useState<{
    layerNodeId: string
    clientX: number
    clientY: number
  } | null>(null)

  const maxDuration = Math.max(1, project.comp.duration || 5)

  const effectiveNodes = useMemo(() => {
    if (!dragPositions) return workflow.nodes
    return workflow.nodes.map((n) =>
      dragPositions[n.id] ? { ...n, position: dragPositions[n.id] } : n
    )
  }, [workflow.nodes, dragPositions])

  // Tính bản đồ quan hệ cha -> con để hỗ trợ thu gọn nhánh (collapsedGroup)
  const { visibleNodes, childCountMap } = useMemo(() => {
    const byId = new Map(effectiveNodes.map((n) => [n.id, n]))
    const childrenOf = new Map<string, string[]>()
    for (const e of workflow.edges) {
      if (!byId.has(e.fromNode) || !byId.has(e.toNode)) continue
      const list = childrenOf.get(e.fromNode) ?? []
      if (!list.includes(e.toNode)) list.push(e.toNode)
      childrenOf.set(e.fromNode, list)
    }
    const counts = new Map<string, number>()
    for (const [pid, list] of childrenOf.entries()) {
      counts.set(pid, list.length)
    }
    const hiddenIds = new Set<string>()
    const markDescendantsHidden = (parentId: string) => {
      const kids = childrenOf.get(parentId) ?? []
      for (const kidId of kids) {
        if (!hiddenIds.has(kidId)) {
          hiddenIds.add(kidId)
          markDescendantsHidden(kidId)
        }
      }
    }
    for (const n of effectiveNodes) {
      if (n.params?.collapsedGroup) {
        markDescendantsHidden(n.id)
      }
    }
    return {
      visibleNodes: effectiveNodes.filter((n) => !hiddenIds.has(n.id)),
      childCountMap: counts
    }
  }, [effectiveNodes, workflow.edges])

  const visibleNodeMap = useMemo(
    () => new Map(visibleNodes.map((n) => [n.id, n])),
    [visibleNodes]
  )

  const visibleEdges = useMemo(
    () =>
      workflow.edges.filter(
        (e) => visibleNodeMap.has(e.fromNode) && visibleNodeMap.has(e.toNode)
      ),
    [workflow.edges, visibleNodeMap]
  )

  // Tìm tập hợp các Node và Dây nối liên kết trực tiếp với Node đang chọn (Highlight Connected Lineage)
  const { highlightedNodeIds, highlightedEdgeIds, isFilteringLineage } = useMemo(() => {
    const nodeSet = new Set<string>()
    const edgeSet = new Set<string>()
    if (!selectedNodeId || selectedNodeId === 'v2-root-scene') {
      return { highlightedNodeIds: nodeSet, highlightedEdgeIds: edgeSet, isFilteringLineage: false }
    }
    nodeSet.add(selectedNodeId)
    // Duyệt xuôi xuống các nhánh con
    let changed = true
    while (changed) {
      changed = false
      for (const e of visibleEdges) {
        if (nodeSet.has(e.fromNode) && !nodeSet.has(e.toNode)) {
          nodeSet.add(e.toNode)
          edgeSet.add(e.id)
          changed = true
        } else if (nodeSet.has(e.fromNode) && nodeSet.has(e.toNode)) {
          edgeSet.add(e.id)
        }
      }
    }
    // Duyệt ngược lên nhánh cha tới Root Cảnh
    let cur = selectedNodeId
    const visitedUp = new Set<string>([cur])
    while (cur) {
      const parentEdge = visibleEdges.find((e) => e.toNode === cur)
      if (!parentEdge || visitedUp.has(parentEdge.fromNode)) break
      visitedUp.add(parentEdge.fromNode)
      nodeSet.add(parentEdge.fromNode)
      edgeSet.add(parentEdge.id)
      cur = parentEdge.fromNode
    }
    return { highlightedNodeIds: nodeSet, highlightedEdgeIds: edgeSet, isFilteringLineage: true }
  }, [selectedNodeId, visibleEdges])

  // Sắp xếp thứ tự các dây ra từ cùng 1 Node cha để tách cổng (Staggered Output Offset) và kênh rẽ (Channel X)
  const edgeRoutingMeta = useMemo(() => {
    const outGroups = new Map<string, typeof visibleEdges>()
    for (const e of visibleEdges) {
      const list = outGroups.get(e.fromNode) ?? []
      list.push(e)
      outGroups.set(e.fromNode, list)
    }
    const meta = new Map<string, { outIdx: number; outTotal: number; channelRatio: number }>()
    for (const [, list] of outGroups.entries()) {
      const sorted = [...list].sort((a, b) => {
        const na = visibleNodeMap.get(a.toNode)
        const nb = visibleNodeMap.get(b.toNode)
        return (na?.position.y ?? 0) - (nb?.position.y ?? 0)
      })
      sorted.forEach((edge, idx) => {
        const total = sorted.length
        // Tách nhẹ kênh dọc giữa các nhánh con để các đoạn thẳng đứng không đè chồng lên nhau
        const spread = total > 1 ? (idx - (total - 1) / 2) * 0.045 : 0
        meta.set(edge.id, {
          outIdx: idx,
          outTotal: total,
          channelRatio: Math.max(0.32, Math.min(0.68, 0.48 + spread))
        })
      })
    }
    return meta
  }, [visibleEdges, visibleNodeMap])

  const selectedNode = useMemo(
    () => effectiveNodes.find((n) => n.id === selectedNodeId) ?? null,
    [effectiveNodes, selectedNodeId]
  )

  const isNodeActiveAtTime = useCallback(
    (node: WorkflowNode): boolean => {
      if (!node.enabled) return false
      const s = node.params?.timeStart ?? 0
      const e = node.params?.timeEnd ?? maxDuration
      return currentTime >= s - 0.02 && currentTime <= e + 0.02
    },
    [currentTime, maxDuration]
  )

  const activeAtTimeCount = useMemo(
    () => visibleNodes.filter((n) => isNodeActiveAtTime(n)).length,
    [visibleNodes, isNodeActiveAtTime]
  )

  /** Căn toàn bộ cây vừa khít khung nhìn với tỉ lệ thoáng đãng */
  const fitTreeToView = useCallback(() => {
    const el = viewportRef.current
    if (!el || visibleNodes.length === 0) return
    const vw = el.clientWidth || 1280
    const vh = el.clientHeight || 280
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of visibleNodes) {
      const h = estimateV2NodeHeight(n)
      minX = Math.min(minX, n.position.x - 20)
      minY = Math.min(minY, n.position.y - 36)
      maxX = Math.max(maxX, n.position.x + WF_V2_NODE_W + 24)
      maxY = Math.max(maxY, n.position.y + h + 20)
    }
    const graphW = Math.max(400, maxX - minX)
    const graphH = Math.max(180, maxY - minY)
    const availW = Math.max(360, vw - 56)
    const availH = Math.max(160, vh - 14)
    const fitW = availW / graphW
    const fitH = availH / graphH
    const nextZ = Math.min(0.95, Math.max(0.46, Math.min(fitW, Math.max(fitH, 0.52))))
    const nx = Math.max(42, Math.round(46 + (availW - graphW * nextZ) / 2 - minX * nextZ))
    const ny = Math.max(6, Math.round((vh - graphH * nextZ) / 2 - minY * nextZ))
    const roundedZ = Number(nextZ.toFixed(2))
    zoomRef.current = roundedZ
    panRef.current = { x: nx, y: ny }
    setZoom(roundedZ)
    setPan({ x: nx, y: ny })
  }, [visibleNodes])

  useEffect(() => {
    const t = window.setTimeout(() => fitTreeToView(), 45)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id, workflow.nodes.length])

  useEffect(() => {
    const onFit = () => fitTreeToView()
    window.addEventListener('pxs:wf-fit-view', onFit)
    return () => window.removeEventListener('pxs:wf-fit-view', onFit)
  }, [fitTreeToView])

  /** Cuộn chuột phóng to / thu nhỏ 60fps quanh con trỏ */
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const curZ = zoomRef.current
      const curPan = panRef.current
      const factor = Math.exp(-Math.max(-180, Math.min(180, e.deltaY)) * 0.0015)
      const nextZ = Number(Math.max(MIN_Z, Math.min(MAX_Z, curZ * factor)).toFixed(3))
      if (Math.abs(nextZ - curZ) < 0.001) return
      const wx = (mx - curPan.x) / curZ
      const wy = (my - curPan.y) / curZ
      const nextPan = { x: Math.round(mx - wx * nextZ), y: Math.round(my - wy * nextZ) }
      zoomRef.current = nextZ
      panRef.current = nextPan
      setZoom(nextZ)
      setPan(nextPan)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    }
  }, [])

  /** Kéo nền để Pan sơ đồ (hoặc click nền để bỏ lọc nhánh, hiện sáng toàn bộ cây) */
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('wf-v2-world')) {
      return
    }
    setSpawnMenu(null)
    const startX = e.clientX
    const startY = e.clientY
    const initPan = { ...panRef.current }
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true
      const next = {
        x: initPan.x + (ev.clientX - startX),
        y: initPan.y + (ev.clientY - startY)
      }
      panRef.current = next
      setPan(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) {
        onSelectNode('v2-root-scene')
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Kéo di chuyển thẻ Node */
  const handleStartDragNode = (e: React.PointerEvent, node: WorkflowNode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const startW = clientToWorld(e.clientX, e.clientY)
    const initPos = { ...node.position }
    let latest: Record<string, { x: number; y: number }> | null = null
    const onMove = (ev: PointerEvent) => {
      const curW = clientToWorld(ev.clientX, ev.clientY)
      latest = {
        [node.id]: {
          x: Math.round(initPos.x + (curW.x - startW.x)),
          y: Math.round(initPos.y + (curW.y - startW.y))
        }
      }
      setDragPositions(latest)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (latest) {
        onMoveNodes(latest)
        setDragPositions(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Kéo dây kết nối giữa các Node hoặc thả ra khoảng trống để gắn nhanh Node Logic */
  const handleStartWireDrag = (
    e: React.PointerEvent,
    nodeId: string,
    port: WorkflowPortKind,
    isOutput: boolean
  ) => {
    const srcNode = visibleNodeMap.get(nodeId)
    if (!srcNode) return
    const sx = isOutput ? srcNode.position.x + WF_V2_NODE_W : srcNode.position.x
    const sy = srcNode.position.y + 33
    const wPos = clientToWorld(e.clientX, e.clientY)
    setWireDrag({
      nodeId,
      port,
      isOutput,
      startX: sx,
      startY: sy,
      curX: wPos.x,
      curY: wPos.y
    })

    const onMove = (ev: PointerEvent) => {
      const p = clientToWorld(ev.clientX, ev.clientY)
      setWireDrag((prev) => (prev ? { ...prev, curX: p.x, curY: p.y } : null))
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (
        isOutput &&
        srcNode.type === 'layer_assembly' &&
        !srcNode.params?.groupKind
      ) {
        const dropW = clientToWorld(ev.clientX, ev.clientY)
        const hitTarget = visibleNodes.find(
          (n) =>
            n.id !== nodeId &&
            dropW.x >= n.position.x - 16 &&
            dropW.x <= n.position.x + WF_V2_NODE_W + 16 &&
            dropW.y >= n.position.y - 12 &&
            dropW.y <= n.position.y + estimateV2NodeHeight(n) + 12
        )
        if (hitTarget) {
          const tTheme = resolveV2NodeTheme(hitTarget)
          onConnectNodes(nodeId, port, hitTarget.id, tTheme.portIn)
        } else if (Math.hypot(dropW.x - sx, dropW.y - sy) > 36) {
          setSpawnMenu({
            layerNodeId: nodeId,
            clientX: ev.clientX,
            clientY: ev.clientY
          })
        }
      }
      setWireDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleCompleteWireDrop = (
    targetNodeId: string,
    targetPort: WorkflowPortKind,
    isTargetInput: boolean
  ) => {
    if (!wireDrag || wireDrag.nodeId === targetNodeId) return
    if (wireDrag.isOutput && isTargetInput) {
      onConnectNodes(wireDrag.nodeId, wireDrag.port, targetNodeId, targetPort)
    } else if (!wireDrag.isOutput && !isTargetInput) {
      onConnectNodes(targetNodeId, targetPort, wireDrag.nodeId, wireDrag.port)
    }
    setWireDrag(null)
  }

  const playheadPct = Math.max(0, Math.min(100, (currentTime / maxDuration) * 100))

  return (
    <div className="wf-v2-canvas-shell">
      {/* 1. ĐƯỜNG KẺ MỐC THỜI GIAN TRÊN ĐỈNH (MASTER TIME RULER) */}
      <WorkflowTimeRulerV2
        project={project}
        currentTime={currentTime}
        duration={maxDuration}
        playing={playing}
        shots={project.shots}
        selectedNode={selectedNode}
        activeAtTimeCount={activeAtTimeCount}
        onSetTime={onSetTime}
        onTogglePlay={onTogglePlay}
        onUpdateNodeTimeRange={(nodeId, nextStart, nextEnd) =>
          onUpdateNodeParams(nodeId, { timeStart: nextStart, timeEnd: nextEnd })
        }
      />

      {/* 2. KHUNG VẼ CÂY PHÂN CẤP WORKFLOW V2 */}
      <div
        ref={viewportRef}
        className="wf-canvas-viewport wf-v2-viewport"
        data-mcp-region="workflow_canvas"
        onPointerDown={handleCanvasPointerDown}
      >
        {/* Đường kẻ kim thời gian chạy dọc xuyên khung vẽ */}
        <div
          className="wf-v2-vertical-playhead"
          style={{ left: `calc(230px + (100% - 242px) * ${playheadPct / 100})` }}
        />

        {/* Cụm HUD dọc gọn gàng bên trái */}
        <div
          className="wf-canvas-hud vertical wf-v2-hud"
          data-mcp-region="workflow_canvas_hud"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="wf-hud-btn"
            title="Sắp xếp cây phân cấp chuẩn thoáng đãng (Alt+L)"
            onClick={() => {
              onAutoLayout()
              window.setTimeout(() => fitTreeToView(), 40)
            }}
          >
            ✨
          </button>
          <button
            type="button"
            className="wf-hud-btn"
            title={
              wireStyle === 'smoothstep'
                ? 'Đang dùng Dây vuông mượt (SmoothStep chuẩn React Flow) — nhấn để đổi sang Dây cong Bezier'
                : 'Đang dùng Dây cong Bezier — nhấn để đổi sang Dây vuông mượt (SmoothStep)'
            }
            onClick={() => setWireStyle((s) => (s === 'smoothstep' ? 'bezier' : 'smoothstep'))}
          >
            {wireStyle === 'smoothstep' ? '⑂' : '∿'}
          </button>
          <button
            type="button"
            className="wf-hud-btn"
            title="Căn vừa toàn bộ cây vào khung nhìn"
            onClick={fitTreeToView}
          >
            ⛶
          </button>
          <div className="wf-hud-divider" />
          <button
            type="button"
            className="wf-hud-btn"
            title="Phóng to"
            onClick={() => setZoom((z) => Number(Math.min(MAX_Z, z + 0.12).toFixed(2)))}
          >
            ＋
          </button>
          <span className="wf-hud-zoom-readout">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="wf-hud-btn"
            title="Thu nhỏ"
            onClick={() => setZoom((z) => Number(Math.max(MIN_Z, z - 0.12).toFixed(2)))}
          >
            －
          </button>
        </div>

        {/* MẶT PHẲNG THẾ GIỚI 4 CỘT PHÂN CẤP THOÁNG ĐÃNG */}
        <div
          className="wf-v2-world"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Nhãn định hướng 4 tầng phân cấp */}
          <div className="wf-v2-col-banner" style={{ left: WF_V2_COL_X.ROOT, width: WF_V2_NODE_W }}>
            <span>1. CẢNH ROOT & CAMERA</span>
          </div>
          <div className="wf-v2-col-banner" style={{ left: WF_V2_COL_X.GROUP, width: WF_V2_NODE_W }}>
            <span>2. GROUP LAYER (3D / 2.5D)</span>
          </div>
          <div className="wf-v2-col-banner" style={{ left: WF_V2_COL_X.LAYER, width: WF_V2_NODE_W }}>
            <span>3. CÁC NODE LAYER</span>
          </div>
          <div className="wf-v2-col-banner" style={{ left: WF_V2_COL_X.LOGIC, width: WF_V2_NODE_W }}>
            <span>4. NODE LOGIC CỦA TỪNG LAYER</span>
          </div>

          {/* LỚP SVG VẼ DÂY NỐI CHUẨN REACT FLOW / N8N (SMOOTHSTEP + ARROWHEAD + LINEAGE HIGHLIGHT) */}
          <svg className="wf-v2-edges-svg" width={2600} height={2400}>
            <defs>
              <marker
                id="wf-v2-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="context-stroke" />
              </marker>
            </defs>

            {visibleEdges.map((edge) => {
              const fromN = visibleNodeMap.get(edge.fromNode)
              const toN = visibleNodeMap.get(edge.toNode)
              if (!fromN || !toN) return null

              const isSameColumn = Math.abs(fromN.position.x - toN.position.x) < 40
              let pathD: string
              if (isSameColumn) {
                const cx = Math.round(fromN.position.x + WF_V2_NODE_W / 2)
                const y1 = fromN.position.y + estimateV2NodeHeight(fromN)
                const y2 = toN.position.y - 2
                pathD = `M ${cx} ${y1} L ${cx} ${y2}`
              } else {
                const x1 = fromN.position.x + WF_V2_NODE_W
                const y1 = fromN.position.y + 33
                const x2 = toN.position.x - 2
                const y2 = toN.position.y + 33
                const channelX = Math.round(x1 + (x2 - x1) * 0.46)
                const dx = Math.max(58, Math.abs(x2 - x1) * 0.46)
                pathD =
                  wireStyle === 'smoothstep'
                    ? buildSmoothStepWirePath(x1, y1, x2, y2, channelX, 14)
                    : `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
              }

              const targetTheme = resolveV2NodeTheme(toN)
              const isEdgeActive = isNodeActiveAtTime(fromN) && isNodeActiveAtTime(toN)
              const isHighlighted = !isFilteringLineage || highlightedEdgeIds.has(edge.id)
              const isDimmed = isFilteringLineage && !highlightedEdgeIds.has(edge.id)

              return (
                <g
                  key={edge.id}
                  className={[
                    'wf-v2-edge-group',
                    isEdgeActive ? 'active' : '',
                    isHighlighted ? 'highlighted' : '',
                    isDimmed ? 'dimmed' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onSelectNode(toN.id)
                  }}
                  onDoubleClick={(ev) => {
                    ev.stopPropagation()
                    onDisconnectEdge(edge.id)
                  }}
                >
                  {/* Đường nền phát sáng nhẹ */}
                  <path
                    d={pathD}
                    className="wf-v2-edge-bg"
                    style={{ stroke: targetTheme.accent }}
                  />
                  {/* Đường dây chính sắc nét kèm mũi tên định hướng vào cổng nhận */}
                  <path
                    d={pathD}
                    className={`wf-v2-edge-fg ${isEdgeActive && isHighlighted ? 'flowing' : ''}`}
                    style={{ stroke: targetTheme.accent }}
                    markerEnd="url(#wf-v2-arrow)"
                  />
                </g>
              )
            })}

            {wireDrag && (
              <path
                d={`M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + 68} ${wireDrag.startY}, ${wireDrag.curX - 68} ${wireDrag.curY}, ${wireDrag.curX} ${wireDrag.curY}`}
                className="wf-v2-edge-dragging"
                markerEnd="url(#wf-v2-arrow)"
              />
            )}
          </svg>

          {/* DANH SÁCH CÁC THẺ NODE */}
          {visibleNodes.map((node) => {
            const isHighlighted = !isFilteringLineage || highlightedNodeIds.has(node.id)
            const isDimmed = isFilteringLineage && !highlightedNodeIds.has(node.id)
            return (
              <WorkflowNodeCardV2
                key={node.id}
                node={node}
                project={project}
                selected={node.id === selectedNodeId}
                isConnectedToSelected={isFilteringLineage && isHighlighted && node.id !== selectedNodeId}
                isDimmed={isDimmed}
                isActiveAtCurrentTime={isNodeActiveAtTime(node)}
                currentTime={currentTime}
                maxDuration={maxDuration}
                childCount={childCountMap.get(node.id) ?? 0}
                onSelect={onSelectNode}
                onStartDragNode={handleStartDragNode}
                onToggleEnable={onToggleNodeEnable}
                onDeleteNode={onDeleteNode}
                onUpdateParams={onUpdateNodeParams}
                onAttachLogicToLayer={onAttachLogicToLayer}
                onStartWireDrag={handleStartWireDrag}
                onCompleteWireDrop={handleCompleteWireDrop}
                onScrubTime={onSetTime}
                onRebuildSceneTree={node.type === 'scene_shot' ? onRebuildSceneTree : undefined}
              />
            )
          })}
        </div>

        {/* Menu thả dây ra khoảng trống để gắn nhanh Node Logic cho Layer */}
        {spawnMenu && (
          <div
            className="wf-v2-quick-spawn-menu"
            style={{ left: spawnMenu.clientX - 60, top: spawnMenu.clientY - 20 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="wf-v2-quick-spawn-title">Gắn Node Logic vào Layer:</div>
            <button
              type="button"
              onClick={() => {
                onAttachLogicToLayer(spawnMenu.layerNodeId, 'action')
                setSpawnMenu(null)
              }}
            >
              🏃 + Node Hành động (Chuyển động)
            </button>
            <button
              type="button"
              onClick={() => {
                onAttachLogicToLayer(spawnMenu.layerNodeId, 'light')
                setSpawnMenu(null)
              }}
            >
              💡 + Node Ánh sáng (Đèn 2.5D/Glow)
            </button>
            <button
              type="button"
              onClick={() => {
                onAttachLogicToLayer(spawnMenu.layerNodeId, 'cave')
                setSpawnMenu(null)
              }}
            >
              🕳️ + Node Hang động (Vùng độ sâu)
            </button>
            <button
              type="button"
              onClick={() => {
                onAttachLogicToLayer(spawnMenu.layerNodeId, 'fx')
                setSpawnMenu(null)
              }}
            >
              ✨ + Node Hiệu ứng & Vật lý
            </button>
            <button
              type="button"
              onClick={() => {
                onAttachLogicToLayer(spawnMenu.layerNodeId, 'audio')
                setSpawnMenu(null)
              }}
            >
              🔊 + Node Âm thanh / Thoại
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
