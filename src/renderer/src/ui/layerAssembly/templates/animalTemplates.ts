import { createTemplateComposite } from './templateBuilder'
import type { AnimationClip } from '@shared/layerRig'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import {
  createQuadrupedBones,
  generateQuadrupedWalk,
  generateQuadrupedWagTail,
  createFishBones,
  generateFishSwim,
  generateFishFloat,
  createBirdBones,
  generateBirdPeckWalk,
  generateBirdWingFlap
} from './creatureRigPresets'

// ---------------------------------------------------------------------------
// 1. Động Vật 4 Chân — Chó Cưng Shiba / Corgi (Vẫy Đuôi & Bước Đi)
// ---------------------------------------------------------------------------

const DOG_BONES = createQuadrupedBones()
const DOG_WALK = generateQuadrupedWalk(DOG_BONES, 1.3)
const DOG_WAG = generateQuadrupedWagTail(DOG_BONES, 0.9)

const DOG_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Lon ton 4 chân (Walk)', duration: 1.3, loop: true, presetKey: 'walk', tracks: DOG_WALK },
  { id: 'clip-wag', name: 'Vẫy đuôi mừng rỡ (Wag Tail)', duration: 0.9, loop: true, presetKey: 'wave', tracks: DOG_WAG }
]

export const TMPL_ANIMAL_DOG: LayerAssemblyTemplate = {
  id: 'tmpl-animal-dog',
  name: 'Động Vật 4 Chân — Chó Shiba Vàng (Vẫy Đuôi & Bước Đi)',
  nameEn: 'Quadruped — Golden Shiba Pet Dog (Wagging Tail & Trot)',
  category: 'animal',
  ageGroup: 'quadruped',
  description:
    'Mẫu động vật 4 chân bóc tách chuẩn: đầu & mõm, tai vểnh tách rời, thân mình đeo vòng cổ đỏ, đuôi bông xù vẫy mừng và 4 chân chia khớp đùi – cẳng bàn chân đối xứng xa/gần.',
  descriptionEn:
    'Full quadruped canine cutout rig with head, isolated ear, body torso, wagging tail and 4 independent 2-joint limbs.',
  width: 520,
  height: 480,
  slots: [
    { id: 'leg-fr-thigh', name: 'Đùi trước phải (Chân xa)', nameEn: 'Front-Right Thigh (Far)', role: 'thigh', atlasCell: 7, boneId: 'bone-leg-fr-thigh', defaultTransform: { x: -46, y: 40, z: 30, scale: 0.44, rotation: 0 }, suggestedAsset: 'animal_modular/dog_front_thigh_far.png', description: 'Đùi chân trước phía xa (tông trầm tạo chiều sâu)' },
    { id: 'leg-fr-shin', name: 'Cẳng bàn chân trước phải (Chân xa)', nameEn: 'Front-Right Shin & Paw (Far)', role: 'shin', atlasCell: 8, boneId: 'bone-leg-fr-shin', defaultTransform: { x: -50, y: 98, z: 25, scale: 0.44, rotation: 0 }, suggestedAsset: 'animal_modular/dog_front_shin_far.png', description: 'Cẳng chân và bàn đệm trước phía xa' },
    { id: 'leg-br-thigh', name: 'Đùi sau phải (Chân xa)', nameEn: 'Back-Right Thigh (Far)', role: 'thigh', atlasCell: 11, boneId: 'bone-leg-br-thigh', defaultTransform: { x: 48, y: 36, z: 20, scale: 0.45, rotation: 0 }, suggestedAsset: 'animal_modular/dog_hind_thigh_far.png', description: 'Đùi chân sau phía xa' },
    { id: 'leg-br-shin', name: 'Cẳng bàn chân sau phải (Chân xa)', nameEn: 'Back-Right Shin & Paw (Far)', role: 'shin', atlasCell: 12, boneId: 'bone-leg-br-shin', defaultTransform: { x: 52, y: 98, z: 15, scale: 0.44, rotation: 0 }, suggestedAsset: 'animal_modular/dog_hind_shin_far.png', description: 'Cẳng chân và bàn đệm sau phía xa' },
    { id: 'tail', name: 'Đuôi bông xù vẫy mừng', nameEn: 'Wagging Bushy Tail', role: 'tail', atlasCell: 4, boneId: 'bone-tail', defaultTransform: { x: 96, y: -38, z: 10, scale: 0.48, rotation: 0 }, suggestedAsset: 'animal_modular/dog_tail.png', description: 'Đuôi cong bông xù gắn khớp đuôi' },
    { id: 'torso', name: 'Thân mình & Vòng cổ đỏ', nameEn: 'Dog Body Torso & Collar', role: 'torso', atlasCell: 3, boneId: 'bone-torso', defaultTransform: { x: 0, y: 4, z: 0, scale: 0.66, rotation: 0 }, suggestedAsset: 'animal_modular/dog_torso.png', description: 'Khối thân ngực và bụng gắn vòng cổ đỏ' },
    { id: 'leg-bl-thigh', name: 'Đùi sau trái (Chân gần)', nameEn: 'Back-Left Thigh (Near)', role: 'thigh', atlasCell: 9, boneId: 'bone-leg-bl-thigh', defaultTransform: { x: 64, y: 40, z: -10, scale: 0.48, rotation: 0 }, suggestedAsset: 'animal_modular/dog_hind_thigh_near.png', description: 'Đùi chân sau phía gần người xem' },
    { id: 'leg-bl-shin', name: 'Cẳng bàn chân sau trái (Chân gần)', nameEn: 'Back-Left Shin & Paw (Near)', role: 'shin', atlasCell: 10, boneId: 'bone-leg-bl-shin', defaultTransform: { x: 68, y: 104, z: -15, scale: 0.46, rotation: 0 }, suggestedAsset: 'animal_modular/dog_hind_shin_near.png', description: 'Cẳng chân và bàn đệm sau phía gần' },
    { id: 'leg-fl-thigh', name: 'Đùi trước trái (Chân gần)', nameEn: 'Front-Left Thigh (Near)', role: 'thigh', atlasCell: 5, boneId: 'bone-leg-fl-thigh', defaultTransform: { x: -64, y: 44, z: -20, scale: 0.46, rotation: 0 }, suggestedAsset: 'animal_modular/dog_front_thigh_near.png', description: 'Đùi chân trước phía gần người xem' },
    { id: 'leg-fl-shin', name: 'Cẳng bàn chân trước trái (Chân gần)', nameEn: 'Front-Left Shin & Paw (Near)', role: 'shin', atlasCell: 6, boneId: 'bone-leg-fl-shin', defaultTransform: { x: -68, y: 104, z: -25, scale: 0.46, rotation: 0 }, suggestedAsset: 'animal_modular/dog_front_shin_near.png', description: 'Cẳng chân và bàn đệm trước phía gần' },
    { id: 'head', name: 'Đầu & Mõm chó Shiba', nameEn: 'Dog Head & Snout', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -92, y: -48, z: -30, scale: 0.56, rotation: 0 }, suggestedAsset: 'animal_modular/dog_head.png', description: 'Đầu chó góc nhìn nghiêng, mắt sáng, má phúng phính' },
    { id: 'ear-l', name: 'Tai chó vểnh (Rung rinh)', nameEn: 'Pointed Dog Ear', role: 'ear', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: -74, y: -96, z: -35, scale: 0.38, rotation: 0 }, suggestedAsset: 'animal_modular/dog_ear.png', description: 'Tai chó tách rời để cử động khi chạy nhảy' }
  ],
  bones: DOG_BONES,
  clips: DOG_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D quadruped dog animation.
