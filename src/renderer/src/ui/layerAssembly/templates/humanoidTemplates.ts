import { createTemplateComposite } from './templateBuilder'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import {
  createHumanoidBones,
  generateWalkCycle,
  generateIdleBreathe,
  generateActionSlash,
  generateWaveHand,
  generateBow
} from '../workshopRigPresets'

const HUMAN_BONES = createHumanoidBones()

const CUTOUT_FRONT_BONES: LayerBone[] = [
  { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 30, length: 50, angle: -90 },
  { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -20, length: 65, angle: -90 },
  { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -90, length: 65, angle: -90 },
  { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -48, y: -58, length: 72, angle: 90 },
  { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -53, y: 14, length: 60, angle: 90 },
  { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: -55, y: 74, length: 24, angle: 90 },
  { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 50, y: -58, length: 72, angle: 90 },
  { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 55, y: 14, length: 60, angle: 90 },
  { id: 'bone-hand-r', name: 'Bàn tay phải', parentId: 'bone-forearm-r', x: 57, y: 74, length: 24, angle: 90 },
  { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -23, y: 42, length: 92, angle: 90 },
  { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -23, y: 134, length: 90, angle: 90 },
  { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -28, y: 224, length: 28, angle: 180 },
  { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 25, y: 42, length: 92, angle: 90 },
  { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 25, y: 134, length: 90, angle: 90 },
  { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 20, y: 224, length: 28, angle: 180 }
]

function buildClipsForBones(bones: LayerBone[]): AnimationClip[] {
  return [
    { id: 'clip-idle', name: 'Đứng thở (Idle)', duration: 2.4, loop: true, presetKey: 'idle', tracks: generateIdleBreathe(bones, 2.4) },
    { id: 'clip-walk', name: 'Bước đi (Walk)', duration: 1.6, loop: true, presetKey: 'walk', tracks: generateWalkCycle(bones, 1.6) },
    { id: 'clip-wave', name: 'Vẫy tay chào (Wave)', duration: 1.8, loop: true, presetKey: 'wave', tracks: generateWaveHand(bones, 1.8) },
    { id: 'clip-bow', name: 'Cúi chào (Bow)', duration: 2.0, loop: false, presetKey: 'bow', tracks: generateBow(bones, 2.0) },
    { id: 'clip-action', name: 'Vung kiếm (Slash)', duration: 1.5, loop: true, presetKey: 'action', tracks: generateActionSlash(bones, 1.5) }
  ]
}

const FRONT_CLIPS = buildClipsForBones(CUTOUT_FRONT_BONES)
const HUMAN_CLIPS = buildClipsForBones(HUMAN_BONES)

