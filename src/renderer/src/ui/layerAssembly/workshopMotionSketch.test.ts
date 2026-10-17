import { describe, it, expect } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { sampleBonePose } from '../../engine/layerRig'
import {
  DEFAULT_SKETCH_SETTINGS,
  applyAutoBoneMotionSketch,
  applyMotionSketch,
  buildSketchKeyframes,
  createSketchAnchor,
  normalizeAngle,
  pickSketchBone,
  sketchPoseAt,
  type MotionSketchSettings,
  type SketchSample
} from './workshopMotionSketch'

const rig = (tracks: LayerRig['tracks'] = {}, duration = 2): LayerRig => ({
  bones: [
    { id: 'hip', name: 'Hông', x: 0, y: 0, length: 60, angle: -90 },
    { id: 'arm', name: 'Cánh tay', x: 0, y: 0, length: 100, angle: 0, parentId: 'hip' }
  ],
  tracks,
  duration,
  loop: false
})

const comp = (r: LayerRig): LayerComposite => ({ id: 'c', name: 'Test', category: 'character', width: 600, height: 600, layers: [], rig: r })

/** Cung tròn bán kính 100 quanh gốc từ góc a0 tới a1 (độ); timeOf(k) trả về thời điểm mẫu thứ k. */
function arc(a0: number, a1: number, count: number, timeOf: (k: number) => number = (k) => k / count): SketchSample[] {
  return Array.from({ length: count + 1 }, (_, k) => {
    const a = ((a0 + ((a1 - a0) * k) / count) * Math.PI) / 180
    return { x: 100 * Math.cos(a), y: 100 * Math.sin(a), t: timeOf(k) }
  })
}

const settings = (patch: Partial<MotionSketchSettings> = {}): MotionSketchSettings => ({ ...DEFAULT_SKETCH_SETTINGS, ...patch })

