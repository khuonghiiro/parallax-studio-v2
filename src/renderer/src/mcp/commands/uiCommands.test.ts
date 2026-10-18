import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickByText, resolveTargetElement, uiCommands } from './uiCommands'
import { normalizeMcpMethod, runCommand } from '../commands'

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

  it('captures the whole window through the preload bridge and supports capture_app_silent wire alias', async () => {
    const captureWindow = vi.fn(async (opts: { width?: number; format?: string }) => ({
      mime: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      data: 'AAAA',
      width: opts.width ?? 1600,
      height: 900
    }))
    vi.stubGlobal('window', { api: { mcp: { captureWindow } } })
    expect(normalizeMcpMethod('capture_app_silent')).toBe('get_app_screenshot')
    const res = (await runCommand('capture_app_silent', { width: 800, format: 'jpeg', delay_ms: 0 })) as Record<
      string,
      unknown
    >
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

  it('inspects and updates UI dialogs, tabs, and theme via get_ui_state and set_ui_dialog', async () => {
    const initial = uiCommands.get_ui_state({}, { reqId: 't', method: 'get_ui_state', params: {} }) as Record<
      string,
      unknown
    >
    expect(initial.theme).toBe('dark')
    expect(initial.dialog).toBeNull()

    const pathRes = (await uiCommands.set_ui_dialog(
      { dialog: 'path', left_tab: 'topview', theme: 'light' },
      { reqId: 't', method: 'set_ui_dialog', params: {} }
    )) as Record<string, unknown>
    expect(pathRes).toMatchObject({
      ok: true,
      theme: 'light',
      dialog: 'path',
      left_tab: 'topview'
    })

    const audioRes = (await uiCommands.set_ui_dialog(
      { dialog: 'audio', audio_mode: 'mixer' },
      { reqId: 't', method: 'set_ui_dialog', params: {} }
    )) as Record<string, unknown>
    expect(audioRes).toMatchObject({
      ok: true,
      dialog: 'audio',
      audio_dialog_mode: 'mixer'
    })

    const closeRes = (await uiCommands.set_ui_dialog(
      { dialog: 'none', theme: 'dark', left_tab: 'shots' },
      { reqId: 't', method: 'set_ui_dialog', params: {} }
    )) as Record<string, unknown>
    expect(closeRes).toMatchObject({
      ok: true,
      theme: 'dark',
      dialog: null,
      left_tab: 'shots'
    })
  })

  it('normalizes typographic ellipsis, emojis, and whitespace in text queries', () => {
    const list = [
      { text: 'Thay thế…', visible: true },
      { text: '🎯 Tự khớp nhân vật', visible: true },
      { text: 'Tự nhận diện', visible: true },
      { text: '+ Thêm', visible: true },
      { text: 'Mở Studio', title: 'Mở Studio Mixamo toàn màn hình', visible: true }
    ]

    // Typographic ellipsis … matched by ascii ...
    expect(pickByText(list, 'Thay thế...')).toBe(0)
    expect(pickByText(list, 'thay thế')).toBe(0)

    // Emoji stripped
    expect(pickByText(list, 'Tự khớp')).toBe(1)
    expect(pickByText(list, 'Tự khớp nhân vật')).toBe(1)
    expect(pickByText(list, '🎯 Tự khớp')).toBe(1)

    // Synonyms
    expect(pickByText(list, 'Tự phân nhóm')).toBe(2)
    expect(pickByText(list, 'Thêm biến thể')).toBe(3)
    expect(pickByText(list, 'Studio Mixamo')).toBe(4)
  })

  it('matches element attributes (title, aria-label, placeholder) alongside innerText', () => {
    const list = [
      { text: '', title: 'Đóng Studio Mixamo', visible: true },
      { text: '', ariaLabel: 'Góc nhìn nhân vật', visible: true },
      { text: '', placeholder: 'VD: face, mouth', visible: true }
    ]

    expect(pickByText(list, 'Đóng Studio Mixamo')).toBe(0)
    expect(pickByText(list, 'Góc nhìn')).toBe(1)
    expect(pickByText(list, 'face, mouth')).toBe(2)
  })

  it('resolves Studio Mixamo sub-regions and aliases', () => {
    const rect = () => ({ x: 0, y: 0, width: 400, height: 400, left: 0, top: 0, right: 400, bottom: 400 })
    const mockStage = { className: 'mx-stage', getBoundingClientRect: rect } as unknown as HTMLElement
    const mockPreview = { className: 'mx-preview-card', getBoundingClientRect: rect } as unknown as HTMLElement
    vi.stubGlobal('document', {
      querySelector: (sel: string) => {
        if (sel.includes('layer_assembly_mixamo_stage') || sel === '.mx-stage') return mockStage
        if (sel.includes('layer_assembly_mixamo_preview') || sel === '.mx-preview-card') return mockPreview
        return null
      }
    })
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }))

    // Canonical names
    expect(resolveTargetElement('layer_assembly_mixamo_stage')).toBe(mockStage)
    expect(resolveTargetElement('layer_assembly_mixamo_preview')).toBe(mockPreview)

    // Short aliases
    expect(resolveTargetElement('mixamo_stage')).toBe(mockStage)
    expect(resolveTargetElement('mixamo_preview')).toBe(mockPreview)
  })
})



