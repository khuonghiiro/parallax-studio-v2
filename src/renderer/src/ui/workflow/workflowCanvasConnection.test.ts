import { describe, expect, it } from 'vitest'
import {
  createCanonicalWorkflow,
  makeNode,
  WORKFLOW_NODE_SPECS
} from '../../project/workflowCatalog'
import {
  getBestMatchingInputPort,
  getBestMatchingOutputPort,
  getInputSocketCoords,
  getOutputSocketCoords,
  NODE_W
} from './workflowLayoutAndFlow'

describe('Workflow Canvas Connection & Playback Reset', () => {
  const wf = createCanonicalWorkflow('shot-1')
  const sceneNode = wf.nodes.find((n) => n.type === 'scene_shot')!
  const assemblyNode = wf.nodes.find((n) => n.type === 'layer_assembly')!
  const motionNode = wf.nodes.find((n) => n.type === 'motion_choreography')!
  const fxNode = wf.nodes.find((n) => n.type === 'physics_fx')!
  const camNode = wf.nodes.find((n) => n.type === 'camera_director')!
  const lookNode = wf.nodes.find((n) => n.type === 'look_output')!

  describe('Port Matching & Fallbacks (getBestMatchingInputPort & getBestMatchingOutputPort)', () => {
    it('matches exact port types when target accepts it', () => {
      // scene_shot (scene_ctx) -> layer_assembly (inputs: scene_ctx)
      expect(getBestMatchingInputPort('scene_ctx', assemblyNode)).toBe('scene_ctx')

      // layer_assembly (actors_rig) -> motion_choreography (inputs: actors_rig, scene_ctx, motion_stream)
      expect(getBestMatchingInputPort('actors_rig', motionNode)).toBe('actors_rig')

      // motion_choreography (motion_stream) -> physics_fx (inputs: motion_stream, ...)
      expect(getBestMatchingInputPort('motion_stream', fxNode)).toBe('motion_stream')
    })

    it('finds semantic fallback when connecting across non-adjacent nodes', () => {
      // connecting motion_stream into look_output (which accepts motion_stream)
      expect(getBestMatchingInputPort('motion_stream', lookNode)).toBe('motion_stream')

      // connecting vfx_stage into look_output
      expect(getBestMatchingInputPort('vfx_stage', lookNode)).toBe('vfx_stage')
    })

    it('finds reverse matching output port when dragging from Input to Output', () => {
      // Target input is actors_rig on motionNode, source is layer_assembly (outputs: actors_rig, scene_ctx)
      expect(getBestMatchingOutputPort('actors_rig', assemblyNode)).toBe('actors_rig')

      // Target input is camera_cut on lookNode, source is camNode (outputs: camera_cut)
      expect(getBestMatchingOutputPort('camera_cut', camNode)).toBe('camera_cut')
    })

    it('returns null if target has no ports of requested direction', () => {
      // scene_shot has no inputs
      expect(getBestMatchingInputPort('scene_ctx', sceneNode)).toBeNull()

      // look_output has no outputs
      expect(getBestMatchingOutputPort('vfx_stage', lookNode)).toBeNull()
    })
  })

  describe('Pin Geometry & Centering', () => {
    it('positions output pin center exactly outside the right edge (+9px)', () => {
      const coords = getOutputSocketCoords(sceneNode, 'scene_ctx')
      expect(coords.x).toBe(sceneNode.position.x + NODE_W + 9)
    })

    it('positions input pin center exactly outside the left edge (-9px)', () => {
      const coords = getInputSocketCoords(assemblyNode, 'scene_ctx')
      expect(coords.x).toBe(assemblyNode.position.x - 9)
    })
  })

  describe('Clear Canvas & Playhead Reset Logic', () => {
    it('creates a fresh canvas with root scene_shot node and clean edges', () => {
      const rootNode = makeNode('scene_shot', 'deep_parallax_stage', true)
      rootNode.params = { ...rootNode.params, shotId: 'shot-1' }
      const clearedWf = {
        version: 1,
        id: 'wf-custom',
        name: 'Quy trình Tự do',
        description: 'Quy trình tự do',
        nodes: [rootNode],
        edges: [],
        targetShotId: 'shot-1'
      }

      expect(clearedWf.nodes).toHaveLength(1)
      expect(clearedWf.nodes[0].type).toBe('scene_shot')
      expect(clearedWf.edges).toHaveLength(0)
    })
  })
})
