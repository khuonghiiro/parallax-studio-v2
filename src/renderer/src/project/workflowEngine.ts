import { autoWireScopedWorkflow } from './workflowAutoWire'
import { syncWorkflowCameraModifiers } from './workflowCameraModifiers'
import type {
  Layer,
  Project,
  WorkflowAiAgentStep,
  WorkflowAiBlueprint,
  WorkflowEdge,
  WorkflowExecutionReport,
  WorkflowExecutionStageResult,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'
import { generatePresetSpatialTracks } from '../animation/motionPresets'
import { applyMotionTracksToGroup, findMotionTargetGroup } from '../animation/motionEngine'
import { createGroundLayer, createParticleLayer, createShot } from './factory'
import {
  CANONICAL_NODE_ORDER,
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS,
  WORKFLOW_TEMPLATES,
  createCanonicalWorkflow,
  buildStandardEdges,
  isLegacyCrampedWorkflowLayout,
  upgradeCrampedNodePositions
} from './workflowCatalog'
import {
  WORKFLOW_SUBPART_CATALOG,
  classifyLayerRole,
  getDefaultPartsForNode,
  getNodeSubParts,
  listProjectBindableTargets,
  resolveNodeTargetBinding
} from './workflowTargets'
import {
  applyCustomNodeRulesToProject,
  applyRuleMutationToProjectLayer,
  deactivateDisconnectedWorkflowStages,
  isForegroundFrameBorderLayer,
  pickShotFocalLayer,
  rebalanceChildLayerRigEdges,
  syncWorkflowFromProject
} from './workflowStageEffects'
import {
  executeAudioLipSyncStage,
  executeCameraDirectorStage,
  executeLookOutputStage,
  syncWorkflowEntityVisibility
} from './workflowEntitySync'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  resolveNodeShotScope,
  spawnLogicNodeIntoWorkflow,
  validateAndNormalizeWorkflowJson,
  type WorkflowLogicNodeCatalogItem
} from './workflowLogicNodes'
import { validateWorkflowConnection } from './workflowConnectionRules'
import { resolveConnectedWorkflowNodes } from './workflowExecutionOrder'
import { getWorkflowRouting } from './workflowRouting'
import { reconcileWorkflowV2WithProject } from './workflowV2Engine'
export { resolveConnectedWorkflowNodes } from './workflowExecutionOrder'

export {
  WORKFLOW_SUBPART_CATALOG,
  applyRuleMutationToProjectLayer,
  classifyLayerRole,
  getDefaultPartsForNode,
  getNodeSubParts,
  listProjectBindableTargets,
  resolveNodeTargetBinding,
  syncWorkflowFromProject,
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  spawnLogicNodeIntoWorkflow,
  validateAndNormalizeWorkflowJson,
  type WorkflowLogicNodeCatalogItem
}

export function createDefaultWorkflow(): WorkflowGraph {
  return createCanonicalWorkflow()
}

export function getWorkflowFromTemplate(_presetId?: string): WorkflowGraph {
  return createCanonicalWorkflow()
}

export function ensureProjectWorkflow(project: Project): WorkflowGraph {
  if (project.workflow && project.workflow.presetId === 'v2_scene_hierarchy') {
    return reconcileWorkflowV2WithProject(project, project.workflow)
  }
  const raw =
    project.workflow && Array.isArray(project.workflow.nodes)
      ? isLegacyCrampedWorkflowLayout(project.workflow.nodes)
        ? {
            ...project.workflow,
            nodes: upgradeCrampedNodePositions(project.workflow.nodes)
          }
        : project.workflow
      : createDefaultWorkflow()
  return syncWorkflowFromProject(project, raw)
}

/**
 * Tự động nối tất cả các Node đang bật theo chuẩn quy trình tạo video chuyên nghiệp.
 */
export function autoWireWorkflowNodes(workflow: WorkflowGraph): WorkflowGraph {
  return autoWireScopedWorkflow(workflow)
}

/**
 * Kết nối một cổng đầu ra (fromPort) của Node nguồn tới cổng đầu vào (toPort) của Node đích.
 * Bắt buộc tuân thủ nghiêm ngặt Ma trận Kiểm tra Tương thích Ngữ nghĩa (Semantic Compatibility Matrix).
 */
