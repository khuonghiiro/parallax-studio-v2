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
})
