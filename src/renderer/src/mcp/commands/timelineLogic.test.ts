import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createShot, createImageLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { runCommand } from '../commands'
import { resolveConnectedWorkflowNodes, resolveNodeTargetBinding, ensureProjectWorkflow } from '../../project/workflowEngine'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicNodes'
import {
  getLayerTimelineLogicBadges,
  listTimelineLogicNodes,
  removeTimelineLogicNode,
  toggleTimelineLogicNode
} from '../../project/timelineLogic'

beforeEach(() => {
  const project = createProject(), shot = createShot('Cảnh thử')
  project.shots.push(shot)
  for (let i = 0; i < 2; i++) project.layers.push(createImageLayer({ id: `asset-${i}`, name: `Layer ${i}`, kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id))
  useEditor.getState().loadProject(project, null)
})

describe('timeline logic MCP parity', () => {
  it('adds a connected scoped node in one undo transaction, preserving other layers', async () => {
    const before = useEditor.getState().project
    const result = await runCommand('set_workflow', { logic_id: 'logic-physics-wind', layer_id: before.layers[0].id }) as any
    const after = useEditor.getState().project
    expect(result.ok).toBe(true)
    const node = after.workflow!.nodes.find((n) => n.id === result.node_id)!
    expect(node.params!.targetLayerIds).toEqual([before.layers[0].id])
    expect(resolveConnectedWorkflowNodes(after.workflow!).activeNodes.map((n) => n.id)).toContain(node.id)
    expect(after.layers[1]).toEqual(before.layers[1])
    expect(after.layers[0]).not.toEqual(before.layers[0])
    useEditor.getState().undo()
    expect(useEditor.getState().project).toEqual(before)
    useEditor.getState().redo()
    expect(useEditor.getState().project).toEqual(after)
  })
  it('keeps repeated adds as separate undo entries', async () => {
    const layer = useEditor.getState().project.layers[0]
    await runCommand('set_workflow', { logic_id: 'logic-physics-wind', layer_id: layer.id })
    const first = useEditor.getState().project
    await runCommand('set_workflow', { logic_id: 'logic-motion-breathe', layer_id: layer.id })
    useEditor.getState().undo()
    expect(useEditor.getState().project).toEqual(first)
  })
  it.each(WORKFLOW_LOGIC_NODE_CATALOG.map((item) => item.id))('connects catalog item %s to its context', async (id) => {
    const project = useEditor.getState().project
    const result = await runCommand('set_workflow', { logic_id: id, shot_id: project.shots[0].id }) as any
    expect(result.ok).toBe(true)
    expect(resolveConnectedWorkflowNodes(useEditor.getState().project.workflow!).activeNodes.map((n) => n.id)).toContain(result.node_id)
  })
  it('honors whole-project scope even when the workflow is scoped to a shot', async () => {
    useEditor.getState().update((draft) => {
      draft.workflow = { ...ensureProjectWorkflow(useEditor.getState().project), targetShotId: draft.shots[0].id }
      const second = createShot('Cảnh khác')
      draft.shots.push(second)
      draft.layers[1].shotId = second.id
    })
    const result = await runCommand('set_workflow', { logic_id: 'logic-physics-wind', shot_id: 'all' }) as any
    const project = useEditor.getState().project
    const node = project.workflow!.nodes.find((n) => n.id === result.node_id)!
    const binding = resolveNodeTargetBinding(node, project, project.workflow)
    expect(project.layers.every((layer) => binding.matchesLayer(layer))).toBe(true)
  })
  it('sets independent view tags through MCP and rejects empty lists', async () => {
    await runCommand('set_view', { active_views: ['animate2d', 'topview'] })
    expect(useView.getState().activeViews).toEqual(['animate2d', 'topview'])
    await expect(runCommand('set_view', { active_views: [] })).rejects.toThrow()
  })
  it('lists, toggles, removes and extracts layer timeline logic badges', async () => {
    const layer0 = useEditor.getState().project.layers[0]
    const res = (await runCommand('set_workflow', {
      logic_id: 'logic-fx-candle',
      layer_id: layer0.id
    })) as any
    const proj1 = useEditor.getState().project
    const wf1 = ensureProjectWorkflow(proj1)
    const entries = listTimelineLogicNodes(proj1, wf1, proj1.layers[0], proj1.shots[0].id)
    expect(entries.some((e) => e.node.id === res.node_id && e.category === 'light_fx')).toBe(true)

    const badges = getLayerTimelineLogicBadges(proj1.layers[0], proj1, wf1)
    expect(badges.some((b) => b.kind === 'workflow_node' && b.nodeId === res.node_id)).toBe(true)
    expect(badges.some((b) => b.kind === 'capability' && b.id.startsWith('cap-virtual-light'))).toBe(true)

    useEditor.getState().update((draft) => {
      toggleTimelineLogicNode(draft, res.node_id)
    })
    const proj2 = useEditor.getState().project
    const nodeAfterToggle = proj2.workflow!.nodes.find((n) => n.id === res.node_id)!
    expect(nodeAfterToggle.enabled).toBe(false)

    useEditor.getState().update((draft) => {
      removeTimelineLogicNode(draft, res.node_id)
    })
    const proj3 = useEditor.getState().project
    expect(proj3.workflow!.nodes.some((n) => n.id === res.node_id)).toBe(false)
  })
})
