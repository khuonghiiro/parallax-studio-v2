import { create } from 'zustand'
import type {
  BuiltInAssetCategory,
  BuiltInAssetItem,
  BuiltInCatalogResult,
  ManifestAssetMeta,
  ManifestItemStatus,
  ManifestModuleData,
  ManifestModuleDescriptor,
  ManifestModuleId,
  ManifestPruneReport,
  ManifestSidebarTopic
} from '@shared/ipc'

export const DEFAULT_MODULE_DESCRIPTORS_CLIENT: Record<ManifestModuleId, ManifestModuleDescriptor> = {
  builtin: {
    id: 'builtin',
    title: 'Kho Tài Nguyên Công Khai',
    file: 'manifests/builtin.json',
    rootFolder: 'assets',
    tempFolder: 'assets/_temp_deleted',
    description: 'Tài nguyên ảnh phân tầng 2.5D, vật liệu, nhân vật tải lên và tệp công khai trong thư mục assets/'
  },
  layer_25d: {
    id: 'layer_25d',
    title: 'Xưởng Layer 2.5D',
    file: 'manifests/layer-25d.json',
    rootFolder: 'assets',
    tempFolder: 'assets/_temp_deleted',
    description: 'Chủ đề phân loại cụm Layer 2.5D (Bối cảnh, Nhân vật, Cây cối, Động vật, Đạo cụ, Kiến trúc) & cột tài nguyên trong xưởng'
  },
  loop_animator: {
    id: 'loop_animator',
    title: 'Xưởng Tách Hoạt Ảnh Loop',
    file: 'manifests/loop-animator.json',
    rootFolder: 'assets/demo_transparent',
    tempFolder: 'assets/_temp_deleted/demo_transparent',
    description: 'Nhóm chủ đề hoạt ảnh lặp (Lửa & Nhiệt, Phép thuật, Thiên nhiên, Điện & Plasma, Tự tạo) và danh mục Loop mẫu'
  },
  model_3d: {
    id: 'model_3d',
    title: 'Xưởng Lắp Ráp Khối 3D',
    file: 'manifests/model-3d.json',
    rootFolder: 'asset-3ds',
    tempFolder: 'assets/_temp_deleted/asset-3ds',
    description: 'Chủ đề mô hình 3D (Tự tạo, Nhà cửa, Nội thất, Phương tiện, Thiên nhiên, Đạo cụ) đồng bộ với asset-3ds/manifest.json'
  },
  audio: {
    id: 'audio',
    title: 'Kho Âm Thanh & Nhạc Nền',
    file: 'manifests/audio.json',
    rootFolder: 'assets/audio',
    tempFolder: 'assets/_temp_deleted/audio',
    description: 'Nhóm chủ đề âm thanh (Nhạc nền, Không gian, SFX, Chuyển cảnh, Lời thoại) và danh mục tệp âm thanh có sẵn'
  }
}

