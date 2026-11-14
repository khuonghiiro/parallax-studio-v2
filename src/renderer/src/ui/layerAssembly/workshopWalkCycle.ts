import type { BoneEasing, BoneKeyframe, BonePose, LayerBone, MotionViewAngle } from '@shared/layerRig'
import { solveWalkLeg, walkRoot } from './workshopWalkFeet'
import { inferHumanoidBoneRoles, type HumanoidBoneRoleMap } from './spineRigWorkflow'

const ROLE_TO_KEY: Record<string, keyof HumanoidBoneRoleMap> = {
  pelvis: 'pelvis',
  torso: 'torso',
  head: 'head',
  'arm-l': 'armL',
  'forearm-l': 'forearmL',
  'hand-l': 'handL',
  'arm-r': 'armR',
  'forearm-r': 'forearmR',
  'hand-r': 'handR',
  'thigh-l': 'thighL',
  'shin-l': 'shinL',
  'foot-l': 'footL',
  'thigh-r': 'thighR',
  'shin-r': 'shinR',
  'foot-r': 'footR'
}

/** Match complete roles: forearm-l must never be mistaken for arm-l. Falls back to Spine spatial/hierarchy inference. */
function roleBone(bones: LayerBone[], role: string, label: string): LayerBone | undefined {
  const direct =
    bones.find((b) => b.id.replaceAll('_', '-').match(new RegExp(`(^|-)${role}$`))) ??
    bones.find((b) => b.name.toLocaleLowerCase('vi').includes(label))
  if (direct) return direct
  const roles = inferHumanoidBoneRoles(bones)
  const key = ROLE_TO_KEY[role]
  if (!key) return undefined
  if (role === 'torso' && roles.torso && roles.torso === roles.pelvis) return undefined
  const inferredId = roles[key]
  return inferredId ? bones.find((b) => b.id === inferredId) : undefined
}

function track(duration: number, pose: (phase: number) => Partial<BonePose>): BoneKeyframe[] {
  return Array.from({ length: 65 }, (_, i) => ({
    time: Number((duration * i / 64).toFixed(3)),
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    easing: 'smooth',
    ...pose((i % 64) / 64 * Math.PI * 2)
  }))
}

/**
 * Sinh chuyển động bước đi (Walk Cycle) linh hoạt theo từng góc nhìn:
 * - 'front' (0°): bước chân dậm nhịp nhấc hạ chân trụ thẳng tới camera, tay đánh nhẹ 2 bên.
 * - 'side' (90°): bước ngang nhìn nghiêng, hai chân sải trước-sau rõ nét, gập cẳng gối, hai tay vung trước-sau ngược pha.
 * - 'diagonal' (45°): góc 3/4 kết hợp giữa bước tới và sải so le.
 * - 'back' (180°): nhìn từ sau lưng, nhịp đánh tay lùi sau.
 */
