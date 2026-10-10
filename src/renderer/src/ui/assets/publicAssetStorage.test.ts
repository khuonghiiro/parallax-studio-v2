import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCustomPublicAssets,
  addCustomPublicAsset,
  hideOrDeletePublicAsset,
  getVisiblePublicAssets
} from './publicAssetStorage'
import type { BuiltInAssetItem } from '@shared/ipc'

describe('publicAssetStorage', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      }
    }
    // @ts-ignore
    globalThis.localStorage = mockLocalStorage
  })

  it('adds and retrieves custom public asset', () => {
    expect(loadCustomPublicAssets()).toEqual([])

    const added = addCustomPublicAsset('Cây Tùng', 'data:image/png;base64,12345', 1024)
    expect(added.name).toBe('Cây Tùng')
    expect(added.previewUrl).toBe('data:image/png;base64,12345')

    const loaded = loadCustomPublicAssets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('Cây Tùng')
  })

  it('hides a builtin asset', () => {
    const builtinItems: BuiltInAssetItem[] = [
      { id: 'b1', name: 'Item 1', fileName: 'item1.png', relativePath: 'demo/item1.png', folder: 'demo', ext: 'png', mime: 'image/png', kind: 'image', size: 100, path: 'demo/item1.png' },
      { id: 'b2', name: 'Item 2', fileName: 'item2.png', relativePath: 'demo/item2.png', folder: 'demo', ext: 'png', mime: 'image/png', kind: 'image', size: 100, path: 'demo/item2.png' }
    ]

    expect(getVisiblePublicAssets(builtinItems)).toHaveLength(2)

    hideOrDeletePublicAsset({ relativePath: 'demo/item1.png', isCustom: false })

    const visible = getVisiblePublicAssets(builtinItems)
    expect(visible).toHaveLength(1)
    expect(visible[0].id).toBe('b2')
  })

  it('deletes a custom public asset permanently', () => {
    const added = addCustomPublicAsset('Hoa Hồng', 'data:image/png;base64,abc', 500)
    expect(loadCustomPublicAssets()).toHaveLength(1)

    hideOrDeletePublicAsset({ id: added.id, isCustom: true })
    expect(loadCustomPublicAssets()).toHaveLength(0)
  })
})
