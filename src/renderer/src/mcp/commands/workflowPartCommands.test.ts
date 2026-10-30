import { syncPartSwapNodeToProject } from '../../project/workflowV2PartAndPathBake'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createImageLayer } from '../../project/factory'
import { evaluateScene } from '../../engine/evaluateScene'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'
import type { WorkflowNode } from '@shared/types'
import { patchPartCue } from '../../project/workflowPartEditing'

function node(id: string, params: WorkflowNode['params']): WorkflowNode {
  return { id, type: 'layer_assembly', title: id, enabled: true, preset: 'composite_part_swap',
    position: { x: 0, y: 0 }, aiAgentRole: 'AssemblyRigAgent', aiDirective: '', params }
}
function setup() {
  const p = createProject(); p.comp.duration = 10
  p.assets = ['normal', 'happy', 'replacement'].map(id => ({ id, name: id, kind: 'image' as const, mime: 'image/png', width: 100, height: 100 }))
  p.layers = p.assets.slice(0, 2).map((a, i) => {
    const l = createImageLayer(a, p.comp, 0); l.id = a.id; l.visible = i === 0
    l.composite = { compositeId: 'c', compositeName: 'c', instanceId: 'cluster', slot: 'face', variant: a.id, lockedGroup: true }
    l.transform.position.keyframes = [{ id: 'motion-a', t: 0, value: [0, 0, 0], ease: 'linear' }, { id: 'motion-b', t: 10, value: [1000, 0, 0], ease: 'linear' }]
    l.outPoint = 10; return l
  })
  p.workflow = { id: 'workflow', name: 'w', description: '', version: 1, nodes: [
    node('hub', { logicCategory: 'part_swap', isPartHub: true, instanceId: 'cluster', targetLayerIds: ['normal', 'happy'] }),
    node('child', { logicCategory: 'part_swap', isPartChild: true, hierarchyParentNodeId: 'hub', instanceId: 'cluster', targetLayerIds: ['normal', 'happy'], timeStart: 2, timeEnd: 4, swapMode: 'part_variant', swapVariant: 'normal' })
  ], edges: [{ id: 'edge', fromNode: 'hub', toNode: 'child', fromPort: 'layers_tree', toPort: 'layers_tree' }] }
  useEditor.getState().loadProject(p, null)
}
const frame = (time: number) => evaluateScene(useEditor.getState().project, time).layers

