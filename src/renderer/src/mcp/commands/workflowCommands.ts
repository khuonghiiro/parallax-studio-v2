import { intervalBounds, retimeTimelineIntervals, type TimelineInterval } from '../../project/timelineIntervals'
import { deleteWorkflowV2Node, detachWorkflowV2NodeFromProject } from '../../project/workflowV2Rebuild'
import { connectTimeNode, createTimeNode, isTimeNode } from '../../project/workflowTiming'
import { moveTimelineLayers } from '../../project/timelineTiming'
import { addTimelineLogic } from '../../project/timelineLogic'
import type { WorkflowNode } from '@shared/types'
import { evaluateNodeDraft, patchNodeDraft } from '../../project/workflowNodeDraft'
import { getWorkflowNodePorts } from '../../project/workflowNodePorts'
import { getWorkflowRouting } from '../../project/workflowRouting'
import type {
  Project,
  WorkflowGraph,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS
} from '../../project/workflowCatalog'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_SUBPART_CATALOG,
  applyWorkflowToProject,
  autoWireWorkflowNodes,
  compileWorkflowBlueprint,
  connectWorkflowPort,
  disconnectWorkflowEdge,
  ensureProjectWorkflow,
  getDefaultPartsForNode,
  getWorkflowFromTemplate,
  listProjectBindableTargets,
  validateAndNormalizeWorkflowJson
} from '../../project/workflowEngine'
import {
  applyModularWorkflowJson,
  buildMainWorkflowJson,
  buildModularWorkflowBundle,
  buildShotWorkflowJson,
  layoutWorkflowV2Tree,
  recomputeSharedLogicTargets,
  shotIdAtTime,
  syncWorkflowV2NodeToProject,
  validateWorkflowV2Connection
} from '../../project/workflowV2Engine'
import { bool, has, num, str } from '../params'
import { ParamError, type Handler } from '../types'

const ed = () => useEditor.getState()
const proj = () => ed().project

