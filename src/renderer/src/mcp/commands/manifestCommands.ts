import type {
  BuiltInAssetCategory,
  BuiltInAssetItem,
  ManifestAssetMeta,
  ManifestItemStatus,
  ManifestModuleData,
  ManifestModuleId
} from '@shared/ipc'
import { ParamError, type Handler } from '../types'
import { bool, num, str } from '../params'
import { useAssetManifestStore } from '../../store/assetManifest'

const VALID_MODULES = new Set<ManifestModuleId>([
  'builtin',
  'layer_25d',
  'loop_animator',
  'model_3d',
  'audio'
])

function parseModuleId(raw: string | undefined, fallback: ManifestModuleId = 'builtin'): ManifestModuleId {
  if (!raw) return fallback
  const normalized = raw.trim().replace(/-/g, '_') as ManifestModuleId
  if (!VALID_MODULES.has(normalized)) {
    throw new ParamError(
      `Invalid module_id "${raw}". Expected one of: builtin, layer_25d, loop_animator, model_3d, audio.`
    )
  }
  return normalized
}

function parseStatus(raw: string | undefined): ManifestItemStatus | undefined {
  if (!raw) return undefined
  if (raw === 'active' || raw === 'deleted' || raw === 'hidden') return raw
  throw new ParamError(`Invalid status "${raw}". Expected active, deleted, or hidden.`)
}

