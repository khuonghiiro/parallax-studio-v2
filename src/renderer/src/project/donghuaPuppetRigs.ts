import { addKeyframe, evaluate } from '../animation/keyframes'
import type { ImageLayer, Vec3 } from '@shared/types'
import type { AnimationClip, BoneKeyframe, BonePose, LayerBone, LayerRig } from '@shared/layerRig'
import type { PlantSpine } from '@shared/plantSpine'
import { buildLayerSkinMesh } from './donghuaSceneryRigs'

export type WaveKey = { phase: number; pose: Partial<BonePose> }

export function makeLoopKeys(duration: number, items: WaveKey[], shiftPhase = 0): BoneKeyframe[] {
  const norm = (p: number): number => ((p + shiftPhase) % 1 + 1) % 1
  const raw = items.map((it) => ({
    phase: norm(it.phase),
    pose: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, ...it.pose }
  }))
  raw.sort((a, b) => a.phase - b.phase)
  const dedup: typeof raw = []
  for (const r of raw) {
    if (dedup.length === 0 || Math.abs(r.phase - dedup[dedup.length - 1].phase) > 1e-4) {
      dedup.push(r)
    }
  }
  const out: BoneKeyframe[] = dedup.map((r) => ({
    time: Number((r.phase * duration).toFixed(4)),
    easing: 'smooth',
    ...r.pose
  }))
  if (out.length > 0 && out[0].time > 1e-3) {
    const first = out[0]
    const last = out[out.length - 1]
    const wrapSpan = duration - last.time + first.time
    const t0 = (duration - last.time) / Math.max(1e-4, wrapSpan)
    const lerp = (a: number, b: number): number => Number((a + (b - a) * t0).toFixed(4))
    out.unshift({
      time: 0,
      easing: 'smooth',
      x: lerp(last.x, first.x),
      y: lerp(last.y, first.y),
      rotation: lerp(last.rotation, first.rotation),
      scaleX: lerp(last.scaleX ?? 1, first.scaleX ?? 1),
      scaleY: lerp(last.scaleY ?? 1, first.scaleY ?? 1)
    })
  }
  if (out.length > 0) {
    out.push({ ...out[0], time: Number(duration.toFixed(4)) })
  }
  return out
}

function makeSineKeys(
  duration: number,
  fn: (phase: number) => Partial<BonePose>,
  steps = 8,
  shiftPhase = 0
): BoneKeyframe[] {
  const items: WaveKey[] = []
  for (let i = 0; i < steps; i++) {
    items.push({ phase: i / steps, pose: fn(i / steps) })
  }
  return makeLoopKeys(duration, items, shiftPhase)
}

export function makeBreathingCurveKeys(
  duration: number,
  phaseLag: number,
  sample: (breathWave: number, swayWave: number) => Partial<BonePose>
): BoneKeyframe[] {
  const controlPts: { p: number; breath: number; sway: number }[] = [
    { p: 0.0, breath: 0.0, sway: -0.25 },
    { p: 0.16, breath: 0.44, sway: 0.35 },
    { p: 0.38, breath: 1.0, sway: 1.0 },
    { p: 0.62, breath: 0.62, sway: 0.22 },
    { p: 0.84, breath: 0.14, sway: -0.68 }
  ]
  return makeLoopKeys(
    duration,
    controlPts.map((pt) => ({ phase: pt.p, pose: sample(pt.breath, pt.sway) })),
    phaseLag
  )
}

function makeSpine(
  id: string,
  name: string,
  layerId: string,
  points: { x: number; y: number }[],
  amp: number,
  speed: number,
  reach: number,
  phaseOffset = 0
): PlantSpine {
  return {
    id,
    name,
    layerIds: [layerId],
    points,
    amplitude: amp,
    speed,
    stiffness: 0.18,
    flexibility: 0.78,
    turbulence: 0.3,
    phaseOffset,
    reach,
    verticalBob: 0,
    waveLag: 0.78,
    enabled: true
  }
}

