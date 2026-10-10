import type { BoneKeyframe, BonePose, LayerBone } from '@shared/layerRig'
import { solveWalkLeg, walkRoot } from './workshopWalkFeet'

/** Match complete roles: forearm-l must never be mistaken for arm-l. */
function roleBone(bones: LayerBone[], role: string, label: string): LayerBone | undefined {
  return bones.find((b) => b.id.replaceAll('_', '-').match(new RegExp(`(^|-)${role}$`)))
    ?? bones.find((b) => b.name.toLocaleLowerCase('vi').includes(label))
}

function track(duration: number, pose: (phase: number) => Partial<BonePose>): BoneKeyframe[] {
  return Array.from({ length: 65 }, (_, i) => ({ time: duration * i / 64,
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth',
    ...pose((i % 64) / 64 * Math.PI * 2) }))
}

/** Frontal in-place walk: planted ankles, fixed limb lengths, alternating support. */
export function generateWalkCycle(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const assign = (bone: LayerBone | undefined, pose: (p: number) => Partial<BonePose>) => {
    if (bone) tracks[bone.id] = track(duration, pose)
  }
  const pelvis = roleBone(bones, 'pelvis', 'hông') ?? bones.find((b) => !b.parentId)
  const unit = (pelvis?.length ?? 50) / 50
  assign(pelvis, (p) => walkRoot(p, unit))
  assign(roleBone(bones, 'torso', 'thân'), (p) => ({ rotation: -1.5 * Math.sin(p - 0.2) }))
  assign(roleBone(bones, 'head', 'đầu'), (p) => ({ rotation: 0.8 * Math.sin(p - 0.4) }))
  for (const [side, label, sign, offset] of [['l', 'trái', 1, 0], ['r', 'phải', -1, Math.PI]] as const) {
    const thigh = roleBone(bones, `thigh-${side}`, `đùi ${label}`)
    const shin = roleBone(bones, `shin-${side}`, `cẳng chân ${label}`)
    if (thigh && shin) {
      assign(thigh, (p) => ({ rotation: solveWalkLeg(thigh, shin, p, offset, sign, unit).thigh }))
      assign(shin, (p) => ({ rotation: solveWalkLeg(thigh, shin, p, offset, sign, unit).shin }))
    }
    assign(roleBone(bones, `arm-${side}`, `bắp tay ${label}`), (p) => ({ rotation: sign * (2 + 4 * Math.sin(p + offset + 0.25)) }))
    assign(roleBone(bones, `forearm-${side}`, `cẳng tay ${label}`), (p) => ({ rotation: -sign * (4 + 4 * Math.sin(p + offset - 0.3)) }))
  }
  for (const bone of bones) if (!tracks[bone.id]) assign(bone, () => ({}))
  return tracks
}
