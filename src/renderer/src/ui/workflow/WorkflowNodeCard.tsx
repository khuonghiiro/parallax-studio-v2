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
import { WorkflowTransformBody } from './WorkflowTransformBody'
import { WorkflowLayerBody } from './WorkflowLayerBody'
import {
  WorkflowAtomicNodeBody,
  WorkflowMainNodeEnrichedBar
} from './WorkflowAtomicCardBody'
import {
  NODE_W,
  SOCKET_PAD_TOP,
  SOCKET_ROW_H,
  estimateNodeCardHeight,
  evaluateNodeRuntimeTelemetry,
  getBestMatchingInputPort,
  getBestMatchingOutputPort
} from './workflowLayoutAndFlow'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'
import { getWorkflowNodePorts } from '../../project/workflowNodePorts'
import {
  connectAtomicNodeToMainNode,
  isMainWorkflowNode,
  switchAtomicNodeFunction
} from '../../project/workflowNodeComposition'

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
  onDisconnectEdge?: (edgeId: string) => void
  onClearPendingWire: () => void
  onOpenConfig?: (node: WorkflowNode) => void
  onOpenQuickAttach?: (e: React.MouseEvent, mainNode: WorkflowNode) => void
  onSpawnSceneLayers?: () => void
  commitWorkflow?: (
    wf: WorkflowGraph,
    mergeKey?: string,
    syncScene?: boolean,
    selectIds?: Set<string>
  ) => void
  showToast?: (msg: string) => void
}

