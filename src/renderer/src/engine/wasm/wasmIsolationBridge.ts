import type { DetectedIsland } from '../../ui/layerAssembly/cutter/types'
import { allocScratchViews, getWasmExports, resolveSlotView } from './wasmRuntime'

export interface WasmRawBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function wasmBoxBlur3(src: Float32Array, w: number, h: number): Float32Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_box_blur3) return null
  const total = w * h
  if (total <= 0 || src.length < total) return null

  const slots = allocScratchViews(exp, {
    src: { kind: 'f32', length: total },
    dst: { kind: 'f32', length: total }
  })
  slots.src.view.set(src.subarray(0, total))
  if (!exp.rust_box_blur3(slots.src.ptr, slots.dst.ptr, w, h)) return null

  const dstView = resolveSlotView(exp, slots.dst, 'f32', total)
  return new Float32Array(dstView)
}

export function wasmFloodFromBorder(
  passable: Uint8Array,
  w: number,
  h: number,
  extraSeed?: (p: number) => boolean
): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_flood_from_border) return null
  const total = w * h
  if (total <= 0 || passable.length < total) return null

  const slots = allocScratchViews(exp, {
    passable: { kind: 'u8', length: total },
    out: { kind: 'u8', length: total },
    ...(extraSeed ? { seed: { kind: 'u8', length: total } } : {})
  })
  slots.passable.view.set(passable.subarray(0, total))
  let seedPtr = 0
  if (extraSeed && 'seed' in slots && slots.seed) {
    const seedView = slots.seed.view
    for (let p = 0; p < total; p++) {
      seedView[p] = extraSeed(p) ? 1 : 0
    }
    seedPtr = slots.seed.ptr
  }

  if (!exp.rust_flood_from_border(slots.passable.ptr, seedPtr, slots.out.ptr, w, h)) return null
  const outView = resolveSlotView(exp, slots.out, 'u8', total)
  return new Uint8Array(outView)
}

export function wasmGrowMaskWithin(
  mask: Uint8Array,
  allowed: Uint8Array,
  w: number,
  h: number,
  steps: number
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_grow_mask_within) return false
  const total = w * h
  if (total <= 0 || mask.length < total || allowed.length < total) return false
  if (steps <= 0) return true

  const slots = allocScratchViews(exp, {
    mask: { kind: 'u8', length: total },
    allowed: { kind: 'u8', length: total }
  })
  slots.mask.view.set(mask.subarray(0, total))
  slots.allowed.view.set(allowed.subarray(0, total))
  if (!exp.rust_grow_mask_within(slots.mask.ptr, slots.allowed.ptr, w, h, steps)) return false

  const outView = resolveSlotView(exp, slots.mask, 'u8', total)
  mask.set(outView)
  return true
}

export function wasmDilateMaskBox(
  mask: Uint8Array,
  w: number,
  h: number,
  radius: number
): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_dilate_mask_box) return null
  const total = w * h
  if (total <= 0 || mask.length < total) return null

  const slots = allocScratchViews(exp, {
    mask: { kind: 'u8', length: total },
    out: { kind: 'u8', length: total }
  })
  slots.mask.view.set(mask.subarray(0, total))
  if (!exp.rust_dilate_mask_box(slots.mask.ptr, slots.out.ptr, w, h, radius)) return null

  const outView = resolveSlotView(exp, slots.out, 'u8', total)
  return new Uint8Array(outView)
}

export function wasmComputeChromaZone(
  data: Uint8ClampedArray,
  rawAlpha: Float32Array,
  w: number,
  h: number,
  keyFlags: number,
  wall: number,
  solidCut: number,
  band: number
): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_compute_chroma_zone) return null
  const total = w * h
  if (total <= 0 || data.length < total * 4 || rawAlpha.length < total) return null

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    rawAlpha: { kind: 'f32', length: total },
    zone: { kind: 'u8', length: total }
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  slots.rawAlpha.view.set(rawAlpha.subarray(0, total))

  const ok = exp.rust_compute_chroma_zone(
    slots.rgba.ptr,
    slots.rawAlpha.ptr,
    w,
    h,
    keyFlags,
    wall,
    solidCut,
    band,
    slots.zone.ptr
  )
  if (!ok) return null

  const zoneView = resolveSlotView(exp, slots.zone, 'u8', total)
  return new Uint8Array(zoneView)
}

export function wasmDisambiguateRegionPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  box: { x: number; y: number; width: number; height: number },
  siblings: Array<{ x: number; y: number; width: number; height: number }>,
  alphaThreshold: number,
  targetPref: number
): boolean | null {
  const exp = getWasmExports()
  if (!exp?.rust_disambiguate_region_pixels) return null
  const total = w * h
  if (total <= 0 || data.length < total * 4 || siblings.length === 0) return null

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    sibs: { kind: 'f32', length: siblings.length * 4 }
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  const sibView = slots.sibs.view
  for (let i = 0; i < siblings.length; i++) {
    const s = siblings[i]
    sibView[i * 4] = s.x
    sibView[i * 4 + 1] = s.y
    sibView[i * 4 + 2] = s.width
    sibView[i * 4 + 3] = s.height
  }

  const res = exp.rust_disambiguate_region_pixels(
    slots.rgba.ptr,
    w,
    h,
    box.x,
    box.y,
    box.width,
    box.height,
    slots.sibs.ptr,
    siblings.length,
    Math.max(0, Math.min(255, Math.trunc(alphaThreshold))),
    targetPref
  )
  if (res < 0) return null
  if (res === 1) {
    const rgbaView = resolveSlotView(exp, slots.rgba, 'u8', total * 4)
    data.set(rgbaView)
    return true
  }
  return false
}

export function wasmScanContourFloodBoxes(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  alphaThresh: number
): WasmRawBox[] | null {
  const exp = getWasmExports()
  if (!exp?.rust_scan_contour_flood_boxes) return null
  const total = w * h
  if (total <= 0 || rgba.length < total * 4) return null

  let maxBoxes = Math.max(4096, Math.ceil(total / 16))
  for (let attempt = 0; attempt < 2; attempt++) {
    const slots = allocScratchViews(exp, {
      rgba: { kind: 'u8', length: total * 4 },
      out: { kind: 'i32', length: maxBoxes * 4 }
    })
    slots.rgba.view.set(rgba.subarray(0, total * 4))
    const count = exp.rust_scan_contour_flood_boxes(
      slots.rgba.ptr,
      w,
      h,
      Math.max(1, Math.min(254, Math.trunc(alphaThresh))),
      slots.out.ptr,
      maxBoxes
    )
    if (count < -1) {
      maxBoxes = -count
      continue
    }
    if (count < 0) return null
    const outView = resolveSlotView(exp, slots.out, 'i32', maxBoxes * 4)
    const boxes: WasmRawBox[] = new Array(count)
    for (let i = 0; i < count; i++) {
      boxes[i] = {
        minX: outView[i * 4],
        minY: outView[i * 4 + 1],
        maxX: outView[i * 4 + 2],
        maxY: outView[i * 4 + 3]
      }
    }
    return boxes
  }
  return null
}

export function wasmScanRawIslandsFromData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  coordScale: number
): DetectedIsland[] | null {
  const exp = getWasmExports()
  if (!exp?.rust_scan_raw_islands) return null
  const total = width * height
  if (total <= 0 || data.length < total * 4) return null

  let maxIslands = Math.max(4096, Math.ceil(total / 16))
  for (let attempt = 0; attempt < 2; attempt++) {
    const slots = allocScratchViews(exp, {
      rgba: { kind: 'u8', length: total * 4 },
      out: { kind: 'i32', length: maxIslands * 5 }
    })
    slots.rgba.view.set(data.subarray(0, total * 4))
    const count = exp.rust_scan_raw_islands(
      slots.rgba.ptr,
      width,
      height,
      coordScale,
      slots.out.ptr,
      maxIslands
    )
    if (count < -1) {
      maxIslands = -count
      continue
    }
    if (count < 0) return null
    const outView = resolveSlotView(exp, slots.out, 'i32', maxIslands * 5)
    const result: DetectedIsland[] = new Array(count)
    for (let i = 0; i < count; i++) {
      const off = i * 5
      result[i] = {
        id: `raw-${i + 1}`,
        x: outView[off],
        y: outView[off + 1],
        width: outView[off + 2],
        height: outView[off + 3],
        area: outView[off + 4]
      }
    }
    return result
  }
  return null
}
