import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { WorkflowEdge, WorkflowGraph, WorkflowNode, WorkflowPortKind } from '@shared/types'
import { CustomSelect } from '../controls/CustomSelect'
import { WORKFLOW_NODE_SPECS, WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { renderWorkflowNodeIcon } from './workflowIcons'

const NODE_W = 186
const PORT_START_Y = 89
const PORT_STEP_Y = 21

export interface WorkflowCanvasProps {
  workflow: WorkflowGraph
  activeNodeIds: Set<string>
  executionStepMap: Map<string, number>
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onMoveNode: (nodeId: string, x: number, y: number) => void
  onToggleNode: (nodeId: string) => void
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onConnectPorts: (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => void
  onDisconnectEdge: (edgeId: string) => void
}

function getOutputPortCoords(node: WorkflowNode, port: WorkflowPortKind): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.outputs.indexOf(port) ?? 0)
  return {
    x: node.position.x + NODE_W,
    y: node.position.y + PORT_START_Y + idx * PORT_STEP_Y
  }
}

function getInputPortCoords(node: WorkflowNode, port: WorkflowPortKind): { x: number; y: number } {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const idx = Math.max(0, spec?.inputs.indexOf(port) ?? 0)
  return {
    x: node.position.x,
    y: node.position.y + PORT_START_Y + idx * PORT_STEP_Y
  }
}

function buildBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(24, Math.abs(x2 - x1) * 0.46)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  activeNodeIds,
  executionStepMap,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onToggleNode,
  onChangeNodePreset,
  onConnectPorts,
  onDisconnectEdge
}) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [pendingSource, setPendingSource] = useState<{
    nodeId: string
    port: WorkflowPortKind
    x: number
    y: number
  } | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const nodeById = useMemo(() => new Map(workflow.nodes.map((n) => [n.id, n])), [workflow.nodes])

  const canvasBounds = useMemo(() => {
    let maxX = 1090
    let maxY = 278
    for (const n of workflow.nodes) {
      maxX = Math.max(maxX, n.position.x + NODE_W + 18)
      maxY = Math.max(maxY, n.position.y + 132)
    }
    return { width: maxX, height: maxY }
  }, [workflow.nodes])

  const startNodeDrag = useCallback(
    (e: React.PointerEvent, node: WorkflowNode) => {
      if ((e.target as HTMLElement).closest('button, input, .custom-select-trigger, .wf-port-pill')) return
      e.stopPropagation()
      onSelectNode(node.id)
      const startX = e.clientX
      const startY = e.clientY
      const origX = node.position.x
      const origY = node.position.y
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const nx = Math.max(12, Math.round(origX + (ev.clientX - startX)))
        const ny = Math.max(12, Math.round(origY + (ev.clientY - startY)))
        onMoveNode(node.id, nx, ny)
      }
      const onUp = () => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    },
    [onSelectNode, onMoveNode]
  )

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!pendingSource || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    setCursorPos({
      x: e.clientX - rect.left + canvasRef.current.scrollLeft,
      y: e.clientY - rect.top + canvasRef.current.scrollTop
    })
  }

  const handleOutputPortClick = (e: React.MouseEvent, node: WorkflowNode, port: WorkflowPortKind) => {
    e.stopPropagation()
    const coords = getOutputPortCoords(node, port)
    if (pendingSource && pendingSource.nodeId === node.id && pendingSource.port === port) {
      setPendingSource(null)
      setCursorPos(null)
    } else {
      setPendingSource({ nodeId: node.id, port, x: coords.x, y: coords.y })
      setCursorPos(coords)
    }
  }

  const handleInputPortClick = (e: React.MouseEvent, node: WorkflowNode, port: WorkflowPortKind) => {
    e.stopPropagation()
    if (pendingSource) {
      if (pendingSource.nodeId !== node.id) {
        onConnectPorts(pendingSource.nodeId, pendingSource.port, node.id, port)
      }
      setPendingSource(null)
      setCursorPos(null)
      return
    }
    // Nếu không trong chế độ nối dây mà bấm vào cổng vào đã có dây -> ngắt dây đó
    const existingEdge = workflow.edges.find((ed) => ed.toNode === node.id && ed.toPort === port)
    if (existingEdge) {
      onDisconnectEdge(existingEdge.id)
    }
  }

  const renderedEdges = useMemo(() => {
    const out: {
      edge: WorkflowEdge
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
      const p1 = getOutputPortCoords(fromNode, edge.fromPort)
      const p2 = getInputPortCoords(toNode, edge.toPort)
      const portSpec = WORKFLOW_PORT_SPECS[edge.fromPort]
      const isActive =
        fromNode.enabled &&
        toNode.enabled &&
        activeNodeIds.has(fromNode.id) &&
        activeNodeIds.has(toNode.id)

      out.push({
        edge,
        path: buildBezierPath(p1.x, p1.y, p2.x, p2.y),
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
        color: portSpec?.color ?? '#38bdf8',
        label: portSpec?.shortLabel ?? edge.fromPort,
        isActive
      })
    }
    return out
  }, [workflow.edges, nodeById, activeNodeIds])

  return (
    <div
      ref={canvasRef}
      className="wf-canvas-viewport"
      data-mcp-region="workflow_canvas"
      onPointerMove={handleCanvasPointerMove}
      onClick={() => {
        if (pendingSource) {
          setPendingSource(null)
          setCursorPos(null)
        }
      }}
    >
      {pendingSource && (
        <div className="wf-connecting-banner">
          <span>
            Đang nối cổng <strong>{WORKFLOW_PORT_SPECS[pendingSource.port]?.shortLabel}</strong> — Bấm vào cổng đầu vào{' '}
            <strong>[● In]</strong> của khối đích để hoàn tất (hoặc bấm vùng trống để hủy)
          </span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={(e) => {
              e.stopPropagation()
              setPendingSource(null)
              setCursorPos(null)
            }}
          >
            Hủy nối
          </button>
        </div>
      )}

      <div className="wf-canvas-stage" style={{ width: canvasBounds.width, height: canvasBounds.height }}>
        {/* SVG Port Connections Layer */}
        <svg className="wf-edges-svg" width={canvasBounds.width} height={canvasBounds.height}>
          <defs>
            <filter id="wf-wire-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {renderedEdges.map(({ edge, path, midX, midY, color, label, isActive }) => (
            <g
              key={edge.id}
              className={`wf-edge-group${isActive ? ' active' : ' muted'}`}
              onClick={(e) => {
                e.stopPropagation()
                onDisconnectEdge(edge.id)
              }}
            >
              <title>{`Cổng ${label} — Bấm để ngắt kết nối`}</title>
              <path d={path} className="wf-edge-hit" />
              <path
                d={path}
                className="wf-edge-line"
                stroke={color}
                filter={isActive ? 'url(#wf-wire-glow)' : undefined}
              />
              <g transform={`translate(${midX}, ${midY})`} className="wf-edge-badge">
                <circle r="6" className="wf-edge-badge-ring" style={{ stroke: color }} />
                <circle r="2.3" className="wf-edge-badge-dot" style={{ fill: color }} />
                <text x="0" y="3" textAnchor="middle" className="wf-edge-badge-x">
                  ✕
                </text>
              </g>
            </g>
          ))}

          {pendingSource && cursorPos && (
            <path
              d={buildBezierPath(pendingSource.x, pendingSource.y, cursorPos.x, cursorPos.y)}
              className="wf-edge-preview"
              stroke={WORKFLOW_PORT_SPECS[pendingSource.port]?.color ?? '#38bdf8'}
            />
          )}
        </svg>

        {/* Functional Workflow Nodes */}
        {workflow.nodes.map((node) => {
          const spec = WORKFLOW_NODE_SPECS[node.type]
          const presetSpec = spec?.presets.find((p) => p.id === node.preset) ?? spec?.presets[0]
          const isSelected = node.id === selectedNodeId
          const isConnected = activeNodeIds.has(node.id)
          const stepNum = executionStepMap.get(node.id)

          const presetOptions = (spec?.presets ?? []).map((p) => ({
            value: p.id,
            label: p.label
          }))

          return (
            <div
              key={node.id}
              id={`wf-node-${node.type}`}
              className={`wf-node-card${isSelected ? ' selected' : ''}${isConnected ? ' connected' : ' disconnected'}${!node.enabled ? ' disabled' : ''}`}
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
              {/* Node Header */}
              <div className="wf-node-header">
                <span className="wf-node-icon" style={{ background: spec?.color }}>
                  {renderWorkflowNodeIcon(node.type, { width: 12, height: 12 })}
                </span>
                <span className="wf-node-title" title={node.title}>
                  {spec?.shortTitle ?? node.title}
                </span>
                <span
                  className={`wf-node-status-pill${isConnected ? ' on' : ''}`}
                  title={
                    !node.enabled
                      ? 'Khối đang tắt'
                      : isConnected
                        ? `Bước thực thi #${stepNum} (${node.aiAgentRole})`
                        : 'Chưa nối Port vào luồng thực thi'
                  }
                >
                  {!node.enabled ? 'Tắt' : isConnected ? `#${stepNum}` : 'Rời'}
                </span>
                <button
                  type="button"
                  className={`wf-node-toggle${node.enabled ? ' on' : ''}`}
                  title={node.enabled ? 'Đang bật khối chức năng (Bấm để tắt)' : 'Đang tắt (Bấm để bật)'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleNode(node.id)
                  }}
                >
                  {node.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Preset Selector & Concise Summary */}
              <div className="wf-node-body">
                <CustomSelect
                  size="sm"
                  value={node.preset}
                  options={presetOptions}
                  dropdownWidth={260}
                  onChange={(val) => onChangeNodePreset(node.id, String(val))}
                  title="Chọn chế độ xử lý nhanh cho khối chức năng này"
                />
                <div className="wf-node-summary" title={presetSpec?.defaultDirective}>
                  {presetSpec?.summary}
                </div>
              </div>

              {/* Input & Output Ports */}
              <div className="wf-node-ports-row">
                <div className="wf-ports-col in">
                  {(spec?.inputs ?? []).map((port) => {
                    const pSpec = WORKFLOW_PORT_SPECS[port]
                    const hasWire = workflow.edges.some((e) => e.toNode === node.id && e.toPort === port)
                    const isCompatibleTarget =
                      pendingSource && pendingSource.nodeId !== node.id && pendingSource.port === port
                    return (
                      <button
                        key={`in-${port}`}
                        type="button"
                        className={`wf-port-pill in${hasWire ? ' wired' : ''}${isCompatibleTarget ? ' highlight' : ''}`}
                        style={{ ['--port-c' as string]: pSpec?.color }}
                        title={
                          pendingSource
                            ? `Bấm để nối vào cổng "${pSpec?.label}"`
                            : hasWire
                              ? `Đầu vào: ${pSpec?.label} (Bấm để ngắt kết nối)`
                              : `Đầu vào: ${pSpec?.label} (Chưa nối)`
                        }
                        onClick={(e) => handleInputPortClick(e, node, port)}
                      >
                        <span className="wf-port-dot" />
                        <span>{pSpec?.shortLabel}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="wf-ports-col out">
                  {(spec?.outputs ?? []).map((port) => {
                    const pSpec = WORKFLOW_PORT_SPECS[port]
                    const hasWire = workflow.edges.some((e) => e.fromNode === node.id && e.fromPort === port)
                    const isPending = pendingSource?.nodeId === node.id && pendingSource?.port === port
                    return (
                      <button
                        key={`out-${port}`}
                        type="button"
                        className={`wf-port-pill out${hasWire ? ' wired' : ''}${isPending ? ' pending' : ''}`}
                        style={{ ['--port-c' as string]: pSpec?.color }}
                        title={`Đầu ra: ${pSpec?.label} — Bấm để kéo nối sang khối tiếp theo`}
                        onClick={(e) => handleOutputPortClick(e, node, port)}
                      >
                        <span>{pSpec?.shortLabel}</span>
                        <span className="wf-port-dot" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
