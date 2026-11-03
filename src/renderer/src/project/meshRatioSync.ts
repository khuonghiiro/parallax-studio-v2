import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import type { AssetMeta, ImageLayer } from '@shared/types'
import type { GridSlicerConfig, LoopFrameBox } from '../ui/loopAnimator/types'

/**
 * Hộp bao lưới đa giác bám sát vật thể đục (Alpha Silhouette Mesh Bounds) chuẩn hoá trong hệ UV [0..1].
 * Dùng để đồng bộ chính xác kích thước mặt phẳng Mesh, tâm đặt (x, y), khớp xương (rig) và các mảnh
 * lắp ráp khi nâng cấp hoặc thay thế ảnh/frame lên độ phân giải cao (2K / 4K), bất kể viền trong suốt
 * (canvas padding) hay kích thước pixel thô của ảnh mới thay đổi như thế nào.
 */
export interface AlphaMeshBounds {
  /** Biên trái vùng đục của Mesh trong hệ chuẩn hoá UV [0..1] */
  u0: number
  /** Biên trên vùng đục của Mesh trong hệ chuẩn hoá UV [0..1] */
  v0: number
  /** Biên phải vùng đục của Mesh trong hệ chuẩn hoá UV [0..1] */
  u1: number
  /** Biên dưới vùng đục của Mesh trong hệ chuẩn hoá UV [0..1] */
  v1: number
  /** Tâm ngang của vùng Alpha Mesh trong UV [0..1] */
  centerU: number
  /** Tâm dọc của vùng Alpha Mesh trong UV [0..1] */
  centerV: number
  /** Mép chân đế dưới cùng của Alpha Mesh trong UV [0..1] */
  bottomV: number
  /** Tỉ lệ chiều rộng vùng Alpha Mesh so với toàn khổ ảnh (0..1] */
  fillW: number
  /** Tỉ lệ chiều cao vùng Alpha Mesh so với toàn khổ ảnh (0..1] */
  fillH: number
  /** Tỉ lệ khung hình thực tế của bản thân vùng Alpha Mesh (meshPxW / meshPxH) */
  meshAspect: number
  /** Chiều rộng pixel của ảnh khi đo */
  imgW: number
  /** Chiều cao pixel của ảnh khi đo */
  imgH: number
}

export interface MeshSyncInput {
  /** Chiều rộng mặt phẳng Mesh hiện tại trong không gian Xưởng / Cảnh */
  oldMeshW: number
  /** Chiều cao mặt phẳng Mesh hiện tại trong không gian Xưởng / Cảnh */
  oldMeshH: number
  /** Hộp bao Alpha Mesh của ảnh cũ (nếu có) */
  oldBounds?: AlphaMeshBounds | null
  /** Hộp bao Alpha Mesh của ảnh mới (nếu có) */
  newBounds?: AlphaMeshBounds | null
  /** Chiều rộng pixel thực tế của ảnh mới (VD 2048, 4096) */
  newImgW: number
  /** Chiều cao pixel thực tế của ảnh mới (VD 2048, 4096) */
  newImgH: number
  /** Hệ số phóng to ngang của layer hiện tại (mặc định 1) */
  scaleX?: number
  /** Hệ số phóng to dọc của layer hiện tại (mặc định 1) */
  scaleY?: number
  /** Điểm neo của layer để bù trừ dịch chuyển tâm Alpha Mesh */
  anchor?: 'center' | 'bottom' | 'top' | 'left' | 'right'
  /** Đảo trục Y khi tính deltaY (true cho không gian 3D Scene nơi +Y hướng lên; false cho Xưởng 2D nơi +Y hướng xuống) */
  invertY?: boolean
}

