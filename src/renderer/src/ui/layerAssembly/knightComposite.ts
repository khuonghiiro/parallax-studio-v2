import type { LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { generateWalkCycle } from './workshopWalkCycle'

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

function part(role: string, name: string, x: number, y: number, z: number, mode: 'soft' | 'rigid' = 'soft'): AssembledLayerItem {
  return { id: `knight-${role}`, name, boneId: `bone-${role}`, bindingMode: mode,
    assetPath: `character_hero/v2/${role.replaceAll('-', '_')}.png`, x, y, z,
    scale: 0.5, rotation: 0, opacity: 1,
    motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' } }
}

/** Artwork is 2x the logical dimensions; shared joint pivots overlap covered armor ends. */
export const KNIGHT_COMPOSITE: LayerComposite = {
  id: 'comp-knight-hero', name: 'Hiệp Sĩ Tí Hon — Bước Đi Nhịp Nhàng', category: 'character',
  description: '11 mảnh giáp vẽ đồng bộ, khớp vai/khuỷu/gối chồng lấp. Bước tại chỗ chính diện, giữ chiều dài chi và nối vòng liên tục.',
  width: 420, height: 540,
  layers: [
    part('thigh-l', 'Đùi trái', -29, 83, 35, 'soft'), part('thigh-r', 'Đùi phải', 29, 83, 35, 'soft'),
    part('shin-l', 'Cẳng chân & Ủng trái', -30, 165, 22, 'soft'), part('shin-r', 'Cẳng chân & Ủng phải', 30, 165, 22, 'soft'),
    part('torso', 'Thân & Giáp ngực', 0, -38, 10, 'soft'), part('pelvis', 'Hông & Thắt lưng', 0, 30, 0, 'soft'),
    part('arm-l', 'Bắp tay & Giáp vai trái', -58, -36, -6, 'soft'), part('arm-r', 'Bắp tay & Giáp vai phải', 58, -36, -6, 'soft'),
    part('head', 'Mũ giáp & Chùm lông đỏ', -6, -159, -15, 'rigid'),
    part('forearm-l', 'Cẳng tay & Găng trái', -58, 32, -25, 'soft'), part('forearm-r', 'Cẳng tay & Găng phải', 58, 32, -25, 'soft')
  ],
  rig: { bones, duration: 1.6, loop: true, tracks: generateWalkCycle(bones) }
}
