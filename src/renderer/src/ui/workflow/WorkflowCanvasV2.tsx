import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import {
  V2_SHARED_CLUSTER,
  WF_V2_CAMERA_LANE_X,
  WF_V2_COL_X,
  WF_V2_NODE_H,
  WF_V2_NODE_W,
  computeV2Clusters,
  resolveHiddenV2NodeIds,
  v2RootId,
  validateWorkflowV2Connection
} from '../../project/workflowV2Engine'
import { WorkflowNodeCardV2, isDeletableV2Node } from './WorkflowNodeCardV2'
import { WorkflowTimeRulerV2 } from './WorkflowTimeRulerV2'
import {
  WorkflowV2CanvasHud,
  WorkflowV2ClusterFrames,
  WorkflowV2EdgeLayer,
  WorkflowV2Legend,
  type EdgeRenderItem
} from './WorkflowV2CanvasChrome'
import { WorkflowV2SpawnMenu } from './WorkflowV2SpawnMenu'
import { useWorkflowV2CanvasInteractions } from './useWorkflowV2CanvasInteractions'
import { useWorkflowV2Viewport, type WorkflowV2Viewport } from './useWorkflowV2Viewport'
import { classifyV2Edge, computeV2Lineage } from './workflowV2Edges'
import type { WorkflowV2SpawnCategory } from './workflowV2Theme'