/** Gắn xương 7 đốt + 3 dải tóc/tà áo mềm cho Kiếm Khách Điềm Tĩnh (`538x1218`). Chân đứng vững trên mỏm đá. */
export function applySwordsmanCalmRig(layer: ImageLayer): void {
  const bones: LayerBone[] = [
    { id: 'bone-pelvis', name: 'Hông & Chân trụ', x: 0, y: -165, length: 145, angle: 90, strength: 1.5, meshEnvelope: true },
    { id: 'bone-leg-anchor', name: 'Ủng & Gấu áo', parentId: 'bone-pelvis', x: 0, y: 120, length: 465, angle: 90, strength: 1.8, meshEnvelope: true },
    { id: 'bone-torso', name: 'Ngực & Thủ ấn', parentId: 'bone-pelvis', x: 0, y: -165, length: 245, angle: -90, strength: 1.25, meshEnvelope: true },
    { id: 'bone-head', name: 'Đầu & Ánh nhìn', parentId: 'bone-torso', x: 0, y: -410, length: 175, angle: -90, strength: 1.2, meshEnvelope: true },
    { id: 'bone-sleeve-l', name: 'Tay áo trái', parentId: 'bone-torso', x: -88, y: -342, length: 325, angle: 112, strength: 1.25, meshEnvelope: true },
    { id: 'bone-sleeve-r', name: 'Tay áo phải', parentId: 'bone-torso', x: 88, y: -342, length: 320, angle: 68, strength: 1.25, meshEnvelope: true }
  ]

  const buildClip = (id: string, name: string, presetKey: string, duration: number, mult: number): AnimationClip => ({
    id,
    name,
    presetKey,
    duration,
    loop: true,
    tracks: {
      'bone-pelvis': makeSineKeys(duration, () => ({ rotation: 0 }), 4),
      'bone-leg-anchor': makeSineKeys(duration, () => ({ rotation: 0 }), 4),
      'bone-torso': makeBreathingCurveKeys(duration, 0, (breath, sway) => ({
        y: Number((-2.8 * breath * mult).toFixed(2)),
        rotation: Number((sway * 2.4 * mult).toFixed(2)),
        scaleY: Number((1 + breath * 0.018 * mult).toFixed(4))
      })),
      'bone-head': makeBreathingCurveKeys(duration, 0.08, (breath, sway) => ({
        rotation: Number((sway * 3.4 * mult + breath * 0.8 * mult).toFixed(2))
      })),
      'bone-sleeve-l': makeBreathingCurveKeys(duration, 0.14, (_breath, sway) => ({
        rotation: Number((sway * 12.5 * mult).toFixed(2))
      })),
      'bone-sleeve-r': makeBreathingCurveKeys(duration, 0.18, (_breath, sway) => ({
        rotation: Number((-sway * 11.8 * mult).toFixed(2))
      }))
    }
  })

  const idleClip = buildClip('dg-calm-idle', 'Tụ Khí Định Thần', 'idle', 2.4, 1.0)
  const actionClip = buildClip('dg-calm-action', 'Vận Công Ngự Kiếm', 'action', 1.8, 1.32)
  const rig: LayerRig = {
    bones,
    duration: idleClip.duration,
    loop: true,
    tracks: idleClip.tracks,
    clips: [idleClip, actionClip],
    activeClipId: idleClip.id,
    meshEnvelope: true
  }
  const plantSpines = [
    makeSpine('dg-calm-hair-ribbon', 'Dải lụa đỏ tóc', layer.id, [
      { x: -35, y: -535 }, { x: -120, y: -492 }, { x: -215, y: -455 }
    ], 17, 0.68, 95, 0),
    makeSpine('dg-calm-hem-l', 'Tà áo ngoài trái', layer.id, [
      { x: -115, y: 120 }, { x: -175, y: 310 }, { x: -242, y: 488 }
    ], 11.5, 0.58, 130, 0.15),
    makeSpine('dg-calm-hem-r', 'Tà áo ngoài phải', layer.id, [
      { x: 115, y: 110 }, { x: 175, y: 300 }, { x: 235, y: 472 }
    ], 11.5, 0.60, 130, 0.48)
  ]
  layer.mesh = buildLayerSkinMesh(layer, {
    segX: 18,
    segY: 24,
    rig,
    primaryBoneId: 'bone-pelvis',
    plantSpines
  })
}

