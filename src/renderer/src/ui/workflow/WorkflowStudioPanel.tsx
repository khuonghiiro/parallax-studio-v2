import React, { useEffect, useMemo, useState } from 'react'
import { useEditor } from '../../store/editor'
import { WorkflowCanvasV2 } from './WorkflowCanvasV2'
import { WorkflowV2Sidebar } from './WorkflowV2Sidebar'
import { WorkflowV2Toolbar } from './WorkflowV2Toolbar'
import { useWorkflowV2Controller } from './useWorkflowV2Controller'
import { resolveV2NodeLevel } from './workflowV2Theme'

const SIDEBAR_KEY = 'pxs:wf-v2-sidebar-collapsed'
const FOLLOW_KEY = 'pxs:wf-v2-follow-shot'

/**
 * Workflow Studio V2: MỘT không gian chung cho toàn dự án (mỗi cảnh là một cụm, nối nhau bằng dây Camera).
 * Đồ thị được suy ra từ dữ liệu thật nên luôn khớp với Timeline; Timeline ghi lại đồ thị đã đồng bộ (không tạo bước Undo).
 * Bảng Thuộc tính Node & JSON Cảnh & Main được hợp nhất sang cột phải (Inspector) dùng chung cho cả Timeline và Workflow.
 */
export const WorkflowStudioPanel: React.FC = () => {
  const inspectorTab = useEditor((s) => s.inspectorTab)
  const setInspectorTab = useEditor((s) => s.setInspectorTab)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [follow, setFollow] = useState(() => localStorage.getItem(FOLLOW_KEY) !== '0')

  const ctrl = useWorkflowV2Controller()
  const {
    project,
    workflow,
    shotItems,
    activeShotId,
    selectedNodeId,
    focusedShotId,
    spawnTarget,
    playing,
    currentTime,
    setTime,
    setPlaying,
    setSelectedNodeId,
    setFocusedShotId,
    activateNode,
    handleFocusShot,
    actions
  } = ctrl

  useEffect(() => {
    if (follow && activeShotId) setFocusedShotId(activeShotId)
  }, [follow, activeShotId, setFocusedShotId])

  const stats = useMemo(
    () => ({
      shots: project.shots.length,
      layers: workflow.nodes.filter((n) => resolveV2NodeLevel(n) === 'layer').length,
      logic: workflow.nodes.filter((n) => resolveV2NodeLevel(n) === 'logic' && n.type !== 'camera_director').length
    }),
    [workflow.nodes, project.shots.length]
  )

  const toggle = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>, on: string, off: string) => () =>
    setter((c) => {
      localStorage.setItem(key, c ? off : on)
      return !c
    })

  const jsonMode = inspectorTab === 'json'
  const handleToggleJsonMode = (): void => {
    setInspectorTab(jsonMode ? 'node' : 'json')
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
        onFocusShot={(id) => handleFocusShot(id, undefined, follow)}
        onToggleJsonMode={handleToggleJsonMode}
        onRelayout={() => actions.relayout(true)}
        onApplyAll={actions.applyAll}
        onAddTime={actions.addTime}
      />
      <div className="wf-v2-body">
        <WorkflowV2Sidebar
          workflow={workflow}
          project={project}
          collapsed={sidebarCollapsed}
          selectedNodeId={selectedNodeId}
          activeShotId={activeShotId}
          spawnTarget={spawnTarget}
          onToggleCollapsed={toggle(SIDEBAR_KEY, setSidebarCollapsed, '1', '0')}
          onSelectNode={(id) => activateNode(id, true, true)}
          onFocusShot={(shotId, rootId) => {
            setSelectedNodeId(rootId)
            handleFocusShot(shotId, rootId, follow)
          }}
          onToggleGroup={(id, collapsed) => actions.updateParams(id, { collapsedGroup: collapsed })}
          onSpawn={(cat, presetId, extraParams, customTitle) => {
            if (spawnTarget) {
              actions.attachLogic(spawnTarget.id, cat, presetId, extraParams, customTitle)
              if (inspectorTab !== 'json') setInspectorTab('node')
            }
          }}
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
          onSelectNode={(id) => activateNode(id, false, true)}
          onSetTime={setTime}
          onTogglePlay={() => setPlaying(!playing)}
          onMoveNodes={actions.moveNodes}
          onToggleNodeEnable={actions.toggleEnable}
          onDeleteNode={actions.deleteNode}
          onUpdateNodeParams={actions.updateParams}
          onAttachLogicToLayer={(layerNodeId, cat, presetId, extraParams, customTitle) => {
            actions.attachLogic(layerNodeId, cat, presetId, extraParams, customTitle)
            if (inspectorTab !== 'json') setInspectorTab('node')
          }}
          onConnectNodes={actions.connect}
          onDisconnectEdge={actions.disconnect}
          onToggleEdgeDisable={actions.toggleEdgeDisable}
          onSpawnCameraWaypoint={actions.spawnCameraWaypoint}
        />
      </div>
    </div>
  )
}
