import { describe, expect, it } from 'vitest'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import type { AssetMeta, ImageLayer } from '@shared/types'
import {
  applyLayerAssetReplacementWithMeshSync,
  computeAlphaMeshBoundsFromImageData,
  computeAlphaMeshBoundsFromMask,
  computeMeshSyncedReplacement,
  rescaleLoopFramesByMeshRatio,
  rescaleLoopGridConfig,
  syncImageMeshDefinition
} from './meshRatioSync'

function createRectAlphaMask(
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { w: number; h: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      data[y * w + x] = 255
    }
  }
  return { w, h, data }
}

describe('meshRatioSync — Đồng bộ ảnh nâng cấp 2K/4K theo tỉ lệ Alpha Mesh', () => {
  it('đo chính xác hộp bao Alpha Mesh từ mặt nạ kênh Alpha', () => {
    // Khung 100x100, vật thể đục nằm từ x=[20..80), y=[10..90)
    const mask = createRectAlphaMask(100, 100, 20, 10, 80, 90)
    const bounds = computeAlphaMeshBoundsFromMask(mask, 1000, 1000)

    expect(bounds.u0).toBeCloseTo(0.2, 4)
    expect(bounds.u1).toBeCloseTo(0.8, 4)
    expect(bounds.v0).toBeCloseTo(0.1, 4)
    expect(bounds.v1).toBeCloseTo(0.9, 4)
    expect(bounds.fillW).toBeCloseTo(0.6, 4)
    expect(bounds.fillH).toBeCloseTo(0.8, 4)
    expect(bounds.centerU).toBeCloseTo(0.5, 4)
    expect(bounds.centerV).toBeCloseTo(0.5, 4)
    expect(bounds.bottomV).toBeCloseTo(0.9, 4)
  })

  it('đo hộp bao Alpha Mesh cho từng vùng cắt (region) trên Sprite Sheet RGBA', () => {
    const sheetW = 200
    const sheetH = 100
    const rgba = new Uint8ClampedArray(sheetW * sheetH * 4)
    // Vẽ vật thể đục trong ô thứ 2 (x: 100..200, y: 0..100) tại vùng con (125..175, 20..80)
    for (let y = 20; y < 80; y++) {
      for (let x = 125; x < 175; x++) {
        const idx = (y * sheetW + x) * 4
        rgba[idx] = 255
        rgba[idx + 3] = 255
      }
    }

    const bounds = computeAlphaMeshBoundsFromImageData(
      { width: sheetW, height: sheetH, data: rgba },
      { x: 100, y: 0, width: 100, height: 100 }
    )
    expect(bounds.u0).toBeCloseTo(0.25, 4)
    expect(bounds.u1).toBeCloseTo(0.75, 4)
    expect(bounds.fillW).toBeCloseTo(0.5, 4)
    expect(bounds.fillH).toBeCloseTo(0.6, 4)
  })

  it('giữ nguyên kích thước mặt phẳng khi nâng cấp ảnh 512px lên 4096px (4K) cùng tỉ lệ lề', () => {
    const oldBounds = computeAlphaMeshBoundsFromMask(
      createRectAlphaMask(100, 100, 20, 10, 80, 90),
      512,
      512
    )
    const newBounds = computeAlphaMeshBoundsFromMask(
      createRectAlphaMask(100, 100, 20, 10, 80, 90),
      4096,
      4096
    )

    const res = computeMeshSyncedReplacement({
      oldMeshW: 300,
      oldMeshH: 300,
      oldBounds,
      newBounds,
      newImgW: 4096,
      newImgH: 4096
    })

    expect(res.meshWidth).toBe(300)
    expect(res.meshHeight).toBe(300)
    expect(res.deltaX).toBe(0)
    expect(res.deltaY).toBe(0)
  })

  it('đồng bộ chuẩn theo tỉ lệ Alpha Mesh và tự bù tâm khi ảnh 4K mới có viền trong suốt (canvas padding) khác ảnh cũ', () => {
    // Ảnh cũ 500x500: nhân vật chiếm 80% chiều rộng & cao (400x400), nằm chính giữa (u: 0.1..0.9, v: 0.1..0.9)
    const oldBounds = computeAlphaMeshBoundsFromMask(
      createRectAlphaMask(100, 100, 10, 10, 90, 90),
      500,
      500
    )
    // Ảnh 4K mới 2000x2000: có lề trong suốt rộng hơn, nhân vật chỉ chiếm 40% khổ ảnh (u: 0.4..0.8, v: 0.3..0.7)
    // và bị lệch sang phải (centerU = 0.6 thay vì 0.5)
    const newBounds = computeAlphaMeshBoundsFromMask(
      createRectAlphaMask(100, 100, 40, 30, 80, 70),
      2000,
      2000
    )

    const res = computeMeshSyncedReplacement({
      oldMeshW: 500,
      oldMeshH: 500,
      oldBounds,
      newBounds,
      newImgW: 2000,
      newImgH: 2000,
      scaleX: 1,
      scaleY: 1,
      anchor: 'center',
      invertY: false
    })

    // Để vùng Alpha Mesh mới (chiếm 40% mặt phẳng) bằng đúng vùng Alpha Mesh cũ (400x400),
    // mặt phẳng Mesh mới phải là 1000x1000 (40% của 1000 = 400!)
    expect(res.meshWidth).toBe(1000)
    expect(res.meshHeight).toBe(1000)
    expect(res.alphaMeshW).toBeCloseTo(400, 1)
    expect(res.alphaMeshH).toBeCloseTo(400, 1)
    // Tâm Alpha Mesh mới lệch phải +100px so với tâm mặt phẳng -> deltaX = -100 để nhân vật đứng yên tại chỗ!
    expect(res.deltaX).toBeCloseTo(-100, 1)
    expect(res.deltaY).toBeCloseTo(0, 1)
  })

  it('co giãn đỉnh skin.positions trong ImageMeshDefinition khớp với mặt phẳng Mesh mới', () => {
    const meshDef: ImageMeshDefinition = {
      version: 1,
      id: 'layer-1-skin',
      name: 'Body',
      surface: { width: 200, height: 400, subdivisions: [1, 1], restUVBounds: [0, 0, 1, 1] },
      anchorUV: [0.5, 0.5],
      modifiers: [],
      materials: {},
      skin: {
        rig: { bones: [], duration: 2, loop: true, tracks: {} },
        binding: { x: 0, y: 0, rotation: 0, scale: 1 },
        positions: [-100, -200, 0, 100, 200, 5],
        uvs: [0, 0, 1, 1],
        indices: [0, 1, 0]
      }
    }

    const updated = syncImageMeshDefinition(meshDef, 300, 600)
    expect(updated.surface.width).toBe(300)
    expect(updated.surface.height).toBe(600)
    expect(updated.skin?.positions).toEqual([-150, -300, 0, 150, 300, 5])
  })

  it('quy đổi lưới cắt và danh sách frame hoạt ảnh Loop khi nâng cấp Sprite Sheet lên 4K', () => {
    const grid = rescaleLoopGridConfig(
      { rows: 4, cols: 4, marginX: 8, marginY: 8, paddingX: 4, paddingY: 4, borderPadding: 2 },
      512,
      512,
      2048,
      2048
    )
    expect(grid.marginX).toBe(32)
    expect(grid.paddingX).toBe(16)
    expect(grid.borderPadding).toBe(8)

    const frames = rescaleLoopFramesByMeshRatio(
      [
        { id: 'f0', index: 0, x: 0, y: 0, width: 128, height: 128, offsetX: 5, offsetY: -3, durationRatio: 1, enabled: true },
        { id: 'f1', index: 1, x: 128, y: 0, width: 128, height: 128, offsetX: 0, offsetY: 0, durationRatio: 1, enabled: true }
      ],
      512,
      512,
      2048,
      2048
    )
    expect(frames[0]).toMatchObject({ x: 0, y: 0, width: 512, height: 512, offsetX: 20, offsetY: -12 })
    expect(frames[1]).toMatchObject({ x: 512, y: 0, width: 512, height: 512 })
  })

  it('applyLayerAssetReplacementWithMeshSync giữ nguyên kích thước Alpha Mesh trên cảnh khi thay ảnh 4K', () => {
    const layer = {
      id: 'layer-hero',
      name: 'Hero',
      type: 'image',
      visible: true,
      locked: false,
      inPoint: 0,
      outPoint: 5,
      shotId: 'shot-1',
      blendMode: 'normal',
      autoScale: false,
      props: { assetId: 'asset-old', width: 400, height: 400 },
      transform: {
        position: { value: [10, 20, 0], keyframes: [] },
        scale: { value: [1, 1, 1], keyframes: [] },
        rotation: { value: [0, 0, 0], keyframes: [] },
        opacity: { value: 1, keyframes: [] }
      }
    } as unknown as ImageLayer

    const oldMeta: AssetMeta = { id: 'asset-old', name: 'hero-sd.png', kind: 'image', mime: 'image/png', width: 400, height: 400 }
    const newMeta: AssetMeta = { id: 'asset-4k', name: 'hero-4k.png', kind: 'image', mime: 'image/png', width: 3840, height: 3840 }

    const oldRt = { meta: oldMeta, alpha: createRectAlphaMask(100, 100, 20, 20, 80, 80) }
    const newRt = { meta: newMeta, alpha: createRectAlphaMask(100, 100, 20, 20, 80, 80) }

    applyLayerAssetReplacementWithMeshSync(layer, newMeta, oldRt, newRt, { syncByMesh: true })

    expect(layer.props.assetId).toBe('asset-4k')
    expect(layer.props.width).toBe(400)
    expect(layer.props.height).toBe(400)
    expect(layer.transform.position.value).toEqual([10, 20, 0])
  })
})