IDENTITY: Stylized 2D animated Golden Shiba / Corgi pet dog, cheerful expression, warm golden coat, red collar.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left, natural standing rest pose, vertical straight leg segments.
BACKGROUND: Uniform solid chroma-key background #00FF00.`,
    cellLayout: [],
    userGuide:
      'Mẫu động vật 4 chân góc nghiêng chuẩn hoạt hình 2D. Các khớp chân trước/sau phân tách rõ chân gần và chân xa có đổ bóng chiều sâu 2.5D.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_DOG, images, name)
}

// ---------------------------------------------------------------------------
// 2. Gia Cầm / Chim Muông — Gà Trống Đại Cảnh (Vỗ Cánh & Mổ Thóc)
// ---------------------------------------------------------------------------

const ROOSTER_BONES = createBirdBones()
const ROOSTER_WALK = generateBirdPeckWalk(ROOSTER_BONES, 1.4)
const ROOSTER_FLAP = generateBirdWingFlap(ROOSTER_BONES, 0.8)

const ROOSTER_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Bước đi mổ thóc (Peck Walk)', duration: 1.4, loop: true, presetKey: 'walk', tracks: ROOSTER_WALK },
  { id: 'clip-flap', name: 'Vỗ cánh gáy vang (Wing Flap)', duration: 0.8, loop: true, presetKey: 'action', tracks: ROOSTER_FLAP }
]

