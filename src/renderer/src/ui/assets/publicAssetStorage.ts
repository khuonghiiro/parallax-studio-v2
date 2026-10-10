import type { BuiltInAssetItem } from '@shared/ipc'

export const CUSTOM_PUBLIC_ASSETS_KEY = 'pxs.customPublicAssets'
export const HIDDEN_PUBLIC_ASSETS_KEY = 'pxs.hiddenPublicAssets'

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
export type DeletableAssetTarget =
  | string
  | (Partial<BuiltInAssetItem> & {
      isCustom?: boolean
      assetPath?: string
    })

/** Ẩn hoặc xoá tài nguyên khỏi kho công khai */
export function hideOrDeletePublicAsset(item: DeletableAssetTarget): void {
  if (!item) return

  // 1. Nếu là chuỗi string
  if (typeof item === 'string') {
    const trimmed = item.trim()
    if (trimmed.startsWith('custom-public-')) {
      const list = loadCustomPublicAssets()
      const next = list.filter((a) => a.id !== trimmed)
      saveCustomPublicAssets(next)
      return
    }
    if (typeof window !== 'undefined' && window.api?.deleteBuiltInAsset) {
      window.api.deleteBuiltInAsset(trimmed).catch((err) => {
        console.warn('[publicAssetStorage] Error deleting built-in asset string from disk:', err)
      })
    }
    const hidden = loadHiddenPublicAssets()
    const variants = expandKeyVariants(trimmed)
    const next = Array.from(new Set([...hidden, ...variants]))
    saveHiddenPublicAssets(next)
    return
  }

  const obj = item as {
    id?: string
    relativePath?: string
    assetPath?: string
    path?: string
    fileName?: string
    isCustom?: boolean
  }

  // 2. Nếu là Custom asset người dùng tự thêm
  if (obj.isCustom || obj.id?.startsWith('custom-public-')) {
    const list = loadCustomPublicAssets()
    const next = list.filter((a) => a.id !== obj.id)
    saveCustomPublicAssets(next)
    return
  }

  // 3. Nếu là Built-in asset có sẵn của hệ thống
  const targetRelPath = obj.relativePath || obj.assetPath || obj.path || obj.id || ''
  if (targetRelPath && typeof window !== 'undefined' && window.api?.deleteBuiltInAsset) {
    window.api.deleteBuiltInAsset(targetRelPath).catch((err) => {
      console.warn('[publicAssetStorage] Error deleting built-in asset from disk:', err)
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

/** Lọc danh sách tài nguyên công khai hiển thị cho người dùng */
export function getVisiblePublicAssets(builtinList: BuiltInAssetItem[]): BuiltInAssetItem[] {
  const custom = loadCustomPublicAssets()
  const hiddenList = loadHiddenPublicAssets()
  if (!hiddenList || hiddenList.length === 0) {
    return [...custom, ...(builtinList || [])]
  }

  const hiddenSet = new Set(hiddenList)

  const filteredBuiltin = (builtinList || []).filter((b) => {
    const candidates = [b.id, b.relativePath, b.path, b.fileName].filter(Boolean) as string[]
    const isHidden = candidates.some((k) => expandKeyVariants(k).some((v) => hiddenSet.has(v)))
    return !isHidden
  })

  return [...custom, ...filteredBuiltin]
}
