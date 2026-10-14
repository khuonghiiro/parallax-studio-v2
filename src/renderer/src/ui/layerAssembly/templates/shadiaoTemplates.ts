import type { AnimationClip } from '@shared/layerRig'
import type { LayerComposite } from '../types'
import {
  createHumanoidBones,
  generateBow,
  generateIdleBreathe,
  generateWalkCycle,
  generateWaveHand
} from '../workshopRigPresets'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import { createTemplateComposite } from './templateBuilder'

// ---------------------------------------------------------------------------
// 1. Cát Gấu Tu Tiên / Cổ Trang (Hoạt Hình Điêu Khắc Cát - 沙雕动画 / 熊猫人修仙)
// ---------------------------------------------------------------------------

const PANDA_BONES = createHumanoidBones()
const PANDA_WALK = generateWalkCycle(PANDA_BONES, 1.4)
const PANDA_IDLE = generateIdleBreathe(PANDA_BONES, 2.0)
const PANDA_WAVE = generateWaveHand(PANDA_BONES, 1.5)
const PANDA_BOW = generateBow(PANDA_BONES, 1.8)

const PANDA_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Đi bộ lạch bạch tấu hài (Walk)', duration: 1.4, loop: true, presetKey: 'walk', tracks: PANDA_WALK },
  { id: 'clip-idle', name: 'Đứng thở ngạo nghễ (Idle)', duration: 2.0, loop: true, presetKey: 'idle', tracks: PANDA_IDLE },
  { id: 'clip-wave', name: 'Vung tay chỉ trỏ vả mặt (Wave)', duration: 1.5, loop: true, presetKey: 'wave', tracks: PANDA_WAVE },
  { id: 'clip-bow', name: 'Cúi chào đạo hữu (Bow)', duration: 1.8, loop: false, presetKey: 'bow', tracks: PANDA_BOW }
]

