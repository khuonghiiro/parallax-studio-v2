import { createTemplateComposite } from './templateBuilder'
import type { AnimationClip } from '@shared/layerRig'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import {
  createQuadrupedBones,
  generateQuadrupedWalk,
  generateQuadrupedWagTail,
  generateQuadrupedGraze,
  createFishBones,
  generateFishSwim,
  generateFishFloat,
  createBirdBones,
  generateBirdPeckWalk,
  generateBirdWingFlap
} from './creatureRigPresets'

// ---------------------------------------------------------------------------
// 1. Chó Cưng 4 Chân (Corgi / Golden / Vẫy Đuôi Lon Ton)
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
  name: 'Động Vật — Chó Cưng 4 Chân (Vẫy Đuôi Lon Ton)',
  nameEn: 'Quadruped — Pet Dog (Wagging Tail & Trot)',
  category: 'animal',
  ageGroup: 'quadruped',
  description: 'Mẫu động vật 4 chân hoàn chỉnh: đầu mõm, tai cúp, thân bụng, đuôi ngoáy, 4 chân phân chia đùi và cẳng chân bước đi nhịp nhàng.',
  descriptionEn: 'Full quadruped canine template with head, ears, body, wagging tail and 4 independent 2-joint limbs.',
  width: 520,
  height: 480,
  slots: [
    { id: 'head', name: 'Đầu & Mõm chó', nameEn: 'Dog Head & Snout', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -85, y: -45, z: -15, scale: 0.9, rotation: 0 }, description: 'Đầu chó góc nhìn nghiêng (side view), mắt sáng, mõm cười' },
    { id: 'ear-l', name: 'Tai chó cúp/vểnh', nameEn: 'Dog Ear', role: 'ear', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: -80, y: -80, z: -25, scale: 0.9, rotation: 0 }, description: 'Tai chó tách rời để rung rinh khi chạy' },
    { id: 'torso', name: 'Thân mình & Ngực bụng', nameEn: 'Dog Body & Chest', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -10, y: 10, z: 0, scale: 0.9, rotation: 0 }, description: 'Khối thân ngực và bụng mềm mại' },
    { id: 'tail', name: 'Đuôi chó ngoáy vẫy', nameEn: 'Wagging Tail', role: 'tail', atlasCell: 5, boneId: 'bone-tail', defaultTransform: { x: 75, y: -15, z: 10, scale: 0.9, rotation: 0 }, description: 'Chiếc đuôi xù vẫy mừng' },
    // Chân trước trái (ngoài)
    { id: 'leg-fl-thigh', name: 'Đùi trước trái (Gần)', nameEn: 'Front-Left Thigh', role: 'thigh', atlasCell: 8, boneId: 'bone-leg-fl-thigh', defaultTransform: { x: -45, y: 40, z: -20, scale: 0.9, rotation: 0 }, description: 'Đùi chân trước bên gần người xem' },
    { id: 'leg-fl-shin', name: 'Cẳng bàn chân trước trái', nameEn: 'Front-Left Shin & Paw', role: 'shin', atlasCell: 11, boneId: 'bone-leg-fl-shin', defaultTransform: { x: -45, y: 90, z: -22, scale: 0.9, rotation: 0 }, description: 'Cẳng chân và bàn đệm vuốt trước gần' },
    // Chân trước phải (xa)
    { id: 'leg-fr-thigh', name: 'Đùi trước phải (Xa)', nameEn: 'Front-Right Thigh', role: 'thigh', atlasCell: 9, boneId: 'bone-leg-fr-thigh', defaultTransform: { x: -25, y: 35, z: 20, scale: 0.88, rotation: 0 }, description: 'Đùi chân trước bên xa người xem' },
    { id: 'leg-fr-shin', name: 'Cẳng bàn chân trước phải', nameEn: 'Front-Right Shin & Paw', role: 'shin', atlasCell: 12, boneId: 'bone-leg-fr-shin', defaultTransform: { x: -25, y: 85, z: 18, scale: 0.88, rotation: 0 }, description: 'Cẳng chân và bàn đệm vuốt trước xa' },
    // Chân sau trái (ngoài)
    { id: 'leg-bl-thigh', name: 'Đùi sau trái (Gần)', nameEn: 'Back-Left Thigh', role: 'thigh', atlasCell: 16, boneId: 'bone-leg-bl-thigh', defaultTransform: { x: 45, y: 40, z: -15, scale: 0.9, rotation: 0 }, description: 'Đùi sau vạm vỡ bên gần người xem' },
    { id: 'leg-bl-shin', name: 'Cẳng bàn chân sau trái', nameEn: 'Back-Left Shin & Paw', role: 'shin', atlasCell: 18, boneId: 'bone-leg-bl-shin', defaultTransform: { x: 45, y: 95, z: -17, scale: 0.9, rotation: 0 }, description: 'Khoeo chân sau và bàn đệm vuốt gần' },
    // Chân sau phải (xa)
    { id: 'leg-br-thigh', name: 'Đùi sau phải (Xa)', nameEn: 'Back-Right Thigh', role: 'thigh', atlasCell: 17, boneId: 'bone-leg-br-thigh', defaultTransform: { x: 60, y: 35, z: 25, scale: 0.88, rotation: 0 }, description: 'Đùi sau bên xa người xem' },
    { id: 'leg-br-shin', name: 'Cẳng bàn chân sau phải', nameEn: 'Back-Right Shin & Paw', role: 'shin', atlasCell: 19, boneId: 'bone-leg-br-shin', defaultTransform: { x: 60, y: 90, z: 23, scale: 0.88, rotation: 0 }, description: 'Khoeo chân sau và bàn đệm vuốt xa' }
  ],
  bones: DOG_BONES,
  clips: DOG_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D quadruped dog animation.
