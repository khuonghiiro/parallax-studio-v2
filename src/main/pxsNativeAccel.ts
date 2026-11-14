import { inflateRawSync } from 'zlib'
import { PXS_CORE_ACCEL_WASM_HEX } from '@shared/wasmBytes'
import {
  allocScratchViews,
  decodeWasmHexBytes,
  resolveSlotView,
  validatePxsWasmExports,
  type PxsWasmExports
} from '@shared/pxsWasmExports'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

let cachedWasmBytes: Uint8Array | null = null
let cachedNativeExports: PxsWasmExports | null = null

export function getNativeWasmBytes(): Uint8Array {
  if (!cachedWasmBytes) {
    cachedWasmBytes = decodeWasmHexBytes(PXS_CORE_ACCEL_WASM_HEX)
  }
  return cachedWasmBytes
}

interface NodeWasmGlobal {
  Module: new (bytes: Uint8Array) => object
  Instance: new (mod: object, imports: Record<string, unknown>) => { exports: unknown }
}

function getNativeExports(): PxsWasmExports {
  if (cachedNativeExports) return cachedNativeExports
  const wasm = (globalThis as unknown as { WebAssembly?: NodeWasmGlobal }).WebAssembly
  if (!wasm) throw new Error('Môi trường Node không hỗ trợ WebAssembly')
  const mod = new wasm.Module(getNativeWasmBytes())
  const inst = new wasm.Instance(mod, {})
  const validated = validatePxsWasmExports(inst.exports)
  if (!validated) {
    throw new Error('Không thể khởi tạo module Rust WASM trong Main Process')
  }
  cachedNativeExports = validated
  return validated
}

export function crc32Rust(data: Uint8Array): number {
  if (data.byteLength === 0) return 0
  const exp = getNativeExports()
  if (!exp.rust_crc32) throw new Error('Thiếu export rust_crc32')
  const slots = allocScratchViews(exp, {
    data: { kind: 'u8', length: data.byteLength }
  })
  slots.data.view.set(data)
  return exp.rust_crc32(slots.data.ptr, data.byteLength) >>> 0
}

export function sha256HexRust(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input
  const exp = getNativeExports()
  if (!exp.rust_sha256) throw new Error('Thiếu export rust_sha256')
  const slots = allocScratchViews(exp, {
    data: { kind: 'u8', length: bytes.byteLength },
    out: { kind: 'u8', length: 32 }
  })
  if (bytes.byteLength > 0) {
    slots.data.view.set(bytes)
  }
  const ok = exp.rust_sha256(bytes.byteLength > 0 ? slots.data.ptr : 0, bytes.byteLength, slots.out.ptr)
  if (!ok) throw new Error('rust_sha256 trả về lỗi')
  const out = resolveSlotView(exp, slots.out, 'u8', 32)
  let hex = ''
  for (let i = 0; i < 32; i++) {
    hex += out[i].toString(16).padStart(2, '0')
  }
  return hex
}

export function packPxsZipRust(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const exp = getNativeExports()
  if (!exp.rust_calc_pxs_store_zip_size || !exp.rust_pack_pxs_store_zip) {
    throw new Error('Thiếu export đóng gói .pxs ZIP trong WASM')
  }
  const count = entries.length
  const nameBytesList = entries.map((e) => textEncoder.encode(e.name))
  const totalNamesLen = nameBytesList.reduce((acc, b) => acc + b.byteLength, 0)
  const totalBlobLen = entries.reduce((acc, e) => acc + e.data.byteLength, 0)

  const sizeSlots = allocScratchViews(exp, {
    meta: { kind: 'u32', length: count * 4 }
  })
  let nameOff = 0
  let blobOff = 0
  for (let i = 0; i < count; i++) {
    const nlen = nameBytesList[i].byteLength
    const dlen = entries[i].data.byteLength
    const base = i * 4
    sizeSlots.meta.view[base] = nameOff
    sizeSlots.meta.view[base + 1] = nlen
    sizeSlots.meta.view[base + 2] = blobOff
    sizeSlots.meta.view[base + 3] = dlen
    nameOff += nlen
    blobOff += dlen
  }
  const outSize =
    exp.rust_calc_pxs_store_zip_size(count, count > 0 ? sizeSlots.meta.ptr : 0) >>> 0
  if (outSize === 0) throw new Error('Kích thước gói .pxs vượt giới hạn ZIP 32-bit')

  const slots = allocScratchViews(exp, {
    meta: { kind: 'u32', length: count * 4 },
    names: { kind: 'u8', length: totalNamesLen },
    blobs: { kind: 'u8', length: totalBlobLen },
    out: { kind: 'u8', length: outSize }
  })

  nameOff = 0
  blobOff = 0
  for (let i = 0; i < count; i++) {
    const nb = nameBytesList[i]
    const db = entries[i].data
    const base = i * 4
    slots.meta.view[base] = nameOff
    slots.meta.view[base + 1] = nb.byteLength
    slots.meta.view[base + 2] = blobOff
    slots.meta.view[base + 3] = db.byteLength
    if (nb.byteLength > 0) slots.names.view.set(nb, nameOff)
    if (db.byteLength > 0) slots.blobs.view.set(db, blobOff)
    nameOff += nb.byteLength
    blobOff += db.byteLength
  }

  const written =
    exp.rust_pack_pxs_store_zip(
      count,
      count > 0 ? slots.meta.ptr : 0,
      totalNamesLen > 0 ? slots.names.ptr : 0,
      totalNamesLen,
      totalBlobLen > 0 ? slots.blobs.ptr : 0,
      totalBlobLen,
      slots.out.ptr,
      outSize
    ) >>> 0
  if (written !== outSize) {
    throw new Error(`Đóng gói .pxs thất bại (written=${written}, expected=${outSize})`)
  }
  return new Uint8Array(resolveSlotView(exp, slots.out, 'u8', outSize))
}

