import { beforeAll, describe, expect, it } from 'vitest'
import type { ImageMeshModifier, MeshMotionConfig } from '@shared/imageMeshDefinition'
import type { LayerRig } from '@shared/layerRig'
import type { PlantSpine } from '@shared/plantSpine'
import { evaluateMeshModifiersInPlaceJs } from '../imageMesh/evaluateDeformation'
import { deformSkin, deformSkinJs, type SkinBinding, type SkinInfluence } from '../layerSkinning'
import { computeMeshCorridor, computeMeshCorridorJs } from '../meshCorridor'
import {
  buildGeodesicSkinWeights,
  buildGeodesicSkinWeightsJs,
  computeDominantBonePerTriangle,
  computeDominantBonePerTriangleJs
} from '../meshGeodesicSkinning'
import { deformPlantSpines, deformPlantSpinesJs } from '../plantSpine'
import { wasmEvaluateMeshModifiers } from './wasmDeformBridge'
import { ensureWasmAccelLoaded, getWasmExports, isWasmAccelReady } from './wasmRuntime'

function createGrid(cols: number, rows: number, width: number, height: number) {
  const count = cols * rows
  const positions = new Float32Array(count * 3)
  const world = new Float32Array(count * 2)
  const uvs = new Float32Array(count * 2)
  const idxList: number[] = []
  for (let r = 0; r < rows; r++) {
    const v = rows > 1 ? r / (rows - 1) : 0
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0
      const i = r * cols + c
      const x = (u - 0.5) * width
      const y = (v - 0.5) * height
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      world[i * 2] = x
      world[i * 2 + 1] = -y
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
      if (r < rows - 1 && c < cols - 1) {
        const tl = i, tr = i + 1, bl = i + cols, br = i + cols + 1
        idxList.push(tl, tr, bl, tr, br, bl)
      }
    }
  }
  return { count, positions, world, uvs, indices: new Uint32Array(idxList) }
}

function createConcaveTrouserMesh() {
  const { world, indices } = createGrid(7, 7, 120, 120)
  const filtered: number[] = []
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2]
    const cy = (world[a * 2 + 1] + world[b * 2 + 1] + world[c * 2 + 1]) / 3
    const cx = (world[a * 2] + world[b * 2] + world[c * 2]) / 3
    // Khoét khe chữ V vùng chân dưới (y > -10 trong hệ Y-down, quanh x = 0)
    if (cy > -10 && Math.abs(cx) < 18) continue
    filtered.push(a, b, c)
  }
  const bones: LayerRig['bones'] = [
    { id: 'hip', name: 'Hip', x: 0, y: -42, length: 30, angle: 90, strength: 1.1 },
    { id: 'legL', name: 'LegL', parentId: 'hip', x: -32, y: -12, length: 58, angle: 92, strength: 1.2 },
    { id: 'legR', name: 'LegR', parentId: 'hip', x: 32, y: -12, length: 56, angle: 88, strength: 1.05 }
  ]
  return { world, indices: new Uint32Array(filtered), bones }
}

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let max = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > max) max = d
  }
  return max
}

function expectParity(actual: Float32Array, expected: Float32Array, tol: number, label: string): void {
  let max = 0, worstIdx = -1
  for (let i = 0; i < actual.length; i++) {
    const d = Math.abs(actual[i] - expected[i])
    if (d > max) { max = d; worstIdx = i }
  }
  if (max >= tol) {
    throw new Error(`${label}: maxDiff=${max} at idx=${worstIdx} (v=${Math.floor(worstIdx / 3)}): actual=${actual[worstIdx]}, expected=${expected[worstIdx]}`)
  }
}

function influenceWeightMap(infs: SkinInfluence[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const inf of infs) out[inf.id] = inf.weight
  return out
}

function makeBentKneeRig(isCloth = false): { rig: LayerRig; binding: SkinBinding } {
  const bones: LayerRig['bones'] = [
    { id: 'thigh', name: 'Thigh', x: 0, y: -70, length: 70, angle: 90 },
    { id: 'calf', name: 'Calf', parentId: 'thigh', x: 0, y: 0, length: 70, angle: 90 }
  ]
  const rig: LayerRig = {
    bones,
    duration: 2,
    loop: true,
    tracks: {
      thigh: [{ time: 0, x: 0, y: -70, rotation: 5, easing: 'linear' }],
      calf: [{ time: 0, x: 0, y: 0, rotation: 90, easing: 'linear' }]
    }
  }
  const binding: SkinBinding = {
    boneId: 'thigh',
    isCloth,
    clothAmplitude: isCloth ? 50 : undefined,
    x: 20,
    y: 5,
    rotation: -10,
    scale: 1.2,
    scaleX: 1.1,
    scaleY: 0.9,
    bindPose: { x: 12, y: -8, rotation: 15 }
  }
  return { rig, binding }
}

