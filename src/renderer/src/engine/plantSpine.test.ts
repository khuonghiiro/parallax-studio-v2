import { describe, expect, it } from 'vitest'
import type { PlantSpine } from '@shared/plantSpine'
import { deformPlantSpines, evaluatePlantSpine, plantBendAngle, resamplePolyline, spinesForLayer } from './plantSpine'

const spine = (patch: Partial<PlantSpine> = {}): PlantSpine => ({
  id: 's1',
  name: 'Thân cây',
  points: [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 0, y: -100 }],
  layerIds: ['tree'],
  amplitude: 20,
  speed: 1,
  stiffness: 0,
  flexibility: 0,
  turbulence: 0,
  ...patch
})

const binding = { x: 0, y: 0, rotation: 0, scale: 1 }
/** Mesh cục bộ Y-up: đỉnh (0,-100) local = (0,100) composite (gốc), (0,100) local = ngọn. */
const mesh = new Float32Array([0, -100, 0, 0, 0, 0, 0, 100, 0, 30, 100, 0, 0, -140, 0])

describe('plantSpine engine', () => {
  it('resamples a hand-drawn stroke into evenly spaced points', () => {
    const pts = resamplePolyline([{ x: 0, y: 0 }, { x: 0, y: -90 }, { x: 0, y: -100 }], 10)
    expect(pts).toHaveLength(11)
    expect(pts[5].y).toBeCloseTo(-50, 5)
  })

  it('stays at rest at t=0 and bends most at the tip', () => {
    const s = spine()
    expect(plantBendAngle(s, 1, 0)).toBe(0)
    const t = 0.25 // sin(2π·0.25) = 1 → uốn cực đại
    expect(plantBendAngle(s, 1, t)).toBeCloseTo(20, 5)
    expect(Math.abs(plantBendAngle(s, 0.5, t))).toBeLessThan(20)
    expect(plantBendAngle(s, 0, t)).toBe(0)
  })

  it('stiffer stems bend less in the middle', () => {
    const soft = plantBendAngle(spine({ stiffness: 0 }), 0.5, 0.25)
    const stiff = plantBendAngle(spine({ stiffness: 1 }), 0.5, 0.25)
    expect(stiff).toBeLessThan(soft)
  })

  it('keeps the root fixed and moves the tip sideways when bent', () => {
    const frame = evaluatePlantSpine(spine(), 0.25)
    expect(frame.bent[0]).toEqual({ x: 0, y: 100 })
    const tip = frame.bent[frame.bent.length - 1]
    expect(tip.x).toBeGreaterThan(20) // góc dương (Y hướng xuống) xoay ngọn đang hướng lên sang phải
    expect(Math.hypot(tip.x, tip.y - 100)).toBeLessThanOrEqual(200.5) // không bị giãn dài
  })

  it('deforms mesh vertices: root and below stay still, tip and canopy above follow', () => {
    const out = deformPlantSpines(mesh, binding, [spine()], 0.25)
    expect(out[0]).toBeCloseTo(0, 5) // gốc
    expect(out[1]).toBeCloseTo(-100, 5)
    expect(out[6]).not.toBeCloseTo(0, 1) // ngọn dời ngang
    expect(out[12]).toBeCloseTo(0, 5) // dưới gốc (rễ) đứng yên
    expect(out[13]).toBeCloseTo(-140, 5)
    expect(deformPlantSpines(mesh, binding, [spine()], 0)).toEqual(mesh)
  })

  it('limits deformation to the reach radius', () => {
    const near = deformPlantSpines(mesh, binding, [spine({ reach: 20 })], 0.25)
    expect(near[9]).toBeCloseTo(30, 5) // đỉnh cách xương 30px > reach → đứng yên
    expect(near[6]).not.toBeCloseTo(0, 1)
  })

  it('selects only enabled spines bound to the layer', () => {
    const list = [spine(), spine({ id: 's2', enabled: false }), spine({ id: 's3', layerIds: ['grass'] })]
    expect(spinesForLayer(list, 'tree').map((s) => s.id)).toEqual(['s1'])
  })

  it('isolates deformation to only the drawn mesh strip among 3 parallel lines', () => {
    // 3 dải mesh song song tại x = -60, x = 0, x = +60 (mỗi dải gồm 4 đỉnh / 2 tam giác từ y_local=-50 đến +50)
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
    // Chỉ vẽ xương thực vật dọc theo đường kẻ 1 (x = -60, từ y_comp = 50 lên -50)
    const line1Spine = spine({
      id: 'line-1',
      points: [{ x: -60, y: 50 }, { x: -60, y: 0 }, { x: -60, y: -50 }],
      reach: 0
    })
    const out = deformPlantSpines(pos, binding, [line1Spine], 0.25, indices)

    // Ngọn đường kẻ 1 (đỉnh 2 & 3) phải chuyển động rõ rệt
    expect(Math.abs(out[2 * 3] - pos[2 * 3])).toBeGreaterThan(5)
    expect(Math.abs(out[3 * 3] - pos[3 * 3])).toBeGreaterThan(5)

    // Đường kẻ 2 (đỉnh 4..7) và đường kẻ 3 (đỉnh 8..11) không đụng tới → hoàn toàn đứng yên 100%
    for (let v = 4; v < 12; v++) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 6)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 6)
    }
  })

  it('isolates deformation to a single branch of a connected multi-branch tree mesh', () => {
    // Thân cây (0..3) nối chạc vào Nhánh trái (4..7) và Nhánh phải (8..11)
    const pos = new Float32Array([
      // Thân dưới: y_local từ -100 đến 0 (y_comp từ 100 lên 0)
      -5, -100, 0, 5, -100, 0, -5, 0, 0, 5, 0, 0,
      // Nhánh trái: từ chạc (-5,0)..(0,0) vươn lên (-80, 80) local = (-80, -80) comp
      -40, 40, 0, -32, 40, 0, -80, 80, 0, -72, 80, 0,
      // Nhánh phải: từ chạc (0,0)..(5,0) vươn lên (+80, 80) local = (+80, -80) comp
      32, 40, 0, 40, 40, 0, 72, 80, 0, 80, 80, 0
    ])
    const indices = [
      // Thân
      0, 1, 2, 1, 3, 2,
      // Nhánh trái nối từ đỉnh 2, 3 của thân
      2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6,
      // Nhánh phải nối từ đỉnh 2, 3 của thân
      2, 3, 8, 3, 9, 8, 8, 9, 10, 9, 11, 10
    ]
    // Vẽ nét theo hướng Nhánh trái: từ (-4, 0) lên (-76, -80) trong toạ độ composite (Y-down)
    const leftBranchSpine = spine({
      id: 'branch-left',
      points: [{ x: -4, y: 0 }, { x: -36, y: -40 }, { x: -76, y: -80 }],
      reach: 0
    })
    const out = deformPlantSpines(pos, binding, [leftBranchSpine], 0.25, indices)

    // Ngọn nhánh trái (đỉnh 6, 7) đung đưa
    expect(Math.hypot(out[6 * 3] - pos[6 * 3], out[6 * 3 + 1] - pos[6 * 3 + 1])).toBeGreaterThan(5)
    // Nhánh phải (đỉnh 8..11) và gốc thân cây (đỉnh 0, 1) không bị kéo theo
    for (const v of [0, 1, 8, 9, 10, 11]) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 5)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 5)
    }
  })

  it('carries attached child sub-branches (cành nhánh) along with the drawn main branch while keeping trunk and sibling branches still', () => {
    // Mô phỏng đúng sơ đồ cây của người dùng:
    // - Thân đen (0..3): từ y_local = -100 lên chạc gốc (0, 0)
    // - Cành đen bên phải tách từ chạc gốc (8..11): từ (0, 0) vươn sang phải lên (80, 60)
    // - Cành chính vẽ nét đỏ (4..7): từ chạc gốc (0, 0) vươn lên (-20, 50) rồi (-40, 100)
    // - Cành nhánh xanh 1 (12..13): mọc ra từ giữa cành đỏ (-20, 50) sang trái lên (-65, 75)
    // - Cành nhánh xanh 2 (14..15): mọc ra từ giữa cành đỏ (-14, 50) sang phải lên (20, 80)
    const pos = new Float32Array([
      // 0..3: Thân đen
      -5, -100, 0, 5, -100, 0, -5, 0, 0, 5, 0, 0,
      // 4..5: Giữa cành đỏ, 6..7: Ngọn cành đỏ
      -20, 50, 0, -14, 50, 0, -40, 100, 0, -34, 100, 0,
      // 8..11: Cành đen bên phải (tách ra ngay tại chạc gốc 2, 3)
      35, 30, 0, 42, 30, 0, 75, 60, 0, 82, 60, 0,
      // 12..13: Cành nhánh xanh 1 (mọc ra từ đỉnh 4, 6 của cành đỏ)
      -65, 72, 0, -60, 78, 0,
      // 14..15: Cành nhánh xanh 2 (mọc ra từ đỉnh 5, 7 của cành đỏ)
      20, 76, 0, 25, 82, 0
    ])
    const indices = [
      // Thân đen
      0, 1, 2, 1, 3, 2,
      // Cành chính đỏ nối từ chạc 2, 3 -> 4, 5 -> 6, 7
      2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6,
      // Cành đen bên phải nối từ chạc 2, 3 -> 8, 9 -> 10, 11
      2, 3, 8, 3, 9, 8, 8, 9, 10, 9, 11, 10,
      // Cành nhánh xanh 1 mọc từ giữa cành đỏ (đỉnh 4, 6)
      4, 6, 12, 6, 13, 12,
      // Cành nhánh xanh 2 mọc từ giữa cành đỏ (đỉnh 5, 7)
      5, 7, 14, 7, 15, 14
    ]
    // Chỉ vẽ nét đỏ dọc theo cành chính (từ chạc (0,0) lên (-17, -50) rồi (-37, -100) trong toạ độ Y-down)
    const redBranchSpine = spine({
      id: 'red-main-branch',
      points: [{ x: 0, y: 0 }, { x: -17, y: -50 }, { x: -37, y: -100 }],
      reach: 0
    })
    const out = deformPlantSpines(pos, binding, [redBranchSpine], 0.25, indices)

    // 1. Cành chính đỏ (đỉnh 6, 7) đung đưa
    expect(Math.hypot(out[6 * 3] - pos[6 * 3], out[6 * 3 + 1] - pos[6 * 3 + 1])).toBeGreaterThan(5)
    // 2. Cả 2 cành nhánh xanh (12..13 và 14..15) mọc ra từ cành đỏ PHẢI đi theo cành đỏ
    for (const v of [12, 13, 14, 15]) {
      expect(Math.hypot(out[v * 3] - pos[v * 3], out[v * 3 + 1] - pos[v * 3 + 1])).toBeGreaterThan(4)
    }
    // 3. Thân đen (0, 1) và cành đen bên phải (8..11) hoàn toàn đứng yên
    for (const v of [0, 1, 8, 9, 10, 11]) {
      expect(out[v * 3]).toBeCloseTo(pos[v * 3], 5)
      expect(out[v * 3 + 1]).toBeCloseTo(pos[v * 3 + 1], 5)
    }
  })

  it('verifies full contourMesh + deformPlantSpines on transparent multi-branch tree image', async () => {
    const { silhouetteFromMask } = await import('../ui/assets/models3d/silhouette')
    const { computeContourCells } = await import('../ui/assets/models3d/contourMesh')
    const { geometryFromLayerCells } = await import('../ui/layerAssembly/layerAssemblyAlphaMesh')
    const { computeMeshCorridor } = await import('./meshCorridor')

    // Dựng ảnh mask 420x460 quy về lưới 105x115 (4x downsample như silhouetteFromImage)
    const imgW = 420
    const imgH = 460
    const maskW = 105
    const maskH = 115
    const maskData = new Uint8Array(maskW * maskH)
    const drawCapsuleWorld = (x0: number, y0: number, x1: number, y1: number, radius: number): void => {
      const px0 = x0 + imgW / 2
      const py0 = y0 + imgH / 2
      const px1 = x1 + imgW / 2
      const py1 = y1 + imgH / 2
      const vx = px1 - px0
      const vy = py1 - py0
      const lenSq = vx * vx + vy * vy
      for (let my = 0; my < maskH; my++) {
        const py = (my + 0.5) * 4
        for (let mx = 0; mx < maskW; mx++) {
          const px = (mx + 0.5) * 4
          const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - px0) * vx + (py - py0) * vy) / lenSq)) : 0
          const d = Math.hypot(px - (px0 + t * vx), py - (py0 + t * vy))
          if (d <= radius) maskData[my * maskW + mx] = 1
        }
      }
    }

    // Thân cây chính + 2 cành lớn độc lập hai bên (kèm nhánh con riêng, không giao cắt với nhánh xanh phía trên)
    drawCapsuleWorld(0, 190, 0, 30, 11)
    drawCapsuleWorld(0, 30, -135, -55, 7.5)
    drawCapsuleWorld(-75, -12, -115, 0, 4.5)
    drawCapsuleWorld(0, 30, 145, -70, 7.5)
    drawCapsuleWorld(80, -20, 128, -8, 4.5)

    // Cành chính mục tiêu (nét vẽ xương sống) + 4 cành nhánh con + nhánh cháu
    drawCapsuleWorld(0, 30, -10, -35, 8.5)
    drawCapsuleWorld(-10, -35, -25, -100, 7.5)
    drawCapsuleWorld(-25, -100, -42, -160, 6.5)
    drawCapsuleWorld(-42, -160, -55, -198, 5.5)
    // Nhánh con 1 + nhánh cháu
    drawCapsuleWorld(-8, -22, 52, -110, 4.5)
    drawCapsuleWorld(22, -66, 58, -75, 3.5)
    // Nhánh con 2 + 2 nhánh cháu
    drawCapsuleWorld(-18, -70, -98, -135, 4.5)
    drawCapsuleWorld(-58, -102, -62, -148, 3.5)
    drawCapsuleWorld(-68, -110, -100, -100, 3.5)
    // Nhánh con 3 + nhánh cháu
    drawCapsuleWorld(-28, -112, 22, -188, 4.5)
    drawCapsuleWorld(-3, -150, 32, -162, 3.5)
    // Nhánh con 4
    drawCapsuleWorld(-38, -148, -80, -182, 4.5)

    const sil = silhouetteFromMask({ w: maskW, h: maskH, data: maskData }, true)
    const cells = computeContourCells(16, 20, sil, 0, true)
    const geom = geometryFromLayerCells(imgW, imgH, cells)
    const pos = geom.userData.basePositions as Float32Array
    const indices = geom.getIndex()!.array
    const vCount = pos.length / 3
    const world = new Float32Array(vCount * 2)
    for (let i = 0; i < vCount; i++) {
      world[i * 2] = pos[i * 3]
      world[i * 2 + 1] = -pos[i * 3 + 1]
    }
    const strokePts = [
      { x: 0, y: 30 },
      { x: -10, y: -35 },
      { x: -25, y: -100 },
      { x: -42, y: -160 },
      { x: -55, y: -198 }
    ]
    const pts = resamplePolyline(strokePts)
    const corr = computeMeshCorridor(world, indices, pts, 0)!
    const testSpine = spine({
      id: 's-red-branch',
      points: strokePts,
      amplitude: 0,
      lean: 28,
      stiffness: 0.35,
      reach: 0
    })
    const deformed = deformPlantSpines(pos, binding, [testSpine], 0, indices)

    // 1. Toàn bộ 8 ngọn cành nhánh & nhánh cháu mọc ra từ cành chính phải có weight = 1 và di chuyển theo cành chính
    for (const subTip of [
      { x: 52, y: -110 },
      { x: 58, y: -75 },
      { x: -98, y: -135 },
      { x: -100, y: -100 },
      { x: -65, y: -148 },
      { x: 22, y: -188 },
      { x: 32, y: -162 },
      { x: -80, y: -182 }
    ]) {
      let bestV = -1
      let bestD = Infinity
      for (let i = 0; i < vCount; i++) {
        const d = Math.hypot(world[i * 2] - subTip.x, world[i * 2 + 1] - subTip.y)
        if (d < bestD) {
          bestD = d
          bestV = i
        }
      }
      const dx = deformed[bestV * 3] - pos[bestV * 3]
      const dy = -(deformed[bestV * 3 + 1] - pos[bestV * 3 + 1])
      expect(corr.weights[bestV]).toBeCloseTo(1, 3)
      expect(Math.hypot(dx, dy)).toBeGreaterThan(8)
    }

    // 2. Thân cây và 2 cành lớn hai bên (cùng nhánh con của chúng) phải có weight = 0 và đứng yên 100%
    for (const stillPt of [
      { x: 0, y: 180 },
      { x: -125, y: -65 },
      { x: -115, y: 5 },
      { x: 145, y: -85 },
      { x: 135, y: -10 }
    ]) {
      let bestV = -1
      let bestD = Infinity
      for (let i = 0; i < vCount; i++) {
        const d = Math.hypot(world[i * 2] - stillPt.x, world[i * 2 + 1] - stillPt.y)
        if (d < bestD) {
          bestD = d
          bestV = i
        }
      }
      const dx = deformed[bestV * 3] - pos[bestV * 3]
      const dy = -(deformed[bestV * 3 + 1] - pos[bestV * 3 + 1])
      expect(corr.weights[bestV]).toBe(0)
      expect(Math.hypot(dx, dy)).toBeCloseTo(0, 5)
    }
  })
})

