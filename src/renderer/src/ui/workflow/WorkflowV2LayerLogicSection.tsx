import React, { useMemo, useState } from 'react'
import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  WORKFLOW_V2_SPAWN_CATALOG,
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
  layer: Layer
  activeNode: WorkflowNode | null
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (layerNodeId: string, category: WorkflowV2SpawnCategory) => void
}> = ({ workflow, layer, activeNode, onSelectNode, onAttachLogic }) => {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const layerNode = useMemo(
    () =>
      workflow.nodes.find(
        (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(layer.id)
      ) ?? null,
    [workflow.nodes, layer.id]
  )

  const logicNodes = useMemo(
    () =>
      workflow.nodes.filter(
        (n) =>
          resolveV2NodeLevel(n) === 'logic' &&
          n.type !== 'camera_director' &&
          n.params?.targetLayerIds?.includes(layer.id)
      ),
    [workflow.nodes, layer.id]
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
          const isSelected = activeNode?.id === ln.id
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

      {quickAddOpen && (
        <div className="wf-v2-node-switch-spawn">
          {WORKFLOW_V2_SPAWN_CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              className="wf-v2-spawn-chip"
              style={{ ['--wf-v2-accent' as string]: item.accent }}
              onClick={() => {
                onAttachLogic(layerNode.id, item.id)
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
