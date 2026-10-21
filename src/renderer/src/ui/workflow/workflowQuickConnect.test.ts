import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { getQuickConnectItems } from './workflowQuickConnect'

const layer: WorkflowNode = {
  id: 'layer', type: 'layer_assembly', title: 'Layer', enabled: true,
  position: { x: 0, y: 0 }, preset: '', aiAgentRole: 'assembly' as WorkflowNode['aiAgentRole'], aiDirective: ''
}

describe('quick connect suggestions', () => {
  it('offers motion producers for an incoming motion port', () => {
    const items = getQuickConnectItems(layer, 'motion_stream', false)
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((item) => item.nodeType === 'motion_choreography')).toBe(true)
    // Scene context can also feed the node under the shared connection rules.
    expect(items.every((item) => ['motion_choreography', 'scene_shot'].includes(item.nodeType))).toBe(true)
  })
  it('does not bypass compatibility when searching', () => {
    expect(getQuickConnectItems(layer, 'motion_stream', false, 'camera')).toEqual([])
  })
  it('searches Vietnamese labels without accents', () => {
    const items = getQuickConnectItems(layer, 'motion_stream', false)
    const word = items[0].title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    expect(getQuickConnectItems(layer, 'motion_stream', false, word)).toContain(items[0])
  })
  it('does not suggest unrelated blocks for a transform link', () => {
    expect(getQuickConnectItems(layer, 'transform_link', true)).toEqual([])
  })
})
