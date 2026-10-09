import { useState, useEffect } from 'react'
import { assetStore } from '../../project/assets'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'

/**
 * Hook giải quyết đường dẫn ảnh cho layer trong Xưởng Lắp Ráp Layer:
 * Hỗ trợ tự động:
 * 1. direct data: hoặc blob: URL
 * 2. assetId trong assetStore (Project Assets)
 * 3. built-in assets qua resolveFaceTexture (e.g. assembly_3d/..., demo_transparent/...)
 */
export function useLayerAssetImage(assetPath?: string, directUrl?: string): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:'))) {
      return directUrl
    }
    if (assetPath) {
      const rt = assetStore.get(assetPath)
      if (rt?.thumbUrl || rt?.url) return rt.thumbUrl || rt.url
    }
    return directUrl || null
  })

  useEffect(() => {
    if (directUrl && (directUrl.startsWith('data:') || directUrl.startsWith('blob:'))) {
      setResolvedUrl(directUrl)
      return
    }

    if (!assetPath) {
      setResolvedUrl(directUrl || null)
      return
    }

    // 1. Kiểm tra assetStore theo ID
    const rt = assetStore.get(assetPath)
    if (rt?.thumbUrl || rt?.url) {
      setResolvedUrl(rt.thumbUrl || rt.url)
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
