import { evaluate } from '../animation/keyframes'
import { evaluateRig, transformRigLayer } from '../engine/layerRig'
import { COMPOSITE_Z_FACTOR } from '../ui/layerAssembly/insertLayerComposite'
import { CUTOUT_FRONT_BONES } from '../ui/layerAssembly/templates/humanoidTemplates'
import type { LayerComposite } from '../ui/layerAssembly/types'
import {
  MOTION_PRESETS,
  createClipFromPreset,
  createMonsterBones,
  createQuadrupedRigBones,
  createSimpleChainBones,
  createWingedRigBones,
  type ProceduralMotionPreset
} from '../ui/layerAssembly/workshopRigPresets'
import type { Animatable, Keyframe, Layer, Vec3 } from '@shared/types'
import type { LayerBone, LayerRig } from '@shared/layerRig'
import { isGeneratedRigKeyId } from './workflowMotionStart'

export type TrajectorySnapshot = Map<
  string,
  { pos: Keyframe<Vec3>[]; scale: Keyframe<Vec3>[]; rot: Keyframe<Vec3>[] }
>

const isTrajKeyId = (id: string): boolean => id.includes('-bboxmot-') || id.includes('-motpath-p-')

/** Xây dựng đường cong quỹ đạo thuần (đã lọc bỏ key `-rig-`) cho mục đích cộng gộp FK. */
export function buildCleanTrajectoryTrack(
  keyframes: Keyframe<Vec3>[],
  fallbackValue: Vec3
): Animatable<Vec3> {
  return {
    value: [...fallbackValue] as Vec3,
    keyframes: keyframes
      .filter((k) => !isGeneratedRigKeyId(k.id))
      .map((k) => ({ ...k, value: [...k.value] as Vec3 }))
  }
}

/** Chụp ảnh nhanh các keyframe quỹ đạo thuần của cụm trước khi chồng các chặng Rig FK. */
export function captureTrajectorySnapshot(members: Layer[]): TrajectorySnapshot {
  const snap: TrajectorySnapshot = new Map()
  for (const m of members) {
    snap.set(m.id, {
      pos: m.transform.position.keyframes
        .filter((k) => !isGeneratedRigKeyId(k.id))
        .map((k) => ({ ...k, value: [...k.value] as Vec3 })),
      scale: m.transform.scale.keyframes.map((k) => ({ ...k, value: [...k.value] as Vec3 })),
      rot: m.transform.rotation.keyframes
        .filter((k) => !isGeneratedRigKeyId(k.id))
        .map((k) => ({ ...k, value: [...k.value] as Vec3 }))
    })
  }
  return snap
}

/** Chọn bộ xương chuẩn phù hợp với hình thái của Cụm 2.5D (Người / Thú 4 chân / Chim / Quái vật / Chuỗi uốn). */
export function resolveClusterRigBones(
  members: Layer[],
  savedComp: LayerComposite | undefined,
  preset: ProceduralMotionPreset,
  rigBonePreset?: string
): LayerBone[] {
  if (savedComp?.rig?.bones && savedComp.rig.bones.length > 0) {
    return savedComp.rig.bones
  }
  const tokens = members
    .map((l) => `${l.composite?.sourceLayerId ?? ''} ${l.composite?.slot ?? ''} ${l.name}`.toLowerCase())
    .join(' ')
  if (
    rigBonePreset === 'quadruped_12' ||
    preset.startsWith('quadruped_') ||
    tokens.includes('leg-fl') ||
    tokens.includes('leg_fl') ||
    tokens.includes('chân trước')
  ) {
    return createQuadrupedRigBones()
  }
  if (rigBonePreset === 'bird_8' || preset === 'wing_flap' || tokens.includes('wing-l') || tokens.includes('cánh trái')) {
    return createWingedRigBones()
  }
  if (
    rigBonePreset === 'monster_14' ||
    preset.startsWith('monster_') ||
    tokens.includes('jaw') ||
    tokens.includes('hàm dưới') ||
    tokens.includes('cự trảo') ||
    tokens.includes('quái')
  ) {
    return createMonsterBones()
  }
  const isHumanoid =
    rigBonePreset === 'humanoid_15' ||
    rigBonePreset === 'mixamo_12' ||
    ['torso', 'head', 'arm', 'thigh', 'shin', 'thân áo', 'đầu', 'cẳng chân', 'bắp tay'].some((t) =>
      tokens.includes(t)
    )
  return isHumanoid ? CUTOUT_FRONT_BONES : createSimpleChainBones()
}

