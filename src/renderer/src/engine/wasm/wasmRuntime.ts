import { PXS_CORE_ACCEL_WASM_HEX } from './wasmBytes'

export interface PxsWasmExports {
  memory: WebAssembly.Memory
  wasm_scratch_reset: () => void
  wasm_scratch_reserve: (totalBytes: number) => void
  wasm_scratch_alloc: (byteLen: number, align: number) => number
  wasm_scratch_capacity: () => number
  rust_find_opaque_bbox?: (
    data: number,
    len: number,
    width: number,
    height: number,
    alphaThreshold: number,
    out: number
  ) => number
  rust_find_opaque_bbox_rect?: (
    data: number,
    len: number,
    width: number,
    height: number,
    rectX: number,
    rectY: number,
    rectW: number,
    rectH: number,
    alphaThreshold: number,
    inclusive: number,
    outI32: number
  ) => number
  rust_chroma_despill?: (
    data: number,
    len: number,
    width: number,
    height: number,
    greenFactor: number
  ) => number
  rust_rgba_to_yuv420p_ex?: (
    rgbaIn: number,
    rgbaLen: number,
    width: number,
    height: number,
    flipY: number,
    yuvOut: number,
    yuvLen: number
  ) => number
  rust_build_geodesic_skin_weights?: (
    worldPtr: number,
    vCount: number,
    bonesMetaPtr: number,
    boneCount: number,
    indicesPtr: number,
    indexCount: number,
    outIndicesPtr: number,
    outWeightsPtr: number
  ) => number
  rust_dominant_bone_per_triangle?: (
    indicesPtr: number,
    indexCount: number,
    vertBoneIndicesPtr: number,
    vertBoneWeightsPtr: number,
    vCount: number,
    outTriBonePtr: number
  ) => number
  rust_compute_mesh_corridor?: (
    worldPtr: number,
    vCount: number,
    indicesPtr: number,
    indexCount: number,
    polyPtsPtr: number,
    polyCount: number,
    reach: number,
    outWeightsPtr: number,
    outGeoDistPtr: number,
    outSegMinPtr: number,
    outSegMaxPtr: number,
    outAvgCoreEdgePtr: number
  ) => number
  rust_deform_skin?: (
    positionsPtr: number,
    outPtr: number,
    vCount: number,
    packedIndicesPtr: number,
    packedWeightsPtr: number,
    bonesTfPtr: number,
    boneCount: number,
    bindingMetaPtr: number,
    primaryBoneIdx: number,
    clothFactor: number
  ) => number
  rust_deform_plant_spines?: (
    positionsPtr: number,
    outPtr: number,
    vCount: number,
    worldPtr: number,
    useCachedWorld: number,
    projPtr: number,
    framesPtr: number,
    frameOffsetsPtr: number,
    spineCount: number,
    bindingMetaPtr: number
  ) => number
  rust_scale_unit_space?: (
    posInPtr: number,
    posOutPtr: number,
    vCount: number,
    invW: number,
    invH: number
  ) => number
  rust_apply_bend?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    width: number,
    height: number,
    axisCode: number,
    intensity: number,
    arcAngle: number,
    taperRatio: number,
    lateral: number,
    regionCode: number
  ) => number
  rust_apply_twist?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    angleDeg: number,
    center: number,
    falloff: number
  ) => number
  rust_apply_depth_profile?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    profileCode: number,
    intensity: number,
    invert: number
  ) => number
  rust_apply_curve?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    localPtsPtr: number,
    ptCount: number
  ) => number
  rust_apply_lattice?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    offsetsPtr: number
  ) => number
  rust_apply_brush?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    strokesPtr: number,
    strokeCount: number,
    width: number,
    height: number
  ) => number
  rust_apply_timeline_motion?: (
    posPtr: number,
    uvsPtr: number,
    count: number,
    motionCode: number,
    dirCode: number,
    speed: number,
    amplitude: number,
    time: number
  ) => number
  rust_box_blur3?: (srcPtr: number, dstPtr: number, w: number, h: number) => number
  rust_flood_from_border?: (
    passablePtr: number,
    seedPtr: number,
    outPtr: number,
    w: number,
    h: number
  ) => number
  rust_grow_mask_within?: (
    maskPtr: number,
    allowedPtr: number,
    w: number,
    h: number,
    steps: number
  ) => number
  rust_dilate_mask_box?: (
    maskPtr: number,
    outPtr: number,
    w: number,
    h: number,
    radius: number
  ) => number
  rust_compute_chroma_zone?: (
    rgbaPtr: number,
    rawAlphaPtr: number,
    w: number,
    h: number,
    keyFlags: number,
    wall: number,
    solidCut: number,
    band: number,
    zoneOutPtr: number
  ) => number
  rust_disambiguate_region_pixels?: (
    rgbaPtr: number,
    w: number,
    h: number,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    sibsPtr: number,
    sibCount: number,
    alphaThreshold: number,
    targetPref: number
  ) => number
  rust_scan_contour_flood_boxes?: (
    rgbaPtr: number,
    w: number,
    h: number,
    alphaThresh: number,
    outBoxesPtr: number,
    maxBoxes: number
  ) => number
  rust_scan_raw_islands?: (
    rgbaPtr: number,
    w: number,
    h: number,
    coordScale: number,
    outI32Ptr: number,
    maxIslands: number
  ) => number
}

