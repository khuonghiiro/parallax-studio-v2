import type { ChromaKeySettings } from '../../ui/layerAssembly/cutter/types'
import { buildChromaMatteParams } from '../../ui/layerAssembly/cutter/chromaMatte'
import {
  buildChromaAnalysisParams,
  finalizeChromaAnalysis,
  type ChromaAlphaAnalysis
} from '../../ui/layerAssembly/cutter/chromaShadowExtractor'
import { allocScratchViews, getWasmExports, resolveSlotView } from './wasmRuntime'

export function wasmAnalyzeChromaAlpha(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number }
): ChromaAlphaAnalysis | null {
  const exp = getWasmExports()
  if (!exp?.rust_analyze_chroma_alpha) return null
  const total = w * h
  if (total <= 0 || data.length < total * 4) return null

  const P = buildChromaAnalysisParams(settings, keyRgb)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    params: { kind: 'f32', length: 14 },
    rawAlpha: { kind: 'f32', length: total },
    dirAlpha: { kind: 'f32', length: total },
    isLight: { kind: 'u8', length: total },
    noise: { kind: 'f32', length: 1 }
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  slots.params.view.set([
    P.kr,
    P.kg,
    P.kb,
    P.invPosR,
    P.invPosG,
    P.invPosB,
    P.invNegR,
    P.invNegG,
    P.invNegB,
    P.kcr,
    P.kcg,
    P.kcb,
    P.kcLenSq,
    P.detailProtection
  ])
  const flags = (P.isChromaticKey ? 1 : 0) | ((P.shadowType & 3) << 1)
  const ok = exp.rust_analyze_chroma_alpha(
    slots.rgba.ptr,
    w,
    h,
    slots.params.ptr,
    flags,
    slots.rawAlpha.ptr,
    slots.dirAlpha.ptr,
    slots.isLight.ptr,
    slots.noise.ptr
  )
  if (!ok) return null

  const rawAlpha = new Float32Array(resolveSlotView(exp, slots.rawAlpha, 'f32', total))
  const dirAlpha = new Float32Array(resolveSlotView(exp, slots.dirAlpha, 'f32', total))
  const isLight = new Uint8Array(resolveSlotView(exp, slots.isLight, 'u8', total))
  const measuredNoise = resolveSlotView(exp, slots.noise, 'f32', 1)[0]
  return {
    ...finalizeChromaAnalysis(rawAlpha, dirAlpha, isLight, data, w, h, settings, keyRgb),
    measuredNoise
  }
}

export function wasmClassifyBgPixels(
  data: Uint8ClampedArray,
  totalPixels: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number },
  precomputedMatte?: Uint8Array | null
): { isBg: Uint8Array; shadowAlpha: Uint8Array } | null {
  const exp = getWasmExports()
  if (!exp?.rust_classify_bg_pixels) return null
  if (totalPixels <= 0 || data.length < totalPixels * 4) return null

  const P = buildChromaMatteParams(settings, keyRgb)
  const hasPre = Boolean(precomputedMatte && precomputedMatte.length >= totalPixels)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: totalPixels * 4 },
    mp: { kind: 'f32', length: 13 },
    isBg: { kind: 'u8', length: totalPixels },
    shadowAlpha: { kind: 'u8', length: totalPixels },
    ...(hasPre ? { pre: { kind: 'u8', length: totalPixels } } : {})
  })
  slots.rgba.view.set(data.subarray(0, totalPixels * 4))
  slots.mp.view.set([
    P.kr,
    P.kg,
    P.kb,
    P.keyDominance,
    P.kMean,
    P.kcr,
    P.kcg,
    P.kcb,
    P.kcLenSq,
    P.tolFactor,
    P.detailProtection,
    P.hardThreshold,
    P.transitionWidth
  ])
  let prePtr = 0
  if (hasPre && precomputedMatte && 'pre' in slots && slots.pre) {
    slots.pre.view.set(precomputedMatte.subarray(0, totalPixels))
    prePtr = slots.pre.ptr
  }

  const ok = exp.rust_classify_bg_pixels(
    slots.rgba.ptr,
    totalPixels,
    slots.mp.ptr,
    (P.mode & 3) | (P.chromatic ? 4 : 0),
    prePtr,
    hasPre ? 1 : 0,
    slots.isBg.ptr,
    slots.shadowAlpha.ptr
  )
  if (!ok) return null

  return {
    isBg: new Uint8Array(resolveSlotView(exp, slots.isBg, 'u8', totalPixels)),
    shadowAlpha: new Uint8Array(resolveSlotView(exp, slots.shadowAlpha, 'u8', totalPixels))
  }
}

