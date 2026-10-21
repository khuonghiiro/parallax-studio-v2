import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { createProject } from './factory'
import { WORKFLOW_NODE_SPECS } from './workflowCatalog'
import { syncWorkflowCameraModifiers } from './workflowCameraModifiers'

const camera = (params: WorkflowNode['params']): WorkflowNode => ({
  id: 'camera', type: 'camera_director', title: 'Camera', enabled: true,
  preset: 'dramatic_handheld_action', position: { x: 0, y: 0 },
  aiAgentRole: WORKFLOW_NODE_SPECS.camera_director.aiAgentRole, aiDirective: '', params
})
describe('workflow camera modifier switches', () => {
  it('explicit false disables DOF even for the DOF logic preset', () => {
    const project = createProject()
    syncWorkflowCameraModifiers(project, [camera({ logicId: 'logic-cam-dof', enableDof: false })])
    expect(project.camera.dofEnabled).toBe(false)
  })
  it('explicit zero disables handheld shake', () => {
    const project = createProject()
    syncWorkflowCameraModifiers(project, [camera({ logicId: 'logic-cam-shake', camShakeAmount: 0 })])
    expect(project.camera.shakeAmount).toBe(0)
  })
  it('honors explicit shake on other presets and preserves another enabled DOF node', () => {
    const project = createProject()
    syncWorkflowCameraModifiers(project, [camera({ enableDof: false }), camera({ enableDof: true, camShakeAmount: 4, intensity: 1.5 })])
    expect(project.camera.dofEnabled).toBe(true)
    expect(project.camera.shakeAmount).toBeGreaterThanOrEqual(6)
  })
  it('clears modifiers when no camera nodes are active', () => {
    const project = createProject()
    project.camera.dofEnabled = true
    project.camera.shakeAmount = 20
    syncWorkflowCameraModifiers(project, [])
    expect(project.camera.dofEnabled).toBe(false)
    expect(project.camera.shakeAmount).toBe(0)
  })
})
