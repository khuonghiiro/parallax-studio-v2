import { wasmDisambiguateRegionPixels } from '../../../engine/wasm/wasmIsolationBridge'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  id?: string
}

export interface OverlapDisambiguationOptions {
  /** Hệ số ưu tiên cho đối tượng hiện tại so với đảo láng giềng (mặc định 0.95) */
  targetPreferenceRatio?: number
  /** Ngưỡng alpha coi là đặc (mặc định 12) */
  alphaThreshold?: number
}

/**
 * Kiểm tra 2 bounding box có giao nhau (AABB intersection) hay không.
 */
export function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/**
 * Khử giao thoa chi tiết giữa các bounding box khi trích xuất mảnh sprite.
 * 
 * Khi 2 hay nhiều mảnh có khung bao (bounding box) giao nhau (ví dụ: bím tóc Mảnh #2 chìa sang
 * khung tóc trước Mảnh #1, hoặc tà áo Mảnh #4 giao với bím tóc Mảnh #2), hàm này:
 * 1. Xác định vùng tranh chấp giữa box mục tiêu và các sibling box.
 * 2. Phân tích các thành phần liên thông (Connected Components) bằng BFS:
 *    - Nếu một thành phần liên thông nằm trọn vẹn trong vùng tranh chấp và không có điểm lõi của
 *      box mục tiêu, đồng thời nghiêng về tâm sibling box (intruder component), triệt tiêu
 *      toàn bộ alpha của nó về 0 để không bị vướng chi tiết của mảnh khác.
 *    - Nếu là thành phần liên thông chính của box mục tiêu, bảo toàn thân chính và chỉ cắt tỉa
 *      phần viền nếu lấn quá sâu vào tâm sibling box.
 */
export function disambiguateRegionPixels(
  imageData: ImageData,
  box: { x: number; y: number; width: number; height: number },
  siblingBoxes?: Array<{ x: number; y: number; width: number; height: number }>,
  options?: OverlapDisambiguationOptions
): boolean {
  if (!siblingBoxes || siblingBoxes.length === 0) return false
  const overlappingSiblings = siblingBoxes.filter(
    (sib) => sib.width > 0 && sib.height > 0 && boxesIntersect(box, sib)
  )
  if (overlappingSiblings.length === 0) return false
  const wasmRes = wasmDisambiguateRegionPixels(
    imageData.data,
    imageData.width,
    imageData.height,
    box,
    overlappingSiblings,
    options?.alphaThreshold ?? 12,
    options?.targetPreferenceRatio ?? 0.95
  )
  if (wasmRes !== null) return wasmRes
  return disambiguateRegionPixelsJs(imageData, box, overlappingSiblings, options)
}

