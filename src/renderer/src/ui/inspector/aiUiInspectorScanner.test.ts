import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatAiInspectorMarkdown,
  extractFiberInfo,
  scanElementContext,
  findElementsInBox,
  AiInspectorSnapshot
} from './aiUiInspectorScanner'
import { extractActiveWorkshopContext } from './aiUiInspectorWorkshopContext'
import { useView } from '../../store/view'

describe('aiUiInspectorScanner', () => {
  let originalDocument: any

  beforeEach(() => {
    originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      elementFromPoint: vi.fn(),
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([])
    }
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
    useView.setState({ dialog: null })
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

  it('skips shared UI primitive files (CustomSelect/NumberInput) to pinpoint the feature/dialog owner file and business handler', () => {
    function setHeightSel(v: number) {
      return v
    }
    function setIsOpen(b: boolean) {
      return b
    }

    const exportDialogFiber = {
      type: function ExportDialog() {},
      _debugSource: { fileName: 'src/renderer/src/ui/App.tsx', lineNumber: 247 },
      memoizedProps: {},
      return: null
    }

    const rowFiber = {
      type: function Row() {},
      _debugSource: { fileName: 'src/renderer/src/ui/ExportDialog.tsx', lineNumber: 134 },
      memoizedProps: { label: 'Độ phân giải' },
      return: exportDialogFiber
    }

    const customSelectFiber = {
      type: function CustomSelect() {},
      _debugSource: { fileName: 'src/renderer/src/ui/ExportDialog.tsx', lineNumber: 135 },
      memoizedProps: {
        value: 1080,
        onChange: (v: number) => setHeightSel(v),
        options: [
          { value: 720, label: '720p (HD)' },
          { value: 1080, label: '1080p (Full HD)' }
        ]
      },
      return: rowFiber
    }

    const triggerBtnElement = {
      tagName: 'BUTTON',
      id: 'export-res-select',
      classList: ['custom-select-trigger'],
      innerText: '1080p (Full HD)',
      textContent: '1080p (Full HD)',
      getBoundingClientRect: () => ({ left: 200, top: 150, width: 160, height: 32 }),
      getAttribute: () => null,
      closest: () => null,
      __reactFiber$abc: {
        type: 'button',
        _debugSource: {
          fileName: 'src/renderer/src/ui/controls/CustomSelect.tsx',
          lineNumber: 170
        },
        memoizedProps: {
          onClick: () => setIsOpen(true)
        },
        return: customSelectFiber
      }
    } as unknown as Element

    const ctx = scanElementContext(triggerBtnElement)
    expect(ctx.primaryFile).toBe('src/renderer/src/ui/ExportDialog.tsx:135')
    expect(ctx.ownerComponentName).toBe('ExportDialog')
    expect(ctx.primaryHandler).toContain('setHeightSel')
    expect(ctx.controlDetails?.primitiveName).toBe('CustomSelect')
    expect(ctx.controlDetails?.primitiveFile).toBe(
      'src/renderer/src/ui/controls/CustomSelect.tsx:170'
    )
    expect(ctx.controlDetails?.fieldLabel).toBe('Độ phân giải')
    expect(ctx.controlDetails?.currentValue).toBe('"1080p (Full HD)" (1080)')
    expect(ctx.controlDetails?.optionsSummary).toContain('720p (HD) | 1080p (Full HD)')
    // Component chain only includes React components, not host <button>
    expect(ctx.componentChain.map((c) => c.componentName)).toEqual([
      'CustomSelect',
      'Row',
      'ExportDialog'
    ])
  })

  it('scanElementContext extracts DOM attributes, aria-label, and linked target dialog module', () => {
    const mockElement = {
      tagName: 'BUTTON',
      id: 'remote-qr-btn',
      classList: ['tb-btn-icon', 'remote-qr-chip'],
      innerText: '',
      textContent: '',
      getBoundingClientRect: () => ({ left: 1572, top: 3, width: 32, height: 32 }),
      getAttribute: (attr: string) => {
        if (attr === 'aria-label') return 'Điều khiển Điện thoại QR'
        if (attr === 'title') {
          return 'Quét mã QR để điều khiển ứng dụng bằng Điện thoại qua Wi-Fi (Mobile Remote 3D Touchpad)'
        }
        if (attr === 'data-mcp-region') return 'remote_chip'
        return null
      },
      closest: () => null
    } as unknown as Element

    const ctx = scanElementContext(mockElement)
    expect(ctx.tagName).toBe('button')
    expect(ctx.kindLabel).toBe('Nút bấm thao tác')
    expect(ctx.id).toBe('remote-qr-btn')
    expect(ctx.text).toBe('Điều khiển Điện thoại QR')
    expect(ctx.mcpRegion).toBe('remote_chip')
    expect(ctx.linkedTarget?.name).toBe('MobileRemoteDialog')
    expect(ctx.linkedTarget?.file).toBe('src/renderer/src/ui/MobileRemoteDialog.tsx')
  })

  it('filters out grazing neighbor buttons and #ai-ui-inspector-btn when scanning a specific toolbar button', () => {
    const aiInspectorBtn = {
      tagName: 'BUTTON',
      id: 'ai-ui-inspector-btn',
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getBoundingClientRect: () => ({
        left: 1540,
        top: 5,
        right: 1574,
        bottom: 35,
        width: 34,
        height: 30
      })
    } as unknown as Element

    const remoteQrBtn = {
      tagName: 'BUTTON',
      id: 'remote-qr-btn',
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getBoundingClientRect: () => ({
        left: 1576,
        top: 5,
        right: 1606,
        bottom: 35,
        width: 30,
        height: 30
      })
    } as unknown as Element

    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('button')) return [aiInspectorBtn, remoteQrBtn]
      return []
    })

    // Box (1572, 3, 34x36) covers remoteQrBtn completely while grazing aiInspectorBtn by 2px
    const found = findElementsInBox({ left: 1572, top: 3, width: 34, height: 36 })
    expect(found).toEqual([remoteQrBtn])
  })

  it('extracts dialog context for Photo Studio, Audio Studio, Manifest, and Remote dialogs', () => {
    useView.setState({ dialog: 'remote' })
    const remoteCtx = extractActiveWorkshopContext({ left: 100, top: 100, width: 200, height: 100 }, [])
    expect(remoteCtx).not.toBeNull()
    expect(remoteCtx?.workshopTitle).toContain('Mobile Wi-Fi Remote')
    expect(remoteCtx?.relatedFiles).toContain('src/renderer/src/ui/MobileRemoteDialog.tsx')

    useView.setState({ dialog: 'photo_editor' })
    const photoCtx = extractActiveWorkshopContext({ left: 100, top: 100, width: 200, height: 100 }, [])
    expect(photoCtx?.workshopType).toBe('photo_editor')
    expect(photoCtx?.relatedFiles).toContain('src/renderer/src/ui/photoStudio/PhotoStudioDialog.tsx')
  })

  it('formatAiInspectorMarkdown generates markdown with AI Focus Target, workshop 2.5D parts, and UI details', () => {
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
        relatedFiles: ['src/renderer/src/ui/layerAssembly/LayerAssemblyDialog.tsx'],
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
          ownerComponentName: 'AssembledLayerItemView',
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
    expect(md).toContain('#### 🎯 Tâm điểm cần sửa (AI Focus Target):')
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
      closest: () => mockButton,
      matches: () => false
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
