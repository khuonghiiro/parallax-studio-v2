/**
 * Tiện ích cô lập "nền bên ngoài" (Outer Isolation) dùng chung cho Xưởng lắp ráp 2.5D (Sprite Cutter)
 * và Xưởng tách hoạt ảnh loop: loang BFS 4 hướng từ biên ảnh qua các pixel được phép đi qua,
 * để phần nền nằm kín bên trong một đường viền đặc (ví dụ ruột vòng tròn) được giữ nguyên.
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
 * Dùng để mặt nạ nền ngoài ôm trọn dải viền anti-alias / mềm biên sát vật thể.
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
 * Cô lập vùng nền liên thông với biên ảnh.
 * - `strict = false` (Xưởng lắp ráp): trên phông xanh lá / xanh dương, các khe nền kín có sắc độ
 *   thuần khiết (dominance >= 50, ví dụ kẽ tóc) cũng được gieo hạt để xoá sạch.
 * - `strict = true` (Tách nền ngoài thuần): chỉ loang từ biên ảnh và vùng đã trong suốt,
 *   giữ nguyên toàn bộ nền nằm kín bên trong đường viền đặc.
 */
export function isolateOuterConnectedBg(
  isBg: Uint8Array,
  w: number,
  h: number,
  data?: Uint8ClampedArray,
  keyColorType?: string,
  strict = false
): Uint8Array {
  if (strict) {
    return floodFromBorder(isBg, w, h, data ? transparentSeed(data) : undefined)
  }
  if (!data || (keyColorType !== 'chroma_green' && keyColorType !== 'chroma_blue')) {
    return floodFromBorder(isBg, w, h)
  }
  const isGreen = keyColorType === 'chroma_green'
  return floodFromBorder(isBg, w, h, (p) => {
    const idx = p * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const dom = isGreen ? g - (r > b ? r : b) : b - (r > g ? r : g)
    return dom >= 50
  })
}