IDENTITY: Golden retriever / Corgi pet dog, cheerful playful expression, fluffy coat.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left, natural standing rest pose.
BACKGROUND: Uniform solid chroma-key background #00FF00.
CELLS:
1. Dog head with snout and neck (facing left)
2. Fluffy floppy ear (isolated)
3. Main body torso and ribs
4. Bushy tail (isolated)
5. Left front upper leg (near)
6. Left front lower leg with paw (near)
7. Right front upper leg (far, slightly darker for depth)
8. Right front lower leg with paw (far)
9. Left rear hind thigh (near, muscular curve)
10. Left rear hock and paw (near)
11. Right rear hind thigh (far)
12. Right rear hock and paw (far)
Hidden rounded overlapping joint connections. Shared pixel scale.`,
    cellLayout: ['1. Đầu & mõm', '2. Tai chó', '3. Thân ngực', '4. Đuôi vẫy', '5. Đùi trước gần', '6. Cẳng trước gần', '7. Đùi trước xa', '8. Cẳng trước xa', '9. Đùi sau gần', '10. Cẳng sau gần', '11. Đùi sau xa', '12. Cẳng sau xa'],
    userGuide: 'Mẫu động vật 4 chân góc nghiêng. Tách nền xanh lá (#00FF00). Khi nạp vào xưởng, khung xương 4 chân sẽ tự động đồng bộ nhịp bước đối xứng tự nhiên.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_DOG, images, name)
}

// ---------------------------------------------------------------------------
// 2. Con Trâu Đồng / Bò Lực Lưỡng (Kéo Cày & Gặm Cỏ)
// ---------------------------------------------------------------------------

const BUFFALO_BONES = createQuadrupedBones()
const BUFFALO_WALK = generateQuadrupedWalk(BUFFALO_BONES, 2.0)
const BUFFALO_GRAZE = generateQuadrupedGraze(BUFFALO_BONES, 2.4)

const BUFFALO_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Bước đi kéo cày (Heavy Walk)', duration: 2.0, loop: true, presetKey: 'walk', tracks: BUFFALO_WALK },
  { id: 'clip-graze', name: 'Cúi đầu gặm cỏ (Graze)', duration: 2.4, loop: true, presetKey: 'idle', tracks: BUFFALO_GRAZE }
]

export const TMPL_ANIMAL_BUFFALO: LayerAssemblyTemplate = {
  id: 'tmpl-animal-buffalo',
  name: 'Động Vật — Con Trâu Đồng / Bò Vạm Vỡ (Kéo Cày & Gặm Cỏ)',
  nameEn: 'Quadruped — Water Buffalo / Bull (Sturdy & Graze)',
  category: 'animal',
  ageGroup: 'quadruped',
  description: 'Con trâu đồng Việt Nam lực lưỡng, cặp sừng cong hình trăng khuyết, thân bụng vạm vỡ, 4 chân guốc vững chãi, bước đi thong thả kéo cày và gặm cỏ.',
  descriptionEn: 'Vietnamese water buffalo with crescent horns, muscular body, sturdy hooves, slow heavy walk and grazing animation.',
  width: 580,
  height: 480,
  slots: [
    { id: 'head', name: 'Đầu trâu & Cặp sừng cong', nameEn: 'Buffalo Head & Horns', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -110, y: -50, z: -15, scale: 0.95, rotation: 0 }, description: 'Đầu trâu góc nghiêng, sừng cong vút, mũi xỏ khuyên dây thừng' },
    { id: 'ear', name: 'Tai trâu cụp ngang', nameEn: 'Buffalo Ear', role: 'ear', atlasCell: 4, boneId: 'bone-head', defaultTransform: { x: -100, y: -75, z: -25, scale: 0.95, rotation: 0 }, description: 'Tai trâu phe phẩy' },
    { id: 'torso', name: 'Thân trâu đen vạm vỡ', nameEn: 'Muscular Body', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -15, y: 10, z: 0, scale: 0.95, rotation: 0 }, description: 'Thân bụng trâu to khỏe vững chãi' },
    { id: 'tail', name: 'Đuôi trâu chổi đuổi ruồi', nameEn: 'Tufted Tail', role: 'tail', atlasCell: 5, boneId: 'bone-tail', defaultTransform: { x: 95, y: -10, z: 10, scale: 0.95, rotation: 0 }, description: 'Đuôi dài có chùm lông ở chóp' },
    { id: 'leg-fl-thigh', name: 'Đùi trước trái (Gần)', nameEn: 'Front-Left Thigh', role: 'thigh', atlasCell: 8, boneId: 'bone-leg-fl-thigh', defaultTransform: { x: -55, y: 45, z: -20, scale: 0.95, rotation: 0 }, description: 'Chân trước vạm vỡ gần' },
    { id: 'leg-fl-shin', name: 'Cẳng chân & Móng guốc trước T', nameEn: 'Front-Left Shin & Hoof', role: 'shin', atlasCell: 11, boneId: 'bone-leg-fl-shin', defaultTransform: { x: -55, y: 105, z: -22, scale: 0.95, rotation: 0 }, description: 'Móng guốc trước gần' },
    { id: 'leg-fr-thigh', name: 'Đùi trước phải (Xa)', nameEn: 'Front-Right Thigh', role: 'thigh', atlasCell: 9, boneId: 'bone-leg-fr-thigh', defaultTransform: { x: -35, y: 40, z: 20, scale: 0.92, rotation: 0 }, description: 'Chân trước xa' },
    { id: 'leg-fr-shin', name: 'Cẳng chân & Móng guốc trước P', nameEn: 'Front-Right Shin & Hoof', role: 'shin', atlasCell: 12, boneId: 'bone-leg-fr-shin', defaultTransform: { x: -35, y: 100, z: 18, scale: 0.92, rotation: 0 }, description: 'Móng guốc trước xa' },
    { id: 'leg-bl-thigh', name: 'Đùi sau trái (Gần)', nameEn: 'Back-Left Thigh', role: 'thigh', atlasCell: 16, boneId: 'bone-leg-bl-thigh', defaultTransform: { x: 55, y: 45, z: -15, scale: 0.95, rotation: 0 }, description: 'Đùi sau gân guốc gần' },
    { id: 'leg-bl-shin', name: 'Cẳng chân & Móng guốc sau T', nameEn: 'Back-Left Shin & Hoof', role: 'shin', atlasCell: 18, boneId: 'bone-leg-bl-shin', defaultTransform: { x: 55, y: 105, z: -17, scale: 0.95, rotation: 0 }, description: 'Móng guốc sau gần' },
    { id: 'leg-br-thigh', name: 'Đùi sau phải (Xa)', nameEn: 'Back-Right Thigh', role: 'thigh', atlasCell: 17, boneId: 'bone-leg-br-thigh', defaultTransform: { x: 75, y: 40, z: 25, scale: 0.92, rotation: 0 }, description: 'Đùi sau xa' },
    { id: 'leg-br-shin', name: 'Cẳng chân & Móng guốc sau P', nameEn: 'Back-Right Shin & Hoof', role: 'shin', atlasCell: 19, boneId: 'bone-leg-br-shin', defaultTransform: { x: 75, y: 100, z: 23, scale: 0.92, rotation: 0 }, description: 'Móng guốc sau xa' }
  ],
  bones: BUFFALO_BONES,
  clips: BUFFALO_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D quadruped water buffalo animation.
IDENTITY: Sturdy Vietnamese water buffalo, dark slate gray skin, large sweeping backward-curving horns, powerful muscular chest and belly, sturdy cloven hooves, rope nose ring.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left, natural rest pose.
BACKGROUND: Uniform solid chroma-key background #00FF00.
CELLS:
1. Buffalo head with sweeping horns and neck
2. Ear (isolated)
3. Muscular torso and barrel body
4. Tufted tail
5. Left front upper leg
6. Left front lower leg and hoof
7. Right front upper leg
8. Right front lower leg and hoof
9. Left rear hind thigh
10. Left rear hock and hoof
11. Right rear hind thigh
12. Right rear hock and hoof
Rounded overlapping joint caps for smooth mechanical puppet rotation.`,
    cellLayout: ['1. Đầu & sừng cong', '2. Tai trâu', '3. Thân lực lưỡng', '4. Đuôi chổi', '5. Đùi trước gần', '6. Móng trước gần', '7. Đùi trước xa', '8. Móng trước xa', '9. Đùi sau gần', '10. Móng sau gần', '11. Đùi sau xa', '12. Móng sau xa'],
    userGuide: 'Mẫu con trâu đồng kéo cày/gặm cỏ, phông xanh (#00FF00). Bước đi vững chắc chậm rãi và có clip cúi đầu gặm cỏ sinh động.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_BUFFALO, images, name)
}

