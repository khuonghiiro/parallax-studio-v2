import type { PxsAccelBackendInfo } from '@shared/ipc'
import {
  getPxsNapiAddon,
  queryPxsAccelBackendInfo,
  setForceWasmFallbackForTest,
  type NativeOpaqueBbox
} from './pxsNapiBinding'
import {
  crc32WasmFallback,
  getWasmFallbackBytes,
  packPxsZipWasmFallback,
  rgbaToYuv420pWasmFallback,
  sha256HexWasmFallback,
  unpackPxsZipWasmFallback
} from './pxsWasmFallback'

export { setForceWasmFallbackForTest, type NativeOpaqueBbox }

export function getPxsAccelBackendInfo(): PxsAccelBackendInfo {
  return queryPxsAccelBackendInfo()
}

export function isPxsNapiActive(): boolean {
  return getPxsNapiAddon() !== null
}

export function getNativeWasmBytes(): Uint8Array {
  return getWasmFallbackBytes()
}

export function crc32Rust(data: Uint8Array): number {
  if (data.byteLength === 0) return 0
  const addon = getPxsNapiAddon()
  if (addon) {
    return addon.napiCrc32(data) >>> 0
  }
  return crc32WasmFallback(data)
}

export function sha256HexRust(input: string | Uint8Array): string {
  const addon = getPxsNapiAddon()
  if (addon) {
    return typeof input === 'string' ? addon.napiSha256TextHex(input) : addon.napiSha256Hex(input)
  }
  return sha256HexWasmFallback(input)
}

export function packPxsZipRust(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const addon = getPxsNapiAddon()
  if (addon) {
    return addon.napiPackPxsZip(entries)
  }
  return packPxsZipWasmFallback(entries)
}

export async function packPxsZipAsyncRust(
  entries: Array<{ name: string; data: Uint8Array }>
): Promise<Uint8Array> {
  const addon = getPxsNapiAddon()
  if (addon) {
    return addon.napiPackPxsZipAsync(entries)
  }
  return packPxsZipWasmFallback(entries)
}

export function unpackPxsZipRust(zipBytes: Uint8Array): Map<string, Uint8Array> {
  const addon = getPxsNapiAddon()
  if (addon) {
    const items = addon.napiUnpackPxsZip(zipBytes)
    const files = new Map<string, Uint8Array>()
    for (let i = 0; i < items.length; i++) {
      files.set(items[i].name, items[i].data)
    }
    return files
  }
  return unpackPxsZipWasmFallback(zipBytes)
}

export function rgbaToYuv420pRust(
  rgba: Uint8Array,
  width: number,
  height: number,
  flipY = true
): Uint8Array {
  const addon = getPxsNapiAddon()
  if (addon) {
    return addon.napiRgbaToYuv420p(rgba, width, height, flipY)
  }
  return rgbaToYuv420pWasmFallback(rgba, width, height, flipY)
}

export async function rgbaToYuv420pAsyncRust(
  rgba: Uint8Array,
  width: number,
  height: number,
  flipY = true
): Promise<Uint8Array> {
  const addon = getPxsNapiAddon()
  if (addon) {
    return addon.napiRgbaToYuv420pAsync(rgba, width, height, flipY)
  }
  return rgbaToYuv420pWasmFallback(rgba, width, height, flipY)
}

export function hashFilesParallelNativeRust(
  paths: string[]
): Promise<Record<string, string>> | null {
  const addon = getPxsNapiAddon()
  if (!addon) return null
  return addon.napiHashFilesParallel(paths)
}

export function findOpaqueBboxRust(
  rgba: Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 0
): NativeOpaqueBbox | null {
  const addon = getPxsNapiAddon()
  if (!addon) return null
  return addon.napiFindOpaqueBbox(rgba, width, height, alphaThreshold)
}
