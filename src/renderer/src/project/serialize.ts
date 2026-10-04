import JSZip from 'jszip'
import type { Project } from '@shared/types'
import { assetStore } from './assets'
import { migrateProject } from './factory'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac'
}

export function extForMime(mime: string): string {
  return EXT[mime] ?? 'bin'
}

/** Collect the ids of all assets that must be written into the project file. */
export function usedAssetIds(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const l of project.layers) if (l.type === 'image') ids.add(l.props.assetId)
  if (project.audio) ids.add(project.audio.assetId)
  for (const a of project.assets) ids.add(a.id) // keep everything listed in the project panel
  return ids
}

/** Pack project JSON + all asset binaries into a .pxs (zip) file. */
export async function serializeProject(project: Project): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(project, null, 2))
  const folder = zip.folder('assets')!
  for (const id of usedAssetIds(project)) {
    const a = assetStore.get(id)
    if (!a) continue
    folder.file(`${id}.${extForMime(a.meta.mime)}`, a.blob)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
}

/** Load a .pxs file, registering all assets in the asset store. */
export async function deserializeProject(data: Uint8Array): Promise<Project> {
  const zip = await JSZip.loadAsync(data)
  const json = await zip.file('project.json')?.async('string')
  if (!json) throw new Error('project.json missing — not a Parallax Studio project')
  const project = migrateProject(JSON.parse(json))

  assetStore.clear()
  await Promise.all(
    project.assets.map(async (meta) => {
      const file = zip.file(`assets/${meta.id}.${extForMime(meta.mime)}`)
      if (!file) return
      const blob = await file.async('blob')
      await assetStore.add(meta.name, meta.mime, new Blob([blob], { type: meta.mime }), meta.kind, { ...meta })
    })
  )
  return project
}
