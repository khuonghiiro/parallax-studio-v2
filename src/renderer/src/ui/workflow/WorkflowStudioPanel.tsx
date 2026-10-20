import React, { useCallback, useMemo, useState } from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { useToast } from '../../actions'
import { CustomSelect } from '../controls/CustomSelect'
import {
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_TEMPLATES
} from '../../project/workflowCatalog'
import {
  applyWorkflowToProject,
  autoWireWorkflowNodes,
  compileWorkflowBlueprint,
  connectWorkflowPort,
  disconnectWorkflowEdge,
  ensureProjectWorkflow,
  getWorkflowFromTemplate,
  resolveConnectedWorkflowNodes
} from '../../project/workflowEngine'
import { IconSparkles } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowSidePanel } from './WorkflowSidePanel'
import { IconWfAutoWire, IconWfJsonCode } from './workflowIcons'

export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const showToast = useToast((s) => s.show)

  const workflow = useMemo(() => ensureProjectWorkflow(project), [project])
  const { activeNodes } = useMemo(() => resolveConnectedWorkflowNodes(workflow), [workflow])
  const blueprint = useMemo(
    () => compileWorkflowBlueprint(workflow, project),
    [workflow, project]
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => workflow.nodes[0]?.id ?? null
  )
  const [sideMode, setSideMode] = useState<'node' | 'json'>('node')

  const activeNodeIds = useMemo(() => new Set(activeNodes.map((n) => n.id)), [activeNodes])
  const executionStepMap = useMemo(() => {
    const map = new Map<string, number>()
    activeNodes.forEach((n, idx) => map.set(n.id, idx + 1))
    return map
  }, [activeNodes])

  const selectedNode = useMemo(
    () => workflow.nodes.find((n) => n.id === selectedNodeId) ?? workflow.nodes[0] ?? null,
    [workflow.nodes, selectedNodeId]
  )

  const commitWorkflow = useCallback((next: WorkflowGraph, mergeKey?: string) => {
    useEditor.getState().update((draft) => {
      draft.workflow = next
    }, mergeKey)
  }, [])

  const handleSelectTemplate = useCallback(
    (presetId: string) => {
      const next = getWorkflowFromTemplate(presetId)
      commitWorkflow(next)
      setSelectedNodeId(next.nodes[0]?.id ?? null)
      showToast(`Đã nạp mẫu quy trình: ${next.name}`)
    },
    [commitWorkflow, showToast]
  )

  const handleAutoWire = useCallback(() => {
    const next = autoWireWorkflowNodes(workflow)
    commitWorkflow(next)
    showToast('Đã tự động kết nối chuẩn toàn bộ cổng chức năng!')
  }, [workflow, commitWorkflow, showToast])

  const handleMoveNodes = useCallback(
    (positions: Record<string, { x: number; y: number }>, mergeKey?: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          positions[n.id] ? { ...n, position: { ...positions[n.id] } } : n
        )
      }
      commitWorkflow(next, mergeKey ?? 'wf-move')
    },
    [workflow, commitWorkflow]
  )

  const handleAutoLayout = useCallback(() => {
    const next: WorkflowGraph = {
      ...workflow,
      nodes: workflow.nodes.map((n) => ({
        ...n,
        position: { ...(DEFAULT_NODE_POSITIONS[n.type] ?? n.position) }
      }))
    }
    commitWorkflow(next, 'wf-autolayout')
    showToast('Đã sắp xếp gọn gàng vị trí 7 khối chức năng!')
  }, [workflow, commitWorkflow, showToast])

  const handleToggleNode = useCallback(
    (nodeId: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, enabled: !n.enabled } : n
        )
      }
      commitWorkflow(next)
    },
    [workflow, commitWorkflow]
  )

  const handleChangeNodePreset = useCallback(
    (nodeId: string, presetId: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) => {
          if (n.id !== nodeId) return n
          const spec = WORKFLOW_NODE_SPECS[n.type]
          const pSpec = spec?.presets.find((p) => p.id === presetId)
          return {
            ...n,
            preset: presetId,
            aiDirective: pSpec?.defaultDirective ?? n.aiDirective,
            params: { ...(pSpec?.defaultParams ?? {}), ...(n.params ?? {}) }
          }
        })
      }
      commitWorkflow(next)
    },
    [workflow, commitWorkflow]
  )

  const handleUpdateNodeDirective = useCallback(
    (nodeId: string, directive: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, aiDirective: directive } : n
        )
      }
      commitWorkflow(next, `wf-dir-${nodeId}`)
    },
    [workflow, commitWorkflow]
  )

  const handleUpdateNodeParams = useCallback(
    (nodeId: string, patch: Partial<WorkflowNodeParams>) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, params: { ...(n.params ?? {}), ...patch } } : n
        )
      }
      commitWorkflow(next, `wf-param-${nodeId}`)
    },
    [workflow, commitWorkflow]
  )

  const handleConnectPorts = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      const next = connectWorkflowPort(workflow, fromNode, fromPort, toNode, toPort)
      commitWorkflow(next)
      showToast('Đã kết nối cổng chức năng!')
    },
    [workflow, commitWorkflow, showToast]
  )

  const handleDisconnectEdge = useCallback(
    (edgeId: string) => {
      const next = disconnectWorkflowEdge(workflow, { edgeId })
      commitWorkflow(next)
    },
    [workflow, commitWorkflow]
  )

  const handleExecuteWorkflow = useCallback(() => {
    let stageCount = 0
    useEditor.getState().update((draft) => {
      const report = applyWorkflowToProject(draft as Project, workflow)
      stageCount = report.executedStages.length
    })
    showToast(
      stageCount > 0
        ? `⚡ Đã áp dụng Workflow (${stageCount} khâu kết nối) vào phân cảnh!`
        : 'Chưa có khối chức năng nào được bật và nối Port!'
    )
  }, [workflow, showToast])

  const handlePreviewNode = useCallback(
    (node: WorkflowNode) => {
      const singleNodeGraph: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) => ({
          ...n,
          enabled: n.id === node.id || n.type === 'scene_shot'
        })),
        edges:
          node.type === 'scene_shot'
            ? []
            : [
                {
                  id: `preview-edge-${node.id}`,
                  fromNode: 'wf-scene_shot',
                  fromPort: 'scene_ctx',
                  toNode: node.id,
                  toPort: WORKFLOW_NODE_SPECS[node.type]?.inputs[0] ?? 'scene_ctx'
                }
              ]
      }
      useEditor.getState().update((draft) => {
        applyWorkflowToProject(draft as Project, singleNodeGraph)
        draft.workflow = workflow
      })
      useView.getState().setPlaying(true)
      showToast(`▶ Đang chạy thử hiệu ứng khối "${node.title}" trên Cảnh 3D!`)
    },
    [workflow, showToast]
  )

  const templateOptions = useMemo(
    () =>
      WORKFLOW_TEMPLATES.map((t) => ({
        value: t.id,
        label: `${t.badge} ${t.name}`
      })),
    []
  )

  return (
    <div className="wf-studio-panel" data-mcp-region="timeline_workflow">
      {/* Workflow Top Toolbar */}
      <div className="timeline-toolbar wf-toolbar" data-mcp-region="workflow_toolbar">
        <TimelineModeTabs
          layerCount={project.layers.length}
          connectedNodeCount={activeNodes.length}
          totalNodeCount={workflow.nodes.length}
        />

        <div className="tl-toolbar-divider" />

        {/* Template Selector */}
        <div className="wf-toolbar-template-group">
          <span className="wf-toolbar-label">Mẫu quy trình:</span>
          <CustomSelect
            size="sm"
            value={workflow.presetId ?? 'cinematic_parallax_intro'}
            options={templateOptions}
            dropdownWidth={310}
            onChange={(val) => handleSelectTemplate(String(val))}
            title="Chọn mẫu quy trình tạo video chuyên nghiệp"
          />
        </div>

        <button
          id="wf-btn-autowire"
          type="button"
          className="btn ghost sm tl-action-btn"
          title="Tự động nối chuẩn tất cả cổng (Port) giữa các khối chức năng đang bật"
          onClick={handleAutoWire}
        >
          <IconWfAutoWire width={13} height={13} />
          <span>Tự nối Port</span>
        </button>

        {/* Active Pipeline Flow Pill */}
        <div className="wf-pipeline-flow-pill" title={blueprint.pipelineSummary}>
          <span className="wf-flow-dot" />
          <span className="wf-flow-text">
            {activeNodes.length > 0
              ? activeNodes
                  .map((n) => WORKFLOW_NODE_SPECS[n.type]?.shortTitle ?? n.title)
                  .join(' ➔ ')
              : 'Chưa nối cổng — Bấm "Tự nối Port" hoặc nối dây giữa các khối'}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <button
          id="wf-btn-toggle-json"
          type="button"
          className={`btn ghost sm tl-action-btn${sideMode === 'json' ? ' active' : ''}`}
          title="Xem & chỉnh sửa cấu hình JSON và bản thiết kế Tác nhân AI (MCP Blueprint)"
          onClick={() => setSideMode((m) => (m === 'json' ? 'node' : 'json'))}
        >
          <IconWfJsonCode width={13} height={13} />
          <span>JSON & AI</span>
        </button>

        <button
          id="wf-btn-apply"
          type="button"
          className="btn primary sm wf-apply-btn"
          disabled={activeNodes.length === 0}
          title="Thực thi ngay chuỗi khối chức năng đã nối Port lên phân cảnh hiện tại (Hỗ trợ Ctrl+Z)"
          onClick={handleExecuteWorkflow}
        >
          <IconSparkles width={13} height={13} />
          <span>Áp dụng Workflow ({activeNodes.length})</span>
        </button>
      </div>

      {/* Main Split Workspace: Interactive Node-Port Canvas + Side Inspector/JSON */}
      <div className="wf-workspace-body">
        <WorkflowCanvas
          workflow={workflow}
          activeNodeIds={activeNodeIds}
          executionStepMap={executionStepMap}
          selectedNodeId={selectedNode?.id ?? null}
          onSelectNode={(id) => {
            setSelectedNodeId(id)
          }}
          onMoveNodes={handleMoveNodes}
          onAutoLayout={handleAutoLayout}
          onToggleNode={handleToggleNode}
          onChangeNodePreset={handleChangeNodePreset}
          onConnectPorts={handleConnectPorts}
          onDisconnectEdge={handleDisconnectEdge}
          onPreviewNode={handlePreviewNode}
        />

        <WorkflowSidePanel
          workflow={workflow}
          blueprint={blueprint}
          selectedNode={selectedNode}
          sideMode={sideMode}
          onChangeSideMode={setSideMode}
          onChangeNodePreset={handleChangeNodePreset}
          onUpdateNodeDirective={handleUpdateNodeDirective}
          onUpdateNodeParams={handleUpdateNodeParams}
          onConnectPorts={handleConnectPorts}
          onDisconnectEdge={handleDisconnectEdge}
          onApplyJsonGraph={(next) => commitWorkflow(next)}
          onShowToast={showToast}
          onPreviewNode={handlePreviewNode}
        />
      </div>
    </div>
  )
}
