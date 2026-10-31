import { createTemplateComposite } from './templateBuilder'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import {
  generateWalkCycle,
  generateIdleBreathe,
  generateActionSlash,
  generateWaveHand,
  generateBow
} from '../workshopRigPresets'
import { weldConnectedLimbBones } from '../mohoRigHelpers'

/**
 * Khung xương mẫu Nam Sinh Kính Cận — toạ độ tuyệt đối khớp đúng vị trí ghép bộ phận,
 * đã hàn khít 100% khớp ngọn cha (tail) trùng tâm khớp gốc con (head) chuẩn Moho Pro.
 */
export const CUTOUT_FRONT_BONES: LayerBone[] = weldConnectedLimbBones([
  { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 65, length: 100, angle: -90 },
  { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -35, length: 140, angle: -90 },
  { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -175, length: 130, angle: -90 },
  { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -96, y: -160, length: 159, angle: 97 },
  { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -115, y: -2, length: 122, angle: 90 },
  { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: -115, y: 120, length: 30, angle: 90 },
  { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 97, y: -160, length: 159, angle: 83 },
  { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 115, y: -2, length: 122, angle: 90 },
  { id: 'bone-hand-r', name: 'Bàn tay phải', parentId: 'bone-forearm-r', x: 115, y: 120, length: 30, angle: 90 },
  { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -46, y: 75, length: 172, angle: 93 },
  { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -54, y: 247, length: 198, angle: 92 },
  { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -60, y: 445, length: 40, angle: 180 },
  { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 42, y: 75, length: 172, angle: 91 },
  { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 38, y: 247, length: 198, angle: 92 },
  { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 32, y: 445, length: 40, angle: 0 }
])

/** Khung xương riêng của mẫu Nam Sinh Học Viện (bộ ảnh character_human_quarter), đã hàn khít khớp nối. */
export const CUTOUT_QUARTER_BONES: LayerBone[] = weldConnectedLimbBones([
  { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 65, length: 100, angle: -90 },
  { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -35, length: 140, angle: -90 },
  { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -175, length: 130, angle: -90 },
  { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -88, y: -115, length: 136, angle: 96 },
  { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -102, y: 20, length: 120, angle: 90 },
  { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: -102, y: 140, length: 45, angle: 90 },
  { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 88, y: -115, length: 136, angle: 84 },
  { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 102, y: 20, length: 120, angle: 90 },
  { id: 'bone-hand-r', name: 'Bàn tay phải', parentId: 'bone-forearm-r', x: 102, y: 140, length: 45, angle: 90 },
  { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -46, y: 80, length: 175, angle: 91 },
  { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -48, y: 255, length: 175, angle: 90 },
  { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -48, y: 430, length: 50, angle: 180 },
  { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 46, y: 80, length: 175, angle: 89 },
  { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 48, y: 255, length: 175, angle: 90 },
  { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 48, y: 430, length: 50, angle: 0 }
])

function buildClipsForBones(bones: LayerBone[]): AnimationClip[] {
  return [
    { id: 'clip-idle', name: 'Đứng thở (Idle)', duration: 2.4, loop: true, presetKey: 'idle', viewAngle: 'front', tracks: generateIdleBreathe(bones, 2.4, 'front') },
    { id: 'clip-walk', name: 'Bước đi (Walk)', duration: 1.6, loop: true, presetKey: 'walk', viewAngle: 'front', tracks: generateWalkCycle(bones, 1.6, 'front') },
    { id: 'clip-wave', name: 'Vẫy tay chào (Wave)', duration: 1.8, loop: true, presetKey: 'wave', viewAngle: 'front', tracks: generateWaveHand(bones, 1.8, 'front') },
    { id: 'clip-bow', name: 'Cúi chào (Bow)', duration: 2.0, loop: false, presetKey: 'bow', viewAngle: 'front', tracks: generateBow(bones, 2.0, 'front') },
    { id: 'clip-action', name: 'Vung đòn (Action)', duration: 1.5, loop: true, presetKey: 'action', viewAngle: 'front', tracks: generateActionSlash(bones, 1.5, 'front') }
  ]
}

export const FRONT_CLIPS = buildClipsForBones(CUTOUT_FRONT_BONES)
export const QUARTER_CLIPS = buildClipsForBones(CUTOUT_QUARTER_BONES)

