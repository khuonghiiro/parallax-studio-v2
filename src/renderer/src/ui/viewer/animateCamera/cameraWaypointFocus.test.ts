import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { createProject } from '../../../project/factory'
import { useEditor } from '../../../store/editor'
import { focusCameraWaypoint } from './cameraWaypointFocus'

const original = useEditor.getState()
const event = (shiftKey = false) => ({ shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() })
describe('camera waypoint focus isolation', () => {
  beforeEach(() => {
    const project = createProject()
    const nodes: WorkflowNode[] = [0, 1].map(i => ({ id: `camera-${i}`, type: 'camera_director',
      title: `Camera ${i}`, enabled: true, position: { x: 0, y: 0 }, preset: '', aiAgentRole: 'SceneLayoutAgent',
      aiDirective: '', params: { isCameraWaypoint: true, waypointIndex: i } }))
    project.workflow = { id: 'w', name: 'w', version: 1, description: '', nodes, edges: [] }
    useEditor.setState({ project, selectedWorkflowNodeId: 'camera-0' })
  })
  afterEach(() => useEditor.setState(original))
  it('keeps the current camera when another frame is clicked without Shift', () => {
    const e = event()
    const before = useEditor.getState().project
    expect(focusCameraWaypoint(e, 1)).toBe(false)
    expect(useEditor.getState().selectedWorkflowNodeId).toBe('camera-0')
    expect(useEditor.getState().project).toBe(before)
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })
  it('allows editing the same frame without Shift and switches with Shift', () => {
    expect(focusCameraWaypoint(event(), 0)).toBe(true)
    expect(focusCameraWaypoint(event(true), 1)).toBe(true)
    expect(useEditor.getState().selectedWorkflowNodeId).toBe('camera-1')
    expect(focusCameraWaypoint(event(), 1)).toBe(true)
  })
  it('protects a focused motion node from camera controls', () => {
    useEditor.setState({ selectedWorkflowNodeId: 'motion' })
    expect(focusCameraWaypoint(event(), 0)).toBe(false)
    expect(useEditor.getState().selectedWorkflowNodeId).toBe('motion')
    expect(focusCameraWaypoint(event(true), 0)).toBe(true)
  })
  it('allows a first selection and blocks unknown frames while a node is focused', () => {
    expect(focusCameraWaypoint(event(), 99)).toBe(false)
    useEditor.setState({ selectedWorkflowNodeId: null })
    expect(focusCameraWaypoint(event(), 0)).toBe(true)
    expect(useEditor.getState().selectedWorkflowNodeId).toBe('camera-0')
  })
})
