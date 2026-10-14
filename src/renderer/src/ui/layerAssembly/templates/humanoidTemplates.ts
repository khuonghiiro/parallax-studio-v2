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

const HUMAN_BONES = createHumanoidBones()
const HUMAN_WALK = generateWalkCycle(HUMAN_BONES, 1.6)
const HUMAN_IDLE = generateIdleBreathe(HUMAN_BONES, 2.4)
const HUMAN_SLASH = generateActionSlash(HUMAN_BONES, 1.5)
const HUMAN_WAVE = generateWaveHand(HUMAN_BONES, 1.8)
const HUMAN_BOW = generateBow(HUMAN_BONES, 2.0)

const HUMAN_CLIPS: AnimationClip[] = [
  { id: 'clip-walk', name: 'Bước đi (Walk)', duration: 1.6, loop: true, presetKey: 'walk', tracks: HUMAN_WALK },
  { id: 'clip-idle', name: 'Đứng thở (Idle)', duration: 2.4, loop: true, presetKey: 'idle', tracks: HUMAN_IDLE },
  { id: 'clip-action', name: 'Vung kiếm (Slash)', duration: 1.5, loop: true, presetKey: 'action', tracks: HUMAN_SLASH },
  { id: 'clip-wave', name: 'Vẫy tay chào (Wave)', duration: 1.8, loop: true, presetKey: 'wave', tracks: HUMAN_WAVE },
  { id: 'clip-bow', name: 'Cúi chào (Bow)', duration: 2.0, loop: false, presetKey: 'bow', tracks: HUMAN_BOW }
]

