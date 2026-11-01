import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from '../../project/factory'
import { syncWorkflowV2Graph } from '../../project/workflowV2Sync'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'

function setup() {
  const project = createProject()
  project.comp.duration = 12
  const shot = createShot('Cảnh MCP')
  project.shots = [shot]
  project.layers = ['l1', 'l2', 'l3'].map((id) => {
    const layer = createImageLayer({ id: `asset-${id}`, name: id, kind: 'image', mime: 'image/png', width: 64, height: 64 }, project.comp, 0, shot.id)
    layer.id = id
    layer.inPoint = 1; layer.outPoint = 4
    return layer
  })
  project.workflow = syncWorkflowV2Graph(project)
  useEditor.setState({ project, past: [], future: [] })
}

type Result = { time_node_id?: string; affected: number; groups: { id: string; start: number; end: number; layerIds: string[] }[] }
const layer = (id: string) => useEditor.getState().project.layers.find(l => l.id === id)!

describe('MCP time_group', () => {
  it('creates, shifts, retimes and unlinks a shared Time group in single Undo steps', async () => {
    setup()
    const created = await runCommand('time_group', { action: 'create', layer_ids: ['l1', 'l2'], title: 'Time A · MCP' }) as Result
    expect(created.groups[0].layerIds.sort()).toEqual(['l1', 'l2'])
    const id = created.time_node_id!
    await runCommand('time_group', { action: 'shift', time_node_id: id, delta: 2 })
    expect([layer('l1').inPoint, layer('l2').outPoint, layer('l3').inPoint]).toEqual([3, 6, 1])
    await runCommand('time_group', { action: 'set_range', time_node_id: id, start: 0, end: 8 })
    expect([layer('l2').inPoint, layer('l2').outPoint]).toEqual([0, 8])
    useEditor.getState().undo()
    expect([layer('l2').inPoint, layer('l2').outPoint]).toEqual([3, 6])
    const linked = await runCommand('time_group', { action: 'link', time_node_id: id, layer_ids: ['l3'] }) as Result
    expect(linked.affected).toBe(1)
    expect(layer('l3').inPoint).toBe(3)
    const unlinked = await runCommand('time_group', { action: 'unlink', layer_ids: ['l1'] }) as Result
    expect(unlinked.affected).toBe(1)
    expect(unlinked.groups[0].layerIds.sort()).toEqual(['l2', 'l3'])
    await runCommand('time_group', { action: 'rename', time_node_id: id, title: 'Nhóm mở đầu', color: '#22c55e' })
    const listed = await runCommand('time_group', {}) as Result & { groups: { title: string; color: string }[] }
    expect(listed.groups[0]).toMatchObject({ title: 'Nhóm mở đầu', color: '#22c55e' })
  })

  it('rejects unknown actions, missing ids and invalid ranges', async () => {
    setup()
    await expect(runCommand('time_group', { action: 'explode' })).rejects.toThrow()
    await expect(runCommand('time_group', { action: 'shift', delta: 1 })).rejects.toThrow()
    await expect(runCommand('time_group', { action: 'create', layer_ids: ['missing'] })).rejects.toThrow()
    const created = await runCommand('time_group', { action: 'create', layer_ids: ['l1'] }) as Result
    await expect(runCommand('time_group', { action: 'set_range', time_node_id: created.time_node_id, start: 5, end: 2 })).rejects.toThrow()
  })
})
