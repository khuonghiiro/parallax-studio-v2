import { createTemplateComposite } from './templateBuilder'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'

// ---------------------------------------------------------------------------
// 1. Cây Đại Thụ Bóc Tách — Đổi Tán Lá Xanh / Vàng / Hoa / Quả (Giữ riêng tài nguyên theo mẫu)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_MODULAR_TREE: LayerAssemblyTemplate = {
  id: 'tmpl-nature-modular-tree',
  name: 'Cây Đại Thụ Bóc Tách (Đổi Tán Lá Xanh / Vàng / Hoa / Quả)',
  nameEn: 'Modular Canopy Tree (Swappable Green/Gold Leaves, Flowers & Fruits)',
  category: 'nature',
  ageGroup: 'plant',
  description:
    'Cây cổ thụ 2.5D bóc tách kèm toàn bộ các layer biến thể mùa thu & hoa anh đào riêng biệt bên trong dự án: Gốc rễ rêu phong, Thân gỗ & Cành nhánh, 3 tầng Tán lá Xanh (kèm 3 tầng Tán lá Vàng & Sakura ẩn sẵn để bật/tắt đổi mùa ngay trong tab Layer), Hoa nở và Quả táo đỏ.',
  descriptionEn:
    'Modular tree with roots, trunk & branches, 3 depth-layered green foliage canopies, plus private pre-aligned autumn gold and sakura canopy variant layers, blossom overlay, and red apple fruit overlay.',
  width: 550,
  height: 600,
  slots: [
    { id: 'tree-roots', name: '1. Gốc rễ & Thảm cỏ rêu (Đế tĩnh)', nameEn: 'Tree Roots & Mossy Ground', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 158, z: 14, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/tree_roots_moss.png', description: 'Gốc rễ bám đất và thảm cỏ rêu cố định dưới mặt đất' },
    { id: 'tree-foliage-back', name: '2. Tán lá xanh hậu cảnh (Z=+35)', nameEn: 'Background Green Canopy', role: 'back-foliage', atlasCell: 2, defaultTransform: { x: 0, y: -92, z: 35, scale: 1.16, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_green.png', description: 'Tán lá xanh lớp sau cùng (Z=+35)' },
    { id: 'tree-foliage-back-gold', name: '2B. Tán lá vàng hậu cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Background Autumn Gold Canopy', role: 'back-foliage-alt', atlasCell: 8, defaultTransform: { x: 0, y: -92, z: 34, scale: 1.16, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_gold.png', description: 'Biến thể tán lá vàng hậu cảnh thuộc riêng mẫu Cây Đại Thụ' },
    { id: 'tree-trunk', name: '3. Thân gỗ đại thụ & Cành nhánh', nameEn: 'Main Trunk & Branches', role: 'trunk', atlasCell: 3, defaultTransform: { x: 0, y: 42, z: 4, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'nature_modular/tree_trunk_branches.png', description: 'Thân cây gỗ sồi và các nhánh lớn vươn lên đỡ tán lá' },
    { id: 'tree-foliage-mid', name: '4. Tán lá xanh trung cảnh (Z=-5)', nameEn: 'Midground Green Canopy', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: 0, y: -78, z: -5, scale: 1.04, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_green.png', description: 'Tán lá xanh chính giữa thân cây' },
    { id: 'tree-foliage-mid-gold', name: '4B. Tán lá vàng trung cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Midground Autumn Gold Canopy', role: 'mid-foliage-alt', atlasCell: 9, defaultTransform: { x: 0, y: -78, z: -6, scale: 1.04, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_gold.png', description: 'Biến thể tán lá vàng trung cảnh thuộc riêng mẫu Cây Đại Thụ' },
    { id: 'tree-foliage-mid-sakura', name: '4C. Tán hoa anh đào Sakura trung cảnh (Ẩn sẵn)', nameEn: 'Midground Pink Sakura Canopy', role: 'mid-foliage-sakura', atlasCell: 10, defaultTransform: { x: 0, y: -78, z: -7, scale: 1.04, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_sakura.png', description: 'Biến thể tán hoa anh đào hồng thuộc riêng mẫu Cây Đại Thụ' },
    { id: 'tree-foliage-front', name: '5. Tán lá xanh tiền cảnh đón nắng (Z=-25)', nameEn: 'Foreground Sunlit Green Canopy', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 0, y: -108, z: -25, scale: 0.86, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_green.png', description: 'Tán lá non phía trước đón nắng' },
    { id: 'tree-foliage-front-gold', name: '5B. Tán lá vàng tiền cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Foreground Autumn Gold Canopy', role: 'front-foliage-alt', atlasCell: 11, defaultTransform: { x: 0, y: -108, z: -26, scale: 0.86, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_gold.png', description: 'Biến thể tán lá vàng tiền cảnh thuộc riêng mẫu Cây Đại Thụ' },
    { id: 'tree-blossoms', name: '6. Layer Hoa nở trắng hồng (Bật/Tắt)', nameEn: 'Blossom Flowers Overlay', role: 'flowers', atlasCell: 6, defaultTransform: { x: 0, y: -88, z: -35, scale: 0.88, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.42 }, suggestedAsset: 'nature_modular/tree_blossoms_cluster.png', description: 'Chùm hoa nở trên tán cây — có thể ẩn đi nếu chỉ muốn cây lá thuần túy' },
    { id: 'tree-fruits', name: '7. Layer Quả táo đỏ chín mọng (Bật/Tắt)', nameEn: 'Red Apples Fruit Overlay', role: 'fruits', atlasCell: 7, defaultTransform: { x: 0, y: -68, z: -42, scale: 0.56, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }, suggestedAsset: 'nature_modular/tree_fruits_apples.png', description: 'Chùm quả táo đỏ đung đưa trên cành — có thể ẩn/hiện tuỳ mùa' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D animated lush oak/fruit tree with swappable seasonal canopy layers, roots, bare trunk with branches, 3 depth-layered foliage canopies, blossoms, and fruits.`,
    cellLayout: [],
    userGuide: 'Toàn bộ tài nguyên tán lá xanh, tán lá vàng mùa thu, hoa anh đào và quả chín đều được đóng gói riêng (private) bên trong mẫu Cây Đại Thụ Bóc Tách.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_MODULAR_TREE, images, name)
}

// ---------------------------------------------------------------------------
// 2. Cụm Đá Rêu Phong & Tinh Thể Bóc Tách — Đổi Rêu Xanh / Tuyết Phủ (Private Assets)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_MODULAR_ROCK: LayerAssemblyTemplate = {
  id: 'tmpl-nature-modular-rock',
  name: 'Cụm Đá Rêu Phong & Tinh Thể Bóc Tách (Đổi Rêu / Tuyết)',
  nameEn: 'Modular Boulder, Moss/Snow Cap & Glowing Crystals',
  category: 'nature',
  ageGroup: 'plant',
  description:
    'Cụm đá tảng thiên nhiên bóc tách kèm các layer riêng biệt trong dự án: Đế đất cỏ, Cụm tinh thể phát sáng hậu cảnh, Khối đá tảng chính, Lớp phủ Rêu xanh, Lớp phủ Tuyết trắng mùa đông (ẩn sẵn), Đá cuội tiền cảnh và Khóm hoa dại.',
  descriptionEn:
    'Modular rock formation with ground base, glowing crystals, main boulder, green moss cap, private toggleable winter snow cap, front pebbles, and wildflowers.',
  width: 500,
  height: 460,
  slots: [
    { id: 'rock-ground', name: '1. Đế đất & Thảm cỏ chân đá', nameEn: 'Ground Soil & Grass Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 105, z: 15, scale: 0.98, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_base_ground.png', description: 'Nền đất và cỏ dưới chân cụm đá' },
    { id: 'rock-crystals', name: '2. Cụm tinh thể phát sáng (Bật/Tắt)', nameEn: 'Glowing Cyan Crystals', role: 'vfx', atlasCell: 2, defaultTransform: { x: 62, y: -32, z: 18, scale: 0.78, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.2, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.2 }, suggestedAsset: 'nature_modular/rock_crystal_glow.png', description: 'Tinh thể năng lượng mọc sau tảng đá — có thể ẩn đi nếu làm đá thường' },
    { id: 'rock-main', name: '3. Khối đá tảng chính góc cạnh', nameEn: 'Main Faceted Boulder', role: 'body', atlasCell: 3, defaultTransform: { x: 0, y: 18, z: 0, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_boulder_main.png', description: 'Tảng đá lớn trung tâm' },
    { id: 'rock-cap', name: '4. Lớp phủ Rêu xanh đỉnh đá', nameEn: 'Green Moss Cap', role: 'cap', atlasCell: 4, defaultTransform: { x: 0, y: -54, z: -8, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'nature_modular/rock_moss_cap.png', description: 'Lớp rêu xanh phủ mặt trên tảng đá' },
    { id: 'rock-snow-cap', name: '4B. Lớp phủ Tuyết trắng mùa đông (Ẩn sẵn - Bật để đổi mùa)', nameEn: 'Winter White Snow Cap', role: 'cap-snow', atlasCell: 7, defaultTransform: { x: 0, y: -54, z: -9, scale: 0.82, rotation: 0, hidden: true }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'nature_modular/rock_snow_cap.png', description: 'Lớp tuyết trắng phủ đỉnh đá thuộc riêng mẫu Cụm Đá Rêu Phong' },
    { id: 'rock-pebbles', name: '5. Cụm đá cuội tiền cảnh (Z=-20)', nameEn: 'Foreground Pebbles & Stones', role: 'front', atlasCell: 5, defaultTransform: { x: -28, y: 82, z: -20, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_stones_front.png', description: 'Các viên đá nhỏ xếp lớp phía trước tạo chiều sâu 2.5D' },
    { id: 'rock-flowers', name: '6. Khóm hoa dại & Dương xỉ đung đưa', nameEn: 'Swaying Wildflowers & Ferns', role: 'flowers', atlasCell: 6, defaultTransform: { x: 36, y: 68, z: -28, scale: 0.58, rotation: 0 }, defaultMotion: { type: 'sway', speed: 1.1, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'nature_modular/rock_wildflowers.png', description: 'Hoa dại mọc ven chân đá đung đưa theo gió' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D modular rock formation with ground soil base, glowing cyan crystal cluster, main faceted boulder, green moss cap, winter snow cap, foreground pebbles, and wildflowers.`,
    cellLayout: [],
    userGuide: 'Toàn bộ tài nguyên tảng đá, rêu xanh, tuyết phủ và tinh thể phát sáng được đóng gói riêng (private) bên trong mẫu Cụm Đá Rêu Phong.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_MODULAR_ROCK, images, name)
}

// ---------------------------------------------------------------------------
// 3. Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp (Private Assets)
// ---------------------------------------------------------------------------

export const TMPL_NATURE_BONSAI: LayerAssemblyTemplate = {
  id: 'tmpl-nature-bonsai',
  name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp',
  nameEn: 'Zen Bonsai Tree (5-Depth Layers)',
  category: 'nature',
  ageGroup: 'plant',
  description:
    'Nghệ thuật Bonsai phân tách 5 tầng chiều sâu: Chậu gốm Tử Sa viền đồng, Thân gỗ uốn khúc, Tán sau mờ xa, Tán chính ngọc bích và Tán trước đón nắng.',
  descriptionEn:
    'Multi-depth Japanese bonsai tree featuring ceramic pot, gnarled twisted trunk and 3 organic wind-swayed foliage layers.',
  width: 550,
  height: 600,
  slots: [
    { id: 'bonsai-foliage-back', name: 'Tán lá tùng sau (Hậu cảnh Z=+35)', nameEn: 'Background Foliage', role: 'back-foliage', atlasCell: 3, defaultTransform: { x: 4, y: -28, z: 35, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_back.png', description: 'Tán lá phía sau tạo chiều sâu' },
    { id: 'bonsai-pot', name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)', nameEn: 'Ceramic Pot Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 168, z: 12, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'assembly_3d/modular/bonsai_pot.png', description: 'Chậu gốm cổ điển đế vững' },
    { id: 'bonsai-trunk', name: 'Thân cổ thụ uốn lượn phong trần', nameEn: 'Gnarled Wood Trunk', role: 'trunk', atlasCell: 2, defaultTransform: { x: 0, y: -38, z: 0, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'assembly_3d/modular/bonsai_trunk.png', description: 'Thân gỗ uốn lượn đung đưa gốc' },
    { id: 'bonsai-foliage-mid', name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=-4)', nameEn: 'Midground Foliage', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: -4, y: -18, z: -4, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_mid.png', description: 'Tán lá chính giữa thân cây' },
    { id: 'bonsai-foliage-front', name: 'Nhánh non vươn nắng (Tiền cảnh Z=-28)', nameEn: 'Foreground Foliage', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 10, y: -8, z: -28, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_front.png', description: 'Tán lá non vươn về phía trước' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Ancient Japanese Juniper / Pine Bonsai in antique dark clay pot with bronze rim, gnarled trunk, and 3 depth-separated foliage layers.`,
    cellLayout: [],
    userGuide: 'Mẫu cây cảnh 5 lớp chiều sâu với bộ tài nguyên riêng biệt theo dự án, dùng chuyển động vật lý đung đưa (sway motion) gió tự nhiên.'
  },
  buildComposite: (images, name) => createTemplateComposite(TMPL_NATURE_BONSAI, images, name)
}

export const NATURE_PROP_TEMPLATES: LayerAssemblyTemplate[] = [
  TMPL_NATURE_MODULAR_TREE,
  TMPL_NATURE_MODULAR_ROCK,
  TMPL_NATURE_BONSAI
]
