import React, { useCallback, useMemo, useState } from 'react'
import type {
  Project,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useToast } from '../../actions'
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
  getDefaultPartsForNode,
  getWorkflowFromTemplate,
  resolveConnectedWorkflowNodes
} from '../../project/workflowEngine'
import { IconPause, IconPlay, IconPlus, IconSparkles } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowSidePanel, type WorkflowInspectorSubTab } from './WorkflowSidePanel'
import { IconWfAutoWire, IconWfJsonCode } from './workflowIcons'

const TEMPLATE_SHORT_PILLS: Record<string, string> = {
  cinematic_parallax_intro: 'Điện ảnh',
  character_action_physics: 'Hành động',
  cave_virtual_light_explore: 'Hang động',
  story_dialogue_lipsync: 'Hội thoại',
  arch3d_flythrough: 'Kiến trúc 3D'
}

export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const playing = useEditor((s) => s.playing)
  const liveTime = useEditor((s) => {
    const raw = Number.isFinite(s.time) ? s.time : 0
    return s.playing ? Math.floor(raw * 8) / 8 : Math.round(raw * 10) / 10
  })
  const setPlaying = useEditor((s) => s.setPlaying)
  const showToast = useToast((s) => s.show)

  const workflow = useMemo(() => ensureProjectWorkflow(project), [project])
  const { activeNodes, disconnectedNodes } = useMemo(
    () => resolveConnectedWorkflowNodes(workflow),
    [workflow]
  )
  const blueprint = useMemo(
    () => compileWorkflowBlueprint(workflow, project),
    [workflow, project]
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => workflow.nodes[0]?.id ?? null
  )
  const [sideMode, setSideMode] = useState<'node' | 'json'>('node')
  const [inspectorSubTab, setInspectorSubTab] = useState<WorkflowInspectorSubTab>('preset')

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

  /**
   * Ghi nhận thay đổi Workflow và đồng bộ ngay lập tức lên Cảnh 3D
   * (khi ngắt dây / tắt khối thì tắt ngay chuyển động/hiệu ứng của khâu đó).
   */
  const commitWorkflow = useCallback(
    (next: WorkflowGraph, mergeKey?: string, syncScene = true) => {
      useEditor.getState().update((draft) => {
        draft.workflow = next
        if (syncScene) {
          applyWorkflowToProject(draft as Project, next)
        }
      }, mergeKey)
    },
    []
  )

  const handleSelectTemplate = useCallback(
    (presetId: string) => {
      const next = getWorkflowFromTemplate(presetId)
      next.targetShotId = workflow.targetShotId ?? 'all'
      commitWorkflow(next, undefined, true)
      setSelectedNodeId(next.nodes[0]?.id ?? null)
      showToast(`🎬 Đã áp dụng kịch bản mẫu: ${next.name}`)
    },
    [workflow.targetShotId, commitWorkflow, showToast]
  )

  const handleSelectShotScope = useCallback(
    (shotId: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        targetShotId: shotId
      }
      commitWorkflow(next, 'wf-shot-scope', true)
      if (shotId === 'all') {
        showToast(
          `⇄ Đã đồng bộ & áp dụng quy trình xử lý cho toàn bộ ${project.shots.length} phân cảnh!`
        )
      } else {
        const shotObj = project.shots.find((s) => s.id === shotId)
        const idx = Math.max(0, project.shots.findIndex((s) => s.id === shotId))
        if (shotObj) {
          const st = useEditor.getState()
          const shotPos = shotObj.position.value
          const matchingKf = st.project.camera.target.keyframes.find(
            (k) => Math.hypot(k.value[0] - shotPos[0], k.value[1] - shotPos[1]) < 600
          )
          const jumpTime = matchingKf
            ? matchingKf.t
            : Math.round((idx / Math.max(1, project.shots.length)) * project.comp.duration * 10) / 10
          st.selectShot(shotId)
          st.setTime(jumpTime)
          showToast(
            `🎯 Đang áp dụng quy trình cho Phân cảnh #${idx + 1}: ${shotObj.name} (${jumpTime.toFixed(1)}s)`
          )
        }
      }
    },
    [workflow, project.shots, commitWorkflow, showToast]
  )

  const handleAutoWire = useCallback(() => {
    const next = autoWireWorkflowNodes(workflow)
    commitWorkflow(next, undefined, true)
    showToast('Đã tự động nối chuẩn toàn bộ cổng chức năng và đồng bộ lên Cảnh 3D!')
  }, [workflow, commitWorkflow, showToast])

  const handleMoveNodes = useCallback(
    (positions: Record<string, { x: number; y: number }>, mergeKey?: string) => {
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          positions[n.id] ? { ...n, position: { ...positions[n.id] } } : n
        )
      }
      commitWorkflow(next, mergeKey ?? 'wf-move', false)
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
    commitWorkflow(next, 'wf-autolayout', false)
    showToast('Đã sắp xếp gọn gàng vị trí 7 khối chức năng!')
  }, [workflow, commitWorkflow, showToast])

  const handleToggleNode = useCallback(
    (nodeId: string) => {
      const target = workflow.nodes.find((n) => n.id === nodeId)
      const nextEnabled = target ? !target.enabled : true
      const next: WorkflowGraph = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, enabled: !n.enabled } : n
        )
      }
      commitWorkflow(next, undefined, true)
      const { activeNodes: nextActive } = resolveConnectedWorkflowNodes(next)
      if (nextActive.length === 0 && playing) {
        setPlaying(false)
      }
      if (target) {
        showToast(
          nextEnabled
            ? `✓ Đã BẬT khối "${target.title}"`
            : `⛔ Đã TẮT khối "${target.title}" — Đã ngắt hiệu ứng khâu này trên Cảnh 3D`
        )
      }
    },
    [workflow, commitWorkflow, playing, setPlaying, showToast]
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
            params: {
              ...(n.params ?? {}),
              ...(pSpec?.defaultParams ?? {}),
              targetParts: getDefaultPartsForNode({ type: n.type, preset: presetId })
            }
          }
        })
      }
      commitWorkflow(next, undefined, true)
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
      commitWorkflow(next, `wf-dir-${nodeId}`, false)
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
      commitWorkflow(next, `wf-param-${nodeId}`, true)
    },
    [workflow, commitWorkflow]
  )

  const handleConnectPorts = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      const next = connectWorkflowPort(workflow, fromNode, fromPort, toNode, toPort)
      commitWorkflow(next, undefined, true)
      const { activeNodes: nextActive } = resolveConnectedWorkflowNodes(next)
      showToast(`🔗 Đã nối dây thành công (${nextActive.length}/7 khối thông mạch)!`)
    },
    [workflow, commitWorkflow, showToast]
  )

  const handleDisconnectEdge = useCallback(
    (edgeId: string) => {
      const next = disconnectWorkflowEdge(workflow, { edgeId })
      commitWorkflow(next, undefined, true)
      const { activeNodes: nextActive } = resolveConnectedWorkflowNodes(next)
      if (nextActive.length === 0 && playing) {
        setPlaying(false)
        showToast(
          '⛔ Đã ngắt nguồn Phân cảnh #1 — Đã dừng phát và tắt hiệu ứng các khối bị đứt luồng!'
        )
      } else {
        showToast(
          `⛔ Đã ngắt dây kết nối (${nextActive.length}/7 khối còn thông mạch — các khối đứt luồng đã dừng hiệu ứng)!`
        )
      }
    },
    [workflow, commitWorkflow, playing, setPlaying, showToast]
  )

  const handleExecuteWorkflow = useCallback(() => {
    let stageCount = 0
    useEditor.getState().update((draft) => {
      const report = applyWorkflowToProject(draft as Project, workflow)
      stageCount = report.executedStages.length
    })
    showToast(
      stageCount > 0
        ? `⚡ Đã áp dụng Workflow (${stageCount}/7 khâu kết nối) vào phân cảnh!`
        : '⛔ Luồng đang đứt — Đã tắt hiệu ứng của các khối chưa nối dây!'
    )
  }, [workflow, showToast])

  const handleTogglePlayFlow = useCallback(() => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (activeNodes.length === 0) {
      showToast(
        '⛔ Chưa có lộ trình thông mạch từ Khối #1 Phân cảnh! Hãy nối dây hoặc bấm "Tự nối Port" để chạy.'
      )
      return
    }
    useEditor.getState().update((draft) => {
      applyWorkflowToProject(draft as Project, workflow)
    }, 'wf-sync-before-play')
    setPlaying(true)
  }, [playing, activeNodes.length, workflow, setPlaying, showToast])

  const handleQuickFocusAddMotion = useCallback(() => {
    const motionNode =
      workflow.nodes.find((n) => n.type === 'motion_choreography') ?? workflow.nodes[0]
    if (motionNode) {
      setSelectedNodeId(motionNode.id)
    }
    setSideMode('node')
    setInspectorSubTab('actions')
    showToast('➕ Chọn hiệu ứng ở tab "➕ Chuyển động" bên phải rồi bấm "+ Gắn"!')
  }, [workflow.nodes, showToast])

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
      useEditor.getState().setPlaying(true)
      showToast(`▶ Đang chạy thử hiệu ứng khối "${node.title}" trên Cảnh 3D!`)
    },
    [workflow, showToast]
  )

  const currentShotScope = workflow.targetShotId ?? 'all'

  return (
    <div className="wf-studio-panel" data-mcp-region="timeline_workflow">
      {/* Workflow Top Toolbar (Hoàn toàn bằng Nút bấm trực tiếp - Không dùng Combobox) */}
      <div className="timeline-toolbar wf-toolbar" data-mcp-region="workflow_toolbar">
        <TimelineModeTabs
          layerCount={project.layers.length}
          connectedNodeCount={activeNodes.length}
          totalNodeCount={workflow.nodes.length}
        />

        <div className="tl-toolbar-divider" />

        {/* Chọn nhanh Kịch bản mẫu bằng Nút Bấm Trực Tiếp (Thay thế Combobox Mẫu quy trình) */}
        <div
          className="wf-toolbar-pill-group"
          role="radiogroup"
          aria-label="Kịch bản quy trình mẫu"
        >
          <span className="wf-toolbar-label">Mẫu:</span>
          {WORKFLOW_TEMPLATES.map((t) => {
            const active = (workflow.presetId ?? 'cinematic_parallax_intro') === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={`wf-toolbar-pill-btn${active ? ' active' : ''}`}
                title={`${t.badge} ${t.name}\n${t.description}`}
                onClick={() => handleSelectTemplate(t.id)}
              >
                <span>{t.badge}</span>
                <span>{TEMPLATE_SHORT_PILLS[t.id] ?? t.name}</span>
              </button>
            )
          })}
        </div>

        {/* Phạm vi Phân cảnh áp dụng (Tất cả phân cảnh hoặc từng Phân cảnh #1, #2, #3) */}
        {project.shots.length > 1 && (
          <div
            className="wf-toolbar-pill-group wf-shot-scope-group"
            role="radiogroup"
            aria-label="Phạm vi Phân cảnh áp dụng"
          >
            <span className="wf-toolbar-label">Cảnh:</span>
            <button
              type="button"
              className={`wf-toolbar-pill-btn${currentShotScope === 'all' ? ' active' : ''}`}
              title="Đồng bộ & áp dụng quy trình xử lý xuyên suốt tất cả các phân cảnh"
              onClick={() => handleSelectShotScope('all')}
            >
              ⇄ Tất cả ({project.shots.length})
            </button>
            {project.shots.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`wf-toolbar-pill-btn${currentShotScope === s.id ? ' active' : ''}`}
                title={`Chỉ áp dụng & xem thử trên Phân cảnh #${idx + 1}: ${s.name}`}
                onClick={() => handleSelectShotScope(s.id)}
              >
                #{idx + 1}
              </button>
            ))}
          </div>
        )}

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

        {/* Nút mở nhanh bộ thêm Chuyển động / Tính năng mới */}
        <button
          id="wf-btn-quick-add-motion"
          type="button"
          className="btn ghost sm tl-action-btn wf-quick-add-btn"
          title="Thêm chức năng chuyển động mới (Wind, Drift, Bước đi, Nhảy, Đèn 2.5D, Glow...) cho Layer bất kỳ"
          onClick={handleQuickFocusAddMotion}
        >
          <IconPlus width={12} height={12} />
          <span>Thêm chuyển động</span>
        </button>

        {/* Nút Phát / Dừng Video trực tiếp trên Workflow để quan sát luồng chạy */}
        <button
          id="wf-btn-play-flow"
          type="button"
          className={`btn ghost sm tl-action-btn wf-play-flow-btn${playing ? ' playing' : ''}${activeNodes.length === 0 ? ' broken' : ''}`}
          title={
            activeNodes.length === 0
              ? 'Luồng đang đứt từ Phân cảnh #1 — Bấm "Tự nối Port" trước khi chạy'
              : playing
                ? 'Đang phát video & mô phỏng lộ trình xử lý theo từng bước (Bấm để tạm dừng)'
                : 'Phát video để quan sát lộ trình xử lý tuần tự qua từng khối chức năng'
          }
          onClick={handleTogglePlayFlow}
        >
          {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
          <span>{playing ? 'Đang chạy' : 'Chạy luồng'}</span>
          <span className="wf-play-time-tag">
            {liveTime.toFixed(1)}s/{project.comp.duration}s
          </span>
        </button>

        {/* Active Pipeline Flow Pill (Hiển thị lộ trình tuần tự #1 ➔ #2 ➔ ...) */}
        <div
          className={`wf-pipeline-flow-pill${playing && activeNodes.length > 0 ? ' playing' : ''}${activeNodes.length === 0 ? ' broken' : ''}`}
          title={blueprint.pipelineSummary}
        >
          <span
            className={`wf-flow-dot${playing && activeNodes.length > 0 ? ' pulsing' : ''}${activeNodes.length === 0 ? ' broken' : ''}`}
          />
          {activeNodes.length > 0 ? (
            <div className="wf-flow-steps">
              {activeNodes.map((n, idx) => {
                const spec = WORKFLOW_NODE_SPECS[n.type]
                const cycleIdx = Math.floor((liveTime * 2.2) % Math.max(1, activeNodes.length))
                const isStepPulse = playing && cycleIdx === idx
                const isNodeSel = selectedNode?.id === n.id
                return (
                  <React.Fragment key={n.id}>
                    {idx > 0 && <span className="wf-flow-arrow">➔</span>}
                    <button
                      type="button"
                      className={`wf-flow-step-chip${isStepPulse ? ' pulsing' : ''}${isNodeSel ? ' selected' : ''}`}
                      style={{ ['--step-c' as string]: spec?.color ?? '#38bdf8' }}
                      onClick={() => setSelectedNodeId(n.id)}
                      title={`Bước #${idx + 1}: ${spec?.title} — Bấm để xem Layer & Cấu hình chuyển động`}
                    >
                      #{idx + 1} {spec?.shortTitle ?? n.title}
                    </button>
                  </React.Fragment>
                )
              })}
              {disconnectedNodes.length > 0 && (
                <span
                  className="wf-flow-broken-tag"
                  title={`Các khối đang đứt dây / tắt (không chạy): ${disconnectedNodes.map((d) => WORKFLOW_NODE_SPECS[d.type]?.shortTitle ?? d.title).join(', ')}`}
                >
                  ⛔ {disconnectedNodes.length} đứt
                </span>
              )}
            </div>
          ) : (
            <span className="wf-flow-text broken">
              ⛔ Luồng đứt từ Phân cảnh #1 — Bấm &quot;Tự nối Port&quot; để khôi phục lộ trình
            </span>
          )}
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
          title="Thực thi & đồng bộ lại chuỗi khối chức năng lên phân cảnh hiện tại (Hỗ trợ Ctrl+Z)"
          onClick={handleExecuteWorkflow}
        >
          <IconSparkles width={13} height={13} />
          <span>Áp dụng ({activeNodes.length}/7)</span>
        </button>
      </div>

      {/* Main Split Workspace: Interactive Node-Port Canvas + Side Inspector/JSON */}
      <div className="wf-workspace-body">
        <WorkflowCanvas
          workflow={workflow}
          project={project}
          playing={playing}
          time={liveTime}
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
          project={project}
          playing={playing}
          time={liveTime}
          blueprint={blueprint}
          selectedNode={selectedNode}
          sideMode={sideMode}
          inspectorSubTab={inspectorSubTab}
          onChangeSideMode={setSideMode}
          onChangeInspectorSubTab={setInspectorSubTab}
          onChangeNodePreset={handleChangeNodePreset}
          onUpdateNodeDirective={handleUpdateNodeDirective}
          onUpdateNodeParams={handleUpdateNodeParams}
          onConnectPorts={handleConnectPorts}
          onDisconnectEdge={handleDisconnectEdge}
          onApplyJsonGraph={(next) => commitWorkflow(next, undefined, true)}
          onShowToast={showToast}
          onPreviewNode={handlePreviewNode}
        />
      </div>
    </div>
  )
}
