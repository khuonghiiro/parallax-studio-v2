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
 * Only root translation is animated. Child pivots and armor dimensions stay attached.
 */
export function generateWalkCycle(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const assign = (id: string | undefined, pose: (p: number) => Partial<BonePose>) => {
    if (id) tracks[id] = track(duration, pose)
  }
  const pelvis = roleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)?.id
  const unit = (bones.find((b) => b.id === pelvis)?.length ?? 50) / 50
  assign(pelvis, (p) => ({
    x: -5.5 * unit * Math.sin(p),
    y: unit * 6.5 * Math.cos(2 * p),
    rotation: -2.0 * Math.sin(p)
  }))
  assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: 2.8 * Math.sin(p - 0.2) }))
  assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: -1.2 * Math.sin(p - 0.4) }))

  for (const [side, label, sign, offset] of [
    ['l', 'trái', 1, 0],
    ['r', 'phải', -1, Math.PI]
  ] as const) {
    const legPhase = (p: number) => ((p + offset) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
    const swingLift = (p: number) => {
      const phi = legPhase(p)
      return phi < Math.PI ? Math.sin(phi) : 0
    }

    // Đùi nhấc lên khi bước chân (swing phase)
    assign(roleBone(bones, `thigh-${side}`, `đùi ${label}`), (p) => {
      const l = swingLift(p)
      return {
        y: -12 * (l ** 1.5),
        rotation: sign * (l > 0 ? 4.5 * l : 1.5 * Math.sin(p + offset))
      }
    })

    // Cẳng chân đi theo đùi, giữ khớp gối khít
    assign(roleBone(bones, `shin-${side}`, `cẳng chân ${label}`), (p) => {
      const l = swingLift(p)
      return {
        rotation: -sign * (l > 0 ? 4.5 * l : 1.5 * Math.sin(p + offset))
      }
    })

    // Bắp tay và cẳng tay vung đối xứng tự nhiên
    assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({
      rotation: -sign * 8.0 * Math.sin(p + offset + 0.25)
    }))
    assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({
      rotation: -sign * 5.5 * Math.sin(p + offset - 0.1)
    }))
  }
  // Unknown bones remain at rest; the parent still carries them along.
  for (const bone of bones) if (!tracks[bone.id]) assign(bone.id, () => ({}))
  return tracks
}