// ---------------------------------------------------------------------------
// 1. Nhân Vật Anime 2.5D — Mẫu Minh Hoạ Kính Cận (13 Mảnh + 2 Biểu Cảm)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_FRONT: LayerAssemblyTemplate = {
  id: 'tmpl-character-front',
  name: 'Nhân Vật Anime 2.5D — Mẫu Minh Hoạ Kính Cận (13 Mảnh + 2 Biểu Cảm)',
  nameEn: '2D Cutout Anime Character — Glasses Student (13 Parts & 2 Expressions)',
  category: 'character',
  ageGroup: 'youth',
  description:
    'Mẫu nhân vật anime 2.5D tách ghép 13 mảnh chuẩn ảnh minh hoạ: đầu trơn kèm mái tóc không ngũ quan, gọng kính rời, 2 biểu cảm mặt rời (Bình thường & Cười mỉm), thân áo sơ mi đeo dây chéo kèm cổ và thắt lưng, 2 bắp tay, 2 cẳng tay kèm đồng hồ, 2 đùi và 2 ống quần kèm giày.',
  descriptionEn:
    '13-part modular 2D anime character rig featuring a combined faceless head & hair base, isolated eyeglasses frame, 2 swappable facial expression overlays (Normal, Happy), sleeveless shirt torso with neck & belt, upper sleeves, forearms with hands, thighs, and shins with shoes.',
  width: 500,
  height: 600,
  slots: [
    { id: 'shin-l', name: 'Ống quần & Giày trái', nameEn: 'Left Lower Leg & Shoe', role: 'shin-l', atlasCell: 11, boneId: 'bone-shin-l', defaultTransform: { x: -28, y: 184, z: 25, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/shin-left.png', description: 'Ống quần dưới và giày trái liền khối từ đầu gối tới đế giày' },
    { id: 'shin-r', name: 'Ống quần & Giày phải', nameEn: 'Right Lower Leg & Shoe', role: 'shin-r', atlasCell: 13, boneId: 'bone-shin-r', defaultTransform: { x: 20, y: 184, z: 25, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/shin-right.png', description: 'Ống quần dưới và giày phải liền khối từ đầu gối tới đế giày' },
    { id: 'thigh-l', name: 'Đùi quần trái', nameEn: 'Left Trouser Thigh', role: 'thigh-l', atlasCell: 10, boneId: 'bone-thigh-l', defaultTransform: { x: -23, y: 92, z: 20, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/thigh-left.png', description: 'Đùi quần trái từ hông xuống đầu gối bo tròn' },
    { id: 'thigh-r', name: 'Đùi quần phải', nameEn: 'Right Trouser Thigh', role: 'thigh-r', atlasCell: 12, boneId: 'bone-thigh-r', defaultTransform: { x: 25, y: 92, z: 20, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/thigh-right.png', description: 'Đùi quần phải từ hông xuống đầu gối bo tròn' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 8, boneId: 'bone-forearm-l', defaultTransform: { x: -55, y: 52, z: 15, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/forearm-left.png', description: 'Cẳng tay và bàn tay trái liền khối từ khuỷu tay xuống ngón tay' },
    { id: 'forearm-r', name: 'Cẳng tay & Bàn tay phải (Đeo đồng hồ)', nameEn: 'Right Forearm & Hand with Watch', role: 'forearm-r', atlasCell: 9, boneId: 'bone-forearm-r', defaultTransform: { x: 57, y: 52, z: 15, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/forearm-right.png', description: 'Cẳng tay và bàn tay phải có đeo đồng hồ từ khuỷu tay xuống ngón tay' },
    { id: 'arm-l', name: 'Bắp tay áo trái', nameEn: 'Left Upper Arm Sleeve', role: 'arm-l', atlasCell: 6, boneId: 'bone-arm-l', defaultTransform: { x: -50, y: -18, z: 10, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/arm-left.png', description: 'Bắp tay áo sơ mi bên trái từ cầu vai xuống gấu tay khuỷu' },
    { id: 'arm-r', name: 'Bắp tay áo phải', nameEn: 'Right Upper Arm Sleeve', role: 'arm-r', atlasCell: 7, boneId: 'bone-arm-r', defaultTransform: { x: 52, y: -18, z: 10, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/arm-right.png', description: 'Bắp tay áo sơ mi bên phải từ cầu vai xuống gấu tay khuỷu' },
    { id: 'torso', name: 'Thân áo sơ mi, Cổ & Thắt lưng', nameEn: 'Sleeveless Shirt Torso with Neck & Belt', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -12, z: 0, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/torso.png', description: 'Thân áo sơ mi trắng kèm cổ, dây đeo chéo và thắt lưng da (không dính tay)' },
    { id: 'head', name: 'Đầu & Mái tóc trơn (Không ngũ quan)', nameEn: 'Faceless Anime Head & Hair Base', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -3, y: -162, z: -20, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/head.png', description: 'Đầu kèm mái tóc đen hoàn chỉnh nhưng khuôn mặt để trơn trắng 100% để ghép biểu cảm rời' },
    { id: 'face-normal', name: 'Biểu cảm 1: Bình thường / Tự tin', nameEn: 'Face Expression: Calm / Normal', role: 'face', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: -7, y: -125, z: -25, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/face-normal.png', description: 'Ngũ quan biểu cảm bình thường (lông mày, mắt, mũi, miệng cười nhẹ) ghép trên đầu trơn' },
    { id: 'face-happy', name: 'Biểu cảm 2: Vui vẻ / Cười mỉm (Ẩn sẵn)', nameEn: 'Face Expression: Happy / Smirk', role: 'face-alt', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: -7, y: -123, z: -26, scale: 0.52, rotation: 0, hidden: true }, suggestedAsset: 'character_human_front/face-happy.png', description: 'Bật con mắt layer này (và ẩn biểu cảm 1) để đổi sang biểu cảm cười mỉm' },
    { id: 'glasses', name: 'Gọng mắt kính rời (Bật/Tắt)', nameEn: 'Isolated Eyeglasses Frame', role: 'glasses', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: -7, y: -121, z: -30, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_human_front/glasses.png', description: 'Gọng kính cận đen tách rời đeo trước khuôn mặt' }
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
// 2. Nhân Vật Anime 2.5D — Nam Sinh Học Viện (Tạo Từ Prompt AI 13 Mảnh)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_QUARTER: LayerAssemblyTemplate = {
  id: 'tmpl-character-quarter',
  name: 'Nhân Vật Anime 2.5D — Nam Sinh Học Viện (Tạo Từ Prompt AI 13 Mảnh)',
  nameEn: '2D Cutout Anime Academy Student — AI Prompt Generated (13 Parts & 2 Expressions)',
  category: 'character',
  ageGroup: 'youth',
  description:
    'Nhân vật nam sinh học viện 2.5D được tạo mới hoàn toàn từ bộ Prompt AI 13 mảnh chuẩn: đầu trơn kèm tóc xanh đen highlight bạc, gọng kính cận rời, 2 biểu cảm mặt rời, áo gile học viện xanh navy kèm cà vạt và thắt lưng, 2 bắp tay áo trắng, 2 cẳng tay, 2 đùi và 2 ống quần kèm giày sneaker.',
  descriptionEn:
    '13-part modular 2D anime academy student character generated from the updated 13-part cutout prompt: combined faceless head with silver-streaked dark-blue hair, isolated glasses, 2 swappable facial expressions, navy sweater vest torso with tie and belt, white sleeves, forearms with hands, thighs, and shins with sneakers.',
  width: 500,
  height: 600,
  slots: [
    { id: 'shin-l', name: 'Ống quần & Giày sneaker trái', nameEn: 'Left Lower Leg & Sneaker', role: 'shin-l', atlasCell: 11, boneId: 'bone-shin-l', defaultTransform: { x: -26, y: 184, z: 25, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-left.png', description: 'Ống quần dưới và giày sneaker trái liền khối' },
    { id: 'shin-r', name: 'Ống quần & Giày sneaker phải', nameEn: 'Right Lower Leg & Sneaker', role: 'shin-r', atlasCell: 13, boneId: 'bone-shin-r', defaultTransform: { x: 26, y: 184, z: 25, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-right.png', description: 'Ống quần dưới và giày sneaker phải liền khối' },
    { id: 'thigh-l', name: 'Đùi quần trái', nameEn: 'Left Trouser Thigh', role: 'thigh-l', atlasCell: 10, boneId: 'bone-thigh-l', defaultTransform: { x: -21, y: 86, z: 20, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-left.png', description: 'Đùi quần tây trái từ hông đến đầu gối' },
    { id: 'thigh-r', name: 'Đùi quần phải', nameEn: 'Right Trouser Thigh', role: 'thigh-r', atlasCell: 12, boneId: 'bone-thigh-r', defaultTransform: { x: 21, y: 86, z: 20, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-right.png', description: 'Đùi quần tây phải từ hông đến đầu gối' },
    { id: 'torso', name: 'Thân áo gile học viện, Cổ & Thắt lưng', nameEn: 'Sleeveless Academy Vest Torso with Neck & Belt', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -14, z: 0, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/torso.png', description: 'Thân áo gile xanh navy kèm cổ sơ mi, cà vạt và thắt lưng da' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 8, boneId: 'bone-forearm-l', defaultTransform: { x: -50, y: 52, z: -10, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-left.png', description: 'Cẳng tay và bàn tay trái liền khối từ khuỷu tay đến ngón tay' },
    { id: 'forearm-r', name: 'Cẳng tay & Bàn tay phải', nameEn: 'Right Forearm & Hand', role: 'forearm-r', atlasCell: 9, boneId: 'bone-forearm-r', defaultTransform: { x: 50, y: 52, z: -10, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-right.png', description: 'Cẳng tay và bàn tay phải liền khối từ khuỷu tay đến ngón tay' },
    { id: 'arm-l', name: 'Bắp tay áo sơ mi trái', nameEn: 'Left Upper Arm Sleeve', role: 'arm-l', atlasCell: 6, boneId: 'bone-arm-l', defaultTransform: { x: -48, y: -14, z: -15, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-left.png', description: 'Bắp tay áo sơ mi trắng bên trái từ vai đến khuỷu tay' },
    { id: 'arm-r', name: 'Bắp tay áo sơ mi phải', nameEn: 'Right Upper Arm Sleeve', role: 'arm-r', atlasCell: 7, boneId: 'bone-arm-r', defaultTransform: { x: 48, y: -14, z: -15, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-right.png', description: 'Bắp tay áo sơ mi trắng bên phải từ vai đến khuỷu tay' },
    { id: 'head', name: 'Đầu & Mái tóc xanh đen highlight bạc (Không ngũ quan)', nameEn: 'Faceless Anime Head & Hair Base', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -158, z: -20, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/head.png', description: 'Đầu kèm mái tóc xanh đen highlight bạc hoàn chỉnh nhưng mặt để trơn không ngũ quan' },
    { id: 'face-normal', name: 'Biểu cảm 1: Điềm tĩnh / Nghiêm túc', nameEn: 'Face Expression: Calm / Normal', role: 'face', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 0, y: -125, z: -25, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/face-normal.png', description: 'Ngũ quan biểu cảm điềm tĩnh ghép trên khuôn mặt trơn' },
    { id: 'face-happy', name: 'Biểu cảm 2: Vui vẻ / Cười tươi (Ẩn sẵn)', nameEn: 'Face Expression: Happy / Cheerful', role: 'face-alt', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: 0, y: -125, z: -26, scale: 0.48, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/face-happy.png', description: 'Bật con mắt layer này để đổi sang biểu cảm cười tươi vui vẻ' },
    { id: 'glasses', name: 'Gọng mắt kính chữ nhật (Bật/Tắt)', nameEn: 'Isolated Eyeglasses Frame', role: 'glasses', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: 0, y: -138, z: -30, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_human_quarter/glasses.png', description: 'Gọng mắt kính chữ nhật tách rời đeo trước mặt' }
  ],
  bones: CUTOUT_FRONT_BONES,
  clips: FRONT_CLIPS,
  activeClipId: 'clip-idle',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D anime young male academy student in strict FRONT ORTHOGRAPHIC VIEW (0°), featuring dark-blue layered hair with silver highlights, rectangular black eyeglasses, dark-navy sweater vest over a white collared shirt with blue tie and brown leather belt, dark charcoal slacks and black-and-white sneakers, separated into 13 modular cutout parts with a FACELESS head+hair base and 2 floating facial expression overlays.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHARACTER_QUARTER, images, name)
}

// ---------------------------------------------------------------------------
// 3. Nhân Vật Chuẩn Đầu Người — Hướng Sau Lưng (180° Back View)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_BACK: LayerAssemblyTemplate = {
  id: 'tmpl-character-back',
  name: 'Nhân Vật Chuẩn Đầu Người — Hướng Sau Lưng (180° Back View)',
  nameEn: 'Standard Human Character — Back View (180° Rear Orthographic)',
  category: 'character',
  ageGroup: 'adult',
  description:
    'Mẫu nhân vật chuẩn đầu người nhìn từ phía sau lưng (180°): hiển thị trọn vẹn mái tóc sau gáy, cổ và vành tai sau, lưng áo, đai lưng sau, mu bàn tay và gót giày ủng để diễn hoạt cảnh nhân vật quay lưng bước đi hoặc đối mặt kẻ địch.',
  descriptionEn:
    'Rear orthographic (180° back view) human character rig showing the full back hair crown, back of head and ears, back tunic, waist belt, dorsal hands, and boot heels.',
  width: 500,
  height: 600,
  slots: [
    { id: 'thigh-l', name: 'Đùi trái (Nhìn từ sau)', nameEn: 'Left Thigh (Back View)', role: 'thigh-l', atlasCell: 10, boneId: 'bone-thigh-l', defaultTransform: { x: -19, y: 64, z: 20, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/thigh-left.png', description: 'Đùi trái nhìn từ phía sau lưng' },
    { id: 'thigh-r', name: 'Đùi phải (Nhìn từ sau)', nameEn: 'Right Thigh (Back View)', role: 'thigh-r', atlasCell: 11, boneId: 'bone-thigh-r', defaultTransform: { x: 19, y: 64, z: 15, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/thigh-right.png', description: 'Đùi phải nhìn từ phía sau lưng' },
    { id: 'shin-l', name: 'Bắp chân trái (Nhìn từ sau)', nameEn: 'Left Shin (Back View)', role: 'shin-l', atlasCell: 12, boneId: 'bone-shin-l', defaultTransform: { x: -19, y: 123, z: 10, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/shin-left.png', description: 'Bắp chân trái nhìn từ phía sau' },
    { id: 'shin-r', name: 'Bắp chân phải (Nhìn từ sau)', nameEn: 'Right Shin (Back View)', role: 'shin-r', atlasCell: 13, boneId: 'bone-shin-r', defaultTransform: { x: 19, y: 123, z: 5, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/shin-right.png', description: 'Bắp chân phải nhìn từ phía sau' },
    { id: 'foot-l', name: 'Gót giày ủng trái (Nhìn từ sau)', nameEn: 'Left Boot Heel (Back View)', role: 'foot-l', atlasCell: 14, boneId: 'bone-foot-l', defaultTransform: { x: -19, y: 167, z: 0, scale: 0.279, rotation: 0 }, suggestedAsset: 'character_human_back/foot-left.png', description: 'Giày ủng trái nhìn từ gót chân sau' },
    { id: 'foot-r', name: 'Gót giày ủng phải (Nhìn từ sau)', nameEn: 'Right Boot Heel (Back View)', role: 'foot-r', atlasCell: 15, boneId: 'bone-foot-r', defaultTransform: { x: 19, y: 167, z: -5, scale: 0.279, rotation: 0 }, suggestedAsset: 'character_human_back/foot-right.png', description: 'Giày ủng phải nhìn từ gót chân sau' },
    { id: 'head', name: 'Sau đầu, Vành tai & Gáy', nameEn: 'Back of Head, Ears & Nape', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -106, z: -10, scale: 0.293, rotation: 0 }, suggestedAsset: 'character_human_back/head.png', description: 'Phần gáy, cổ và hai vành tai nhìn từ sau lưng' },
    { id: 'torso', name: 'Lưng áo trên (Nhìn từ sau)', nameEn: 'Back of Jacket / Tunic Torso', role: 'torso', atlasCell: 3, boneId: 'bone-torso', defaultTransform: { x: 0, y: -37, z: -15, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/torso.png', description: 'Phần lưng áo và cổ áo sau' },
    { id: 'pelvis', name: 'Đai lưng sau & Vạt áo dưới', nameEn: 'Back Waist Belt & Lower Tunic', role: 'pelvis', atlasCell: 4, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 19, z: -20, scale: 0.306, rotation: 0 }, suggestedAsset: 'character_human_back/pelvis.png', description: 'Thắt lưng da và vạt áo sau che khớp hông' },
    { id: 'arm-l', name: 'Bắp tay trái (Nhìn từ sau)', nameEn: 'Left Upper Arm (Back View)', role: 'arm-l', atlasCell: 5, boneId: 'bone-arm-l', defaultTransform: { x: -39, y: -34, z: -25, scale: 0.288, rotation: 0 }, suggestedAsset: 'character_human_back/arm-left.png', description: 'Bắp tay trái nhìn từ sau lưng' },
    { id: 'arm-r', name: 'Bắp tay phải (Nhìn từ sau)', nameEn: 'Right Upper Arm (Back View)', role: 'arm-r', atlasCell: 6, boneId: 'bone-arm-r', defaultTransform: { x: 39, y: -34, z: -25, scale: 0.288, rotation: 0 }, suggestedAsset: 'character_human_back/arm-right.png', description: 'Bắp tay phải nhìn từ sau lưng' },
    { id: 'hand-l', name: 'Mu bàn tay trái (Nhìn từ sau)', nameEn: 'Left Dorsal Hand (Back View)', role: 'hand-l', atlasCell: 9, boneId: 'bone-hand-l', defaultTransform: { x: -41, y: 31, z: -30, scale: 0.198, rotation: 0 }, suggestedAsset: 'character_human_back/hand-left.png', description: 'Mu bàn tay trái nhìn từ phía sau' },
    { id: 'hand-r', name: 'Mu bàn tay phải (Nhìn từ sau)', nameEn: 'Right Dorsal Hand (Back View)', role: 'hand-r', atlasCell: 16, boneId: 'bone-hand-r', defaultTransform: { x: 41, y: 31, z: -30, scale: 0.198, rotation: 0 }, suggestedAsset: 'character_human_back/hand-right.png', description: 'Mu bàn tay phải nhìn từ phía sau' },
    { id: 'forearm-l', name: 'Cẳng tay trái (Nhìn từ sau)', nameEn: 'Left Forearm (Back View)', role: 'forearm-l', atlasCell: 7, boneId: 'bone-forearm-l', defaultTransform: { x: -40, y: 2, z: -35, scale: 0.252, rotation: 0 }, suggestedAsset: 'character_human_back/forearm-left.png', description: 'Cẳng tay và hộ uyển trái nhìn từ sau' },
    { id: 'forearm-r', name: 'Cẳng tay phải (Nhìn từ sau)', nameEn: 'Right Forearm (Back View)', role: 'forearm-r', atlasCell: 8, boneId: 'bone-forearm-r', defaultTransform: { x: 40, y: 2, z: -35, scale: 0.252, rotation: 0 }, suggestedAsset: 'character_human_back/forearm-right.png', description: 'Cẳng tay và hộ uyển phải nhìn từ sau' },
    { id: 'hair-back', name: 'Mái tóc sau đầu trọn vẹn', nameEn: 'Full Back Hair Crown (Back View)', role: 'hair-back', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: 0, y: -118, z: -40, scale: 0.324, rotation: 0 }, suggestedAsset: 'character_human_back/hair-back.png', description: 'Toàn bộ mái tóc nhìn từ phía sau đầu' },
    { id: 'cape', name: 'Áo choàng phủ lưng (Ẩn sẵn)', nameEn: 'Full Back Cape Overlay (Back View)', role: 'cape', atlasCell: 17, boneId: 'bone-torso', defaultTransform: { x: 0, y: 24, z: -45, scale: 0.675, rotation: 0, hidden: true }, suggestedAsset: 'character_human_back/cape.png', description: 'Áo choàng phủ sau lưng — ẩn sẵn để lộ chi tiết lưng áo và đai lưng' }
  ],
  bones: HUMAN_BONES,
  clips: HUMAN_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D animated young adult human martial/adventure hero in strict BACK ORTHOGRAPHIC VIEW (180° seen directly from behind), showing the back hair crown, back of head and ears, royal-blue back tunic, brown leather waist belt, arms, dorsal hands, trousers and boot heels.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHARACTER_BACK, images, name)
}

/** Alias tương thích ngược cho các module gọi TMPL_MALE_HERO */
export const TMPL_MALE_HERO = TMPL_CHARACTER_FRONT

export const HUMANOID_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_CHARACTER_FRONT,
  TMPL_CHARACTER_QUARTER,
  TMPL_CHARACTER_BACK
]
