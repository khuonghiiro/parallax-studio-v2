import { describe, it, expect } from 'vitest'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import { exportAnimationClipToJson, parseAnimationClipFromJson } from './workshopClipJson'
import { buildMotionAuthoringGuide, MOTION_AI_GUIDE_VERSION, type MotionBoneTreeNode } from './workshopClipAiGuide'
import { finalizeTracksForPlayback, parseRawKeyframe } from './workshopClipSmoothing'

const bones: LayerBone[] = [
  { id: 'bone-pelvis', name: 'Hông', x: 0, y: 40, length: 20, angle: -90 },
  { id: 'bone-torso', name: 'Thân', parentId: 'bone-pelvis', x: 0, y: 20, length: 60, angle: -90 },
  { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -40, length: 30, angle: -90 },
  { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -20, y: -30, length: 40, angle: 90, minAngle: -30, maxAngle: 130 },
  { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 20, y: -30, length: 40, angle: 90 },
  { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -20, y: 10, length: 35, angle: 90 }
]

const clip: AnimationClip = {
  id: 'clip-1',
  name: 'Vẫy tay chào',
  duration: 1.6,
  loop: true,
  fps: 30,
  tracks: {
    'bone-arm-l': [
      { time: 0, x: 0, y: 0, rotation: 0, easing: 'smooth' },
      { time: 0.8, x: 0, y: 0, rotation: 90, easing: 'smooth' },
      { time: 1.6, x: 0, y: 0, rotation: 0, easing: 'smooth' }
    ]
  }
}

function findNode(nodes: MotionBoneTreeNode[], id: string): MotionBoneTreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = n.children ? findNode(n.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}

describe('workshopClipAiGuide — JSON cho AI khác hiểu cấu trúc cụm 2.5D', () => {
  it('JSON xuất đính kèm aiAuthoringGuide đứng TRƯỚC tracks với cây xương lồng nhau và hợp đồng đầu ra', () => {
    const json = exportAnimationClipToJson(clip, bones, true)
    const data = JSON.parse(json)
    const guide = data.aiAuthoringGuide
    expect(guide.guideVersion).toBe(MOTION_AI_GUIDE_VERSION)
    expect(Object.keys(data).indexOf('aiAuthoringGuide')).toBeLessThan(Object.keys(data).indexOf('tracks'))
    expect(guide.outputContract.allowedBoneIds.sort()).toEqual(bones.map((b) => b.id).sort())
    expect(guide.outputContract.requiredFields).toEqual(expect.arrayContaining(['format', 'tracks', 'duration']))
    expect(Object.keys(guide.keyframeSchema)).toEqual(
      expect.arrayContaining(['time', 'x', 'y', 'rotation', 'scaleX', 'scaleY', 'zOrder', 'easing', 'bezier'])
    )
    expect(guide.boneHierarchy).toHaveLength(1)
    expect(guide.boneHierarchy[0].id).toBe('bone-pelvis')
    const forearm = findNode(guide.boneHierarchy, 'bone-forearm-l')
    expect(forearm?.depth).toBe(3)
    expect(forearm?.suggestedPhaseDelaySec).toBeGreaterThan(0)
    expect(findNode(guide.boneHierarchy, 'bone-arm-l')?.rotationLimitDeg).toEqual({ min: -30, max: 130 })
    expect(guide.timing.minKeySpacingSec).toBeCloseTo(2 / 30, 3)
  })

  it('starterExample dùng id xương thật, vòng lặp khép kín và xương con trễ pha', () => {
    const guide = buildMotionAuthoringGuide(clip, bones, undefined, 'front')
    const ex = guide.starterExample
    const ids = Object.keys(ex.tracks)
    expect(ids.length).toBeGreaterThan(2)
    expect(ids.every((id) => bones.some((b) => b.id === id))).toBe(true)
    for (const id of ids) {
      const keys = ex.tracks[id]
      const first = keys[0]
      const last = keys[keys.length - 1]
      expect(first.time).toBe(0)
      expect(last.time).toBeCloseTo(ex.duration, 3)
      expect({ ...last, time: 0 }).toEqual(first)
      for (let i = 1; i < keys.length; i++) expect(keys[i].time).toBeGreaterThan(keys[i - 1].time)
    }
    const pelvisY = ex.tracks['bone-pelvis']?.map((k) => k.y)
    expect(pelvisY?.some((v) => v !== 0)).toBe(true)
  })

  it('tắt includeAiGuide thì không xuất khối hướng dẫn; JSON xuất vẫn nhập ngược lại được', () => {
    expect(JSON.parse(exportAnimationClipToJson(clip, bones, true, { includeAiGuide: false })).aiAuthoringGuide).toBeUndefined()
    const res = parseAnimationClipFromJson(exportAnimationClipToJson(clip, bones, true), bones, { autoFixBiomechanics: false })
    expect(res.success).toBe(true)
    expect(res.clip?.tracks['bone-arm-l']).toHaveLength(3)
  })

  it('AI trả về đúng starterExample → nhập thành công, không cảnh báo giật', () => {
    const guide = buildMotionAuthoringGuide(clip, bones, undefined, 'front')
    const aiReply = '```json\n' + JSON.stringify({ format: 'parallax-motion-v1', ...guide.starterExample }) + '\n```'
    const res = parseAnimationClipFromJson(aiReply, bones, { autoFixBiomechanics: false })
    expect(res.success).toBe(true)
    expect(res.warnings ?? []).toEqual([])
    expect(Object.keys(res.clip?.tracks ?? {})).toEqual(Object.keys(guide.starterExample.tracks))
  })
})

describe('workshopClipSmoothing — chuẩn hoá keyframe để phát lại mượt', () => {
  it('parseRawKeyframe đọc alias và bezier; bezier thiếu điểm → ease-in-out', () => {
    expect(parseRawKeyframe({ t: 0.5, rot: 12, sx: 1.1, easing: 'bezier', bezier: [0.2, 0, 0.4, 1] })).toMatchObject({
      time: 0.5,
      rotation: 12,
      scaleX: 1.1,
      easing: 'bezier',
      bezier: [0.2, 0, 0.4, 1]
    })
    expect(parseRawKeyframe({ time: 1, easing: 'bezier' })?.easing).toBe('ease-in-out')
    expect(parseRawKeyframe(null)).toBeNull()
  })

  it('khép kín vòng lặp, kẹp key vượt thời lượng, gộp key trùng và cảnh báo cú giật', () => {
    const k = (time: number, rotation: number) => ({ time, x: 0, y: 0, rotation, scaleX: 1, scaleY: 1, easing: 'smooth' as const })
    const res = finalizeTracksForPlayback(
      {
        a: [k(0, 0), k(1, 20), k(2, 5)],
        b: [k(0, 0), k(0.5, 4), k(0.5, 6), k(2.6, 3)],
        c: [k(0, 0), k(0.02, 80), k(2, 0)]
      },
      { duration: 2, loop: true, fps: 30 }
    )
    expect(res.tracks.a[2].rotation).toBe(0)
    expect(res.tracks.b.map((x) => x.time)).toEqual([0, 0.5, 2])
    expect(res.tracks.b[1].rotation).toBe(6)
    expect(res.tracks.b[2].rotation).toBe(0)
    expect(res.fixesApplied.join(' ')).toMatch(/Khép kín vòng lặp/)
    expect(res.fixesApplied.join(' ')).toMatch(/Kẹp 1 keyframe/)
    expect(res.warnings.some((w) => w.includes('"c"'))).toBe(true)
  })
})
