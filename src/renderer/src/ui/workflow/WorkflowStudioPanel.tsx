import { getWorkflowLayerVisibility } from '../../project/workflowVisibility'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Project,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  useToast,
  addParticleLayer,
  addTextLayer,
  addGroundLayer,
  importDroppedFiles
} from '../../actions'
import { validateWorkflowConnection } from '../../project/workflowConnectionRules'
import {
  WORKFLOW_NODE_SPECS,
  createCanonicalWorkflow
} from '../../project/workflowCatalog'
import {
  applyWorkflowToProject,
  autoWireWorkflowNodes,
  compileWorkflowBlueprint,
  connectWorkflowPort,
  disconnectWorkflowEdge,
  ensureProjectWorkflow,
  getDefaultPartsForNode,
  resolveConnectedWorkflowNodes
} from '../../project/workflowEngine'
import { syncWorkflowEntityVisibility } from '../../project/workflowEntitySync'
import {
  consolidateCompositeWorkflowNodes,
  createClearedWorkflowWithSceneRoots,
  getWorkflowEffectiveDuration,
  spawnSceneWithChildLayers,
  syncMissingLayersToWorkflow
} from '../../project/workflowSceneHierarchy'
import { applyRuleMutationToProjectLayer } from '../../project/workflowStageEffects'
import { spawnLogicNodeIntoWorkflow } from '../../project/workflowLogicNodes'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowNodePalette } from './WorkflowNodePalette'
import { WorkflowSidePanel, type WorkflowInspectorSubTab } from './WorkflowSidePanel'
import { WorkflowNodeConfigDialog } from './WorkflowNodeConfigDialog'
import { WorkflowStudioToolbar } from './WorkflowStudioToolbar'
import { resolveNodeCollisionPush, solveSpaciousWorkflowLayout } from './workflowLayoutAndFlow'

