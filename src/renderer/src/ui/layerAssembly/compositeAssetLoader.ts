import { nanoid } from 'nanoid'
import type { AssetMeta } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { assetStore } from '../../project/assets'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'
import { resolveAssetAlias } from '../../project/json/assetTable'

export interface ResolvedCompositeAsset {
  asset: AssetMeta
  /** true nếu asset chưa có trong dự án và cần được thêm vào `project.assets`. */
  isNew: boolean
}

async function loadBuiltInBytes(path: string): Promise<{ data: Uint8Array | Blob; mime: string } | null> {
  const api = typeof window !== 'undefined' ? window.api : undefined
  if (api?.loadBuiltInAssetBytes) {
    try {
      const file =
        (await api.loadBuiltInAssetBytes(path)) ||
        (await api.loadBuiltInAssetBytes(`assembly_3d/${path.replace(/^assembly_3d[\\/]/, '')}`))
      if (file?.data && file.data.length > 0) return { data: file.data, mime: file.mime || 'image/png' }
    } catch {
      /* thử nguồn tiếp theo */
    }
  }
  if (api?.asset3ds?.loadBytes) {
    try {
      const file = await api.asset3ds.loadBytes(path.replace(/^asset-3ds[\\/]/, ''))
      if (file?.data && file.data.length > 0) return { data: file.data, mime: file.mime || 'image/png' }
    } catch {
      /* thử nguồn tiếp theo */
    }
  }
  const resolved = await resolveFaceTexture(path)
  if (resolved?.url) {
    const blob = await (await fetch(resolved.url)).blob()
    return { data: blob, mime: blob.type || 'image/png' }
  }
  return null
}

async function loadItemBytes(item: AssembledLayerItem, resolvedPath: string | undefined): Promise<{ data: Uint8Array | Blob; mime: string } | null> {
  if (item.imageUrl && !resolvedPath) {
    const response = await fetch(item.imageUrl)
    if (!response.ok) throw new Error('Không tải được ảnh đã chỉnh sửa')
    const blob = await response.blob()
    return { data: blob, mime: blob.type || 'image/png' }
  }
  if (resolvedPath) {
    const bytes = await loadBuiltInBytes(resolvedPath)
    if (bytes) return bytes
  }
  if (item.imageUrl && /^(data:|blob:|http)/.test(item.imageUrl)) {
    const blob = await (await fetch(item.imageUrl)).blob()
    return { data: blob, mime: blob.type || 'image/png' }
  }
  return null
}

function findExisting(projectAssets: AssetMeta[], path: string | undefined): AssetMeta | undefined {
  if (!path) return undefined
  return projectAssets.find((a) => a.path?.endsWith(path) || a.assetPath === path || a.id === path) ?? assetStore.get(path)?.meta
}

/**
 * Giải tài nguyên ảnh của 1 layer trong mẫu lắp ráp thành AssetMeta của dự án: dùng lại asset đã có,
 * nếu chưa có thì nạp bytes (built-in / asset-3ds / texture / ảnh đã tẩy) và đăng ký vào assetStore.
 */
export async function resolveCompositeItemAsset(
  item: AssembledLayerItem,
  composite: Pick<LayerComposite, 'assets' | 'width' | 'height'>,
  projectAssets: AssetMeta[]
): Promise<ResolvedCompositeAsset> {
  const hasEditedImage = Boolean(item.imageUrl)
  const resolvedPath = hasEditedImage ? undefined : resolveAssetAlias(item.asset || item.assetPath, composite.assets)
  const existing = hasEditedImage ? undefined : findExisting(projectAssets, resolvedPath)
  if (existing) return { asset: existing, isNew: !projectAssets.some((a) => a.id === existing.id) }
  try {
    const bytes = await loadItemBytes(item, resolvedPath)
    if (bytes) {
      const fileName = (resolvedPath || item.assetPath || item.name || 'layer').split('/').pop() || 'layer.png'
      const added = await assetStore.add(fileName, bytes.mime, bytes.data, 'image')
      if (resolvedPath) {
        added.meta.assetPath = resolvedPath
        added.meta.path = resolvedPath
      }
      return { asset: added.meta, isNew: true }
    }
  } catch (err) {
    console.warn('[resolveCompositeItemAsset] Failed to load asset bytes for item:', item.name, err)
    if (hasEditedImage) throw err
  }
  const fallback: AssetMeta = {
    id: resolvedPath || item.assetPath || `asset-auto-${nanoid(6)}`,
    name: item.name,
    kind: 'image',
    mime: 'image/png',
    width: composite.width,
    height: composite.height
  }
  return { asset: fallback, isNew: false }
}
