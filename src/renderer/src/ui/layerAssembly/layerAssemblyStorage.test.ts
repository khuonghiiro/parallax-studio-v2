import { describe, expect, it, beforeEach } from 'vitest'
import {
  BUILTIN_COMPOSITES,
  getStoredComposites,
  saveComposite,
  deleteComposite,
  duplicateComposite,
  cleanDuplicateComposites,
  updateCompositeThumbnail,
  restoreDefaultComposites,
  getDeletedCompositeIds
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

  it('loads built-in composites with the 2 anime characters and 3 approved nature presets (modular tree, modular rock, bonsai)', () => {
    const list = getStoredComposites()
    expect(list.length).toBe(5)

    const bonsai = list.find((c) => c.id === 'comp-bonsai-zen')
    expect(bonsai).toBeDefined()
    expect(bonsai?.name).toContain('Bonsai')
    expect(bonsai?.layers.length).toBe(5)

    const tree = list.find((c) => c.id === 'comp-modular-tree')
    expect(tree).toBeDefined()
    expect(tree?.name).toContain('Cây Đại Thụ Bóc Tách')
    expect(tree?.category).toBe('nature')
    expect(tree?.layers.length).toBe(11)

    const rock = list.find((c) => c.id === 'comp-modular-rock')
    expect(rock).toBeDefined()
    expect(rock?.name).toContain('Cụm Đá Rêu Phong')
    expect(rock?.layers.length).toBe(7)

    // Check layer stack depths & motion: tán lá hậu cảnh ở sau, hoa quả ở trước
    const backFoliage = tree?.layers.find((l) => l.id === 'tree-foliage-back')
    const frontFoliage = tree?.layers.find((l) => l.id === 'tree-foliage-front')
    expect(backFoliage).toBeDefined()
    expect(frontFoliage).toBeDefined()
    expect(backFoliage!.z).toBeGreaterThan(frontFoliage!.z)
    expect(backFoliage!.motion.type).toBe('sway')
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
    const dup = duplicateComposite('comp-modular-rock')
    expect(dup).not.toBeNull()
    expect(dup?.id).not.toBe('comp-modular-rock')
    expect(dup?.name).toContain('(Bản sao)')
    expect(dup?.category).toBe('custom')
    expect(dup?.layers.length).toBe(7)
    expect(dup?.layers[0].id).not.toBe('rock-ground')
  })

  it('deletes composite by id', () => {
    deleteComposite('comp-modular-rock')
    const list = getStoredComposites()
    const rock = list.find((c) => c.id === 'comp-modular-rock')
    expect(rock).toBeUndefined()
  })

  it('ensures humanoid rigged character presets have symmetrical frontal depth', () => {
    const list = getStoredComposites()
    const character = list.find((c) => c.id === 'comp-character-cutout-demo-20261011')
    expect(character).toBeDefined()
    const armL = character?.layers.find((l) => l.name === 'arm-left')
    const armR = character?.layers.find((l) => l.name === 'arm-right')
    expect(armL?.z).toBe(armR?.z)
    const legL = character?.layers.find((l) => l.name === 'thigh-left')
    const legR = character?.layers.find((l) => l.name === 'thigh-right')
    expect(legL?.z).toBe(legR?.z)
    const foreL = character?.layers.find((l) => l.name === 'forearm-left')
    const foreR = character?.layers.find((l) => l.name === 'forearm-right')
    expect(foreL?.z).toBe(foreR?.z)

    const head = character?.layers.find((l) => l.name === 'head')
    const glasses = character?.layers.find((l) => l.name === 'glasses')
    const shinL = character?.layers.find((l) => l.name === 'shin-left')
    expect(shinL?.z).toBeGreaterThan(0) // Ống quần nằm ở lớp sau đùi
    expect(head!.z).toBeLessThan(0) // Đầu nằm phía trước cổ áo
    expect(glasses!.z).toBeLessThan(head!.z) // Kính nằm phía trước đầu và mặt
  })

  it('permanently remembers deleted built-in composites across app reloads and seed migrations', () => {
    // 1. Ban đầu có comp-bonsai-zen
    const initial = getStoredComposites()
    expect(initial.some((c) => c.id === 'comp-bonsai-zen')).toBe(true)

    // 2. Xóa comp-bonsai-zen
    deleteComposite('comp-bonsai-zen')
    expect(getDeletedCompositeIds().has('comp-bonsai-zen')).toBe(true)

    // 3. Giả lập mở lại app / thay đổi SEED_VERSION
    localStorage.setItem('pxs.layerComposites.seeded_version', 'v_old_version')
    const reloaded = getStoredComposites()
    expect(reloaded.some((c) => c.id === 'comp-bonsai-zen')).toBe(false)
  })

  it('filters out obsolete auto-saved duplicate clones (*-saved-<timestamp>)', () => {
    const dirtyList: LayerComposite[] = [
      {
        id: 'comp-bonsai-zen',
        name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp',
        category: 'nature',
        width: 500,
        height: 500,
        layers: []
      },
      {
        id: 'comp-bonsai-zen-saved-1791618755179',
        name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp (Bản đã lưu)',
        category: 'custom',
        width: 500,
        height: 500,
        layers: []
      },
      {
        id: 'comp-user-created-custom',
        name: 'Tự tạo hợp lệ',
        category: 'custom',
        width: 400,
        height: 400,
        layers: []
      }
    ]

    const cleaned = cleanDuplicateComposites(dirtyList)
    expect(cleaned.length).toBe(2)
    expect(cleaned.some((c) => c.id === 'comp-bonsai-zen-saved-1791618755179')).toBe(false)
    expect(cleaned.some((c) => c.id === 'comp-user-created-custom')).toBe(true)
  })

  it('safely updates thumbnail cache without modifying updatedAt or resurrecting deleted items', () => {
    const list = getStoredComposites()
    const target = list[0]
    const originalUpdated = target.updatedAt

    updateCompositeThumbnail(target.id, 'data:image/png;base64,sample')
    const updated = getStoredComposites().find((c) => c.id === target.id)
    expect(updated?.thumbnail).toBe('data:image/png;base64,sample')
    expect(updated?.updatedAt).toBe(originalUpdated)

    // Nếu item đã bị xóa, updateCompositeThumbnail không được phép hồi sinh nó
    deleteComposite(target.id)
    updateCompositeThumbnail(target.id, 'data:image/png;base64,new_thumb')
    const afterDelete = getStoredComposites()
    expect(afterDelete.some((c) => c.id === target.id)).toBe(false)
  })

  it('restores default built-in composites when explicitly requested', () => {
    deleteComposite('comp-modular-rock')
    expect(getStoredComposites().some((c) => c.id === 'comp-modular-rock')).toBe(false)

    restoreDefaultComposites()
    expect(getStoredComposites().some((c) => c.id === 'comp-modular-rock')).toBe(true)
    expect(getDeletedCompositeIds().has('comp-modular-rock')).toBe(false)
  })

  it('exports and imports LayerComposite via JSON with AssetTable aliases', async () => {
    const {
      exportLayerCompositeToJson,
      importLayerCompositeFromJson,
      setAssetAliasInComposite,
      replaceAssetPathInComposite
    } = await import('./layerAssemblyStorage')

    const comp: LayerComposite = {
      id: 'comp-json-test-1',
      name: 'Test Cutout Composite',
      category: 'character',
      width: 500,
      height: 600,
      assets: {
        head: 'character_cutout_demo/head.png',
        torso: 'character_cutout_demo/torso.png'
      },
      layers: [
        {
          id: 'l1',
          name: 'Head Layer',
          asset: '@head',
          assetPath: 'character_cutout_demo/head.png',
          x: 0,
          y: -100,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        },
        {
          id: 'l2',
          name: 'Torso Layer',
          asset: '@torso',
          assetPath: 'character_cutout_demo/torso.png',
          x: 0,
          y: 0,
          z: 5,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ]
    }

    const jsonStr = exportLayerCompositeToJson(comp, true)
    expect(jsonStr).toContain('"head": "character_cutout_demo/head.png"')
    expect(jsonStr).toContain('"@head"')

    const imported = importLayerCompositeFromJson(jsonStr)
    expect(imported.id).toBe('comp-json-test-1')
    expect(imported.assets?.head).toBe('character_cutout_demo/head.png')
    expect(imported.layers).toHaveLength(2)

    // Thử cập nhật nhãn tài nguyên (setAssetAliasInComposite)
    const updated = setAssetAliasInComposite(imported, 'head', 'character_cutout_demo/head_4k.png')
    expect(updated.assets?.head).toBe('character_cutout_demo/head_4k.png')

    // Thử thay thế đường dẫn (replaceAssetPathInComposite)
    const { composite: replaced, replacedCount } = replaceAssetPathInComposite(
      updated,
      'character_cutout_demo/torso.png',
      'character_cutout_demo/torso_hd.png'
    )
    expect(replacedCount).toBeGreaterThan(0)
    expect(replaced.assets?.torso).toBe('character_cutout_demo/torso_hd.png')
    expect(replaced.layers.find((l) => l.id === 'l2')?.assetPath).toBe('character_cutout_demo/torso_hd.png')
  })
})


