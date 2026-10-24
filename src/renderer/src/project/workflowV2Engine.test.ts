import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import {
  WF_V2_COL_X,
  attachLogicNodeToLayerV2,
  buildWorkflowV2SceneTree,
  syncWorkflowV2NodeToProject
} from './workflowV2Engine'
describe('Workflow V2 Engine — Hierarchical Time-Driven Scene Tree', () => {
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
    proj.layers.push(sky, cave, hero)
    return { proj, shot, sky, cave, hero }
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
    expect(layerNodes.length).toBe(3)
    for (const ln of layerNodes) {
      expect(ln.position.x).toBe(WF_V2_COL_X.LAYER)
      expect(wf.edges.some((e) => e.toNode === ln.id)).toBe(true)
    }
    // Level 3: Logic Nodes (Action, Light, Cave) connected from Layer Nodes
    const caveLogic = wf.nodes.find((n) => n.params?.logicCategory === 'cave')
    expect(caveLogic).toBeDefined()
    expect(caveLogic?.position.x).toBe(WF_V2_COL_X.LOGIC)
  })
  it('attaches Action, Light, Cave, FX, and Audio logic nodes to a Layer and syncs to Project', () => {
    const { proj, shot, hero } = createSampleSceneProject()
    let wf = buildWorkflowV2SceneTree(proj, shot.id)
    const heroNodeId = `v2-layer-${hero.id}`
    // Attach Light node
    const lightRes = attachLogicNodeToLayerV2(wf, heroNodeId, 'light')
    wf = lightRes.workflow
    const lightNode = wf.nodes.find((n) => n.id === lightRes.createdNodeId)!
    expect(lightNode.params?.logicCategory).toBe('light')
    syncWorkflowV2NodeToProject(proj, lightNode, { lightColor: '#fbbf24', intensity: 1.8, timeStart: 0.5, timeEnd: 3.5 })
    expect(hero.virtualLight?.enabled).toBe(true)
    expect(hero.virtualLight?.color).toBe('#fbbf24')
    // Attach Cave node
    const caveRes = attachLogicNodeToLayerV2(wf, heroNodeId, 'cave')
    wf = caveRes.workflow
    const caveNode = wf.nodes.find((n) => n.id === caveRes.createdNodeId)!
    expect(caveNode.params?.logicCategory).toBe('cave')
    syncWorkflowV2NodeToProject(proj, caveNode, { caveArchShape: 'ellipse', caveDarkness: 0.9 })
    expect(hero.physics?.depthPortal?.enabled).toBe(true)
    expect(hero.physics?.depthPortal?.archShape).toBe('ellipse')
    expect(hero.physics?.depthPortal?.darkness).toBe(0.9)
    // Sync Layer time range [inPoint, outPoint] and Z depth
    const heroLayerNode = wf.nodes.find((n) => n.id === heroNodeId)!
    syncWorkflowV2NodeToProject(proj, heroLayerNode, { timeStart: 1.2, timeEnd: 4.4, transformZ: 280 })
    expect(hero.inPoint).toBe(1.2)
    expect(hero.outPoint).toBe(4.4)
    expect(hero.transform.position.value[2]).toBe(280)
  })
})