export interface MeshSyncResult {
  /** Chiều rộng mặt phẳng Mesh mới đã đồng bộ theo tỉ lệ Alpha Mesh */
  meshWidth: number
  /** Chiều cao mặt phẳng Mesh mới đã đồng bộ theo tỉ lệ Alpha Mesh */
  meshHeight: number
  /** Độ dịch chuyển bù trừ trục X để Alpha Mesh mới chồng khít lên vị trí Alpha Mesh cũ */
  deltaX: number
  /** Độ dịch chuyển bù trừ trục Y để Alpha Mesh mới chồng khít lên vị trí Alpha Mesh cũ */
  deltaY: number
  /** Tỉ lệ thay đổi mặt phẳng Mesh theo trục X (meshWidth / oldMeshW) */
  scaleRatioX: number
  /** Tỉ lệ thay đổi mặt phẳng Mesh theo trục Y (meshHeight / oldMeshH) */
  scaleRatioY: number
  /** Kích thước thực tế của vùng Alpha Mesh theo chiều ngang trong không gian Xưởng/Cảnh */
  alphaMeshW: number
  /** Kích thước thực tế của vùng Alpha Mesh theo chiều dọc trong không gian Xưởng/Cảnh */
  alphaMeshH: number
}

const urlBoundsCache = new Map<string, AlphaMeshBounds>()
const elementBoundsCache = new WeakMap<object, AlphaMeshBounds>()
const MAX_URL_CACHE = 256

function setUrlBoundsCache(key: string, bounds: AlphaMeshBounds): void {
  urlBoundsCache.set(key, bounds)
  if (urlBoundsCache.size > MAX_URL_CACHE) {
    const first = urlBoundsCache.keys().next().value
    if (first !== undefined) urlBoundsCache.delete(first)
  }
}

export function createFullFrameMeshBounds(imgW = 256, imgH = 256): AlphaMeshBounds {
  const safeW = Math.max(1, imgW)
  const safeH = Math.max(1, imgH)
  return {
    u0: 0,
    v0: 0,
    u1: 1,
    v1: 1,
    centerU: 0.5,
    centerV: 0.5,
    bottomV: 1,
    fillW: 1,
    fillH: 1,
    meshAspect: safeW / safeH,
    imgW: safeW,
    imgH: safeH
  }
}

/**
 * Đo hộp bao Alpha Mesh từ mặt nạ kênh Alpha 1-byte/pixel (như `RuntimeAsset.alpha` trong `assetStore`).
 * Tốc độ thực thi ~0.01ms trên mặt nạ <= 256×256.
 */
