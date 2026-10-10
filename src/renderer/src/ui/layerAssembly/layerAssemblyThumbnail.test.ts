import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import type { LayerComposite } from './types'

describe('Layer Assembly Thumbnail Generator', () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.document = originalDocument
    globalThis.Image = originalImage
  })

  it('returns empty string when composite has no layers', async () => {
    const emptyComp: LayerComposite = {
      id: 'test-empty',
      name: 'Empty Composite',
      category: 'nature',
      width: 600,
      height: 600,
      layers: []
    }

    const thumb = await captureCompositeThumbnail(emptyComp)
    expect(thumb).toBe('')
  })

  it('returns empty string when all layers are hidden', async () => {
    const hiddenComp: LayerComposite = {
      id: 'test-hidden',
      name: 'Hidden Composite',
      category: 'nature',
      width: 600,
      height: 600,
      layers: [
        {
          id: 'l1',
          name: 'Hidden Layer',
          assetPath: 'test.png',
          imageUrl: 'data:image/png;base64,hiddenLayerData',
          x: 0,
          y: 0,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          hidden: true,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ]
    }

    const thumb = await captureCompositeThumbnail(hiddenComp)
    expect(thumb).toBe('')
  })

  it('renders a valid dataURL for composite with layers', async () => {
    // Mock HTMLCanvasElement and 2D context in node
    const mockCtx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      shadowColor: '',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      globalAlpha: 1
    }

    const mockCanvas = {
      width: 280,
      height: 280,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => 'data:image/png;base64,mockThumbnailDataUrl')
    }

    // @ts-expect-error Mock document for node environment
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
        return {} as HTMLElement
      }
    }

    // Mock Image loading
    class MockImage {
      naturalWidth = 200
      naturalHeight = 200
      crossOrigin = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''

      set src(val: string) {
        this._src = val
        setTimeout(() => this.onload?.(), 0)
      }
      get src() {
        return this._src
      }
    }

    // @ts-expect-error Mock Image for node/vitest
    globalThis.Image = MockImage

    const sampleComp: LayerComposite = {
      id: 'test-sample',
      name: 'Bonsai Sample',
      category: 'nature',
      width: 600,
      height: 600,
      layers: [
        {
          id: 'pot',
          name: 'Chậu',
          assetPath: '',
          imageUrl: 'data:image/png;base64,potData',
          x: 0,
          y: 100,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
        },
        {
          id: 'branch',
          name: 'Cành',
          assetPath: '',
          imageUrl: 'data:image/png;base64,branchData',
          x: 0,
          y: -50,
          z: -10,
          scale: 1,
          rotation: 15,
          opacity: 0.9,
          motion: { type: 'sway', speed: 1, amplitude: 5, anchor: 'bottom' }
        }
      ]
    }

    const thumb = await captureCompositeThumbnail(sampleComp, {
      size: 280,
      autoFit: true,
      time: 0
    })

    expect(thumb).toBe('data:image/png;base64,mockThumbnailDataUrl')
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2)
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 280, 280)
  })
})
