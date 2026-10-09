import { describe, expect, it, beforeEach } from 'vitest'
import {
  BUILTIN_COMPOSITES,
  getStoredComposites,
  saveComposite,
  deleteComposite,
  duplicateComposite
} from './layerAssemblyStorage'
import type { LayerComposite } from './types'

describe('Layer Assembly Workshop Storage System', () => {
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
    // @ts-expect-error polyfill for vitest environment
    globalThis.localStorage = mockLocalStorage
  })

  it('loads built-in composites with oak tree, flower bush, and swinging lantern presets', () => {
    const list = getStoredComposites()
    expect(list.length).toBeGreaterThanOrEqual(3)

    const tree = list.find((c) => c.id === 'comp-oak-tree')
    expect(tree).toBeDefined()
    expect(tree?.name).toContain('Cây Sồi')
    expect(tree?.category).toBe('nature')
    expect(tree?.layers.length).toBe(4)

    // Check layer stack depths & motion
    const trunk = tree?.layers.find((l) => l.id === 'layer-trunk')
    const canopyFront = tree?.layers.find((l) => l.id === 'layer-canopy-front')
    expect(trunk).toBeDefined()
    expect(canopyFront).toBeDefined()
    expect(trunk!.z).toBeGreaterThan(canopyFront!.z) // Trunk in background, leaves in foreground
    expect(canopyFront!.motion.type).toBe('sway')
  })

  it('saves new custom composite and retrieves from storage', () => {
    const custom: LayerComposite = {
      id: 'comp-custom-windmill',
      name: 'Cối Xay Gió Hoạt Ảnh',
      category: 'architecture',
      width: 500,
      height: 600,
      layers: [
        {
          id: 'l-tower',
          name: 'Tháp cối xay',
          x: 0,
          y: 0,
          z: 10,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        },
        {
          id: 'l-blades',
          name: 'Cánh quạt quay',
          x: 0,
          y: -100,
          z: -5,
          scale: 1,
          rotation: 45,
          opacity: 1,
          motion: { type: 'rocking', speed: 1.5, amplitude: 30, anchor: 'center' }
        }
      ]
    }

    saveComposite(custom)
    const list = getStoredComposites()
    const found = list.find((c) => c.id === 'comp-custom-windmill')
    expect(found).toBeDefined()
    expect(found?.name).toBe('Cối Xay Gió Hoạt Ảnh')
    expect(found?.layers.length).toBe(2)
  })

  it('updates existing composite when saved with same id', () => {
    const list = getStoredComposites()
    const first = list[0]
    const updated: LayerComposite = {
      ...first,
      name: 'Tên Đã Chỉnh Sửa'
    }

    saveComposite(updated)
    const after = getStoredComposites()
    const target = after.find((c) => c.id === first.id)
    expect(target?.name).toBe('Tên Đã Chỉnh Sửa')
  })

  it('duplicates composite with a new unique id and (Bản sao) suffix', () => {
    const dup = duplicateComposite('comp-oak-tree')
    expect(dup).not.toBeNull()
    expect(dup?.id).not.toBe('comp-oak-tree')
    expect(dup?.name).toContain('(Bản sao)')
    expect(dup?.category).toBe('custom')
    expect(dup?.layers.length).toBe(4)
    expect(dup?.layers[0].id).not.toBe('layer-trunk')
  })

  it('deletes composite by id', () => {
    deleteComposite('comp-flower-bush')
    const list = getStoredComposites()
    const bush = list.find((c) => c.id === 'comp-flower-bush')
    expect(bush).toBeUndefined()
  })
})
