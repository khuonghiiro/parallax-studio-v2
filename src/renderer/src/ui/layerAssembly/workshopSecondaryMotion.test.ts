import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { DEFAULT_SECONDARY, bakeSecondaryMotion, secondaryBoneIds, simulateSecondary } from './workshopSecondaryMotion'

const rig = (): LayerRig => ({
  bones: [
    { id: 'body', name: 'Thân', x: 0, y: 0, length: 80, angle: -90 },
    { id: 'hair1', name: 'Tóc 1', parentId: 'body', x: 0, y: -80, length: 50, angle: 90 },
    { id: 'hair2', name: 'Tóc 2', parentId: 'hair1', x: 0, y: -30, length: 50, angle: 90 }
  ],
  tracks: {
    body: [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
      { time: 0.4, x: 0, y: 0, rotation: 35, easing: 'smooth' },
      { time: 0.8, x: 0, y: 0, rotation: -10, easing: 'smooth' },
      { time: 1.5, x: 0, y: 0, rotation: 0, easing: 'smooth' }
    ]
  },
  duration: 1.5,
  loop: false
})

const comp = (): LayerComposite => ({ id: 'c', name: 'Nhân vật', category: 'character', width: 400, height: 400, layers: [], rig: rig() })

describe('workshopSecondaryMotion', () => {
  it('chọn nhánh: xương gốc (tuỳ chọn) + toàn bộ con cháu', () => {
    expect(secondaryBoneIds(rig(), 'hair1', true)).toEqual(['hair1', 'hair2'])
    expect(secondaryBoneIds(rig(), 'hair1', false)).toEqual(['hair2'])
    expect(secondaryBoneIds(rig(), 'body', false)).toEqual(['hair1', 'hair2'])
  })

  it('mô phỏng tạo độ lệch quán tính khi xương cha chuyển động, giới hạn theo maxAngle', () => {
    const offsets = simulateSecondary(rig(), ['hair1', 'hair2'], { ...DEFAULT_SECONDARY, maxAngle: 30 })
    const series = offsets.get('hair2')!
    expect(series.length).toBeGreaterThan(10)
    const peak = Math.max(...series.map(Math.abs))
    expect(peak).toBeGreaterThan(0.5)
    expect(peak).toBeLessThanOrEqual(30.001)
  })

  it('nướng thành keyframe cho cả nhánh (thay key cũ) trong một lần', () => {
    const r = bakeSecondaryMotion(comp(), 'hair1', DEFAULT_SECONDARY)
    expect(r.boneIds).toEqual(['hair1', 'hair2'])
    expect(r.keyCount).toBeGreaterThan(2)
    const tracks = r.composite.rig!.tracks
    expect(tracks.hair2.length).toBeGreaterThan(1)
    expect(tracks.hair2.some((k) => Math.abs(k.rotation) > 0.3)).toBe(true)
    expect(tracks.body).toHaveLength(4)
  })

  it('báo lỗi khi nhánh không có xương nào để mô phỏng', () => {
    expect(() => bakeSecondaryMotion(comp(), 'hair2', { ...DEFAULT_SECONDARY, includeRoot: false })).toThrow()
    expect(() => bakeSecondaryMotion(comp(), 'missing', DEFAULT_SECONDARY)).toThrow()
  })
})