// ---------------------------------------------------------------------------
// 3. Mèo Con Mềm Mại (Rón Rén & Vươn Vai)
// ---------------------------------------------------------------------------

const CAT_BONES = createQuadrupedBones()
const CAT_WALK = generateQuadrupedWalk(CAT_BONES, 1.2)
const CAT_TAIL = generateQuadrupedWagTail(CAT_BONES, 1.4)

const CAT_CLIPS: AnimationClip[] = [
  { id: 'clip-prowl', name: 'Rón rén êm ái (Prowl)', duration: 1.2, loop: true, presetKey: 'walk', tracks: CAT_WALK },
  { id: 'clip-idle', name: 'Vẫy nhẹ đuôi (Idle)', duration: 1.4, loop: true, presetKey: 'idle', tracks: CAT_TAIL }
]

export const TMPL_ANIMAL_CAT: LayerAssemblyTemplate = {
  id: 'tmpl-animal-cat',
  name: 'Động Vật — Mèo Con Mềm Mại (Rón Rén & Vươn Vai)',
  nameEn: 'Quadruped — Feline Cat (Stealth Prowl & Tail)',
  category: 'animal',
  ageGroup: 'quadruped',
  description: 'Mèo con tam thể / mướp mắt to tròn lanh lợi, tai nhọn vểnh, thân hình mềm mại, đuôi dài cong vút, bước đi rón rén không tiếng động.',
  descriptionEn: 'Cute domestic cat with pointed ears, slender flexible body, long curved tail and silent stealth prowl.',
  width: 480,
  height: 440,
  slots: [
    { id: 'head', name: 'Đầu mèo mắt to & Tai nhọn', nameEn: 'Cat Head & Pointed Ears', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: -75, y: -40, z: -15, scale: 0.85, rotation: 0 }, description: 'Đầu mèo mắt tròn to long lanh, ria mép' },
    { id: 'torso', name: 'Thân mèo thon thả', nameEn: 'Slender Cat Torso', role: 'torso', atlasCell: 6, boneId: 'bone-torso', defaultTransform: { x: -10, y: 10, z: 0, scale: 0.85, rotation: 0 }, description: 'Thân mèo dẻo dai mềm mại' },
    { id: 'tail', name: 'Đuôi mèo dài cong uốn lượn', nameEn: 'Long Curved Tail', role: 'tail', atlasCell: 5, boneId: 'bone-tail', defaultTransform: { x: 70, y: -25, z: 10, scale: 0.85, rotation: 0 }, description: 'Đuôi mèo dài cong vểnh cao' },
    { id: 'leg-fl-thigh', name: 'Chân trước trái (Gần)', nameEn: 'Near Front Upper Leg', role: 'thigh', atlasCell: 8, boneId: 'bone-leg-fl-thigh', defaultTransform: { x: -40, y: 35, z: -20, scale: 0.85, rotation: 0 }, description: 'Đoạn chân trước phía trên bên gần, không gồm cẳng và bàn chân' },
    { id: 'leg-fl-shin', name: 'Bàn chân đệm vuốt trước T', nameEn: 'Near Front Shin & Paw', role: 'shin', atlasCell: 11, boneId: 'bone-leg-fl-shin', defaultTransform: { x: -40, y: 80, z: -22, scale: 0.85, rotation: 0 }, description: 'Bàn đệm vuốt trước gần' },
    { id: 'leg-fr-thigh', name: 'Chân trước phải (Xa)', nameEn: 'Far Front Upper Leg', role: 'thigh', atlasCell: 9, boneId: 'bone-leg-fr-thigh', defaultTransform: { x: -20, y: 30, z: 20, scale: 0.82, rotation: 0 }, description: 'Chân trước xa' },
    { id: 'leg-fr-shin', name: 'Bàn chân đệm vuốt trước P', nameEn: 'Far Front Shin & Paw', role: 'shin', atlasCell: 12, boneId: 'bone-leg-fr-shin', defaultTransform: { x: -20, y: 75, z: 18, scale: 0.82, rotation: 0 }, description: 'Bàn đệm vuốt trước xa' },
    { id: 'leg-bl-thigh', name: 'Chân sau trái (Gần)', nameEn: 'Near Hind Upper Leg', role: 'thigh', atlasCell: 16, boneId: 'bone-leg-bl-thigh', defaultTransform: { x: 40, y: 35, z: -15, scale: 0.85, rotation: 0 }, description: 'Chân sau gập lò xo dẻo dai gần' },
    { id: 'leg-bl-shin', name: 'Bàn chân đệm vuốt sau T', nameEn: 'Near Hind Shin & Paw', role: 'shin', atlasCell: 18, boneId: 'bone-leg-bl-shin', defaultTransform: { x: 40, y: 85, z: -17, scale: 0.85, rotation: 0 }, description: 'Bàn đệm vuốt sau gần' },
    { id: 'leg-br-thigh', name: 'Chân sau phải (Xa)', nameEn: 'Far Hind Upper Leg', role: 'thigh', atlasCell: 17, boneId: 'bone-leg-br-thigh', defaultTransform: { x: 55, y: 30, z: 25, scale: 0.82, rotation: 0 }, description: 'Chân sau xa' },
    { id: 'leg-br-shin', name: 'Bàn chân đệm vuốt sau P', nameEn: 'Far Hind Shin & Paw', role: 'shin', atlasCell: 19, boneId: 'bone-leg-br-shin', defaultTransform: { x: 55, y: 80, z: 23, scale: 0.82, rotation: 0 }, description: 'Bàn đệm vuốt sau xa' }
  ],
  bones: CAT_BONES,
  clips: CAT_CLIPS,
  activeClipId: 'clip-prowl',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D cat cutout animation.
