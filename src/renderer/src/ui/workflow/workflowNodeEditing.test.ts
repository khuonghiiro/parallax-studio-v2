import { afterEach, describe, expect, it, vi } from 'vitest'
import { createImageLayer, createProject, createShot } from '../../project/factory'
import { createDefaultWorkflow } from '../../project/workflowEngine'
import { evaluateNodeDraft, initializeNodeDraft } from '../../project/workflowNodeDraft'
import { editableNodeRules, nodeEditingLabel, nodePreviewChanges, nodePreviewKey } from './workflowNodeEditing'
import { createNodePreviewScheduler } from './nodePreviewScheduler'

function fixture() {
  const project = createProject(), shot = createShot('Test')
  project.shots.push(shot)
  project.layers.push(createImageLayer({ id: 'image', name: 'Layer', kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id))
  project.workflow = createDefaultWorkflow()
  const previous = project.workflow.nodes.find((node) => node.type === 'camera_director')!
  const node = initializeNodeDraft(previous, project)
  return { project, node, previous }
}

afterEach(() => vi.useRealTimers())

describe('focused workflow node editing', () => {
  it('notes, labels and canvas movement do not invalidate preview; parameters and wires do', () => {
    const { project } = fixture()
    const graph = project.workflow!, key = nodePreviewKey(graph)
    const changed = structuredClone(graph)
    changed.nodes[0].aiDirective = 'Đang gõ ghi chú'
    changed.nodes[0].title = 'Tên mới'; changed.nodes[0].position.x += 100
    expect(nodePreviewKey(changed)).toBe(key)
    changed.nodes[0].params = { ...changed.nodes[0].params, intensity: 1.5 }
    expect(nodePreviewKey(changed)).not.toBe(key)
    changed.nodes[0].params = graph.nodes[0].params
    changed.edges.pop()
    expect(nodePreviewKey(changed)).not.toBe(key)
  })
  it('keeps assets and unaffected layers shared while evaluating actual camera settings', () => {
    const { project, node, previous } = fixture()
    node.params!.enableDof = true
    const preview = evaluateNodeDraft(project, project.workflow!, node, previous)
    expect(preview.camera.dofEnabled).toBe(true)
    expect(project.camera.dofEnabled).toBe(false)
    expect(preview.assets).toBe(project.assets)
    expect(preview.layers[0]).toBe(project.layers[0])
    expect(nodePreviewChanges(project, preview).layers).toEqual([])
    expect(nodePreviewChanges(project, preview).sections).toContain('Camera')
  })
  it('does not report equal rewritten values as scene changes', () => {
    const { project } = fixture()
    const next = { ...project, layers: [{ ...project.layers[0] }], camera: { ...project.camera } }
    expect(nodePreviewChanges(project, next)).toEqual({ layers: [], sections: [] })
  })
  it('identifies the chosen editable action without presenting Inspector mirrors as executable rules', () => {
    const { node } = fixture()
    node.params!.customRules = [
      { id: 'wind', label: 'Wind', targetId: 'all', targetName: 'Node', actionKind: 'wind', speed: 1, amount: 1, enabled: true },
      { id: 'drift', label: 'Drift', targetId: 'all', targetName: 'Node', actionKind: 'drift', speed: 1, amount: 1, enabled: true },
      { id: 'inspector-mirror', label: 'Mirror', targetId: 'all', targetName: 'Node', actionKind: 'wind', enabled: true }
    ]
    expect(editableNodeRules(node).map((rule) => rule.id)).toEqual(['wind', 'drift'])
    expect(nodeEditingLabel(node, 'wind')).not.toBe(nodeEditingLabel(node, 'drift'))
  })
})

describe('preview scheduling', () => {
  it('evaluates only the final draft of a continuous slider gesture', () => {
    vi.useFakeTimers()
    const scheduler = createNodePreviewScheduler(), frames: number[] = []
    for (let step = 0; step < 12; step++) {
      scheduler.schedule(() => frames.push(step))
      vi.advanceTimersByTime(16)
    }
    expect(frames).toEqual([])
    vi.advanceTimersByTime(80)
    expect(frames).toEqual([11])
  })
  it('cancels pending work when paused or closed and allows one explicit refresh', () => {
    vi.useFakeTimers()
    const scheduler = createNodePreviewScheduler(), evaluate = vi.fn()
    scheduler.schedule(evaluate); scheduler.cancel(); vi.runAllTimers()
    expect(evaluate).not.toHaveBeenCalled()
    scheduler.schedule(evaluate, true); vi.runAllTimers()
    expect(evaluate).toHaveBeenCalledTimes(1)
    scheduler.flush(); expect(evaluate).toHaveBeenCalledTimes(1)
  })
})
