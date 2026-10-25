import React, { useMemo } from 'react'
import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import {
  WORKFLOW_V2_SPAWN_CATALOG,
  cleanV2NodeTitle,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export interface WorkflowV2SidebarProps {
  workflow: WorkflowGraph
  collapsed: boolean
  selectedNodeId: string | null
  spawnTarget?: WorkflowNode
  onToggleCollapsed: () => void
  onSelectNode: (nodeId: string) => void
  onToggleGroup: (groupNodeId: string, collapsed: boolean) => void
  onSpawn: (category: WorkflowV2SpawnCategory) => void
}

/** Cột trái Workflow V2: cây đề cương (Nhóm → Layer) để điều hướng nhanh + lưới gắn Node Logic cho Layer đích */
export const WorkflowV2Sidebar: React.FC<WorkflowV2SidebarProps> = ({
  workflow,
  collapsed,
  selectedNodeId,
  spawnTarget,
  onToggleCollapsed,
  onSelectNode,
  onToggleGroup,
  onSpawn
}) => {
  const outline = useMemo(() => {
    const byId = new Map(workflow.nodes.map((n) => [n.id, n]))
    return workflow.nodes
      .filter((n) => n.params?.groupKind)
      .map((group) => ({
        group,
        layers: workflow.edges
          .filter((e) => e.fromNode === group.id)
          .map((e) => byId.get(e.toNode))
          .filter((n): n is WorkflowNode => Boolean(n && n.type === 'layer_assembly' && !n.params?.groupKind))
      }))
  }, [workflow])

  return (
    <aside className={`wf-node-palette wf-v2-sidebar${collapsed ? ' collapsed' : ''}`} data-mcp-region="workflow_palette">
      <div className="wf-v2-sidebar-head">
        {!collapsed && <span>Cấu trúc cảnh</span>}
        <button
          type="button"
          className="wf-v2-collapse-btn"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Mở cột cấu trúc' : 'Thu gọn cột cấu trúc'}
          aria-label={collapsed ? 'Mở cột cấu trúc' : 'Thu gọn cột cấu trúc'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      {!collapsed && (
        <div className="wf-v2-sidebar-content">
          <section className="wf-v2-sidebar-sec">
            <div className="wf-v2-sec-title">Nhóm & Layer</div>
            <div className="wf-v2-outline" role="tree">
              {outline.map(({ group, layers }) => {
                const isCollapsed = Boolean(group.params?.collapsedGroup)
                return (
                  <div key={group.id} role="treeitem" aria-expanded={!isCollapsed}>
                    <div className={`wf-v2-outline-row group${selectedNodeId === group.id ? ' active' : ''}`}>
                      <button
                        type="button"
                        className="wf-v2-outline-caret"
                        title={isCollapsed ? 'Mở nhóm' : 'Thu gọn nhóm'}
                        aria-label={isCollapsed ? 'Mở nhóm' : 'Thu gọn nhóm'}
                        onClick={() => onToggleGroup(group.id, !isCollapsed)}
                      >
                        {isCollapsed ? '▸' : '▾'}
                      </button>
                      <button type="button" className="wf-v2-outline-name" onClick={() => onSelectNode(group.id)}>
                        <span aria-hidden="true">{resolveV2NodeTheme(group).icon}</span>
                        <span className="txt">{group.title.replace(/^Group\s+/i, '')}</span>
                      </button>
                      <span className="wf-v2-outline-count">{layers.length}</span>
                    </div>
                    {!isCollapsed &&
                      layers.map((layer) => (
                        <button
                          key={layer.id}
                          type="button"
                          className={`wf-v2-outline-row layer${selectedNodeId === layer.id ? ' active' : ''}${layer.enabled ? '' : ' off'}`}
                          onClick={() => onSelectNode(layer.id)}
                          title={layer.title}
                        >
                          <span className="txt">{cleanV2NodeTitle(layer.title)}</span>
                        </button>
                      ))}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="wf-v2-sidebar-sec">
            <div className="wf-v2-sec-title">Gắn logic</div>
            <div className={`wf-v2-spawn-target${spawnTarget ? '' : ' empty'}`}>
              {spawnTarget ? (
                <>
                  Đích: <strong title={spawnTarget.title}>{cleanV2NodeTitle(spawnTarget.title)}</strong>
                </>
              ) : (
                'Chọn một Layer trên sơ đồ để gắn logic'
              )}
            </div>
            <div className="wf-v2-add-grid">
              {WORKFLOW_V2_SPAWN_CATALOG.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="wf-v2-add-card"
                  disabled={!spawnTarget}
                  style={{ ['--wf-v2-accent' as string]: item.accent }}
                  title={spawnTarget ? `Gắn ${item.label} cho "${cleanV2NodeTitle(spawnTarget.title)}"` : 'Chọn một Layer trước'}
                  onClick={() => onSpawn(item.id)}
                >
                  <span className="wf-v2-add-icon" aria-hidden="true">{item.icon}</span>
                  <span className="wf-v2-add-info">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}
