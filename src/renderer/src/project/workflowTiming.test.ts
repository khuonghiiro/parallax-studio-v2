import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import { connectTimeNode, createTimeNode, effectiveTimeParams } from './workflowTiming'
import { syncWorkflowV2Graph } from './workflowV2Sync'
import { syncWorkflowV2NodeToProject } from './workflowV2Mutations'
import { moveTimelineLayers } from './timelineTiming'
import { useEditor } from '../store/editor'
import { runCommand } from '../mcp/commands'
import { repairThreeSceneTiming } from './demoTiming'

function fixture() {
  const project = createProject()
  project.comp.duration = 15
  const shot = createShot('Cảnh')
  project.shots = [shot]
  project.layers = [1, 2, 3].map(i => {
    const layer = createImageLayer({ id: `asset-${i}`, name: `Layer ${i}`, kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id)
    layer.inPoint = i; layer.outPoint = i + 3
    layer.transform.opacity.keyframes = [{ id: `key-${i}`, t: i, value: 0, ease: 'linear' }, { id: `end-${i}`, t: i + 3, value: 1, ease: 'linear' }]
    return layer
  })
  project.workflow = syncWorkflowV2Graph(project)
  return project
}

describe('shared timing and timeline movement', () => {
  it('survives graph reconciliation and restores individual ranges after disconnect', () => {
    const project = fixture()
    const clock = createTimeNode(project)
    clock.params = { ...clock.params, timeStart: 5, timeEnd: 10 }
    project.workflow!.nodes.push(clock)
    const ids = project.layers.slice(0, 2).map(l => `v2-layer-${l.id}`)
    for (const id of ids) project.workflow = connectTimeNode(project.workflow!, clock.id, id)
    syncWorkflowV2NodeToProject(project, clock)
    expect(project.layers.slice(0, 2).map(l => [l.inPoint, l.outPoint])).toEqual([[5, 10], [5, 10]])
    project.workflow = syncWorkflowV2Graph(project, project.workflow)
    expect(project.workflow.edges.filter(e => e.fromPort === 'time_range')).toHaveLength(2)
    project.workflow.edges = project.workflow.edges.filter(e => e.toNode !== ids[0] || e.fromPort !== 'time_range')
    syncWorkflowV2NodeToProject(project, project.workflow.nodes.find(n => n.id === ids[0])!)
    expect([project.layers[0].inPoint, project.layers[0].outPoint]).toEqual([1, 4])
    expect([project.layers[1].inPoint, project.layers[1].outPoint]).toEqual([5, 10])
  })

  it('moves a group by one clamped delta and skips locked layers', () => {
    const project = fixture(); project.layers[2].locked = true
    moveTimelineLayers(project, project.layers.map(l => l.id), -5)
    expect(project.layers.map(l => l.inPoint)).toEqual([0, 1, 3])
    expect(project.layers[1].transform.opacity.keyframes.map(k => k.t)).toEqual([1, 4])
    moveTimelineLayers(project, project.layers.map(l => l.id), 6, 'align')
    expect(project.layers.map(l => l.inPoint)).toEqual([6, 6, 3])
    expect(project.layers[0].transform.opacity.keyframes.map(k => k.t)).toEqual([6, 9])
    expect(() => moveTimelineLayers(project, [project.layers[0].id], 14, 'align')).toThrow()
  })

  it('MCP creates/connects/edits Time and undoes a multi-row alignment', async () => {
    const project = fixture(); useEditor.setState({ project, past: [], future: [] })
    const result = await runCommand('set_workflow', { create_time: true }) as { node_id: string }
    const id = `v2-layer-${project.layers[0].id}`
    await runCommand('connect_workflow_ports', { from_node: result.node_id, to_node: id, port: 'time_range' })
    await runCommand('set_workflow', { node_id: result.node_id, node_params: JSON.stringify({ timeStart: 3, timeEnd: 8 }) })
    expect(useEditor.getState().project.layers[0].inPoint).toBe(3)
    await runCommand('connect_workflow_ports', { action: 'disconnect', from_node: result.node_id, to_node: id })
    expect(useEditor.getState().project.layers[0].inPoint).toBe(1)
    const before = useEditor.getState().project
    await runCommand('retime_layers', { layer_ids: project.layers.slice(0, 2).map(l => l.id), mode: 'align', seconds: 7 })
    expect(useEditor.getState().project.layers.slice(0, 2).map(l => l.inPoint)).toEqual([7, 7])
    useEditor.getState().undo()
    expect(useEditor.getState().project).toEqual(before)
  })

  it('rejects Time cycles and invalid ranges', () => {
    const project = fixture(), clock = createTimeNode(project)
    project.workflow!.nodes.push(clock)
    expect(() => connectTimeNode(project.workflow!, clock.id, clock.id)).toThrow()
    const node = project.workflow!.nodes.find(n => n.type === 'layer_assembly' && !n.params?.groupKind)!
    project.workflow = connectTimeNode(project.workflow!, clock.id, node.id)
    clock.params!.timeEnd = -1
    expect(() => effectiveTimeParams(project, node, node.params!)).toThrow()
  })

  it('demo retains its final hold and makes the arriving scene visible during travel', () => {
    const project = fixture()
    project.shots.push(createShot('B'), createShot('C'))
    project.layers[1].shotId = project.shots[1].id; project.layers[1].inPoint = 5
    project.camera.position.keyframes = [0, 2.2, 5, 7.2, 10, 14.8].map(t => ({ id: `p-${t}`, t, value: [t, 0, -100] as [number, number, number], ease: 'easeInOut' }))
    repairThreeSceneTiming(project)
    expect(project.comp.duration).toBe(15)
    expect(project.layers[1].inPoint).toBe(4)
    expect(project.camera.position.keyframes.map(k => k.t)).toEqual([0, 2.2, 4, 5, 7.2, 9, 10, 15])
    expect(project.camera.position.keyframes[1].ease).toBe('hold')
  })
})