export function connectWorkflowPort(
  workflow: WorkflowGraph,
  fromNodeId: string,
  fromPort: WorkflowPortKind,
  toNodeId: string,
  toPort: WorkflowPortKind
): WorkflowGraph {
  if (fromNodeId === toNodeId) return workflow
  const fromNode = workflow.nodes.find((n) => n.id === fromNodeId || n.type === fromNodeId)
  const toNode = workflow.nodes.find((n) => n.id === toNodeId || n.type === toNodeId)
  if (!fromNode || !toNode) {
    throw new Error(`Không tìm thấy Khối khi kết nối ${fromNodeId}:${fromPort} -> ${toNodeId}:${toPort}`)
  }

  const validation = validateWorkflowConnection(fromNode, fromPort, toNode, toPort)
  if (!validation.valid) {
    throw new Error(validation.reason || `Kết nối không hợp lệ giữa "${fromNode.title}" và "${toNode.title}".`)
  }

  // Nếu cổng đích chỉ chấp nhận 1 dây vào duy nhất (ví dụ layers_tree hoặc transform_link):
  // Tự động gỡ dây cũ trước khi cắm dây mới vào để tránh đa liên kết sai logic
  let currentEdges = workflow.edges
  if (toPort === 'layers_tree' || toPort === 'transform_link') {
    currentEdges = currentEdges.filter((e) => !(e.toNode === toNode.id && e.toPort === toPort))
  }

  const exists = currentEdges.some(
    (e) =>
      e.fromNode === fromNode.id &&
      e.fromPort === fromPort &&
      e.toNode === toNode.id &&
      e.toPort === toPort
  )
  if (exists) return { ...workflow, edges: currentEdges }

  const newEdge: WorkflowEdge = {
    id: `edge-${fromNode.id}-${fromPort}-${toNode.id}-${toPort}`,
    fromNode: fromNode.id,
    fromPort,
    toNode: toNode.id,
    toPort
  }

  return {
    ...workflow,
    edges: [...currentEdges, newEdge]
  }
}

/**
 * Ngắt kết nối một cạnh (Edge) hoặc cổng giữa 2 Node.
 */
export function disconnectWorkflowEdge(
  workflow: WorkflowGraph,
  filter: {
    edgeId?: string
    fromNode?: string
    fromPort?: string
    toNode?: string
    toPort?: string
  }
): WorkflowGraph {
  const resolveId = (idOrType?: string): string | undefined => {
    if (!idOrType) return undefined
    const found = workflow.nodes.find((n) => n.id === idOrType || n.type === idOrType)
    return found ? found.id : idOrType
  }
  const fNode = resolveId(filter.fromNode)
  const tNode = resolveId(filter.toNode)

  const nextEdges = workflow.edges.filter((e) => {
    if (filter.edgeId && e.id === filter.edgeId) return false
    const matchFrom = !fNode || e.fromNode === fNode
    const matchFromPort = !filter.fromPort || e.fromPort === filter.fromPort
    const matchTo = !tNode || e.toNode === tNode
    const matchToPort = !filter.toPort || e.toPort === filter.toPort
    if ((filter.fromNode || filter.toNode || filter.fromPort || filter.toPort) && matchFrom && matchFromPort && matchTo && matchToPort) {
      return false
    }
    return true
  })

  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => getWorkflowRouting(node, workflow).layerIds.length
      ? { ...node, params: { ...node.params, requireLayerConnection: true } } : node),
    edges: nextEdges
  }
}

/**
 * Biên dịch đồ thị Workflow thành bản thiết kế Tác nhân Logic (AI Blueprint)
 * để AI Agent (qua MCP) hiểu chính xác luồng xử lý, vai trò tác nhân và các lệnh MCP tương ứng.
 */
