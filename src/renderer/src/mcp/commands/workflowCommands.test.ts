import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createImageLayer, createShot } from '../../project/factory'
import { DEFAULT_NODE_POSITIONS } from '../../project/workflowCatalog'
import {
  applyWorkflowToProject,
  disconnectWorkflowEdge,
  ensureProjectWorkflow,
  resolveConnectedWorkflowNodes
} from '../../project/workflowEngine'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  spawnLogicNodeIntoWorkflow
} from '../../project/workflowLogicNodes'
import {
  NODE_W,
  buildSmartEdgeGeometry,
  evaluateNodeRuntimeTelemetry
} from '../../ui/workflow/workflowLayoutAndFlow'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'

describe('MCP workflowCommands & Workflow Engine', () => {
  beforeEach(() => {
    const proj = createProject()
    const shot = createShot('Cảnh 1')
    proj.shots.push(shot)
    const shotId = shot.id
    // Add sample layers for testing workflow application
    const skyLayer = createImageLayer(
      { id: 'asset-sky', name: 'Bầu trời đêm.png', kind: 'image', mime: 'image/png', width: 1920, height: 1080 },
      proj.comp,
      2000,
      shotId
    )
    const charLayer = createImageLayer(
      { id: 'asset-hero', name: 'Nhân vật Hero.png', kind: 'image', mime: 'image/png', width: 512, height: 768 },
      proj.comp,
      0,
      shotId
    )
    charLayer.composite = {
      compositeId: 'comp-hero-1',
      compositeName: 'Nhân vật Hero',
      instanceId: 'inst-hero-1',
      lockedGroup: true
    }
    const fgLayer = createImageLayer(
      { id: 'asset-tree', name: 'Cây tiền cảnh.png', kind: 'image', mime: 'image/png', width: 800, height: 900 },
      proj.comp,
      -250,
      shotId
    )
    proj.layers.push(skyLayer, charLayer, fgLayer)

    proj.assets.push({
      id: 'asset-voice-1',
      name: 'Thoại nhân vật.mp3',
      kind: 'audio',
      mime: 'audio/mp3'
    })
    proj.audioTracks = [
      {
        id: 'track-voice-1',
        name: 'Thoại nhân vật',
        assetId: 'asset-voice-1',
        offset: 0,
        volume: 1
      }
    ]

    useEditor.getState().loadProject(proj, null)
  })

  it('lists node specs, port specs, and logic nodes via list_workflow_presets', async () => {
    const res = (await runCommand('list_workflow_presets')) as any
    expect(res.nodeTypes.length).toBe(7)
    expect(res.ports.length).toBe(6)
    expect(res.logicNodes.length).toBeGreaterThanOrEqual(10)
  })

  it('returns default workflow and compiled AI Logical Agent Blueprint via get_workflow', async () => {
    const res = (await runCommand('get_workflow')) as any
    expect(res.workflow).toBeDefined()
    expect(res.workflow.nodes.length).toBe(7)
    expect(res.aiBlueprint).toBeDefined()
    expect(res.aiBlueprint.executionOrder.length).toBeGreaterThanOrEqual(5)
    expect(res.aiBlueprint.agents[0].aiAgentRole).toBe('SceneLayoutAgent')
    expect(
      res.aiBlueprint.agents.some((a: any) => a.recommendedMcpTools.includes('build_camera_path'))
    ).toBe(true)
  })

  it('updates individual node configuration via set_workflow', async () => {
    const res = (await runCommand('set_workflow', {
      node_id: 'wf-camera_director',
      node_preset: 'dolly_push_focus'
    })) as any

    expect(res.ok).toBe(true)
    const camNode = res.workflow.nodes.find((n: any) => n.id === 'wf-camera_director')
    expect(camNode.preset).toBe('dolly_push_focus')
  })

  it('connects, disconnects, and auto-wires workflow ports via connect_workflow_ports', async () => {
    const first = (await runCommand('get_workflow')) as any
    const edgeToDisconnect = first.workflow.edges[0].id

    const afterDisconnect = (await runCommand('connect_workflow_ports', {
      action: 'disconnect',
      edge_id: edgeToDisconnect
    })) as any
    expect(
      afterDisconnect.workflow.edges.some((e: any) => e.id === edgeToDisconnect)
    ).toBe(false)

    const afterConnect = (await runCommand('connect_workflow_ports', {
      action: 'connect',
      from_node: 'wf-scene_shot',
      to_node: 'wf-layer_assembly',
      port: 'scene_ctx'
    })) as any
    expect(
      afterConnect.workflow.edges.some(
        (e: any) => e.fromNode === 'wf-scene_shot' && e.toNode === 'wf-layer_assembly' && e.fromPort === 'scene_ctx'
      )
    ).toBe(true)

    const afterAutoWire = (await runCommand('connect_workflow_ports', {
      action: 'auto_wire'
    })) as any
    expect(afterAutoWire.workflow.edges.length).toBeGreaterThanOrEqual(6)
  })

  it('executes connected workflow onto project via apply_workflow', async () => {
    const res = (await runCommand('apply_workflow', {})) as any

    expect(res.ok).toBe(true)
    expect(res.report).toBeDefined()
    expect(res.executedStages.length).toBeGreaterThanOrEqual(5)
    expect(res.executedStages.some((s: any) => s.affectedCount > 0)).toBe(true)

    const updatedProject = useEditor.getState().project
    expect(updatedProject.camera.position.keyframes.length).toBeGreaterThan(0)
    // Character layer should have motion or physics configured
    const hero = updatedProject.layers.find((l) => l.name.includes('Hero'))
    expect(hero?.motion?.type).not.toBe('none')
    expect(hero?.virtualLight?.enabled).toBe(true)
  })

  it('binds explicit 2.5D composite/layers and sub-parts to a workflow node and reflects in AI Blueprint', async () => {
    const initial = (await runCommand('get_workflow')) as any
    expect(initial.bindableTargets.length).toBeGreaterThanOrEqual(3)
    const compositeTarget = initial.bindableTargets.find((t: any) => t.kind === 'composite_25d')
    expect(compositeTarget).toBeDefined()

    const updated = (await runCommand('set_workflow', {
      node_id: 'wf-motion_choreography',
      target_mode: 'custom',
      target_layer_ids: [compositeTarget.id],
      target_parts: ['torso_breathe', 'hair_cloth_sway']
    })) as any

    expect(updated.ok).toBe(true)
    const motionAgent = updated.aiBlueprint.agents.find(
      (a: any) => a.nodeType === 'motion_choreography'
    )
    expect(motionAgent).toBeDefined()
    expect(motionAgent.boundTargets.map((t: any) => t.id)).toEqual([compositeTarget.id])
    expect(motionAgent.activeParts.map((p: any) => p.id)).toEqual([
      'torso_breathe',
      'hair_cloth_sway'
    ])
  })

  it('maintains spacious node layout, smart corridor wire routing, and live playback telemetry', () => {
    // Check horizontal column gaps >= 100px and vertical row separation >= 220px
    expect(DEFAULT_NODE_POSITIONS.layer_assembly.x - (DEFAULT_NODE_POSITIONS.scene_shot.x + NODE_W)).toBeGreaterThanOrEqual(100)
    expect(DEFAULT_NODE_POSITIONS.audio_lipsync.y - DEFAULT_NODE_POSITIONS.motion_choreography.y).toBeGreaterThanOrEqual(220)

    // Auto-upgrades legacy cramped positions
    const proj = useEditor.getState().project
    const wf = ensureProjectWorkflow(proj)
    const sceneNode = wf.nodes.find((n) => n.type === 'scene_shot')!
    const camNode = wf.nodes.find((n) => n.type === 'camera_director')!
    const geom = buildSmartEdgeGeometry(sceneNode, 'scene_ctx', camNode, 'scene_ctx', wf.nodes)
    expect(geom.path).toContain('L ')
    expect(geom.midY).toBeGreaterThan(170)
    expect(geom.midY).toBeLessThan(350)

    const telemetryRunning = evaluateNodeRuntimeTelemetry(sceneNode, proj, 2.5, true, true, 1, 7)
    expect(telemetryRunning.state).toBe('running')
    expect(telemetryRunning.liveSummary).toContain('lớp hiển thị')

    // Verify orphan subgraphs disconnected from scene_shot are rejected
    applyWorkflowToProject(proj, wf)
    const treeLayer = proj.layers.find((l) => l.name.includes('Cây tiền cảnh'))!
    expect(treeLayer.motion?.type).toBeDefined()

    const orphanGraph = {
      ...wf,
      edges: [
        {
          id: 'orphan-1',
          fromNode: 'wf-layer_assembly',
          fromPort: 'actors_rig' as const,
          toNode: 'wf-motion_choreography',
          toPort: 'actors_rig' as const
        },
        {
          id: 'orphan-2',
          fromNode: 'wf-audio_lipsync',
          fromPort: 'audio_mix' as const,
          toNode: 'wf-look_output',
          toPort: 'audio_mix' as const
        }
      ]
    }
    const { activeNodes, disconnectedNodes } = resolveConnectedWorkflowNodes(orphanGraph)
    expect(activeNodes.length).toBe(0)
    expect(disconnectedNodes.length).toBe(7)

    // Disconnected stages immediately deactivate motions & camera path
    applyWorkflowToProject(proj, orphanGraph)
    expect(treeLayer.motion?.enabled).toBe(false)
    expect(proj.camera.position.keyframes.length).toBe(0)

    // Custom rules on an active stage apply directly to target layers
    const partialConnected = {
      ...wf,
      nodes: wf.nodes.map((n) =>
        n.type === 'motion_choreography'
          ? {
              ...n,
              params: {
                ...(n.params ?? {}),
                customRules: [
                  {
                    id: 'rule-test-candle',
                    label: 'Đèn nến 2.5D',
                    actionKind: 'virtual_light_candle' as const,
                    targetId: treeLayer.id,
                    targetName: treeLayer.name,
                    speed: 1.4,
                    amount: 0.9,
                    enabled: true
                  }
                ]
              }
            }
          : n
      ),
      edges: [
        {
          id: 'e1',
          fromNode: 'wf-scene_shot',
          fromPort: 'scene_ctx' as const,
          toNode: 'wf-layer_assembly',
          toPort: 'scene_ctx' as const
        },
        {
          id: 'e2',
          fromNode: 'wf-layer_assembly',
          fromPort: 'actors_rig' as const,
          toNode: 'wf-motion_choreography',
          toPort: 'actors_rig' as const
        }
      ]
    }
    const partialResolved = resolveConnectedWorkflowNodes(partialConnected)
    expect(partialResolved.activeNodes.map((n) => n.type)).toEqual([
      'scene_shot',
      'layer_assembly',
      'motion_choreography'
    ])
    applyWorkflowToProject(proj, partialConnected)
    expect(treeLayer.virtualLight?.enabled).toBe(true)
    expect(treeLayer.virtualLight?.kind).toBe('candle')

    // Preserves 4-directional user-dragged node coordinates (including x < 0, y < 0, x <= 310)
    proj.workflow = {
      ...wf,
      nodes: wf.nodes.map((n) => {
        if (n.type === 'scene_shot') return { ...n, position: { x: -140, y: -60 } }
        if (n.type === 'layer_assembly') return { ...n, position: { x: 180, y: 40 } }
        return n
      })
    }
    const afterDragWf = ensureProjectWorkflow(proj)
    expect(afterDragWf.nodes.find((n) => n.type === 'scene_shot')?.position).toEqual({ x: -140, y: -60 })
    expect(afterDragWf.nodes.find((n) => n.type === 'layer_assembly')?.position).toEqual({ x: 180, y: 40 })

    // Regression guard: setTime(NaN / undefined) never poisons editor time or scene evaluation
    useEditor.getState().setTime(2.5)
    useEditor.getState().setTime(NaN)
    expect(Number.isFinite(useEditor.getState().time)).toBe(true)
    expect(useEditor.getState().time).toBe(2.5)

    // Bi-directional sync: edits in Right Inspector (Layer, Camera, Look) sync into Workflow
    treeLayer.glow = {
      enabled: true,
      side: 'outer',
      color: '#38bdf8',
      thickness: 8,
      intensity: 1.5,
      animated: 'breathe',
      speed: 1.8
    }
    proj.camera.dofEnabled = false
    proj.look.fogEnabled = false
    const syncedWf = ensureProjectWorkflow(proj)
    const fxNode = syncedWf.nodes.find((n) => n.type === 'physics_fx')!
    expect(fxNode.params?.targetParts).toContain('rim_glow_silhouette')
    expect(
      fxNode.params?.customRules?.some(
        (r) => r.id === `inspector-glow-${treeLayer.id}` && r.enabled
      )
    ).toBe(true)
    const camNodeSynced = syncedWf.nodes.find((n) => n.type === 'camera_director')!
    expect(camNodeSynced.params?.enableDof).toBe(false)
    const lookNodeSynced = syncedWf.nodes.find((n) => n.type === 'look_output')!
    expect(lookNodeSynced.params?.targetParts).not.toContain('z_depth_fog')
  })

  it('isolates workflow execution strictly per-shot and supports spawning/disconnecting Logic Nodes', () => {
    const proj = useEditor.getState().project
    const shot1 = proj.shots[0]
    const shot2 = createShot('Cảnh 2 - Rừng Đom Đóm')
    const shot3 = createShot('Cảnh 3 - Đỉnh Núi Mây')
    proj.shots.push(shot2, shot3)

    const layerShot3 = createImageLayer(
      { id: 'asset-s3', name: 'Cây Cảnh 3.png', kind: 'image', mime: 'image/png', width: 800, height: 900 },
      proj.comp,
      400,
      shot3.id
    )
    proj.layers.push(layerShot3)

    // Scope workflow strictly to Shot 1
    const baseWf = {
      ...ensureProjectWorkflow(proj),
      targetShotId: shot1.id
    }

    // Spawn a Logic Node ("Ánh Sáng Ấm") into Shot 1's workflow
    expect(WORKFLOW_LOGIC_NODE_CATALOG.length).toBeGreaterThanOrEqual(8)
    const { workflow: wfWithLogic, spawnedNode } = spawnLogicNodeIntoWorkflow(
      baseWf,
      'logic-fx-candle',
      shot1.id
    )
    expect(spawnedNode.params?.logicId).toBe('logic-fx-candle')
    expect(spawnedNode.params?.shotId).toBe(shot1.id)

    applyWorkflowToProject(proj, wfWithLogic)

    // Camera DOF must remain OFF by default so Camera viewport stays razor-sharp like Cam 2D
    expect(proj.camera.dofEnabled).toBe(false)

    // Shot 1 layers receive motion & candle virtual light
    const shot1Layers = proj.layers.filter((l) => l.shotId === shot1.id)
    expect(shot1Layers.some((l) => l.virtualLight?.enabled)).toBe(true)

    // Shot 3 layer must remain 100% untouched (no motion, no virtualLight, no Z-shift)
    expect(layerShot3.motion?.enabled ?? false).toBe(false)
    expect(layerShot3.virtualLight?.enabled ?? false).toBe(false)
    expect(layerShot3.transform.position.value[2]).toBe(400)

    // Disconnecting the spawned Logic Node from the flow turns off its candle light on Shot 1
    const inEdge = wfWithLogic.edges.find((e) => e.toNode === spawnedNode.id)!
    const afterCut = disconnectWorkflowEdge(wfWithLogic, { edgeId: inEdge.id })
    applyWorkflowToProject(proj, afterCut)
    expect(shot1Layers.some((l) => l.virtualLight?.enabled)).toBe(false)
  })
})

