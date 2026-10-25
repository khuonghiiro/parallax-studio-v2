import { useCallback, useEffect, useMemo } from 'react'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { computeShotRoute, v2RootId } from '../../project/workflowV2Engine'
import { resolveWorkflowV2 } from '../../project/workflowV2Rebuild'
import { resolveV2SpawnTarget, useWorkflowV2Actions } from './useWorkflowV2Actions'
import { resolveV2NodeLevel } from './workflowV2Theme'

export const focusWorkflowCluster = (rootId: string): void => {
  window.dispatchEvent(new CustomEvent('pxs:wf-focus-cluster', { detail: { rootId } }))
}

/** Cảnh camera đang quay tại mốc `t` theo lộ trình camera (cùng nguồn với dải "Cảnh đang quay" của Timeline) */
export function useActiveShotId(): string | null {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const route = useMemo(() => computeShotRoute(project), [project])
  return useMemo(() => {
    for (const shot of route.order) {
      const r = route.ranges.get(shot.id)
      if (r && time >= r.start - 1e-3 && time <= r.end + 1e-3) return shot.id
    }
    return null
  }, [route, time])
}

/**
 * Bộ điều khiển chung cho Workflow V2 & Bảng Thuộc tính Node / JSON Cảnh & Main.
 * Hoạt động đồng nhất ở cả chế độ Timeline lẫn Workflow Studio.
 */
export function useWorkflowV2Controller() {
  const project = useEditor((s) => s.project)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedNodeId = useEditor((s) => s.selectedWorkflowNodeId)
  const focusedShotId = useEditor((s) => s.focusedWorkflowShotId)
  const playing = useEditor((s) => s.playing)
  const currentTime = useEditor((s) => (Number.isFinite(s.time) ? s.time : 0))
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setSelectedNodeId = useEditor((s) => s.setSelectedWorkflowNodeId)
  const setFocusedShotId = useEditor((s) => s.setFocusedWorkflowShotId)

  const workflow = useMemo(() => resolveWorkflowV2(project), [project])
  const route = useMemo(() => computeShotRoute(project), [project])
  const shotItems = useMemo(
    () => route.order.map((shot) => ({ shot, index: project.shots.findIndex((s) => s.id === shot.id) })),
    [route.order, project.shots]
  )
  const activeShotId = useActiveShotId()

  const activateNode = useCallback(
    (id: string | null, panWorkflowCanvas = false, focusInspectorNodeTab = false) => {
      setSelectedNodeId(id)
      if (!id) return
      if (panWorkflowCanvas) {
        window.dispatchEvent(new CustomEvent('pxs:wf-focus-node', { detail: { nodeId: id } }))
      }
      const st = useEditor.getState()
      if (focusInspectorNodeTab && st.inspectorTab !== 'json') {
        st.setInspectorTab('node')
      }
      const node = workflow.nodes.find((n) => n.id === id)
      if (!node) return
      const level = resolveV2NodeLevel(node)
      const repLayerId = node.params?.targetLayerIds?.[0] ?? null
      const shotId =
        node.params?.shotId ??
        (repLayerId ? st.project.layers.find((l) => l.id === repLayerId)?.shotId : null) ??
        null

      if (shotId) setFocusedShotId(shotId)

      if (node.type === 'camera_director' && node.params?.isCameraWaypoint) {
        if (st.playing) st.setPlaying(false)
        if (shotId) st.selectShot(shotId)
        if (typeof node.params?.timeStart === 'number') st.setTime(node.params.timeStart)
        if (shotId) useView.getState().requestFocus('shot', shotId)
        return
      }

      if ((level === 'layer' || (level === 'logic' && node.type !== 'camera_director')) && repLayerId) {
        st.selectLayer(repLayerId)
        const shotRange = shotId ? route.ranges.get(shotId) : undefined
        const tStart = node.params?.timeStart ?? shotRange?.start ?? 0
        const tEnd = node.params?.timeEnd ?? shotRange?.end ?? st.project.comp.duration
        const effStart = shotRange ? Math.max(tStart, shotRange.start) : tStart
        const effEnd = shotRange ? Math.min(tEnd, shotRange.end) : tEnd
        if (!st.playing && (st.time < effStart - 0.02 || st.time > effEnd + 0.02)) {
          st.setTime(effStart <= effEnd ? effStart : (shotRange?.start ?? tStart))
        }
        useView.getState().requestFocus('layer', repLayerId)
        return
      }

      if (shotId) {
        st.selectShot(shotId)
        const shotRange = route.ranges.get(shotId)
        if (!st.playing && shotRange && (st.time < shotRange.start - 0.02 || st.time > shotRange.end + 0.02)) {
          st.setTime(shotRange.start)
        }
        useView.getState().requestFocus('shot', shotId)
      }
    },
    [workflow.nodes, route.ranges, setSelectedNodeId, setFocusedShotId]
  )

  const selectNode = useCallback(
    (id: string | null) => activateNode(id, true, false),
    [activateNode]
  )

  const handleFocusShot = useCallback(
    (shotId: string | null, rootId?: string, follow = false): void => {
      setFocusedShotId(shotId)
      if (!shotId) {
        window.dispatchEvent(new CustomEvent('pxs:wf-fit-view', { detail: { all: !rootId } }))
        if (rootId) focusWorkflowCluster(rootId)
        return
      }
      const r = route.ranges.get(shotId)
      if (r && !follow) setTime(r.start)
      focusWorkflowCluster(rootId ?? v2RootId(shotId))
    },
    [route.ranges, setFocusedShotId, setTime]
  )

  const actions = useWorkflowV2Actions(workflow, selectedNodeId, setSelectedNodeId)
  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null
  const spawnTarget = resolveV2SpawnTarget(workflow, selectedNodeId)

  return {
    project,
    workflow,
    route,
    shotItems,
    activeShotId,
    selectedShotId,
    selectedLayerId,
    selectedNodeId,
    selectedNode,
    focusedShotId,
    spawnTarget,
    playing,
    currentTime,
    setTime,
    setPlaying,
    setSelectedNodeId,
    setFocusedShotId,
    activateNode,
    selectNode,
    handleFocusShot,
    actions
  }
}

