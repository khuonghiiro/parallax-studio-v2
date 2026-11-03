import type { BuiltInAssetItem } from '@shared/ipc'
import { useAssetManifestStore } from '../../store/assetManifest'

export const CUSTOM_PUBLIC_ASSETS_KEY = 'pxs.customPublicAssets'
export const HIDDEN_PUBLIC_ASSETS_KEY = 'pxs.hiddenPublicAssets'

if (typeof window !== 'undefined') {
  window.addEventListener('parallax:asset-restored', ((e: Event) => {
    const detail = (e as CustomEvent<{ relPath?: string }>).detail
    if (detail?.relPath) {
      unhidePublicAsset(detail.relPath)
    }
  }) as EventListener)
}

export function loadCustomPublicAssets(): BuiltInAssetItem[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(CUSTOM_PUBLIC_ASSETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomPublicAssets(list: BuiltInAssetItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CUSTOM_PUBLIC_ASSETS_KEY, JSON.stringify(list))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('publicAssets:changed'))
    }
  } catch {
    /* ignore storage errors */
  }
}

export function loadHiddenPublicAssets(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(HIDDEN_PUBLIC_ASSETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveHiddenPublicAssets(list: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(HIDDEN_PUBLIC_ASSETS_KEY, JSON.stringify(list))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('publicAssets:changed'))
    }
  } catch {
    /* ignore storage errors */
  }
}