export const manifestCommands: Record<string, Handler> = {
  get_assets_manifest: async (p) => {
    const store = useAssetManifestStore.getState()
    await store.refreshCatalog(false)
    const state = useAssetManifestStore.getState()
    const moduleFilter = str(p, 'module_id') ? parseModuleId(str(p, 'module_id')) : undefined
    const includeItems = bool(p, 'include_items') ?? true

    if (moduleFilter) {
      const modData: ManifestModuleData | undefined = state.modules[moduleFilter]
      return {
        ok: true,
        module_id: moduleFilter,
        module: modData ?? null,
        custom_icons: Object.keys(state.iconUrls ?? {}),
        deleted_items_count: state.deletedItems.length
      }
    }

    return {
      ok: true,
      version: state.catalog?.coordinator?.version || '2.0',
      temp_trash_folder: state.catalog?.tempTrashFolder || '_temp_deleted',
      icons_folder: state.catalog?.iconsFolder || 'icons',
      modules: state.modules,
      categories: state.categories,
      active_items_count: state.items.length,
      deleted_items_count: state.deletedItems.length,
      deleted_items: state.deletedItems.map((item: BuiltInAssetItem) => ({
        relativePath: item.relativePath,
        name: item.name,
        category: item.category || item.folder,
        status: item.status ?? 'deleted',
        tempPath: item.tempPath,
        deletedAt: item.deletedAt
      })),
      items: includeItems
        ? state.items.map((item: BuiltInAssetItem) => ({
            id: item.id,
            name: item.name,
            category: item.category || item.folder,
            relativePath: item.relativePath,
            kind: item.kind,
            status: item.status ?? 'active'
          }))
        : undefined,
      custom_icons: Object.keys(state.iconUrls ?? {})
    }
  },

  update_assets_manifest: async (p) => {
    const store = useAssetManifestStore.getState()
    if (!store.loaded) await store.refreshCatalog(false)
    const state = useAssetManifestStore.getState()
    const moduleId = parseModuleId(str(p, 'module_id'), 'builtin')
    const action = str(p, 'action') ?? 'upsert_category'
    const currentMod = state.modules[moduleId]

    if (action === 'save_module') {
      const rawModule = p.module_data as Record<string, unknown> | undefined
      if (!rawModule || typeof rawModule !== 'object' || !Array.isArray(rawModule.categories)) {
        throw new ParamError('save_module requires "module_data" with a "categories" array')
      }
      const res = await state.saveModuleJson(moduleId, JSON.stringify(rawModule, null, 2))
      return { ok: res.ok, error: res.error, module_id: moduleId, categories_count: rawModule.categories.length }
    }

    if (action === 'upsert_category') {
      const catId = str(p, 'category_id') || str(p, 'id')
      if (!catId) throw new ParamError('upsert_category requires "category_id"')
      const existing = currentMod?.categories.find((c) => c.id === catId)
      const updated: BuiltInAssetCategory = {
        id: catId,
        title: str(p, 'title') ?? existing?.title ?? catId,
        shortTitle: str(p, 'short_title') ?? existing?.shortTitle,
        folder: str(p, 'folder') ?? existing?.folder ?? `${moduleId}/${catId}`,
        icon: str(p, 'icon') ?? existing?.icon ?? 'sparkles',
        iconUrl: str(p, 'icon_url') !== undefined ? str(p, 'icon_url') || undefined : existing?.iconUrl,
        iconText: str(p, 'icon_text') !== undefined ? str(p, 'icon_text') || undefined : existing?.iconText,
        accent: str(p, 'accent') ?? existing?.accent ?? '#38bdf8',
        order: num(p, 'order') ?? existing?.order ?? (currentMod?.categories.length ?? 0) + 1,
        status: parseStatus(str(p, 'status')) ?? existing?.status ?? 'active'
      }
      const res = await state.upsertCategory(moduleId, updated)
      return { ok: res.ok, error: res.error, module_id: moduleId, action, category: updated }
    }

    if (action === 'delete_category') {
      const catId = str(p, 'category_id') || str(p, 'id')
      if (!catId) throw new ParamError('delete_category requires "category_id"')
      const softHide = bool(p, 'soft_hide') ?? false
      const res = await state.deleteCategory(moduleId, catId, softHide)
      return { ok: res.ok, error: res.error, module_id: moduleId, action, deleted_category_id: catId }
    }

    if (action === 'upsert_asset') {
      const relPath = str(p, 'relative_path')
      if (!relPath) throw new ParamError('upsert_asset requires "relative_path"')
      const meta: Partial<ManifestAssetMeta> = {
        ...(str(p, 'name') ? { name: str(p, 'name')! } : {}),
        ...(str(p, 'category') ? { category: str(p, 'category')! } : {}),
        ...(str(p, 'status') ? { status: parseStatus(str(p, 'status')) } : {})
      }
      const res = await state.upsertAssetMeta(moduleId, relPath, meta)
      return { ok: res.ok, error: res.error, module_id: moduleId, action, relative_path: relPath, asset: meta }
    }

    throw new ParamError(
      `Invalid action "${action}". Expected upsert_category, delete_category, upsert_asset, or save_module.`
    )
  },

  restore_deleted_asset: async (p) => {
    const relPath = str(p, 'relative_path')
    if (!relPath) throw new ParamError('Provide "relative_path" of the asset')
    const action = str(p, 'action') ?? 'restore'
    const store = useAssetManifestStore.getState()

    if (action === 'restore') {
      const res = await store.restoreAsset(relPath)
      return { ok: res.ok, error: res.error, action: 'restore', relative_path: relPath }
    }
    if (action === 'soft_delete') {
      const res = await store.softDeleteAsset(relPath, false)
      return {
        ok: res.ok,
        error: res.error,
        action: 'soft_delete',
        relative_path: relPath,
        temp_folder: '_temp_deleted'
      }
    }
    if (action === 'permanent_delete') {
      const res = await store.softDeleteAsset(relPath, true)
      return { ok: res.ok, error: res.error, action: 'permanent_delete', relative_path: relPath }
    }
    throw new ParamError(`Invalid action "${action}". Expected restore, soft_delete, or permanent_delete.`)
  },

  prune_assets_manifest: async () => {
    const store = useAssetManifestStore.getState()
    const res = await store.pruneManifests()
    return {
      ok: res.ok,
      error: res.error,
      removedCount: res.report?.removedAssets.length ?? 0,
      addedCount: res.report?.added.length ?? 0,
      softDeletedCount: res.report?.softDeletedAssets.length ?? 0,
      report: res.report
    }
  }
}
