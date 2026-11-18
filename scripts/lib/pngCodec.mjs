import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import ffmpegPath from 'ffmpeg-static'

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const out = Buffer.allocUnsafe(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilterScanlines(raw, width, height, bpp) {
  const stride = width * bpp
  const out = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const srcRow = y * (stride + 1)
    const filter = raw[srcRow]
    const dstRow = y * stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[srcRow + 1 + x]
      const a = x >= bpp ? out[dstRow + x - bpp] : 0
      const b = y > 0 ? out[dstRow - stride + x] : 0
      const c = y > 0 && x >= bpp ? out[dstRow - stride + x - bpp] : 0
      let val = cur
      if (filter === 1) val = (cur + a) & 0xff
      else if (filter === 2) val = (cur + b) & 0xff
      else if (filter === 3) val = (cur + ((a + b) >> 1)) & 0xff
      else if (filter === 4) val = (cur + paethPredictor(a, b, c)) & 0xff
      out[dstRow + x] = val
    }
  }
  return out
}

function tryDecodeStandardPngBuffer(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idatChunks = []

  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buf.subarray(offset + 8, offset + 8 + len)
    offset += 12 + len
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (interlace !== 0 || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idatChunks))
  const pixels = unfilterScanlines(raw, width, height, bpp)
  if (bpp === 4) return { width, height, rgba: new Uint8ClampedArray(pixels) }

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    const o = i * 4
    rgba[o] = pixels[j]
    rgba[o + 1] = pixels[j + 1]
    rgba[o + 2] = pixels[j + 2]
    rgba[o + 3] = 255
  }
  return { width, height, rgba }
}

/** Giải mã bất kỳ file ảnh (PNG/JPG/WebP) thành buffer `{ width, height, rgba }`. */
export function decodeImageToRgba(filePath) {
  const buf = readFileSync(filePath)
  const direct = tryDecodeStandardPngBuffer(buf)
  if (direct) return direct

  if (!ffmpegPath) throw new Error(`Cannot decode non-8bit-RGB/RGBA image without ffmpeg-static: ${filePath}`)
  const pngStdout = execFileSync(
    ffmpegPath,
    ['-v', 'error', '-i', filePath, '-frames:v', '1', '-c:v', 'png', '-pix_fmt', 'rgba', '-f', 'image2pipe', '-'],
    { maxBuffer: 96 * 1024 * 1024 }
  )
  const converted = tryDecodeStandardPngBuffer(pngStdout)
  if (!converted) throw new Error(`ffmpeg failed to normalize image to 8-bit RGBA PNG: ${filePath}`)
  return converted
}

/** Đọc kích thước `{ width, height }` của PNG/JPEG trên đĩa. */
export function readImageDimensions(filePath) {
  const buf = readFileSync(filePath)
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIG)) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  const { width, height } = decodeImageToRgba(filePath)
  return { width, height }
}

/** Ghi buffer `{ width, height, rgba }` thành PNG RGBA 8-bit tối ưu dung lượng bằng Sub-filter. */
export function encodeRgbaToPngFile(filePath, rgba, width, height) {
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const filtered = Buffer.allocUnsafe(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    const dstRow = y * (stride + 1)
    const srcRow = y * stride
    filtered[dstRow] = 1 // Sub filter nén tốt hơn None ~2x cho ảnh mỹ thuật
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? rgba[srcRow + x - 4] : 0
      filtered[dstRow + 1 + x] = (rgba[srcRow + x] - a) & 0xff
    }
  }

  const compressed = deflateSync(filtered, { level: 6 })
  const out = Buffer.concat([PNG_SIG, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))])
  writeFileSync(filePath, out)
}
