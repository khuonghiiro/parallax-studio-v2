import type { BoneKeyframe, BonePose, LayerBone } from '@shared/layerRig'

/** Match complete roles: "forearm-l" must never be mistaken for "arm-l". */
function roleBone(bones: LayerBone[], role: string, label: string): string | undefined {
  return bones.find((b) => b.id.replaceAll('_', '-').match(new RegExp(`(^|-)${role}$`)))?.id
    ?? bones.find((b) => b.name.toLocaleLowerCase('vi').includes(label))?.id
}

function track(duration: number, pose: (phase: number) => Partial<BonePose>): BoneKeyframe[] {
  return Array.from({ length: 33 }, (_, i) => ({ time: duration * i / 32,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth',
    ...pose((i % 32) / 32 * Math.PI * 2) }))
}

/** Frontal marching in place: mirrored, half-cycle legs and delayed opposite arms.
 * Natural frontal arm swing flexes forearms forward/inward with depth scaling rather than flaring sideways.
 */
export function generateWalkCycle(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const assign = (id: string | undefined, pose: (p: number) => Partial<BonePose>) => {
    if (id) tracks[id] = track(duration, pose)
  }
  const pelvis = roleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)?.id
  const unit = (bones.find((b) => b.id === pelvis)?.length ?? 50) / 50
  assign(pelvis, (p) => ({
    x: -4.5 * unit * Math.sin(p),
    y: unit * 5.5 * Math.cos(2 * p),
    rotation: -1.5 * Math.sin(p)
  }))
  assign(roleBone(bones, 'torso', 'thân'), (p) => ({
    rotation: 1.8 * Math.sin(p - 0.2),
    y: -1.0 * Math.cos(2 * p)
  }))
  assign(roleBone(bones, 'head', 'đầu'), (p) => ({
    rotation: -0.8 * Math.sin(p - 0.4),
    y: 0.5 * Math.cos(2 * p)
  }))

  for (const [side, label, sign, offset] of [
    ['l', 'trái', 1, 0],
    ['r', 'phải', -1, Math.PI]
  ] as const) {
    const legPhase = (p: number) => ((p + offset) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
    const swingLift = (p: number) => {
      const phi = legPhase(p)
      return phi < Math.PI ? Math.sin(phi) : 0
    }

    // Đùi nhấc lên khi bước chân (swing phase), tăng nhẹ tỉ lệ chiều sâu phối cảnh
    assign(roleBone(bones, `thigh-${side}`, `đùi ${label}`), (p) => {
      const l = swingLift(p)
      return {
        y: -11 * (l ** 1.4),
        rotation: sign * 1.5 * Math.sin(p + offset),
        scaleY: 1 + 0.04 * l,
        scaleX: 1 + 0.03 * l
      }
    })

    // Cẳng chân đi theo đùi, giữ khớp gối khít
    assign(roleBone(bones, `shin-${side}`, `cẳng chân ${label}`), (p) => {
      const l = swingLift(p)
      return {
        rotation: -sign * 1.5 * Math.sin(p + offset),
        scaleY: 1 + 0.05 * l,
        scaleX: 1 + 0.05 * l
      }
    })

    // TAY VUNG CHÍNH DIỆN:
    // Đánh tay ngược pha với chân (offset + PI)
    // Khi đánh tới trước: cẳng tay gập lên ở khuỷu tay (y âm), cổ tay hướng nhẹ vào trong ngực, không bạt ngang
    const armPhase = (p: number) => legPhase(p + Math.PI)
    assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => {
      const fwd = Math.cos(armPhase(p))
      return {
        x: sign * 0.8 * fwd,
        y: -2.0 * fwd,
        rotation: sign * (0.8 * fwd),
        scaleY: 1 + 0.03 * fwd,
        scaleX: 1 + 0.03 * fwd
      }
    })
    assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => {
      const fwd = Math.cos(armPhase(p))
      const lift = Math.max(0, fwd)
      return {
        x: sign * 1.5 * lift,
        y: -9.0 * (lift ** 1.3) + 3.0 * Math.max(0, -fwd),
        rotation: sign * 3.5 * lift,
        scaleY: 1 + 0.07 * lift - 0.04 * Math.max(0, -fwd),
        scaleX: 1 + 0.06 * lift - 0.03 * Math.max(0, -fwd)
      }
    })
  }
  // Unknown bones remain at rest; the parent still carries them along.
  for (const bone of bones) if (!tracks[bone.id]) assign(bone.id, () => ({}))
  return tracks
}