// ---------------------------------------------------------------------------
// 1. Nhân Vật Chuẩn Đầu Người — Hướng Chính Diện (0° Front View)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_FRONT: LayerAssemblyTemplate = {
  id: 'tmpl-character-front',
  name: 'Nhân Vật Chuẩn Đầu Người — Hướng Chính Diện (0° + Đầu Trơn & 4 Biểu Cảm)',
  nameEn: 'Standard Human Character — Front View (0° Faceless Head & 4 Expressions)',
  category: 'character',
  ageGroup: 'adult',
  description:
    'Mẫu nhân vật chuẩn đầu người góc nhìn chính diện (0°): phần Đầu gốc trơn không ngũ quan (không mắt mũi miệng) để ghép chồng 4 bộ Biểu cảm khuôn mặt rời (Bình thường, Vui vẻ, Tức giận, Hoảng hốt), kết hợp tóc trước/sau và 3 khúc tay chân chuẩn giải phẫu.',
  descriptionEn:
    'Standard front-view (0°) human character rig featuring a faceless base head with 4 swappable facial expression overlays (Normal, Happy, Angry, Shocked), layered hair, and 3-segment limbs.',
  width: 500,
  height: 600,
  slots: [
    { id: 'cape', name: 'Áo choàng sau lưng', nameEn: 'Back Cape / Cloak', role: 'cape', atlasCell: 4, boneId: 'bone-torso', defaultTransform: { x: 0, y: 24, z: 40, scale: 0.698, rotation: 0 }, suggestedAsset: 'character_human_front/cape.png', description: 'Áo choàng rộng phía sau lưng nhân vật' },
    { id: 'hair-back', name: 'Tóc sau gáy', nameEn: 'Back Hair Silhouette', role: 'hair-back', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: 0, y: -118, z: 30, scale: 0.473, rotation: 0 }, suggestedAsset: 'character_human_front/hair-back.png', description: 'Khối tóc phía sau đầu và gáy' },
    { id: 'thigh-l', name: 'Đùi trái', nameEn: 'Left Thigh', role: 'thigh-l', atlasCell: 13, boneId: 'bone-thigh-l', defaultTransform: { x: -21, y: 64, z: 20, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_front/thigh-left.png', description: 'Đùi trái từ hông đến đầu gối' },
    { id: 'thigh-r', name: 'Đùi phải', nameEn: 'Right Thigh', role: 'thigh-r', atlasCell: 14, boneId: 'bone-thigh-r', defaultTransform: { x: 21, y: 64, z: 15, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_front/thigh-right.png', description: 'Đùi phải từ hông đến đầu gối' },
    { id: 'shin-l', name: 'Cẳng chân trái (Không dính giày)', nameEn: 'Left Shin / Lower Leg', role: 'shin-l', atlasCell: 15, boneId: 'bone-shin-l', defaultTransform: { x: -21, y: 123, z: 10, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_front/shin-left.png', description: 'Cẳng chân trái từ gối tới cổ chân' },
    { id: 'shin-r', name: 'Cẳng chân phải (Không dính giày)', nameEn: 'Right Shin / Lower Leg', role: 'shin-r', atlasCell: 16, boneId: 'bone-shin-r', defaultTransform: { x: 21, y: 123, z: 5, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_front/shin-right.png', description: 'Cẳng chân phải từ gối tới cổ chân' },
    { id: 'foot-l', name: 'Bàn chân & Giày ủng trái', nameEn: 'Left Boot / Foot', role: 'foot-l', atlasCell: 17, boneId: 'bone-foot-l', defaultTransform: { x: -22, y: 168, z: 0, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_human_front/foot-left.png', description: 'Giày ủng trái tách rời xoay cổ chân độc lập' },
    { id: 'foot-r', name: 'Bàn chân & Giày ủng phải', nameEn: 'Right Boot / Foot', role: 'foot-r', atlasCell: 18, boneId: 'bone-foot-r', defaultTransform: { x: 22, y: 168, z: -5, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_human_front/foot-right.png', description: 'Giày ủng phải tách rời xoay cổ chân độc lập' },
    { id: 'pelvis', name: 'Đai lưng & Vạt áo dưới che hông', nameEn: 'Waist Belt & Lower Tunic Pelvis', role: 'pelvis', atlasCell: 6, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 20, z: -10, scale: 0.432, rotation: 0 }, suggestedAsset: 'character_human_front/pelvis.png', description: 'Thắt lưng da và vạt áo dưới che khớp hông' },
    { id: 'torso', name: 'Thân áo ngực (Không kèm tay)', nameEn: 'Sleeveless Jacket / Tunic Torso', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -35, z: -15, scale: 0.432, rotation: 0 }, suggestedAsset: 'character_human_front/torso.png', description: 'Thân áo từ cổ đến eo, tách rời hai cánh tay' },
    { id: 'arm-l', name: 'Bắp tay trái', nameEn: 'Left Upper Arm Sleeve', role: 'arm-l', atlasCell: 7, boneId: 'bone-arm-l', defaultTransform: { x: -40, y: -34, z: -20, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_human_front/arm-left.png', description: 'Bắp tay áo trái từ vai đến khuỷu tay' },
    { id: 'arm-r', name: 'Bắp tay phải', nameEn: 'Right Upper Arm Sleeve', role: 'arm-r', atlasCell: 8, boneId: 'bone-arm-r', defaultTransform: { x: 40, y: -34, z: -20, scale: 0.36, rotation: 0 }, suggestedAsset: 'character_human_front/arm-right.png', description: 'Bắp tay áo phải từ vai đến khuỷu tay' },
    { id: 'hand-l', name: 'Bàn tay trái', nameEn: 'Left Human Hand', role: 'hand-l', atlasCell: 11, boneId: 'bone-hand-l', defaultTransform: { x: -43, y: 32, z: -25, scale: 0.293, rotation: 0 }, suggestedAsset: 'character_human_front/hand-left.png', description: 'Bàn tay người bên trái buông tự nhiên' },
    { id: 'prop-weapon', name: 'Kiếm / Vũ khí cầm tay (Bật/Tắt)', nameEn: 'Handheld Sword / Weapon Prop', role: 'prop-weapon', atlasCell: 23, boneId: 'bone-hand-r', defaultTransform: { x: 52, y: -10, z: -28, scale: 0.608, rotation: 0 }, suggestedAsset: 'character_human_front/weapon.png', description: 'Vũ khí/đạo cụ gắn theo bàn tay phải' },
    { id: 'hand-r', name: 'Bàn tay phải', nameEn: 'Right Human Hand', role: 'hand-r', atlasCell: 12, boneId: 'bone-hand-r', defaultTransform: { x: 43, y: 32, z: -30, scale: 0.293, rotation: 0 }, suggestedAsset: 'character_human_front/hand-right.png', description: 'Bàn tay người bên phải buông tự nhiên' },
    { id: 'forearm-l', name: 'Cẳng tay & Hộ uyển trái', nameEn: 'Left Forearm Bracer', role: 'forearm-l', atlasCell: 9, boneId: 'bone-forearm-l', defaultTransform: { x: -42, y: 2, z: -35, scale: 0.369, rotation: 0 }, suggestedAsset: 'character_human_front/forearm-left.png', description: 'Cẳng tay trái từ khuỷu đến cổ tay (không dính bàn tay)' },
    { id: 'forearm-r', name: 'Cẳng tay & Hộ uyển phải', nameEn: 'Right Forearm Bracer', role: 'forearm-r', atlasCell: 10, boneId: 'bone-forearm-r', defaultTransform: { x: 42, y: 2, z: -35, scale: 0.369, rotation: 0 }, suggestedAsset: 'character_human_front/forearm-right.png', description: 'Cẳng tay phải từ khuỷu đến cổ tay (không dính bàn tay)' },
    { id: 'head', name: 'Đầu người trơn (Không ngũ quan)', nameEn: 'Faceless Human Head & Neck Base', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 0, y: -106, z: -40, scale: 0.423, rotation: 0 }, suggestedAsset: 'character_human_front/head.png', description: 'Đầu người trơn không có mắt mũi miệng để ghép các layer biểu cảm lên trên' },
    { id: 'face-normal', name: 'Biểu cảm 1: Bình thường / Tự tin', nameEn: 'Face Expression: Calm / Normal', role: 'face', atlasCell: 19, boneId: 'bone-head', defaultTransform: { x: 0, y: -107, z: -45, scale: 0.153, rotation: 0 }, suggestedAsset: 'character_human_front/face-normal.png', description: 'Ngũ quan biểu cảm bình thường tự tin ghép trên đầu trơn' },
    { id: 'face-happy', name: 'Biểu cảm 2: Vui vẻ / Cười tươi (Ẩn sẵn)', nameEn: 'Face Expression: Happy / Laughing', role: 'face-alt', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: 0, y: -107, z: -46, scale: 0.153, rotation: 0, hidden: true }, suggestedAsset: 'character_human_front/face-happy.png', description: 'Bật con mắt layer này (và ẩn biểu cảm 1) để đổi sang mặt cười vui vẻ' },
    { id: 'face-angry', name: 'Biểu cảm 3: Tức giận / Chiến đấu (Ẩn sẵn)', nameEn: 'Face Expression: Angry / Fierce', role: 'face-alt', atlasCell: 21, boneId: 'bone-head', defaultTransform: { x: 0, y: -107, z: -47, scale: 0.153, rotation: 0, hidden: true }, suggestedAsset: 'character_human_front/face-angry.png', description: 'Bật con mắt layer này để đổi sang biểu cảm tức giận chiến đấu' },
    { id: 'face-shock', name: 'Biểu cảm 4: Hoảng hốt / Kinh ngạc (Ẩn sẵn)', nameEn: 'Face Expression: Shocked / Panic', role: 'face-alt', atlasCell: 22, boneId: 'bone-head', defaultTransform: { x: 0, y: -107, z: -48, scale: 0.153, rotation: 0, hidden: true }, suggestedAsset: 'character_human_front/face-shock.png', description: 'Bật con mắt layer này để đổi sang biểu cảm hoảng hốt đổ mồ hôi' },
    { id: 'hair-front', name: 'Tóc mái trước & Tóc mai', nameEn: 'Front Hair Bangs & Sideburns', role: 'hair-front', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 0, y: -124, z: -50, scale: 0.459, rotation: 0 }, suggestedAsset: 'character_human_front/hair-front.png', description: 'Tóc mái trước ôm lấy trán, chừa khoảng trống cho khuôn mặt' }
  ],
  bones: HUMAN_BONES,
  clips: HUMAN_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D animated young adult human martial/adventure hero in strict FRONT ORTHOGRAPHIC VIEW (0°), wearing royal-blue and white layered jacket tunic with gold trim, leather belt, dark trousers and boots, featuring a FACELESS base head and 4 separate facial expression overlays.`,
    cellLayout: [],
    userGuide: ''
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_CHARACTER_FRONT, images, name)
}

// ---------------------------------------------------------------------------
// 2. Nhân Vật Chuẩn Đầu Người — Hướng Chéo 3/4 (45° Three-Quarter View)
// ---------------------------------------------------------------------------

export const TMPL_CHARACTER_QUARTER: LayerAssemblyTemplate = {
  id: 'tmpl-character-quarter',
  name: 'Nhân Vật Chuẩn Đầu Người — Hướng Chéo 3/4 (45° + Đầu Trơn & 4 Biểu Cảm)',
  nameEn: 'Standard Human Character — Three-Quarter View (45° Faceless Head & 4 Expressions)',
  category: 'character',
  ageGroup: 'adult',
  description:
    'Mẫu nhân vật chuẩn đầu người góc nhìn chéo 3/4 (45°): đầu người 3/4 trơn không ngũ quan kết hợp 4 biểu cảm mặt góc nghiêng 3/4 (Bình thường, Vui vẻ, Tức giận, Hoảng hốt), phân lớp tay chân xa/gần tạo chiều sâu 2.5D tự nhiên.',
  descriptionEn:
    'Three-quarter view (45°) standard human character rig with a faceless 3/4 head, 4 swappable 3/4 facial expression overlays, and depth-sorted near/far limbs.',
  width: 500,
  height: 600,
  slots: [
    { id: 'cape', name: 'Áo choàng sau lưng (Góc chéo)', nameEn: 'Back Cape (3/4 View)', role: 'cape', atlasCell: 4, boneId: 'bone-torso', defaultTransform: { x: -11, y: 24, z: 45, scale: 0.666, rotation: 0 }, suggestedAsset: 'character_human_quarter/cape.png', description: 'Áo choàng phía sau lưng góc nhìn chéo 45°' },
    { id: 'hair-back', name: 'Tóc sau gáy (Góc chéo 3/4)', nameEn: 'Back Hair (3/4 View)', role: 'hair-back', atlasCell: 2, boneId: 'bone-head', defaultTransform: { x: -6, y: -116, z: 40, scale: 0.459, rotation: 0 }, suggestedAsset: 'character_human_quarter/hair-back.png', description: 'Tóc sau đầu góc chéo 3/4' },
    { id: 'arm-r', name: 'Bắp tay phải (Bên xa)', nameEn: 'Far-Side Upper Arm (3/4 View)', role: 'arm-r', atlasCell: 8, boneId: 'bone-arm-r', defaultTransform: { x: 29, y: -34, z: 35, scale: 0.351, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-right.png', description: 'Bắp tay phía xa nằm sau thân ngực' },
    { id: 'prop-weapon', name: 'Kiếm / Vũ khí cầm tay (Ẩn sẵn)', nameEn: 'Handheld Sword Prop', role: 'prop-weapon', atlasCell: 23, boneId: 'bone-hand-r', defaultTransform: { x: 41, y: -8, z: 32, scale: 0.585, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/weapon.png', description: 'Vũ khí cầm tay góc nghiêng 3/4' },
    { id: 'hand-r', name: 'Bàn tay phải (Bên xa)', nameEn: 'Far-Side Hand (3/4 View)', role: 'hand-r', atlasCell: 12, boneId: 'bone-hand-r', defaultTransform: { x: 33, y: 31, z: 30, scale: 0.252, rotation: 0 }, suggestedAsset: 'character_human_quarter/hand-right.png', description: 'Bàn tay phía xa' },
    { id: 'forearm-r', name: 'Cẳng tay phải (Bên xa)', nameEn: 'Far-Side Forearm (3/4 View)', role: 'forearm-r', atlasCell: 10, boneId: 'bone-forearm-r', defaultTransform: { x: 32, y: 2, z: 25, scale: 0.324, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-right.png', description: 'Cẳng tay phía xa' },
    { id: 'thigh-r', name: 'Đùi phải (Chân xa)', nameEn: 'Far-Side Thigh (3/4 View)', role: 'thigh-r', atlasCell: 14, boneId: 'bone-thigh-r', defaultTransform: { x: 14, y: 64, z: 20, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-right.png', description: 'Đùi chân phía xa góc 3/4' },
    { id: 'shin-r', name: 'Cẳng chân phải (Chân xa)', nameEn: 'Far-Side Shin (3/4 View)', role: 'shin-r', atlasCell: 16, boneId: 'bone-shin-r', defaultTransform: { x: 14, y: 122, z: 15, scale: 0.383, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-right.png', description: 'Cẳng chân phía xa góc 3/4' },
    { id: 'foot-r', name: 'Giày ủng phải (Chân xa)', nameEn: 'Far-Side Boot (3/4 View)', role: 'foot-r', atlasCell: 18, boneId: 'bone-foot-r', defaultTransform: { x: 20, y: 165, z: 10, scale: 0.342, rotation: 0 }, suggestedAsset: 'character_human_quarter/foot-right.png', description: 'Bàn chân và giày ủng phía xa hướng chéo' },
    { id: 'thigh-l', name: 'Đùi trái (Chân gần)', nameEn: 'Near-Side Thigh (3/4 View)', role: 'thigh-l', atlasCell: 13, boneId: 'bone-thigh-l', defaultTransform: { x: -12, y: 65, z: 5, scale: 0.396, rotation: 0 }, suggestedAsset: 'character_human_quarter/thigh-left.png', description: 'Đùi chân phía gần góc 3/4' },
    { id: 'shin-l', name: 'Cẳng chân trái (Chân gần)', nameEn: 'Near-Side Shin (3/4 View)', role: 'shin-l', atlasCell: 15, boneId: 'bone-shin-l', defaultTransform: { x: -12, y: 124, z: 0, scale: 0.396, rotation: 0 }, suggestedAsset: 'character_human_quarter/shin-left.png', description: 'Cẳng chân phía gần góc 3/4' },
    { id: 'foot-l', name: 'Giày ủng trái (Chân gần)', nameEn: 'Near-Side Boot (3/4 View)', role: 'foot-l', atlasCell: 17, boneId: 'bone-foot-l', defaultTransform: { x: -6, y: 168, z: -5, scale: 0.351, rotation: 0 }, suggestedAsset: 'character_human_quarter/foot-left.png', description: 'Bàn chân và giày ủng phía gần hướng chéo' },
    { id: 'pelvis', name: 'Đai lưng & Vạt áo dưới (Góc 3/4)', nameEn: 'Waist Belt & Lower Tunic (3/4 View)', role: 'pelvis', atlasCell: 6, boneId: 'bone-pelvis', defaultTransform: { x: 0, y: 20, z: -10, scale: 0.405, rotation: 0 }, suggestedAsset: 'character_human_quarter/pelvis.png', description: 'Đai lưng và vạt áo dưới góc nghiêng 45°' },
    { id: 'torso', name: 'Thân áo ngực (Góc 3/4)', nameEn: 'Sleeveless Jacket Torso (3/4 View)', role: 'torso', atlasCell: 5, boneId: 'bone-torso', defaultTransform: { x: 0, y: -35, z: -15, scale: 0.414, rotation: 0 }, suggestedAsset: 'character_human_quarter/torso.png', description: 'Thân ngực xoay góc chéo 45°' },
    { id: 'head', name: 'Đầu người trơn 3/4 (Không ngũ quan)', nameEn: 'Faceless Human Head (3/4 View)', role: 'head', atlasCell: 1, boneId: 'bone-head', defaultTransform: { x: 2, y: -106, z: -20, scale: 0.405, rotation: 0 }, suggestedAsset: 'character_human_quarter/head.png', description: 'Đầu người góc 3/4 trơn không mắt mũi miệng để ghép các biểu cảm 3/4' },
    { id: 'face-normal', name: 'Biểu cảm 3/4: Bình thường / Tự tin', nameEn: '3/4 Face: Calm / Normal', role: 'face', atlasCell: 19, boneId: 'bone-head', defaultTransform: { x: 11, y: -106, z: -25, scale: 0.189, rotation: 0 }, suggestedAsset: 'character_human_quarter/face-normal.png', description: 'Ngũ quan góc nghiêng 3/4 bình thường tự tin' },
    { id: 'face-happy', name: 'Biểu cảm 3/4: Vui vẻ / Cười tươi (Ẩn sẵn)', nameEn: '3/4 Face: Happy / Laughing', role: 'face-alt', atlasCell: 20, boneId: 'bone-head', defaultTransform: { x: 11, y: -106, z: -26, scale: 0.189, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/face-happy.png', description: 'Bật con mắt layer này để đổi sang biểu cảm cười tươi góc 3/4' },
    { id: 'face-angry', name: 'Biểu cảm 3/4: Tức giận / Chiến đấu (Ẩn sẵn)', nameEn: '3/4 Face: Angry / Fierce', role: 'face-alt', atlasCell: 21, boneId: 'bone-head', defaultTransform: { x: 11, y: -106, z: -27, scale: 0.189, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/face-angry.png', description: 'Bật con mắt layer này để đổi sang biểu cảm tức giận góc 3/4' },
    { id: 'face-shock', name: 'Biểu cảm 3/4: Hoảng hốt / Kinh ngạc (Ẩn sẵn)', nameEn: '3/4 Face: Shocked / Panic', role: 'face-alt', atlasCell: 22, boneId: 'bone-head', defaultTransform: { x: 11, y: -106, z: -28, scale: 0.189, rotation: 0, hidden: true }, suggestedAsset: 'character_human_quarter/face-shock.png', description: 'Bật con mắt layer này để đổi sang biểu cảm hoảng hốt góc 3/4' },
    { id: 'hair-front', name: 'Tóc mái trước & Tóc mai (Góc 3/4)', nameEn: 'Front Hair Bangs (3/4 View)', role: 'hair-front', atlasCell: 3, boneId: 'bone-head', defaultTransform: { x: 5, y: -133, z: -30, scale: 0.441, rotation: 0 }, suggestedAsset: 'character_human_quarter/hair-front.png', description: 'Tóc mái trước theo phối cảnh góc chéo 45°' },
    { id: 'arm-l', name: 'Bắp tay trái (Bên gần)', nameEn: 'Near-Side Upper Arm (3/4 View)', role: 'arm-l', atlasCell: 7, boneId: 'bone-arm-l', defaultTransform: { x: -32, y: -33, z: -35, scale: 0.369, rotation: 0 }, suggestedAsset: 'character_human_quarter/arm-left.png', description: 'Bắp tay phía gần người xem' },
    { id: 'hand-l', name: 'Bàn tay trái (Bên gần)', nameEn: 'Near-Side Hand (3/4 View)', role: 'hand-l', atlasCell: 11, boneId: 'bone-hand-l', defaultTransform: { x: -34, y: 32, z: -40, scale: 0.261, rotation: 0 }, suggestedAsset: 'character_human_quarter/hand-left.png', description: 'Bàn tay phía gần người xem' },
    { id: 'forearm-l', name: 'Cẳng tay trái (Bên gần)', nameEn: 'Near-Side Forearm (3/4 View)', role: 'forearm-l', atlasCell: 9, boneId: 'bone-forearm-l', defaultTransform: { x: -33, y: 2, z: -45, scale: 0.342, rotation: 0 }, suggestedAsset: 'character_human_quarter/forearm-left.png', description: 'Cẳng tay và hộ uyển phía gần người xem' }
  ],
  bones: HUMAN_BONES,
  clips: HUMAN_CLIPS,
  activeClipId: 'clip-walk',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D animated young adult human martial/adventure hero in THREE-QUARTER VIEW (45° angled perspective), wearing royal-blue and white layered jacket tunic with gold trim, leather belt, dark trousers and boots, featuring a FACELESS 3/4 base head and 4 separate 3/4 facial expression overlays.`,
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
