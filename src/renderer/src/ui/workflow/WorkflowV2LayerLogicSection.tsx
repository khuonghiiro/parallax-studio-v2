import React, { useMemo, useState } from 'react'
import type { Layer, Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getCompatibleLogicCatalogForNode } from '../../project/workflowV2Engine'
import {
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export function resolveActiveLayerForInspector(
  project: Project,
  node: WorkflowNode | null,
  selectedLayerId: string | null
): Layer | undefined {
  const fromNodeLayerId = node?.params?.targetLayerIds?.[0] ?? null
  if (fromNodeLayerId) {
    const found = project.layers.find((l) => l.id === fromNodeLayerId)
    if (found) return found
  }
  if (selectedLayerId) {
    return project.layers.find((l) => l.id === selectedLayerId)
  }
  return undefined
}

/**
 * Dải chuyển nhanh giữa Node Layer gốc và các Node Logic đang gắn trên cùng Layer.
 * Giúp người dùng thao tác mượt mà ở cả chế độ Timeline lẫn Workflow mà không cần mở sơ đồ dây.
 */
export const WorkflowV2NodeSwitcherBar: React.FC<{
  workflow: WorkflowGraph
  project?: Project
  layer: Layer
  activeNode: WorkflowNode | null
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
}> = ({ workflow, project, layer, activeNode, onSelectNode, onAttachLogic }) => {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const layerNode = useMemo(
    () =>
      workflow.nodes.find(
        (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(layer.id)
      ) ?? null,
    [workflow.nodes, layer.id]
  )

  const instId = activeNode?.params?.instanceId ?? layer.composite?.instanceId ?? layer.model3d?.instanceId

  const logicNodes = useMemo(
    () =>
      workflow.nodes.filter(
        (n) =>
          resolveV2NodeLevel(n) === 'logic' &&
          n.type !== 'camera_director' &&
          !n.params?.isPartChild &&
          (n.params?.targetLayerIds?.includes(layer.id) || (instId && n.params?.instanceId === instId))
      ),
    [workflow.nodes, layer.id, instId]
  )

  const partChildNodes = useMemo(
    () =>
      workflow.nodes.filter(
        (n) =>
          n.params?.logicCategory === 'part_swap' &&
          Boolean(n.params?.isPartChild) &&
          (instId ? n.params?.instanceId === instId : n.params?.targetLayerIds?.includes(layer.id))
      ),
    [workflow.nodes, layer.id, instId]
  )

  const clusterLockNode = useMemo(
    () =>
      instId
        ? (workflow.nodes.find(
            (n) => n.params?.logicCategory === 'cluster_lock' && n.params?.instanceId === instId
          ) ?? null)
        : null,
    [workflow.nodes, instId]
  )

  const attachTargetNodeId =
    activeNode?.params?.logicCategory === 'cluster_lock'
      ? activeNode.id
      : clusterLockNode && clusterLockNode.enabled && clusterLockNode.params?.lockedGroup !== false
        ? clusterLockNode.id
        : layerNode?.id ?? ''

  const targetNodeObj = useMemo(
    () => (attachTargetNodeId ? workflow.nodes.find((n) => n.id === attachTargetNodeId) ?? layerNode : layerNode),
    [workflow.nodes, attachTargetNodeId, layerNode]
  )

  const compat = useMemo(
    () =>
      targetNodeObj
        ? getCompatibleLogicCatalogForNode(targetNodeObj, project)
        : { parentKind: 'other' as const, categories: [], dynamicParts: [] },
    [targetNodeObj, project]
  )

  if (!layerNode) return null

  const isLayerSelected = activeNode?.id === layerNode.id

  return (
    <div className="wf-v2-node-switcher" aria-label="Chuyển nhanh Node của Layer">
      <div className="wf-v2-node-switcher-row">
        <button
          type="button"
          className={`wf-v2-node-switch-pill is-layer${isLayerSelected ? ' active' : ''}`}
          title={`Node Layer gốc: ${layer.name} (Chỉnh BBox 2D, X/Y/Z, thời lượng)`}
          onClick={() => onSelectNode(layerNode.id)}
        >
          <span className="pill-ico">🖼</span>
          <span className="pill-txt">{layer.name}</span>
        </button>

        {logicNodes.map((ln) => {
          const theme = resolveV2NodeTheme(ln)
          const isSelected =
            activeNode?.id === ln.id ||
            Boolean(ln.params?.isPartHub && activeNode?.params?.isPartChild && activeNode?.params?.hierarchyParentNodeId === ln.id)
          return (
            <button
              key={ln.id}
              type="button"
              className={`wf-v2-node-switch-pill${isSelected ? ' active' : ''}${!ln.enabled ? ' is-off' : ''}`}
              style={{ ['--wf-v2-accent' as string]: theme.accent }}
              title={`${ln.title} (${theme.badge}) — Click để chỉnh riêng thông số của Node này`}
              onClick={() => onSelectNode(ln.id)}
            >
              <span className={`pill-dot${ln.enabled ? ' on' : ''}`} />
              <span className="pill-ico">{theme.icon}</span>
              <span className="pill-txt">{cleanV2NodeTitle(ln.title)}</span>
            </button>
          )
        })}

        <button
          type="button"
          className={`wf-v2-node-switch-add${quickAddOpen ? ' active' : ''}`}
          title="Gắn thêm Node Logic mới vào Layer này"
          onClick={() => setQuickAddOpen((v) => !v)}
        >
          + Logic
        </button>
      </div>

      {partChildNodes.length > 0 && activeNode?.params?.logicCategory === 'part_swap' && (
        <div className="wf-v2-part-children-row" aria-label="Danh sách Node con Bộ phận">
          <span className="wf-v2-part-children-tag">🧩 Bộ phận con:</span>
          {partChildNodes.map((child) => {
            const isChildSelected = activeNode?.id === child.id
            const timeLabel =
              child.params?.timeStart !== undefined && child.params?.timeEnd !== undefined
                ? ` (${child.params.timeStart}s–${child.params.timeEnd}s)`
                : ''
            return (
              <button
                key={child.id}
                type="button"
                className={`wf-v2-part-child-pill${isChildSelected ? ' active' : ''}${!child.enabled ? ' is-off' : ''}`}
                title={`${child.title}${timeLabel} — Click để cấu hình riêng bộ phận này`}
                onClick={() => onSelectNode(child.id)}
              >
                <span className="pill-ico">{child.params?.partIcon || '🧩'}</span>
                <span className="pill-txt">{child.params?.partGroupTitle || cleanV2NodeTitle(child.title)}</span>
              </button>
            )
          })}
        </div>
      )}

      {quickAddOpen && (
        <div className="wf-v2-node-switch-spawn">
          {compat.categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className="wf-v2-spawn-chip"
              style={{ ['--wf-v2-accent' as string]: item.accent }}
              onClick={() => {
                onAttachLogic(attachTargetNodeId, item.id)
                setQuickAddOpen(false)
              }}
            >
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
