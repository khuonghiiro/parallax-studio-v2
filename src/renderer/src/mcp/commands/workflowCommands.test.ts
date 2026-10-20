import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createImageLayer, createShot } from '../../project/factory'
import { DEFAULT_NODE_POSITIONS } from '../../project/workflowCatalog'
import { ensureProjectWorkflow } from '../../project/workflowEngine'
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

  it('lists built-in workflow presets, node specs, and port specs', async () => {
    const res = (await runCommand('list_workflow_presets')) as any
    expect(res.templates.length).toBeGreaterThanOrEqual(5)
    expect(res.nodeTypes.length).toBe(7)
    expect(res.ports.length).toBe(6)
    expect(res.templates.map((t: any) => t.id)).toContain('cinematic_parallax_intro')
    expect(res.templates.map((t: any) => t.id)).toContain('character_action_physics')
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

  it('updates workflow preset and individual node configuration via set_workflow', async () => {
    const res = (await runCommand('set_workflow', {
      preset_id: 'cave_virtual_light_explore',
      node_id: 'wf-camera_director',
      node_preset: 'dolly_push_focus'
    })) as any

    expect(res.ok).toBe(true)
    expect(res.workflow.presetId).toBe('cave_virtual_light_explore')
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
    const res = (await runCommand('apply_workflow', {
      preset_id: 'character_action_physics'
    })) as any

    expect(res.ok).toBe(true)
    expect(res.report).toBeDefined()
    expect(res.executedStages.length).toBeGreaterThanOrEqual(5)
    expect(res.executedStages.some((s: any) => s.affectedCount > 0)).toBe(true)

    const updatedProject = useEditor.getState().project
    expect(updatedProject.workflow?.presetId).toBe('character_action_physics')
    expect(updatedProject.camera.position.keyframes.length).toBeGreaterThan(0)
    // Character layer should have motion or physics configured
    const hero = updatedProject.layers.find((l) => l.name.includes('Hero'))
    expect(hero?.motion?.type).not.toBe('none')
    expect(hero?.physics?.enabled).toBe(true)
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
    expect(geom.midY).toBeLessThan(256)

    const telemetryRunning = evaluateNodeRuntimeTelemetry(sceneNode, proj, 2.5, true, true, 1, 7)
    expect(telemetryRunning.state).toBe('running')
    expect(telemetryRunning.liveSummary).toContain('lớp hiển thị')
  })
})