/** Ánh xạ tên mảnh bộ phận 2.5D sang ID xương (hỗ trợ Người, Thú 4 chân, Chim và Quái vật). */
export function inferClusterBoneId(layer: Layer, bones: LayerBone[], savedBoneId?: string): string | undefined {
  if (savedBoneId && bones.some((b) => b.id === savedBoneId)) return savedBoneId
  const key = `${layer.composite?.sourceLayerId ?? ''} ${layer.composite?.slot ?? ''} ${layer.name ?? ''}`.toLowerCase()
  const has = (id: string): string | undefined => (bones.some((b) => b.id === id) ? id : undefined)

  // Chim / Linh cầm
  if (key.includes('wing-l') || key.includes('wing_l') || key.includes('cánh trái') || key.includes('cánh gần')) {
    return has('bone-bird-wing-l') ?? has('bone-arm-l')
  }
  if (key.includes('wing-r') || key.includes('wing_r') || key.includes('cánh phải') || key.includes('cánh xa')) {
    return has('bone-bird-wing-r') ?? has('bone-arm-r')
  }
  if (key.includes('bird-body') || key.includes('thân chim') || key.includes('ức chim')) return has('bone-bird-body')
  if (key.includes('bird-tail') || key.includes('lông đuôi chim')) return has('bone-bird-tail')

  // Thú 4 chân
  if (key.includes('leg-fl-shin') || key.includes('leg_fl_shin') || key.includes('fl-shin') || key.includes('cẳng chân trước trái')) {
    return has('bone-leg-fl-shin') ?? has('bone-shin-l')
  }
  if (key.includes('leg-fl-thigh') || key.includes('leg_fl_thigh') || key.includes('fl-thigh') || key.includes('đùi trước trái')) {
    return has('bone-leg-fl-thigh') ?? has('bone-thigh-l')
  }
  if (key.includes('leg-fr-shin') || key.includes('leg_fr_shin') || key.includes('fr-shin') || key.includes('cẳng chân trước phải')) {
    return has('bone-leg-fr-shin') ?? has('bone-shin-r')
  }
  if (key.includes('leg-fr-thigh') || key.includes('leg_fr_thigh') || key.includes('fr-thigh') || key.includes('đùi trước phải')) {
    return has('bone-leg-fr-thigh') ?? has('bone-thigh-r')
  }
  if (key.includes('leg-bl-shin') || key.includes('leg_bl_shin') || key.includes('bl-shin') || key.includes('cẳng chân sau trái')) {
    return has('bone-leg-bl-shin')
  }
  if (key.includes('leg-bl-thigh') || key.includes('leg_bl_thigh') || key.includes('bl-thigh') || key.includes('đùi sau trái')) {
    return has('bone-leg-bl-thigh')
  }
  if (key.includes('leg-br-shin') || key.includes('leg_br_shin') || key.includes('br-shin') || key.includes('cẳng chân sau phải')) {
    return has('bone-leg-br-shin')
  }
  if (key.includes('leg-br-thigh') || key.includes('leg_br_thigh') || key.includes('br-thigh') || key.includes('đùi sau phải')) {
    return has('bone-leg-br-thigh')
  }

  // Hàm dưới, đuôi & cổ (Quái vật & Linh thú)
  if (key.includes('jaw') || key.includes('hàm dưới')) return has('bone-jaw') ?? has('bone-head')
  if (key.includes('tail-tip') || key.includes('tail_tip') || key.includes('ngọn đuôi') || key.includes('chùy')) {
    return has('bone-tail-tip') ?? has('bone-tail')
  }
  if (key.includes('tail') || key.includes('đuôi')) return has('bone-tail') ?? has('bone-chain-tip')
  if (key.includes('neck') || key.includes('cổ')) return has('bone-neck') ?? has('bone-torso')

  // Người & Quái vật 2 chân
  if (key.includes('forearm-l') || key.includes('forearm_l') || key.includes('cẳng tay trái') || key.includes('cẳng trảo xa') || key.includes('bàn tay trái')) {
    return has('bone-forearm-l') ?? has('bone-arm-l')
  }
  if (key.includes('forearm-r') || key.includes('forearm_r') || key.includes('cẳng tay phải') || key.includes('cẳng trảo gần') || key.includes('bàn tay phải') || key.includes('đồng hồ')) {
    return has('bone-forearm-r') ?? has('bone-arm-r')
  }
  if (key.includes('arm-l') || key.includes('arm_l') || key.includes('bắp tay áo trái') || key.includes('bắp tay trái') || key.includes('trảo xa') || key.includes('tay áo sơ mi trái')) {
    return has('bone-arm-l')
  }
  if (key.includes('arm-r') || key.includes('arm_r') || key.includes('bắp tay áo phải') || key.includes('bắp tay phải') || key.includes('trảo gần') || key.includes('tay áo sơ mi phải')) {
    return has('bone-arm-r')
  }
  if (key.includes('shin-l') || key.includes('shin_l') || key.includes('ống quần & giày trái') || key.includes('giày sneaker trái') || key.includes('cẳng chân trái') || key.includes('cẳng chân móng xa')) {
    return has('bone-shin-l') ?? has('bone-thigh-l')
  }
  if (key.includes('shin-r') || key.includes('shin_r') || key.includes('ống quần & giày phải') || key.includes('giày sneaker phải') || key.includes('cẳng chân phải') || key.includes('cẳng chân móng gần')) {
    return has('bone-shin-r') ?? has('bone-thigh-r')
  }
  if (key.includes('thigh-l') || key.includes('thigh_l') || key.includes('đùi quần trái') || key.includes('đùi trái') || key.includes('đùi quái vật xa')) {
    return has('bone-thigh-l')
  }
  if (key.includes('thigh-r') || key.includes('thigh_r') || key.includes('đùi quần phải') || key.includes('đùi phải') || key.includes('đùi quái vật gần')) {
    return has('bone-thigh-r')
  }
  if (
    key.includes('head') ||
    key.includes('face') ||
    key.includes('glass') ||
    key.includes('đầu') ||
    key.includes('mái tóc') ||
    key.includes('biểu cảm') ||
    key.includes('mắt kính') ||
    key.includes('gọng kính')
  ) {
    return has('bone-head') ?? has('bone-bird-head') ?? has('bone-chain-tip')
  }
  if (key.includes('coat') || key.includes('cape') || key.includes('áo choàng') || key.includes('torso') || key.includes('thân áo') || key.includes('áo gile') || key.includes('ngực')) {
    return has('bone-torso') ?? has('bone-bird-body') ?? has('bone-chain-mid')
  }
  if (key.includes('pelvis') || key.includes('belt') || key.includes('hông') || key.includes('đai')) {
    return has('bone-pelvis') ?? has('bone-bird-body') ?? has('bone-chain-root')
  }
  if (bones.some((b) => b.id === 'bone-chain-root')) {
    if (key.includes('gốc') || key.includes('thân') || key.includes('root') || key.includes('trunk')) return 'bone-chain-root'
    if (key.includes('ngọn') || key.includes('tán') || key.includes('hoa') || key.includes('tip') || key.includes('canopy')) return 'bone-chain-tip'
    return 'bone-chain-mid'
  }
  return undefined
}

