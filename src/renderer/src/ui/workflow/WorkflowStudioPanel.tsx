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
  recomputeSharedLogicTargets,
  reconcileWorkflowV2WithProject,
  syncWorkflowV2NodeToProject,
  validateWorkflowV2Connection
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

  const workflow: WorkflowGraph = useMemo(() => {
    if (
      project.workflow &&
      project.workflow.presetId === 'v2_scene_hierarchy' &&
      project.workflow.nodes.some((n) => n.id === 'v2-root-scene')
    ) {
      return reconcileWorkflowV2WithProject(project, project.workflow, shotScope)
    }
    return buildWorkflowV2SceneTree(project, shotScope)
  }, [project, shotScope])

  useEffect(() => {
    if (!project.workflow || project.workflow.presetId !== 'v2_scene_hierarchy') {
      const nextWf = buildWorkflowV2SceneTree(useEditor.getState().project, shotScope)
      useEditor.getState().update((draft) => {
        draft.workflow = nextWf
        for (const n of nextWf.nodes) {
          if (n.params?.logicCategory === 'material' || n.params?.logicCategory === 'collision') {
            syncWorkflowV2NodeToProject(draft as Project, n)
          }
        }
      }, 'wf-v2-init')
    } else if (workflow !== project.workflow) {
      useEditor.getState().update((draft) => {
        draft.workflow = workflow
      }, 'wf-v2-reconcile')
    }
  }, [project.workflow, workflow, shotScope])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => workflow.nodes[0]?.id ?? null)

  useEffect(() => {
    const onSelectV2Node = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId?: string }>).detail
      if (detail?.nodeId) {
        setSelectedNodeId(detail.nodeId)
      }
    }
    window.addEventListener('pxs:select-workflow-v2-node', onSelectV2Node)
    return () => window.removeEventListener('pxs:select-workflow-v2-node', onSelectV2Node)
  }, [])

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
    useEditor.getState().update((draft) => {
      draft.workflow = freshTree
      for (const n of freshTree.nodes) {
        if (n.params?.logicCategory === 'material' || n.params?.logicCategory === 'collision') {
          syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }
    }, 'wf-v2-rebuild')
    setSelectedNodeId('v2-root-scene')
    window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))
    showToast('🎬 Đã bung Cây Cảnh V2 (Cảnh Root ➔ Group Layer ➔ Layer ➔ Node Logic / Va chạm)')
  }, [shotScope, showToast])

  /** Sắp xếp lại cây phân cấp chuẩn 4 cột */
  const handleAutoLayout = useCallback(() => {
    const synced = recomputeSharedLogicTargets(workflow.nodes, workflow.edges)
    const nextNodes = layoutWorkflowV2Tree(synced, workflow.edges)
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
      const targetNode = workflow.nodes.find((n) => n.id === nodeId)
      const toRemove = new Set<string>([nodeId])
      if (targetNode?.type === 'layer_assembly') {
        let added = true
        while (added) {
          added = false
          for (const e of workflow.edges) {
            if (toRemove.has(e.fromNode) && !toRemove.has(e.toNode)) {
              // Chỉ xoá kéo theo Logic Node nếu không còn Layer nào khác dùng chung nó
              const otherParentEdges = workflow.edges.filter(
                (oe) => oe.toNode === e.toNode && !toRemove.has(oe.fromNode)
              )
              if (otherParentEdges.length === 0) {
                toRemove.add(e.toNode)
                added = true
              }
            }
          }
        }
      }
      const remainEdges = workflow.edges.filter(
        (e) => !toRemove.has(e.fromNode) && !toRemove.has(e.toNode)
      )
      const syncedRemain = recomputeSharedLogicTargets(
        workflow.nodes.filter((n) => !toRemove.has(n.id)),
        remainEdges
      )
      const remainNodes = layoutWorkflowV2Tree(syncedRemain, remainEdges)
      commitWorkflow({ ...workflow, nodes: remainNodes, edges: remainEdges }, 'wf-v2-delete')
    },
    [workflow, commitWorkflow]
  )

  /** Cập nhật tham số hoặc Khoảng mốc thời gian [timeStart, timeEnd] của Node và đồng bộ tức thì xuống Project */
  const handleUpdateNodeParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => {
      useEditor.getState().update((draft) => {
        const wf = draft.workflow ?? workflow
        const rawNodes = wf.nodes.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            title: nextTitle ?? n.title,
            params: { ...(n.params ?? {}), ...patch }
          }
        })
        const nextNodes =
          patch.collapsedGroup !== undefined
            ? layoutWorkflowV2Tree(rawNodes, wf.edges)
            : rawNodes
        draft.workflow = { ...wf, nodes: nextNodes }
        const updatedNode = nextNodes.find((n) => n.id === nodeId)
        if (updatedNode) {
          syncWorkflowV2NodeToProject(draft as Project, updatedNode, patch)
          // Nếu vừa đổi Nhãn Vật liệu, tự động cập nhật lại các Node Va chạm có liên kết với Layer này
          if (updatedNode.params?.logicCategory === 'material') {
            for (const cn of nextNodes) {
              if (cn.params?.logicCategory === 'collision') {
                syncWorkflowV2NodeToProject(draft as Project, cn)
              }
            }
          }
        }
      }, `wf-v2-param-${nodeId}`)
      if (patch.collapsedGroup !== undefined) {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('pxs:wf-fit-view')), 35)
      }
    },
    [workflow]
  )

  /** Chọn một Group Layer ở Sidebar bên trái -> Bung nhánh Group đó ra rõ nét */
  const handleFocusGroupNode = useCallback(
    (groupNodeId: string) => {
      setSelectedNodeId(groupNodeId)
      useEditor.getState().update((draft) => {
        const wf = draft.workflow ?? workflow
        const totalLayers = wf.nodes.filter(
          (n) => n.type === 'layer_assembly' && !n.params?.groupKind
        ).length
        const rawNodes = wf.nodes.map((n) => {
          if (!n.params?.groupKind) return n
          if (n.id === groupNodeId) {
            return { ...n, params: { ...n.params, collapsedGroup: false } }
          }
          if (totalLayers > 4) {
            return { ...n, params: { ...n.params, collapsedGroup: true } }
          }
          return n
        })
        draft.workflow = { ...wf, nodes: layoutWorkflowV2Tree(rawNodes, wf.edges) }
      }, 'wf-v2-focus-group')
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('pxs:wf-fit-view')), 35)
    },
    [workflow]
  )

  /** Gắn thêm hoặc tái sử dụng một Node Logic vào một Node Layer (có kiểm tra chống trùng logic) */
  const handleAttachLogicToLayer = useCallback(
    (
      layerNodeId: string,
      category: 'action' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio'
    ) => {
      const { workflow: nextWf, createdNodeId, reusedExisting, message } = attachLogicNodeToLayerV2(
        workflow,
        layerNodeId,
        category
      )
      if (!createdNodeId) {
        if (message) showToast(message)
        return
      }
      useEditor.getState().update((draft) => {
        draft.workflow = nextWf
        const targetNode = nextWf.nodes.find((n) => n.id === createdNodeId)
        if (targetNode) {
          syncWorkflowV2NodeToProject(draft as Project, targetNode)
        }
      }, 'wf-v2-attach-logic')
      setSelectedNodeId(createdNodeId)
      if (reusedExisting && message) {
        showToast(`ℹ️ ${message}`)
        return
      }
      const labelMap = {
        action: '🏃 Node Hành động',
        material: '🏷️ Node Nhãn Vật liệu',
        collision: '💥 Node Va chạm Vật lý (2 Layer)',
        light: '💡 Node Ánh sáng',
        cave: '🕳️ Node Hang động',
        fx: '✨ Node Hiệu ứng',
        audio: '🔊 Node Âm thanh'
      }
      showToast(`Đã gắn ${labelMap[category]} — chọn thẻ để chỉnh chi tiết & khoảng mốc thời gian!`)
    },
    [workflow, showToast]
  )

  /** Gắn nhanh Node Logic vào Layer đang chọn */
  const handleQuickSpawnForSelectedLayer = useCallback(
    (category: 'action' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio') => {
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

  /**
   * Kết nối dây giữa 2 Node:
   * - Kiểm tra nghiêm ngặt điều kiện hợp lệ & chống trùng logic bằng validateWorkflowV2Connection
   * - Cho phép tái sử dụng Node Logic (nhiều Layer kết nối chung vào 1 Node Logic hoặc 2 Layer kết nối vào 1 Node Va chạm)
   */
  const handleConnectNodes = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      const check = validateWorkflowV2Connection(workflow, fromNode, toNode)
      if (!check.valid) {
        showToast(`⚠️ ${check.reason ?? 'Kết nối không hợp lệ!'}`)
        return
      }
      const src = workflow.nodes.find((n) => n.id === fromNode)
      const dst = workflow.nodes.find((n) => n.id === toNode)
      if (!src || !dst) return

      const isDstLayerOrGroup = dst.type === 'layer_assembly' || dst.type === 'camera_director'
      // Nếu đích là Node Layer/Group thì thay thế cạnh cha cũ; nếu đích là Node Logic thì giữ nguyên các Layer đã nối để TÁI SỬ DỤNG NODE!
      const baseEdges = isDstLayerOrGroup
        ? workflow.edges.filter((e) => e.toNode !== toNode)
        : workflow.edges

      const nextEdges = [
        ...baseEdges,
        {
          id: `e-${fromNode}-${toNode}`,
          fromNode,
          fromPort,
          toNode,
          toPort
        }
      ]
      const syncedNodes = recomputeSharedLogicTargets(workflow.nodes, nextEdges)
      const laidOutNodes = layoutWorkflowV2Tree(syncedNodes, nextEdges)

      useEditor.getState().update((draft) => {
        draft.workflow = {
          ...workflow,
          nodes: laidOutNodes,
          edges: nextEdges
        }
        const updatedDst = laidOutNodes.find((n) => n.id === toNode)
        if (updatedDst) {
          syncWorkflowV2NodeToProject(draft as Project, updatedDst)
        }
      }, 'wf-v2-connect')

      const sharedCount =
        laidOutNodes.find((n) => n.id === toNode)?.params?.sharedLayerNodeIds?.length ?? 1
      if (!isDstLayerOrGroup && sharedCount > 1) {
        showToast(
          `🔗 Đã nối "${src.title}" vào "${dst.title}" (Đang tái sử dụng chung cho ${sharedCount} Layer!)`
        )
      } else {
        showToast(`🔗 Đã kết nối "${src.title}" ➔ "${dst.title}"`)
      }
    },
    [workflow, showToast]
  )

  const handleDisconnectEdge = useCallback(
    (edgeId: string) => {
      const nextEdges = workflow.edges.filter((e) => e.id !== edgeId)
      const syncedNodes = recomputeSharedLogicTargets(workflow.nodes, nextEdges)
      commitWorkflow({ ...workflow, nodes: syncedNodes, edges: nextEdges }, 'wf-v2-disconnect')
    },
    [workflow, commitWorkflow]
  )

  /** Áp dụng toàn bộ thông số và khoảng mốc thời gian trên Cây Workflow V2 vào Cảnh thực tế */
  const handleApplyAllToScene = useCallback(() => {
    useEditor.getState().update((draft) => {
      const wf = draft.workflow ?? workflow
      // Ưu tiên áp dụng Node Nhãn Vật liệu trước để Node Va chạm đọc đúng chất liệu biến dạng
      for (const n of wf.nodes) {
        if (n.params?.logicCategory !== 'collision') {
          syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }
      for (const n of wf.nodes) {
        if (n.params?.logicCategory === 'collision') {
          syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }
    }, 'wf-v2-apply-all')
    showToast('⚡ Đã áp dụng toàn bộ Cây Workflow, Nhãn Vật liệu & Va chạm Vật lý vào Cảnh 3D!')
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
            onClick={() => handleQuickSpawnForSelectedLayer('material')}
            title="Gắn Node Nhãn Vật liệu (Cao su, Gỗ, Đá, Lá...) để định hình biến dạng khi va chạm"
          >
            +🏷️ Vật liệu
          </button>
          <button
            type="button"
            className="wf-v2-tool-btn spawn-fx"
            onClick={() => handleQuickSpawnForSelectedLayer('collision')}
            title="Gắn Node Va chạm Vật lý kết nối 2 Layer (tự động tạo chuyển động lao tới, biến dạng & bật nảy)"
          >
            +💥 Va chạm
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
            className="wf-v2-tool-btn primary-apply"
            onClick={handleApplyAllToScene}
            title="Áp dụng toàn bộ logic, vật liệu, va chạm và khoảng mốc thời gian vào Cảnh"
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
                <div className="wf-v2-sec-title">1. NHÓM LAYER TRONG CẢNH ({groupNodes.length})</div>
                <div className="wf-v2-tree-list">
                  {groupNodes.map((g) => (
                    <div
                      key={g.id}
                      className={`wf-v2-tree-item ${selectedNodeId === g.id ? 'active' : ''}`}
                      onClick={() => handleFocusGroupNode(g.id)}
                      title="Nhấn để bung nhánh Group này ra rõ nét trên sơ đồ"
                    >
                      <span>{g.params?.groupKind === 'group_3d' ? '🧊' : g.params?.groupKind === 'group_env' ? '🌍' : '🗂️'}</span>
                      <span className="wf-v2-tree-name">{g.title.replace(/^Group\s+/i, '')}</span>
                      <span className="wf-v2-tree-count">
                        {g.params?.collapsedGroup ? `▸${g.params?.childLayerCount ?? 0}` : `▾${g.params?.childLayerCount ?? 0}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="wf-v2-sidebar-sec">
                <div className="wf-v2-sec-title">2. GẮN NODE LOGIC CHO LAYER</div>
                <div className="wf-v2-add-grid">
                  <button
                    type="button"
                    className="wf-v2-add-card action"
                    onClick={() => handleQuickSpawnForSelectedLayer('action')}
                  >
                    <span className="wf-v2-add-icon">🏃</span>
                    <div className="wf-v2-add-info">
                      <strong>Hành động</strong>
                      <small>Bay, đung đưa</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card light"
                    onClick={() => handleQuickSpawnForSelectedLayer('material')}
                  >
                    <span className="wf-v2-add-icon">🏷️</span>
                    <div className="wf-v2-add-info">
                      <strong>Nhãn Vật liệu</strong>
                      <small>Cao su, Gỗ, Đá</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card fx"
                    onClick={() => handleQuickSpawnForSelectedLayer('collision')}
                  >
                    <span className="wf-v2-add-icon">💥</span>
                    <div className="wf-v2-add-info">
                      <strong>Va chạm Vật lý</strong>
                      <small>Nối 2 Layer va đập</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card light"
                    onClick={() => handleQuickSpawnForSelectedLayer('light')}
                  >
                    <span className="wf-v2-add-icon">💡</span>
                    <div className="wf-v2-add-info">
                      <strong>Ánh sáng</strong>
                      <small>Đèn viền, nến</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card cave"
                    onClick={() => handleQuickSpawnForSelectedLayer('cave')}
                  >
                    <span className="wf-v2-add-icon">🕳️</span>
                    <div className="wf-v2-add-info">
                      <strong>Hang động</strong>
                      <small>Vòm độ sâu</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wf-v2-add-card fx"
                    onClick={() => handleQuickSpawnForSelectedLayer('fx')}
                  >
                    <span className="wf-v2-add-icon">✨</span>
                    <div className="wf-v2-add-info">
                      <strong>Hiệu ứng</strong>
                      <small>Đàn hồi, Bloom</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

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