export function computeAlphaMeshBoundsFromMask(
  mask: { w: number; h: number; data: Uint8ClampedArray | Uint8Array | number[] },
  imgW?: number,
  imgH?: number,
  alphaThreshold = 12
): AlphaMeshBounds {
  const w = Math.max(1, mask.w)
  const h = Math.max(1, mask.h)
  const fullW = Math.max(1, imgW || w)
  const fullH = Math.max(1, imgH || h)
  const data = mask.data

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w
    for (let x = 0; x < w; x++) {
      if (data[rowOffset + x] >= alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return createFullFrameMeshBounds(fullW, fullH)
  }

  const u0 = minX / w
  const v0 = minY / h
  const u1 = (maxX + 1) / w
  const v1 = (maxY + 1) / h
  const fillW = Math.max(0.02, Math.min(1, u1 - u0))
  const fillH = Math.max(0.02, Math.min(1, v1 - v0))
  const meshPxW = fillW * fullW
  const meshPxH = fillH * fullH

  return {
    u0,
    v0,
    u1,
    v1,
    centerU: (u0 + u1) * 0.5,
    centerV: (v0 + v1) * 0.5,
    bottomV: v1,
    fillW,
    fillH,
    meshAspect: meshPxW / Math.max(1e-4, meshPxH),
    imgW: fullW,
    imgH: fullH
  }
}

/**
 * Đo hộp bao Alpha Mesh từ dữ liệu RGBA `ImageData` (toàn ảnh hoặc một vùng khung cắt `region` trong Sprite Sheet).
 */
export function computeAlphaMeshBoundsFromImageData(
  imageData: { width: number; height: number; data: Uint8ClampedArray | Uint8Array },
  region?: { x: number; y: number; width: number; height: number },
  alphaThreshold = 12
): AlphaMeshBounds {
  const sheetW = Math.max(1, imageData.width)
  const sheetH = Math.max(1, imageData.height)
  const rx = region ? Math.max(0, Math.min(sheetW - 1, Math.round(region.x))) : 0
  const ry = region ? Math.max(0, Math.min(sheetH - 1, Math.round(region.y))) : 0
  const rw = region ? Math.max(1, Math.min(sheetW - rx, Math.round(region.width))) : sheetW
  const rh = region ? Math.max(1, Math.min(sheetH - ry, Math.round(region.height))) : sheetH
  const data = imageData.data

  let minX = rw
  let minY = rh
  let maxX = -1
  let maxY = -1

  for (let ly = 0; ly < rh; ly++) {
    const rowBase = ((ry + ly) * sheetW + rx) * 4
    for (let lx = 0; lx < rw; lx++) {
      if (data[rowBase + lx * 4 + 3] >= alphaThreshold) {
        if (lx < minX) minX = lx
        if (lx > maxX) maxX = lx
        if (ly < minY) minY = ly
        if (ly > maxY) maxY = ly
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return createFullFrameMeshBounds(rw, rh)
  }

  const u0 = minX / rw
  const v0 = minY / rh
  const u1 = (maxX + 1) / rw
  const v1 = (maxY + 1) / rh
  const fillW = Math.max(0.02, Math.min(1, u1 - u0))
  const fillH = Math.max(0.02, Math.min(1, v1 - v0))

  return {
    u0,
    v0,
    u1,
    v1,
    centerU: (u0 + u1) * 0.5,
    centerV: (v0 + v1) * 0.5,
    bottomV: v1,
    fillW,
    fillH,
    meshAspect: (fillW * rw) / Math.max(1e-4, fillH * rh),
    imgW: rw,
    imgH: rh
  }
}

let scratchCanvas: HTMLCanvasElement | null = null

/**
 * Đo hộp bao Alpha Mesh trực tiếp từ phần tử ảnh / canvas / bitmap (thu nhỏ tối đa 256px để đo tức thì).
 */
export function computeAlphaMeshBoundsFromElement(
  el: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  alphaThreshold = 12
): AlphaMeshBounds {
  const cached = elementBoundsCache.get(el)
  if (cached) return cached

  const rawW =
    ('naturalWidth' in el && el.naturalWidth ? el.naturalWidth : el.width) || 256
  const rawH =
    ('naturalHeight' in el && el.naturalHeight ? el.naturalHeight : el.height) || 256

  if (typeof document === 'undefined') {
    return createFullFrameMeshBounds(rawW, rawH)
  }

  try {
    const maxSample = 256
    const scale = Math.min(1, maxSample / Math.max(rawW, rawH))
    const sw = Math.max(1, Math.round(rawW * scale))
    const sh = Math.max(1, Math.round(rawH * scale))
    if (!scratchCanvas) scratchCanvas = document.createElement('canvas')
    scratchCanvas.width = sw
    scratchCanvas.height = sh
    const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return createFullFrameMeshBounds(rawW, rawH)
    ctx.clearRect(0, 0, sw, sh)
    ctx.drawImage(el, 0, 0, sw, sh)
    const imgData = ctx.getImageData(0, 0, sw, sh)
    const bounds = computeAlphaMeshBoundsFromImageData(imgData, undefined, alphaThreshold)
    const result: AlphaMeshBounds = {
      ...bounds,
      imgW: rawW,
      imgH: rawH,
      meshAspect: (bounds.fillW * rawW) / Math.max(1e-4, bounds.fillH * rawH)
    }
    elementBoundsCache.set(el, result)
    if ('src' in el && typeof el.src === 'string' && el.src) {
      setUrlBoundsCache(el.src, result)
    }
    return result
  } catch {
    return createFullFrameMeshBounds(rawW, rawH)
  }
}

/**
 * Tải (hoặc lấy từ cache) và đo Alpha Mesh Bounds cho một đường dẫn / Data URL ảnh.
 */
export async function measureUrlAlphaMeshBounds(
  url: string | null | undefined,
  alphaThreshold = 12
): Promise<AlphaMeshBounds | null> {
  if (!url) return null
  const cached = urlBoundsCache.get(url)
  if (cached) return cached
  if (typeof Image === 'undefined') return null

  return new Promise<AlphaMeshBounds | null>((resolve) => {
    const img = new Image()
    if (url.startsWith('http')) img.crossOrigin = 'anonymous'
    img.onload = () => {
      const b = computeAlphaMeshBoundsFromElement(img, alphaThreshold)
      setUrlBoundsCache(url, b)
      resolve(b)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function getCachedUrlAlphaMeshBounds(url: string | null | undefined): AlphaMeshBounds | null {
  if (!url) return null
  return urlBoundsCache.get(url) ?? null
}

/**
 * Tính toán kích thước mặt phẳng Mesh (`meshWidth × meshHeight`) và độ lệch bù trừ tâm (`deltaX, deltaY`)
 * khi thay thế ảnh cũ bằng ảnh mới (ví dụ nâng cấp lên 2K / 4K hoặc thay biến thể có lề trong suốt khác).
 *
 * Nguyên lý:
 * - Giữ cố định diện tích/kích thước hiển thị của bản thân vùng **Alpha Mesh** (phần hình dáng vật thể đục)
 *   trong không gian Xưởng / Cảnh để khớp xương (`rig`), đường cong `plantSpines` và các bộ phận lắp ráp
 *   luôn khớp tỉ lệ 100%, đồng thời giữ đúng tỉ lệ pixel tự nhiên của ảnh mới (không làm méo hình).
 * - Tự động bù trừ độ lệch tâm Alpha Mesh (`centerU, centerV` hoặc `bottomV`) vào vị trí đặt layer.
 */
export function computeMeshSyncedReplacement(input: MeshSyncInput): MeshSyncResult {
  const oldMeshW = Math.max(1, input.oldMeshW || 256)
  const oldMeshH = Math.max(1, input.oldMeshH || 256)
  const newImgW = Math.max(1, input.newImgW || oldMeshW)
  const newImgH = Math.max(1, input.newImgH || oldMeshH)
  const scaleX = input.scaleX ?? 1
  const scaleY = input.scaleY ?? 1
  const anchor = input.anchor ?? 'center'
  const invertY = Boolean(input.invertY)

  const oldB = input.oldBounds ?? createFullFrameMeshBounds(oldMeshW, oldMeshH)
  const newB = input.newBounds ?? createFullFrameMeshBounds(newImgW, newImgH)

  // Kích thước thực tế của vùng Alpha Mesh cũ trong không gian Xưởng / Cảnh (chưa nhân scale)
  const targetAlphaW = oldMeshW * Math.max(0.05, oldB.fillW)
  const targetAlphaH = oldMeshH * Math.max(0.05, oldB.fillH)

  // Kích thước pixel của vùng Alpha Mesh trong ảnh mới (VD trên ảnh 2K/4K)
  const newAlphaPxW = Math.max(1, newImgW * Math.max(0.05, newB.fillW))
  const newAlphaPxH = Math.max(1, newImgH * Math.max(0.05, newB.fillH))

  // Tỉ lệ quy đổi từ 1 pixel của ảnh mới sang đơn vị không gian Mesh
  const scalePerPxX = targetAlphaW / newAlphaPxW
  const scalePerPxY = targetAlphaH / newAlphaPxH

  // Dùng trung bình nhân (geometric mean) để:
  // 1) Khi ảnh 2K/4K là bản nâng cấp cùng tỉ lệ vật thể (dù khác lề trong suốt): scalePerPxX === scalePerPxY tuyệt đối!
  // 2) Khi thay bằng biến thể có dáng hơi khác (VD tóc dài hơn): giữ nguyên tỉ lệ khung ảnh mới (không bị kéo dãn méo hình)
  //    nhưng diện tích Alpha Mesh mới vẫn khớp 100% với diện tích Alpha Mesh cũ!
  const uniformScalePerPx = Math.sqrt(scalePerPxX * scalePerPxY)

  const meshWidth = Math.max(1, Math.round(newImgW * uniformScalePerPx))
  const meshHeight = Math.max(1, Math.round(newImgH * uniformScalePerPx))

  // Tính vị trí điểm đặc trưng của Alpha Mesh so với tâm mặt phẳng [-meshW/2 .. +meshW/2]
  const oldRefU = anchor === 'left' ? oldB.u0 : anchor === 'right' ? oldB.u1 : oldB.centerU
  const newRefU = anchor === 'left' ? newB.u0 : anchor === 'right' ? newB.u1 : newB.centerU
  const oldRefV = anchor === 'bottom' ? oldB.bottomV : anchor === 'top' ? oldB.v0 : oldB.centerV
  const newRefV = anchor === 'bottom' ? newB.bottomV : anchor === 'top' ? newB.v0 : newB.centerV

  const oldOffsetLocalX = (oldRefU - 0.5) * oldMeshW
  const newOffsetLocalX = (newRefU - 0.5) * meshWidth
  const oldOffsetLocalY = (oldRefV - 0.5) * oldMeshH
  const newOffsetLocalY = (newRefV - 0.5) * meshHeight

  const rawDeltaX = (oldOffsetLocalX - newOffsetLocalX) * scaleX
  const rawDeltaY = (oldOffsetLocalY - newOffsetLocalY) * scaleY

  const deltaX = Math.round(rawDeltaX * 100) / 100
  const deltaY = Math.round((invertY ? -rawDeltaY : rawDeltaY) * 100) / 100

  return {
    meshWidth,
    meshHeight,
    deltaX,
    deltaY,
    scaleRatioX: meshWidth / oldMeshW,
    scaleRatioY: meshHeight / oldMeshH,
    alphaMeshW: Math.round(meshWidth * newB.fillW * 100) / 100,
    alphaMeshH: Math.round(meshHeight * newB.fillH * 100) / 100
  }
}

/**
 * Đồng bộ lại định nghĩa `ImageMeshDefinition` (`layer.mesh`) khi mặt phẳng Mesh thay đổi kích thước
 * để các đỉnh `skin.positions` khớp với `surface.width × surface.height` mới mà không làm lệch khớp xương.
 */
export function syncImageMeshDefinition(
  meshDef: ImageMeshDefinition,
  newWidth: number,
  newHeight: number
): ImageMeshDefinition {
  const oldW = Math.max(1, meshDef.surface.width || newWidth)
  const oldH = Math.max(1, meshDef.surface.height || newHeight)
  if (Math.abs(oldW - newWidth) < 0.5 && Math.abs(oldH - newHeight) < 0.5) {
    return meshDef
  }
  const rx = newWidth / oldW
  const ry = newHeight / oldH
  const next = structuredClone(meshDef)
  next.surface.width = newWidth
  next.surface.height = newHeight

  if (next.skin && Array.isArray(next.skin.positions)) {
    const pos = next.skin.positions
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = Math.round(pos[i] * rx * 1000) / 1000
      pos[i + 1] = Math.round(pos[i + 1] * ry * 1000) / 1000
    }
  }
  return next
}

/**
 * Quy đổi cấu hình lưới cắt (`GridSlicerConfig`) theo tỉ lệ độ phân giải mới khi nâng cấp ảnh Sprite Sheet lên 2K / 4K.
 */
export function rescaleLoopGridConfig(
  grid: GridSlicerConfig,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): GridSlicerConfig {
  if (oldW <= 0 || oldH <= 0 || (oldW === newW && oldH === newH)) return { ...grid }
  const sx = newW / oldW
  const sy = newH / oldH
  const sUniform = (sx + sy) * 0.5
  return {
    ...grid,
    marginX: Math.round((grid.marginX || 0) * sx),
    marginY: Math.round((grid.marginY || 0) * sy),
    paddingX: Math.round((grid.paddingX || 0) * sx),
    paddingY: Math.round((grid.paddingY || 0) * sy),
    borderPadding: grid.borderPadding ? Math.max(1, Math.round(grid.borderPadding * sUniform)) : 0
  }
}

/**
 * Co giãn và căn chỉnh danh sách các khung hình `LoopFrameBox` theo tỉ lệ Mesh khi nâng cấp ảnh Sprite Sheet
 * lên độ phân giải cao (2K / 4K). Nếu truyền `newSourceCanvas` (đã tách nền), hàm sẽ đo tiếp Alpha Mesh bên trong
 * từng khung hình mới để tự động tinh chỉnh `offsetX, offsetY` giúp hoạt ảnh đứng vững, không bị rung giật.
 */
export function rescaleLoopFramesByMeshRatio(
  oldFrames: LoopFrameBox[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
  newSourceCanvas?: HTMLCanvasElement | null,
  alignAnchor: 'bottom' | 'center' = 'bottom',
  alphaThreshold = 16
): LoopFrameBox[] {
  if (oldFrames.length === 0) return []
  const safeOldW = Math.max(1, oldW || newW)
  const safeOldH = Math.max(1, oldH || newH)
  const sx = newW / safeOldW
  const sy = newH / safeOldH

  const scaled = oldFrames.map((f, idx) => {
    const x = Math.max(0, Math.min(newW - 1, Math.round(f.x * sx)))
    const y = Math.max(0, Math.min(newH - 1, Math.round(f.y * sy)))
    const width = Math.max(1, Math.min(newW - x, Math.round(f.width * sx)))
    const height = Math.max(1, Math.min(newH - y, Math.round(f.height * sy)))
    return {
      ...f,
      index: idx,
      x,
      y,
      width,
      height,
      offsetX: Math.round((f.offsetX || 0) * sx),
      offsetY: Math.round((f.offsetY || 0) * sy)
    }
  })

  if (!newSourceCanvas) return scaled

  if (!newSourceCanvas || newSourceCanvas.width <= 0 || newSourceCanvas.height <= 0) {
    return scaled
  }

  let scanCanvas = newSourceCanvas
  const maxScanDim = 1024
  if (
    typeof document !== 'undefined' &&
    (newSourceCanvas.width > maxScanDim || newSourceCanvas.height > maxScanDim)
  ) {
    const downScale = maxScanDim / Math.max(newSourceCanvas.width, newSourceCanvas.height)
    const sw = Math.max(1, Math.round(newSourceCanvas.width * downScale))
    const sh = Math.max(1, Math.round(newSourceCanvas.height * downScale))
    const proxy = document.createElement('canvas')
    proxy.width = sw
    proxy.height = sh
    const pctx = proxy.getContext('2d', { willReadFrequently: true })
    if (pctx) {
      pctx.drawImage(newSourceCanvas, 0, 0, sw, sh)
      scanCanvas = proxy
    }
  }

  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return scaled
  }

  const scanW = scanCanvas.width
  const scanH = scanCanvas.height
  const scanSX = scanW / Math.max(1, newW)
  const scanSY = scanH / Math.max(1, newH)
  const sheetData = ctx.getImageData(0, 0, scanW, scanH)
  const measured = scaled.map((f) => ({
    frame: f,
    bounds: computeAlphaMeshBoundsFromImageData(
      sheetData,
      {
        x: Math.round(f.x * scanSX),
        y: Math.round(f.y * scanSY),
        width: Math.max(1, Math.round(f.width * scanSX)),
        height: Math.max(1, Math.round(f.height * scanSY))
      },
      alphaThreshold
    )
  }))

  // Nếu các frame chưa có offset thủ công, tự động đồng bộ tâm ngang và chân đế Alpha Mesh giữa các frame 2K/4K
  const hasManualOffsets = oldFrames.some((f) => Math.abs(f.offsetX || 0) > 0 || Math.abs(f.offsetY || 0) > 0)
  if (hasManualOffsets) return scaled

  const avgCenterU =
    measured.reduce((acc, m) => acc + m.bounds.centerU, 0) / Math.max(1, measured.length)
  const avgRefV =
    alignAnchor === 'bottom'
      ? measured.reduce((acc, m) => acc + m.bounds.bottomV, 0) / Math.max(1, measured.length)
      : measured.reduce((acc, m) => acc + m.bounds.centerV, 0) / Math.max(1, measured.length)

  return measured.map(({ frame, bounds }) => {
    const refV = alignAnchor === 'bottom' ? bounds.bottomV : bounds.centerV
    const dx = Math.round((avgCenterU - bounds.centerU) * frame.width)
    const dy = Math.round((avgRefV - refV) * frame.height)
    return {
      ...frame,
      offsetX: dx,
      offsetY: dy
    }
  })
}

export interface RuntimeAlphaLike {
  meta: AssetMeta
  alpha?: { w: number; h: number; data: Uint8ClampedArray | Uint8Array }
}

/**
 * Áp dụng thay thế tài nguyên ảnh cho `ImageLayer` trên Cảnh với chế độ đồng bộ theo tỉ lệ Alpha Mesh (2K / 4K).
 * Bảo toàn kích thước hiển thị của hình dáng vật thể đục, tự động bù lệch tâm `(deltaX, deltaY)` và co giãn
 * đỉnh `layer.mesh` khớp xương.
 */
export function applyLayerAssetReplacementWithMeshSync(
  layer: ImageLayer,
  meta: AssetMeta,
  oldRuntime?: RuntimeAlphaLike,
  newRuntime?: RuntimeAlphaLike,
  options?: { syncByMesh?: boolean }
): void {
  const oldName = layer.name
  layer.props.assetId = meta.id

  const shouldSyncMesh =
    options?.syncByMesh !== false &&
    Boolean(
      options?.syncByMesh === true ||
        layer.mesh ||
        layer.composite ||
        layer.props.loopTemplateId ||
        (oldRuntime?.alpha && newRuntime?.alpha)
    )

  if (shouldSyncMesh) {
    const oldBounds = oldRuntime?.alpha
      ? computeAlphaMeshBoundsFromMask(oldRuntime.alpha, oldRuntime.meta.width, oldRuntime.meta.height)
      : null
    const newBounds = newRuntime?.alpha
      ? computeAlphaMeshBoundsFromMask(newRuntime.alpha, meta.width, meta.height)
      : null
    const synced = computeMeshSyncedReplacement({
      oldMeshW: layer.props.width,
      oldMeshH: layer.props.height,
      oldBounds,
      newBounds,
      newImgW: meta.width ?? layer.props.width,
      newImgH: meta.height ?? layer.props.height,
      scaleX: layer.transform.scale.value[0] ?? 1,
      scaleY: layer.transform.scale.value[1] ?? 1,
      anchor: 'center',
      invertY: true
    })
    layer.props.width = synced.meshWidth
    layer.props.height = synced.meshHeight

    if ((synced.deltaX !== 0 || synced.deltaY !== 0) && layer.transform.position.keyframes.length === 0) {
      layer.transform.position.value = [
        Math.round((layer.transform.position.value[0] + synced.deltaX) * 100) / 100,
        Math.round((layer.transform.position.value[1] + synced.deltaY) * 100) / 100,
        layer.transform.position.value[2]
      ]
      if (layer.composite?.rootOffset) {
        layer.composite.rootOffset = [
          Math.round((layer.composite.rootOffset[0] + synced.deltaX) * 100) / 100,
          Math.round((layer.composite.rootOffset[1] + synced.deltaY) * 100) / 100,
          layer.composite.rootOffset[2]
        ]
      }
    }
    if (layer.mesh) {
      layer.mesh = syncImageMeshDefinition(layer.mesh, synced.meshWidth, synced.meshHeight)
    }
  } else {
    layer.props.width = meta.width ?? layer.props.width
    layer.props.height = meta.height ?? layer.props.height
    if (layer.mesh) {
      layer.mesh = syncImageMeshDefinition(layer.mesh, layer.props.width, layer.props.height)
    }
  }

  if (oldName.includes('(phần') || oldName === 'Ảnh mới' || oldName.startsWith('Layer')) {
    layer.name = meta.name
  }
}