describe('workshopMotionSketch', () => {
  it('chuẩn hoá góc về [-180, 180)', () => {
    expect(normalizeAngle(270)).toBe(-90)
    expect(normalizeAngle(-270)).toBe(90)
    expect(normalizeAngle(360)).toBe(0)
  })

  it('chọn xương gần điểm nhấn nhất, bỏ qua khi quá xa', () => {
    expect(pickSketchBone(rig(), { x: 70, y: 6 }, 0)?.bone.id).toBe('arm')
    expect(pickSketchBone(rig(), { x: 4, y: -40 }, 0)?.bone.id).toBe('hip')
    expect(pickSketchBone(rig(), { x: 400, y: 400 }, 0)).toBeNull()
  })

  it('xoay xương theo hướng ngọn bút và mở vòng khi quay quá 180°', () => {
    const anchor = createSketchAnchor(rig(), 'arm', 0, { x: 100, y: 0 })
    expect(sketchPoseAt(anchor, { x: 0, y: 100 }, 'rotate').rotation).toBeCloseTo(90)
    let prev: number | undefined
    for (const s of arc(0, 270, 27)) prev = sketchPoseAt(anchor, s, 'rotate', prev).rotation
    expect(prev).toBeCloseTo(270)
  })

  it('nét đều tuyến tính chỉ cần 2 keyframe (đầu & cuối)', () => {
    const anchor = createSketchAnchor(rig(), 'arm', 0, { x: 100, y: 0 })
    const keys = buildSketchKeyframes(anchor, arc(0, 90, 30), settings({ timing: 'even' }), 0)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatchObject({ time: 0, rotation: 0 })
    expect(keys[1].time).toBe(1)
    expect(keys[1].rotation).toBeCloseTo(90, 0)
  })

  it('nhịp theo tay: vẽ chậm đoạn đầu thì động tác cũng chậm đoạn đầu', () => {
    // 90% thời gian vẽ dành cho 10% quãng đường đầu
    const slowStart = (k: number) => (k <= 3 ? (k / 3) * 0.9 : 0.9 + ((k - 3) / 27) * 0.1)
    const samples = arc(0, 90, 30, slowStart)
    const anchor = createSketchAnchor(rig(), 'arm', 0, { x: 100, y: 0 })
    const hand = applyMotionSketch(comp(rig()), anchor, samples, settings({ timing: 'hand' }), 0)
    const even = applyMotionSketch(comp(rig()), anchor, samples, settings({ timing: 'even' }), 0)
    const midHand = sampleBonePose({ ...hand.composite.rig!, loop: false }, 'arm', 0.5).rotation
    const midEven = sampleBonePose({ ...even.composite.rig!, loop: false }, 'arm', 0.5).rotation
    expect(midHand).toBeLessThan(15)
    expect(midEven).toBeGreaterThan(35)
  })

  it('khứ hồi: quay về tư thế cũ và tự nới thời lượng clip', () => {
    const anchor = createSketchAnchor(rig({}, 1.5), 'arm', 0.5, { x: 100, y: 0 })
    const result = applyMotionSketch(comp(rig({}, 1.5)), anchor, arc(0, 60, 20), settings({ loopBack: true, timing: 'even' }), 0.5)
    expect(result.endTime).toBeCloseTo(2.5)
    expect(result.composite.rig!.duration).toBeGreaterThanOrEqual(2.5)
    const r = { ...result.composite.rig!, loop: false }
    expect(sampleBonePose(r, 'arm', 1.5).rotation).toBeCloseTo(60, 0)
    expect(sampleBonePose(r, 'arm', 2.5).rotation).toBeCloseTo(0, 1)
  })

  it('xoá keyframe cũ nằm trong đoạn vẽ, giữ keyframe ngoài đoạn', () => {
    const old = rig({ arm: [
      { time: 0.5, x: 0, y: 0, rotation: 50, easing: 'smooth' },
      { time: 1.8, x: 0, y: 0, rotation: -20, easing: 'smooth' }
    ] })
    const anchor = createSketchAnchor(old, 'arm', 0, { x: 100, y: 0 })
    const result = applyMotionSketch(comp(old), anchor, arc(0, 90, 30), settings({ timing: 'even' }), 0)
    const times = result.composite.rig!.tracks.arm.map((k) => k.time)
    expect(times).not.toContain(0.5)
    expect(times).toContain(1.8)
  })

  it('chế độ Dời: khớp gốc dời theo nét vẽ', () => {
    const anchor = createSketchAnchor(rig(), 'hip', 0, { x: 0, y: -30 })
    const samples: SketchSample[] = Array.from({ length: 11 }, (_, k) => ({ x: k * 4, y: -30 + k * 2, t: k / 10 }))
    const keys = buildSketchKeyframes(anchor, samples, settings({ mode: 'move', timing: 'even' }), 0)
    expect(keys[0]).toMatchObject({ x: 0, y: 0 })
    expect(keys[keys.length - 1]).toMatchObject({ x: 40, y: 20 })
    expect(keys.every((k) => k.rotation === undefined)).toBe(true)
  })

  it('tự động tạo xương nhánh và gắn uốn mềm khi vẽ trực tiếp lên nhánh chưa có xương', () => {
    const emptyComp: LayerComposite = {
      id: 'tree-comp',
      name: 'Cây nhiều nhánh',
      category: 'nature',
      width: 600,
      height: 600,
      layers: [
        {
          id: 'layer-tree',
          name: 'tree_trunk_branches',
          x: 0,
          y: 0,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ]
    }
    const branchSamples: SketchSample[] = [
      { x: 10, y: -20, t: 0 },
      { x: 50, y: -60, t: 0.2 },
      { x: 90, y: -100, t: 0.4 }
    ]
    const res = applyAutoBoneMotionSketch(emptyComp, branchSamples, settings(), 0, 'layer-tree')
    expect(res.composite.rig?.bones).toHaveLength(1)
    expect(res.composite.layers[0].bindingMode).toBe('soft')
    expect(res.composite.layers[0].boneId).toBe(res.boneId)
    expect(res.keys.length).toBeGreaterThanOrEqual(3)
  })
})
