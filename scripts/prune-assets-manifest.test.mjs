import { describe, expect, it } from 'vitest'
import { hasChanges, pruneManifest, serializeLike } from './prune-assets-manifest.mjs'

const base = {
  categories: [
    { id: 'all', folder: '' },
    { id: 'city', folder: 'city' },
    { id: 'demos', folder: 'demos' }
  ],
  assets: {
    'city/a.jpg': { name: 'A' },
    'demos/b.gif': { name: 'B' },
    'c.png': 'C'
  }
}

describe('prune-assets-manifest', () => {
  it('removes entries of deleted files and empty categories', () => {
    const { manifest, report } = pruneManifest(base, ['demos/b.gif', 'x/c.png'])
    expect(Object.keys(manifest.assets)).toEqual(['demos/b.gif', 'c.png'])
    expect(manifest.categories.map((c) => c.id)).toEqual(['all', 'demos'])
    expect(report.removedAssets).toEqual(['city/a.jpg'])
    expect(report.removedCategories).toEqual(['city'])
    expect(hasChanges(report)).toBe(true)
  })

  it('keeps empty categories with keepEmpty and reports/adds unlisted files', () => {
    const files = ['demos/b.gif', 'demos/new_fire-fx.gif', 'x/c.png']
    const kept = pruneManifest(base, files, { keepEmpty: true })
    expect(kept.manifest.categories).toHaveLength(3)
    expect(kept.report.unlisted).toEqual(['demos/new_fire-fx.gif'])
    expect(kept.manifest.assets['demos/new_fire-fx.gif']).toBeUndefined()

    const added = pruneManifest(base, files, { addNew: true })
    expect(added.manifest.assets['demos/new_fire-fx.gif']).toEqual({ name: 'new fire fx' })
  })

  it('accepts assets/ prefixed keys and item arrays', () => {
    const m = { categories: [], assets: { 'assets/demos/b.gif': 'B' }, items: [{ path: 'gone.png' }, { path: 'demos/b.gif' }] }
    const { manifest, report } = pruneManifest(m, ['demos/b.gif'])
    expect(Object.keys(manifest.assets)).toEqual(['assets/demos/b.gif'])
    expect(manifest.items).toEqual([{ path: 'demos/b.gif' }])
    expect(report.removedItems).toEqual(['gone.png'])
  })

  it('reports no changes for a clean manifest', () => {
    const { report } = pruneManifest(base, ['city/a.jpg', 'demos/b.gif', 'c.png'])
    expect(hasChanges(report)).toBe(false)
  })

  it('preserves CRLF line endings and trailing newline', () => {
    expect(serializeLike('{\r\n}\r\n', { a: 1 })).toBe('{\r\n  "a": 1\r\n}\r\n')
    expect(serializeLike('{\n}', { a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('marks files in _temp_deleted as status deleted and restores files moved back to active', () => {
    const m = {
      categories: [
        { id: 'all', folder: '' },
        { id: 'city', folder: 'city' }
      ],
      assets: {
        'city/a.jpg': { name: 'A', status: 'active' },
        'city/restored.jpg': { name: 'Restored', status: 'deleted', tempPath: '_temp_deleted/city/restored.jpg' },
        'city/gone_forever.jpg': { name: 'Gone', status: 'deleted' }
      }
    }
    const { manifest, report } = pruneManifest(m, ['city/restored.jpg'], {
      tempFiles: ['city/a.jpg']
    })
    expect(manifest.assets['city/a.jpg']).toEqual({
      name: 'A',
      status: 'deleted',
      tempPath: '_temp_deleted/city/a.jpg'
    })
    expect(manifest.assets['city/restored.jpg']).toEqual({
      name: 'Restored',
      status: 'active'
    })
    expect(manifest.assets['city/gone_forever.jpg']).toBeUndefined()
    expect(report.softDeletedAssets).toEqual(['city/a.jpg'])
    expect(report.restoredAssets).toEqual(['city/restored.jpg'])
    expect(report.removedAssets).toEqual(['city/gone_forever.jpg'])
  })
})
