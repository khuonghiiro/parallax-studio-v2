import { useState, useEffect } from 'react'
import { assetStore } from '../../project/assets'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'
import { resolveAssetAlias, type AssetTable } from '../../project/json/assetTable'

/**
 * Lấy URL ảnh độ phân giải cao gốc (Full Resolution) từ assetStore hoặc direct URL
 */
export function getLayerFullResUrl(assetPath?: string, directUrl?: string, assetTable?: AssetTable): string | null {
  // 1. Ưu tiên directUrl (ảnh do người dùng cọ tẩy, chỉnh sửa trực tiếp, data: hoặc blob:)
  if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
    return directUrl
  }

  const effectivePath = resolveAssetAlias(assetPath, assetTable)

  // 2. Tiếp theo lấy từ assetStore nếu có effectivePath
  if (effectivePath) {
    const rt = assetStore.get(effectivePath)
    if (rt?.url) return rt.url
    if (rt?.thumbUrl) return rt.thumbUrl

    // 3. Kiểm tra customPublicAssets nếu là ảnh người dùng thêm vào
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('pxs.customPublicAssets')
        if (raw) {
          const list = JSON.parse(raw)
          const match = list.find(
            (it: any) =>
              it?.path === effectivePath ||
              it?.relativePath === effectivePath ||
              it?.id === effectivePath ||
              it?.fileName === effectivePath ||
              effectivePath.endsWith(it?.fileName || '___')
          )
          if (match?.previewUrl && typeof match.previewUrl === 'string' && match.previewUrl.startsWith('data:')) {
            return match.previewUrl
          }
        }
      } catch {
        /* ignore storage errors */
      }
    }
  }
  return directUrl || null
}

/**
 * Giải quyết URL ảnh cho layer bất đồng bộ (cho thumbnail generator hoặc headless operations)
 */
export async function resolveLayerImageUrlAsync(assetPath?: string, directUrl?: string, assetTable?: AssetTable): Promise<string | null> {
  const direct = getLayerFullResUrl(assetPath, directUrl, assetTable)
  if (direct) return direct
  const effectivePath = resolveAssetAlias(assetPath, assetTable)
  if (!effectivePath) return null
  try {
    const res = await resolveFaceTexture(effectivePath, assetTable)
    return res?.url || null
  } catch {
    return null
  }
}

/**
 * Hook giải quyết đường dẫn ảnh cho layer trong Xưởng Lắp Ráp Layer:
 * Hỗ trợ tự động:
 * 1. direct data: hoặc blob: URL (ảnh cọ tẩy, chỉnh sửa riêng)
 * 2. alias trong assetTable của composite
 * 3. assetId trong assetStore (Project Assets - ưu tiên full-res rt.url)
 * 4. customPublicAssets từ localStorage
 * 5. built-in assets qua resolveFaceTexture (e.g. character_cutout_demo/..., assembly_3d/...)
 */
export function useLayerAssetImage(assetPath?: string, directUrl?: string, assetTable?: AssetTable): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    return getLayerFullResUrl(assetPath, directUrl, assetTable)
  })

  useEffect(() => {
    // 1. Ưu tiên directUrl nếu có (ảnh cọ tẩy/chỉnh sửa)
    if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
      setResolvedUrl(directUrl)
      return
    }

    const effectivePath = resolveAssetAlias(assetPath, assetTable)

    // 2. Nếu có effectivePath trong assetStore -> lấy trực tiếp full-res URL
    if (effectivePath) {
      const rt = assetStore.get(effectivePath)
      if (rt?.url) {
        setResolvedUrl(rt.url)
        return
      }
      if (rt?.thumbUrl) {
        setResolvedUrl(rt.thumbUrl)
        return
      }

      // 3. Kiểm tra customPublicAssets
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem('pxs.customPublicAssets')
          if (raw) {
            const list = JSON.parse(raw)
            const match = list.find(
              (it: any) =>
                it?.path === effectivePath ||
                it?.relativePath === effectivePath ||
                it?.id === effectivePath ||
                it?.fileName === effectivePath ||
                effectivePath.endsWith(it?.fileName || '___')
            )
            if (match?.previewUrl && typeof match.previewUrl === 'string' && match.previewUrl.startsWith('data:')) {
              setResolvedUrl(match.previewUrl)
              return
            }
          }
        } catch {
          /* ignore storage errors */
        }
      }

      // 4. Resolve qua built-in textures
      let active = true
      resolveFaceTexture(effectivePath, assetTable).then((res) => {
        if (active && res?.url) {
          setResolvedUrl(res.url)
        }
      })
      return () => {
        active = false
      }
    }

    setResolvedUrl(null)
  }, [assetPath, directUrl, assetTable])

  return resolvedUrl
}

