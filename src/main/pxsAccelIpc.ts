import { ipcMain } from 'electron'
import type { PxsAccelBackendInfo, PxsZipEntry } from '@shared/ipc'
import { hashFilesParallel, packPxsArchiveAsync, unpackPxsArchive } from './pxsArchiveService'
import { getPxsAccelBackendInfo, sha256HexRust } from './pxsNativeAccel'

let registered = false

export function registerPxsAccelIpc(): void {
  if (registered) return
  registered = true

  ipcMain.handle('pxsAccel:getBackendInfo', (): PxsAccelBackendInfo => {
    return getPxsAccelBackendInfo()
  })

  ipcMain.handle('pxsAccel:sha256Hex', (_e, input: string | Uint8Array): string => {
    return sha256HexRust(input)
  })

  ipcMain.handle('pxsAccel:hashFiles', (_e, paths: string[]): Promise<Record<string, string>> => {
    return hashFilesParallel(paths)
  })

  ipcMain.handle('pxsAccel:packArchive', (_e, entries: PxsZipEntry[]): Promise<Uint8Array> => {
    return packPxsArchiveAsync(entries)
  })

  ipcMain.handle('pxsAccel:unpackArchive', (_e, zipBytes: Uint8Array): PxsZipEntry[] => {
    return unpackPxsArchive(zipBytes)
  })
}
