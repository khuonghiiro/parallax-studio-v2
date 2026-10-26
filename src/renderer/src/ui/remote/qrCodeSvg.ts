/**
 * Bộ tạo mã QR Code chuẩn ISO/IEC 18004 thuần TypeScript (Zero-dependency, 100% Offline).
 * Hỗ trợ chế độ Byte (UTF-8), Error Correction Level L, Phiên bản 1–8 (tối đa 192 bytes).
 */

interface QrVersionSpec {
  version: number
  totalData: number
  ecPerBlock: number
  numBlocks: number
  alignCenters: number[]
}

const VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, totalData: 19, ecPerBlock: 7, numBlocks: 1, alignCenters: [] },
  { version: 2, totalData: 34, ecPerBlock: 10, numBlocks: 1, alignCenters: [6, 18] },
  { version: 3, totalData: 55, ecPerBlock: 15, numBlocks: 1, alignCenters: [6, 22] },
  { version: 4, totalData: 80, ecPerBlock: 20, numBlocks: 1, alignCenters: [6, 26] },
  { version: 5, totalData: 108, ecPerBlock: 26, numBlocks: 1, alignCenters: [6, 30] },
  { version: 6, totalData: 136, ecPerBlock: 18, numBlocks: 2, alignCenters: [6, 34] },
  { version: 7, totalData: 156, ecPerBlock: 20, numBlocks: 2, alignCenters: [6, 22, 38] },
  { version: 8, totalData: 194, ecPerBlock: 24, numBlocks: 2, alignCenters: [6, 24, 42] }
]

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function buildGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const root = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], root)
    }
    poly = next
  }
  return poly
}

function computeReedSolomon(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = buildGeneratorPoly(ecLen)
  const rem = new Uint8Array(ecLen)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0]
    rem.copyWithin(0, 1)
    rem[ecLen - 1] = 0
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor)
      }
    }
  }
  return rem
}

function encodeDataCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const bits: number[] = []
  const pushBits = (val: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }

  // Mode indicator: Byte mode (0100)
  pushBits(0b0100, 4)
  // Character count indicator (8 bits for versions 1-9)
  pushBits(bytes.length, 8)
  for (const b of bytes) pushBits(b, 8)

  const maxBits = spec.totalData * 8
  const terminator = Math.min(4, maxBits - bits.length)
  pushBits(0, terminator)

  while (bits.length % 8 !== 0) bits.push(0)

  const out = new Uint8Array(spec.totalData)
  const byteLen = bits.length >>> 3
  for (let i = 0; i < byteLen; i++) {
    let v = 0
    for (let b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b]
    out[i] = v
  }

  const pads = [0xec, 0x11]
  for (let i = byteLen; i < spec.totalData; i++) {
    out[i] = pads[(i - byteLen) % 2]
  }
  return out
}

function buildFinalCodewords(dataCodewords: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const blockDataLen = spec.totalData / spec.numBlocks
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []

  for (let b = 0; b < spec.numBlocks; b++) {
    const slice = dataCodewords.subarray(b * blockDataLen, (b + 1) * blockDataLen)
    dataBlocks.push(slice)
    ecBlocks.push(computeReedSolomon(slice, spec.ecPerBlock))
  }

  const totalLen = spec.totalData + spec.ecPerBlock * spec.numBlocks
  const finalBytes = new Uint8Array(totalLen)
  let offset = 0

  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      finalBytes[offset++] = dataBlocks[b][i]
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      finalBytes[offset++] = ecBlocks[b][i]
    }
  }
  return finalBytes
}

function computeFormatBits(ecLevelBits: number, mask: number): number {
  const data = (ecLevelBits << 3) | mask
  let rem = data << 10
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10)
  }
  return ((data << 10) | rem) ^ 0x5412
}

function computeVersionBits(version: number): number {
  let rem = version << 12
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12)
  }
  return (version << 12) | rem
}

