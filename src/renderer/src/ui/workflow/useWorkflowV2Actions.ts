import { useCallback } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import { useEditor } from '../../store/editor'
import { useToast } from '../../actions'
import {
  attachLogicNodeToLayerV2,
  layoutWorkflowV2Tree,
  recomputeSharedLogicTargets,
  syncWorkflowV2NodeToProject,
  validateWorkflowV2Connection
} from '../../project/workflowV2Engine'
import {
  applyWorkflowV2PhysicsNodes,
  applyWorkflowV2ToProject,
  detachWorkflowV2NodeFromProject,
  logicCategoryOf,
  rebuildWorkflowV2PreservingLogic
} from '../../project/workflowV2Rebuild'
import { isDeletableV2Node } from './WorkflowNodeCardV2'
import { WORKFLOW_V2_SPAWN_CATALOG, cleanV2NodeTitle, resolveV2NodeLevel, type WorkflowV2SpawnCategory } from './workflowV2Theme'

const fitSoon = (delay = 40): void => {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('pxs:wf-fit-view')), delay)
}

/** Layer đích để gắn Node Logic: Layer đang chọn, hoặc Layer chủ của Node Logic đang chọn */
export function resolveV2SpawnTarget(workflow: WorkflowGraph, selectedNodeId: string | null): WorkflowNode | undefined {
  const sel = workflow.nodes.find((n) => n.id === selectedNodeId)
  if (!sel) return undefined
  if (resolveV2NodeLevel(sel) === 'layer') return sel
  const parentId = sel.params?.sharedLayerNodeIds?.[0] ?? sel.params?.hierarchyParentNodeId
  const parent = workflow.nodes.find((n) => n.id === parentId)
  return parent && resolveV2NodeLevel(parent) === 'layer' ? parent : undefined
}

