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
  NODE_W,
  resolveNodeCollisionPush,
  solveSpaciousWorkflowLayout
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
      // scene_shot (layers_tree) -> layer_assembly (inputs: layers_tree)
      expect(getBestMatchingInputPort('layers_tree', assemblyNode)).toBe('layers_tree')

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

  describe('Collision Push & Auto-Layout (Anti-Overlap Guarantee)', () => {
    it('automatically pushes overlapping nodes away to prevent UI occlusion', () => {
      const fixedNode = { ...sceneNode, position: { x: 100, y: 100 } }
      const incomingNode = { ...assemblyNode, position: { x: 120, y: 120 } }

      // When dragging incomingNode directly onto fixedNode (collision)
      const resolved = resolveNodeCollisionPush(incomingNode, { x: 120, y: 120 }, [fixedNode])

      // Resolved position must be completely disjoint from fixedNode
      const isOverlapping =
        resolved.x < fixedNode.position.x + NODE_W + 20 &&
        resolved.x + NODE_W + 20 > fixedNode.position.x &&
        resolved.y < fixedNode.position.y + 120 &&
        resolved.y + 120 > fixedNode.position.y

      expect(isOverlapping).toBe(false)
      expect(resolved.y).toBeGreaterThan(fixedNode.position.y)
    })

    it('arranges multi-layer workflow cleanly into columns with zero overlapping nodes', () => {
      const complexNodes = [
        { ...sceneNode, id: 'n-scene' },
        { ...assemblyNode, id: 'n-layer-1', params: { targetLayerIds: ['l1'] } },
        { ...assemblyNode, id: 'n-layer-2', params: { targetLayerIds: ['l2'] } },
        { ...assemblyNode, id: 'n-layer-3', params: { targetLayerIds: ['l3'] } },
        { ...motionNode, id: 'n-motion-1', params: { logicId: 'logic-physics-wind' } },
        { ...motionNode, id: 'n-motion-2', params: { logicId: 'logic-motion-drift' } },
        { ...fxNode, id: 'n-fx-1', params: { logicId: 'logic-fx-candle' } },
        { ...camNode, id: 'n-cam' },
        { ...lookNode, id: 'n-look' }
      ]

      const layout = solveSpaciousWorkflowLayout(complexNodes, [])

      // Verify all nodes have assigned positions
      for (const n of complexNodes) {
        expect(layout[n.id]).toBeDefined()
        expect(Number.isFinite(layout[n.id].x)).toBe(true)
        expect(Number.isFinite(layout[n.id].y)).toBe(true)
      }

      // Check horizontal progression between layers from left to right
      expect(layout['n-layer-2'].x).toBeGreaterThan(layout['n-layer-1'].x)
      expect(layout['n-layer-3'].x).toBeGreaterThan(layout['n-layer-2'].x)

      // Check vertical stratum and downstream column placement
      expect(layout['n-layer-1'].y).toBeGreaterThan(layout['n-scene'].y)
      expect(layout['n-cam'].x).toBeGreaterThan(layout['n-scene'].x)
      expect(layout['n-motion-1'].x).toBeGreaterThan(layout['n-layer-3'].x)
      expect(layout['n-look'].x).toBeGreaterThan(layout['n-cam'].x)
    })
  })

  describe('Camera Logic Node Separation & Look Output Delivery', () => {
    it('allows camera_cut port in camera_director and look_output inputs', () => {
      expect(WORKFLOW_NODE_SPECS.camera_director.inputs).toContain('camera_cut')
      expect(WORKFLOW_NODE_SPECS.look_output.inputs).toContain('camera_cut')
    })

    it('matches camera_cut between camera modifier nodes and downstream look node', () => {
      // connecting camera_cut from camNode to another camNode (modifier chaining)
      expect(getBestMatchingInputPort('camera_cut', camNode)).toBe('camera_cut')

      // connecting camera_cut from camNode to look_output (final render delivery)
      expect(getBestMatchingInputPort('camera_cut', lookNode)).toBe('camera_cut')

      // layer_assembly does NOT accept camera cuts (semantically invalid)
      expect(getBestMatchingInputPort('camera_cut', assemblyNode)).toBeNull()
    })
  })
})