IDENTITY: Sleek domestic tabby or calico cat, big expressive green eyes, pointed ears, slender flexible body, long expressive tail, soft paws.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left, stalking rest pose.
BACKGROUND: Flat magenta #FF00FF chroma-key background.
CELLS:
1. Cat head with pointed ears and whiskers
2. Body torso and back arch
3. Long curved tail
4. Left front leg
5. Left front soft paw
6. Right front leg
7. Right front paw
8. Left rear thigh
9. Left rear hock and paw
10. Right rear thigh
11. Right rear hock and paw
Overlapping hidden joint connections for fluid feline movement.`,
    cellLayout: ['1. Đầu & tai nhọn', '2. Thân mềm', '3. Đuôi cong', '4. Chân trước gần', '5. Vuốt trước gần', '6. Chân trước xa', '7. Vuốt trước xa', '8. Chân sau gần', '9. Vuốt sau gần', '10. Chân sau xa', '11. Vuốt sau xa'],
    userGuide: 'Mẫu mèo mềm mại, tách nền hồng tím (#FF00FF). Dáng đi rón rén và đuôi vẫy nhẹ uốn lượn đặc trưng loài mèo.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_CAT, images, name)
}

// ---------------------------------------------------------------------------
// 4. Cá Chép Koi / Thủy Sinh (Bơi Lội Uốn Lượn 2.5D)
// ---------------------------------------------------------------------------

const FISH_BONES = createFishBones()
const FISH_SWIM = generateFishSwim(FISH_BONES, 1.6)
const FISH_FLOAT = generateFishFloat(FISH_BONES, 2.4)

const FISH_CLIPS: AnimationClip[] = [
  { id: 'clip-swim', name: 'Bơi uốn lượn (Swim Wave)', duration: 1.6, loop: true, presetKey: 'wave', tracks: FISH_SWIM },
  { id: 'clip-float', name: 'Nổi lững lờ đung đưa (Float)', duration: 2.4, loop: true, presetKey: 'idle', tracks: FISH_FLOAT }
]

export const TMPL_ANIMAL_FISH: LayerAssemblyTemplate = {
  id: 'tmpl-animal-fish',
  name: 'Thủy Sinh — Cá Chép Koi (Bơi Lội Uốn Lượn 2.5D)',
  nameEn: 'Aquatic — Japanese Koi Fish (Fluid Swimming Spine)',
  category: 'animal',
  ageGroup: 'aquatic',
  description: 'Cá chép Koi hoa văn đỏ trắng rực rỡ, phân tách 3 khúc cột sống uốn lượn nhịp nhàng, vây bơi chèo hai bên và đuôi xòe lụa bồng bềnh trong nước.',
  descriptionEn: 'Vibrant Koi fish with 3-segment sinusoidal spine chain, rowing pectoral fins and flowing translucent tail fin.',
  width: 520,
  height: 420,
  slots: [
    { id: 'fish-head', name: 'Đầu cá & Mang thở', nameEn: 'Fish Head & Gills', role: 'head', atlasCell: 1, boneId: 'bone-fish-head', defaultTransform: { x: -80, y: 0, z: -10, scale: 0.9, rotation: 0 }, description: 'Đầu cá chép góc nhìn nghiêng/trên, râu cá, mắt tròn' },
    { id: 'fish-mid', name: 'Thân giữa & Lưng vảy đỏ', nameEn: 'Mid Body & Scales', role: 'torso', atlasCell: 6, boneId: 'bone-fish-mid', defaultTransform: { x: -10, y: 0, z: 0, scale: 0.9, rotation: 0 }, description: 'Khúc thân giữa uốn cong vảy óng ánh' },
    { id: 'fish-tail-base', name: 'Cuống đuôi sau', nameEn: 'Tail Base Segment', role: 'pelvis', atlasCell: 7, boneId: 'bone-fish-tail-base', defaultTransform: { x: 50, y: 0, z: 5, scale: 0.9, rotation: 0 }, description: 'Khúc cuống đuôi thon gọn nối vây đuôi' },
    { id: 'fish-fin-tail', name: 'Đuôi lụa xòe bồng bềnh', nameEn: 'Flowing Tail Fin', role: 'tail', atlasCell: 5, boneId: 'bone-fish-fin-tail', defaultTransform: { x: 110, y: 0, z: 15, scale: 0.95, rotation: 0 }, description: 'Vây đuôi xòe rộng như dải lụa mỏng' },
    { id: 'fish-fin-dorsal', name: 'Vây lưng trên', nameEn: 'Dorsal Fin', role: 'decor', atlasCell: 3, boneId: 'bone-fish-fin-dorsal', defaultTransform: { x: -10, y: -45, z: 8, scale: 0.85, rotation: 0 }, description: 'Vây gai lưng trên' },
    { id: 'fish-fin-pectoral-l', name: 'Vây bơi chèo trái (Gần)', nameEn: 'Left Pectoral Fin', role: 'arm-l', atlasCell: 8, boneId: 'bone-fish-fin-pectoral-l', defaultTransform: { x: -60, y: 35, z: -25, scale: 0.85, rotation: 0 }, description: 'Vây ngực bên gần' },
    { id: 'fish-fin-pectoral-r', name: 'Vây bơi chèo phải (Xa)', nameEn: 'Right Pectoral Fin', role: 'arm-r', atlasCell: 9, boneId: 'bone-fish-fin-pectoral-r', defaultTransform: { x: -60, y: -35, z: 25, scale: 0.82, rotation: 0 }, description: 'Vây ngực bên xa' }
  ],
  bones: FISH_BONES,
  clips: FISH_CLIPS,
  activeClipId: 'clip-swim',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D Koi fish swimming cutout animation.
IDENTITY: Traditional Japanese Kohaku Koi fish, bright orange-red and pearly white pattern, flowing translucent fins.
VIEW: Top-angled 3/4 orthographic view facing left, gently arched swimming silhouette.
BACKGROUND: Flat solid cyan #00FFFF chroma-key background.
CELLS:
1. Fish head with barbels and gills (facing left)
2. Mid-body torso segment with overlapping round ends
3. Rear tail-base segment
4. Large flowing translucent tail fin
5. Dorsal fin
6. Left near pectoral rowing fin
7. Right far pectoral rowing fin
Rounded hidden overlapping joints between segments so when rotated, the fish spine forms a seamless organic curved curve.`,
    cellLayout: ['1. Đầu cá', '2. Thân giữa vảy', '3. Cuống đuôi', '4. Đuôi lụa xòe', '5. Vây lưng', '6. Vây bơi gần', '7. Vây bơi xa'],
    userGuide: 'Mẫu cá chép Koi uốn lượn, tách nền cyan (#00FFFF). Cột sống 3 khúc liên hoàn tạo hiệu ứng sóng bơi mượt mà không bị gãy khớp.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_FISH, images, name)
}