/** Gắn xương + 4 dải tóc/tà áo tung bay cho Kiếm Khách Khai Phong (`724x1262`). */
export function applySwordsmanFierceRig(layer: ImageLayer): void {
  const bones: LayerBone[] = [
    { id: 'bone-pelvis', name: 'Hông & Thế tấn', x: 10, y: -100, length: 155, angle: 90, strength: 1.5, meshEnvelope: true },
    { id: 'bone-leg-anchor', name: 'Chân tấn vững', parentId: 'bone-pelvis', x: 10, y: 150, length: 445, angle: 90, strength: 1.8, meshEnvelope: true },
    { id: 'bone-torso', name: 'Thân kiếm thế', parentId: 'bone-pelvis', x: 10, y: -100, length: 230, angle: -90, strength: 1.3, meshEnvelope: true },
    { id: 'bone-head', name: 'Đầu & Kim nhãn', parentId: 'bone-torso', x: 10, y: -330, length: 165, angle: -86, strength: 1.2, meshEnvelope: true },
    { id: 'bone-sleeve-l', name: 'Tay áo cuộn trái', parentId: 'bone-torso', x: -75, y: -280, length: 295, angle: 148, strength: 1.35, meshEnvelope: true },
    { id: 'bone-sleeve-r', name: 'Tay áo cuộn phải', parentId: 'bone-torso', x: 95, y: -280, length: 285, angle: 32, strength: 1.35, meshEnvelope: true }
  ]

  const buildClip = (id: string, name: string, presetKey: string, duration: number, mult: number): AnimationClip => ({
    id,
    name,
    presetKey,
    duration,
    loop: true,
    tracks: {
      'bone-pelvis': makeBreathingCurveKeys(duration, 0, (breath) => ({
        y: Number((breath * 2.8 * mult).toFixed(2))
      })),
      'bone-leg-anchor': makeSineKeys(duration, () => ({ rotation: 0 }), 4),
      'bone-torso': makeBreathingCurveKeys(duration, 0.04, (breath, sway) => ({
        rotation: Number((sway * 4.5 * mult).toFixed(2)),
        y: Number((-3.2 * breath * mult).toFixed(2)),
        scaleY: Number((1 + breath * 0.02 * mult).toFixed(4))
      })),
      'bone-head': makeBreathingCurveKeys(duration, 0.12, (_breath, sway) => ({
        rotation: Number((-sway * 4.2 * mult).toFixed(2))
      })),
      'bone-sleeve-l': makeBreathingCurveKeys(duration, 0.16, (_breath, sway) => ({
        rotation: Number((sway * 16.5 * mult).toFixed(2))
      })),
      'bone-sleeve-r': makeBreathingCurveKeys(duration, 0.21, (_breath, sway) => ({
        rotation: Number((-sway * 15.5 * mult).toFixed(2))
      }))
    }
  })

  const actionClip = buildClip('dg-fierce-action', 'Khai Phong Kiếm Ý', 'action', 1.6, 1.0)
  const idleClip = buildClip('dg-fierce-idle', 'Tụ Khí Gió Trúc', 'idle', 2.1, 0.75)
  const rig: LayerRig = {
    bones,
    duration: actionClip.duration,
    loop: true,
    tracks: actionClip.tracks,
    clips: [actionClip, idleClip],
    activeClipId: actionClip.id,
    meshEnvelope: true
  }
  const plantSpines = [
    makeSpine('dg-fierce-ponytail', 'Đuôi tóc tung bay', layer.id, [
      { x: 0, y: -490 }, { x: -108, y: -562 }, { x: -222, y: -602 }
    ], 18.5, 0.76, 145, 0),
    makeSpine('dg-fierce-ribbon', 'Dải băng tóc đỏ', layer.id, [
      { x: -15, y: -455 }, { x: -115, y: -405 }, { x: -202, y: -395 }
    ], 19.5, 0.78, 108, 0.2),
    makeSpine('dg-fierce-hem-l', 'Vạt áo chiến trái', layer.id, [
      { x: -135, y: 120 }, { x: -225, y: 315 }, { x: -322, y: 495 }
    ], 13.5, 0.64, 145, 0.1),
    makeSpine('dg-fierce-hem-r', 'Vạt áo chiến phải', layer.id, [
      { x: 145, y: 120 }, { x: 235, y: 305 }, { x: 325, y: 485 }
    ], 13.5, 0.66, 145, 0.42)
  ]
  layer.mesh = buildLayerSkinMesh(layer, {
    segX: 20,
    segY: 24,
    rig,
    primaryBoneId: 'bone-pelvis',
    plantSpines
  })
}

