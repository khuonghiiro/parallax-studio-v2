import React from 'react'
import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import type { V2Cluster } from '../../project/workflowV2Engine'
import { IconFit, IconZoomIn, IconZoomOut } from '../icons'
import { WF_V2_PORT_Y, buildEdgePath, type V2EdgeKind } from './workflowV2Edges'
import { resolveV2NodeTheme } from './workflowV2Theme'

export interface WireDragState {
  nodeId: string
  isOutput: boolean
  startX: number
  startY: number
  curX: number
  curY: number
  /** Node đích đang rê vào (đã kiểm tra hợp lệ) — dây "hút" vào cổng của Node này */
  hoverNodeId?: string
  hoverValid?: boolean
  hoverReason?: string
}

export interface EdgeRenderItem {
  edge: WorkflowEdge
  from: WorkflowNode
  to: WorkflowNode
  kind: V2EdgeKind
  lane: number
  running: boolean
  lit: boolean
  label?: string
}

const KIND_COLOR: Record<V2EdgeKind, string | null> = {
  hierarchy: 'var(--text-faint)',
  camera: 'var(--accent-cyan)',
  data: '#f97316',
  logic: null
}

/** Lớp SVG vẽ dây nối: phân loại theo ý nghĩa, dây đang chạy có hiệu ứng dòng chảy theo hướng xử lý, hỗ trợ ngắt / xoá line */
export const WorkflowV2EdgeLayer: React.FC<{
  items: EdgeRenderItem[]
  wireStyle: 'smoothstep' | 'bezier'
  lineageActive: boolean
  wireDrag: WireDragState | null
  nodeMap: Map<string, WorkflowNode>
  onSelectNode: (nodeId: string) => void
  onDisconnectEdge: (edgeId: string) => void
  onToggleEdgeDisable?: (edgeId: string) => void
}> = ({ items, wireStyle, lineageActive, wireDrag, nodeMap, onSelectNode, onDisconnectEdge, onToggleEdgeDisable }) => {
  const hover = wireDrag?.hoverNodeId && wireDrag.hoverValid ? nodeMap.get(wireDrag.hoverNodeId) : undefined
  const endX = hover ? (wireDrag!.isOutput ? hover.position.x - 8 : hover.position.x + 242) : wireDrag?.curX ?? 0
  const endY = hover ? hover.position.y + WF_V2_PORT_Y : wireDrag?.curY ?? 0
  return (
    <svg className="wf-v2-edges-svg" width={1} height={1}>
      <defs>
        <marker id="wf-v2-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="context-stroke" />
        </marker>
      </defs>
      {items.map(({ edge, from, to, kind, lane, running, lit, label }) => {
        const d = buildEdgePath(from, to, kind, wireStyle, lane)
        const isDisabled = Boolean(edge.disabled)
        const color = isDisabled ? 'var(--text-faint)' : (KIND_COLOR[kind] ?? resolveV2NodeTheme(to).accent)
        const isToClusterLock = to.params?.logicCategory === 'cluster_lock'
        const isGroupToLayer = kind === 'hierarchy' && Boolean(from.params?.groupKind) && to.type === 'layer_assembly'
        const disconnectable = (kind === 'logic' || kind === 'data') && !to.params?.isCameraWaypoint
        const canDisable = disconnectable || isGroupToLayer
        const isWaypointStep = Boolean(to.params?.isCameraWaypoint) && Math.abs(from.position.x - to.position.x) < 40
        const stepBadgeText = isWaypointStep
          ? from.params?.isCameraWaypoint
            ? `▼ Bước ${(from.params.waypointLocalIndex ?? 0) + 1} → ${(to.params?.waypointLocalIndex ?? 0) + 1}`
            : `▼ Mở đầu #${to.params?.waypointLabel ?? 1}`
          : null
        const midX = isToClusterLock
          ? Math.round(from.position.x + 236 + 34)
          : isGroupToLayer
            ? Math.round(to.position.x - 28)
            : Math.round((from.position.x + 236 + to.position.x) / 2)
        const midY = isToClusterLock
          ? Math.round(from.position.y + WF_V2_PORT_Y)
          : isGroupToLayer
            ? Math.round(to.position.y + WF_V2_PORT_Y)
            : Math.round((from.position.y + WF_V2_PORT_Y + to.position.y + WF_V2_PORT_Y) / 2 + lane * 7)
        const pillW = disconnectable && onToggleEdgeDisable ? 44 : 24
        return (
          <g
            key={edge.id}
            className={[
              'wf-v2-edge-group',
              `kind-${kind}`,
              running && !isDisabled ? 'running' : '',
              isDisabled ? 'is-disabled' : '',
              isToClusterLock ? 'to-cluster-lock' : '',
              lineageActive && lit ? 'highlighted' : '',
              lit ? '' : 'dimmed'
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={(ev) => {
              ev.stopPropagation()
              onSelectNode(to.id)
            }}
            onDoubleClick={(ev) => {
              ev.stopPropagation()
              if (disconnectable) onDisconnectEdge(edge.id)
              else if (canDisable && onToggleEdgeDisable) onToggleEdgeDisable(edge.id)
            }}
          >
            <title>
              {kind === 'camera'
                ? `Camera chuyển cảnh: ${from.title} → ${to.title}`
                : isWaypointStep
                  ? `Lộ trình quay: ${from.title} → ${to.title}`
                  : isToClusterLock
                    ? isDisabled
                      ? 'Line đang tắt (mảnh tách khỏi cụm) — nhấn 🔌 để khoá lại hoặc ✕ để gỡ dây'
                      : 'Đang nối vào Khoá Cụm (mảnh được khoá theo cụm) — nhấn 🔌 để tạm ngắt hoặc ✕ để tách khỏi cụm'
                    : disconnectable
                      ? 'Nhấp đúp hoặc bấm ✕ để xoá liên kết line · bấm 🔌 để ngắt tạm (Disable) line'
                      : canDisable
                        ? 'Bấm 🔌 để ngắt tạm (Disable) hoặc bật lại nhánh Group → Layer'
                        : 'Dây cấu trúc cảnh'}
            </title>
            <path d={d} className="wf-v2-edge-hit" />
            <path
              d={d}
              className="wf-v2-edge-fg"
              style={{ stroke: color, strokeDasharray: isDisabled ? '5 5' : undefined }}
              markerEnd="url(#wf-v2-arrow)"
            />
            {running && !isDisabled && <path d={d} className="wf-v2-edge-flow" style={{ stroke: color }} />}
            {(canDisable || disconnectable) && !isWaypointStep && (
              <g
                className={`wf-v2-edge-ctrl${isDisabled ? ' always-show' : ''}`}
                transform={`translate(${midX} ${midY})`}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => ev.stopPropagation()}
              >
                <rect
                  className="wf-v2-edge-ctrl-bg"
                  x={-pillW / 2}
                  y={-10}
                  width={pillW}
                  height={20}
                  rx={5}
                />
                {onToggleEdgeDisable && (
                  <g
                    className={`wf-v2-edge-ctrl-btn ${isDisabled ? 'is-off' : 'is-on'}`}
                    transform={`translate(${disconnectable ? -10 : 0} 0)`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onToggleEdgeDisable(edge.id)
                    }}
                  >
                    <title>{isDisabled ? 'Bật lại kết nối line này' : 'Ngắt tạm (Disable) kết nối line này'}</title>
                    <text x={0} y={3.5} textAnchor="middle" className="wf-v2-edge-ctrl-text">
                      {isDisabled ? '🔌' : '⚡'}
                    </text>
                  </g>
                )}
                {disconnectable && (
                  <g
                    className="wf-v2-edge-ctrl-btn danger"
                    transform={`translate(${onToggleEdgeDisable ? 10 : 0} 0)`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onDisconnectEdge(edge.id)
                    }}
                  >
                    <title>
                      {isToClusterLock
                        ? 'Xoá line kết nối đến Khoá Cụm (mở khoá riêng mảnh Layer này)'
                        : 'Xoá liên kết line này'}
                    </title>
                    <text x={0} y={3.5} textAnchor="middle" className="wf-v2-edge-ctrl-text">
                      ✕
                    </text>
                  </g>
                )}
              </g>
            )}
            {stepBadgeText && (
              <g transform={`translate(${Math.round(from.position.x + 118)} ${Math.round((from.position.y + 64 + to.position.y) / 2)})`}>
                <rect
                  className="wf-v2-step-label-bg"
                  x={-38}
                  y={-8}
                  width={76}
                  height={16}
                  rx={4}
                  style={{ stroke: color }}
                />
                <text className="wf-v2-step-label" x={0} y={3} style={{ fill: color }}>
                  {stepBadgeText}
                </text>
              </g>
            )}
            {label && kind === 'camera' && (
              <g transform={`translate(${6} ${(from.position.y + to.position.y) / 2 + WF_V2_PORT_Y})`}>
                <rect className="wf-v2-chain-label-bg" x={-2} y={-9} width={56} height={18} rx={4} />
                <text className="wf-v2-chain-label" x={26} y={4}>{label}</text>
              </g>
            )}
          </g>
        )
      })}
      {wireDrag && (
        <path
          className={`wf-v2-edge-dragging${wireDrag.hoverNodeId ? (wireDrag.hoverValid ? ' valid' : ' invalid') : ''}`}
          d={`M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + (wireDrag.isOutput ? 60 : -60)} ${wireDrag.startY}, ${endX + (wireDrag.isOutput ? -60 : 60)} ${endY}, ${endX} ${endY}`}
        />
      )}
    </svg>
  )
}