// ---------------------------------------------------------------------------
// 5. Gà Trống / Loài Chim (Mổ Thóc & Vỗ Cánh)
// ---------------------------------------------------------------------------

const ROOSTER_BONES = createBirdBones()
const ROOSTER_PECK = generateBirdPeckWalk(ROOSTER_BONES, 1.4)
const ROOSTER_FLAP = generateBirdWingFlap(ROOSTER_BONES, 0.8)

const ROOSTER_CLIPS: AnimationClip[] = [
  { id: 'clip-peck', name: 'Bước đi mổ thóc (Peck Walk)', duration: 1.4, loop: true, presetKey: 'walk', tracks: ROOSTER_PECK },
  { id: 'clip-flap', name: 'Vỗ cánh gáy vang (Wing Flap)', duration: 0.8, loop: true, presetKey: 'action', tracks: ROOSTER_FLAP }
]

export const TMPL_ANIMAL_ROOSTER: LayerAssemblyTemplate = {
  id: 'tmpl-animal-rooster',
  name: 'Gia Cầm — Gà Trống Mào Đỏ (Mổ Thóc & Vỗ Cánh)',
  nameEn: 'Avian — Proud Rooster (Peck Walk & Wing Flap)',
  category: 'animal',
  ageGroup: 'avian',
  description: 'Gà trống Đông Tảo / gà tre mào đỏ rực, mỏ nhọn, thân ức tròn béo, chùm lông đuôi xòe cong vút bảy màu, cánh vỗ phành phạch và chân bước mổ thóc.',
  descriptionEn: 'Proud rooster with bright red comb, sharp beak, layered plumage, arching sickle tail feathers, flapping wings and pecking walk.',
  width: 500,
  height: 500,
  slots: [
    { id: 'head', name: 'Đầu mào đỏ & Mỏ nhọn', nameEn: 'Comb Head & Beak', role: 'head', atlasCell: 1, boneId: 'bone-bird-head', defaultTransform: { x: -60, y: -80, z: -15, scale: 0.9, rotation: 0 }, description: 'Đầu mào đỏ tươi, mỏ nhọn sắc sảo' },
    { id: 'torso', name: 'Thân & Ức gà béo tròn', nameEn: 'Plump Body & Breast', role: 'torso', atlasCell: 6, boneId: 'bone-bird-body', defaultTransform: { x: 0, y: -10, z: 0, scale: 0.9, rotation: 0 }, description: 'Thân lông óng mượt và ức gà căng tròn' },
    { id: 'wing-l', name: 'Cánh gà trái (Gần)', nameEn: 'Left Wing (Near)', role: 'arm-l', atlasCell: 8, boneId: 'bone-bird-wing-l', defaultTransform: { x: -20, y: -15, z: -25, scale: 0.9, rotation: 0 }, description: 'Cánh xếp lớp lông vũ vỗ phành phạch gần' },
    { id: 'wing-r', name: 'Cánh gà phải (Xa)', nameEn: 'Right Wing (Far)', role: 'arm-r', atlasCell: 9, boneId: 'bone-bird-wing-r', defaultTransform: { x: 20, y: -20, z: 25, scale: 0.85, rotation: 0 }, description: 'Cánh xếp lớp bên xa' },
    { id: 'tail', name: 'Chùm lông đuôi cong vút', nameEn: 'Sickle Tail Feathers', role: 'tail', atlasCell: 5, boneId: 'bone-bird-tail', defaultTransform: { x: 75, y: -45, z: 10, scale: 0.95, rotation: 0 }, description: 'Chùm lông đuôi cầu vồng cong vút kiêu hãnh' },
    { id: 'thigh-l', name: 'Đùi gà trái (Gần)', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 16, boneId: 'bone-bird-thigh-l', defaultTransform: { x: -20, y: 50, z: -10, scale: 0.9, rotation: 0 }, description: 'Bắp đùi gà chắc khỏe gần' },
    { id: 'shin-l', name: 'Cẳng chân & Móng vuốt trái', nameEn: 'Near Shin & Clawed Foot', role: 'shin-l', atlasCell: 18, boneId: 'bone-bird-shin-l', defaultTransform: { x: -20, y: 105, z: -12, scale: 0.9, rotation: 0 }, description: 'Chân vàng và móng vuốt nhọn gần' },
    { id: 'thigh-r', name: 'Đùi gà phải (Xa)', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 17, boneId: 'bone-bird-thigh-r', defaultTransform: { x: 15, y: 45, z: 15, scale: 0.86, rotation: 0 }, description: 'Bắp đùi gà xa' },
    { id: 'shin-r', name: 'Cẳng chân & Móng vuốt phải', nameEn: 'Far Shin & Clawed Foot', role: 'shin-r', atlasCell: 19, boneId: 'bone-bird-shin-r', defaultTransform: { x: 15, y: 100, z: 13, scale: 0.86, rotation: 0 }, description: 'Chân vàng và móng vuốt xa' }
  ],
  bones: ROOSTER_BONES,
  clips: ROOSTER_CLIPS,
  activeClipId: 'clip-peck',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D rooster / bird cutout animation.
IDENTITY: Proud crowing rooster, vibrant red comb and wattles, sharp golden beak, iridescent emerald and bronze neck feathers, plump breast, large layered wings, sweeping arching sickle tail feathers, yellow scaled feet with sharp spurs.
VIEW: Pure SIDE ORTHOGRAPHIC view facing left, alert upright stance.
BACKGROUND: Solid flat green chroma-key background #00FF00.
CELLS:
1. Rooster head with red comb and beak
2. Plump body torso
3. Left layered wing (near)
4. Right layered wing (far)
5. Large arching sickle tail plume
6. Left upper thigh (near)
7. Left yellow claw foot with spur (near)
8. Right upper thigh (far)
9. Right yellow claw foot with spur (far)
Concealed overlapping joints at neck, wings and hips for clean rotation.`,
    cellLayout: ['1. Đầu mào đỏ & mỏ', '2. Thân ức gà', '3. Cánh gần', '4. Cánh xa', '5. Chùm đuôi cong', '6. Đùi gần', '7. Móng vuốt gần', '8. Đùi xa', '9. Móng vuốt xa'],
    userGuide: 'Mẫu gà trống/chim có cánh và 2 chân móng. Tách nền xanh (#00FF00), có clip mổ thóc gật đầu và vỗ cánh reo mừng.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ANIMAL_ROOSTER, images, name)
}

export const ANIMAL_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_ANIMAL_DOG,
  TMPL_ANIMAL_BUFFALO,
  TMPL_ANIMAL_CAT,
  TMPL_ANIMAL_FISH,
  TMPL_ANIMAL_ROOSTER
]