export const TMPL_ANIMAL_ROOSTER: LayerAssemblyTemplate = {
  id: 'tmpl-animal-rooster',
  name: 'Gia Cầm / Chim Muông — Gà Trống Ngũ Sắc (Vỗ Cánh & Mổ Thóc)',
  nameEn: 'Avian — Colorful Rooster (Wing Flap & Pecking Walk)',
  category: 'animal',
  ageGroup: 'avian',
  description:
    'Mẫu gia cầm / chim chóc 2 chân: đầu mào đỏ rực, thân ức tròn đầy, đôi cánh vỗ nhịp nhàng, chùm lông đuôi cong ngũ sắc và 2 chân bước đi mổ thóc.',
  descriptionEn:
    'Avian 2-legged rooster rig with red comb head, plump breast body, flapping wings, arching tail plume and walking legs.',
  width: 480,
  height: 480,
  slots: [
    { id: 'wing-r', name: 'Cánh phải (Bên xa)', nameEn: 'Right Wing (Far)', role: 'wing', atlasCell: 4, boneId: 'bone-bird-wing-r', defaultTransform: { x: -16, y: -12, z: 25, scale: 0.48, rotation: 0 }, suggestedAsset: 'animal_modular/bird_wing_far.png', description: 'Cánh phía xa tạo chiều sâu khi vỗ cánh' },
    { id: 'leg-r', name: 'Chân & Móng phải (Chân xa)', nameEn: 'Right Leg & Talons (Far)', role: 'shin', atlasCell: 7, boneId: 'bone-bird-thigh-r', defaultTransform: { x: 10, y: 84, z: 20, scale: 0.44, rotation: 0 }, suggestedAsset: 'animal_modular/bird_leg_far.png', description: 'Chân vàng phía xa bước đi so le' },
    { id: 'tail', name: 'Chùm lông đuôi cong ngũ sắc', nameEn: 'Iridescent Tail Plume', role: 'tail', atlasCell: 5, boneId: 'bone-bird-tail', defaultTransform: { x: 76, y: -20, z: 10, scale: 0.56, rotation: 0 }, suggestedAsset: 'animal_modular/bird_tail.png', description: 'Chùm lông đuôi dài cong vút' },
    { id: 'body', name: 'Thân & Ức gà trống', nameEn: 'Plump Bird Body & Breast', role: 'torso', atlasCell: 2, boneId: 'bone-bird-body', defaultTransform: { x: 0, y: 12, z: 0, scale: 0.58, rotation: 0 }, suggestedAsset: 'animal_modular/bird_torso.png', description: 'Thân mình và bộ lông ngực óng ả' },
    { id: 'leg-l', name: 'Chân & Móng trái (Chân gần)', nameEn: 'Left Leg & Talons (Near)', role: 'shin', atlasCell: 6, boneId: 'bone-bird-thigh-l', defaultTransform: { x: -14, y: 88, z: -10, scale: 0.46, rotation: 0 }, suggestedAsset: 'animal_modular/bird_leg_near.png', description: 'Chân vàng phía gần người xem' },
    { id: 'head', name: 'Đầu gà, Mào đỏ & Mỏ vàng', nameEn: 'Rooster Head, Comb & Beak', role: 'head', atlasCell: 1, boneId: 'bone-bird-head', defaultTransform: { x: -56, y: -56, z: -20, scale: 0.50, rotation: 0 }, suggestedAsset: 'animal_modular/bird_head.png', description: 'Đầu gà mào đỏ rực rỡ gắn khớp cổ mổ thóc' },
    { id: 'wing-l', name: 'Cánh trái (Bên gần)', nameEn: 'Left Wing (Near)', role: 'wing', atlasCell: 3, boneId: 'bone-bird-wing-l', defaultTransform: { x: 4, y: 4, z: -30, scale: 0.52, rotation: 0 }, suggestedAsset: 'animal_modular/bird_wing_near.png', description: 'Cánh lớn phía gần vỗ mạnh mẽ' }
  ],
  bones: ROOSTER_BONES,
  clips: ROOSTER_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D avian rooster/bird animation.
IDENTITY: Proud colorful rooster with bright red comb, golden-amber and emerald plumage, sweeping tail feathers.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left.
BACKGROUND: Uniform solid chroma-key background #00FF00.`,
    cellLayout: [],
    userGuide:
      'Mẫu gia cầm / chim muông 2 chân chuẩn hoạt hình: chuyển động gật đầu mổ thóc và vỗ cánh tự nhiên.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_ROOSTER, images, name)
}

// ---------------------------------------------------------------------------
// 3. Thủy Sinh — Cá Chép Koi Kohaku (Uốn Lượn & Bơi Lội)
// ---------------------------------------------------------------------------

