import { CUTOUT_HERO_COMPOSITE } from './cutoutHeroComposite'
import type { LayerComposite } from './types'

/**
 * Các mẫu cụm layer dựng sẵn (Presets) minh họa việc ghép cây, nhà, nhân vật 2.5D từ các layer xếp chồng và hoạt ảnh dẻo dai.
 */
export const BUILTIN_COMPOSITES: LayerComposite[] = [
  {
    id: 'comp-modular-tree',
    name: 'Cây Đại Thụ Bóc Tách (Đổi Tán Lá Xanh / Vàng / Hoa / Quả)',
    category: 'nature',
    description: 'Cây cổ thụ 2.5D bóc tách 7 layer: Gốc rễ rêu phong, Thân gỗ & Cành nhánh, 3 tầng Tán lá (dễ dàng đổi sang tán lá vàng mùa thu hoặc hoa anh đào), kèm Layer Hoa nở và Layer Quả táo đỏ có thể bật/tắt.',
    width: 550,
    height: 600,
    layers: [
      {
        id: 'tree-roots',
        name: '1. Gốc rễ & Thảm cỏ rêu (Đế tĩnh)',
        assetPath: 'nature_modular/tree_roots_moss.png',
        x: 0,
        y: 150,
        z: -5,
        scale: 0.72,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'tree-foliage-back',
        name: '2. Tán lá hậu cảnh (Đổi Xanh / Vàng)',
        assetPath: 'nature_modular/tree_foliage_back_green.png',
        x: 0,
        y: -62,
        z: 35,
        scale: 1.15,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.75, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.25 }
      },
      {
        id: 'tree-trunk',
        name: '3. Thân gỗ đại thụ & Cành nhánh',
        assetPath: 'nature_modular/tree_trunk_branches.png',
        x: 0,
        y: 46,
        z: 12,
        scale: 0.78,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.6, amplitude: 1.8, anchor: 'bottom', phaseOffset: 0.05 }
      },
      {
        id: 'tree-foliage-mid',
        name: '4. Tán lá trung cảnh (Đổi Xanh / Vàng / Sakura)',
        assetPath: 'nature_modular/tree_foliage_mid_green.png',
        x: 0,
        y: -74,
        z: -5,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.85, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'tree-foliage-front',
        name: '5. Tán lá tiền cảnh đón nắng (Đổi Xanh / Vàng)',
        assetPath: 'nature_modular/tree_foliage_front_green.png',
        x: 0,
        y: -102,
        z: -25,
        scale: 0.88,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.4 }
      },
      {
        id: 'tree-blossoms',
        name: '6. Layer Hoa nở trắng hồng (Bật/Tắt)',
        assetPath: 'nature_modular/tree_blossoms_cluster.png',
        x: 0,
        y: -78,
        z: -35,
        scale: 0.88,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.95, amplitude: 5.5, anchor: 'bottom', phaseOffset: 0.42 }
      },
      {
        id: 'tree-fruits',
        name: '7. Layer Quả táo đỏ chín mọng (Bật/Tắt)',
        assetPath: 'nature_modular/tree_fruits_apples.png',
        x: 0,
        y: -55,
        z: -42,
        scale: 0.68,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.1, amplitude: 4.0, anchor: 'top', phaseOffset: 0.5 }
      }
    ]
  },
  {
    id: 'comp-modular-rock',
    name: 'Cụm Đá Rêu Phong & Tinh Thể Bóc Tách (Đổi Rêu / Tuyết)',
    category: 'nature',
    description: 'Cụm đá tảng thiên nhiên bóc tách 6 layer: Đế đất cỏ, Cụm tinh thể phát sáng hậu cảnh, Khối đá tảng chính, Lớp phủ đỉnh đá (Rêu xanh / Tuyết trắng), Đá cuội tiền cảnh và Khóm hoa dại.',
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
        name: '4. Lớp phủ đỉnh đá (Đổi Rêu xanh / Tuyết trắng)',
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
    description: 'Nghệ thuật Bonsai phân tách 5 tầng chiều sâu: Chậu gốm Tử Sa viền đồng, Thân gỗ uốn khúc, Tán sau mờ xa, Tán chính ngọc bích và Tán trước đón nắng.',
    width: 550,
    height: 600,
    layers: [
      {
        id: 'bonsai-pot',
        name: 'Chậu gốm Tử Sa viền đồng (Gốc neo)',
        assetPath: 'assembly_3d/modular/bonsai_pot.png',
        x: 0,
        y: 155,
        z: -5,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'bonsai-trunk',
        name: 'Thân cổ thụ uốn lượn phong trần',
        assetPath: 'assembly_3d/modular/bonsai_trunk.png',
        x: 0,
        y: 10,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.6, amplitude: 2.2, anchor: 'bottom', phaseOffset: 0.05 }
      },
      {
        id: 'bonsai-foliage-back',
        name: 'Tán lá tùng sau (Hậu cảnh Z=+35)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_back.png',
        x: 5,
        y: -60,
        z: 35,
        scale: 0.95,
        rotation: 0,
        opacity: 0.9,
        motion: { type: 'sway', speed: 0.8, amplitude: 3.5, anchor: 'bottom', phaseOffset: 0.3 }
      },
      {
        id: 'bonsai-foliage-mid',
        name: 'Tán tùng chính bồng bềnh (Trung cảnh Z=0)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_mid.png',
        x: -10,
        y: -90,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.7, amplitude: 4.5, anchor: 'bottom', phaseOffset: 0.15 }
      },
      {
        id: 'bonsai-foliage-front',
        name: 'Nhánh non vươn nắng (Tiền cảnh Z=-30)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_front.png',
        x: 25,
        y: -40,
        z: -30,
        scale: 1.02,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.9, amplitude: 6.0, anchor: 'bottom', phaseOffset: 0.4 }
      }
    ]
  },
  {
    id: 'comp-flower-bush',
    name: 'Bụi Hoa Tự Nhiên Rung Rinh Trong Gió',
    category: 'nature',
    description: 'Bụi hoa nhiều lớp gồm cỏ nền, cành hoa, cánh hoa đỏ và nhụy hoa vàng đung đưa theo gió sinh động.',
    width: 500,
    height: 500,
    layers: [
      {
        id: 'layer-grass-base',
        name: 'Bụi cỏ xanh nền sau',
        assetPath: 'assembly_3d/modular/nature_grass.png',
        x: 0,
        y: 95,
        z: 20,
        scale: 0.85,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.8, amplitude: 8, anchor: 'bottom', phaseOffset: 0.1 }
      },
      {
        id: 'layer-flower-stem',
        name: 'Thân cành hoa uốn lượn',
        assetPath: 'assembly_3d/modular/nature_flower_stem.png',
        x: 0,
        y: 15,
        z: 5,
        scale: 0.65,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 12, anchor: 'bottom', phaseOffset: 0.3 }
      },
      {
        id: 'layer-flower-petal',
        name: 'Cánh hoa đỏ tươi',
        assetPath: 'assembly_3d/modular/nature_flower_corolla.png',
        x: 4,
        y: -88,
        z: -18,
        scale: 0.56,
        rotation: 2,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.4, amplitude: 20, anchor: 'center', phaseOffset: 0.6 }
      },
      {
        id: 'layer-flower-center',
        name: 'Nhụy hoa rực rỡ',
        assetPath: 'assembly_3d/modular/nature_flower_center.png',
        x: 4,
        y: -88,
        z: -25,
        scale: 0.22,
        rotation: 0,
        opacity: 1,
        motion: { type: 'breathe', speed: 1.2, amplitude: 8, anchor: 'center', phaseOffset: 0.4 }
      }
    ]
  },
  {
    id: 'comp-vines-ruins',
    name: 'Cây Dây Leo & Đom Đóm Đung Đưa',
    category: 'nature',
    description: 'Chi tiết tự nhiên gồm vách cổng rêu phong, dây leo rủ đung đưa phía trước và đàn đom đóm lập lòe.',
    width: 600,
    height: 650,
    layers: [
      {
        id: 'layer-ruins',
        name: 'Cổng tàn tích cổ',
        assetPath: 'demo_transparent/layer4_ancient_ruins.png',
        x: 0,
        y: 40,
        z: 15,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'layer-vines',
        name: 'Dây leo rủ tiền cảnh',
        assetPath: 'demo_transparent/layer5_foreground_vines.png',
        x: 0,
        y: -60,
        z: -20,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.9, amplitude: 18, anchor: 'top', phaseOffset: 0.1 }
      }
    ]
  },
  {
    id: 'comp-balcony-window',
    name: 'Cửa Sổ Ban Công & Giàn Hoa Rung Rinh',
    category: 'architecture',
    description: 'Khung cửa gỗ cổ điển kết hợp bồn hoa rực rỡ và nhánh lá cây đung đưa trước gió.',
    width: 520,
    height: 580,
    layers: [
      {
        id: 'layer-window',
        name: 'Khung cửa sổ Tudor',
        assetPath: 'assembly_3d/modular/decor_window.png',
        x: 0,
        y: -40,
        z: 15,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-flower-box',
        name: 'Hộp hoa ban công',
        assetPath: 'assembly_3d/modular/decor_flower_box.png',
        x: 0,
        y: 80,
        z: -5,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'breathe', speed: 1.0, amplitude: 5, anchor: 'bottom', phaseOffset: 0.2 }
      },
      {
        id: 'layer-green-leaf',
        name: 'Nhánh lá cây rung rinh',
        assetPath: 'assembly_3d/modular/nature_leaf.png',
        x: 118,
        y: 65,
        z: -18,
        scale: 0.34,
        rotation: 32,
        opacity: 1,
        motion: { type: 'sway', speed: 1.3, amplitude: 16, anchor: 'bottom', phaseOffset: 0.5 }
      }
    ]
  },
  CUTOUT_HERO_COMPOSITE
]

