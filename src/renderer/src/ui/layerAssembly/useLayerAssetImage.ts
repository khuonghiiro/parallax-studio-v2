import { useState, useEffect } from 'react'
import { assetStore } from '../../project/assets'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'

/**
 * Lấy URL ảnh độ phân giải cao gốc (Full Resolution) từ assetStore hoặc direct URL
 */
export function getLayerFullResUrl(assetPath?: string, directUrl?: string): string | null {
  // 1. Ưu tiên directUrl (ảnh do người dùng cọ tẩy, chỉnh sửa trực tiếp, data: hoặc blob:)
  if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
    return directUrl
  }
  // 2. Tiếp theo lấy từ assetStore nếu có assetPath
  if (assetPath) {
    const rt = assetStore.get(assetPath)
    if (rt?.url) return rt.url
    if (rt?.thumbUrl) return rt.thumbUrl
  }
  return directUrl || null
}

/**
 * Giải quyết URL ảnh cho layer bất đồng bộ (cho thumbnail generator hoặc headless operations)
 */
export async function resolveLayerImageUrlAsync(assetPath?: string, directUrl?: string): Promise<string | null> {
  const direct = getLayerFullResUrl(assetPath, directUrl)
  if (direct) return direct
  if (!assetPath) return null
  try {
    const res = await resolveFaceTexture(assetPath)
    return res?.url || null
  } catch {
    return null
  }
}

/**
 * Hook giải quyết đường dẫn ảnh cho layer trong Xưởng Lắp Ráp Layer:
 * Hỗ trợ tự động:
 * 1. direct data: hoặc blob: URL (ảnh cọ tẩy, chỉnh sửa riêng)
 * 2. assetId trong assetStore (Project Assets - ưu tiên full-res rt.url)
 * 3. built-in assets qua resolveFaceTexture (e.g. assembly_3d/..., demo_transparent/...)
 */
export function useLayerAssetImage(assetPath?: string, directUrl?: string): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    return getLayerFullResUrl(assetPath, directUrl)
  })

  useEffect(() => {
    // 1. Ưu tiên directUrl nếu có (ảnh cọ tẩy/chỉnh sửa)
    if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
      setResolvedUrl(directUrl)
      return
    }

    // 2. Nếu có assetPath trong assetStore -> lấy trực tiếp full-res URL
    if (assetPath) {
      const rt = assetStore.get(assetPath)
      if (rt?.url) {
        setResolvedUrl(rt.url)
        return
      }
      if (rt?.thumbUrl) {
        setResolvedUrl(rt.thumbUrl)
        return
      }
    }

    if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
      setResolvedUrl(directUrl)
      return
    }

    if (!assetPath) {
      setResolvedUrl(directUrl || null)
      return
    }

    // 2. Thử giải quyết qua textureResolver (built-in asset hoặc disk asset)
    let isCancelled = false
    resolveFaceTexture(assetPath)
      .then((res) => {
        if (!isCancelled && res?.url) {
          setResolvedUrl(res.url)
        }
      })
      .catch(() => {
        if (!isCancelled) setResolvedUrl(null)
      })

    return () => {
      isCancelled = true
    }
  }, [assetPath, directUrl])

  return resolvedUrl
}
