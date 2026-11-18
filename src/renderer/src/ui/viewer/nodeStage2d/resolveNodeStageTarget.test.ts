import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from '../../../project/factory'
import { attachLogicNodeToLayerV2, v2LayerNodeId } from '../../../project/workflowV2Engine'
import { resolveWorkflowV2 } from '../../../project/workflowV2Rebuild'
import {
  buildStageLayerNodeContext,
  resolveEffectiveStageNode,
  resolveNodeStagePrimaryMode
} from './resolveNodeStageTarget'

describe('resolveNodeStageTarget (Viewer Màn Khung 2D)', () => {
  it('resolves selected layer node automatically when selectedWorkflowNodeId is empty', () => {
    const project = createProject()
    const shot = createShot('Cảnh 1')
    project.shots.push(shot)
    const layer = createImageLayer(
      { id: 'a1', name: 'Nhân vật A', kind: 'image', mime: 'image/png', width: 400, height: 600 },
      project.comp,
      0,
      shot.id
    )
    project.layers.push(layer)
    const workflow = resolveWorkflowV2(project)

    const resolved = resolveEffectiveStageNode(project, workflow, null, layer.id, shot.id, shot.id, 'layer')
    expect(resolved?.id).toBe(v2LayerNodeId(layer.id))
    expect(resolveNodeStagePrimaryMode(resolved)).toBe('scene_bbox')
  })

  it('switches primary mode to logic_25d and part_25d for specialized 2.5D nodes', () => {
    const project = createProject()
    const shot = createShot('Cảnh 1')
    project.shots.push(shot)
    const layer = createImageLayer(
      { id: 'a1', name: 'Đèn lồng', kind: 'image', mime: 'image/png', width: 300, height: 300 },
      project.comp,
      0,
      shot.id
    )
    project.layers.push(layer)
    const wf0 = resolveWorkflowV2(project)
    const lightRes = attachLogicNodeToLayerV2(wf0, v2LayerNodeId(layer.id), 'light')
    const lightNode = lightRes.workflow.nodes.find((n) => n.id === lightRes.createdNodeId) ?? null

    expect(resolveNodeStagePrimaryMode(lightNode)).toBe('logic_25d')

    const ctx = buildStageLayerNodeContext(project, lightRes.workflow, lightNode, layer.id)
    expect(ctx.activeLayer?.id).toBe(layer.id)
    expect(ctx.attachTargetNodeId).toBe(v2LayerNodeId(layer.id))
    expect(ctx.logicNodes.some((n) => n.id === lightNode?.id)).toBe(true)
    expect(ctx.compatibleCategories.length).toBeGreaterThan(0)
  })
})
