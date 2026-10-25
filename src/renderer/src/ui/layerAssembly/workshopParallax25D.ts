import type { AnimationClip, BoneKeyframe, BonePose, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { AssembledLayerItem } from './types'
import type { BonePoseEntry } from './workshopAnimation'

/**
 * Hệ thống Điều Khiển Phối Cảnh 2.5D (Live2D / Spine 2.5D Parallax Controller)
 * & Bộ Tổng Hợp Chu Kỳ Chuyển Động Tham Số (Duik Angela Procedural Cycle Synthesizer).
 *
 * 1. Parallax 2.5D XY Controller (Yaw X ∈ [-1, 1], Pitch Y ∈ [-1, 1]):
 *    - Dịch chuyển bất đối xứng và co giãn phối cảnh (Foreshortening scaleX/scaleY) cho Đầu, Thân, 2 Vai/Tay,
 *      đồng thời đẩy ngược pha các xương phụ phía sau (Tóc sau, Áo choàng, Đuôi) tạo hiệu ứng quay đầu/xoay người 2.5D.
 * 2. Duik-style Parameterized Cycle Synthesizer:
 *    - Tổng hợp các chu kỳ Bước đi, Chạy, Rón rén, Hành quân, Nhảy chân sáo, Thủ thế chiến đấu
 *      với các tham số Sải chân (Stride), Độ nảy (Bounce), Đánh tay (Arm Swing), Độ nghiêng thân (Lean) và Phối cảnh 2.5D.
 */

export type Parallax25DClipPreset =
  | 'look-around-25d'
  | 'nod-tilt-25d'
  | 'body-turn-25d'
  | 'hero-wind-idle-25d'

export interface Parallax25DPresetMeta {
  id: Parallax25DClipPreset
  name: string
  icon: string
  duration: number
  description: string
}

export const PARALLAX_25D_PRESETS: Parallax25DPresetMeta[] = [
  {
    id: 'look-around-25d',
    name: 'Ngoái nhìn 2.5D (Look Around)',
    icon: '👀',
    duration: 2.4,
    description: 'Quay đầu & vai nhìn sang trái, sang phải và ngước nhẹ với hiệu ứng lệch pha chiều sâu 2.5D'
  },
  {
    id: 'nod-tilt-25d',
    name: 'Gật & Nghiêng đầu 2.5D (Nod & Tilt)',
    icon: '🙂',
    duration: 2.0,
    description: 'Gật đầu đồng tình kết hợp nghiêng đầu biểu cảm kiểu Live2D / Anime'
  },
  {
    id: 'body-turn-25d',
    name: 'Xoay người 2.5D (Body Turn 3/4)',
    icon: '🔄',
    duration: 2.2,
    description: 'Xoay ngực, chuyển trọng tâm hông và co giãn phối cảnh 2 vai trái-phải 2.5D'
  },
  {
    id: 'hero-wind-idle-25d',
    name: 'Đứng ngầu trước gió 2.5D (Hero Idle)',
    icon: '🌬️',
    duration: 2.6,
    description: 'Nhịp thở sâu kết hợp quay nhẹ 2.5D, tóc và tà áo phất phơ theo gió'
  }
]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r2 = (v: number) => Number(v.toFixed(2))
const r3 = (v: number) => Number(v.toFixed(3))

/** Tính tư thế xương 2.5D (BonePoseEntry[]) từ tọa độ bàn xoay XY (yawX, pitchY ∈ [-1, 1]) */
export function computeParallax25DPose(
  bones: LayerBone[],
  yawX: number,
  pitchY: number,
  intensity = 1.0
): BonePoseEntry[] {
  const yaw = clamp(yawX, -1, 1)
  const pitch = clamp(pitchY, -1, 1)
  const k = clamp(intensity, 0.1, 2.5)
  const unit = Math.max(0.5, (bones.find((b) => !b.parentId)?.length ?? 60) / 60)

  return bones.map((b) => {
    const tag = `${b.id} ${b.name}`.toLowerCase()
    let x = 0
    let y = 0
    let rotation = 0
    let scaleX = 1
    let scaleY = 1

    if (/(hair[-_ ]?back|ponytail|cape|cloak|tail|tóc sau|áo choàng|đuôi)/i.test(tag)) {
      // Phần phía sau dịch chuyển NGƯỢC chiều với đầu/ngực để tạo chiều sâu Parallax 2.5D
      x = r2(-yaw * 14 * unit * k)
      y = r2(-pitch * 6 * unit * k)
      rotation = r2(-yaw * 10 * k)
      scaleX = r3(1 - Math.abs(yaw) * 0.05 * k)
    } else if (/(head|đầu|face|mặt)/i.test(tag)) {
      x = r2(yaw * 15 * unit * k)
      y = r2(pitch * 11 * unit * k)
      rotation = r2((yaw * 6.5 + pitch * 2.5) * k)
      scaleX = r3(1 - Math.abs(yaw) * 0.07 * k)
      scaleY = r3(1 - Math.abs(pitch) * 0.05 * k)
    } else if (/(neck|cổ)/i.test(tag)) {
      x = r2(yaw * 8 * unit * k)
      y = r2(pitch * 5 * unit * k)
      rotation = r2(yaw * 4 * k)
    } else if (/(torso|chest|body|thân|ngực)/i.test(tag)) {
      x = r2(yaw * 7 * unit * k)
      y = r2(pitch * 4.5 * unit * k)
      rotation = r2(yaw * 3.5 * k)
      scaleX = r3(1 - Math.abs(yaw) * 0.045 * k)
    } else if (/(pelvis|hip|root|hông)/i.test(tag)) {
      // Hông đối trọng nhẹ với ngực
      x = r2(-yaw * 3 * unit * k)
      y = r2(Math.abs(yaw) * 2.5 * unit * k)
      rotation = r2(-yaw * 1.5 * k)
    } else if (/(arm|shoulder|wing|bắp tay|vai|cánh)/i.test(tag) && !/(forearm|cẳng tay)/i.test(tag)) {
      const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
      const sideSign = isRight ? 1 : -1
      // Khi quay sang phải (yaw > 0), vai trái tiến ra trước (phóng to nhẹ), vai phải lùi ra sau (thu nhỏ nhẹ)
      const depthShift = -sideSign * yaw
      x = r2(yaw * 9 * unit * k)
      y = r2((pitch * 3 + depthShift * 4) * unit * k)
      rotation = r2((yaw * 4 - sideSign * Math.abs(pitch) * 3) * k)
      scaleX = r3(1 + depthShift * 0.06 * k)
      scaleY = r3(1 + depthShift * 0.04 * k)
    } else if (/(forearm|hand|cẳng tay|bàn tay)/i.test(tag)) {
      const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
      const sideSign = isRight ? 1 : -1
      const depthShift = -sideSign * yaw
      x = r2(yaw * 5 * unit * k)
      rotation = r2(yaw * 5 * k)
      scaleX = r3(1 + depthShift * 0.05 * k)
    } else if (/(thigh|đùi)/i.test(tag)) {
      const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
      const sideSign = isRight ? 1 : -1
      rotation = r2(-yaw * 1.8 * k)
      scaleX = r3(1 - sideSign * yaw * 0.03 * k)
    }

    return { boneId: b.id, x, y, rotation, scaleX, scaleY }
  })
}

/** Áp dụng góc nghiêng 2.5D (rotationX, rotationY) trực tiếp lên các mảnh Layer theo tọa độ XY */
export function applyLayerParallax25DOffset(
  layers: AssembledLayerItem[],
  yawX: number,
  pitchY: number,
  intensity = 1.0
): AssembledLayerItem[] {
  const yaw = clamp(yawX, -1, 1)
  const pitch = clamp(pitchY, -1, 1)
  const k = clamp(intensity, 0.1, 2.5)
  return layers.map((layer) => {
    if (layer.locked) return layer
    const depthFactor = clamp(1 - (layer.z ?? 0) / 140, 0.35, 1.5)
    return {
      ...layer,
      rotationY: r2(yaw * 18 * k * depthFactor),
      rotationX: r2(-pitch * 12 * k * depthFactor)
    }
  })
}

/** Tạo AnimationClip 2.5D hoàn chỉnh từ mẫu Parallax 2.5D */
export function createParallax25DClip(
  preset: Parallax25DClipPreset,
  bones: LayerBone[],
  intensity = 1.0
): AnimationClip {
  const meta = PARALLAX_25D_PRESETS.find((p) => p.id === preset) ?? PARALLAX_25D_PRESETS[0]
  const duration = meta.duration
  const steps = 48
  const tracks: Record<string, BoneKeyframe[]> = {}
  for (const b of bones) tracks[b.id] = []

  for (let i = 0; i <= steps; i++) {
    const time = r3((duration * i) / steps)
    const phase = (i / steps) * Math.PI * 2
    let yawX = 0
    let pitchY = 0
    let extraBreathY = 0

    if (preset === 'look-around-25d') {
      yawX = Math.sin(phase) * 0.85
      pitchY = -Math.sin(phase * 2) * 0.35
    } else if (preset === 'nod-tilt-25d') {
      yawX = Math.sin(phase) * 0.4
      pitchY = Math.sin(phase * 2) * 0.75
    } else if (preset === 'body-turn-25d') {
      yawX = Math.sin(phase) * 1.0
      pitchY = Math.cos(phase) * 0.2
    } else {
      // 'hero-wind-idle-25d'
      yawX = Math.sin(phase) * 0.45
      pitchY = -Math.cos(phase) * 0.25
      extraBreathY = -Math.sin(phase) * 3.5
    }

    const poses = computeParallax25DPose(bones, yawX, pitchY, intensity)
    for (const p of poses) {
      const b = bones.find((item) => item.id === p.boneId)
      const tag = `${b?.id ?? ''} ${b?.name ?? ''}`.toLowerCase()
      let rot = p.rotation ?? 0
      let py = p.y ?? 0
      if (preset === 'hero-wind-idle-25d') {
        if (/(torso|chest|thân|ngực)/i.test(tag)) py = r2(py + extraBreathY)
        if (/(hair|cape|tail|tóc|áo choàng|đuôi)/i.test(tag)) {
          rot = r2(rot + (Math.sin(phase * 2) * 12 + 8) * intensity)
        }
      }
      tracks[p.boneId].push({
        time,
        x: p.x ?? 0,
        y: py,
        rotation: rot,
        scaleX: p.scaleX ?? 1,
        scaleY: p.scaleY ?? 1,
        easing: 'smooth'
      })
    }
  }

  return {
    id: `clip-25d-${preset}-${Date.now().toString(36)}`,
    name: meta.name,
    duration,
    loop: true,
    tracks,
    description: meta.description,
    viewAngle: 'front'
  }
}

// ============================================================================
// 2. Bộ Tổng Hợp Chu Kỳ Chuyển Động Tham Số 2.5D (Duik-style Synthesizer)
// ============================================================================

export type ParameterizedCycleType =
  | 'walk'
  | 'run'
  | 'sneak'
  | 'march'
  | 'happy-skip'
  | 'combat-idle'

export interface ParameterizedCycle25DConfig {
  cycleType: ParameterizedCycleType
  /** Sải chân (0.3 .. 2.0, chuẩn 1.0) */
  stride: number
  /** Độ nảy trọng tâm hông (0.2 .. 2.0, chuẩn 1.0) */
  bounce: number
  /** Biên độ đánh tay (0.0 .. 2.0, chuẩn 1.0) */
  armSwing: number
  /** Độ nghiêng thân người bằng độ (-15 .. 20, chuẩn 0) */
  bodyLean: number
  /** Cường độ phối cảnh 2.5D (0.0 .. 2.0, chuẩn 1.0) */
  depth25D: number
  /** Thời lượng 1 chu kỳ giây (0.4 .. 4.0) */
  duration: number
  /** Góc nhìn: 0°, 45°, 90°, 180° */
  viewAngle: MotionViewAngle
}

export const DEFAULT_PARAMETERIZED_CYCLE_25D: ParameterizedCycle25DConfig = {
  cycleType: 'walk',
  stride: 1.0,
  bounce: 1.0,
  armSwing: 1.0,
  bodyLean: 0,
  depth25D: 1.0,
  duration: 1.5,
  viewAngle: 'front'
}

export const PARAMETERIZED_CYCLE_TYPES: Array<{
  id: ParameterizedCycleType
  label: string
  icon: string
  defaultConfig: Partial<ParameterizedCycle25DConfig>
}> = [
  { id: 'walk', label: 'Đi bộ chuẩn', icon: '🚶', defaultConfig: { stride: 1.0, bounce: 1.0, armSwing: 1.0, bodyLean: 0, duration: 1.5 } },
  { id: 'run', label: 'Chạy nước rút', icon: '🏃', defaultConfig: { stride: 1.45, bounce: 1.4, armSwing: 1.5, bodyLean: 10, duration: 0.9 } },
  { id: 'sneak', label: 'Rón rén / Lén lút', icon: '🕵️', defaultConfig: { stride: 0.75, bounce: 0.55, armSwing: 0.45, bodyLean: 12, duration: 2.0 } },
  { id: 'march', label: 'Hành quân / Oai vệ', icon: '💂', defaultConfig: { stride: 1.25, bounce: 1.15, armSwing: 1.35, bodyLean: -4, duration: 1.4 } },
  { id: 'happy-skip', label: 'Nhảy chân sáo', icon: '🎶', defaultConfig: { stride: 1.2, bounce: 1.75, armSwing: 1.4, bodyLean: -2, duration: 1.2 } },
  { id: 'combat-idle', label: 'Thủ thế chiến đấu', icon: '🥊', defaultConfig: { stride: 0.35, bounce: 1.3, armSwing: 0.6, bodyLean: 8, duration: 1.3 } }
]

function findRoleBone(bones: LayerBone[], role: string, viLabel: string): LayerBone | undefined {
  return (
    bones.find((b) => b.id.replaceAll('_', '-').match(new RegExp(`(^|-)${role}$`))) ??
    bones.find((b) => b.name.toLocaleLowerCase('vi').includes(viLabel))
  )
}

function sampleTrack(duration: number, fn: (phase: number) => Partial<BonePose>): BoneKeyframe[] {
  const N = 48
  return Array.from({ length: N + 1 }, (_, i) => ({
    time: r3((duration * i) / N),
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    easing: 'smooth',
    ...fn(((i % N) / N) * Math.PI * 2)
  }))
}

/** Tổng hợp AnimationClip từ cấu hình tham số Duik 2.5D */
export function generateParameterizedCycle25D(
  bones: LayerBone[],
  rawConfig: Partial<ParameterizedCycle25DConfig> = {}
): AnimationClip {
  const cfg: ParameterizedCycle25DConfig = { ...DEFAULT_PARAMETERIZED_CYCLE_25D, ...rawConfig }
  const stride = clamp(cfg.stride, 0.2, 2.5)
  const bounce = clamp(cfg.bounce, 0.1, 2.5)
  const armSwing = clamp(cfg.armSwing, 0, 2.5)
  const lean = clamp(cfg.bodyLean, -25, 30)
  const depth = clamp(cfg.depth25D, 0, 2.5)
  const duration = clamp(cfg.duration, 0.3, 6.0)
  const isSide = cfg.viewAngle === 'side' || cfg.viewAngle === 'diagonal'
  const sideRatio = cfg.viewAngle === 'side' ? 1 : cfg.viewAngle === 'diagonal' ? 0.65 : 0

  const tracks: Record<string, BoneKeyframe[]> = {}
  const pelvis = findRoleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)
  const torso = findRoleBone(bones, 'torso', 'thân')
  const head = findRoleBone(bones, 'head', 'đầu')
  const unit = Math.max(0.5, (pelvis?.length ?? 60) / 60)

  const assign = (b: LayerBone | undefined, fn: (p: number) => Partial<BonePose>) => {
    if (b) tracks[b.id] = sampleTrack(duration, fn)
  }

  const crouchOffset = cfg.cycleType === 'sneak' ? 10 * unit : cfg.cycleType === 'combat-idle' ? 6 * unit : 0

  assign(pelvis, (p) => ({
    x: r2((isSide ? 2 : 3.5) * unit * stride * Math.sin(p)),
    y: r2(crouchOffset - 6 * unit * bounce * Math.abs(Math.sin(p))),
    rotation: r2(2.2 * bounce * Math.sin(p))
  }))

  assign(torso, (p) => ({
    rotation: r2(lean - 2.5 * stride * Math.sin(p - 0.2)),
    y: r2(-1.5 * bounce * Math.sin(p * 2))
  }))

  assign(head, (p) => ({
    rotation: r2(-lean * 0.4 + 1.8 * bounce * Math.sin(p - 0.4)),
    y: r2(-1.2 * bounce * Math.sin(p * 2 - 0.3))
  }))

  for (const [side, viSide, sign, offset] of [
    ['l', 'trái', 1, 0],
    ['r', 'phải', -1, Math.PI]
  ] as const) {
    const thigh = findRoleBone(bones, `thigh-${side}`, `đùi ${viSide}`)
    const shin = findRoleBone(bones, `shin-${side}`, `cẳng chân ${viSide}`)
    const foot = findRoleBone(bones, `foot-${side}`, `bàn chân ${viSide}`)
    const arm = findRoleBone(bones, `arm-${side}`, `bắp tay ${viSide}`)
    const forearm = findRoleBone(bones, `forearm-${side}`, `cẳng tay ${viSide}`)
    const hand = findRoleBone(bones, `hand-${side}`, `bàn tay ${viSide}`)

    const sPhase = (p: number) => Math.sin(p + offset)
    const lift = (p: number) => Math.max(0, sPhase(p))
    const aSwing = (p: number) => -Math.sin(p + offset)
    const fSwing = (p: number) => Math.max(0, aSwing(p))

    assign(thigh, (p) => {
      const sideRot = 28 * stride * sPhase(p)
      const frontRot = sign * (2.5 + 3.5 * stride * sPhase(p))
      return {
        rotation: r2(sideRot * sideRatio + frontRot * (1 - sideRatio)),
        y: r2(-15 * unit * stride * lift(p) * (1 - sideRatio * 0.65)),
        scaleX: r3(1 + 0.08 * depth * sPhase(p) * (1 - sideRatio * 0.5)),
        scaleY: r3(1 + 0.08 * depth * sPhase(p) * (1 - sideRatio * 0.5))
      }
    })

    assign(shin, (p) => {
      const sideFold = Math.cos(p + offset) > 0 ? 34 * stride * lift(p) : 0
      const frontRot = -sign * (2 + 4.5 * stride * lift(p))
      return {
        rotation: r2(sideFold * sideRatio + frontRot * (1 - sideRatio)),
        y: r2(-7 * unit * bounce * lift(p) * (1 - sideRatio * 0.6)),
        scaleX: r3(1 + 0.11 * depth * sPhase(p) * (1 - sideRatio * 0.5)),
        scaleY: r3(1 + 0.11 * depth * sPhase(p) * (1 - sideRatio * 0.5))
      }
    })

    assign(foot, (p) => ({
      rotation: r2((isSide ? 12 : -sign * 4) * stride * lift(p)),
      y: r2(-4 * unit * bounce * lift(p) * (1 - sideRatio * 0.5)),
      scaleX: r3(1 + 0.1 * depth * sPhase(p) * (1 - sideRatio * 0.5)),
      scaleY: r3(1 + 0.1 * depth * sPhase(p) * (1 - sideRatio * 0.5))
    }))

    assign(arm, (p) => {
      const sideArmRot = -26 * armSwing * sPhase(p)
      const frontArmRot = -sign * (2 + 6.5 * armSwing * aSwing(p))
      return {
        rotation: r2(sideArmRot * sideRatio + frontArmRot * (1 - sideRatio)),
        y: r2(-3 * unit * armSwing * fSwing(p)),
        scaleX: r3(1 + 0.05 * depth * aSwing(p)),
        scaleY: r3(1 - 0.05 * depth * fSwing(p))
      }
    })

    assign(forearm, (p) => {
      const guardOffset = cfg.cycleType === 'combat-idle' ? -35 : 0
      const sideForeRot = guardOffset - 14 * armSwing - 16 * armSwing * Math.sin(p + offset - 0.3)
      const frontForeRot = guardOffset + sign * (4 + 9 * armSwing * fSwing(p))
      return {
        rotation: r2(sideForeRot * sideRatio + frontForeRot * (1 - sideRatio)),
        y: r2(-10 * unit * armSwing * fSwing(p) * (1 - sideRatio * 0.5)),
        scaleX: r3(1 + 0.08 * depth * fSwing(p)),
        scaleY: r3(1 - 0.14 * depth * fSwing(p))
      }
    })

    assign(hand, (p) => ({
      rotation: r2(sign * 8 * armSwing * fSwing(p)),
      y: r2(-10 * unit * armSwing * fSwing(p) * (1 - sideRatio * 0.5)),
      scaleX: r3(1 + 0.1 * depth * fSwing(p)),
      scaleY: r3(1 - 0.1 * depth * fSwing(p))
    }))
  }

  // Các xương phụ (tóc sau, áo choàng, đuôi) tự động nảy trễ pha (follow-through)
  for (const b of bones) {
    if (tracks[b.id]) continue
    const tag = `${b.id} ${b.name}`.toLowerCase()
    if (/(hair|cape|cloak|tail|wing|tóc|áo choàng|đuôi|cánh)/i.test(tag)) {
      assign(b, (p) => ({
        rotation: r2(8 * bounce * Math.sin(p * 2 - 0.6) + Math.max(0, lean * 0.8))
      }))
    } else {
      assign(b, () => ({}))
    }
  }

  const presetMeta = PARAMETERIZED_CYCLE_TYPES.find((t) => t.id === cfg.cycleType)
  const angleTag = cfg.viewAngle === 'side' ? '90°' : cfg.viewAngle === 'diagonal' ? '45°' : cfg.viewAngle === 'back' ? '180°' : '0°'
  return {
    id: `clip-duik-${cfg.cycleType}-${Date.now().toString(36)}`,
    name: `${presetMeta?.label ?? 'Chu kỳ 2.5D'} [${angleTag}]`,
    duration,
    loop: true,
    tracks,
    viewAngle: cfg.viewAngle,
    description: `Chu kỳ 2.5D tùy chỉnh (Sải: ${stride}x, Nảy: ${bounce}x, Tay: ${armSwing}x, Nghiêng: ${lean}°)`
  }
}
