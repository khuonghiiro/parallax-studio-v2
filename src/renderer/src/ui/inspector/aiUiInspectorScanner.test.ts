import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatAiInspectorMarkdown,
  extractFiberInfo,
  scanElementContext,
  findElementsInBox,
  AiInspectorSnapshot
} from './aiUiInspectorScanner'

describe('aiUiInspectorScanner', () => {
  let originalDocument: any

  beforeEach(() => {
    originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      elementFromPoint: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([])
    }
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
  })

  it('extractFiberInfo handles elements without fiber gracefully', () => {
    const el = {
      tagName: 'DIV'
    } as unknown as Element

    const res = extractFiberInfo(el)
    expect(res.componentChain).toEqual([])
    expect(res.primaryFile).toBeNull()
    expect(res.primaryHandler).toBeNull()
  })

  it('scanElementContext extracts DOM attributes and classes', () => {
    const mockElement = {
      tagName: 'BUTTON',
      id: 'test-btn',
      classList: ['btn', 'primary', 'special-action'],
      innerText: 'Bấm vào đây',
      textContent: 'Bấm vào đây',
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 40 }),
      getAttribute: (attr: string) => {
        if (attr === 'title') return 'Nút thử nghiệm'
        return null
      },
      closest: (sel: string) => {
        if (sel === '[data-mcp-region]') {
          return {
            getAttribute: () => 'toolbar_actions'
          }
        }
        return null
      }
    } as unknown as Element

    const ctx = scanElementContext(mockElement)
    expect(ctx.tagName).toBe('button')
    expect(ctx.id).toBe('test-btn')
    expect(ctx.text).toBe('Bấm vào đây')
    expect(ctx.title).toBe('Nút thử nghiệm')
    expect(ctx.mcpRegion).toBe('toolbar_actions')
    expect(ctx.classes).toContain('btn')
    expect(ctx.classes).toContain('primary')
  })

  it('formatAiInspectorMarkdown generates markdown with all details', () => {
    const snapshot: AiInspectorSnapshot = {
      rect: { left: 100, top: 50, width: 240, height: 120 },
      primaryRegion: 'toolbar_actions',
      elements: [
        {
          element: {} as Element,
          tagName: 'button',
          id: 'save-btn',
          classes: ['btn', 'save'],
          text: 'Lưu dự án',
          title: 'Lưu dự án (Ctrl+S)',
          primaryFile: 'src/renderer/src/ui/Toolbar.tsx:409',
          primaryHandler: 'onClick={saveProject}',
          componentChain: [
            { componentName: 'button', fileInfo: 'src/renderer/src/ui/Toolbar.tsx:409', handlers: ['onClick={saveProject}'] },
            { componentName: 'Toolbar', fileInfo: 'src/renderer/src/App.tsx:228', handlers: [] }
          ],
          mcpRegion: 'toolbar_actions',
          mcpDialog: null,
          bounds: { left: 100, top: 50, width: 80, height: 32 }
        }
      ],
      appState: {
        shotName: 'Cảnh Mở Đầu',
        shotIndex: 1,
        currentTime: 2.5,
        duration: 15.0,
        fps: 30,
        isPlaying: false,
        selectedLayerNames: ['"Background" (layer_1)'],
        activeDialog: null,
        theme: 'dark'
      }
    }

    const md = formatAiInspectorMarkdown(snapshot)
    expect(md).toContain('### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)')
    expect(md).toContain('Khu vực MCP: `toolbar_actions`')
    expect(md).toContain('"Lưu dự án"')
    expect(md).toContain('src/renderer/src/ui/Toolbar.tsx:409')
    expect(md).toContain('onClick={saveProject}')
    expect(md).toContain('<button> ➔ <Toolbar>')
    expect(md).toContain('Cảnh Mở Đầu')
    expect(md).toContain('2.5s / 15s')
  })

  it('findElementsInBox returns single element if box is very small', () => {
    const mockButton = {
      tagName: 'BUTTON',
      classList: { contains: () => false },
      closest: () => mockButton
    } as unknown as Element

    ;(globalThis as any).document.elementFromPoint = vi.fn().mockReturnValue(mockButton)

    const found = findElementsInBox({ left: 10, top: 10, width: 2, height: 2 })
    expect(found.length).toBe(1)
    expect(found[0]).toBe(mockButton)
  })
})
