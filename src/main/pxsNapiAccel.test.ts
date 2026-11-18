import { createHash } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { disposeHashWorkerPool, hashFilesParallel } from './pxsArchiveService'
import {
  crc32Rust,
  findOpaqueBboxRust,
  getPxsAccelBackendInfo,
  isPxsNapiActive,
  packPxsZipAsyncRust,
  packPxsZipRust,
  rgbaToYuv420pAsyncRust,
  rgbaToYuv420pRust,
  setForceWasmFallbackForTest,
  sha256HexRust,
  unpackPxsZipRust
} from './pxsNativeAccel'

afterEach(async () => {
  setForceWasmFallbackForTest(false)
  await disposeHashWorkerPool()
})

describe('NAPI-RS 64-bit Native Rust Accel (Electron Main + Rayon)', () => {
  it('loads the compiled .node NAPI-RS addon with multi-threaded Rayon pool', () => {
    expect(isPxsNapiActive()).toBe(true)
    const info = getPxsAccelBackendInfo()
    expect(info.backend).toBe('napi-rs')
    expect(info.rayonThreads).toBeGreaterThanOrEqual(1)
    expect(info.addonPath).toBeTruthy()
  })

  it('matches WASM fallback bit-for-bit on SHA-256, CRC32, and .pxs STORE/DEFLATE archives', async () => {
    const sampleVi = 'Parallax Studio V2 — Tăng tốc Rust Native 64-bit NAPI-RS đa nhân'
    const bin = new Uint8Array(64 * 1024 + 29)
    for (let i = 0; i < bin.length; i++) bin[i] = (i * 41 + 13) & 0xff

    const napiShaText = sha256HexRust(sampleVi)
    const napiShaBin = sha256HexRust(bin)
    const napiCrc = crc32Rust(bin)

    const entries = [
      { name: 'project.json', data: new TextEncoder().encode(JSON.stringify({ title: sampleVi })) },
      { name: 'assets/layer-01.bin', data: bin },
      { name: 'assets/empty.bin', data: new Uint8Array(0) }
    ]
    const napiZipSync = packPxsZipRust(entries)
    const napiZipAsync = await packPxsZipAsyncRust(entries)
    expect(Buffer.from(napiZipAsync).equals(Buffer.from(napiZipSync))).toBe(true)

    setForceWasmFallbackForTest(true)
    expect(getPxsAccelBackendInfo().backend).toBe('wasm-fallback')
    expect(sha256HexRust(sampleVi)).toBe(napiShaText)
    expect(sha256HexRust(bin)).toBe(napiShaBin)
    expect(crc32Rust(bin)).toBe(napiCrc)

    const wasmZip = packPxsZipRust(entries)
    expect(Buffer.from(napiZipSync).equals(Buffer.from(wasmZip))).toBe(true)

    // Chuyển lại NAPI-RS để giải nén gói DEFLATE (flate2 song song trên Rayon)
    setForceWasmFallbackForTest(false)
    const jszip = new JSZip()
    jszip.file('project.json', entries[0].data)
    jszip.file('assets/layer-01.bin', bin)
    const deflated = await jszip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    const unpacked = unpackPxsZipRust(deflated)
    expect(Buffer.from(unpacked.get('assets/layer-01.bin')!).equals(Buffer.from(bin))).toBe(true)
  })

  it('converts multi-band HD frames (RGBA -> YUV420p) identically between Rayon sync/async and WASM', async () => {
    const width = 320
    const height = 180
    const rgba = new Uint8Array(width * height * 4)
    for (let i = 0; i < rgba.length; i++) {
      rgba[i] = (i * 53 + (i >> 5) * 17 + 9) & 0xff
    }

    for (const flipY of [true, false]) {
      setForceWasmFallbackForTest(false)
      const napiSync = rgbaToYuv420pRust(rgba, width, height, flipY)
      const napiAsync = await rgbaToYuv420pAsyncRust(rgba, width, height, flipY)

      setForceWasmFallbackForTest(true)
      const wasmRef = rgbaToYuv420pRust(rgba, width, height, flipY)

      expect(Buffer.from(napiSync).equals(Buffer.from(wasmRef))).toBe(true)
      expect(Buffer.from(napiAsync).equals(Buffer.from(wasmRef))).toBe(true)
    }
  })

  it('hashes batch files via NAPI-RS AsyncTask + Rayon and computes native opaque BBox', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-napi-rayon-'))
    try {
      const paths: string[] = []
      const expected: Record<string, string> = {}
      for (let i = 0; i < 8; i++) {
        const p = join(dir, `asset-${i}.bin`)
        const buf = new Uint8Array(4096 * (i + 1) + 7)
        for (let k = 0; k < buf.length; k++) buf[k] = (i * 29 + k * 7) & 0xff
        writeFileSync(p, buf)
        paths.push(p)
        expected[p] = createHash('sha256').update(buf).digest('hex')
      }
      const actual = await hashFilesParallel(paths)
      expect(actual).toEqual(expected)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }

    const w = 16
    const h = 12
    const canvas = new Uint8Array(w * h * 4)
    canvas[(2 * w + 3) * 4 + 3] = 200
    canvas[(9 * w + 11) * 4 + 3] = 255
    const bbox = findOpaqueBboxRust(canvas, w, h, 10)
    expect(bbox).toEqual({ minX: 3, minY: 2, maxX: 11, maxY: 9, found: true })
  })
})