const FISH_BONES = createFishBones()
const FISH_SWIM = generateFishSwim(FISH_BONES, 1.5)
const FISH_FLOAT = generateFishFloat(FISH_BONES, 2.4)

const FISH_CLIPS: AnimationClip[] = [
  { id: 'clip-swim', name: 'Bơi uốn lượn (Swim Wave)', duration: 1.5, loop: true, presetKey: 'walk', tracks: FISH_SWIM },
  { id: 'clip-float', name: 'Lơ lửng vẫy vây (Gentle Float)', duration: 2.4, loop: true, presetKey: 'idle', tracks: FISH_FLOAT }
]

export const TMPL_ANIMAL_FISH: LayerAssemblyTemplate = {
  id: 'tmpl-animal-fish',
  name: 'Thủy Sinh — Cá Chép Koi Kohaku (Bơi Uốn Lượn Sống Động)',
  nameEn: 'Aquatic — Kohaku Koi Carp (Sinusoidal Swimming)',
  category: 'animal',
  ageGroup: 'aquatic',
  description:
    'Mẫu cá chép Koi Nhật Bản chia 3 đốt sống thân – đuôi truyền sóng hình sin mượt mà, kết hợp đôi vây ngực quạt nước đối xứng.',
  descriptionEn:
    'Multi-segment Koi fish rig with 3 spine segments and pectoral fins for fluid sinusoidal swimming motion.',
  width: 560,
  height: 420,
  slots: [
    { id: 'fin-pec-r', name: 'Vây ngực phải (Bên trên/xa)', nameEn: 'Right Pectoral Fin', role: 'fin', atlasCell: 5, boneId: 'bone-fish-fin-pectoral-r', defaultTransform: { x: -34, y: -42, z: 20, scale: 0.36, rotation: 0 }, suggestedAsset: 'animal_modular/fish_fin_far.png', description: 'Vây bơi quạt nước phía trên' },
    { id: 'fin-pec-l', name: 'Vây ngực trái (Bên dưới/gần)', nameEn: 'Left Pectoral Fin', role: 'fin', atlasCell: 4, boneId: 'bone-fish-fin-pectoral-l', defaultTransform: { x: -34, y: 42, z: 15, scale: 0.38, rotation: 0 }, suggestedAsset: 'animal_modular/fish_fin_near.png', description: 'Vây bơi quạt nước phía dưới' },
    { id: 'tail-fin', name: 'Cuống đuôi & Vây đuôi lụa', nameEn: 'Tail Base & Flowing Caudal Fin', role: 'tail', atlasCell: 3, boneId: 'bone-fish-fin-tail', defaultTransform: { x: 96, y: 0, z: 10, scale: 0.56, rotation: 0 }, suggestedAsset: 'animal_modular/fish_tail.png', description: 'Vây đuôi lụa uốn lượn mềm mại theo nhịp bơi' },
    { id: 'mid-body', name: 'Thân giữa vảy trắng cam', nameEn: 'Koi Mid-Body Segment', role: 'torso', atlasCell: 2, boneId: 'bone-fish-mid', defaultTransform: { x: 4, y: 0, z: 0, scale: 0.54, rotation: 0 }, suggestedAsset: 'animal_modular/fish_mid.png', description: 'Khúc thân giữa nối liền đầu và đuôi' },
    { id: 'head', name: 'Đầu cá Koi & Râu cá chép', nameEn: 'Koi Fish Head & Barbels', role: 'head', atlasCell: 1, boneId: 'bone-fish-head', defaultTransform: { x: -84, y: 0, z: -10, scale: 0.54, rotation: 0 }, suggestedAsset: 'animal_modular/fish_head.png', description: 'Đầu cá Koi Kohaku trắng đỏ hướng sang trái' }
  ],
  bones: FISH_BONES,
  clips: FISH_CLIPS,
  activeClipId: 'clip-swim',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D Koi fish swimming animation.
IDENTITY: Japanese Kohaku Koi carp, pearly white scales with vibrant vermilion-orange markings and translucent flowing fins.
VIEW: Top-angled side view facing left.
BACKGROUND: Uniform solid chroma-key background #00FF00.`,
    cellLayout: [],
    userGuide:
      'Mẫu thủy sinh nhiều đốt sống truyền sóng hình sin mượt mà từ đầu tới vây đuôi.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_FISH, images, name)
}

export const ANIMAL_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_ANIMAL_DOG,
  TMPL_ANIMAL_ROOSTER,
  TMPL_ANIMAL_FISH
]
