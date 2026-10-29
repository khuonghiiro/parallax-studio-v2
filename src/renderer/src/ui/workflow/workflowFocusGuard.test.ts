import { afterEach, describe, expect, it, vi } from 'vitest'
import { canFocusWorkflowNode, guardWorkflowNodeEvent, canEditViewportTarget } from './workflowFocusGuard'
import { useEditor } from '../../store/editor'
import { createProject } from '../../project/factory'

describe('explicit workflow focus', () => {
  afterEach(() => useEditor.setState({ selectedWorkflowNodeId: null }))
  it('permits first selection and editing the current node, requiring Shift for any other node', () => {
    expect(canFocusWorkflowNode(null, 'camera-10', false)).toBe(true)
    expect(canFocusWorkflowNode('camera-10', 'camera-10', false)).toBe(true)
    expect(canFocusWorkflowNode('camera-10', 'camera-9', false)).toBe(false)
    expect(canFocusWorkflowNode('motion-2', 'layer-1', false)).toBe(false)
    expect(canFocusWorkflowNode('camera-10', 'camera-9', true)).toBe(true)
  })
  it('prevents blocked pointer/click events from focusing controls or reaching mutations', () => {
    useEditor.setState({ selectedWorkflowNodeId: 'motion-2' })
    const event = { shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    expect(guardWorkflowNodeEvent(event, 'motion-1')).toBe(false)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(guardWorkflowNodeEvent({ ...event, shiftKey: true }, 'motion-1')).toBe(true)
  })
  it('does not let a viewport click switch from camera to a layer without Shift', () => {
    const project = createProject()
    project.workflow = { id: 'w', name: 'w', version: 1, description: '', nodes: [
      { id: 'camera', type: 'camera_director', title: '', position: { x: 0, y: 0 }, enabled: true, preset: '', aiAgentRole: 'SceneLayoutAgent', aiDirective: '' },
      { id: 'motion', type: 'motion_choreography', title: '', position: { x: 0, y: 0 }, enabled: true, preset: '', aiAgentRole: 'SceneLayoutAgent', aiDirective: '', params: { targetLayerIds: ['own'] } }
    ], edges: [] }
    expect(canEditViewportTarget(project, 'camera', { layerId: 'other' }, false)).toBe(false)
    expect(canEditViewportTarget(project, 'camera', { layerId: 'other' }, true)).toBe(true)
    expect(canEditViewportTarget(project, 'motion', { layerId: 'own' }, false)).toBe(true)
    expect(canEditViewportTarget(project, 'motion', { layerId: 'other' }, false)).toBe(false)
    expect(canEditViewportTarget(project, 'motion', { camera: true }, false)).toBe(false)
    expect(canEditViewportTarget(project, 'motion', {}, false)).toBe(false)
  })
})
