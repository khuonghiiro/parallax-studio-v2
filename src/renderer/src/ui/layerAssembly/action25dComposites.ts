import type { AnimationClip, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import { weldConnectedLimbBones } from './mohoRigHelpers'
import type { AssembledLayerItem, LayerComposite } from './types'
import { createClipFromPreset } from './workshopRigPresets'

type BoneSpec = [id: string, name: string, x: number, y: number, length: number, angle: number, parentId?: string]

interface PartExtra {
  rotation?: number
  hidden?: boolean
  slot?: string
  variant?: string
  partGroupId?: string
}

type PartSpec = [
  id: string,
  name: string,
  boneId: string,
  x: number,
  y: number,
  z: number,
  extra?: PartExtra
]

type PresetKey = Parameters<typeof createClipFromPreset>[0]

function makeBones(specs: BoneSpec[]): LayerBone[] {
  return weldConnectedLimbBones(
    specs.map(([id, name, x, y, length, angle, parentId]) => ({
      id,
      name,
      ...(parentId ? { parentId } : {}),
      x,
      y,
      length,
      angle
    }))
  )
}

function makeParts(prefix: string, folder: string, specs: PartSpec[]): AssembledLayerItem[] {
  return specs.map(([id, name, boneId, x, y, z, extra]) => ({
    id: `${prefix}-${id}`,
    name,
    assetPath: `scenes-action-25d/${folder}/${id}.png`,
    x,
    y,
    z,
    scale: 1,
    rotation: extra?.rotation ?? 0,
    opacity: 1,
    boneId,
    bindingMode: 'rigid',
    ...(extra?.hidden ? { hidden: true } : {}),
    ...(extra?.slot ? { slot: extra.slot } : {}),
    ...(extra?.variant ? { variant: extra.variant } : {}),
    ...(extra?.partGroupId ? { partGroupId: extra.partGroupId } : {}),
    motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
  }))
}

function makeRig(bones: LayerBone[], presets: PresetKey[], viewAngle: MotionViewAngle = 'side'): LayerRig {
  const clips: AnimationClip[] = presets.map((preset) => {
    const clip = createClipFromPreset(preset, bones, undefined, viewAngle)
    return { ...clip, viewAngle }
  })
  const first = clips[0]
  return {
    bones,
    fps: 30,
    duration: first?.duration ?? 1.6,
    loop: first?.loop ?? true,
    tracks: first?.tracks ?? {},
    clips,
    activeClipId: first?.id ?? presets[0]
  }
}

const HERO_BONES: BoneSpec[] = [
  ['bone-pelvis', 'Hông (Root)', 0, 52, 86, -90],
  ['bone-torso', 'Thân & Giáp ngực', 0, -34, 146, -85, 'bone-pelvis'],
  ['bone-cape', 'Áo choàng bay (Cape)', -18, -138, 180, 108, 'bone-torso'],
  ['bone-head', 'Đầu & Búi tóc', 14, -180, 118, -88, 'bone-torso'],
  ['bone-arm-l', 'Vai & Tay trước (Kiếm)', -39, -130, 128, 86, 'bone-torso'],
  ['bone-forearm-l', 'Cẳng tay & Trường kiếm', -30, -2, 120, 74, 'bone-arm-l'],
  ['bone-arm-r', 'Vai & Tay sau', 42, -144, 130, 90, 'bone-torso'],
  ['bone-forearm-r', 'Cẳng tay sau', 42, -14, 120, 90, 'bone-arm-r'],
  ['bone-thigh-l', 'Đùi trước (Trái)', -20, 62, 154, 92, 'bone-pelvis'],
  ['bone-shin-l', 'Ống quyển & Giày trước', -25, 216, 178, 90, 'bone-thigh-l'],
  ['bone-thigh-r', 'Đùi sau (Phải)', 26, 62, 154, 90, 'bone-pelvis'],
  ['bone-shin-r', 'Ống quyển & Giày sau', 26, 216, 178, 90, 'bone-thigh-r']
]

const HERO_PARTS: PartSpec[] = [
  ['cape', 'Áo choàng sau (Bật/Tắt)', 'bone-cape', 0, 93.7, -34],
  ['arm-r', 'Bắp tay sau', 'bone-arm-r', 44.2, -83.2, -26],
  ['forearm-r', 'Cẳng tay sau', 'bone-forearm-r', 45.2, 53.2, -24],
  ['thigh-r', 'Đùi sau', 'bone-thigh-r', 27.6, 131.9, -20],
  ['shin-r', 'Chân & Ủng sau', 'bone-shin-r', 39.4, 298.4, -18],
  ['thigh-l', 'Đùi trước', 'bone-thigh-l', -18.4, 132.7, -8],
  ['shin-l', 'Chân & Ủng trước', 'bone-shin-l', -11.4, 299.2, -6],
  ['torso', 'Thân áo chiến giáp', 'bone-torso', 3.2, -96.6, 2],
  ['pelvis', 'Đai hông & Vạt giáp', 'bone-pelvis', 3.5, 63.5, 4],
  [
    'head-calm',
    'Biểu cảm: Điềm tĩnh',
    'bone-head',
    -4.7,
    -256.3,
    10,
    { slot: 'expression', variant: 'calm', partGroupId: 'pg-hero-expr' }
  ],
  [
    'head-shout',
    'Biểu cảm: Hét xung phong (Ẩn sẵn)',
    'bone-head',
    -4.9,
    -257.0,
    10,
    { hidden: true, slot: 'expression', variant: 'shout', partGroupId: 'pg-hero-expr' }
  ],
  ['arm-l', 'Bắp tay trước', 'bone-arm-l', -33.1, -81.9, 16],
  ['forearm-l', 'Cẳng tay cầm Trường Kiếm', 'bone-forearm-l', 10.2, 119.7, 22]
]

const WOLF_BONES: BoneSpec[] = [
  ['bone-pelvis', 'Hông sói (Root)', -84, 16, 96, 0],
  ['bone-torso', 'Thân & Vai sói', 12, 12, 108, -4, 'bone-pelvis'],
  ['bone-neck', 'Cổ & Bờm', 104, -14, 52, -48, 'bone-torso'],
  ['bone-head', 'Đầu Linh Lang', 128, -44, 92, 8, 'bone-neck'],
  ['bone-jaw', 'Hàm dưới', 136, -24, 60, 14, 'bone-head'],
  ['bone-tail', 'Gốc đuôi', -136, -6, 92, 165, 'bone-pelvis'],
  ['bone-tail-tip', 'Chóp đuôi linh khí', -232, 10, 84, 142, 'bone-tail'],
  ['bone-leg-fl-thigh', 'Vai trước trái', 86, 26, 96, 86, 'bone-torso'],
  ['bone-leg-fl-shin', 'Cẳng chân trước trái', 92, 122, 98, 92, 'bone-leg-fl-thigh'],
  ['bone-leg-fr-thigh', 'Vai trước phải (Xa)', 60, 26, 96, 94, 'bone-torso'],
  ['bone-leg-fr-shin', 'Cẳng chân trước phải', 54, 122, 98, 90, 'bone-leg-fr-thigh'],
  ['bone-leg-bl-thigh', 'Đùi sau trái', -68, 26, 102, 98, 'bone-pelvis'],
  ['bone-leg-bl-shin', 'Cẳng chân sau trái', -82, 128, 94, 82, 'bone-leg-bl-thigh'],
  ['bone-leg-br-thigh', 'Đùi sau phải (Xa)', -94, 26, 102, 102, 'bone-pelvis'],
  ['bone-leg-br-shin', 'Cẳng chân sau phải', -112, 128, 94, 82, 'bone-leg-br-thigh']
]

const WOLF_PARTS: PartSpec[] = [
  ['leg-fr-thigh', 'Đùi trước xa', 'bone-leg-fr-thigh', 60.0, 64.1, -24],
  ['leg-fr-shin', 'Bàn chân trước xa', 'bone-leg-fr-shin', 69.0, 172.2, -22],
  ['leg-br-thigh', 'Đùi sau xa', 'bone-leg-br-thigh', -90.0, 66.8, -20],
  ['leg-br-shin', 'Bàn chân sau xa', 'bone-leg-br-shin', -103.1, 167.5, -18],
  ['tail-tip', 'Chóp đuôi xù', 'bone-tail-tip', -283.2, -5.8, -14],
  ['tail', 'Đoạn gốc đuôi', 'bone-tail', -191.2, 2.8, -12],
  ['pelvis', 'Hông & Lưng sau', 'bone-pelvis', -71.0, 34.0, 0],
  ['torso', 'Ngực & Bờm cổ sói', 'bone-torso', 20.4, 1.3, 6],
  ['jaw', 'Hàm dưới nhe nanh', 'bone-jaw', 172.0, -4.6, 10, { rotation: -10 }],
  ['head', 'Đầu Linh Lang', 'bone-head', 164.7, -80.0, 14],
  ['leg-fl-thigh', 'Đùi trước gần', 'bone-leg-fl-thigh', 86.0, 64.1, 16],
  ['leg-fl-shin', 'Bàn chân trước gần', 'bone-leg-fl-shin', 105.1, 172.2, 18],
  ['leg-bl-thigh', 'Đùi sau gần', 'bone-leg-bl-thigh', -64.2, 66.8, 20],
  ['leg-bl-shin', 'Bàn chân sau gần', 'bone-leg-bl-shin', -74.0, 167.5, 22]
]

const MONSTER_BONES: BoneSpec[] = [
  ['bone-pelvis', 'Hông ma thú (Root)', 0, 70, 58, -95],
  ['bone-torso', 'Ngực đá hắc ám', -4, 14, 158, -102, 'bone-pelvis'],
  ['bone-head', 'Sọ sừng quái thú', -34, -142, 108, 174, 'bone-torso'],
  ['bone-jaw', 'Hàm răng nanh', -32, -118, 80, 172, 'bone-head'],
  ['bone-arm-r', 'Vai & Bắp tay trước (Phải)', 48, -148, 118, 114, 'bone-torso'],
  ['bone-forearm-r', 'Cẳng vuốt trước (Phải)', 2, -32, 136, 140, 'bone-arm-r'],
  ['bone-arm-l', 'Vai & Bắp tay sau (Trái)', -64, -138, 110, 104, 'bone-torso'],
  ['bone-forearm-l', 'Cẳng vuốt sau (Trái)', -86, -32, 130, 138, 'bone-arm-l'],
  ['bone-thigh-r', 'Đùi trước (Phải)', 42, 82, 132, 114, 'bone-pelvis'],
  ['bone-shin-r', 'Cẳng chân móng (Phải)', -16, 200, 144, 72, 'bone-thigh-r'],
  ['bone-thigh-l', 'Đùi sau (Trái)', -44, 82, 132, 118, 'bone-pelvis'],
  ['bone-shin-l', 'Cẳng chân móng (Trái)', -104, 200, 144, 74, 'bone-thigh-l'],
  ['bone-tail', 'Gốc đuôi gai', 52, 54, 124, 26, 'bone-pelvis'],
  ['bone-tail-tip', 'Đuôi gai nhọn', 162, 108, 112, -10, 'bone-tail']
]

const MONSTER_PARTS: PartSpec[] = [
  ['arm-l', 'Vai sau trái', 'bone-arm-l', -77.4, -87.6, -26],
  ['forearm-l', 'Vuốt sau trái', 'bone-forearm-l', -100.6, 39.4, -24],
  ['thigh-l', 'Đùi sau trái', 'bone-thigh-l', -67.2, 140.0, -18],
  ['shin-l', 'Bàn chân sau trái', 'bone-shin-l', -93.0, 261.2, -16],
  ['tail', 'Đốt gốc đuôi', 'bone-tail', 112.5, 84.4, -14],
  ['tail-tip', 'Chóp đuôi gai', 'bone-tail-tip', 228.9, 128.6, -12],
  ['thigh-r', 'Đùi trước gần', 'bone-thigh-r', 14.8, 138.9, -6],
  ['shin-r', 'Bàn chân trước gần', 'bone-shin-r', -2.7, 260.8, -4],
  ['torso', 'Thân giáp hắc ám', 'bone-torso', 1.4, -77.2, 4],
  ['pelvis', 'Đai hông quái thú', 'bone-pelvis', 3.9, 70.0, 8],
  ['jaw', 'Hàm dưới nhe nanh', 'bone-jaw', -67.8, -97.1, 11, { rotation: 4 }],
  ['head', 'Đầu sừng ma thú', 'bone-head', -45.4, -207.3, 14],
  ['arm-r', 'Bắp tay trước gần', 'bone-arm-r', 48.0, -109.7, 18],
  ['forearm-r', 'Đại trảo trước gần', 'bone-forearm-r', 47.8, 47.8, 22]
]

const EAGLE_BONES: BoneSpec[] = [
  ['bone-bird-body', 'Thân & Đuôi Linh Ưng', 0, 12, 145, -36],
  ['bone-bird-head', 'Đầu & Mỏ ưng', 112, -88, 65, 10, 'bone-bird-body'],
  ['bone-bird-wing-l', 'Cánh gần (Trái)', -8, -28, 165, -38, 'bone-bird-body'],
  ['bone-bird-wing-r', 'Cánh xa (Phải)', 16, -38, 155, -38, 'bone-bird-body']
]

const EAGLE_PARTS: PartSpec[] = [
  ['wing-r', 'Cánh sau (Phải)', 'bone-bird-wing-r', 126.5, -107.4, -14],
  ['bird-body', 'Thân, Đầu & Móng ưng', 'bone-bird-body', 0.0, 5.9, 0],
  ['wing-l', 'Cánh trước (Trái)', 'bone-bird-wing-l', 112.7, -103.5, 14]
]

export const SWORD_HUNTER_25D_COMPOSITE: LayerComposite = {
  id: 'comp-action-sword-hunter-25d',
  name: '⚔️ Kiếm Khách Thanh Đao 2.5D (Chiến Đấu & Biểu Cảm)',
  category: 'character',
  description:
    'Nhân vật kiếm khách góc nghiêng 3/4 (+X) tách rời 13 bộ phận giải phẫu chuẩn mực (áo choàng, tay kiếm trước, tay sau, đùi/ống quyển và 2 đầu biểu cảm Điềm tĩnh / Hét xung phong), tích hợp sẵn động tác đi, chạy, liên hoàn kiếm chiêu và né đòn phản kích.',
  width: 680,
  height: 860,
  layers: makeParts('hero', 'hero', HERO_PARTS),
  rig: makeRig(makeBones(HERO_BONES), ['idle', 'walk', 'run', 'combat', 'dodge_counter', 'martial_kick', 'hit_recoil'], 'side')
}

export const SPIRIT_WOLF_25D_COMPOSITE: LayerComposite = {
  id: 'comp-action-spirit-wolf-25d',
  name: '🐺 Linh Lang Bạch Ngân 2.5D (Tứ Chi & Hàm Đa Khớp)',
  category: 'animal',
  description:
    'Linh thú sói 2.5D tách rời 14 bộ phận (4 cặp đùi/chân riêng biệt, đầu, hàm dưới nhe nanh và đuôi 2 đốt) với hệ khớp hàn chuẩn vị trí cho động tác bước săn mồi, phi nước đại và trúng đòn lùi lại.',
  width: 680,
  height: 520,
  layers: makeParts('wolf', 'wolf', WOLF_PARTS),
  rig: makeRig(makeBones(WOLF_BONES), ['quadruped_walk', 'quadruped_gallop', 'hit_recoil'], 'side')
}

export const SHADOW_MONSTER_25D_COMPOSITE: LayerComposite = {
  id: 'comp-action-shadow-monster-25d',
  name: '👹 Hắc Ám Ma Thú 2.5D (Quái Vật Chiến Đấu)',
  category: 'character',
  description:
    'Boss quái vật bóng đêm hướng trái (-X) gồm 14 bộ phận tách nền sạch (sọ sừng, hàm nanh cử động độc lập, cặp đại trảo trước/sau, đùi/cẳng móng vuốt và đuôi gai 2 đốt), sẵn sàng các động tác rình mồi, gầm vang, vồ trảo và trúng kiếm bật lùi.',
  width: 720,
  height: 740,
  layers: makeParts('monster', 'monster', MONSTER_PARTS),
  rig: makeRig(makeBones(MONSTER_BONES), ['monster_prowl', 'monster_roar', 'monster_pounce', 'hit_recoil'], 'side')
}

export const SPIRIT_EAGLE_25D_COMPOSITE: LayerComposite = {
  id: 'comp-action-spirit-eagle-25d',
  name: '🦅 Kim Sí Linh Ưng 2.5D (Cánh Đôi Đập Đồng Pha)',
  category: 'animal',
  description:
    'Linh điểu 2.5D hướng bay (+X) tách thân đầu vuốt và cặp cánh trước/sau độc lập, tối ưu động tác vỗ cánh đồng pha trên nền bầu trời parallax.',
  width: 620,
  height: 520,
  layers: makeParts('eagle', 'eagle', EAGLE_PARTS),
  rig: makeRig(makeBones(EAGLE_BONES), ['wing_flap'], 'side')
}
