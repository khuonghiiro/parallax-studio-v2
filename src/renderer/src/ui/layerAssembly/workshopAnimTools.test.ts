import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import { applyAnimTool, canBreakdown, keyTimes, neighborKeyTime } from './workshopAnimTools'

const rig = (loop = false): LayerRig => ({
  bones: [
    { id: 'body', name: 'Thân', x: 0, y: 0, length: 80, angle: -90 },
    { id: 'arm', name: 'Tay', parentId: 'body', x: 0, y: -80, length: 60, angle: 0 },
    { id: 'hand', name: 'Bàn tay', parentId: 'arm', x: 60, y: -80, length: 30, angle: 0 }
  ],
  tracks: {
    body: [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'ease-in' },
      { time: 1, x: 10, y: 0, rotation: 40, easing: 'smooth' }
    ],
    arm: [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
      { time: 0.5, x: 0, y: 0, rotation: 20, easing: 'smooth' },
      { time: 1, x: 0, y: 0, rotation: 0, easing: 'smooth' }
    ],
    hand: [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
      { time: 0.5, x: 0, y: 0, rotation: 30, easing: 'smooth' },
      { time: 1, x: 0, y: 0, rotation: 0, easing: 'smooth' }
    ]
  },
  duration: 2,
  loop
})

describe('điều hướng key', () => {
  it('liệt kê và nhảy key trước / sau (toàn clip hoặc một xương)', () => {
    const r = rig()
    expect(keyTimes(r)).toEqual([0, 0.5, 1])
    expect(neighborKeyTime(r, 0.2, 1)).toBe(0.5)
    expect(neighborKeyTime(r, 0.2, -1)).toBe(0)
    expect(neighborKeyTime(r, 0.2, 1, 'body')).toBe(1)
    expect(neighborKeyTime(r, 1, 1)).toBeNull()
  })
})

describe('breakdown', () => {
  it('chèn dáng trung gian theo tỉ lệ nghiêng về key sau', () => {
    const r = rig()
    expect(canBreakdown(r, 0.25)).toBe(true)
    const n = applyAnimTool(r, { op: 'breakdown', time: 0.25, favor: 0.25 })
    expect(n).toBe(3)
    const body = r.tracks.body.find((k) => k.time === 0.25)!
    expect(body.rotation).toBeCloseTo(10)
    expect(body.x).toBeCloseTo(2.5)
    expect(body.easing).toBe('ease-in')
    expect(r.tracks.arm.find((k) => k.time === 0.25)!.rotation).toBeCloseTo(5)
  })
  it('không làm gì ngoài vùng giữa 2 key', () => {
    const r = rig()
    expect(canBreakdown(r, 1.5)).toBe(false)
    expect(applyAnimTool(r, { op: 'breakdown', time: 1.5, favor: 0.5 })).toBe(0)
  })
})

describe('close-loop / retime / reverse / shift-time', () => {
  it('khép vòng lặp: key cuối clip trùng dáng đầu và bật lặp', () => {
    const r = rig()
    applyAnimTool(r, { op: 'close-loop' })
    expect(r.loop).toBe(true)
    const last = r.tracks.body.at(-1)!
    expect(last.time).toBe(2)
    expect(last.rotation).toBe(0)
  })
  it('co giãn thời gian nhân thời điểm mọi key và thời lượng', () => {
    const r = rig()
    applyAnimTool(r, { op: 'retime', factor: 1.5 })
    expect(r.duration).toBe(3)
    expect(r.tracks.arm.map((k) => k.time)).toEqual([0, 0.75, 1.5])
  })
  it('đảo ngược: thứ tự key lật lại và ease-in thành ease-out', () => {
    const r = rig()
    applyAnimTool(r, { op: 'reverse' })
    expect(r.tracks.body.map((k) => k.time)).toEqual([1, 2])
    expect(r.tracks.body[0].rotation).toBe(40)
    expect(r.tracks.body[0].easing).toBe('ease-out')
  })
  it('chèn rồi bớt thời gian tại đầu phát', () => {
    const r = rig()
    applyAnimTool(r, { op: 'shift-time', from: 0.25, delta: 0.5 })
    expect(r.tracks.arm.map((k) => k.time)).toEqual([0, 1, 1.5])
    expect(r.duration).toBe(2.5)
    applyAnimTool(r, { op: 'shift-time', from: 0.25, delta: -0.5 })
    expect(r.tracks.arm.map((k) => k.time)).toEqual([0, 0.5, 1])
    expect(r.duration).toBe(2)
  })
})

describe('overlap (follow-through)', () => {
  it('xương con trễ theo cấp, xương gốc giữ nguyên', () => {
    const r = rig(true)
    const before = structuredClone(r.tracks.body)
    expect(applyAnimTool(r, { op: 'overlap', rootBoneId: 'body', delay: 0.1 })).toBe(2)
    expect(r.tracks.body).toEqual(before)
    expect(r.tracks.arm.some((k) => Math.abs(k.time - 0.6) < 1e-6 && k.rotation === 20)).toBe(true)
    expect(r.tracks.hand.some((k) => Math.abs(k.time - 0.7) < 1e-6 && k.rotation === 30)).toBe(true)
    expect(r.tracks.hand[0].time).toBe(0)
    expect(r.tracks.hand.at(-1)!.time).toBe(2)
  })
  it('báo lỗi khi xương gốc không tồn tại', () => {
    expect(() => applyAnimTool(rig(), { op: 'overlap', rootBoneId: 'nope', delay: 0.1 })).toThrow()
  })
})