export function generateWalkCycle(
  bones: LayerBone[],
  duration = 1.6,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const assign = (bone: LayerBone | undefined, pose: (p: number) => Partial<BonePose>) => {
    if (bone) tracks[bone.id] = track(duration, pose)
  }
  const pelvis = roleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)
  const unit = (pelvis?.length ?? 50) / 50

  if (viewAngle === 'side') {
    // === GÓC NHÌN NGHIÊNG 90° (Side Profile) ===
    assign(pelvis, (p) => ({
      y: Number((-4 * Math.abs(Math.sin(p))).toFixed(2)),
      rotation: Number((1.5 * Math.sin(p)).toFixed(2))
    }))
    assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: Number((3 + 1.5 * Math.sin(p)).toFixed(2)) }))
    assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: Number((-1.5 * Math.sin(p)).toFixed(2)) }))

    for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
      const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
      const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
      if (thigh) {
        assign(thigh, (p) => ({
          rotation: Number((26 * Math.sin(p + offset)).toFixed(2))
        }))
      }
      if (shin) {
        assign(shin, (p) => {
          const ph = p + offset
          const backFold = Math.cos(ph) > 0 ? 32 * Math.sin(ph) : 0
          return { rotation: Number(Math.max(-2, backFold).toFixed(2)) }
        })
      }
      // Bàn chân hơi duỗi/gập theo cẳng chân
      assign(roleBone(bones, `foot-${side}`, `bàn chân ${label}`), (p) => {
        const ph = p + offset
        const ankleBend = Math.cos(ph) > 0 ? 10 * Math.sin(ph) : -5
        return { rotation: Number(ankleBend.toFixed(2)) }
      })

      // Tay vung ngược pha với chân
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((-28 * Math.sin(p + offset)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-14 - 16 * Math.sin(p + offset - 0.3)).toFixed(2))
      }))
      // Bàn tay hơi vung nhẹ
      assign(roleBone(bones, `hand-${side}`, `bàn tay ${label}`), (p) => ({
        rotation: Number((-10 * Math.sin(p + offset - 0.4)).toFixed(2))
      }))
    }
  } else if (viewAngle === 'diagonal') {
    // === GÓC NHÌN CHÉO 3/4 (45° Diagonal) ===
    assign(pelvis, (p) => {
      const f = walkRoot(p, unit)
      return { x: f.x * 0.6, y: f.y, rotation: f.rotation * 0.7 }
    })
    assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: -2 * Math.sin(p - 0.2) }))
    assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: 1 * Math.sin(p - 0.4) }))

    for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
      const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
      const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
      if (thigh && shin) {
        assign(thigh, (p) => {
          const solved = solveWalkLeg(thigh, shin, p, offset, sign, unit)
          return { rotation: Number((solved.thigh * 0.6 + 14 * Math.sin(p + offset)).toFixed(2)) }
        })
        assign(shin, (p) => {
          const solved = solveWalkLeg(thigh, shin, p, offset, sign, unit)
          return { rotation: Number((solved.shin * 0.7 + Math.max(0, 18 * Math.sin(p + offset))).toFixed(2)) }
        })
      }
      assign(roleBone(bones, `foot-${side}`, `bàn chân ${label}`), (p) => ({
        rotation: Number((5 * Math.sin(p + offset)).toFixed(2))
      }))
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((sign * 3 - 18 * Math.sin(p + offset + 0.2)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-sign * 3 - 10 * Math.sin(p + offset - 0.2)).toFixed(2))
      }))
      assign(roleBone(bones, `hand-${side}`, `bàn tay ${label}`), (p) => ({
        rotation: Number((-8 * Math.sin(p + offset - 0.3)).toFixed(2))
      }))
    }
  } else {
    // === GÓC CHÍNH DIỆN 0° (Frontal) & SAU LƯNG 180° ===
    // Chu kỳ bước đi 2.5D tiến về camera (Walk Cycle Frontal) với phối cảnh chiều sâu Z,
    // hoán đổi thứ tự hiển thị zOrder tức thời tại điểm giao nhau và tay đánh nghịch pha với chân.
    const signMod = viewAngle === 'back' ? -1 : 1
    const tScale = duration / 1.6
    const posScale = (pelvis?.length ?? 100) / 100

    const mapKeys = (
      keyframes: Array<{
        time: number
        x?: number
        y?: number
        rotation?: number
        scaleX?: number
        scaleY?: number
        zOrder?: number
        easing?: BoneEasing
      }>
    ): BoneKeyframe[] =>
      keyframes.map((k) => ({
        time: Number((k.time * tScale).toFixed(3)),
        x: k.x !== undefined ? Number((k.x * posScale).toFixed(2)) : 0,
        y: k.y !== undefined ? Number((k.y * posScale).toFixed(2)) : 0,
        rotation: k.rotation !== undefined ? Number((k.rotation * signMod).toFixed(2)) : 0,
        scaleX: k.scaleX ?? 1,
        scaleY: k.scaleY ?? 1,
        easing: k.easing ?? 'smooth',
        ...(k.zOrder !== undefined ? { zOrder: Number((k.zOrder * signMod).toFixed(1)) } : {})
      }))

    const pelvisKeys = [
      { time: 0.0, x: 0, y: 10, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' as const },
      { time: 0.4, x: -4, y: 0, rotation: -2, scaleX: 1, scaleY: 1, easing: 'smooth' as const },
      { time: 0.8, x: 0, y: 10, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' as const },
      { time: 1.2, x: 4, y: 0, rotation: 2, scaleX: 1, scaleY: 1, easing: 'smooth' as const },
      { time: 1.6, x: 0, y: 10, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' as const }
    ]

    const torsoKeys = [
      { time: 0.0, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const },
      { time: 0.4, x: 0, y: -3, rotation: 2, scaleX: 0.98, scaleY: 0.99, easing: 'smooth' as const },
      { time: 0.8, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const },
      { time: 1.2, x: 0, y: -3, rotation: -2, scaleX: 0.98, scaleY: 0.99, easing: 'smooth' as const },
      { time: 1.6, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const }
    ]

    const headKeys = [
      { time: 0.0, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const },
      { time: 0.4, x: 0, y: -1, rotation: -2, scaleX: 0.98, scaleY: 0.98, easing: 'smooth' as const },
      { time: 0.8, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const },
      { time: 1.2, x: 0, y: -1, rotation: 2, scaleX: 0.98, scaleY: 0.98, easing: 'smooth' as const },
      { time: 1.6, x: 0, y: 2, rotation: 0, scaleX: 1.03, scaleY: 1.03, easing: 'smooth' as const }
    ]

    const armLKeys = [
      { time: 0.0, rotation: 14, scaleY: 1.04, zOrder: -40, easing: 'smooth' as const },
      { time: 0.38, rotation: 4.5, scaleY: 0.983, zOrder: -40, easing: 'smooth' as const },
      { time: 0.42, rotation: 3.5, scaleY: 0.977, zOrder: 50, easing: 'smooth' as const },
      { time: 0.8, rotation: -6, scaleY: 0.92, zOrder: 50, easing: 'smooth' as const },
      { time: 1.18, rotation: 3.5, scaleY: 0.977, zOrder: 50, easing: 'smooth' as const },
      { time: 1.22, rotation: 4.5, scaleY: 0.983, zOrder: -40, easing: 'smooth' as const },
      { time: 1.6, rotation: 14, scaleY: 1.04, zOrder: -40, easing: 'smooth' as const }
    ]

    const forearmLKeys = [
      { time: 0.0, rotation: 10, scaleY: 1.02, zOrder: -45, easing: 'smooth' as const },
      { time: 0.38, rotation: 1.45, scaleY: 0.963, zOrder: -45, easing: 'smooth' as const },
      { time: 0.42, rotation: 0.55, scaleY: 0.957, zOrder: 52, easing: 'smooth' as const },
      { time: 0.8, rotation: -8, scaleY: 0.9, zOrder: 52, easing: 'smooth' as const },
      { time: 1.18, rotation: 0.55, scaleY: 0.957, zOrder: 52, easing: 'smooth' as const },
      { time: 1.22, rotation: 1.45, scaleY: 0.963, zOrder: -45, easing: 'smooth' as const },
      { time: 1.6, rotation: 10, scaleY: 1.02, zOrder: -45, easing: 'smooth' as const }
    ]

    const handLKeys = [
      { time: 0.0, rotation: 8, easing: 'smooth' as const },
      { time: 0.4, rotation: -1, easing: 'smooth' as const },
      { time: 0.8, rotation: -10, easing: 'smooth' as const },
      { time: 1.2, rotation: -1, easing: 'smooth' as const },
      { time: 1.6, rotation: 8, easing: 'smooth' as const }
    ]

    const armRKeys = [
      { time: 0.0, rotation: 6, scaleY: 0.92, zOrder: 50, easing: 'smooth' as const },
      { time: 0.38, rotation: -3.5, scaleY: 0.977, zOrder: 50, easing: 'smooth' as const },
      { time: 0.42, rotation: -4.5, scaleY: 0.983, zOrder: -40, easing: 'smooth' as const },
      { time: 0.8, rotation: -14, scaleY: 1.04, zOrder: -40, easing: 'smooth' as const },
      { time: 1.18, rotation: -4.5, scaleY: 0.983, zOrder: -40, easing: 'smooth' as const },
      { time: 1.22, rotation: -3.5, scaleY: 0.977, zOrder: 50, easing: 'smooth' as const },
      { time: 1.6, rotation: 6, scaleY: 0.92, zOrder: 50, easing: 'smooth' as const }
    ]

    const forearmRKeys = [
      { time: 0.0, rotation: 8, scaleY: 0.9, zOrder: 52, easing: 'smooth' as const },
      { time: 0.38, rotation: -0.55, scaleY: 0.957, zOrder: 52, easing: 'smooth' as const },
      { time: 0.42, rotation: -1.45, scaleY: 0.963, zOrder: -45, easing: 'smooth' as const },
      { time: 0.8, rotation: -10, scaleY: 1.02, zOrder: -45, easing: 'smooth' as const },
      { time: 1.18, rotation: -1.45, scaleY: 0.963, zOrder: -45, easing: 'smooth' as const },
      { time: 1.22, rotation: -0.55, scaleY: 0.957, zOrder: 52, easing: 'smooth' as const },
      { time: 1.6, rotation: 8, scaleY: 0.9, zOrder: 52, easing: 'smooth' as const }
    ]

    const handRKeys = [
      { time: 0.0, rotation: 10, easing: 'smooth' as const },
      { time: 0.4, rotation: 1, easing: 'smooth' as const },
      { time: 0.8, rotation: -8, easing: 'smooth' as const },
      { time: 1.2, rotation: 1, easing: 'smooth' as const },
      { time: 1.6, rotation: 10, easing: 'smooth' as const }
    ]

    const thighLKeys = [
      { time: 0.0, rotation: 8, scaleX: 1.06, scaleY: 1.04, zOrder: 16, easing: 'smooth' as const },
      { time: 0.38, rotation: 5.6, scaleX: 1.017, scaleY: 1.007, zOrder: 16, easing: 'smooth' as const },
      { time: 0.42, rotation: 5.4, scaleX: 1.013, scaleY: 1.003, zOrder: -16, easing: 'smooth' as const },
      { time: 0.8, rotation: 3, scaleX: 0.97, scaleY: 0.97, zOrder: -16, easing: 'smooth' as const },
      { time: 1.18, rotation: 5.4, scaleX: 0.953, scaleY: 0.933, zOrder: -16, easing: 'smooth' as const },
      { time: 1.22, rotation: 5.6, scaleX: 0.951, scaleY: 0.931, zOrder: 16, easing: 'smooth' as const },
      { time: 1.6, rotation: 8, scaleX: 1.06, scaleY: 1.04, zOrder: 16, easing: 'smooth' as const }
    ]

    const shinLKeys = [
      { time: 0.0, rotation: -4, y: -5, scaleX: 1.08, scaleY: 1.05, zOrder: 15, easing: 'smooth' as const },
      { time: 0.38, rotation: -3.05, y: -2.6, scaleX: 1.028, scaleY: 1.012, zOrder: 15, easing: 'smooth' as const },
      { time: 0.42, rotation: -2.95, y: -2.4, scaleX: 1.022, scaleY: 1.008, zOrder: -17, easing: 'smooth' as const },
      { time: 0.8, rotation: -2, y: 0, scaleX: 0.97, scaleY: 0.97, zOrder: -17, easing: 'smooth' as const },
      { time: 1.18, rotation: -11.6, y: -0.4, scaleX: 0.953, scaleY: 0.883, zOrder: -17, easing: 'smooth' as const },
      { time: 1.22, rotation: -12.0, y: -0.6, scaleX: 0.951, scaleY: 0.881, zOrder: 15, easing: 'smooth' as const },
      { time: 1.6, rotation: -4, y: -5, scaleX: 1.08, scaleY: 1.05, zOrder: 15, easing: 'smooth' as const }
    ]

    const footLKeys = [
      { time: 0.0, rotation: 3, y: 8, scaleX: 1.12, scaleY: 0.96, easing: 'smooth' as const },
      { time: 0.4, rotation: 1, y: 2, scaleX: 1.02, scaleY: 1.0, easing: 'smooth' as const },
      { time: 0.8, rotation: -4, y: -3, scaleX: 0.97, scaleY: 1.0, easing: 'smooth' as const },
      { time: 1.2, rotation: -6, y: -8, scaleX: 0.95, scaleY: 0.98, easing: 'smooth' as const },
      { time: 1.6, rotation: 3, y: 8, scaleX: 1.12, scaleY: 0.96, easing: 'smooth' as const }
    ]

    const thighRKeys = [
      { time: 0.0, rotation: -3, scaleX: 0.97, scaleY: 0.97, zOrder: -16, easing: 'smooth' as const },
      { time: 0.38, rotation: -5.4, scaleX: 0.953, scaleY: 0.933, zOrder: -16, easing: 'smooth' as const },
      { time: 0.42, rotation: -5.6, scaleX: 0.951, scaleY: 0.931, zOrder: 16, easing: 'smooth' as const },
      { time: 0.8, rotation: -8, scaleX: 1.06, scaleY: 1.04, zOrder: 16, easing: 'smooth' as const },
      { time: 1.18, rotation: -5.6, scaleX: 1.017, scaleY: 1.007, zOrder: 16, easing: 'smooth' as const },
      { time: 1.22, rotation: -5.4, scaleX: 1.013, scaleY: 1.003, zOrder: -16, easing: 'smooth' as const },
      { time: 1.6, rotation: -3, scaleX: 0.97, scaleY: 0.97, zOrder: -16, easing: 'smooth' as const }
    ]

    const shinRKeys = [
      { time: 0.0, rotation: 2, y: 0, scaleX: 0.97, scaleY: 0.97, zOrder: -17, easing: 'smooth' as const },
      { time: 0.38, rotation: 11.6, y: -0.4, scaleX: 0.953, scaleY: 0.883, zOrder: -17, easing: 'smooth' as const },
      { time: 0.42, rotation: 12.0, y: -0.6, scaleX: 0.951, scaleY: 0.881, zOrder: 15, easing: 'smooth' as const },
      { time: 0.8, rotation: 4, y: -5, scaleX: 1.08, scaleY: 1.05, zOrder: 15, easing: 'smooth' as const },
      { time: 1.18, rotation: 3.05, y: -2.6, scaleX: 1.028, scaleY: 1.012, zOrder: 15, easing: 'smooth' as const },
      { time: 1.22, rotation: 2.95, y: -2.4, scaleX: 1.022, scaleY: 1.008, zOrder: -17, easing: 'smooth' as const },
      { time: 1.6, rotation: 2, y: 0, scaleX: 0.97, scaleY: 0.97, zOrder: -17, easing: 'smooth' as const }
    ]

    const footRKeys = [
      { time: 0.0, rotation: 4, y: -3, scaleX: 0.97, scaleY: 1.0, easing: 'smooth' as const },
      { time: 0.4, rotation: 6, y: -8, scaleX: 0.95, scaleY: 0.98, easing: 'smooth' as const },
      { time: 0.8, rotation: -3, y: 8, scaleX: 1.12, scaleY: 0.96, easing: 'smooth' as const },
      { time: 1.2, rotation: -1, y: 2, scaleX: 1.02, scaleY: 1.0, easing: 'smooth' as const },
      { time: 1.6, rotation: 4, y: -3, scaleX: 0.97, scaleY: 1.0, easing: 'smooth' as const }
    ]

    type WalkTemplateKey = Partial<BoneKeyframe> & { time: number }
    const roleMapping: Record<string, { role: string; label: string; keys: WalkTemplateKey[] }> = {
      pelvis: { role: 'pelvis', label: 'hông', keys: pelvisKeys },
      torso: { role: 'torso', label: 'thân', keys: torsoKeys },
      head: { role: 'head', label: 'đầu', keys: headKeys },
      'arm-l': { role: 'arm-l', label: 'bắp tay trái', keys: armLKeys },
      'forearm-l': { role: 'forearm-l', label: 'cẳng tay trái', keys: forearmLKeys },
      'hand-l': { role: 'hand-l', label: 'bàn tay trái', keys: handLKeys },
      'arm-r': { role: 'arm-r', label: 'bắp tay phải', keys: armRKeys },
      'forearm-r': { role: 'forearm-r', label: 'cẳng tay phải', keys: forearmRKeys },
      'hand-r': { role: 'hand-r', label: 'bàn tay phải', keys: handRKeys },
      'thigh-l': { role: 'thigh-l', label: 'đùi trái', keys: thighLKeys },
      'shin-l': { role: 'shin-l', label: 'cẳng chân trái', keys: shinLKeys },
      'foot-l': { role: 'foot-l', label: 'bàn chân trái', keys: footLKeys },
      'thigh-r': { role: 'thigh-r', label: 'đùi phải', keys: thighRKeys },
      'shin-r': { role: 'shin-r', label: 'cẳng chân phải', keys: shinRKeys },
      'foot-r': { role: 'foot-r', label: 'bàn chân phải', keys: footRKeys }
    }

    for (const [key, def] of Object.entries(roleMapping)) {
      const b =
        key === 'pelvis'
          ? (roleBone(bones, 'pelvis', 'hông') ?? bones.find((bone) => !bone.parentId))
          : roleBone(bones, def.role, def.label)
      if (b) {
        tracks[b.id] = mapKeys(def.keys)
      }
    }
  }

  for (const bone of bones) if (!tracks[bone.id]) assign(bone, () => ({}))
  return tracks
}

/** Sinh chuyển động chạy nhanh (Run Cycle) linh hoạt theo góc nhìn */
export function generateRunCycle(
  bones: LayerBone[],
  duration = 1.0,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const assign = (bone: LayerBone | undefined, pose: (p: number) => Partial<BonePose>) => {
    if (bone) tracks[bone.id] = track(duration, pose)
  }
  const pelvis = roleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)
  const unit = (pelvis?.length ?? 50) / 50

  if (viewAngle === 'side') {
    assign(pelvis, (p) => ({
      y: Number((-8 * Math.abs(Math.sin(p))).toFixed(2)),
      rotation: Number((3 * Math.sin(p)).toFixed(2))
    }))
    assign(roleBone(bones, 'torso', 'thân'), () => ({ rotation: 8 })) // Ngả nhiều về trước
    assign(roleBone(bones, 'head', 'đầu'), () => ({ rotation: -5 }))

    for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
      const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
      const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
      if (thigh) assign(thigh, (p) => ({ rotation: Number((42 * Math.sin(p + offset)).toFixed(2)) }))
      if (shin) {
        assign(shin, (p) => {
          const ph = p + offset
          const backFold = Math.cos(ph) > 0 ? 55 * Math.sin(ph) : 0
          return { rotation: Number(Math.max(-4, backFold).toFixed(2)) }
        })
      }
      assign(roleBone(bones, `foot-${side}`, `bàn chân ${label}`), (p) => {
        const ph = p + offset
        const ankleBend = Math.cos(ph) > 0 ? 15 * Math.sin(ph) : -10
        return { rotation: Number(ankleBend.toFixed(2)) }
      })
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((-48 * Math.sin(p + offset)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-35 - 25 * Math.sin(p + offset - 0.2)).toFixed(2))
      }))
      assign(roleBone(bones, `hand-${side}`, `bàn tay ${label}`), (p) => ({
        rotation: Number((-15 * Math.sin(p + offset - 0.4)).toFixed(2))
      }))
    }
  } else {
    // Chạy chính diện / chéo
    const signMod = viewAngle === 'back' ? -1 : 1
    assign(pelvis, (p) => ({
      x: 4 * unit * Math.sin(p),
      y: -6 * unit * Math.abs(Math.sin(p)),
      rotation: 3 * Math.sin(p)
    }))
    assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: -3 * Math.sin(p - 0.2) * signMod }))
    assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: 1.5 * Math.sin(p - 0.4) * signMod }))
    for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
      const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
      const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
      
      const stepPhase = (p: number) => Math.sin(p + offset)
      const lift = (p: number) => Math.max(0, stepPhase(p))
      
      if (thigh) {
        assign(thigh, (p) => ({ 
          rotation: sign * (4 + 6 * stepPhase(p)) * signMod,
          y: -22 * unit * lift(p),
          scaleX: 1 + 0.12 * stepPhase(p),
          scaleY: 1 + 0.12 * stepPhase(p),
          zOrder: Number((15 * stepPhase(p) * signMod).toFixed(1))
        }))
      }
      if (shin) {
        assign(shin, (p) => ({ 
          rotation: -sign * (6 + 8 * lift(p)) * signMod,
          y: -12 * unit * lift(p),
          scaleX: 1 + 0.15 * stepPhase(p),
          scaleY: 1 + 0.15 * stepPhase(p)
        }))
      }
      const armSwing = (p: number) => -Math.sin(p + offset)
      const forwardSwing = (p: number) => Math.max(0, armSwing(p))
      const backwardSwing = (p: number) => Math.max(0, -armSwing(p))
      
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: -sign * (4 + 10 * armSwing(p)) * signMod,
        y: -8 * unit * forwardSwing(p), // Đánh tay cao hơn khi chạy
        scaleX: 1 + 0.1 * forwardSwing(p) - 0.08 * backwardSwing(p),
        scaleY: 1 - 0.15 * forwardSwing(p),
        zOrder: Number(((60 * forwardSwing(p) - 25 * backwardSwing(p)) * signMod).toFixed(1))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: sign * (6 + 12 * forwardSwing(p)) * signMod,
        y: -20 * unit * forwardSwing(p), // Gập mạnh hơn khi chạy
        scaleX: 1 + 0.15 * forwardSwing(p) - 0.12 * backwardSwing(p),
        scaleY: 1 - 0.3 * forwardSwing(p)
      }))
      assign(roleBone(bones, `hand-${side}`, `bàn tay ${label}`), (p) => ({
        rotation: sign * (8 * forwardSwing(p)) * signMod,
        y: -24 * unit * forwardSwing(p), 
        scaleX: 1 + 0.18 * forwardSwing(p) - 0.1 * backwardSwing(p),
        scaleY: 1 - 0.35 * forwardSwing(p)
      }))
      assign(roleBone(bones, `foot-${side}`, `bàn chân ${label}`), (p) => ({
        rotation: -sign * (6 * lift(p)) * signMod,
        y: -12 * unit * lift(p),
        scaleX: 1 + 0.18 * stepPhase(p),
        scaleY: 1 + 0.18 * stepPhase(p)
      }))
    }
  }

  for (const bone of bones) if (!tracks[bone.id]) assign(bone, () => ({}))
  return tracks
}
