import { PXS_CORE_ACCEL_WASM_HEX } from './wasmBytes'
import {
  allocScratchViews,
  decodeWasmHexBytes,
  resolveSlotView,
  validatePxsWasmExports,
  type PxsWasmExports,
  type ScratchKind,
  type ScratchSlot,
  type ScratchSpec,
  type ScratchView
} from '@shared/pxsWasmExports'

export {
  allocScratchViews,
  resolveSlotView,
  type PxsWasmExports,
  type ScratchKind,
  type ScratchSlot,
  type ScratchSpec,
  type ScratchView
}

let cachedExports: PxsWasmExports | null = null
let loadPromise: Promise<boolean> | null = null
let initAttempted = false

function trySyncInit(): PxsWasmExports | null {
  if (cachedExports) return cachedExports
  if (initAttempted) return null
  initAttempted = true
  try {
    const bytes = decodeWasmHexBytes(PXS_CORE_ACCEL_WASM_HEX)
    const mod = new WebAssembly.Module(bytes as BufferSource)
    const inst = new WebAssembly.Instance(mod, {})
    cachedExports = validatePxsWasmExports(inst.exports)
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
      const bytes = decodeWasmHexBytes(PXS_CORE_ACCEL_WASM_HEX)
      const { instance } = await WebAssembly.instantiate(bytes as BufferSource, {})
      cachedExports = validatePxsWasmExports(instance.exports)
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
