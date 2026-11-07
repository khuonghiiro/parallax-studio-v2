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

  it('extractFiberInfo handles elements without fiber gracefully and summarizes inline arrow handlers', () => {
    const el = {
      tagName: 'DIV'
    } as unknown as Element

    const res = extractFiberInfo(el)
    expect(res.componentChain).toEqual([])
    expect(res.primaryFile).toBeNull()
    expect(res.primaryHandler).toBeNull()

    const elWithFiber = {
      tagName: 'BUTTON',
      __reactFiber$xyz: {
        type: function MenuItem() {},
        _debugSource: { fileName: 'src/renderer/src/ui/Toolbar.tsx', lineNumber: 120 },
        memoizedProps: {
          onClick: () => setDialog('layer_assembly')
        },
        return: null
      }
    } as unknown as Element

    function setDialog(id: string) {
      return id
    }

    const res2 = extractFiberInfo(elWithFiber)
    expect(res2.primaryFile).toBe('src/renderer/src/ui/Toolbar.tsx:120')
    expect(res2.primaryHandler).toContain('setDialog')
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
    expect(ctx.kindLabel).toBe('Nút bấm thao tác')
    expect(ctx.id).toBe('test-btn')
    expect(ctx.text).toBe('Bấm vào đây')
    expect(ctx.title).toBe('Nút thử nghiệm')
    expect(ctx.mcpRegion).toBe('toolbar_actions')
    expect(ctx.classes).toContain('btn')
    expect(ctx.classes).toContain('primary')
  })

  it('formatAiInspectorMarkdown generates markdown with workshop 2.5D parts and UI details', () => {
    const snapshot: AiInspectorSnapshot = {
      rect: { left: 100, top: 50, width: 240, height: 120 },
      primaryRegion: 'layer_assembly_viewport_2d',
      workshopContext: {
        workshopType: 'layer_assembly_25d',
        workshopTitle: 'Xưởng Lắp Ráp Layer & Rigging 2.5D',
        modelName: 'Hiệp Khách Chibi',
        modelId: 'comp_hero_1',
        canvasSize: '600 × 600 px',
        primaryModeLabel: 'Lắp ráp & Rigging 2.5D',
        activeTabLabel: 'Tạo xương (Moho Rigging)',
        totalLayers: 8,
        totalBones: 6,
        scannedParts: [
          {
            id: 'layer_arm_r',
            name: 'Cánh tay phải cầm kiếm',
            orderIndex: 3,
            roleLabel: 'Cánh tay phải',
            roleIcon: '🦾',
            x: 85,
            y: -20,
            z: -12,
            scale: 1,
            rotation: 15,
            opacity: 1,
            boneId: 'bone_arm_r',
            boneName: 'Xương Tay Phải',
            bindingMode: 'rigid',
            isSelected: true,
            assetPath: 'characters/hero/arm_r.png'
          }
        ],
        scannedBones: []
      },
      elements: [
        {
          element: {} as Element,
          tagName: 'div',
          kindLabel: 'Bộ phận 2.5D trên sân khấu',
          id: 'layer_arm_r',
          classes: ['lw-stage-layer-item'],
          text: 'Cánh tay phải cầm kiếm',
          title: 'Bộ phận 2.5D: "Cánh tay phải cầm kiếm"',
          primaryFile: 'src/renderer/src/ui/layerAssembly/AssembledLayerItemView.tsx:266',
          primaryHandler: 'onPointerDown={handleStartDragLayer}',
          componentChain: [
            {
              componentName: 'AssembledLayerItemView',
              fileInfo: 'src/renderer/src/ui/layerAssembly/AssembledLayerItemView.tsx:266',
              handlers: ['onPointerDown={handleStartDragLayer}']
            }
          ],
          mcpRegion: 'layer_assembly_viewport_2d',
          mcpDialog: 'layer_assembly',
          bounds: { left: 100, top: 50, width: 90, height: 120 }
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
        activeDialog: 'layer_assembly',
        theme: 'dark'
      }
    }

    const md = formatAiInspectorMarkdown(snapshot)
    expect(md).toContain('### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)')
    expect(md).toContain('Xưởng Lắp Ráp Layer & Rigging 2.5D')
    expect(md).toContain('Hiệp Khách Chibi')
    expect(md).toContain('Cánh tay phải cầm kiếm')
    expect(md).toContain('Gắn xương "Xương Tay Phải"')
    expect(md).toContain('AssembledLayerItemView.tsx:266')
  })

  it('findElementsInBox pierces inspector barrier on single click and scopes to open popup on marquee drag', () => {
    const mockButton = {
      tagName: 'BUTTON',
      classList: { contains: () => false },
      closest: () => mockButton
    } as unknown as Element

    const mockBarrier = {
      tagName: 'DIV',
      style: { pointerEvents: 'auto' },
      classList: { contains: () => false },
      closest: (sel: string) => (sel === '.ai-ui-inspector-barrier' ? mockBarrier : null)
    } as unknown as Element

    let callCount = 0
    ;(globalThis as any).document.elementFromPoint = vi.fn().mockImplementation(() => {
      callCount++
      return callCount === 1 ? mockBarrier : mockButton
    })

    const found = findElementsInBox({ left: 10, top: 10, width: 2, height: 2 })
    expect(found.length).toBe(1)
    expect(found[0]).toBe(mockButton)

    // Test marquee drag scoping to open popup (.menu) instead of background elements
    const popupMenuItem = {
      tagName: 'BUTTON',
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getBoundingClientRect: () => ({
        left: 120,
        top: 60,
        right: 260,
        bottom: 92,
        width: 140,
        height: 32
      })
    } as unknown as Element

    const openPopupMenu = {
      tagName: 'DIV',
      classList: { contains: () => false },
      closest: () => null,
      getBoundingClientRect: () => ({
        left: 110,
        top: 50,
        right: 280,
        bottom: 200,
        width: 170,
        height: 150
      }),
      querySelectorAll: vi.fn().mockReturnValue([popupMenuItem])
    } as unknown as Element

    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('.menu[role="menu"]')) return [openPopupMenu]
      return []
    })

    const popupFound = findElementsInBox({ left: 105, top: 55, width: 180, height: 60 })
    expect(popupFound).toEqual([popupMenuItem])
  })
})
