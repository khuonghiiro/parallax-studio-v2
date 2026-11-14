import { ipcMain } from 'electron'
import type { PxsZipEntry } from '@shared/ipc'
import { hashFilesParallel, packPxsArchive, unpackPxsArchive } from './pxsArchiveService'
import { sha256HexRust } from './pxsNativeAccel'

let registered = false

export function registerPxsAccelIpc(): void {
  if (registered) return
  registered = true

  ipcMain.handle('pxsAccel:sha256Hex', (_e, input: string | Uint8Array): string => {
    return sha256HexRust(input)
  })

  ipcMain.handle('pxsAccel:hashFiles', (_e, paths: string[]): Promise<Record<string, string>> => {
    return hashFilesParallel(paths)
  })

  ipcMain.handle('pxsAccel:packArchive', (_e, entries: PxsZipEntry[]): Uint8Array => {
    return packPxsArchive(entries)
  })

  ipcMain.handle('pxsAccel:unpackArchive', (_e, zipBytes: Uint8Array): PxsZipEntry[] => {
    return unpackPxsArchive(zipBytes)
  })
}