export const TMPL_SHADIAO_PANDA_XIANXIA: LayerAssemblyTemplate = {
  id: 'tmpl-character-shadiao-panda',
  name: 'Cát Gấu Tu Tiên / Cổ Trang (Hoạt Hình Điêu Khắc Cát)',
  nameEn: 'Shadiao Panda Cultivator (Chinese Sand Sculpture Meme)',
  category: 'character',
  ageGroup: 'adult',
  description:
    'Nhân vật Hoạt hình Điêu Khắc Cát / Cát Gấu (沙雕动画 - 熊猫人修仙) chuẩn 20 lớp: Đầu Gấu Trúc Meme cười bựa, biểu cảm Khóc Thét/Nổi Gân thay thế, kính đen Thug Life 8-bit, mão ngọc đạo sĩ, râu đạo sĩ, trường bào cổ trang và kiếm gỗ buộc gạch ống "vả mặt".',
  descriptionEn:
    'Chinese Sand Sculpture Animation (Shadiao Donghua) Panda-Head Xianxia Cultivator with 20 modular 2D Flash vector cutout parts, Baozou meme expressions, 8-bit sunglasses, jade crown, and brick-strapped wooden sword prop.',
  width: 500,
  height: 600,
  slots: [
    { id: 'cape', name: 'Áo choàng Tiên Hiệp sau lưng', nameEn: 'Xianxia Immortal Back Cloak', role: 'cape', atlasCell: 25, boneId: 'bone-torso', defaultTransform: { x: 0, y: 10, z: 50, scale: 0.92, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/cape.png', description: 'Áo choàng trường bào viền mây vàng bay phía sau lưng' },
    { id: 'thigh-l', name: 'Đùi quần cổ trang trái', nameEn: 'Left Cultivator Trouser Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -24, y: 78, z: 24, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/thigh-left.png', description: 'Ống quần cổ trang đùi trái' },
    { id: 'thigh-r', name: 'Đùi quần cổ trang phải', nameEn: 'Right Cultivator Trouser Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 24, y: 78, z: 24, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/thigh-right.png', description: 'Ống quần cổ trang đùi phải' },
    { id: 'shin-l', name: 'Xà cạp quấn chân trái', nameEn: 'Left Cloth-Wrapped Shin', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -24, y: 134, z: 18, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/shin-left.png', description: 'Cẳng chân quấn xà cạp trắng đan dây bên trái' },
    { id: 'shin-r', name: 'Xà cạp quấn chân phải', nameEn: 'Right Cloth-Wrapped Shin', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 24, y: 134, z: 18, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/shin-right.png', description: 'Cẳng chân quấn xà cạp trắng đan dây bên phải' },
    { id: 'foot-l', name: 'Giày vải mây cổ trang trái', nameEn: 'Left Ancient Cloud Boot', role: 'foot-l', atlasCell: 21, boneId: 'bone-foot-l', defaultTransform: { x: -27, y: 172, z: 12, scale: 0.22, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/foot-left.png', description: 'Hài cổ trang mũi cong bên trái' },
    { id: 'foot-r', name: 'Giày vải mây cổ trang phải', nameEn: 'Right Ancient Cloud Boot', role: 'foot-r', atlasCell: 22, boneId: 'bone-foot-r', defaultTransform: { x: 27, y: 172, z: 12, scale: 0.22, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/foot-right.png', description: 'Hài cổ trang mũi cong bên phải' },
    { id: 'arm-l', name: 'Bắp tay áo cổ trang trái', nameEn: 'Left Robe Upper Sleeve', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -48, y: -28, z: 8, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/arm-left.png', description: 'Bắp tay áo trường bào xanh bên trái' },
    { id: 'arm-r', name: 'Bắp tay áo cổ trang phải', nameEn: 'Right Robe Upper Sleeve', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 48, y: -28, z: 8, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/arm-right.png', description: 'Bắp tay áo trường bào xanh bên phải' },
    { id: 'torso', name: 'Thân áo đạo bào giao lĩnh Tu Tiên', nameEn: 'Xianxia Cross-Collar Robe Torso', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -36, z: 0, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/torso.png', description: 'Thân áo cổ trang giao lĩnh thêu mây vàng chuẩn hoạt hình Điêu Khắc Cát' },
    { id: 'pelvis', name: 'Đai lưng ngọc bội & Vạt áo dưới', nameEn: 'Jade Waist Sash & Lower Robe Skirt', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 32, z: -6, scale: 0.50, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/pelvis.png', description: 'Đai lưng kim ngọc kèm vạt trường bào dưới che liền mạch khớp hông' },
    { id: 'hand-l', name: 'Bàn tay trái bắt kiếm quyết', nameEn: 'Left Pointing Hand', role: 'hand-l', atlasCell: 13, boneId: 'bone-hand-l', defaultTransform: { x: -52, y: 54, z: -10, scale: 0.24, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/hand-left.png', description: 'Bàn tay trái duỗi ngón chỉ kiếm quyết' },
    { id: 'hand-r', name: 'Bàn tay phải nắm vũ khí', nameEn: 'Right Gripping Hand', role: 'hand-r', atlasCell: 14, boneId: 'bone-hand-r', defaultTransform: { x: 52, y: 50, z: -10, scale: 0.24, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/hand-right.png', description: 'Bàn tay phải nắm đạo cụ' },
    { id: 'forearm-l', name: 'Hộ uyển cổ tay áo trái', nameEn: 'Left Gold-Trimmed Martial Bracer', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -51, y: 16, z: -14, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/forearm-left.png', description: 'Ống hộ uyển bó tay áo viền vàng bên trái' },
    { id: 'forearm-r', name: 'Hộ uyển cổ tay áo phải', nameEn: 'Right Gold-Trimmed Martial Bracer', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 51, y: 16, z: -14, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/forearm-right.png', description: 'Ống hộ uyển bó tay áo viền vàng bên phải' },
    { id: 'head', name: 'Đầu Gấu Trúc Meme (Cười Khẩy)', nameEn: 'Chinese Meme Panda Head (Smirk)', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -128, z: -20, scale: 0.66, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/head.png', description: 'Đầu Gấu Trúc trắng tai đen kèm mặt meme Baozou cười đểu kinh điển' },
    { id: 'beard', name: 'Râu cá trê Đạo Sĩ (Hoá trang)', nameEn: 'Taoist Catfish Mustache & Beard Prop', role: 'beard', atlasCell: 10, boneId: 'bone-head', defaultTransform: { x: 0, y: -92, z: -24, scale: 0.24, rotation: 0, opacity: 0 }, suggestedAsset: 'character_shadiao_panda/beard.png', description: 'Chòm râu cá trê đạo sĩ hài hước (bật opacity=1 khi cần hoá trang)' },
    { id: 'mask', name: 'Biểu cảm Khóc Thét / Nổi Gân (Đổi mặt)', nameEn: 'Bawling Tears & Anger Vein Meme Face', role: 'mask', atlasCell: 15, boneId: 'bone-head', defaultTransform: { x: 0, y: -128, z: -28, scale: 0.66, rotation: 0, opacity: 0 }, suggestedAsset: 'character_shadiao_panda/mask.png', description: 'Khuôn mặt gấu khóc thành sông & nổi gân trán (bật opacity=1 để đổi biểu cảm tức thì)' },
    { id: 'glasses', name: 'Kính đen Thug Life 8-Bit', nameEn: '8-Bit Pixelated Thug-Life Sunglasses', role: 'glasses', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: 0, y: -126, z: -32, scale: 0.32, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/glasses.png', description: 'Kính đen pixel Deal-With-It ngầu lòi' },
    { id: 'hat', name: 'Mão Ngọc Tử Kim Tu Tiên', nameEn: 'Ancient Jade & Gold Cultivator Crown', role: 'hat', atlasCell: 5, boneId: 'bone-head', defaultTransform: { x: 0, y: -192, z: -36, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/hat.png', description: 'Mão tử kim ngọc bích kèm trâm ngọc đội trên đỉnh đầu gấu' },
    { id: 'prop-weapon', name: 'Kiếm Gỗ Buộc Gạch Ống "Vả Mặt"', nameEn: 'Wooden Sword Tied with Red Brick Prop', role: 'prop-weapon', atlasCell: 24, boneId: 'bone-hand-r', defaultTransform: { x: 82, y: 10, z: -40, scale: 0.46, rotation: 0 }, suggestedAsset: 'character_shadiao_panda/weapon.png', description: 'Thanh kiếm gỗ tu tiên cột gạch ống đỏ chuyên dùng "vả mặt" nghịch tập' }
  ],
  bones: PANDA_BONES,
  clips: PANDA_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `IDENTITY: Chinese Sand Sculpture Animation (沙雕动画 / 熊猫人修仙) Panda-Head Xianxia Cultivator character in 2D Flash vector comic style, bold black ink outlines, flat cel-shaded colors, pure white round panda head with two black panda ears and a funny Baozou Manhua smirk meme face, sky-blue cultivator robe, jade crown, 8-bit pixel sunglasses, and a wooden sword tied with a red clay brick.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_SHADIAO_PANDA_XIANXIA, images, name)
}

// ---------------------------------------------------------------------------
// 2. Đầu Nấm Đô Thị / Tổng Tài Bựa (Hoạt Hình Điêu Khắc Cát - 沙雕动画 / 蘑菇头)
// ---------------------------------------------------------------------------

const MUSH_BONES = createHumanoidBones().filter((b) => !b.id.includes('hand-') && !b.id.includes('foot-'))
const MUSH_WALK = generateWalkCycle(MUSH_BONES, 1.35)
const MUSH_IDLE = generateIdleBreathe(MUSH_BONES, 1.9)
const MUSH_WAVE = generateWaveHand(MUSH_BONES, 1.5)

const MUSH_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Đi bộ lầy lội (Walk)', duration: 1.35, loop: true, presetKey: 'walk', tracks: MUSH_WALK },
  { id: 'clip-idle', name: 'Đứng nhún nhảy cà khịa (Idle)', duration: 1.9, loop: true, presetKey: 'idle', tracks: MUSH_IDLE },
  { id: 'clip-wave', name: 'Giơ dép lào dọa đánh (Wave)', duration: 1.5, loop: true, presetKey: 'wave', tracks: MUSH_WAVE }
]

export const TMPL_SHADIAO_MUSHROOM_MODERN: LayerAssemblyTemplate = {
  id: 'tmpl-character-shadiao-modern',
  name: 'Đầu Nấm Đô Thị / Thanh Niên Lầy Lội (Hoạt Hình Điêu Khắc Cát)',
  nameEn: 'Shadiao Mushroom-Head Urban Meme (Baozou Cutout)',
  category: 'character',
  ageGroup: 'youth',
  description:
    'Nhân vật Đầu Nấm (蘑菇头 / Baozou Manhua) kinh điển của dòng Hoạt hình Điêu Khắc Cát Đô Thị: Đầu Nấm tóc úp nồi mặt cười khẩy, mặt Khóc Thác Nước thay thế, mũ bảo hiểm vàng, kính đen tổng tài, áo ba lỗ dây chuyền vàng, quần đùi hoa và đạo cụ Dép Lào huyền thoại.',
  descriptionEn:
    'Chinese Sand Sculpture Animation (Shadiao Donghua) Mushroom-Head urban meme character with 15 modular 2D Flash vector cutout layers, bawling tears expression swap, hard-hat, sunglasses, red tank-top with gold chain, floral shorts, and giant flip-flop slipper prop.',
  width: 500,
  height: 600,
  slots: [
    { id: 'thigh-l', name: 'Đùi quần hoa trái', nameEn: 'Left Floral Shorts Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -22, y: 58, z: 16, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/thigh-left.png', description: 'Đùi trái mặc quần đùi hoa đi biển' },
    { id: 'thigh-r', name: 'Đùi quần hoa phải', nameEn: 'Right Floral Shorts Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 22, y: 58, z: 16, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/thigh-right.png', description: 'Đùi phải mặc quần đùi hoa đi biển' },
    { id: 'shin-l', name: 'Cẳng chân & Dép lào trái', nameEn: 'Left Shin & Flip-Flop Sandal', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -26, y: 132, z: 20, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/shin-left.png', description: 'Cẳng chân và dép kẹp vàng xanh bên trái' },
    { id: 'shin-r', name: 'Cẳng chân & Dép lào phải', nameEn: 'Right Shin & Flip-Flop Sandal', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 26, y: 132, z: 20, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/shin-right.png', description: 'Cẳng chân và dép kẹp vàng xanh bên phải' },
    { id: 'arm-l', name: 'Bắp tay áo đỏ trái', nameEn: 'Left Red Upper Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -46, y: -36, z: 10, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/arm-left.png', description: 'Bắp tay trái khớp tròn' },
    { id: 'arm-r', name: 'Bắp tay áo đỏ phải', nameEn: 'Right Red Upper Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 46, y: -36, z: 10, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/arm-right.png', description: 'Bắp tay phải khớp tròn' },
    { id: 'pelvis', name: 'Quần đùi hoa đi biển (Hông)', nameEn: 'Floral Beach Shorts & Hips', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 24, z: 4, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/pelvis.png', description: 'Quần đùi hoa nhiệt đới hài hước' },
    { id: 'torso', name: 'Áo ba lỗ đỏ & Dây chuyền vàng', nameEn: 'Red Tank-Top & Gold Chain Torso', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -36, z: 0, scale: 0.46, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/torso.png', description: 'Áo thun đỏ đeo dây chuyền vàng "đại gia chân đất"' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Bare Forearm & Hand', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -52, y: 22, z: -12, scale: 0.40, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/forearm-left.png', description: 'Cẳng tay và bàn tay trái' },
    { id: 'forearm-r', name: 'Cẳng tay & Bàn tay phải', nameEn: 'Right Bare Forearm & Hand', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 52, y: 22, z: -12, scale: 0.40, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/forearm-right.png', description: 'Cẳng tay và bàn tay phải' },
    { id: 'head', name: 'Đầu Nấm Meme Baozou (Cười Khẩy)', nameEn: 'Mushroom-Head Meme Face (Smirk)', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -136, z: -22, scale: 0.62, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/head.png', description: 'Đầu nấm tóc úp nồi đen bóng kèm mặt meme cười khẩy kinh điển' },
    { id: 'mask', name: 'Biểu cảm Khóc Thác Nước (Đổi mặt)', nameEn: 'Bawling Waterfall Tears Meme Face', role: 'mask', atlasCell: 15, boneId: 'bone-head', defaultTransform: { x: 0, y: -132, z: -26, scale: 0.58, rotation: 0, opacity: 0 }, suggestedAsset: 'character_shadiao_modern/mask.png', description: 'Mặt meme khóc lụt nhà (bật opacity=1 để đổi biểu cảm khóc thét)' },
    { id: 'glasses', name: 'Kính Râm Đen Tổng Tài', nameEn: 'Black Boss Sunglasses Prop', role: 'glasses', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: 4, y: -130, z: -28, scale: 0.34, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/glasses.png', description: 'Kính râm đen phong cách tổng tài bá đạo' },
    { id: 'hat', name: 'Mũ Bảo Hiểm Vàng Công Trường', nameEn: 'Yellow Construction Hard-Hat Prop', role: 'hat', atlasCell: 5, boneId: 'bone-head', defaultTransform: { x: 0, y: -186, z: -32, scale: 0.56, rotation: 0, opacity: 0 }, suggestedAsset: 'character_shadiao_modern/hat.png', description: 'Mũ bảo hộ công trường màu vàng (bật opacity=1 khi đội mũ)' },
    { id: 'prop-weapon', name: 'Chiếc Dép Lào Xanh "Tấu Hài"', nameEn: 'Giant Blue Flip-Flop Slipper Weapon', role: 'prop-weapon', atlasCell: 24, boneId: 'bone-forearm-r', defaultTransform: { x: 86, y: 22, z: -36, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_shadiao_modern/weapon.png', description: 'Vũ khí tối thượng trong phim Điêu Khắc Cát: Chiếc dép lào xanh vàng' }
  ],
  bones: MUSH_BONES,
  clips: MUSH_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `IDENTITY: Chinese Sand Sculpture Animation (沙雕动画 / 蘑菇头) Mushroom-Head urban meme character in 2D Flash vector comic style, bold black ink outlines, flat vibrant cel-shaded colors, oversized white head with shiny black bowl-cut mushroom hair and hilarious Baozou smirk meme face, red tank-top with gold chain, floral beach shorts, and flip-flop sandals.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_SHADIAO_MUSHROOM_MODERN, images, name)
}

export const SHADIAO_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_SHADIAO_PANDA_XIANXIA,
  TMPL_SHADIAO_MUSHROOM_MODERN
]

export const SHADIAO_DEFAULT_COMPOSITES: LayerComposite[] = [
  {
    ...createTemplateComposite(TMPL_SHADIAO_PANDA_XIANXIA),
    id: 'comp-shadiao-panda-xianxia',
    name: 'Cát Gấu Tu Tiên — Hoạt Hình Điêu Khắc Cát (21 Lớp Rigging)',
    description:
      'Nhân vật Cát Gấu Tu Tiên (沙雕动画 / 熊猫人修仙) gắn sẵn khung xương chuyển động: Đầu Gấu Trúc Meme, Kính đen Thug Life 8-bit, Mão ngọc đạo sĩ, Trường bào cổ trang, Kiếm gỗ buộc gạch ống "vả mặt" và lớp Biểu cảm Khóc Thét/Nổi Gân có thể bật/tắt tức thì.'
  },
  {
    ...createTemplateComposite(TMPL_SHADIAO_MUSHROOM_MODERN),
    id: 'comp-shadiao-mushroom-modern',
    name: 'Đầu Nấm Đô Thị — Hoạt Hình Điêu Khắc Cát (15 Lớp Rigging)',
    description:
      'Nhân vật Đầu Nấm Baozou (蘑菇头) hài bựa gắn sẵn khung xương chuyển động: Đầu Nấm cười khẩy, Kính đen tổng tài, Áo ba lỗ dây chuyền vàng, Quần đùi hoa, Dép lào chiến thuật và lớp Biểu cảm Khóc Thác Nước / Mũ bảo hiểm bật/tắt linh hoạt.'
  }
]