/**
 * Tự động đồng bộ lựa chọn Layer / Cảnh / Sự kiện Node với `selectedWorkflowNodeId`
 * ngay cả khi đang ở chế độ Timeline (không mở tab Workflow).
 */
export function useWorkflowV2SelectionSync(ctrl: ReturnType<typeof useWorkflowV2Controller>): void {
  const {
    workflow,
    selectedLayerId,
    selectedShotId,
    selectedNodeId,
    activateNode,
    setSelectedNodeId,
    setFocusedShotId
  } = ctrl

  useEffect(() => {
    const onSelect = (e: Event): void => {
      const detail = (e as CustomEvent<{ nodeId?: string; openInspector?: boolean }>).detail
      if (detail?.nodeId) {
        activateNode(detail.nodeId, true, detail.openInspector ?? true)
      }
    }
    window.addEventListener('pxs:select-workflow-v2-node', onSelect)
    return () => window.removeEventListener('pxs:select-workflow-v2-node', onSelect)
  }, [activateNode])

  // Chọn Layer ở Timeline / Viewport → chọn Node Layer tương ứng (trừ khi Node hiện tại đã gắn với Layer đó)
  useEffect(() => {
    if (!selectedLayerId) return
    const prevNode = selectedNodeId ? workflow.nodes.find((n) => n.id === selectedNodeId) : undefined
    if (prevNode?.params?.targetLayerIds?.includes(selectedLayerId)) return
    const node = workflow.nodes.find(
      (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(selectedLayerId)
    )
    if (node) setSelectedNodeId(node.id)
  }, [selectedLayerId, selectedNodeId, workflow.nodes, setSelectedNodeId])

  // Chọn Cảnh ở Timeline / Shots panel → đồng bộ focusedShotId và chọn Root Cảnh nếu chưa chọn Layer
  useEffect(() => {
    if (!selectedShotId) return
    setFocusedShotId(selectedShotId)
    window.setTimeout(() => focusWorkflowCluster(v2RootId(selectedShotId)), 60)
    if (!selectedLayerId) {
      const prevNode = selectedNodeId ? workflow.nodes.find((n) => n.id === selectedNodeId) : undefined
      if (prevNode?.params?.shotId === selectedShotId) return
      const rootNode = workflow.nodes.find((n) => n.id === v2RootId(selectedShotId))
      if (rootNode) setSelectedNodeId(rootNode.id)
    }
  }, [selectedShotId, selectedLayerId, selectedNodeId, workflow.nodes, setFocusedShotId, setSelectedNodeId])
}