export function wasmBatchUnmixPixels(
  data: Uint8ClampedArray,
  analysis: ChromaAlphaAnalysis,
  zone: Uint8Array,
  totalPixels: number,
  keyRgb: { r: number; g: number; b: number }
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_batch_unmix_pixels) return false
  if (totalPixels <= 0 || data.length < totalPixels * 4) return false

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: totalPixels * 4 },
    rawAlpha: { kind: 'f32', length: totalPixels },
    isLight: { kind: 'u8', length: totalPixels },
    zone: { kind: 'u8', length: totalPixels }
  })
  slots.rgba.view.set(data.subarray(0, totalPixels * 4))
  slots.rawAlpha.view.set(analysis.rawAlpha.subarray(0, totalPixels))
  slots.isLight.view.set(analysis.isLight.subarray(0, totalPixels))
  slots.zone.view.set(zone.subarray(0, totalPixels))

  const flags =
    (analysis.isGreenKey ? 1 : 0) |
    (analysis.isBlueKey ? 2 : 0) |
    (analysis.isMagentaKey ? 4 : 0)

  const ok = exp.rust_batch_unmix_pixels(
    slots.rgba.ptr,
    slots.rawAlpha.ptr,
    slots.isLight.ptr,
    slots.zone.ptr,
    totalPixels,
    keyRgb.r,
    keyRgb.g,
    keyRgb.b,
    flags
  )
  if (!ok) return false

  data.set(resolveSlotView(exp, slots.rgba, 'u8', totalPixels * 4))
  return true
}

export function wasmCollectBoundaryIndices(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): Int32Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_collect_boundary_indices) return null
  const total = w * h
  if (total <= 0 || data.length < total * 4) return null

  const hasEx = Boolean(excludeShadowMask && excludeShadowMask.length >= total)
  let maxOut = Math.min(total, Math.max(4096, (w + h) * 32))
  for (let attempt = 0; attempt < 2; attempt++) {
    const slots = allocScratchViews(exp, {
      rgba: { kind: 'u8', length: total * 4 },
      alphaSnap: { kind: 'u8', length: total },
      out: { kind: 'i32', length: maxOut },
      ...(hasEx ? { ex: { kind: 'u8', length: total } } : {})
    })
    slots.rgba.view.set(data.subarray(0, total * 4))
    let exPtr = 0
    if (hasEx && excludeShadowMask && 'ex' in slots && slots.ex) {
      slots.ex.view.set(excludeShadowMask.subarray(0, total))
      exPtr = slots.ex.ptr
    }

    const count = exp.rust_collect_boundary_indices(
      slots.rgba.ptr,
      w,
      h,
      exPtr,
      hasEx ? 1 : 0,
      slots.alphaSnap.ptr,
      slots.out.ptr,
      maxOut
    )
    if (count < -1) {
      maxOut = -count
      continue
    }
    if (count < 0) return null
    alphaSnap.set(resolveSlotView(exp, slots.alphaSnap, 'u8', total))
    return new Int32Array(resolveSlotView(exp, slots.out, 'i32', maxOut).subarray(0, count))
  }
  return null
}

export function wasmApplySmoothEdgeFeather(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_apply_smooth_edge_feather) return false
  const total = w * h
  if (total <= 0 || data.length < total * 4) return false

  const hasEx = Boolean(excludeShadowMask && excludeShadowMask.length >= total)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    alphaSnap: { kind: 'u8', length: total },
    ...(hasEx ? { ex: { kind: 'u8', length: total } } : {})
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  let exPtr = 0
  if (hasEx && excludeShadowMask && 'ex' in slots && slots.ex) {
    slots.ex.view.set(excludeShadowMask.subarray(0, total))
    exPtr = slots.ex.ptr
  }

  const ok = exp.rust_apply_smooth_edge_feather(
    slots.rgba.ptr,
    w,
    h,
    feather,
    slots.alphaSnap.ptr,
    exPtr,
    hasEx ? 1 : 0
  )
  if (!ok) return false

  data.set(resolveSlotView(exp, slots.rgba, 'u8', total * 4))
  alphaSnap.set(resolveSlotView(exp, slots.alphaSnap, 'u8', total))
  return true
}

export function wasmApplyFeatherAndChoke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  edgeChoke: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_apply_feather_and_choke) return false
  const total = w * h
  if (total <= 0 || data.length < total * 4) return false

  const hasEx = Boolean(excludeShadowMask && excludeShadowMask.length >= total)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    alphaSnap: { kind: 'u8', length: total },
    ...(hasEx ? { ex: { kind: 'u8', length: total } } : {})
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  let exPtr = 0
  if (hasEx && excludeShadowMask && 'ex' in slots && slots.ex) {
    slots.ex.view.set(excludeShadowMask.subarray(0, total))
    exPtr = slots.ex.ptr
  }

  const ok = exp.rust_apply_feather_and_choke(
    slots.rgba.ptr,
    w,
    h,
    feather,
    edgeChoke,
    slots.alphaSnap.ptr,
    exPtr,
    hasEx ? 1 : 0
  )
  if (!ok) return false

  data.set(resolveSlotView(exp, slots.rgba, 'u8', total * 4))
  alphaSnap.set(resolveSlotView(exp, slots.alphaSnap, 'u8', total))
  return true
}