export const WorkflowStudioPanel: React.FC = () => {
  const project = useEditor((s) => s.project)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const playing = useEditor((s) => s.playing)
  const liveTime = useEditor((s) => {
    const raw = Number.isFinite(s.time) ? s.time : 0
    return s.playing ? Math.floor(raw * 8) / 8 : Math.round(raw * 10) / 10
  })
  const setPlaying = useEditor((s) => s.setPlaying)
  const showToast = useToast((s) => s.show)
  const explicitAllScopeRef = useRef(false)

  useEffect(() => {
    if (selectedShotId) {
      explicitAllScopeRef.current = false
    }
  }, [selectedShotId])

  const currentShotScope = useMemo(() => {
    if (project.shots.length <= 1) return project.shots[0]?.id ?? 'all'
    if (explicitAllScopeRef.current) return 'all'
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) {
      return selectedShotId
    }
    if (
      project.workflow?.targetShotId &&
      project.workflow.targetShotId !== 'all' &&
      project.shots.some((s) => s.id === project.workflow?.targetShotId)
    ) {
      return project.workflow.targetShotId
    }
    return project.shots[0]?.id ?? 'all'
  }, [project.shots, project.workflow?.targetShotId, selectedShotId])

  const activeShotLabel = useMemo(() => {
    if (currentShotScope === 'all') return `Tất cả (${project.shots.length} cảnh)`
    const idx = project.shots.findIndex((s) => s.id === currentShotScope)
    const shotObj = project.shots[idx]
    return shotObj ? `Cảnh #${idx + 1}: ${shotObj.name}` : 'Cảnh #1'
  }, [currentShotScope, project.shots])

  const currentShotIndex = useMemo(() => {
    if (!currentShotScope || currentShotScope === 'all') return 0
    const idx = project.shots.findIndex((s) => s.id === currentShotScope)
    return idx >= 0 ? idx : 0
  }, [currentShotScope, project.shots])

  const workflow = useMemo(() => {
    const wf = ensureProjectWorkflow({
      ...project,
      workflow: project.workflow
        ? { ...project.workflow, targetShotId: currentShotScope }
        : undefined
    })
    return {
      ...wf,
      targetShotId: currentShotScope
    }
  }, [project, currentShotScope])

  const workflowDuration = useMemo(
    () => getWorkflowEffectiveDuration(workflow, project, currentShotScope),
    [workflow, project, currentShotScope]
  )

  const scopedProject = useMemo(
    () => ({ ...project, workflow }),
    [project, workflow]
  )
  const { activeNodes, disconnectedNodes } = useMemo(
    () => resolveConnectedWorkflowNodes(workflow),
    [workflow]
  )
  const blueprint = useMemo(
    () => compileWorkflowBlueprint(workflow, scopedProject),
    [workflow, scopedProject]
  )

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => workflow.nodes[0]?.id ?? null
  )
  const [configNodeId, setConfigNodeId] = useState<string | null>(null)
  const [sideMode, setSideMode] = useState<'node' | 'json' | 'none'>('none')
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

  const configNode = useMemo(
    () => (configNodeId ? workflow.nodes.find((n) => n.id === configNodeId) ?? null : null),
    [workflow.nodes, configNodeId]
  )

  const handleOpenNodeConfig = useCallback((node: WorkflowNode) => {
    setSelectedNodeId(node.id)
    setConfigNodeId(node.id)
  }, [])

  const handleOpenNodeConfigById = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setConfigNodeId(nodeId)
  }, [])

  // Đồng bộ 2 chiều: Khi người dùng click chọn Layer bên Cam 2D / 3D / Timeline, tự highlight Node chứa Layer đó trên Workflow
  useEffect(() => {
    if (!selectedLayerId) return
    const current = workflow.nodes.find((n) => n.id === selectedNodeId)
    if (
      current &&
      current.type !== 'scene_shot' &&
      current.params?.targetLayerIds?.includes(selectedLayerId)
    ) {
      return
    }
    const matchingLayerNode = workflow.nodes.find(
      (n) =>
        n.type === 'layer_assembly' &&
        n.id.startsWith('wf-layer-') &&
        n.params?.targetLayerIds?.includes(selectedLayerId)
    )
    if (matchingLayerNode) {
      setSelectedNodeId(matchingLayerNode.id)
    }
  }, [selectedLayerId, workflow.nodes, selectedNodeId])

  // Bảo đảm đồng bộ trạng thái ẩn/hiện (visible) của Layer theo trạng thái Bật/Tắt (ON/OFF) của Node Layer con
  useEffect(() => {
    const visibility = getWorkflowLayerVisibility(project, workflow, activeNodeIds)
    if (project.layers.some((layer) => !layer.locked && visibility.has(layer.id) && visibility.get(layer.id) !== layer.visible)) {
      useEditor.getState().update((draft) => {
        syncWorkflowEntityVisibility(draft as Project, workflow, activeNodeIds)
      }, 'wf-sync-entity-visibility')
    }
  }, [workflow, project.layers, activeNodeIds])

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      const n = workflow.nodes.find((item) => item.id === nodeId)
      if (!n) return
      const st = useEditor.getState()
      const vw = useView.getState()

      if (n.type === 'scene_shot') {
        const shotId =
          (n.params?.shotId && n.params.shotId !== 'all' ? n.params.shotId : null) ??
          st.selectedShotId ??
          st.project.shots[0]?.id ??
          null
        if (shotId) {
          st.selectShot(shotId)
          if (vw.split || vw.primary === 'editor' || vw.primary === 'animate2d') {
            useView.setState((s) => ({
              focus: { kind: 'shot', id: shotId, n: (s.focus?.n ?? 0) + 1 }
            }))
          }
        }
        st.setInspectorTab('scene')
        return
      }

      const targetIds = n.params?.targetLayerIds ?? []
      if (targetIds.length > 0) {
        const boundLayers = st.project.layers.filter((l) => targetIds.includes(l.id))
        const targetLayer = boundLayers.find((l) => l.composite?.isRoot) ?? boundLayers[0]
        if (targetLayer) {
          st.selectLayer(targetLayer.id)
          if (vw.split || vw.primary === 'editor' || vw.primary === 'animate2d') {
            useView.setState((s) => ({
              focus: { kind: 'layer', id: targetLayer.id, n: (s.focus?.n ?? 0) + 1 }
            }))
          }
          return
        }
      }

      const ruleTarget = (n.params?.customRules ?? []).find(
        (r) => r.targetId && r.targetId !== 'all'
      )
      if (ruleTarget) {
        const matched = st.project.layers.find(
          (l) =>
            l.id === ruleTarget.targetId ||
            l.composite?.instanceId === ruleTarget.targetId ||
            l.model3d?.instanceId === ruleTarget.targetId
        )
        if (matched) {
          st.selectLayer(matched.id)
          return
        }
      }

      if (n.type === 'camera_director') {
        st.setInspectorTab('route')
      } else if (n.type === 'look_output') {
        st.setInspectorTab('scene')
      } else if (
        n.type === 'layer_assembly' ||
        n.type === 'motion_choreography' ||
        n.type === 'physics_fx'
      ) {
        if (!st.selectedLayerId) {
          const activeShot = st.selectedShotId ?? st.project.shots[0]?.id ?? null
          const candidate =
            st.project.layers.find((l) => l.shotId === activeShot && l.type === 'image') ??
            st.project.layers.find((l) => l.type === 'image')
          if (candidate) st.selectLayer(candidate.id)
        } else {
          st.setInspectorTab('layer')
        }
      }
    },
    [workflow.nodes]
  )

  /**
   * Ghi nhận thay đổi Workflow và đồng bộ ngay lập tức lên Cảnh 3D
   * (khi ngắt dây / tắt khối thì tắt ngay chuyển động/hiệu ứng và ẩn/hiện layer tương ứng).
   */
  const commitWorkflow = useCallback(
    (
      next: WorkflowGraph,
      mergeKey?: string,
      syncScene = true,
      onlyNodeIds?: Set<string>
    ) => {
      const scopedNext: WorkflowGraph = {
        ...next,
        targetShotId: next.targetShotId ?? currentShotScope
      }
      useEditor.getState().update((draft) => {
        draft.workflow = scopedNext
        if (syncScene) {
          applyWorkflowToProject(
            draft as Project,
            scopedNext,
            onlyNodeIds ? { onlyNodeIds } : undefined
          )
        }
      }, mergeKey)
    },
    [currentShotScope]
  )

  // Tự động kết nối Layer mới vào Workflow nếu sơ đồ đã bung Cảnh
  useEffect(() => {
    const res = syncMissingLayersToWorkflow(workflow, project, currentShotScope)
    if (!res || res.addedCount === 0) return
    const newPositions = solveSpaciousWorkflowLayout(res.workflow.nodes, res.workflow.edges, project)
    const laidOutWf: WorkflowGraph = {
      ...res.workflow,
      nodes: res.workflow.nodes.map((n) => ({
        ...n,
        position: newPositions[n.id] ? { ...newPositions[n.id] } : n.position
      }))
    }
    commitWorkflow(laidOutWf, undefined, true)
    showToast(`✨ Đã tự động kết nối ${res.addedCount} Layer mới vào Sơ đồ Cảnh!`)
  }, [project.layers, currentShotScope, workflow, commitWorkflow, showToast, project])

  const handleResetCanonical = useCallback(() => {
    const next = createCanonicalWorkflow(currentShotScope)
    commitWorkflow(next, undefined, true)
    setSelectedNodeId(next.nodes[0]?.id ?? null)
    showToast(`✨ Đã phục hồi luồng chuẩn 7 khâu xử lý cho ${activeShotLabel}!`)
  }, [currentShotScope, activeShotLabel, commitWorkflow, showToast])

  const handleClearCanvas = useCallback(() => {
    useEditor.getState().setPlaying(false)
    useEditor.getState().setTime(0)
    const next = createClearedWorkflowWithSceneRoots(workflow, project, currentShotScope)
    commitWorkflow(next, undefined, true)
    setSelectedNodeId(next.nodes[0]?.id ?? null)
    setConfigNodeId(null)
    showToast(
      `🧹 Đã làm sạch các dây nối và khối phụ, giữ lại ${next.nodes.length} Node Root Cảnh sẵn sàng kết nối!`
    )
  }, [workflow, project, currentShotScope, commitWorkflow, showToast])

  const handleSelectShotScope = useCallback(
    (shotId: string) => {
      explicitAllScopeRef.current = shotId === 'all'
      const next: WorkflowGraph = {
        ...workflow,
        targetShotId: shotId
      }
      commitWorkflow(next, 'wf-shot-scope', true)
      if (shotId === 'all') {
        showToast(
          `⇄ Đã chuyển sang chế độ đồng bộ toàn bộ ${project.shots.length} phân cảnh!`
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
            `🎯 Đang cô lập xử lý riêng cho Phân cảnh #${idx + 1}: ${shotObj.name} (${jumpTime.toFixed(1)}s)`
          )
        }
      }
    },
    [workflow, project.shots, project.comp.duration, commitWorkflow, showToast]
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
    const consolidated = consolidateCompositeWorkflowNodes(workflow, project)
    const baseWf = consolidated.workflow
    const newPositions = solveSpaciousWorkflowLayout(baseWf.nodes, baseWf.edges, project)
    const next: WorkflowGraph = {
      ...baseWf,
      nodes: baseWf.nodes.map((n) => ({
        ...n,
        position: newPositions[n.id] ? { ...newPositions[n.id] } : n.position
      }))
    }
    commitWorkflow(next, 'wf-autolayout', false)
    window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))
    showToast(
      consolidated.consolidatedCount > 0
        ? `✨ Đã gom cụm ${consolidated.consolidatedCount} node con và sắp xếp sơ đồ gọn gàng, triệt tiêu đè lấn!`
        : '✨ Đã tự sắp xếp gọn gàng toàn bộ sơ đồ, triệt tiêu đè lấn!'
    )
  }, [workflow, project, commitWorkflow, showToast])

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
        const isLayerChild = target.type === 'layer_assembly' && target.id.startsWith('wf-layer-')
        showToast(
          nextEnabled
            ? isLayerChild
              ? `👁️ Đã BẬT & HIỆN "${target.title}" trên Cảnh 2D / 3D`
              : `✓ Đã BẬT khối "${target.title}"`
            : isLayerChild
              ? `🙈 Đã TẮT & ẨN "${target.title}" trên Cảnh 2D / 3D`
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
      commitWorkflow(next, undefined, true, new Set([nodeId]))
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
      commitWorkflow(next, `wf-param-${nodeId}`, true, new Set([nodeId]))
    },
    [workflow, commitWorkflow]
  )

  const handleConnectPorts = useCallback(
    (fromNode: string, fromPort: WorkflowPortKind, toNode: string, toPort: WorkflowPortKind) => {
      try {
        const next = connectWorkflowPort(workflow, fromNode, fromPort, toNode, toPort)
        const sourceNode = workflow.nodes.find((n) => n.id === fromNode)
        const targetNode = workflow.nodes.find((n) => n.id === toNode)
        if (sourceNode?.type === 'layer_assembly' && targetNode?.type === 'layer_assembly' && !targetNode.params?.assemblyRootNodeId && toPort === 'layers_tree') {
          const parentLayerId = sourceNode.params?.targetLayerIds?.[0]
          const childLayerId = targetNode.params?.targetLayerIds?.[0]
          if (parentLayerId && childLayerId) {
            useEditor.getState().update((draft) => {
              const child = draft.layers.find((l) => l.id === childLayerId)
              if (child) child.parentId = parentLayerId
            }, 'wf-link-parent-child')
            showToast(`🔗 Đã liên kết Cha - Con: "${targetNode.title}" bám theo "${sourceNode.title}" (Parent & Link)!`)
          }
        } else {
          const { activeNodes: nextActive } = resolveConnectedWorkflowNodes(next)
          showToast(`🔗 Đã nối dây (${nextActive.length}/${next.nodes.length} khối thông mạch)!`)
        }
        commitWorkflow(next, undefined, true)
      } catch (err: any) {
        showToast(`⚠️ ${err.message || 'Kết nối không hợp lệ theo quy tắc logic'}`)
      }
    },
    [workflow, commitWorkflow, showToast]
  )

  const handleDisconnectEdge = useCallback(
    (edgeId: string) => {
      const targetEdge = workflow.edges.find((e) => e.id === edgeId)
      if (targetEdge && (targetEdge.toPort === 'transform_link' || targetEdge.fromPort === 'transform_link')) {
        showToast('🔒 Liên kết Tọa độ Transform là cố định, không thể ngắt kết nối!')
        return
      }
      if (targetEdge && targetEdge.toPort === 'layers_tree') {
        const sourceNode = workflow.nodes.find((n) => n.id === targetEdge.fromNode)
        const targetNode = workflow.nodes.find((n) => n.id === targetEdge.toNode)
        if (sourceNode?.type === 'layer_assembly' && targetNode?.type === 'layer_assembly') {
          const childLayerId = targetNode.params?.targetLayerIds?.[0]
          if (childLayerId) {
            useEditor.getState().update((draft) => {
              const child = draft.layers.find((l) => l.id === childLayerId)
              if (child && child.parentId === sourceNode.params?.targetLayerIds?.[0]) child.parentId = null
            }, 'wf-unlink-parent-child')
            showToast(`✂️ Đã hủy liên kết Cha - Con: "${targetNode.title}" trở về độc lập trong Phân cảnh.`)
          }
        }
      }
      const next = disconnectWorkflowEdge(workflow, { edgeId })
      commitWorkflow(next, undefined, true)
      const { activeNodes: nextActive } = resolveConnectedWorkflowNodes(next)
      if (nextActive.length === 0 && playing) {
        setPlaying(false)
        showToast('⛔ Đã ngắt nguồn Phân cảnh #1 — Đã dừng phát và tắt hiệu ứng các khối bị đứt luồng!')
      } else {
        showToast(`⛔ Đã ngắt dây (${nextActive.length}/${next.nodes.length} khối còn thông mạch)!`)
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
        ? `⚡ Đã áp dụng Workflow (${stageCount}/${workflow.nodes.length} khâu kết nối) vào phân cảnh!`
        : '⛔ Luồng đang đứt — Đã tắt hiệu ứng của các khối chưa nối dây!'
    )
  }, [workflow, showToast])

  const handleTogglePlayFlow = useCallback(() => {
    if (playing) { setPlaying(false); return }
    if (activeNodes.length === 0) {
      showToast('⛔ Chưa có lộ trình thông mạch từ Khối #1 Phân cảnh! Hãy nối dây hoặc bấm "Tự nối Port" để chạy.')
      return
    }
    const st = useEditor.getState()
    const maxDur = workflowDuration > 0 ? workflowDuration : st.project.comp.duration
    if (st.time >= maxDur - 0.05) st.setTime(0)
    useEditor.getState().update((draft) => {
      applyWorkflowToProject(draft as Project, workflow)
    }, 'wf-sync-before-play')
    setPlaying(true)
  }, [playing, activeNodes.length, workflow, workflowDuration, setPlaying, showToast])

  const handleRewindToZero = useCallback(() => {
    useEditor.getState().setPlaying(false)
    useEditor.getState().setTime(0)
    showToast('⏮ Đã tua về 0.0s')
  }, [showToast])

  const handleSpawnSceneLayers = useCallback(() => {
    const { workflow: nextWf, sceneNode, childNodes } = spawnSceneWithChildLayers(project, workflow, currentShotScope)
    const newPositions = solveSpaciousWorkflowLayout(nextWf.nodes, nextWf.edges, project)
    const laidOutWf: WorkflowGraph = {
      ...nextWf,
      nodes: nextWf.nodes.map((n) => ({
        ...n,
        position: newPositions[n.id] ? { ...newPositions[n.id] } : n.position
      }))
    }
    commitWorkflow(laidOutWf, undefined, false)
    setSelectedNodeId(sceneNode.id)
    window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))
    showToast(
      `🎬 Đã bung Cảnh "${sceneNode.title}" (${childNodes.length} layer) — Không trùng lặp, sơ đồ thoáng đẹp!`
    )
  }, [project, workflow, currentShotScope, commitWorkflow, showToast])

  const handleSpawnLogicNode = useCallback(
    (logicId: string, customPos?: { x: number; y: number }) => {
      if (logicId === '__SPAWN_SCENE_LAYERS__') {
        handleSpawnSceneLayers()
        return
      }
      const { workflow: next, spawnedNode } = spawnLogicNodeIntoWorkflow(
        workflow,
        logicId,
        currentShotScope,
        { autoConnect: false }
      )
      const desiredPos = customPos ?? spawnedNode.position
      const otherNodes = next.nodes.filter((n: WorkflowNode) => n.id !== spawnedNode.id)
      const resolved = resolveNodeCollisionPush(spawnedNode, desiredPos, otherNodes)
      const resolvedNodes = next.nodes.map((n: WorkflowNode) =>
        n.id === spawnedNode.id ? { ...n, position: resolved } : n
      )
      const finalWf = { ...next, nodes: resolvedNodes }

      commitWorkflow(finalWf, undefined, true, new Set([spawnedNode.id]))
      setSelectedNodeId(spawnedNode.id)
      showToast(
        `🧩 Đã thêm "${spawnedNode.title}". Nối dây từ chân cắm để kích hoạt logic này!`
      )
    },
    [workflow, currentShotScope, activeShotLabel, commitWorkflow, showToast, handleSpawnSceneLayers]
  )

  const handleSpawnAndConnectLogicNode = useCallback(
    (
      logicId: string,
      worldPos: { x: number; y: number },
      sourceNodeId: string,
      sourcePort: WorkflowPortKind,
      isSourceOutput: boolean
    ) => {
      const sourceNode = workflow.nodes.find((n) => n.id === sourceNodeId)
      if (!sourceNode) return

      const { workflow: nextWf, spawnedNode } = spawnLogicNodeIntoWorkflow(
        workflow,
        logicId,
        currentShotScope,
        { autoConnect: false }
      )
      const otherNodes = nextWf.nodes.filter((n) => n.id !== spawnedNode.id)
      const resolved = resolveNodeCollisionPush(spawnedNode, worldPos, otherNodes)
      const positionedNode = { ...spawnedNode, position: resolved }

      // Tìm chân cắm tương thích giữa sourceNode và spawnedNode
      const nodeSpec = WORKFLOW_NODE_SPECS[spawnedNode.type]
      let edgeToAdd: WorkflowEdge | null = null

      if (isSourceOutput) {
        const candidateInputs = nodeSpec?.inputs ?? []
        const matchedInPort = candidateInputs.find(
          (p) => validateWorkflowConnection(sourceNode, sourcePort, positionedNode, p).valid
        )
        if (matchedInPort) {
          edgeToAdd = {
            id: `edge-${sourceNode.id}-${sourcePort}-${positionedNode.id}-${matchedInPort}`,
            fromNode: sourceNode.id,
            fromPort: sourcePort,
            toNode: positionedNode.id,
            toPort: matchedInPort
          }
        }
      } else {
        const candidateOutputs = nodeSpec?.outputs ?? []
        const matchedOutPort = candidateOutputs.find(
          (p) => validateWorkflowConnection(positionedNode, p, sourceNode, sourcePort).valid
        )
        if (matchedOutPort) {
          edgeToAdd = {
            id: `edge-${positionedNode.id}-${matchedOutPort}-${sourceNode.id}-${sourcePort}`,
            fromNode: positionedNode.id,
            fromPort: matchedOutPort,
            toNode: sourceNode.id,
            toPort: sourcePort
          }
        }
      }

      if (!edgeToAdd) {
        showToast('Không tìm thấy cổng tương thích. Chưa tạo khối mới.')
        return
      }
      const finalNodes = nextWf.nodes.map((n) => (n.id === positionedNode.id ? positionedNode : n))
      const finalEdges = edgeToAdd ? [...nextWf.edges, edgeToAdd] : nextWf.edges
      const finalWf: WorkflowGraph = {
        ...nextWf,
        nodes: finalNodes,
        edges: finalEdges
      }

      commitWorkflow(finalWf, undefined, true, new Set([positionedNode.id]))
      setSelectedNodeId(positionedNode.id)
      showToast(
        edgeToAdd
          ? `✨ Đã tạo "${positionedNode.title}" và tự động nối dây vào "${sourceNode.title}"!`
          : `🧩 Đã tạo "${positionedNode.title}" tại vị trí chuột!`
      )
    },
    [workflow, currentShotScope, commitWorkflow, showToast]
  )

  const handleSpecialAction = useCallback(
    async (
      actionId: string,
      _quickConnect: {
        sourceNode: WorkflowNode
        sourcePort: WorkflowPortKind
      }
    ) => {
      if (actionId === 'add_image_layer') {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = true
        input.onchange = async () => {
          if (input.files && input.files.length > 0) {
            await importDroppedFiles(input.files)
          }
        }
        input.click()
        return
      }
      if (actionId === 'add_particles') {
        addParticleLayer()
        showToast('✨ Đã thêm Lớp Hạt Khí Quyển vào Phân cảnh & Sơ đồ!')
        return
      }
      if (actionId === 'add_text_layer') {
        addTextLayer()
        showToast('🔤 Đã thêm Layer Chữ 2.5D vào Phân cảnh & Sơ đồ!')
        return
      }
      if (actionId === 'add_ground_layer') {
        addGroundLayer()
        showToast('⛰️ Đã thêm Mặt Đất 3D vào Phân cảnh & Sơ đồ!')
        return
      }
    },
    [showToast]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const target = workflow.nodes.find((n) => n.id === nodeId)
      if (!target) return
      if (target.type === 'layer_transform') {
        showToast('🔒 Khối Tọa độ Transform là cố định đi kèm Layer, không thể xóa lẻ!')
        return
      }

      // Khi xóa layer_assembly, đồng thời xóa luôn companion transform node đi kèm
      const companionIds =
        target.type === 'layer_assembly'
          ? workflow.edges
              .filter((e) => e.fromNode === nodeId && e.toPort === 'transform_link')
              .map((e) => e.toNode)
          : []
      const allDeleteIds = new Set([nodeId, ...companionIds])

      const shotFilter = currentShotScope !== 'all' ? currentShotScope : null
      useEditor.getState().update((draft) => {
        for (const r of target.params?.customRules ?? []) {
          applyRuleMutationToProjectLayer(draft as Project, r, false, shotFilter)
        }
        const nextNodes = workflow.nodes.filter((n) => !allDeleteIds.has(n.id))
        const nextEdges = workflow.edges.filter(
          (e) => !allDeleteIds.has(e.fromNode) && !allDeleteIds.has(e.toNode)
        )
        const nextWf: WorkflowGraph = {
          ...workflow,
          targetShotId: currentShotScope,
          nodes: nextNodes,
          edges: nextEdges
        }
        draft.workflow = nextWf
        applyWorkflowToProject(draft as Project, nextWf)
      })
      if (allDeleteIds.has(selectedNodeId ?? '')) {
        setSelectedNodeId(workflow.nodes[0]?.id ?? null)
      }
      showToast(`🗑️ Đã xóa "${target.title}" khỏi sơ đồ và ngắt hiệu ứng trên cảnh!`)
    },
    [workflow, currentShotScope, selectedNodeId, showToast]
  )

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

  return (
    <div className="wf-studio-panel" data-mcp-region="timeline_workflow">
      <WorkflowStudioToolbar
        project={project}
        workflow={workflow}
        activeNodes={activeNodes}
        disconnectedNodes={disconnectedNodes}
        blueprint={blueprint}
        selectedNode={selectedNode}
        playing={playing}
        liveTime={liveTime}
        workflowDuration={workflowDuration}
        currentShotScope={currentShotScope}
        currentShotIndex={currentShotIndex}
        sideMode={sideMode}
        onSelectNode={handleSelectNode}
        onOpenNodeConfig={handleOpenNodeConfigById}
        onSelectShotScope={handleSelectShotScope}
        onSpawnSceneLayers={handleSpawnSceneLayers}
        onSpawnLogicNode={handleSpawnLogicNode}
        onAutoWire={handleAutoWire}
        onAutoLayout={handleAutoLayout}
        onResetCanonical={handleResetCanonical}
        onClearCanvas={handleClearCanvas}
        onRewindToZero={handleRewindToZero}
        onTogglePlayFlow={handleTogglePlayFlow}
        onToggleSideMode={() => setSideMode((m) => (m === 'json' ? 'none' : 'json'))}
        onExecuteWorkflow={handleExecuteWorkflow}
      />

      {/* Main Workspace: Left Node Palette + Center Interactive Node Canvas (100% full width when sideMode !== 'json') + Optional Right JSON Panel */}
      <div className="wf-workspace-body">
        <WorkflowNodePalette
          onAddLogicNode={(id: string) => handleSpawnLogicNode(id)}
          onSpawnSceneLayers={handleSpawnSceneLayers}
          shotCount={project.shots.length}
          layerCount={project.layers.filter((l) => !l.locked).length}
        />

        <WorkflowCanvas
          workflow={workflow}
          project={scopedProject}
          playing={playing}
          time={liveTime}
          currentShotScope={currentShotScope}
          activeNodeIds={activeNodeIds}
          executionStepMap={executionStepMap}
          selectedNodeId={selectedNode?.id ?? null}
          onSelectNode={handleSelectNode}
          onOpenNodeConfig={handleOpenNodeConfig}
          onMoveNodes={handleMoveNodes}
          onAutoLayout={handleAutoLayout}
          onToggleNode={handleToggleNode}
          onDeleteNode={handleDeleteNode}
          onChangeNodePreset={handleChangeNodePreset}
          onUpdateNodeParams={handleUpdateNodeParams}
          onConnectPorts={handleConnectPorts}
          onDisconnectEdge={handleDisconnectEdge}
          onPreviewNode={handlePreviewNode}
          onDropLogicNode={(id, worldPos) => handleSpawnLogicNode(id, worldPos)}
          commitWorkflow={commitWorkflow}
          showToast={showToast}
          onSpawnAndConnectLogicNode={handleSpawnAndConnectLogicNode}
          onSpecialAction={handleSpecialAction}
        />

        {sideMode === 'json' && (
          <WorkflowSidePanel
            workflow={workflow}
            project={scopedProject}
            playing={playing}
            time={liveTime}
            blueprint={blueprint}
            selectedNode={selectedNode}
            sideMode="json"
            inspectorSubTab={inspectorSubTab}
            onChangeSideMode={setSideMode}
            onChangeInspectorSubTab={setInspectorSubTab}
            onChangeNodePreset={handleChangeNodePreset}
            onUpdateNodeDirective={handleUpdateNodeDirective}
            onUpdateNodeParams={handleUpdateNodeParams}
            onConnectPorts={handleConnectPorts}
            onDisconnectEdge={handleDisconnectEdge}
            onApplyJsonGraph={(next) => commitWorkflow(next, undefined, true)}
            onSpawnLogicNode={(id) => handleSpawnLogicNode(id)}
            activeShotLabel={activeShotLabel}
            onShowToast={showToast}
            onPreviewNode={handlePreviewNode}
          />
        )}
      </div>

      {/* Hộp thoại Cấu hình Khối khi Chuột phải / Bấm đúp / Bấm ⚙ */}
      {configNode && (
        <WorkflowNodeConfigDialog
          node={configNode}
          project={scopedProject}
          workflow={workflow}
          blueprint={blueprint}
          onClose={() => setConfigNodeId(null)}
          onChangeNodePreset={handleChangeNodePreset}
          onUpdateNodeDirective={handleUpdateNodeDirective}
          onUpdateNodeParams={handleUpdateNodeParams}
          onToggleNode={handleToggleNode}
          onDeleteNode={(id) => {
            handleDeleteNode(id)
            setConfigNodeId(null)
          }}
          onPreviewNode={handlePreviewNode}
          onConnectPorts={handleConnectPorts}
          onDisconnectEdge={handleDisconnectEdge}
          onSpawnLogicNode={(id) => handleSpawnLogicNode(id)}
          activeShotLabel={activeShotLabel}
          onShowToast={showToast}
        />
      )}
    </div>
  )
}
