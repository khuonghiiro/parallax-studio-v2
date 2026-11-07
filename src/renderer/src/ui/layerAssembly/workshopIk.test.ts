import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import { buildIkChain, chainPositions, ikChainIds, solveCcd, solveIkPose } from './workshopIk'

const rig = (): LayerRig => ({
  bones: [
    { id: 'root', name: 'Thân', x: 0, y: 0, length: 60, angle: -90 },
    { id: 'upper', name: 'Bắp tay', parentId: 'root', x: 0, y: -60, length: 100, angle: 0 },
    { id: 'lower', name: 'Cẳng tay', parentId: 'upper', x: 100, y: -60, length: 100, angle: 0 }
  ],
  tracks: {},
  duration: 2,
  loop: false
})

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('workshopIk', () => {
  it('chuỗi IK đi ngược từ xương cuối lên cha, giới hạn theo độ dài', () => {
    const ids = ikChainIds(rig(), 'lower', 2)
    expect(ids).toHaveLength(2)
    expect(ids).toContain('upper')
    expect(ids).toContain('lower')
    expect(ikChainIds(rig(), 'lower', 4)).toHaveLength(3)
    expect(ikChainIds(rig(), 'root', 3)).toEqual(['root'])
  })

  it('CCD đưa ngọn chuỗi tới điểm đích trong tầm với', () => {
    const chain = buildIkChain(rig(), 'lower', 2, 0)
    const start = chain.points[chain.points.length - 1]
    const base = chain.points[0]
    const target = { x: base.x + 90, y: base.y + 90 }
    expect(dist(start, target)).toBeGreaterThan(5)
    const deltas = solveCcd(chain, target, undefined, 60)
    const tip = chainPositions(chain, deltas).at(-1)!
    expect(dist(tip, target)).toBeLessThan(1.5)
  })

  it('điểm ngoài tầm với: chuỗi duỗi thẳng hướng về đích', () => {
    const chain = buildIkChain(rig(), 'lower', 2, 0)
    const base = chain.points[0]
    const target = { x: base.x + 1000, y: base.y }
    const tip = chainPositions(chain, solveCcd(chain, target, undefined, 60)).at(-1)!
    expect(dist(tip, base)).toBeCloseTo(200, 0)
    expect(Math.abs(tip.y - base.y)).toBeLessThan(3)
  })

  it('solveIkPose trả về góc xoay cho từng xương trong chuỗi', () => {
    const r = rig()
    const base = buildIkChain(r, 'lower', 2, 0).points[0]
    const rotations = solveIkPose(r, 0, 'lower', { x: base.x + 50, y: base.y + 120 }, 2)
    expect(rotations.map((x) => x.boneId).sort()).toEqual(['lower', 'upper'])
    expect(rotations.every((x) => Number.isFinite(x.rotation))).toBe(true)
  })

  it('bẻ cong tự nhiên chuỗi xương chân/tay thẳng đứng (90°) khi kéo thẳng Lên/Xuống dọc theo trục xương', () => {
    const verticalLegRig: LayerRig = {
      bones: [
        { id: 'torso', name: 'Thân', x: 0, y: -120, length: 180, angle: 90 },
        { id: 'thigh', name: 'Đùi', parentId: 'torso', x: -40, y: 60, length: 75, angle: 90 },
        { id: 'shin', name: 'Cẳng chân', parentId: 'thigh', x: -40, y: 135, length: 85, angle: 90 }
      ],
      tracks: {},
      duration: 2,
      loop: false
    }
    const chain = buildIkChain(verticalLegRig, 'shin', 2, 0)
    // Bàn chân đang ở (-40, 220); người dùng kéo thẳng LÊN trên tới (-40, 150)
    const targetUp = { x: -40, y: 150 }
    const deltas = solveCcd(chain, targetUp, undefined, 20)
    const tip = chainPositions(chain, deltas).at(-1)!
    expect(dist(tip, targetUp)).toBeLessThan(1.5)
    expect(Math.abs(deltas[0])).toBeGreaterThan(15)
    expect(Math.abs(deltas[1])).toBeGreaterThan(25)
  })
})
