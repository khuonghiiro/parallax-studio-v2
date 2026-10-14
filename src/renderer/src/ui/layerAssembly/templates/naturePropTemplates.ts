import { createTemplateComposite } from './templateBuilder'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'

// ---------------------------------------------------------------------------
// 0A. Cây Đại Thụ Bóc Tách 7 Lớp — Đổi Tán Lá Xanh / Lá Vàng / Hoa / Quả
// ---------------------------------------------------------------------------

export const TMPL_NATURE_MODULAR_TREE: LayerAssemblyTemplate = {
  id: 'tmpl-nature-modular-tree',
  name: 'Cây Đại Thụ Bóc Tách (Đổi Tán Lá Xanh / Vàng / Hoa / Quả)',
  nameEn: 'Modular Canopy Tree (Swappable Green/Gold Leaves, Flowers & Fruits)',
  category: 'nature',
  ageGroup: 'plant',
  description: 'Cây cổ thụ 2.5D bóc tách 7 layer độc lập: Gốc rễ rêu phong, Thân gỗ & Cành nhánh, 3 tầng Tán lá (dễ dàng đổi từ tán lá xanh sang tán lá vàng mùa thu hoặc hoa anh đào), kèm Layer Hoa nở và Layer Quả táo đỏ có thể bật/tắt tuỳ ý.',
  descriptionEn: '7-layer modular tree with roots, trunk & branches, 3 depth-layered foliage canopies (swappable between green, autumn gold, and sakura), plus toggleable blossom and red apple fruit layers.',
  width: 550,
  height: 600,
  slots: [
    { id: 'tree-roots', name: '1. Gốc rễ & Thảm cỏ rêu (Đế tĩnh)', nameEn: 'Tree Roots & Mossy Ground', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 150, z: -5, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/tree_roots_moss.png', description: 'Gốc rễ bám đất và thảm cỏ rêu cố định dưới mặt đất' },
    { id: 'tree-foliage-back', name: '2. Tán lá hậu cảnh (Đổi Xanh / Vàng)', nameEn: 'Background Canopy (Green/Gold)', role: 'back-foliage', atlasCell: 2, defaultTransform: { x: 0, y: -62, z: 35, scale: 1.15, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_green.png', description: 'Tán lá lớp sau cùng (Z=+35). Có thể đổi sang tree_foliage_back_gold.png' },
    { id: 'tree-trunk', name: '3. Thân gỗ đại thụ & Cành nhánh', nameEn: 'Main Trunk & Branches', role: 'trunk', atlasCell: 3, defaultTransform: { x: 0, y: 46, z: 12, scale: 0.78, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'nature_modular/tree_trunk_branches.png', description: 'Thân cây gỗ sồi và các nhánh lớn vươn lên đỡ tán lá' },
    { id: 'tree-foliage-mid', name: '4. Tán lá trung cảnh (Đổi Xanh / Vàng / Sakura)', nameEn: 'Midground Canopy (Green/Gold/Sakura)', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: 0, y: -74, z: -5, scale: 1.05, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_green.png', description: 'Tán lá chính giữa (dễ dàng đổi sang tree_foliage_mid_gold.png hoặc tree_foliage_mid_sakura.png)' },
    { id: 'tree-foliage-front', name: '5. Tán lá tiền cảnh đón nắng (Đổi Xanh / Vàng)', nameEn: 'Foreground Sunlit Canopy', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 0, y: -102, z: -25, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_green.png', description: 'Tán lá non phía trước đón nắng (có thể đổi sang tree_foliage_front_gold.png)' },
    { id: 'tree-blossoms', name: '6. Layer Hoa nở trắng hồng (Bật/Tắt)', nameEn: 'Blossom Flowers Overlay', role: 'flowers', atlasCell: 6, defaultTransform: { x: 0, y: -78, z: -35, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.42 }, suggestedAsset: 'nature_modular/tree_blossoms_cluster.png', description: 'Chùm hoa nở trên tán cây — có thể ẩn đi nếu chỉ muốn cây lá thuần túy' },
    { id: 'tree-fruits', name: '7. Layer Quả táo đỏ chín mọng (Bật/Tắt)', nameEn: 'Red Apples Fruit Overlay', role: 'fruits', atlasCell: 7, defaultTransform: { x: 0, y: -55, z: -42, scale: 0.68, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }, suggestedAsset: 'nature_modular/tree_fruits_apples.png', description: 'Chùm quả táo đỏ đung đưa trên cành — có thể ẩn/hiện tuỳ mùa' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 MODULAR TREE SPRITE ATLAS for 2.5D parallax animation.
IDENTITY: Stylized 2D animated lush oak/fruit tree with swappable seasonal canopy layers.
BACKGROUND: Flat solid green #00FF00 or magenta #FF00FF chroma-key background.
CELLS:
1. Tree roots and mossy grass ground base
2. Bare wooden trunk with spreading main branches (no leaves baked on trunk)
3. Background dark foliage canopy silhouette (Green or Autumn Gold)
4. Midground main leafy canopy cluster (Green, Autumn Gold, or Pink Sakura)
5. Foreground sunlit leaf clusters (Green or Bright Gold)
6. Isolated flower blossoms cluster overlay (fits over canopy)
7. Isolated hanging red apples / fruits overlay (fits over canopy)
CRITICAL: Keep trunk, foliage canopies, flowers, and fruits completely separated in their own cells so the animator can swap green leaves for golden autumn leaves or toggle flowers/fruits on and off.`,
    cellLayout: [
      '1. Gốc rễ & thảm cỏ',
      '2. Tán lá hậu cảnh (Xanh/Vàng)',
      '3. Thân gỗ & cành nhánh',
      '4. Tán lá trung cảnh (Xanh/Vàng/Sakura)',
      '5. Tán lá tiền cảnh (Xanh/Vàng)',
      '6. Chùm hoa nở tách rời',
      '7. Chùm quả chín tách rời'
    ],
    userGuide: 'Thiết kế bóc tách chuẩn Studio: Khi muốn đổi cây mùa xuân/hạ sang cây mùa thu lá vàng, bạn chỉ cần chọn 3 layer Tán lá và đổi ảnh sang bộ Tán Lá Vàng (tree_foliage_*_gold.png) trong mục Cây cối & Đá bóc tách, hoặc ẩn/hiện layer Hoa và Quả chỉ với 1 cú nhấp chuột.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_MODULAR_TREE, images, name)
}

// ---------------------------------------------------------------------------
// 0B. Cây Đại Thụ Mùa Thu — Tán Lá Vàng Rực & Quả Chín (Biến thể đổi sẵn)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_AUTUMN_TREE: LayerAssemblyTemplate = {
  id: 'tmpl-nature-autumn-tree',
  name: 'Cây Đại Thụ Mùa Thu (Tán Lá Vàng Cam & Quả Chín)',
  nameEn: 'Autumn Golden Tree (Swapped Gold Canopy & Fruits)',
  category: 'nature',
  ageGroup: 'plant',
  description: 'Biến thể mùa thu của Cây Đại Thụ Bóc Tách: giữ nguyên gốc rễ và thân cành nhưng thay 3 lớp tán lá xanh bằng 3 lớp tán lá vàng cam rực rỡ kèm quả chín.',
  descriptionEn: 'Autumn variant using the exact same modular trunk and roots paired with golden-amber foliage layers and ripe fruits.',
  width: 550,
  height: 600,
  slots: [
    { id: 'tree-roots', name: '1. Gốc rễ & Thảm cỏ rêu', nameEn: 'Tree Roots & Mossy Ground', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 150, z: -5, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/tree_roots_moss.png', description: 'Gốc rễ bám đất cố định' },
    { id: 'tree-foliage-back', name: '2. Tán lá vàng hậu cảnh (Z=+35)', nameEn: 'Autumn Back Canopy', role: 'back-foliage', atlasCell: 2, defaultTransform: { x: 0, y: -62, z: 35, scale: 1.15, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_gold.png', description: 'Tán lá cam sẫm phía sau' },
    { id: 'tree-trunk', name: '3. Thân gỗ đại thụ & Cành nhánh', nameEn: 'Main Trunk & Branches', role: 'trunk', atlasCell: 3, defaultTransform: { x: 0, y: 46, z: 12, scale: 0.78, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'nature_modular/tree_trunk_branches.png', description: 'Thân cây gỗ sồi và cành lớn' },
    { id: 'tree-foliage-mid', name: '4. Tán lá vàng trung cảnh (Z=-5)', nameEn: 'Autumn Mid Canopy', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: 0, y: -74, z: -5, scale: 1.05, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_gold.png', description: 'Tán lá vàng hổ phách trung cảnh' },
    { id: 'tree-foliage-front', name: '5. Tán lá vàng tiền cảnh (Z=-25)', nameEn: 'Autumn Front Canopy', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 0, y: -102, z: -25, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_gold.png', description: 'Tán lá vàng tươi đón nắng thu' },
    { id: 'tree-fruits', name: '6. Layer Quả táo đỏ mùa thu', nameEn: 'Ripe Red Apples', role: 'fruits', atlasCell: 6, defaultTransform: { x: 0, y: -55, z: -38, scale: 0.68, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }, suggestedAsset: 'nature_modular/tree_fruits_apples.png', description: 'Chùm quả chín mọng trên tán lá vàng' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: TMPL_NATURE_MODULAR_TREE.promptGuide,
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_AUTUMN_TREE, images, name)
}

// ---------------------------------------------------------------------------
// 0C. Cụm Đá Rêu Phong & Tinh Thể Bóc Tách — Đổi Rêu Xanh / Tuyết Phủ
// ---------------------------------------------------------------------------

export const TMPL_NATURE_MODULAR_ROCK: LayerAssemblyTemplate = {
  id: 'tmpl-nature-modular-rock',
  name: 'Cụm Đá Rêu Phong & Tinh Thể Bóc Tách (Đổi Rêu / Tuyết)',
  nameEn: 'Modular Boulder, Moss/Snow Cap & Glowing Crystals',
  category: 'nature',
  ageGroup: 'plant',
  description: 'Cụm đá tảng thiên nhiên bóc tách 6 layer: Đế đất cỏ, Cụm tinh thể phát sáng hậu cảnh, Khối đá tảng chính, Lớp phủ đỉnh đá (đổi giữa Rêu xanh hoặc Tuyết trắng), Đá cuội tiền cảnh và Khóm hoa dại.',
  descriptionEn: '6-layer modular rock formation with ground base, glowing crystals, main boulder, swappable moss/snow cap, front pebbles, and wildflowers.',
  width: 500,
  height: 460,
  slots: [
    { id: 'rock-ground', name: '1. Đế đất & Thảm cỏ chân đá', nameEn: 'Ground Soil & Grass Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 105, z: 15, scale: 0.98, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_base_ground.png', description: 'Nền đất và cỏ dưới chân cụm đá' },
    { id: 'rock-crystals', name: '2. Cụm tinh thể phát sáng (Bật/Tắt)', nameEn: 'Glowing Cyan Crystals', role: 'vfx', atlasCell: 2, defaultTransform: { x: 62, y: -32, z: 18, scale: 0.78, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.2, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.2 }, suggestedAsset: 'nature_modular/rock_crystal_glow.png', description: 'Tinh thể năng lượng mọc sau tảng đá — có thể ẩn đi nếu làm đá thường' },
    { id: 'rock-main', name: '3. Khối đá tảng chính góc cạnh', nameEn: 'Main Faceted Boulder', role: 'body', atlasCell: 3, defaultTransform: { x: 0, y: 18, z: 0, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_boulder_main.png', description: 'Tảng đá lớn trung tâm' },
    { id: 'rock-cap', name: '4. Lớp phủ đỉnh đá (Đổi Rêu xanh / Tuyết trắng)', nameEn: 'Swappable Moss or Snow Cap', role: 'cap', atlasCell: 4, defaultTransform: { x: 0, y: -54, z: -8, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'nature_modular/rock_moss_cap.png', description: 'Lớp rêu xanh phủ mặt trên tảng đá — đổi sang rock_snow_cap.png để biến thành cảnh mùa đông' },
    { id: 'rock-pebbles', name: '5. Cụm đá cuội tiền cảnh (Z=-20)', nameEn: 'Foreground Pebbles & Stones', role: 'front', atlasCell: 5, defaultTransform: { x: -28, y: 82, z: -20, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_stones_front.png', description: 'Các viên đá nhỏ xếp lớp phía trước tạo chiều sâu 2.5D' },
    { id: 'rock-flowers', name: '6. Khóm hoa dại & Dương xỉ đung đưa', nameEn: 'Swaying Wildflowers & Ferns', role: 'flowers', atlasCell: 6, defaultTransform: { x: 36, y: 68, z: -28, scale: 0.58, rotation: 0 }, defaultMotion: { type: 'sway', speed: 1.1, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'nature_modular/rock_wildflowers.png', description: 'Hoa dại mọc ven chân đá đung đưa theo gió' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `Create ONE high-resolution 4096x4096 MODULAR ROCK & ENVIRONMENT SPRITE ATLAS for 2.5D parallax scene building.
BACKGROUND: Flat solid green #00FF00 chroma-key background.
CELLS:
1. Earthy ground mound and grass base
2. Glowing cyan magic crystal cluster (optional back attachment)
3. Large stylized faceted stone boulder (bare rock without moss)
4. Swappable top surface cap (Lush green moss cap OR winter white snow cap fitting the boulder top)
5. Smaller foreground stones and pebbles cluster
6. Wildflowers and fern fronds cluster for foreground base`,
    cellLayout: [
      '1. Đế đất & cỏ',
      '2. Tinh thể phát sáng',
      '3. Tảng đá chính',
      '4. Lớp phủ Rêu xanh / Tuyết trắng',
      '5. Đá cuội tiền cảnh',
      '6. Hoa dại & dương xỉ'
    ],
    userGuide: 'Bạn có thể đổi nhanh giữa đá rêu rừng nhiệt đới (rock_moss_cap.png) và đá phủ tuyết mùa đông (rock_snow_cap.png), hoặc bật/tắt cụm tinh thể phát sáng chỉ bằng 1 thao tác.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_MODULAR_ROCK, images, name)
}

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
    { id: 'bonsai-pot', name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)', nameEn: 'Ceramic Pot Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 140, z: -5, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'assembly_3d/modular/bonsai_pot.png', description: 'Chậu gốm cổ điển đế vững' },
    { id: 'bonsai-trunk', name: 'Thân cổ thụ uốn lượn phong trần', nameEn: 'Gnarled Wood Trunk', role: 'trunk', atlasCell: 2, defaultTransform: { x: 0, y: 20, z: 0, scale: 0.75, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'assembly_3d/modular/bonsai_trunk.png', description: 'Thân gỗ uốn lượn đung đưa gốc' },
    { id: 'bonsai-foliage-back', name: 'Tán lá tùng sau (Hậu cảnh Z=+35)', nameEn: 'Background Foliage', role: 'back-foliage', atlasCell: 3, defaultTransform: { x: 5, y: -55, z: 35, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_back.png', description: 'Tán lá phía sau tạo chiều sâu' },
    { id: 'bonsai-foliage-mid', name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=0)', nameEn: 'Midground Foliage', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: -8, y: -78, z: -2, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_mid.png', description: 'Tán lá chính giữa thân cây' },
    { id: 'bonsai-foliage-front', name: 'Nhánh non vươn nắng (Tiền cảnh Z=-30)', nameEn: 'Foreground Foliage', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 18, y: -42, z: -30, scale: 0.75, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_front.png', description: 'Tán lá non vươn về phía trước' }
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
    { id: 'grass-base', name: 'Bụi cỏ xanh nền sau', nameEn: 'Background Grass Clump', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 110, z: 20, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 8, anchor: 'bottom', phaseOffset: 0.1 }, suggestedAsset: 'assembly_3d/modular/nature_grass.png', description: 'Cụm cỏ nền phía sau' },
    { id: 'flower-stem', name: 'Thân cành hoa uốn lượn', nameEn: 'Curved Flower Stem', role: 'stem', atlasCell: 2, defaultTransform: { x: 0, y: 30, z: 5, scale: 0.62, rotation: 0 }, defaultMotion: { type: 'sway', speed: 1.1, amplitude: 12, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/nature_flower_stem.png', description: 'Cành hoa dẻo dai' },
    { id: 'flower-petal', name: 'Cánh hoa đỏ tươi xòe nở', nameEn: 'Red Blossom Petals', role: 'petals', atlasCell: 3, defaultTransform: { x: 4, y: -70, z: -18, scale: 0.22, rotation: 2 }, defaultMotion: { type: 'rocking', speed: 1.4, amplitude: 20, anchor: 'center', phaseOffset: 0.6 }, suggestedAsset: 'assembly_3d/modular/nature_flower_corolla.png', description: 'Các cánh hoa đỏ bồng bềnh' },
    { id: 'flower-center', name: 'Nhụy hoa vàng rực rỡ', nameEn: 'Golden Flower Center', role: 'center', atlasCell: 4, defaultTransform: { x: 4, y: -70, z: -25, scale: 0.20, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.2, amplitude: 8, anchor: 'center', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/nature_flower_center.png', description: 'Nhụy hoa trung tâm nhấp nhô' }
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
    { id: 'window-frame', name: 'Khung cửa sổ Tudor cổ điển', nameEn: 'Wooden Window Frame', role: 'frame', atlasCell: 1, defaultTransform: { x: 0, y: -35, z: 15, scale: 0.62, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'assembly_3d/modular/decor_window.png', description: 'Khung cửa kính chia ô Tudor' },
    { id: 'flower-box', name: 'Hộp hoa ban công rực rỡ', nameEn: 'Balcony Flower Box', role: 'decor', atlasCell: 2, defaultTransform: { x: 0, y: 95, z: -5, scale: 0.56, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.0, amplitude: 5, anchor: 'bottom', phaseOffset: 0.2 }, suggestedAsset: 'assembly_3d/modular/decor_flower_box.png', description: 'Bồn hoa ban công gỗ trồng hoa phong lữ' },
    { id: 'green-leaf', name: 'Nhánh lá cây rung rinh', nameEn: 'Swaying Vine Leaves', role: 'nature', atlasCell: 3, defaultTransform: { x: 118, y: 80, z: -18, scale: 0.28, rotation: 32 }, defaultMotion: { type: 'sway', speed: 1.3, amplitude: 16, anchor: 'bottom', phaseOffset: 0.5 }, suggestedAsset: 'assembly_3d/modular/nature_leaf.png', description: 'Dây lá vươn ngoài bồn hoa đung đưa' }
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
    { id: 'ruins-gate', name: 'Cổng đá tàn tích cổ rêu phong', nameEn: 'Ancient Stone Portal', role: 'gate', atlasCell: 1, defaultTransform: { x: 0, y: 35, z: 15, scale: 0.42, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'demo_transparent/layer4_ancient_ruins.png', description: 'Vách cổng vòm đá cổ kính' },
    { id: 'vines-front', name: 'Dây leo rủ tiền cảnh (Z=-20)', nameEn: 'Hanging Foreground Vines', role: 'vines', atlasCell: 2, defaultTransform: { x: 0, y: -85, z: -20, scale: 0.36, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 18, anchor: 'top', phaseOffset: 0.1 }, suggestedAsset: 'demo_transparent/layer5_foreground_vines.png', description: 'Dây leo xanh đung đưa đỉnh cổng' },
    { id: 'fireflies', name: 'Đom đóm lấp lánh huyền ảo', nameEn: 'Sparkling Fireflies', role: 'vfx', atlasCell: 3, defaultTransform: { x: 0, y: 10, z: -35, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'float', speed: 1.2, amplitude: 14, anchor: 'center', phaseOffset: 0.5 }, suggestedAsset: 'nature_modular/fireflies_glow.png', description: 'Hiệu ứng hạt đom đóm lơ lửng' }
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
  TMPL_NATURE_MODULAR_TREE,
  TMPL_NATURE_AUTUMN_TREE,
  TMPL_NATURE_MODULAR_ROCK,
  TMPL_NATURE_BONSAI,
  TMPL_NATURE_FLOWER,
  TMPL_ARCH_WINDOW,
  TMPL_ARCH_RUINS
]
