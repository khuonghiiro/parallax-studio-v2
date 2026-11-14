import { createHash } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterAll, describe, expect, it } from 'vitest'
import { hashSource } from './aiCodeHandoffFiles'
import { disposeHashWorkerPool, hashFilesParallel } from './pxsArchiveService'
import {
  crc32Rust,
  packPxsZipRust,
  rgbaToYuv420pRust,
  sha256HexRust,
  unpackPxsZipRust
} from './pxsNativeAccel'

function nodeSha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex')
}

afterAll(async () => {
  await disposeHashWorkerPool()
})

describe('Stage 4A Rust Native Accel (SHA-256, CRC32, .pxs ZIP & Worker Pool)', () => {
  it('computes SHA-256 matching Node crypto for empty, UTF-8 Vietnamese, and >100KB binary', () => {
    expect(sha256HexRust('')).toBe(nodeSha256(''))
    const vi = 'Parallax Studio V2 — Cảnh ba chiều ánh sáng tiếng Việt có dấu 🚀'
    expect(sha256HexRust(vi)).toBe(nodeSha256(vi))
    expect(hashSource(vi)).toBe(nodeSha256(vi))

    const large = new Uint8Array(128 * 1024 + 17)
    for (let i = 0; i < large.length; i++) {
      large[i] = (i * 31 + 7) & 0xff
    }
    expect(sha256HexRust(large)).toBe(nodeSha256(large))
  })

  it('computes IEEE CRC32 and round-trips .pxs STORE and JSZip DEFLATE archives', async () => {
    const checkBytes = new TextEncoder().encode('123456789')
    expect(crc32Rust(checkBytes)).toBe(0xcbf43926)

    const entries = [
      {
        name: 'project.json',
        data: new TextEncoder().encode(JSON.stringify({ name: 'Dự án thử nghiệm' }))
      },
      {
        name: 'assets/sprite-1.png',
        data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5])
      },
      {
        name: 'assets/empty.bin',
        data: new Uint8Array(0)
      }
    ]
    const packed = packPxsZipRust(entries)
    const unpacked = unpackPxsZipRust(packed)
    expect(Array.from(unpacked.keys())).toEqual(['project.json', 'assets/sprite-1.png', 'assets/empty.bin'])
    expect(Array.from(unpacked.get('project.json')!)).toEqual(Array.from(entries[0].data))
    expect(Array.from(unpacked.get('assets/sprite-1.png')!)).toEqual(Array.from(entries[1].data))
    expect(unpacked.get('assets/empty.bin')!.byteLength).toBe(0)

    // Corrupting a payload byte inside STORE ZIP must fail CRC32 check
    const corrupted = new Uint8Array(packed)
    const jsonOffset = 30 + 'project.json'.length
    corrupted[jsonOffset] ^= 0x01
    expect(() => unpackPxsZipRust(corrupted)).toThrow(/mã lỗi -4/)

    // Unpack JSZip archive created with DEFLATE compression (legacy .pxs compatibility)
    const jszip = new JSZip()
    jszip.file('project.json', entries[0].data)
    jszip.file('assets/sprite-1.png', new Uint8Array(2048).fill(42))
    const deflated = await jszip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    const unpackedDeflate = unpackPxsZipRust(deflated)
    expect(Array.from(unpackedDeflate.get('project.json')!)).toEqual(Array.from(entries[0].data))
    expect(unpackedDeflate.get('assets/sprite-1.png')!.length).toBe(2048)
    expect(unpackedDeflate.get('assets/sprite-1.png')![2047]).toBe(42)
  })

  it('hashes 6 temp files via worker_threads pool matching crypto.createHash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-hash-pool-'))
    try {
      const files: string[] = []
      const expected: Record<string, string> = {}
      for (let i = 0; i < 6; i++) {
        const p = join(dir, `sample-${i}.bin`)
        const buf = new Uint8Array(1024 * (i + 1))
        for (let j = 0; j < buf.length; j++) buf[j] = (i * 19 + j * 13) & 0xff
        writeFileSync(p, buf)
        files.push(p)
        expected[p] = nodeSha256(buf)
      }
      const actual = await hashFilesParallel(files)
      expect(actual).toEqual(expected)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('packs RGBA into planar YUV420p from Main native bridge', () => {
    const w = 4
    const h = 4
    const rgba = new Uint8Array(w * h * 4).fill(255)
    const yuv = rgbaToYuv420pRust(rgba, w, h, true)
    expect(yuv.byteLength).toBe((w * h * 3) / 2)
  })
})
