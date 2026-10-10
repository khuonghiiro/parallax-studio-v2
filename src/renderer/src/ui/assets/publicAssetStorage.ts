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

/** Ẩn hoặc xoá tài nguyên khỏi kho công khai */
export function hideOrDeletePublicAsset(item: string | { id?: string; relativePath?: string; isCustom?: boolean }): void {
  const targetObj = typeof item === 'string' ? { id: item, relativePath: item } : item
  if (targetObj.isCustom || targetObj.id?.startsWith('custom-public-')) {
    const list = loadCustomPublicAssets()
    const next = list.filter((a) => a.id !== targetObj.id)
    saveCustomPublicAssets(next)
  } else {
    const hidden = loadHiddenPublicAssets()
    const keys = [targetObj.relativePath, targetObj.id].filter(Boolean) as string[]
    const next = Array.from(new Set([...hidden, ...keys]))
    saveHiddenPublicAssets(next)
  }
}

/** Lọc danh sách tài nguyên công khai hiển thị cho người dùng */
export function getVisiblePublicAssets(builtinList: BuiltInAssetItem[]): BuiltInAssetItem[] {
  const custom = loadCustomPublicAssets()
  const hiddenSet = new Set(loadHiddenPublicAssets())
  const filteredBuiltin = (builtinList || []).filter(
    (b) => !hiddenSet.has(b.relativePath) && !hiddenSet.has(b.id)
  )
  return [...custom, ...filteredBuiltin]
}