function makeDualSpines(): PlantSpine[] {
  return [
    {
      id: 'sp1',
      name: 'MainBranch',
      layerIds: ['layer1'],
      amplitude: 24,
      speed: 0.85,
      stiffness: 0.35,
      flexibility: 0.7,
      turbulence: 0.6,
      lean: 8,
      phaseOffset: 0.15,
      reach: 90,
      verticalBob: 0.25,
      points: [{ x: -18, y: 65 }, { x: -12, y: 0 }, { x: -6, y: -65 }]
    },
    {
      id: 'sp2',
      name: 'SideTwig',
      layerIds: ['layer1'],
      amplitude: 16,
      speed: 1.25,
      stiffness: 0.55,
      flexibility: 0.5,
      turbulence: 0.45,
      lean: -5,
      phaseOffset: 0.4,
      reach: 75,
      verticalBob: 0.15,
      points: [{ x: 14, y: 55 }, { x: 24, y: -5 }, { x: 32, y: -58 }]
    }
  ]
}

function buildAllModifiers(): ImageMeshModifier[] {
  const offsets: [number, number, number][] = Array.from({ length: 16 }, (_, idx) => {
    const col = idx % 4
    const row = (idx / 4) | 0
    return [(col - 1.5) * 4, (row - 1.5) * 3, Math.sin(idx * 0.8) * 14]
  })
  return [
    {
      type: 'bend',
      id: 'b1',
      enabled: true,
      axis: 'y',
      intensity: 32,
      arcAngle: 45,
      taperRatio: 0.7,
      lateral: 12,
      region: 'curl'
    },
    { type: 'twist', id: 't1', enabled: true, angle: 35, center: 0.4, falloff: 1.2 },
    { type: 'depthProfile', id: 'd1', enabled: true, profile: 'ridge', intensity: 40 },
    { type: 'depthProfile', id: 'd2', enabled: true, profile: 'sphere', intensity: 22, invert: true },
    {
      type: 'curve',
      id: 'c1',
      enabled: true,
      controlPoints: [
        { position: [0, 0, 0] },
        { position: [0.08, 0.35, 0.1] },
        { position: [-0.06, 0.7, 0.18] },
        { position: [0.12, 1.0, 0.25] }
      ]
    },
    { type: 'lattice', id: 'l1', enabled: true, dimensions: [4, 4, 1], offsets },
    {
      type: 'sculpt',
      id: 's1',
      enabled: true,
      strokes: [
        { uv: [0.5, 0.0], pressure: 1.0, radius: 0.5, mode: 'inflate' }, // Kiểm tra bảo vệ gốc v <= 0.01
        { uv: [0.45, 0.65], pressure: 0.8, radius: 0.38, mode: 'inflate' },
        { uv: [0.6, 0.5], pressure: 0.75, radius: 0.35, mode: 'grab', direction: [18, -10, 12] },
        { uv: [0.5, 0.55], pressure: 0.6, radius: 0.4, mode: 'smooth' }
      ]
    }
  ]
}