// ---------------------------------------------------------------------------
// 1. Nhân Vật Anime 2.5D — Mẫu Minh Hoạ Kính Cận (13 Mảnh + 2 Biểu Cảm, Tỉ Lệ Gốc 1:1)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_FRONT: LayerAssemblyTemplate = {
  id: 'tmpl-character-front',
  name: 'Nhân Vật Anime 2.5D — Mẫu Minh Hoạ Kính Cận (13 Mảnh + 2 Biểu Cảm)',
  nameEn: '2D Cutout Anime Character — Glasses Student (13 Parts & 2 Expressions)',
  category: 'character',
  ageGroup: 'youth',
  description:
    'Mẫu nhân vật anime 2.5D tách ghép 13 mảnh giữ nguyên tỉ lệ pixel gốc 1:1 từ ảnh minh hoạ: đầu trơn kèm mái tóc không ngũ quan, gọng kính rời, 2 biểu cảm mặt rời (Bình thường & Cười mỉm), thân áo sơ mi đeo dây chéo kèm cổ và thắt lưng, 2 bắp tay, 2 cẳng tay kèm đồng hồ, 2 đùi và 2 ống quần kèm giày.',
  descriptionEn:
    '13-part modular 2D anime character rig at 1:1 native pixel scale featuring a combined faceless head & hair base, isolated eyeglasses frame, 2 swappable facial expression overlays (Normal, Happy), sleeveless shirt torso with neck & belt, upper sleeves, forearms with hands, thighs, and shins with shoes.',
  width: 750,
  height: 1050,
  slots: [
    { id: 'arm-l', name: 'Bắp tay áo trái', nameEn: 'Left Upper Arm Sleeve', role: 'arm-l', atlasCell: 6, boneId: 'bone-arm-l', defaultTransform: { x: -106, y: -80, z: 35, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/arm-left.png', description: 'Bắp tay áo sơ mi bên trái từ cầu vai xuống gấu tay khuỷu (tỉ lệ gốc 1:1)' },
    { id: 'arm-r', name: 'Bắp tay áo phải', nameEn: 'Right Upper Arm Sleeve', role: 'arm-r', atlasCell: 7, boneId: 'bone-arm-r', defaultTransform: { x: 108, y: -80, z: 35, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/arm-right.png', description: 'Bắp tay áo sơ mi bên phải từ cầu vai xuống gấu tay khuỷu (tỉ lệ gốc 1:1)' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 8, boneId: 'bone-forearm-l', defaultTransform: { x: -115, y: 66, z: 40, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/forearm-left.png', description: 'Cẳng tay và bàn tay trái liền khối từ khuỷu tay xuống ngón tay (tỉ lệ gốc 1:1)' },
    { id: 'forearm-r', name: 'Cẳng tay & Bàn tay phải (Đeo đồng hồ)', nameEn: 'Right Forearm & Hand with Watch', role: 'forearm-r', atlasCell: 9, boneId: 'bone-forearm-r', defaultTransform: { x: 115, y: 64, z: 40, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/forearm-right.png', description: 'Cẳng tay và bàn tay phải có đeo đồng hồ từ khuỷu tay xuống ngón tay (tỉ lệ gốc 1:1)' },
    { id: 'thigh-l', name: 'Đùi quần trái', nameEn: 'Left Trouser Thigh', role: 'thigh-l', atlasCell: 10, boneId: 'bone-thigh-l', defaultTransform: { x: -46, y: 160, z: 20, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/thigh-left.png', description: 'Đùi quần trái từ hông xuống đầu gối bo tròn (tỉ lệ gốc 1:1)' },
    { id: 'thigh-r', name: 'Đùi quần phải', nameEn: 'Right Trouser Thigh', role: 'thigh-r', atlasCell: 12, boneId: 'bone-thigh-r', defaultTransform: { x: 42, y: 160, z: 20, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/thigh-right.png', description: 'Đùi quần phải từ hông xuống đầu gối bo tròn (tỉ lệ gốc 1:1)' },
    { id: 'shin-l', name: 'Ống quần & Giày trái', nameEn: 'Left Lower Leg & Shoe', role: 'shin-l', atlasCell: 11, boneId: 'bone-shin-l', defaultTransform: { x: -58, y: 352, z: 25, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/shin-left.png', description: 'Ống quần dưới và giày trái liền khối từ đầu gối tới đế giày (tỉ lệ gốc 1:1)' },
    { id: 'shin-r', name: 'Ống quần & Giày phải', nameEn: 'Right Lower Leg & Shoe', role: 'shin-r', atlasCell: 13, boneId: 'bone-shin-r', defaultTransform: { x: 34, y: 352, z: 25, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/shin-right.png', description: 'Ống quần dưới và giày phải liền khối từ đầu gối tới đế giày (tỉ lệ gốc 1:1)' },
    { id: 'torso', name: 'Thân áo sơ mi, Cổ & Thắt lưng', nameEn: 'Sleeveless Shirt Torso with Neck & Belt', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -50, z: 0, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/torso.png', description: 'Thân áo sơ mi trắng kèm cổ, dây đeo chéo và thắt lưng da (tỉ lệ gốc 1:1)' },
    { id: 'head', name: 'Đầu & Mái tóc trơn (Không ngũ quan)', nameEn: 'Faceless Anime Head & Hair Base', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -295, z: -20, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/head.png', description: 'Đầu kèm mái tóc đen hoàn chỉnh nhưng khuôn mặt để trơn trắng 100% (tỉ lệ gốc 1:1)' },
    { id: 'face-normal', name: 'Biểu cảm 1: Bình thường / Tự tin', nameEn: 'Face Expression: Calm / Normal', role: 'face', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: -8, y: -214, z: -30, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/face-normal.png', description: 'Ngũ quan biểu cảm bình thường ghép trên đầu trơn (tỉ lệ gốc 1:1)' },
    { id: 'face-happy', name: 'Biểu cảm 2: Vui vẻ / Cười mỉm (Ẩn sẵn)', nameEn: 'Face Expression: Happy / Smirk', role: 'face-alt', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: -8, y: -207, z: -32, scale: 1, rotation: 0, hidden: true }, suggestedAsset: 'character_cutout_demo/face-happy.png', description: 'Bật con mắt layer này (và ẩn biểu cảm 1) để đổi sang biểu cảm cười mỉm (tỉ lệ gốc 1:1)' },
    { id: 'glasses', name: 'Gọng mắt kính rời (Bật/Tắt)', nameEn: 'Isolated Eyeglasses Frame', role: 'glasses', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: -8, y: -224, z: -42, scale: 1, rotation: 0 }, suggestedAsset: 'character_cutout_demo/glasses.png', description: 'Gọng kính cận đen tách rời đeo trước khuôn mặt (tỉ lệ gốc 1:1)' }
  ],
  bones: CUTOUT_FRONT_BONES,
  clips: FRONT_CLIPS,
  activeClipId: 'clip-idle',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D anime young male student character in strict FRONT ORTHOGRAPHIC VIEW (0°), featuring messy layered black hair with hairpin, rectangular black eyeglasses, white collared dress shirt with diagonal black shoulder strap and brown leather waist belt, dark charcoal trousers and black-and-white shoes, separated into 13 modular cutout parts with a FACELESS head+hair base and 2 floating facial expression overlays.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHARACTER_FRONT, images, name)
}

// ---------------------------------------------------------------------------
// 2. Nhân Vật Anime 2.5D — Nam Sinh Học Viện (Tạo Từ Prompt AI 13 Mảnh, Tỉ Lệ Gốc 1:1)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_QUARTER: LayerAssemblyTemplate = {
  id: 'tmpl-character-quarter',
  name: 'Nhân Vật Anime 2.5D — Nam Sinh Học Viện (Tạo Từ Prompt AI 13 Mảnh)',
  nameEn: '2D Cutout Anime Academy Student — AI Prompt Generated (13 Parts & 2 Expressions)',
  category: 'character',
  ageGroup: 'youth',
  description:
    'Nhân vật nam sinh học viện 2.5D được tạo mới hoàn toàn từ bộ Prompt AI 13 mảnh giữ nguyên tỉ lệ pixel gốc 1:1: đầu trơn kèm tóc xanh đen highlight bạc, gọng kính cận rời, 2 biểu cảm mặt rời, áo gile học viện xanh navy kèm cà vạt và thắt lưng, 2 bắp tay áo trắng, 2 cẳng tay, 2 đùi và 2 ống quần kèm giày sneaker.',
  descriptionEn:
    '13-part modular 2D anime academy student character at 1:1 native pixel scale generated from the updated 13-part cutout prompt: combined faceless head with silver-streaked dark-blue hair, isolated glasses, 2 swappable facial expressions, navy sweater vest torso with tie and belt, white sleeves, forearms with hands, thighs, and shins with sneakers.',
  width: 750,
  height: 1050,
  slots: [
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 8, boneId: 'bone-forearm-l', defaultTransform: { x: -105, y: 80, z: 35, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-left.png', description: 'Cẳng tay và bàn tay trái liền khối từ khuỷu tay đến ngón tay (tỉ lệ gốc 1:1)' },
    { id: 'forearm-r', name: 'Cẳng tay & Bàn tay phải', nameEn: 'Right Forearm & Hand', role: 'forearm-r', atlasCell: 9, boneId: 'bone-forearm-r', defaultTransform: { x: 105, y: 80, z: 35, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-right.png', description: 'Cẳng tay và bàn tay phải liền khối từ khuỷu tay đến ngón tay (tỉ lệ gốc 1:1)' },
    { id: 'thigh-l', name: 'Đùi quần trái', nameEn: 'Left Trouser Thigh', role: 'thigh-l', atlasCell: 10, boneId: 'bone-thigh-l', defaultTransform: { x: -50, y: 165, z: 20, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-left.png', description: 'Đùi quần tây trái từ hông đến đầu gối (tỉ lệ gốc 1:1)' },
    { id: 'thigh-r', name: 'Đùi quần phải', nameEn: 'Right Trouser Thigh', role: 'thigh-r', atlasCell: 12, boneId: 'bone-thigh-r', defaultTransform: { x: 50, y: 165, z: 20, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-right.png', description: 'Đùi quần tây phải từ hông đến đầu gối (tỉ lệ gốc 1:1)' },
    { id: 'arm-l', name: 'Bắp tay áo sơ mi trái', nameEn: 'Left Upper Arm Sleeve', role: 'arm-l', atlasCell: 6, boneId: 'bone-arm-l', defaultTransform: { x: -98, y: -8, z: 15, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-left.png', description: 'Bắp tay áo sơ mi trắng bên trái từ vai đến khuỷu tay (tỉ lệ gốc 1:1)' },
    { id: 'arm-r', name: 'Bắp tay áo sơ mi phải', nameEn: 'Right Upper Arm Sleeve', role: 'arm-r', atlasCell: 7, boneId: 'bone-arm-r', defaultTransform: { x: 98, y: -8, z: 15, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-right.png', description: 'Bắp tay áo sơ mi trắng bên phải từ vai đến khuỷu tay (tỉ lệ gốc 1:1)' },
    { id: 'shin-l', name: 'Ống quần & Giày sneaker trái', nameEn: 'Left Lower Leg & Sneaker', role: 'shin-l', atlasCell: 11, boneId: 'bone-shin-l', defaultTransform: { x: -52, y: 375, z: 10, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-left.png', description: 'Ống quần dưới và giày sneaker trái liền khối (tỉ lệ gốc 1:1)' },
    { id: 'shin-r', name: 'Ống quần & Giày sneaker phải', nameEn: 'Right Lower Leg & Sneaker', role: 'shin-r', atlasCell: 13, boneId: 'bone-shin-r', defaultTransform: { x: 52, y: 375, z: 10, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-right.png', description: 'Ống quần dưới và giày sneaker phải liền khối (tỉ lệ gốc 1:1)' },
    { id: 'torso', name: 'Thân áo gile học viện, Cổ & Thắt lưng', nameEn: 'Sleeveless Academy Vest Torso with Neck & Belt', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -45, z: 0, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/torso.png', description: 'Thân áo gile xanh navy kèm cổ sơ mi, cà vạt và thắt lưng da (tỉ lệ gốc 1:1)' },
    { id: 'head', name: 'Đầu & Mái tóc xanh đen highlight bạc (Không ngũ quan)', nameEn: 'Faceless Anime Head & Hair Base', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -305, z: -20, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/head.png', description: 'Đầu kèm mái tóc xanh đen highlight bạc hoàn chỉnh nhưng mặt để trơn không ngũ quan (tỉ lệ gốc 1:1)' },
    { id: 'face-normal', name: 'Biểu cảm 1: Điềm tĩnh / Nghiêm túc', nameEn: 'Face Expression: Calm / Normal', role: 'face', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 0, y: -230, z: -30, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/face-normal.png', description: 'Ngũ quan biểu cảm điềm tĩnh ghép trên khuôn mặt trơn (tỉ lệ gốc 1:1)' },
    { id: 'face-happy', name: 'Biểu cảm 2: Vui vẻ / Cười tươi (Ẩn sẵn)', nameEn: 'Face Expression: Happy / Cheerful', role: 'face-alt', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: 0, y: -230, z: -32, scale: 1, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/face-happy.png', description: 'Bật con mắt layer này để đổi sang biểu cảm cười tươi vui vẻ (tỉ lệ gốc 1:1)' },
    { id: 'glasses', name: 'Gọng mắt kính chữ nhật (Bật/Tắt)', nameEn: 'Isolated Eyeglasses Frame', role: 'glasses', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: 0, y: -248, z: -42, scale: 1, rotation: 0 }, suggestedAsset: 'character_human_quarter/glasses.png', description: 'Gọng mắt kính chữ nhật tách rời đeo trước mặt (tỉ lệ gốc 1:1)' }
  ],
  bones: CUTOUT_QUARTER_BONES,
  clips: QUARTER_CLIPS,
  activeClipId: 'clip-idle',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D anime young male academy student in strict FRONT ORTHOGRAPHIC VIEW (0°), featuring dark-blue layered hair with silver highlights, rectangular black eyeglasses, dark-navy sweater vest over a white collared shirt with blue tie and brown leather belt, dark charcoal slacks and black-and-white sneakers, separated into 13 modular cutout parts with a FACELESS head+hair base and 2 floating facial expression overlays.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHARACTER_QUARTER, images, name)
}

/** Alias tương thích ngược cho các module gọi TMPL_MALE_HERO */
export const TMPL_MALE_HERO = TMPL_CHARACTER_FRONT

export const HUMANOID_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_CHARACTER_FRONT,
  TMPL_CHARACTER_QUARTER
]