/** Gắn xương + dải lụa Pibo mềm mại cho Thiếu Nữ Đèn Hoa Sen (`831x1076`). */
export function applyMaidenPuppetRig(layer: ImageLayer): void {
  const bones: LayerBone[] = [
    { id: 'bone-pelvis', name: 'Chân váy & Giày thêu', x: -35, y: -140, length: 240, angle: 90, strength: 1.55, meshEnvelope: true },
    { id: 'bone-torso', name: 'Thân áo & Nhịp thở', parentId: 'bone-pelvis', x: -25, y: -140, length: 205, angle: -90, strength: 1.25, meshEnvelope: true },
    { id: 'bone-head', name: 'Đầu & Ánh nhìn đèn trời', parentId: 'bone-torso', x: -25, y: -345, length: 170, angle: -86, strength: 1.2, meshEnvelope: true },
    { id: 'bone-lantern-arm', name: 'Tay nâng đèn hoa sen', parentId: 'bone-torso', x: -65, y: -270, length: 258, angle: 176, strength: 1.3, meshEnvelope: true }
  ]

  const buildClip = (id: string, name: string, presetKey: string, duration: number, mult: number): AnimationClip => ({
    id,
    name,
    presetKey,
    duration,
    loop: true,
    tracks: {
      'bone-pelvis': makeSineKeys(duration, () => ({ rotation: 0 }), 4),
      'bone-torso': makeBreathingCurveKeys(duration, 0, (breath, sway) => ({
        y: Number((-2.8 * breath * mult).toFixed(2)),
        rotation: Number((sway * 2.2 * mult).toFixed(2)),
        scaleY: Number((1 + breath * 0.018 * mult).toFixed(4))
      })),
      'bone-head': makeBreathingCurveKeys(duration, 0.09, (breath, sway) => ({
        rotation: Number((1.2 + sway * 5.8 * mult + breath * 0.6 * mult).toFixed(2))
      })),
      'bone-lantern-arm': makeBreathingCurveKeys(duration, 0.16, (_breath, sway) => ({
        rotation: Number((sway * 13.5 * mult).toFixed(2))
      }))
    }
  })

  const waveClip = buildClip('dg-maiden-wave', 'Dâng Đèn Hoa Sen', 'wave', 2.8, 1.0)
  const idleClip = buildClip('dg-maiden-idle', 'Ngắm Trời Sao', 'idle', 3.2, 0.78)
  const rig: LayerRig = {
    bones,
    duration: waveClip.duration,
    loop: true,
    tracks: waveClip.tracks,
    clips: [waveClip, idleClip],
    activeClipId: waveClip.id,
    meshEnvelope: true
  }
  const plantSpines = [
    makeSpine('dg-maiden-pibo', 'Dải lụa Pibo đỏ', layer.id, [
      { x: 45, y: -235 }, { x: 205, y: -145 }, { x: 382, y: -120 }
    ], 22, 0.62, 132, 0),
    makeSpine('dg-maiden-sleeve', 'Tay áo lụa kem', layer.id, [
      { x: 55, y: -210 }, { x: 165, y: -115 }, { x: 255, y: -82 }
    ], 17, 0.56, 125, 0.28),
    makeSpine('dg-maiden-skirt', 'Tà váy gió sông đêm', layer.id, [
      { x: -15, y: 205 }, { x: 165, y: 325 }, { x: 342, y: 412 }
    ], 16.5, 0.55, 175, 0.55)
  ]
  layer.mesh = buildLayerSkinMesh(layer, {
    segX: 18,
    segY: 22,
    rig,
    primaryBoneId: 'bone-pelvis',
    plantSpines
  })
}

/**
 * Gắn xương đập cánh mềm cho Cụm Tiên Hạc 3 lớp (`wingFar`, `body`, `wingNear`).
 * Vì toàn bộ góc vỗ & co giãn phối cảnh nằm trong `mesh.skin.rig`, quỹ đạo `bbox_target`
 * dịch chuyển cả 3 lớp mượt mà mà không xung đột keyframe!
 */
