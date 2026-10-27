import { describe, expect, it } from 'vitest'
import type { WorkflowEdge, WorkflowNode } from '@shared/types'
import { isV2EdgeFlowing } from './workflowV2Edges'

const from = { id: 'from', enabled: true, params: { timeEnd: 5 } } as WorkflowNode
const to = { id: 'to', enabled: true, params: { timeStart: 6 } } as WorkflowNode
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
    const waypoint = { ...to, params: { isCameraWaypoint: true } }
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
    const camera = { ...from, params: { timeEnd: 7 } }
    expect(isV2EdgeFlowing(edge, camera, to, 'camera', active, 4, true, { start: 3, end: 5 })).toBe(true)
    expect(isV2EdgeFlowing(edge, camera, to, 'camera', active, 5, true, { start: 5, end: 5 })).toBe(false)
  })
})
