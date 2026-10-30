import fs from 'node:fs'
import type { Project } from '@shared/types'
import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import type { WorkflowNodeParams } from '@shared/types'
import { createImageLayer, createProject, createShot } from './factory'
import { attachLogicNodeToLayerV2, syncWorkflowV2Graph, syncWorkflowV2NodeToProject, v2LayerNodeId } from './workflowV2Engine'
import { resolveMotionMode } from './workflowMotionMode'

describe('motion tab selection', () => {
  it('prioritizes the selected mode over retained presets and paths', () => {
    for (const motionMode of ['bbox', 'path', 'cycle'] as const) {
      expect(resolveMotionMode({ motionMode, actionPreset: 'bbox_target', customMotionPath: [[0, 0], [1, 1]] })).toBe(motionMode)
    }
  })

  it.each([false, true])('switches all modes through immutable editor updates (cluster: %s)', (cluster) => {
    let project = createProject()
    const shot = createShot('Motion')
    project.shots.push(shot)
    const layer = createImageLayer({ id: 'motion-image', name: 'Motion', kind: 'image', mime: 'image/png', width: 640, height: 480 }, project.comp, 0, shot.id)
    if (cluster) {
      layer.composite = { instanceId: 'motion-cluster', compositeId: 'motion-template', compositeName: 'Motion', isRoot: true, lockedGroup: true, rootOffset: [0, 0, 0], sourceLayerId: 'body' }
    }
    project.layers.push(layer)
    project.workflow = syncWorkflowV2Graph(project)
    const attached = attachLogicNodeToLayerV2(project.workflow, cluster ? 'v2-cluster-motion-cluster' : v2LayerNodeId(layer.id), 'action')
    project.workflow = attached.workflow
    const path: [number, number][] = [[0, 0], [0.5, 0.5], [1, 0]]
    const select = (patch: Partial<WorkflowNodeParams>) => {
      const workflow = project.workflow!
      project = produce(project, draft => {
        const nodes = workflow.nodes.map(n => n.id === attached.createdNodeId ? { ...n, params: { ...n.params, ...patch } } : n)
        draft.workflow = { ...workflow, nodes }
        syncWorkflowV2NodeToProject(draft, nodes.find(n => n.id === attached.createdNodeId)!, patch)
      })
      project = produce(project, draft => { draft.workflow = syncWorkflowV2Graph(draft, draft.workflow) })
      return project.workflow!.nodes.find(n => n.id === attached.createdNodeId)!
    }
    for (const mode of ['path', 'cycle', 'bbox', 'path', 'bbox', 'cycle'] as const) {
      const node = select({ motionMode: mode, actionPreset: mode === 'bbox' ? 'bbox_target' : mode === 'path' ? 'custom_draw' : 'float', customMotionPath: path, bboxTargetX: 150, timeStart: 0, timeEnd: 2 })
      expect(node.params?.motionMode).toBe(mode)
      expect(node.params?.customMotionPath).toEqual(path)
      expect(project.layers[0].transform.position.keyframes.some(k => k.id.includes('-motpath-'))).toBe(mode === 'path')
      expect(project.layers[0].transform.position.keyframes.some(k => k.id.includes('-bboxmot-'))).toBe(mode === 'bbox')
      expect(Boolean(project.layers[0].motion?.enabled)).toBe(mode === 'cycle')
    }
    const node = select({ motionMode: 'path', actionPreset: 'custom_draw', customMotionPath: [] })
    expect(node.params?.motionMode).toBe('path')
    expect(project.layers[0].motion?.enabled).toBe(false)
    expect(project.layers[0].transform.position.keyframes.some(k => k.id.includes('-motpath-'))).toBe(false)
  })
})


it('switches a motion tab in the multi-shot sample project', () => {
  let project: Project = JSON.parse(fs.readFileSync('projects/ba-canh-mau-workflow-v2.json', 'utf8'))
  project = produce(project, draft => { draft.workflow = syncWorkflowV2Graph(draft, draft.workflow) })
  for (const mode of ['cycle', 'path', 'bbox'] as const) {
    const workflow = project.workflow!
    const nodeId = workflow.nodes.find(n => n.params?.logicCategory === 'action')!.id
    const patch: Partial<WorkflowNodeParams> = { motionMode: mode, actionPreset: mode === 'cycle' ? 'float' : mode === 'path' ? 'custom_draw' : 'bbox_target' }
    project = produce(project, draft => {
      const nodes = workflow.nodes.map(n => n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)
      draft.workflow = { ...workflow, nodes }
      syncWorkflowV2NodeToProject(draft, nodes.find(n => n.id === nodeId)!, patch)
    })
    project = produce(project, draft => { draft.workflow = syncWorkflowV2Graph(draft, draft.workflow) })
    expect(project.workflow!.nodes.find(n => n.id === nodeId)?.params?.motionMode).toBe(mode)
  }
})
