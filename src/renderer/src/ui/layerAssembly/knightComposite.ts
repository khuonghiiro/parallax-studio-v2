import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { generateWalkCycle } from './workshopWalkCycle'
import { generateIdleBreathe, generateActionSlash } from './workshopRigPresets'

const bones: LayerBone[] = [
  { id: 'bone-pelvis', name: 'Hông', x: 0, y: 38, length: 38, angle: -90 },
  { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: 0, length: 95, angle: -90 },
  { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -95, length: 95, angle: -90 }
]
for (const [side, label, sign] of [['l', 'trái', -1], ['r', 'phải', 1]] as const) {
  bones.push(
    { id: `bone-arm-${side}`, name: `Bắp tay ${label}`, parentId: 'bone-torso', x: sign * 58, y: -70, length: 70, angle: 90 },
    { id: `bone-forearm-${side}`, name: `Cẳng tay ${label}`, parentId: `bone-arm-${side}`, x: sign * 58, y: 0, length: 67, angle: 90 },
    { id: `bone-thigh-${side}`, name: `Đùi ${label}`, parentId: 'bone-pelvis', x: sign * 29, y: 43, length: 77, angle: 90 },
    { id: `bone-shin-${side}`, name: `Cẳng chân ${label}`, parentId: `bone-thigh-${side}`, x: sign * 29, y: 120, length: 91, angle: 90 }
  )
}

function part(role: string, name: string, x: number, y: number, z: number): AssembledLayerItem {
  return { id: `knight-${role}`, name, boneId: `bone-${role}`, bindingMode: 'rigid',
    assetPath: `character_hero/v2/${role.replaceAll('-', '_')}.png`, x, y, z,
    scale: 0.5, rotation: 0, opacity: 1,
    motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' } }
}

const walkTracks = generateWalkCycle(bones, 1.6)
const idleTracks = generateIdleBreathe(bones, 2.4)
const actionTracks = generateActionSlash(bones, 1.5)

const knightClips: AnimationClip[] = [
  { id: 'clip-knight-walk', name: 'Bước đi (Walk)', duration: 1.6, loop: true, tracks: walkTracks, description: 'Bước chân tiếp đất chính diện giữ vững chiều dài chi' },
  { id: 'clip-knight-idle', name: 'Đứng thở (Idle)', duration: 2.4, loop: true, tracks: idleTracks, description: 'Đứng thở thả lỏng nhẹ nhàng' },
  { id: 'clip-knight-action', name: 'Vung đòn (Action)', duration: 1.5, loop: true, tracks: actionTracks, description: 'Vung tay tung đòn chém dứt khoát' }
]

/** Artwork is 2x the logical dimensions; shared joint pivots overlap covered armor ends. */
export const KNIGHT_COMPOSITE: LayerComposite = {
  id: 'comp-knight-hero', name: 'Hiệp Sĩ Tí Hon — Bước Đi Nhịp Nhàng', category: 'character',
  description: '11 mảnh giáp vẽ đồng bộ, khớp vai/khuỷu/gối chồng lấp. Đầy đủ các động tác bước đi, đứng thở và vung đòn.',
  width: 420, height: 540,
  layers: [
    part('thigh-l', 'Đùi trái', -29, 83, 0), part('thigh-r', 'Đùi phải', 29, 83, 0),
    part('shin-l', 'Cẳng chân & Ủng trái', -30, 165, -5), part('shin-r', 'Cẳng chân & Ủng phải', 30, 165, -5),
    part('torso', 'Thân & Giáp ngực', 0, -38, -12), part('pelvis', 'Hông & Thắt lưng', 0, 30, -18),
    part('arm-l', 'Bắp tay & Giáp vai trái', -58, -36, -25), part('arm-r', 'Bắp tay & Giáp vai phải', 58, -36, -25),
    part('head', 'Mũ giáp & Chùm lông đỏ', -6, -159, -32),
    part('forearm-l', 'Cẳng tay & Găng trái', -58, 32, -42), part('forearm-r', 'Cẳng tay & Găng phải', 58, 32, -42)
  ],
  rig: {
    bones,
    duration: 1.6,
    loop: true,
    tracks: walkTracks,
    clips: knightClips,
    activeClipId: 'clip-knight-walk'
  }
}

