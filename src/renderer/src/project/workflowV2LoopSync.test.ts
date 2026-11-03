import { describe, expect, it } from 'vitest'
import type { AssetMeta, WorkflowNode } from '@shared/types'
import { createImageLayer, createProject } from './factory'
import {
  deriveLoopLifecycleParams,
  normalizeLoopComboFx,
  readLoopComboFx,
  syncFxAppearAndRhythmToLayers,
  syncLoopSpriteNodeToLayers,
  syncPureLoopAnimNodeToLayers,
  toggleLoopComboFx
} from './workflowV2LoopSync'
import { syncWorkflowV2Graph } from './workflowV2Sync'

function setup() {
  const project = createProject({ duration: 8 })
  const asset = { id: 'a1', name: 'spark.png', kind: 'image', width: 64, height: 64 } as unknown as AssetMeta
  const layer = createImageLayer(asset, project.comp)
  layer.inPoint = 0
  layer.outPoint = 8
  project.layers.push(layer)
  const node = {
    id: 'v2-anim_fx-l1',
    type: 'motion_choreography',
    title: 'Loop',
    enabled: true,
    position: { x: 0, y: 0 },
    params: { logicCategory: 'anim_fx', animMode: 'loop_sprite', targetLayerIds: [layer.id] }
  } as unknown as WorkflowNode
  return { project, layer, node }
}

describe('Workflow V2 · Node Loop (vòng đời + kết hợp FX)', () => {
  it('keeps only one combo effect per property group', () => {
    expect(normalizeLoopComboFx(['blink', 'breathe', 'popIn', 'nope'])).toEqual(['popIn', 'breathe'])
    expect(toggleLoopComboFx(['blink'], 'breathe')).toEqual(['breathe'])
    expect(toggleLoopComboFx(['blink', 'shake'], 'blink')).toEqual(['shake'])
  })

  it('writes lifecycle props from node params and node time (Node Time drives the loop)', () => {
    const { project, layer, node } = setup()
    const params = {
      ...node.params,
      loopMode: 'once' as const,
      loopPlayCount: 2,
      loopEndAction: 'fade_out' as const,
      loopFadeInSec: 0.5,
      loopFadeOutSec: 0.8,
      timeStart: 1.5,
      timeEnd: 6
    }
    syncLoopSpriteNodeToLayers(project, node, params)
    expect(layer.props.loopMode).toBe('once')
    expect(layer.props.loopPlayCount).toBe(2)
    expect(layer.props.loopEndAction).toBe('fade_out')
    expect(layer.props.loopFadeInSec).toBe(0.5)
    expect(layer.props.loopStartTime).toBe(1.5)
    expect(layer.props.loopEndTime).toBe(6)
    const derived = deriveLoopLifecycleParams(layer)
    expect(derived.loopPlayCount).toBe(2)
    expect(derived.loopEndAction).toBe('fade_out')
  })

  it('adds / removes combo FX on the layer and clears everything when the node is disabled', () => {
    const { project, layer, node } = setup()
    const params = { ...node.params, timeStart: 0, timeEnd: 4, loopComboFx: ['popIn', 'neonBreathe'] }
    syncLoopSpriteNodeToLayers(project, node, params)
    expect(readLoopComboFx(layer)).toEqual(['popIn', 'neonBreathe'])
    expect(layer.transform.scale.keyframes.length).toBeGreaterThan(0)
    expect(layer.glow?.enabled).toBe(true)

    syncLoopSpriteNodeToLayers(project, node, { ...params, loopComboFx: ['popIn'] }, { loopComboFx: ['popIn'] })
    expect(readLoopComboFx(layer)).toEqual(['popIn'])

    syncLoopSpriteNodeToLayers(project, { ...node, enabled: false }, { ...params, loopEndAction: 'hide' })
    expect(layer.props.loopRhythmMode).toBe('none')
    expect(layer.props.loopEndAction).toBeUndefined()
    expect(readLoopComboFx(layer)).toEqual([])
  })

  it('auto-connects a dedicated pure Node Animation Loop (loop_anim) when an Animate Loop layer is added', () => {
    const { project, layer } = setup()
    layer.props.loopTemplateId = 'tpl-sparkle-1'
    layer.props.speed = 1.5
    layer.props.loopMode = 'ping-pong'

    const wf = syncWorkflowV2Graph(project, project.workflow)
    const loopNode = wf.nodes.find((n) => n.params?.logicCategory === 'loop_anim')
    expect(loopNode).toBeDefined()
    expect(loopNode?.id).toBe(`v2-loop_anim-${layer.id}`)
    expect(loopNode?.params?.loopSpeed).toBe(1.5)
    expect(loopNode?.params?.loopMode).toBe('ping-pong')
    expect(wf.edges.some((e) => e.fromNode === `v2-layer-${layer.id}` && e.toNode === loopNode?.id)).toBe(true)

    // Pure loop node only mutates loop playback properties
    syncPureLoopAnimNodeToLayers(project, loopNode!, {
      ...loopNode!.params,
      loopMode: 'once',
      loopPlayCount: 3,
      loopEndAction: 'hide',
      loopSpeed: 2.0
    })
    expect(layer.props.loopMode).toBe('once')
    expect(layer.props.loopPlayCount).toBe(3)
    expect(layer.props.loopEndAction).toBe('hide')
    expect(layer.props.speed).toBe(2.0)

    // Node Hiệu ứng (fx) separately controls Fade In/Out and Rhythm Beat
    const fxNode = {
      id: `v2-fx-${layer.id}`,
      type: 'physics_fx',
      title: 'Hiệu ứng',
      enabled: true,
      position: { x: 0, y: 0 },
      params: {
        logicCategory: 'fx',
        targetLayerIds: [layer.id],
        loopFadeInSec: 0.4,
        loopFadeOutSec: 0.6,
        loopEndAction: 'fade_out',
        loopRhythmMode: 'pulse_scale',
        loopScaleBeatPct: 18
      }
    } as unknown as WorkflowNode
    syncFxAppearAndRhythmToLayers(project, fxNode, fxNode.params!)
    expect(layer.fadeIn).toBe(0.4)
    expect(layer.fadeOut).toBe(0.6)
    expect(layer.props.loopFadeInSec).toBe(0.4)
    expect(layer.props.loopFadeOutSec).toBe(0.6)
    expect(layer.props.loopRhythmMode).toBe('pulse_scale')
    expect(layer.props.loopScaleBeatPct).toBe(18)
  })
})
