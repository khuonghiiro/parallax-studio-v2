import { describe, expect, it } from 'vitest'
import type { WorkflowNode } from '@shared/types'
import { workflowBboxEditTime } from './workflowBboxEditTime'

describe('BBox edit time stays independent from the playhead', () => {
  const node = { params: { logicCategory: 'action', motionMode: 'bbox', timeStart: 2, timeEnd: 5 } } as WorkflowNode
  it('keeps the start frame visible even with the playhead at the destination', () => {
    expect(workflowBboxEditTime(node, 5, false)).toBe(2)
    expect(workflowBboxEditTime(node, 3.5, false)).toBe(2)
  })
  it('plays the real motion only during explicit playback', () => {
    expect(workflowBboxEditTime(node, 4, true)).toBe(4)
    expect(workflowBboxEditTime({ ...node, params: { logicCategory: 'collision' } }, 4, false)).toBe(4)
  })
})