export function useWorkflowV2Actions(
  workflow: WorkflowGraph,
  scope: string,
  selectedNodeId: string | null,
  setSelectedNodeId: (id: string | null) => void
) {
  const showToast = useToast((s) => s.show)

  const commit = useCallback((next: WorkflowGraph, mergeKey: string) => {
    useEditor.getState().update((draft) => {
      draft.workflow = next
    }, mergeKey)
  }, [])

  const rebuild = useCallback(() => {
    const { project } = useEditor.getState()
    const next = rebuildWorkflowV2PreservingLogic(project, scope, project.workflow)
    useEditor.getState().update((draft) => {
      draft.workflow = next
      applyWorkflowV2PhysicsNodes(draft as Project, next)
    }, 'wf-v2-rebuild')
    setSelectedNodeId('v2-root-scene')
    fitSoon()
    showToast('Đã đồng bộ cây Workflow với Cảnh & Layer hiện tại (giữ nguyên Node Logic đã cấu hình)')
  }, [scope, setSelectedNodeId, showToast])

  const autoLayout = useCallback(() => {
    const synced = recomputeSharedLogicTargets(workflow.nodes, workflow.edges)
    commit({ ...workflow, nodes: layoutWorkflowV2Tree(synced, workflow.edges) }, 'wf-v2-layout')
    fitSoon()
  }, [workflow, commit])

  const moveNodes = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      commit({ ...workflow, nodes: workflow.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id] } : n)) }, 'wf-v2-move')
    },
    [workflow, commit]
  )

  const toggleEnable = useCallback(
    (nodeId: string) => {
      useEditor.getState().update((draft) => {
        const nodes = workflow.nodes.map((n) => (n.id === nodeId ? { ...n, enabled: !n.enabled } : n))
        draft.workflow = { ...workflow, nodes }
        const toggled = nodes.find((n) => n.id === nodeId)
        if (toggled) syncWorkflowV2NodeToProject(draft as Project, toggled)
      }, 'wf-v2-toggle')
    },
    [workflow]
  )

  /** Xoá Node Logic: gỡ dây, gỡ hiệu ứng khỏi Layer và xếp lại cây */
  const deleteNode = useCallback(
    (nodeId: string) => {
      const target = workflow.nodes.find((n) => n.id === nodeId)
      if (!target || !isDeletableV2Node(target)) return
      const edges = workflow.edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId)
      const synced = recomputeSharedLogicTargets(workflow.nodes.filter((n) => n.id !== nodeId), edges)
      useEditor.getState().update((draft) => {
        detachWorkflowV2NodeFromProject(draft as Project, target)
        draft.workflow = { ...workflow, nodes: layoutWorkflowV2Tree(synced, edges), edges }
        // Va chạm đọc chất liệu từ Node Vật liệu → xoá Vật liệu thì tính lại các Va chạm liên quan
        if (logicCategoryOf(target) === 'material') applyWorkflowV2PhysicsNodes(draft as Project, draft.workflow as WorkflowGraph)
      }, 'wf-v2-delete')
      if (selectedNodeId === nodeId) setSelectedNodeId(target.params?.sharedLayerNodeIds?.[0] ?? 'v2-root-scene')
      showToast(`Đã xoá "${cleanV2NodeTitle(target.title)}" và gỡ hiệu ứng khỏi Layer`)
    },
    [workflow, selectedNodeId, setSelectedNodeId, showToast]
  )

  const updateParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => {
      const relayout = patch.collapsedGroup !== undefined
      useEditor.getState().update((draft) => {
        const raw = workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, title: nextTitle ?? n.title, params: { ...(n.params ?? {}), ...patch } } : n
        )
        const nodes = relayout ? layoutWorkflowV2Tree(raw, workflow.edges) : raw
        draft.workflow = { ...workflow, nodes }
        const updated = nodes.find((n) => n.id === nodeId)
        if (!updated || relayout) return
        syncWorkflowV2NodeToProject(draft as Project, updated, patch)
        if (updated.params?.logicCategory === 'material') {
          for (const n of nodes) if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }, `wf-v2-param-${nodeId}`)
      if (relayout) fitSoon(35)
    },
    [workflow]
  )

  const attachLogic = useCallback(
    (layerNodeId: string, category: WorkflowV2SpawnCategory) => {
      const res = attachLogicNodeToLayerV2(workflow, layerNodeId, category)
      if (!res.createdNodeId) {
        if (res.message) showToast(res.message)
        return
      }
      useEditor.getState().update((draft) => {
        draft.workflow = res.workflow
        const created = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
        if (created) syncWorkflowV2NodeToProject(draft as Project, created)
      }, 'wf-v2-attach-logic')
      setSelectedNodeId(res.createdNodeId)
      window.dispatchEvent(new CustomEvent('pxs:wf-focus-node', { detail: { nodeId: res.createdNodeId } }))
      const label = WORKFLOW_V2_SPAWN_CATALOG.find((c) => c.id === category)?.label ?? 'Logic'
      showToast(res.reusedExisting && res.message ? res.message : `Đã gắn Node ${label} — chỉnh chi tiết ở bảng bên phải`)
    },
    [workflow, setSelectedNodeId, showToast]
  )

  const connect = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      const check = validateWorkflowV2Connection(workflow, fromNode, toNode)
      if (!check.valid) {
        showToast(check.reason ?? 'Kết nối không hợp lệ')
        return
      }
      const dst = workflow.nodes.find((n) => n.id === toNode)!
      const dstIsStructural = resolveV2NodeLevel(dst) !== 'logic' || dst.type === 'camera_director'
      const base = dstIsStructural ? workflow.edges.filter((e) => e.toNode !== toNode) : workflow.edges
      const edges = [...base, { id: `e-${fromNode}-${toNode}`, fromNode, fromPort, toNode, toPort }]
      const nodes = layoutWorkflowV2Tree(recomputeSharedLogicTargets(workflow.nodes, edges), edges)
      useEditor.getState().update((draft) => {
        draft.workflow = { ...workflow, nodes, edges }
        const updated = nodes.find((n) => n.id === toNode)
        if (updated) syncWorkflowV2NodeToProject(draft as Project, updated)
      }, 'wf-v2-connect')
      const shared = nodes.find((n) => n.id === toNode)?.params?.sharedLayerNodeIds?.length ?? 1
      showToast(shared > 1 && !dstIsStructural ? `Đã nối — Node đang dùng chung cho ${shared} Layer` : 'Đã kết nối')
    },
    [workflow, showToast]
  )

  /** Gỡ dây Layer → Logic: gỡ hiệu ứng khỏi Layer vừa tách, Node còn Layer khác thì áp dụng lại cho đúng tập mới */
  const disconnect = useCallback(
    (edgeId: string) => {
      const edge = workflow.edges.find((e) => e.id === edgeId)
      const dst = edge && workflow.nodes.find((n) => n.id === edge.toNode)
      if (!edge || !dst || !logicCategoryOf(dst)) return
      const edges = workflow.edges.filter((e) => e.id !== edgeId)
      const stillLinked = edges.some((e) => e.toNode === dst.id)
      const synced = recomputeSharedLogicTargets(workflow.nodes, edges).map((n) =>
        n.id === dst.id && !stillLinked ? { ...n, params: { ...n.params, targetLayerIds: [], sharedLayerNodeIds: [] } } : n
      )
      const nodes = layoutWorkflowV2Tree(synced, edges)
      useEditor.getState().update((draft) => {
        detachWorkflowV2NodeFromProject(draft as Project, dst)
        draft.workflow = { ...workflow, nodes, edges }
        const updated = nodes.find((n) => n.id === dst.id)
        if (stillLinked && updated?.enabled) syncWorkflowV2NodeToProject(draft as Project, updated)
      }, 'wf-v2-disconnect')
      showToast(stillLinked ? 'Đã gỡ dây nối' : 'Đã gỡ dây — Node chưa nối Layer nào nên tạm không có hiệu lực')
    },
    [workflow, showToast]
  )

  const applyAll = useCallback(() => {
    useEditor.getState().update((draft) => {
      applyWorkflowV2ToProject(draft as Project, (draft.workflow as WorkflowGraph) ?? workflow)
    }, 'wf-v2-apply-all')
    showToast('Đã áp dụng toàn bộ cây Workflow vào cảnh')
  }, [workflow, showToast])

  return { rebuild, autoLayout, moveNodes, toggleEnable, deleteNode, updateParams, attachLogic, connect, disconnect, applyAll }
}