export const workflowCommands: Record<string, Handler> = {
  list_workflow_presets: () => {
    const nodeTypes = Object.values(WORKFLOW_NODE_SPECS).map((n) => ({
      type: n.type,
      step_order: n.stepOrder,
      title: n.title,
      ai_agent_role: n.aiAgentRole,
      inputs: n.inputs,
      outputs: n.outputs,
      sub_parts: WORKFLOW_SUBPART_CATALOG[n.type] ?? [],
      presets: n.presets.map((p) => ({
        id: p.id,
        label: p.label,
        summary: p.summary,
        recommended_mcp_tools: p.recommendedMcpTools
      }))
    }))
    const ports = Object.values(WORKFLOW_PORT_SPECS)
    const logicNodes = WORKFLOW_LOGIC_NODE_CATALOG.map((item) => ({
      id: item.id,
      category: item.category,
      category_label: item.categoryLabel,
      node_type: item.nodeType,
      icon: item.icon,
      title: item.title,
      short_label: item.shortLabel,
      preset: item.preset,
      description: item.description,
      operations: item.buildRules?.().map((rule) => ({ action: rule.actionKind, speed: rule.speed, amount: rule.amount })) ?? []
    }))
    return {
      presets: [],
      templates: [],
      node_types: nodeTypes,
      nodeTypes,
      ports,
      logic_nodes: logicNodes,
      logicNodes
    }
  },

  get_workflow: (p) => {
    const project = proj()
    const workflow = ensureProjectWorkflow(project)
    const blueprint = compileWorkflowBlueprint(workflow, project)
    const bindableTargets = listProjectBindableTargets(project)
    const bundle = buildModularWorkflowBundle(project, workflow)
    const requestedShotId = str(p, 'shot_id')
    const activeShotId = requestedShotId || shotIdAtTime(project, ed().time) || project.shots[0]?.id || null
    const activeShotJson = activeShotId ? (bundle.shots[activeShotId] ?? buildShotWorkflowJson(project, activeShotId, workflow)) : null
    return {
      timeline_tab: useView.getState().timelineTab,
      active_shot_id: activeShotId,
      main_json: bundle.main,
      shot_json: activeShotJson,
      shot_jsons: bundle.shots,
      modular_files: bundle.files,
      workflow,
      node_io: workflow.nodes.map((node) => ({
        node_id: node.id,
        enabled: node.enabled,
        executable: blueprint.agents.some((agent) => agent.nodeId === node.id),
        ...getWorkflowNodePorts(node),
        routing: getWorkflowRouting(node, workflow)
      })),
      bindable_targets: bindableTargets,
      bindableTargets,
      ai_blueprint: blueprint,
      aiBlueprint: blueprint
    }
  },

  retime_layers: (p) => {
    if (Array.isArray(p.intervals)) {
      const items = p.intervals as TimelineInterval[]
      const mode = str(p, 'mode')
      if (!['shift', 'align', 'in', 'out'].includes(mode ?? '')) throw new ParamError('Invalid interval mode')
      if (!items.length || items.some(i => !i || !['layer', 'keys', 'effect'].includes(i.kind) || !intervalBounds(proj(), i)))
        throw new ParamError('Unknown, locked or invalid timeline interval')
      ed().update(d => retimeTimelineIntervals(d as Project, items, mode as 'shift' | 'align' | 'in' | 'out', num(p, 'seconds', true)!))
      return { ok: true, intervals: items.map(i => ({ ...i, ...intervalBounds(proj(), i) })) }
    }
    if (!Array.isArray(p.layer_ids) || !p.layer_ids.length) throw new ParamError('layer_ids is required')
    const ids = p.layer_ids.map(String)
    if (ids.some(id => !proj().layers.some(l => l.id === id))) throw new ParamError('Unknown layer ID')
    const mode = str(p, 'mode')
    if (mode !== 'shift' && mode !== 'align') throw new ParamError('Layer IDs require shift or align; use intervals for IN/OUT')
    ed().update(d => moveTimelineLayers(d as Project, ids, num(p, 'seconds', true)!, mode))
    return { ok: true, layers: proj().layers.filter(l => ids.includes(l.id)).map(l => ({ id: l.id, inPoint: l.inPoint, outPoint: l.outPoint })) }
  },
  set_workflow: (p) => {
    if (bool(p, 'delete_node')) {
      const nodeId = str(p, 'node_id', true)!
      ed().update(d => {
        d.workflow = structuredClone(ensureProjectWorkflow(proj()))
        deleteWorkflowV2Node(d as Project, nodeId)
      }, 'mcp-delete-workflow-node')
      return { ok: true, workflow: ensureProjectWorkflow(proj()) }
    }
    if (bool(p, 'create_time')) {
      const node = createTimeNode(proj())
      ed().update(d => { const wf = ensureProjectWorkflow(proj()); d.workflow = { ...wf, nodes: [...wf.nodes, node] } })
      return { ok: true, node_id: node.id }
    }
    if (has(p, 'logic_id')) {
      let nodeId = ''
      ed().update((draft) => {
        nodeId = addTimelineLogic(draft, str(p, 'logic_id', true)!, str(p, 'layer_id'), str(p, 'shot_id'))
      })
      return { ok: true, node_id: nodeId, workflow: ensureProjectWorkflow(proj()) }
    }
    const tab = str(p, 'tab')
    const switchToTab = bool(p, 'switch_to_tab')
    if (tab === 'timeline' || tab === 'workflow') {
      useView.getState().setTimelineTab(tab)
    } else if (switchToTab) {
      useView.getState().setTimelineTab('workflow')
    }

    const modularRaw = p.main_json ?? p.shot_json ?? p.bundle_json
    const rawJson = modularRaw ?? p.workflow_json ?? p.workflow ?? p.json
    const isModularPayload = (() => {
      if (modularRaw !== undefined) return true
      if (!rawJson) return false
      try {
        const obj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson
        return Boolean(
          obj &&
            typeof obj === 'object' &&
            (obj.kind === 'parallax-workflow-main' ||
              obj.kind === 'parallax-workflow-shot' ||
              obj.kind === 'parallax-workflow-bundle' ||
              (obj.shot && Array.isArray(obj.logic)) ||
              (Array.isArray(obj.route) && Array.isArray(obj.connections)))
        )
      } catch {
        return false
      }
    })()

    if (isModularPayload && rawJson !== undefined) {
      let applyRes: ReturnType<typeof applyModularWorkflowJson> | undefined
      ed().update((d) => {
        applyRes = applyModularWorkflowJson(d as Project, rawJson, str(p, 'shot_id'))
      }, 'mcp-set-modular-workflow')
      const updated = ensureProjectWorkflow(proj())
      const blueprint = compileWorkflowBlueprint(updated, proj())
      return {
        ok: true,
        modular_result: applyRes,
        timeline_tab: useView.getState().timelineTab,
        workflow: updated,
        main_json: buildMainWorkflowJson(proj(), updated),
        ai_blueprint: blueprint,
        aiBlueprint: blueprint
      }
    }

    const presetId = str(p, 'preset_id') || (has(p, 'node_id') ? undefined : str(p, 'preset'))
    const nodeId = str(p, 'node_id')
    const autoWire = bool(p, 'auto_wire')

    if (!presetId && rawJson === undefined && !nodeId && !tab && switchToTab === undefined && autoWire === undefined) {
      throw new ParamError('Provide "preset_id", "workflow", "node_id", "auto_wire", or "tab"')
    }

    let previousNode: WorkflowNode | undefined
    let editedNode: WorkflowNode | undefined
    let current: WorkflowGraph
    if (presetId) {
      current = structuredClone(getWorkflowFromTemplate(presetId))
    } else if (rawJson !== undefined) {
      current = validateAndNormalizeWorkflowJson(rawJson)
    } else {
      current = structuredClone(ensureProjectWorkflow(proj()))
    }

    if (nodeId) {
      const normalizedQuery = nodeId.replace(/^node-/, 'wf-')
      const target = current.nodes.find(
        (n) =>
          n.id === nodeId ||
          n.id === normalizedQuery ||
          n.type === nodeId ||
          n.type.startsWith(nodeId.replace(/^(node-|wf-)/, ''))
      )
      if (!target) {
        throw new ParamError(
          `Workflow node "${nodeId}" not found. Available: ${current.nodes.map((n) => `${n.id} (${n.type})`).join(', ')}`
        )
      }
      previousNode = structuredClone(target)
      editedNode = target
      target.params = { ...target.params, configurationMode: 'explicit' }
      const nodePreset = str(p, 'node_preset') || str(p, 'preset')
      if (nodePreset) {
        const spec = WORKFLOW_NODE_SPECS[target.type]
        const foundPreset = spec?.presets.find((pr) => pr.id === nodePreset)
        if (!foundPreset) {
          throw new ParamError(
            `Invalid preset "${nodePreset}" for node "${target.type}". Available: ${spec?.presets.map((pr) => pr.id).join(', ')}`
          )
        }
        target.preset = foundPreset.id
        if (!has(p, 'ai_directive')) target.aiDirective = foundPreset.defaultDirective
        target.params = {
          ...(target.params ?? {}),
          ...foundPreset.defaultParams,
          targetParts: getDefaultPartsForNode({ type: target.type, preset: foundPreset.id })
        }
      }
      if (has(p, 'enabled')) target.enabled = bool(p, 'enabled')!
      if (has(p, 'ai_directive')) target.aiDirective = str(p, 'ai_directive')!
      if (has(p, 'intensity')) {
        target.params = { ...(target.params ?? {}), intensity: num(p, 'intensity')! }
      }
      if (has(p, 'target_mode')) {
        const mode = str(p, 'target_mode') === 'custom' ? 'custom' : 'auto'
        target.params = { ...(target.params ?? {}), targetMode: mode }
      }
      if (Array.isArray(p.target_layer_ids)) {
        const ids = p.target_layer_ids.map(String).filter(Boolean)
        target.params = {
          ...(target.params ?? {}),
          targetMode: 'custom',
          targetLayerIds: ids
        }
      }
      if (Array.isArray(p.target_parts)) {
        const parts = p.target_parts.map(String).filter(Boolean)
        target.params = { ...(target.params ?? {}), targetParts: parts }
      }
    }

    if (editedNode && p.node_params !== undefined) {
      const params = typeof p.node_params === 'string' ? JSON.parse(p.node_params) : p.node_params
      if (!params || typeof params !== 'object' || Array.isArray(params)) throw new ParamError('node_params must be a JSON object')
      editedNode.params = {
        ...patchNodeDraft(editedNode, params).params,
        ...(params as Record<string, unknown>)
      }
    }
    if (bool(p, 'apply_node') && (!editedNode || !previousNode)) throw new ParamError('apply_node requires node_id')

    if (autoWire) {
      current = autoWireWorkflowNodes(current)
    }

    if (bool(p, 'apply_node') && editedNode && previousNode) {
      const next = evaluateNodeDraft(proj(), current, editedNode, previousNode)
      ed().update((d) => {
        Object.assign(d, next)
        if (current.presetId === 'v2_scene_hierarchy' && editedNode) {
          syncWorkflowV2NodeToProject(d as Project, editedNode)
        }
      })
    } else {
      ed().update((d) => {
        d.workflow = current
        if (current.presetId === 'v2_scene_hierarchy' && editedNode) {
          syncWorkflowV2NodeToProject(d as Project, editedNode)
        }
      }, 'mcp-set-workflow')
    }

    const updated = ensureProjectWorkflow(proj())
    const blueprint = compileWorkflowBlueprint(updated, proj())
    return {
      ok: true,
      timeline_tab: useView.getState().timelineTab,
      workflow: updated,
      ai_blueprint: blueprint,
      aiBlueprint: blueprint
    }
  },

  connect_workflow_ports: (p) => {
    const action = (str(p, 'action') ?? 'connect') as 'connect' | 'disconnect' | 'auto_wire' | 'clear'
    let next = structuredClone(ensureProjectWorkflow(proj()))

    const resolveNode = (query: string) => {
      const clean = query.replace(/^(node-|wf-)/, '')
      return next.nodes.find(
        (n) => n.id === query || n.type === query || n.id === `wf-${clean}` || n.type.startsWith(clean)
      )
    }

    if (action === 'auto_wire') {
      next = autoWireWorkflowNodes(next)
    } else if (action === 'clear') {
      next = { ...next, edges: [] }
    } else if (action === 'connect') {
      const fromNode = str(p, 'from_node', true)!
      const toNode = str(p, 'to_node', true)!
      const fromSrc = resolveNode(fromNode)
      const toDst = resolveNode(toNode)
      if (!fromSrc || !toDst) {
        throw new ParamError(`Invalid from_node "${fromNode}" or to_node "${toNode}"`)
      }
      if (isTimeNode(fromSrc)) {
        next = connectTimeNode(next, fromSrc.id, toDst.id)
      } else if (next.presetId === 'v2_scene_hierarchy') {
        const check = validateWorkflowV2Connection(next, fromSrc.id, toDst.id)
        if (!check.valid) {
          throw new ParamError(check.reason ?? 'Invalid Workflow V2 connection')
        }
        const defaultPort = WORKFLOW_NODE_SPECS[fromSrc.type]?.outputs[0] ?? 'layers_tree'
        const fromPort = (str(p, 'from_port') || str(p, 'port') || defaultPort) as WorkflowPortKind
        const toPort = (str(p, 'to_port') || str(p, 'port') || fromPort) as WorkflowPortKind
        const isDstLayerOrGroup = toDst.type === 'layer_assembly' || toDst.type === 'camera_director'
        const baseEdges = isDstLayerOrGroup
          ? next.edges.filter((e) => e.toNode !== toDst.id)
          : next.edges
        const nextEdges = [
          ...baseEdges,
          {
            id: `e-${fromSrc.id}-${toDst.id}`,
            fromNode: fromSrc.id,
            fromPort,
            toNode: toDst.id,
            toPort
          }
        ]
        const synced = recomputeSharedLogicTargets(next.nodes, nextEdges)
        next = {
          ...next,
          nodes: layoutWorkflowV2Tree(synced, nextEdges),
          edges: nextEdges
        }
      } else {
        const defaultPort = WORKFLOW_NODE_SPECS[fromSrc.type]?.outputs[0] ?? 'scene_ctx'
        const fromPort = (str(p, 'from_port') || str(p, 'port') || defaultPort) as WorkflowPortKind
        const toPort = (str(p, 'to_port') || str(p, 'port') || fromPort) as WorkflowPortKind
        next = connectWorkflowPort(next, fromSrc.id, fromPort, toDst.id, toPort)
      }
    } else if (action === 'disconnect') {
      const fromQ = str(p, 'from_node')
      const toQ = str(p, 'to_node')
      next = disconnectWorkflowEdge(next, {
        edgeId: str(p, 'edge_id') ?? undefined,
        fromNode: fromQ ? (resolveNode(fromQ)?.id ?? fromQ) : undefined,
        fromPort: str(p, 'from_port') ?? str(p, 'port') ?? undefined,
        toNode: toQ ? (resolveNode(toQ)?.id ?? toQ) : undefined,
        toPort: str(p, 'to_port') ?? str(p, 'port') ?? undefined
      })
      if (next.presetId === 'v2_scene_hierarchy') {
        next.nodes = recomputeSharedLogicTargets(next.nodes, next.edges)
      }
    } else {
      throw new ParamError(`Unknown action "${action}". Expected connect, disconnect, auto_wire, or clear.`)
    }

    ed().update((d) => {
      if (next.presetId === 'v2_scene_hierarchy' && (action === 'disconnect' || action === 'clear')) {
        const previous = ensureProjectWorkflow(proj())
        const removedTargets = new Set(previous.edges.filter(e => e.fromPort !== 'time_range' && !next.edges.some(n => n.id === e.id)).map(e => e.toNode))
        for (const node of previous.nodes) {
          if (removedTargets.has(node.id)) detachWorkflowV2NodeFromProject(d as Project, node, false)
        }
      }
      d.workflow = next
      if (next.presetId === 'v2_scene_hierarchy') {
        for (const n of next.nodes) {
          if (n.params?.logicCategory !== 'collision') {
            syncWorkflowV2NodeToProject(d as Project, n)
          }
        }
        for (const n of next.nodes) {
          if (n.params?.logicCategory === 'collision') {
            syncWorkflowV2NodeToProject(d as Project, n)
          }
        }
      } else {
        applyWorkflowToProject(d as Project, next)
      }
    }, 'mcp-wf-ports')

    const blueprint = compileWorkflowBlueprint(next, proj())
    return {
      ok: true,
      action,
      edges_count: next.edges.length,
      workflow: next,
      ai_blueprint: blueprint,
      aiBlueprint: blueprint
    }
  },

  apply_workflow: (p) => {
    const presetId = str(p, 'preset_id') || str(p, 'preset')
    const modularRaw = p.main_json ?? p.shot_json ?? p.bundle_json
    const rawJson = modularRaw ?? p.workflow_json ?? p.workflow ?? p.json
    const switchTab = bool(p, 'open_workflow_tab') ?? bool(p, 'switch_to_tab')

    if (switchTab) {
      useView.getState().setTimelineTab('workflow')
    }

    if (modularRaw !== undefined) {
      let applyRes: ReturnType<typeof applyModularWorkflowJson> | undefined
      ed().update((d) => {
        applyRes = applyModularWorkflowJson(d as Project, modularRaw, str(p, 'shot_id'))
      }, 'Áp dụng Modular Workflow JSON')
      return {
        ok: true,
        modular_result: applyRes,
        workflow: ensureProjectWorkflow(proj())
      }
    }

    let targetWorkflow: WorkflowGraph
    if (presetId) {
      targetWorkflow = getWorkflowFromTemplate(presetId)
    } else if (rawJson !== undefined) {
      targetWorkflow = validateAndNormalizeWorkflowJson(rawJson)
    } else {
      targetWorkflow = ensureProjectWorkflow(proj())
    }

    let report = applyWorkflowToProject(structuredClone(proj()), targetWorkflow)
    ed().update((d) => {
      report = applyWorkflowToProject(d as Project, targetWorkflow)
      if (targetWorkflow.presetId === 'v2_scene_hierarchy') {
        for (const n of targetWorkflow.nodes) {
          if (n.params?.logicCategory !== 'collision') {
            syncWorkflowV2NodeToProject(d as Project, n)
          }
        }
        for (const n of targetWorkflow.nodes) {
          if (n.params?.logicCategory === 'collision') {
            syncWorkflowV2NodeToProject(d as Project, n)
          }
        }
      }
    }, `Áp dụng Workflow: ${targetWorkflow.name}`)

    return {
      ...report,
      report
    }
  }
}
