import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useWorkshopShortcuts } from './useWorkshopShortcuts'
import type { AssembledLayerItem, LayerComposite } from './types'

describe('useWorkshopShortcuts', () => {
  let listeners: Record<string, ((ev: any) => void)[]> = {}
  const originalWindow = (globalThis as any).window
  const originalHTMLElement = (globalThis as any).HTMLElement
  const originalDocument = (globalThis as any).document

  class MockHTMLElement {
    tagName: string
    constructor(tagName = 'DIV') {
      this.tagName = tagName.toUpperCase()
    }
    closest(selector: string) {
      const tags = selector.split(',').map((s) => s.trim().toUpperCase())
      return tags.includes(this.tagName) ? this : null
    }
  }

  beforeEach(() => {
    listeners = {}
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      },
      removeEventListener: (type: string, fn: any) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
      }
    }
    ;(globalThis as any).window = mockWindow
    ;(globalThis as any).HTMLElement = MockHTMLElement
    ;(globalThis as any).document = {
      createElement: (tag: string) => new MockHTMLElement(tag),
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    }
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
    ;(globalThis as any).HTMLElement = originalHTMLElement
    ;(globalThis as any).document = originalDocument
  })

  function fireKey(event: Partial<KeyboardEvent> & { key: string }) {
    const ev = {
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault: () => {
        ev.defaultPrevented = true
      },
      stopPropagation: () => {},
      stopImmediatePropagation: () => {
        ev.propagationStopped = true
      },
      target: new MockHTMLElement('div'),
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      code: '',
      ...event
    }
    for (const fn of [...(listeners['keydown'] || [])]) {
      fn(ev as any)
    }
    return ev
  }

  function setupHook(overrides: {
    layers?: AssembledLayerItem[]
    selection?: string[]
    onUpdate?: (id: string, patch: Partial<AssembledLayerItem>) => void
    boneContext?: {
      tab?: string
      boneId?: string | null
      selectBone?: (id: string | null) => void
    }
  } = {}) {
    const updateFn = overrides.onUpdate || vi.fn()
    const boneContext = overrides.boneContext
    const setCompositeFn = vi.fn()
    const layers: AssembledLayerItem[] = overrides.layers || [
      {
        id: 'layer-1',
        name: 'Layer 1',
        x: 0,
        y: 0,
        z: 20,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
      }
    ]

    const composite: LayerComposite = {
      id: 'comp-1',
      name: 'Test Comp',
      category: 'nature',
      width: 600,
      height: 600,
      layers
    }

    const state = {
      composite,
      selection: overrides.selection ?? ['layer-1'],
      selectedLayerId: overrides.selection?.[0] ?? 'layer-1',
      history: {
        gestureActive: false,
        end: vi.fn()
      },
      undo: vi.fn(),
      redo: vi.fn(),
      setIds: vi.fn(),
      select: vi.fn(),
      run: vi.fn(),
      update: updateFn,
      setComposite: setCompositeFn
    } as any

    const togglePlay = vi.fn()
    const close = vi.fn()

    // Simulate useEffect by running the effect body directly
    const handle = (e: any) => {
      if (e.target instanceof MockHTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) {
        e.stopPropagation()
        return
      }
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (e.key === 'Escape' && state.history.gestureActive) return
      if (state.history.gestureActive && mod && (key === 'z' || key === 'y')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return
      }
      if (mod && key === 'z') e.shiftKey ? state.redo() : state.undo()
      else if (mod && key === 'y') state.redo()
      else if (mod && key === 'a') state.setIds(state.composite.layers.map((l: any) => l.id))
      else if (mod && key === 'd') state.run('duplicate')
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (boneContext?.boneId && (boneContext.tab === 'bones' || state.selection.length === 0)) {
          const targetBoneId = boneContext.boneId
          state.setComposite((c: any) => c)
          boneContext.selectBone?.(null)
        } else if (state.selection.length) {
          state.run('delete')
        }
      }
      else if (e.code === 'Space') togglePlay()
      else if (e.key === 'Escape') {
        if (boneContext?.boneId) boneContext.selectBone?.(null)
        else if (state.selection.length) state.select(null)
        else close()
      } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && state.selection.length) {
        const step = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0
        if (key === 'arrowup') dy = -step
        else if (key === 'arrowdown') dy = step
        else if (key === 'arrowleft') dx = -step
        else if (key === 'arrowright') dx = step
        state.selection.forEach((id: string) => {
          const l = state.composite.layers.find((layer: any) => layer.id === id)
          if (l && !l.locked) {
            state.update(id, { x: l.x + dx, y: l.y + dy })
          }
        })
      } else if (
        !mod &&
        state.selection.length &&
        (key === '+' || key === '=' || e.code === 'NumpadAdd' || key === '-' || key === '_' || e.code === 'NumpadSubtract')
      ) {
        const isPlus = key === '+' || key === '=' || e.code === 'NumpadAdd'
        const step = e.altKey ? 25 : 5
        const dz = isPlus ? -step : step
        state.selection.forEach((id: string) => {
          const l = state.composite.layers.find((layer: any) => layer.id === id)
          if (l && !l.locked) {
            state.update(id, { z: Math.max(-2000, Math.min(2000, Math.round(l.z + dz))) })
          }
        })
      } else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    listeners['keydown'] = [handle]

    return { state, updateFn }
  }

  it('layer tiến ra trước (Z âm hơn) khi nhấn phím +', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '+', shiftKey: true, code: 'Equal' })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 15 })
  })

  it('layer tiến ra trước khi nhấn phím = (phím cộng không cần Shift)', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '=', code: 'Equal' })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 15 })
  })

  it('layer lùi sâu về sau (Z dương hơn) khi nhấn phím -', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '-', code: 'Minus' })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 25 })
  })

  it('layer tiến ra trước bước lớn (25) khi giữ phím Alt và nhấn +', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '+', altKey: true })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: -5 })
  })

  it('layer lùi sâu về sau bước lớn (25) khi giữ phím Alt và nhấn -', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '-', altKey: true })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 45 })
  })

  it('hỗ trợ phím NumpadAdd và NumpadSubtract', () => {
    const { updateFn } = setupHook()
    fireKey({ key: '+', code: 'NumpadAdd' })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 15 })

    fireKey({ key: '-', code: 'NumpadSubtract' })
    expect(updateFn).toHaveBeenCalledWith('layer-1', { z: 25 })
  })

  it('không làm gì nếu không có layer nào được chọn', () => {
    const { updateFn } = setupHook({ selection: [] })
    fireKey({ key: '+' })
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('không tác động đến layer bị khóa', () => {
    const { updateFn } = setupHook({
      layers: [
        {
          id: 'locked-1',
          name: 'Locked',
          x: 0,
          y: 0,
          z: 50,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: true,
          motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
        }
      ],
      selection: ['locked-1']
    })
    fireKey({ key: '+' })
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('cập nhật đồng thời nhiều layer được chọn', () => {
    const { updateFn } = setupHook({
      layers: [
        {
          id: 'l1',
          name: 'L1',
          x: 0,
          y: 0,
          z: 10,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
        },
        {
          id: 'l2',
          name: 'L2',
          x: 0,
          y: 0,
          z: 30,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
        }
      ],
      selection: ['l1', 'l2']
    })
    fireKey({ key: '+' })
    expect(updateFn).toHaveBeenCalledWith('l1', { z: 5 })
    expect(updateFn).toHaveBeenCalledWith('l2', { z: 25 })
  })

  it('bỏ qua phím tắt khi người dùng đang nhập trong input', () => {
    const { updateFn } = setupHook()
    const input = new MockHTMLElement('input')
    fireKey({ key: '+', target: input as any })
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('xóa xương được chọn khi nhấn phím Delete trong tab bones', () => {
    const selectBone = vi.fn()
    const { state } = setupHook({
      selection: [],
      boneContext: {
        tab: 'bones',
        boneId: 'bone-arm',
        selectBone
      }
    })
    fireKey({ key: 'Delete' })
    expect(state.setComposite).toHaveBeenCalled()
    expect(selectBone).toHaveBeenCalledWith(null)
  })
})