export type ScratchKind = 'f32' | 'i32' | 'u32' | 'i16' | 'u8'

export interface ScratchSpec {
  kind: ScratchKind
  length: number
  align?: number
}

export type ScratchView<K extends ScratchKind> = K extends 'f32'
  ? Float32Array
  : K extends 'i32'
    ? Int32Array
    : K extends 'u32'
      ? Uint32Array
      : K extends 'i16'
        ? Int16Array
        : Uint8Array

export interface ScratchSlot<T extends ArrayBufferView> {
  ptr: number
  view: T
}

let cachedExports: PxsWasmExports | null = null
let loadPromise: Promise<boolean> | null = null
let initAttempted = false

function hexNibble(code: number): number {
  if (code >= 48 && code <= 57) return code - 48
  if (code >= 97 && code <= 102) return code - 87
  if (code >= 65 && code <= 70) return code - 55
  return 0
}

function decodeHexBytes(hex: string): Uint8Array {
  const len = hex.length >>> 1
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    const j = i * 2
    out[i] = (hexNibble(hex.charCodeAt(j)) << 4) | hexNibble(hex.charCodeAt(j + 1))
  }
  return out
}

function validateExports(raw: WebAssembly.Exports): PxsWasmExports | null {
  const exp = raw as unknown as Partial<PxsWasmExports>
  if (
    !(exp.memory instanceof WebAssembly.Memory) ||
    typeof exp.wasm_scratch_reset !== 'function' ||
    typeof exp.wasm_scratch_reserve !== 'function' ||
    typeof exp.wasm_scratch_alloc !== 'function' ||
    typeof exp.wasm_scratch_capacity !== 'function'
  ) {
    return null
  }
  return exp as PxsWasmExports
}

function trySyncInit(): PxsWasmExports | null {
  if (cachedExports) return cachedExports
  if (initAttempted) return null
  initAttempted = true
  try {
    const bytes = decodeHexBytes(PXS_CORE_ACCEL_WASM_HEX)
    const mod = new WebAssembly.Module(bytes as BufferSource)
    const inst = new WebAssembly.Instance(mod, {})
    cachedExports = validateExports(inst.exports)
    return cachedExports
  } catch {
    void ensureWasmAccelLoaded()
    return null
  }
}

