import { describe, expect, it } from 'vitest'
import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import { buildEdgePath, computeSmartTimeEdgeRoute, isV2EdgeFlowing } from './workflowV2Edges'

const from = { id: 'from', enabled: true, params: { timeEnd: 5 } } as unknown as WorkflowNode
const to = { id: 'to', enabled: true, params: { timeStart: 6 } } as unknown as WorkflowNode
const edge = { id: 'edge', fromNode: 'from', toNode: 'to' } as WorkflowEdge
const active = new Set(['from', 'to'])

describe('workflow connection playback', () => {
  it('does not animate paused, disabled or inactive connections', () => {
    expect(isV2EdgeFlowing(edge, from, to, 'logic', active, 2, false)).toBe(false)
    expect(isV2EdgeFlowing({ ...edge, disabled: true }, from, to, 'logic', active, 2, true)).toBe(false)
    expect(isV2EdgeFlowing(edge, { ...from, enabled: false }, to, 'logic', active, 2, true)).toBe(false)
    expect(isV2EdgeFlowing(edge, from, { ...to, enabled: false }, 'logic', active, 2, true)).toBe(false)
    expect(isV2EdgeFlowing(edge, from, to, 'logic', new Set(['to']), 2, true)).toBe(false)
  })

  it('flows from an active source to its active logic target', () => {
    expect(isV2EdgeFlowing(edge, from, to, 'logic', active, 2, true)).toBe(true)
    expect(isV2EdgeFlowing(edge, from, to, 'data', active, 2, true)).toBe(true)
  })

  it('advances to the current waypoint after the preceding waypoint has finished', () => {
    const waypoint = { ...to, params: { isCameraWaypoint: true } } as unknown as WorkflowNode
    expect(isV2EdgeFlowing(edge, from, waypoint, 'logic', new Set(['to']), 2, true)).toBe(true)
    expect(isV2EdgeFlowing(edge, from, waypoint, 'logic', new Set(['from']), 2, true)).toBe(false)
  })

  it('shows camera travel only inside the transition interval', () => {
    for (const time of [4.8, 6, 6.5]) {
      expect(isV2EdgeFlowing(edge, from, to, 'camera', active, time, true)).toBe(false)
    }
    expect(isV2EdgeFlowing(edge, from, to, 'camera', active, 5.5, true)).toBe(true)
    expect(isV2EdgeFlowing(edge, from, to, 'camera', active, 5.5, false)).toBe(false)
  })

  it('uses the scene route instead of overlapping camera waypoint tails', () => {
    const camera = { ...from, params: { timeEnd: 7 } } as unknown as WorkflowNode
    expect(isV2EdgeFlowing(edge, camera, to, 'camera', active, 4, true, { start: 3, end: 5 })).toBe(true)
    expect(isV2EdgeFlowing(edge, camera, to, 'camera', active, 5, true, { start: 5, end: 5 })).toBe(false)
  })
})

describe('computeSmartTimeEdgeRoute', () => {
  const timeNode = {
    id: 'time-a',
    type: 'logic_node',
    position: { x: 500, y: 100 },
    params: { logicCategory: 'time' }
  } as unknown as WorkflowNode

  it('routes cleanly to a partner on the left from the left port with rounded orthogonal steps', () => {
    const leftPartner = {
      id: 'cam-wp',
      type: 'logic_node',
      position: { x: 48, y: 160 },
      params: { isCameraWaypoint: true }
    } as unknown as WorkflowNode

    const route = computeSmartTimeEdgeRoute(timeNode, leftPartner, 0)
    expect(route.path).toContain('M')
    expect(route.path).toContain('Q') // has rounded corners
    // Does not fall back to diagonal straight cut
    expect(route.path.split(' ').length).toBeGreaterThan(6)
    // Control point sits in the vertical channel between nodes
    expect(route.controlPoint[0]).toBeGreaterThan(leftPartner.position.x + 236)
    expect(route.controlPoint[0]).toBeLessThan(timeNode.position.x)

    const edgePath = buildEdgePath(timeNode, leftPartner, 'time', 'smoothstep', 0)
    expect(edgePath).toBe(route.path)
  })

  it('routes cleanly to a partner on the right from the right port', () => {
    const rightPartner = {
      id: 'layer-1',
      type: 'layer_assembly',
      position: { x: 880, y: 100 },
      params: {}
    } as unknown as WorkflowNode

    const route = computeSmartTimeEdgeRoute(timeNode, rightPartner, 0)
    expect(route.path).toContain('M')
    expect(route.controlPoint[0]).toBeGreaterThan(timeNode.position.x)
    expect(route.controlPoint[0]).toBeLessThanOrEqual(rightPartner.position.x)
  })

  it('routes vertically to a partner directly below or above', () => {
    const belowPartner = {
      id: 'layer-below',
      type: 'layer_assembly',
      position: { x: 500, y: 280 },
      params: {}
    } as unknown as WorkflowNode

    const route = computeSmartTimeEdgeRoute(timeNode, belowPartner, 0)
    expect(route.path).toContain('M')
    expect(route.controlPoint[1]).toBeGreaterThan(timeNode.position.y)
    expect(route.controlPoint[1]).toBeLessThan(belowPartner.position.y)
  })
})
