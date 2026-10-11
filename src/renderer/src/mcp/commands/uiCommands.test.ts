import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickByText, resolveTargetElement, uiCommands } from './uiCommands'

describe('pickByText', () => {
  const items = [
    { text: 'Tất cả mẫu 50', visible: true },
    { text: 'Thiên nhiên 5', visible: true },
    { text: 'Thiên nhiên', visible: false },
    { text: '  Chọn mẫu này ', visible: true },
    { text: 'Chọn mẫu này', visible: true }
  ]

  it('prefers exact visible matches and ignores hidden elements', () => {
    expect(pickByText(items, 'chọn mẫu này')).toBe(3)
    expect(pickByText(items, 'chọn mẫu này', 1)).toBe(4)
    expect(pickByText(items, 'Thiên nhiên')).toBe(1)
  })

  it('falls back to partial matches and returns -1 when nothing matches', () => {
    expect(pickByText(items, 'tất cả')).toBe(0)
    expect(pickByText(items, 'không có')).toBe(-1)
    expect(pickByText(items, '   ')).toBe(-1)
  })

  it('clamps the index to the last match', () => {
    expect(pickByText(items, 'chọn mẫu này', 9)).toBe(4)
  })
})

describe('get_app_screenshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('captures the whole window through the preload bridge', async () => {
    const captureWindow = vi.fn(async (opts: { width?: number; format?: string }) => ({
      mime: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      data: 'AAAA',
      width: opts.width ?? 1600,
      height: 900
    }))
    vi.stubGlobal('window', { api: { mcp: { captureWindow } } })
    const res = (await uiCommands.get_app_screenshot({ width: 800, format: 'jpeg', delay_ms: 0 }, {
      reqId: 't',
      method: 'get_app_screenshot',
      params: {}
    })) as Record<string, unknown>
    expect(captureWindow).toHaveBeenCalledWith({ width: 800, format: 'jpeg', rect: undefined })
    expect(res).toMatchObject({ mime: 'image/jpeg', data: 'AAAA', width: 800, target: 'app-window' })
  })

  it('fails clearly when the bridge is missing', async () => {
    vi.stubGlobal('window', {})
    await expect(
      uiCommands.get_app_screenshot({ delay_ms: 0 }, { reqId: 't', method: 'get_app_screenshot', params: {} })
    ).rejects.toThrow(/not available/)
  })

  it('handles set_ai_lock to lock and unlock UI', async () => {
    const lockRes = (await uiCommands.set_ai_lock({ locked: true, reason: 'Testing AI Lock' }, {
      reqId: 't',
      method: 'set_ai_lock',
      params: {}
    })) as Record<string, unknown>
    expect(lockRes).toMatchObject({ ok: true, locked: true, reason: 'Testing AI Lock' })

    const unlockRes = (await uiCommands.set_ai_lock({ locked: false }, {
      reqId: 't',
      method: 'set_ai_lock',
      params: {}
    })) as Record<string, unknown>
    expect(unlockRes).toMatchObject({ ok: true, locked: false })
  })

  it('supports expanded predefined UI regions and resolves valid elements', () => {
    const mockEl = {
      tagName: 'DIV',
      className: 'timeline-toolbar',
      getBoundingClientRect: () => ({
        x: 0,
        y: 800,
        left: 0,
        top: 800,
        right: 1200,
        bottom: 840,
        width: 1200,
        height: 40
      })
    } as unknown as HTMLElement

    vi.stubGlobal('document', {
      querySelector: (sel: string) => (sel === '.timeline-toolbar' ? mockEl : null)
    })
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }))

    const found = resolveTargetElement('timeline_toolbar')
    expect(found).toBe(mockEl)
  })
})