export function applyFlappingCraneClusterRig(
  body: ImageLayer,
  wingNear: ImageLayer,
  wingFar: ImageLayer,
  opts: { flapDuration?: number; phaseShift?: number } = {}
): void {
  const dur = opts.flapDuration ?? 0.72
  const shift = opts.phaseShift ?? 0
  const tau = Math.PI * 2

  const bodyBones: LayerBone[] = [
    { id: 'bone-crane-torso', name: 'Thân hạc nhấp nhô', x: 0, y: 12, length: 120, angle: 0, strength: 1.4, meshEnvelope: true },
    { id: 'bone-crane-neck', name: 'Cổ hạc lượn sóng', parentId: 'bone-crane-torso', x: 135, y: -12, length: 415, angle: -5, strength: 1.25, meshEnvelope: true },
    { id: 'bone-crane-legs', name: 'Đôi chân duỗi gió', parentId: 'bone-crane-torso', x: -140, y: 48, length: 420, angle: 162, strength: 1.25, meshEnvelope: true }
  ]
  const bodyClip: AnimationClip = {
    id: 'dg-crane-body-flap',
    name: 'Nhịp Thân Bay Lượn',
    presetKey: 'action',
    duration: dur,
    loop: true,
    tracks: {
      'bone-crane-torso': makeSineKeys(dur, (p) => ({
        y: Number((-Math.sin(p * tau) * 16).toFixed(2)),
        rotation: Number((Math.sin(p * tau) * 2.8).toFixed(2))
      }), 8, shift),
      'bone-crane-neck': makeSineKeys(dur, (p) => ({
        rotation: Number((Math.sin(p * tau - 0.5) * 4.5).toFixed(2))
      }), 8, shift),
      'bone-crane-legs': makeSineKeys(dur, (p) => ({
        rotation: Number((-Math.sin(p * tau - 0.7) * 5.2).toFixed(2))
      }), 8, shift)
    }
  }
  body.mesh = buildLayerSkinMesh(body, {
    segX: 20,
    segY: 12,
    rig: { bones: bodyBones, duration: dur, loop: true, tracks: bodyClip.tracks, clips: [bodyClip], activeClipId: bodyClip.id, meshEnvelope: true },
    primaryBoneId: 'bone-crane-torso'
  })

  // Cánh gần: gốc vai dưới-phải (402, +232) -> vươn lên trái
  const nearBones: LayerBone[] = [
    { id: 'bone-wing-arm', name: 'Khớp vai cánh gần', x: 402, y: 232, length: 438, angle: -141.5, strength: 1.5, meshEnvelope: true },
    { id: 'bone-wing-tip', name: 'Hàng lông đầu cánh', parentId: 'bone-wing-arm', x: 60, y: -40, length: 535, angle: -145.5, strength: 1.4, meshEnvelope: true }
  ]
  const nearClip: AnimationClip = {
    id: 'dg-wing-near-flap',
    name: 'Đập Cánh Gần',
    presetKey: 'action',
    duration: dur,
    loop: true,
    tracks: {
      'bone-wing-arm': makeSineKeys(dur, (p) => ({
        rotation: Number((Math.sin(p * tau) * 18 + 8).toFixed(2)),
        scaleY: Number((0.76 + Math.sin(p * tau) * 0.24).toFixed(4))
      }), 10, shift),
      'bone-wing-tip': makeSineKeys(dur, (p) => ({
        rotation: Number((Math.sin(p * tau - 0.85) * 14).toFixed(2))
      }), 10, shift)
    }
  }
  wingNear.mesh = buildLayerSkinMesh(wingNear, {
    segX: 16,
    segY: 16,
    rig: { bones: nearBones, duration: dur, loop: true, tracks: nearClip.tracks, clips: [nearClip], activeClipId: nearClip.id, meshEnvelope: true },
    primaryBoneId: 'bone-wing-arm',
    plantSpines: [makeSpine('dg-wing-near-feather', 'Lông đầu cánh', wingNear.id, [{ x: 40, y: -55 }, { x: -395, y: -345 }], 9, 1.4, 240, shift * dur)]
  })

  // Cánh xa: gốc vai dưới-trái (-402, +232) -> vươn lên phải phía sau lưng
  const farBones: LayerBone[] = [
    { id: 'bone-wing-arm', name: 'Khớp vai cánh xa', x: -402, y: 232, length: 438, angle: -38.5, strength: 1.5, meshEnvelope: true },
    { id: 'bone-wing-tip', name: 'Đầu cánh xa', parentId: 'bone-wing-arm', x: -60, y: -40, length: 535, angle: -34.5, strength: 1.4, meshEnvelope: true }
  ]
  const farClip: AnimationClip = {
    id: 'dg-wing-far-flap',
    name: 'Đập Cánh Xa',
    presetKey: 'action',
    duration: dur,
    loop: true,
    tracks: {
      'bone-wing-arm': makeSineKeys(dur, (p) => ({
        rotation: Number((-Math.sin(p * tau - 0.18) * 16 - 8).toFixed(2)),
        scaleY: Number((0.78 + Math.sin(p * tau - 0.18) * 0.20).toFixed(4))
      }), 10, shift),
      'bone-wing-tip': makeSineKeys(dur, (p) => ({
        rotation: Number((-Math.sin(p * tau - 1.0) * 12).toFixed(2))
      }), 10, shift)
    }
  }
  wingFar.mesh = buildLayerSkinMesh(wingFar, {
    segX: 16,
    segY: 16,
    rig: { bones: farBones, duration: dur, loop: true, tracks: farClip.tracks, clips: [farClip], activeClipId: farClip.id, meshEnvelope: true },
    primaryBoneId: 'bone-wing-arm',
    plantSpines: [makeSpine('dg-wing-far-feather', 'Lông cánh xa', wingFar.id, [{ x: -40, y: -55 }, { x: 395, y: -345 }], 8.5, 1.4, 240, shift * dur + 0.05)]
  })
}

