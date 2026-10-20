import React from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import {
  PRESET_SHORT_LABELS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { renderWorkflowNodeIcon } from './workflowIcons'
import { WorkflowNodePreview } from './WorkflowNodePreview'
import {
  NODE_W,
  SOCKET_PAD_TOP,
  SOCKET_ROW_H,
  evaluateNodeRuntimeTelemetry,
  getBestMatchingInputPort,
  getBestMatchingOutputPort
} from './workflowLayoutAndFlow'

export interface WorkflowNodeCardProps {
  node: WorkflowNode
  project?: Project
  workflow: WorkflowGraph
  playing: boolean
  time: number
  isSelected: boolean
  isConnected: boolean
  stepNum?: number
  activeNodeIds: Set<string>
  pendingSource: {
    nodeId: string
    port: WorkflowPortKind
    isOutput: boolean
    x: number
    y: number
  } | null
  snappedTarget: {
    nodeId: string
    port: WorkflowPortKind
    isInput: boolean
    x: number
    y: number
    targetCardOnly?: boolean
  } | null
  onSelectNode: (nodeId: string) => void
  onStartNodeDrag: (e: React.PointerEvent, node: WorkflowNode) => void
  onToggleNode: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  onChangeNodePreset: (nodeId: string, presetId: string) => void
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onPreviewNode?: (node: WorkflowNode) => void
  onStartConnecting: (
    e: React.PointerEvent,
    node: WorkflowNode,
    port: WorkflowPortKind,
    isOutput: boolean
  ) => void
  onInputSocketClick: (
    e: React.MouseEvent,
    node: WorkflowNode,
    port: WorkflowPortKind
  ) => void
  onOutputSocketClick: (
    e: React.MouseEvent,
    node: WorkflowNode,
    port: WorkflowPortKind
  ) => void
  onConnectPorts: (
    fromNode: string,
    fromPort: WorkflowPortKind,
    toNode: string,
    toPort: WorkflowPortKind
  ) => void
  onClearPendingWire: () => void
}

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = ({
  node,
  project,
  workflow,
  playing,
  time,
  isSelected,
  isConnected,
  stepNum,
  activeNodeIds,
  pendingSource,
  snappedTarget,
  onSelectNode,
  onStartNodeDrag,
  onToggleNode,
  onDeleteNode,
  onChangeNodePreset,
  onUpdateNodeParams,
  onPreviewNode,
  onStartConnecting,
  onInputSocketClick,
  onOutputSocketClick,
  onConnectPorts,
  onClearPendingWire
}) => {
  const logicItem = React.useMemo(() => {
    if (!node.params?.logicId) return null
    return WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === node.params?.logicId) ?? null
  }, [node.params?.logicId])

  const boundLayer = React.useMemo(() => {
    if (!project || !node.params?.targetLayerIds?.[0]) return null
    return project.layers.find((l) => l.id === node.params?.targetLayerIds?.[0]) ?? null
  }, [project, node.params?.targetLayerIds])

  const spec = WORKFLOW_NODE_SPECS[node.type]

  const inputs = React.useMemo(() => {
    if (boundLayer) {
      return ['scene_ctx', 'motion_stream', 'vfx_stage', 'audio_mix'] as WorkflowPortKind[]
    }
    return spec?.inputs ?? []
  }, [boundLayer, spec])

  const outputs = React.useMemo(() => {
    if (boundLayer) {
      return ['actors_rig', 'scene_ctx'] as WorkflowPortKind[]
    }
    return spec?.outputs ?? []
  }, [boundLayer, spec])

  const socketRowCount = Math.max(inputs.length, outputs.length, 1)

  const nodeColor = React.useMemo(() => {
    if (logicItem) {
      switch (logicItem.category) {
        case 'camera':
          return '#22c55e'
        case 'audio':
          return '#06b6d4'
        case 'physics':
          return '#10b981'
        case 'light_fx':
          return '#ec4899'
        case 'motion':
          return '#f59e0b'
        case 'scene':
          return '#38bdf8'
        case 'assembly':
          return '#8b5cf6'
        case 'look':
          return '#eab308'
        default:
          return '#38bdf8'
      }
    }
    if (boundLayer) return '#8b5cf6'
    return spec?.color ?? '#38bdf8'
  }, [logicItem, boundLayer, spec])

  const cardTitle = React.useMemo(() => {
    if (boundLayer) return boundLayer.name
    if (logicItem) return logicItem.title
    return spec?.shortTitle ?? node.title
  }, [boundLayer, logicItem, spec, node.title])

  const cardCategoryBadge = React.useMemo(() => {
    if (boundLayer) {
      const zVal = Math.round(boundLayer.transform.position.value[2] ?? 0)
      const zTag =
        zVal > 2000
          ? 'Bầu trời'
          : zVal > 1000
            ? 'Núi xa'
            : zVal > 200
              ? 'Trung cảnh'
              : zVal >= 0
                ? 'Tiêu điểm'
                : 'Tiền cảnh'
      return `${zTag} · Z:${zVal}`
    }
    if (logicItem) return logicItem.categoryLabel
    return spec?.shortTitle ?? 'Khối'
  }, [boundLayer, logicItem, spec])

  const telemetry = evaluateNodeRuntimeTelemetry(
    node,
    project,
    time,
    playing,
    isConnected,
    stepNum,
    Math.max(1, activeNodeIds.size),
    workflow,
    activeNodeIds
  )

  const isConnectable = Boolean(
    pendingSource &&
      pendingSource.nodeId !== node.id &&
      (pendingSource.isOutput ? inputs.length > 0 : outputs.length > 0)
  )
  const isSnapNode = Boolean(snappedTarget && snappedTarget.nodeId === node.id)

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pendingSource && pendingSource.nodeId !== node.id) {
      if (pendingSource.isOutput) {
        const bestInput = getBestMatchingInputPort(pendingSource.port, node)
        if (bestInput) {
          onConnectPorts(pendingSource.nodeId, pendingSource.port, node.id, bestInput)
          onClearPendingWire()
          return
        }
      } else {
        const bestOutput = getBestMatchingOutputPort(pendingSource.port, node)
        if (bestOutput) {
          onConnectPorts(node.id, bestOutput, pendingSource.nodeId, pendingSource.port)
          onClearPendingWire()
          return
        }
      }
    }
    onSelectNode(node.id)
  }

  return (
    <div
      id={`wf-node-${node.type}`}
      className={`wf-node-card${isSelected ? ' selected' : ''}${isConnected ? ' connected' : ' disconnected'}${!node.enabled ? ' disabled' : ''}${telemetry.isStageHighlight ? ' running stage-highlight' : ''}${isConnectable ? ' wire-connectable' : ''}${isSnapNode ? ' snap-target' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        ['--wf-node-color' as string]: nodeColor
      }}
      onPointerDown={(e) => onStartNodeDrag(e, node)}
      onClick={handleCardClick}
    >
      {/* Chỉ báo nổi bật khi thẻ được hút nam châm làm điểm kết nối */}
      {isSnapNode && (
        <div className="wf-node-snap-indicator">
          🔗 Bấm để nối vào đây
        </div>
      )}

      {/* 1. Thanh tiêu đề Khối (Nắm kéo tự do 4 hướng) */}
      <div className="wf-node-header" style={{ ['--wf-node-color' as string]: nodeColor }}>
        <span className="wf-node-icon" style={{ background: nodeColor }}>
          {logicItem ? (
            <span style={{ fontSize: 13, lineHeight: '14px' }}>{logicItem.icon}</span>
          ) : boundLayer ? (
            <span style={{ fontSize: 13, lineHeight: '14px' }}>
              {boundLayer.type === 'text'
                ? '🔤'
                : boundLayer.type === 'particles'
                  ? '✨'
                  : boundLayer.composite
                    ? '🎭'
                    : '🖼️'}
            </span>
          ) : (
            renderWorkflowNodeIcon(node.type, { width: 12, height: 12 })
          )}
        </span>
        <span
          className="wf-node-title"
          title={`${cardTitle} — Nắm kéo để di chuyển tự do Trái / Phải / Lên / Xuống`}
        >
          {cardTitle}
          <span className="wf-node-sub-tag">{cardCategoryBadge}</span>
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
              ? 'Khối đang tắt (OFF)'
              : isConnected
                ? `${telemetry.routeText} (${node.aiAgentRole}) — ${telemetry.liveSummary}`
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
        {onDeleteNode && (
          <button
            type="button"
            className="wf-node-del-btn"
            title={`Xóa "${cardTitle}" khỏi sơ đồ`}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteNode(node.id)
            }}
          >
            ✕
          </button>
        )}
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
            inPort && pendingSource && pendingSource.nodeId !== node.id && pendingSource.isOutput
          )
          const isSnapped = Boolean(
            inPort &&
              snappedTarget &&
              snappedTarget.nodeId === node.id &&
              snappedTarget.port === inPort &&
              snappedTarget.isInput
          )
          const isInPending = Boolean(
            inPort &&
              pendingSource?.nodeId === node.id &&
              pendingSource?.port === inPort &&
              !pendingSource.isOutput
          )

          const isCompatibleOutput = Boolean(
            outPort && pendingSource && pendingSource.nodeId !== node.id && !pendingSource.isOutput
          )
          const isSnappedOutput = Boolean(
            outPort &&
              snappedTarget &&
              snappedTarget.nodeId === node.id &&
              snappedTarget.port === outPort &&
              !snappedTarget.isInput
          )
          const isOutPending = Boolean(
            outPort &&
              pendingSource?.nodeId === node.id &&
              pendingSource?.port === outPort &&
              pendingSource.isOutput
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
                  className={`wf-socket-hit in${inWired ? ' wired' : ''}${isCompatibleTarget ? ' compatible' : ''}${isSnapped ? ' snapped' : ''}${isInPending ? ' pending' : ''}`}
                  style={{ ['--port-c' as string]: inSpec.color }}
                  title={
                    isCompatibleTarget
                      ? `Thả hoặc bấm vào đây để nối vào cổng "${inSpec.label}"`
                      : inWired
                        ? `Cổng vào: ${inSpec.label} (Đang nối — Bấm để ngắt dây)`
                        : `Cổng vào: ${inSpec.label} (Chưa nối — Nắm kéo sang khối khác hoặc bấm để chọn)`
                  }
                  onPointerDown={(e) => onStartConnecting(e, node, inPort, false)}
                  onClick={(e) => onInputSocketClick(e, node, inPort)}
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
                  className={`wf-socket-hit out${outWired ? ' wired' : ''}${isOutPending ? ' pending' : ''}${isCompatibleOutput ? ' compatible' : ''}${isSnappedOutput ? ' snapped' : ''}`}
                  style={{ ['--port-c' as string]: outSpec.color }}
                  title={`Cổng ra: ${outSpec.label} — Nắm kéo sang khối tiếp theo hoặc bấm để nối`}
                  onPointerDown={(e) => onStartConnecting(e, node, outPort, true)}
                  onClick={(e) => onOutputSocketClick(e, node, outPort)}
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

      {/* 3. Thân Thẻ Node Kiểu Blender (Inline Controls & Preview) */}
      <div className="wf-node-body">
        {logicItem ? (
          <div className="wf-node-logic-body">
            <div className="wf-node-inline-slider">
              <div className="wf-node-inline-slider-label">
                <span>Cường độ / Tốc độ:</span>
                <strong>{Math.round((node.params?.intensity ?? 1.0) * 100)}%</strong>
              </div>
              <input
                type="range"
                className="wf-range sm"
                min={0.2}
                max={2.0}
                step={0.05}
                value={node.params?.intensity ?? 1.0}
                onChange={(e) => {
                  e.stopPropagation()
                  onUpdateNodeParams?.(node.id, { intensity: parseFloat(e.target.value) })
                }}
                onClick={(e) => e.stopPropagation()}
                title="Kéo trượt để tăng giảm cường độ / tốc độ tác động của logic này"
              />
            </div>
            <div className="wf-node-logic-desc" title={logicItem.description}>
              {logicItem.description}
            </div>
          </div>
        ) : boundLayer ? (
          <WorkflowNodePreview
            node={node}
            project={project}
            mode="card"
            runtimeTelemetry={telemetry}
          />
        ) : (
          <>
            <div
              className="wf-preset-pills-bar"
              role="radiogroup"
              aria-label={`Chế độ xử lý của ${cardTitle}`}
            >
              {(spec?.presets ?? []).slice(0, 3).map((p) => {
                const active = node.preset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`wf-preset-pill${active ? ' active' : ''}`}
                    title={`${p.label}\n${p.summary}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectNode(node.id)
                      onChangeNodePreset(node.id, p.id)
                    }}
                  >
                    {PRESET_SHORT_LABELS[p.id] ?? p.label}
                  </button>
                )
              })}
            </div>

            <WorkflowNodePreview
              node={node}
              project={project}
              mode="card"
              runtimeTelemetry={telemetry}
            />
          </>
        )}
      </div>
    </div>
  )
}