export const FALLBACK_MODULE_CATEGORIES: Record<ManifestModuleId, BuiltInAssetCategory[]> = {
  builtin: [
    { id: 'all', folder: '', title: 'Tất cả tài nguyên', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', accent: '#38bdf8', order: 0, status: 'active' },
    { id: 'demo_transparent', folder: 'demo_transparent', title: 'Cảnh mẫu trong suốt (2.5D)', shortTitle: 'Cảnh 2.5D', icon: 'layers', iconText: '2.5D', accent: '#22c55e', order: 1, status: 'active' },
    { id: 'audio', folder: 'audio', title: 'Âm Thanh & Nhạc Nền', shortTitle: 'Âm thanh', icon: 'music', iconText: 'SFX', accent: '#a78bfa', order: 2, status: 'active' },
    { id: 'uploads', folder: 'uploads', title: 'Tài nguyên tải lên', shortTitle: 'Tải lên', icon: 'image', iconText: 'UP', accent: '#f59e0b', order: 10, status: 'active' }
  ],
  layer_25d: [
    { id: 'all', folder: '', title: 'Tất cả 2.5D', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', accent: '#38bdf8', order: 0, status: 'active' },
    { id: 'scene', folder: 'demo_transparent', title: 'Bối cảnh 2.5D', shortTitle: 'Bối cảnh', icon: 'layers', iconText: 'SC', accent: '#22c55e', order: 1, status: 'active' },
    { id: 'character', folder: 'character_cutout_demo', title: 'Nhân vật', shortTitle: 'Nhân vật', icon: 'character', iconText: 'NV', accent: '#f59e0b', order: 2, status: 'active' },
    { id: 'nature', folder: 'nature_modular', title: 'Thiên nhiên & Cây cối', shortTitle: 'Cây cối', icon: 'nature', iconText: 'CC', accent: '#10b981', order: 3, status: 'active' },
    { id: 'animal', folder: 'animal_modular', title: 'Động vật & Sinh vật', shortTitle: 'Động vật', icon: 'animal', iconText: 'ĐV', accent: '#fb923c', order: 4, status: 'active' },
    { id: 'prop', folder: 'prop', title: 'Đạo cụ 2D', shortTitle: 'Đạo cụ', icon: 'prop', iconText: 'ĐC', accent: '#a855f7', order: 5, status: 'active' },
    { id: 'architecture', folder: 'house', title: 'Kiến trúc & Công trình', shortTitle: 'Kiến trúc', icon: 'architecture', iconText: 'KT', accent: '#60a5fa', order: 6, status: 'active' },
    { id: 'custom', folder: 'uploads', title: 'Tự tạo', shortTitle: 'Tự tạo', icon: 'custom', iconText: 'MY', accent: '#ec4899', order: 10, status: 'active' }
  ],
  loop_animator: [
    { id: 'all', folder: '', title: 'Tất cả Hoạt ảnh Loop', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', accent: '#38bdf8', order: 0, status: 'active' },
    { id: 'fire', folder: 'demo_transparent', title: 'Lửa & Nhiệt', shortTitle: 'Lửa', icon: 'flame', iconText: 'FIRE', accent: '#fb923c', order: 1, status: 'active' },
    { id: 'magic', folder: 'demo_transparent', title: 'Phép thuật', shortTitle: 'Phép thuật', icon: 'magic', iconText: 'MAG', accent: '#c084fc', order: 2, status: 'active' },
    { id: 'nature', folder: 'demo_transparent', title: 'Thiên nhiên', shortTitle: 'Thiên nhiên', icon: 'nature', iconText: 'NAT', accent: '#34d399', order: 3, status: 'active' },
    { id: 'electric', folder: 'demo_transparent', title: 'Điện & Plasma', shortTitle: 'Điện', icon: 'lightning', iconText: 'ELEC', accent: '#38bdf8', order: 4, status: 'active' },
    { id: 'custom', folder: 'uploads', title: 'Tự tạo (Của tôi)', shortTitle: 'Tự tạo', icon: 'custom', iconText: 'MY', accent: '#f472b6', order: 10, status: 'active' }
  ],
  model_3d: [
    { id: 'all', folder: '', title: 'Tất cả mô hình 3D', shortTitle: 'Tất cả', icon: 'all', iconText: '3D', accent: '#38bdf8', order: 0, status: 'active' },
    { id: 'custom', folder: 'custom', title: 'Mô hình tự tạo', shortTitle: 'Tự tạo', icon: 'custom', iconText: 'MY', accent: '#f472b6', order: 1, status: 'active' },
    { id: 'architecture', folder: 'architecture', title: 'Nhà cửa & Kiến trúc', shortTitle: 'Nhà cửa', icon: 'architecture', iconText: 'ARCH', accent: '#60a5fa', order: 2, status: 'active' },
    { id: 'interior', folder: 'interior', title: 'Nội thất phòng', shortTitle: 'Nội thất', icon: 'interior', iconText: 'ROOM', accent: '#f59e0b', order: 3, status: 'active' },
    { id: 'vehicle', folder: 'vehicle', title: 'Phương tiện & Xe cộ', shortTitle: 'Xe cộ', icon: 'vehicle', iconText: 'CAR', accent: '#ef4444', order: 4, status: 'active' },
    { id: 'nature', folder: 'nature', title: 'Cây cối & Thiên nhiên', shortTitle: 'Thiên nhiên', icon: 'nature', iconText: 'TREE', accent: '#22c55e', order: 5, status: 'active' },
    { id: 'prop', folder: 'prop', title: 'Đạo cụ & Vật dụng', shortTitle: 'Đạo cụ', icon: 'prop', iconText: 'PROP', accent: '#a855f7', order: 6, status: 'active' }
  ],
  audio: [
    { id: 'all', folder: '', title: 'Tất cả âm thanh', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', accent: '#38bdf8', order: 0, status: 'active' },
    { id: 'music', folder: 'audio', title: 'Nhạc nền (BGM)', shortTitle: 'Nhạc nền', icon: 'music', iconText: 'BGM', accent: '#a78bfa', order: 1, status: 'active' },
    { id: 'ambient', folder: 'audio', title: 'Không gian (Ambient)', shortTitle: 'Không gian', icon: 'ambient', iconText: 'AMB', accent: '#34d399', order: 2, status: 'active' },
    { id: 'sfx', folder: 'audio', title: 'Hiệu ứng (SFX)', shortTitle: 'Hiệu ứng', icon: 'sfx', iconText: 'SFX', accent: '#fb923c', order: 3, status: 'active' },
    { id: 'cinematic', folder: 'audio', title: 'Chuyển cảnh (Cinematic)', shortTitle: 'Chuyển cảnh', icon: 'cinematic', iconText: 'CINE', accent: '#38bdf8', order: 4, status: 'active' },
    { id: 'voice', folder: 'audio', title: 'Lời thoại (Voice)', shortTitle: 'Lời thoại', icon: 'voice', iconText: 'VOX', accent: '#f472b6', order: 5, status: 'active' }
  ]
}

export const FALLBACK_LAYER25D_TEMPLATE_CATEGORIES: BuiltInAssetCategory[] = [
  { id: 'all', folder: '', title: 'Tất cả mẫu', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', order: 0, status: 'active' },
  { id: 'character', folder: 'character_cutout_demo', title: 'Nhân vật', shortTitle: 'Nhân vật', icon: 'character', iconText: 'NV', order: 1, status: 'active' },
  { id: 'nature', folder: 'nature_modular', title: 'Cây cối', shortTitle: 'Cây cối', icon: 'nature', iconText: 'CC', order: 2, status: 'active' },
  { id: 'animal', folder: 'animal_modular', title: 'Động vật', shortTitle: 'Động vật', icon: 'animal', iconText: 'ĐV', order: 3, status: 'active' },
  { id: 'prop', folder: 'prop', title: 'Đạo cụ', shortTitle: 'Đạo cụ', icon: 'prop', iconText: 'ĐC', order: 4, status: 'active' }
]

export const FALLBACK_LAYER25D_SIDEBAR_TOPICS: ManifestSidebarTopic[] = [
  { id: 'all', title: 'Tất cả ảnh', shortTitle: 'Tất cả', icon: 'all', iconText: 'ALL', folderFilter: '', order: 0, status: 'active' },
  { id: 'demo_transparent', title: 'Lớp Cảnh 2.5D', shortTitle: 'Cảnh 2.5D', icon: 'layers', iconText: '2.5D', folderFilter: 'demo_transparent', order: 1, status: 'active' },
  { id: 'character', title: 'Nhân vật & Tải lên', shortTitle: 'Nhân vật', icon: 'character', iconText: 'NV', folderFilter: 'uploads', order: 2, status: 'active' },
  { id: 'nature', title: 'Cây cối & Lá', shortTitle: 'Cây cối', icon: 'nature', iconText: 'CC', folderFilter: 'tree', order: 3, status: 'active' }
]

function buildDefaultModules(): Record<ManifestModuleId, ManifestModuleData> {
  const out = {} as Record<ManifestModuleId, ManifestModuleData>
  const ids: ManifestModuleId[] = ['builtin', 'layer_25d', 'loop_animator', 'model_3d', 'audio']
  for (const id of ids) {
    const desc = DEFAULT_MODULE_DESCRIPTORS_CLIENT[id]
    const cats = FALLBACK_MODULE_CATEGORIES[id]
    const payload: any = {
      moduleId: id,
      title: desc.title,
      description: desc.description,
      categories: cats,
      ...(id === 'layer_25d'
        ? {
            templateCategories: FALLBACK_LAYER25D_TEMPLATE_CATEGORIES,
            sidebarAssetTopics: FALLBACK_LAYER25D_SIDEBAR_TOPICS
          }
        : {}),
      assets: {}
    }
    out[id] = {
      moduleId: id,
      title: desc.title,
      description: desc.description,
      file: desc.file,
      manifestPath: `assets/${desc.file}`,
      rawJson: JSON.stringify(payload, null, 2),
      categories: cats,
      templateCategories: id === 'layer_25d' ? FALLBACK_LAYER25D_TEMPLATE_CATEGORIES : undefined,
      sidebarAssetTopics: id === 'layer_25d' ? FALLBACK_LAYER25D_SIDEBAR_TOPICS : undefined,
      assets: {}
    }
  }
  return out
}

export interface SoftDeleteSnapshotOpts {
  name?: string
  category?: string
  folder?: string
  previewDataUrl?: string
  jsonContent?: string
  binaryBuffer?: Uint8Array
  fileName?: string
}

function dataUrlToUint8Array(dataUrl?: string): Uint8Array | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx < 0) return null
  try {
    const b64 = dataUrl.slice(commaIdx + 1)
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export interface AssetManifestState {
  loaded: boolean
  loading: boolean
  revision: number
  catalog: BuiltInCatalogResult | null
  categories: BuiltInAssetCategory[]
  items: BuiltInAssetItem[]
  deletedItems: BuiltInAssetItem[]
  iconUrls: Record<string, string>
  modules: Record<ManifestModuleId, ManifestModuleData>
  applyCatalog: (catalog: BuiltInCatalogResult) => void
  refreshCatalog: (force?: boolean) => Promise<BuiltInCatalogResult | null>
  saveModuleJson: (
    moduleId: ManifestModuleId | 'coordinator',
    rawJson: string
  ) => Promise<{ ok: boolean; error?: string }>
  upsertCategory: (
    moduleId: ManifestModuleId,
    cat: BuiltInAssetCategory
  ) => Promise<{ ok: boolean; error?: string }>
  deleteCategory: (
    moduleId: ManifestModuleId,
    categoryId: string,
    softHide?: boolean
  ) => Promise<{ ok: boolean; error?: string }>
  upsertAssetMeta: (
    moduleId: ManifestModuleId,
    relPath: string,
    meta: Partial<ManifestAssetMeta>
  ) => Promise<{ ok: boolean; error?: string }>
  softDeleteAsset: (
    relPath: string,
    permanent?: boolean,
    snapshotOpts?: SoftDeleteSnapshotOpts
  ) => Promise<{ ok: boolean; status?: ManifestItemStatus; tempPath?: string; error?: string }>
  restoreAsset: (relPath: string) => Promise<{ ok: boolean; error?: string }>
  pruneManifests: (opts?: {
    keepEmpty?: boolean
    addNew?: boolean
  }) => Promise<{ ok: boolean; report?: ManifestPruneReport; error?: string }>
}

function notifyLegacyListeners(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('parallax:manifest-updated'))
    window.dispatchEvent(new CustomEvent('parallax:public-assets-changed'))
  }
}

export const useAssetManifestStore = create<AssetManifestState>((set, get) => ({
  loaded: false,
  loading: false,
  revision: 0,
  catalog: null,
  categories: FALLBACK_MODULE_CATEGORIES.builtin,
  items: [],
  deletedItems: [],
  iconUrls: {},
  modules: buildDefaultModules(),

  applyCatalog: (catalog) => {
    const prevModules = get().modules
    const nextModules = catalog.modules ? { ...prevModules, ...catalog.modules } : prevModules
    set((s) => ({
      loaded: true,
      loading: false,
      revision: s.revision + 1,
      catalog,
      categories: catalog.categories?.length ? catalog.categories : FALLBACK_MODULE_CATEGORIES.builtin,
      items: catalog.items || [],
      deletedItems: catalog.deletedItems || [],
      iconUrls: catalog.iconUrls || {},
      modules: nextModules
    }))
    notifyLegacyListeners()
  },

  refreshCatalog: async (force = false) => {
    if (typeof window === 'undefined' || !window.api?.getBuiltInCatalog) return null
    set({ loading: true })
    try {
      const cat = await window.api.getBuiltInCatalog(force)
      if (cat) get().applyCatalog(cat)
      return cat
    } catch {
      set({ loading: false })
      return null
    }
  },

  saveModuleJson: async (moduleId, rawJson) => {
    if (typeof window === 'undefined') return { ok: false, error: 'Chưa sẵn sàng IPC' }
    let parsedObj: any = null
    try {
      parsedObj = JSON.parse(rawJson)
    } catch (err) {
      return { ok: false, error: `JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}` }
    }

    try {
      const res =
        moduleId === 'coordinator' || !window.api?.saveModuleManifest
          ? await window.api.saveBuiltInManifest(rawJson)
          : await window.api.saveModuleManifest(moduleId, rawJson)
      if (res.ok && res.catalog) {
        get().applyCatalog(res.catalog)
      }
      return { ok: res.ok, error: res.error }
    } catch {
      // Fallback nếu tiến trình Electron Main chưa khởi động lại để nhận IPC mới
      if (moduleId !== 'coordinator') {
        const prevMod = get().modules[moduleId]
        const nextMod: ManifestModuleData = {
          ...prevMod,
          rawJson,
          categories: Array.isArray(parsedObj?.categories) ? parsedObj.categories : prevMod.categories,
          templateCategories: Array.isArray(parsedObj?.templateCategories)
            ? parsedObj.templateCategories
            : prevMod.templateCategories,
          sidebarAssetTopics: Array.isArray(parsedObj?.sidebarAssetTopics)
            ? parsedObj.sidebarAssetTopics
            : prevMod.sidebarAssetTopics,
          assets: parsedObj?.assets && typeof parsedObj.assets === 'object' ? parsedObj.assets : prevMod.assets
        }
        set((s) => ({
          revision: s.revision + 1,
          modules: { ...s.modules, [moduleId]: nextMod },
          ...(moduleId === 'builtin' ? { categories: nextMod.categories } : {})
        }))
        notifyLegacyListeners()
        return { ok: true }
      }
      return { ok: false, error: 'Không thể lưu manifest' }
    }
  },

  upsertCategory: async (moduleId, cat) => {
    const mod = get().modules[moduleId]
    if (!mod) return { ok: false, error: `Không tìm thấy phân hệ ${moduleId}` }
    let parsed: any = {}
    try {
      parsed = JSON.parse(mod.rawJson)
    } catch {
      parsed = { moduleId, title: mod.title, categories: [...mod.categories], assets: { ...mod.assets } }
    }
    const list: BuiltInAssetCategory[] = Array.isArray(parsed.categories) ? [...parsed.categories] : []
    const idx = list.findIndex((c) => c.id === cat.id)
    if (idx >= 0) list[idx] = { ...list[idx], ...cat }
    else list.push({ ...cat, status: cat.status || 'active' })
    parsed.categories = list
    return get().saveModuleJson(moduleId, JSON.stringify(parsed, null, 2))
  },

  deleteCategory: async (moduleId, categoryId, softHide = false) => {
    if (categoryId === 'all') {
      return { ok: false, error: 'Không thể xoá danh mục gốc "all"' }
    }
    const mod = get().modules[moduleId]
    if (!mod) return { ok: false, error: `Không tìm thấy phân hệ ${moduleId}` }
    let parsed: any = {}
    try {
      parsed = JSON.parse(mod.rawJson)
    } catch {
      parsed = { moduleId, title: mod.title, categories: [...mod.categories], assets: { ...mod.assets } }
    }
    const list: BuiltInAssetCategory[] = Array.isArray(parsed.categories) ? [...parsed.categories] : []
    if (softHide) {
      parsed.categories = list.map((c) => (c.id === categoryId ? { ...c, status: 'deleted' } : c))
    } else {
      parsed.categories = list.filter((c) => c.id !== categoryId)
    }
    return get().saveModuleJson(moduleId, JSON.stringify(parsed, null, 2))
  },

  upsertAssetMeta: async (moduleId, relPath, meta) => {
    const mod = get().modules[moduleId]
    if (!mod) return { ok: false, error: `Không tìm thấy phân hệ ${moduleId}` }
    let parsed: any = {}
    try {
      parsed = JSON.parse(mod.rawJson)
    } catch {
      parsed = { moduleId, title: mod.title, categories: [...mod.categories], assets: { ...mod.assets } }
    }
    parsed.assets = parsed.assets && typeof parsed.assets === 'object' ? { ...parsed.assets } : {}
    const prev =
      typeof parsed.assets[relPath] === 'string'
        ? { name: parsed.assets[relPath] }
        : parsed.assets[relPath] || {}
    parsed.assets[relPath] = {
      ...prev,
      ...meta,
      status: meta.status || prev.status || 'active'
    }
    return get().saveModuleJson(moduleId, JSON.stringify(parsed, null, 2))
  },

  softDeleteAsset: async (relPath, permanent = false, snapshotOpts) => {
    if (typeof window === 'undefined' || !window.api?.deleteBuiltInAsset) {
      return { ok: false, error: 'Không tìm thấy IPC deleteBuiltInAsset' }
    }
    let targetRel = relPath.replace(/\\/g, '/').replace(/^builtin:/, '').replace(/^assets\//, '').trim()

    // Đảm bảo luôn có tệp vật lý trong assets/_temp_deleted/ kể cả với tài nguyên procedural / localStorage / in-memory
    if (!permanent && (snapshotOpts?.previewDataUrl || snapshotOpts?.binaryBuffer) && window.api?.importBuiltInAssetFile) {
      const probePath = targetRel.match(/^loop_animations\/[^/]+$/)
        ? `${targetRel}/thumbnail.png`
        : targetRel
      let existsOnDisk = false
      if (window.api.loadBuiltInAssetBytes) {
        try {
          const check = await window.api.loadBuiltInAssetBytes(probePath)
          existsOnDisk = Boolean(check && check.data && check.data.length > 0)
        } catch {
          existsOnDisk = false
        }
      }
      if (!existsOnDisk) {
        const buf = snapshotOpts.binaryBuffer || dataUrlToUint8Array(snapshotOpts.previewDataUrl)
        if (buf && buf.length > 0) {
          const parts = targetRel.split('/').filter(Boolean)
          const defaultFolder = parts.length > 1 ? parts[0] : 'uploads'
          const rawFile = snapshotOpts.fileName || parts[parts.length - 1] || 'deleted_item.png'
          const safeFile = /\.[a-z0-9]+$/i.test(rawFile) ? rawFile : `${rawFile}.png`
          try {
            const imported = await window.api.importBuiltInAssetFile({
              name: safeFile,
              buffer: buf,
              folder: snapshotOpts.folder || defaultFolder,
              title: snapshotOpts.name
            })
            if (imported?.ok && imported.relPath) {
              targetRel = imported.relPath
            }
          } catch {
            /* ignore fallback import error */
          }
        }
      }
    }

    const res = await window.api.deleteBuiltInAsset(targetRel, {
      permanent,
      snapshotJson: snapshotOpts?.jsonContent,
      snapshotName: snapshotOpts?.name,
      snapshotCategory: snapshotOpts?.category,
      snapshotPreviewDataUrl: snapshotOpts?.previewDataUrl
    })
    if (res.ok) {
      if (res.catalog) get().applyCatalog(res.catalog)
      else await get().refreshCatalog(true)
    }
    return res
  },

  restoreAsset: async (relPath) => {
    if (typeof window === 'undefined' || !window.api?.restoreBuiltInAsset) {
      return { ok: false, error: 'Không tìm thấy IPC restoreBuiltInAsset' }
    }
    const res = await window.api.restoreBuiltInAsset(relPath)
    if (res.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('parallax:asset-restored', { detail: { relPath: res.relPath || relPath } }))
      }
      if (res.catalog) get().applyCatalog(res.catalog)
      else await get().refreshCatalog(true)
    }
    return { ok: res.ok, error: res.error }
  },

  pruneManifests: async (opts) => {
    if (typeof window === 'undefined' || !window.api?.pruneBuiltInManifest) {
      return { ok: false, error: 'Không tìm thấy IPC pruneBuiltInManifest' }
    }
    const res = await window.api.pruneBuiltInManifest(opts)
    if (res.ok && res.catalog) {
      get().applyCatalog(res.catalog)
    }
    return { ok: res.ok, report: res.report, error: res.error }
  }
}))

let listenerBound = false

export function initAssetManifestLiveSync(): void {
  if (listenerBound || typeof window === 'undefined') return
  listenerBound = true
  void useAssetManifestStore.getState().refreshCatalog(false)
  if (window.api?.onBuiltInCatalogUpdated) {
    window.api.onBuiltInCatalogUpdated((catalog) => {
      useAssetManifestStore.getState().applyCatalog(catalog)
    })
  }
}

export function getActiveCategoriesForModule(
  modules: Record<ManifestModuleId, ManifestModuleData>,
  moduleId: ManifestModuleId
): BuiltInAssetCategory[] {
  const mod = modules[moduleId]
  const raw = mod?.categories?.length ? mod.categories : FALLBACK_MODULE_CATEGORIES[moduleId]
  return raw.filter((c) => c.status !== 'deleted' && c.status !== 'hidden')
}
