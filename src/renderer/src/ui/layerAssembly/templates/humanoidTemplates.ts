import { createTemplateComposite } from './templateBuilder'
import type { AnimationClip } from '@shared/layerRig'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import {
  createHumanoidBones,
  generateWalkCycle,
  generateIdleBreathe,
  generateActionSlash,
  generateWaveHand,
  generateBow
} from '../workshopRigPresets'
import {
  createChildBones,
  generateChildToddle,
  createElderlyBones,
  generateElderlyCaneWalk
} from './creatureRigPresets'
import {
  HERO_PROP_ART,
  ANIME_GIRL_ART,
  CHIBI_KID_ART,
  BUSINESSMAN_ART,
  GRANDPA_ART
} from './humanoidTemplateArtwork'

// ---------------------------------------------------------------------------
// 1. Nam Trưởng Thành / Nam Anh Hùng (Atlas 5x5 theo character-cutout-prompt.md)
// ---------------------------------------------------------------------------

const HERO_BONES = createHumanoidBones()
const HERO_WALK = generateWalkCycle(HERO_BONES, 1.6)
const HERO_IDLE = generateIdleBreathe(HERO_BONES, 2.4)
const HERO_SLASH = generateActionSlash(HERO_BONES, 1.5)
const HERO_WAVE = generateWaveHand(HERO_BONES, 1.8)

const HERO_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Bước đi (Walk)', duration: 1.6, loop: true, presetKey: 'walk', tracks: HERO_WALK },
  { id: 'clip-idle', name: 'Đứng thở (Idle)', duration: 2.4, loop: true, presetKey: 'idle', tracks: HERO_IDLE },
  { id: 'clip-action', name: 'Vung kiếm (Slash)', duration: 1.5, loop: true, presetKey: 'action', tracks: HERO_SLASH },
  { id: 'clip-wave', name: 'Vẫy tay chào (Wave)', duration: 1.8, loop: true, presetKey: 'wave', tracks: HERO_WAVE }
]