describe('Rust WASM Stage 3 Parity & Stability', () => {
  beforeAll(async () => {
    await ensureWasmAccelLoaded()
  })

  it('activates WASM SIMD128 runtime cleanly', () => {
    expect(isWasmAccelReady()).toBe(true)
    const exp = getWasmExports()
    expect(exp?.wasm_scratch_capacity).toBeTypeOf('function')
    expect(exp?.rust_scale_unit_space).toBeTypeOf('function')
  })

  it('matches geodesic skinning & dominant bone per triangle on concave trouser mesh', () => {
    const { world, indices, bones } = createConcaveTrouserMesh()
    const wasmW = buildGeodesicSkinWeights(world, bones, indices)!
    const jsW = buildGeodesicSkinWeightsJs(world, bones, indices)!
    expect(wasmW).not.toBeNull()
    expect(wasmW.length).toBe(jsW.length)
    for (let v = 0; v < jsW.length; v++) {
      const mW = influenceWeightMap(wasmW[v])
      const mJ = influenceWeightMap(jsW[v])
      for (const id of new Set([...Object.keys(mW), ...Object.keys(mJ)])) {
        expect(Math.abs((mW[id] ?? 0) - (mJ[id] ?? 0))).toBeLessThan(1e-4)
      }
    }
    expect(computeDominantBonePerTriangle(world, bones, indices)).toEqual(
      computeDominantBonePerTriangleJs(world, bones, indices)
    )
  })

  it('matches subtree mesh corridor weights, seg bounds and geodesic distances', () => {
    const { world, indices } = createGrid(9, 9, 160, 160)
    const polyline = [{ x: -45, y: 50 }, { x: -12, y: 8 }, { x: 24, y: -32 }, { x: 48, y: -62 }]
    const resWasm = computeMeshCorridor(world, indices, polyline, 55)!
    const resJs = computeMeshCorridorJs(world, indices, polyline, 55)!
    expect(resWasm).not.toBeNull()
    expect(maxAbsDiff(resWasm.weights, resJs.weights)).toBeLessThan(1e-4)
    expect(maxAbsDiff(resWasm.geoDist, resJs.geoDist)).toBeLessThan(1e-3)
    expect(Math.abs(resWasm.avgCoreEdge - resJs.avgCoreEdge)).toBeLessThan(1e-4)
    expect(Array.from(resWasm.segMin)).toEqual(Array.from(resJs.segMin))
    expect(Array.from(resWasm.segMax)).toEqual(Array.from(resJs.segMax))
  })

  it('matches per-frame deformSkin with 90° Sagitta bend, bindPose, and cloth mode', () => {
    const { positions, indices } = createGrid(7, 9, 100, 160)
    for (const isCloth of [false, true]) {
      const { rig, binding } = makeBentKneeRig(isCloth)
      const outWasm = deformSkin(positions, binding, rig, 0.25, indices)
      const outJs = deformSkinJs(positions, binding, rig, 0.25, indices)
      expectParity(outWasm, outJs, 1e-3, `deformSkin(isCloth=${isCloth})`)
    }
  })

  it('matches per-frame deformPlantSpines both standalone and chained after deformSkin', () => {
    const { positions, indices } = createGrid(7, 9, 120, 160)
    const { rig, binding } = makeBentKneeRig(false)
    const spines = makeDualSpines()

    // Case 1: cacheOwner === positions (cached world coordinates)
    const w1 = deformPlantSpines(positions, binding, spines, 0.73, indices)
    const j1 = deformPlantSpinesJs(positions, binding, spines, 0.73, indices)
    expect(maxAbsDiff(w1, j1)).toBeLessThan(1e-3)

    // Case 2: cacheOwner !== positions (chained after deformSkin)
    const skinnedW = deformSkin(positions, binding, rig, 0.4, indices)
    const skinnedJ = deformSkinJs(positions, binding, rig, 0.4, indices)
    const w2 = deformPlantSpines(skinnedW, binding, spines, 0.73, indices, positions)
    const j2 = deformPlantSpinesJs(skinnedJ, binding, spines, 0.73, indices, positions)
    expect(maxAbsDiff(w2, j2)).toBeLessThan(1e-3)
  })

  it('matches all 6 mesh modifiers, 4 timeline motions, and SIMD128 unitSpace on 35 vertices', () => {
    const { count, positions, uvs } = createGrid(5, 7, 140, 210)
    expect(count % 4).toBe(3) // Đảm bảo chạy cả SIMD128 và phần đuôi scalar
    const surface = { width: 140, height: 210, subdivisions: [4, 6] as [number, number], restUVBounds: [0, 0, 1, 1] as [number, number, number, number] }
    const modifiers = buildAllModifiers()

    for (const type of ['wind', 'wave', 'breathe', 'wiggle'] as const) {
      const motion: MeshMotionConfig = {
        type,
        speed: 1.5,
        amplitude: 14,
        direction: 'both',
        anchor: 'bottom'
      }
      const pWasm = new Float32Array(positions)
      const pJs = new Float32Array(positions)
      const ok = wasmEvaluateMeshModifiers(pWasm, uvs, count, modifiers, surface, motion, 0.65, true)
      expect(ok).toBe(true)
      evaluateMeshModifiersInPlaceJs(pJs, uvs, count, modifiers, surface, motion, 0.65, true)
      expect(maxAbsDiff(pWasm, pJs)).toBeLessThan(1e-3)
    }
  })

  it('handles 10,201-vertex memory.grow and keeps scratch capacity constant across 200 frames', () => {
    const { positions, world, indices } = createGrid(101, 101, 400, 400)
    const { rig, binding } = makeBentKneeRig(false)
    const exports = getWasmExports()!
    const weights = buildGeodesicSkinWeights(world, rig.bones, indices)
    expect(weights?.length).toBe(10201)

    const out = new Float32Array(positions.length)
    deformSkin(positions, binding, rig, 0.1, indices, out)
    const stableCapacity = exports.wasm_scratch_capacity()
    expect(stableCapacity).toBeGreaterThan(0)

    for (let iter = 2; iter <= 200; iter++) {
      rig.tracks.calf[0].rotation = 15 + (iter % 90)
      deformSkin(positions, binding, rig, 0.1, indices, out)
      expect(exports.wasm_scratch_capacity()).toBe(stableCapacity)
    }
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true)
    }
    const jsRef = deformSkinJs(positions, binding, rig, 0.1, indices)
    expectParity(out, jsRef, 1e-3, '10201-vertex stress')
  })
})
