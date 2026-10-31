import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { handleWorkshopKeydown, type WorkshopBoneContext } from './useWorkshopShortcuts'
import type { AssembledLayerItem, LayerComposite } from './types'
import { evaluateRig } from '../../engine/layerRig'
import { createHumanoidBones } from './workshopRigPresets'

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

  function setupHook(
    overrides: {
      composite?: LayerComposite
      layers?: AssembledLayerItem[]
      selection?: string[]
      onUpdate?: (id: string, patch: Partial<AssembledLayerItem>) => void
      boneContext?: WorkshopBoneContext
    } = {}
  ) {
    const updateFn = overrides.onUpdate || vi.fn()
    const boneContext = overrides.boneContext
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

    let currentComposite: LayerComposite =
      overrides.composite || {
        id: 'comp-1',
        name: 'Test Comp',
        category: 'nature',
        width: 600,
        height: 600,
        layers
      }

    const setCompositeFn = vi.fn((updater: any) => {
      currentComposite = typeof updater === 'function' ? updater(currentComposite) : updater
      state.composite = currentComposite
    })

    const state = {
      composite: currentComposite,
      selection: overrides.selection ?? ['layer-1'],
      selectedLayerId: overrides.selection?.[0] ?? 'layer-1',
      history: {
        gestureActive: false,
        begin: vi.fn(),
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

    listeners['keydown'] = [(e: any) => handleWorkshopKeydown(e, state, togglePlay, close, boneContext)]

    return { state, updateFn, togglePlay, getComposite: () => currentComposite }
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

  it('không làm gì nếu không có layer nào được chọn ở tab layers', () => {
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
    const { state, getComposite } = setupHook({
      composite: {
        id: 'comp-bone-del',
        name: 'Bone Delete Test',
        category: 'character',
        width: 600,
        height: 600,
        layers: [],
        rig: {
          bones: [{ id: 'bone-arm', name: 'Cánh tay', x: 0, y: 0, length: 60, angle: 90 }],
          duration: 2,
          loop: true,
          tracks: {}
        }
      },
      selection: [],
      boneContext: {
        tab: 'bones',
        boneId: 'bone-arm',
        selectBone
      }
    })
    fireKey({ key: 'Delete' })
    expect(state.setComposite).toHaveBeenCalled()
    expect(getComposite().rig?.bones).toHaveLength(0)
    expect(selectBone).toHaveBeenCalledWith(null)
  })

  it('không kích hoạt togglePlay khi phím Space được nhấn trong lúc isErasing là true (chế độ cọ tẩy)', () => {
    const { togglePlay } = setupHook({
      boneContext: {
        isErasing: true
      }
    })
    fireKey({ key: ' ', code: 'Space' })
    expect(togglePlay).not.toHaveBeenCalled()
  })

  it('kích hoạt togglePlay khi phím Space được nhấn trong lúc bình thường (isErasing là false)', () => {
    const { togglePlay } = setupHook({
      boneContext: {
        isErasing: false
      }
    })
    const ev = fireKey({ key: ' ', code: 'Space' })
    expect(togglePlay).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
    expect(ev.propagationStopped).toBe(true)
  })

  it('không xoá layer và không chỉnh Z khi đang ở tab plant', () => {
    const { state, updateFn } = setupHook({
      selection: ['layer-1'],
      boneContext: {
        tab: 'plant'
      }
    })
    fireKey({ key: 'Delete' })
    expect(state.run).not.toHaveBeenCalledWith('delete')
    fireKey({ key: '+' })
    expect(updateFn).not.toHaveBeenCalled()
    fireKey({ key: '-' })
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('ở tab animation, phím + tăng Z-Index và phím - giảm Z-Index của xương cha tại mốc time, toàn bộ xương con tự ăn theo', () => {
    const stopPlayback = vi.fn()
    const bones = createHumanoidBones()
    const { updateFn, getComposite } = setupHook({
      composite: {
        id: 'comp-rig',
        name: 'Nhân vật 2.5D',
        category: 'character',
        width: 600,
        height: 600,
        layers: [],
        rig: {
          bones,
          duration: 2,
          fps: 30,
          loop: true,
          tracks: {}
        }
      },
      selection: [],
      boneContext: {
        tab: 'animation',
        boneId: 'bone-arm-r',
        time: 0.8,
        stopPlayback
      }
    })

    // Nhấn + hai lần (+10 * 2 = +20) và Alt + + một lần (+30) => tổng +50 trên Bắp tay phải tại t = 0.8s
    fireKey({ key: '+', shiftKey: true, code: 'Equal' })
    fireKey({ key: '=' })
    fireKey({ key: '+', altKey: true })

    expect(stopPlayback).toHaveBeenCalled()
    expect(updateFn).not.toHaveBeenCalled()

    let comp = getComposite()
    // Tự neo mốc nghỉ 0.0s (zOrder = 0) để khoảng trước không bị nhảy lớp đột ngột
    const t0 = evaluateRig({ ...comp.rig!, loop: false }, 0)
    expect(t0.get('bone-arm-r')?.zOrder ?? 0).toBe(0)
    expect(t0.get('bone-forearm-r')?.zOrder ?? 0).toBe(0)

    // Tại t = 0.8s: Bắp tay phải (+50) -> Cẳng tay phải và Bàn tay phải tự ăn theo +50
    const tPose = evaluateRig({ ...comp.rig!, loop: false }, 0.8)
    expect(tPose.get('bone-arm-r')?.zOrder).toBe(50)
    expect(tPose.get('bone-forearm-r')?.zOrder).toBe(50)
    expect(tPose.get('bone-hand-r')?.zOrder).toBe(50)

    // Nhấn Alt + - (-30) và - ba lần (-10 * 3 = -30) => 50 - 60 = -10 (lùi ra sau lưng), con cũng lùi theo -10
    fireKey({ key: '-', altKey: true })
    fireKey({ key: '-' })
    fireKey({ key: '-' })
    fireKey({ key: '-', code: 'NumpadSubtract' })

    comp = getComposite()
    const tBack = evaluateRig({ ...comp.rig!, loop: false }, 0.8)
    expect(tBack.get('bone-arm-r')?.zOrder).toBe(-10)
    expect(tBack.get('bone-forearm-r')?.zOrder).toBe(-10)
    expect(tBack.get('bone-hand-r')?.zOrder).toBe(-10)
  })
})
