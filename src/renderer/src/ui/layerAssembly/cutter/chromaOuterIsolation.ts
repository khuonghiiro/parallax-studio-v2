import type { ChromaKeySettings } from './types'
import type { ChromaAlphaAnalysis } from './chromaShadowExtractor'

/**
 * Tiện ích phân vùng "nền ngoài" (Outer Isolation) dùng chung cho Xưởng lắp ráp 2.5D (Sprite Cutter)
 * và Xưởng tách hoạt ảnh loop: loang BFS 4 hướng từ mép ảnh qua các pixel được phép đi qua,
 * để phần nằm bên trong đường viền (ruột vòng tròn, quầng sáng bao quanh lõi...) được giữ nguyên.
 */

/**
 * Loang BFS 4 hướng từ 4 cạnh ảnh qua các pixel `passable`.
 * `extraSeed` (tuỳ chọn) gieo thêm hạt giống ở bên trong ảnh (ví dụ vùng đã trong suốt sẵn).
 */
export function floodFromBorder(
  passable: Uint8Array,
  w: number,
  h: number,
  extraSeed?: (p: number) => boolean
): Uint8Array {
  const total = w * h
  const out = new Uint8Array(total)
  if (total === 0) return out
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const push = (p: number): void => {
    if (passable[p] && !out[p]) {
      out[p] = 1
      queue[tail++] = p
    }
  }

  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    push(y * w)
    push(y * w + (w - 1))
  }
  if (extraSeed) {
    for (let p = 0; p < total; p++) {
      if (extraSeed(p)) push(p)
    }
  }

  while (head < tail) {
    const curr = queue[head++]
    const cx = curr % w
    if (cx > 0) push(curr - 1)
    if (cx < w - 1) push(curr + 1)
    if (curr >= w) push(curr - w)
    if (curr < total - w) push(curr + w)
  }
  return out
}

/**
 * Nới rộng mặt nạ `mask` thêm `steps` pixel (4 hướng) nhưng chỉ vào những pixel được phép `allowed`.
 * Dùng để vùng nền ngoài ôm trọn dải viền anti-alias / mềm biên sát vật thể.
 */
export function growMaskWithin(
  mask: Uint8Array,
  allowed: Uint8Array,
  w: number,
  h: number,
  steps: number
): void {
  const total = w * h
  for (let s = 0; s < steps; s++) {
    const snap = mask.slice()
    for (let p = 0; p < total; p++) {
      if (mask[p] || !allowed[p]) continue
      const x = p % w
      if (
        (x > 0 && snap[p - 1]) ||
        (x < w - 1 && snap[p + 1]) ||
        (p >= w && snap[p - w]) ||
        (p < total - w && snap[p + w])
      ) {
        mask[p] = 1
      }
    }
  }
}

/** Gieo hạt giống tại các pixel đã trong suốt sẵn (vạch lưới đã xoá, ảnh PNG có alpha) */
export function transparentSeed(data: Uint8ClampedArray): (p: number) => boolean {
  return (p) => data[p * 4 + 3] < 15
}

/**
 * Ngưỡng độ phủ của "đường viền" chặn vùng loang nền ngoài:
 * - Xoá bóng: mọi thứ khác nền rõ rệt (kể cả quầng sáng) là vật thể → ngưỡng thấp theo Độ nhạy,
 *   nên "Chỉ nền ngoài" chỉ xoá phông bên ngoài viền và giữ nguyên toàn bộ bên trong.
 * - Lấy cả bóng / Chỉ lấy bóng: chỉ nét vật thể ĐẶC mới là tường; quầng sáng / bóng đổ phía ngoài
 *   được loang tới để tách bóng, phần nằm trong đường viền đặc kín được giữ nguyên.
 */
export function resolveOuterWallAlpha(settings: ChromaKeySettings, analysis: ChromaAlphaAnalysis): number {
  const shadowOn = settings.shadowMode === 'include' || settings.shadowMode === 'only'
  if (shadowOn) return Math.max(0.3, Math.min(0.92, (settings.shadowSolidThreshold ?? 62) / 100))
  const tol = Math.max(0, Math.min(100, settings.tolerance)) / 100
  return Math.max(0.08, Math.min(0.6, Math.max(analysis.measuredNoise + 0.05, tol * 0.4)))
}