export const TMPL_MALE_HERO: LayerAssemblyTemplate = {
  id: 'tmpl-character-male-hero',
  name: 'Nam Anh Hùng / Hiệp Sĩ Trưởng Thành (Atlas 5x5)',
  nameEn: 'Adult Male Hero / Knight (5x5 Cutout Atlas)',
  category: 'character',
  ageGroup: 'adult',
  description: 'Nhân vật nam thanh niên / hiệp sĩ chia 23 bộ phận chuẩn Atlas 5x5: tách rời cẳng tay & bàn tay, cẳng chân & bàn chân; khuôn mặt mộc độc lập với Mũ, Kính mắt, Râu giả, Mặt nạ để hoá trang đóng phim.',
  descriptionEn: 'Adult male character with 23 modular cutout parts: separated hands & feet, bare head isolated from hat, glasses, beard and mask for movie disguise and costume changes.',
  width: 500,
  height: 600,
  slots: [
    { id: 'cape', name: 'Áo choàng đỏ sau lưng', nameEn: 'Hero Crimson Cape', role: 'cape', atlasCell: 25, boneId: 'bone-torso', defaultTransform: { x: 0, y: 18, z: 60, scale: 0.48, rotation: 0 }, suggestedAsset: 'character_cutout_demo/cape.png', description: 'Áo choàng đỏ bay phía sau lưng nhân vật Chibi' },
    { id: 'hair-back', name: 'Tóc sau gáy & Lông mũ', nameEn: 'Back Hair / Helmet Plume', role: 'hair-back', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 0, y: -125, z: 50, scale: 0.385, rotation: 0 }, suggestedAsset: 'character_cutout_demo/hair-back.png', description: 'Khối tóc sau đầu Chibi' },
    { id: 'pelvis', name: 'Hông & Thắt lưng giáp', nameEn: 'Pelvis & Armored Belt', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: -4, y: 12, z: 0, scale: 0.37, rotation: 0 }, suggestedAsset: 'character_cutout_demo/pelvis.png', description: 'Hông và thắt lưng che khớp đùi' },
    { id: 'thigh-l', name: 'Đùi trái giáp sắt', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -16, y: 58, z: 15, scale: 0.28, rotation: 0 }, suggestedAsset: 'character_cutout_demo/thigh-left.png', description: 'Đùi trái từ hông đến đầu gối' },
    { id: 'shin-l', name: 'Cẳng chân trái (Không dính bàn chân)', nameEn: 'Left Shin / Greave', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -21, y: 112, z: 10, scale: 0.28, rotation: 0 }, suggestedAsset: 'character_cutout_demo/shin-left.png', description: 'Cẳng chân trái từ đầu gối tới cổ chân' },
    { id: 'foot-l', name: 'Bàn chân & Ủng sắt trái', nameEn: 'Left Foot / Sabaton Boot', role: 'foot-l', atlasCell: 21, boneId: 'bone-foot-l', defaultTransform: { x: -22, y: 152, z: 5, scale: 0.22, rotation: 0 }, suggestedAsset: 'character_cutout_demo/foot-left.png', description: 'Bàn chân trái có thể xoay cổ chân độc lập' },
    { id: 'thigh-r', name: 'Đùi phải giáp sắt', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 16, y: 58, z: 15, scale: 0.28, rotation: 0 }, suggestedAsset: 'character_cutout_demo/thigh-right.png', description: 'Đùi phải từ hông đến đầu gối' },
    { id: 'shin-r', name: 'Cẳng chân phải (Không dính bàn chân)', nameEn: 'Right Shin / Greave', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 18, y: 112, z: 10, scale: 0.28, rotation: 0 }, suggestedAsset: 'character_cutout_demo/shin-right.png', description: 'Cẳng chân phải từ đầu gối tới cổ chân' },
    { id: 'foot-r', name: 'Bàn chân & Ủng sắt phải', nameEn: 'Right Foot / Sabaton Boot', role: 'foot-r', atlasCell: 22, boneId: 'bone-foot-r', defaultTransform: { x: 18, y: 152, z: 5, scale: 0.22, rotation: 0 }, suggestedAsset: 'character_cutout_demo/foot-right.png', description: 'Bàn chân phải có thể xoay cổ chân độc lập' },
    { id: 'torso', name: 'Thân & Áo giáp ngực', nameEn: 'Torso & Cuirass Armor', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -4, y: -43, z: -15, scale: 0.44, rotation: 0 }, suggestedAsset: 'character_cutout_demo/torso.png', description: 'Thân từ vai đến eo' },
    { id: 'arm-l', name: 'Bắp tay trái & Giáp vai', nameEn: 'Left Upper Arm & Pauldron', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -44, y: -49, z: -20, scale: 0.285, rotation: 0 }, suggestedAsset: 'character_cutout_demo/arm-left.png', description: 'Bắp tay trái khớp vai chuẩn' },
    { id: 'forearm-l', name: 'Cẳng tay trái (Không dính bàn tay)', nameEn: 'Left Forearm / Vambrace', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -48, y: -9, z: -32, scale: 0.275, rotation: 0 }, suggestedAsset: 'character_cutout_demo/forearm-left.png', description: 'Cẳng tay trái từ khuỷu tay đến cổ tay' },
    { id: 'hand-l', name: 'Bàn tay & Găng sắt trái', nameEn: 'Left Hand / Gauntlet', role: 'hand-l', atlasCell: 13, boneId: 'bone-hand-l', defaultTransform: { x: -48, y: 18, z: -44, scale: 0.21, rotation: 0 }, suggestedAsset: 'character_cutout_demo/hand-left.png', description: 'Bàn tay trái có thể xoay cổ tay' },
    { id: 'arm-r', name: 'Bắp tay phải & Giáp vai', nameEn: 'Right Upper Arm & Pauldron', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 44, y: -49, z: -20, scale: 0.285, rotation: 0 }, suggestedAsset: 'character_cutout_demo/arm-right.png', description: 'Bắp tay phải khớp vai chuẩn' },
    { id: 'forearm-r', name: 'Cẳng tay phải (Không dính bàn tay)', nameEn: 'Right Forearm / Vambrace', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 44, y: -9, z: -32, scale: 0.275, rotation: 0 }, suggestedAsset: 'character_cutout_demo/forearm-right.png', description: 'Cẳng tay phải từ khuỷu tay đến cổ tay' },
    { id: 'hand-r', name: 'Bàn tay & Găng sắt phải', nameEn: 'Right Hand / Gauntlet', role: 'hand-r', atlasCell: 14, boneId: 'bone-hand-r', defaultTransform: { x: 48, y: 18, z: -44, scale: 0.21, rotation: 0 }, suggestedAsset: 'character_cutout_demo/hand-right.png', description: 'Bàn tay phải có thể xoay cổ tay' },
    { id: 'head', name: 'Khuôn mặt Nam Chibi (Mặt mộc)', nameEn: 'Bare Chibi Head & Face', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -2, y: -127, z: -25, scale: 0.385, rotation: 0 }, suggestedAsset: 'character_cutout_demo/head.png', description: 'Khuôn mặt Nam Chibi mắt sáng long lanh' },
    { id: 'beard', name: 'Râu giả / Râu quai nón hoá trang', nameEn: 'Fake Beard / Mustache Prop', role: 'beard', atlasCell: 10, boneId: 'bone-head', defaultTransform: { x: -2, y: -102, z: -30, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_cutout_demo/beard.png', description: 'Đạo cụ râu quai nón hoá trang' },
    { id: 'glasses', name: 'Kính mắt chiến thuật đạo cụ', nameEn: 'Eyewear / Glasses Prop', role: 'glasses', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: -2, y: -122, z: -33, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_cutout_demo/glasses.png', description: 'Kính mắt đạo cụ' },
    { id: 'mask', name: 'Mặt nạ / Khăn che mặt hoá trang', nameEn: 'Costume Mask / Face Visor', role: 'mask', atlasCell: 15, boneId: 'bone-head', defaultTransform: { x: -2, y: -108, z: -36, scale: 0.42, rotation: 0 }, suggestedAsset: 'character_cutout_demo/mask.png', description: 'Mặt nạ che mặt' },
    { id: 'hair-front', name: 'Tóc mái trước Anime Chibi', nameEn: 'Front Hair / Bangs Wig', role: 'hair-front', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: -1, y: -127, z: -40, scale: 0.38, rotation: 0 }, suggestedAsset: 'character_cutout_demo/hair-front.png', description: 'Tóc mái trước Chibi' },
    { id: 'hat', name: 'Mũ / Vương miện chiến binh', nameEn: 'Helmet / Hat Headwear', role: 'hat', atlasCell: 5, boneId: 'bone-head', defaultTransform: { x: -1, y: -162, z: -45, scale: 0.44, rotation: 0 }, suggestedAsset: 'character_cutout_demo/hat.png', description: 'Mũ nón đội lên đỉnh đầu' },
    { id: 'prop-weapon', name: 'Thanh kiếm ánh sáng cầm tay', nameEn: 'Sword / Handheld Film Prop', role: 'prop-weapon', atlasCell: 24, boneId: 'bone-hand-r', defaultTransform: { x: 68, y: -18, z: -50, scale: 0.45, rotation: 0 }, suggestedAsset: 'character_cutout_demo/weapon.png', description: 'Đạo cụ cầm tay gắn vào xương bàn tay phải' }
  ],
  bones: HERO_BONES,
  clips: HERO_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Use the attached character image as the strict identity reference.
Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for 2D skeletal / 2.5D animation.
IDENTITY: Chibi / stylized 2D animated male hero with modular costume disguise kit.
VIEW: Strict FRONT ORTHOGRAPHIC view, neutral relaxed rest pose, limbs straight, no perspective.
OUTPUT: Single square 4096x4096 PNG on flat OPAQUE green chroma-key background (#00FF00). Exactly 5 columns x 5 rows of equal cells.

MODULAR FILM DISGUISE & ACTOR PROPS PRINCIPLE (CRITICAL):
1. BARE BASE HEAD (Cell 1): Must draw a completely clean, bare face (eyes, nose, mouth, ears, forehead). NEVER bake a beard, glasses, mask, or hat into the base face. The face acts as an unadorned actor base.
2. DISGUISE ACCESSORIES (Cells 5, 10, 15, 20):
   - Cell 5 (HAT / HELMET): Isolated headwear with hollow space matching the head crown.
   - Cell 10 (DETACHABLE BEARD / MUSTACHE): Isolated facial hair prop aligning precisely with the chin and upper lip of Cell 1.
   - Cell 15 (DISGUISE MASK / BANDANA / VISOR): Isolated face mask covering lower face or eyes.
   - Cell 20 (EYEWEAR / GLASSES): Isolated spectacles/sunglasses matching the interpupillary distance of Cell 1.
3. SEPARATED 3-SEGMENT LIMBS:
   - Forearms (Cells 11, 12) must NOT have hands. Extend wrist with 10-15% rounded joint overlap.
   - Hands (Cells 13, 14) are independent sprites with 5 fingers and rounded wrist caps for independent wrist rotation.
   - Shins / Lower Legs (Cells 18, 19) must NOT have feet or shoes. Extend ankle with 10-15% rounded joint overlap.
   - Feet / Boots / Shoes (Cells 21, 22) are independent sprites with rounded ankle caps for ankle pivoting.
4. MOVIE PROPS & CAPE (Cells 24, 25): Handheld sword/prop in Cell 24, flowing back cape in Cell 25.

5x5 EQUAL CELLS:
Row 1: 1.Head/face (bare, no beard/hat/mask/glasses), 2.Neck, 3.Back hair silhouette, 4.Front bangs/wig, 5.Hat/helmet/headwear
Row 2: 6.Torso/chestplate, 7.Pelvis/belt, 8.LEFT upper arm, 9.RIGHT upper arm, 10.Detachable beard/mustache prop
Row 3: 11.LEFT forearm (no hand), 12.RIGHT forearm (no hand), 13.LEFT hand/glove, 14.RIGHT hand/glove, 15.Costume mask/bandana
Row 4: 16.LEFT thigh, 17.RIGHT thigh, 18.LEFT lower leg (no foot), 19.RIGHT lower leg (no foot), 20.Glasses/eyewear prop
Row 5: 21.LEFT foot/boot, 22.RIGHT foot/boot, 23.Left shoulder pad/cape lock, 24.Handheld movie prop/sword, 25.Back cape/cloak
CRITICAL: Extend all joints with rounded concealed overlapping ends (10-15%). One shared pixel scale across all cells.`,
    cellLayout: [
      '1. Mặt mộc nam (không râu/kính/mặt nạ/mũ)',
      '3. Tóc sau gáy',
      '4. Tóc mái trước / Tóc giả',
      '5. Mũ / Nón / Mũ giáp',
      '6. Thân áo / Giáp ngực',
      '7. Hông & Thắt lưng',
      '8. Bắp tay trái',
      '9. Bắp tay phải',
      '10. Râu giả / Râu quai nón',
      '11. Cẳng tay trái (không kèm bàn tay)',
      '12. Cẳng tay phải (không kèm bàn tay)',
      '13. Bàn tay / Găng tay trái',
      '14. Bàn tay / Găng tay phải',
      '15. Mặt nạ / Khăn che mặt hoá trang',
      '16. Đùi trái',
      '17. Đùi phải',
      '18. Cẳng chân trái (không kèm bàn chân)',
      '19. Cẳng chân phải (không kèm bàn chân)',
      '20. Kính mắt / Kính râm hoá trang',
      '21. Bàn chân / Ủng trái',
      '22. Bàn chân / Ủng phải',
      '24. Đạo cụ cầm tay / Kiếm',
      '25. Áo choàng đỏ sau lưng'
    ],
    userGuide: 'Mẫu nhân vật Nam Hiệp Sĩ Chibi bóc tách 23 bộ phận chuẩn phim hoạt hình: Tách riêng 3 khúc tay (bắp tay - cẳng tay - bàn tay) và 3 khúc chân (đùi - cẳng chân - bàn chân). Khuôn mặt mộc được tách riêng biệt với Mũ, Kính mắt, Râu giả và Mặt nạ để bật/tắt hoá trang.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_MALE_HERO, images, name)
}

// ---------------------------------------------------------------------------
// 2. Nữ Thiếu Nữ / Nữ Sinh Anime (12 Khớp Rigging)
// ---------------------------------------------------------------------------

const ANIME_BONES = createHumanoidBones()
const ANIME_WALK = generateWalkCycle(ANIME_BONES, 1.6)
const ANIME_IDLE = generateIdleBreathe(ANIME_BONES, 2.0)
const ANIME_WAVE = generateWaveHand(ANIME_BONES, 1.8)
const ANIME_BOW = generateBow(ANIME_BONES, 2.0)

const ANIME_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Đi bộ tự nhiên (Walk)', duration: 1.6, loop: true, presetKey: 'walk', tracks: ANIME_WALK },
  { id: 'clip-idle', name: 'Đứng thở nhẹ nhàng (Idle)', duration: 2.0, loop: true, presetKey: 'idle', tracks: ANIME_IDLE },
  { id: 'clip-wave', name: 'Vẫy tay chào bạn (Wave)', duration: 1.8, loop: true, presetKey: 'wave', tracks: ANIME_WAVE },
  { id: 'clip-bow', name: 'Cúi chào lễ phép (Bow)', duration: 2.0, loop: false, presetKey: 'bow', tracks: ANIME_BOW }
]

export const TMPL_FEMALE_ANIME: LayerAssemblyTemplate = {
  id: 'tmpl-character-female-anime',
  name: 'Nữ Thiếu Nữ Chibi / Anime Girl (Tóc Buông & Váy Xếp Ly)',
  nameEn: 'Young Female Chibi / Anime Heroine (Sailor Outfit & Rigged Hair)',
  category: 'character',
  ageGroup: 'youth',
  description: 'Nữ sinh Chibi Anime tóc hồng Sakura dài buông xõa hai bên vai, đồng phục học sinh áo thủy thủ nơ đỏ váy xếp ly, 12 bộ phận tách rời khớp xương 100%.',
  descriptionEn: 'Young female Chibi anime character with flowing twin hair, sailor blouse, pleated skirt and 12 rigged cutout layers.',
  width: 500,
  height: 600,
  slots: [
    { id: 'hair-back', name: 'Tóc sau dài buông vai', nameEn: 'Back Hair', role: 'hair-back', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 0, y: -80, z: 50, scale: 0.55, rotation: 0 }, suggestedAsset: 'character_chibi_female/hair-back.png', description: 'Khối tóc hồng Sakura sau đầu mờ xa phía hậu cảnh' },
    { id: 'head', name: 'Đầu & Khuôn mặt Nữ Chibi', nameEn: 'Head, Face & Front Bangs', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -124, z: -15, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_chibi_female/head.png', description: 'Khuôn mặt Chibi anime mắt tím to long lanh, tóc mái nơ đỏ' },
    { id: 'torso', name: 'Áo đồng phục thủy thủ & Nơ', nameEn: 'Sailor Torso & Bow', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -40, z: 10, scale: 0.54, rotation: 0 }, suggestedAsset: 'character_chibi_female/torso.png', description: 'Thân áo thủy thủ trắng kèm nơ đỏ' },
    { id: 'pelvis', name: 'Váy xếp ly học sinh & Hông', nameEn: 'Pleated Skirt & Pelvis', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 12, z: 0, scale: 0.54, rotation: 0 }, suggestedAsset: 'character_chibi_female/pelvis.png', description: 'Váy xếp ly màu lam sẫm che khớp đùi' },
    { id: 'arm-l', name: 'Bắp tay áo phồng trái', nameEn: 'Left Upper Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -36, y: -42, z: -6, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_chibi_female/arm-left.png', description: 'Tay áo học sinh bên trái' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -38, y: 10, z: -25, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_chibi_female/forearm-left.png', description: 'Cẳng tay và bàn tay trái Chibi' },
    { id: 'arm-r', name: 'Bắp tay áo phồng phải', nameEn: 'Right Upper Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 36, y: -42, z: -6, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_chibi_female/arm-right.png', description: 'Tay áo học sinh bên phải' },
    { id: 'forearm-r', name: 'Cẳng tay & Cặp sách phải', nameEn: 'Right Forearm, Hand & School Bag', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 42, y: 14, z: -25, scale: 0.52, rotation: 0 }, suggestedAsset: 'character_chibi_female/forearm-right.png', description: 'Cẳng tay phải cầm cặp sách đi học' },
    { id: 'thigh-l', name: 'Đùi trái mang tất dài', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -20, y: 64, z: 35, scale: 0.58, rotation: 0 }, suggestedAsset: 'character_chibi_female/thigh-left.png', description: 'Đùi trái mang tất đùi đen' },
    { id: 'shin-l', name: 'Cẳng chân & Giày học sinh trái', nameEn: 'Left Shin & Loafer', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -20, y: 136, z: 22, scale: 0.58, rotation: 0 }, suggestedAsset: 'character_chibi_female/shin-left.png', description: 'Cẳng chân và giày da học sinh trái' },
    { id: 'thigh-r', name: 'Đùi phải mang tất dài', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 20, y: 64, z: 35, scale: 0.58, rotation: 0 }, suggestedAsset: 'character_chibi_female/thigh-right.png', description: 'Đùi phải mang tất đùi đen' },
    { id: 'shin-r', name: 'Cẳng chân & Giày học sinh phải', nameEn: 'Right Shin & Loafer', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 20, y: 136, z: 22, scale: 0.58, rotation: 0 }, suggestedAsset: 'character_chibi_female/shin-right.png', description: 'Cẳng chân và giày da học sinh phải' }
  ],
  bones: ANIME_BONES,
  clips: ANIME_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for 2D anime girl skeletal animation.
IDENTITY: Young anime schoolgirl, silver-lavender twin-tail hair, gentle smiling expression, white sailor uniform with navy collar and red ribbon bow, navy pleated skirt, black thigh-high socks, brown loafers, leather school bag.
VIEW: Front orthographic view, calm relaxed standing rest pose, arms at sides.
BACKGROUND: Uniform flat opaque chroma-key magenta #FF00FF background.
CELLS:
1. Head, face & front bangs
3. Long flowing back hair silhouette
6. Sailor blouse with red bow
7. Pleated navy skirt & hips
8. Left puffy sleeve & upper arm
9. Right puffy sleeve & upper arm
11. Left slender forearm & hand
12. Right forearm, hand & school bag
16. Left thigh with black stocking
17. Right thigh with black stocking
18. Left shin with school loafer
19. Right shin with school loafer
Hidden rounded overlaps at joints (10-15%). Clear silhouette edges, no color bleed.`,
    cellLayout: ['1. Mặt anime', '3. Tóc sau dài', '6. Thân áo thủy thủ', '7. Váy xếp ly', '8. Tay áo T', '9. Tay áo P', '11. Cẳng tay T', '12. Cẳng tay P', '16. Đùi tất T', '17. Đùi tất P', '18. Chân giày T', '19. Chân giày P'],
    userGuide: 'Lưu ảnh sprite atlas với phông hồng tím (#FF00FF), loại bỏ nền trong suốt rồi gắn từng bộ phận vào xưởng lắp ráp.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_FEMALE_ANIME, images, name)
}

// ---------------------------------------------------------------------------
// 3. Trẻ Em / Bé Trai / Bé Gái Chibi (Tỉ lệ 3.5 đầu, lon ton tinh nghịch)
// ---------------------------------------------------------------------------

const CHILD_BONES = createChildBones()
const CHILD_TODDLE = generateChildToddle(CHILD_BONES, 1.1)
const CHILD_IDLE = generateIdleBreathe(CHILD_BONES, 1.8)

const CHILD_CLIPS: AnimationClip[] = [
  { id: 'clip-toddle', name: 'Bước đi lon ton (Toddle)', duration: 1.1, loop: true, presetKey: 'walk', tracks: CHILD_TODDLE },
  { id: 'clip-idle', name: 'Đứng thở tinh nghịch (Idle)', duration: 1.8, loop: true, presetKey: 'idle', tracks: CHILD_IDLE }
]

export const TMPL_CHILD_KID: LayerAssemblyTemplate = {
  id: 'tmpl-character-child-kid',
  name: 'Bé Trai / Trẻ Em Chibi (Lon Ton Tinh Nghịch)',
  nameEn: 'Toddler / Chibi Kid (Playful & Energetic)',
  category: 'character',
  ageGroup: 'child',
  description: 'Trẻ em / bé trai chibi tỉ lệ 3.5 đầu tròn lẳn, má phính dễ thương, áo thun quần yếm, bước đi lon ton nhí nhảnh và vui tươi.',
  descriptionEn: 'Cute chibi child character with 3.5 heads proportion, overalls, short chubby limbs and energetic waddle.',
  width: 450,
  height: 520,
  slots: [
    { id: 'head', name: 'Đầu to tròn & Mũ lưỡi trai', nameEn: 'Chibi Head & Cap', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -82, z: -15, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.head, description: 'Đầu tròn to, má phính hồng hào, mũ lưỡi trai' },
    { id: 'torso', name: 'Thân áo thun trẻ em', nameEn: 'Child T-Shirt Torso', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -20, z: 0, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.torso, description: 'Áo thun sọc ngắn trẻ em' },
    { id: 'pelvis', name: 'Quần yếm bò dễ thương', nameEn: 'Denim Overalls & Hips', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: -5, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.pelvis, description: 'Quần yếm ngắn bò xanh có túi' },
    { id: 'arm-l', name: 'Tay áo trái bụ bẫm', nameEn: 'Left Whole Arm & Hand', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -34, y: -12, z: -10, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.armL, description: 'Cánh tay liền và bàn tay tròn ngắn bụ bẫm bên trái' },
    { id: 'arm-r', name: 'Tay áo phải bụ bẫm', nameEn: 'Right Whole Arm & Hand', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 34, y: -12, z: -10, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.armR, description: 'Cánh tay liền và bàn tay tròn ngắn bụ bẫm bên phải' },
    { id: 'thigh-l', name: 'Chân trái ngắn & Giày thể thao', nameEn: 'Left Leg & Sneaker', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -20, y: 72, z: 10, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.legL, description: 'Chân ngắn bụ bẫm và giày đỏ bên trái' },
    { id: 'thigh-r', name: 'Chân phải ngắn & Giày thể thao', nameEn: 'Right Leg & Sneaker', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 20, y: 72, z: 10, scale: 0.9, rotation: 0 }, suggestedAsset: CHIBI_KID_ART.legR, description: 'Chân ngắn bụ bẫm và giày đỏ bên phải' }
  ],
  bones: CHILD_BONES,
  clips: CHILD_CLIPS,
  activeClipId: 'clip-toddle',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D cute toddler / child character.
IDENTITY: 5-year-old child, chibi proportions (3.5 heads tall), oversized round head with chubby cheeks, backwards baseball cap, colorful striped t-shirt and blue denim overalls, small red sneakers.
VIEW: Front orthographic view, relaxed friendly pose, short chubby limbs.
BACKGROUND: Solid flat green chroma-key background #00FF00.
CELLS:
1. Head and cap (large round silhouette, cheerful big eyes)
6. Torso with striped tee
7. Denim overalls hip section
8. Left chubby arm with small hand
9. Right chubby arm with small hand
16. Left short leg with red sneaker
17. Right short leg with red sneaker
Overlapping rounded joint caps for smooth puppet animation.`,
    cellLayout: ['1. Đầu chibi & mũ', '6. Thân áo sọc', '7. Quần yếm bò', '8. Tay trái bụ bẫm', '9. Tay phải bụ bẫm', '16. Chân & giày trái', '17. Chân & giày phải'],
    userGuide: 'Prompt tạo tỉ lệ chibi 3.5 đầu dễ thương, tách nền và ráp vào các khớp ngắn của trẻ em.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHILD_KID, images, name)
}

// ---------------------------------------------------------------------------
// 4. Người Trung Niên / Doanh Nhân Công Sở (Đĩnh đạc, Vest lịch thiệp)
// ---------------------------------------------------------------------------

const MID_BONES = createHumanoidBones()
const MID_WALK = generateWalkCycle(MID_BONES, 1.8)
const MID_IDLE = generateIdleBreathe(MID_BONES, 2.6)

const MID_CLIPS: AnimationClip[] = [
  { id: 'clip-firm-walk', name: 'Bước đi đĩnh đạc (Firm Walk)', duration: 1.8, loop: true, presetKey: 'walk', tracks: MID_WALK },
  { id: 'clip-idle', name: 'Đứng phong thái đĩnh đạc (Idle)', duration: 2.6, loop: true, presetKey: 'idle', tracks: MID_IDLE }
]

export const TMPL_MIDDLEAGED_MAN: LayerAssemblyTemplate = {
  id: 'tmpl-character-middleaged-man',
  name: 'Người Trung Niên / Quý Ông Công Sở (Vest Đĩnh Đạc)',
  nameEn: 'Middle-Aged Professional / Gentleman (Business Suit)',
  category: 'character',
  ageGroup: 'middleaged',
  description: 'Nhân vật nam trung niên tầm 45 tuổi: tách rời cẳng tay & bàn tay, cẳng chân & giày tây; khuôn mặt mộc độc lập với Kính mắt, Râu mép, Mũ phớt và Cặp da đạo cụ.',
  descriptionEn: 'Middle-aged businessman in tailored suit with separated hands, oxford shoes, and modular disguise props: bare face, mustache, eyewear, fedora and briefcase.',
  width: 500,
  height: 600,
  slots: [
    { id: 'head', name: 'Khuôn mặt mộc trung niên', nameEn: 'Mature Bare Head', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -119, z: -20, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.head, description: 'Khuôn mặt trung niên chín chắn, tóc chải ngược, không dính kính mắt hay râu' },
    { id: 'beard', name: 'Râu mép / Râu doanh nhân', nameEn: 'Mustache / Executive Beard', role: 'beard', atlasCell: 10, boneId: 'bone-head', defaultTransform: { x: 0, y: -98, z: -26, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.beard, description: 'Râu mép cắt tỉa gọn gàng lịch lãm' },
    { id: 'glasses', name: 'Kính mắt gọng kim loại', nameEn: 'Metal Frame Eyeglasses', role: 'glasses', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: 0, y: -120, z: -30, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.glasses, description: 'Kính cận hoặc kính râm doanh nhân' },
    { id: 'mask', name: 'Khẩu trang / Mặt nạ hoá trang', nameEn: 'Face Mask / Disguise', role: 'mask', atlasCell: 15, boneId: 'bone-head', defaultTransform: { x: 0, y: -104, z: -32, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.mask, description: 'Khẩu trang y tế hoặc khăn che nửa mặt' },
    { id: 'hat', name: 'Mũ phớt Fedora', nameEn: 'Fedora Felt Hat', role: 'hat', atlasCell: 5, boneId: 'bone-head', defaultTransform: { x: 0, y: -152, z: -35, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.hat, description: 'Mũ phớt nỉ phong cách quý ông cổ điển' },
    { id: 'torso', name: 'Áo Vest âu & Cà vạt đỏ', nameEn: 'Suit Jacket & Red Tie', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -40, z: -5, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.torso, description: 'Áo vest xám cắt may chỉn chu, sơ mi trắng và cà vạt đỏ' },
    { id: 'pelvis', name: 'Hông thắt lưng da', nameEn: 'Hips & Leather Belt', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: 0, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.pelvis, description: 'Thắt lưng da khóa kim loại và phần trên quần âu' },
    { id: 'arm-l', name: 'Tay áo vest trái', nameEn: 'Left Suit Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -40, y: -40, z: -15, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.armL, description: 'Cánh tay áo vest trái' },
    { id: 'forearm-l', name: 'Cẳng tay sơ mi trái', nameEn: 'Left Forearm', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -42, y: 12, z: -25, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.forearmL, description: 'Cẳng tay trái tay áo sơ mi lót' },
    { id: 'hand-l', name: 'Bàn tay trái & Đồng hồ', nameEn: 'Left Hand & Watch', role: 'hand-l', atlasCell: 13, boneId: 'bone-hand-l', defaultTransform: { x: -42, y: 54, z: -35, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.handL, description: 'Bàn tay trái đeo đồng hồ kim loại' },
    { id: 'arm-r', name: 'Tay áo vest phải', nameEn: 'Right Suit Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 40, y: -40, z: -15, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.armR, description: 'Cánh tay áo vest phải' },
    { id: 'forearm-r', name: 'Cẳng tay sơ mi phải', nameEn: 'Right Forearm', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 42, y: 12, z: -25, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.forearmR, description: 'Cẳng tay phải tay áo sơ mi' },
    { id: 'hand-r', name: 'Bàn tay phải xách cặp', nameEn: 'Right Hand', role: 'hand-r', atlasCell: 14, boneId: 'bone-hand-r', defaultTransform: { x: 42, y: 54, z: -35, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.handR, description: 'Bàn tay phải cầm quai xách' },
    { id: 'prop-hand', name: 'Cặp tài liệu da công sở', nameEn: 'Leather Briefcase Prop', role: 'prop-hand', atlasCell: 24, boneId: 'bone-hand-r', defaultTransform: { x: 52, y: 80, z: -40, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.briefcase, description: 'Cặp da tài liệu đạo cụ công sở' },
    { id: 'thigh-l', name: 'Quần âu đùi trái', nameEn: 'Left Trousers Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -24, y: 75, z: 20, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.thighL, description: 'Ống quần âu ủi ly phẳng phiu trái' },
    { id: 'shin-l', name: 'Cẳng chân quần âu trái', nameEn: 'Left Trousers Shin', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -24, y: 145, z: 15, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.shinL, description: 'Ống quần cẳng chân trái' },
    { id: 'foot-l', name: 'Giày da Oxford đen trái', nameEn: 'Left Oxford Shoe', role: 'foot-l', atlasCell: 21, boneId: 'bone-foot-l', defaultTransform: { x: -26, y: 192, z: 10, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.footL, description: 'Giày da Oxford đen bóng trái' },
    { id: 'thigh-r', name: 'Quần âu đùi phải', nameEn: 'Right Trousers Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 24, y: 75, z: 20, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.thighR, description: 'Ống quần âu ủi ly phẳng phiu phải' },
    { id: 'shin-r', name: 'Cẳng chân quần âu phải', nameEn: 'Right Trousers Shin', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 24, y: 145, z: 15, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.shinR, description: 'Ống quần cẳng chân phải' },
    { id: 'foot-r', name: 'Giày da Oxford đen phải', nameEn: 'Right Oxford Shoe', role: 'foot-r', atlasCell: 22, boneId: 'bone-foot-r', defaultTransform: { x: 26, y: 192, z: 10, scale: 0.95, rotation: 0 }, suggestedAsset: BUSINESSMAN_ART.footR, description: 'Giày da Oxford đen bóng phải' }
  ],
  bones: MID_BONES,
  clips: MID_CLIPS,
  activeClipId: 'clip-firm-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D middle-aged businessman character with modular film disguise props.
IDENTITY: 45-year-old dignified male executive in charcoal tailored suit, white shirt and red silk tie, with detachable disguise accessories: bare unmasked face, mustache, wireframe glasses, fedora hat, leather briefcase, Oxford dress shoes.
VIEW: Front orthographic view, upright confident posture.
BACKGROUND: Uniform solid chroma-key background #00FF00.
CELLS:
1. Bare Head/Face (clean face, no glasses, no beard, no hat)
5. Fedora hat prop
6. Torso with suit jacket and red tie
7. Leather belt and hip waist
8. Left suit jacket arm
9. Right suit jacket arm
10. Detachable mustache / beard prop
11. Left forearm
12. Right forearm
13. Left hand with wristwatch
14. Right hand
15. Face mask / disguise bandana
16. Left tailored trouser thigh
17. Right tailored trouser thigh
18. Left trouser shin
19. Right trouser shin
20. Metal frame eyeglasses prop
21. Left Oxford dress shoe
22. Right Oxford dress shoe
24. Handheld leather briefcase prop
Overlapping concealed joint ends for clean cutout rotation and costume swapping.`,
    cellLayout: [
      '1. Mặt mộc trung niên',
      '5. Mũ phớt Fedora',
      '6. Áo vest & cà vạt',
      '7. Thắt lưng',
      '8. Bắp tay vest T',
      '9. Bắp tay vest P',
      '10. Râu mép doanh nhân',
      '11. Cẳng tay T',
      '12. Cẳng tay P',
      '13. Bàn tay & đồng hồ T',
      '14. Bàn tay P',
      '15. Khẩu trang / Mặt nạ',
      '16. Quần âu đùi T',
      '17. Quần âu đùi P',
      '18. Cẳng chân quần T',
      '19. Cẳng chân quần P',
      '20. Kính mắt gọng kim loại',
      '21. Giày tây Oxford T',
      '22. Giày tây Oxford P',
      '24. Cặp tài liệu da P'
    ],
    userGuide: 'Mẫu nhân vật trung niên công sở chuyên nghiệp: tách rời tay và chân, khuôn mặt mộc kèm các lớp kính mắt, râu mép, mũ phớt và cặp da đạo cụ có thể ẩn/hiện tuỳ ý.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_MIDDLEAGED_MAN, images, name)
}

