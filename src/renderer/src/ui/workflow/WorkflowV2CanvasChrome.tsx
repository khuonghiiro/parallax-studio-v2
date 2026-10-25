import React from 'react'
import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import { IconFit, IconZoomIn, IconZoomOut } from '../icons'
import { buildEdgePath } from './workflowV2Edges'
import { resolveV2NodeLevel, resolveV2NodeTheme } from './workflowV2Theme'

export interface WireDragState {
  nodeId: string
  isOutput: boolean
  startX: number
  startY: number
  curX: number
  curY: number
}

/** Lớp SVG vẽ dây nối (smooth-step / bezier, mũi tên, làm nổi bật nhánh đang chọn) */
export const WorkflowV2EdgeLayer: React.FC<{
  edges: WorkflowEdge[]
  nodeMap: Map<string, WorkflowNode>
  wireStyle: 'smoothstep' | 'bezier'
  lineage: { edgeIds: Set<string>; active: boolean }
  isLive: (node: WorkflowNode) => boolean
  wireDrag: WireDragState | null
  onSelectNode: (nodeId: string) => void
  onDisconnectEdge: (edgeId: string) => void
}> = ({ edges, nodeMap, wireStyle, lineage, isLive, wireDrag, onSelectNode, onDisconnectEdge }) => (
  <svg className="wf-v2-edges-svg" width={1} height={1}>
    <defs>
      <marker id="wf-v2-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="context-stroke" />
      </marker>
    </defs>
    {edges.map((edge) => {
      const from = nodeMap.get(edge.fromNode)
      const to = nodeMap.get(edge.toNode)
      if (!from || !to) return null
      const d = buildEdgePath(from, to, wireStyle)
      const lit = !lineage.active || lineage.edgeIds.has(edge.id)
      const flowing = lineage.active && lit && isLive(from) && isLive(to)
      const disconnectable = resolveV2NodeLevel(to) === 'logic'
      return (
        <g
          key={edge.id}
          className={`wf-v2-edge-group${lineage.active && lit ? ' highlighted' : ''}${lit ? '' : ' dimmed'}`}
          onClick={(ev) => {
            ev.stopPropagation()
            onSelectNode(to.id)
          }}
          onDoubleClick={(ev) => {
            ev.stopPropagation()
            if (disconnectable) onDisconnectEdge(edge.id)
          }}
        >
          <title>{disconnectable ? 'Nhấp đúp để gỡ dây nối' : 'Dây phân cấp'}</title>
          <path d={d} className="wf-v2-edge-hit" />
          <path
            d={d}
            className={`wf-v2-edge-fg${flowing ? ' flowing' : ''}`}
            style={{ stroke: resolveV2NodeTheme(to).accent }}
            markerEnd="url(#wf-v2-arrow)"
          />
        </g>
      )
    })}
    {wireDrag && (
      <path
        className="wf-v2-edge-dragging"
        d={`M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + (wireDrag.isOutput ? 60 : -60)} ${wireDrag.startY}, ${
          wireDrag.curX + (wireDrag.isOutput ? -60 : 60)
        } ${wireDrag.curY}, ${wireDrag.curX} ${wireDrag.curY}`}
      />
    )}
  </svg>
)

/** Cụm HUD dọc chỉ gồm icon ở góc khung vẽ (vừa khung, thu phóng, kiểu dây) */
export const WorkflowV2CanvasHud: React.FC<{
  zoom: number
  wireStyle: 'smoothstep' | 'bezier'
  onFit: () => void
  onZoom: (factor: number) => void
  onToggleWireStyle: () => void
}> = ({ zoom, wireStyle, onFit, onZoom, onToggleWireStyle }) => (
  <div className="wf-canvas-hud vertical wf-v2-hud" data-mcp-region="workflow_canvas_hud" onPointerDown={(e) => e.stopPropagation()}>
    <button type="button" className="wf-hud-btn" title="Vừa khung nhìn" onClick={onFit}>
      <IconFit width={14} height={14} />
    </button>
    <button type="button" className="wf-hud-btn" title="Phóng to (Ctrl + lăn chuột)" onClick={() => onZoom(1.15)}>
      <IconZoomIn width={14} height={14} />
    </button>
    <span className="wf-hud-zoom-readout">{Math.round(zoom * 100)}%</span>
    <button type="button" className="wf-hud-btn" title="Thu nhỏ (Ctrl + lăn chuột)" onClick={() => onZoom(1 / 1.15)}>
      <IconZoomOut width={14} height={14} />
    </button>
    <div className="wf-hud-divider" />
    <button
      type="button"
      className="wf-hud-btn"
      title={wireStyle === 'smoothstep' ? 'Dây vuông bo góc — nhấn để đổi sang dây cong' : 'Dây cong — nhấn để đổi sang dây vuông bo góc'}
      onClick={onToggleWireStyle}
    >
      {wireStyle === 'smoothstep' ? '⌐' : '∿'}
    </button>
  </div>
)
