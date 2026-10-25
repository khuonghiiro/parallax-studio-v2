import { useCallback } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import { useEditor } from '../../store/editor'
import { useToast } from '../../actions'
import {
  attachLogicNodeToLayerV2,
  findFreeV2Spot,
  layoutWorkflowV2Tree,
  recomputeSharedLogicTargets,
  spawnWorkflowV2CameraWaypoint,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2CameraId,
  validateWorkflowV2Connection
} from '../../project/workflowV2Engine'
import {
  applyWorkflowV2PhysicsNodes,
  applyWorkflowV2ToProject,
  detachWorkflowV2NodeFromProject,
  logicCategoryOf,
  relayoutWorkflowV2
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

/** Mọi thao tác chỉnh cây Workflow V2 — đều ghi vào Project qua `update()` (có Undo) và đồng bộ xuống Layer thật */
export function useWorkflowV2Actions(workflow: WorkflowGraph, selectedNodeId: string | null, setSelectedNodeId: (id: string | null) => void) {
  const showToast = useToast((s) => s.show)

  const relayout = useCallback(
    (resetPins: boolean) => {
      useEditor.getState().update((draft) => {
        draft.workflow = relayoutWorkflowV2(useEditor.getState().project, resetPins)
      }, 'wf-v2-layout')
      fitSoon()
      showToast(resetPins ? 'Đã xếp lại toàn bộ không gian Workflow (bỏ ghim các thẻ kéo tay)' : 'Đã xếp lại cây')
    },
    [showToast]
  )

  /** Kéo thả thẻ: ghim vị trí mới, tự né sang chỗ trống gần nhất để không bao giờ đè lên thẻ khác */
  const moveNodes = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      let nodes = workflow.nodes
      for (const [id, pos] of Object.entries(positions)) {
        const spot = findFreeV2Spot(nodes, workflow.edges, id, pos)
        nodes = nodes.map((n) => (n.id === id ? { ...n, position: spot, params: { ...n.params, pinned: true } } : n))
      }
      useEditor.getState().update((draft) => {
        draft.workflow = { ...workflow, nodes }
      }, 'wf-v2-move')
    },
    [workflow]
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

  /** Xoá Node Logic hoặc mốc lộ trình quay phụ: gỡ dây, gỡ hẳn khỏi Layer / lộ trình Camera */
  const deleteNode = useCallback(
    (nodeId: string) => {
      const target = workflow.nodes.find((n) => n.id === nodeId)
      if (!target || !isDeletableV2Node(target)) return
      if (target.params?.isCameraWaypoint) {
        const parentCamId = target.params?.shotId ? v2CameraId(target.params.shotId) : null
        useEditor.getState().update((draft) => {
          detachWorkflowV2NodeFromProject(draft as Project, target)
          draft.workflow = syncWorkflowV2Graph(draft as Project, draft.workflow as WorkflowGraph, { relayout: true })
        }, 'wf-v2-delete-cam-wp')
        if (selectedNodeId === nodeId) setSelectedNodeId(parentCamId)
        showToast(`Đã xoá mốc lộ trình quay "${cleanV2NodeTitle(target.title)}"`)
        return
      }
      const edges = workflow.edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId)
      const synced = recomputeSharedLogicTargets(workflow.nodes.filter((n) => n.id !== nodeId), edges)
      useEditor.getState().update((draft) => {
        detachWorkflowV2NodeFromProject(draft as Project, target)
        draft.workflow = { ...workflow, nodes: layoutWorkflowV2Tree(synced, edges), edges }
        if (logicCategoryOf(target) === 'material') applyWorkflowV2PhysicsNodes(draft as Project, draft.workflow as WorkflowGraph)
      }, 'wf-v2-delete')
      if (selectedNodeId === nodeId) setSelectedNodeId(target.params?.sharedLayerNodeIds?.[0] ?? null)
      showToast(`Đã xoá "${cleanV2NodeTitle(target.title)}" và gỡ hiệu ứng khỏi Layer`)
    },
    [workflow, selectedNodeId, setSelectedNodeId, showToast]
  )

  const updateParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => {
      const relayoutNeeded = patch.collapsedGroup !== undefined
      useEditor.getState().update((draft) => {
        const raw = workflow.nodes.map((n) => (n.id === nodeId ? { ...n, title: nextTitle ?? n.title, params: { ...(n.params ?? {}), ...patch } } : n))
        const nodes = relayoutNeeded ? layoutWorkflowV2Tree(raw, workflow.edges) : raw
        draft.workflow = { ...workflow, nodes }
        const updated = nodes.find((n) => n.id === nodeId)
        if (!updated || relayoutNeeded) return
        syncWorkflowV2NodeToProject(draft as Project, updated, patch)
        if (updated.params?.isCameraWaypoint) {
          draft.workflow = syncWorkflowV2Graph(draft as Project, draft.workflow as WorkflowGraph)
          return
        }
        if (updated.params?.logicCategory === 'material') {
          for (const n of nodes) if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }, `wf-v2-param-${nodeId}`)
    },
    [workflow]
  )

  const spawnCameraWaypoint = useCallback(
    (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold' = 'zoom-in', fromWaypointTime?: number) => {
      let spawnedNodeId: string | null = null
      let spawnedLabel = ''
      let spawnedShotName = ''
      useEditor.getState().update((draft) => {
        const res = spawnWorkflowV2CameraWaypoint(draft as Project, shotId, mode, fromWaypointTime)
        const nextWf = syncWorkflowV2Graph(draft as Project, draft.workflow as WorkflowGraph, { relayout: true })
        draft.workflow = nextWf
        if (res) {
          spawnedLabel = res.displayLabel
          spawnedShotName = res.shotName
          const match = nextWf.nodes.find(
            (n) => n.params?.isCameraWaypoint && n.params?.shotId === shotId && Math.abs((n.params?.timeStart ?? -1) - res.nextTime) <= 0.08
          )
          spawnedNodeId = match?.id ?? null
        }
      }, 'wf-v2-spawn-cam-wp')
      if (spawnedNodeId) {
        setSelectedNodeId(spawnedNodeId)
        window.dispatchEvent(new CustomEvent('pxs:wf-focus-node', { detail: { nodeId: spawnedNodeId } }))
      }
      if (spawnedLabel) {
        showToast(`Đã thêm cảnh con #${spawnedLabel} vào lộ trình quay của "${spawnedShotName}"`)
      }
    },
    [setSelectedNodeId, showToast]
  )

  const attachLogic = useCallback(
    (layerNodeId: string, category: WorkflowV2SpawnCategory, presetId?: string) => {
      const res = attachLogicNodeToLayerV2(workflow, layerNodeId, category, presetId)
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
      showToast(res.message ?? `Đã gắn Node ${label} — chỉnh chi tiết ở bảng bên phải`)
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

  /** Gỡ dây Layer → Logic: gỡ hiệu ứng khỏi Layer vừa tách; Node còn Layer khác thì áp dụng lại đúng tập mới */
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

  return { relayout, moveNodes, toggleEnable, deleteNode, updateParams, attachLogic, spawnCameraWaypoint, connect, disconnect, applyAll }
}
