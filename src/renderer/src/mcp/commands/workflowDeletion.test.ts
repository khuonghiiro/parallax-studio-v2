import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from '../../project/factory'
import { syncWorkflowV2Graph } from '../../project/workflowV2Sync'
import { addTimelineLogic } from '../../project/timelineLogic'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'

function fixture(preset: string) {
  const project = createProject()
  const shot = createShot('Scene'); project.shots = [shot]
  const layer = createImageLayer({ id: 'asset', name: 'Layer', kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id)
  project.layers = [layer]
  project.workflow = syncWorkflowV2Graph(project)
  const nodeId = addTimelineLogic(project, preset, layer.id)
  useEditor.setState({ project, past: [], future: [] })
  return { nodeId, layerId: layer.id }
}

describe('workflow deletion and disconnected effects', () => {
  it.each(['v2:material:stone_wall', 'v2:action:sway', 'v2:light:candle', 'v2:cave:arch', 'v2:fx:wind_physics'])('deletes %s without resurrection and restores with Undo', async preset => {
    const { nodeId } = fixture(preset)
    await runCommand('set_workflow', { node_id: nodeId, delete_node: true })
    const project = useEditor.getState().project
    const graph = syncWorkflowV2Graph(project, project.workflow)
    expect(graph.nodes.some(n => n.id === nodeId)).toBe(false)
    expect(graph.edges.some(e => e.fromNode === nodeId || e.toNode === nodeId)).toBe(false)
    useEditor.getState().undo()
    expect(useEditor.getState().project.workflow!.nodes.some(n => n.id === nodeId)).toBe(true)
  })

  it('disconnects a light, keeps the node, and reconnects without widening targets', async () => {
    const { nodeId, layerId } = fixture('v2:light:candle')
    const args = { from_node: `v2-layer-${layerId}`, to_node: nodeId, port: 'layers_tree' }
    await runCommand('connect_workflow_ports', { ...args, action: 'disconnect' })
    let project = useEditor.getState().project
    expect(project.layers[0].virtualLight?.enabled).toBe(false)
    expect(project.workflow!.nodes.find(n => n.id === nodeId)?.params?.targetLayerIds).toEqual([])
    await runCommand('connect_workflow_ports', args)
    project = useEditor.getState().project
    expect(project.layers[0].virtualLight?.enabled).toBe(true)
    expect(project.workflow!.nodes.find(n => n.id === nodeId)?.params?.targetLayerIds).toEqual([layerId])
  })
})
