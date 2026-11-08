import { describe, expect, it } from 'vitest'
import type { WorkflowGraph, WorkflowNode } from '@shared/types'
import { workflowBboxEditTime } from './workflowBboxEditTime'

describe('BBox edit time stays independent from the playhead', () => {
  const node = { params: { logicCategory: 'action', motionMode: 'bbox', timeStart: 2, timeEnd: 5 } } as WorkflowNode
  it('keeps the start frame visible even with the playhead at the destination', () => {
    expect(workflowBboxEditTime(node, 5, false)).toBe(2)
    expect(workflowBboxEditTime(node, 3.5, false)).toBe(2)
  })
  it('plays the real motion only during explicit playback', () => {
    expect(workflowBboxEditTime(node, 4, true)).toBe(4)
    expect(workflowBboxEditTime({ ...node, params: { logicCategory: 'collision' } }, 4, false)).toBe(4)
  })
  it('resolves start time for cluster or layer nodes connected to an action node', () => {
    const clusterNode = { id: 'v2-cluster-1', type: 'layer_assembly', params: {} } as WorkflowNode
    const actionNode = { id: 'v2-action-1', type: 'motion_choreography', params: { logicCategory: 'action', motionMode: 'bbox', timeStart: 1.5, timeEnd: 4 } } as WorkflowNode
    const workflow = {
      version: 2,
      id: 'wf',
      nodes: [clusterNode, actionNode],
      edges: [{ id: 'e1', fromNode: 'v2-cluster-1', toNode: 'v2-action-1', fromPort: 'out', toPort: 'in' }]
    } as unknown as WorkflowGraph
    expect(workflowBboxEditTime(clusterNode, 3, false, workflow)).toBe(1.5)
  })
})