/** Thêm một ảnh mới vào kho tài nguyên Công khai (Public) dùng chung */
export function addCustomPublicAsset(
  name: string,
  dataUrl: string,
  size = 0,
  folder = ''
): BuiltInAssetItem {
  const ext = dataUrl.includes('image/gif')
    ? 'gif'
    : dataUrl.includes('image/webp')
      ? 'webp'
      : dataUrl.includes('image/jpeg')
        ? 'jpg'
        : 'png'

  const newItem: BuiltInAssetItem = {
    id: `custom-public-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.replace(/\.[^/.]+$/, ''),
    fileName: `${name}.${ext}`,
    relativePath: `custom/${name}.${ext}`,
    folder: folder || '',
    ext,
    mime: dataUrl.split(';')[0]?.replace('data:', '') || 'image/png',
    kind: 'image',
    size,
    path: `custom/${name}.${ext}`,
    previewUrl: dataUrl,
    isAnimated: ext === 'gif'
  }

  const list = loadCustomPublicAssets()
  const next = [newItem, ...list]
  saveCustomPublicAssets(next)
  return newItem
}

/** Chuẩn hóa key đường dẫn tài nguyên để đối chiếu */
function normalizeKey(str: string): string {
  return str.replace(/\\/g, '/').trim()
}

/** Tạo tập hợp các biến thể key tương đương của một đường dẫn hoặc id */
function expandKeyVariants(raw: string): string[] {
  if (!raw) return []
  const norm = normalizeKey(raw)
  const stripped = norm.replace(/^builtin:/, '').replace(/^assets\//, '')
  const fileName = stripped.includes('/') ? stripped.split('/').pop() || '' : stripped
  return Array.from(
    new Set([
      norm,
      stripped,
      `builtin:${stripped}`,
      `assets/${stripped}`,
      `builtin:assets/${stripped}`,
      fileName ? `file:${fileName}` : ''
    ])
  ).filter(Boolean)
}

/** Ẩn hoặc xoá tài nguyên khỏi kho công khai */
/** Khôi phục một tài nguyên khỏi danh sách ẩn (unhide) */
export function unhidePublicAsset(rawKey: string): void {
  if (!rawKey) return
  const hidden = loadHiddenPublicAssets()
  if (hidden.length === 0) return
  const variants = new Set(expandKeyVariants(rawKey))
  variants.add(rawKey)
  const next = hidden.filter((k) => !variants.has(k))
  if (next.length !== hidden.length) {
    saveHiddenPublicAssets(next)
  }
}

export type DeletableAssetTarget =
  | string
  | (Partial<BuiltInAssetItem> & {
      isCustom?: boolean
      assetPath?: string
    })

/** Ẩn hoặc xoá tài nguyên khỏi kho công khai (chuyển vào assets/_temp_deleted/ để khôi phục khi cần) */
export function hideOrDeletePublicAsset(item: DeletableAssetTarget): void {
  if (!item) return

  // 1. Nếu là chuỗi string
  if (typeof item === 'string') {
    const trimmed = item.trim()
    if (trimmed.startsWith('custom-public-')) {
      const list = loadCustomPublicAssets()
      const found = list.find((a) => a.id === trimmed)
      const next = list.filter((a) => a.id !== trimmed)
      saveCustomPublicAssets(next)
      if (found) {
        const rel = found.relativePath || `uploads/${found.fileName || `${found.id}.png`}`
        void useAssetManifestStore.getState().softDeleteAsset(rel, false, {
          name: found.name,
          folder: found.folder || 'uploads',
          previewDataUrl: found.previewUrl,
          fileName: found.fileName || `${found.id}.png`
        })
      }
      return
    }
    void useAssetManifestStore.getState().softDeleteAsset(trimmed, false)
    const hidden = loadHiddenPublicAssets()
    const variants = expandKeyVariants(trimmed)
    const next = Array.from(new Set([...hidden, ...variants]))
    saveHiddenPublicAssets(next)
    return
  }

  const obj = item as {
    id?: string
    name?: string
    relativePath?: string
    assetPath?: string
    path?: string
    fileName?: string
    folder?: string
    previewUrl?: string
    isCustom?: boolean
  }

  // 2. Nếu là Custom asset người dùng tự thêm
  if (obj.isCustom || obj.id?.startsWith('custom-public-')) {
    const list = loadCustomPublicAssets()
    const found = list.find((a) => a.id === obj.id)
    const next = list.filter((a) => a.id !== obj.id)
    saveCustomPublicAssets(next)
    const itemRef = found || obj
    const fName = itemRef.fileName || `${itemRef.id || Date.now()}.png`
    const rel = itemRef.relativePath || `uploads/${fName}`
    void useAssetManifestStore.getState().softDeleteAsset(rel, false, {
      name: itemRef.name || fName,
      folder: itemRef.folder || 'uploads',
      previewDataUrl: itemRef.previewUrl,
      fileName: fName
    })
    return
  }

  // 3. Nếu là Built-in asset có sẵn của hệ thống
  const targetRelPath = obj.relativePath || obj.assetPath || obj.path || obj.id || ''
  if (targetRelPath) {
    void useAssetManifestStore.getState().softDeleteAsset(targetRelPath, false, {
      name: obj.name || obj.fileName || targetRelPath,
      folder: obj.folder || 'uploads',
      previewDataUrl: obj.previewUrl,
      fileName: obj.fileName
    })
  }

  const hidden = loadHiddenPublicAssets()
  const rawCandidateKeys = [
    obj.id,
    obj.relativePath,
    obj.assetPath,
    obj.path,
    obj.fileName
  ].filter(Boolean) as string[]

  const allVariants = new Set<string>(hidden)
  rawCandidateKeys.forEach((key) => {
    expandKeyVariants(key).forEach((v) => allVariants.add(v))
  })

  saveHiddenPublicAssets(Array.from(allVariants))
}

/** Kiểm tra một tài nguyên có đang bị ẩn hay không */
export function isPublicAssetHidden(item: DeletableAssetTarget): boolean {
  const hiddenList = loadHiddenPublicAssets()
  if (!hiddenList || hiddenList.length === 0) return false
  const hiddenSet = new Set(hiddenList)

  if (typeof item === 'string') {
    return expandKeyVariants(item).some((v) => hiddenSet.has(v))
  }

  const obj = item as {
    id?: string
    relativePath?: string
    assetPath?: string
    path?: string
    fileName?: string
  }

  const rawCandidateKeys = [
    obj.id,
    obj.relativePath,
    obj.assetPath,
    obj.path,
    obj.fileName
  ].filter(Boolean) as string[]

  return rawCandidateKeys.some((k) => expandKeyVariants(k).some((v) => hiddenSet.has(v)))
}

const PRIVATE_MODULAR_PREFIXES = [
  'character_cutout_demo/',
  'character_human_',
  'animal_modular/',
  'nature_modular/',
  'assembly_3d/',
  'house/'
]

/** Kiểm tra xem tài nguyên có thuộc bộ phận lắp ráp riêng (private theo mẫu) hay không */
export function isPrivateModularAsset(rawPathOrId?: string): boolean {
  if (!rawPathOrId) return false
  const stripped = normalizeKey(rawPathOrId)
    .replace(/^builtin:/, '')
    .replace(/^assets\//, '')
  return PRIVATE_MODULAR_PREFIXES.some((prefix) => stripped.startsWith(prefix))
}

/** Lọc danh sách tài nguyên công khai hiển thị cho người dùng (ẩn các mảnh lắp ráp private của từng mẫu) */
export function getVisiblePublicAssets(builtinList: BuiltInAssetItem[]): BuiltInAssetItem[] {
  const custom = loadCustomPublicAssets()
  const hiddenList = loadHiddenPublicAssets()
  const hiddenSet = new Set(hiddenList || [])

  const filteredBuiltin = (builtinList || []).filter((b) => {
    const candidates = [b.id, b.relativePath, b.path, b.fileName].filter(Boolean) as string[]
    if (candidates.some((c) => isPrivateModularAsset(c))) return false
    if (hiddenSet.size === 0) return true
    const isHidden = candidates.some((k) => expandKeyVariants(k).some((v) => hiddenSet.has(v)))
    return !isHidden
  })

  return [...custom, ...filteredBuiltin]
}