export function compileWorkflowBlueprint(workflow: WorkflowGraph, project?: Project): WorkflowAiBlueprint {
  const { activeNodes, disconnectedNodes } = resolveConnectedWorkflowNodes(workflow)
  const nodeById = new Map(workflow.nodes.map((n) => [n.id, n]))
  const activeSet = new Set(activeNodes.map((n) => n.id))

  const agents: WorkflowAiAgentStep[] = activeNodes.map((node, idx) => {
    const spec = WORKFLOW_NODE_SPECS[node.type]
    const presetSpec = spec?.presets.find((p) => p.id === node.preset) ?? spec?.presets[0]
    const rawBinding = resolveNodeTargetBinding(node, project, workflow)
    const targetShotFilter = resolveNodeShotScope(node, workflow)
    const binding = {
      ...rawBinding,
      matchesLayer: (l: Layer) =>
        rawBinding.matchesLayer(l) && (!targetShotFilter || !l.shotId || l.shotId === targetShotFilter)
    }

    const inputsFrom = workflow.edges
      .filter((e) => e.toNode === node.id && activeSet.has(e.fromNode))
      .map((e) => ({
        nodeId: e.fromNode,
        nodeTitle: nodeById.get(e.fromNode)?.title ?? e.fromNode,
        port: e.fromPort
      }))

    const outputsTo = workflow.edges
      .filter((e) => e.fromNode === node.id && activeSet.has(e.toNode))
      .map((e) => ({
        nodeId: e.toNode,
        nodeTitle: nodeById.get(e.toNode)?.title ?? e.toNode,
        port: e.toPort
      }))

    const activeParts = binding.activeParts.map((p) => ({
      id: p.id,
      label: p.label,
      shortLabel: p.shortLabel,
      category: p.category
    }))

    return {
      step: idx + 1,
      nodeId: node.id,
      nodeType: node.type,
      title: node.title,
      aiAgentRole: node.aiAgentRole,
      preset: node.preset,
      presetLabel: presetSpec?.label ?? node.preset,
      summary: presetSpec?.summary ?? '',
      aiDirective: node.aiDirective || presetSpec?.defaultDirective || '',
      inputsFrom,
      outputsTo,
      boundTargets: binding.boundTargets,
      activeParts,
      recommendedMcpTools: presetSpec?.recommendedMcpTools ?? [],
      mcpActionHint: {
        ...(presetSpec?.mcpHint ?? {}),
        ...(node.params ?? {}),
        targetMode: binding.mode,
        boundEntities: binding.boundTargets.map((t) => `${t.name} [${t.roleLabel}]`),
        activeSubParts: activeParts.map((p) => p.shortLabel),
        ...(project
          ? {
              projectShots: project.shots.length,
              projectLayers: project.layers.length
            }
          : {})
      }
    }
  })

  const hasScene = activeNodes.some((n) => n.type === 'scene_shot')
  const hasOutput = activeNodes.some((n) => n.type === 'look_output' || n.type === 'camera_director')
  const isPipelineComplete =
    hasScene &&
    hasOutput &&
    activeNodes.length >= 2 &&
    disconnectedNodes.length === 0

  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    presetId: workflow.presetId,
    description: workflow.description,
    totalNodes: workflow.nodes.length,
    connectedNodesCount: activeNodes.length,
    isPipelineComplete,
    pipelineSummary:
      agents.length > 0
        ? isPipelineComplete
          ? `✓ Luồng hoàn chỉnh (${agents.length} khâu): ${agents.map((a) => a.presetLabel || a.title).join(' ➔ ')}`
          : `Đang xử lý (${agents.length}/${workflow.nodes.length} khâu): ${agents.map((a) => a.presetLabel || a.title).join(' ➔ ')}`
        : '⛔ Chưa có khối chức năng nào được nối Port kích hoạt.',
    executionOrder: activeNodes.map((n) => n.type),
    agents
  }
}

/**
 * Thực thi trực tiếp chuỗi Node đã kết nối trong Workflow lên dữ liệu Project.
 */