export const WorkflowNodeCard: React.FC<WorkflowNodeCardProps> = React.memo(({
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
  onDisconnectEdge,
  onClearPendingWire,
  onOpenConfig,
  onOpenQuickAttach,
  onSpawnSceneLayers,
  commitWorkflow,
  showToast
}) => {
  const logicItem = React.useMemo(() => {
    if (!node.params?.logicId) return null
    return WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === node.params?.logicId) ?? null
  }, [node.params?.logicId])

  const boundLayer = React.useMemo(() => {
    if (node.type === 'scene_shot' || node.params?.logicId) return null
    if (!project || !node.params?.targetLayerIds?.length) return null
    if (node.params.targetLayerIds.length > 1 && !node.id.startsWith('wf-layer-')) return null
    return project.layers.find((l) => l.id === node.params?.targetLayerIds?.[0]) ?? null
  }, [node.id, node.type, node.params?.logicId, project, node.params?.targetLayerIds])

  const boundShot = React.useMemo(() => {
    if (node.type !== 'scene_shot' || !project) return null
    const sid = node.params?.shotId
    return (sid ? project.shots.find((s) => s.id === sid) : null) ?? project.shots[0] ?? null
  }, [node.type, node.params?.shotId, project])

  const parentLayer = React.useMemo(() => {
    if (!project || !boundLayer?.parentId) return null
    return project.layers.find((l) => l.id === boundLayer.parentId) ?? null
  }, [project, boundLayer?.parentId])

  const spec = WORKFLOW_NODE_SPECS[node.type]

  const { inputs, outputs } = React.useMemo(() => {
    if (boundLayer) {
      return {
        inputs: ['layers_tree', 'motion_stream', 'vfx_stage', 'audio_mix'] as WorkflowPortKind[],
        outputs: ['transform_link', 'actors_rig'] as WorkflowPortKind[]
      }
    }
    return getWorkflowNodePorts(node)
  }, [boundLayer, node])

  const handleSwitchAtomicFunction = React.useCallback(
    (nodeId: string, newLogicId: string) => {
      if (!commitWorkflow) return
      const next = switchAtomicNodeFunction(workflow, nodeId, newLogicId)
      commitWorkflow(next, `wf-switch-fn-${nodeId}`, true, new Set([nodeId]))
      const newItem = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === newLogicId)
      if (newItem) {
        showToast?.(`⚡ Đã đổi chức năng khối sang "${newItem.icon} ${newItem.title}"!`)
      }
    },
    [commitWorkflow, workflow, showToast]
  )

  const handleConnectToMainNode = React.useCallback(
    (atomicNodeId: string, mainNodeId: string) => {
      if (!commitWorkflow) return
      const next = connectAtomicNodeToMainNode(workflow, atomicNodeId, mainNodeId)
      if (next.edges.length > workflow.edges.length) {
        commitWorkflow(next, undefined, true)
        const mainNode = workflow.nodes.find((n) => n.id === mainNodeId)
        showToast?.(
          `🔗 Đã gắn chức năng "${logicItem?.title ?? node.title}" vào Node Chính "${mainNode?.title ?? mainNodeId}"!`
        )
      } else {
        showToast?.('⚠️ Không tìm thấy cổng tương thích để gắn trực tiếp')
      }
    },
    [commitWorkflow, workflow, logicItem?.title, node.title, showToast]
  )

  const verticalInPort = React.useMemo(
    () => inputs.find((p) => p === 'transform_link') ?? null,
    [inputs]
  )
  const verticalOutPort = React.useMemo(
    () => null as WorkflowPortKind | null,
    []
  )
  const sideInputs = React.useMemo(
    () => inputs.filter((p) => p !== 'transform_link'),
    [inputs]
  )
  const sideOutputs = React.useMemo(
    () => outputs.filter((p) => p !== 'transform_link'),
    [outputs]
  )
  const socketRowCount = Math.max(sideInputs.length, sideOutputs.length)

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
    if (boundShot) return `Cảnh: ${boundShot.name}`
    if (boundLayer && node.params?.isAssemblyRoot) return boundLayer.composite?.compositeName ?? boundLayer.model3d?.modelName ?? boundLayer.name
    if (boundLayer) return boundLayer.name
    if (logicItem) return logicItem.title
    return spec?.shortTitle ?? node.title
  }, [boundShot, boundLayer, logicItem, spec, node.title, node.params?.isAssemblyRoot])

  const cardCategoryBadge = React.useMemo(() => {
    if (boundShot && project) {
      const shotLayers = project.layers.filter(
        (l) => !l.locked && (project.shots.length <= 1 || l.shotId === boundShot.id)
      )
      const visCount = shotLayers.filter((l) => l.visible !== false).length
      const dur = node.params?.duration ?? Math.round(((project.comp?.duration ?? 5) / Math.max(1, project.shots.length)) * 10) / 10
      return `${visCount}/${shotLayers.length} lớp · ${dur.toFixed(1)}s`
    }
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
  }, [boundShot, project, node.params?.duration, boundLayer, logicItem, spec])

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

  const sourceNode = React.useMemo(() => {
    if (!pendingSource) return null
    return workflow.nodes.find((n) => n.id === pendingSource.nodeId) ?? null
  }, [pendingSource, workflow.nodes])

  return (
    <div
      id={`wf-node-${node.type}`}
      className={`wf-node-card${node.type === 'layer_transform' ? ' is-companion' : ''}${isSelected ? ' selected' : ''}${isConnected ? ' connected' : ' disconnected'}${!node.enabled ? ' disabled' : ''}${telemetry.isStageHighlight ? ' running stage-highlight' : ''}${isConnectable ? ' wire-connectable' : ''}${isSnapNode ? ' snap-target' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        minHeight: estimateNodeCardHeight(node),
        ['--wf-node-color' as string]: nodeColor
      }}
      onPointerDown={(e) => onStartNodeDrag(e, node)}
      onClick={handleCardClick}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelectNode(node.id)
        onOpenConfig?.(node)
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelectNode(node.id)
        onOpenConfig?.(node)
      }}
    >
      {/* Cổng Đỉnh Đầu (Top Port: layers_tree trên Layer hoặc transform_link trên Transform) */}
      {verticalInPort && (() => {
        const portSpec = WORKFLOW_PORT_SPECS[verticalInPort]
        const inWired = workflow.edges.some((e) => e.toNode === node.id && e.toPort === verticalInPort)
        const isCompatibleTarget = Boolean(
          pendingSource &&
            sourceNode &&
            pendingSource.nodeId !== node.id &&
            pendingSource.isOutput &&
            validateWorkflowConnection(sourceNode, pendingSource.port, node, verticalInPort).valid
        )
        const isIncompatible = Boolean(
          pendingSource && pendingSource.nodeId !== node.id && !isCompatibleTarget
        )
        const isSnapped = Boolean(
          snappedTarget && snappedTarget.nodeId === node.id && snappedTarget.port === verticalInPort && snappedTarget.isInput
        )
        const isInPending = Boolean(
          pendingSource?.nodeId === node.id && pendingSource?.port === verticalInPort && !pendingSource.isOutput
        )
        return (
          <button
            type="button"
            className={`wf-socket-vertical top${inWired ? ' wired' : ''}${isCompatibleTarget ? ' compatible' : ''}${isIncompatible ? ' incompatible' : ''}${isSnapped ? ' snapped' : ''}${isInPending ? ' pending' : ''}`}
            style={{ ['--port-c' as string]: portSpec?.color ?? '#38bdf8' }}
            title={`Cổng đỉnh: ${portSpec?.label ?? verticalInPort} (${inWired ? 'Đang nối — Bấm để chọn' : 'Chưa nối — Bấm hoặc kéo để nối'})`}
            onPointerDown={(e) => onStartConnecting(e, node, verticalInPort, false)}
            onClick={(e) => onInputSocketClick(e, node, verticalInPort)}
          >
            <span className="wf-socket-vertical-pin">
              <span className="wf-socket-vertical-pin-core" />
            </span>
            <span className="wf-socket-vertical-label">{portSpec?.shortLabel ?? verticalInPort}</span>
          </button>
        )
      })()}

      {/* Chỉ báo nổi bật khi thẻ được hút nam châm làm điểm kết nối */}
      {isSnapNode && (
        <div className="wf-node-snap-indicator">
          🔗 Bấm để nối vào đây
        </div>
      )}

      {/* Thanh Công Cụ Nổi Kiểu n8n (Floating Quick Actions khi Hover hoặc Chọn khối) */}
      {node.type !== 'layer_transform' && (
        <div
          className="wf-node-floating-toolbar"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {onPreviewNode && (
            <button
              type="button"
              className="wf-float-act-btn"
              title="Chạy thử hiệu ứng khối này trên Cảnh 3D"
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(node.id)
                onPreviewNode(node)
              }}
            >
              ▶ Thử
            </button>
          )}
          {onOpenQuickAttach && isMainWorkflowNode(node) && (
            <button
              type="button"
              className="wf-float-act-btn accent"
              title="Gắn nhanh Chuyển động / Hiệu ứng / Âm thanh vào khối này (Kiểu n8n)"
              onClick={(e) => {
                e.stopPropagation()
                onOpenQuickAttach(e, node)
              }}
            >
              + Hiệu ứng
            </button>
          )}
          {onOpenConfig && (
            <button
              type="button"
              className="wf-float-act-btn"
              title="Mở bảng Cấu hình chi tiết của khối (Hoặc bấm đúp)"
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(node.id)
                onOpenConfig(node)
              }}
            >
              ⚙ Cấu hình
            </button>
          )}
          {onDeleteNode && (
            <button
              type="button"
              className="wf-float-act-btn danger"
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
      )}

      {/* Nút [+] Mép Phải Kiểu n8n (1-Click Quick-Add & Auto-Wire) */}
      {onOpenQuickAttach && isMainWorkflowNode(node) && (
        <button
          type="button"
          className="wf-n8n-plus-btn"
          title={`Bấm [+] để gắn nhanh chức năng vào "${cardTitle}" và tự động nối dây (Chuẩn n8n)`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onOpenQuickAttach(e, node)
          }}
        >
          <span className="wf-n8n-plus-stem" />
          <span className="wf-n8n-plus-circle">+</span>
        </button>
      )}

      {/* 1. Thanh tiêu đề Khối Gọn Thoáng (Nắm kéo tự do 4 hướng) */}
      {node.type === 'layer_transform' ? (
        <div className="wf-node-header companion" style={{ ['--wf-node-color' as string]: '#0284c7' }}>
          <span className="wf-node-icon" style={{ background: '#0284c7' }}>🎯</span>
          <span
            className="wf-node-title"
            title={`${cardTitle} — Kéo slider chỉnh tọa độ 60fps (Chuột phải hoặc bấm đúp để cấu hình)`}
          >
            {cardTitle}
          </span>
          {onOpenConfig && (
            <button
              type="button"
              className="wf-node-gear-btn"
              title="Cấu hình khối (Chuột phải hoặc bấm đúp)"
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(node.id)
                onOpenConfig(node)
              }}
            >
              ⚙
            </button>
          )}
          <span className="wf-node-status-pill on">⚡ 60fps</span>
        </div>
      ) : (
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
            title={`${cardTitle} (${cardCategoryBadge}) — Nắm kéo để di chuyển tự do 4 hướng (Bấm đúp để cấu hình)`}
          >
            {cardTitle}
            {parentLayer && (
              <span className="wf-node-sub-tag parent-link" title={`Layer con bám theo Cha: "${parentLayer.name}" (Parent & Link)`}>
                ↳ {parentLayer.name}
              </span>
            )}
          </span>
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
        </div>
      )}

      {/* 2. Khu vực Chân cắm Port (Protruding Socket Pins trên mép trái & phải) */}
      {socketRowCount > 0 && (
        <div
          className="wf-socket-matrix"
          style={{ height: SOCKET_PAD_TOP * 2 + socketRowCount * SOCKET_ROW_H }}
        >
          {Array.from({ length: socketRowCount }).map((_, rowIdx) => {
            const inPort = sideInputs[rowIdx]
            const outPort = sideOutputs[rowIdx]
            const inSpec = inPort ? WORKFLOW_PORT_SPECS[inPort] : null
            const outSpec = outPort ? WORKFLOW_PORT_SPECS[outPort] : null

          const inWired = inPort
            ? workflow.edges.some((e) => e.toNode === node.id && e.toPort === inPort)
            : false
          const outWired = outPort
            ? workflow.edges.some((e) => e.fromNode === node.id && e.fromPort === outPort)
            : false

          const isCompatibleTarget = Boolean(
            inPort &&
              pendingSource &&
              sourceNode &&
              pendingSource.nodeId !== node.id &&
              pendingSource.isOutput &&
              validateWorkflowConnection(sourceNode, pendingSource.port, node, inPort).valid
          )
          const isIncompatibleInput = Boolean(
            inPort && pendingSource && pendingSource.nodeId !== node.id && !isCompatibleTarget
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
            outPort &&
              pendingSource &&
              sourceNode &&
              pendingSource.nodeId !== node.id &&
              !pendingSource.isOutput &&
              validateWorkflowConnection(node, outPort, sourceNode, pendingSource.port).valid
          )
          const isIncompatibleOutput = Boolean(
            outPort && pendingSource && pendingSource.nodeId !== node.id && !isCompatibleOutput
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
                  className={`wf-socket-hit in${inWired ? ' wired' : ''}${isCompatibleTarget ? ' compatible' : ''}${isIncompatibleInput ? ' incompatible' : ''}${isSnapped ? ' snapped' : ''}${isInPending ? ' pending' : ''}`}
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
                  className={`wf-socket-hit out${outWired ? ' wired' : ''}${isOutPending ? ' pending' : ''}${isCompatibleOutput ? ' compatible' : ''}${isIncompatibleOutput ? ' incompatible' : ''}${isSnappedOutput ? ' snapped' : ''}`}
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
      )}

      {/* 3. Thân Thẻ Node Kiểu Blender (Inline Controls & Preview) */}
      <div className="wf-node-body">
        {node.type === 'layer_transform' ? (
          <WorkflowTransformBody
            node={node}
            project={project}
            onUpdateNodeParams={onUpdateNodeParams}
          />
        ) : boundLayer ? (
          <WorkflowLayerBody
            node={node}
            project={project}
            workflow={workflow}
            boundLayer={boundLayer}
            onSelectNode={onSelectNode}
            onToggleNode={onToggleNode}
            onDisconnectEdge={onDisconnectEdge}
            onOpenQuickAttach={onOpenQuickAttach}
            onUpdateNodeParams={onUpdateNodeParams}
          />
        ) : logicItem ? (
          <WorkflowAtomicNodeBody
            node={node}
            logicItem={logicItem}
            workflow={workflow}
            project={project}
            onSelectNode={onSelectNode}
            onUpdateNodeParams={onUpdateNodeParams}
            onSwitchAtomicFunction={commitWorkflow ? handleSwitchAtomicFunction : undefined}
            onConnectToMainNode={commitWorkflow ? handleConnectToMainNode : undefined}
            onDisconnectEdge={onDisconnectEdge}
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

            {node.type === 'scene_shot' &&
              onSpawnSceneLayers &&
              !workflow.nodes.some((n) => n.id.startsWith('wf-layer-')) && (
              <button
                type="button"
                className="wf-scene-unpack-inline-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onSpawnSceneLayers()
                }}
                title="Bung tất cả Layer của Phân cảnh này thành lưới thẻ 2.5D gọn đẹp để thao tác trực tiếp"
              >
                <span>🎬 Bung các Layer của Cảnh</span>
              </button>
            )}

            {isMainWorkflowNode(node) && (
              <WorkflowMainNodeEnrichedBar
                mainNode={node}
                workflow={workflow}
                onSelectNode={onSelectNode}
                onToggleNode={onToggleNode}
                onDisconnectEdge={onDisconnectEdge}
                onOpenQuickAttach={onOpenQuickAttach}
              />
            )}
          </>
        )}
      </div>

      {/* Cổng Chân Đáy (Bottom Port: layers_tree trên Scene hoặc transform_link trên Layer) */}
      {verticalOutPort && (() => {
        const portSpec = WORKFLOW_PORT_SPECS[verticalOutPort]
        const outWired = workflow.edges.some((e) => e.fromNode === node.id && e.fromPort === verticalOutPort)
        const isOutPending = Boolean(
          pendingSource?.nodeId === node.id && pendingSource?.port === verticalOutPort && pendingSource.isOutput
        )
        const isCompatibleOutput = Boolean(
          pendingSource &&
            sourceNode &&
            pendingSource.nodeId !== node.id &&
            !pendingSource.isOutput &&
            validateWorkflowConnection(node, verticalOutPort, sourceNode, pendingSource.port).valid
        )
        const isIncompatibleOut = Boolean(
          pendingSource && pendingSource.nodeId !== node.id && !isCompatibleOutput
        )
        const isSnappedOutput = Boolean(
          snappedTarget && snappedTarget.nodeId === node.id && snappedTarget.port === verticalOutPort && !snappedTarget.isInput
        )
        return (
          <button
            type="button"
            className={`wf-socket-vertical bottom${outWired ? ' wired' : ''}${isOutPending ? ' pending' : ''}${isCompatibleOutput ? ' compatible' : ''}${isIncompatibleOut ? ' incompatible' : ''}${isSnappedOutput ? ' snapped' : ''}`}
            style={{ ['--port-c' as string]: portSpec?.color ?? '#38bdf8' }}
            title={`Cổng đáy: ${portSpec?.label ?? verticalOutPort} (${outWired ? 'Đang nối — Bấm để chọn' : 'Chưa nối — Bấm hoặc kéo để nối'})`}
            onPointerDown={(e) => onStartConnecting(e, node, verticalOutPort, true)}
            onClick={(e) => onOutputSocketClick(e, node, verticalOutPort)}
          >
            <span className="wf-socket-vertical-label">{portSpec?.shortLabel ?? verticalOutPort}</span>
            <span className="wf-socket-vertical-pin">
              <span className="wf-socket-vertical-pin-core" />
            </span>
          </button>
        )
      })()}
    </div>
  )
})
