import * as THREE from 'three'

export interface ResolvedTexture {
  texture: THREE.Texture
  image?: HTMLImageElement
  width: number
  height: number
}

const textureCache = new Map<string, Promise<ResolvedTexture | null>>()
const createdBlobUrls = new Set<string>()

export function resolveFaceTexture(assetPath: string): Promise<ResolvedTexture | null> {
  const cleanKey = assetPath.trim()
  if (!cleanKey) return Promise.resolve(null)

  const cached = textureCache.get(cleanKey)
  if (cached) return cached

  const promise = (async (): Promise<ResolvedTexture | null> => {
    try {
      // 1. Data URL or Blob URL directly
      if (cleanKey.startsWith('data:') || cleanKey.startsWith('blob:')) {
        return new Promise<ResolvedTexture | null>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const tex = new THREE.Texture(img)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.needsUpdate = true
            resolve({ texture: tex, image: img, width: img.naturalWidth, height: img.naturalHeight })
          }
          img.onerror = () => resolve(null)
          img.src = cleanKey
        })
      }

      // 2. Try loading raw bytes from main process
      let fileData: { name: string; mime: string; data: Uint8Array } | null = null

      // Check asset-3ds first if path mentions asset-3ds or tudor
      if (window.api?.asset3ds?.loadBytes && (cleanKey.includes('asset-3ds') || cleanKey.includes('tudor_cottage'))) {
        const clean = cleanKey.replace(/^asset-3ds[\\/]/, '')
        fileData = await window.api.asset3ds.loadBytes(clean)
      }

      // Check built-in assets
      if (!fileData && window.api?.loadBuiltInAssetBytes) {
        // Try exact path
        fileData = await window.api.loadBuiltInAssetBytes(cleanKey)
        // Try assembly_3d prefix
        if (!fileData && !cleanKey.startsWith('assembly_3d/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
        // Try assembly_3d/house prefix if starts with house/
        if (!fileData && cleanKey.startsWith('house/')) {
          fileData = await window.api.loadBuiltInAssetBytes(`assembly_3d/${cleanKey}`)
        }
      }

      // Fallback: check asset-3ds for any path
      if (!fileData && window.api?.asset3ds?.loadBytes) {
        fileData = await window.api.asset3ds.loadBytes(cleanKey)
      }

      if (fileData) {
        const blob = new Blob([fileData.data as BlobPart], { type: fileData.mime })
        const blobUrl = URL.createObjectURL(blob)
        createdBlobUrls.add(blobUrl)

        return new Promise<ResolvedTexture | null>((resolve) => {
          const img = new Image()
          img.onload = () => {
            const tex = new THREE.Texture(img)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.needsUpdate = true
            resolve({ texture: tex, image: img, width: img.naturalWidth, height: img.naturalHeight })
          }
          img.onerror = () => resolve(null)
          img.src = blobUrl
        })
      }
    } catch (err) {
      console.warn('[textureResolver] Error resolving face texture:', assetPath, err)
    }
    return null
  })()

  textureCache.set(cleanKey, promise)
  return promise
}

export function clearTextureCache(): void {
  for (const url of createdBlobUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
  createdBlobUrls.clear()
  textureCache.clear()
}
