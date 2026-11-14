import JSZip from 'jszip'
import type { Project } from '@shared/types'
import { wasmPackPxsZip, wasmUnpackPxsZip } from '../engine/wasm/wasmZipBridge'
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

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

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
  const entries: Array<{ name: string; data: Uint8Array }> = [
    { name: 'project.json', data: textEncoder.encode(JSON.stringify(project, null, 2)) }
  ]
  for (const id of usedAssetIds(project)) {
    const a = assetStore.get(id)
    if (!a) continue
    entries.push({
      name: `assets/${id}.${extForMime(a.meta.mime)}`,
      data: new Uint8Array(await a.blob.arrayBuffer())
    })
  }

  const wasmPacked = wasmPackPxsZip(entries)
  if (wasmPacked) return wasmPacked

  if (typeof window !== 'undefined' && typeof window.api?.pxsAccel?.packArchive === 'function') {
    try {
      return await window.api.pxsAccel.packArchive(entries)
    } catch {
      /* Fallback sang JSZip nếu Main chưa khởi động lại sau HMR */
    }
  }

  const zip = new JSZip()
  for (const entry of entries) {
    zip.file(entry.name, entry.data)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
}

async function unpackProjectZipEntries(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const wasmFiles = wasmUnpackPxsZip(data)
  if (wasmFiles) return wasmFiles

  if (typeof window !== 'undefined' && typeof window.api?.pxsAccel?.unpackArchive === 'function') {
    try {
      const ipcEntries = await window.api.pxsAccel.unpackArchive(data)
      return new Map(ipcEntries.map((entry) => [entry.name, entry.data]))
    } catch {
      /* Fallback sang JSZip nếu Main chưa khởi động lại hoặc file nén đặc biệt */
    }
  }

  const zip = await JSZip.loadAsync(data)
  const files = new Map<string, Uint8Array>()
  const names = Object.keys(zip.files)
  await Promise.all(
    names.map(async (name) => {
      const entry = zip.files[name]
      if (!entry || entry.dir) return
      files.set(name, await entry.async('uint8array'))
    })
  )
  return files
}

/** Load a .pxs file, registering all assets in the asset store. */
export async function deserializeProject(data: Uint8Array): Promise<Project> {
  const files = await unpackProjectZipEntries(data)
  const projectBytes = files.get('project.json')
  if (!projectBytes) throw new Error('project.json missing — not a Parallax Studio project')
  const project = migrateProject(JSON.parse(textDecoder.decode(projectBytes)))

  assetStore.clear()
  await Promise.all(
    project.assets.map(async (meta) => {
      const raw = files.get(`assets/${meta.id}.${extForMime(meta.mime)}`)
      if (!raw) return
      const blob = new Blob([raw as BlobPart], { type: meta.mime })
      await assetStore.add(meta.name, meta.mime, blob, meta.kind, { ...meta })
    })
  )
  return project
}
