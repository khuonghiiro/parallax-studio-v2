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
const MIN_Z = 0.18
const MAX_Z = 1.6
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
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 32, y: 18 })
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
  /** Căn toàn bộ cây vừa khít khung nhìn */
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
    const availH = Math.max(160, vh - 16)
    const nextZ = Math.min(1.0, Math.max(0.28, Math.min(availW / graphW, availH / graphH)))
    const nx = Math.round(44 + (availW - graphW * nextZ) / 2 - minX * nextZ)
    const ny = Math.round((vh - graphH * nextZ) / 2 - minY * nextZ)
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
  /** Kéo nền để Pan sơ đồ */
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('wf-v2-world')) {
      return
    }
    setSpawnMenu(null)
    const startX = e.clientX
    const startY = e.clientY
    const initPan = { ...panRef.current }
    const onMove = (ev: PointerEvent) => {
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
    const sy = srcNode.position.y + 38
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
      // Nếu kéo từ một Node Layer ra khoảng trống -> mở menu chọn nhanh Node Logic
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
            title="Sắp xếp cây phân cấp chuẩn (Alt+L)"
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
            title="Đồng bộ / Bung lại Cây Cảnh từ dữ liệu thật"
            onClick={() => {
              onRebuildSceneTree()
              window.setTimeout(() => fitTreeToView(), 50)
            }}
          >
            🎬
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
        {/* MẶT PHẲNG THẾ GIỚI 4 CỘT PHÂN CẤP */}
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
            <span>4. NODE HÀNH ĐỘNG · ÁNH SÁNG · HIỆU ỨNG</span>
          </div>
          {/* LỚP SVG VẼ DÂY NỐI TRÁI -> PHẢI KÈM NHÃN KHOẢNG MỐC THỜI GIAN */}
          <svg className="wf-v2-edges-svg" width={2400} height={2400}>
            {visibleEdges.map((edge) => {
              const fromN = visibleNodeMap.get(edge.fromNode)
              const toN = visibleNodeMap.get(edge.toNode)
              if (!fromN || !toN) return null
              const x1 = fromN.position.x + WF_V2_NODE_W
              const y1 = fromN.position.y + 38
              const x2 = toN.position.x
              const y2 = toN.position.y + 38
              const dx = Math.max(48, Math.abs(x2 - x1) * 0.46)
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
              const targetTheme = resolveV2NodeTheme(toN)
              const isEdgeActive = isNodeActiveAtTime(fromN) && isNodeActiveAtTime(toN)
              const midX = Math.round((x1 + x2) / 2)
              const midY = Math.round((y1 + y2) / 2)
              const tStart = (toN.params?.timeStart ?? 0).toFixed(1)
              const tEnd = (toN.params?.timeEnd ?? maxDuration).toFixed(1)
              return (
                <g key={edge.id} className={`wf-v2-edge-group ${isEdgeActive ? 'active' : ''}`}>
                  <path
                    d={pathD}
                    className="wf-v2-edge-bg"
                    style={{ stroke: targetTheme.accent }}
                  />
                  <path
                    d={pathD}
                    className={`wf-v2-edge-fg ${isEdgeActive ? 'flowing' : ''}`}
                    style={{ stroke: targetTheme.accent }}
                  />
                  {/* Nhãn khoảng mốc thời gian ngay trên sợi dây kết nối */}
                  <g
                    className="wf-v2-edge-time-badge"
                    transform={`translate(${midX}, ${midY})`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onSelectNode(toN.id)
                    }}
                    onDoubleClick={(ev) => {
                      ev.stopPropagation()
                      onDisconnectEdge(edge.id)
                    }}
                  >
                    <rect
                      x={-36}
                      y={-10}
                      width={72}
                      height={20}
                      rx={4}
                      className="wf-v2-edge-pill-rect"
                      style={{ stroke: targetTheme.accent }}
                    />
                    <text x={0} y={4} textAnchor="middle" className="wf-v2-edge-pill-text">
                      ⏱ {tStart}–{tEnd}s
                    </text>
                  </g>
                </g>
              )
            })}
            {wireDrag && (
              <path
                d={`M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + 60} ${wireDrag.startY}, ${wireDrag.curX - 60} ${wireDrag.curY}, ${wireDrag.curX} ${wireDrag.curY}`}
                className="wf-v2-edge-dragging"
              />
            )}
          </svg>
          {/* DANH SÁCH CÁC THẺ NODE */}
          {visibleNodes.map((node) => (
            <WorkflowNodeCardV2
              key={node.id}
              node={node}
              project={project}
              selected={node.id === selectedNodeId}
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
          ))}
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
