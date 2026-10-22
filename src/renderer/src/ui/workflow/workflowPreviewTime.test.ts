import { describe, expect, it } from 'vitest'
import { createProject, createShot } from '../../project/factory'
import { addKeyframe } from '../../animation/keyframes'
import { getNodePreviewTime } from './workflowPreviewTime'
import { shotAtTime } from '../../animation/cameraPath'
import type { WorkflowNode } from '@shared/types'
const node: WorkflowNode = { id: 'scene', type: 'scene_shot', title: 'Scene', enabled: true, position: { x: 0, y: 0 }, preset: '', aiAgentRole: 'SceneLayoutAgent', aiDirective: '' }
describe('node camera preview time', () => {
  it('clamps invalid and out of bounds editor times', () => {
    const project = createProject({ duration: 10 })
    expect(getNodePreviewTime(project, node, NaN)).toBe(0)
    expect(getNodePreviewTime(project, node, 20)).toBe(10)
    expect(getNodePreviewTime(project, node, -1)).toBe(0)
  })
  it('starts on the target shot using the real camera path', () => {
    const project = createProject({ duration: 10 })
    const first = createShot('First')
    const second = createShot('Second', [10000, 0, 0])
    project.shots = [first, second]
    addKeyframe(project.camera.target, 0, [0, 0, 0], 'linear')
    addKeyframe(project.camera.target, 3, [10000, 0, 0], 'linear')
    const time = getNodePreviewTime(project, { ...node, params: { shotId: second.id } }, 0)
    expect(shotAtTime(project, time)).toBe(second.id)
  })
  it('keeps the current frame when already viewing the node shot', () => {
    const project = createProject({ duration: 10 })
    const shot = createShot('Shot')
    project.shots = [shot]
    expect(getNodePreviewTime(project, { ...node, params: { shotId: shot.id } }, 2)).toBe(2)
  })
})