export interface SampleTrajectoryRigArgs {
  layer: Layer
  root: Layer
  boneId: string
  rig: LayerRig
  baseScale: number
  baseRotZ: number
  baseRootScale: number
  rootOff: Vec3
  rootTrajTrack: Animatable<Vec3>
  rootScaleTrack: Animatable<Vec3>
  rootRotTrack: Animatable<Vec3>
  tStart: number
  span: number
  intensity: number
  nodeTag: string
}

interface RigSamplePoint {
  t: number
  pos: Vec3
  rot: Vec3
  dz: number
}

function pushSampledPosKeys(
  l: Layer,
  samples: RigSamplePoint[],
  tStart: number,
  tEnd: number,
  hasActiveTraj: boolean,
  nodeTag: string
): void {
  const thresh = 0.08
  let lastP: Vec3 | null = null
  let lastPIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    if (
      i === 0 ||
      i === samples.length - 1 ||
      !lastP ||
      Math.hypot(s.pos[0] - lastP[0], s.pos[1] - lastP[1], s.pos[2] - lastP[2]) >= thresh
    ) {
      if (i - 1 > lastPIdx && lastPIdx >= 0) {
        const prev = samples[i - 1]
        l.transform.position.keyframes.push({
          id: `${l.id}-rig-p-${nodeTag}${i - 1}`,
          t: prev.t,
          value: prev.pos,
          ease: 'linear'
        })
      }
      l.transform.position.keyframes.push({
        id: `${l.id}-rig-p-${nodeTag}${i}`,
        t: s.t,
        value: s.pos,
        ease: 'linear'
      })
      lastP = s.pos
      lastPIdx = i
    }
  }
  if (hasActiveTraj) {
    const trajKeysInSpan = l.transform.position.keyframes.filter(
      (k) => isTrajKeyId(k.id) && k.t >= tStart - 0.004 && k.t <= tEnd + 0.004
    )
    for (const tk of trajKeysInSpan) {
      if (tk.t > tStart + 0.004 && tk.t < tEnd - 0.004) {
        for (const dt of [-0.002, 0.002]) {
          const tNear = Number((tk.t + dt).toFixed(3))
          const near = samples.reduce(
            (best, cur) => (Math.abs(cur.t - tNear) < Math.abs(best.t - tNear) ? cur : best),
            samples[0]
          )
          l.transform.position.keyframes.push({
            id: `${l.id}-rig-p-${nodeTag}g-${tNear}`,
            t: tNear,
            value: near.pos,
            ease: 'linear'
          })
        }
      }
    }
    if (samples.length > 0 && trajKeysInSpan.some((k) => Math.abs(k.t - tStart) < 0.004)) {
      l.transform.position.keyframes.push({
        id: `${l.id}-rig-p-${nodeTag}s0`,
        t: Number((tStart + 0.002).toFixed(3)),
        value: samples[0].pos,
        ease: 'linear'
      })
    }
    if (samples.length > 0 && trajKeysInSpan.some((k) => Math.abs(k.t - tEnd) < 0.004)) {
      const last = samples[samples.length - 1]
      l.transform.position.keyframes.push({
        id: `${l.id}-rig-p-${nodeTag}e0`,
        t: Number((tEnd - 0.002).toFixed(3)),
        value: last.pos,
        ease: 'linear'
      })
    }
  }
  l.transform.position.keyframes.sort((a, b) => {
    if (Math.abs(a.t - b.t) > 1e-6) return a.t - b.t
    const aRig = isGeneratedRigKeyId(a.id)
    const bRig = isGeneratedRigKeyId(b.id)
    if (aRig === bRig) return 0
    if (a.t <= tStart + 0.004) return aRig ? -1 : 1
    return aRig ? 1 : -1
  })
}