/** Làm mịn hộp 3×3 tách 2 lượt ngang–dọc (O(N)) */
function boxBlur3(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const l = src[row + (x > 0 ? x - 1 : x)]
      const r = src[row + (x < w - 1 ? x + 1 : x)]
      tmp[row + x] = (l + src[row + x] + r) / 3
    }
  }
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : y) * w
    const dn = (y < h - 1 ? y + 1 : y) * w
    const row = y * w
    for (let x = 0; x < w; x++) out[row + x] = (tmp[up + x] + tmp[row + x] + tmp[dn + x]) / 3
  }
  return out
}

function legacyChromaGapSeed(
  data: Uint8ClampedArray,
  rawAlpha: Float32Array,
  isGreen: boolean,
  isBlue: boolean,
  isMagenta: boolean
): (p: number) => boolean {
  return (p) => {
    const idx = p * 4
    if (data[idx + 3] < 15) return true
    if (rawAlpha[p] < 0.08) return true
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    if (isGreen) return g - (r > b ? r : b) >= 42
    if (isBlue) return b - (r > g ? r : g) >= 42
    if (isMagenta) return Math.min(r, b) - g >= 42
    return false
  }
}

/**
 * Vùng cần tách nền (zone) theo phạm vi:
 * - `all` (Tách toàn bộ): toàn ảnh — xoá cả nền bên trong lẫn bên ngoài đường viền.
 * - `outer_only` (Chỉ nền ngoài): nền liên thông với mép ảnh (loang qua pixel có độ phủ dưới ngưỡng viền)
 *   cộng dải mềm biên 1–4px; phần ruột nằm trong đường viền giữ nguyên 100%.
 *   `strictOuterIsolation !== true` bật lại kiểu tự gieo hạt ở khe phông xanh/lam/hồng thuần khiết (kẽ tóc, hốc mắt).
 */
export function computeChromaZone(
  analysis: ChromaAlphaAnalysis,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings
): Uint8Array {
  const total = w * h
  const zone = new Uint8Array(total)
  if (settings.isolationMode !== 'outer_only') {
    zone.fill(1)
    return zone
  }
  const wall = resolveOuterWallAlpha(settings, analysis)
  // Ngưỡng viền thấp (Xoá bóng) dễ bị nhiễu JPEG làm răng cưa đường viền → so trên bản làm mịn 3×3
  const rawAlpha = wall < 0.3 ? boxBlur3(analysis.rawAlpha, w, h) : analysis.rawAlpha
  const passable = new Uint8Array(total)
  const soft = new Uint8Array(total)
  const solidCut = Math.max(wall, Math.max(0.3, Math.min(0.92, (settings.shadowSolidThreshold ?? 62) / 100)))
  for (let p = 0; p < total; p++) {
    const clear = data[p * 4 + 3] < 15
    if (clear || rawAlpha[p] < wall) passable[p] = 1
    if (clear || rawAlpha[p] < solidCut) soft[p] = 1
  }
  const legacy =
    settings.strictOuterIsolation !== true &&
    (analysis.isGreenKey || analysis.isBlueKey || analysis.isMagentaKey)
  const seed = legacy
    ? legacyChromaGapSeed(
        data,
        analysis.rawAlpha,
        analysis.isGreenKey,
        analysis.isBlueKey,
        analysis.isMagentaKey
      )
    : transparentSeed(data)
  const outer = floodFromBorder(passable, w, h, seed)
  // Dải mềm biên: ôm thêm vài px viền chuyển tiếp để mép ngoài mịn mà không ăn sâu vào trong
  const baseBand = legacy ? 3 : 1
  const band = baseBand + Math.round(Math.max(0, Math.min(30, settings.smoothness ?? 0)) / 10)
  growMaskWithin(outer, soft, w, h, band)
  // Nét vật thể ĐẶC luôn được xử lý (khử ám màu mép); chỉ phần mềm / nền bị bao kín bên trong mới giữ nguyên
  for (let p = 0; p < total; p++) {
    if (!soft[p]) outer[p] = 1
  }
  return outer
}
