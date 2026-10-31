import React from 'react'
import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import type { V2Cluster } from '../../project/workflowV2Engine'
import { IconFit, IconZoomIn, IconZoomOut } from '../icons'
import { WF_V2_PORT_Y, buildEdgePath, type V2EdgeKind } from './workflowV2Edges'
import {
  IconWfFitAll,
  IconWfFollowShot,
  IconWfWireBezier,
  IconWfWireStep
} from './workflowIcons'
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

/** Màu gốc của nhánh hoặc Node đích để CSS tự cân chỉnh độ tương phản theo Dark / Light Theme */
function resolveRawBranchAccent(kind: V2EdgeKind, from: WorkflowNode, to: WorkflowNode): string {
  if (kind === 'camera') return '#38bdf8'
  if (kind === 'data') return '#f97316'
  if (kind === 'hierarchy' && (Boolean(from.params?.groupKind) || Boolean(from.params?.isPartHub))) {
    return resolveV2NodeTheme(from).accent
  }
  return resolveV2NodeTheme(to).accent
}

/** Lớp SVG vẽ dây nối 2 lớp (casing tách nền + lõi màu độ tương phản cao, bù tỷ lệ zoom), xung sáng khi phát và nút vector */
export const WorkflowV2EdgeLayer: React.FC<{
  items: EdgeRenderItem[]
  zoom?: number
  wireStyle: 'smoothstep' | 'bezier'
  lineageActive: boolean
  wireDrag: WireDragState | null
  nodeMap: Map<string, WorkflowNode>
  onSelectNode: (nodeId: string) => void
  onDisconnectEdge: (edgeId: string) => void
  onToggleEdgeDisable?: (edgeId: string) => void
}> = ({ items, zoom = 1, wireStyle, lineageActive, wireDrag, nodeMap, onSelectNode, onDisconnectEdge, onToggleEdgeDisable }) => {
  const hover = wireDrag?.hoverNodeId && wireDrag.hoverValid ? nodeMap.get(wireDrag.hoverNodeId) : undefined
  const endX = hover ? (wireDrag!.isOutput ? hover.position.x - 8 : hover.position.x + 242) : wireDrag?.curX ?? 0
  const endY = hover ? hover.position.y + WF_V2_PORT_Y : wireDrag?.curY ?? 0
  const dragPath = wireDrag
    ? `M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + (wireDrag.isOutput ? 64 : -64)} ${wireDrag.startY}, ${endX + (wireDrag.isOutput ? -64 : 64)} ${endY}, ${endX} ${endY}`
    : ''
  const dragStateClass = wireDrag?.hoverNodeId ? (wireDrag.hoverValid ? ' valid' : ' invalid') : ''
  // Bù độ dày nét khi thu nhỏ sơ đồ (30% - 80%) để line không bị mảnh dưới 1px vật lý
  const zoomComp = Number(Math.max(1, Math.min(2.05, 1 / Math.pow(Math.max(0.2, zoom), 0.56))).toFixed(3))

  return (
    <svg
      className="wf-v2-edges-svg"
      width={1}
      height={1}
      style={{ ['--wf-zoom-comp' as string]: zoomComp }}
    >
      <defs>
        <marker
          id="wf-v2-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={Math.round(9.4 * Math.min(1.45, zoomComp) * 10) / 10}
          markerHeight={Math.round(9.4 * Math.min(1.45, zoomComp) * 10) / 10}
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 0.8 1.5 L 8.8 5 L 0.8 8.5 L 2.6 5 Z" fill="context-stroke" />
        </marker>
      </defs>
      {items.map(({ edge, from, to, kind, lane, running, lit, label }) => {
        const d = buildEdgePath(from, to, kind, wireStyle, lane)
        const isDisabled = Boolean(edge.disabled)
        const rawAccent = resolveRawBranchAccent(kind, from, to)
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
        const pillW = disconnectable && onToggleEdgeDisable ? 46 : 24
        const showAura = !isDisabled && (running || (lineageActive && lit))

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
            style={{ ['--wf-edge-raw' as string]: rawAccent }}
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
                      ? 'Line đang tắt (mảnh tách khỏi cụm) — nhấn nút nguồn để khoá lại hoặc ✕ để gỡ dây'
                      : 'Đang nối vào Khoá Cụm (mảnh được khoá theo cụm) — nhấn nút nguồn để tạm ngắt hoặc ✕ để tách khỏi cụm'
                    : disconnectable
                      ? 'Nhấp đúp hoặc bấm ✕ để xoá liên kết line · bấm nút nguồn để ngắt tạm (Disable) line'
                      : canDisable
                        ? 'Bấm nút nguồn để ngắt tạm (Disable) hoặc bật lại nhánh Group → Layer'
                        : 'Dây cấu trúc cảnh'}
            </title>
            <path d={d} className="wf-v2-edge-hit" />
            <path d={d} className="wf-v2-edge-casing" />
            {kind === 'camera' && !isDisabled && <path d={d} className="wf-v2-edge-rail" />}
            {showAura && <path d={d} className="wf-v2-edge-glow" />}
            <path
              d={d}
              className="wf-v2-edge-fg"
              markerEnd="url(#wf-v2-arrow)"
            />
            {running && !isDisabled && <path d={d} className="wf-v2-edge-flow" />}
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
                  y={-11}
                  width={pillW}
                  height={22}
                  rx={5}
                />
                {onToggleEdgeDisable && (
                  <g
                    className={`wf-v2-edge-ctrl-btn ${isDisabled ? 'is-off' : 'is-on'}`}
                    transform={`translate(${disconnectable ? -10.5 : 0} 0)`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onToggleEdgeDisable(edge.id)
                    }}
                  >
                    <title>{isDisabled ? 'Bật lại kết nối line này' : 'Ngắt tạm (Disable) kết nối line này'}</title>
                    <rect className="wf-v2-edge-ctrl-hit" x={-9} y={-9} width={18} height={18} rx={4} />
                    {isDisabled ? (
                      <path
                        className="wf-v2-edge-ctrl-icon"
                        d="M -3.8 1.5 L -1.5 3.8 A 2.6 2.6 0 0 0 2.2 0.1 M 3.8 -1.5 L 1.5 -3.8 A 2.6 2.6 0 0 0 -2.2 -0.1 M -4.4 -4.4 L 4.4 4.4"
                      />
                    ) : (
                      <path
                        className="wf-v2-edge-ctrl-icon bolt"
                        d="M 0.6 -5 L -3.6 0.6 H 0.3 L -0.6 5 L 3.6 -0.6 H -0.3 Z"
                      />
                    )}
                  </g>
                )}
                {disconnectable && onToggleEdgeDisable && (
                  <line className="wf-v2-edge-ctrl-sep" x1={0} y1={-6} x2={0} y2={6} />
                )}
                {disconnectable && (
                  <g
                    className="wf-v2-edge-ctrl-btn danger"
                    transform={`translate(${onToggleEdgeDisable ? 10.5 : 0} 0)`}
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
                    <rect className="wf-v2-edge-ctrl-hit" x={-9} y={-9} width={18} height={18} rx={4} />
                    <path className="wf-v2-edge-ctrl-icon" d="M -3.1 -3.1 L 3.1 3.1 M 3.1 -3.1 L -3.1 3.1" />
                  </g>
                )}
              </g>
            )}
            {stepBadgeText && (
              <g transform={`translate(${Math.round(from.position.x + 118)} ${Math.round((from.position.y + 64 + to.position.y) / 2)})`}>
                <rect
                  className="wf-v2-step-label-bg"
                  x={-42}
                  y={-8.5}
                  width={84}
                  height={17}
                  rx={4}
                />
                <text className="wf-v2-step-label" x={0} y={3}>
                  {stepBadgeText}
                </text>
              </g>
            )}
            {label && kind === 'camera' && (
              <g transform={`translate(${6} ${(from.position.y + to.position.y) / 2 + WF_V2_PORT_Y})`}>
                <rect className="wf-v2-chain-label-bg" x={-3} y={-9.5} width={58} height={19} rx={4} />
                <text className="wf-v2-chain-label" x={26} y={3.5}>{label}</text>
              </g>
            )}
          </g>
        )
      })}
      {wireDrag && (
        <g className="wf-v2-edge-drag-layer">
          <path className="wf-v2-edge-dragging-casing" d={dragPath} />
          <path className={`wf-v2-edge-dragging${dragStateClass}`} d={dragPath} />
          <circle className={`wf-v2-edge-drag-tip${dragStateClass}`} cx={endX} cy={endY} r={4.2} />
        </g>
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

/** Cụm HUD dọc chỉ gồm icon vector sắc nét ở góc khung vẽ */
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
    <button
      type="button"
      className={`wf-hud-btn${follow ? ' active' : ''}`}
      title={follow ? 'Đang tự theo cảnh camera đang quay — nhấn để tắt' : 'Tự di chuyển tới cảnh camera đang quay'}
      onClick={onToggleFollow}
    >
      <IconWfFollowShot width={14} height={14} />
    </button>
    <button type="button" className="wf-hud-btn" title="Vừa khung (F) — giữ chữ đọc được" onClick={() => onFit(false)}>
      <IconFit width={14} height={14} />
    </button>
    <button type="button" className="wf-hud-btn" title="Toàn cảnh — thấy toàn bộ không gian (Shift+F)" onClick={() => onFit(true)}>
      <IconWfFitAll width={14} height={14} />
    </button>
    <div className="wf-hud-divider" />
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
      title={wireStyle === 'smoothstep' ? 'Dây vuông bo góc — nhấn để đổi sang dây cong mềm' : 'Dây cong mềm — nhấn để đổi sang dây vuông bo góc'}
      onClick={onToggleWireStyle}
    >
      {wireStyle === 'smoothstep' ? <IconWfWireStep width={14} height={14} /> : <IconWfWireBezier width={14} height={14} />}
    </button>
  </div>
)

/** Chú giải loại dây bằng mẫu vector SVG thật để khớp 1:1 với dây trên sơ đồ ở cả 2 Theme */
export const WorkflowV2Legend: React.FC = () => (
  <div className="wf-v2-legend" data-mcp-region="workflow_legend" onPointerDown={(e) => e.stopPropagation()}>
    <span>
      <svg className="wf-v2-legend-svg k-hierarchy" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line x1="1" y1="5" x2="18.5" y2="5" />
        <polygon points="17.5,2.2 23,5 17.5,7.8" />
      </svg>
      Cấu trúc
    </span>
    <span>
      <svg className="wf-v2-legend-svg k-logic" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line x1="1" y1="5" x2="18.5" y2="5" />
        <polygon points="17.5,2.2 23,5 17.5,7.8" />
      </svg>
      Logic Layer
    </span>
    <span>
      <svg className="wf-v2-legend-svg k-data" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line x1="1" y1="5" x2="18.5" y2="5" strokeDasharray="4.5 3" />
        <polygon points="17.5,2.2 23,5 17.5,7.8" />
      </svg>
      Chất liệu → Va chạm
    </span>
    <span>
      <svg className="wf-v2-legend-svg k-camera" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line x1="1" y1="5" x2="18.5" y2="5" strokeDasharray="6 3" />
        <polygon points="17.5,2.2 23,5 17.5,7.8" />
      </svg>
      Camera chuyển cảnh
    </span>
    <span>
      <svg className="wf-v2-legend-svg k-running" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line className="base" x1="1" y1="5" x2="22" y2="5" />
        <line className="pulse" x1="2" y1="5" x2="22" y2="5" strokeDasharray="4 6" />
      </svg>
      Đang chạy
    </span>
  </div>
)