export function disambiguateRegionPixelsJs(
  imageData: ImageData,
  box: { x: number; y: number; width: number; height: number },
  siblingBoxes?: Array<{ x: number; y: number; width: number; height: number }>,
  options?: OverlapDisambiguationOptions
): boolean {
  if (!siblingBoxes || siblingBoxes.length === 0) return false

  // 1. Chỉ lọc các sibling box có thực sự giao thoa với box
  const overlappingSiblings = siblingBoxes.filter(
    (sib) => sib.width > 0 && sib.height > 0 && boxesIntersect(box, sib)
  )
  if (overlappingSiblings.length === 0) return false

  const W = imageData.width
  const H = imageData.height
  const totalPixels = W * H
  if (totalPixels <= 0) return false

  const data = imageData.data
  const alphaThreshold = options?.alphaThreshold ?? 12
  const targetPref = options?.targetPreferenceRatio ?? 0.95

  // Tâm và bán trục của box mục tiêu (trong hệ tọa độ gốc)
  const targetCx = box.x + box.width * 0.5
  const targetCy = box.y + box.height * 0.5
  const targetHw = Math.max(1, box.width * 0.5)
  const targetHh = Math.max(1, box.height * 0.5)

  // Tiền xử lý tọa độ các sibling box và vùng giao thoa cục bộ
  const sibMeta = overlappingSiblings.map((sib) => {
    const scx = sib.x + sib.width * 0.5
    const scy = sib.y + sib.height * 0.5
    const shw = Math.max(1, sib.width * 0.5)
    const shh = Math.max(1, sib.height * 0.5)

    const localMinX = Math.max(0, Math.floor(sib.x - box.x))
    const localMinY = Math.max(0, Math.floor(sib.y - box.y))
    const localMaxX = Math.min(W - 1, Math.ceil(sib.x + sib.width - box.x))
    const localMaxY = Math.min(H - 1, Math.ceil(sib.y + sib.height - box.y))

    return {
      box: sib,
      cx: scx,
      cy: scy,
      hw: shw,
      hh: shh,
      localMinX,
      localMinY,
      localMaxX,
      localMaxY
    }
  })

  // 2. Phân loại pixel:
  // 0 = trong suốt
  // 1 = đục, NẰM NGOÀI mọi sibling box (Pixel Lõi chắc chắn thuộc box này)
  // 2 = đục, NẰM TRONG vùng giao thoa với ít nhất một sibling box (Vùng tranh chấp)
  const pixelState = new Uint8Array(totalPixels)
  let contestedCount = 0

  for (let y = 0; y < H; y++) {
    const gy = box.y + y
    const rowOffset = y * W
    for (let x = 0; x < W; x++) {
      const idx = rowOffset + x
      if (data[idx * 4 + 3] < alphaThreshold) continue

      const gx = box.x + x
      let inAnySib = false
      for (let s = 0; s < sibMeta.length; s++) {
        const meta = sibMeta[s]
        if (
          x >= meta.localMinX &&
          x <= meta.localMaxX &&
          y >= meta.localMinY &&
          y <= meta.localMaxY &&
          gx >= meta.box.x &&
          gx < meta.box.x + meta.box.width &&
          gy >= meta.box.y &&
          gy < meta.box.y + meta.box.height
        ) {
          inAnySib = true
          break
        }
      }

      if (inAnySib) {
        pixelState[idx] = 2
        contestedCount++
      } else {
        pixelState[idx] = 1
      }
    }
  }

  // Nếu không có pixel đục nào nằm trong vùng giao thoa, không cần làm gì
  if (contestedCount === 0) return false

  // 3. Quét các thành phần liên thông (Connected Components) bằng BFS
  const visited = new Uint8Array(totalPixels)
  const queue = new Int32Array(totalPixels)
  let modified = false

  for (let y = 0; y < H; y++) {
    const rowOffset = y * W
    for (let x = 0; x < W; x++) {
      const startIdx = rowOffset + x
      if (visited[startIdx] || pixelState[startIdx] === 0) continue

      let head = 0
      let tail = 0
      queue[tail++] = startIdx
      visited[startIdx] = 1

      let hasCorePixels = false

      while (head < tail) {
        const curr = queue[head++]
        if (pixelState[curr] === 1) {
          hasCorePixels = true
        }

        const cx = curr % W
        const cy = (curr - cx) / W

        if (cy > 0) {
          const n = curr - W
          if (!visited[n] && pixelState[n] > 0) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cy < H - 1) {
          const n = curr + W
          if (!visited[n] && pixelState[n] > 0) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cx > 0) {
          const n = curr - 1
          if (!visited[n] && pixelState[n] > 0) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cx < W - 1) {
          const n = curr + 1
          if (!visited[n] && pixelState[n] > 0) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
      }

      // 4. Đánh giá thành phần liên thông:
      if (!hasCorePixels) {
        // Trường hợp A: Không có bất kỳ pixel lõi nào của target box.
        // Đây là mảnh ngoại lai (intruder) thò từ sibling sang.
        let votesForSib = 0
        let votesForTarget = 0

        for (let i = 0; i < tail; i++) {
          const p = queue[i]
          const px = p % W
          const py = (p - px) / W
          const gx = box.x + px
          const gy = box.y + py

          const dTarget = Math.hypot((gx - targetCx) / targetHw, (gy - targetCy) / targetHh)

          let minDSib = Infinity
          for (let s = 0; s < sibMeta.length; s++) {
            const meta = sibMeta[s]
            if (
              gx >= meta.box.x &&
              gx < meta.box.x + meta.box.width &&
              gy >= meta.box.y &&
              gy < meta.box.y + meta.box.height
            ) {
              const dSib = Math.hypot((gx - meta.cx) / meta.hw, (gy - meta.cy) / meta.hh)
              if (dSib < minDSib) minDSib = dSib
            }
          }

          if (minDSib < dTarget * targetPref) {
            votesForSib++
          } else {
            votesForTarget++
          }
        }

        // Nếu đa số pixel gần sibling hơn: xóa sạch mảnh ngoại lai này
        if (votesForSib >= votesForTarget) {
          for (let i = 0; i < tail; i++) {
            const p = queue[i]
            data[p * 4 + 3] = 0
          }
          modified = true
        } else {
          // Ngay cả khi đa số nghiêng về target, vẫn khử các pixel lấn quá sâu vào sibling
          for (let i = 0; i < tail; i++) {
            const p = queue[i]
            if (pixelState[p] === 2) {
              const px = p % W
              const py = (p - px) / W
              const gx = box.x + px
              const gy = box.y + py
              const dTarget = Math.hypot((gx - targetCx) / targetHw, (gy - targetCy) / targetHh)
              let minDSib = Infinity
              for (let s = 0; s < sibMeta.length; s++) {
                const meta = sibMeta[s]
                if (
                  gx >= meta.box.x &&
                  gx < meta.box.x + meta.box.width &&
                  gy >= meta.box.y &&
                  gy < meta.box.y + meta.box.height
                ) {
                  const dSib = Math.hypot((gx - meta.cx) / meta.hw, (gy - meta.cy) / meta.hh)
                  if (dSib < minDSib) minDSib = dSib
                }
              }
              if (minDSib < dTarget * 0.8) {
                data[p * 4 + 3] = 0
                modified = true
              }
            }
          }
        }
      } else {
        // Trường hợp B: Có chứa pixel lõi của target box.
        // Đây là thân chính của mảnh mục tiêu. Chỉ khử các pixel ở vùng tranh chấp
        // nếu chúng lấn quá sâu vào tâm sibling box (trường hợp 2 mảnh dính liền mép).
        for (let i = 0; i < tail; i++) {
          const p = queue[i]
          if (pixelState[p] === 2) {
            const px = p % W
            const py = (p - px) / W
            const gx = box.x + px
            const gy = box.y + py

            const dTarget = Math.hypot((gx - targetCx) / targetHw, (gy - targetCy) / targetHh)

            let minDSib = Infinity
            for (let s = 0; s < sibMeta.length; s++) {
              const meta = sibMeta[s]
              if (
                gx >= meta.box.x &&
                gx < meta.box.x + meta.box.width &&
                gy >= meta.box.y &&
                gy < meta.box.y + meta.box.height
              ) {
                const dSib = Math.hypot((gx - meta.cx) / meta.hw, (gy - meta.cy) / meta.hh)
                if (dSib < minDSib) minDSib = dSib
              }
            }

            if (minDSib < dTarget * 0.75) {
              data[p * 4 + 3] = 0
              modified = true
            }
          }
        }
      }
    }
  }

  return modified
}

/**
 * Áp dụng khử giao thoa trực tiếp lên thẻ canvas cục bộ của mảnh cắt.
 */
export function disambiguateCanvasOverlap(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  siblingBoxes?: Array<{ x: number; y: number; width: number; height: number }>,
  options?: OverlapDisambiguationOptions
): boolean {
  if (!siblingBoxes || siblingBoxes.length === 0) return false
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const modified = disambiguateRegionPixels(imgData, box, siblingBoxes, options)
  if (modified) {
    ctx.putImageData(imgData, 0, 0)
  }
  return modified
}