/** Cảnh 1: Linh Kiếm lượn hộ chủ nhịp nhàng phía sau Kiếm Khách (`0..6s`). */
export function choreographSpiritSwordShot1(sword: ImageLayer): void {
  const keys: { t: number; dx: number; dy: number; rot: number }[] = [
    { t: 0.0, dx: 0, dy: 0, rot: -42 },
    { t: 1.4, dx: 26, dy: 28, rot: -33 },
    { t: 2.8, dx: -18, dy: -16, rot: -48 },
    { t: 4.3, dx: 22, dy: 24, rot: -31 },
    { t: 5.9, dx: 4, dy: 8, rot: -40 }
  ]
  for (const k of keys) {
    const baseP = evaluate(sword.transform.position, k.t)
    addKeyframe(sword.transform.position, k.t, [baseP[0] + k.dx, baseP[1] + k.dy, baseP[2]], 'easeInOut')
    addKeyframe(sword.transform.rotation, k.t, [0, 0, k.rot], 'easeInOut')
  }
}

/** Cảnh 2: Linh Kiếm xuất chiêu quét vòng cung tại 7.8s kèm luồng Kiếm Khí Thanh Ngọc rực sáng. */
export function choreographSpiritSwordShot2(sword: ImageLayer, swordQi: ImageLayer): void {
  sword.transform.position.keyframes = []
  sword.transform.rotation.keyframes = []
  const pts: { t: number; pos: Vec3; rot: number; ease: 'easeInOut' | 'easeOut' }[] = [
    { t: 6.0, pos: [45, 12, 196], rot: -42, ease: 'easeInOut' },
    { t: 7.4, pos: [95, 58, 175], rot: -26, ease: 'easeInOut' },
    { t: 7.85, pos: [135, 92, 152], rot: 14, ease: 'easeOut' },
    { t: 8.35, pos: [330, -14, 134], rot: 112, ease: 'easeInOut' },
    { t: 9.25, pos: [315, 55, 146], rot: 58, ease: 'easeInOut' },
    { t: 10.6, pos: [230, 26, 165], rot: -28, ease: 'easeInOut' },
    { t: 11.8, pos: [215, 42, 168], rot: -38, ease: 'easeInOut' }
  ]
  sword.transform.position.value = [...pts[0].pos]
  sword.transform.rotation.value = [0, 0, pts[0].rot]
  for (const k of pts) {
    addKeyframe(sword.transform.position, k.t, k.pos, k.ease)
    addKeyframe(sword.transform.rotation, k.t, [0, 0, k.rot], k.ease)
  }

  swordQi.transform.position.keyframes = []
  swordQi.transform.scale.keyframes = []
  swordQi.transform.opacity.keyframes = []
  swordQi.transform.rotation.keyframes = []
  swordQi.transform.opacity.value = 0
  addKeyframe(swordQi.transform.opacity, 7.65, 0, 'easeOut')
  addKeyframe(swordQi.transform.opacity, 7.92, 0.88, 'easeOut')
  addKeyframe(swordQi.transform.opacity, 8.75, 0.74, 'easeInOut')
  addKeyframe(swordQi.transform.opacity, 10.35, 0, 'easeOut')

  addKeyframe(swordQi.transform.position, 7.75, [115, -18, 145], 'easeOut')
  addKeyframe(swordQi.transform.position, 8.25, [285, 16, 135], 'easeOut')
  addKeyframe(swordQi.transform.position, 9.8, [455, 58, 125], 'easeInOut')

  addKeyframe(swordQi.transform.scale, 7.75, [0.34, 0.34, 1], 'easeOut')
  addKeyframe(swordQi.transform.scale, 8.3, [0.76, 0.76, 1], 'easeOut')
  addKeyframe(swordQi.transform.scale, 9.9, [0.96, 0.96, 1], 'easeInOut')

  addKeyframe(swordQi.transform.rotation, 7.75, [0, 0, -14], 'easeOut')
  addKeyframe(swordQi.transform.rotation, 8.45, [0, 0, 8], 'easeInOut')
}

