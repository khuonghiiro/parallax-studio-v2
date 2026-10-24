import React, { useMemo } from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  type WorkflowLogicNodeCatalogItem
} from '../../project/workflowLogicCatalog'
import {
  getCompatibleMainNodesForAtomicNode,
  getConnectedAtomicNodesForMainNode,
  getConnectedMainNodesForAtomicNode
} from '../../project/workflowNodeComposition'

export interface WorkflowAtomicNodeBodyProps {
  node: WorkflowNode
  logicItem: WorkflowLogicNodeCatalogItem
  workflow: WorkflowGraph
  project?: Project
  onSelectNode: (nodeId: string) => void
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onSwitchAtomicFunction?: (nodeId: string, newLogicId: string) => void
  onConnectToMainNode?: (atomicNodeId: string, mainNodeId: string) => void
  onDisconnectEdge?: (edgeId: string) => void
}

/**
 * Thân thẻ chuyên biệt cho Node Chức Năng Đơn Lẻ (1 Node = 1 Tính năng).
 * Hỗ trợ:
 * 1. Đổi nhanh chức năng cùng nhóm bằng 1 cú nhấp (1-Click Function Switcher Pills).
 * 2. Hiển thị tường minh Node Chính đang nhận hiệu ứng (hoặc nút nối nhanh 1-click nếu đang đứt).
 * 3. Thanh trượt Cường độ / Tốc độ trực tiếp trên thẻ.
 */
