import { describe, expect, it } from 'vitest'
import { resolveDeviceBreakpoint } from './useResponsiveViewport'

describe('resolveDeviceBreakpoint', () => {
  it('detects Phone portrait and landscape viewports', () => {
    expect(resolveDeviceBreakpoint(390, 844)).toBe('phone')
    expect(resolveDeviceBreakpoint(430, 932)).toBe('phone')
    expect(resolveDeviceBreakpoint(768, 1024)).toBe('phone')
    // Phone landscape (short height <= 520 && width <= 960)
    expect(resolveDeviceBreakpoint(844, 390)).toBe('phone')
    expect(resolveDeviceBreakpoint(932, 430)).toBe('phone')
  })

  it('detects iPad and Tablet viewports (769px..1120px)', () => {
    expect(resolveDeviceBreakpoint(820, 1180)).toBe('tablet')
    expect(resolveDeviceBreakpoint(1024, 768)).toBe('tablet')
    expect(resolveDeviceBreakpoint(1120, 834)).toBe('tablet')
  })

  it('detects compact Laptop viewports (1121px..1366px)', () => {
    expect(resolveDeviceBreakpoint(1280, 800)).toBe('laptop')
    expect(resolveDeviceBreakpoint(1366, 768)).toBe('laptop')
  })

  it('detects Desktop and Ultrawide viewports (>= 1367px)', () => {
    expect(resolveDeviceBreakpoint(1440, 900)).toBe('desktop')
    expect(resolveDeviceBreakpoint(1920, 1080)).toBe('desktop')
    expect(resolveDeviceBreakpoint(2560, 1440)).toBe('desktop')
  })
})
