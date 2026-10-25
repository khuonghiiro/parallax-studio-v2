import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  getShotTimeRange,
  isWorkflowV2Graph,
  normalizeWorkflowV2Scope,
  resolveWorkflowV2ActiveShot,
  workflowV2ScopeOf
} from '../../project/workflowV2Engine'
import { applyWorkflowV2PhysicsNodes, resolveWorkflowForScope } from '../../project/workflowV2Rebuild'
import { WorkflowCanvasV2 } from './WorkflowCanvasV2'
import { WorkflowV2Inspector } from './WorkflowV2Inspector'
import { WorkflowV2Sidebar } from './WorkflowV2Sidebar'
import { WorkflowV2Toolbar } from './WorkflowV2Toolbar'
import { resolveV2SpawnTarget, useWorkflowV2Actions } from './useWorkflowV2Actions'
import { resolveV2NodeLevel } from './workflowV2Theme'

const SIDEBAR_KEY = 'pxs:wf-v2-sidebar-collapsed'

export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const playing = useEditor((s) => s.playing)
  const currentTime = useEditor((s) => (Number.isFinite(s.time) ? s.time : 0))
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const [shotScope, setShotScope] = useState<string>(() => normalizeWorkflowV2Scope(project, selectedShotId))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const scope = normalizeWorkflowV2Scope(project, shotScope)

  useEffect(() => {
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) setShotScope(selectedShotId)
  }, [selectedShotId, project.shots])

  const workflow = useMemo(() => resolveWorkflowForScope(project, scope), [project, scope])

  // Ghi đồ thị dẫn xuất vào Project mà không tạo bước Undo (tránh vòng lặp hoàn tác bị kẹt)
  useEffect(() => {
    if (workflow === project.workflow) return
    const needsPhysicsInit = !isWorkflowV2Graph(project.workflow) || workflowV2ScopeOf(project.workflow) !== scope
    useEditor.getState().patchDerived((draft) => {
      draft.workflow = workflow
      if (needsPhysicsInit) applyWorkflowV2PhysicsNodes(draft as Project, workflow)
    })
  }, [workflow, project.workflow, scope])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('v2-root-scene')
  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id)
    if (id) window.dispatchEvent(new CustomEvent('pxs:wf-focus-node', { detail: { nodeId: id } }))
  }, [])

  useEffect(() => {
    const onSelect = (e: Event): void => {
      const id = (e as CustomEvent<{ nodeId?: string }>).detail?.nodeId
      if (id) selectNode(id)
    }
    window.addEventListener('pxs:select-workflow-v2-node', onSelect)
    return () => window.removeEventListener('pxs:select-workflow-v2-node', onSelect)
  }, [selectNode])

  // Chọn Layer ở Timeline / Viewport → chọn Node Layer tương ứng
  useEffect(() => {
    if (!selectedLayerId) return
    const layerNode = workflow.nodes.find(
      (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(selectedLayerId)
    )
    if (layerNode) setSelectedNodeId(layerNode.id)
  }, [selectedLayerId, workflow.nodes])

  const actions = useWorkflowV2Actions(workflow, scope, selectedNodeId, setSelectedNodeId)
  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null
  const spawnTarget = resolveV2SpawnTarget(workflow, selectedNodeId)
  const scopeRange = useMemo(() => getShotTimeRange(project, resolveWorkflowV2ActiveShot(project, scope)), [project, scope])

  const stats = useMemo(() => {
    const levels = workflow.nodes.map(resolveV2NodeLevel)
    return {
      groups: levels.filter((l) => l === 'group').length,
      layers: levels.filter((l) => l === 'layer').length,
      logic: workflow.nodes.filter((n) => resolveV2NodeLevel(n) === 'logic' && n.type !== 'camera_director').length
    }
  }, [workflow.nodes])

  const handleSwitchScope = (next: string): void => {
    setShotScope(next)
    if (next !== '__all__') useEditor.getState().selectShot(next)
    setSelectedNodeId('v2-root-scene')
  }

  const toggleSidebar = (): void => {
    setSidebarCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <div className="wf-studio-panel wf-v2-studio" data-mcp-region="timeline_workflow">
      <WorkflowV2Toolbar
        layerCount={project.layers.length}
        enabledNodeCount={workflow.nodes.filter((n) => n.enabled).length}
        totalNodeCount={workflow.nodes.length}
        stats={stats}
        shots={project.shots}
        scope={scope}
        onSwitchScope={handleSwitchScope}
        onRebuild={actions.rebuild}
        onAutoLayout={actions.autoLayout}
        onApplyAll={actions.applyAll}
      />
      <div className="wf-v2-body">
        <WorkflowV2Sidebar
          workflow={workflow}
          collapsed={sidebarCollapsed}
          selectedNodeId={selectedNodeId}
          spawnTarget={spawnTarget}
          onToggleCollapsed={toggleSidebar}
          onSelectNode={selectNode}
          onToggleGroup={(id, collapsed) => actions.updateParams(id, { collapsedGroup: collapsed })}
          onSpawn={(cat) => spawnTarget && actions.attachLogic(spawnTarget.id, cat)}
        />
        <WorkflowCanvasV2
          workflow={workflow}
          project={project}
          currentTime={currentTime}
          playing={playing}
          scopeRange={scopeRange}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
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
          onUpdateParams={actions.updateParams}
          onToggleEnable={actions.toggleEnable}
          onDeleteNode={actions.deleteNode}
          onAttachLogic={actions.attachLogic}
          onScrubTime={setTime}
        />
      </div>
    </div>
  )
}
