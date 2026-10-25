import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { computeShotRoute, v2RootId } from '../../project/workflowV2Engine'
import { resolveWorkflowV2 } from '../../project/workflowV2Rebuild'
import { WorkflowCanvasV2 } from './WorkflowCanvasV2'
import { WorkflowV2Inspector } from './WorkflowV2Inspector'
import { WorkflowV2Sidebar } from './WorkflowV2Sidebar'
import { WorkflowV2Toolbar } from './WorkflowV2Toolbar'
import { resolveV2SpawnTarget, useWorkflowV2Actions } from './useWorkflowV2Actions'
import { resolveV2NodeLevel } from './workflowV2Theme'

const SIDEBAR_KEY = 'pxs:wf-v2-sidebar-collapsed'
const FOLLOW_KEY = 'pxs:wf-v2-follow-shot'
const JSON_MODE_KEY = 'pxs:wf-v2-json-mode'

const focusCluster = (rootId: string): void => {
  window.dispatchEvent(new CustomEvent('pxs:wf-focus-cluster', { detail: { rootId } }))
}

/** Cảnh camera đang quay tại mốc `t` theo lộ trình camera (cùng nguồn với dải "Cảnh đang quay" của Timeline) */
function useActiveShotId(): string | null {
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
 * Workflow Studio V2: MỘT không gian chung cho toàn dự án (mỗi cảnh là một cụm, nối nhau bằng dây Camera).
 * Đồ thị được suy ra từ dữ liệu thật nên luôn khớp với Timeline; Timeline ghi lại đồ thị đã đồng bộ (không tạo bước Undo).
 */
export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const playing = useEditor((s) => s.playing)
  const currentTime = useEditor((s) => (Number.isFinite(s.time) ? s.time : 0))
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [follow, setFollow] = useState(() => localStorage.getItem(FOLLOW_KEY) !== '0')
  const [jsonMode, setJsonMode] = useState(() => localStorage.getItem(JSON_MODE_KEY) === '1')
  const [focusedShotId, setFocusedShotId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const workflow = useMemo(() => resolveWorkflowV2(project), [project])
  const route = useMemo(() => computeShotRoute(project), [project])
  const shotItems = useMemo(
    () => route.order.map((shot) => ({ shot, index: project.shots.findIndex((s) => s.id === shot.id) })),
    [route.order, project.shots]
  )
  const activeShotId = useActiveShotId()

  const activateNode = useCallback(
    (id: string | null, panWorkflowCanvas = false) => {
      setSelectedNodeId(id)
      if (!id) return
      if (panWorkflowCanvas) {
        window.dispatchEvent(new CustomEvent('pxs:wf-focus-node', { detail: { nodeId: id } }))
      }
      const st = useEditor.getState()
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
    [workflow.nodes, route.ranges]
  )

  const selectNode = useCallback(
    (id: string | null) => activateNode(id, true),
    [activateNode]
  )

  useEffect(() => {
    const onSelect = (e: Event): void => {
      const id = (e as CustomEvent<{ nodeId?: string }>).detail?.nodeId
      if (id) selectNode(id)
    }
    window.addEventListener('pxs:select-workflow-v2-node', onSelect)
    return () => window.removeEventListener('pxs:select-workflow-v2-node', onSelect)
  }, [selectNode])

  // Chọn Layer ở Timeline / Viewport → chọn Node Layer tương ứng (trừ khi Node hiện tại đã gắn với Layer đó)
  useEffect(() => {
    if (!selectedLayerId) return
    setSelectedNodeId((prevId) => {
      const prevNode = prevId ? workflow.nodes.find((n) => n.id === prevId) : undefined
      if (prevNode?.params?.targetLayerIds?.includes(selectedLayerId)) return prevId
      const node = workflow.nodes.find((n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(selectedLayerId))
      return node ? node.id : prevId
    })
  }, [selectedLayerId, workflow.nodes])
  useEffect(() => {
    if (!selectedShotId) return
    setFocusedShotId(selectedShotId)
    window.setTimeout(() => focusCluster(v2RootId(selectedShotId)), 60)
  }, [selectedShotId])
  useEffect(() => {
    if (follow && activeShotId) setFocusedShotId(activeShotId)
  }, [follow, activeShotId])

  const actions = useWorkflowV2Actions(workflow, selectedNodeId, setSelectedNodeId)
  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null
  const spawnTarget = resolveV2SpawnTarget(workflow, selectedNodeId)
  const stats = useMemo(
    () => ({
      shots: project.shots.length,
      layers: workflow.nodes.filter((n) => resolveV2NodeLevel(n) === 'layer').length,
      logic: workflow.nodes.filter((n) => resolveV2NodeLevel(n) === 'logic' && n.type !== 'camera_director').length
    }),
    [workflow.nodes, project.shots.length]
  )

  const handleFocusShot = (shotId: string | null, rootId?: string): void => {
    setFocusedShotId(shotId)
    if (!shotId) {
      window.dispatchEvent(new CustomEvent('pxs:wf-fit-view', { detail: { all: !rootId } }))
      if (rootId) focusCluster(rootId)
      return
    }
    const r = route.ranges.get(shotId)
    if (r && !follow) setTime(r.start)
    focusCluster(rootId ?? v2RootId(shotId))
  }

  const toggle = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>, on: string, off: string) => () =>
    setter((c) => {
      localStorage.setItem(key, c ? off : on)
      return !c
    })

  const handleSetJsonMode = (next: boolean): void => {
    localStorage.setItem(JSON_MODE_KEY, next ? '1' : '0')
    setJsonMode(next)
  }

  return (
    <div className="wf-studio-panel wf-v2-studio" data-mcp-region="timeline_workflow">
      <WorkflowV2Toolbar
        layerCount={project.layers.length}
        enabledNodeCount={workflow.nodes.filter((n) => n.enabled).length}
        totalNodeCount={workflow.nodes.length}
        stats={stats}
        shots={shotItems}
        activeShotId={activeShotId}
        focusedShotId={focusedShotId}
        jsonMode={jsonMode}
        onFocusShot={(id) => handleFocusShot(id)}
        onToggleJsonMode={toggle(JSON_MODE_KEY, setJsonMode, '1', '0')}
        onRelayout={() => actions.relayout(true)}
        onApplyAll={actions.applyAll}
      />
      <div className="wf-v2-body">
        <WorkflowV2Sidebar
          workflow={workflow}
          collapsed={sidebarCollapsed}
          selectedNodeId={selectedNodeId}
          activeShotId={activeShotId}
          spawnTarget={spawnTarget}
          onToggleCollapsed={toggle(SIDEBAR_KEY, setSidebarCollapsed, '1', '0')}
          onSelectNode={selectNode}
          onFocusShot={(shotId, rootId) => {
            setSelectedNodeId(rootId)
            handleFocusShot(shotId, rootId)
          }}
          onToggleGroup={(id, collapsed) => actions.updateParams(id, { collapsedGroup: collapsed })}
          onSpawn={(cat) => spawnTarget && actions.attachLogic(spawnTarget.id, cat)}
        />
        <WorkflowCanvasV2
          workflow={workflow}
          project={project}
          currentTime={currentTime}
          playing={playing}
          activeShotId={activeShotId}
          follow={follow}
          onToggleFollow={toggle(FOLLOW_KEY, setFollow, '1', '0')}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => activateNode(id, false)}
          onSetTime={setTime}
          onTogglePlay={() => setPlaying(!playing)}
          onMoveNodes={actions.moveNodes}
          onToggleNodeEnable={actions.toggleEnable}
          onDeleteNode={actions.deleteNode}
          onUpdateNodeParams={actions.updateParams}
          onAttachLogicToLayer={actions.attachLogic}
          onConnectNodes={actions.connect}
          onDisconnectEdge={actions.disconnect}
        />
        <WorkflowV2Inspector
          workflow={workflow}
          project={project}
          node={selectedNode}
          currentTime={currentTime}
          shots={shotItems}
          activeShotId={activeShotId}
          focusedShotId={focusedShotId}
          jsonMode={jsonMode}
          onSetJsonMode={handleSetJsonMode}
          onSelectShotFocus={(shotId) => handleFocusShot(shotId)}
          onUpdateParams={actions.updateParams}
          onToggleEnable={actions.toggleEnable}
          onDeleteNode={actions.deleteNode}
          onAttachLogic={actions.attachLogic}
          onSpawnCameraWaypoint={actions.spawnCameraWaypoint}
          onSelectNode={selectNode}
          onConnectLayer={(layerNodeId, logicNodeId) => actions.connect(layerNodeId, 'layers_tree', logicNodeId, 'layers_tree')}
          onScrubTime={setTime}
        />
      </div>
    </div>
  )
}
