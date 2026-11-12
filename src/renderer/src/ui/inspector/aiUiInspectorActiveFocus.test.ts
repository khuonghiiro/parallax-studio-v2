import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectElementActiveFocus,
  getElementInteractionScore,
  rankAndDesignatePrimaryFocus
} from './aiUiInspectorActiveFocus'
import type { ScannedElementContext } from './aiUiInspectorScanner'
import { useEditor } from '../../store/editor'

describe('aiUiInspectorActiveFocus', () => {
  let originalDocument: any

  beforeEach(() => {
    originalDocument = (globalThis as any).document
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
  })

  it('detects document.activeElement as isFocused', () => {
    const el = {
      tagName: 'INPUT',
      classList: ['form-input'],
      getAttribute: vi.fn().mockReturnValue(null),
      contains: vi.fn().mockReturnValue(false)
    } as unknown as Element

    ;(globalThis as any).document = {
      activeElement: el,
      body: {}
    }

    const state = detectElementActiveFocus(el)
    expect(state.isFocused).toBe(true)
    expect(state.focusReason).toBe('active_element')
    expect(state.activeStateLabel).toContain('Đang Focus')
  })

  it('detects active classes as isActive', () => {
    const el = {
      tagName: 'BUTTON',
      classList: ['btn', 'active'],
      getAttribute: vi.fn().mockReturnValue(null),
      contains: vi.fn().mockReturnValue(false)
    } as unknown as Element

    ;(globalThis as any).document = {
      activeElement: null,
      body: {}
    }

    const state = detectElementActiveFocus(el)
    expect(state.isActive).toBe(true)
    expect(state.activeReason).toBe('class_active')
    expect(state.activeStateLabel).toContain('Đang Active')
  })

  it('detects aria-selected as isActive', () => {
    const el = {
      tagName: 'DIV',
      classList: ['tab-item'],
      getAttribute: vi.fn().mockImplementation((attr) => (attr === 'aria-selected' ? 'true' : null)),
      contains: vi.fn().mockReturnValue(false)
    } as unknown as Element

    const state = detectElementActiveFocus(el)
    expect(state.isActive).toBe(true)
    expect(state.activeReason).toBe('aria_selected')
  })

  it('detects selected layer in store as isActive', () => {
    useEditor.setState({
      selectedLayerId: 'layer-hero-123'
    })

    const el = {
      tagName: 'DIV',
      classList: ['layer-row'],
      getAttribute: vi.fn().mockImplementation((attr) => (attr === 'data-layer-id' ? 'layer-hero-123' : null)),
      contains: vi.fn().mockReturnValue(false)
    } as unknown as Element

    const state = detectElementActiveFocus(el)
    expect(state.isActive).toBe(true)
    expect(state.activeReason).toBe('selected_layer')
  })

  it('rankAndDesignatePrimaryFocus puts focused or active item at index 0', () => {
    const item1 = {
      id: 'item-inactive-1',
      isFocused: false,
      isActive: false
    } as unknown as ScannedElementContext

    const item2 = {
      id: 'item-active-2',
      isFocused: false,
      isActive: true
    } as unknown as ScannedElementContext

    const item3 = {
      id: 'item-focused-3',
      isFocused: true,
      isActive: false
    } as unknown as ScannedElementContext

    // Pass in [item1, item2, item3]
    const ranked = rankAndDesignatePrimaryFocus([item1, item2, item3])

    // item3 (focused) should be first, then item2 (active), then item1
    expect(ranked[0].id).toBe('item-focused-3')
    expect(ranked[0].isPrimaryFocus).toBe(true)
    expect(ranked[1].id).toBe('item-active-2')
    expect(ranked[1].isPrimaryFocus).toBe(false)
    expect(ranked[2].id).toBe('item-inactive-1')
    expect(ranked[2].isPrimaryFocus).toBe(false)
  })
})

