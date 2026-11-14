import { beforeAll, describe, expect, it } from 'vitest'
import {
  ensureWasmAccelLoaded,
  isWasmAccelReady,
  wasmRgbaToYuv420p
} from '../wasmAccel'
import {
  wasmBoxBlur3,
  wasmScanContourFloodBoxes
} from './wasmIsolationBridge'
import {
  findOpaqueBoundingBox,
  findOpaqueBoundingBoxJs
} from '../../ui/layerAssembly/imageAutoTrim'
import {
  applyFastGreenDespill,
  applyFastGreenDespillJs,
  applyDefringeAndDespill,
  applyDefringeAndDespillJs,
  applyDespeckleAndWhiteCrumbs,
  applyDespeckleAndWhiteCrumbsJs,
  applyFeatherAndChoke,
  applyFeatherAndChokeJs,
  batchUnmixPixels,
  batchUnmixPixelsJs,
  classifyBackgroundPixels,
  classifyBackgroundPixelsJs,
  collectBoundaryIndices,
  collectBoundaryIndicesJs
} from '../../ui/layerAssembly/cutter/chromaAdvancedProcessor'
import {
  analyzeChromaAlpha,
  analyzeChromaAlphaJs,
  applySmoothEdgeFeather,
  applySmoothEdgeFeatherJs,
  dilateMaskBox,
  dilateMaskBoxJs
} from '../../ui/layerAssembly/cutter/chromaShadowExtractor'
import {
  computeChromaZone,
  computeChromaZoneJs,
  floodFromBorder,
  floodFromBorderJs,
  growMaskWithin,
  growMaskWithinJs
} from '../../ui/layerAssembly/cutter/chromaOuterIsolation'
import {
  disambiguateRegionPixels,
  disambiguateRegionPixelsJs
} from '../../ui/layerAssembly/cutter/islandDisambiguation'
import {
  scanRawIslandsFromData,
  scanRawIslandsFromDataJs
} from '../../ui/layerAssembly/cutter/chromaKey'
import { scanContourFloodBoxesJs } from '../../ui/loopAnimator/loopContourSlicer'
import type { ChromaKeySettings } from '../../ui/layerAssembly/cutter/types'

function makeTestRgba(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inBox = x >= 6 && x <= 18 && y >= 6 && y <= 18
      const inSecond = x >= 22 && x <= 28 && y >= 10 && y <= 16
      if (inBox) {
        data[i] = 190
        data[i + 1] = x === 6 || x === 18 ? 170 : 100
        data[i + 2] = 90
        data[i + 3] = x === 6 || y === 6 ? 180 : 255
      } else if (inSecond) {
        data[i] = 240
        data[i + 1] = 240
        data[i + 2] = 240
        data[i + 3] = 255
      } else {
        data[i] = 0
        data[i + 1] = 219
        data[i + 2] = 78
        data[i + 3] = 255
      }
    }
  }
  return data
}

const baseGreenSettings: ChromaKeySettings = {
  enabled: true,
  keyColorType: 'chroma_green',
  keyColorHex: '#00DB4E',
  tolerance: 40,
  smoothness: 6,
  despill: true,
  defringeStrength: 60,
  shadowMode: 'off',
  shadowType: 'auto',
  shadowRetention: 68,
  shadowSolidThreshold: 62,
  shadowUnmixColor: true,
  despeckleSize: 3,
  keepLargestIslandOnly: false,
  edgeChoke: 1,
  edgeSmooth: 0,
  strokeWidth: 0,
  strokeColorHex: '#ffffff',
  isolationMode: 'outer_only',
  strictOuterIsolation: true,
  removeSoftHalo: true,
  cleanupMode: 'all',
  previewMode: 'transparent',
  whiteSpeckleSensitivity: 30
}