// ---------------------------------------------------------------------------
// 5. Cụ Già / Ông Lão Tóc Bạc & Gậy Chống (Chậm rãi, Lưng khom hiền từ)
// ---------------------------------------------------------------------------

const OLD_BONES = createElderlyBones()
const OLD_CANE_WALK = generateElderlyCaneWalk(OLD_BONES, 2.4)
const OLD_IDLE = generateIdleBreathe(OLD_BONES, 2.8)

const OLD_CLIPS: AnimationClip[] = [
  { id: 'clip-cane-walk', name: 'Bước đi chống gậy (Cane Walk)', duration: 2.4, loop: true, presetKey: 'walk', tracks: OLD_CANE_WALK },
  { id: 'clip-idle', name: 'Đứng thở chậm rãi (Calm Idle)', duration: 2.8, loop: true, presetKey: 'idle', tracks: OLD_IDLE }
]

export const TMPL_ELDERLY_GRANDPA: LayerAssemblyTemplate = {
  id: 'tmpl-character-elderly-grandpa',
  name: 'Cụ Già / Ông Lão Tóc Bạc & Gậy Chống',
  nameEn: 'Elderly Senior / Wise Grandpa (Walking Cane & Long Beard)',
  category: 'character',
  ageGroup: 'elderly',
  description: 'Cụ già tóc bạc râu trắng hiền hậu: tách rời cẳng tay & bàn tay, cẳng chân & giày vải; mặt mộc già nua kèm các lớp chòm râu bạc, kính lão, mũ len và gậy ba toong đạo cụ.',
  descriptionEn: 'Elderly grandfather with separated hands, cloth shoes, and modular disguise props: bare wrinkled face, detachable long white beard, spectacles, beanie and wooden cane.',
  width: 500,
  height: 600,
  slots: [
    { id: 'head', name: 'Khuôn mặt mộc già nua', nameEn: 'Bare Wrinkled Face', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -12, y: -120, z: -25, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.head, description: 'Khuôn mặt nếp nhăn hiền từ, tóc bạc phơ, không dính râu hay kính' },
    { id: 'beard', name: 'Chòm râu trắng dài buông ngực', nameEn: 'Long White Beard Prop', role: 'beard', atlasCell: 10, boneId: 'bone-head', defaultTransform: { x: -12, y: -82, z: -30, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.beard, description: 'Chòm râu trắng dài hiền từ có thể tháo lắp hoá trang' },
    { id: 'glasses', name: 'Kính lão trễ sống mũi', nameEn: 'Reading Spectacles Prop', role: 'glasses', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: -12, y: -120, z: -32, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.glasses, description: 'Kính lão đọc sách gọng tròn trễ xuống sống mũi' },
    { id: 'mask', name: 'Khăn len quàng cổ / Khăn bịt', nameEn: 'Scarf / Face Cover Prop', role: 'mask', atlasCell: 15, boneId: 'bone-head', defaultTransform: { x: -10, y: -90, z: -34, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.mask, description: 'Khăn len quàng cổ giữ ấm hoặc khăn che mặt' },
    { id: 'hat', name: 'Mũ nồi len / Khăn xếp', nameEn: 'Knit Beanie / Cap', role: 'hat', atlasCell: 5, boneId: 'bone-head', defaultTransform: { x: -12, y: -152, z: -36, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.hat, description: 'Mũ len ấm áp đội trùm đầu' },
    { id: 'torso', name: 'Thân áo dài khom lưng', nameEn: 'Stooped Traditional Robe', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -6, y: -42, z: -10, scale: 0.95, rotation: 4 }, suggestedAsset: GRANDPA_ART.torso, description: 'Áo dài vải bông mộc mạc, dáng hơi gù lưng về trước' },
    { id: 'pelvis', name: 'Hông khom & Đai vải', nameEn: 'Hips & Cloth Sash', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: 0, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.pelvis, description: 'Hông áo dài và đai vải thắt eo' },
    { id: 'arm-l', name: 'Tay áo dài trái buông', nameEn: 'Left Robe Sleeve', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -40, y: -42, z: -18, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.armL, description: 'Tay áo dài thụng mộc mạc bên trái' },
    { id: 'forearm-l', name: 'Cẳng tay trái', nameEn: 'Left Forearm', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -42, y: 10, z: -28, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.forearmL, description: 'Cẳng tay gầy guộc bên trái' },
    { id: 'hand-l', name: 'Bàn tay trái gầy guộc', nameEn: 'Left Hand', role: 'hand-l', atlasCell: 13, boneId: 'bone-hand-l', defaultTransform: { x: -42, y: 48, z: -35, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.handL, description: 'Bàn tay gầy guộc của người cao tuổi bên trái' },
    { id: 'arm-r', name: 'Tay áo phải giữ gậy', nameEn: 'Right Arm on Cane', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 34, y: -42, z: -18, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.armR, description: 'Tay áo phải vươn giữ gậy chống' },
    { id: 'forearm-r', name: 'Cẳng tay phải', nameEn: 'Right Forearm', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 40, y: 12, z: -32, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.forearmR, description: 'Cẳng tay phải hướng về phía cây gậy' },
    { id: 'hand-r', name: 'Bàn tay phải nắm gậy', nameEn: 'Right Hand Gripping Cane', role: 'hand-r', atlasCell: 14, boneId: 'bone-hand-r', defaultTransform: { x: 42, y: 48, z: -38, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.handR, description: 'Bàn tay phải nắm chặt đầu cây gậy ba toong' },
    { id: 'prop-hand', name: 'Gậy ba toong gỗ uốn cong', nameEn: 'Wooden Walking Cane Prop', role: 'prop-hand', atlasCell: 24, boneId: 'bone-hand-r', defaultTransform: { x: 48, y: 122, z: -42, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.cane, description: 'Cây gậy ba toong gỗ uốn cong đạo cụ chống bước đi' },
    { id: 'thigh-l', name: 'Chân áo dài trái', nameEn: 'Left Leg in Robe', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -22, y: 75, z: 20, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.thighL, description: 'Chân trong tà áo dài bên trái' },
    { id: 'shin-l', name: 'Cẳng chân trái áo dài', nameEn: 'Left Shin in Robe', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -22, y: 145, z: 15, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.shinL, description: 'Cẳng chân áo dài bên trái' },
    { id: 'foot-l', name: 'Giày vải đen truyền thống trái', nameEn: 'Left Traditional Cloth Shoe', role: 'foot-l', atlasCell: 21, boneId: 'bone-foot-l', defaultTransform: { x: -24, y: 192, z: 10, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.footL, description: 'Giày vải đen truyền thống bên trái' },
    { id: 'thigh-r', name: 'Chân áo dài phải', nameEn: 'Right Leg in Robe', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 22, y: 75, z: 20, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.thighR, description: 'Chân trong tà áo dài bên phải' },
    { id: 'shin-r', name: 'Cẳng chân phải áo dài', nameEn: 'Right Shin in Robe', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 22, y: 145, z: 15, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.shinR, description: 'Cẳng chân áo dài bên phải' },
    { id: 'foot-r', name: 'Giày vải đen truyền thống phải', nameEn: 'Right Traditional Cloth Shoe', role: 'foot-r', atlasCell: 22, boneId: 'bone-foot-r', defaultTransform: { x: 24, y: 192, z: 10, scale: 0.95, rotation: 0 }, suggestedAsset: GRANDPA_ART.footR, description: 'Giày vải đen truyền thống bên phải' }
  ],
  bones: OLD_BONES,
  clips: OLD_CLIPS,
  activeClipId: 'clip-cane-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D elderly grandfather / senior character with modular disguise accessories.
IDENTITY: 75-year-old gentle wise grandfather with detachable accessories: bare wrinkled face, long white beard, round reading spectacles, knit beanie, brown traditional robe, black cloth shoes, gnarled wooden walking cane.
VIEW: Front orthographic view, standing with cane.
BACKGROUND: Flat opaque chroma-key magenta #FF00FF background.
CELLS:
1. Bare Head/Face (wrinkled gentle face, no beard, no glasses, no hat)
5. Knit beanie hat prop
6. Stooped traditional robe torso
7. Sash and hips
8. Left loose robe sleeve
9. Right robe arm
10. Long white flowing beard prop
11. Left forearm
12. Right forearm
13. Left weathered hand
14. Right hand gripping cane
15. Scarf / neck cover prop
16. Left robe leg thigh
17. Right robe leg thigh
18. Left robe shin
19. Right robe shin
20. Reading spectacles prop
21. Left traditional cloth shoe
22. Right traditional cloth shoe
24. Gnarled wooden walking cane prop
Concealed overlapping joint caps for smooth puppet animation and costume customization.`,
    cellLayout: [
      '1. Mặt mộc già nua',
      '5. Mũ nồi len',
      '6. Thân áo gù',
      '7. Hông đai vải',
      '8. Tay áo T',
      '9. Tay áo P',
      '10. Chòm râu trắng dài',
      '11. Cẳng tay T',
      '12. Cẳng tay P',
      '13. Bàn tay T',
      '14. Bàn tay P',
      '15. Khăn len quàng cổ',
      '16. Chân T',
      '17. Chân P',
      '18. Cẳng chân T',
      '19. Cẳng chân P',
      '20. Kính lão trễ mũi',
      '21. Giày vải T',
      '22. Giày vải P',
      '24. Gậy ba toong gỗ'
    ],
    userGuide: 'Mẫu cụ già tóc bạc chống gậy: tách rời tay và chân, khuôn mặt mộc kèm các lớp râu dài, kính lão, mũ len và gậy ba toong đạo cụ có thể ẩn/hiện tuỳ ý để hoá trang đóng phim.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ELDERLY_GRANDPA, images, name)
}

export const HUMANOID_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_MALE_HERO,
  TMPL_FEMALE_ANIME,
  TMPL_CHILD_KID,
  TMPL_MIDDLEAGED_MAN,
  TMPL_ELDERLY_GRANDPA
]