/** Nạp bất đồng bộ module Rust WASM nếu môi trường chặn biên dịch đồng bộ trên main thread. */
export function ensureWasmAccelLoaded(): Promise<boolean> {
  if (cachedExports) return Promise.resolve(true)
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const bytes = decodeHexBytes(PXS_CORE_ACCEL_WASM_HEX)
      const { instance } = await WebAssembly.instantiate(bytes as BufferSource, {})
      cachedExports = validateExports(instance.exports)
      return cachedExports !== null
    } catch {
      return false
    }
  })()
  return loadPromise
}

export function isWasmAccelReady(): boolean {
  return (cachedExports ?? trySyncInit()) !== null
}

export function getWasmExports(): PxsWasmExports | null {
  return cachedExports ?? trySyncInit()
}

function elemByteSize(kind: ScratchKind): number {
  if (kind === 'i16') return 2
  if (kind === 'u8') return 1
  return 4
}

function buildTypedView(
  buffer: ArrayBuffer,
  ptr: number,
  kind: ScratchKind,
  length: number
): ArrayBufferView {
  switch (kind) {
    case 'f32':
      return new Float32Array(buffer, ptr, length)
    case 'i32':
      return new Int32Array(buffer, ptr, length)
    case 'u32':
      return new Uint32Array(buffer, ptr, length)
    case 'i16':
      return new Int16Array(buffer, ptr, length)
    case 'u8':
      return new Uint8Array(buffer, ptr, length)
  }
}

function nextPowerOfTwoAlign(align: number): number {
  let a = 16
  while (a < align && a < 1024) a <<= 1
  return a
}

/**
 * Cấp phát toàn bộ slot bộ nhớ scratch trong 1 lượt TRƯỚC khi tạo TypedArray view
 * nhằm tránh hoàn toàn lỗi detached ArrayBuffer hoặc dời Vec heap khi dung lượng tăng.
 */
export function allocScratchViews<T extends Record<string, ScratchSpec>>(
  exports: PxsWasmExports,
  specs: T
): { [K in keyof T]: ScratchSlot<ScratchView<T[K]['kind']>> } {
  exports.wasm_scratch_reset()
  const entries = Object.entries(specs) as Array<[keyof T, ScratchSpec]>
  let totalReserve = 0
  for (let i = 0; i < entries.length; i++) {
    const spec = entries[i][1]
    const align = nextPowerOfTwoAlign(spec.align ?? 16)
    const byteLen = Math.max(1, Math.max(0, spec.length) * elemByteSize(spec.kind))
    totalReserve += align + byteLen
  }
  exports.wasm_scratch_reserve(totalReserve)

  const ptrs = new Array<number>(entries.length)
  for (let i = 0; i < entries.length; i++) {
    const spec = entries[i][1]
    const byteLen = Math.max(0, spec.length) * elemByteSize(spec.kind)
    ptrs[i] = exports.wasm_scratch_alloc(byteLen, spec.align ?? 16)
  }

  const buffer = exports.memory.buffer
  const result = {} as { [K in keyof T]: ScratchSlot<ScratchView<T[K]['kind']>> }
  for (let i = 0; i < entries.length; i++) {
    const [key, spec] = entries[i]
    result[key] = {
      ptr: ptrs[i],
      view: buildTypedView(buffer, ptrs[i], spec.kind, Math.max(0, spec.length)) as ScratchView<
        T[typeof key]['kind']
      >
    }
  }
  return result
}

/**
 * Lấy lại TypedArray view an toàn sau lời gọi hàm WASM:
 * nếu Rust cấp phát heap và kích hoạt `memory.grow()` trong lúc chạy, buffer cũ sẽ bị detached.
 */
export function resolveSlotView<K extends ScratchKind>(
  exports: PxsWasmExports,
  slot: ScratchSlot<ScratchView<K>>,
  kind: K,
  length: number
): ScratchView<K> {
  const currentBuf = exports.memory.buffer
  if (slot.view.buffer === currentBuf) return slot.view
  return buildTypedView(currentBuf, slot.ptr, kind, Math.max(0, length)) as ScratchView<K>
}
