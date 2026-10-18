import { useEffect, useState } from 'react'
import type { PartAssetCandidate } from './workshopParts'
import { getVisiblePublicAssets } from '../assets/publicAssetStorage'

let cache: PartAssetCandidate[] | null = null
let pending: Promise<PartAssetCandidate[]> | null = null

async function loadCatalog(): Promise<PartAssetCandidate[]> {
  if (cache) return cache
  if (!pending) {
    pending = (async () => {
      try {
        const res = await window.api?.getBuiltInCatalog?.()
        const items = (res?.items ?? []).filter((it) => it.kind === 'image')
        const list = getVisiblePublicAssets(items).map((it) => ({
          path: it.relativePath || it.path || '',
          name: it.name || it.fileName || '',
          previewUrl: it.previewUrl
        }))
        cache = list.filter((c) => c.path)
        return cache
      } catch {
        return []
      } finally {
        pending = null
      }
    })()
  }
  return pending
}

/** Huỷ cache khi kho tài nguyên công khai thay đổi (thêm/xoá ảnh). */
export function invalidatePartAssetCatalog(): void {
  cache = null
}

/** Danh sách ảnh có sẵn (built-in + ảnh người dùng thêm) để thay thế bộ phận. */
export function usePartAssetCatalog(enabled = true): { items: PartAssetCandidate[]; reload: () => void } {
  const [items, setItems] = useState<PartAssetCandidate[]>(cache ?? [])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void loadCatalog().then((list) => active && setItems(list))
    const onChanged = () => {
      invalidatePartAssetCatalog()
      setVersion((v) => v + 1)
    }
    window.addEventListener('publicAssets:changed', onChanged)
    return () => {
      active = false
      window.removeEventListener('publicAssets:changed', onChanged)
    }
  }, [enabled, version])
  return {
    items,
    reload: () => {
      invalidatePartAssetCatalog()
      setVersion((v) => v + 1)
    }
  }
}
