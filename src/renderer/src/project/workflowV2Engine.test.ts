import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import {
  WF_V2_COL_X,
  attachLogicNodeToLayerV2,
  buildWorkflowV2SceneTree,
  recomputeSharedLogicTargets,
  syncWorkflowV2NodeToProject,
  validateWorkflowV2Connection
} from './workflowV2Engine'

describe('Workflow V2 Engine — Hierarchical Time-Driven Scene Tree, Validation, Reuse & Collision Physics', () => {
  function createSampleSceneProject() {
    const proj = createProject()
    const shot = createShot('Thung Lũng Huyền Ẩn')
    proj.shots.push(shot)
    const sky = createImageLayer(
      { id: 'a-sky', name: 'Bầu trời hoàng hôn', kind: 'image', mime: 'image/png', width: 1920, height: 1080 },
      proj.comp,
      3200,
      shot.id
    )
    const cave = createImageLayer(
      { id: 'a-cave', name: 'Cổng di tích hang động', kind: 'image', mime: 'image/png', width: 1200, height: 900 },
      proj.comp,
      450,
      shot.id
    )
    const vine = createImageLayer(
      { id: 'a-vine', name: 'Dây leo tiền cảnh', kind: 'image', mime: 'image/png', width: 800, height: 900 },
      proj.comp,
      180,
      shot.id
    )
    const hero = createImageLayer(
      { id: 'a-hero', name: 'Hiệp sĩ 2.5D', kind: 'image', mime: 'image/png', width: 512, height: 768 },
      proj.comp,
      120,
      shot.id
    )
    hero.composite = {
      instanceId: 'inst-hero',
      compositeId: 'comp-hero',
      compositeName: 'Hiệp sĩ 2.5D',
      lockedGroup: true,
      isRoot: true
    }
    proj.layers.push(sky, cave, vine, hero)
    return { proj, shot, sky, cave, vine, hero }
  }

  it('builds a 4-level hierarchy: Root Scene -> Group Layers -> Layer Nodes -> Logic Nodes', () => {
    const { proj, shot } = createSampleSceneProject()
    const wf = buildWorkflowV2SceneTree(proj, shot.id)
    expect(wf.presetId).toBe('v2_scene_hierarchy')

    // Level 0: Root Scene + Camera
    const root = wf.nodes.find((n) => n.id === 'v2-root-scene')
    expect(root).toBeDefined()
    expect(root?.position.x).toBe(WF_V2_COL_X.ROOT)

    // Level 1: Group Layers connected from Root Scene
    const groups = wf.nodes.filter((n) => Boolean(n.params?.groupKind))
    expect(groups.length).toBeGreaterThanOrEqual(2)
    for (const g of groups) {
      expect(g.position.x).toBe(WF_V2_COL_X.GROUP)
      expect(wf.edges.some((e) => e.fromNode === 'v2-root-scene' && e.toNode === g.id)).toBe(true)
    }

    // Level 2: Layer Nodes connected from their Group Layer
    const layerNodes = wf.nodes.filter((n) => n.type === 'layer_assembly' && !n.params?.groupKind)
    expect(layerNodes.length).toBe(4)
    for (const ln of layerNodes) {
      expect(ln.position.x).toBe(WF_V2_COL_X.LAYER)
      expect(wf.edges.some((e) => e.toNode === ln.id)).toBe(true)
    }

    // Level 3: Logic Nodes (Action, Material, Collision, Cave) connected from Layer Nodes
    const caveLogic = wf.nodes.find((n) => n.params?.logicCategory === 'cave')
    expect(caveLogic).toBeDefined()
    expect(caveLogic?.position.x).toBeGreaterThanOrEqual(WF_V2_COL_X.LOGIC)
  })

  it('enforces strict connection validation, prevents duplicate logic per layer, and supports multi-layer node reuse', () => {
    const { proj, shot, cave, vine, hero } = createSampleSceneProject()
    let wf = buildWorkflowV2SceneTree(proj, shot.id)
    const caveNodeId = `v2-layer-${cave.id}`
    const vineNodeId = `v2-layer-${vine.id}`
    const heroNodeId = `v2-layer-${hero.id}`

    // 1. Block invalid Layer -> Layer connection
    const layerToLayer = validateWorkflowV2Connection(wf, vineNodeId, caveNodeId)
    expect(layerToLayer.valid).toBe(false)
    expect(layerToLayer.reason).toContain('Không nối trực tiếp 2 Node Layer')

    // 2. Block invalid Root -> Logic connection
    const anyLogic = wf.nodes.find((n) => n.params?.logicCategory === 'action')!
    const rootToLogic = validateWorkflowV2Connection(wf, 'v2-root-scene', anyLogic.id)
    expect(rootToLogic.valid).toBe(false)

    // 3. Anti-duplicate logic per Layer: attaching a 2nd 'action' node to hero reuses existing node instead of duplicating
    const firstAction = attachLogicNodeToLayerV2(wf, heroNodeId, 'action')
    wf = firstAction.workflow
    const duplicateTry = attachLogicNodeToLayerV2(wf, heroNodeId, 'action')
    expect(duplicateTry.reusedExisting).toBe(true)
    expect(duplicateTry.createdNodeId).toBe(firstAction.createdNodeId)

    // 4. Node Reuse: allow a second Layer (caveNodeId) to connect into and share vine's Action Node
    const vineActionEdge = wf.edges.find(
      (e) =>
        e.fromNode === vineNodeId &&
        wf.nodes.find((n) => n.id === e.toNode)?.params?.logicCategory === 'action'
    )!
    const sharedActionNodeId = vineActionEdge.toNode
    const reuseCheck = validateWorkflowV2Connection(wf, caveNodeId, sharedActionNodeId)
    expect(reuseCheck.valid).toBe(true)

    const nextEdges = [
      ...wf.edges,
      {
        id: `e-${caveNodeId}-${sharedActionNodeId}`,
        fromNode: caveNodeId,
        fromPort: 'layers_tree' as const,
        toNode: sharedActionNodeId,
        toPort: 'layers_tree' as const
      }
    ]
    const syncedNodes = recomputeSharedLogicTargets(wf.nodes, nextEdges)
    const sharedNode = syncedNodes.find((n) => n.id === sharedActionNodeId)!
    expect(sharedNode.params?.sharedLayerNodeIds).toEqual(expect.arrayContaining([vineNodeId, caveNodeId]))
    expect(sharedNode.params?.targetLayerIds).toEqual(expect.arrayContaining([vine.id, cave.id]))
  })

  it('applies Material Tag nodes and 2-Layer Collision Physics with material-specific deformation keyframes', () => {
    const { proj, shot, vine, cave } = createSampleSceneProject()
    let wf = buildWorkflowV2SceneTree(proj, shot.id)
    proj.workflow = wf

    const vineNodeId = `v2-layer-${vine.id}`
    const caveNodeId = `v2-layer-${cave.id}`

    // 1. Tag vine as 'jelly_slime' (soft rubber/jelly that squashes 42%)
    const matResA = attachLogicNodeToLayerV2(wf, vineNodeId, 'material')
    wf = matResA.workflow
    const matNodeA = wf.nodes.find((n) => n.id === matResA.createdNodeId)!
    matNodeA.params = { ...matNodeA.params, materialTag: 'jelly_slime', materialStiffness: 0.35, materialBounciness: 1.25 }
    syncWorkflowV2NodeToProject(proj, matNodeA)
    expect(vine.physics?.enabled).toBe(true)
    expect(vine.physics?.material).toBe('jelly_slime')
    expect(vine.physics?.bounciness).toBe(1.25)

    // 2. Tag cave as 'stone_wall' (rigid stone that vibrates slightly on impact)
    const matResB = attachLogicNodeToLayerV2(wf, caveNodeId, 'material')
    wf = matResB.workflow
    const matNodeB = wf.nodes.find((n) => n.id === matResB.createdNodeId)!
    matNodeB.params = { ...matNodeB.params, materialTag: 'stone_wall', materialStiffness: 0.96, materialBounciness: 0.25 }
    syncWorkflowV2NodeToProject(proj, matNodeB)
    expect(cave.physics?.enabled).toBe(true)
    expect(cave.physics?.material).toBe('stone_wall')

    // 3. Configure the 2-Layer Collision Node connecting vine (Striker A) and cave (Collider B)
    const colRes = attachLogicNodeToLayerV2(wf, vineNodeId, 'collision')
    wf = colRes.workflow
    proj.workflow = wf
    const colNode = wf.nodes.find((n) => n.id === colRes.createdNodeId)!
    expect(colNode.params?.logicCategory).toBe('collision')
    expect(colNode.params?.sharedLayerNodeIds?.length).toBeGreaterThanOrEqual(2)

    syncWorkflowV2NodeToProject(proj, colNode, {
      collisionMode: 'elastic_bounce',
      collisionForce: 1.2,
      deformIntensity: 1.0,
      strikerLayerId: vine.id,
      targetColliderLayerId: cave.id,
      timeStart: 1.0,
      timeEnd: 3.0
    })

    // Verify real engine PhysicsImpactPulse and squash-and-stretch / rebound keyframes on both layers
    expect(vine.physics?.impacts?.length).toBeGreaterThan(0)
    expect(cave.physics?.impacts?.length).toBeGreaterThan(0)
    expect(vine.transform.position.keyframes.length).toBeGreaterThanOrEqual(3)
    expect(vine.transform.scale.keyframes.length).toBeGreaterThanOrEqual(3)
    expect(cave.transform.scale.keyframes.length).toBeGreaterThanOrEqual(3)

    // Soft jelly_slime (vine) should deform/squash more at impact than rigid stone_wall (cave)
    const vineImpactScale = vine.transform.scale.keyframes[1].value
    const caveImpactScale = cave.transform.scale.keyframes[1].value
    const vineDeformDelta = Math.abs(vineImpactScale[0] - vine.transform.scale.keyframes[0].value[0])
    const caveDeformDelta = Math.abs(caveImpactScale[0] - cave.transform.scale.keyframes[0].value[0])
    expect(vineDeformDelta).toBeGreaterThan(caveDeformDelta)
  })
})
