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

  it('loads built-in composites with bonsai tree, flower bush, vines ruins, and balcony window presets', () => {
    const list = getStoredComposites()
    expect(list.length).toBeGreaterThanOrEqual(4)

    const bonsai = list.find((c) => c.id === 'comp-bonsai-zen')
    expect(bonsai).toBeDefined()
    expect(bonsai?.name).toContain('Bonsai')
    expect(bonsai?.layers.length).toBe(5)

    const bush = list.find((c) => c.id === 'comp-flower-bush')
    expect(bush).toBeDefined()
    expect(bush?.name).toContain('Bụi Hoa')
    expect(bush?.category).toBe('nature')
    expect(bush?.layers.length).toBe(4)

    // Check layer stack depths & motion: cỏ nền ở sau, cánh hoa ở trước
    const grassBase = bush?.layers.find((l) => l.id === 'layer-grass-base')
    const petal = bush?.layers.find((l) => l.id === 'layer-flower-petal')
    expect(grassBase).toBeDefined()
    expect(petal).toBeDefined()
    expect(grassBase!.z).toBeGreaterThan(petal!.z) // Grass in background (z=20), petal in foreground (z=-18)
    expect(grassBase!.motion.type).toBe('sway')
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
    const dup = duplicateComposite('comp-flower-bush')
    expect(dup).not.toBeNull()
    expect(dup?.id).not.toBe('comp-flower-bush')
    expect(dup?.name).toContain('(Bản sao)')
    expect(dup?.category).toBe('custom')
    expect(dup?.layers.length).toBe(4)
    expect(dup?.layers[0].id).not.toBe('layer-grass-base')
  })

  it('deletes composite by id', () => {
    deleteComposite('comp-vines-ruins')
    const list = getStoredComposites()
    const ruins = list.find((c) => c.id === 'comp-vines-ruins')
    expect(ruins).toBeUndefined()
  })

  it('ensures humanoid rigged character presets have symmetrical frontal depth', () => {
    const list = getStoredComposites()
    const knight = list.find((c) => c.id === 'comp-knight-hero')
    expect(knight).toBeDefined()
    const armL = knight?.layers.find((l) => l.id === 'knight-arm-l')
    const armR = knight?.layers.find((l) => l.id === 'knight-arm-r')
    expect(armL?.z).toBe(armR?.z)
    const legL = knight?.layers.find((l) => l.id === 'knight-thigh-l')
    const legR = knight?.layers.find((l) => l.id === 'knight-thigh-r')
    expect(legL?.z).toBe(legR?.z)
    const foreL = knight?.layers.find((l) => l.id === 'knight-forearm-l')
    const foreR = knight?.layers.find((l) => l.id === 'knight-forearm-r')
    expect(foreL?.z).toBe(foreR?.z)
    // Giữ trọn độ giãn chiều sâu Z 2.5D rõ nét giữa các phân tầng cơ thể (> 40px)
    expect(legL!.z - foreL!.z).toBeGreaterThan(40)

    const anime = list.find((c) => c.id === 'comp-anime-girl-hero')
    expect(anime).toBeDefined()
    const aArmL = anime?.layers.find((l) => l.id === 'anime-arm-l')
    const aArmR = anime?.layers.find((l) => l.id === 'anime-arm-r')
    expect(aArmL?.z).toBe(aArmR?.z)
    const hairBack = anime?.layers.find((l) => l.id === 'anime-hair-back')
    expect(hairBack?.z).toBeGreaterThan(0) // Tóc sau lưng nằm ở hậu cảnh
    expect(hairBack!.z - aArmL!.z).toBeGreaterThan(40)
  })
})
