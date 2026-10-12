import type { Project } from '@shared/types'
import { assetStore } from '../assets'
import { uint8ArrayToBase64 } from './base64'

function getAssetsRelativePath(a: { path?: string; assetPath?: string }): string | undefined {
  if (a.assetPath) return a.assetPath.replace(/\\/g, '/').replace(/^assets\//, '')
  if (a.path) {
    const norm = a.path.replace(/\\/g, '/')
    const idx = norm.toLowerCase().lastIndexOf('/assets/')
    if (idx >= 0) return norm.slice(idx + '/assets/'.length)
    if (norm.toLowerCase().startsWith('assets/')) return norm.slice('assets/'.length)
  }
  return undefined
}

/**
 * Exports a full Parallax Studio project to JSON.
 * Assets inside the `assets/` directory use relative paths instead of bulky base64 data URLs.
 * External assets continue to use portable base64 data URLs.
 */
export async function exportProjectToJson(project: Project, pretty = true): Promise<string> {
  const assetsWithData = await Promise.all(
    project.assets.map(async (a) => {
      const rel = getAssetsRelativePath(a)
      if (rel) {
        return {
          ...a,
          path: `assets/${rel}`,
          assetPath: rel
        }
      }

      const bytes = await assetStore.getBytes(a.id)
      const dataUrl = bytes ? `data:${a.mime};base64,${uint8ArrayToBase64(bytes)}` : undefined
      return { ...a, ...(dataUrl ? { dataUrl } : {}) }
    })
  )

  const serializable = {
    ...project,
    assets: assetsWithData
  }

  return JSON.stringify(serializable, null, pretty ? 2 : undefined)
}

/**
 * Exports a single shot and its associated layers to JSON.
 */
export async function exportShotToJson(project: Project, shotId: string, pretty = true): Promise<string> {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot with ID "${shotId}" not found`)

  const layers = project.layers.filter((l) => l.shotId === shotId)
  const usedAssetIds = new Set<string>()
  for (const l of layers) {
    if (l.type === 'image') usedAssetIds.add(l.props.assetId)
  }

  const assetsWithData = await Promise.all(
    project.assets
      .filter((a) => usedAssetIds.has(a.id))
      .map(async (a) => {
        const rel = getAssetsRelativePath(a)
        if (rel) {
          return {
            ...a,
            path: `assets/${rel}`,
            assetPath: rel
          }
        }

        const bytes = await assetStore.getBytes(a.id)
        const dataUrl = bytes ? `data:${a.mime};base64,${uint8ArrayToBase64(bytes)}` : undefined
        return { ...a, ...(dataUrl ? { dataUrl } : {}) }
      })
  )

  const payload = {
    type: 'parallax-shot',
    version: 2,
    shot,
    layers,
    assets: assetsWithData
  }

  return JSON.stringify(payload, null, pretty ? 2 : undefined)
}

/**
 * Xuất dự án ra định dạng Declarative Project JSON siêu gọn gàng (human & AI friendly):
 * - Tạo bảng `assets` alias ở đầu file.
 * - Các shot và layer tham chiếu tài nguyên qua nhãn `asset: "@alias"`.
 * - Dung lượng siêu nhẹ, AI đọc và chỉnh sửa cực nhanh không lo phình dung lượng.
 */
export async function exportProjectToDeclarativeJson(project: Project, pretty = true): Promise<string> {
  const assetTable: Record<string, string> = {}
  const idToAlias = new Map<string, string>()

  // 1. Xây dựng AssetTable từ project.assets
  for (const a of project.assets) {
    const rel = getAssetsRelativePath(a)
    let alias = (a.name || 'asset')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    let uniqueAlias = alias || 'asset'
    let counter = 1
    while (uniqueAlias in assetTable) {
      uniqueAlias = `${alias}_${counter++}`
    }

    if (rel) {
      assetTable[uniqueAlias] = rel
    } else {
      const bytes = await assetStore.getBytes(a.id)
      if (bytes) {
        assetTable[uniqueAlias] = `data:${a.mime};base64,${uint8ArrayToBase64(bytes)}`
      } else {
        assetTable[uniqueAlias] = a.name
      }
    }
    idToAlias.set(a.id, uniqueAlias)
  }

  // 2. Chuyển đổi shots và layers sang Declarative format
  const shots = project.shots.map((sh) => {
    const shotLayers = project.layers.filter((l) => l.shotId === sh.id)
    return {
      name: sh.name,
      position: sh.position?.value ?? [0, 0, 0],
      layers: shotLayers.map((l) => {
        const item: any = {
          name: l.name,
          type: l.type,
          visible: l.visible,
          opacity: l.transform.opacity.value,
          position: l.transform.position.value,
          rotation: l.transform.rotation.value,
          scale: l.transform.scale.value
        }
        if (l.type === 'image' && l.props.assetId) {
          const alias = idToAlias.get(l.props.assetId)
          if (alias) item.asset = `@${alias}`
        }
        if (l.type === 'text') {
          item.text = l.props.text
          item.fontSize = l.props.fontSize
          item.color = l.props.color
        }
        if (l.blendMode && l.blendMode !== 'normal') item.blendMode = l.blendMode
        if (l.motion && l.motion.type !== 'none') item.motion = l.motion
        return item
      })
    }
  })

  const spec = {
    version: 2,
    name: project.comp.name,
    comp: {
      width: project.comp.width,
      height: project.comp.height,
      fps: project.comp.fps,
      duration: project.comp.duration,
      background: project.comp.background
    },
    look: project.look,
    assets: assetTable,
    shots
  }

  return JSON.stringify(spec, null, pretty ? 2 : undefined)
}

