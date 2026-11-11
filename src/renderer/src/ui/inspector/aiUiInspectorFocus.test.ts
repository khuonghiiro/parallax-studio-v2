import { afterEach, describe, expect, it, vi } from 'vitest'
import { findElementsInBox } from './aiUiInspectorElementFinder'

afterEach(() => vi.unstubAllGlobals())

describe('scan focus follows the selected rectangle', () => {
  it('does not inject a previously focused BBox outside the scan', () => {
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height })
    const base = { parentElement: null, closest: () => null, contains: () => false,
      getAttribute: () => null, matches: () => false }
    const oldFocus = { ...base, getAttribute: () => 'true',
      matches: (s: string) => s.includes('.wf-v2-direct-layer-bbox'),
      getBoundingClientRect: () => rect(500, 500, 50, 50) }
    const button = { ...base, tagName: 'BUTTON', getBoundingClientRect: () => rect(10, 10, 40, 40) }
    const stage = { ...base, tagName: 'SECTION',
      matches: (s: string) => s.includes('workflow_preview') || s.includes('section'),
      contains: (el: unknown) => el === button || el === oldFocus,
      querySelectorAll: () => [oldFocus], getBoundingClientRect: () => rect(0, 0, 800, 800) }
    vi.stubGlobal('document', { querySelector: () => null, elementFromPoint: () => null,
      querySelectorAll: (s: string) => s.includes('button') ? [stage, button] : [] })
    expect(findElementsInBox({ left: 5, top: 5, width: 50, height: 50 })).toEqual([button])
  })
})
