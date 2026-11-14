import { allocScratchViews, getWasmExports, resolveSlotView } from './wasmRuntime'

export interface WasmZipEntry {
  name: string
  data: Uint8Array
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function wasmPackPxsZip(entries: WasmZipEntry[]): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_calc_pxs_store_zip_size || !exp.rust_pack_pxs_store_zip) return null

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
  if (outSize === 0) return null

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
  if (written !== outSize) return null

  return new Uint8Array(resolveSlotView(exp, slots.out, 'u8', outSize))
}

/** Giải mã trực tiếp gói `.pxs` nén STORE trong WASM; trả `null` nếu có entry nén DEFLATE cần tầng Host/JSZip. */
export function wasmUnpackPxsZip(zipBytes: Uint8Array): Map<string, Uint8Array> | null {
  const exp = getWasmExports()
  if (!exp?.rust_probe_pxs_zip || !exp.rust_read_pxs_zip_index) return null
  if (zipBytes.byteLength < 22) return null

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
  if (okProbe !== 1) return null

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
  if (readCount < 0) return null

  const meta = resolveSlotView(exp, readSlots.meta, 'u32', count * 7)
  const namesView = resolveSlotView(exp, readSlots.names, 'u8', namesLen)

  for (let i = 0; i < readCount; i++) {
    const b = i * 7
    const nameOff = meta[b] >>> 0
    const nameLen = meta[b + 1] >>> 0
    const dataOff = meta[b + 2] >>> 0
    const compSize = meta[b + 3] >>> 0
    const method = meta[b + 5] >>> 0
    if (method !== 0) return null
    const name = textDecoder.decode(namesView.subarray(nameOff, nameOff + nameLen))
    files.set(name, new Uint8Array(zipBytes.subarray(dataOff, dataOff + compSize)))
  }
  return files
}
