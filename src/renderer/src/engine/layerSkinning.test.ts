import { describe, expect, it } from 'vitest'
import { deformSkin, skinBones, skinWeights } from './layerSkinning'
import { evaluateRig, transformRigLayer } from './layerRig'
import { createHumanoidBones, createSimpleChainBones, generateSway, generateWalkCycle } from '../ui/layerAssembly/workshopRigPresets'
import type { LayerRig } from '@shared/layerRig'

const rig: LayerRig = { duration: 2, loop: false, bones: [
  { id: 'root', name: 'Root', x: 0, y: 0, angle: 90, length: 50 },
  { id: 'tip', name: 'Tip', parentId: 'root', x: 0, y: 50, angle: 90, length: 50 },
  { id: 'other', name: 'Other', x: 0, y: 90, angle: 0, length: 100 }
], tracks: { tip: [{ time: 0, x: 0, y: 0, rotation: 60, easing: 'linear' }] } }
const binding = { boneId: 'root', x: 0, y: 0, rotation: 0, scale: 1 }

describe('2D mesh skinning', () => {
  it('does not add sibling branches when including the immediate parent', () => {
    const humanoid = { bones: createHumanoidBones(), duration: 1, loop: false, tracks: {} }
    expect(skinBones(humanoid, 'bone-arm-l').map((b) => b.id).sort()).toEqual(
      ['bone-arm-l', 'bone-forearm-l', 'bone-hand-l', 'bone-torso'].sort())
  })
  it('normalizes weights and excludes unrelated branches', () => {
    const weights = skinWeights(0, 75, skinBones(rig, 'root'))
    expect(weights.map((w) => w.id)).not.toContain('other')
    expect(weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1)
  })
  it('preserves transformed rest geometry and never accumulates deformation', () => {
    const rest = { ...rig, tracks: {} }
    const points = new Float32Array([12, -40, 0, 0, -100, 0])
    const bind = { ...binding, x: 80, y: 20, rotation: 35, scale: 2, scaleX: -1, scaleY: 0.7 }
    deformSkin(points, bind, rest, 0).forEach((value, i) => expect(value).toBeCloseTo(points[i], 5))
    expect(deformSkin(points, binding, rig, 0)).toEqual(deformSkin(points, binding, rig, 0))
    expect([...points]).toEqual([12, -40, 0, 0, -100, 0])
  })
  it('bends the tip while keeping the root nearly fixed', () => {
    const result = deformSkin(new Float32Array([0, 0, 0, 0, -100, 0]), binding, rig, 0)
    expect(Math.abs(result[0])).toBeLessThan(0.1)
    expect(result[3]).toBeLessThan(-40)
    expect(result[4]).toBeGreaterThan(-80)
  })
  it('correctly deforms relative to animated layer transform with bindPose', () => {
    const singleRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [{ id: 'b1', name: 'Bone 1', x: 10, y: 20, angle: 0, length: 50 }],
      tracks: { b1: [{ time: 0.5, x: 25, y: -15, rotation: 30, easing: 'linear' }] }
    }
    const restBind = { boneId: 'b1', x: 10, y: 20, rotation: 0, scale: 1 }
    const points = new Float32Array([5, 10, 0, -5, -10, 0])

    // When the layer is transformed by the bone at t=0.5:
    // It should keep the same local coordinates because all vertices belong to bone b1 (rigid follower)
    const animLayer = {
      ...restBind,
      x: 35, // moved with bone
      y: 5,
      rotation: 30,
      bindPose: { x: 10, y: 20, rotation: 0 }
    }
    const deformed = deformSkin(points, animLayer, singleRig, 0.5)
    expect(deformed[0]).toBeCloseTo(points[0], 2)
    expect(deformed[1]).toBeCloseTo(points[1], 2)
    expect(deformed[3]).toBeCloseTo(points[3], 2)
    expect(deformed[4]).toBeCloseTo(points[4], 2)
  })

  it('tests 3-bone chain sway deforming mesh vertices smoothly', () => {
    const bones = createSimpleChainBones()
    const rig = { bones, duration: 2.0, loop: true, tracks: generateSway(bones, 2.0) }
    const layer = {
      id: 'tree-trunk',
      boneId: 'bone-chain-root',
      bindingMode: 'soft' as const,
      x: 0,
      y: 40,
      scale: 1,
      rotation: 0
    }
    // Vertices along trunk from base to tip:
    const geom = new Float32Array([0, -80, 0, 0, 0, 0, 0, 80, 0])
    const transforms = evaluateRig(rig, 1.0)
    const transformed = transformRigLayer(layer, transforms)
    const deformed = deformSkin(geom, { ...transformed, bindPose: { x: layer.x, y: layer.y, rotation: layer.rotation } }, rig, 1.0)
    // Base vertex (near root) should have minimal relative displacement
    // Tip vertex (near tip bone) should curve significantly
    expect(Math.abs(deformed[0])).toBeLessThan(25)
    expect(Math.abs(deformed[6])).toBeGreaterThan(10)
  })

  it('deforms only the targeted mesh line among 3 parallel lines when triangle indices are provided', () => {
    const xs = [-60, 0, 60]
    const verts: number[] = []
    const indices: number[] = []
    for (let s = 0; s < 3; s++) {
      const cx = xs[s]
      const base = s * 4
      verts.push(
        cx - 4, -50, 0,
        cx + 4, -50, 0,
        cx - 4, 50, 0,
        cx + 4, 50, 0
      )
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    }
    const pos = new Float32Array(verts)
    // Xương chỉ đặt trên đường kẻ 1 (x = -60, từ y_comp = 50 hướng lên -90° dài 100px)
    const lineRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [{ id: 'b-line1', name: 'Line 1', x: -60, y: 50, length: 100, angle: -90 }],
      tracks: { 'b-line1': [{ time: 0.5, x: 0, y: 0, rotation: 25, easing: 'linear' }] }
    }
    const out = deformSkin(
      pos,
      { boneId: 'b-line1', x: 0, y: 0, rotation: 0, scale: 1 },
      lineRig,
      0.5,
      indices
    )
    // Ngọn đường kẻ 1 (đỉnh 2, 3) xoay theo xương
    expect(Math.abs(out[2 * 3] - pos[2 * 3])).toBeGreaterThan(10)
    // Đường kẻ 2 (đỉnh 4..7) và đường kẻ 3 (đỉnh 8..11) không hề bị ảnh hưởng
    for (let v = 4; v < 12; v++) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 5)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 5)
    }
  })

  it('carries attached child sub-branches (cành nhánh) along with the rigged branch while keeping trunk and sibling branches still', () => {
    const pos = new Float32Array([
      // 0..3: Thân đen
      -5, -100, 0, 5, -100, 0, -5, 0, 0, 5, 0, 0,
      // 4..5: Giữa cành đỏ, 6..7: Ngọn cành đỏ
      -20, 50, 0, -14, 50, 0, -40, 100, 0, -34, 100, 0,
      // 8..11: Cành đen bên phải (tách ra tại chạc gốc 2, 3)
      35, 30, 0, 42, 30, 0, 75, 60, 0, 82, 60, 0,
      // 12..13: Cành nhánh xanh 1 (mọc ra từ cành đỏ)
      -65, 72, 0, -60, 78, 0,
      // 14..15: Cành nhánh xanh 2 (mọc ra từ cành đỏ)
      20, 76, 0, 25, 82, 0
    ])
    const indices = [
      0, 1, 2, 1, 3, 2,
      2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6,
      2, 3, 8, 3, 9, 8, 8, 9, 10, 9, 11, 10,
      4, 6, 12, 6, 13, 12,
      5, 7, 14, 7, 15, 14
    ]
    const branchRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [{ id: 'b-red', name: 'Red Branch', x: 0, y: 0, length: 106, angle: -110 }],
      tracks: { 'b-red': [{ time: 0.5, x: 0, y: 0, rotation: 20, easing: 'linear' }] }
    }
    const out = deformSkin(
      pos,
      { boneId: 'b-red', x: 0, y: 0, rotation: 0, scale: 1 },
      branchRig,
      0.5,
      indices
    )
    // Cành đỏ (6, 7) và các cành nhánh xanh (12..15) đều xoay theo xương
    for (const v of [6, 7, 12, 13, 14, 15]) {
      expect(Math.hypot(out[v * 3] - pos[v * 3], out[v * 3 + 1] - pos[v * 3 + 1])).toBeGreaterThan(5)
    }
    // Thân đen (0, 1) và cành đen bên phải (8..11) đứng yên
    for (const v of [0, 1, 8, 9, 10, 11]) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 5)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 5)
    }
  })

  it('preserves joint volume and limb cross-section thickness at sharp 90-degree bend', () => {
    const legRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [
        { id: 'b-thigh', name: 'Thigh', x: 0, y: 0, length: 50, angle: 90 },
        { id: 'b-calf', name: 'Calf', parentId: 'b-thigh', x: 0, y: 50, length: 50, angle: 90 }
      ],
      tracks: {
        'b-calf': [{ time: 0.5, x: 0, y: 0, rotation: -90, easing: 'linear' }]
      }
    }
    const kneeVertex = new Float32Array([12, -50, 0])
    const out = deformSkin(
      kneeVertex,
      { boneId: 'b-thigh', x: 0, y: 0, rotation: 0, scale: 1 },
      legRig,
      0.5
    )
    const jointPos = { x: 0, y: -50 }
    const deformedRadius = Math.hypot(out[0] - jointPos.x, out[1] - jointPos.y)
    expect(deformedRadius).toBeGreaterThan(11.0)
    expect(deformedRadius).toBeLessThanOrEqual(13.0)
  })

  it('keeps the other branch of a V-shaped mesh completely still when deforming one branch', () => {
    // Mesh chữ V: 2 nhánh tách nhau ở đỉnh, chỉ gặp nhau tại đáy chạc (0, 0)
    const pos = new Float32Array([
      // 0, 1: Đáy chạc chữ V (tiếp giáp)
      -4, 0, 0, 4, 0, 0,
      // 2, 3: Giữa nhánh trái, 4, 5: Ngọn nhánh trái (x = -50..-40, y_mesh = -100)
      -26, 50, 0, -20, 50, 0, -52, 100, 0, -44, 100, 0,
      // 6, 7: Giữa nhánh phải, 8, 9: Ngọn nhánh phải (x = 40..50, y_mesh = -100)
      20, 50, 0, 26, 50, 0, 44, 100, 0, 52, 100, 0
    ])
    const indices = [
      // Nhánh trái
      0, 1, 2, 1, 3, 2,
      2, 3, 4, 3, 5, 4,
      // Nhánh phải
      0, 1, 6, 1, 7, 6,
      6, 7, 8, 7, 9, 8
    ]
    const vRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [
        { id: 'b-v-left', name: 'Nhánh Trái V', x: 0, y: 0, length: 111, angle: -115.6 },
        { id: 'b-v-right', name: 'Nhánh Phải V', x: 0, y: 0, length: 111, angle: -64.4 }
      ],
      tracks: {
        'b-v-left': [{ time: 0.5, x: 0, y: 0, rotation: 30, easing: 'linear' }]
      }
    }

    const out = deformSkin(
      pos,
      { boneId: 'b-v-left', extraBoneIds: ['b-v-right'], x: 0, y: 0, rotation: 0, scale: 1 },
      vRig,
      0.5,
      indices
    )

    // 1. Nhánh trái (đỉnh 4, 5) uốn rõ rệt theo xương trái
    expect(Math.hypot(out[4 * 3] - pos[4 * 3], out[4 * 3 + 1] - pos[4 * 3 + 1])).toBeGreaterThan(10)
    expect(Math.hypot(out[5 * 3] - pos[5 * 3], out[5 * 3 + 1] - pos[5 * 3 + 1])).toBeGreaterThan(10)

    // 2. Nhánh phải (đỉnh 6, 7, 8, 9) KHÔNG BỊ DÍNH MESH: đứng yên hoàn toàn!
    for (const v of [6, 7, 8, 9]) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 4)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 4)
    }
  })

  it('keeps left branch still when bending right bone in a connected V-chain (down to apex, up to right)', () => {
    // Mesh chữ V: 2 nhánh tách nhau ở đỉnh, chỉ gặp nhau tại đáy chạc (0, 0)
    const pos = new Float32Array([
      // 0, 1: Đáy chạc chữ V (tiếp giáp)
      -4, 0, 0, 4, 0, 0,
      // 2, 3: Giữa nhánh trái, 4, 5: Ngọn nhánh trái (x = -50..-40, y_mesh = -100)
      -26, 50, 0, -20, 50, 0, -52, 100, 0, -44, 100, 0,
      // 6, 7: Giữa nhánh phải, 8, 9: Ngọn nhánh phải (x = 40..50, y_mesh = -100)
      20, 50, 0, 26, 50, 0, 44, 100, 0, 52, 100, 0
    ])
    const indices = [
      0, 1, 2, 1, 3, 2,
      2, 3, 4, 3, 5, 4,
      0, 1, 6, 1, 7, 6,
      6, 7, 8, 7, 9, 8
    ]
    // Chuỗi xương hình V:
    // Đốt 1: từ ngọn trái (-48, -100) đi xuống đáy (0, 0)
    // Đốt 2: nối tiếp từ đuôi Đốt 1 tại (0, 0) đi lên ngọn phải (48, -100)
    // y_comp = -y_mesh, nên y_comp từ 100 xuống 0 -> dx = 48, dy = 100 -> angle = 64.4°
    const chainVRig: LayerRig = {
      duration: 1,
      loop: false,
      bones: [
        { id: 'b-down', name: 'Nhánh Trái Xuống', x: -48, y: -100, length: 111, angle: 64.4 },
        { id: 'b-up', name: 'Nhánh Phải Lên', parentId: 'b-down', x: 0, y: 0, length: 111, angle: -64.4 }
      ],
      // Chỉ xoay uốn Đốt 2 (nhánh PHẢI) 30 độ
      tracks: {
        'b-up': [{ time: 0.5, x: 0, y: 0, rotation: 30, easing: 'linear' }]
      }
    }

    const out = deformSkin(
      pos,
      { boneId: 'b-down', x: 0, y: 0, rotation: 0, scale: 1 },
      chainVRig,
      0.5,
      indices
    )

    // 1. Nhánh phải (đỉnh 8, 9) uốn rõ rệt theo Đốt 2
    expect(Math.hypot(out[8 * 3] - pos[8 * 3], out[8 * 3 + 1] - pos[8 * 3 + 1])).toBeGreaterThan(10)
    expect(Math.hypot(out[9 * 3] - pos[9 * 3], out[9 * 3 + 1] - pos[9 * 3 + 1])).toBeGreaterThan(10)

    // 2. Nhánh trái (đỉnh 2, 3, 4, 5) KHÔNG BỊ DÍNH MESH sang nhánh phải: đứng yên hoàn toàn!
    for (const v of [2, 3, 4, 5]) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 4)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 4)
    }
  })
})
