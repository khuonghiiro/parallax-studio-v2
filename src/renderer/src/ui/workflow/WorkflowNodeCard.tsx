import React from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowPortKind
} from '@shared/types'
import {
  PRESET_SHORT_LABELS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
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
  onPreviewNode,
  onStartConnecting,
  onInputSocketClick,
  onOutputSocketClick,
  onConnectPorts,
  onClearPendingWire
}) => {
  const spec = WORKFLOW_NODE_SPECS[node.type]
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
        ['--wf-node-color' as string]: spec?.color ?? '#38bdf8'
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
      <div className="wf-node-header">
        <span className="wf-node-icon" style={{ background: spec?.color }}>
          {renderWorkflowNodeIcon(node.type, { width: 12, height: 12 })}
        </span>
        <span
          className="wf-node-title"
          title={`${node.title} — Nắm kéo để di chuyển tự do Trái / Phải / Lên / Xuống`}
        >
          {node.params?.logicId ? node.title.replace(/^Node:\s*/i, '') : (spec?.shortTitle ?? node.title)}
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
        {onDeleteNode && workflow.nodes.length > 1 && (
          <button
            type="button"
            className="wf-node-del-btn"
            title={`Xóa "${node.title}" khỏi sơ đồ`}
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

      {/* 3. Chọn nhanh Chế độ bằng Nút Bấm Trực Tiếp (Không dùng Combobox) & Preview 2.5D */}
      <div className="wf-node-body">
        <div
          className="wf-preset-pills-bar"
          role="radiogroup"
          aria-label={`Chế độ xử lý của ${node.title}`}
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
      </div>
    </div>
  )
}
