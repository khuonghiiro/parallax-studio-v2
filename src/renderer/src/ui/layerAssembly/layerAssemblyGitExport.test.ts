import { describe, it, expect, vi } from 'vitest'
import { dataUrlToUint8Array, exportCompositeToGitProject, importCompositeFromGitProject } from './layerAssemblyGitExport'
import type { LayerComposite } from './types'

describe('layerAssemblyGitExport', () => {
  it('converts base64 dataUrl to Uint8Array accurately', () => {
    // 1x1 transparent png or simple base64 "Hello"
    const raw = 'SGVsbG8gd29ybGQ=' // "Hello world"
    const dataUrl = `data:image/png;base64,${raw}`
    const bytes = dataUrlToUint8Array(dataUrl)
    expect(bytes).toBeInstanceOf(Uint8Array)
    const decoded = String.fromCharCode(...bytes)
    expect(decoded).toBe('Hello world')
  })

  it('exports composite layers with base64 imageUrl to real PNG assets and saves JSON', async () => {
    const mockImportAsset = vi.fn().mockResolvedValue({ ok: true, relPath: 'uploads/hero_head_123.png' })
    const mockSaveJson = vi.fn().mockResolvedValue('D:/Codes/parallax-studio/hero.composite.json')

    // Mock window.api
    vi.stubGlobal('window', {
      api: {
        importBuiltInAssetFile: mockImportAsset,
        saveJson: mockSaveJson
      },
      dispatchEvent: vi.fn()
    })

    const sampleComposite: LayerComposite = {
      id: 'comp-hero',
      name: 'Hiệp Sĩ Nam',
      category: 'character',
      width: 500,
      height: 600,
      createdAt: 1000,
      updatedAt: 1000,
      layers: [
        {
          id: 'layer-head',
          name: 'Đầu & Mũ',
          assetPath: 'assets/hero_atlas.png',
          imageUrl: 'data:image/png;base64,SGVsbG8=',
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
          scale: 1,
          opacity: 1
        }
      ]
    }

    const onUpdate = vi.fn()
    const result = await exportCompositeToGitProject(sampleComposite, onUpdate)

    expect(result.ok).toBe(true)
    expect(result.savedPath).toBe('D:/Codes/parallax-studio/hero.composite.json')
    expect(mockImportAsset).toHaveBeenCalledTimes(1)
    expect(mockSaveJson).toHaveBeenCalledTimes(1)

    // The updated layer should have assetPath set to the real PNG and imageUrl cleared
    const updatedComposite = onUpdate.mock.calls[0][0] as LayerComposite
    expect(updatedComposite.layers[0].assetPath).toBe('uploads/hero_head_123.png')
    expect(updatedComposite.layers[0].imageUrl).toBeUndefined()

    vi.unstubAllGlobals()
  })

  it('imports composite from JSON file and persists to storage', async () => {
    const mockOpenJson = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        id: 'comp-imported',
        name: 'Mẫu Tải Về',
        width: 600,
        height: 800,
        layers: []
      })
    })

    vi.stubGlobal('window', {
      api: {
        openJson: mockOpenJson
      },
      dispatchEvent: vi.fn()
    })

    const onLoaded = vi.fn()
    const result = await importCompositeFromGitProject(onLoaded)

    expect(result.ok).toBe(true)
    expect(onLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comp-imported',
        name: 'Mẫu Tải Về'
      })
    )

    vi.unstubAllGlobals()
  })
})