export function wasmApplyDefringeAndDespill(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  strength: number,
  fringeRgb: { r: number; g: number; b: number },
  isGreenFringe: boolean,
  isBlueFringe: boolean,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null,
  analysis?: ChromaAlphaAnalysis,
  effectiveKeyRgb?: { r: number; g: number; b: number },
  zone?: Uint8Array
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_apply_defringe_and_despill) return false
  const total = w * h
  if (total <= 0 || data.length < total * 4) return false

  const hasEx = Boolean(excludeShadowMask && excludeShadowMask.length >= total)
  const hasAnalysis = Boolean(analysis && effectiveKeyRgb)
  const hasZone = Boolean(zone && zone.length >= total)

  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    params: { kind: 'f32', length: 7 },
    alphaSnap: { kind: 'u8', length: total },
    ...(hasEx ? { ex: { kind: 'u8', length: total } } : {}),
    ...(hasAnalysis ? { rawAlpha: { kind: 'f32', length: total }, isLight: { kind: 'u8', length: total } } : {}),
    ...(hasZone ? { zone: { kind: 'u8', length: total } } : {})
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  slots.params.view.set([
    strength,
    fringeRgb.r,
    fringeRgb.g,
    fringeRgb.b,
    effectiveKeyRgb?.r ?? 0,
    effectiveKeyRgb?.g ?? 0,
    effectiveKeyRgb?.b ?? 0
  ])
  let exPtr = 0
  if (hasEx && excludeShadowMask && 'ex' in slots && slots.ex) {
    slots.ex.view.set(excludeShadowMask.subarray(0, total))
    exPtr = slots.ex.ptr
  }
  let rawPtr = 0
  let lightPtr = 0
  if (hasAnalysis && analysis && 'rawAlpha' in slots && slots.rawAlpha && 'isLight' in slots && slots.isLight) {
    slots.rawAlpha.view.set(analysis.rawAlpha.subarray(0, total))
    slots.isLight.view.set(analysis.isLight.subarray(0, total))
    rawPtr = slots.rawAlpha.ptr
    lightPtr = slots.isLight.ptr
  }
  let zonePtr = 0
  if (hasZone && zone && 'zone' in slots && slots.zone) {
    slots.zone.view.set(zone.subarray(0, total))
    zonePtr = slots.zone.ptr
  }

  const flags =
    (isGreenFringe ? 1 : 0) |
    (isBlueFringe ? 2 : 0) |
    (analysis?.isGreenKey ? 4 : 0) |
    (analysis?.isBlueKey ? 8 : 0) |
    (analysis?.isMagentaKey ? 16 : 0)

  const ok = exp.rust_apply_defringe_and_despill(
    slots.rgba.ptr,
    w,
    h,
    slots.params.ptr,
    flags,
    slots.alphaSnap.ptr,
    exPtr,
    hasEx ? 1 : 0,
    rawPtr,
    lightPtr,
    hasAnalysis ? 1 : 0,
    zonePtr,
    hasZone ? 1 : 0
  )
  if (!ok) return false

  data.set(resolveSlotView(exp, slots.rgba, 'u8', total * 4))
  alphaSnap.set(resolveSlotView(exp, slots.alphaSnap, 'u8', total))
  return true
}

export function wasmApplyDespeckleAndWhiteCrumbs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  whiteSens: number,
  despeckleSize: number,
  keepLargest: boolean,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_apply_despeckle_and_crumbs) return false
  const total = w * h
  if (total <= 0 || data.length < total * 4) return false

  const hasEx = Boolean(excludeShadowMask && excludeShadowMask.length >= total)
  const slots = allocScratchViews(exp, {
    rgba: { kind: 'u8', length: total * 4 },
    alphaSnap: { kind: 'u8', length: total },
    ...(hasEx ? { ex: { kind: 'u8', length: total } } : {})
  })
  slots.rgba.view.set(data.subarray(0, total * 4))
  let exPtr = 0
  if (hasEx && excludeShadowMask && 'ex' in slots && slots.ex) {
    slots.ex.view.set(excludeShadowMask.subarray(0, total))
    exPtr = slots.ex.ptr
  }

  const ok = exp.rust_apply_despeckle_and_crumbs(
    slots.rgba.ptr,
    w,
    h,
    whiteSens,
    despeckleSize,
    keepLargest ? 1 : 0,
    slots.alphaSnap.ptr,
    exPtr,
    hasEx ? 1 : 0
  )
  if (!ok) return false

  data.set(resolveSlotView(exp, slots.rgba, 'u8', total * 4))
  alphaSnap.set(resolveSlotView(exp, slots.alphaSnap, 'u8', total))
  return true
}
