import { connectTimeNode, createTimeNode, isTimeNode } from '../../project/workflowTiming'
import { useCallback } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import { useEditor } from '../../store/editor'
import { useToast } from '../../actions'
import {
  attachExternalLayerToClusterV2,
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

/** Layer hoặc Khoá Cụm đích để gắn Node Logic: Layer / Khoá Cụm đang chọn, hoặc chủ của Node Logic đang chọn */
export function resolveV2SpawnTarget(workflow: WorkflowGraph, selectedNodeId: string | null): WorkflowNode | undefined {
  const sel = workflow.nodes.find((n) => n.id === selectedNodeId)
  if (!sel) return undefined
  if (resolveV2NodeLevel(sel) === 'layer' || sel.params?.logicCategory === 'cluster_lock') return sel
  const parentId = sel.params?.sharedLayerNodeIds?.[0] ?? sel.params?.hierarchyParentNodeId
  const parent = workflow.nodes.find((n) => n.id === parentId)
  return parent && (resolveV2NodeLevel(parent) === 'layer' || parent.params?.logicCategory === 'cluster_lock') ? parent : undefined
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
        const nodes = workflow.nodes.map((n) => {
          if (n.id !== nodeId) return n
          const nextEnabled = !n.enabled
          if (n.params?.logicCategory === 'cluster_lock') {
            return { ...n, enabled: nextEnabled, params: { ...n.params, lockedGroup: nextEnabled } }
          }
          return { ...n, enabled: nextEnabled }
        })
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
      useEditor.getState().update((draft) => {
        draft.workflow = { ...workflow, nodes: [...workflow.nodes], edges: [...workflow.edges] }
        if (isTimeNode(target)) {
          draft.workflow.edges = draft.workflow.edges.filter(e => e.fromNode !== target.id)
          for (const edge of workflow.edges.filter(e => e.fromNode === target.id)) {
            const consumer = draft.workflow.nodes.find(n => n.id === edge.toNode)
            if (consumer) syncWorkflowV2NodeToProject(draft as Project, consumer)
          }
        } else detachWorkflowV2NodeFromProject(draft as Project, target)
        const wfAfterDetach = draft.workflow as WorkflowGraph
        const edges = wfAfterDetach.edges.filter((e) => e.fromNode !== nodeId && e.toNode !== nodeId)
        const synced = recomputeSharedLogicTargets(wfAfterDetach.nodes.filter((n) => n.id !== nodeId), edges)
        draft.workflow = { ...wfAfterDetach, nodes: layoutWorkflowV2Tree(synced, edges), edges }
        if (logicCategoryOf(target) === 'material') applyWorkflowV2PhysicsNodes(draft as Project, draft.workflow as WorkflowGraph)
      }, 'wf-v2-delete')
      if (selectedNodeId === nodeId) setSelectedNodeId(target.params?.sharedLayerNodeIds?.[0] ?? null)
      showToast(`Đã xoá "${cleanV2NodeTitle(target.title)}" và gỡ hiệu ứng khỏi Layer`)
    },
    [workflow, selectedNodeId, setSelectedNodeId, showToast]
  )

  const updateParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => {
      const relayoutNeeded = patch.collapsedGroup !== undefined || patch.collapsedSubLayers !== undefined
      let scrubToSettled: number | null = null
      useEditor.getState().update((draft) => {
        const raw = workflow.nodes.map((n) => {
          if (n.id !== nodeId) return n
          const nextEnabled = patch.lockedGroup !== undefined && n.params?.logicCategory === 'cluster_lock' ? patch.lockedGroup : n.enabled
          return { ...n, enabled: nextEnabled, title: nextTitle ?? n.title, params: { ...(n.params ?? {}), ...patch } }
        })
        const nodes = relayoutNeeded ? layoutWorkflowV2Tree(raw, workflow.edges) : raw
        draft.workflow = { ...workflow, nodes }
        const updated = nodes.find((n) => n.id === nodeId)
        if (!updated || relayoutNeeded) return
        syncWorkflowV2NodeToProject(draft as Project, updated, patch)
        if (
          updated.params?.logicCategory === 'anim_fx' &&
          (updated.params.animFxPreset === 'popIn' || updated.params.animFxPreset === 'fadeIn')
        ) {
          const t0 = updated.params.timeStart ?? 0
          const t1 = updated.params.timeEnd ?? t0 + 0.5
          if (useEditor.getState().time <= t0 + 0.05) {
            scrubToSettled = Number(Math.min(draft.comp.duration || 5, Math.max(t0 + 0.35, t1)).toFixed(2))
          }
        }
        if (updated.params?.isCameraWaypoint) {
          draft.workflow = syncWorkflowV2Graph(draft as Project, draft.workflow as WorkflowGraph)
          return
        }
        if (updated.params?.logicCategory === 'material') {
          for (const n of nodes) if (n.params?.logicCategory === 'collision') syncWorkflowV2NodeToProject(draft as Project, n)
        }
      }, `wf-v2-param-${nodeId}`)
      if (scrubToSettled !== null) {
        useEditor.getState().setTime(scrubToSettled)
      }
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
    (
      layerNodeId: string,
      category: WorkflowV2SpawnCategory,
      presetId?: string,
      extraParams?: Partial<WorkflowNodeParams>,
      customTitle?: string
    ) => {
      const res = attachLogicNodeToLayerV2(workflow, layerNodeId, category, presetId, extraParams, customTitle)
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
      const label = customTitle ?? WORKFLOW_V2_SPAWN_CATALOG.find((c) => c.id === category)?.label ?? 'Logic'
      showToast(res.message ?? `Đã gắn Node ${label} — chỉnh chi tiết ở bảng bên phải`)
    },
    [workflow, setSelectedNodeId, showToast]
  )

  const connect = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      if (workflow.nodes.some(n => n.id === fromNode && isTimeNode(n))) {
        useEditor.getState().update(d => {
          d.workflow = connectTimeNode(workflow, fromNode, toNode)
          const target = d.workflow.nodes.find(n => n.id === toNode)!
          syncWorkflowV2NodeToProject(d as Project, target)
        })
        return
      }
      const check = validateWorkflowV2Connection(workflow, fromNode, toNode)
      if (!check.valid) {
        showToast(check.reason ?? 'Kết nối không hợp lệ')
        return
      }
      const src = workflow.nodes.find((n) => n.id === fromNode)
      const dst = workflow.nodes.find((n) => n.id === toNode)!
      const dstIsClusterLock = dst.params?.logicCategory === 'cluster_lock'
      const dstIsStructural = (resolveV2NodeLevel(dst) !== 'logic' || dst.type === 'camera_director') && !dstIsClusterLock
      const filtered = workflow.edges.filter((e) => {
        if (dstIsStructural && e.toNode === toNode) return false
        if (e.fromNode === fromNode && e.toNode === toNode) return false
        return true
      })
      const edges = [...filtered, { id: `e-${fromNode}-${toNode}`, fromNode, fromPort, toNode, toPort, disabled: false }]
      const nodes = layoutWorkflowV2Tree(recomputeSharedLogicTargets(workflow.nodes, edges), edges)
      const srcLayerIds = new Set(src?.params?.targetLayerIds ?? [])
      useEditor.getState().update((draft) => {
        if (dstIsClusterLock) {
          const targetClusterNode = nodes.find((n) => n.id === toNode)
          for (const l of draft.layers) {
            if (!srcLayerIds.has(l.id)) continue
            if (l.composite && l.composite.instanceId === dst.params?.instanceId) {
              l.composite.lockedGroup = true
            } else if (l.model3d && l.model3d.instanceId === dst.params?.instanceId) {
              l.model3d.lockedGroup = true
            } else if (targetClusterNode) {
              attachExternalLayerToClusterV2(draft as Project, [l.id], targetClusterNode)
            }
          }
        }
        draft.workflow = { ...workflow, nodes, edges }
        const updated = nodes.find((n) => n.id === toNode)
        if (updated && !dstIsClusterLock) syncWorkflowV2NodeToProject(draft as Project, updated)
      }, 'wf-v2-connect')
      if (dstIsClusterLock) {
        showToast(`Đã nối "${src?.title ?? 'Layer'}" vào Khoá Cụm — mảnh này được khoá theo cụm`)
        return
      }
      const shared = nodes.find((n) => n.id === toNode)?.params?.sharedLayerNodeIds?.length ?? 1
      showToast(shared > 1 && !dstIsStructural ? `Đã nối — Node đang dùng chung cho ${shared} Layer` : 'Đã kết nối')
    },
    [workflow, showToast]
  )

  /** Gỡ dây Layer → Khoá Cụm hoặc Layer/Khoá Cụm → Logic */
  const disconnect = useCallback(
    (edgeId: string) => {
      const edge = workflow.edges.find((e) => e.id === edgeId)
      const src = edge && workflow.nodes.find((n) => n.id === edge.fromNode)
      const dst = edge && workflow.nodes.find((n) => n.id === edge.toNode)
      if (!edge || !dst) return

      // Trường hợp 1: Gỡ dây từ Node Layer đến Node Khoá Cụm (`cluster_lock`) -> mở khoá riêng mảnh Layer đó
      if (edge.fromPort === 'time_range') {
        useEditor.getState().update(d => {
          d.workflow = { ...workflow, edges: workflow.edges.filter(e => e.id !== edgeId) }
          syncWorkflowV2NodeToProject(d as Project, dst)
        })
        return
      }
      if (dst.params?.logicCategory === 'cluster_lock') {
        const edges = workflow.edges.filter((e) => e.id !== edgeId)
        const synced = recomputeSharedLogicTargets(workflow.nodes, edges)
        const nodes = layoutWorkflowV2Tree(synced, edges)
        const srcLayerIds = new Set(src?.params?.targetLayerIds ?? [])
        useEditor.getState().update((draft) => {
          for (const l of draft.layers) {
            if (!srcLayerIds.has(l.id)) continue
            if (l.composite) l.composite.lockedGroup = false
            if (l.model3d) l.model3d.lockedGroup = false
          }
          draft.workflow = { ...workflow, nodes, edges }
        }, 'wf-v2-disconnect-cluster-member')
        showToast(`Đã ngắt dây "${src?.title ?? 'Layer'}" khỏi Khoá Cụm — mảnh này không còn khoá theo cụm`)
        return
      }

      if (!logicCategoryOf(dst)) return
      const edges = workflow.edges.filter((e) => e.id !== edgeId)
      const stillLinked = edges.some((e) => e.toNode === dst.id && !e.disabled)
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

  /** Bật / Tắt (Disable) một đường dây nối (Group -> Layer, Layer -> Khoá Cụm, hoặc Layer/Khoá Cụm -> Logic) */
  const toggleEdgeDisable = useCallback(
    (edgeId: string) => {
      const edge = workflow.edges.find((e) => e.id === edgeId)
      const src = edge && workflow.nodes.find((n) => n.id === edge.fromNode)
      const dst = edge && workflow.nodes.find((n) => n.id === edge.toNode)
      if (!edge || !src || !dst) return
      const nextDisabled = !edge.disabled
      const edges = workflow.edges.map((e) => (e.id === edgeId ? { ...e, disabled: nextDisabled } : e))
      if (edge.fromPort === 'time_range') {
        useEditor.getState().update(d => { d.workflow = { ...workflow, edges }; syncWorkflowV2NodeToProject(d as Project, dst) })
        return
      }
      const synced = recomputeSharedLogicTargets(workflow.nodes, edges)
      const nodes = layoutWorkflowV2Tree(synced, edges)
      const srcLayerIds = new Set(src.params?.targetLayerIds ?? [])
      const dstLayerIds = new Set(dst.params?.targetLayerIds ?? [])

      useEditor.getState().update((draft) => {
        if (dst.params?.logicCategory === 'cluster_lock') {
          for (const l of draft.layers) {
            if (!srcLayerIds.has(l.id)) continue
            if (l.composite) l.composite.lockedGroup = !nextDisabled
            if (l.model3d) l.model3d.lockedGroup = !nextDisabled
          }
        } else if (src.params?.groupKind && dst.type === 'layer_assembly') {
          for (const l of draft.layers) {
            if (dstLayerIds.has(l.id)) l.visible = !nextDisabled
          }
        } else if (logicCategoryOf(dst)) {
          detachWorkflowV2NodeFromProject(draft as Project, dst)
          const updated = nodes.find((n) => n.id === dst.id)
          const hasActiveEdge = edges.some((e) => e.toNode === dst.id && !e.disabled)
          if (hasActiveEdge && updated?.enabled) {
            syncWorkflowV2NodeToProject(draft as Project, updated)
          }
        }
        draft.workflow = { ...workflow, nodes, edges }
      }, 'wf-v2-toggle-edge')

      showToast(
        nextDisabled
          ? `Đã ngắt tạm (Disable) đường dây "${src.title} → ${cleanV2NodeTitle(dst.title)}"`
          : `Đã bật lại đường dây "${src.title} → ${cleanV2NodeTitle(dst.title)}"`
      )
    },
    [workflow, showToast]
  )

  const applyAll = useCallback(() => {
    useEditor.getState().update((draft) => {
      applyWorkflowV2ToProject(draft as Project, (draft.workflow as WorkflowGraph) ?? workflow)
    }, 'wf-v2-apply-all')
    showToast('Đã áp dụng toàn bộ cây Workflow vào cảnh')
  }, [workflow, showToast])

  const addTime = () => {
    const node = createTimeNode(useEditor.getState().project)
    node.position = findFreeV2Spot(workflow.nodes, workflow.edges, node.id, node.position)
    useEditor.getState().update(d => { d.workflow = { ...workflow, nodes: [...workflow.nodes, node] } })
    setSelectedNodeId(node.id)
    useEditor.getState().setInspectorTab('node')
    fitSoon()
  }

  return {
    addTime,
    relayout,
    moveNodes,
    toggleEnable,
    deleteNode,
    updateParams,
    attachLogic,
    spawnCameraWaypoint,
    connect,
    disconnect,
    toggleEdgeDisable,
    applyAll
  }
}