function pushSampledRotKeys(l: Layer, samples: RigSamplePoint[], nodeTag: string): void {
  let lastR: Vec3 | null = null
  let lastRIdx = -1
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    if (i === 0 || i === samples.length - 1 || !lastR || Math.abs(s.rot[2] - lastR[2]) >= 0.08) {
      if (i - 1 > lastRIdx && lastRIdx >= 0) {
        const prev = samples[i - 1]
        l.transform.rotation.keyframes.push({
          id: `${l.id}-rig-r-${nodeTag}${i - 1}`,
          t: prev.t,
          value: prev.rot,
          ease: 'linear'
        })
      }
      l.transform.rotation.keyframes.push({
        id: `${l.id}-rig-r-${nodeTag}${i}`,
        t: s.t,
        value: s.rot,
        ease: 'linear'
      })
      lastR = s.rot
      lastRIdx = i
    }
  }
  l.transform.rotation.keyframes.sort((a, b) => a.t - b.t)
}

/**
 * Lấy mẫu keyframe xương FK và CỘNG GỘP tuyến tính lên quỹ đạo di chuyển của cụm (`-bboxmot-` / `-motpath-p-`).
 * Khắc phục triệt để lỗi rơi/bung khớp tay chân khi nhân vật, thú hoặc quái vật vừa đi/chạy vừa dịch chuyển BBox.
 */
