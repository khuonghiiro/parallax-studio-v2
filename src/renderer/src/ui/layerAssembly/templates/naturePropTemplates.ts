import { createTemplateComposite } from './templateBuilder'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'

// ---------------------------------------------------------------------------
// 1. Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp (Nature)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_BONSAI: LayerAssemblyTemplate = {
  id: 'tmpl-nature-bonsai',
  name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp',
  nameEn: 'Zen Bonsai Tree (5-Depth Layers)',
  category: 'nature',
  ageGroup: 'plant',
  description: 'Nghệ thuật Bonsai phân tách 5 tầng chiều sâu: Chậu gốm Tử Sa viền đồng, Thân gỗ uốn khúc, Tán sau mờ xa, Tán chính ngọc bích và Tán trước đón nắng.',
  descriptionEn: 'Multi-depth Japanese bonsai tree featuring ceramic pot, gnarled twisted trunk and 3 organic wind-swayed foliage layers.',
  width: 550,
  height: 600,
  slots: [
    { id: 'bonsai-pot', name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)', nameEn: 'Ceramic Pot Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 155, z: -5, scale: 1.05, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'assembly_3d/modular/bonsai_pot.png', description: 'Chậu gốm cổ điển đế vững' },
    { id: 'bonsai-trunk', name: 'Thân cổ thụ uốn lượn phong trần', nameEn: 'Gnarled Wood Trunk', role: 'trunk', atlasCell: 2, defaultTransform: { x: 0, y: 10, z: 0, scale: 1.0, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'assembly_3d/modular/bonsai_trunk.png', description: 'Thân gỗ uốn lượn đung đưa gốc' },
    { id: 'bonsai-foliage-back', name: 'Tán lá tùng sau (Hậu cảnh Z=+35)', nameEn: 'Background Foliage', role: 'back-foliage', atlasCell: 3, defaultTransform: { x: 5, y: -60, z: 35, scale: 0.95, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_back.png', description: 'Tán lá phía sau tạo chiều sâu' },
    { id: 'bonsai-foliage-mid', name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=0)', nameEn: 'Midground Foliage', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: -10, y: -90, z: 0, scale: 1.0, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_mid.png', description: 'Tán lá chính giữa thân cây' },
    { id: 'bonsai-foliage-front', name: 'Nhánh non vươn nắng (Tiền cảnh Z=-30)', nameEn: 'Foreground Foliage', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 25, y: -40, z: -30, scale: 1.02, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_front.png', description: 'Tán lá non vươn về phía trước' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D parallax Bonsai tree animation.
IDENTITY: Ancient Japanese Juniper / Pine Bonsai in antique dark clay pot with bronze rim.
VIEW: Front orthographic view.
BACKGROUND: Flat magenta #FF00FF chroma-key background.
CELLS:
1. Antique bonsai ceramic pot (wide flat base)
2. Gnarled twisting ancient trunk and thick branches (no leaves)
3. Background pine needle foliage cluster (softer, darker green)
4. Main midground foliage crown (vibrant emerald needles)
5. Foreground reaching sunny branch and needle spray (bright yellow-green)
Clean transparent edges after chroma-keying.`,
    cellLayout: ['1. Chậu gốm', '2. Thân gỗ uốn', '3. Tán lá sau', '4. Tán lá chính', '5. Nhánh non trước'],
    userGuide: 'Mẫu cây cảnh 5 lớp chiều sâu, dùng chuyển động vật lý đung đưa (sway motion) gió tự nhiên giữa các tầng.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_BONSAI, images, name)
}

// ---------------------------------------------------------------------------
// 2. Bụi Hoa Tự Nhiên Rung Rinh Trong Gió (Nature)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_FLOWER: LayerAssemblyTemplate = {
  id: 'tmpl-nature-flower-bush',
  name: 'Bụi Hoa Thiên Nhiên Đung Đưa Trong Gió',
  nameEn: 'Wildflower Bush (Swaying Petals & Grass)',
  category: 'nature',
  ageGroup: 'plant',
  description: 'Bụi hoa nhiều lớp gồm cụm cỏ nền, thân cành hoa uốn lượn, cánh hoa đỏ tươi nở rộ và nhụy hoa vàng rực đung đưa theo gió sinh động.',
  descriptionEn: 'Layered botanical flower bush with grass background, curvy stem, red petals and glowing pollen center.',
  width: 500,
  height: 500,
  slots: [
    { id: 'grass-base', name: 'Bụi cỏ xanh nền sau', nameEn: 'Background Grass Clump', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 80, z: 20, scale: 1.1, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 8, anchor: 'bottom', phaseOffset: 0.1 }, suggestedAsset: 'assembly_3d/modular/nature_grass.png', description: 'Cụm cỏ nền phía sau' },
    { id: 'flower-stem', name: 'Thân cành hoa uốn lượn', nameEn: 'Curved Flower Stem', role: 'stem', atlasCell: 2, defaultTransform: { x: -10, y: 10, z: 5, scale: 1.0, rotation: 0 }, defaultMotion: { type: 'sway', speed: 1.1, amplitude: 12, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/nature_flower_stem.png', description: 'Cành hoa dẻo dai' },
    { id: 'flower-petal', name: 'Cánh hoa đỏ tươi xòe nở', nameEn: 'Red Blossom Petals', role: 'petals', atlasCell: 3, defaultTransform: { x: -5, y: -110, z: -18, scale: 0.95, rotation: 2 }, defaultMotion: { type: 'rocking', speed: 1.4, amplitude: 20, anchor: 'center', phaseOffset: 0.6 }, suggestedAsset: 'assembly_3d/modular/nature_flower_petal.png', description: 'Các cánh hoa đỏ bồng bềnh' },
    { id: 'flower-center', name: 'Nhụy hoa vàng rực rỡ', nameEn: 'Golden Flower Center', role: 'center', atlasCell: 4, defaultTransform: { x: -5, y: -110, z: -25, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.2, amplitude: 8, anchor: 'center', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/nature_flower_center.png', description: 'Nhụy hoa trung tâm nhấp nhô' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D parallax botanical flower bush.
BACKGROUND: Flat solid cyan #00FFFF chroma-key background.
CELLS:
1. Lush wild green grass clump base
2. Curving green flower stem with small leaves
3. Open red floral petal arrangement (isolated circle)
4. Glowing golden pollen center pistil / stamen disc
Alpha-ready parts with crisp outlines.`,
    cellLayout: ['1. Bụi cỏ nền', '2. Thân cành hoa', '3. Cánh hoa đỏ', '4. Nhụy vàng'],
    userGuide: 'Tách nền cyan (#00FFFF). Chuyển động gió lắc lư tự nhiên giữa cành hoa và cánh hoa.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_FLOWER, images, name)
}

// ---------------------------------------------------------------------------
// 3. Cửa Sổ Ban Công & Giàn Hoa Rung Rinh (Architecture / Decor)
// ---------------------------------------------------------------------------

export const TMPL_ARCH_WINDOW: LayerAssemblyTemplate = {
  id: 'tmpl-arch-window',
  name: 'Cửa Sổ Ban Công & Giàn Hoa Rung Rinh',
  nameEn: 'Tudor Balcony Window & Flower Planter',
  category: 'architecture',
  ageGroup: 'decor',
  description: 'Khung cửa sổ gỗ Tudor cổ điển châu Âu, kết hợp rèm ren, bồn hoa ban công rực rỡ và nhánh lá cây đung đưa trước gió đón nắng mai.',
  descriptionEn: 'European rustic Tudor wooden window frame, balcony flower box, dangling leafy vines and warm lantern.',
  width: 520,
  height: 580,
  slots: [
    { id: 'window-frame', name: 'Khung cửa sổ Tudor cổ điển', nameEn: 'Wooden Window Frame', role: 'frame', atlasCell: 1, defaultTransform: { x: 0, y: -40, z: 15, scale: 1.0, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'assembly_3d/modular/decor_window.png', description: 'Khung cửa kính chia ô Tudor' },
    { id: 'flower-box', name: 'Hộp hoa ban công rực rỡ', nameEn: 'Balcony Flower Box', role: 'decor', atlasCell: 2, defaultTransform: { x: 0, y: 80, z: -5, scale: 1.05, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.0, amplitude: 5, anchor: 'bottom', phaseOffset: 0.2 }, suggestedAsset: 'assembly_3d/modular/decor_flower_box.png', description: 'Bồn hoa ban công gỗ trồng hoa phong lữ' },
    { id: 'green-leaf', name: 'Nhánh lá cây rung rinh', nameEn: 'Swaying Vine Leaves', role: 'nature', atlasCell: 3, defaultTransform: { x: 90, y: 40, z: -18, scale: 0.8, rotation: 25 }, defaultMotion: { type: 'sway', speed: 1.3, amplitude: 16, anchor: 'bottom', phaseOffset: 0.5 }, suggestedAsset: 'assembly_3d/modular/nature_leaf.png', description: 'Dây lá vươn ngoài bồn hoa đung đưa' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D architectural window and balcony cutout.
BACKGROUND: Flat magenta #FF00FF chroma-key background.
CELLS:
1. Tudor medieval wooden window frame with leaded glass panes
2. Rustic wooden window flower box overflowing with colorful geraniums
3. Dangling green ivy leaves branch spray
Crisp architectural and botanical silhouettes.`,
    cellLayout: ['1. Khung cửa sổ', '2. Bồn hoa ban công', '3. Dây leo đung đưa'],
    userGuide: 'Mẫu kiến trúc cửa sổ ban công 3 lớp, tạo cảm giác chiều sâu ngôi nhà cổ tích.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ARCH_WINDOW, images, name)
}

// ---------------------------------------------------------------------------
// 4. Cổng Tàn Tích Cổ & Dây Leo Đom Đóm (Architecture / Nature)
// ---------------------------------------------------------------------------

export const TMPL_ARCH_RUINS: LayerAssemblyTemplate = {
  id: 'tmpl-arch-ruins',
  name: 'Cổng Tàn Tích Cổ & Dây Leo Đom Đóm',
  nameEn: 'Ancient Overgrown Ruins & Fireflies',
  category: 'architecture',
  ageGroup: 'decor',
  description: 'Vòm cổng đá tàn tích rêu phong cổ xưa, dây leo xanh rủ đung đưa phía tiền cảnh và đàn đom đóm lấp lánh huyền ảo.',
  descriptionEn: 'Mystical overgrown ancient stone ruins with dangling foreground creepers and floating glowing fireflies.',
  width: 600,
  height: 650,
  slots: [
    { id: 'ruins-gate', name: 'Cổng đá tàn tích cổ rêu phong', nameEn: 'Ancient Stone Portal', role: 'gate', atlasCell: 1, defaultTransform: { x: 0, y: 40, z: 15, scale: 1.0, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'demo_transparent/layer4_ancient_ruins.png', description: 'Vách cổng vòm đá cổ kính' },
    { id: 'vines-front', name: 'Dây leo rủ tiền cảnh (Z=-20)', nameEn: 'Hanging Foreground Vines', role: 'vines', atlasCell: 2, defaultTransform: { x: 0, y: -60, z: -20, scale: 1.05, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 18, anchor: 'top', phaseOffset: 0.1 }, suggestedAsset: 'demo_transparent/layer5_foreground_vines.png', description: 'Dây leo xanh đung đưa đỉnh cổng' },
    { id: 'fireflies', name: 'Đom đóm lấp lánh huyền ảo', nameEn: 'Sparkling Fireflies', role: 'vfx', atlasCell: 3, defaultTransform: { x: -30, y: -30, z: -35, scale: 1.2, rotation: 0 }, defaultMotion: { type: 'float', speed: 1.2, amplitude: 14, anchor: 'center', phaseOffset: 0.5 }, description: 'Hiệu ứng hạt đom đóm lơ lửng' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 SPRITE ATLAS for 2D mystical ruins parallax cutout.
BACKGROUND: Flat black or green #00FF00 chroma-key.
CELLS:
1. Ancient crumbling stone archway covered in moss and cracks
2. Long hanging jungle vine creepers from top edge
3. Swarm of tiny glowing yellow mystical fireflies particles
Watertight transparent cutouts.`,
    cellLayout: ['1. Vòm cổng đá', '2. Dây leo rủ', '3. Hạt đom đóm'],
    userGuide: 'Mẫu cảnh không gian chiều sâu kỳ ảo kết hợp giữa công trình kiến trúc và dây leo thiên nhiên đung đưa.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_ARCH_RUINS, images, name)
}

export const NATURE_PROP_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_NATURE_BONSAI,
  TMPL_NATURE_FLOWER,
  TMPL_ARCH_WINDOW,
  TMPL_ARCH_RUINS
]
