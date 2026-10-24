import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { useToast } from '../../actions'
import {
  attachLogicNodeToLayerV2,
  buildWorkflowV2SceneTree,
  layoutWorkflowV2Tree,
  syncWorkflowV2NodeToProject
} from '../../project/workflowV2Engine'
import { WorkflowCanvasV2 } from './WorkflowCanvasV2'
export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const playing = useEditor((s) => s.playing)
  const currentTime = useEditor((s) => (Number.isFinite(s.time) ? s.time : 0))
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setTimelineTab = useView((s) => s.setTimelineTab)
  const showToast = useToast((s) => s.show)
  const [shotScope, setShotScope] = useState<string>(() => selectedShotId || project.shots[0]?.id || '__all__')
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  useEffect(() => {
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) {
      setShotScope(selectedShotId)
    }
  }, [selectedShotId, project.shots])
  // Khởi tạo hoặc lấy Cây Workflow V2 chuẩn 4 tầng (Cảnh Root -> Group Layer -> Node Layer -> Node Logic)
  const workflow: WorkflowGraph = useMemo(() => {
    if (
      project.workflow &&
      project.workflow.presetId === 'v2_scene_hierarchy' &&
      project.workflow.nodes.some((n) => n.id === 'v2-root-scene')
    ) {
      return project.workflow
    }
    return buildWorkflowV2SceneTree(project, shotScope)
  }, [project, shotScope])
  // Tự động lưu cây V2 vào project khi mở lần đầu hoặc khi đổi sang chế độ V2
  useEffect(() => {
    if (!project.workflow || project.workflow.presetId !== 'v2_scene_hierarchy') {
      const nextWf = buildWorkflowV2SceneTree(useEditor.getState().project, shotScope)
      useEditor.getState().update((draft) => {
        draft.workflow = nextWf
      }, 'wf-v2-init')
    }
  }, [project.workflow?.presetId, shotScope])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => workflow.nodes[0]?.id ?? null)
  // Khi click chọn Layer trên Viewport/Timeline, tự động chọn đúng Node Layer trên Workflow V2
  useEffect(() => {
    if (!selectedLayerId) return
    const layerNode = workflow.nodes.find(
      (n) =>
        n.type === 'layer_assembly' &&
        !n.params?.groupKind &&
        n.params?.targetLayerIds?.includes(selectedLayerId)
    )
    if (layerNode) {
      setSelectedNodeId(layerNode.id)
    }
  }, [selectedLayerId, workflow.nodes])
  const commitWorkflow = useCallback((nextWf: WorkflowGraph, mergeKey = 'wf-v2-edit') => {
    useEditor.getState().update((draft) => {
      draft.workflow = nextWf
    }, mergeKey)
  }, [])
  /** Đồng bộ / Bung lại toàn bộ Cây Cảnh 4 tầng từ dữ liệu thật của Project */
  const handleRebuildSceneTree = useCallback(() => {
    const freshTree = buildWorkflowV2SceneTree(useEditor.getState().project, shotScope)
    commitWorkflow(freshTree, 'wf-v2-rebuild')
    setSelectedNodeId('v2-root-scene')
    window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))
    showToast('🎬 Đã bung Cây Cảnh V2 (Cảnh Root ➔ Group Layer ➔ Layer ➔ Node Logic)')
  }, [shotScope, commitWorkflow, showToast])
  /** Sắp xếp lại cây phân cấp chuẩn 4 cột */
  const handleAutoLayout = useCallback(() => {
    const nextNodes = layoutWorkflowV2Tree(workflow.nodes, workflow.edges)
    commitWorkflow({ ...workflow, nodes: nextNodes }, 'wf-v2-layout')
    window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))
    showToast('✨ Đã căn chỉnh cây phân cấp 4 cột gọn gàng')
  }, [workflow, commitWorkflow, showToast])
  /** Di chuyển thẻ Node tự do */
  const handleMoveNodes = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const nextNodes = workflow.nodes.map((n) =>
        positions[n.id] ? { ...n, position: positions[n.id] } : n
      )
      commitWorkflow({ ...workflow, nodes: nextNodes }, 'wf-v2-move')
    },
    [workflow, commitWorkflow]
  )
  /** Bật / Tắt một Node và đồng bộ xuống Project */
  const handleToggleNodeEnable = useCallback(
    (nodeId: string) => {
      useEditor.getState().update((draft) => {
        const wf = draft.workflow ?? workflow
        const nextNodes = wf.nodes.map((n) =>
          n.id === nodeId ? { ...n, enabled: !n.enabled } : n
        )
        draft.workflow = { ...wf, nodes: nextNodes }
        const toggled = nextNodes.find((n) => n.id === nodeId)
        if (toggled) {
          syncWorkflowV2NodeToProject(draft as Project, toggled)
        }
      }, 'wf-v2-toggle')
    },
    [workflow]
  )
  /** Xoá một Node (và các nhánh con nếu là Group/Layer) */
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'v2-root-scene') return
      const toRemove = new Set<string>([nodeId])
      let added = true
      while (added) {
        added = false
        for (const e of workflow.edges) {
          if (toRemove.has(e.fromNode) && !toRemove.has(e.toNode)) {
            toRemove.add(e.toNode)
            added = true
          }
        }
      }
      const remainEdges = workflow.edges.filter(
        (e) => !toRemove.has(e.fromNode) && !toRemove.has(e.toNode)
      )
      const remainNodes = layoutWorkflowV2Tree(
        workflow.nodes.filter((n) => !toRemove.has(n.id)),
        remainEdges
      )
      commitWorkflow({ ...workflow, nodes: remainNodes, edges: remainEdges }, 'wf-v2-delete')
    },
    [workflow, commitWorkflow]
  )
  /** Cập nhật tham số hoặc Khoảng mốc thời gian [timeStart, timeEnd] của Node và đồng bộ tức thì xuống Project */
  const handleUpdateNodeParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => {
      useEditor.getState().update((draft) => {
        const wf = draft.workflow ?? workflow
        const nextNodes = wf.nodes.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            title: nextTitle ?? n.title,
            params: { ...(n.params ?? {}), ...patch }
          }
        })
        draft.workflow = { ...wf, nodes: nextNodes }
        const updatedNode = nextNodes.find((n) => n.id === nodeId)
        if (updatedNode) {
          syncWorkflowV2NodeToProject(draft as Project, updatedNode, patch)
        }
      }, `wf-v2-param-${nodeId}`)
    },
    [workflow]
  )
  /** Gắn thêm một Node Logic (Hành động, Ánh sáng, Hang động, Hiệu ứng, Âm thanh) vào một Node Layer */
  const handleAttachLogicToLayer = useCallback(
    (layerNodeId: string, category: 'action' | 'light' | 'cave' | 'fx' | 'audio') => {
      const { workflow: nextWf, createdNodeId } = attachLogicNodeToLayerV2(
        workflow,
        layerNodeId,
        category
      )
      useEditor.getState().update((draft) => {
        draft.workflow = nextWf
        const created = nextWf.nodes.find((n) => n.id === createdNodeId)
        if (created) {
          syncWorkflowV2NodeToProject(draft as Project, created)
        }
      }, 'wf-v2-attach-logic')
      setSelectedNodeId(createdNodeId)
      const labelMap = {
        action: '🏃 Node Hành động',
        light: '💡 Node Ánh sáng',
        cave: '🕳️ Node Hang động',
        fx: '✨ Node Hiệu ứng',
        audio: '🔊 Node Âm thanh'
      }
      showToast(`Đã gắn ${labelMap[category]} — kéo thanh mốc thời gian để chỉnh khoảng chạy!`)
    },
    [workflow, showToast]
  )
  /** Gắn nhanh Node Logic vào Layer đang chọn (hoặc Layer đầu tiên nếu đang chọn Root/Group) */
  const handleQuickSpawnForSelectedLayer = useCallback(
    (category: 'action' | 'light' | 'cave' | 'fx' | 'audio') => {
      const selNode = workflow.nodes.find((n) => n.id === selectedNodeId)
      let targetLayerNodeId: string | undefined
      if (selNode?.type === 'layer_assembly' && !selNode.params?.groupKind) {
        targetLayerNodeId = selNode.id
      } else if (selNode?.params?.hierarchyParentNodeId?.startsWith('v2-layer-')) {
        targetLayerNodeId = selNode.params.hierarchyParentNodeId
      } else {
        targetLayerNodeId = workflow.nodes.find(
          (n) => n.type === 'layer_assembly' && !n.params?.groupKind
        )?.id
      }
      if (!targetLayerNodeId) {
        showToast('Chưa có Node Layer nào trong cảnh để gắn Logic!')
        return
      }
      handleAttachLogicToLayer(targetLayerNodeId, category)
    },
    [workflow.nodes, selectedNodeId, handleAttachLogicToLayer, showToast]
  )
  /** Kết nối dây giữa 2 Node và tự động đồng bộ khoảng mốc thời gian + targetLayerIds */
  const handleConnectNodes = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      if (fromNode === toNode) return
      const exists = workflow.edges.some((e) => e.fromNode === fromNode && e.toNode === toNode)
      if (exists) return
      const src = workflow.nodes.find((n) => n.id === fromNode)
      const dst = workflow.nodes.find((n) => n.id === toNode)
      if (!src || !dst) return
      const nextEdges = [
        ...workflow.edges.filter((e) => e.toNode !== toNode),
        {
          id: `e-${fromNode}-${toNode}`,
          fromNode,
          fromPort,
          toNode,
          toPort
        }
      ]
      const nextNodes = workflow.nodes.map((n) => {
        if (n.id !== toNode) return n
        return {
          ...n,
          params: {
            ...(n.params ?? {}),
            hierarchyParentNodeId: fromNode,
            targetLayerIds: src.params?.targetLayerIds ?? n.params?.targetLayerIds,
            timeStart: n.params?.timeStart ?? src.params?.timeStart ?? 0,
            timeEnd: n.params?.timeEnd ?? src.params?.timeEnd ?? project.comp.duration
          }
        }
      })
      commitWorkflow(
        {
          ...workflow,
          nodes: layoutWorkflowV2Tree(nextNodes, nextEdges),
          edges: nextEdges
        },
        'wf-v2-connect'
      )
      showToast(`🔗 Đã kết nối "${src.title}" ➔ "${dst.title}"`)
    },
    [workflow, project.comp.duration, commitWorkflow, showToast]
  )
  const handleDisconnectEdge = useCallback(
    (edgeId: string) => {
      const nextEdges = workflow.edges.filter((e) => e.id !== edgeId)
      commitWorkflow({ ...workflow, edges: nextEdges }, 'wf-v2-disconnect')
    },
    [workflow, commitWorkflow]
  )
  /** Áp dụng toàn bộ thông số và khoảng mốc thời gian trên Cây Workflow V2 vào Cảnh thực tế */
  const handleApplyAllToScene = useCallback(() => {
    useEditor.getState().update((draft) => {
      const wf = draft.workflow ?? workflow
      for (const n of wf.nodes) {
        syncWorkflowV2NodeToProject(draft as Project, n)
      }
    }, 'wf-v2-apply-all')
    showToast('⚡ Đã áp dụng toàn bộ Cây Workflow & Khoảng mốc thời gian vào Cảnh 3D!')
  }, [workflow, showToast])
  const handleSwitchShotScope = (nextScope: string) => {
    setShotScope(nextScope)
    if (nextScope !== '__all__') {
      useEditor.getState().selectShot(nextScope)
    }
    const rebuilt = buildWorkflowV2SceneTree(useEditor.getState().project, nextScope)
    commitWorkflow(rebuilt, 'wf-v2-switch-shot')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('pxs:wf-fit-view')), 40)
  }
  const groupNodes = useMemo(
    () => workflow.nodes.filter((n) => Boolean(n.params?.groupKind)),
    [workflow.nodes]
  )
  const layerNodes = useMemo(
    () => workflow.nodes.filter((n) => n.type === 'layer_assembly' && !n.params?.groupKind),
    [workflow.nodes]
  )
  const logicNodes = useMemo(
    () =>
      workflow.nodes.filter(
        (n) => n.type !== 'scene_shot' && n.type !== 'layer_assembly'
      ),
    [workflow.nodes]
  )
  return (
    <div className="wf-studio-panel wf-v2-studio" data-mcp-region="timeline_workflow">
      {/* THANH CÔNG CỤ ĐỈNH WORKFLOW V2 */}
      <div className="wf-toolbar wf-v2-toolbar" data-mcp-region="workflow_toolbar">
        {/* Cụm chuyển đổi Timeline / Workflow */}
        <div className="tl-mode-tabs" data-mcp-region="timeline_tabs">
          <button
            type="button"
            className="tl-mode-tab"
            onClick={() => setTimelineTab('timeline')}
          >
            <span>🎞️ Timeline</span>
            <span className="tl-mode-tab-badge">{project.layers.length}</span>
          </button>
          <button
            type="button"
            className="tl-mode-tab active"
            onClick={() => setTimelineTab('workflow')}
          >
            <span>🌿 Workflow V2</span>
            <span className="tl-mode-tab-badge">{workflow.nodes.length}</span>
          </button>
        </div>
        <span className="wf-v2-status-pill">
          ✓ Cây thông mạch ({groupNodes.length} Group · {layerNodes.length} Layer · {logicNodes.length} Logic)
        </span>
        {/* Chọn Cảnh Root */}
        <div className="wf-v2-shot-switcher">
          <span className="wf-v2-shot-label">Cảnh Root:</span>
          <button
            type="button"
            className={`wf-v2-shot-btn ${shotScope === '__all__' ? 'active' : ''}`}
            onClick={() => handleSwitchShotScope('__all__')}
          >
            Tất cả ({project.shots.length})
          </button>
          {project.shots.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              className={`wf-v2-shot-btn ${shotScope === s.id ? 'active' : ''}`}
              onClick={() => handleSwitchShotScope(s.id)}
              title={`Cảnh #${idx + 1}: ${s.name}`}
            >
              #{idx + 1} {s.name}
            </button>
          ))}
        </div>
        {/* Các nút thao tác nhanh trên thanh công cụ */}
        <div className="wf-v2-toolbar-actions">
          <button
            type="button"
            className="wf-v2-tool-btn"
            onClick={handleRebuildSceneTree}
            title="Bung lại Cây Cảnh 4 tầng từ dữ liệu Cảnh & Layer hiện tại"
          >
            🎬 Bung Cây Cảnh
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn"
            onClick={handleAutoLayout}
            title="Tự động căn chỉnh Cây 4 cột gọn đẹp (Alt+L)"
          >
            ✨ Sắp xếp Cây
          </button>
          <div className="wf-v2-toolbar-sep" />
          <button
            type="button"
            className="wf-v2-tool-btn spawn-action"
            onClick={() => handleQuickSpawnForSelectedLayer('action')}
            title="Gắn thêm Node Hành động vào Layer đang chọn"
          >
            +🏃 Hành động
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn spawn-light"
            onClick={() => handleQuickSpawnForSelectedLayer('light')}
            title="Gắn thêm Node Ánh sáng vào Layer đang chọn"
          >
            +💡 Ánh sáng
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn spawn-fx"
            onClick={() => handleQuickSpawnForSelectedLayer('cave')}
            title="Gắn thêm Node Hang động / Vùng độ sâu vào Layer đang chọn"
          >
            +🕳️ Hang động
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn spawn-fx"
            onClick={() => handleQuickSpawnForSelectedLayer('fx')}
            title="Gắn thêm Node Hiệu ứng vào Layer đang chọn"
          >
            +✨ Hiệu ứng
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn primary-apply"
            onClick={handleApplyAllToScene}
            title="Áp dụng toàn bộ logic và khoảng mốc thời gian vào Cảnh"
          >
            ⚡ Áp dụng
          </button>
        </div>
      </div>
      {/* THÂN CHÍNH: CỘT THƯ VIỆN BÊN TRÁI + KHUNG VẼ CÂY THỜI GIAN BÊN PHẢI */}
      <div className="wf-v2-body">
        <aside
          className={`wf-node-palette wf-v2-sidebar ${paletteCollapsed ? 'collapsed' : ''}`}
          data-mcp-region="workflow_palette"
        >
          <div className="wf-v2-sidebar-head">
            {!paletteCollapsed && <span>🌿 CẤU TRÚC CÂY & NODE</span>}
            <button
              type="button"
              className="wf-v2-collapse-btn"
              onClick={() => setPaletteCollapsed((c) => !c)}
              title={paletteCollapsed ? 'Mở bảng cấu trúc Node' : 'Thu gọn bảng bên trái'}
            >
              {paletteCollapsed ? '▶' : '◀'}
            </button>
          </div>
          {!paletteCollapsed && (
            <div className="wf-v2-sidebar-content">
              <div className="wf-v2-sidebar-sec">
                <div className="wf-v2-sec-title">1. GẮN NODE LOGIC CHO LAYER</div>
                <div className="wf-v2-add-grid">
                  <button
                    type="button"
                    className="wf-v2-add-card action"
                    onClick={() => handleQuickSpawnForSelectedLayer('action')}
                  >
                    <span className="wf-v2-add-icon">🏃</span>
                    <div className="wf-v2-add-info">
                      <strong>Node Hành động</strong>
                      <small>Bay, đung đưa, thở, trượt + mốc thời gian</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card light"
                    onClick={() => handleQuickSpawnForSelectedLayer('light')}
                  >
                    <span className="wf-v2-add-icon">💡</span>
                    <div className="wf-v2-add-info">
                      <strong>Node Ánh sáng</strong>
                      <small>Đèn viền, đèn nến, đèn pin + mốc thời gian</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card cave"
                    onClick={() => handleQuickSpawnForSelectedLayer('cave')}
                  >
                    <span className="wf-v2-add-icon">🕳️</span>
                    <div className="wf-v2-add-info">
                      <strong>Node Hang động</strong>
                      <small>Vòm hang độ sâu, bóng tối + mốc thời gian</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card fx"
                    onClick={() => handleQuickSpawnForSelectedLayer('fx')}
                  >
                    <span className="wf-v2-add-icon">✨</span>
                    <div className="wf-v2-add-info">
                      <strong>Node Hiệu ứng</strong>
                      <small>Gió đàn hồi, Bloom, Blur, RGB + mốc thời gian</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card audio"
                    onClick={() => handleQuickSpawnForSelectedLayer('audio')}
                  >
                    <span className="wf-v2-add-icon">🔊</span>
                    <div className="wf-v2-add-info">
                      <strong>Node Âm thanh</strong>
                      <small>Thoại nhân vật, Lip-Sync + mốc thời gian</small>
                    </div>
                  </button>
                </div>
              </div>
              <div className="wf-v2-sidebar-sec">
                <div className="wf-v2-sec-title">2. NHÓM LAYER TRONG CẢNH ({groupNodes.length})</div>
                <div className="wf-v2-tree-list">
                  {groupNodes.map((g) => (
                    <div
                      key={g.id}
                      className={`wf-v2-tree-item ${selectedNodeId === g.id ? 'active' : ''}`}
                      onClick={() => setSelectedNodeId(g.id)}
                    >
                      <span>{g.params?.groupKind === 'group_3d' ? '🧊' : g.params?.groupKind === 'group_env' ? '🌍' : '🗂️'}</span>
                      <span className="wf-v2-tree-name">{g.title}</span>
                      <span className="wf-v2-tree-count">{g.params?.childLayerCount ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
        {/* KHUNG VẼ CÂY PHÂN CẤP + ĐƯỜNG KẺ MỐC THỜI GIAN */}
        <WorkflowCanvasV2
          workflow={workflow}
          project={project}
          currentTime={currentTime}
          playing={playing}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onSetTime={setTime}
          onTogglePlay={() => setPlaying(!playing)}
          onMoveNodes={handleMoveNodes}
          onToggleNodeEnable={handleToggleNodeEnable}
          onDeleteNode={handleDeleteNode}
          onUpdateNodeParams={handleUpdateNodeParams}
          onAttachLogicToLayer={handleAttachLogicToLayer}
          onConnectNodes={handleConnectNodes}
          onDisconnectEdge={handleDisconnectEdge}
          onAutoLayout={handleAutoLayout}
          onRebuildSceneTree={handleRebuildSceneTree}
        />
      </div>
    </div>
  )
}
