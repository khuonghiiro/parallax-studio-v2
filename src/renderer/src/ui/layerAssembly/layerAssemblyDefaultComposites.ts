import { CUTOUT_HERO_COMPOSITE } from './cutoutHeroComposite'
import { TMPL_CHARACTER_QUARTER } from './templates/humanoidTemplates'
import type { LayerComposite } from './types'

const HUMAN_QUARTER_COMPOSITE: LayerComposite = {
  ...TMPL_CHARACTER_QUARTER.buildComposite(),
  id: 'comp-character-human-quarter'
}

/**
 * Danh sách 5 mẫu cụm layer dựng sẵn (Presets):
 * - 2 mẫu nhân vật Anime 2.5D bóc tách 13 mảnh tỉ lệ gốc 1:1 (Mẫu minh hoạ kính cận & Nam sinh học viện tương tự)
 * - 3 mẫu thiên nhiên bóc tách được giữ lại theo yêu cầu: Cây Đại Thụ Bóc Tách, Cụm Đá Rêu Phong & Tinh Thể Bóc Tách, Cây Bonsai Cổ Thụ Đung Đưa
 */
export const BUILTIN_COMPOSITES: LayerComposite[] = [
  CUTOUT_HERO_COMPOSITE,
  HUMAN_QUARTER_COMPOSITE,
  {
    id: 'comp-modular-tree',
    name: 'Cây Đại Thụ Bóc Tách (Đổi Tán Lá Xanh / Vàng / Hoa / Quả)',
    category: 'nature',
    description:
      'Cây cổ thụ 2.5D bóc tách kèm các layer biến thể riêng theo dự án: Nền đất & thảm cỏ rêu riêng (không chứa rễ cây), Thân gỗ đại thụ kèm cả bộ rễ cây liền khối, 3 tầng Tán lá Xanh (kèm Tán lá Vàng & Sakura ẩn sẵn để đổi mùa), Hoa nở trắng hồng và 6 layer Quả táo đỏ lẻ tẻ để ghép chồng tạo chùm quả.',
    width: 550,
    height: 600,
    layers: [
      {
        id: 'tree-roots',
        name: '1. Nền đất & Thảm cỏ rêu (Đế đất riêng, không rễ)',
        assetPath: 'nature_modular/tree_roots_moss.png',
        x: 0,
        y: 162,
        z: 14,
        scale: 0.92,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'tree-foliage-back',
        name: '2. Tán lá xanh hậu cảnh (Z=+35)',
        assetPath: 'nature_modular/tree_foliage_back_green.png',
        x: 0,
        y: -92,
        z: 35,
        scale: 1.16,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }
      },
      {
        id: 'tree-foliage-back-gold',
        name: '2B. Tán lá vàng hậu cảnh (Ẩn sẵn - Bật để đổi mùa thu)',
        assetPath: 'nature_modular/tree_foliage_back_gold.png',
        x: 0,
        y: -92,
        z: 34,
        scale: 1.16,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }
      },
      {
        id: 'tree-trunk',
        name: '3. Thân gỗ đại thụ & Bộ rễ cây liền khối',
        assetPath: 'nature_modular/tree_trunk_branches.png',
        x: 0,
        y: 36,
        z: 4,
        scale: 0.8,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }
      },
      {
        id: 'tree-foliage-mid',
        name: '4. Tán lá xanh trung cảnh (Z=-5)',
        assetPath: 'nature_modular/tree_foliage_mid_green.png',
        x: 0,
        y: -78,
        z: -5,
        scale: 1.04,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'tree-foliage-mid-gold',
        name: '4B. Tán lá vàng trung cảnh (Ẩn sẵn - Bật để đổi mùa thu)',
        assetPath: 'nature_modular/tree_foliage_mid_gold.png',
        x: 0,
        y: -78,
        z: -6,
        scale: 1.04,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'tree-foliage-mid-sakura',
        name: '4C. Tán hoa anh đào Sakura trung cảnh (Ẩn sẵn)',
        assetPath: 'nature_modular/tree_foliage_mid_sakura.png',
        x: 0,
        y: -78,
        z: -7,
        scale: 1.04,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'tree-foliage-front',
        name: '5. Tán lá xanh tiền cảnh đón nắng (Z=-25)',
        assetPath: 'nature_modular/tree_foliage_front_green.png',
        x: 0,
        y: -108,
        z: -25,
        scale: 0.86,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }
      },
      {
        id: 'tree-foliage-front-gold',
        name: '5B. Tán lá vàng tiền cảnh (Ẩn sẵn - Bật để đổi mùa thu)',
        assetPath: 'nature_modular/tree_foliage_front_gold.png',
        x: 0,
        y: -108,
        z: -26,
        scale: 0.86,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }
      },
      {
        id: 'tree-blossoms',
        name: '6. Layer Hoa nở trắng hồng (Bật/Tắt)',
        assetPath: 'nature_modular/tree_blossoms_cluster.png',
        x: 0,
        y: -88,
        z: -35,
        scale: 0.92,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.42 }
      },
      {
        id: 'tree-fruits',
        name: '7A. Quả táo đỏ lẻ #1 (Hướng thẳng - Cụm trái)',
        assetPath: 'nature_modular/tree_fruits_apples.png',
        x: -78,
        y: -96,
        z: -40,
        scale: 0.3,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }
      },
      {
        id: 'tree-fruits-2',
        name: '7B. Quả táo đỏ lẻ #2 (Nghiêng trái 3/4 - Ghép chùm trái)',
        assetPath: 'nature_modular/tree_fruit_apple_tilt_left.png',
        x: -54,
        y: -84,
        z: -42,
        scale: 0.31,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.55 }
      },
      {
        id: 'tree-fruits-3',
        name: '7C. Quả táo đỏ lẻ #3 (Nghiêng phải - Ghép chùm trái)',
        assetPath: 'nature_modular/tree_fruit_apple_tilt_right.png',
        x: -66,
        y: -70,
        z: -44,
        scale: 0.29,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.35 }
      },
      {
        id: 'tree-fruits-4',
        name: '7D. Quả táo đỏ lẻ #4 (Nghiêng trái 3/4 - Đỉnh tán)',
        assetPath: 'nature_modular/tree_fruit_apple_tilt_left.png',
        x: -6,
        y: -152,
        z: -41,
        scale: 0.29,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.6 }
      },
      {
        id: 'tree-fruits-5',
        name: '7E. Quả táo đỏ lẻ #5 (Hướng thẳng - Cụm phải)',
        assetPath: 'nature_modular/tree_fruits_apples.png',
        x: 56,
        y: -104,
        z: -40,
        scale: 0.3,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.65 }
      },
      {
        id: 'tree-fruits-6',
        name: '7F. Quả táo đỏ lẻ #6 (Nghiêng phải - Ghép chùm phải)',
        assetPath: 'nature_modular/tree_fruit_apple_tilt_right.png',
        x: 78,
        y: -90,
        z: -43,
        scale: 0.31,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.45 }
      }
    ]
  },
  {
    id: 'comp-modular-rock',
    name: 'Cụm Đá Rêu Phong & Tinh Thể Bóc Tách (Đổi Rêu / Tuyết)',
    category: 'nature',
    description:
      'Cụm đá tảng thiên nhiên bóc tách kèm các layer riêng theo dự án: Đế đất cỏ, Cụm tinh thể phát sáng hậu cảnh, Khối đá tảng chính, Lớp phủ đỉnh đá (Rêu xanh & Tuyết trắng mùa đông ẩn sẵn), Đá cuội tiền cảnh và Khóm hoa dại.',
    width: 500,
    height: 460,
    layers: [
      {
        id: 'rock-ground',
        name: '1. Đế đất & Thảm cỏ chân đá',
        assetPath: 'nature_modular/rock_base_ground.png',
        x: 0,
        y: 105,
        z: 15,
        scale: 0.98,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'rock-crystals',
        name: '2. Cụm tinh thể phát sáng (Bật/Tắt)',
        assetPath: 'nature_modular/rock_crystal_glow.png',
        x: 62,
        y: -32,
        z: 18,
        scale: 0.78,
        rotation: 0,
        opacity: 1,
        motion: { type: 'breathe', speed: 1.2, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.2 }
      },
      {
        id: 'rock-main',
        name: '3. Khối đá tảng chính góc cạnh',
        assetPath: 'nature_modular/rock_boulder_main.png',
        x: 0,
        y: 18,
        z: 0,
        scale: 0.88,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'rock-cap',
        name: '4. Lớp phủ Rêu xanh đỉnh đá',
        assetPath: 'nature_modular/rock_moss_cap.png',
        x: 0,
        y: -54,
        z: -8,
        scale: 0.82,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'rock-snow-cap',
        name: '4B. Lớp phủ Tuyết trắng mùa đông (Ẩn sẵn - Bật để đổi mùa)',
        assetPath: 'nature_modular/rock_snow_cap.png',
        x: 0,
        y: -54,
        z: -9,
        scale: 0.82,
        rotation: 0,
        opacity: 1,
        hidden: true,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'rock-pebbles',
        name: '5. Cụm đá cuội tiền cảnh (Z=-20)',
        assetPath: 'nature_modular/rock_stones_front.png',
        x: -28,
        y: 82,
        z: -20,
        scale: 0.72,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'rock-flowers',
        name: '6. Khóm hoa dại & Dương xỉ đung đưa',
        assetPath: 'nature_modular/rock_wildflowers.png',
        x: 36,
        y: 68,
        z: -28,
        scale: 0.58,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.3 }
      }
    ]
  },
  {
    id: 'comp-bonsai-zen',
    name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp',
    category: 'nature',
    description:
      'Nghệ thuật Bonsai phân tách 5 tầng chiều sâu: Chậu gốm Tử Sa viền đồng, Thân gỗ uốn khúc, Tán sau mờ xa, Tán chính ngọc bích và Tán trước đón nắng.',
    width: 550,
    height: 600,
    layers: [
      {
        id: 'bonsai-foliage-back',
        name: 'Tán lá tùng sau (Hậu cảnh Z=+35)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_back.png',
        x: 4,
        y: -28,
        z: 35,
        scale: 0.88,
        rotation: 0,
        opacity: 0.92,
        motion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }
      },
      {
        id: 'bonsai-pot',
        name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)',
        assetPath: 'assembly_3d/modular/bonsai_pot.png',
        x: 0,
        y: 168,
        z: 12,
        scale: 0.8,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'bonsai-trunk',
        name: 'Thân cổ thụ uốn lượn phong trần',
        assetPath: 'assembly_3d/modular/bonsai_trunk.png',
        x: 0,
        y: -38,
        z: 0,
        scale: 0.82,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }
      },
      {
        id: 'bonsai-foliage-mid',
        name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=-4)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_mid.png',
        x: -4,
        y: -18,
        z: -4,
        scale: 0.85,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'bonsai-foliage-front',
        name: 'Nhánh non vươn nắng (Tiền cảnh Z=-28)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_front.png',
        x: 10,
        y: -8,
        z: -28,
        scale: 0.8,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.9, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }
      }
    ]
  }
]
