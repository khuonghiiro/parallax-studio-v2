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
  description: 'Nhân vật nam thanh niên / hiệp sĩ chia 12 bộ phận chuẩn Atlas 5x5, tỉ lệ chuẩn 7.5 đầu, khớp nối vai/khuỷu/gối/cổ chân chồng lấp 15% tự nhiên.',
  descriptionEn: 'Adult male character with 12 cutout parts matching 5x5 sprite atlas standards, overlapping joints for 2.5D animation.',
  width: 500,
  height: 600,
  slots: [
    { id: 'head', name: 'Đầu & Khuôn mặt nam', nameEn: 'Head & Face', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -6, y: -159, z: -32, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/head.png', description: 'Khuôn mặt nam chính diện, bao gồm tai và cằm' },
    { id: 'torso', name: 'Thân & Áo giáp ngực', nameEn: 'Torso & Chest', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -38, z: -12, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/torso.png', description: 'Thân từ vai đến eo, có phần đầu nối cổ và hông' },
    { id: 'pelvis', name: 'Hông & Thắt lưng', nameEn: 'Pelvis & Belt', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 30, z: -18, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/pelvis.png', description: 'Hông và thắt lưng che đầu nối đùi' },
    { id: 'arm-l', name: 'Bắp tay & Giáp vai trái', nameEn: 'Left Upper Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -58, y: -36, z: -25, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/arm_l.png', description: 'Bắp tay trái với đầu tròn khớp vai' },
    { id: 'arm-r', name: 'Bắp tay & Giáp vai phải', nameEn: 'Right Upper Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 58, y: -36, z: -25, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/arm_r.png', description: 'Bắp tay phải với đầu tròn khớp vai' },
    { id: 'forearm-l', name: 'Cẳng tay & Găng trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -58, y: 32, z: -42, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/forearm_l.png', description: 'Cẳng tay và bàn tay trái' },
    { id: 'forearm-r', name: 'Cẳng tay & Găng phải', nameEn: 'Right Forearm & Hand', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 58, y: 32, z: -42, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/forearm_r.png', description: 'Cẳng tay và bàn tay phải' },
    { id: 'thigh-l', name: 'Đùi trái', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -29, y: 83, z: 0, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/thigh_l.png', description: 'Đùi trái từ hông đến đầu gối' },
    { id: 'thigh-r', name: 'Đùi phải', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 29, y: 83, z: 0, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/thigh_r.png', description: 'Đùi phải từ hông đến đầu gối' },
    { id: 'shin-l', name: 'Cẳng chân & Ủng trái', nameEn: 'Left Shin & Boot', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -30, y: 165, z: -5, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/shin_l.png', description: 'Cẳng chân và ủng trái' },
    { id: 'shin-r', name: 'Cẳng chân & Ủng phải', nameEn: 'Right Shin & Boot', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 30, y: 165, z: -5, scale: 0.5, rotation: 0 }, suggestedAsset: 'character_hero/v2/shin_r.png', description: 'Cẳng chân và ủng phải' }
  ],
  bones: HERO_BONES,
  clips: HERO_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Use the attached character image as the strict identity reference.
Create ONE high-resolution CHARACTER CUTOUT SPRITE ATLAS for 2D skeletal / 2.5D animation.
IDENTITY: Adult male warrior/hero, 7.5 heads athletic proportion, heroic demeanor.
VIEW: Strict FRONT ORTHOGRAPHIC view, neutral relaxed rest pose, limbs straight.
OUTPUT: Single square 4096x4096 PNG on flat OPAQUE green chroma-key background (#00FF00).
5x5 EQUAL CELLS:
Row 1: 1.Head/face (no neck/hair), 2.Neck, 3.Back hair/cape, 4.Front hair/helmet, 5.Head accessory
Row 2: 6.Torso/chestplate, 7.Pelvis/belt, 8.LEFT upper arm, 9.RIGHT upper arm, 10.Collar/scarf
Row 3: 11.LEFT forearm, 12.RIGHT forearm, 13.LEFT hand/glove, 14.RIGHT hand/glove, 15.Belt buckle
Row 4: 16.LEFT thigh, 17.RIGHT thigh, 18.LEFT shin, 19.RIGHT shin, 20.Sheath/weapon
Row 5: 21.LEFT boot/foot, 22.RIGHT boot/foot, 23.Left shoulder pad, 24.Right shoulder pad, 25.Cape
CRITICAL: Extend joints with rounded concealed overlapping ends (10-15% length). No hard seam lines. Shared pixel scale.`,
    cellLayout: ['1. Đầu/mặt', '2. Cổ', '3. Tóc sau', '4. Tóc trước', '6. Thân áo', '7. Hông', '8. Bắp tay T', '9. Bắp tay P', '11. Cẳng tay T', '12. Cẳng tay P', '16. Đùi T', '17. Đùi P', '18. Cẳng chân T', '19. Cẳng chân P'],
    userGuide: 'Tải ảnh atlas về, dùng công cụ tách nền xanh lá (#00FF00). Cắt các ô bộ phận tương ứng và kéo thả vào từng layer trong xưởng lắp ráp.'
  },
  buildComposite: (images = {}, nameOverride) => ({
    id: `comp-${crypto.randomUUID()}`,
    name: nameOverride || 'Nhân vật Nam Anh Hùng (Mẫu Atlas)',
    category: 'character',
    width: 500,
    height: 600,
    layers: TMPL_MALE_HERO.slots.map((s) => ({
      id: `layer-${s.id}`,
      name: s.name,
      boneId: s.boneId,
      bindingMode: s.bindingMode || 'rigid',
      assetPath: images[s.id] || (s.role ? images[s.role] : undefined) || s.suggestedAsset,
      x: s.defaultTransform.x,
      y: s.defaultTransform.y,
      z: s.defaultTransform.z,
      scale: s.defaultTransform.scale,
      rotation: s.defaultTransform.rotation,
      opacity: s.defaultTransform.opacity ?? 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    })),
    rig: {
      bones: HERO_BONES,
      duration: 1.6,
      loop: true,
      tracks: HERO_WALK,
      clips: HERO_CLIPS,
      activeClipId: 'clip-walk'
    }
  })
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
  name: 'Nữ Thiếu Nữ / Anime Girl (Tóc Buông & Váy Xếp Ly)',
  nameEn: 'Young Female / Anime Heroine (Sailor Outfit & Rigged Hair)',
  category: 'character',
  ageGroup: 'youth',
  description: 'Nữ sinh anime tóc dài buông xõa hai bên vai, đồng phục học sinh áo trắng nơ đỏ váy xếp ly, 12 bộ phận tách rời có lọn tóc sau và cặp sách.',
  descriptionEn: 'Young female anime character with flowing twin hair, sailor blouse, pleated skirt and 12 rigged cutout layers.',
  width: 500,
  height: 600,
  slots: [
    { id: 'hair-back', name: 'Tóc sau dài buông vai', nameEn: 'Back Hair', role: 'hair-back', atlasCell: 3, boneId: 'bone-torso', defaultTransform: { x: 0, y: -15, z: 50, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/hair_back.png', description: 'Khối tóc sau đầu mờ xa phía hậu cảnh' },
    { id: 'head', name: 'Đầu & Khuôn mặt nữ sinh', nameEn: 'Head & Face', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -130, z: -15, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/head.png', description: 'Khuôn mặt anime mắt to long lanh, tóc mái' },
    { id: 'torso', name: 'Áo đồng phục thủy thủ & Nơ', nameEn: 'Sailor Torso & Bow', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -42, z: 10, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/torso.png', description: 'Thân áo thủy thủ trắng kèm nơ đỏ' },
    { id: 'pelvis', name: 'Váy xếp ly học sinh & Hông', nameEn: 'Pleated Skirt & Pelvis', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 20, z: 0, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/pelvis.png', description: 'Váy xếp ly màu lam sẫm che khớp đùi' },
    { id: 'arm-l', name: 'Bắp tay áo phồng trái', nameEn: 'Left Upper Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -34, y: -42, z: -6, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/arm_l.png', description: 'Tay áo phồng học sinh bên trái' },
    { id: 'forearm-l', name: 'Cẳng tay & Bàn tay trái', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -36, y: 8, z: -25, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/forearm_l.png', description: 'Cẳng tay trắng thon thả' },
    { id: 'arm-r', name: 'Bắp tay áo phồng phải', nameEn: 'Right Upper Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 34, y: -42, z: -6, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/arm_r.png', description: 'Tay áo phồng học sinh bên phải' },
    { id: 'forearm-r', name: 'Cẳng tay & Cặp sách phải', nameEn: 'Right Forearm & Bag', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 36, y: 8, z: -25, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/forearm_r.png', description: 'Cẳng tay phải cầm cặp sách đi học' },
    { id: 'thigh-l', name: 'Đùi trái mang tất dài', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -22, y: 68, z: 35, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/thigh_l.png', description: 'Đùi trái mang tất đùi đen' },
    { id: 'shin-l', name: 'Cẳng chân & Giày học sinh trái', nameEn: 'Left Shin & Loafer', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -22, y: 142, z: 22, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/shin_l.png', description: 'Cẳng chân và giày da đen học sinh trái' },
    { id: 'thigh-r', name: 'Đùi phải mang tất dài', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 22, y: 68, z: 35, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/thigh_r.png', description: 'Đùi phải mang tất đùi đen' },
    { id: 'shin-r', name: 'Cẳng chân & Giày học sinh phải', nameEn: 'Right Shin & Loafer', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 22, y: 142, z: 22, scale: 1.0, rotation: 0 }, suggestedAsset: 'character_anime/shin_r.png', description: 'Cẳng chân và giày da đen học sinh phải' }
  ],
  bones: ANIME_BONES,
  clips: ANIME_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for 2D anime girl skeletal animation.
IDENTITY: Young anime schoolgirl, silver hair, gentle smiling expression, sailor uniform with red ribbon bow and navy pleated skirt, black thigh-high socks, brown loafers.
VIEW: Front orthographic view, calm relaxed standing rest pose, arms at sides.
BACKGROUND: Uniform flat opaque chroma-key magenta #FF00FF background.
CELLS:
Row 1: 1.Face & head without hair, 2.Neck, 3.Long flowing back hair silhouette, 4.Front bangs, 5.Hair bow
Row 2: 6.Sailor blouse with red bow, 7.Pleated navy skirt & hips, 8.Left puffy sleeve, 9.Right puffy sleeve, 10.School necktie
Row 3: 11.Left slender forearm, 12.Right forearm with school bag, 13.Left hand, 14.Right hand, 15.Hair ribbon
Row 4: 16.Left thigh with black stocking, 17.Right thigh with black stocking, 18.Left shin with school loafer, 19.Right shin with school loafer, 20.Side hair lock
Hidden rounded overlaps at joints (10-15%). Clear silhouette edges, no color bleed.`,
    cellLayout: ['1. Mặt anime', '3. Tóc sau dài', '6. Thân áo thủy thủ', '7. Váy xếp ly', '8. Tay áo T', '9. Tay áo P', '11. Cẳng tay T', '12. Cẳng tay P', '16. Đùi tất T', '17. Đùi tất P', '18. Chân giày T', '19. Chân giày P'],
    userGuide: 'Lưu ảnh sprite atlas với phông hồng tím (#FF00FF), loại bỏ nền trong suốt rồi gắn từng bộ phận vào xưởng lắp ráp.'
  },
  buildComposite: (images = {}, nameOverride) => ({
    id: `comp-${crypto.randomUUID()}`,
    name: nameOverride || 'Nữ Sinh Anime Tóc Bạch Kim (Mẫu Lắp Ráp)',
    category: 'character',
    width: 500,
    height: 600,
    layers: TMPL_FEMALE_ANIME.slots.map((s) => ({
      id: `layer-${s.id}`,
      name: s.name,
      boneId: s.boneId,
      bindingMode: s.bindingMode || 'rigid',
      assetPath: images[s.id] || (s.role ? images[s.role] : undefined) || s.suggestedAsset,
      x: s.defaultTransform.x,
      y: s.defaultTransform.y,
      z: s.defaultTransform.z,
      scale: s.defaultTransform.scale,
      rotation: s.defaultTransform.rotation,
      opacity: s.defaultTransform.opacity ?? 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    })),
    rig: {
      bones: ANIME_BONES,
      duration: 1.6,
      loop: true,
      tracks: ANIME_WALK,
      clips: ANIME_CLIPS,
      activeClipId: 'clip-walk'
    }
  })
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
    { id: 'head', name: 'Đầu to tròn & Mũ lưỡi trai', nameEn: 'Chibi Head & Cap', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -90, z: -15, scale: 0.9, rotation: 0 }, description: 'Đầu tròn to, má phính hồng hào, mũ lưỡi trai' },
    { id: 'torso', name: 'Thân áo thun trẻ em', nameEn: 'Child T-Shirt Torso', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -20, z: 0, scale: 0.9, rotation: 0 }, description: 'Áo thun sọc ngắn trẻ em' },
    { id: 'pelvis', name: 'Quần yếm bò dễ thương', nameEn: 'Denim Overalls & Hips', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: -5, scale: 0.9, rotation: 0 }, description: 'Quần yếm ngắn bò xanh có túi' },
    { id: 'arm-l', name: 'Tay áo trái bụ bẫm', nameEn: 'Left Chubby Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -30, y: -25, z: -10, scale: 0.9, rotation: 0 }, description: 'Cánh tay tròn ngắn bụ bẫm bên trái' },
    { id: 'arm-r', name: 'Tay áo phải bụ bẫm', nameEn: 'Right Chubby Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 30, y: -25, z: -10, scale: 0.9, rotation: 0 }, description: 'Cánh tay tròn ngắn bụ bẫm bên phải' },
    { id: 'thigh-l', name: 'Chân trái ngắn & Giày thể thao', nameEn: 'Left Leg & Sneaker', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -20, y: 70, z: 10, scale: 0.9, rotation: 0 }, description: 'Chân ngắn bụ bẫm và giày đỏ bên trái' },
    { id: 'thigh-r', name: 'Chân phải ngắn & Giày thể thao', nameEn: 'Right Leg & Sneaker', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 20, y: 70, z: 10, scale: 0.9, rotation: 0 }, description: 'Chân ngắn bụ bẫm và giày đỏ bên phải' }
  ],
  bones: CHILD_BONES,
  clips: CHILD_CLIPS,
  activeClipId: 'clip-toddle',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D cute toddler / child character.
IDENTITY: 5-year-old child, chibi proportions (3.5 heads tall), oversized round head with chubby cheeks, backwards baseball cap, colorful striped t-shirt and blue denim overalls, small red sneakers.
VIEW: Front orthographic view, relaxed friendly pose, short chubby limbs.
BACKGROUND: Solid flat cyan chroma-key background #00FFFF.
CELLS:
1. Head and cap (large round silhouette, cheerful big eyes)
2. Torso with striped tee
3. Denim overalls hip section
4. Left chubby arm with small hand
5. Right chubby arm with small hand
6. Left short leg with red sneaker
7. Right short leg with red sneaker
8. Backpack / stuffed animal toy accessory
Overlapping rounded joint caps for smooth puppet animation.`,
    cellLayout: ['1. Đầu chibi & mũ', '2. Thân áo sọc', '3. Quần yếm bò', '4. Tay trái bụ bẫm', '5. Tay phải bụ bẫm', '6. Chân & giày trái', '7. Chân & giày phải'],
    userGuide: 'Prompt tạo tỉ lệ chibi 3.5 đầu dễ thương, tách nền cyan (#00FFFF) và ráp vào các khớp ngắn của trẻ em.'
  },
  buildComposite: (images = {}, nameOverride) => ({
    id: `comp-${crypto.randomUUID()}`,
    name: nameOverride || 'Bé Trai Chibi (Mẫu Lắp Ráp)',
    category: 'character',
    width: 450,
    height: 520,
    layers: TMPL_CHILD_KID.slots.map((s) => ({
      id: `layer-${s.id}`,
      name: s.name,
      boneId: s.boneId,
      bindingMode: 'rigid',
      assetPath: images[s.id] || (s.role ? images[s.role] : undefined) || s.suggestedAsset,
      x: s.defaultTransform.x,
      y: s.defaultTransform.y,
      z: s.defaultTransform.z,
      scale: s.defaultTransform.scale,
      rotation: s.defaultTransform.rotation,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    })),
    rig: {
      bones: CHILD_BONES,
      duration: 1.1,
      loop: true,
      tracks: CHILD_TODDLE,
      clips: CHILD_CLIPS,
      activeClipId: 'clip-toddle'
    }
  })
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
  description: 'Nhân vật nam trung niên tầm 45 tuổi, nét mặt chín chắn, kính mắt lịch thiệp, âu phục vest xám cà vạt đỏ, bước đi đĩnh đạc tự tin.',
  descriptionEn: 'Middle-aged businessman in tailored charcoal suit, glasses, dignified posture and firm professional stride.',
  width: 500,
  height: 600,
  slots: [
    { id: 'head', name: 'Đầu & Kính mắt trung niên', nameEn: 'Mature Head & Glasses', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -135, z: -20, scale: 0.95, rotation: 0 }, description: 'Khuôn mặt trung niên chín chắn, tóc chải ngược, đeo kính mắt' },
    { id: 'torso', name: 'Áo Vest âu & Cà vạt đỏ', nameEn: 'Suit Jacket & Red Tie', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: 0, y: -40, z: -5, scale: 0.95, rotation: 0 }, description: 'Áo vest xám cắt may chỉn chu, sơ mi trắng và cà vạt đỏ' },
    { id: 'pelvis', name: 'Hông thắt lưng da', nameEn: 'Hips & Leather Belt', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: 0, scale: 0.95, rotation: 0 }, description: 'Thắt lưng da khóa kim loại và phần trên quần âu' },
    { id: 'arm-l', name: 'Tay áo vest trái', nameEn: 'Left Suit Arm', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -38, y: -40, z: -15, scale: 0.95, rotation: 0 }, description: 'Cánh tay áo vest trái' },
    { id: 'forearm-l', name: 'Cẳng tay sơ mi & Bàn tay T', nameEn: 'Left Forearm & Hand', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -40, y: 15, z: -25, scale: 0.95, rotation: 0 }, description: 'Cẳng tay trái đeo đồng hồ kim loại' },
    { id: 'arm-r', name: 'Tay áo vest phải', nameEn: 'Right Suit Arm', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 38, y: -40, z: -15, scale: 0.95, rotation: 0 }, description: 'Cánh tay áo vest phải' },
    { id: 'forearm-r', name: 'Cẳng tay & Cặp da công sở', nameEn: 'Right Forearm & Briefcase', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 40, y: 15, z: -25, scale: 0.95, rotation: 0 }, description: 'Cẳng tay phải xách cặp tài liệu da' },
    { id: 'thigh-l', name: 'Quần âu đùi trái', nameEn: 'Left Trousers Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -24, y: 75, z: 20, scale: 0.95, rotation: 0 }, description: 'Ống quần âu ủi ly phẳng phiu trái' },
    { id: 'shin-l', name: 'Cẳng chân & Giày tây trái', nameEn: 'Left Shin & Oxford Shoe', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -24, y: 145, z: 15, scale: 0.95, rotation: 0 }, description: 'Ống quần và giày da Oxford đen trái' },
    { id: 'thigh-r', name: 'Quần âu đùi phải', nameEn: 'Right Trousers Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 24, y: 75, z: 20, scale: 0.95, rotation: 0 }, description: 'Ống quần âu ủi ly phẳng phiu phải' },
    { id: 'shin-r', name: 'Cẳng chân & Giày tây phải', nameEn: 'Right Shin & Oxford Shoe', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 24, y: 145, z: 15, scale: 0.95, rotation: 0 }, description: 'Ống quần và giày da Oxford đen phải' }
  ],
  bones: MID_BONES,
  clips: MID_CLIPS,
  activeClipId: 'clip-firm-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D middle-aged businessman character.
IDENTITY: 45-year-old dignified male executive, neat combed hair with slight silver at temples, stylish glasses, sharp charcoal gray suit, crisp white dress shirt, crimson tie, leather belt, polished black oxford shoes, leather briefcase.
VIEW: Front orthographic view, upright confident posture.
BACKGROUND: Uniform solid chroma-key background #00FF00.
CELLS:
1. Head, neat hair and glasses
2. Suit torso with red tie
3. Leather belt and hip waist
4. Left suit jacket arm
5. Right suit jacket arm
6. Left forearm with wristwatch
7. Right forearm holding leather briefcase
8. Left tailored trouser leg (thigh)
9. Right tailored trouser leg (thigh)
10. Left shoe and shin
11. Right shoe and shin
Overlapping concealed joint ends for clean cutout rotation.`,
    cellLayout: ['1. Đầu & kính mắt', '2. Áo vest & cà vạt', '3. Thắt lưng', '4. Tay vest T', '5. Tay vest P', '6. Cẳng tay T', '7. Cặp da P', '8. Quần âu T', '9. Quần âu P', '10. Giày tây T', '11. Giày tây P'],
    userGuide: 'Mẫu nhân vật trung niên công sở chuyên nghiệp, phông xanh lá (#00FF00), các chi tiết vest và cà vạt đồng bộ.'
  },
  buildComposite: (images = {}, nameOverride) => ({
    id: `comp-${crypto.randomUUID()}`,
    name: nameOverride || 'Người Trung Niên Công Sở (Mẫu Lắp Ráp)',
    category: 'character',
    width: 500,
    height: 600,
    layers: TMPL_MIDDLEAGED_MAN.slots.map((s) => ({
      id: `layer-${s.id}`,
      name: s.name,
      boneId: s.boneId,
      bindingMode: 'rigid',
      assetPath: images[s.id] || (s.role ? images[s.role] : undefined) || s.suggestedAsset,
      x: s.defaultTransform.x,
      y: s.defaultTransform.y,
      z: s.defaultTransform.z,
      scale: s.defaultTransform.scale,
      rotation: s.defaultTransform.rotation,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    })),
    rig: {
      bones: MID_BONES,
      duration: 1.8,
      loop: true,
      tracks: MID_WALK,
      clips: MID_CLIPS,
      activeClipId: 'clip-firm-walk'
    }
  })
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
  description: 'Cụ già tóc bạc râu trắng dài hiền hậu, dáng người hơi khom lưng (stooped posture), áo dài truyền thống mộc mạc và cây gậy chống ba toong gỗ.',
  descriptionEn: 'Elderly grandfather with long white beard, wrinkles, stooped posture, traditional robe and wooden walking cane.',
  width: 500,
  height: 600,
  slots: [
    { id: 'head', name: 'Đầu tóc bạc & Râu dài trắng', nameEn: 'White-Haired Head & Beard', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -16, y: -130, z: -25, scale: 0.95, rotation: 0 }, description: 'Khuôn mặt nếp nhăn hiền từ, tóc bạc phơ, râu dài trắng buông ngực' },
    { id: 'torso', name: 'Thân áo dài khom lưng', nameEn: 'Stooped Traditional Robe', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -8, y: -45, z: -10, scale: 0.95, rotation: 5 }, description: 'Áo dài vải bông mộc mạc, dáng hơi gù lưng về trước' },
    { id: 'pelvis', name: 'Hông khom & Đai vải', nameEn: 'Hips & Cloth Sash', role: 'pelvis', atlasCell: 7, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 25, z: 0, scale: 0.95, rotation: 0 }, description: 'Hông áo dài và đai vải thắt eo' },
    { id: 'arm-l', name: 'Tay áo dài trái buông', nameEn: 'Left Robe Sleeve', role: 'arm-l', atlasCell: 8, boneId: 'bone-arm-l', defaultTransform: { x: -40, y: -45, z: -18, scale: 0.95, rotation: 0 }, description: 'Tay áo dài thụng mộc mạc bên trái' },
    { id: 'forearm-l', name: 'Cẳng tay trái', nameEn: 'Left Forearm', role: 'forearm-l', atlasCell: 11, boneId: 'bone-forearm-l', defaultTransform: { x: -42, y: 10, z: -28, scale: 0.95, rotation: 0 }, description: 'Bàn tay gầy guộc hiền từ bên trái' },
    { id: 'arm-r', name: 'Tay áo phải giữ gậy', nameEn: 'Right Arm on Cane', role: 'arm-r', atlasCell: 9, boneId: 'bone-arm-r', defaultTransform: { x: 30, y: -45, z: -18, scale: 0.95, rotation: 0 }, description: 'Tay áo phải vươn giữ gậy chống' },
    { id: 'forearm-r', name: 'Cẳng tay & Gậy ba toong gỗ', nameEn: 'Right Hand & Wooden Cane', role: 'forearm-r', atlasCell: 12, boneId: 'bone-forearm-r', defaultTransform: { x: 42, y: 15, z: -35, scale: 0.95, rotation: 0 }, description: 'Bàn tay nắm chặt đầu cây gậy ba toong gỗ uốn cong' },
    { id: 'thigh-l', name: 'Chân áo dài trái', nameEn: 'Left Leg in Robe', role: 'thigh-l', atlasCell: 16, boneId: 'bone-thigh-l', defaultTransform: { x: -22, y: 75, z: 20, scale: 0.95, rotation: 0 }, description: 'Chân trong tà áo dài bên trái' },
    { id: 'shin-l', name: 'Cẳng chân & Giày vải cổ trái', nameEn: 'Left Shin & Cloth Shoe', role: 'shin-l', atlasCell: 18, boneId: 'bone-shin-l', defaultTransform: { x: -22, y: 145, z: 15, scale: 0.95, rotation: 0 }, description: 'Giày vải đen truyền thống bên trái' },
    { id: 'thigh-r', name: 'Chân áo dài phải', nameEn: 'Right Leg in Robe', role: 'thigh-r', atlasCell: 17, boneId: 'bone-thigh-r', defaultTransform: { x: 22, y: 75, z: 20, scale: 0.95, rotation: 0 }, description: 'Chân trong tà áo dài bên phải' },
    { id: 'shin-r', name: 'Cẳng chân & Giày vải cổ phải', nameEn: 'Right Shin & Cloth Shoe', role: 'shin-r', atlasCell: 19, boneId: 'bone-shin-r', defaultTransform: { x: 22, y: 145, z: 15, scale: 0.95, rotation: 0 }, description: 'Giày vải đen truyền thống bên phải' }
  ],
  bones: OLD_BONES,
  clips: OLD_CLIPS,
  activeClipId: 'clip-cane-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 CHARACTER CUTOUT SPRITE ATLAS for a 2D elderly grandfather / senior character.