/** Khung nền của từng cụm cảnh (tiêu đề + khoảng thời gian), cụm đang quay được làm nổi bật */
export const WorkflowV2ClusterFrames: React.FC<{
  clusters: (V2Cluster & { title: string; range?: { start: number; end: number }; color?: string })[]
  activeRootId: string | null
  onFocus: (rootId: string) => void
}> = ({ clusters, activeRootId, onFocus }) => (
  <>
    {clusters.map((c) => (
      <div
        key={c.rootId}
        className={`wf-v2-cluster${c.rootId === activeRootId ? ' active' : ''}`}
        style={{ left: c.bounds.x, top: c.bounds.y, width: c.bounds.w, height: c.bounds.h, ['--wf-cluster-c' as string]: c.color ?? 'var(--accent)' }}
      >
        <button type="button" className="wf-v2-cluster-head" onPointerDown={(e) => e.stopPropagation()} onClick={() => onFocus(c.rootId)}>
          <span className="dot" />
          <strong>{c.title}</strong>
          {c.range && (
            <span className="range">
              {c.range.start.toFixed(1)}s – {c.range.end.toFixed(1)}s
            </span>
          )}
          {c.rootId === activeRootId && <span className="live">ĐANG QUAY</span>}
        </button>
      </div>
    ))}
  </>
)

