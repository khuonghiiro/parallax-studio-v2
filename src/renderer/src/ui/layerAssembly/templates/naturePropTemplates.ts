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
    'Cây cổ thụ 2.5D bóc tách kèm các layer biến thể riêng biệt bên trong dự án: Nền đất & thảm cỏ rêu riêng (không chứa rễ cây, đủ 4 góc cạnh), Thân gỗ đại thụ đi kèm cả bộ rễ cây liền khối, 3 tầng Tán lá Xanh (kèm Tán lá Vàng & Sakura ẩn sẵn), Hoa nở trắng hồng và các layer Quả táo đỏ lẻ tẻ để ghép chồng tạo chùm linh hoạt.',
  descriptionEn:
    'Modular tree with complete unclipped 4-corner pure grassy earth mound (no tree roots), unified oak trunk with upper branches and sprawling gnarled roots in one piece, 3 depth-layered green foliage canopies (plus autumn gold and sakura variants), canopy-conforming blossom clusters, and individual stackable red apple layers.',
  width: 550,
  height: 600,
  slots: [
    { id: 'tree-roots', name: '1. Nền đất & Thảm cỏ rêu (Đế đất riêng, không rễ)', nameEn: 'Pure Mossy & Grassy Ground Mound', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 162, z: 14, scale: 0.92, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/tree_roots_moss.png', description: 'Gò nền đất & thảm cỏ rêu riêng biệt KHÔNG chứa rễ cây hay gốc gỗ, nguyên vẹn đủ 4 góc cạnh (cách lề >=15%, không cắt cụt mép trái/phải/đáy) để đặt thân cây có rễ lên trên luôn khớp tự nhiên' },
    { id: 'tree-foliage-back', name: '2. Tán lá xanh hậu cảnh (Z=+35)', nameEn: 'Background Green Canopy', role: 'back-foliage', atlasCell: 2, defaultTransform: { x: 0, y: -92, z: 35, scale: 1.16, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_green.png', description: 'Tán lá xanh đậm lớp sau cùng (Z=+35) nguyên vẹn 4 góc cạnh cách lề >=12%' },
    { id: 'tree-foliage-back-gold', name: '2B. Tán lá vàng hậu cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Background Autumn Gold Canopy', role: 'back-foliage-alt', atlasCell: 8, defaultTransform: { x: 0, y: -92, z: 34, scale: 1.16, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }, suggestedAsset: 'nature_modular/tree_foliage_back_gold.png', description: 'Biến thể tán lá vàng hậu cảnh đồng bộ chu vi 1:1 với tán lá xanh hậu cảnh' },
    { id: 'tree-trunk', name: '3. Thân gỗ đại thụ & Bộ rễ cây liền khối', nameEn: 'Main Trunk, Branches & Gnarled Roots', role: 'trunk', atlasCell: 3, defaultTransform: { x: 0, y: 36, z: 4, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'nature_modular/tree_trunk_branches.png', description: 'Thân cây gỗ sồi liền khối đồng bộ nét vẽ từ ngọn cành mảnh mai phía trên xuống thân chính và bộ rễ cây xoè rộng dưới gốc (tách nền sắc nét, không ăn lẹm viền sáng)' },
    { id: 'tree-foliage-mid', name: '4. Tán lá xanh trung cảnh (Z=-5)', nameEn: 'Midground Green Canopy', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: 0, y: -78, z: -5, scale: 1.04, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_green.png', description: 'Vòm tán lá xanh chính giữa thân cây dạng cụm mây nhiều múi nguyên vẹn đủ 4 góc cạnh' },
    { id: 'tree-foliage-mid-gold', name: '4B. Tán lá vàng trung cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Midground Autumn Gold Canopy', role: 'mid-foliage-alt', atlasCell: 9, defaultTransform: { x: 0, y: -78, z: -6, scale: 1.04, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_gold.png', description: 'Biến thể tán lá vàng trung cảnh đồng bộ vòm tán 1:1 với tán lá xanh trung cảnh' },
    { id: 'tree-foliage-mid-sakura', name: '4C. Tán hoa anh đào Sakura trung cảnh (Ẩn sẵn)', nameEn: 'Midground Pink Sakura Canopy', role: 'mid-foliage-sakura', atlasCell: 10, defaultTransform: { x: 0, y: -78, z: -7, scale: 1.04, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'nature_modular/tree_foliage_mid_sakura.png', description: 'Biến thể tán hoa anh đào hồng trung cảnh đồng bộ vòm tán 1:1' },
    { id: 'tree-foliage-front', name: '5. Tán lá xanh tiền cảnh đón nắng (Z=-25)', nameEn: 'Foreground Sunlit Green Canopy', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 0, y: -108, z: -25, scale: 0.86, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_green.png', description: 'Tán lá non phía trước đón nắng xếp lớp tạo chiều sâu 2.5D' },
    { id: 'tree-foliage-front-gold', name: '5B. Tán lá vàng tiền cảnh (Ẩn sẵn - Bật để đổi mùa thu)', nameEn: 'Foreground Autumn Gold Canopy', role: 'front-foliage-alt', atlasCell: 11, defaultTransform: { x: 0, y: -108, z: -26, scale: 0.86, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'nature_modular/tree_foliage_front_gold.png', description: 'Biến thể tán lá vàng tiền cảnh đồng bộ vòm tán 1:1' },
    { id: 'tree-blossoms', name: '6. Layer Hoa nở trắng hồng (Bật/Tắt)', nameEn: 'Blossom Flowers Overlay', role: 'flowers', atlasCell: 6, defaultTransform: { x: 0, y: -88, z: -35, scale: 0.92, rotation: 0, hidden: true }, defaultMotion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.42 }, suggestedAsset: 'nature_modular/tree_blossoms_cluster.png', description: '6–8 cụm hoa 5 cánh trắng hồng phân bố trải đều theo đúng vòm đám mây của tán lá trung/tiền cảnh, cài lá đệm cùng tông xanh tán cây, không lộ cành bụi phía dưới' },
    { id: 'tree-fruits', name: '7A. Quả táo đỏ lẻ #1 (Hướng thẳng - Cụm trái)', nameEn: 'Single Ripe Red Apple #1 (Upright Pose)', role: 'fruits', atlasCell: 7, defaultTransform: { x: -78, y: -96, z: -40, scale: 0.3, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }, suggestedAsset: 'nature_modular/tree_fruits_apples.png', description: 'Quả táo đỏ chín mọng tư thế thẳng chính diện kèm cuống & lá xanh vươn sang phải (cách lề >=20%)' },
    { id: 'tree-fruits-2', name: '7B. Quả táo đỏ lẻ #2 (Nghiêng trái 3/4 - Ghép chùm trái)', nameEn: 'Single Ripe Red Apple #2 (Tilted Left 3/4 Pose)', role: 'fruits', atlasCell: 12, defaultTransform: { x: -54, y: -84, z: -42, scale: 0.31, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.55 }, suggestedAsset: 'nature_modular/tree_fruit_apple_tilt_left.png', description: 'Quả táo đỏ tư thế nghiêng trái ~30° góc 3/4 kèm 2 lá vươn lên trái, ghép chồng cạnh quả #1 tạo độ đa dạng tự nhiên' },
    { id: 'tree-fruits-3', name: '7C. Quả táo đỏ lẻ #3 (Nghiêng phải - Ghép chùm trái)', nameEn: 'Single Ripe Red Apple #3 (Tilted Right Pose)', role: 'fruits', atlasCell: 13, defaultTransform: { x: -66, y: -70, z: -44, scale: 0.29, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.35 }, suggestedAsset: 'nature_modular/tree_fruit_apple_tilt_right.png', description: 'Quả táo đỏ tư thế nghiêng phải ~25° kèm 3 lá xoè phía trên, ghép cùng quả #1 và #2 tạo thành chùm 3 quả thật mắt' },
    { id: 'tree-fruits-4', name: '7D. Quả táo đỏ lẻ #4 (Nghiêng trái 3/4 - Đỉnh tán)', nameEn: 'Single Ripe Red Apple #4 (Tilted Left Top Canopy)', role: 'fruits', atlasCell: 14, defaultTransform: { x: -6, y: -152, z: -41, scale: 0.29, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.6 }, suggestedAsset: 'nature_modular/tree_fruit_apple_tilt_left.png', description: 'Quả táo đỏ góc nghiêng trái điểm xuyết trên múi tán lá đỉnh cây' },
    { id: 'tree-fruits-5', name: '7E. Quả táo đỏ lẻ #5 (Hướng thẳng - Cụm phải)', nameEn: 'Single Ripe Red Apple #5 (Upright Right Canopy)', role: 'fruits', atlasCell: 15, defaultTransform: { x: 56, y: -104, z: -40, scale: 0.3, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.65 }, suggestedAsset: 'nature_modular/tree_fruits_apples.png', description: 'Quả táo đỏ tư thế thẳng bên múi tán lá phải' },
    { id: 'tree-fruits-6', name: '7F. Quả táo đỏ lẻ #6 (Nghiêng phải - Ghép chùm phải)', nameEn: 'Single Ripe Red Apple #6 (Tilted Right Cluster)', role: 'fruits', atlasCell: 16, defaultTransform: { x: 78, y: -90, z: -43, scale: 0.31, rotation: 0 }, defaultMotion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.45 }, suggestedAsset: 'nature_modular/tree_fruit_apple_tilt_right.png', description: 'Quả táo đỏ tư thế nghiêng phải ghép chồng cạnh quả #5 tạo chùm quả tự nhiên bên phải tán cây' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D animated lush oak/fruit tree with a standalone 4-corner unclipped mossy grass ground mound (no tree roots on the ground layer), a 100% unified wooden oak trunk that includes spreading upper branches and sprawling gnarled roots in one single consistent hand-painted artwork, 3 depth-layered cloud-like foliage canopies (plus autumn gold and pink sakura variants), canopy-conforming blossom clusters, and isolated single ripe red apple sprites drawn at varied orientations (upright, tilted left 3/4, tilted right/downward) for realistic cluster stacking.`,
    cellLayout: [],
    userGuide: 'Nền đất cỏ rêu được tách riêng không chứa rễ cây, Thân gỗ kèm bộ rễ cây được vẽ đồng nhất 100% liền khối (không lẹm viền), còn Quả táo đỏ có 3 tư thế hướng khác nhau (thẳng, nghiêng trái, nghiêng phải) để ghép chồng tạo chùm quả sống động.'
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
    'Cụm đá tảng thiên nhiên bóc tách kèm các layer riêng biệt trong dự án: Đế đất & thảm cỏ chân đá nguyên vẹn đủ 4 góc cạnh, Cụm tinh thể phát sáng hậu cảnh, Khối đá tảng chính, Lớp phủ Rêu xanh, Lớp phủ Tuyết trắng mùa đông (ẩn sẵn), Đá cuội tiền cảnh và Khóm hoa dại.',
  descriptionEn:
    'Modular rock formation with complete unclipped 4-corner earthen turf base mound, glowing crystals, main boulder, green moss cap, private toggleable winter snow cap, front pebbles, and wildflowers.',
  width: 500,
  height: 460,
  slots: [
    { id: 'rock-ground', name: '1. Đế đất & Thảm cỏ chân đá', nameEn: 'Ground Soil & Grass Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 105, z: 15, scale: 0.98, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_base_ground.png', description: 'Gò đế đất & thảm cỏ chân đá thấp đáy bằng, nguyên vẹn đủ 4 góc cạnh trái/phải/trên/dưới (bo tròn 2 đầu bằng cỏ rủ & sỏi góc, cách lề >=15%, tuyệt đối không cắt phẳng 2 đầu hay làm mờ trắng đáy), mặt trên lõm ôm khít đáy tảng đá chính' },
    { id: 'rock-crystals', name: '2. Cụm tinh thể phát sáng (Bật/Tắt)', nameEn: 'Glowing Cyan Crystals', role: 'vfx', atlasCell: 2, defaultTransform: { x: 62, y: -32, z: 18, scale: 0.78, rotation: 0 }, defaultMotion: { type: 'breathe', speed: 1.2, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.2 }, suggestedAsset: 'nature_modular/rock_crystal_glow.png', description: 'Tinh thể năng lượng mọc sau tảng đá nguyên vẹn đủ các đỉnh nhọn và chân đế (cách lề >=15%)' },
    { id: 'rock-main', name: '3. Khối đá tảng chính góc cạnh', nameEn: 'Main Faceted Boulder', role: 'body', atlasCell: 3, defaultTransform: { x: 0, y: 18, z: 0, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_boulder_main.png', description: 'Tảng đá lớn trung tâm vát cạnh sắc nét, đáy bo tròn đặt ăn khít vào lòng lõm của Đế đất cỏ' },
    { id: 'rock-cap', name: '4. Lớp phủ Rêu xanh đỉnh đá', nameEn: 'Green Moss Cap', role: 'cap', atlasCell: 4, defaultTransform: { x: 0, y: -54, z: -8, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'nature_modular/rock_moss_cap.png', description: 'Lớp rêu xanh dày phủ ôm khít mặt trên tảng đá chính, nguyên vẹn 4 góc cạnh' },
    { id: 'rock-snow-cap', name: '4B. Lớp phủ Tuyết trắng mùa đông (Ẩn sẵn - Bật để đổi mùa)', nameEn: 'Winter White Snow Cap', role: 'cap-snow', atlasCell: 7, defaultTransform: { x: 0, y: -54, z: -9, scale: 0.82, rotation: 0, hidden: true }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }, suggestedAsset: 'nature_modular/rock_snow_cap.png', description: 'Lớp tuyết trắng phủ đỉnh đá đồng bộ chu vi 1:1 với lớp rêu xanh' },
    { id: 'rock-pebbles', name: '5. Cụm đá cuội tiền cảnh (Z=-20)', nameEn: 'Foreground Pebbles & Stones', role: 'front', atlasCell: 5, defaultTransform: { x: -28, y: 82, z: -20, scale: 0.72, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'nature_modular/rock_stones_front.png', description: 'Các viên đá cuội nhỏ xếp lớp phía trước nguyên vẹn 4 góc cạnh (cách lề >=15%)' },
    { id: 'rock-flowers', name: '6. Khóm hoa dại & Dương xỉ đung đưa', nameEn: 'Swaying Wildflowers & Ferns', role: 'flowers', atlasCell: 6, defaultTransform: { x: 36, y: 68, z: -28, scale: 0.58, rotation: 0 }, defaultMotion: { type: 'sway', speed: 1.1, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'nature_modular/rock_wildflowers.png', description: 'Hoa dại và lá dương xỉ mọc ven chân đá đung đưa theo gió, nguyên vẹn gốc cỏ' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Stylized 2D modular rock formation with complete 4-corner unclipped flat-bottomed earthen grass base mound cradling a main faceted boulder, glowing cyan crystal cluster, contour-hugging green moss cap and winter snow cap, foreground pebbles, and wildflowers.`,
    cellLayout: [],
    userGuide: 'Toàn bộ tài nguyên đế đất cỏ, tảng đá, rêu xanh, tuyết phủ và tinh thể phát sáng được thiết kế đủ 4 góc cạnh (cách lề >=15%, không cắt cụt mép ảnh).'
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
    { id: 'bonsai-foliage-back', name: 'Tán lá tùng sau (Hậu cảnh Z=+35)', nameEn: 'Background Foliage', role: 'back-foliage', atlasCell: 3, defaultTransform: { x: 4, y: -28, z: 35, scale: 0.88, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_back.png', description: 'Tán lá tùng phía sau tạo chiều sâu nguyên vẹn 4 góc cạnh (cách lề >=15%)' },
    { id: 'bonsai-pot', name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)', nameEn: 'Ceramic Pot Base', role: 'base', atlasCell: 1, defaultTransform: { x: 0, y: 168, z: 12, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, suggestedAsset: 'assembly_3d/modular/bonsai_pot.png', description: 'Chậu gốm Tử Sa cổ điển đầy đủ vành chậu, chân đế và mặt đất rêu (cách lề >=15%)' },
    { id: 'bonsai-trunk', name: 'Thân cổ thụ uốn lượn phong trần', nameEn: 'Gnarled Wood Trunk', role: 'trunk', atlasCell: 2, defaultTransform: { x: 0, y: -38, z: 0, scale: 0.82, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }, suggestedAsset: 'assembly_3d/modular/bonsai_trunk.png', description: 'Thân gỗ uốn lượn có bộ rễ nổi cắm khít vào mặt đất trong chậu gốm' },
    { id: 'bonsai-foliage-mid', name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=-4)', nameEn: 'Midground Foliage', role: 'mid-foliage', atlasCell: 4, defaultTransform: { x: -4, y: -18, z: -4, scale: 0.85, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_mid.png', description: 'Tán lá tùng chính giữa thân cây nguyên vẹn 4 góc cạnh' },
    { id: 'bonsai-foliage-front', name: 'Nhánh non vươn nắng (Tiền cảnh Z=-28)', nameEn: 'Foreground Foliage', role: 'front-foliage', atlasCell: 5, defaultTransform: { x: 10, y: -8, z: -28, scale: 0.8, rotation: 0 }, defaultMotion: { type: 'sway', speed: 0.9, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }, suggestedAsset: 'assembly_3d/modular/bonsai_foliage_front.png', description: 'Tán lá non vươn về phía trước đón nắng' }
  ],
  bones: [],
  clips: [],
  activeClipId: '',
  promptGuide: {
    systemPrompt: `IDENTITY: Ancient Japanese Juniper / Pine Bonsai in complete unclipped antique dark clay pot with bronze rim, gnarled trunk with roots anchored into the pot soil, and 3 depth-separated cloud-like foliage layers.`,
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
