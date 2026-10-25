import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import { WF_V2_COL_X, WF_V2_NODE_W, resolveHiddenV2NodeIds } from '../../project/workflowV2Engine'
import { WorkflowNodeCardV2 } from './WorkflowNodeCardV2'
import { WorkflowTimeRulerV2 } from './WorkflowTimeRulerV2'
import { WorkflowV2CanvasHud, WorkflowV2EdgeLayer } from './WorkflowV2CanvasChrome'
import { WorkflowV2SpawnMenu } from './WorkflowV2SpawnMenu'
import { useWorkflowV2CanvasInteractions } from './useWorkflowV2CanvasInteractions'
import { useWorkflowV2Viewport } from './useWorkflowV2Viewport'
import { computeV2Lineage } from './workflowV2Edges'
import type { WorkflowV2SpawnCategory } from './workflowV2Theme'

export interface WorkflowCanvasV2Props {
  workflow: WorkflowGraph
  project: Project
  currentTime: number
  playing: boolean
  scopeRange: { start: number; end: number }
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onMoveNodes: (positions: Record<string, { x: number; y: number }>) => void
  onToggleNodeEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onAttachLogicToLayer: (layerNodeId: string, category: WorkflowV2SpawnCategory) => void
  onConnectNodes: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
}

const COLUMN_BANNERS = [
  { x: WF_V2_COL_X.ROOT, label: 'CẢNH & CAMERA' },
  { x: WF_V2_COL_X.GROUP, label: 'NHÓM LAYER' },
  { x: WF_V2_COL_X.LAYER, label: 'LAYER' },
  { x: WF_V2_COL_X.LOGIC, label: 'LOGIC CỦA LAYER' }
]

/** Node có đang hoạt động tại mốc thời gian hiện tại không */
function activeAt(node: WorkflowNode, t: number, maxDuration: number): boolean {
  if (!node.enabled) return false
  return t >= (node.params?.timeStart ?? 0) - 0.02 && t <= (node.params?.timeEnd ?? maxDuration) + 0.02
}

/** Node hiển thị (bỏ nhánh thu gọn), số nhánh con và đồ thị dây hiển thị */
function useVisibleGraph(workflow: WorkflowGraph, dragPositions: Record<string, { x: number; y: number }> | null) {
  return useMemo(() => {
    const nodes = dragPositions
      ? workflow.nodes.map((n) => (dragPositions[n.id] ? { ...n, position: dragPositions[n.id] } : n))
      : workflow.nodes
    const hidden = resolveHiddenV2NodeIds(nodes, workflow.edges)
    const childCount = new Map<string, number>()
    for (const e of workflow.edges) childCount.set(e.fromNode, (childCount.get(e.fromNode) ?? 0) + 1)
    const visibleNodes = nodes.filter((n) => !hidden.has(n.id))
    const visibleMap = new Map(visibleNodes.map((n) => [n.id, n]))
    const visibleEdges = workflow.edges.filter((e) => visibleMap.has(e.fromNode) && visibleMap.has(e.toNode))
    return { nodes, visibleNodes, visibleMap, visibleEdges, childCount }
  }, [workflow.nodes, workflow.edges, dragPositions])
}

/** Tự căn khung khi đổi phạm vi / số Node, và lắng nghe yêu cầu "vừa khung" / "tới Node" từ bên ngoài */
function useViewportEvents(fitToView: () => void, focusNode: (id: string) => void, workflowId: string, visibleCount: number): void {
  useEffect(() => {
    const t = window.setTimeout(fitToView, 40)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, visibleCount])
  useEffect(() => {
    const onFit = (): void => fitToView()
    const onFocus = (e: Event): void => {
      const id = (e as CustomEvent<{ nodeId?: string }>).detail?.nodeId
      if (id) window.setTimeout(() => focusNode(id), 30)
    }
    window.addEventListener('pxs:wf-fit-view', onFit)
    window.addEventListener('pxs:wf-focus-node', onFocus)
    return () => {
      window.removeEventListener('pxs:wf-fit-view', onFit)
      window.removeEventListener('pxs:wf-focus-node', onFocus)
    }
  }, [fitToView, focusNode])
}