describe('part cue UI/MCP shared semantics', () => {
  beforeEach(setup)
  it('swaps only within the cue; additive pose follows Motion without touching path keys', async () => {
    const before = useEditor.getState().project
    await runCommand('set_part_cue', { node_id: 'child', mode: 'part_variant', variant_id: 'happy', x: 20, rotation: 30, wave: 'hold' })
    expect(frame(1).map(l => l.active)).toEqual([true, false])
    expect(frame(3).map(l => l.active)).toEqual([false, true])
    expect(frame(4).map(l => l.active)).toEqual([true, false])
    expect(frame(3)[1].position[0]).toBeCloseTo(320)
    expect(frame(3)[1].rotation[2]).toBe(30)
    expect(frame(5)[0].position[0]).toBeCloseTo(500)
    expect(useEditor.getState().project.layers[0].transform.position.keyframes).toEqual(before.layers[0].transform.position.keyframes)
    const after = useEditor.getState().project
    useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(before)
    useEditor.getState().redo(); expect(useEditor.getState().project).toEqual(after)
  })
  it('times image replacements and visibility without mutating the source image', async () => {
    await runCommand('set_part_cue', { node_id: 'child', mode: 'replace_asset', layer_id: 'normal', asset_id: 'replacement' })
    expect((frame(3)[0].layer.props as any).assetId).toBe('replacement')
    expect((frame(4)[0].layer.props as any).assetId).toBe('normal')
    await runCommand('set_part_cue', { node_id: 'child', variant_id: 'happy', layer_id: 'happy' })
    expect(frame(3)[1].active).toBe(true)
    expect((frame(3)[1].layer.props as any).assetId).toBe('replacement')
    expect((useEditor.getState().project.layers[0].props as any).assetId).toBe('normal')
    await runCommand('set_part_cue', { node_id: 'child', mode: 'toggle_part', layer_id: 'normal', visible: false })
    expect(frame(3)[0].active).toBe(false); expect(frame(4)[0].active).toBe(true)
  })
  it('adds an independent cue with one Undo step; latest start wins, then earlier held state resumes', async () => {
    await runCommand('set_part_cue', { node_id: 'child', variant_id: 'happy', hold_after_end: true })
    const before = useEditor.getState().project
    const result = await runCommand('set_part_cue', { node_id: 'child', action: 'add', at: 3, duration: 1, variant_id: 'normal', hold_after_end: false }) as any
    expect(result.node_id).not.toBe('child')
    expect(frame(2.5)[1].active).toBe(true); expect(frame(3.5)[0].active).toBe(true); expect(frame(4.5)[1].active).toBe(true)
    expect(useEditor.getState().project.workflow?.nodes.find(n => n.id === 'child')?.params?.timeStart).toBe(2)
    useEditor.getState().undo(); expect(useEditor.getState().project).toEqual(before)
  })
  it('rejects editing a hub, a foreign variant, invalid range, and shared time edits atomically', async () => {
    const before = useEditor.getState().project
    for (const args of [{ node_id: 'hub', x: 3 }, { node_id: 'child', variant_id: 'other' }, { node_id: 'child', start: 5, end: 3 }]) {
      await expect(runCommand('set_part_cue', args)).rejects.toThrow()
      expect(useEditor.getState().project).toEqual(before)
    }
    useEditor.getState().update(d => {
      d.workflow!.nodes.push(node('time', { logicCategory: 'time', timeStart: 1, timeEnd: 5 }))
      d.workflow!.edges.push({ id: 'time-wire', fromNode: 'time', toNode: 'child', fromPort: 'time_range', toPort: 'time_range' })
    })
    await expect(runCommand('set_part_cue', { node_id: 'child', start: 2 })).rejects.toThrow('Time')
  })
  it('migrates legacy baked swap/pose without touching other cluster members or Motion keys', async () => {
    useEditor.getState().update(d => {
      const n = d.workflow!.nodes.find(n => n.id === 'child')!
      n.params = { ...n.params, swapVariant: 'happy', partOffsetX: 15 }
      syncPartSwapNodeToProject(d, n, n.params)
      const body = createImageLayer(d.assets[0], d.comp, 0); body.id = 'body'; body.visible = true
      body.composite = { compositeId: 'c', compositeName: 'c', instanceId: 'cluster', lockedGroup: true }
      d.layers.push(body)
      d.workflow!.nodes.find(n => n.id === 'hub')!.params!.targetLayerIds!.push('body')
    })
    await runCommand('set_part_cue', { node_id: 'child', rotation: 10, wave: 'hold' })
    const p = useEditor.getState().project
    expect(p.layers.find(l => l.id === 'body')!.visible).toBe(true)
    expect(p.layers[0].transform.position.keyframes.map(k => k.id)).toEqual(['motion-a', 'motion-b'])
    expect(frame(3)[1].position[0]).toBeCloseTo(315)
    expect(frame(1)[1].active).toBe(false)
  })
  it('uses the same patch helper as UI and describes evaluated positions for AI without seeking', async () => {
    useEditor.getState().update(d => patchPartCue(d, 'child', { partOffsetY: 40, partPoseWave: 'hold' }))
    const beforeTime = useEditor.getState().time
    const result = await runCommand('get_part_cues', { node_id: 'hub', time: 3 }) as any
    expect(result.parts[0].id).toBe('child'); expect(result.preview[0].position).toEqual([300, 40, 0])
    expect(useEditor.getState().time).toBe(beforeTime)
    useEditor.getState().update(d => { d.workflow!.nodes.find(n => n.id === 'hub')!.enabled = false })
    expect(frame(3)[0].position[1]).toBe(0)
  })
})