export interface WorkflowCanvasV2Props {
  workflow: WorkflowGraph
  project: Project
  currentTime: number
  playing: boolean
  /** Cảnh camera đang quay tại đầu phát (null khi đang lia chuyển cảnh) */
  activeShotId: string | null
  follow: boolean
  onToggleFollow: () => void
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onMoveNodes: (positions: Record<string, { x: number; y: number }>) => void
  onToggleNodeEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onAttachLogicToLayer: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onConnectNodes: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
  onToggleEdgeDisable?: (edgeId: string) => void
  onSpawnCameraWaypoint?: (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold', fromWaypointTime?: number) => void
}

const COLUMN_BANNERS = [
  { x: WF_V2_COL_X.ROOT, label: 'CẢNH & CAMERA' },
  { x: WF_V2_COL_X.GROUP, label: 'NHÓM LAYER' },
  { x: WF_V2_COL_X.LAYER, label: 'LAYER' },
  { x: WF_V2_COL_X.LOGIC, label: 'LOGIC CỦA LAYER' }
]
const CULL_MARGIN = 240

function activeAt(node: WorkflowNode, t: number, maxDuration: number): boolean {
  if (!node.enabled) return false
  return t >= (node.params?.timeStart ?? 0) - 0.02 && t <= (node.params?.timeEnd ?? maxDuration) + 0.02
}

/** Node hiển thị (bỏ nhánh thu gọn), cụm cảnh và số nhánh con */
function useSpaceGraph(workflow: WorkflowGraph, project: Project, dragPositions: Record<string, { x: number; y: number }> | null) {
  return useMemo(() => {
    const nodes = dragPositions ? workflow.nodes.map((n) => (dragPositions[n.id] ? { ...n, position: dragPositions[n.id] } : n)) : workflow.nodes
    const hidden = resolveHiddenV2NodeIds(nodes, workflow.edges)
    const childCount = new Map<string, number>()
    for (const e of workflow.edges) childCount.set(e.fromNode, (childCount.get(e.fromNode) ?? 0) + 1)
    const visibleNodes = nodes.filter((n) => !hidden.has(n.id))
    const visibleMap = new Map(visibleNodes.map((n) => [n.id, n]))
    const visibleEdges = workflow.edges.filter((e) => visibleMap.has(e.fromNode) && visibleMap.has(e.toNode))
    const clusters = computeV2Clusters(nodes, workflow.edges, hidden).map((c) => {
      const root = nodes.find((n) => n.id === c.rootId)
      const shot = project.shots.find((s) => s.id === c.shotId)
      return {
        ...c,
        title: root?.title ?? 'Cảnh',
        range: root?.params ? { start: root.params.timeStart ?? 0, end: root.params.timeEnd ?? 0 } : undefined,
        color: shot?.color
      }
    })
    const clusterOf = new Map<string, string>()
    for (const c of clusters) for (const id of c.nodeIds) clusterOf.set(id, c.rootId)
    return { nodes, visibleNodes, visibleMap, visibleEdges, childCount, clusters, clusterOf }
  }, [workflow.nodes, workflow.edges, project.shots, dragPositions])
}

/** Vùng thế giới đang nhìn thấy (để chỉ render thẻ / dây trong tầm nhìn — nhẹ khi nhiều cảnh trong 1 không gian) */
function useViewRect(vp: WorkflowV2Viewport) {
  const m = CULL_MARGIN / vp.zoom
  return { x0: -vp.pan.x / vp.zoom - m, y0: -vp.pan.y / vp.zoom - m, x1: (vp.size.w - vp.pan.x) / vp.zoom + m, y1: (vp.size.h - vp.pan.y) / vp.zoom + m }
}

type ViewRect = ReturnType<typeof useViewRect>
const nodeInView = (n: WorkflowNode, r: ViewRect): boolean =>
  n.position.x + WF_V2_NODE_W >= r.x0 && n.position.x <= r.x1 && n.position.y + WF_V2_NODE_H >= r.y0 && n.position.y <= r.y1

/** Dựng danh sách dây cần vẽ: loại dây, làn tách khi nhiều dây đổ vào 1 Node, trạng thái đang chạy */
function buildEdgeItems(
  graph: ReturnType<typeof useSpaceGraph>,
  running: Set<string>,
  lineage: { edgeIds: Set<string>; active: boolean },
  view: ViewRect,
  t: number
): EdgeRenderItem[] {
  const incoming = new Map<string, WorkflowNode[]>()
  for (const e of graph.visibleEdges) {
    const list = incoming.get(e.toNode) ?? []
    list.push(graph.visibleMap.get(e.fromNode)!)
    incoming.set(e.toNode, list)
  }
  const items: EdgeRenderItem[] = []
  for (const edge of graph.visibleEdges) {
    const from = graph.visibleMap.get(edge.fromNode)!
    const to = graph.visibleMap.get(edge.toNode)!
    const kind = classifyV2Edge(edge, from, to)
    const minX = Math.min(from.position.x, to.position.x, kind === 'camera' ? WF_V2_CAMERA_LANE_X : Infinity)
    const maxX = Math.max(from.position.x, to.position.x) + WF_V2_NODE_W
    const minY = Math.min(from.position.y, to.position.y)
    const maxY = Math.max(from.position.y, to.position.y) + WF_V2_NODE_H
    if (maxX < view.x0 || minX > view.x1 || maxY < view.y0 || minY > view.y1) continue
    const sources = (incoming.get(edge.toNode) ?? []).sort((a, b) => a.position.y - b.position.y)
    const lane = sources.length > 1 ? sources.indexOf(from) - (sources.length - 1) / 2 : 0
    const fromEnd = from.params?.timeEnd ?? 0
    const toStart = to.params?.timeStart ?? 0
    const isRunning = edge.disabled
      ? false
      : kind === 'camera'
        ? t >= fromEnd - 0.6 && t <= toStart + 0.8
        : to.params?.isCameraWaypoint
          ? running.has(to.id)
          : running.has(from.id) && running.has(to.id)
    items.push({
      edge,
      from,
      to,
      kind,
      lane,
      running: isRunning,
      lit: !lineage.active || lineage.edgeIds.has(edge.id),
      label: kind === 'camera' ? `⇄ ${toStart.toFixed(1)}s` : undefined
    })
  }
  return items
}

export const WorkflowCanvasV2: React.FC<WorkflowCanvasV2Props> = (props) => {
  const { workflow, project, currentTime, selectedNodeId, onSelectNode, onSetTime } = props
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const [wireStyle, setWireStyle] = useState<'smoothstep' | 'bezier'>('smoothstep')
  const maxDuration = Math.max(1, project.comp.duration || 5)
  const graph = useSpaceGraph(workflow, project, dragPositions)
  const rootIds = useMemo(() => new Set(graph.clusters.map((c) => c.rootId)), [graph.clusters])
  const lineage = useMemo(() => computeV2Lineage(selectedNodeId, graph.visibleEdges, rootIds), [selectedNodeId, graph.visibleEdges, rootIds])
  const vp = useWorkflowV2Viewport(graph.visibleNodes)
  const validate = useCallback((from: string, to: string) => validateWorkflowV2Connection(workflow, from, to), [workflow])
  const ix = useWorkflowV2CanvasInteractions(vp, graph.visibleNodes, setDragPositions, { ...props, validate })
  const view = useViewRect(vp)

  const activeRootId = props.activeShotId ? v2RootId(props.activeShotId) : null
  const sharedRootId = v2RootId(V2_SHARED_CLUSTER)
  const isLive = useCallback((n: WorkflowNode) => activeAt(n, currentTime, maxDuration), [currentTime, maxDuration])
  const running = useMemo(() => {
    const set = new Set<string>()
    for (const n of graph.visibleNodes) {
      const cluster = graph.clusterOf.get(n.id)
      if ((cluster === activeRootId || cluster === sharedRootId) && isLive(n)) set.add(n.id)
    }
    return set
  }, [graph, activeRootId, sharedRootId, isLive])
  const edgeItems = useMemo(() => buildEdgeItems(graph, running, lineage, view, currentTime), [graph, running, lineage, view.x0, view.y0, view.x1, view.y1, currentTime])
  const cards = graph.visibleNodes.filter((n) => nodeInView(n, view) || n.id === selectedNodeId)

  const focusCluster = useCallback(
    (rootId: string) => {
      const c = graph.clusters.find((x) => x.rootId === rootId)
      if (c) vp.focusBounds(c.bounds)
    },
    [graph.clusters, vp]
  )
  useCanvasEvents(vp, workflow.id, graph.visibleNodes.length, focusCluster)
  // Theo dõi cảnh: khi đang phát video và đầu phát chuyển sang cảnh khác, khung nhìn tự di chuyển tới cụm Workflow của cảnh đó
  // (không tự nhảy về đầu cụm khi người dùng đang dừng để bấm chọn Node con ở các cột bên phải)
  useEffect(() => {
    if (!props.follow || !activeRootId) return
    if (!props.playing && selectedNodeId && graph.clusterOf.get(selectedNodeId) === activeRootId) return
    focusCluster(activeRootId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRootId, props.follow])

  const wireStateOf = (n: WorkflowNode): 'valid' | 'invalid' | 'hover-valid' | 'hover-invalid' | undefined => {
    const w = ix.wireDrag
    if (!w || w.nodeId === n.id) return undefined
    if (w.hoverNodeId === n.id) return w.hoverValid ? 'hover-valid' : 'hover-invalid'
    const ok = w.isOutput ? validate(w.nodeId, n.id).valid : validate(n.id, w.nodeId).valid
    return ok ? 'valid' : 'invalid'
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const sel = workflow.nodes.find((n) => n.id === selectedNodeId)
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && isDeletableV2Node(sel)) props.onDeleteNode(sel.id)
    else if (e.key === 'f' || e.key === 'F') vp.fitToView(e.shiftKey)
    else if (e.key === 'Escape') onSelectNode(null)
    else return
    e.preventDefault()
  }

  return (
    <div className="wf-v2-canvas-shell">
      <WorkflowTimeRulerV2
        currentTime={currentTime}
        duration={maxDuration}
        playing={props.playing}
        selectedNode={graph.nodes.find((n) => n.id === selectedNodeId) ?? null}
        scopeRange={graph.clusters.find((c) => c.rootId === activeRootId)?.range ?? { start: 0, end: maxDuration }}
        activeAtTimeCount={running.size}
        onSetTime={onSetTime}
        onTogglePlay={props.onTogglePlay}
        onUpdateNodeTimeRange={(id, s, en) => props.onUpdateNodeParams(id, { timeStart: s, timeEnd: en })}
      />

      <div
        ref={vp.viewportRef}
        className={`wf-canvas-viewport wf-v2-viewport${ix.wireDrag ? ' wiring' : ''}`}
        data-mcp-region="workflow_canvas"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={ix.onCanvasPointerDown}
      >
        <WorkflowV2CanvasHud
          zoom={vp.zoom}
          wireStyle={wireStyle}
          follow={props.follow}
          onFit={(all) => vp.fitToView(all)}
          onZoom={(f) => vp.zoomBy(f)}
          onToggleWireStyle={() => setWireStyle((s) => (s === 'smoothstep' ? 'bezier' : 'smoothstep'))}
          onToggleFollow={props.onToggleFollow}
        />
        <WorkflowV2Legend />

        <div className="wf-v2-world" style={{ transform: `translate3d(${vp.pan.x}px, ${vp.pan.y}px, 0) scale(${vp.zoom})` }}>
          {COLUMN_BANNERS.map((b) => (
            <div key={b.label} className="wf-v2-col-banner" style={{ left: b.x, width: WF_V2_NODE_W }}>
              {b.label}
            </div>
          ))}
          <WorkflowV2ClusterFrames clusters={graph.clusters} activeRootId={activeRootId} onFocus={focusCluster} />
          <WorkflowV2EdgeLayer
            items={edgeItems}
            wireStyle={wireStyle}
            lineageActive={lineage.active}
            wireDrag={ix.wireDrag}
            nodeMap={graph.visibleMap}
            onSelectNode={onSelectNode}
            onDisconnectEdge={props.onDisconnectEdge}
            onToggleEdgeDisable={props.onToggleEdgeDisable}
          />
          {cards.map((node) => (
            <WorkflowNodeCardV2
              key={node.id}
              node={node}
              project={project}
              selected={node.id === selectedNodeId}
              isConnectedToSelected={lineage.active && lineage.nodeIds.has(node.id) && node.id !== selectedNodeId}
              isDimmed={lineage.active && !lineage.nodeIds.has(node.id)}
              isActiveAtCurrentTime={isLive(node)}
              running={running.has(node.id)}
              wireState={wireStateOf(node)}
              currentTime={currentTime}
              maxDuration={maxDuration}
              childCount={graph.childCount.get(node.id) ?? 0}
              onSelect={onSelectNode}
              onStartDragNode={ix.onStartDragNode}
              onToggleEnable={props.onToggleNodeEnable}
              onDeleteNode={props.onDeleteNode}
              onUpdateParams={props.onUpdateNodeParams}
              onStartWireDrag={ix.onStartWireDrag}
              onScrubTime={onSetTime}
              onSpawnCameraWaypoint={props.onSpawnCameraWaypoint}
            />
          ))}
        </div>

        {ix.wireDrag?.hoverNodeId && !ix.wireDrag.hoverValid && ix.wireDrag.hoverReason && (
          <div className="wf-v2-wire-reason" role="status">{ix.wireDrag.hoverReason}</div>
        )}
        {!workflow.nodes.some((n) => n.type === 'layer_assembly' && !n.params?.groupKind) && (
          <div className="wf-v2-empty">Dự án chưa có Layer nào — thêm ảnh/Layer vào cảnh để bung cây Workflow.</div>
        )}
        {ix.spawnMenu && (
          <WorkflowV2SpawnMenu
            clientX={ix.spawnMenu.clientX}
            clientY={ix.spawnMenu.clientY}
            parentNode={graph.nodes.find((n) => n.id === ix.spawnMenu!.layerNodeId)}
            project={project}
            onPick={(cat, presetId, extraParams, customTitle) => {
              props.onAttachLogicToLayer(ix.spawnMenu!.layerNodeId, cat, presetId, extraParams, customTitle)
              ix.setSpawnMenu(null)
            }}
            onClose={() => ix.setSpawnMenu(null)}
          />
        )}
      </div>
    </div>
  )
}

/** Tự căn khung khi số Node đổi; lắng nghe yêu cầu "vừa khung" / "tới Node" / "tới cụm cảnh" từ bên ngoài */
function useCanvasEvents(vp: WorkflowV2Viewport, workflowId: string, visibleCount: number, focusCluster: (rootId: string) => void): void {
  const { fitToView, focusNode } = vp
  useEffect(() => {
    const t = window.setTimeout(() => fitToView(), 40)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])
  useEffect(() => {
    const onFit = (e: Event): void => fitToView(Boolean((e as CustomEvent<{ all?: boolean }>).detail?.all))
    const onFocus = (e: Event): void => {
      const id = (e as CustomEvent<{ nodeId?: string }>).detail?.nodeId
      if (id) window.setTimeout(() => focusNode(id), 30)
    }
    const onCluster = (e: Event): void => {
      const id = (e as CustomEvent<{ rootId?: string }>).detail?.rootId
      if (id) focusCluster(id)
    }
    window.addEventListener('pxs:wf-fit-view', onFit)
    window.addEventListener('pxs:wf-focus-node', onFocus)
    window.addEventListener('pxs:wf-focus-cluster', onCluster)
    return () => {
      window.removeEventListener('pxs:wf-fit-view', onFit)
      window.removeEventListener('pxs:wf-focus-node', onFocus)
      window.removeEventListener('pxs:wf-focus-cluster', onCluster)
    }
  }, [fitToView, focusNode, focusCluster, visibleCount])
}