/** Cảnh 3: Cộng nhịp dập dềnh sóng nước lên Thuyền Sen + Thiếu Nữ + Gợn Nước, và đung đưa nhẹ Đèn Trời. */
export function choreographBoatWaveAndLanternSway(
  boat: ImageLayer,
  maiden: ImageLayer,
  waterShimmer: ImageLayer,
  lanternsFar: ImageLayer,
  lanternsFg: ImageLayer
): void {
  const steps = 16
  const boatSamples = Array.from({ length: steps + 1 }, (_, i) => {
    const t = Number((12 + (6 * i) / steps).toFixed(3))
    const waveY = Math.sin((i / steps) * Math.PI * 5) * 7.5
    const tilt = Math.sin((i / steps) * Math.PI * 5 - 0.5) * 3.1
    const pBoat = evaluate(boat.transform.position, t)
    const pMaiden = evaluate(maiden.transform.position, t)
    return { t, pBoat, pMaiden, waveY, tilt }
  })

  boat.transform.position.keyframes = []
  boat.transform.rotation.keyframes = []
  maiden.transform.position.keyframes = []
  maiden.transform.rotation.keyframes = []
  waterShimmer.transform.position.keyframes = []

  for (const s of boatSamples) {
    addKeyframe(boat.transform.position, s.t, [s.pBoat[0], s.pBoat[1] + s.waveY, s.pBoat[2]], 'easeInOut')
    addKeyframe(boat.transform.rotation, s.t, [0, 0, Number(s.tilt.toFixed(2))], 'easeInOut')
    addKeyframe(maiden.transform.position, s.t, [s.pMaiden[0], s.pMaiden[1] + s.waveY, s.pMaiden[2]], 'easeInOut')
    addKeyframe(maiden.transform.rotation, s.t, [0, 0, Number((s.tilt * 0.55).toFixed(2))], 'easeInOut')
    addKeyframe(waterShimmer.transform.position, s.t, [s.pBoat[0], s.pBoat[1] - 84, s.pBoat[2] + 6], 'easeInOut')
  }

  for (const [layer, phase, amp] of [[lanternsFar, 0, 4.5], [lanternsFg, 1.1, 5.4]] as const) {
    layer.transform.rotation.keyframes = []
    for (let i = 0; i <= 12; i++) {
      const t = Number((12 + i * 0.5).toFixed(2))
      const rz = Number((Math.sin(t * 1.15 + phase) * amp).toFixed(2))
      addKeyframe(layer.transform.rotation, t, [0, 0, rz], 'easeInOut')
    }
  }
}