export function unpackPxsZipRust(zipBytes: Uint8Array): Map<string, Uint8Array> {
  const exp = getNativeExports()
  if (!exp.rust_probe_pxs_zip || !exp.rust_read_pxs_zip_index) {
    throw new Error('Thiếu export giải nén .pxs ZIP trong WASM')
  }
  if (zipBytes.byteLength < 22) {
    throw new Error('Tệp .pxs không hợp lệ (quá nhỏ)')
  }

  const probeSlots = allocScratchViews(exp, {
    zip: { kind: 'u8', length: zipBytes.byteLength },
    pair: { kind: 'u32', length: 2 }
  })
  probeSlots.zip.view.set(zipBytes)
  const okProbe = exp.rust_probe_pxs_zip(
    probeSlots.zip.ptr,
    zipBytes.byteLength,
    probeSlots.pair.ptr
  )
  if (okProbe !== 1) {
    throw new Error(`Header ZIP .pxs không hợp lệ (mã ${okProbe})`)
  }

  const pair = resolveSlotView(exp, probeSlots.pair, 'u32', 2)
  const count = pair[0] >>> 0
  const namesLen = pair[1] >>> 0
  const files = new Map<string, Uint8Array>()
  if (count === 0) return files

  const readSlots = allocScratchViews(exp, {
    zip: { kind: 'u8', length: zipBytes.byteLength },
    meta: { kind: 'u32', length: count * 7 },
    names: { kind: 'u8', length: namesLen }
  })
  readSlots.zip.view.set(zipBytes)
  const readCount = exp.rust_read_pxs_zip_index(
    readSlots.zip.ptr,
    zipBytes.byteLength,
    readSlots.meta.ptr,
    count,
    namesLen > 0 ? readSlots.names.ptr : 0,
    namesLen
  )
  if (readCount < 0) {
    throw new Error(`Không thể đọc chỉ mục .pxs (mã lỗi ${readCount})`)
  }

  const meta = resolveSlotView(exp, readSlots.meta, 'u32', count * 7)
  const namesView = resolveSlotView(exp, readSlots.names, 'u8', namesLen)

  for (let i = 0; i < readCount; i++) {
    const b = i * 7
    const nameOff = meta[b] >>> 0
    const nameLen = meta[b + 1] >>> 0
    const dataOff = meta[b + 2] >>> 0
    const compSize = meta[b + 3] >>> 0
    const uncompSize = meta[b + 4] >>> 0
    const method = meta[b + 5] >>> 0
    const expectedCrc = meta[b + 6] >>> 0

    const name = textDecoder.decode(namesView.subarray(nameOff, nameOff + nameLen))
    const rawSlice = zipBytes.subarray(dataOff, dataOff + compSize)
    if (method === 0) {
      files.set(name, new Uint8Array(rawSlice))
    } else if (method === 8) {
      const inflated = new Uint8Array(inflateRawSync(rawSlice))
      if (inflated.byteLength !== uncompSize) {
        throw new Error(`Kích thước giải nén DEFLATE không khớp tại ${name}`)
      }
      if (crc32Rust(inflated) !== expectedCrc) {
        throw new Error(`Sai checksum CRC32 tại ${name}`)
      }
      files.set(name, inflated)
    } else {
      throw new Error(`Phương thức nén ZIP không được hỗ trợ (${method}) tại ${name}`)
    }
  }
  return files
}

export function rgbaToYuv420pRust(
  rgba: Uint8Array,
  width: number,
  height: number,
  flipY = true
): Uint8Array {
  const exp = getNativeExports()
  if (!exp.rust_rgba_to_yuv420p_ex) {
    throw new Error('Thiếu export rust_rgba_to_yuv420p_ex')
  }
  const rgbaLen = width * height * 4
  const yuvLen = Math.floor((width * height * 3) / 2)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: rgbaLen },
    yuv: { kind: 'u8', length: yuvLen }
  })
  slots.rgba.view.set(rgba.subarray(0, rgbaLen))
  const ok = exp.rust_rgba_to_yuv420p_ex(
    slots.rgba.ptr,
    rgbaLen,
    width,
    height,
    flipY ? 1 : 0,
    slots.yuv.ptr,
    yuvLen
  )
  if (!ok) throw new Error('rust_rgba_to_yuv420p_ex thất bại')
  return new Uint8Array(resolveSlotView(exp, slots.yuv, 'u8', yuvLen))
}