/** Cụm HUD dọc chỉ gồm icon ở góc khung vẽ */
export const WorkflowV2CanvasHud: React.FC<{
  zoom: number
  wireStyle: 'smoothstep' | 'bezier'
  follow: boolean
  onFit: (all: boolean) => void
  onZoom: (factor: number) => void
  onToggleWireStyle: () => void
  onToggleFollow: () => void
}> = ({ zoom, wireStyle, follow, onFit, onZoom, onToggleWireStyle, onToggleFollow }) => (
  <div className="wf-canvas-hud vertical wf-v2-hud" data-mcp-region="workflow_canvas_hud" onPointerDown={(e) => e.stopPropagation()}>
    <button type="button" className={`wf-hud-btn${follow ? ' active' : ''}`} title={follow ? 'Đang tự theo cảnh camera đang quay — nhấn để tắt' : 'Tự di chuyển tới cảnh camera đang quay'} onClick={onToggleFollow}>
      ◎
    </button>
    <button type="button" className="wf-hud-btn" title="Vừa khung (F) — giữ chữ đọc được" onClick={() => onFit(false)}>
      <IconFit width={14} height={14} />
    </button>
    <button type="button" className="wf-hud-btn" title="Toàn cảnh — thấy toàn bộ không gian (Shift+F)" onClick={() => onFit(true)}>
      ⤢
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

/** Chú giải loại dây để người xem hiểu ngay luồng logic */
export const WorkflowV2Legend: React.FC = () => (
  <div className="wf-v2-legend" data-mcp-region="workflow_legend" onPointerDown={(e) => e.stopPropagation()}>
    <span><i className="k-hierarchy" />Cấu trúc</span>
    <span><i className="k-logic" />Logic Layer</span>
    <span><i className="k-data" />Chất liệu → Va chạm</span>
    <span><i className="k-camera" />Camera chuyển cảnh</span>
    <span><i className="k-running" />Đang chạy</span>
  </div>
)
