import { describe, expect, it } from 'vitest'
import type { Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { autoWireScopedWorkflow } from './workflowAutoWire'
import { getWorkflowLayerVisibility } from './workflowVisibility'
import { rebalanceChildLayerRigEdges } from './workflowStageEffects'

function node(id: string, type: WorkflowNode['type'], shotId = 's1', targets?: string[]): WorkflowNode {
  return { id, type, title: id, enabled: true, preset: 'default', aiAgentRole: 'SceneLayoutAgent',
    aiDirective: '', position: { x: 0, y: 0 }, params: { shotId, targetLayerIds: targets, targetMode: 'custom' } }
}
function graph(nodes: WorkflowNode[]): WorkflowGraph {
  return { id: 'test', version: 1, name: 'test', description: '', nodes, edges: [] }
}

describe('scoped workflow wiring', () => {
  it('connects exact targets and hierarchy, preserves wires and is idempotent', () => {
    const scene = node('scene', 'scene_shot')
    const root = node('wf-layer-root', 'layer_assembly', 's1', ['a', 'b'])
    const part = node('wf-layer-part', 'layer_assembly', 's1', ['b'])
    part.params = { ...part.params, assemblyRootNodeId: root.id, hierarchyParentNodeId: root.id }
    const motion = node('motion', 'motion_choreography', 's1', ['b'])
    const transform = node('transform', 'layer_transform', 's1', ['a', 'b'])
    const wired = autoWireScopedWorkflow(graph([scene, root, part, motion, transform]))
    expect(wired.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromNode: root.id, toNode: part.id, toPort: 'layers_tree' }),
      expect.objectContaining({ fromNode: part.id, toNode: motion.id, toPort: 'actors_rig' }),
      expect.objectContaining({ fromNode: root.id, toNode: transform.id, toPort: 'transform_link' })
    ]))
    expect(autoWireScopedWorkflow(wired)).toEqual(wired)
    part.enabled = false
    expect(rebalanceChildLayerRigEdges(wired)).toBe(wired)
    expect(autoWireScopedWorkflow(wired).edges).toEqual(wired.edges)
  })

  it('does not guess a layer or cross a shot boundary', () => {
    const a = node('a', 'layer_assembly', 's1', ['a'])
    const b = node('b', 'layer_assembly', 's2', ['b'])
    const motion = node('motion', 'motion_choreography', 's1', ['missing'])
    const wf = graph([node('s1', 'scene_shot'), node('s2', 'scene_shot', 's2'), a, b, motion])
    wf.edges = [{ id: 'bad', fromNode: b.id, fromPort: 'actors_rig', toNode: motion.id, toPort: 'actors_rig' }]
    const wired = autoWireScopedWorkflow(wf)
    expect(wired.edges.some((edge) => edge.toNode === motion.id)).toBe(false)
    expect(wired.edges.some((edge) => edge.fromNode === 's1' && edge.toNode === b.id)).toBe(false)
  })

  it('combines group and child visibility independently of node order', () => {
    const root = node('wf-layer-root', 'layer_assembly', 's1', ['a', 'b'])
    const part = node('wf-layer-part', 'layer_assembly', 's1', ['b'])
    part.enabled = false
    const project = { layers: [{ id: 'a' }, { id: 'b', parentId: 'a' }] } as Project
    const active = new Set([root.id, part.id])
    expect(getWorkflowLayerVisibility(project, graph([root, part]), active).get('b')).toBe(false)
    expect(getWorkflowLayerVisibility(project, graph([part, root]), active).get('b')).toBe(false)
    root.enabled = false
    expect([...getWorkflowLayerVisibility(project, graph([root, part]), active).values()]).toEqual([false, false])
  })
})