function placeFunctionPatterns(
  modules: boolean[][],
  isFunc: boolean[][],
  size: number,
  spec: QrVersionSpec
): void {
  const setFunc = (r: number, c: number, dark: boolean): void => {
    if (r < 0 || r >= size || c < 0 || c >= size) return
    modules[r][c] = dark
    isFunc[r][c] = true
  }

  const drawFinder = (topR: number, leftC: number): void => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const border = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setFunc(topR + dr, leftC + dc, inside && (border || core))
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0)
    setFunc(i, 6, i % 2 === 0)
  }

  // Alignment patterns
  const centers = spec.alignCenters
  for (const r of centers) {
    for (const c of centers) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc))
          setFunc(r + dr, c + dc, dist !== 1)
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunc[8][i] = true
      isFunc[i][8] = true
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = true
    isFunc[size - 1 - i][8] = true
  }
  setFunc(size - 8, 8, true)

  // Version info for version >= 7
  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version)
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setFunc(a, b, bit)
      setFunc(b, a, bit)
    }
  }
}

function drawFormatBits(modules: boolean[][], size: number, mask: number): void {
  // Error correction level L = 0b01
  const bits = computeFormatBits(0b01, mask)
  const getBit = (i: number): boolean => ((bits >>> i) & 1) === 1

  const row8Cols = [0, 1, 2, 3, 4, 5, 7, 8]
  for (let i = 0; i < 8; i++) modules[8][row8Cols[i]] = getBit(14 - i)
  const col8Rows = [7, 5, 4, 3, 2, 1, 0]
  for (let i = 0; i < 7; i++) modules[col8Rows[i]][8] = getBit(6 - i)

  for (let i = 0; i < 7; i++) modules[size - 1 - i][8] = getBit(14 - i)
  for (let i = 0; i < 8; i++) modules[8][size - 8 + i] = getBit(7 - i)
}

function applyMask(modules: boolean[][], isFunc: boolean[][], size: number, mask: number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunc[r][c]) continue
      const inv =
        mask === 0
          ? (r + c) % 2 === 0
          : mask === 1
            ? r % 2 === 0
            : mask === 2
              ? c % 3 === 0
              : (r + c) % 3 === 0
      if (inv) modules[r][c] = !modules[r][c]
    }
  }
}

/**
 * Tạo ma trận boolean (true = ô đen, false = ô trắng) cho chuỗi văn bản đầu vào.
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const spec = VERSION_SPECS_L.find((s) => s.totalData - 2 >= bytes.length) ?? VERSION_SPECS_L[VERSION_SPECS_L.length - 1]
  const trimmed = bytes.length > spec.totalData - 2 ? bytes.subarray(0, spec.totalData - 2) : bytes

  const size = 17 + spec.version * 4
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isFunc: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  placeFunctionPatterns(modules, isFunc, size, spec)

  const dataWords = encodeDataCodewords(trimmed, spec)
  const codewords = buildFinalCodewords(dataWords, spec)

  let bitIdx = 0
  const totalBits = codewords.length * 8
  let upward = true

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const c = right - j
        if (!isFunc[r][c]) {
          let dark = false
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1
            bitIdx++
          }
          modules[r][c] = dark
        }
      }
    }
    upward = !upward
  }

  // Mask 0 ((r + c) % 2 === 0) gives balanced density for alphanumeric URLs
  const mask = 0
  applyMask(modules, isFunc, size, mask)
  drawFormatBits(modules, size, mask)
  return modules
}

/**
 * Kết xuất đường dẫn SVG `<path d="..." />` từ ma trận QR để nhúng trực tiếp vào React component.
 */
export function buildQrSvgPath(matrix: boolean[][], quietZone = 2): { viewBoxSize: number; pathData: string } {
  const n = matrix.length
  const viewBoxSize = n + quietZone * 2
  const parts: string[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        parts.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`)
      }
    }
  }
  return { viewBoxSize, pathData: parts.join('') }
}
