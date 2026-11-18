import './envConfig'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { createRequire } from 'module'
import { dirname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import type { PxsAccelBackendInfo } from '@shared/ipc'

export interface NativePxsZipEntry {
  name: string
  data: Uint8Array
}

export interface NativeOpaqueBbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  found: boolean
}

export interface PxsNapiAddon {
  napiGetBackendInfo(): {
    backend: string
    arch: string
    os: string
    rayonThreads: number
    simdLevel: string
  }
  napiCrc32(data: Uint8Array): number
  napiSha256Hex(data: Uint8Array): string
  napiSha256TextHex(text: string): string
  napiFindOpaqueBbox(
    rgba: Uint8Array,
    width: number,
    height: number,
    alphaThreshold: number
  ): NativeOpaqueBbox
  napiHashFilesSync(paths: string[]): Record<string, string>
  napiHashFilesParallel(paths: string[]): Promise<Record<string, string>>
  napiPackPxsZip(entries: NativePxsZipEntry[]): Uint8Array
  napiPackPxsZipAsync(entries: NativePxsZipEntry[]): Promise<Uint8Array>
  napiUnpackPxsZip(zipBytes: Uint8Array): NativePxsZipEntry[]
  napiRgbaToYuv420p(rgba: Uint8Array, width: number, height: number, flipY?: boolean): Uint8Array
  napiRgbaToYuv420pAsync(
    rgba: Uint8Array,
    width: number,
    height: number,
    flipY?: boolean
  ): Promise<Uint8Array>
}

let probed = false
let cachedAddon: PxsNapiAddon | null = null
let cachedAddonPath: string | null = null
let forceWasmFallback = false

function getNodeRequire(): NodeRequire {
  if (typeof import.meta?.url === 'string' && import.meta.url.startsWith('file:')) {
    return createRequire(import.meta.url)
  }
  return createRequire(pathToFileURL(join(process.cwd(), 'package.json')).href)
}

function getModuleDir(): string {
  if (typeof __dirname === 'string' && __dirname.length > 0) {
    return __dirname
  }
  if (typeof import.meta?.url === 'string' && import.meta.url.startsWith('file:')) {
    return dirname(fileURLToPath(import.meta.url))
  }
  return process.cwd()
}

function candidateNativeDirs(): string[] {
  const dirs = new Set<string>()
  dirs.add(resolve(process.cwd(), 'native'))
  const modDir = getModuleDir()
  dirs.add(resolve(modDir, '../../native'))
  dirs.add(resolve(modDir, '../native'))
  const procWithRes = process as NodeJS.Process & { resourcesPath?: string }
  if (procWithRes.resourcesPath) {
    dirs.add(resolve(procWithRes.resourcesPath, 'app.asar.unpacked', 'native'))
    dirs.add(resolve(procWithRes.resourcesPath, 'native'))
  }
  return Array.from(dirs)
}

function tryPromoteStagedAddon(addonPath: string): string {
  const staged = `${addonPath}.next`
  if (!existsSync(staged)) return addonPath
  try {
    copyFileSync(staged, addonPath)
    unlinkSync(staged)
    return addonPath
  } catch {
    return staged
  }
}

function validateAddonExports(raw: unknown): raw is PxsNapiAddon {
  if (!raw || typeof raw !== 'object') return false
  const m = raw as Partial<PxsNapiAddon>
  return (
    typeof m.napiGetBackendInfo === 'function' &&
    typeof m.napiCrc32 === 'function' &&
    typeof m.napiSha256Hex === 'function' &&
    typeof m.napiSha256TextHex === 'function' &&
    typeof m.napiHashFilesParallel === 'function' &&
    typeof m.napiPackPxsZip === 'function' &&
    typeof m.napiUnpackPxsZip === 'function' &&
    typeof m.napiRgbaToYuv420p === 'function' &&
    typeof m.napiRgbaToYuv420pAsync === 'function'
  )
}

export function getPxsNapiAddon(): PxsNapiAddon | null {
  if (forceWasmFallback || process.env.PXS_DISABLE_NAPI === '1') {
    return null
  }
  if (probed) return cachedAddon
  probed = true

  const fileName = `pxs_native_napi.${process.platform}-${process.arch}.node`
  const req = getNodeRequire()

  for (const dir of candidateNativeDirs()) {
    const baseAddonPath = join(dir, fileName)
    const loadPath = tryPromoteStagedAddon(baseAddonPath)
    if (!existsSync(loadPath)) continue
    try {
      const loaded: unknown = req(loadPath)
      if (validateAddonExports(loaded)) {
        cachedAddon = loaded
        cachedAddonPath = loadPath
        return cachedAddon
      }
    } catch {
      /* Thử ứng viên tiếp theo hoặc rơi về fallback WASM */
    }
  }
  return null
}

export function getPxsNapiAddonPath(): string | null {
  getPxsNapiAddon()
  return forceWasmFallback ? null : cachedAddonPath
}

/** Chỉ phục vụ kiểm thử đối chiếu bit-for-bit giữa NAPI-RS 64-bit và WASM fallback. */
export function setForceWasmFallbackForTest(force: boolean): void {
  forceWasmFallback = force
}

export function queryPxsAccelBackendInfo(): PxsAccelBackendInfo {
  const addon = getPxsNapiAddon()
  if (addon) {
    const info = addon.napiGetBackendInfo()
    return {
      backend: 'napi-rs',
      arch: info.arch,
      os: info.os,
      rayonThreads: info.rayonThreads,
      simdLevel: info.simdLevel,
      addonPath: cachedAddonPath
    }
  }
  return {
    backend: 'wasm-fallback',
    arch: process.arch,
    os: process.platform,
    rayonThreads: 1,
    simdLevel: 'wasm-simd128',
    addonPath: null
  }
}
