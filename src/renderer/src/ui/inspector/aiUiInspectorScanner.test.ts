import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatAiInspectorMarkdown,
  extractFiberInfo,
  scanElementContext,
  findElementsInBox,
  captureAiInspectorSnapshot,
  AiInspectorSnapshot
} from './aiUiInspectorScanner'
import { extractActiveWorkshopContext } from './aiUiInspectorWorkshopContext'
import { useView } from '../../store/view'
import { useEditor } from '../../store/editor'

describe('aiUiInspectorScanner', () => {
  let originalDocument: any

  beforeEach(() => {
    originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      elementFromPoint: vi.fn(),
      getElementById: vi.fn().mockReturnValue(null),
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
      getBoundingClientRect: () => ({ left: 200, top: 150, right: 360, bottom: 182, width: 160, height: 32 }),
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
      getBoundingClientRect: () => ({ left: 1572, top: 3, right: 1604, bottom: 35, width: 32, height: 32 }),
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
      getAttribute: () => null,
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
      getAttribute: () => null,
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

    const found = findElementsInBox({ left: 1572, top: 3, width: 34, height: 36 })
    expect(found).toEqual([remoteQrBtn])
  })

  it('clips scrolled elements inside .wf-v2-insp-body so they do not leak into #tab-node-props (inspector_bottom_tabs)', () => {
    const inspScrollBody = {
      tagName: 'DIV',
      matches: (sel: string) => sel.includes('.wf-v2-insp-body'),
      getBoundingClientRect: () => ({
        left: 1530,
        top: 300,
        right: 1910,
        bottom: 910,
        width: 380,
        height: 610
      }),
      parentElement: null
    } as unknown as HTMLElement

    // "🧩 Cẳng chân phải" has raw rect extending down to y=940, but its parent .wf-v2-insp-body clips at bottom=910
    const scrolledMemberBtn = {
      tagName: 'BUTTON',
      id: '',
      parentElement: inspScrollBody,
      classList: { contains: () => false },
      closest: (sel: string) => (sel.includes('.wf-v2-insp-body') ? inspScrollBody : null),
      contains: () => false,
      matches: () => false,
      getAttribute: () => null,
      getBoundingClientRect: () => ({
        left: 1550,
        top: 912,
        right: 1880,
        bottom: 940,
        width: 330,
        height: 28
      })
    } as unknown as Element

    const tabNodePropsBtn = {
      tagName: 'BUTTON',
      id: 'tab-node-props',
      parentElement: null,
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getAttribute: () => null,
      getBoundingClientRect: () => ({
        left: 1535,
        top: 916,
        right: 1720,
        bottom: 952,
        width: 185,
        height: 36
      })
    } as unknown as Element

    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('button')) return [scrolledMemberBtn, tabNodePropsBtn]
      return []
    })

    const found = findElementsInBox({ left: 1532, top: 916, width: 382, height: 41 })
    expect(found).toEqual([tabNodePropsBtn])
  })

  it('prioritizes focused Layer / 2.5D Cluster BBox inside Khung chỉnh BBox (workflow_preview)', () => {
    const focusedBboxEl = {
      tagName: 'DIV',
      id: '',
      parentElement: null,
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: (sel: string) => sel.includes('.wf-v2-direct-layer-bbox'),
      getAttribute: (attr: string) => (attr === 'data-bbox-focused' ? 'true' : null),
      getBoundingClientRect: () => ({
        left: 1350,
        top: 400,
        right: 1550,
        bottom: 600,
        width: 200,
        height: 200
      })
    } as unknown as Element

    const backgroundStageLayerEl = {
      tagName: 'DIV',
      id: '',
      parentElement: null,
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: (sel: string) => sel.includes('.wf-v2-direct-layer') && !sel.includes('-bbox'),
      getAttribute: () => null,
      getBoundingClientRect: () => ({
        left: 1220,
        top: 350,
        right: 1880,
        bottom: 700,
        width: 660,
        height: 350
      })
    } as unknown as Element

    const outerSectionEl = {
      tagName: 'SECTION',
      id: '',
      parentElement: null,
      classList: { contains: () => false },
      closest: () => null,
      contains: (other: Element) => other === focusedBboxEl || other === backgroundStageLayerEl,
      matches: (sel: string) => sel.includes('[data-mcp-region]') || sel.includes('section'),
      getAttribute: (attr: string) => (attr === 'data-mcp-region' ? 'workflow_preview' : null),
      querySelectorAll: () => [focusedBboxEl],
      getBoundingClientRect: () => ({
        left: 1205,
        top: 344,
        right: 1917,
        bottom: 713,
        width: 712,
        height: 369
      })
    } as unknown as Element

    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('.wf-v2-direct-layer-bbox')) {
        return [outerSectionEl, backgroundStageLayerEl, focusedBboxEl]
      }
      return []
    })

    const found = findElementsInBox({ left: 1205, top: 344, width: 712, height: 369 })
    expect(found).toEqual([focusedBboxEl])
  })

  it('captures Scene Layer / 2.5D Cluster on #viewer-canvas and filters out peripheral toolbar buttons when scanning the scene', () => {
    const baseProject = useEditor.getState().project
    const mockLayer = {
      id: 'layer_hero_1',
      name: 'Cô Gái Áo Đỏ 2.5D',
      type: 'image' as const,
      visible: true,
      locked: false,
      inPoint: 0,
      outPoint: 10,
      composite: {
        compositeId: 'comp_girl',
        instanceId: 'inst_girl_1',
        partKey: 'torso',
        partName: 'Thân áo'
      },
      transform: {
        position: { value: [120, -40, 0] as [number, number, number], keyframes: [] },
        scale: { value: [1, 1, 1] as [number, number, number], keyframes: [] },
        rotation: { value: [0, 0, 0] as [number, number, number], keyframes: [] },
        opacity: { value: 1, keyframes: [] }
      }
    }
    useEditor.setState({
      project: { ...baseProject, layers: [mockLayer as any] },
      selectedLayerId: mockLayer.id
    })
    const targetLayer = mockLayer

    const viewerCanvas = {
      tagName: 'CANVAS',
      id: 'viewer-canvas',
      classList: [],
      getAttribute: (attr: string) => (attr === 'data-mcp-region' ? 'viewer_canvas' : null),
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getBoundingClientRect: () => ({
        left: 340,
        top: 60,
        right: 1500,
        bottom: 760,
        width: 1160,
        height: 700
      }),
      __pxsQuerySceneLayersInBox: vi.fn().mockReturnValue([
        {
          layerId: targetLayer.id,
          isFocused: true,
          selectionScope: 'layer',
          clusterInstanceId: null,
          workflowNodeId: `v2:layer:${targetLayer.id}`,
          pane: 'camera',
          screenBounds: { left: 680, top: 210, width: 320, height: 360 }
        }
      ])
    } as unknown as Element

    const peripheralToolBtn = {
      tagName: 'BUTTON',
      id: 'view-path',
      classList: ['viewer-tool-btn', 'icon', 'active'],
      innerText: 'Hiện/ẩn đường bay camera 3D',
      textContent: 'Hiện/ẩn đường bay camera 3D',
      getAttribute: () => null,
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getBoundingClientRect: () => ({
        left: 420,
        top: 34,
        right: 452,
        bottom: 62,
        width: 32,
        height: 28
      })
    } as unknown as Element

    ;(globalThis as any).document.getElementById = vi.fn().mockImplementation((id: string) => {
      if (id === 'viewer-canvas') return viewerCanvas
      return null
    })
    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('canvas')) return [viewerCanvas, peripheralToolBtn]
      return []
    })

    const snap = captureAiInspectorSnapshot({ left: 342, top: 31, width: 1157, height: 749 })
    expect(snap.primaryRegion).toBe('viewer_canvas')
    expect(snap.elements.length).toBe(1)
    expect(snap.elements[0].id).toBe(targetLayer.id)
    expect(snap.elements[0].sceneEntity?.layerName).toBe(targetLayer.name)
    expect(snap.elements[0].bounds).toEqual({ left: 680, top: 210, width: 320, height: 360 })

    const md = formatAiInspectorMarkdown(snap)
    expect(md).toContain('Đối tượng Cảnh / Khung BBox đang chọn:')
    expect(md).toContain(targetLayer.name)
    expect(md).not.toContain('#view-path')
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

    const popupMenuItem = {
      tagName: 'BUTTON',
      classList: { contains: () => false },
      closest: () => null,
      contains: () => false,
      matches: () => false,
      getAttribute: () => null,
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

  it('preserves Workflow V2 Node Card as primary focus target and provides descriptive labels for inner controls', () => {
    useEditor.setState({
      project: {
        comp: { duration: 15 },
        layers: [
          {
            id: 'layer-root-1',
            name: 'Nhân Vật Anime 2.5D',
            composite: { instanceId: 'comp-inst-wIt2GIGV', templateId: 'tpl-1' }
          }
        ],
        shots: [],
        workflow: {
          nodes: [
            {
              id: 'v2-cluster-comp-inst-wIt2GIGV',
              type: 'cluster_lock',
              title: 'Nhân Vật Anime 2.5D — Nam Sinh Kính Cận (13 Mảnh + 2 Biểu Cảm)',
              position: { x: 600, y: 780 },
              enabled: true,
              params: {
                logicCategory: 'cluster_lock',
                instanceId: 'comp-inst-wIt2GIGV',
                timeStart: 0,
                timeEnd: 15
              }
            }
          ],
          edges: []
        }
      } as any
    })

    const createClassList = (classes: string[]) => {
      const arr: any = [...classes]
      arr.contains = (c: string) => classes.includes(c)
      return arr
    }

    const collapseBtn = {
      tagName: 'BUTTON',
      classList: createClassList(['wf-v2-icon-btn']),
      innerText: '−',
      textContent: '−',
      getAttribute: (k: string) =>
        k === 'title' ? 'Thu gọn các mảnh phụ của cụm trên sơ đồ (chỉ giữ Gốc neo)' : null,
      closest: (sel: string) => (sel.includes('.wf-v2-card') ? nodeCard : null),
      matches: (sel: string) => sel.includes('button'),
      getBoundingClientRect: () => ({ left: 680, top: 805, right: 704, bottom: 829, width: 24, height: 24 })
    } as unknown as Element

    const toggleBtn = {
      tagName: 'BUTTON',
      classList: createClassList(['wf-v2-toggle-pill', 'on']),
      innerText: '🔒',
      textContent: '🔒',
      getAttribute: (k: string) =>
        k === 'title'
          ? 'Đang khoá cả cụm — nhấn để mở khoá cụm (chỉnh lẻ từng mảnh)'
          : k === 'role'
            ? 'switch'
            : null,
      closest: (sel: string) => (sel.includes('.wf-v2-card') ? nodeCard : null),
      matches: (sel: string) => sel.includes('button') || sel.includes('[role="switch"]'),
      getBoundingClientRect: () => ({ left: 710, top: 805, right: 746, bottom: 829, width: 36, height: 24 })
    } as unknown as Element

    const timeBtn = {
      tagName: 'BUTTON',
      classList: createClassList(['wf-v2-time-pill']),
      innerText: '0.0–15.0s',
      textContent: '0.0–15.0s',
      getAttribute: (k: string) =>
        k === 'title' ? 'Nhấn để tua tới mốc bắt đầu' : null,
      closest: (sel: string) => (sel.includes('.wf-v2-card') ? nodeCard : null),
      matches: (sel: string) => sel.includes('button'),
      getBoundingClientRect: () => ({ left: 685, top: 840, right: 755, bottom: 860, width: 70, height: 20 })
    } as unknown as Element

    const nodeCard = {
      tagName: 'DIV',
      id: 'v2-cluster-comp-inst-wIt2GIGV',
      classList: createClassList(['wf-v2-card', 'level-logic', 'is-locked']),
      innerText: '',
      textContent: '',
      getAttribute: (k: string) => {
        if (k === 'data-mcp-region') return 'workflow_node_card'
        if (k === 'data-node-id') return 'v2-cluster-comp-inst-wIt2GIGV'
        return null
      },
      hasAttribute: (k: string) => k === 'data-node-id',
      closest: (sel: string) => (sel.includes('.wf-v2-card') ? nodeCard : null),
      matches: (sel: string) => sel.includes('.wf-v2-card') || sel.includes('[data-mcp-region]'),
      contains: (other: any) =>
        other === collapseBtn || other === toggleBtn || other === timeBtn,
      getBoundingClientRect: () => ({ left: 600, top: 780, right: 820, bottom: 870, width: 220, height: 90 })
    } as unknown as Element

    ;(globalThis as any).document.querySelectorAll = vi.fn().mockImplementation((sel: string) => {
      if (sel.includes('.wf-v2-card') || sel.includes('button')) {
        return [nodeCard, collapseBtn, toggleBtn, timeBtn]
      }
      return []
    })

    const found = findElementsInBox({ left: 679, top: 803, width: 188, height: 74 })
    // Thẻ Node không bị loại bỏ và được xếp làm phần tử số 1 (Tâm điểm)
    expect(found[0]).toBe(nodeCard)
    expect(found).toContain(collapseBtn)
    expect(found).toContain(toggleBtn)
    expect(found).toContain(timeBtn)

    const cardCtx = scanElementContext(nodeCard)
    expect(cardCtx.kindLabel).toBe('Thẻ Node Sơ đồ (Node Logic (cluster_lock))')
    expect(cardCtx.text).toContain('Nhân Vật Anime 2.5D')
    expect(cardCtx.id).toBe('v2-cluster-comp-inst-wIt2GIGV')

    const collapseCtx = scanElementContext(collapseBtn)
    expect(collapseCtx.text).toBe('Nút Thu gọn mảnh phụ (−)')
    expect(collapseCtx.id).toBe('') // Không bị gán nhầm id của node

    const toggleCtx = scanElementContext(toggleBtn)
    expect(toggleCtx.text).toBe('Công tắc Khóa Cụm 2.5D (🔒 Đang Khóa)')
    expect(toggleCtx.id).toBe('')

    const timeCtx = scanElementContext(timeBtn)
    expect(timeCtx.text).toBe('Thời lượng Node (0.0–15.0s)')
    expect(timeCtx.id).toBe('')

    const md = formatAiInspectorMarkdown({
      rect: { left: 679, top: 803, width: 188, height: 74 },
      primaryRegion: 'workflow_node_card',
      elements: [cardCtx, collapseCtx, timeCtx, toggleCtx],
      workshopContext: null,
      appState: {
        shotName: 'Cánh Đồng Gió Mùa',
        shotIndex: 1,
        currentTime: 0,
        duration: 15.0,
        fps: 30,
        isPlaying: false,
        selectedLayerNames: [],
        activeDialog: null,
        theme: 'dark'
      }
    })

    expect(md).toContain('Thẻ Node trọng tâm:')
    expect(md).toContain('Nhân Vật Anime 2.5D — Nam Sinh Kính Cận')
    expect(md).toContain('`<div id="v2-cluster-comp-inst-wIt2GIGV">` · 🎯 **Tâm điểm**')
    expect(md).toContain('**"Nút Thu gọn mảnh phụ (−)"** (Nút bấm thao tác) — `<button class="wf-v2-icon-btn">`')
    expect(md).toContain('"Thời lượng Node (0.0–15.0s)"')
    expect(md).toContain('"Công tắc Khóa Cụm 2.5D (🔒 Đang Khóa)"')
  })
})