describe('Rust WASM Stage 1 & Stage 2 JS Parity', () => {
  beforeAll(async () => {
    await ensureWasmAccelLoaded()
  })

  it('loads WASM runtime ready in Node/Vitest', () => {
    expect(isWasmAccelReady()).toBe(true)
  })

  it('matches Stage 1 bbox, fast green despill, and RGBA->YUV420p flipY', () => {
    const w = 32
    const h = 24
    const buf = new Uint8ClampedArray(w * h * 4)
    buf[(5 * w + 7) * 4 + 3] = 50
    buf[(17 * w + 25) * 4 + 3] = 255
    expect(findOpaqueBoundingBox(buf, w, h, 10)).toEqual(findOpaqueBoundingBoxJs(buf, w, h, 10))

    const a = makeTestRgba(w, h)
    const b = new Uint8ClampedArray(a)
    applyFastGreenDespill(a, w, h, 0.75)
    applyFastGreenDespillJs(b, w, h, 0.75)
    expect(Array.from(a)).toEqual(Array.from(b))

    const yuv = wasmRgbaToYuv420p(
      new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255]),
      2,
      2,
      undefined,
      true
    )
    expect(yuv).not.toBeNull()
    expect(Array.from(yuv!.subarray(0, 4))).toEqual([16, 16, 235, 235])
  })

  it('matches Stage 2A outer isolation, boxBlur3, dilate, disambiguation, contour & raw islands', () => {
    const w = 32
    const h = 24
    const total = w * h
    const srcBlur = new Float32Array(total)
    srcBlur[10 * w + 10] = 0.9
    srcBlur[10 * w + 11] = 0.6
    const blurWasm = wasmBoxBlur3(srcBlur, w, h)
    expect(blurWasm).not.toBeNull()
    expect(blurWasm![10 * w + 10]).toBeGreaterThan(0.1)

    const passable = new Uint8Array(total).fill(1)
    for (let y = 5; y <= 12; y++) {
      for (let x = 5; x <= 14; x++) {
        if (y === 5 || y === 12 || x === 5 || x === 14) passable[y * w + x] = 0
      }
    }
    const fWasm = floodFromBorder(passable, w, h)
    const fJs = floodFromBorderJs(passable, w, h)
    expect(Array.from(fWasm)).toEqual(Array.from(fJs))

    const gA = new Uint8Array(fWasm)
    const gB = new Uint8Array(fJs)
    const allowed = new Uint8Array(total).fill(1)
    growMaskWithin(gA, allowed, w, h, 2)
    growMaskWithinJs(gB, allowed, w, h, 2)
    expect(Array.from(gA)).toEqual(Array.from(gB))

    const mask = new Uint8Array(total)
    mask[10 * w + 10] = 1
    expect(Array.from(dilateMaskBox(mask, w, h, 2))).toEqual(Array.from(dilateMaskBoxJs(mask, w, h, 2)))

    const rgba = makeTestRgba(w, h)
    const keyRgb = { r: 0, g: 219, b: 78 }
    const analysisWasm = analyzeChromaAlpha(rgba, w, h, baseGreenSettings, keyRgb)
    const analysisJs = analyzeChromaAlphaJs(rgba, w, h, baseGreenSettings, keyRgb)
    expect(Array.from(computeChromaZone(analysisWasm, rgba, w, h, baseGreenSettings))).toEqual(
      Array.from(computeChromaZoneJs(analysisJs, rgba, w, h, baseGreenSettings))
    )

    // Contour & Raw Islands
    const cut = new Uint8ClampedArray(w * h * 4)
    for (let y = 3; y <= 7; y++) {
      for (let x = 3; x <= 7; x++) cut[(y * w + x) * 4 + 3] = 255
    }
    expect(wasmScanContourFloodBoxes(cut, w, h, 24)).toEqual(scanContourFloodBoxesJs(cut, w, h, 24))
    expect(scanRawIslandsFromData(cut, w, h, 2)).toEqual(scanRawIslandsFromDataJs(cut, w, h, 2))

    // Disambiguation
    const d1 = new Uint8ClampedArray(w * h * 4)
    const d2 = new Uint8ClampedArray(w * h * 4)
    for (let y = 8; y <= 14; y++) {
      for (let x = 2; x <= 6; x++) {
        d1[(y * w + x) * 4 + 3] = 255
        d2[(y * w + x) * 4 + 3] = 255
      }
      for (let x = 18; x <= 26; x++) {
        d1[(y * w + x) * 4 + 3] = 255
        d2[(y * w + x) * 4 + 3] = 255
      }
    }
    const sibs = [{ x: 0, y: 0, width: 12, height: h }]
    const target = { x: 0, y: 0, width: w, height: h }
    expect(disambiguateRegionPixels({ width: w, height: h, data: d1 } as ImageData, target, sibs)).toBe(
      disambiguateRegionPixelsJs({ width: w, height: h, data: d2 } as ImageData, target, sibs)
    )
    expect(Array.from(d1)).toEqual(Array.from(d2))
  })

  it('matches Stage 2B analysis, matte classify, unmix, feather/choke, defringe & despeckle', () => {
    const w = 32
    const h = 24
    const total = w * h
    const keyRgb = { r: 0, g: 219, b: 78 }
    const src = makeTestRgba(w, h)

    const aWasm = analyzeChromaAlpha(src, w, h, baseGreenSettings, keyRgb)
    const aJs = analyzeChromaAlphaJs(src, w, h, baseGreenSettings, keyRgb)
    expect(Math.abs(aWasm.measuredNoise - aJs.measuredNoise)).toBeLessThan(1e-5)
    for (let i = 0; i < total; i++) {
      expect(Math.abs(aWasm.rawAlpha[i] - aJs.rawAlpha[i])).toBeLessThan(1e-4)
      expect(Math.abs(aWasm.dirAlpha[i] - aJs.dirAlpha[i])).toBeLessThan(1e-4)
      expect(aWasm.isLight[i]).toBe(aJs.isLight[i])
    }

    const cWasm = classifyBackgroundPixels(src, total, baseGreenSettings, keyRgb)
    const cJs = classifyBackgroundPixelsJs(src, total, baseGreenSettings, keyRgb)
    expect(Array.from(cWasm.isBg)).toEqual(Array.from(cJs.isBg))
    expect(Array.from(cWasm.shadowAlpha)).toEqual(Array.from(cJs.shadowAlpha))

    const dWasm = new Uint8ClampedArray(src)
    const dJs = new Uint8ClampedArray(src)
    for (let p = 0; p < total; p++) {
      if (cWasm.isBg[p]) {
        dWasm[p * 4 + 3] = cWasm.shadowAlpha[p]
        dJs[p * 4 + 3] = cJs.shadowAlpha[p]
      }
    }
    const zone = computeChromaZone(aWasm, src, w, h, baseGreenSettings)
    batchUnmixPixels(dWasm, aWasm, zone, total, keyRgb)
    batchUnmixPixelsJs(dJs, aJs, zone, total, keyRgb)
    expect(Array.from(dWasm)).toEqual(Array.from(dJs))

    const snapW = new Uint8Array(total)
    const snapJ = new Uint8Array(total)
    expect(Array.from(collectBoundaryIndices(dWasm, w, h, snapW))).toEqual(
      Array.from(collectBoundaryIndicesJs(dJs, w, h, snapJ))
    )

    applyDefringeAndDespill(dWasm, w, h, baseGreenSettings, snapW, null, aWasm, keyRgb, zone)
    applyDefringeAndDespillJs(dJs, w, h, baseGreenSettings, snapJ, null, aJs, keyRgb, zone)
    expect(Array.from(dWasm)).toEqual(Array.from(dJs))

    applyFeatherAndChoke(dWasm, w, h, 4, 1, snapW, null)
    applyFeatherAndChokeJs(dJs, w, h, 4, 1, snapJ, null)
    expect(Array.from(dWasm)).toEqual(Array.from(dJs))

    applyDespeckleAndWhiteCrumbs(dWasm, w, h, baseGreenSettings, snapW, null)
    applyDespeckleAndWhiteCrumbsJs(dJs, w, h, baseGreenSettings, snapJ, null)
    expect(Array.from(dWasm)).toEqual(Array.from(dJs))

    applySmoothEdgeFeather(dWasm, w, h, 6, snapW, null)
    applySmoothEdgeFeatherJs(dJs, w, h, 6, snapJ, null)
    expect(Array.from(dWasm)).toEqual(Array.from(dJs))
  })
})
