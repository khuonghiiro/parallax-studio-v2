import type { WorkflowNode } from '@shared/types'
import { evaluateNodeDraft, patchNodeDraft } from '../../project/workflowNodeDraft'
import type {
  Project,
  WorkflowGraph,
  WorkflowPortKind
} from '@shared/types'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS,
  WORKFLOW_TEMPLATES
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
      description: item.description
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

  get_workflow: () => {
    const project = proj()
    const workflow = ensureProjectWorkflow(project)
    const blueprint = compileWorkflowBlueprint(workflow, project)
    const bindableTargets = listProjectBindableTargets(project)
    return {
      timeline_tab: useView.getState().timelineTab,
      workflow,
      bindable_targets: bindableTargets,
      bindableTargets,
      ai_blueprint: blueprint,
      aiBlueprint: blueprint
    }
  },

  set_workflow: (p) => {
    const tab = str(p, 'tab')
    const switchToTab = bool(p, 'switch_to_tab')
    if (tab === 'timeline' || tab === 'workflow') {
      useView.getState().setTimelineTab(tab)
    } else if (switchToTab) {
      useView.getState().setTimelineTab('workflow')
    }

    const presetId = str(p, 'preset_id') || (has(p, 'node_id') ? undefined : str(p, 'preset'))
    const rawJson = p.workflow_json ?? p.workflow ?? p.json
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
      editedNode.params = patchNodeDraft(editedNode, params).params
    }
    if (bool(p, 'apply_node') && (!editedNode || !previousNode)) throw new ParamError('apply_node requires node_id')

    if (autoWire) {
      current = autoWireWorkflowNodes(current)
    }

    if (bool(p, 'apply_node') && editedNode && previousNode) {
      const next = evaluateNodeDraft(proj(), current, editedNode, previousNode)
      ed().update((d) => { Object.assign(d, next) })
    } else {
      ed().update((d) => { d.workflow = current }, 'mcp-set-workflow')
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
      const defaultPort = WORKFLOW_NODE_SPECS[fromSrc.type]?.outputs[0] ?? 'scene_ctx'
      const fromPort = (str(p, 'from_port') || str(p, 'port') || defaultPort) as WorkflowPortKind
      const toPort = (str(p, 'to_port') || str(p, 'port') || fromPort) as WorkflowPortKind
      next = connectWorkflowPort(next, fromSrc.id, fromPort, toDst.id, toPort)
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
    } else {
      throw new ParamError(`Unknown action "${action}". Expected connect, disconnect, auto_wire, or clear.`)
    }

    ed().update((d) => {
      d.workflow = next
      applyWorkflowToProject(d as Project, next)
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
    const rawJson = p.workflow_json ?? p.workflow ?? p.json
    const switchTab = bool(p, 'open_workflow_tab') ?? bool(p, 'switch_to_tab')

    if (switchTab) {
      useView.getState().setTimelineTab('workflow')
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
    }, `Áp dụng Workflow: ${targetWorkflow.name}`)

    return {
      ...report,
      report
    }
  }
}