export const WorkflowCanvasV2: React.FC<WorkflowCanvasV2Props> = (props) => {
  const { workflow, project, currentTime, selectedNodeId, onSelectNode, onSetTime } = props
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const [wireStyle, setWireStyle] = useState<'smoothstep' | 'bezier'>('smoothstep')
  const maxDuration = Math.max(1, project.comp.duration || 5)
  const graph = useVisibleGraph(workflow, dragPositions)
  const lineage = useMemo(() => computeV2Lineage(selectedNodeId, graph.visibleEdges), [selectedNodeId, graph.visibleEdges])
  const vp = useWorkflowV2Viewport(graph.visibleNodes)
  const ix = useWorkflowV2CanvasInteractions(vp, graph.visibleNodes, setDragPositions, props)
  useViewportEvents(vp.fitToView, vp.focusNode, workflow.id, graph.visibleNodes.length)

  const isLive = useCallback((n: WorkflowNode) => activeAt(n, currentTime, maxDuration), [currentTime, maxDuration])
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) ?? null
  const activeCount = graph.visibleNodes.filter(isLive).length

  return (
    <div className="wf-v2-canvas-shell">
      <WorkflowTimeRulerV2
        currentTime={currentTime}
        duration={maxDuration}
        playing={props.playing}
        selectedNode={selectedNode}
        scopeRange={props.scopeRange}
        activeAtTimeCount={activeCount}
        onSetTime={onSetTime}
        onTogglePlay={props.onTogglePlay}
        onUpdateNodeTimeRange={(id, s, e) => props.onUpdateNodeParams(id, { timeStart: s, timeEnd: e })}
      />

      <div ref={vp.viewportRef} className="wf-canvas-viewport wf-v2-viewport" data-mcp-region="workflow_canvas" onPointerDown={ix.onCanvasPointerDown}>
        <WorkflowV2CanvasHud
          zoom={vp.zoom}
          wireStyle={wireStyle}
          onFit={vp.fitToView}
          onZoom={(f) => vp.zoomBy(f)}
          onToggleWireStyle={() => setWireStyle((s) => (s === 'smoothstep' ? 'bezier' : 'smoothstep'))}
        />

        <div className="wf-v2-world" style={{ transform: `translate3d(${vp.pan.x}px, ${vp.pan.y}px, 0) scale(${vp.zoom})` }}>
          {COLUMN_BANNERS.map((b) => (
            <div key={b.label} className="wf-v2-col-banner" style={{ left: b.x, width: WF_V2_NODE_W }}>
              {b.label}
            </div>
          ))}
          <WorkflowV2EdgeLayer
            edges={graph.visibleEdges}
            nodeMap={graph.visibleMap}
            wireStyle={wireStyle}
            lineage={lineage}
            isLive={isLive}
            wireDrag={ix.wireDrag}
            onSelectNode={onSelectNode}
            onDisconnectEdge={props.onDisconnectEdge}
          />
          {graph.visibleNodes.map((node) => (
            <WorkflowNodeCardV2
              key={node.id}
              node={node}
              project={project}
              selected={node.id === selectedNodeId}
              isConnectedToSelected={lineage.active && lineage.nodeIds.has(node.id) && node.id !== selectedNodeId}
              isDimmed={lineage.active && !lineage.nodeIds.has(node.id)}
              isActiveAtCurrentTime={isLive(node)}
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
            />
          ))}
        </div>

        {!workflow.nodes.some((n) => n.type === 'layer_assembly' && !n.params?.groupKind) && (
          <div className="wf-v2-empty">Cảnh chưa có Layer nào — thêm ảnh/Layer vào cảnh để bung cây Workflow.</div>
        )}

        {ix.spawnMenu && (
          <WorkflowV2SpawnMenu
            clientX={ix.spawnMenu.clientX}
            clientY={ix.spawnMenu.clientY}
            onPick={(cat) => {
              props.onAttachLogicToLayer(ix.spawnMenu!.layerNodeId, cat)
              ix.setSpawnMenu(null)
            }}
            onClose={() => ix.setSpawnMenu(null)}
          />
        )}
      </div>
    </div>
  )
}
