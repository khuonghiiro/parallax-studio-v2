import type { Project } from '@shared/types'
import { assetStore } from '../assets'
import { uint8ArrayToBase64 } from './base64'

/**
 * Exports a full Parallax Studio project to a 100% self-contained, portable JSON string.
 * All image and audio binaries in `assetStore` are encoded as base64 data URLs.
 */
export async function exportProjectToJson(project: Project, pretty = true): Promise<string> {
  const assetsWithData = await Promise.all(
    project.assets.map(async (a) => {
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
