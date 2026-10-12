import { CUTOUT_HERO_COMPOSITE } from './cutoutHeroComposite'
import type { LayerComposite } from './types'

/**
 * Các mẫu cụm layer dựng sẵn (Presets) minh họa việc ghép cây, nhà, nhân vật 2.5D từ các layer xếp chồng và hoạt ảnh dẻo dai.
 */
export const BUILTIN_COMPOSITES: LayerComposite[] = [
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
        y: 80,
        z: 20,
        scale: 1.1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.8, amplitude: 8, anchor: 'bottom', phaseOffset: 0.1 }
      },
      {
        id: 'layer-flower-stem',
        name: 'Thân cành hoa uốn lượn',
        assetPath: 'assembly_3d/modular/nature_flower_stem.png',
        x: -10,
        y: 10,
        z: 5,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 12, anchor: 'bottom', phaseOffset: 0.3 }
      },
      {
        id: 'layer-flower-petal',
        name: 'Cánh hoa đỏ tươi',
        assetPath: 'assembly_3d/modular/nature_flower_petal.png',
        x: -5,
        y: -110,
        z: -18,
        scale: 0.95,
        rotation: 2,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.4, amplitude: 20, anchor: 'center', phaseOffset: 0.6 }
      },
      {
        id: 'layer-flower-center',
        name: 'Nhụy hoa rực rỡ',
        assetPath: 'assembly_3d/modular/nature_flower_center.png',
        x: -5,
        y: -110,
        z: -25,
        scale: 0.85,
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
        x: 90,
        y: 40,
        z: -18,
        scale: 0.8,
        rotation: 25,
        opacity: 1,
        motion: { type: 'sway', speed: 1.3, amplitude: 16, anchor: 'bottom', phaseOffset: 0.5 }
      }
    ]
  },
  CUTOUT_HERO_COMPOSITE
]

