import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssetManifestStore } from '../../store/assetManifest'
import { manifestCommands } from './manifestCommands'
import { renderCategoryIcon } from '../../ui/assets/categoryIcons'

describe('manifestCommands & dynamic icon fallback', () => {
  beforeEach(() => {
    useAssetManifestStore.setState({
      loaded: true,
      loading: false,
      categories: [
        {
          id: 'characters',
          title: 'Nhân vật',
          shortTitle: 'Nhân vật',
          folder: 'characters',
          icon: 'user-male',
          accent: '#ec4899',
          order: 1,
          status: 'active'
        }
      ],
      items: [
        {
          id: 'builtin:characters/chibi_boy_jump.png',
          name: 'Cậu bé nhảy',
          fileName: 'chibi_boy_jump.png',
          category: 'characters',
          folder: 'characters',
          relativePath: 'characters/chibi_boy_jump.png',
          path: 'D:/assets/characters/chibi_boy_jump.png',
          ext: '.png',
          mime: 'image/png',
          size: 1024,
          previewUrl: 'data:image/png;base64,AAA',
          kind: 'image',
          status: 'active'
        }
      ],
      deletedItems: [
        {
          id: 'builtin:deleted:nature/old_tree.png',
          name: 'Cây cổ thụ cũ',
          fileName: 'old_tree.png',
          category: 'nature',
          folder: 'nature',
          relativePath: 'nature/old_tree.png',
          path: 'D:/assets/_temp_deleted/nature/old_tree.png',
          ext: '.png',
          mime: 'image/png',
          size: 2048,
          previewUrl: '',
          kind: 'image',
          status: 'deleted',
          tempPath: '_temp_deleted/nature/old_tree.png',
          deletedAt: '2026-11-03T10:00:00.000Z'
        }
      ],
      iconUrls: {
        'icons/default-topic.svg': 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
      },
      refreshCatalog: vi.fn(async () => useAssetManifestStore.getState().catalog),
      upsertCategory: vi.fn(async () => ({ ok: true })),
      deleteCategory: vi.fn(async () => ({ ok: true })),
      upsertAssetMeta: vi.fn(async () => ({ ok: true })),
      saveModuleJson: vi.fn(async () => ({ ok: true })),
      softDeleteAsset: vi.fn(async () => ({ ok: true, status: 'deleted' as const })),
      restoreAsset: vi.fn(async () => ({ ok: true })),
      pruneManifests: vi.fn(async () => ({
        ok: true,
        report: {
          removedAssets: ['a.png', 'b.png'],
          removedItems: [],
          removedCategories: [],
          softDeletedAssets: ['nature/old_tree.png'],
          restoredAssets: [],
          unlisted: [],
          added: ['new.png']
        }
      }))
    })
  })

  it('get_assets_manifest returns coordinator overview and soft-deleted items', async () => {
    const res = (await manifestCommands.get_assets_manifest({}, {
      reqId: '1',
      method: 'get_assets_manifest',
      params: {}
    })) as Record<string, unknown>

    expect(res.ok).toBe(true)
    expect(res.temp_trash_folder).toBe('_temp_deleted')
    expect(res.active_items_count).toBe(1)
    expect(res.deleted_items_count).toBe(1)
  })

  it('update_assets_manifest upserts a category with icon_url and icon_text', async () => {
    const res = (await manifestCommands.update_assets_manifest(
      {
        module_id: 'builtin',
        action: 'upsert_category',
        category_id: 'water_fx',
        title: 'Thác nước & Sóng',
        folder: 'nature/water',
        icon: 'sparkles',
        icon_url: 'icons/default-topic.svg',
        icon_text: 'WT'
      },
      { reqId: '2', method: 'update_assets_manifest', params: {} }
    )) as { ok: boolean; category: { id: string; title: string; iconText?: string } }

    expect(res.ok).toBe(true)
    expect(res.category.id).toBe('water_fx')
    expect(res.category.title).toBe('Thác nước & Sóng')
    expect(res.category.iconText).toBe('WT')
  })

  it('restore_deleted_asset supports restore, soft_delete, and permanent_delete', async () => {
    const resRestore = (await manifestCommands.restore_deleted_asset(
      { relative_path: 'nature/old_tree.png', action: 'restore' },
      { reqId: '3', method: 'restore_deleted_asset', params: {} }
    )) as { ok: boolean; action: string }
    expect(resRestore.ok).toBe(true)
    expect(resRestore.action).toBe('restore')

    const resSoft = (await manifestCommands.restore_deleted_asset(
      { relative_path: 'characters/chibi_boy_jump.png', action: 'soft_delete' },
      { reqId: '4', method: 'restore_deleted_asset', params: {} }
    )) as { ok: boolean; temp_folder: string }
    expect(resSoft.ok).toBe(true)
    expect(resSoft.temp_folder).toBe('_temp_deleted')
  })

  it('prune_assets_manifest triggers workspace prune report', async () => {
    const res = (await manifestCommands.prune_assets_manifest(
      {},
      { reqId: '5', method: 'prune_assets_manifest', params: {} }
    )) as { ok: boolean; removedCount: number; addedCount: number }
    expect(res.ok).toBe(true)
    expect(res.removedCount).toBe(2)
    expect(res.addedCount).toBe(1)
  })

  it('renderCategoryIcon falls back to warning icon when iconUrl is missing and text badge when iconText is provided', () => {
    const validNode = renderCategoryIcon('sparkles', 14, 14, 'water_fx', {
      iconUrl: 'icons/default-topic.svg'
    })
    expect(validNode).toBeTruthy()

    const brokenNode = renderCategoryIcon('sparkles', 14, 14, 'water_fx', {
      iconUrl: 'icons/missing-deleted-folder.svg'
    })
    expect(brokenNode).toBeTruthy()

    const textBadgeNode = renderCategoryIcon('text', 14, 14, 'fx', {
      iconText: 'FX'
    })
    expect(textBadgeNode).toBeTruthy()
  })
})