export const WorkflowAtomicNodeBody: React.FC<WorkflowAtomicNodeBodyProps> = React.memo(({
  node,
  logicItem,
  workflow,
  project,
  onSelectNode,
  onUpdateNodeParams,
  onSwitchAtomicFunction,
  onConnectToMainNode,
  onDisconnectEdge
}) => {
  const siblingFunctions = useMemo(() => {
    return WORKFLOW_LOGIC_NODE_CATALOG.filter(
      (item) =>
        item.category === logicItem.category &&
        item.id !== 'logic-scene-spawn-layers' &&
        item.id !== 'logic-assembly-child'
    )
  }, [logicItem.category])

  const connectedMainNodes = useMemo(
    () => getConnectedMainNodesForAtomicNode(node, workflow, project),
    [node, workflow, project]
  )

  const compatibleMainNodes = useMemo(() => {
    if (connectedMainNodes.length > 0) return []
    return getCompatibleMainNodesForAtomicNode(node, workflow, project).slice(0, 4)
  }, [connectedMainNodes.length, node, workflow, project])

  const intensityPct = Math.round((node.params?.intensity ?? 1.0) * 100)

  return (
    <div className="wf-node-logic-body" onClick={(e) => e.stopPropagation()}>
      {/* 1. Dải đổi nhanh chức năng đơn lẻ cùng nhóm (1-Click Function Switcher) */}
      {siblingFunctions.length > 1 && onSwitchAtomicFunction && (
        <div className="wf-atomic-Siblings-wrap">
          <div className="wf-atomic-section-label">
            <span>⚡ Đổi nhanh chức năng ({logicItem.categoryLabel}):</span>
          </div>
          <div className="wf-atomic-sibling-pills" role="radiogroup" aria-label="Đổi chức năng đơn lẻ">
            {siblingFunctions.map((sib) => {
              const active = sib.id === logicItem.id
              return (
                <button
                  key={sib.id}
                  type="button"
                  className={`wf-preset-pill wf-atomic-sib-pill${active ? ' active' : ''}`}
                  title={`${sib.title}\n${sib.description}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!active) {
                      onSwitchAtomicFunction(node.id, sib.id)
                    }
                  }}
                >
                  <span>{sib.icon}</span>
                  <span>{sib.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Đích nhận (Node Chính đang được làm giàu) hoặc Nút nối nhanh 1-click */}
      <div className="wf-atomic-targets-box">
        {connectedMainNodes.length > 0 ? (
          <div className="wf-atomic-connected-row">
            <span className="wf-atomic-target-label">🎯 Đang gắn vào:</span>
            <div className="wf-atomic-target-pills">
              {connectedMainNodes.map((target) => (
                <span
                  key={target.node.id}
                  className="wf-atomic-target-chip connected"
                  title={`Đang làm giàu cho ${target.kindLabel}: "${target.label}" — Bấm để chọn Node Chính`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectNode(target.node.id)
                  }}
                >
                  <span>{target.icon}</span>
                  <span className="wf-atomic-target-name">{target.label}</span>
                  {onDisconnectEdge && target.edgeId && (
                    <button
                      type="button"
                      className="wf-atomic-target-unlink"
                      title={`Ngắt chức năng "${logicItem.shortLabel}" khỏi "${target.label}"`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDisconnectEdge(target.edgeId)
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="wf-atomic-disconnected-box">
            <span className="wf-atomic-target-label warn">
              🔗 Chưa nối — Bấm để gắn ngay vào Node Chính:
            </span>
            {compatibleMainNodes.length > 0 && onConnectToMainNode ? (
              <div className="wf-atomic-quick-bind-list">
                {compatibleMainNodes.map((cand) => (
                  <button
                    key={cand.node.id}
                    type="button"
                    className="wf-atomic-quick-bind-btn"
                    title={`Gắn "${logicItem.title}" vào ${cand.kindLabel} "${cand.label}"`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onConnectToMainNode(node.id, cand.node.id)
                    }}
                  >
                    <span>+ {cand.icon}</span>
                    <span>{cand.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="wf-atomic-no-target-hint">
                Kéo dây từ cổng vào thẻ Layer / Cảnh / Camera đích
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Thanh trượt Cường độ / Tốc độ */}
      <div className="wf-node-inline-slider">
        <div className="wf-node-inline-slider-label">
          <span>Cường độ / Tốc độ:</span>
          <strong>{intensityPct}%</strong>
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
          title="Kéo trượt để tăng giảm cường độ / tốc độ tác động của chức năng này"
        />
      </div>

      <div className="wf-node-logic-desc" title={logicItem.description}>
        {logicItem.description}
      </div>
    </div>
  )
})

export interface WorkflowMainNodeEnrichedBarProps {
  mainNode: WorkflowNode
  workflow: WorkflowGraph
  onSelectNode: (nodeId: string) => void
  onToggleNode: (nodeId: string) => void
  onDisconnectEdge?: (edgeId: string) => void
  onOpenQuickAttach?: (e: React.MouseEvent, mainNode: WorkflowNode) => void
}

/**
 * Khay hiển thị tất cả các Node Chức Năng Đơn Lẻ đang kết nối vào một Node Chính (Cảnh / Layer / Camera / Xuất),
 * cho phép bật/tắt, ngắt từng chức năng hoặc bấm [+ Gắn chức năng] ngay trên thẻ Node Chính.
 */
export const WorkflowMainNodeEnrichedBar: React.FC<WorkflowMainNodeEnrichedBarProps> = React.memo(({
  mainNode,
  workflow,
  onSelectNode,
  onToggleNode,
  onDisconnectEdge,
  onOpenQuickAttach
}) => {
  const attachedAtomics = useMemo(
    () => getConnectedAtomicNodesForMainNode(mainNode, workflow),
    [mainNode, workflow]
  )

  return (
    <div className="wf-main-enriched-section" onClick={(e) => e.stopPropagation()}>
      <div className="wf-main-enriched-header">
        <span className="wf-main-enriched-title">
          ⚡ Logic kết hợp ({attachedAtomics.length})
        </span>
        {onOpenQuickAttach && (
          <button
            type="button"
            className="wf-main-attach-btn"
            title="Gắn thêm Node chức năng đơn lẻ vào Node Chính này để làm phong phú hành vi"
            onClick={(e) => {
              e.stopPropagation()
              onOpenQuickAttach(e, mainNode)
            }}
          >
            + Gắn chức năng
          </button>
        )}
      </div>

      {attachedAtomics.length > 0 ? (
        <div className="wf-main-enriched-pills">
          {attachedAtomics.map((item) => (
            <div
              key={item.node.id}
              className={`wf-main-enriched-pill${item.enabled ? ' on' : ' off'}`}
              style={{ ['--eff-c' as string]: item.color }}
              title={`${item.logicItem?.title ?? item.shortLabel} (${item.intensityPct}%)\n• Bấm tên để chọn node\n• Bấm chấm tròn để Bật/Tắt\n• Bấm ✕ để tháo khỏi Node Chính`}
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(item.node.id)
              }}
            >
              <button
                type="button"
                className={`wf-eff-toggle-dot${item.enabled ? ' on' : ''}`}
                title={item.enabled ? 'Đang BẬT — Bấm để tạm tắt chức năng này' : 'Đang TẮT — Bấm để bật lại'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleNode(item.node.id)
                }}
              />
              <span className="wf-eff-icon">{item.icon}</span>
              <span className="wf-eff-label">{item.shortLabel}</span>
              <span className="wf-eff-pct">{item.intensityPct}%</span>
              {onDisconnectEdge && (
                <button
                  type="button"
                  className="wf-eff-unlink-btn"
                  title={`Tháo "${item.shortLabel}" khỏi Node Chính này`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDisconnectEdge(item.edgeId)
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="wf-main-enriched-empty"
          onClick={(e) => {
            if (onOpenQuickAttach) {
              e.stopPropagation()
              onOpenQuickAttach(e, mainNode)
            }
          }}
          title="Bấm [+ Gắn chức năng] hoặc kéo nhiều Node chức năng đơn lẻ nối vào đây để kết hợp logic"
        >
          <span>Chưa gắn node đơn năng — Bấm <strong>+ Gắn chức năng</strong> để kết hợp</span>
        </div>
      )}
    </div>
  )
})
