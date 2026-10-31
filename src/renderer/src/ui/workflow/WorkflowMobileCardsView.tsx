import React, { useMemo, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { computeV2Clusters, v2RootId } from '../../project/workflowV2Engine'
import { effectiveTimeParams } from '../../project/workflowTiming'
import { IconPlus, IconSliders, IconTrash } from '../icons'
import { isDeletableV2Node } from './WorkflowNodeCardV2'
import { WorkflowTimeRulerV2 } from './WorkflowTimeRulerV2'
import { WorkflowV2SpawnMenu } from './WorkflowV2SpawnMenu'
import {
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export interface WorkflowMobileCardsViewProps {
  workflow: WorkflowGraph
  project: Project
  currentTime: number
  playing: boolean
  activeShotId: string | null
  focusedShotId: string | null
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
  onOpenNodeInspector: (nodeId: string) => void
  onSetTime: (t: number) => void
  onTogglePlay: () => void
  onToggleNodeEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateNodeParams: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
  onAttachLogicToLayer: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onSpawnCameraWaypoint?: (
    shotId: string,
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold',
    fromWaypointTime?: number
  ) => void
}

export const WorkflowMobileCardsView: React.FC<WorkflowMobileCardsViewProps> = (props) => {
  const {
    workflow,
    project,
    currentTime,
    playing,
    activeShotId,
    focusedShotId,
    selectedNodeId,
    onSelectNode,
    onOpenNodeInspector,
    onSetTime,
    onTogglePlay,
    onToggleNodeEnable,
    onDeleteNode,
    onUpdateNodeParams,
    onAttachLogicToLayer,
    onSpawnCameraWaypoint
  } = props

  const [spawnTarget, setSpawnTarget] = useState<{ layerNodeId: string; x: number; y: number } | null>(null)
  const maxDuration = Math.max(1, project.comp.duration || 5)

  const nodeMap = useMemo(() => new Map(workflow.nodes.map((n) => [n.id, n])), [workflow.nodes])
  const childrenMap = useMemo(() => {
    const map = new Map<string, WorkflowNode[]>()
    for (const edge of workflow.edges) {
      const child = nodeMap.get(edge.toNode)
      if (!child) continue
      const arr = map.get(edge.fromNode) ?? []
      if (!arr.some((x) => x.id === child.id)) arr.push(child)
      map.set(edge.fromNode, arr)
    }
    return map
  }, [workflow.edges, nodeMap])

  const clusters = useMemo(() => {
    const raw = computeV2Clusters(workflow.nodes, workflow.edges, new Set())
    return raw.filter((c) => !focusedShotId || c.shotId === focusedShotId)
  }, [workflow.nodes, workflow.edges, focusedShotId])

  const activeRootId = activeShotId ? v2RootId(activeShotId) : null
  const activeCount = useMemo(() => {
    let n = 0
    for (const node of workflow.nodes) {
      if (!node.enabled) continue
      const p = effectiveTimeParams(project, node, node.params ?? {})
      const s = p.timeStart ?? 0
      const e = p.timeEnd ?? maxDuration
      if (currentTime >= s - 0.02 && currentTime <= e + 0.02) n++
    }
    return n
  }, [workflow.nodes, project, currentTime, maxDuration])

  const openSpawnFor = (e: React.MouseEvent, layerNodeId: string): void => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSpawnTarget({ layerNodeId, x: Math.round(rect.left), y: Math.round(rect.bottom + 4) })
  }

  const renderNodeActions = (node: WorkflowNode, extra?: React.ReactNode) => (
    <div className="wf-mcard-actions" onClick={(e) => e.stopPropagation()}>
      {extra}
      <button
        type="button"
        className="btn ghost sm wf-mcard-btn"
        title="Mở bảng chỉnh sửa thông số Node"
        onClick={() => onOpenNodeInspector(node.id)}
      >
        <IconSliders width={12} height={12} />
        <span>Chỉnh</span>
      </button>
      <button
        type="button"
        className={`wf-mcard-toggle${node.enabled ? ' on' : ''}`}
        title={node.enabled ? 'Đang bật — chạm để tạm tắt' : 'Đang tắt — chạm để bật'}
        onClick={() => onToggleNodeEnable(node.id)}
      >
        {node.enabled ? 'BẬT' : 'TẮT'}
      </button>
      {isDeletableV2Node(node) && (
        <button
          type="button"
          className="btn ghost icon sm wf-mcard-del"
          title="Xoá Node này"
          onClick={() => onDeleteNode(node.id)}
        >
          <IconTrash width={12} height={12} />
        </button>
      )}
    </div>
  )

  return (
    <div className="wf-mobile-cards-view" data-mcp-region="workflow_mobile_cards">
      <WorkflowTimeRulerV2
        currentTime={currentTime}
        duration={maxDuration}
        playing={playing}
        selectedNode={selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null}
        scopeRange={{ start: 0, end: maxDuration }}
        activeAtTimeCount={activeCount}
        onSetTime={onSetTime}
        onTogglePlay={onTogglePlay}
        onUpdateNodeTimeRange={(id, s, en) => onUpdateNodeParams(id, { timeStart: s, timeEnd: en })}
      />

      <div className="wf-mcards-scroll">
        {clusters.map((cluster) => {
          const root = nodeMap.get(cluster.rootId)
          if (!root) return null
          const clusterNodes = cluster.nodeIds
            .map((id) => nodeMap.get(id))
            .filter((n): n is WorkflowNode => Boolean(n))
          const isLiveShot = cluster.rootId === activeRootId
          const camParent = clusterNodes.find(
            (n) => n.type === 'camera_director' && !n.params?.isCameraWaypoint
          )
          const camWaypoints = clusterNodes
            .filter((n) => Boolean(n.params?.isCameraWaypoint))
            .sort((a, b) => (a.params?.timeStart ?? 0) - (b.params?.timeStart ?? 0))
          const clusterLocks = clusterNodes.filter((n) => n.params?.logicCategory === 'cluster_lock')
          const layerNodes = clusterNodes.filter((n) => resolveV2NodeLevel(n) === 'layer')

          return (
            <section
              key={cluster.rootId}
              className={`wf-mcard-cluster${isLiveShot ? ' is-live' : ''}`}
            >
              <header
                className={`wf-mcard-cluster-head${selectedNodeId === root.id ? ' selected' : ''}`}
                onClick={() => {
                  onSelectNode(root.id)
                  if (root.params?.timeStart !== undefined) onSetTime(root.params.timeStart)
                }}
              >
                <div className="wf-mcard-cluster-title">
                  <span className="wf-mcard-emoji">🎬</span>
                  <strong>{cleanV2NodeTitle(root.title)}</strong>
                  {isLiveShot && <span className="wf-mcard-live-badge">ĐANG QUAY</span>}
                </div>
                <span className="wf-mcard-time">
                  {(root.params?.timeStart ?? 0).toFixed(1)}s – {(root.params?.timeEnd ?? maxDuration).toFixed(1)}s
                </span>
              </header>

              {/* 1. Lộ trình Camera 3D của Cảnh */}
              {camParent && (
                <div className="wf-mcard-group">
                  <div
                    className={`wf-mcard-row is-cam${selectedNodeId === camParent.id ? ' selected' : ''}`}
                    style={{ ['--wf-v2-accent' as string]: resolveV2NodeTheme(camParent).accent }}
                    onClick={() => onSelectNode(camParent.id)}
                  >
                    <div className="wf-mcard-info">
                      <span className="wf-mcard-badge">CAMERA 3D</span>
                      <span className="wf-mcard-name">{cleanV2NodeTitle(camParent.title)}</span>
                    </div>
                    {renderNodeActions(
                      camParent,
                      cluster.shotId && onSpawnCameraWaypoint ? (
                        <button
                          type="button"
                          className="btn ghost sm wf-mcard-btn accent"
                          onClick={() => onSpawnCameraWaypoint(cluster.shotId!, 'pan')}
                          title="Thêm mốc lộ trình Camera mới cho cảnh này"
                        >
                          <IconPlus width={11} height={11} />
                          <span>Mốc</span>
                        </button>
                      ) : null
                    )}
                  </div>

                  {camWaypoints.map((wp) => {
                    const th = resolveV2NodeTheme(wp)
                    return (
                      <div
                        key={wp.id}
                        className={`wf-mcard-row is-child${selectedNodeId === wp.id ? ' selected' : ''}`}
                        style={{ ['--wf-v2-accent' as string]: th.accent }}
                        onClick={() => {
                          onSelectNode(wp.id)
                          if (wp.params?.timeStart !== undefined) onSetTime(wp.params.timeStart)
                        }}
                      >
                        <div className="wf-mcard-info">
                          <span className="wf-mcard-step-icon">{th.icon}</span>
                          <div className="wf-mcard-texts">
                            <span className="wf-mcard-name">{cleanV2NodeTitle(wp.title)}</span>
                            <small className="wf-mcard-sub">
                              {(wp.params?.timeStart ?? 0).toFixed(1)}s → {(wp.params?.timeEnd ?? 0).toFixed(1)}s
                            </small>
                          </div>
                        </div>
                        {renderNodeActions(wp)}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 1b. Cụm 2.5D / Khoá Cụm & Logic chung của cả Nhân vật / Tổ hợp */}
              {clusterLocks.map((lockNode) => {
                const lockTheme = resolveV2NodeTheme(lockNode)
                const lockLogic = (childrenMap.get(lockNode.id) ?? []).filter(
                  (c) => resolveV2NodeLevel(c) === 'logic' && c.params?.logicCategory !== 'cluster_lock'
                )
                return (
                  <div key={lockNode.id} className="wf-mcard-group">
                    <div
                      className={`wf-mcard-row is-layer${selectedNodeId === lockNode.id ? ' selected' : ''}`}
                      style={{ ['--wf-v2-accent' as string]: lockTheme.accent }}
                      onClick={() => onSelectNode(lockNode.id)}
                    >
                      <div className="wf-mcard-info">
                        <span className="wf-mcard-emoji">{lockTheme.icon}</span>
                        <div className="wf-mcard-texts">
                          <span className="wf-mcard-name">{cleanV2NodeTitle(lockNode.title)}</span>
                          <small className="wf-mcard-sub">
                            {lockTheme.badge} · {lockLogic.length} logic cụm
                          </small>
                        </div>
                      </div>
                      {renderNodeActions(
                        lockNode,
                        <button
                          type="button"
                          className="btn ghost sm wf-mcard-btn accent"
                          onClick={(e) => openSpawnFor(e, lockNode.id)}
                          title="Gắn Logic chung cho toàn bộ Cụm 2.5D (Chuyển động, Rig xương, Biểu cảm...)"
                        >
                          <IconPlus width={11} height={11} />
                          <span>Logic cụm</span>
                        </button>
                      )}
                    </div>

                    {lockLogic.map((lg) => {
                      const gTheme = resolveV2NodeTheme(lg)
                      return (
                        <div
                          key={lg.id}
                          className={`wf-mcard-row is-child is-logic${selectedNodeId === lg.id ? ' selected' : ''}`}
                          style={{ ['--wf-v2-accent' as string]: gTheme.accent }}
                          onClick={() => onSelectNode(lg.id)}
                        >
                          <div className="wf-mcard-info">
                            <span className="wf-mcard-emoji">{gTheme.icon}</span>
                            <div className="wf-mcard-texts">
                              <span className="wf-mcard-name">{cleanV2NodeTitle(lg.title)}</span>
                              <small className="wf-mcard-sub">
                                {gTheme.badge} · {(lg.params?.timeStart ?? 0).toFixed(1)}s–
                                {(lg.params?.timeEnd ?? maxDuration).toFixed(1)}s
                              </small>
                            </div>
                          </div>
                          {renderNodeActions(lg)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* 2. Danh sách Layer & Logic riêng gắn kèm */}
              <div className="wf-mcard-layers">
                {layerNodes.map((ln) => {
                  const lTheme = resolveV2NodeTheme(ln)
                  const attached = (childrenMap.get(ln.id) ?? []).filter(
                    (c) => resolveV2NodeLevel(c) === 'logic' && c.params?.logicCategory !== 'cluster_lock'
                  )
                  return (
                    <div key={ln.id} className="wf-mcard-group">
                      <div
                        className={`wf-mcard-row is-layer${selectedNodeId === ln.id ? ' selected' : ''}`}
                        style={{ ['--wf-v2-accent' as string]: lTheme.accent }}
                        onClick={() => onSelectNode(ln.id)}
                      >
                        <div className="wf-mcard-info">
                          <span className="wf-mcard-emoji">{lTheme.icon}</span>
                          <div className="wf-mcard-texts">
                            <span className="wf-mcard-name">{cleanV2NodeTitle(ln.title)}</span>
                            <small className="wf-mcard-sub">
                              {lTheme.badge} · {attached.length} logic
                            </small>
                          </div>
                        </div>
                        {renderNodeActions(
                          ln,
                          <button
                            type="button"
                            className="btn ghost sm wf-mcard-btn accent"
                            onClick={(e) => openSpawnFor(e, ln.id)}
                            title="Gắn thêm Node Logic (Chuyển động, Hiệu ứng, Ánh sáng, Xương...) cho Layer này"
                          >
                            <IconPlus width={11} height={11} />
                            <span>Logic</span>
                          </button>
                        )}
                      </div>

                      {attached.map((lg) => {
                        const gTheme = resolveV2NodeTheme(lg)
                        return (
                          <div
                            key={lg.id}
                            className={`wf-mcard-row is-child is-logic${selectedNodeId === lg.id ? ' selected' : ''}`}
                            style={{ ['--wf-v2-accent' as string]: gTheme.accent }}
                            onClick={() => onSelectNode(lg.id)}
                          >
                            <div className="wf-mcard-info">
                              <span className="wf-mcard-emoji">{gTheme.icon}</span>
                              <div className="wf-mcard-texts">
                                <span className="wf-mcard-name">{cleanV2NodeTitle(lg.title)}</span>
                                <small className="wf-mcard-sub">
                                  {gTheme.badge} · {(lg.params?.timeStart ?? 0).toFixed(1)}s–
                                  {(lg.params?.timeEnd ?? maxDuration).toFixed(1)}s
                                </small>
                              </div>
                            </div>
                            {renderNodeActions(lg)}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {spawnTarget && (
        <WorkflowV2SpawnMenu
          clientX={spawnTarget.x}
          clientY={spawnTarget.y}
          parentNode={nodeMap.get(spawnTarget.layerNodeId)}
          project={project}
          onPick={(cat, presetId, extraParams, customTitle) => {
            onAttachLogicToLayer(spawnTarget.layerNodeId, cat, presetId, extraParams, customTitle)
            setSpawnTarget(null)
          }}
          onClose={() => setSpawnTarget(null)}
        />
      )}
    </div>
  )
}
