import {
  allocScratchViews,
  ensureWasmAccelLoaded,
  getWasmExports,
  isWasmAccelReady,
  resolveSlotView
} from './wasm/wasmRuntime'

export { ensureWasmAccelLoaded, getWasmExports, isWasmAccelReady }

export interface OpaqueBboxResult {
  minX: number
  minY: number
  maxX: number
  maxY: number
  found: boolean
}

export interface BboxSubRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Nạp sẵn module Rust WASM SIMD128 bất đồng bộ khi khởi động ứng dụng hoặc WebWorker.
 */
export function preloadWasmAccel(): Promise<boolean> {
  return ensureWasmAccelLoaded()
}

/**
 * Tìm bounding box pixel đục (RGB+Alpha) bằng Rust WASM SIMD128.
 * Trả về `null` nếu module WASM chưa sẵn sàng để caller tự chuyển về JS fallback.
 */
export function wasmFindOpaqueBbox(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 10,
  inclusive = false,
  subRect?: BboxSubRect
): OpaqueBboxResult | null {
  const exp = getWasmExports()
  if (!exp?.rust_find_opaque_bbox_rect) return null
  if (width <= 0 || height <= 0) return { minX: 0, minY: 0, maxX: -1, maxY: -1, found: false }

  const byteLen = width * height * 4
  if (data.length < byteLen) return null

  const rx = subRect ? Math.trunc(subRect.x) : 0
  const ry = subRect ? Math.trunc(subRect.y) : 0
  const rw = subRect ? Math.trunc(subRect.width) : width
  const rh = subRect ? Math.trunc(subRect.height) : height
  if (rw <= 0 || rh <= 0) {
    return { minX: 0, minY: 0, maxX: -1, maxY: -1, found: false }
  }

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: byteLen },
    out: { kind: 'i32', length: 5 }
  })
  slots.rgba.view.set(data.subarray(0, byteLen))

  const thresh = Math.max(0, Math.min(255, Math.trunc(alphaThreshold)))
  const ok = exp.rust_find_opaque_bbox_rect(
    slots.rgba.ptr,
    byteLen,
    width,
    height,
    rx,
    ry,
    rw,
    rh,
    thresh,
    inclusive ? 1 : 0,
    slots.out.ptr
  )
  if (!ok) return null

  const outView = resolveSlotView(exp, slots.out, 'i32', 5)
  const found = outView[4] !== 0
  return {
    minX: found ? outView[0] : 0,
    minY: found ? outView[1] : 0,
    maxX: found ? outView[2] : -1,
    maxY: found ? outView[3] : -1,
    found
  }
}

/**
 * Khử ám xanh lá nhanh trên mảng pixel RGBA bằng Rust WASM.
 * Trả về `false` nếu WASM chưa sẵn sàng.
 */
export function wasmChromaDespill(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  greenFactor: number
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_chroma_despill) return false
  if (width <= 0 || height <= 0) return false

  const byteLen = width * height * 4
  if (data.length < byteLen) return false

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: byteLen }
  })
  slots.rgba.view.set(data.subarray(0, byteLen))

  const ok = exp.rust_chroma_despill(slots.rgba.ptr, byteLen, width, height, greenFactor)
  if (!ok) return false

  const rgbaView = resolveSlotView(exp, slots.rgba, 'u8', byteLen)
  data.set(rgbaView.subarray(0, byteLen))
  return true
}

/**
 * Chuyển đổi RGBA sang Planar YUV420p (BT.601) bằng Rust WASM; hỗ trợ `flipY` cho frame WebGL.
 */
export function wasmRgbaToYuv420p(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  outYuv?: Uint8Array,
  flipY = false
): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_rgba_to_yuv420p_ex) return null
  if (width <= 0 || height <= 0 || width % 2 !== 0 || height % 2 !== 0) return null

  const rgbaLen = width * height * 4
  const yuvLen = (width * height * 3) / 2
  if (rgba.length < rgbaLen) return null

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
  if (!ok) return null

  const yuvView = resolveSlotView(exp, slots.yuv, 'u8', yuvLen)
  const dest = outYuv && outYuv.length >= yuvLen ? outYuv : new Uint8Array(yuvLen)
  dest.set(yuvView.subarray(0, yuvLen))
  return dest
}
