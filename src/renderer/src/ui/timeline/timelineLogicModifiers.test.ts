import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canOpenTimelineLogic, logicPointerDown } from './timelineLogicModifiers'
import { useTimelineSelection } from './timelineSelection'

const first = { kind: 'layer' as const, layerId: 'a' }
const second = { kind: 'layer' as const, layerId: 'b' }
const event = (detail: number, ctrlKey = true, metaKey = false) => ({ detail, ctrlKey, metaKey, preventDefault: vi.fn(), stopPropagation: vi.fn() })
describe('Logic button during multi-selection', () => {
  beforeEach(() => useTimelineSelection.getState().clear())
  it('preserves existing ranges and toggles the clicked row only once across pointerdown/click', () => {
    useTimelineSelection.getState().pick(first, true)
    const down = event(0)
    logicPointerDown(down, second)
    expect(down.preventDefault).toHaveBeenCalledOnce()
    expect(canOpenTimelineLogic(event(1), second)).toBe(false)
    expect(useTimelineSelection.getState().intervals).toEqual([first, second])
    logicPointerDown(event(0), second)
    expect(canOpenTimelineLogic(event(1), second)).toBe(false)
    expect(useTimelineSelection.getState().intervals).toEqual([first])
  })
  it('supports keyboard and MCP Ctrl+click and Meta+click without opening the picker', () => {
    expect(canOpenTimelineLogic(event(0), first)).toBe(false)
    expect(canOpenTimelineLogic(event(0, false, true), second)).toBe(false)
    expect(useTimelineSelection.getState().intervals).toEqual([first, second])
  })
  it('allows a normal click without changing selection', () => {
    expect(canOpenTimelineLogic(event(1, false), first)).toBe(true)
    expect(useTimelineSelection.getState().intervals).toEqual([])
  })
})