IDENTITY: 75-year-old gentle wise grandfather, flowing long white beard and mustache, gentle wrinkled face, slightly stooped posture, rustic earthen-colored traditional robe with cloth sash, rustic cloth shoes, gnarled wooden walking cane.
VIEW: Front 3/4 orthographic view, standing with cane.
BACKGROUND: Flat opaque chroma-key magenta #FF00FF background.
CELLS:
1. Head, wrinkles and long white beard
2. Stooped traditional robe torso
3. Sash and hips
4. Left loose robe sleeve
5. Right robe arm
6. Left weathered hand
7. Right hand firmly grasping curved wooden cane
8. Left robe leg
9. Right robe leg
10. Left traditional cloth shoe
11. Right traditional cloth shoe
Concealed overlapping joint caps for smooth puppet animation.`,
    cellLayout: ['1. Đầu & râu trắng', '2. Thân áo gù', '3. Hông đai vải', '4. Tay áo T', '5. Tay áo P', '6. Bàn tay T', '7. Bàn tay & gậy chống P', '8. Chân T', '9. Chân P', '10. Giày vải T', '11. Giày vải P'],
    userGuide: 'Mẫu cụ già tóc bạc chống gậy, tách nền hồng tím (#FF00FF). Hoạt ảnh bước đi chậm rãi run run cùng nhịp gậy gõ đất.'
  },
  buildComposite: (images = {}, nameOverride) => ({
    id: `comp-${crypto.randomUUID()}`,
    name: nameOverride || 'Cụ Già Tóc Bạc & Gậy Chống (Mẫu Lắp Ráp)',
    category: 'character',
    width: 500,
    height: 600,
    layers: TMPL_ELDERLY_GRANDPA.slots.map((s) => ({
      id: `layer-${s.id}`,
      name: s.name,
      boneId: s.boneId,
      bindingMode: 'rigid',
      assetPath: images[s.id] || (s.role ? images[s.role] : undefined) || s.suggestedAsset,
      x: s.defaultTransform.x,
      y: s.defaultTransform.y,
      z: s.defaultTransform.z,
      scale: s.defaultTransform.scale,
      rotation: s.defaultTransform.rotation,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    })),
    rig: {
      bones: OLD_BONES,
      duration: 2.4,
      loop: true,
      tracks: OLD_CANE_WALK,
      clips: OLD_CLIPS,
      activeClipId: 'clip-cane-walk'
    }
  })
}

export const HUMANOID_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_MALE_HERO,
  TMPL_FEMALE_ANIME,
  TMPL_CHILD_KID,
  TMPL_MIDDLEAGED_MAN,
  TMPL_ELDERLY_GRANDPA
]
