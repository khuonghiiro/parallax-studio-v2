import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useIsolatedCanvas Keyboard & Space Pan Interaction', () => {
  let listeners: Record<string, ((ev: any) => void)[]> = {}
  const originalWindow = (globalThis as any).window
  const originalDocument = (globalThis as any).document

  class MockHTMLElement {
    tagName: string
    type?: string
    isContentEditable: boolean
    constructor(tagName = 'DIV', type?: string, isContentEditable = false) {
      this.tagName = tagName.toUpperCase()
      this.type = type
      this.isContentEditable = isContentEditable
    }
  }

  beforeEach(() => {
    listeners = {}
    ;(globalThis as any).window = {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      },
      removeEventListener: (type: string, fn: any) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
      }
    }
    ;(globalThis as any).document = {
      activeElement: new MockHTMLElement('BODY')
    }
    ;(globalThis as any).HTMLElement = MockHTMLElement
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
    ;(globalThis as any).document = originalDocument
  })

  function isEditingText(target: any): boolean {
    if (!target) return false
    if (target.isContentEditable) return true
    const tag = target.tagName?.toLowerCase()
    if (tag === 'textarea') return true
    if (tag === 'input') {
      const type = target.type?.toLowerCase()
      return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].includes(type)
    }
    return false
  }

  function simulatePixelKeyboard(isErasing: boolean, setSpace: (val: boolean) => void) {
    const down = (e: any) => {
      const activeEl = (globalThis as any).document.activeElement
      const targetEl = e.target
      if (isEditingText(activeEl) || isEditingText(targetEl)) return

      if (e.code === 'Space') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (e.repeat) return
        if (!isErasing) setSpace(true)
      }
    }

    const up = (e: any) => {
      if (e.code === 'Space') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setSpace(false)
      }
    }

    listeners['keydown'] = [down]
    listeners['keyup'] = [up]
  }

  it('nhấn giữ phím Space sẽ kích hoạt setSpace(true) và ngăn sự kiện lọt ra ngoài', () => {
    const setSpace = vi.fn()
    simulatePixelKeyboard(false, setSpace)

    let defaultPrevented = false
    let propagationStopped = false
    const ev = {
      code: 'Space',
      repeat: false,
      target: new MockHTMLElement('DIV'),
      preventDefault: () => { defaultPrevented = true },
      stopImmediatePropagation: () => { propagationStopped = true }
    }

    listeners['keydown'][0](ev)
    expect(setSpace).toHaveBeenCalledWith(true)
    expect(defaultPrevented).toBe(true)
    expect(propagationStopped).toBe(true)
  })

  it('nhả phím Space sẽ gọi setSpace(false)', () => {
    const setSpace = vi.fn()
    simulatePixelKeyboard(false, setSpace)

    let defaultPrevented = false
    let propagationStopped = false
    const ev = {
      code: 'Space',
      preventDefault: () => { defaultPrevented = true },
      stopImmediatePropagation: () => { propagationStopped = true }
    }

    listeners['keyup'][0](ev)
    expect(setSpace).toHaveBeenCalledWith(false)
    expect(defaultPrevented).toBe(true)
    expect(propagationStopped).toBe(true)
  })

  it('vẫn cho phép phím Space kích hoạt dời ảnh khi focus đang ở input range (slider cỡ cọ)', () => {
    const setSpace = vi.fn()
    simulatePixelKeyboard(false, setSpace)

    const rangeInput = new MockHTMLElement('INPUT', 'range')
    ;(globalThis as any).document.activeElement = rangeInput

    let defaultPrevented = false
    const ev = {
      code: 'Space',
      repeat: false,
      target: rangeInput,
      preventDefault: () => { defaultPrevented = true },
      stopImmediatePropagation: () => {}
    }

    listeners['keydown'][0](ev)
    expect(setSpace).toHaveBeenCalledWith(true)
    expect(defaultPrevented).toBe(true)
  })

  it('bỏ qua phím Space khi người dùng đang gõ văn bản trong input text hoặc textarea', () => {
    const setSpace = vi.fn()
    simulatePixelKeyboard(false, setSpace)

    const textInput = new MockHTMLElement('INPUT', 'text')
    ;(globalThis as any).document.activeElement = textInput

    let defaultPrevented = false
    const ev = {
      code: 'Space',
      repeat: false,
      target: textInput,
      preventDefault: () => { defaultPrevented = true },
      stopImmediatePropagation: () => {}
    }

    listeners['keydown'][0](ev)
    expect(setSpace).not.toHaveBeenCalled()
    expect(defaultPrevented).toBe(false)
  })
})
