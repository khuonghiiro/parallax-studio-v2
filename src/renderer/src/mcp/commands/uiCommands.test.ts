import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickByText, uiCommands } from './uiCommands'

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
    expect(captureWindow).toHaveBeenCalledWith({ width: 800, format: 'jpeg' })
    expect(res).toMatchObject({ mime: 'image/jpeg', data: 'AAAA', width: 800, target: 'app-window' })
  })

  it('fails clearly when the bridge is missing', async () => {
    vi.stubGlobal('window', {})
    await expect(
      uiCommands.get_app_screenshot({ delay_ms: 0 }, { reqId: 't', method: 'get_app_screenshot', params: {} })
    ).rejects.toThrow(/not available/)
  })
})
