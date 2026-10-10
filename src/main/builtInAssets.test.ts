import { describe, expect, it } from 'vitest'
import {
  loadAssetBytes,
  saveManifestJson,
  scanBuiltInCatalog,
  sortCategories,
  importBuiltInAssetFile,
  deleteBuiltInAsset
} from './builtInAssets'
import type { BuiltInAssetCategory } from '@shared/ipc'

describe('Built-in Assets Catalog & Manifest Management', () => {
  it('scans built-in catalog and finds categories and media assets', async () => {
    const catalog = await scanBuiltInCatalog()
    expect(catalog).toBeDefined()
    expect(Array.isArray(catalog.categories)).toBe(true)
    expect(catalog.categories.length).toBeGreaterThanOrEqual(3)

    // Check default categories
    const allCat = catalog.categories.find((c) => c.id === 'all')
    const layeredCat = catalog.categories.find((c) => c.id === 'demo_transparent')
    const audioCat = catalog.categories.find((c) => c.id === 'audio')
    expect(allCat).toBeDefined()
    expect(layeredCat?.title).toContain('2.5D')
    expect(audioCat?.title).toContain('Âm thanh')

    // Check items discovered
    expect(Array.isArray(catalog.items)).toBe(true)
    expect(catalog.items.length).toBeGreaterThan(0)

    // Look for known files in assets
    const layeredItem = catalog.items.find((it) => it.folder === 'demo_transparent')
    expect(layeredItem).toBeDefined()
    expect(layeredItem?.kind).toBe('image')

    const demoItem = catalog.items.find((it) => it.folder === 'demos' && it.isAnimated)
    expect(demoItem).toBeDefined()

    // 3D assembly textures are excluded from the regular 2D library
    expect(catalog.items.some((it) => it.relativePath.startsWith('assembly_3d/'))).toBe(false)
  })

  it('loads binary bytes and mime type for an existing asset', async () => {
    const catalog = await scanBuiltInCatalog()
    const firstItem = catalog.items[0]
    expect(firstItem).toBeDefined()

    const loaded = await loadAssetBytes(firstItem.relativePath)
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe(firstItem.fileName)
    expect(loaded?.data.length).toBeGreaterThan(0)
    expect(loaded?.mime).toBe(firstItem.mime)
  })

  it('rejects invalid JSON syntax when saving manifest', async () => {
    const res = await saveManifestJson('{ invalid json syntax')
    expect(res.ok).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('rejects manifest JSON without categories array', async () => {
    const res = await saveManifestJson('{"name": "test"}')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('categories')
  })

  it('maps custom Vietnamese asset names configured in manifest.json', async () => {
    const catalog = await scanBuiltInCatalog(true)
    const skyItem = catalog.items.find((it) => it.relativePath === 'demo_transparent/layer1_sky.png')
    expect(skyItem).toBeDefined()
    expect(skyItem?.name).toBe('Bầu trời hoàng hôn')

    // Audio assets are listed with a non-empty display name too
    const audioItem = catalog.items.find((it) => it.relativePath === 'audio/ambient_chime.wav')
    expect(audioItem?.kind).toBe('audio')
    expect(audioItem?.name.length).toBeGreaterThan(0)
  })

  it('sorts categories by order ascending and falls back to alphabetical order for matching order', () => {
    const rawCategories: BuiltInAssetCategory[] = [
      { id: 'cat_c', folder: 'c', title: 'Cảnh quan biển', icon: 'image', order: 2 },
      { id: 'cat_a', folder: 'a', title: 'Âm thanh tự nhiên', icon: 'music', order: 2 },
      { id: 'cat_b', folder: 'b', title: 'Bầu trời đêm', icon: 'image', order: 2 },
      { id: 'cat_first', folder: '', title: 'Tất cả tài nguyên', icon: 'all', order: 0 },
      { id: 'cat_last', folder: 'last', title: 'Đồ họa khác', icon: 'image' }, // order undefined -> 9999
      { id: 'cat_one', folder: 'one', title: 'Nhân vật hoạt hình', icon: 'image', order: 1 }
    ]

    const sorted = sortCategories(rawCategories)
    expect(sorted.map((c) => c.id)).toEqual([
      'cat_first', // order 0
      'cat_one',   // order 1
      'cat_a',     // order 2, 'Âm thanh tự nhiên' (chữ Â đứng đầu)
      'cat_b',     // order 2, 'Bầu trời đêm' (chữ B)
      'cat_c',     // order 2, 'Cảnh quan biển' (chữ C)
      'cat_last'   // order 9999
    ])
  })

  it('imports an asset file buffer into assets/uploads and cleans it up with deleteBuiltInAsset', async () => {
    // 1x1 transparent PNG buffer
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const buffer = Buffer.from(pngBase64, 'base64')

    const importRes = await importBuiltInAssetFile({
      name: 'test_unit_upload_photo.png',
      buffer: new Uint8Array(buffer),
      folder: 'uploads',
      title: 'Ảnh test đơn vị'
    })

    expect(importRes.ok).toBe(true)
    expect(importRes.relPath).toBeDefined()
    expect(importRes.relPath).toMatch(/^uploads\/test_unit_upload_photo(_\d+)?\.png$/)
    expect(importRes.item).toBeDefined()
    expect(importRes.item?.name).toBe('Ảnh test đơn vị')

    // Clean up
    if (importRes.relPath) {
      const deleteRes = await deleteBuiltInAsset(importRes.relPath)
      expect(deleteRes.ok).toBe(true)
    }
  })
})
