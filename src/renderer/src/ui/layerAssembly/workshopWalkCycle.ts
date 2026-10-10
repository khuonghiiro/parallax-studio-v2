import type { BoneKeyframe, BonePose, LayerBone, MotionViewAngle } from '@shared/layerRig'
import { solveWalkLeg, walkRoot } from './workshopWalkFeet'

/** Match complete roles: forearm-l must never be mistaken for arm-l. */
function roleBone(bones: LayerBone[], role: string, label: string): LayerBone | undefined {
  return bones.find((b) => b.id.replaceAll('_', '-').match(new RegExp(`(^|-)${role}$`)))
    ?? bones.find((b) => b.name.toLocaleLowerCase('vi').includes(label))
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
      // Tay vung ngược pha với chân
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((-28 * Math.sin(p + offset)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-14 - 16 * Math.sin(p + offset - 0.3)).toFixed(2))
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
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((sign * 3 - 18 * Math.sin(p + offset + 0.2)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-sign * 3 - 10 * Math.sin(p + offset - 0.2)).toFixed(2))
      }))
    }
  } else {
    // === GÓC CHÍNH DIỆN 0° (Frontal) & SAU LƯNG 180° ===
    const signMod = viewAngle === 'back' ? -1 : 1
    assign(pelvis, (p) => {
      const r = walkRoot(p, unit)
      // Thêm lắt le hông trái/phải nhẹ nhàng
      return { x: 3 * unit * Math.sin(p), y: r.y, rotation: 1.5 * Math.sin(p) }
    })
    assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: -1.5 * Math.sin(p - 0.2) * signMod }))
    assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: 0.8 * Math.sin(p - 0.4) * signMod }))
    
    for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
      const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
      const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
      
      const stepPhase = (p: number) => Math.sin(p + offset)
      const lift = (p: number) => Math.max(0, stepPhase(p))
      
      if (thigh) {
        assign(thigh, (p) => ({ 
          rotation: sign * (2 + 3 * stepPhase(p)) * signMod, // Lắc nhẹ đùi
          y: -14 * unit * lift(p), // Nhấc đùi lên theo trục Y để mô phỏng bước tới
          scaleX: 1 + 0.08 * stepPhase(p), // Phóng to/thu nhỏ tạo cảm giác phối cảnh 3D
          scaleY: 1 + 0.08 * stepPhase(p)
        }))
      }
      if (shin) {
        assign(shin, (p) => ({ 
          rotation: -sign * (2 + 4 * lift(p)) * signMod, // Mũi chân hơi cụp vào trong
          y: -6 * unit * lift(p), // Cẳng chân co thêm lên
          scaleX: 1 + 0.12 * stepPhase(p),
          scaleY: 1 + 0.12 * stepPhase(p)
        }))
      }
      const armSwing = (p: number) => -Math.sin(p + offset) // Tay vung ngược pha với chân
      const forwardSwing = (p: number) => Math.max(0, armSwing(p))
      const backwardSwing = (p: number) => Math.max(0, -armSwing(p))

      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: -sign * (2 + 5 * armSwing(p)) * signMod, // Vung tới -> xoay nhẹ vào trong
        y: -4 * unit * forwardSwing(p), // Hơi nhấc vai khi vung tay tới
        scaleX: 1 + 0.05 * forwardSwing(p) - 0.05 * backwardSwing(p), // To ra khi tới gần, nhỏ đi khi lùi sau
        scaleY: 1 - 0.1 * forwardSwing(p) // Bắp tay ngắn lại do phối cảnh chiếu trục Z
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: sign * (2 + 6 * forwardSwing(p)) * signMod,
        y: -14 * unit * forwardSwing(p), // Trượt cẳng tay lên trên (gập khuỷu tay hướng về camera)
        scaleX: 1 + 0.1 * forwardSwing(p) - 0.08 * backwardSwing(p),
        scaleY: 1 - 0.2 * forwardSwing(p) // Cẳng tay ngắn lại rõ rệt do chỉa thẳng vào camera
      }))
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
      assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
        rotation: Number((-48 * Math.sin(p + offset)).toFixed(2))
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: Number((-35 - 25 * Math.sin(p + offset - 0.2)).toFixed(2))
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
          scaleY: 1 + 0.12 * stepPhase(p)
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
        scaleY: 1 - 0.15 * forwardSwing(p)
      }))
      assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
        rotation: sign * (6 + 12 * forwardSwing(p)) * signMod,
        y: -20 * unit * forwardSwing(p), // Gập mạnh hơn khi chạy
        scaleX: 1 + 0.15 * forwardSwing(p) - 0.12 * backwardSwing(p),
        scaleY: 1 - 0.3 * forwardSwing(p)
      }))
    }
  }

  for (const bone of bones) if (!tracks[bone.id]) assign(bone, () => ({}))
  return tracks
}