export function applyWorkflowToProject(
  project: Project,
  workflowInput?: WorkflowGraph,
  opts?: { onlyNodeIds?: Set<string> }
): WorkflowExecutionReport {
  const workflow = rebalanceChildLayerRigEdges(
    workflowInput ? structuredClone(workflowInput) : structuredClone(ensureProjectWorkflow(project))
  )
  const { activeNodes, disconnectedNodes } = resolveConnectedWorkflowNodes(workflow)
  const executedStages: WorkflowExecutionStageResult[] = []

  const connectedStageTypes = new Set(activeNodes.map((n) => n.type))
  const activeNodeIdSet = new Set(activeNodes.map((n) => n.id))
  if (!opts?.onlyNodeIds) {
    deactivateDisconnectedWorkflowStages(project, connectedStageTypes)
  }
  const visibilityGraph = opts?.onlyNodeIds
    ? { ...workflow, nodes: workflow.nodes.filter((node) => opts.onlyNodeIds!.has(node.id)) } : workflow
  syncWorkflowEntityVisibility(project, visibilityGraph, activeNodeIdSet)

  // Clean up first so a disconnected operation cannot disable a later active operation's output.
  for (const dn of disconnectedNodes) {
    if (!dn.params?.logicId || (opts?.onlyNodeIds && !opts.onlyNodeIds.has(dn.id))) continue
    const binding = resolveNodeTargetBinding(dn, project, workflow)
    for (const rule of dn.params.customRules ?? []) {
      if (rule.enabled) applyRuleMutationToProjectLayer(project, rule, false, resolveNodeShotScope(dn, workflow), binding.matchesLayer)
    }
  }

  const composedMotionLayers = new WeakSet<Layer>()
  for (const node of activeNodes) {
    if (opts?.onlyNodeIds && !opts.onlyNodeIds.has(node.id)) continue
    const intensity = Math.max(0.2, Math.min(2.5, node.params?.intensity ?? 1.0))
    const rawBinding = resolveNodeTargetBinding(node, project, workflow)
    const targetShotFilter = resolveNodeShotScope(node, workflow)
    const binding = {
      ...rawBinding,
      matchesLayer: (l: Layer) =>
        rawBinding.matchesLayer(l) && (!targetShotFilter || !l.shotId || l.shotId === targetShotFilter)
    }
    const activePartIds = new Set(binding.activeParts.map((p) => p.id))
    const partNamesSummary = binding.activeParts.map((p) => p.shortLabel).slice(0, 3).join(', ')

    // A library operation owns its rules; never run the broad stage preset as well.
    if (node.params?.logicId && node.params.customRules?.length) {
      const operation = { ...node, params: { ...node.params, customRules: node.params.customRules.map((rule) =>
        ({ ...rule, amount: (rule.amount ?? 1) * intensity })) } }
      const affected = applyCustomNodeRulesToProject(project, operation, binding.matchesLayer, composedMotionLayers)
      executedStages.push({ nodeId: node.id, nodeType: node.type, title: node.title,
        aiAgentRole: node.aiAgentRole, preset: node.preset,
        appliedSummary: `${node.title} · ${affected} đối tượng theo kết nối.`, affectedCount: affected })
      continue
    }

    if (node.type === 'scene_shot') {
      let affected = 0
      if (project.shots.length === 0) {
        const s = createShot('Cảnh 1', [0, 0, 0], 0)
        project.shots.push(s)
        for (const l of project.layers) {
          if (!l.shotId) l.shotId = s.id
        }
        affected++
      }

      const zTiers =
        node.preset === 'intimate_portrait_stage'
          ? [1400, 750, 320, 0, -60]
          : [3200, 1800, 850, 280, 0, -120]

      const scopedSceneShots = targetShotFilter
        ? project.shots.filter((s) => s.id === targetShotFilter)
        : project.shots
      if (node.params?.autoArrangeZ !== false) {
        for (const shot of scopedSceneShots) {
          const standalone = project.layers.filter(
            (l) =>
              l.shotId === shot.id &&
              l.type === 'image' &&
              !l.composite &&
              !l.model3d &&
              !l.locked &&
              binding.matchesLayer(l)
          )
          const uniqueZs = new Set(standalone.map((l) => Math.round(l.transform.position.value[2] / 50)))
          if (standalone.length > 1 && uniqueZs.size <= 1) {
            standalone.forEach((l, idx) => {
              const targetZ = Math.round((zTiers[idx % zTiers.length] ?? 0) * intensity)
              l.transform.position.value[2] = targetZ
              affected++
            })
          } else {
            affected += standalone.length
          }
        }
      }

      const wantGround =
        node.params?.ensureGround ?? (node.preset === 'grounded_3d_stage' || activePartIds.has('ground_plane'))
      const targetGroundShotId = targetShotFilter ?? project.shots[0]?.id ?? null
      if (wantGround) {
        const hasGround = project.layers.some(
          (l) =>
            (!targetShotFilter || l.shotId === targetShotFilter) &&
            l.transform.rotation.value[0] <= -65
        )
        if (!hasGround) {
          const g = createGroundLayer(project.comp, 'Mặt đất 3D (Workflow)')
          g.shotId = targetGroundShotId
          project.layers.push(g)
          affected++
        }
      } else {
        project.layers = project.layers.filter(
          (l) =>
            !(l.name === 'Mặt đất 3D (Workflow)' && (!targetShotFilter || l.shotId === targetShotFilter))
        )
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Chuẩn hóa ${project.shots.length} phân cảnh · Bộ phận: ${partNamesSummary || node.preset}.`,
        affectedCount: affected
      })
    } else if (node.type === 'layer_assembly' && node.id.startsWith('wf-layer-') && !node.params?.logicId) {
      executedStages.push({ nodeId: node.id, nodeType: node.type, title: node.title, aiAgentRole: node.aiAgentRole, preset: node.preset, appliedSummary: 'Quản lý hiển thị và cấu trúc layer.', affectedCount: node.params?.targetLayerIds?.length ?? 0 })
    } else if (node.type === 'layer_assembly') {
      let affected = 0
      for (const l of project.layers) {
        if (l.locked || !binding.matchesLayer(l)) continue
        if (l.composite) {
          l.composite.lockedGroup = true
          if (l.composite.isRoot && node.preset !== 'arch3d_and_props' && activePartIds.has('root_anchor')) {
            l.autoOrient = 'camera-y'
            if (l.transform.anchor) l.transform.anchor.value = [0, -0.5, 0]
          }
          affected++
        } else if (l.model3d) {
          affected++
        } else if (classifyLayerRole(l) === 'character' || classifyLayerRole(l) === 'foliage') {
          if (l.transform.anchor && activePartIds.has('root_anchor')) {
            l.transform.anchor.value = [0, -0.5, 0]
          }
          affected++
        }
      }
      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Đồng bộ ${affected} lớp 2.5D/3D · Bộ phận: ${partNamesSummary}.`,
        affectedCount: affected
      })
    } else if (node.type === 'motion_choreography') {
      let affected = 0
      for (const l of project.layers) {
        if (l.locked || l.type === 'solid' || !binding.matchesLayer(l)) continue
        const role = classifyLayerRole(l)
        if (role === 'sky' && activePartIds.has('sky_cloud_drift')) {
          l.motion = {
            enabled: true,
            type: 'drift',
            speed: Math.round(18 * intensity),
            direction: 'right',
            loopMode: 'ping-pong',
            amount: 0.85
          }
          affected++
        } else if (role === 'foliage' && activePartIds.has('canopy_wind')) {
          l.motion = {
            enabled: true,
            type: 'wind',
            speed: Number((0.85 * intensity).toFixed(2)),
            amplitude: [Math.round(10 * intensity), Math.round(4 * intensity), 3],
            amount: 0.9
          }
          affected++
        } else if (
          role === 'character' &&
          (activePartIds.has('torso_breathe') || activePartIds.has('hair_cloth_sway')) &&
          (!l.motion || l.motion.type === 'none')
        ) {
          l.motion = {
            enabled: true,
            type: 'float',
            speed: Number((0.7 * intensity).toFixed(2)),
            amplitude: [2, Math.round(6 * intensity), 0],
            amount: 0.75
          }
          affected++
        }
      }

      if (
        (node.preset === 'character_walk_depth' || node.preset === 'dynamic_action_arc') &&
        activePartIds.has('legs_stride')
      ) {
        const focal =
          project.layers.find((l) => l.composite?.isRoot && binding.matchesLayer(l)) ??
          project.layers.find((l) => classifyLayerRole(l) === 'character' && binding.matchesLayer(l))
        if (focal) {
          const targetId = focal.composite?.instanceId || focal.id
          const group = findMotionTargetGroup(project, targetId)
          if (group && group.layers.length > 0) {
            const presetId = node.preset === 'dynamic_action_arc' ? 'jump_arc' : 'walk_into_depth'
            const tracks = generatePresetSpatialTracks(
              presetId,
              {
                position: group.centerPosition,
                rotation: group.layers[0].transform.rotation.value,
                scale: [1, 1, 1],
                opacity: group.layers[0].transform.opacity.value
              },
              {
                time: 0,
                duration: Math.min(project.comp.duration, node.params?.duration ?? 5)
              }
            )
            applyMotionTracksToGroup(group, tracks)
            affected += group.layers.length
          }
        }
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Kích hoạt hoạt họa cho ${affected} layer · Bộ phận: ${partNamesSummary}.`,
        affectedCount: affected
      })
    } else if (node.type === 'physics_fx') {
      let affected = 0
      const scopedShots = targetShotFilter
        ? project.shots.filter((s) => s.id === targetShotFilter)
        : project.shots
      const shotIdsToProcess: (string | null)[] =
        scopedShots.length > 0 ? scopedShots.map((s) => s.id) : [null]

      const explicitLightTargetIds = new Set(
        (node.params?.customRules ?? [])
          .filter((r) => r.enabled && !r.id.startsWith('inspector-'))
          .map((r) => r.targetId)
      )
      const activeFxNodes = activeNodes.filter((n) => n.type === 'physics_fx')
      const anyGlowActive = activeFxNodes.some((n) => {
        const parts = n.params?.targetParts ?? getDefaultPartsForNode(n)
        return (
          (n.preset === 'combat_elastic_glow' && parts.includes('rim_glow_silhouette')) ||
          (n.params?.customRules ?? []).some((r) => r.enabled && r.actionKind === 'rim_glow')
        )
      })
      const anyPortalActive = activeFxNodes.some((n) => {
        const parts = n.params?.targetParts ?? getDefaultPartsForNode(n)
        return n.preset === 'cave_portal_flashlight' && parts.includes('cave_depth_portal')
      })
      const anyVLightActive = activeFxNodes.some((n) => {
        const parts = n.params?.targetParts ?? getDefaultPartsForNode(n)
        return (
          parts.includes('virtual_light_core') ||
          (n.params?.customRules ?? []).some(
            (r) =>
              r.enabled &&
              (r.actionKind === 'virtual_light_candle' || r.actionKind === 'virtual_light_flashlight')
          )
        )
      })

      for (const l of project.layers) {
        if (l.locked || (targetShotFilter && l.shotId && l.shotId !== targetShotFilter)) continue
        if (!anyGlowActive && l.glow?.enabled) {
          l.glow.enabled = false
        }
        if (!anyPortalActive && l.physics?.depthPortal?.enabled) {
          l.physics.depthPortal.enabled = false
        }
        if (
          (!anyVLightActive || isForegroundFrameBorderLayer(l)) &&
          l.virtualLight?.enabled &&
          !explicitLightTargetIds.has(l.id)
        ) {
          l.virtualLight.enabled = false
        }
      }

      const focalLayers = shotIdsToProcess
        .map((sid) => pickShotFocalLayer(project, sid, binding.matchesLayer))
        .filter((l): l is Layer => Boolean(l))

      if (node.preset === 'combat_elastic_glow') {
        if (activePartIds.has('soft_mesh_jiggle') || activePartIds.has('collider_zone')) {
          for (const l of project.layers) {
            if (l.locked || l.type !== 'image' || !binding.matchesLayer(l)) continue
            const role = classifyLayerRole(l)
            if (role === 'foliage' || role === 'prop' || role === 'character') {
              l.physics = {
                enabled: true,
                material: role === 'foliage' ? 'foliage_bush' : role === 'character' ? 'flesh_body' : 'wood_tree',
                role: role === 'character' ? 'striker' : 'prop_target',
                stiffness: 1.2,
                damping: 0.25,
                bounciness: Number((1.15 * intensity).toFixed(2))
              }
              affected++
            }
          }
        }
        if (activePartIds.has('rim_glow_silhouette')) {
          for (const fl of focalLayers) {
            fl.glow = {
              enabled: true,
              side: 'outer',
              color: '#38bdf8',
              thickness: 8,
              intensity: Number((1.35 * intensity).toFixed(2)),
              animated: 'breathe',
              speed: 1.8
            }
            affected++
          }
        }
      } else if (node.preset === 'cave_portal_flashlight') {
        if (activePartIds.has('cave_depth_portal')) {
          for (const sid of shotIdsToProcess) {
            const bgLayer = project.layers.find(
              (l) =>
                l.type === 'image' &&
                (!sid || l.shotId === sid) &&
                l.transform.position.value[2] >= 600 &&
                !l.locked &&
                binding.matchesLayer(l)
            )
            if (bgLayer) {
              bgLayer.physics = {
                ...(bgLayer.physics ?? { enabled: true, material: 'stone_wall' }),
                enabled: true,
                depthPortal: {
                  enabled: true,
                  centerUV: [0.5, 0.45],
                  radiusUV: [0.35, 0.35],
                  minScale: 0.4,
                  darkness: 0.82,
                  shadowTint: '#060814',
                  depthPullZ: 140
                }
              }
              affected++
            }
          }
        }
        if (activePartIds.has('virtual_light_core')) {
          for (const fl of focalLayers) {
            fl.virtualLight = {
              enabled: true,
              kind: 'flashlight',
              color: '#fef08a',
              intensity: Number((1.55 * intensity).toFixed(2)),
              radius: 520,
              beamAngleDeg: 0,
              coneAngleDeg: 54,
              flickerSpeed: 0.6,
              zReach: 340
            }
            affected++
          }
        }
      } else {
        if (activePartIds.has('virtual_light_core')) {
          for (const fl of focalLayers) {
            fl.virtualLight = {
              enabled: true,
              kind: 'candle',
              color: '#ffbe6b',
              intensity: Number((1.35 * intensity).toFixed(2)),
              radius: 440,
              windPreset: 'gentle',
              windStrength: 0.45,
              windSensitivity: 1.0,
              flickerSpeed: 1.4,
              zReach: 300
            }
            affected++
          }
        }
      }

      if (
        (node.params?.spawnParticles || activePartIds.has('firefly_particles')) &&
        node.params?.spawnParticles !== false &&
        !project.layers.some((l) => l.type === 'particles')
      ) {
        const pLayer = createParticleLayer(project.comp)
        pLayer.name = 'Hạt Đom Đóm Khí Quyển (Workflow)'
        pLayer.shotId = scopedShots[0]?.id ?? project.shots[0]?.id ?? null
        project.layers.unshift(pLayer)
        affected++
      }

      executedStages.push({
        nodeId: node.id,
        nodeType: node.type,
        title: node.title,
        aiAgentRole: node.aiAgentRole,
        preset: node.preset,
        appliedSummary: `Thiết lập Vật lý 2.5D & FX (${affected} hạng mục) · Bộ phận: ${partNamesSummary}.`,
        affectedCount: affected
      })
    } else if (node.type === 'camera_director') {
      executedStages.push(
        executeCameraDirectorStage(
          project,
          node,
          activeNodes,
          activePartIds,
          partNamesSummary,
          intensity,
          targetShotFilter,
          workflow
        )
      )
    } else if (node.type === 'audio_lipsync') {
      executedStages.push(
        executeAudioLipSyncStage(
          project,
          node,
          activePartIds,
          partNamesSummary,
          intensity,
          binding.matchesLayer
        )
      )
    } else if (node.type === 'look_output') {
      executedStages.push(
        executeLookOutputStage(project, node, activePartIds, partNamesSummary, intensity)
      )
    }

    // Áp dụng các quy tắc Chuyển động / Tính năng tùy chỉnh (customRules) gắn trên khối này
    applyCustomNodeRulesToProject(project, node, binding.matchesLayer, composedMotionLayers)
  }

  // Tự động reset DOF và Rung lắc nếu không còn node camera nào hoạt động
  const hasActiveCameraNode = activeNodes.some((n) => n.type === 'camera_director')
  if (!hasActiveCameraNode && (!opts?.onlyNodeIds || workflow.nodes.some((node) => opts.onlyNodeIds!.has(node.id) && node.type === 'camera_director'))) {
    project.camera.dofEnabled = false
    project.camera.shakeAmount = 0
  }
  if (!opts?.onlyNodeIds || workflow.nodes.some((n) => opts.onlyNodeIds!.has(n.id) && n.type === 'camera_director')) {
    syncWorkflowCameraModifiers(project, activeNodes)
  }


  // Đảm bảo đồng bộ trạng thái hiển thị (visible) của từng Layer con & Cảnh theo đúng trạng thái ON/OFF của Node
  syncWorkflowEntityVisibility(project, visibilityGraph, activeNodeIdSet)

  workflow.lastAppliedAt = new Date().toISOString()
  project.workflow = workflow

  return {
    ok: true,
    workflowId: workflow.id,
    workflowName: workflow.name,
    executedStages,
    skippedDisconnectedNodes: disconnectedNodes.map((n) => n.id),
    blueprint: compileWorkflowBlueprint(workflow, project)
  }
}