export function sampleTrajectoryAwareRigKeyframes(args: SampleTrajectoryRigArgs): boolean {
  const {
    layer: l,
    root,
    boneId,
    rig,
    baseScale,
    baseRotZ,
    baseRootScale,
    rootOff,
    rootTrajTrack,
    rootScaleTrack,
    rootRotTrack,
    tStart,
    span,
    intensity,
    nodeTag
  } = args

  const tEnd = tStart + span
  const off: Vec3 = l.composite?.rootOffset ?? [0, 0, 0]
  const itemX = off[0] / baseScale
  const itemY = -off[1] / baseScale
  const itemZ = COMPOSITE_Z_FACTOR > 0 ? -off[2] / (baseScale * COMPOSITE_Z_FACTOR) : 0
  const virtItem = { x: itemX, y: itemY, z: itemZ, rotation: baseRotZ, boneId, scale: 1 }

  const isSoftSkinned = Boolean(l.mesh?.skin?.binding?.boneId)
  if (isSoftSkinned && l.mesh?.skin) {
    l.mesh.skin.rig = structuredClone(rig)
  }

  const hasActiveTraj =
    rootTrajTrack.keyframes.some((k) => isTrajKeyId(k.id) && k.t >= tStart - 0.05 && k.t <= tEnd + 0.05) ||
    l.transform.position.keyframes.some((k) => isTrajKeyId(k.id) && k.t >= tStart - 0.05 && k.t <= tEnd + 0.05)

  const totalSteps = Math.max(8, Math.ceil(span * (hasActiveTraj ? 24 : 16)))
  const samples: RigSamplePoint[] = []

  for (let step = 0; step <= totalSteps; step++) {
    const tScene = Number((tStart + (span * step) / totalSteps).toFixed(3))
    const tClip = (((tScene - tStart) % rig.duration) + rig.duration) % rig.duration
    const posed = transformRigLayer(virtItem, evaluateRig(rig, tClip))

    const rootPosT = evaluate(rootTrajTrack, tScene)
    const rootScaleT = evaluate(rootScaleTrack, tScene)
    const rootRotT = evaluate(rootRotTrack, tScene)
    const scaleRatio = baseRootScale > 1e-4 ? Math.abs(rootScaleT[0]) / baseRootScale : 1
    const trajCenterX = rootPosT[0] - rootOff[0] * scaleRatio
    const trajCenterY = rootPosT[1] - rootOff[1] * scaleRatio
    const trajCenterZ = rootPosT[2] - rootOff[2] * scaleRatio

    const dx = isSoftSkinned ? 0 : (posed.x - itemX) * baseScale * scaleRatio * intensity
    const dy = isSoftSkinned ? 0 : -(posed.y - itemY) * baseScale * scaleRatio * intensity
    const dz = -((posed.z ?? itemZ) - itemZ) * COMPOSITE_Z_FACTOR * baseScale * scaleRatio
    const rawFkRot = (posed.rotation - baseRotZ) * intensity
    const rotZ = isSoftSkinned ? 0 : (rootRotT[2] ?? 0) + baseRotZ + rawFkRot

    samples.push({
      t: tScene,
      pos: [
        Math.round((trajCenterX + off[0] * scaleRatio + dx) * 100) / 100,
        Math.round((trajCenterY + off[1] * scaleRatio + dy) * 100) / 100,
        Math.round((trajCenterZ + off[2] * scaleRatio + dz) * 100) / 100
      ],
      rot: [0, 0, Math.round(rotZ * 100) / 100],
      dz
    })
  }

  const first = samples[0]
  const hasAnyTrajKey =
    l.transform.position.keyframes.some((k) => isTrajKeyId(k.id)) ||
    root.transform.position.keyframes.some((k) => isTrajKeyId(k.id))
  if (!hasAnyTrajKey) l.transform.position.value = first.pos
  if (!l.transform.rotation.keyframes.some((k) => isTrajKeyId(k.id))) {
    l.transform.rotation.value = first.rot
  }

  const isStaticPos = samples.every(
    (s) => Math.hypot(s.pos[0] - first.pos[0], s.pos[1] - first.pos[1], s.pos[2] - first.pos[2]) < 0.05
  )
  const isStaticDz = samples.every((s) => Math.abs(s.dz - first.dz) < 0.05)
  const isStaticRot = samples.every((s) => Math.abs(s.rot[2] - first.rot[2]) < 0.05)

  if (!hasActiveTraj && isStaticPos && isStaticRot) return false
  if (isSoftSkinned && hasActiveTraj && isStaticDz && isStaticRot) return true

  if (!isStaticPos && !(isSoftSkinned && isStaticDz)) {
    pushSampledPosKeys(l, samples, tStart, tEnd, hasActiveTraj, nodeTag)
  }
  if (!isStaticRot) {
    pushSampledRotKeys(l, samples, nodeTag)
  }
  return true
}

export { MOTION_PRESETS, createClipFromPreset, type ProceduralMotionPreset }
