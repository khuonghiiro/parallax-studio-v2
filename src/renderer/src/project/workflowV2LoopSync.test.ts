import { describe, expect, it } from 'vitest'
import type { AssetMeta, WorkflowNode } from '@shared/types'
import { createImageLayer, createProject } from './factory'
import {
  deriveLoopLifecycleParams,
  normalizeLoopComboFx,
  readLoopComboFx,
  syncLoopSpriteNodeToLayers,
  toggleLoopComboFx
} from './workflowV2LoopSync'

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
})
