import { useState, useEffect } from 'react'
import { assetStore } from '../../project/assets'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'

/**
 * Lấy URL ảnh độ phân giải cao gốc (Full Resolution) từ assetStore hoặc direct URL
 */
export function getLayerFullResUrl(assetPath?: string, directUrl?: string): string | null {
  if (assetPath) {
    const rt = assetStore.get(assetPath)
    if (rt?.url) return rt.url
    if (rt?.thumbUrl) return rt.thumbUrl
  }
  if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:') || directUrl.startsWith('http'))) {
    return directUrl
  }
  return directUrl || null
}

/**
 * Hook giải quyết đường dẫn ảnh cho layer trong Xưởng Lắp Ráp Layer:
 * Hỗ trợ tự động:
 * 1. direct data: hoặc blob: URL
 * 2. assetId trong assetStore (Project Assets - ưu tiên full-res rt.url)
 * 3. built-in assets qua resolveFaceTexture (e.g. assembly_3d/..., demo_transparent/...)
 */
export function useLayerAssetImage(assetPath?: string, directUrl?: string): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    return getLayerFullResUrl(assetPath, directUrl)
  })

  useEffect(() => {
    // 1. Nếu có assetPath trong assetStore -> Ưu tiên lấy trực tiếp full-res URL
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
