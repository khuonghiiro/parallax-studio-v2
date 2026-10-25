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
  activeShotId: string | null
  spawnTarget?: WorkflowNode
  onToggleCollapsed: () => void
  onSelectNode: (nodeId: string) => void
  onFocusShot: (shotId: string | null, rootId: string) => void
  onToggleGroup: (groupNodeId: string, collapsed: boolean) => void
  onSpawn: (category: WorkflowV2SpawnCategory) => void
}

interface OutlineCluster {
  root: WorkflowNode
  groups: { group: WorkflowNode; layers: WorkflowNode[] }[]
}

function buildOutline(workflow: WorkflowGraph): OutlineCluster[] {
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]))
  const kids = (id: string, pick: (n: WorkflowNode) => boolean): WorkflowNode[] =>
    workflow.edges
      .filter((e) => e.fromNode === id)
      .map((e) => byId.get(e.toNode))
      .filter((n): n is WorkflowNode => Boolean(n && pick(n)))
  return workflow.nodes
    .filter((n) => n.type === 'scene_shot')
    .map((root) => {
      const camBranches = kids(root.id, (n) => n.type === 'camera_director' && !n.params?.isCameraWaypoint).map((cam) => {
        const waypoints = workflow.nodes
          .filter((n) => n.type === 'camera_director' && Boolean(n.params?.isCameraWaypoint) && n.params?.shotId === root.params?.shotId)
          .sort((a, b) => (a.params?.waypointLocalIndex ?? 0) - (b.params?.waypointLocalIndex ?? 0))
        return { group: { ...cam, title: 'Lộ trình Camera' }, layers: waypoints }
      })
      const layerBranches = kids(root.id, (n) => Boolean(n.params?.groupKind)).map((group) => ({
        group,
        layers: kids(group.id, (n) => n.type === 'layer_assembly' && !n.params?.groupKind)
      }))
      return {
        root,
        groups: [...camBranches, ...layerBranches]
      }
    })
}

const GroupRows: React.FC<{
  group: WorkflowNode
  layers: WorkflowNode[]
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onToggleGroup: (id: string, collapsed: boolean) => void
}> = ({ group, layers, selectedNodeId, onSelectNode, onToggleGroup }) => {
  const isCollapsed = Boolean(group.params?.collapsedGroup)
  return (
    <div role="treeitem" aria-expanded={!isCollapsed}>
      <div className={`wf-v2-outline-row group${selectedNodeId === group.id ? ' active' : ''}`}>
        <button type="button" className="wf-v2-outline-caret" aria-label={isCollapsed ? 'Mở nhóm' : 'Thu gọn nhóm'} onClick={() => onToggleGroup(group.id, !isCollapsed)}>
          {isCollapsed ? '▸' : '▾'}
        </button>
        <button type="button" className="wf-v2-outline-name" onClick={() => onSelectNode(group.id)}>
          <span aria-hidden="true">{resolveV2NodeTheme(group).icon}</span>
          <span className="txt">{group.title.replace(/^Nhóm\s+/i, '')}</span>
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
}

/** Cột trái: cây đề cương Cảnh → Nhóm → Layer (điều hướng trong không gian chung) + lưới gắn Node Logic */
export const WorkflowV2Sidebar: React.FC<WorkflowV2SidebarProps> = (props) => {
  const outline = useMemo(() => buildOutline(props.workflow), [props.workflow])
  const { collapsed, spawnTarget } = props
  return (
    <aside className={`wf-node-palette wf-v2-sidebar${collapsed ? ' collapsed' : ''}`} data-mcp-region="workflow_palette">
      <div className="wf-v2-sidebar-head">
        {!collapsed && <span>Cấu trúc dự án</span>}
        <button type="button" className="wf-v2-collapse-btn" onClick={props.onToggleCollapsed} aria-label={collapsed ? 'Mở cột cấu trúc' : 'Thu gọn cột cấu trúc'}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      {!collapsed && (
        <div className="wf-v2-sidebar-content">
          <section className="wf-v2-sidebar-sec">
            <div className="wf-v2-sec-title">Cảnh · Nhóm · Layer</div>
            <div className="wf-v2-outline" role="tree">
              {outline.map(({ root, groups }) => {
                const live = Boolean(root.params?.shotId) && root.params?.shotId === props.activeShotId
                return (
                  <div key={root.id} className="wf-v2-outline-cluster">
                    <button
                      type="button"
                      className={`wf-v2-outline-shot${props.selectedNodeId === root.id ? ' active' : ''}${live ? ' live' : ''}`}
                      onClick={() => props.onFocusShot(root.params?.shotId ?? null, root.id)}
                      title={`${root.title} · ${(root.params?.timeStart ?? 0).toFixed(1)}s – ${(root.params?.timeEnd ?? 0).toFixed(1)}s`}
                    >
                      {live && <span className="wf-v2-live-dot" aria-hidden="true" />}
                      <span className="txt">{root.title}</span>
                      <span className="range">{(root.params?.timeStart ?? 0).toFixed(1)}s</span>
                    </button>
                    {groups.map(({ group, layers }) => (
                      <GroupRows key={group.id} group={group} layers={layers} selectedNodeId={props.selectedNodeId} onSelectNode={props.onSelectNode} onToggleGroup={props.onToggleGroup} />
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
                  onClick={() => props.onSpawn(item.id)}
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
