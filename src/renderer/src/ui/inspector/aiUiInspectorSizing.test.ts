import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractComputedSizing,
  getCurrentInspectorViewport,
  getBreakpointLabel
} from './aiUiInspectorSizing'

describe('aiUiInspectorSizing', () => {
  let originalWindow: any

  beforeEach(() => {
    originalWindow = globalThis.window
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  it('provides correct breakpoint labels', () => {
    expect(getBreakpointLabel('phone')).toContain('Phone')
    expect(getBreakpointLabel('tablet')).toContain('Tablet')
    expect(getBreakpointLabel('laptop')).toContain('Laptop')
    expect(getBreakpointLabel('desktop')).toContain('Desktop')
  })

  it('determines viewport and breakpoint from window', () => {
    ;(globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768
    }
    const vp = getCurrentInspectorViewport()
    expect(vp.width).toBe(1024)
    expect(vp.height).toBe(768)
    expect(vp.breakpoint).toBe('tablet')
    expect(vp.breakpointLabel).toContain('Tablet')
  })

  it('extractComputedSizing calculates styles, percent of parent and warnings', () => {
    const parentEl = {
      tagName: 'DIV',
      getBoundingClientRect: () => ({ width: 500, height: 400 })
    }

    const el = {
      tagName: 'BUTTON',
      classList: ['btn', 'btn-primary'],
      parentElement: parentEl,
      getAttribute: vi.fn().mockReturnValue('button')
    } as unknown as Element

    ;(globalThis as any).window = {
      getComputedStyle: () => ({
        fontSize: '24px',
        lineHeight: '30px',
        fontWeight: '600',
        boxSizing: 'border-box',
        display: 'inline-flex',
        paddingTop: '6px',
        paddingRight: '12px',
        paddingBottom: '6px',
        paddingLeft: '12px',
        gap: '8px'
      })
    }

    const sizing = extractComputedSizing(el, { width: 150, height: 28 })
    expect(sizing).not.toBeNull()
    if (!sizing) return

    expect(sizing.fontSize).toBe('24px')
    expect(sizing.fontSizePx).toBe(24)
    expect(sizing.width).toBe(150)
    expect(sizing.height).toBe(28)
    expect(sizing.parentWidth).toBe(500)
    expect(sizing.widthPercentOfParent).toBe(30)
    expect(sizing.isTouchCompliant).toBe(false) // height 28 < 34

    // Warnings should include font size warning and touch height warning
    expect(sizing.warnings.some((w) => w.includes('Cỡ chữ 24px'))).toBe(true)
    expect(sizing.warnings.some((w) => w.includes('28px'))).toBe(true)

    // Recommendations should suggest button specs
    expect(sizing.recommendations.some((r) => r.includes('12–14px'))).toBe(true)
  })

  it('extractComputedSizing handles null window or errors gracefully', () => {
    ;(globalThis as any).window = undefined
    const el = {} as Element
    expect(extractComputedSizing(el, { width: 100, height: 50 })).toBeNull()
  })
})
