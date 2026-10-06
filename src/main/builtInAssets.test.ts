import { describe, expect, it } from 'vitest'
import { loadAssetBytes, saveManifestJson, scanBuiltInCatalog } from './builtInAssets'

describe('Built-in Assets Catalog & Manifest Management', () => {
  it('scans built-in catalog and finds categories and media assets', async () => {
    const catalog = await scanBuiltInCatalog()
    expect(catalog).toBeDefined()
    expect(Array.isArray(catalog.categories)).toBe(true)
    expect(catalog.categories.length).toBeGreaterThanOrEqual(3)

    // Check default categories
    const allCat = catalog.categories.find((c) => c.id === 'all')
    const cityCat = catalog.categories.find((c) => c.id === 'city')
    const demosCat = catalog.categories.find((c) => c.id === 'demos')
    expect(allCat).toBeDefined()
    expect(cityCat?.title).toContain('Thành phố')
    expect(demosCat?.title).toContain('VFX')

    // Check items discovered
    expect(Array.isArray(catalog.items)).toBe(true)
    expect(catalog.items.length).toBeGreaterThan(0)

    // Look for known files in assets
    const cityItem = catalog.items.find((it) => it.folder === 'city')
    expect(cityItem).toBeDefined()
    expect(cityItem?.kind).toBe('image')

    const demoItem = catalog.items.find((it) => it.folder === 'demos' && it.isAnimated)
    expect(demoItem).toBeDefined()
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
})
